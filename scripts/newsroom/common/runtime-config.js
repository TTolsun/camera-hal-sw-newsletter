const {
  configuredModels: configuredModelList,
  isGeminiProModel
} = require('../llm/model-policy');
const {
  getSelectionWindowPolicy
} = require('./newsletter-policy');

const DEFAULT_LLM_PROVIDER = 'gemini';
const LLM_PROVIDER_VALUES = Object.freeze(['gemini', 'openapi']);
const DEFAULT_LLM_MODEL = 'gemini-2.5-flash';
const DEFAULT_LLM_FALLBACK_MODELS = ['gemini-2.5-flash-lite'];
const DEFAULT_LLM_STAGE_MODELS = Object.freeze({
  reporter: 'gemini-2.5-flash',
  editor: 'gemini-3.5-flash',
  factcheck: 'gemini-2.5-flash',
  repair: 'gemini-3.5-flash',
  judge: 'gemini-2.5-flash-lite',
  sourceDiscovery: 'gemini-2.5-flash-lite'
});
const LLM_STAGE_MODEL_ENV_KEYS = Object.freeze({
  reporter: 'NEWSROOM_REPORTER_MODEL',
  editor: 'NEWSROOM_EDITOR_MODEL',
  factcheck: 'NEWSROOM_FACTCHECK_MODEL',
  repair: 'NEWSROOM_REPAIR_MODEL',
  judge: 'NEWSROOM_JUDGE_MODEL',
  sourceDiscovery: 'NEWSROOM_SOURCEDISCOVERY_MODEL'
});
const PRO_DISABLED_ENV_KEYS = Object.freeze([
  'NEWSROOM_ALLOW_PRO_ON_SCHEDULE',
  'NEWSROOM_ALLOW_PRO_ON_MANUAL',
  'NEWSROOM_PRO_ESCALATION'
]);
const LINKED_EVIDENCE_MODES = Object.freeze({
  EXTRACT_ONLY: 'extract_only',
  RESOLVE_ALLOWED_OFFICIAL_LINKS: 'resolve_allowed_official_links',
  OFFLINE_FIXTURE_TEST: 'offline_fixture_test'
});
const LINKED_EVIDENCE_MODE_VALUES = Object.freeze(Object.values(LINKED_EVIDENCE_MODES));
const CANDIDATE_INPUT_MODE_VALUES = Object.freeze(['default', 'artifact']);
const DEFAULT_SELECTION_WINDOW_POLICY = getSelectionWindowPolicy();

const DEFAULT_RUNTIME_CONFIG = {
  newsletterDate: '',
  // #487: default source collection lookback is 10 days. The daily collect
  // workflow (01-newsletters-source-collect-pr.yml) still passes an explicit
  // LOOKBACK_DAYS=90 to feed the catch-up pool until the weekly upsert model
  // (#488) lands; this default applies to runs that do not set LOOKBACK_DAYS.
  lookbackDays: 10,
  selectionWindowPolicy: {
    primarySelectionDays: DEFAULT_SELECTION_WINDOW_POLICY.primarySelectionDays,
    fallbackSelectionDays: DEFAULT_SELECTION_WINDOW_POLICY.fallbackSelectionDays,
    referenceContextDays: DEFAULT_SELECTION_WINDOW_POLICY.referenceContextDays
  },
  llmProvider: DEFAULT_LLM_PROVIDER,
  llmModel: DEFAULT_LLM_MODEL,
  llmFallbackModels: DEFAULT_LLM_FALLBACK_MODELS,
  llmStageModels: { ...DEFAULT_LLM_STAGE_MODELS },
  llmStageModelSources: {
    reporter: 'code_default',
    editor: 'code_default',
    factcheck: 'code_default',
    repair: 'code_default',
    judge: 'code_default',
    sourceDiscovery: 'code_default'
  },
  geminiModel: DEFAULT_LLM_MODEL,
  geminiFallbackModels: DEFAULT_LLM_FALLBACK_MODELS,
  geminiMaxRetries: 2,
  geminiRetryDelaysMs: [20000, 10000],
  geminiRetryMaxDelayMs: 300000,
  newsroomMaxQualityRetries: 1,
  newsroomMaxSectionRepairs: 1,
  newsroomWarnCostUsd: 0.15,
  newsroomMaxCostUsd: 0.25,
  geminiThinkingBudgetReporter: 0,
  geminiThinkingBudgetEditor: 1024,
  geminiThinkingBudgetRepair: 0,
  geminiThinkingBudgetFactcheck: 1024,
  geminiThinkingBudgetJudge: 1024,
  geminiThinkingBudgetScoring: 0,
  geminiTemperatureDefault: 0.35,
  geminiTemperatureSourceDiscovery: 0.45,
  geminiTemperatureReporter: 0.30,
  geminiTemperatureEditor: 0.4,
  geminiTemperatureFactcheck: 0.20,
  geminiTemperatureRepair: 0.25,
  geminiTemperatureJudge: 0.20,
  linkedEvidenceMode: LINKED_EVIDENCE_MODES.EXTRACT_ONLY,
  linkedEvidenceMaxLinksPerCandidate: 8,
  linkedEvidenceMaxLinksPerRun: 40,
  linkedEvidenceTimeoutMs: 5000,
  linkedEvidenceMaxBytes: 200000,
  newsroomCandidateInputMode: 'default',
  newsroomCandidateInputPath: '',
  newsroomEnableGeminiSourceDiscovery: false,
  githubEventName: ''
};

