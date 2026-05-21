const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_RUNTIME_CONFIG,
  DEFAULT_LLM_STAGE_MODELS,
  readRuntimeConfig,
  validateRuntimeConfig,
  sanitizeRuntimeConfig,
  parseCsv,
  parseBoolean,
  parseInteger,
  parseIntegerList,
  parseNumber,
  normalizeLlmProvider
} = require('../../../scripts/lib/runtime-config');
const {
  configuredModels,
  configuredModelsForStage,
  modelGroupForStage
} = require('../../../scripts/newsroom/llm/model-policy');

const doctorConfigScript = path.join(__dirname, '..', '..', '..', 'scripts', 'doctor-config.js');

function doctorConfigEnv(overrides = {}) {
  return {
    ...process.env,
    GEMINI_API_KEY: '',
    INTERNAL_LLM_API_KEY: '',
    LLM_PROVIDER: 'gemini',
    LLM_MODEL: 'gemini-2.5-flash',
    GEMINI_MODEL: 'gemini-2.5-flash',
    LLM_FALLBACK_MODELS: 'gemini-2.5-flash-lite',
    GEMINI_FALLBACK_MODELS: 'gemini-2.5-flash-lite',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'false',
    ...overrides
  };
}

test('defaults match workflow runtime defaults', () => {
  const config = readRuntimeConfig({});

  assert.equal(config.newsletterDate, DEFAULT_RUNTIME_CONFIG.newsletterDate);
  assert.equal(config.lookbackDays, 21);
  assert.deepEqual(config.selectionWindowPolicy, {
    primarySelectionDays: 7,
    fallbackSelectionDays: 21,
    referenceContextDays: 90
  });
  assert.equal(config.llmProvider, 'gemini');
  assert.equal(config.llmModel, 'gemini-2.5-flash');
  assert.equal(config.llmModelExplicitlyConfigured, false);
  assert.equal(config.llmGlobalModelExplicitlyConfigured, false);
  assert.equal(config.llmModelSource, 'code_default');
  assert.deepEqual(config.llmFallbackModels, ['gemini-2.5-flash-lite']);
  assert.deepEqual(config.llmStageModels, DEFAULT_LLM_STAGE_MODELS);
  assert.deepEqual(config.llmStageModelSources, {
    reporter: 'code_default',
    editor: 'code_default',
    factcheck: 'code_default',
    repair: 'code_default'
  });
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
  assert.equal(config.linkedEvidenceMode, 'extract_only');
  assert.equal(config.linkedEvidenceMaxLinksPerCandidate, 8);
  assert.equal(config.linkedEvidenceMaxLinksPerRun, 40);
  assert.equal(config.linkedEvidenceTimeoutMs, 5000);
  assert.equal(config.linkedEvidenceMaxBytes, 200000);
  assert.equal(config.newsroomCandidateInputMode, 'default');
  assert.equal(config.newsroomCandidateInputPath, '');
  assert.equal(config.newsroomEnableGeminiSourceDiscovery, false);
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
    PRIMARY_SELECTION_DAYS: '3',
    FALLBACK_SELECTION_DAYS: '14',
    REFERENCE_CONTEXT_DAYS: '60',
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
    NEWSROOM_LINKED_EVIDENCE_MODE: 'resolve_allowed_official_links',
    NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE: '4',
    NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN: '12',
    NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS: '2500',
    NEWSROOM_LINKED_EVIDENCE_MAX_BYTES: '4096',
    NEWSROOM_CANDIDATE_INPUT_MODE: 'artifact',
    NEWSROOM_CANDIDATE_INPUT_PATH: 'content/collected-news/2026-05-04/manual-candidates.json',
    NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true',
    GITHUB_EVENT_NAME: 'workflow_dispatch'
  }, { requireGeminiApiKey: true });

  assert.equal(config.newsletterDate, '2026-05-04');
  assert.equal(config.lookbackDays, 14);
  assert.deepEqual(config.selectionWindowPolicy, {
    primarySelectionDays: 3,
    fallbackSelectionDays: 14,
    referenceContextDays: 60
  });
  assert.equal(config.llmProvider, 'gemini');
  assert.equal(config.llmModel, 'primary-model');
  assert.equal(config.llmModelExplicitlyConfigured, false);
  assert.equal(config.llmGlobalModelExplicitlyConfigured, true);
  assert.equal(config.llmModelSource, 'GEMINI_MODEL');
  assert.deepEqual(config.llmFallbackModels, []);
  assert.deepEqual(config.llmStageModels, {
    reporter: 'primary-model',
    editor: 'primary-model',
    factcheck: 'primary-model',
    repair: 'primary-model'
  });
  assert.deepEqual(config.llmStageModelSources, {
    reporter: 'GEMINI_MODEL',
    editor: 'GEMINI_MODEL',
    factcheck: 'GEMINI_MODEL',
    repair: 'GEMINI_MODEL'
  });
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
  assert.equal(config.linkedEvidenceMode, 'resolve_allowed_official_links');
  assert.equal(config.linkedEvidenceMaxLinksPerCandidate, 4);
  assert.equal(config.linkedEvidenceMaxLinksPerRun, 12);
  assert.equal(config.linkedEvidenceTimeoutMs, 2500);
  assert.equal(config.linkedEvidenceMaxBytes, 4096);
  assert.equal(config.newsroomCandidateInputMode, 'artifact');
  assert.equal(config.newsroomCandidateInputPath, 'content/collected-news/2026-05-04/manual-candidates.json');
  assert.equal(config.newsroomEnableGeminiSourceDiscovery, true);
  assert.equal(config.githubEventName, 'workflow_dispatch');
  assert.equal(config.geminiApiKeyConfigured, true);
});

