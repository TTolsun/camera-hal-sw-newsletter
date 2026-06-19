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
} = require('../../../common/runtime-config');
const {
  configuredModels,
  configuredModelsForStage,
  modelGroupInfoForStage,
  modelGroupForStage
} = require('../../../llm/model-policy');

const doctorConfigScript = path.join(__dirname, '..', '..', '..', '..', '..', 'src', 'shared', 'tooling', 'cli', 'doctor-config.js');

function doctorConfigEnv(overrides = {}) {
  const baseEnv = { ...process.env };
  for (const key of [
    'NEWSROOM_ALLOW_PRO_ON_SCHEDULE',
    'NEWSROOM_ALLOW_PRO_ON_MANUAL',
    'NEWSROOM_PRO_ESCALATION'
  ]) {
    delete baseEnv[key];
  }
  return {
    ...baseEnv,
    GEMINI_API_KEY: '',
    INTERNAL_LLM_API_KEY: '',
    LLM_PROVIDER: 'gemini',
    LLM_MODEL: 'gemini-2.5-flash',
    GEMINI_MODEL: 'gemini-2.5-flash',
    LLM_FALLBACK_MODELS: 'gemini-2.5-flash,gemini-2.5-flash-lite',
    GEMINI_FALLBACK_MODELS: 'gemini-2.5-flash,gemini-2.5-flash-lite',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    ...overrides
  };
}

test('빈 문자열 thinking budget env는 코드 기본값으로 해석된다 (drift 해소)', () => {
  const config = readRuntimeConfig({
    GEMINI_THINKING_BUDGET_REPORTER: '',
    GEMINI_THINKING_BUDGET_EDITOR: '',
    GEMINI_THINKING_BUDGET_REPAIR: '',
    GEMINI_THINKING_BUDGET_FACTCHECK: '',
    GEMINI_THINKING_BUDGET_JUDGE: '',
    GEMINI_THINKING_BUDGET_SCORING: ''
  });
  assert.equal(config.geminiThinkingBudgetReporter, 512);
  assert.equal(config.geminiThinkingBudgetEditor, 1024);
  assert.equal(config.geminiThinkingBudgetRepair, 1024);
  assert.equal(config.geminiThinkingBudgetFactcheck, 2048);
  assert.equal(config.geminiThinkingBudgetJudge, 1024);
  assert.equal(config.geminiThinkingBudgetScoring, 0);
});

