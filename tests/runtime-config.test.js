const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_RUNTIME_CONFIG,
  readRuntimeConfig,
  validateRuntimeConfig,
  sanitizeRuntimeConfig,
  parseCsv,
  parseBoolean,
  parseInteger,
  parseIntegerList,
  parseNumber,
  normalizeLlmProvider
} = require('../scripts/lib/runtime-config');

test('defaults match workflow runtime defaults', () => {
  const config = readRuntimeConfig({});

  assert.equal(config.newsletterDate, DEFAULT_RUNTIME_CONFIG.newsletterDate);
  assert.equal(config.lookbackDays, 21);
  assert.equal(config.llmProvider, 'gemini');
  assert.equal(config.llmModel, 'gemini-2.5-flash');
  assert.deepEqual(config.llmFallbackModels, ['gemini-2.5-flash-lite']);
  assert.equal(config.geminiModel, 'gemini-2.5-flash');
  assert.deepEqual(config.geminiFallbackModels, ['gemini-2.5-flash-lite']);
  assert.equal(config.geminiMaxRetries, 2);
  assert.deepEqual(config.geminiRetryDelaysMs, [20000, 10000]);
  assert.equal(config.geminiRetryMaxDelayMs, 300000);
  assert.equal(config.newsroomMaxQualityRetries, 1);
  assert.equal(config.newsroomMaxSectionRepairs, 1);
  assert.equal(config.newsroomWarnCostUsd, 0.15);
  assert.equal(config.newsroomMaxCostUsd, 0.25);
  assert.equal(config.newsroomAllowProOnSchedule, false);
  assert.equal(config.newsroomAllowProOnManual, false);
  assert.equal(config.newsroomProEscalation, 'manual');
  assert.equal(config.geminiThinkingBudgetReporter, 0);
  assert.equal(config.geminiThinkingBudgetEditor, 512);
  assert.equal(config.geminiThinkingBudgetRepair, 0);
  assert.equal(config.geminiThinkingBudgetFactcheck, 0);
  assert.equal(config.geminiThinkingBudgetScoring, 0);
  assert.equal(config.geminiApiKeyConfigured, false);
  assert.equal(config.internalLlmApiKeyConfigured, false);
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

test('boolean parsing accepts common true and false values', () => {
  assert.equal(parseBoolean('true', 'FIELD'), true);
  assert.equal(parseBoolean('0', 'FIELD'), false);
  assert.throws(() => parseBoolean('maybe', 'FIELD'), /FIELD must be true or false/);
});

test('LLM provider default values normalize to Gemini', () => {
  assert.equal(normalizeLlmProvider(''), 'gemini');
  assert.equal(normalizeLlmProvider('default'), 'gemini');
  assert.equal(normalizeLlmProvider('internal'), 'internal');
  assert.equal(readRuntimeConfig({ LLM_PROVIDER: '' }).llmProvider, 'gemini');
  assert.equal(readRuntimeConfig({ LLM_PROVIDER: 'default' }).llmProvider, 'gemini');
});

test('runtime config rejects unknown LLM providers', () => {
  assert.throws(
    () => readRuntimeConfig({ LLM_PROVIDER: 'unknown' }),
    /LLM_PROVIDER must be one of: gemini, internal/
  );
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
    NEWSROOM_MAX_SECTION_REPAIRS: '1',
    NEWSROOM_WARN_COST_USD: '0.12',
    NEWSROOM_MAX_COST_USD: '0.2',
    NEWSROOM_ALLOW_PRO_ON_SCHEDULE: 'false',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true',
    NEWSROOM_PRO_ESCALATION: 'manual',
    GEMINI_THINKING_BUDGET_REPORTER: '0',
    GEMINI_THINKING_BUDGET_EDITOR: '1024',
    GEMINI_THINKING_BUDGET_REPAIR: '0',
    GEMINI_THINKING_BUDGET_FACTCHECK: '0',
    GEMINI_THINKING_BUDGET_SCORING: '0',
    GITHUB_EVENT_NAME: 'workflow_dispatch'
  }, { requireGeminiApiKey: true });

  assert.equal(config.newsletterDate, '2026-05-04');
  assert.equal(config.lookbackDays, 14);
  assert.equal(config.llmProvider, 'gemini');
  assert.equal(config.llmModel, 'primary-model');
  assert.deepEqual(config.llmFallbackModels, []);
  assert.equal(config.geminiModel, 'primary-model');
  assert.deepEqual(config.geminiFallbackModels, []);
  assert.equal(config.geminiMaxRetries, 0);
  assert.deepEqual(config.geminiRetryDelaysMs, [0]);
  assert.equal(config.geminiRetryMaxDelayMs, 1000);
  assert.equal(config.newsroomMaxQualityRetries, 1);
  assert.equal(config.newsroomMaxSectionRepairs, 1);
  assert.equal(config.newsroomWarnCostUsd, 0.12);
  assert.equal(config.newsroomMaxCostUsd, 0.2);
  assert.equal(config.newsroomAllowProOnSchedule, false);
  assert.equal(config.newsroomAllowProOnManual, true);
  assert.equal(config.newsroomProEscalation, 'manual');
  assert.equal(config.geminiThinkingBudgetReporter, 0);
  assert.equal(config.geminiThinkingBudgetEditor, 1024);
  assert.equal(config.geminiThinkingBudgetRepair, 0);
  assert.equal(config.geminiThinkingBudgetFactcheck, 0);
  assert.equal(config.geminiThinkingBudgetScoring, 0);
  assert.equal(config.githubEventName, 'workflow_dispatch');
  assert.equal(config.geminiApiKeyConfigured, true);
});

