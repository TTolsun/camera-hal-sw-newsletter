class LlmJsonParseError extends Error {
  constructor(stage, message, rawText = '') {
    super(`[${stage}] ${message}`);
    this.name = 'LlmJsonParseError';
    this.stage = stage;
    this.rawText = String(rawText || '');
  }
}

// A single provider call exceeded its wall-clock ceiling and was abandoned.
// This is distinct from API/quota/parse errors: the model is hanging, so the
// caller should stop waiting on it, skip same-model retries, and fall through
// to the next configured fallback model instead of hard-failing.
class LlmCallTimeoutError extends Error {
  constructor(stage, modelName, timeoutMs) {
    super(`[${stage}] LLM call to model ${modelName} exceeded ${timeoutMs}ms wall-clock timeout.`);
    this.name = 'LlmCallTimeoutError';
    this.stage = stage;
    this.modelName = modelName;
    this.timeoutMs = timeoutMs;
  }
}

function errorText(error) {
  return [
    error?.message,
    error?.statusDetails,
    error?.details,
    error?.response?.data,
    error?.response?.body,
    error?.body,
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

function errorStatus(error, retryableStatuses = new Set()) {
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

// Gemini rejects an over-complex constrained-decoding response schema with a 400
// "too many states" error. Unlike a transient 429/503, this is permanent: the
// schema outgrew the model's state limit, so retrying the same schema (on this or
// a weaker fallback model) fails again. Detect it distinctly so the failure is
// reported as schema drift rather than a generic capacity/quality issue (#652).
const SCHEMA_COMPLEXITY_PATTERN =
  /too many (?:possible )?states|maximum number of states|(?:response )?schema is too (?:complex|large)/i;

function isSchemaComplexityError(error) {
  return Boolean(error) && SCHEMA_COMPLEXITY_PATTERN.test(errorText(error));
}

function lastStatus(error, retryableStatuses = new Set()) {
  if (error instanceof LlmCallTimeoutError) return 'timeout';
  if (isSchemaComplexityError(error)) return 'schema_incompatible';
  const directStatus = errorStatus(error, retryableStatuses);
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

function isRetryableError(error, retryableStatuses = new Set()) {
  if (errorStatus(error, retryableStatuses)) return true;
  return /\b(UNAVAILABLE|RESOURCE_EXHAUSTED|rate limit|high demand|temporarily unavailable|quota)\b/i
    .test(errorText(error));
}

function isQuotaError(error, retryableStatuses = new Set()) {
  const text = errorText(error);
  return errorStatus(error, retryableStatuses) === 429 ||
    /\b(RESOURCE_EXHAUSTED|quota|rate limit|too many requests)\b/i.test(text);
}

function isFreeTierQuotaExhausted(error, retryableStatuses = new Set()) {
  const text = errorText(error);
  return isQuotaError(error, retryableStatuses) &&
    /(daily|per\s*day|GenerateRequestsPerDay|RequestsPerDay|free[_\s-]*tier.*(?:daily|per\s*day)|(?:daily|per\s*day).*free[_\s-]*tier)/i.test(text);
}

function extractJson(text, stage, providerLabel = 'LLM') {
  const rawText = String(text || '');
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new LlmJsonParseError(stage, `${providerLabel} returned an empty response.`, rawText);
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

  throw new LlmJsonParseError(stage, `${providerLabel} output was not valid JSON.`, rawText);
}

module.exports = {
  LlmCallTimeoutError,
  LlmJsonParseError,
  errorStatus,
  errorText,
  extractJson,
  isFreeTierQuotaExhausted,
  isQuotaError,
  isRetryableError,
  isSchemaComplexityError,
  lastStatus,
  parseDurationToMs,
  parseRetryDelayMs
};