test('defaults match workflow runtime defaults', () => {
  const config = readRuntimeConfig({});

  assert.equal(config.newsletterDate, DEFAULT_RUNTIME_CONFIG.newsletterDate);
  assert.equal(config.lookbackDays, 10);
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
  assert.deepEqual(config.llmFallbackModels, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.deepEqual(config.llmStageModels, DEFAULT_LLM_STAGE_MODELS);
  assert.deepEqual(config.llmStageModelSources, {
    reporter: 'code_default',
    editor: 'code_default',
    factcheck: 'code_default',
    repair: 'code_default',
    judge: 'code_default',
    sourceDiscovery: 'code_default'
  });
  assert.equal(config.geminiModel, 'gemini-2.5-flash');
  assert.deepEqual(config.geminiFallbackModels, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.equal(config.geminiMaxRetries, 2);
  assert.deepEqual(config.geminiRetryDelaysMs, [20000, 10000]);
  assert.equal(config.geminiRetryMaxDelayMs, 300000);
  assert.equal(config.newsroomMaxQualityRetries, 1);
  assert.equal(config.newsroomMaxSectionRepairs, 1);
  assert.equal(config.newsroomWarnCostUsd, 0.2);
  assert.equal(config.newsroomMaxCostUsd, 0.35);
  assert.equal(config.geminiThinkingBudgetReporter, 512);
  assert.equal(config.geminiThinkingBudgetEditor, 1024);
  assert.equal(config.geminiThinkingBudgetRepair, 1024);
  assert.equal(config.geminiThinkingBudgetFactcheck, 2048);
  assert.equal(config.geminiThinkingBudgetJudge, 1024);
  assert.equal(config.geminiThinkingBudgetScoring, 0);
  assert.equal(config.geminiTemperatureDefault, 0.35);
  assert.equal(config.geminiTemperatureSourceDiscovery, 0.45);
  assert.equal(config.geminiTemperatureReporter, 0.30);
  assert.equal(config.geminiTemperatureEditor, 0.4);
  assert.equal(config.geminiTemperatureFactcheck, 0.20);
  assert.equal(config.geminiTemperatureRepair, 0.25);
  assert.equal(config.geminiTemperatureJudge, 0.20);
  assert.equal(config.linkedEvidenceMode, 'extract_only');
  assert.equal(config.linkedEvidenceMaxLinksPerCandidate, 8);
  assert.equal(config.linkedEvidenceMaxLinksPerRun, 40);
  assert.equal(config.linkedEvidenceTimeoutMs, 5000);
  assert.equal(config.linkedEvidenceMaxBytes, 200000);
  assert.equal(config.newsroomCandidateInputMode, 'default');
  assert.equal(config.newsroomCandidateInputPath, '');
  assert.equal(config.newsroomEnableGeminiSourceDiscovery, false);
  assert.equal(config.newsroomEnableLinkedEvidenceDiscovery, true);
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

test('boolean parsing accepts common true and false values', () => {
  assert.equal(parseBoolean('true', 'FIELD'), true);
  assert.equal(parseBoolean('0', 'FIELD'), false);
  assert.throws(() => parseBoolean('maybe', 'FIELD'), /FIELD must be true or false/);
});

test('LLM provider default values normalize to Gemini', () => {
  assert.equal(normalizeLlmProvider(''), 'gemini');
  assert.equal(normalizeLlmProvider('default'), 'gemini');
  assert.equal(normalizeLlmProvider('openapi'), 'openapi');
  assert.equal(readRuntimeConfig({ LLM_PROVIDER: '' }).llmProvider, 'gemini');
  assert.equal(readRuntimeConfig({ LLM_PROVIDER: 'default' }).llmProvider, 'gemini');
  assert.equal(readRuntimeConfig({ LLM_PROVIDER: 'openapi' }).llmProvider, 'openapi');
});

test('runtime config rejects unknown LLM providers', () => {
  assert.throws(
    () => readRuntimeConfig({ LLM_PROVIDER: 'unknown' }),
    /LLM_PROVIDER must be one of: gemini, openapi/
  );
  assert.throws(
    () => readRuntimeConfig({ LLM_PROVIDER: 'internal' }),
    /LLM_PROVIDER must be one of: gemini, openapi/
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
    NEWSROOM_CANDIDATE_INPUT_PATH: 'articles/content/collected-news/2026-05-04/manual-candidates.json',
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
    repair: 'primary-model',
    judge: 'primary-model',
    sourceDiscovery: 'primary-model'
  });
  assert.deepEqual(config.llmStageModelSources, {
    reporter: 'GEMINI_MODEL',
    editor: 'GEMINI_MODEL',
    factcheck: 'GEMINI_MODEL',
    repair: 'GEMINI_MODEL',
    judge: 'GEMINI_MODEL',
    sourceDiscovery: 'GEMINI_MODEL'
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
  assert.equal(config.geminiThinkingBudgetReporter, 0);
  assert.equal(config.geminiThinkingBudgetEditor, 1024);
  assert.equal(config.geminiThinkingBudgetRepair, 0);
  assert.equal(config.geminiThinkingBudgetFactcheck, 0);
  assert.equal(config.geminiThinkingBudgetJudge, 1024);
  assert.equal(config.geminiThinkingBudgetScoring, 0);
  assert.equal(config.linkedEvidenceMode, 'resolve_allowed_official_links');
  assert.equal(config.linkedEvidenceMaxLinksPerCandidate, 4);
  assert.equal(config.linkedEvidenceMaxLinksPerRun, 12);
  assert.equal(config.linkedEvidenceTimeoutMs, 2500);
  assert.equal(config.linkedEvidenceMaxBytes, 4096);
  assert.equal(config.newsroomCandidateInputMode, 'artifact');
  assert.equal(config.newsroomCandidateInputPath, 'articles/content/collected-news/2026-05-04/manual-candidates.json');
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
    newsroomMaxQualityRetries: 1,
    newsroomMaxSectionRepairs: 1,
    newsroomWarnCostUsd: 0.15,
    newsroomMaxCostUsd: 0.25,
    geminiThinkingBudgetReporter: 0,
    geminiThinkingBudgetEditor: 512,
    geminiThinkingBudgetRepair: 0,
    geminiThinkingBudgetFactcheck: 0,
    geminiThinkingBudgetJudge: 0,
    geminiThinkingBudgetScoring: 0,
    linkedEvidenceMode: 'extract_only',
    linkedEvidenceMaxLinksPerCandidate: -1,
    linkedEvidenceMaxLinksPerRun: -1,
    linkedEvidenceTimeoutMs: 0,
    linkedEvidenceMaxBytes: 0,
    githubEventName: '',
    geminiApiKeyConfigured: false,
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
      NEWSROOM_CANDIDATE_INPUT_PATH: 'articles/content/collected-news/2026-05-04/manual-candidates.json\nextra'
    }),
    /NEWSROOM_CANDIDATE_INPUT_PATH must be a single-line/
  );
});

test('doctor config CLI can validate collect-only runtime without LLM credentials', () => {
  const result = spawnSync(process.execPath, [
    doctorConfigScript,
    '--no-llm-credentials'
  ], {
    cwd: path.join(__dirname, '..', '..', '..', '..', '..'),
    env: doctorConfigEnv(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Runtime config validation passed\./);
  assert.match(result.stdout, /"geminiApiKeyConfigured": false/);
});

test('doctor config CLI still requires LLM credentials by default', () => {
  const result = spawnSync(process.execPath, [doctorConfigScript], {
    cwd: path.join(__dirname, '..', '..', '..', '..', '..'),
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
    cwd: path.join(__dirname, '..', '..', '..', '..', '..'),
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
    repair: 'llm-primary',
    judge: 'llm-primary',
    sourceDiscovery: 'llm-primary'
  });
  assert.equal(config.geminiModel, 'llm-primary');
  assert.deepEqual(config.geminiFallbackModels, ['llm-fallback']);
});

test('stage model env vars independently override code defaults', () => {
  const config = readRuntimeConfig({
    NEWSROOM_REPORTER_MODEL: 'reporter-model',
    NEWSROOM_EDITOR_MODEL: 'editor-model',
    NEWSROOM_FACTCHECK_MODEL: 'factcheck-model',
    NEWSROOM_REPAIR_MODEL: 'repair-model',
    NEWSROOM_JUDGE_MODEL: 'judge-model'
  });

  assert.deepEqual(config.llmStageModels, {
    reporter: 'reporter-model',
    editor: 'editor-model',
    factcheck: 'factcheck-model',
    repair: 'repair-model',
    judge: 'judge-model',
    sourceDiscovery: 'gemini-2.5-flash-lite'
  });
  assert.deepEqual(config.llmStageModelSources, {
    reporter: 'NEWSROOM_REPORTER_MODEL',
    editor: 'NEWSROOM_EDITOR_MODEL',
    factcheck: 'NEWSROOM_FACTCHECK_MODEL',
    repair: 'NEWSROOM_REPAIR_MODEL',
    judge: 'NEWSROOM_JUDGE_MODEL',
    sourceDiscovery: 'code_default'
  });
  assert.deepEqual(configuredModelsForStage(config, 'reporter attempt 1/2'), ['reporter-model', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'editor attempt 1/2'), ['editor-model', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'fact-checker attempt 1/2'), ['factcheck-model', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'editor repair attempt 1/2'), ['repair-model', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'public article judge attempt 1/2'), ['judge-model', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
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
    repair: 'global-model',
    judge: 'global-model',
    sourceDiscovery: 'global-model'
  });
  assert.deepEqual(config.llmStageModelSources, {
    reporter: 'LLM_MODEL',
    editor: 'LLM_MODEL',
    factcheck: 'LLM_MODEL',
    repair: 'LLM_MODEL',
    judge: 'LLM_MODEL',
    sourceDiscovery: 'LLM_MODEL'
  });
  assert.deepEqual(configuredModelsForStage(config, 'editor attempt 1/2'), ['global-model', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
});

test('stage model normalizer maps known generation stages', () => {
  assert.equal(modelGroupForStage('reporter attempt 1/2'), 'reporter');
  assert.equal(modelGroupForStage('background-context attempt 1/2'), 'reporter');
  assert.equal(modelGroupForStage('editor attempt 1/2'), 'editor');
  assert.equal(modelGroupForStage('fact-checker repair attempt 1/2'), 'factcheck');
  assert.equal(modelGroupForStage('fact-check completion attempt 1/2'), 'factcheck');
  assert.equal(modelGroupForStage('editor repair attempt 1/2'), 'repair');
  assert.equal(modelGroupForStage('editor completion attempt 1/2'), 'repair');
  assert.equal(modelGroupForStage('public article judge attempt 1/2'), 'judge');
  assert.equal(modelGroupForStage('unknown stage'), 'reporter');
  assert.deepEqual(modelGroupInfoForStage('unknown stage'), {
    group: 'reporter',
    known: false,
    warning: 'unknown_stage_defaulted_to_reporter'
  });
  assert.deepEqual(modelGroupInfoForStage('fact-checker repair attempt 1/2'), {
    group: 'factcheck',
    known: true,
    warning: ''
  });
});

test('source discovery stage routes to its own group on gemini-2.5-flash-lite', () => {
  assert.equal(modelGroupForStage('sourceDiscovery'), 'sourceDiscovery');
  assert.equal(modelGroupForStage('source-discovery attempt 1/2'), 'sourceDiscovery');
  assert.deepEqual(modelGroupInfoForStage('sourceDiscovery'), {
    group: 'sourceDiscovery',
    known: true,
    warning: ''
  });

  const config = readRuntimeConfig({});
  assert.equal(config.llmStageModels.sourceDiscovery, 'gemini-2.5-flash-lite');
  assert.equal(config.llmStageModelSources.sourceDiscovery, 'code_default');
  assert.deepEqual(configuredModelsForStage(config, 'sourceDiscovery'), ['gemini-2.5-flash-lite', 'gemini-2.5-flash']);
});

test('linked evidence discovery is enabled by default and can be disabled via env', () => {
  assert.equal(readRuntimeConfig({}).newsroomEnableLinkedEvidenceDiscovery, true);
  assert.equal(
    readRuntimeConfig({ NEWSROOM_ENABLE_LINKED_EVIDENCE_DISCOVERY: 'false' }).newsroomEnableLinkedEvidenceDiscovery,
    false
  );
});

test('source discovery stage honors NEWSROOM_SOURCEDISCOVERY_MODEL override', () => {
  const config = readRuntimeConfig({ NEWSROOM_SOURCEDISCOVERY_MODEL: 'gemini-2.5-flash' });
  assert.equal(config.llmStageModels.sourceDiscovery, 'gemini-2.5-flash');
  assert.equal(config.llmStageModelSources.sourceDiscovery, 'NEWSROOM_SOURCEDISCOVERY_MODEL');
  assert.deepEqual(configuredModelsForStage(config, 'sourceDiscovery'), ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
});

test('gemini provider works with GEMINI_API_KEY when credentials required', () => {
  const config = readRuntimeConfig({
    LLM_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'gemini-test-key'
  }, { requireLlmCredentials: true });
  assert.equal(config.llmProvider, 'gemini');
  assert.equal(config.geminiApiKeyConfigured, true);
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
    newsroomMaxQualityRetries: -1,
    newsroomMaxSectionRepairs: -1,
    newsroomWarnCostUsd: -0.1,
    newsroomMaxCostUsd: -0.2,
    geminiThinkingBudgetReporter: -1,
    geminiThinkingBudgetEditor: -1,
    geminiThinkingBudgetRepair: -1,
    geminiThinkingBudgetFactcheck: -1,
    geminiThinkingBudgetJudge: -1,
    geminiThinkingBudgetScoring: -1,
    githubEventName: '',
    geminiApiKeyConfigured: false,
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
  assert.match(result.errors.join('\n'), /GEMINI_THINKING_BUDGET_JUDGE/);
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
    newsroomMaxQualityRetries: 1,
    newsroomMaxSectionRepairs: 1,
    newsroomWarnCostUsd: 0.15,
    newsroomMaxCostUsd: 0.25,
    geminiThinkingBudgetReporter: 0,
    geminiThinkingBudgetEditor: 512,
    geminiThinkingBudgetRepair: 0,
    geminiThinkingBudgetFactcheck: 0,
    geminiThinkingBudgetJudge: 0,
    geminiThinkingBudgetScoring: 0,
    githubEventName: 'schedule',
    geminiApiKeyConfigured: true,
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
    repair: 'code_default',
    judge: 'code_default',
    sourceDiscovery: 'code_default'
  });
  assert.deepEqual(sanitized.selectionWindowPolicy, {
    primarySelectionDays: 7,
    fallbackSelectionDays: 21,
    referenceContextDays: 90
  });
  assert.equal(sanitized.newsroomWarnCostUsd, 0.2);
  assert.equal(sanitized.newsroomMaxCostUsd, 0.35);
  assert.equal(sanitized.newsroomMaxSectionRepairs, 1);
  assert.equal(sanitized.geminiThinkingBudgetEditor, 1024);
  assert.equal(sanitized.geminiThinkingBudgetJudge, 1024);
  assert.equal(sanitized.linkedEvidenceMode, 'extract_only');
  assert.equal(sanitized.linkedEvidenceMaxLinksPerCandidate, 8);
  assert.equal(sanitized.linkedEvidenceMaxLinksPerRun, 40);
  assert.equal(sanitized.linkedEvidenceTimeoutMs, 5000);
  assert.equal(sanitized.linkedEvidenceMaxBytes, 200000);
  assert.equal(sanitized.newsroomCandidateInputMode, 'default');
  assert.equal(sanitized.newsroomCandidateInputPath, '');
  assert.equal(sanitized.newsroomEnableGeminiSourceDiscovery, false);
  assert.equal(sanitized.newsroomEnableLinkedEvidenceDiscovery, true);
  assert.equal(sanitized.proPolicy, 'disabled');
  assert.equal(sanitized.proModelConfigured, false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'proModelAllowed'), false);
  assert.equal(text.includes('super-secret-api-key'), false);
});

test('deprecated Pro policy environment variables are rejected', () => {
  for (const key of [
    'NEWSROOM_ALLOW_PRO_ON_SCHEDULE',
    'NEWSROOM_ALLOW_PRO_ON_MANUAL',
    'NEWSROOM_PRO_ESCALATION'
  ]) {
    assert.throws(
      () => readRuntimeConfig({ [key]: key === 'NEWSROOM_PRO_ESCALATION' ? 'manual' : 'true' }),
      new RegExp(`Gemini Pro policy settings are no longer supported; remove: ${key}`)
    );
  }

  const result = validateRuntimeConfig({
    ...DEFAULT_RUNTIME_CONFIG,
    newsroomAllowProOnManual: true
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /newsroomAllowProOnManual/);
});

test('Gemini Pro model names are rejected across public model config surfaces', () => {
  const cases = [
    { LLM_MODEL: 'gemini-2.5-pro' },
    { GEMINI_MODEL: 'gemini-2.5-pro' },
    { LLM_FALLBACK_MODELS: 'gemini-2.5-pro' },
    { GEMINI_FALLBACK_MODELS: 'gemini-2.5-pro' },
    { NEWSROOM_REPORTER_MODEL: 'gemini-2.5-pro' },
    { NEWSROOM_EDITOR_MODEL: 'gemini-2.5-pro' },
    { NEWSROOM_FACTCHECK_MODEL: 'gemini-2.5-pro' },
    { NEWSROOM_REPAIR_MODEL: 'gemini-2.5-pro' },
    { NEWSROOM_JUDGE_MODEL: 'gemini-2.5-pro' },
    {
      LLM_PROVIDER: 'internal',
      LLM_MODEL: 'gemini-2.5-pro',
      INTERNAL_LLM_API_KEY: 'internal-test-key',
      INTERNAL_LLM_ENDPOINT: 'https://internal.example.test/llm'
    }
  ];

  for (const env of cases) {
    assert.throws(
      () => readRuntimeConfig(env),
      /Gemini Pro models are disabled; configured Pro model\(s\): gemini-2\.5-pro/
    );
  }
});

test('non-Pro model routing remains stage-specific without Pro fallback append', () => {
  const config = readRuntimeConfig({
    LLM_PROVIDER: 'gemini',
    NEWSROOM_EDITOR_MODEL: 'gemini-3.5-flash',
    NEWSROOM_REPAIR_MODEL: 'gemini-3.5-flash',
    NEWSROOM_JUDGE_MODEL: 'gemini-2.5-flash-lite'
  });

  assert.deepEqual(configuredModels(config), ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'editor completion attempt 1/2'), ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.deepEqual(configuredModelsForStage(config, 'public article judge repair'), ['gemini-2.5-flash-lite', 'gemini-2.5-flash']);
  assert.equal(sanitizeRuntimeConfig(config).proModelConfigured, false);
});

test('GEMINI_TEMPERATURE_* env override가 stage별 temperature를 대체한다', () => {
  const config = readRuntimeConfig({
    GEMINI_TEMPERATURE_EDITOR: '0.7',
    GEMINI_TEMPERATURE_FACTCHECK: '0.1',
    GEMINI_TEMPERATURE_JUDGE: '0.15'
  });

  assert.equal(config.geminiTemperatureEditor, 0.7);
  assert.equal(config.geminiTemperatureFactcheck, 0.1);
  assert.equal(config.geminiTemperatureJudge, 0.15);
  // override하지 않은 필드는 default 유지
  assert.equal(config.geminiTemperatureReporter, 0.30);
  assert.equal(config.geminiTemperatureDefault, 0.35);
});

test('GEMINI_TEMPERATURE_* — 범위 밖 값은 파싱 단계에서 에러', () => {
  assert.throws(
    () => readRuntimeConfig({ GEMINI_TEMPERATURE_EDITOR: '2.1' }),
    /GEMINI_TEMPERATURE_EDITOR must be <= 2/
  );
  assert.throws(
    () => readRuntimeConfig({ GEMINI_TEMPERATURE_REPORTER: '-0.1' }),
    /GEMINI_TEMPERATURE_REPORTER must be >= 0/
  );
});
