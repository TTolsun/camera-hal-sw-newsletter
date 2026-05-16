const {
  configuredModels: configuredModelList,
  isGeminiProModel
} = require('../llm/model-policy');

const DEFAULT_LLM_PROVIDER = 'gemini';
const DEFAULT_LLM_MODEL = 'gemini-2.5-flash';
const DEFAULT_LLM_FALLBACK_MODELS = ['gemini-2.5-flash-lite'];
const LINKED_EVIDENCE_MODES = Object.freeze({
  EXTRACT_ONLY: 'extract_only',
  RESOLVE_ALLOWED_OFFICIAL_LINKS: 'resolve_allowed_official_links',
  OFFLINE_FIXTURE_TEST: 'offline_fixture_test'
});
const LINKED_EVIDENCE_MODE_VALUES = Object.freeze(Object.values(LINKED_EVIDENCE_MODES));
const CANDIDATE_INPUT_MODE_VALUES = Object.freeze(['default', 'artifact']);

const DEFAULT_RUNTIME_CONFIG = {
  newsletterDate: '',
  lookbackDays: 21,
  llmProvider: DEFAULT_LLM_PROVIDER,
  llmModel: DEFAULT_LLM_MODEL,
  llmFallbackModels: DEFAULT_LLM_FALLBACK_MODELS,
  geminiModel: DEFAULT_LLM_MODEL,
  geminiFallbackModels: DEFAULT_LLM_FALLBACK_MODELS,
  geminiMaxRetries: 2,
  geminiRetryDelaysMs: [20000, 10000],
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

function normalizeLlmProvider(value, defaultValue = DEFAULT_RUNTIME_CONFIG.llmProvider) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'default') return defaultValue;
  return normalized;
}

function isProModel(value) {
  return isGeminiProModel(value);
}