function parseCsv(value) {
  if (value === undefined || value === null) return [];
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseInteger(value, fieldName, options = {}) {
  const hasDefault = Object.prototype.hasOwnProperty.call(options, 'defaultValue');
  if (value === undefined || value === null) {
    if (hasDefault) return options.defaultValue;
    throw new Error(`${fieldName} is required.`);
  }

  const text = String(value).trim();
  if (!text) {
    if (options.allowEmpty) return options.emptyValue;
    if (hasDefault && options.defaultOnEmpty) return options.defaultValue;
    throw new Error(`${fieldName} must be an integer.`);
  }

  if (!/^-?\d+$/.test(text)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  const number = Number(text);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${fieldName} must be a safe integer.`);
  }
  if (options.min !== undefined && number < options.min) {
    throw new Error(`${fieldName} must be >= ${options.min}.`);
  }
  if (options.max !== undefined && number > options.max) {
    throw new Error(`${fieldName} must be <= ${options.max}.`);
  }
  return number;
}

function parseIntegerList(value, fieldName) {
  const items = parseCsv(value);
  return items.map((item, index) => parseInteger(item, `${fieldName}[${index}]`, { min: 0 }));
}

function parseNumber(value, fieldName, options = {}) {
  const hasDefault = Object.prototype.hasOwnProperty.call(options, 'defaultValue');
  if (value === undefined || value === null) {
    if (hasDefault) return options.defaultValue;
    throw new Error(`${fieldName} is required.`);
  }

  const text = String(value).trim();
  if (!text) {
    if (hasDefault && options.defaultOnEmpty) return options.defaultValue;
    throw new Error(`${fieldName} must be a number.`);
  }

  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a number.`);
  }
  if (options.min !== undefined && number < options.min) {
    throw new Error(`${fieldName} must be >= ${options.min}.`);
  }
  // 범위 초과 시 default fallback 아닌 throw로 fail-fast
  if (options.max !== undefined && number > options.max) {
    throw new Error(`${fieldName} must be <= ${options.max}.`);
  }
  return number;
}

function parseBoolean(value, fieldName, options = {}) {
  const hasDefault = Object.prototype.hasOwnProperty.call(options, 'defaultValue');
  if (value === undefined || value === null || String(value).trim() === '') {
    if (hasDefault) return options.defaultValue;
    throw new Error(`${fieldName} must be true or false.`);
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  throw new Error(`${fieldName} must be true or false.`);
}

function envValue(env, key, defaultValue) {
  return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : defaultValue;
}

function envText(env, key) {
  if (!Object.prototype.hasOwnProperty.call(env, key)) return '';
  return String(env[key] || '').trim();
}

function normalizeLlmProvider(value, defaultValue = DEFAULT_RUNTIME_CONFIG.llmProvider) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'default') return defaultValue;
  return normalized;
}

function isProModel(value) {
  return isGeminiProModel(value);
}

function deprecatedProEnvKeys(env) {
  return PRO_DISABLED_ENV_KEYS.filter(key => Object.prototype.hasOwnProperty.call(env, key));
}

function globalModelSource(env) {
  if (envText(env, 'LLM_MODEL')) return 'LLM_MODEL';
  if (envText(env, 'GEMINI_MODEL')) return 'GEMINI_MODEL';
  return '';
}

function resolveStageModels(env, llmModel, llmModelSource) {
  const models = {};
  const sources = {};
  for (const [group, envKey] of Object.entries(LLM_STAGE_MODEL_ENV_KEYS)) {
    const stageValue = envText(env, envKey);
    if (llmModelSource) {
      models[group] = llmModel;
      sources[group] = llmModelSource;
    } else if (stageValue) {
      models[group] = stageValue;
      sources[group] = envKey;
    } else {
      models[group] = DEFAULT_LLM_STAGE_MODELS[group];
      sources[group] = 'code_default';
    }
  }
  return { models, sources };
}