test('LLM_MODEL and LLM_FALLBACK_MODELS override Gemini compatibility aliases', () => {
  const config = readRuntimeConfig({
    LLM_MODEL: 'llm-primary',
    LLM_FALLBACK_MODELS: 'llm-fallback',
    GEMINI_MODEL: 'gemini-primary',
    GEMINI_FALLBACK_MODELS: 'gemini-fallback'
  });

  assert.equal(config.llmModel, 'llm-primary');
  assert.deepEqual(config.llmFallbackModels, ['llm-fallback']);
  assert.equal(config.geminiModel, 'llm-primary');
  assert.deepEqual(config.geminiFallbackModels, ['llm-fallback']);
});

test('internal provider credentials do not require a Gemini API key', () => {
  const config = readRuntimeConfig({
    LLM_PROVIDER: 'internal',
    LLM_MODEL: 'internal-model',
    INTERNAL_LLM_API_KEY: 'internal-test-key',
    INTERNAL_LLM_ENDPOINT: 'https://internal.example.test/llm',
    GEMINI_API_KEY: ''
  }, { requireLlmCredentials: true });

  assert.equal(config.llmProvider, 'internal');
  assert.equal(config.geminiApiKeyConfigured, false);
  assert.equal(config.internalLlmApiKeyConfigured, true);
});

test('internal provider requires its own key and endpoint only when selected', () => {
  const missingBoth = validateRuntimeConfig({
    newsletterDate: '',
    lookbackDays: 21,
    llmProvider: 'internal',
    llmModel: 'internal-model',
    llmFallbackModels: [],
    geminiModel: 'internal-model',
    geminiFallbackModels: [],
    geminiMaxRetries: 2,
    geminiRetryDelaysMs: [20000],
    geminiRetryMaxDelayMs: 300000,
    internalLlmEndpoint: '',
    internalLlmApiVersion: '',
    newsroomMaxQualityRetries: 1,
    newsroomMaxSectionRepairs: 1,
    newsroomWarnCostUsd: 0.15,
    newsroomMaxCostUsd: 0.25,
    newsroomAllowProOnSchedule: false,
    newsroomAllowProOnManual: false,
    newsroomProEscalation: 'manual',
    geminiThinkingBudgetReporter: 0,
    geminiThinkingBudgetEditor: 512,
    geminiThinkingBudgetRepair: 0,
    geminiThinkingBudgetFactcheck: 0,
    geminiThinkingBudgetScoring: 0,
    githubEventName: '',
    geminiApiKeyConfigured: false,
    internalLlmApiKeyConfigured: false
  }, { requireLlmCredentials: true });

  assert.equal(missingBoth.ok, false);
  assert.match(missingBoth.errors.join('\n'), /INTERNAL_LLM_API_KEY/);
  assert.match(missingBoth.errors.join('\n'), /INTERNAL_LLM_ENDPOINT/);

  const gemini = readRuntimeConfig({
    LLM_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'gemini-test-key',
    INTERNAL_LLM_API_KEY: '',
    INTERNAL_LLM_ENDPOINT: ''
  }, { requireLlmCredentials: true });
  assert.equal(gemini.llmProvider, 'gemini');
});

test('invalid date and ranges return field-specific validation errors', () => {
  const result = validateRuntimeConfig({
    newsletterDate: '2026-99-99',
    lookbackDays: 0,
    llmProvider: 'gemini',
    llmModel: '',
    llmFallbackModels: [],
    geminiModel: '',
    geminiFallbackModels: ['fallback-model'],
    geminiMaxRetries: -1,
    geminiRetryDelaysMs: [],
    geminiRetryMaxDelayMs: -1,
    internalLlmEndpoint: '',
    internalLlmApiVersion: '',
    newsroomMaxQualityRetries: -1,
    newsroomMaxSectionRepairs: -1,
    newsroomWarnCostUsd: -0.1,
    newsroomMaxCostUsd: -0.2,
    newsroomAllowProOnSchedule: false,
    newsroomAllowProOnManual: false,
    newsroomProEscalation: 'manual',
    geminiThinkingBudgetReporter: -1,
    geminiThinkingBudgetEditor: -1,
    geminiThinkingBudgetRepair: -1,
    geminiThinkingBudgetFactcheck: -1,
    geminiThinkingBudgetScoring: -1,
    githubEventName: '',
    geminiApiKeyConfigured: false,
    internalLlmApiKeyConfigured: false
  }, { requireGeminiApiKey: true });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /NEWSLETTER_DATE/);
  assert.match(result.errors.join('\n'), /LOOKBACK_DAYS/);
  assert.match(result.errors.join('\n'), /GEMINI_MODEL/);
  assert.match(result.errors.join('\n'), /GEMINI_MAX_RETRIES/);
  assert.match(result.errors.join('\n'), /GEMINI_RETRY_DELAYS_MS/);
  assert.match(result.errors.join('\n'), /GEMINI_RETRY_MAX_DELAY_MS/);
  assert.match(result.errors.join('\n'), /NEWSROOM_MAX_QUALITY_RETRIES/);
  assert.match(result.errors.join('\n'), /NEWSROOM_MAX_SECTION_REPAIRS/);
  assert.match(result.errors.join('\n'), /NEWSROOM_WARN_COST_USD/);
  assert.match(result.errors.join('\n'), /NEWSROOM_MAX_COST_USD/);
  assert.match(result.errors.join('\n'), /GEMINI_THINKING_BUDGET_REPORTER/);
  assert.match(result.errors.join('\n'), /GEMINI_THINKING_BUDGET_EDITOR/);
  assert.match(result.errors.join('\n'), /GEMINI_THINKING_BUDGET_REPAIR/);
  assert.match(result.errors.join('\n'), /GEMINI_THINKING_BUDGET_FACTCHECK/);
  assert.match(result.errors.join('\n'), /GEMINI_THINKING_BUDGET_SCORING/);
  assert.match(result.errors.join('\n'), /GEMINI_API_KEY/);
});