test('selection window runtime config keeps policy shape and validates ordering', () => {
  assert.deepEqual(readRuntimeConfig({}).selectionWindowPolicy, {
    primarySelectionDays: 7,
    fallbackSelectionDays: 21,
    referenceContextDays: 90
  });
  assert.deepEqual(readRuntimeConfig({
    PRIMARY_SELECTION_DAYS: '7',
    FALLBACK_SELECTION_DAYS: '7',
    REFERENCE_CONTEXT_DAYS: '90'
  }).selectionWindowPolicy, {
    primarySelectionDays: 7,
    fallbackSelectionDays: 7,
    referenceContextDays: 90
  });
  assert.deepEqual(readRuntimeConfig({
    PRIMARY_SELECTION_DAYS: '7',
    FALLBACK_SELECTION_DAYS: '21',
    REFERENCE_CONTEXT_DAYS: '21'
  }).selectionWindowPolicy, {
    primarySelectionDays: 7,
    fallbackSelectionDays: 21,
    referenceContextDays: 21
  });
  assert.deepEqual(readRuntimeConfig({
    PRIMARY_SELECTION_DAYS: '7',
    FALLBACK_SELECTION_DAYS: '7',
    REFERENCE_CONTEXT_DAYS: '7'
  }).selectionWindowPolicy, {
    primarySelectionDays: 7,
    fallbackSelectionDays: 7,
    referenceContextDays: 7
  });

  assert.throws(
    () => readRuntimeConfig({ PRIMARY_SELECTION_DAYS: '0' }),
    /PRIMARY_SELECTION_DAYS must be >= 1/
  );
  assert.throws(
    () => readRuntimeConfig({ FALLBACK_SELECTION_DAYS: '1.5' }),
    /FALLBACK_SELECTION_DAYS must be an integer/
  );
  assert.throws(
    () => readRuntimeConfig({
      PRIMARY_SELECTION_DAYS: '22',
      FALLBACK_SELECTION_DAYS: '21'
    }),
    /FALLBACK_SELECTION_DAYS must be >= PRIMARY_SELECTION_DAYS/
  );
  assert.throws(
    () => readRuntimeConfig({
      FALLBACK_SELECTION_DAYS: '91',
      REFERENCE_CONTEXT_DAYS: '90'
    }),
    /REFERENCE_CONTEXT_DAYS must be >= FALLBACK_SELECTION_DAYS/
  );
});