function readRuntimeConfig(env = process.env, options = {}) {
  const newsletterDate = String(envValue(env, 'NEWSLETTER_DATE', DEFAULT_RUNTIME_CONFIG.newsletterDate) || '').trim();
  const defaultSelectionWindowPolicy = DEFAULT_RUNTIME_CONFIG.selectionWindowPolicy;
  const llmProvider = normalizeLlmProvider(envValue(env, 'LLM_PROVIDER', DEFAULT_RUNTIME_CONFIG.llmProvider));
  const llmModelExplicitlyConfigured = String(env.LLM_MODEL || '').trim().length > 0;
  const llmModelSource = globalModelSource(env);
  const llmModel = String(
    envValue(env, 'LLM_MODEL', envValue(env, 'GEMINI_MODEL', DEFAULT_RUNTIME_CONFIG.llmModel)) || ''
  ).trim();
  const llmFallbackDefault = envValue(env, 'GEMINI_FALLBACK_MODELS', DEFAULT_RUNTIME_CONFIG.llmFallbackModels.join(','));
  const llmFallbackValue = envValue(
    env,
    'LLM_FALLBACK_MODELS',
    llmFallbackDefault
  );
  const llmFallbackModels = parseCsv(llmFallbackValue);
  const stageModelResolution = resolveStageModels(env, llmModel, llmModelSource);

  const config = {
    newsletterDate,
    lookbackDays: parseInteger(envValue(env, 'LOOKBACK_DAYS', DEFAULT_RUNTIME_CONFIG.lookbackDays), 'LOOKBACK_DAYS', { min: 1 }),
    selectionWindowPolicy: {
      primarySelectionDays: parseInteger(
        envValue(env, 'PRIMARY_SELECTION_DAYS', defaultSelectionWindowPolicy.primarySelectionDays),
        'PRIMARY_SELECTION_DAYS',
        { min: 1 }
      ),
      fallbackSelectionDays: parseInteger(
        envValue(env, 'FALLBACK_SELECTION_DAYS', defaultSelectionWindowPolicy.fallbackSelectionDays),
        'FALLBACK_SELECTION_DAYS',
        { min: 1 }
      ),
      referenceContextDays: parseInteger(
        envValue(env, 'REFERENCE_CONTEXT_DAYS', defaultSelectionWindowPolicy.referenceContextDays),
        'REFERENCE_CONTEXT_DAYS',
        { min: 1 }
      )
    },
    llmProvider,
    llmModel,
    llmModelExplicitlyConfigured,
    llmGlobalModelExplicitlyConfigured: Boolean(llmModelSource),
    llmModelSource: llmModelSource || 'code_default',
    llmFallbackModels,
    llmStageModels: stageModelResolution.models,
    llmStageModelSources: stageModelResolution.sources,
    geminiModel: llmModel,
    geminiFallbackModels: llmFallbackModels,
    geminiMaxRetries: parseInteger(envValue(env, 'GEMINI_MAX_RETRIES', DEFAULT_RUNTIME_CONFIG.geminiMaxRetries), 'GEMINI_MAX_RETRIES', { min: 0 }),
    geminiRetryDelaysMs: parseIntegerList(
      envValue(env, 'GEMINI_RETRY_DELAYS_MS', DEFAULT_RUNTIME_CONFIG.geminiRetryDelaysMs.join(',')),
      'GEMINI_RETRY_DELAYS_MS'
    ),
    geminiRetryMaxDelayMs: parseInteger(
      envValue(env, 'GEMINI_RETRY_MAX_DELAY_MS', DEFAULT_RUNTIME_CONFIG.geminiRetryMaxDelayMs),
      'GEMINI_RETRY_MAX_DELAY_MS',
      { min: 0 }
    ),
    newsroomMaxQualityRetries: parseInteger(
      envValue(env, 'NEWSROOM_MAX_QUALITY_RETRIES', DEFAULT_RUNTIME_CONFIG.newsroomMaxQualityRetries),
      'NEWSROOM_MAX_QUALITY_RETRIES',
      { min: 0 }
    ),
    newsroomMaxSectionRepairs: parseInteger(
      envValue(env, 'NEWSROOM_MAX_SECTION_REPAIRS', DEFAULT_RUNTIME_CONFIG.newsroomMaxSectionRepairs),
      'NEWSROOM_MAX_SECTION_REPAIRS',
      { min: 0 }
    ),
    newsroomWarnCostUsd: parseNumber(
      envValue(env, 'NEWSROOM_WARN_COST_USD', DEFAULT_RUNTIME_CONFIG.newsroomWarnCostUsd),
      'NEWSROOM_WARN_COST_USD',
      { min: 0 }
    ),
    newsroomMaxCostUsd: parseNumber(
      envValue(env, 'NEWSROOM_MAX_COST_USD', DEFAULT_RUNTIME_CONFIG.newsroomMaxCostUsd),
      'NEWSROOM_MAX_COST_USD',
      { min: 0 }
    ),
    deprecatedProEnvKeys: deprecatedProEnvKeys(env),
    geminiThinkingBudgetReporter: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_REPORTER', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetReporter),
      'GEMINI_THINKING_BUDGET_REPORTER',
      { min: 0 }
    ),
    geminiThinkingBudgetEditor: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_EDITOR', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetEditor),
      'GEMINI_THINKING_BUDGET_EDITOR',
      { min: 0 }
    ),
    geminiThinkingBudgetRepair: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_REPAIR', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetRepair),
      'GEMINI_THINKING_BUDGET_REPAIR',
      { min: 0 }
    ),
    geminiThinkingBudgetFactcheck: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_FACTCHECK', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetFactcheck),
      'GEMINI_THINKING_BUDGET_FACTCHECK',
      { min: 0 }
    ),
    geminiThinkingBudgetJudge: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_JUDGE', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetJudge),
      'GEMINI_THINKING_BUDGET_JUDGE',
      { min: 0 }
    ),
    geminiThinkingBudgetScoring: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_SCORING', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetScoring),
      'GEMINI_THINKING_BUDGET_SCORING',
      { min: 0 }
    ),
    geminiTemperatureDefault: parseNumber(
      envValue(env, 'GEMINI_TEMPERATURE_DEFAULT', DEFAULT_RUNTIME_CONFIG.geminiTemperatureDefault),
      'GEMINI_TEMPERATURE_DEFAULT',
      { min: 0, max: 2, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiTemperatureDefault }
    ),
    geminiTemperatureSourceDiscovery: parseNumber(
      envValue(env, 'GEMINI_TEMPERATURE_SOURCE_DISCOVERY', DEFAULT_RUNTIME_CONFIG.geminiTemperatureSourceDiscovery),
      'GEMINI_TEMPERATURE_SOURCE_DISCOVERY',
      { min: 0, max: 2, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiTemperatureSourceDiscovery }
    ),
    geminiTemperatureReporter: parseNumber(
      envValue(env, 'GEMINI_TEMPERATURE_REPORTER', DEFAULT_RUNTIME_CONFIG.geminiTemperatureReporter),
      'GEMINI_TEMPERATURE_REPORTER',
      { min: 0, max: 2, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiTemperatureReporter }
    ),
    geminiTemperatureEditor: parseNumber(
      envValue(env, 'GEMINI_TEMPERATURE_EDITOR', DEFAULT_RUNTIME_CONFIG.geminiTemperatureEditor),
      'GEMINI_TEMPERATURE_EDITOR',
      { min: 0, max: 2, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiTemperatureEditor }
    ),
    geminiTemperatureFactcheck: parseNumber(
      envValue(env, 'GEMINI_TEMPERATURE_FACTCHECK', DEFAULT_RUNTIME_CONFIG.geminiTemperatureFactcheck),
      'GEMINI_TEMPERATURE_FACTCHECK',
      { min: 0, max: 2, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiTemperatureFactcheck }
    ),
    geminiTemperatureRepair: parseNumber(
      envValue(env, 'GEMINI_TEMPERATURE_REPAIR', DEFAULT_RUNTIME_CONFIG.geminiTemperatureRepair),
      'GEMINI_TEMPERATURE_REPAIR',
      { min: 0, max: 2, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiTemperatureRepair }
    ),
    geminiTemperatureJudge: parseNumber(
      envValue(env, 'GEMINI_TEMPERATURE_JUDGE', DEFAULT_RUNTIME_CONFIG.geminiTemperatureJudge),
      'GEMINI_TEMPERATURE_JUDGE',
      { min: 0, max: 2, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiTemperatureJudge }
    ),
    linkedEvidenceMode: String(
      envValue(env, 'NEWSROOM_LINKED_EVIDENCE_MODE', DEFAULT_RUNTIME_CONFIG.linkedEvidenceMode) || ''
    ).trim() || DEFAULT_RUNTIME_CONFIG.linkedEvidenceMode,
    linkedEvidenceMaxLinksPerCandidate: parseInteger(
      envValue(
        env,
        'NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE',
        DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxLinksPerCandidate
      ),
      'NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE',
      { min: 0 }
    ),
    linkedEvidenceMaxLinksPerRun: parseInteger(
      envValue(
        env,
        'NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN',
        DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxLinksPerRun
      ),
      'NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN',
      { min: 0 }
    ),
    linkedEvidenceTimeoutMs: parseInteger(
      envValue(env, 'NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS', DEFAULT_RUNTIME_CONFIG.linkedEvidenceTimeoutMs),
      'NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS',
      { min: 1 }
    ),
    linkedEvidenceMaxBytes: parseInteger(
      envValue(env, 'NEWSROOM_LINKED_EVIDENCE_MAX_BYTES', DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxBytes),
      'NEWSROOM_LINKED_EVIDENCE_MAX_BYTES',
      { min: 1 }
    ),
    newsroomCandidateInputMode: String(
      envValue(env, 'NEWSROOM_CANDIDATE_INPUT_MODE', DEFAULT_RUNTIME_CONFIG.newsroomCandidateInputMode) || ''
    ).trim().toLowerCase() || DEFAULT_RUNTIME_CONFIG.newsroomCandidateInputMode,
    newsroomCandidateInputPath: String(
      envValue(env, 'NEWSROOM_CANDIDATE_INPUT_PATH', DEFAULT_RUNTIME_CONFIG.newsroomCandidateInputPath) || ''
    ).trim(),
    newsroomEnableGeminiSourceDiscovery: parseBoolean(
      envValue(
        env,
        'NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY',
        DEFAULT_RUNTIME_CONFIG.newsroomEnableGeminiSourceDiscovery
      ),
      'NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY',
      { defaultValue: DEFAULT_RUNTIME_CONFIG.newsroomEnableGeminiSourceDiscovery }
    ),
    githubEventName: String(envValue(env, 'GITHUB_EVENT_NAME', DEFAULT_RUNTIME_CONFIG.githubEventName) || '').trim(),
    geminiApiKeyConfigured: Boolean(String(env.GEMINI_API_KEY || '').trim())
  };

  const result = validateRuntimeConfig(config, options);
  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }

  return config;
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateRuntimeConfig(config, options = {}) {
  const errors = [];

  if (config.newsletterDate && !isValidIsoDate(config.newsletterDate)) {
    errors.push('NEWSLETTER_DATE must be empty or a valid YYYY-MM-DD date.');
  }
  if (!Number.isInteger(config.lookbackDays) || config.lookbackDays < 1) {
    errors.push('LOOKBACK_DAYS must be an integer >= 1.');
  }
  const selectionWindowPolicy = config.selectionWindowPolicy ?? DEFAULT_RUNTIME_CONFIG.selectionWindowPolicy;
  if (!selectionWindowPolicy || typeof selectionWindowPolicy !== 'object' || Array.isArray(selectionWindowPolicy)) {
    errors.push('selectionWindowPolicy must be an object.');
  } else {
    const { primarySelectionDays, fallbackSelectionDays, referenceContextDays } = selectionWindowPolicy;
    if (!Number.isInteger(primarySelectionDays) || primarySelectionDays < 1) {
      errors.push('PRIMARY_SELECTION_DAYS must be an integer >= 1.');
    }
    if (!Number.isInteger(fallbackSelectionDays) || fallbackSelectionDays < 1) {
      errors.push('FALLBACK_SELECTION_DAYS must be an integer >= 1.');
    }
    if (!Number.isInteger(referenceContextDays) || referenceContextDays < 1) {
      errors.push('REFERENCE_CONTEXT_DAYS must be an integer >= 1.');
    }
    if (
      Number.isInteger(primarySelectionDays) &&
      Number.isInteger(fallbackSelectionDays) &&
      fallbackSelectionDays < primarySelectionDays
    ) {
      errors.push('FALLBACK_SELECTION_DAYS must be >= PRIMARY_SELECTION_DAYS.');
    }
    if (
      Number.isInteger(fallbackSelectionDays) &&
      Number.isInteger(referenceContextDays) &&
      referenceContextDays < fallbackSelectionDays
    ) {
      errors.push('REFERENCE_CONTEXT_DAYS must be >= FALLBACK_SELECTION_DAYS.');
    }
  }
  if (!LLM_PROVIDER_VALUES.includes(config.llmProvider)) {
    errors.push(`LLM_PROVIDER must be one of: ${LLM_PROVIDER_VALUES.join(', ')}.`);
  }
  if (!String(config.llmModel || '').trim()) {
    errors.push('LLM_MODEL/GEMINI_MODEL must be non-empty.');
  }
  if (!Array.isArray(config.llmFallbackModels)) {
    errors.push('LLM_FALLBACK_MODELS/GEMINI_FALLBACK_MODELS must be a comma-separated list.');
  } else if (config.llmFallbackModels.some(item => !String(item || '').trim())) {
    errors.push('LLM_FALLBACK_MODELS/GEMINI_FALLBACK_MODELS must not contain empty model names.');
  }
  const llmStageModels = config.llmStageModels ?? DEFAULT_RUNTIME_CONFIG.llmStageModels;
  if (!llmStageModels || typeof llmStageModels !== 'object' || Array.isArray(llmStageModels)) {
    errors.push('llmStageModels must be an object.');
  } else {
    for (const group of Object.keys(DEFAULT_LLM_STAGE_MODELS)) {
      if (!String(llmStageModels[group] || '').trim()) {
        errors.push(`llmStageModels.${group} must be non-empty.`);
      }
    }
  }
  if (!Number.isInteger(config.geminiMaxRetries) || config.geminiMaxRetries < 0) {
    errors.push('GEMINI_MAX_RETRIES must be an integer >= 0.');
  }
  if (!Array.isArray(config.geminiRetryDelaysMs) || config.geminiRetryDelaysMs.length === 0) {
    errors.push('GEMINI_RETRY_DELAYS_MS must contain at least one integer delay.');
  } else if (config.geminiRetryDelaysMs.some(value => !Number.isInteger(value) || value < 0)) {
    errors.push('GEMINI_RETRY_DELAYS_MS values must be integers >= 0.');
  }
  if (!Number.isInteger(config.geminiRetryMaxDelayMs) || config.geminiRetryMaxDelayMs < 0) {
    errors.push('GEMINI_RETRY_MAX_DELAY_MS must be an integer >= 0.');
  }
  if (!Number.isInteger(config.newsroomMaxQualityRetries) || config.newsroomMaxQualityRetries < 0) {
    errors.push('NEWSROOM_MAX_QUALITY_RETRIES must be an integer >= 0.');
  }
  if (!Number.isInteger(config.newsroomMaxSectionRepairs) || config.newsroomMaxSectionRepairs < 0) {
    errors.push('NEWSROOM_MAX_SECTION_REPAIRS must be an integer >= 0.');
  }
  if (!Number.isFinite(Number(config.newsroomWarnCostUsd)) || Number(config.newsroomWarnCostUsd) < 0) {
    errors.push('NEWSROOM_WARN_COST_USD must be a number >= 0.');
  }
  if (!Number.isFinite(Number(config.newsroomMaxCostUsd)) || Number(config.newsroomMaxCostUsd) < 0) {
    errors.push('NEWSROOM_MAX_COST_USD must be a number >= 0.');
  }
  const deprecatedProKeys = [
    ...PRO_DISABLED_ENV_KEYS.filter(key => Object.prototype.hasOwnProperty.call(config, key)),
    ...(Array.isArray(config.deprecatedProEnvKeys) ? config.deprecatedProEnvKeys : []),
    ...[
      'newsroomAllowProOnSchedule',
      'newsroomAllowProOnManual',
      'newsroomProEscalation'
    ].filter(key => Object.prototype.hasOwnProperty.call(config, key))
  ];
  if (deprecatedProKeys.length > 0) {
    errors.push(`Gemini Pro policy settings are no longer supported; remove: ${[...new Set(deprecatedProKeys)].join(', ')}.`);
  }
  for (const [field, name] of [
    [config.geminiThinkingBudgetReporter, 'GEMINI_THINKING_BUDGET_REPORTER'],
    [config.geminiThinkingBudgetEditor, 'GEMINI_THINKING_BUDGET_EDITOR'],
    [config.geminiThinkingBudgetRepair, 'GEMINI_THINKING_BUDGET_REPAIR'],
    [config.geminiThinkingBudgetFactcheck, 'GEMINI_THINKING_BUDGET_FACTCHECK'],
    [config.geminiThinkingBudgetJudge, 'GEMINI_THINKING_BUDGET_JUDGE'],
    [config.geminiThinkingBudgetScoring, 'GEMINI_THINKING_BUDGET_SCORING']
  ]) {
    if (!Number.isInteger(field) || field < 0) {
      errors.push(`${name} must be an integer >= 0.`);
    }
  }
  for (const [field, name, defaultField] of [
    [config.geminiTemperatureDefault, 'GEMINI_TEMPERATURE_DEFAULT', 'geminiTemperatureDefault'],
    [config.geminiTemperatureSourceDiscovery, 'GEMINI_TEMPERATURE_SOURCE_DISCOVERY', 'geminiTemperatureSourceDiscovery'],
    [config.geminiTemperatureReporter, 'GEMINI_TEMPERATURE_REPORTER', 'geminiTemperatureReporter'],
    [config.geminiTemperatureEditor, 'GEMINI_TEMPERATURE_EDITOR', 'geminiTemperatureEditor'],
    [config.geminiTemperatureFactcheck, 'GEMINI_TEMPERATURE_FACTCHECK', 'geminiTemperatureFactcheck'],
    [config.geminiTemperatureRepair, 'GEMINI_TEMPERATURE_REPAIR', 'geminiTemperatureRepair'],
    [config.geminiTemperatureJudge, 'GEMINI_TEMPERATURE_JUDGE', 'geminiTemperatureJudge']
  ]) {
    // 필드가 없으면 default값을 사용하므로 검증 대상에서 제외 (GEMINI_THINKING_BUDGET_* 패턴과 동일)
    const value = field !== undefined ? field : DEFAULT_RUNTIME_CONFIG[defaultField];
    if (!Number.isFinite(value) || value < 0 || value > 2) {
      errors.push(`${name} must be a number between 0 and 2.`);
    }
  }
  const linkedEvidenceMode = String(config.linkedEvidenceMode || DEFAULT_RUNTIME_CONFIG.linkedEvidenceMode).trim();
  if (!LINKED_EVIDENCE_MODE_VALUES.includes(linkedEvidenceMode)) {
    errors.push(`NEWSROOM_LINKED_EVIDENCE_MODE must be one of: ${LINKED_EVIDENCE_MODE_VALUES.join(', ')}.`);
  }
  for (const [field, name, min] of [
    [
      config.linkedEvidenceMaxLinksPerCandidate ?? DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxLinksPerCandidate,
      'NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE',
      0
    ],
    [
      config.linkedEvidenceMaxLinksPerRun ?? DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxLinksPerRun,
      'NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN',
      0
    ],
    [
      config.linkedEvidenceTimeoutMs ?? DEFAULT_RUNTIME_CONFIG.linkedEvidenceTimeoutMs,
      'NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS',
      1
    ],
    [
      config.linkedEvidenceMaxBytes ?? DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxBytes,
      'NEWSROOM_LINKED_EVIDENCE_MAX_BYTES',
      1
    ]
  ]) {
    if (!Number.isInteger(field) || field < min) {
      errors.push(`${name} must be an integer >= ${min}.`);
    }
  }
  const candidateInputMode = String(
    config.newsroomCandidateInputMode || DEFAULT_RUNTIME_CONFIG.newsroomCandidateInputMode
  ).trim();
  if (!CANDIDATE_INPUT_MODE_VALUES.includes(candidateInputMode)) {
    errors.push(`NEWSROOM_CANDIDATE_INPUT_MODE must be one of: ${CANDIDATE_INPUT_MODE_VALUES.join(', ')}.`);
  }
  if (/[ \t]*[\r\n]/.test(String(config.newsroomCandidateInputPath || ''))) {
    errors.push('NEWSROOM_CANDIDATE_INPUT_PATH must be a single-line repository-relative path.');
  }
  const enableGeminiSourceDiscovery =
    config.newsroomEnableGeminiSourceDiscovery ?? DEFAULT_RUNTIME_CONFIG.newsroomEnableGeminiSourceDiscovery;
  if (typeof enableGeminiSourceDiscovery !== 'boolean') {
    errors.push('NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY must be true or false.');
  }
  const configuredModels = configuredModelList(config);
  const proModels = configuredModels.filter(isProModel);
  if (proModels.length > 0) {
    errors.push(`Gemini Pro models are disabled; configured Pro model(s): ${proModels.join(', ')}.`);
  }
  if (options.requireGeminiApiKey && config.llmProvider === 'gemini' && !config.geminiApiKeyConfigured) {
    errors.push('GEMINI_API_KEY must be configured for Gemini newsroom generation.');
  }
  if (options.requireLlmCredentials && config.llmProvider === 'gemini' && !config.geminiApiKeyConfigured) {
    errors.push('GEMINI_API_KEY must be configured for Gemini newsroom generation.');
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

function sanitizeRuntimeConfig(config) {
  return {
    newsletterDate: config.newsletterDate,
    lookbackDays: config.lookbackDays,
    selectionWindowPolicy: {
      ...(config.selectionWindowPolicy ?? DEFAULT_RUNTIME_CONFIG.selectionWindowPolicy)
    },
    llmProvider: config.llmProvider,
    llmModel: config.llmModel,
    llmModelExplicitlyConfigured: Boolean(config.llmModelExplicitlyConfigured),
    llmGlobalModelExplicitlyConfigured: Boolean(config.llmGlobalModelExplicitlyConfigured),
    llmModelSource: config.llmModelSource || 'code_default',
    llmFallbackModels: config.llmFallbackModels,
    llmStageModels: {
      ...(config.llmStageModels ?? DEFAULT_RUNTIME_CONFIG.llmStageModels)
    },
    llmStageModelSources: {
      ...(config.llmStageModelSources ?? DEFAULT_RUNTIME_CONFIG.llmStageModelSources)
    },
    geminiModel: config.geminiModel,
    geminiFallbackModels: config.geminiFallbackModels,
    geminiMaxRetries: config.geminiMaxRetries,
    geminiRetryDelaysMs: config.geminiRetryDelaysMs,
    geminiRetryMaxDelayMs: config.geminiRetryMaxDelayMs,
    newsroomMaxQualityRetries: config.newsroomMaxQualityRetries,
    newsroomMaxSectionRepairs: config.newsroomMaxSectionRepairs,
    newsroomWarnCostUsd: config.newsroomWarnCostUsd,
    newsroomMaxCostUsd: config.newsroomMaxCostUsd,
    geminiThinkingBudgetReporter: config.geminiThinkingBudgetReporter,
    geminiThinkingBudgetEditor: config.geminiThinkingBudgetEditor,
    geminiThinkingBudgetRepair: config.geminiThinkingBudgetRepair,
    geminiThinkingBudgetFactcheck: config.geminiThinkingBudgetFactcheck,
    geminiThinkingBudgetJudge: config.geminiThinkingBudgetJudge,
    geminiThinkingBudgetScoring: config.geminiThinkingBudgetScoring,
    geminiTemperatureDefault: config.geminiTemperatureDefault,
    geminiTemperatureSourceDiscovery: config.geminiTemperatureSourceDiscovery,
    geminiTemperatureReporter: config.geminiTemperatureReporter,
    geminiTemperatureEditor: config.geminiTemperatureEditor,
    geminiTemperatureFactcheck: config.geminiTemperatureFactcheck,
    geminiTemperatureRepair: config.geminiTemperatureRepair,
    geminiTemperatureJudge: config.geminiTemperatureJudge,
    linkedEvidenceMode: config.linkedEvidenceMode,
    linkedEvidenceMaxLinksPerCandidate: config.linkedEvidenceMaxLinksPerCandidate,
    linkedEvidenceMaxLinksPerRun: config.linkedEvidenceMaxLinksPerRun,
    linkedEvidenceTimeoutMs: config.linkedEvidenceTimeoutMs,
    linkedEvidenceMaxBytes: config.linkedEvidenceMaxBytes,
    newsroomCandidateInputMode: config.newsroomCandidateInputMode ?? DEFAULT_RUNTIME_CONFIG.newsroomCandidateInputMode,
    newsroomCandidateInputPath: config.newsroomCandidateInputPath ?? DEFAULT_RUNTIME_CONFIG.newsroomCandidateInputPath,
    newsroomEnableGeminiSourceDiscovery:
      config.newsroomEnableGeminiSourceDiscovery ?? DEFAULT_RUNTIME_CONFIG.newsroomEnableGeminiSourceDiscovery,
    githubEventName: config.githubEventName,
    proPolicy: 'disabled',
    proModelConfigured: configuredModelList(config).some(isProModel),
    geminiApiKeyConfigured: Boolean(config.geminiApiKeyConfigured)
  };
}

module.exports = {
  DEFAULT_RUNTIME_CONFIG,
  LLM_PROVIDER_VALUES,
  DEFAULT_LLM_STAGE_MODELS,
  LLM_STAGE_MODEL_ENV_KEYS,
  PRO_DISABLED_ENV_KEYS,
  CANDIDATE_INPUT_MODE_VALUES,
  LINKED_EVIDENCE_MODES,
  LINKED_EVIDENCE_MODE_VALUES,
  readRuntimeConfig,
  validateRuntimeConfig,
  sanitizeRuntimeConfig,
  parseCsv,
  parseBoolean,
  parseInteger,
  parseIntegerList,
  parseNumber,
  normalizeLlmProvider,
  isProModel
};