test('validator returns structured errors for malformed fallback model input', () => {
  const result = validateRuntimeConfig({
    newsletterDate: '',
    lookbackDays: 21,
    llmProvider: 'gemini',
    llmModel: 'gemini-2.5-flash',
    llmFallbackModels: 'gemini-2.5-pro',
    geminiModel: 'gemini-2.5-flash',
    geminiFallbackModels: 'gemini-2.5-pro',
    geminiMaxRetries: 2,
    geminiRetryDelaysMs: [20000],
    geminiRetryMaxDelayMs: 300000,
    internalLlmEndpoint: '',
    internalLlmApiVersion: '',
    newsroomMaxQualityRetries: 1,
    newsroomMaxSectionRepairs: 1,
    newsroomWarnCostUsd: 0.15,
    newsroomMaxCostUsd: 0.25,
    newsroomAllowProOnSchedule: false,
    newsroomAllowProOnManual: false,
    newsroomProEscalation: 'manual',
    geminiThinkingBudgetReporter: 0,
    geminiThinkingBudgetEditor: 512,
    geminiThinkingBudgetRepair: 0,
    geminiThinkingBudgetFactcheck: 0,
    geminiThinkingBudgetScoring: 0,
    githubEventName: 'schedule',
    geminiApiKeyConfigured: true,
    internalLlmApiKeyConfigured: false
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['LLM_FALLBACK_MODELS/GEMINI_FALLBACK_MODELS must be a comma-separated list.']);
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
  assert.equal(sanitized.internalLlmApiKeyConfigured, false);
  assert.equal(sanitized.internalLlmEndpointConfigured, false);
  assert.equal(sanitized.newsroomWarnCostUsd, 0.15);
  assert.equal(sanitized.newsroomMaxCostUsd, 0.25);
  assert.equal(sanitized.newsroomMaxSectionRepairs, 1);
  assert.equal(sanitized.geminiThinkingBudgetEditor, 512);
  assert.equal(text.includes('super-secret-api-key'), false);
});

test('scheduled runs reject configured Pro models by default', () => {
  assert.throws(
    () => readRuntimeConfig({
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_FALLBACK_MODELS: 'gemini-2.5-pro',
      GITHUB_EVENT_NAME: 'schedule'
    }),
    /Gemini Pro models require explicit manual escalation/
  );
});

test('manual workflow dispatch allows Pro only when explicitly enabled', () => {
  assert.throws(
    () => readRuntimeConfig({
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_FALLBACK_MODELS: 'gemini-2.5-pro',
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      NEWSROOM_ALLOW_PRO_ON_MANUAL: 'false'
    }),
    /Gemini Pro models require explicit manual escalation/
  );

  const config = readRuntimeConfig({
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_FALLBACK_MODELS: 'gemini-2.5-pro',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true'
  });

  assert.deepEqual(config.geminiFallbackModels, ['gemini-2.5-pro']);
  assert.equal(sanitizeRuntimeConfig(config).proModelConfigured, true);
  assert.equal(sanitizeRuntimeConfig(config).proModelAllowed, true);
});

test('manual workflow allow_pro equivalent appends Pro to the default Flash-Lite fallback', () => {
  const baseFallback = DEFAULT_RUNTIME_CONFIG.geminiFallbackModels.join(',');
  const config = readRuntimeConfig({
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_FALLBACK_MODELS: `${baseFallback},gemini-2.5-pro`,
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true'
  });

  assert.deepEqual(config.geminiFallbackModels, ['gemini-2.5-flash-lite', 'gemini-2.5-pro']);
  assert.equal(sanitizeRuntimeConfig(config).proModelConfigured, true);
  assert.equal(sanitizeRuntimeConfig(config).proModelAllowed, true);
});
