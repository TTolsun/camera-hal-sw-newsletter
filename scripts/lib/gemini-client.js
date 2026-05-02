const fs = require('fs');
const path = require('path');
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
const configuredMaxRetryDelayMs = Number(process.env.GEMINI_RETRY_MAX_DELAY_MS || 60000);
const maxRetryDelayMs = Number.isFinite(configuredMaxRetryDelayMs) && configuredMaxRetryDelayMs >= 0
  ? configuredMaxRetryDelayMs
  : 60000;
const rawOutputRoot = process.env.GEMINI_RAW_OUTPUT_DIR || path.join(process.cwd(), '.tmp', 'gemini-raw');

class GeminiJsonParseError extends Error {
  constructor(stage, message, rawText = '') {
    super(`[${stage}] ${message}`);
    this.name = 'GeminiJsonParseError';
    this.stage = stage;
    this.rawText = String(rawText || '');
  }
}

const diagnostics = {
  quota_error_count: 0,
  invalid_json_count: 0,
  model_usage: {}
};
const modelUsageByStage = new Map();

function fail(message) {
  throw new Error(message);
}

function safeFilenamePart(value) {
  const safe = String(value || 'unknown')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return safe || 'unknown';
}

function extractJson(text, stage) {
  const rawText = String(text || '');
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new GeminiJsonParseError(stage, 'Gemini returned an empty response.', rawText);
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

  throw new GeminiJsonParseError(stage, 'Gemini output was not valid JSON.', rawText);
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

function errorText(error) {
  return [
    error?.message,
    error?.statusDetails,
    error?.details,
    error?.response?.data,
    error?.response?.body,
    error?.cause?.message
  ].map(value => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }).filter(Boolean).join('\n');
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

  const match = errorText(error).match(/\b(429|500|502|503|504)\b/);
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

  const match = errorText(error).match(/\b([1-5]\d\d)\b/);
  return match ? Number(match[1]) : 'unknown';
}

function parseDurationToMs(value, unit = 's') {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  const normalizedUnit = String(unit || 's').toLowerCase();
  if (normalizedUnit.startsWith('ms') || normalizedUnit.startsWith('milli')) return Math.round(number);
  if (normalizedUnit.startsWith('m') && !normalizedUnit.startsWith('milli')) return Math.round(number * 60 * 1000);
  return Math.round(number * 1000);
}