test('linked evidence runtime config rejects invalid mode and unsafe limits', () => {
  assert.throws(
    () => readRuntimeConfig({
      NEWSROOM_LINKED_EVIDENCE_MODE: 'resolve_everything'
    }),
    /NEWSROOM_LINKED_EVIDENCE_MODE must be one of/
  );

  const result = validateRuntimeConfig({
    newsletterDate: '',
    lookbackDays: 21,
    llmProvider: 'gemini',
    llmModel: 'gemini-2.5-flash',
    llmFallbackModels: [],
    geminiModel: 'gemini-2.5-flash',
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
    linkedEvidenceMode: 'extract_only',
    linkedEvidenceMaxLinksPerCandidate: -1,
    linkedEvidenceMaxLinksPerRun: -1,
    linkedEvidenceTimeoutMs: 0,
    linkedEvidenceMaxBytes: 0,
    githubEventName: '',
    geminiApiKeyConfigured: false,
    internalLlmApiKeyConfigured: false
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE/);
  assert.match(result.errors.join('\n'), /NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN/);
  assert.match(result.errors.join('\n'), /NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS/);
  assert.match(result.errors.join('\n'), /NEWSROOM_LINKED_EVIDENCE_MAX_BYTES/);
});

test('candidate artifact runtime config rejects invalid mode and multiline path', () => {
  assert.throws(
    () => readRuntimeConfig({
      NEWSROOM_CANDIDATE_INPUT_MODE: 'remote'
    }),
    /NEWSROOM_CANDIDATE_INPUT_MODE must be one of/
  );

  assert.throws(
    () => readRuntimeConfig({
      NEWSROOM_CANDIDATE_INPUT_PATH: 'content/collected-news/2026-05-04/manual-candidates.json\nextra'
    }),
    /NEWSROOM_CANDIDATE_INPUT_PATH must be a single-line/
  );
});

test('doctor config CLI can validate collect-only runtime without LLM credentials', () => {
  const result = spawnSync(process.execPath, [
    doctorConfigScript,
    '--no-llm-credentials'
  ], {
    cwd: path.join(__dirname, '..', '..', '..'),
    env: doctorConfigEnv(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Runtime config validation passed\./);
  assert.match(result.stdout, /"geminiApiKeyConfigured": false/);
});

test('doctor config CLI still requires LLM credentials by default', () => {
  const result = spawnSync(process.execPath, [doctorConfigScript], {
    cwd: path.join(__dirname, '..', '..', '..'),
    env: doctorConfigEnv(),
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GEMINI_API_KEY must be configured for Gemini newsroom generation\./);
});

test('doctor config CLI rejects unknown options', () => {
  const result = spawnSync(process.execPath, [
    doctorConfigScript,
    '--no-llm-credential'
  ], {
    cwd: path.join(__dirname, '..', '..', '..'),
    env: doctorConfigEnv({ GEMINI_API_KEY: 'test-key' }),
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option\(s\): --no-llm-credential/);
});

test('LLM_MODEL and LLM_FALLBACK_MODELS override Gemini compatibility aliases', () => {
  const config = readRuntimeConfig({
    LLM_MODEL: 'llm-primary',
    LLM_FALLBACK_MODELS: 'llm-fallback',
    GEMINI_MODEL: 'gemini-primary',
    GEMINI_FALLBACK_MODELS: 'gemini-fallback'
  });

  assert.equal(config.llmModel, 'llm-primary');
  assert.equal(config.llmModelExplicitlyConfigured, true);
  assert.equal(config.llmGlobalModelExplicitlyConfigured, true);
  assert.equal(config.llmModelSource, 'LLM_MODEL');
  assert.deepEqual(config.llmFallbackModels, ['llm-fallback']);
  assert.deepEqual(config.llmStageModels, {
    reporter: 'llm-primary',
    editor: 'llm-primary',
    factcheck: 'llm-primary',
    repair: 'llm-primary'
  });
  assert.equal(config.geminiModel, 'llm-primary');
  assert.deepEqual(config.geminiFallbackModels, ['llm-fallback']);
});

test('stage model env vars independently override code defaults', () => {
  const config = readRuntimeConfig({
    NEWSROOM_REPORTER_MODEL: 'reporter-model',
    NEWSROOM_EDITOR_MODEL: 'editor-model',
    NEWSROOM_FACTCHECK_MODEL: 'factcheck-model',
    NEWSROOM_REPAIR_MODEL: 'repair-model'
  });

  assert.deepEqual(config.llmStageModels, {
    reporter: 'reporter-model',
    editor: 'editor-model',
    factcheck: 'factcheck-model',
    repair: 'repair-model'
  });
  assert.deepEqual(config.llmStageModelSources, {
    reporter: 'NEWSROOM_REPORTER_MODEL',
    editor: 'NEWSROOM_EDITOR_MODEL',
    factcheck: 'NEWSROOM_FACTCHECK_MODEL',
    repair: 'NEWSROOM_REPAIR_MODEL'
  });
  assert.deepEqual(configuredModelsForStage(config, 'reporter attempt 1/2'), ['reporter-model', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'editor attempt 1/2'), ['editor-model', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'fact-checker attempt 1/2'), ['factcheck-model', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'editor repair attempt 1/2'), ['repair-model', 'gemini-2.5-flash-lite']);
});

test('global LLM model overrides stage-specific model env vars', () => {
  const config = readRuntimeConfig({
    LLM_MODEL: 'global-model',
    NEWSROOM_EDITOR_MODEL: 'editor-model'
  });

  assert.deepEqual(config.llmStageModels, {
    reporter: 'global-model',
    editor: 'global-model',
    factcheck: 'global-model',
    repair: 'global-model'
  });
  assert.deepEqual(config.llmStageModelSources, {
    reporter: 'LLM_MODEL',
    editor: 'LLM_MODEL',
    factcheck: 'LLM_MODEL',
    repair: 'LLM_MODEL'
  });
  assert.deepEqual(configuredModelsForStage(config, 'editor attempt 1/2'), ['global-model', 'gemini-2.5-flash-lite']);
});

test('stage model normalizer maps known generation stages', () => {
  assert.equal(modelGroupForStage('reporter attempt 1/2'), 'reporter');
  assert.equal(modelGroupForStage('background-context attempt 1/2'), 'reporter');
  assert.equal(modelGroupForStage('editor attempt 1/2'), 'editor');
  assert.equal(modelGroupForStage('fact-checker repair attempt 1/2'), 'factcheck');
  assert.equal(modelGroupForStage('fact-check completion attempt 1/2'), 'factcheck');
  assert.equal(modelGroupForStage('editor repair attempt 1/2'), 'repair');
  assert.equal(modelGroupForStage('editor completion attempt 1/2'), 'repair');
  assert.equal(modelGroupForStage('unknown stage'), 'reporter');
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
  assert.equal(config.llmModelExplicitlyConfigured, true);
  assert.deepEqual(config.llmFallbackModels, []);
});

test('internal provider requires explicit LLM_MODEL and does not accept Gemini model aliases', () => {
  assert.throws(
    () => readRuntimeConfig({
      LLM_PROVIDER: 'internal',
      INTERNAL_LLM_API_KEY: 'internal-test-key',
      INTERNAL_LLM_ENDPOINT: 'https://internal.example.test/llm',
      GEMINI_API_KEY: ''
    }, { requireLlmCredentials: true }),
    /LLM_MODEL is required when LLM_PROVIDER=internal/
  );

  assert.throws(
    () => readRuntimeConfig({
      LLM_PROVIDER: 'internal',
      GEMINI_MODEL: 'internal-via-gemini-alias',
      INTERNAL_LLM_API_KEY: 'internal-test-key',
      INTERNAL_LLM_ENDPOINT: 'https://internal.example.test/llm',
      GEMINI_API_KEY: ''
    }, { requireLlmCredentials: true }),
    /LLM_MODEL is required when LLM_PROVIDER=internal/
  );
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
    internalLlmApiKeyConfigured: false,
    llmModelExplicitlyConfigured: true
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
  assert.equal(sanitized.llmModelExplicitlyConfigured, false);
  assert.equal(sanitized.llmGlobalModelExplicitlyConfigured, false);
  assert.equal(sanitized.llmModelSource, 'code_default');
  assert.deepEqual(sanitized.llmStageModels, DEFAULT_LLM_STAGE_MODELS);
  assert.deepEqual(sanitized.llmStageModelSources, {
    reporter: 'code_default',
    editor: 'code_default',
    factcheck: 'code_default',
    repair: 'code_default'
  });
  assert.deepEqual(sanitized.selectionWindowPolicy, {
    primarySelectionDays: 7,
    fallbackSelectionDays: 21,
    referenceContextDays: 90
  });
  assert.equal(sanitized.internalLlmApiKeyConfigured, false);
  assert.equal(sanitized.internalLlmEndpointConfigured, false);
  assert.equal(sanitized.newsroomWarnCostUsd, 0.15);
  assert.equal(sanitized.newsroomMaxCostUsd, 0.25);
  assert.equal(sanitized.newsroomMaxSectionRepairs, 1);
  assert.equal(sanitized.geminiThinkingBudgetEditor, 512);
  assert.equal(sanitized.linkedEvidenceMode, 'extract_only');
  assert.equal(sanitized.linkedEvidenceMaxLinksPerCandidate, 8);
  assert.equal(sanitized.linkedEvidenceMaxLinksPerRun, 40);
  assert.equal(sanitized.linkedEvidenceTimeoutMs, 5000);
  assert.equal(sanitized.linkedEvidenceMaxBytes, 200000);
  assert.equal(sanitized.newsroomCandidateInputMode, 'default');
  assert.equal(sanitized.newsroomCandidateInputPath, '');
  assert.equal(sanitized.newsroomEnableGeminiSourceDiscovery, false);
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

test('stage-specific Pro models require explicit manual escalation', () => {
  assert.throws(
    () => readRuntimeConfig({
      NEWSROOM_EDITOR_MODEL: 'gemini-2.5-pro',
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      NEWSROOM_ALLOW_PRO_ON_MANUAL: 'false'
    }),
    /Gemini Pro models require explicit manual escalation/
  );

  const config = readRuntimeConfig({
    NEWSROOM_EDITOR_MODEL: 'gemini-2.5-pro',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true'
  });

  assert.equal(config.llmStageModels.editor, 'gemini-2.5-pro');
  assert.equal(sanitizeRuntimeConfig(config).proModelConfigured, true);
  assert.equal(sanitizeRuntimeConfig(config).proModelAllowed, true);
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
  const config = readRuntimeConfig({
    GEMINI_MODEL: 'gemini-2.5-flash',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true'
  });

  assert.deepEqual(config.geminiFallbackModels, ['gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModels(config), ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']);
  assert.deepEqual(configuredModelsForStage(config, 'editor attempt 1/2'), ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']);
  assert.equal(sanitizeRuntimeConfig(config).proModelConfigured, true);
  assert.equal(sanitizeRuntimeConfig(config).proModelAllowed, true);
});

test('manual Pro model policy dedupes and does not apply to schedule or internal providers', () => {
  const manualGemini = readRuntimeConfig({
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_FALLBACK_MODELS: 'gemini-2.5-pro',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true'
  });
  assert.deepEqual(configuredModels(manualGemini), ['gemini-2.5-flash', 'gemini-2.5-pro']);

  const scheduledGemini = readRuntimeConfig({
    GITHUB_EVENT_NAME: 'schedule',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true'
  });
  assert.deepEqual(configuredModels(scheduledGemini), ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite']);

  const internal = readRuntimeConfig({
    LLM_PROVIDER: 'internal',
    LLM_MODEL: 'internal-model',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true',
    INTERNAL_LLM_API_KEY: 'internal-test-key',
    INTERNAL_LLM_ENDPOINT: 'https://internal.example.test/llm'
  }, { requireLlmCredentials: true });
  assert.deepEqual(configuredModels(internal), ['internal-model']);
});