function readRuntimeConfig(env = process.env, options = {}) {
  const newsletterDate = String(envValue(env, 'NEWSLETTER_DATE', DEFAULT_RUNTIME_CONFIG.newsletterDate) || '').trim();
  const llmProvider = normalizeLlmProvider(envValue(env, 'LLM_PROVIDER', DEFAULT_RUNTIME_CONFIG.llmProvider));
  const llmModelExplicitlyConfigured = String(env.LLM_MODEL || '').trim().length > 0;
  const llmModel = String(
    envValue(env, 'LLM_MODEL', envValue(env, 'GEMINI_MODEL', DEFAULT_RUNTIME_CONFIG.llmModel)) || ''
  ).trim();
  const llmFallbackDefault = llmProvider === 'internal'
    ? ''
    : envValue(env, 'GEMINI_FALLBACK_MODELS', DEFAULT_RUNTIME_CONFIG.llmFallbackModels.join(','));
  const llmFallbackValue = envValue(
    env,
    'LLM_FALLBACK_MODELS',
    llmFallbackDefault
  );
  const llmFallbackModels = parseCsv(llmFallbackValue);

  const config = {
    newsletterDate,
    lookbackDays: parseInteger(envValue(env, 'LOOKBACK_DAYS', DEFAULT_RUNTIME_CONFIG.lookbackDays), 'LOOKBACK_DAYS', { min: 1 }),
    llmProvider,
    llmModel,
    llmModelExplicitlyConfigured,
    llmFallbackModels,
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
    internalLlmEndpoint: String(envValue(env, 'INTERNAL_LLM_ENDPOINT', DEFAULT_RUNTIME_CONFIG.internalLlmEndpoint) || '').trim(),
    internalLlmApiVersion: String(envValue(env, 'INTERNAL_LLM_API_VERSION', DEFAULT_RUNTIME_CONFIG.internalLlmApiVersion) || '').trim(),
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
    newsroomAllowProOnSchedule: parseBoolean(
      envValue(env, 'NEWSROOM_ALLOW_PRO_ON_SCHEDULE', DEFAULT_RUNTIME_CONFIG.newsroomAllowProOnSchedule),
      'NEWSROOM_ALLOW_PRO_ON_SCHEDULE',
      { defaultValue: DEFAULT_RUNTIME_CONFIG.newsroomAllowProOnSchedule }
    ),
    newsroomAllowProOnManual: parseBoolean(
      envValue(env, 'NEWSROOM_ALLOW_PRO_ON_MANUAL', DEFAULT_RUNTIME_CONFIG.newsroomAllowProOnManual),
      'NEWSROOM_ALLOW_PRO_ON_MANUAL',
      { defaultValue: DEFAULT_RUNTIME_CONFIG.newsroomAllowProOnManual }
    ),
    newsroomProEscalation: String(envValue(env, 'NEWSROOM_PRO_ESCALATION', DEFAULT_RUNTIME_CONFIG.newsroomProEscalation) || '').trim(),
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
    geminiThinkingBudgetScoring: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_SCORING', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetScoring),
      'GEMINI_THINKING_BUDGET_SCORING',
      { min: 0 }
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
    geminiApiKeyConfigured: Boolean(String(env.GEMINI_API_KEY || '').trim()),
    internalLlmApiKeyConfigured: Boolean(String(env.INTERNAL_LLM_API_KEY || '').trim())
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
  if (!['gemini', 'internal'].includes(config.llmProvider)) {
    errors.push('LLM_PROVIDER must be one of: gemini, internal.');
  }
  if (!String(config.llmModel || '').trim()) {
    errors.push('LLM_MODEL/GEMINI_MODEL must be non-empty.');
  }
  if (config.llmProvider === 'internal' && config.llmModelExplicitlyConfigured !== true) {
    errors.push('LLM_MODEL is required when LLM_PROVIDER=internal.');
  }
  if (!Array.isArray(config.llmFallbackModels)) {
    errors.push('LLM_FALLBACK_MODELS/GEMINI_FALLBACK_MODELS must be a comma-separated list.');
  } else if (config.llmFallbackModels.some(item => !String(item || '').trim())) {
    errors.push('LLM_FALLBACK_MODELS/GEMINI_FALLBACK_MODELS must not contain empty model names.');
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
  if (typeof config.newsroomAllowProOnSchedule !== 'boolean') {
    errors.push('NEWSROOM_ALLOW_PRO_ON_SCHEDULE must be true or false.');
  }
  if (typeof config.newsroomAllowProOnManual !== 'boolean') {
    errors.push('NEWSROOM_ALLOW_PRO_ON_MANUAL must be true or false.');
  }
  if (!String(config.newsroomProEscalation || '').trim()) {
    errors.push('NEWSROOM_PRO_ESCALATION must be non-empty.');
  }
  for (const [field, name] of [
    [config.geminiThinkingBudgetReporter, 'GEMINI_THINKING_BUDGET_REPORTER'],
    [config.geminiThinkingBudgetEditor, 'GEMINI_THINKING_BUDGET_EDITOR'],
    [config.geminiThinkingBudgetRepair, 'GEMINI_THINKING_BUDGET_REPAIR'],
    [config.geminiThinkingBudgetFactcheck, 'GEMINI_THINKING_BUDGET_FACTCHECK'],
    [config.geminiThinkingBudgetScoring, 'GEMINI_THINKING_BUDGET_SCORING']
  ]) {
    if (!Number.isInteger(field) || field < 0) {
      errors.push(`${name} must be an integer >= 0.`);
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
  const proModels = config.llmProvider === 'gemini' ? configuredModels.filter(isProModel) : [];
  if (proModels.length > 0) {
    const eventName = String(config.githubEventName || '').trim();
    const allowScheduled = eventName === 'schedule' && config.newsroomAllowProOnSchedule === true;
    const allowManual = eventName === 'workflow_dispatch' && config.newsroomAllowProOnManual === true;
    if (!allowScheduled && !allowManual) {
      errors.push(`Gemini Pro models require explicit manual escalation; configured Pro model(s): ${proModels.join(', ')}.`);
    }
  }
  if (options.requireGeminiApiKey && config.llmProvider === 'gemini' && !config.geminiApiKeyConfigured) {
    errors.push('GEMINI_API_KEY must be configured for Gemini newsroom generation.');
  }
  if (options.requireLlmCredentials && config.llmProvider === 'gemini' && !config.geminiApiKeyConfigured) {
    errors.push('GEMINI_API_KEY must be configured for Gemini newsroom generation.');
  }
  if (options.requireLlmCredentials && config.llmProvider === 'internal') {
    if (!config.internalLlmApiKeyConfigured) {
      errors.push('INTERNAL_LLM_API_KEY must be configured for internal LLM generation.');
    }
    if (!String(config.internalLlmEndpoint || '').trim()) {
      errors.push('INTERNAL_LLM_ENDPOINT must be configured for internal LLM generation.');
    }
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
    llmProvider: config.llmProvider,
    llmModel: config.llmModel,
    llmModelExplicitlyConfigured: Boolean(config.llmModelExplicitlyConfigured),
    llmFallbackModels: config.llmFallbackModels,
    geminiModel: config.geminiModel,
    geminiFallbackModels: config.geminiFallbackModels,
    geminiMaxRetries: config.geminiMaxRetries,
    geminiRetryDelaysMs: config.geminiRetryDelaysMs,
    geminiRetryMaxDelayMs: config.geminiRetryMaxDelayMs,
    newsroomMaxQualityRetries: config.newsroomMaxQualityRetries,
    newsroomMaxSectionRepairs: config.newsroomMaxSectionRepairs,
    newsroomWarnCostUsd: config.newsroomWarnCostUsd,
    newsroomMaxCostUsd: config.newsroomMaxCostUsd,
    newsroomAllowProOnSchedule: config.newsroomAllowProOnSchedule,
    newsroomAllowProOnManual: config.newsroomAllowProOnManual,
    newsroomProEscalation: config.newsroomProEscalation,
    geminiThinkingBudgetReporter: config.geminiThinkingBudgetReporter,
    geminiThinkingBudgetEditor: config.geminiThinkingBudgetEditor,
    geminiThinkingBudgetRepair: config.geminiThinkingBudgetRepair,
    geminiThinkingBudgetFactcheck: config.geminiThinkingBudgetFactcheck,
    geminiThinkingBudgetScoring: config.geminiThinkingBudgetScoring,
    linkedEvidenceMode: config.linkedEvidenceMode,
    linkedEvidenceMaxLinksPerCandidate: config.linkedEvidenceMaxLinksPerCandidate,
    linkedEvidenceMaxLinksPerRun: config.linkedEvidenceMaxLinksPerRun,
    linkedEvidenceTimeoutMs: config.linkedEvidenceTimeoutMs,
    linkedEvidenceMaxBytes: config.linkedEvidenceMaxBytes,
    newsroomCandidateInputMode: config.newsroomCandidateInputMode ?? DEFAULT_RUNTIME_CONFIG.newsroomCandidateInputMode,
    newsroomCandidateInputPath: config.newsroomCandidateInputPath ?? DEFAULT_RUNTIME_CONFIG.newsroomCandidateInputPath,
    newsroomEnableGeminiSourceDiscovery:
      config.newsroomEnableGeminiSourceDiscovery ?? DEFAULT_RUNTIME_CONFIG.newsroomEnableGeminiSourceDiscovery,
    internalLlmEndpointConfigured: Boolean(String(config.internalLlmEndpoint || '').trim()),
    internalLlmApiVersion: config.internalLlmApiVersion,
    githubEventName: config.githubEventName,
    proModelConfigured: config.llmProvider === 'gemini' && configuredModelList(config).some(isProModel),
    proModelAllowed: config.llmProvider === 'gemini' && configuredModelList(config).some(isProModel)
      ? (config.githubEventName === 'schedule' && config.newsroomAllowProOnSchedule === true) ||
        (config.githubEventName === 'workflow_dispatch' && config.newsroomAllowProOnManual === true)
      : false,
    geminiApiKeyConfigured: Boolean(config.geminiApiKeyConfigured),
    internalLlmApiKeyConfigured: Boolean(config.internalLlmApiKeyConfigured)
  };
}

module.exports = {
  DEFAULT_RUNTIME_CONFIG,
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