function parseRetryDelayMs(error) {
  const text = errorText(error);
  const retryIn = text.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)\s*(ms|milliseconds?|s|seconds?|m|minutes?)?/i);
  if (retryIn) return parseDurationToMs(retryIn[1], retryIn[2] || 's');

  const retryDelay = text.match(/["']?retryDelay["']?\s*:\s*["']?([0-9]+(?:\.[0-9]+)?)(ms|s|m)?["']?/i);
  if (retryDelay) return parseDurationToMs(retryDelay[1], retryDelay[2] || 's');

  return null;
}

function isRetryableError(error) {
  if (errorStatus(error)) return true;
  return /\b(UNAVAILABLE|RESOURCE_EXHAUSTED|rate limit|high demand|temporarily unavailable|quota)\b/i
    .test(errorText(error));
}

function isQuotaError(error) {
  const text = errorText(error);
  return errorStatus(error) === 429 ||
    /\b(RESOURCE_EXHAUSTED|quota|rate limit|too many requests)\b/i.test(text);
}

function isFreeTierQuotaExhausted(error) {
  const text = errorText(error);
  return isQuotaError(error) &&
    /(daily|per\s*day|GenerateRequestsPerDay|RequestsPerDay|free[_\s-]*tier.*(?:daily|per\s*day)|(?:daily|per\s*day).*free[_\s-]*tier)/i.test(text);
}

function retryDelay(attempt, error) {
  const hintedDelay = parseRetryDelayMs(error);
  if (hintedDelay !== null) return Math.min(hintedDelay, maxRetryDelayMs);
  return effectiveRetryDelaysMs[attempt - 1] ?? effectiveRetryDelaysMs[effectiveRetryDelaysMs.length - 1];
}

function usageFor(stage, modelName) {
  if (!diagnostics.model_usage[stage]) diagnostics.model_usage[stage] = {};
  if (!diagnostics.model_usage[stage][modelName]) {
    diagnostics.model_usage[stage][modelName] = {
      requests: 0,
      successes: 0,
      invalid_json: 0,
      quota_errors: 0,
      api_errors: 0
    };
  }
  return diagnostics.model_usage[stage][modelName];
}

function cloneDiagnostics() {
  return JSON.parse(JSON.stringify(diagnostics));
}

function resetGeminiDiagnostics() {
  diagnostics.quota_error_count = 0;
  diagnostics.invalid_json_count = 0;
  diagnostics.model_usage = {};
  modelUsageByStage.clear();
}

function recordQuotaError(stage, modelName) {
  diagnostics.quota_error_count += 1;
  usageFor(stage, modelName).quota_errors += 1;
}

function recordApiError(stage, modelName) {
  usageFor(stage, modelName).api_errors += 1;
}

function recordInvalidJson(stage, modelName) {
  diagnostics.invalid_json_count += 1;
  usageFor(stage, modelName).invalid_json += 1;
}

function saveRawGeminiOutput(stage, attempt, modelName, text) {
  fs.mkdirSync(rawOutputRoot, { recursive: true });
  const fileName = `${safeFilenamePart(stage)}-attempt-${attempt}-${safeFilenamePart(modelName)}.txt`;
  const filePath = path.join(rawOutputRoot, fileName);
  fs.writeFileSync(filePath, String(text || ''), 'utf8');
  return filePath;
}

async function generateContentJsonWithRetry(stage, ai, request, modelName) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      usageFor(stage, modelName).requests += 1;
      console.log(`[${stage}] Gemini request attempt ${attempt}/${maxRetries + 1} using model ${modelName}.`);
      const response = await ai.models.generateContent(request);
      const text = typeof response.text === 'function' ? response.text() : response.text;
      const json = extractJson(text, stage);
      usageFor(stage, modelName).successes += 1;
      return json;
    } catch (error) {
      lastError = error;

      if (error instanceof GeminiJsonParseError) {
        recordInvalidJson(stage, modelName);
        const rawPath = saveRawGeminiOutput(stage, attempt, modelName, error.rawText);
        if (attempt > maxRetries) break;
        const delayMs = retryDelay(attempt, error);
        console.warn(
          `[${stage}] Gemini returned invalid JSON for model ${modelName}; raw output saved to ${path.relative(process.cwd(), rawPath)}. Retrying in ${delayMs}ms.`
        );
        await sleep(delayMs);
        continue;
      }

      if (isQuotaError(error)) recordQuotaError(stage, modelName);
      else recordApiError(stage, modelName);

      const retryable = isRetryableError(error);
      if (!retryable || attempt > maxRetries) break;

      if (isFreeTierQuotaExhausted(error)) {
        console.warn(`[${stage}] Gemini quota appears exhausted for model ${modelName}; skipping remaining retries for this model.`);
        break;
      }

      const delayMs = retryDelay(attempt, error);
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

  lines.push('Gemini API capacity or model-output quality issue is likely. Review .tmp/gemini-raw artifacts, re-run the job, or check fallback model availability.');
  return lines.join('\n');
}

async function callGeminiJson(stage, systemInstruction, prompt, responseSchema, options = {}) {
  const key = options.apiKey || apiKey;
  if (!key) {
    fail('Missing GEMINI_API_KEY. Add it in GitHub repository Settings > Secrets and variables > Actions.');
  }

  const ClientCtor = options.GoogleGenAI || GoogleGenAI;
  const failures = [];
  for (const modelName of configuredModels()) {
    const apiVersion = apiVersionForModel(modelName);
    const ai = options.ai || new ClientCtor(apiVersion ? { apiKey: key, apiVersion } : { apiKey: key });
    console.log(`[${stage}] Gemini model selected: ${modelName} (apiVersion ${apiVersion || 'sdk-default'}).`);

    try {
      const json = await generateContentJsonWithRetry(stage, ai, {
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          ...schemaConfig(responseSchema)
        }
      }, modelName);
      console.log(`[${stage}] Gemini API succeeded with model ${modelName}.`);
      modelUsageByStage.set(stage, modelName);
      return json;
    } catch (error) {
      failures.push({
        model: modelName,
        status: lastStatus(error),
        message: error.message
      });

      if (!(error instanceof GeminiJsonParseError) && !isRetryableError(error)) {
        fail(`[${stage}] Gemini API failed with non-retryable error on model ${modelName}: ${error.message}`);
      }

      console.warn(`[${stage}] Gemini model ${modelName} failed after ${maxRetries} retries. Trying fallback model if configured.`);
    }
  }

  fail(failureSummary(stage, failures));
}

module.exports = {
  GeminiJsonParseError,
  callGeminiJson,
  extractJson,
  getGeminiDiagnostics: cloneDiagnostics,
  getGeminiModelUsage(stage) {
    return modelUsageByStage.get(stage) || '';
  },
  parseRetryDelayMs,
  resetGeminiDiagnostics,
  safeFilenamePart,
  saveRawGeminiOutput
};
