const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_RUNTIME_CONFIG,
  readRuntimeConfig,
  validateRuntimeConfig,
  sanitizeRuntimeConfig,
  parseCsv,
  parseInteger,
  parseIntegerList,
  parseNumber
} = require('../scripts/lib/runtime-config');

test('defaults match workflow runtime defaults', () => {
  const config = readRuntimeConfig({});

  assert.equal(config.newsletterDate, DEFAULT_RUNTIME_CONFIG.newsletterDate);
  assert.equal(config.lookbackDays, 21);
  assert.equal(config.geminiModel, 'gemini-2.5-flash');
  assert.deepEqual(config.geminiFallbackModels, ['gemini-2.5-flash-lite', 'gemini-2.5-pro']);
  assert.equal(config.geminiMaxRetries, 2);
  assert.deepEqual(config.geminiRetryDelaysMs, [20000, 10000]);
  assert.equal(config.geminiRetryMaxDelayMs, 300000);
  assert.equal(config.newsroomMaxQualityRetries, 1);
  assert.equal(config.newsroomWarnCostUsd, 0.15);
  assert.equal(config.newsroomMaxCostUsd, 0.25);
  assert.equal(config.geminiApiKeyConfigured, false);
});

test('CSV parsing trims values and drops empty items', () => {
  assert.deepEqual(parseCsv(' flash, , pro ,'), ['flash', 'pro']);
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv(undefined), []);
});

test('integer parsing accepts only safe integers in range', () => {
  assert.equal(parseInteger(' 3 ', 'FIELD', { min: 0 }), 3);
  assert.throws(() => parseInteger('1.5', 'FIELD'), /FIELD must be an integer/);
  assert.throws(() => parseInteger('-1', 'FIELD', { min: 0 }), /FIELD must be >= 0/);
  assert.throws(() => parseInteger('', 'FIELD'), /FIELD must be an integer/);
});

test('integer list parsing rejects invalid members', () => {
  assert.deepEqual(parseIntegerList('20000, 10000,0', 'DELAYS'), [20000, 10000, 0]);
  assert.throws(() => parseIntegerList('20000,nope', 'DELAYS'), /DELAYS\[1] must be an integer/);
});

test('number parsing accepts decimals and rejects negative values', () => {
  assert.equal(parseNumber('0.25', 'FIELD', { min: 0 }), 0.25);
  assert.throws(() => parseNumber('nope', 'FIELD'), /FIELD must be a number/);
  assert.throws(() => parseNumber('-0.1', 'FIELD', { min: 0 }), /FIELD must be >= 0/);
});

test('runtime env overrides are parsed into typed config', () => {
  const config = readRuntimeConfig({
    NEWSLETTER_DATE: '2026-05-04',
    LOOKBACK_DAYS: '14',
    GEMINI_API_KEY: 'secret-test-key',
    GEMINI_MODEL: 'primary-model',
    GEMINI_FALLBACK_MODELS: '',
    GEMINI_MAX_RETRIES: '0',
    GEMINI_RETRY_DELAYS_MS: '0',
    GEMINI_RETRY_MAX_DELAY_MS: '1000',
    NEWSROOM_MAX_QUALITY_RETRIES: '1',
    NEWSROOM_WARN_COST_USD: '0.12',
    NEWSROOM_MAX_COST_USD: '0.2'
  }, { requireGeminiApiKey: true });

  assert.equal(config.newsletterDate, '2026-05-04');
  assert.equal(config.lookbackDays, 14);
  assert.equal(config.geminiModel, 'primary-model');
  assert.deepEqual(config.geminiFallbackModels, []);
  assert.equal(config.geminiMaxRetries, 0);
  assert.deepEqual(config.geminiRetryDelaysMs, [0]);
  assert.equal(config.geminiRetryMaxDelayMs, 1000);
  assert.equal(config.newsroomMaxQualityRetries, 1);
  assert.equal(config.newsroomWarnCostUsd, 0.12);
  assert.equal(config.newsroomMaxCostUsd, 0.2);
  assert.equal(config.geminiApiKeyConfigured, true);
});

test('invalid date and ranges return field-specific validation errors', () => {
  const result = validateRuntimeConfig({
    newsletterDate: '2026-99-99',
    lookbackDays: 0,
    geminiModel: '',
    geminiFallbackModels: ['fallback-model'],
    geminiMaxRetries: -1,
    geminiRetryDelaysMs: [],
    geminiRetryMaxDelayMs: -1,
    newsroomMaxQualityRetries: -1,
    newsroomWarnCostUsd: -0.1,
    newsroomMaxCostUsd: -0.2,
    geminiApiKeyConfigured: false
  }, { requireGeminiApiKey: true });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /NEWSLETTER_DATE/);
  assert.match(result.errors.join('\n'), /LOOKBACK_DAYS/);
  assert.match(result.errors.join('\n'), /GEMINI_MODEL/);
  assert.match(result.errors.join('\n'), /GEMINI_MAX_RETRIES/);
  assert.match(result.errors.join('\n'), /GEMINI_RETRY_DELAYS_MS/);
  assert.match(result.errors.join('\n'), /GEMINI_RETRY_MAX_DELAY_MS/);
  assert.match(result.errors.join('\n'), /NEWSROOM_MAX_QUALITY_RETRIES/);
  assert.match(result.errors.join('\n'), /NEWSROOM_WARN_COST_USD/);
  assert.match(result.errors.join('\n'), /NEWSROOM_MAX_COST_USD/);
  assert.match(result.errors.join('\n'), /GEMINI_API_KEY/);
});

test('readRuntimeConfig rejects explicit empty retry delay list', () => {
  assert.throws(
    () => readRuntimeConfig({ GEMINI_RETRY_DELAYS_MS: '' }),
    /GEMINI_RETRY_DELAYS_MS must contain at least one integer delay/
  );
});

test('sanitized diagnostics never include the raw API key', () => {
  const config = readRuntimeConfig({
    GEMINI_API_KEY: 'super-secret-api-key'
  });
  const sanitized = sanitizeRuntimeConfig(config);
  const text = JSON.stringify(sanitized);

  assert.equal(sanitized.geminiApiKeyConfigured, true);
  assert.equal(sanitized.newsroomWarnCostUsd, 0.15);
  assert.equal(sanitized.newsroomMaxCostUsd, 0.25);
  assert.equal(text.includes('super-secret-api-key'), false);
});
