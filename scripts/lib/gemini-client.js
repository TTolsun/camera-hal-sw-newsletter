const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
const defaultModel = 'gemini-2.5-flash';
const defaultFallbackModels = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite-preview'];
const primaryModel = process.env.GEMINI_MODEL || defaultModel;
const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || defaultFallbackModels.join(','))
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);
const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const configuredMaxRetries = Number(process.env.GEMINI_MAX_RETRIES || 3);
const maxRetries = Number.isFinite(configuredMaxRetries) && configuredMaxRetries >= 0
  ? Math.floor(configuredMaxRetries)
  : 3;
const retryDelaysMs = (process.env.GEMINI_RETRY_DELAYS_MS || '2000,5000,10000')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(value => Number.isFinite(value) && value >= 0);
const effectiveRetryDelaysMs = retryDelaysMs.length > 0 ? retryDelaysMs : [2000, 5000, 10000];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function extractJson(text, stage) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    fail(`[${stage}] Gemini returned an empty response.`);
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const firstObject = candidate.indexOf('{');
    const lastObject = candidate.lastIndexOf('}');
    const firstArray = candidate.indexOf('[');
    const lastArray = candidate.lastIndexOf(']');

    const objectJson = firstObject !== -1 && lastObject > firstObject
      ? candidate.slice(firstObject, lastObject + 1)
      : '';
    const arrayJson = firstArray !== -1 && lastArray > firstArray
      ? candidate.slice(firstArray, lastArray + 1)
      : '';

    for (const value of [objectJson, arrayJson]) {
      if (!value) continue;
      try {
        return JSON.parse(value);
      } catch (_) {
        // Try the next extraction shape.
      }
    }
  }

  fail(`[${stage}] Gemini output was not valid JSON.`);
}

function schemaConfig(responseSchema) {
  return {
    responseMimeType: 'application/json',
    responseSchema,
    temperature: 0.35
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function configuredModels() {
  return [primaryModel, ...fallbackModels].filter((item, index, items) => items.indexOf(item) === index);
}

function apiVersionForModel(modelName) {
  if (process.env.GEMINI_API_VERSION) return process.env.GEMINI_API_VERSION;
  return undefined;
}

function clientOptions(apiVersion) {
  return apiVersion ? { apiKey, apiVersion } : { apiKey };
}

function errorStatus(error) {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.code,
    error?.response?.status,
    error?.cause?.status
  ];

  for (const value of candidates) {
    const status = Number(value);
    if (retryableStatuses.has(status)) return status;
  }

  const message = String(error?.message || '');
  const match = message.match(/\b(429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

function lastStatus(error) {
  const directStatus = errorStatus(error);
  if (directStatus) return directStatus;

  const candidates = [
    error?.status,
    error?.statusCode,
    error?.code,
    error?.response?.status,
    error?.cause?.status
  ];

  for (const value of candidates) {
    const status = Number(value);
    if (Number.isFinite(status)) return status;
  }

  const message = String(error?.message || '');
  const match = message.match(/\b([1-5]\d\d)\b/);
  return match ? Number(match[1]) : 'unknown';
}

function isRetryableError(error) {
  if (errorStatus(error)) return true;
  return /\b(UNAVAILABLE|RESOURCE_EXHAUSTED|rate limit|high demand|temporarily unavailable)\b/i
    .test(String(error?.message || ''));
}

function retryDelay(attempt) {
  return effectiveRetryDelaysMs[attempt - 1] ?? effectiveRetryDelaysMs[effectiveRetryDelaysMs.length - 1];
}

async function generateContentWithRetry(stage, ai, request, modelName) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      console.log(`[${stage}] Gemini request attempt ${attempt}/${maxRetries + 1} using model ${modelName}.`);
      return await ai.models.generateContent(request);
    } catch (error) {
      lastError = error;
      const retryable = isRetryableError(error);
      if (!retryable || attempt > maxRetries) break;

      const delayMs = retryDelay(attempt);
      const status = errorStatus(error) || 'unknown';
      console.warn(
        `[${stage}] Gemini API retry ${attempt}/${maxRetries} for model ${modelName} after status ${status}: ${error.message}. Waiting ${delayMs}ms.`
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function failureSummary(stage, failures) {
  const lines = [
    `[${stage}] Gemini API failed for all configured models.`,
    `Tried models: ${failures.map(item => item.model).join(', ')}`,
    `Retries per model: ${maxRetries}`,
    'Last error by model:'
  ];

  for (const item of failures) {
    lines.push(`- ${item.model}: status ${item.status}; ${item.message}`);
  }

  lines.push('Gemini API capacity issue is likely. Re-run the job or check fallback model availability.');
  return lines.join('\n');
}

async function callGeminiJson(stage, systemInstruction, prompt, responseSchema) {
  if (!apiKey) {
    fail('Missing GEMINI_API_KEY. Add it in GitHub repository Settings > Secrets and variables > Actions.');
  }

  const failures = [];
  for (const modelName of configuredModels()) {
    const apiVersion = apiVersionForModel(modelName);
    const ai = new GoogleGenAI(clientOptions(apiVersion));
    console.log(`[${stage}] Gemini model selected: ${modelName} (apiVersion ${apiVersion || 'sdk-default'}).`);

    let response;
    try {
      response = await generateContentWithRetry(stage, ai, {
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          ...schemaConfig(responseSchema)
        }
      }, modelName);
    } catch (error) {
      failures.push({
        model: modelName,
        status: lastStatus(error),
        message: error.message
      });

      if (!isRetryableError(error)) {
        fail(`[${stage}] Gemini API failed with non-retryable error on model ${modelName}: ${error.message}`);
      }

      console.warn(`[${stage}] Gemini model ${modelName} failed after ${maxRetries} retries. Trying fallback model if configured.`);
      continue;
    }

    console.log(`[${stage}] Gemini API succeeded with model ${modelName}.`);
    const text = typeof response.text === 'function' ? response.text() : response.text;
    return extractJson(text, stage);
  }

  fail(failureSummary(stage, failures));
}

module.exports = {
  callGeminiJson,
  extractJson
};
