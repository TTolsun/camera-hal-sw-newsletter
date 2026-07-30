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
// 공용 fallback. editor/repair primary(gemini-3.5-flash)가 503 등으로 죽으면 먼저
// gemini-2.5-flash로 폴백한다 — flash-lite는 schema는 수용하지만 contract version 등
// 출력 품질이 editor/completion 게이트를 못 넘어 발행에 실패함을 실측 확인(PR #633로
// schema를 슬림화해 두 모델 모두 schema 자체는 수용). flash-lite는 최후 안전망으로 남긴다.
// reporter/factcheck(primary=gemini-2.5-flash)는 dedup으로 기존과 동일하고,
// judge/sourceDiscovery(primary=flash-lite)는 폴백 안전망이 flash로 강화된다.
const DEFAULT_LLM_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const DEFAULT_LLM_STAGE_MODELS = Object.freeze({
  reporter: 'gemini-2.5-flash',
  editor: 'gemini-3.5-flash',
  factcheck: 'gemini-2.5-flash',
  repair: 'gemini-3.5-flash',
  judge: 'gemini-2.5-flash-lite',
  // #700 editorial-plan은 분류·판단 stage라 flash-lite보다 분류 정확도가 좋은 gemini-2.5-flash를
  // 기본으로 둔다(editor의 비싼 gemini-3.5-flash는 불필요). 자체 노브로 독립 튜닝·비용 관측한다.
  editorialPlan: 'gemini-2.5-flash',
  sourceDiscovery: 'gemini-2.5-flash-lite'
});
const LLM_STAGE_MODEL_ENV_KEYS = Object.freeze({
  reporter: 'NEWSROOM_REPORTER_MODEL',
  editor: 'NEWSROOM_EDITOR_MODEL',
  factcheck: 'NEWSROOM_FACTCHECK_MODEL',
  repair: 'NEWSROOM_REPAIR_MODEL',
  judge: 'NEWSROOM_JUDGE_MODEL',
  editorialPlan: 'NEWSROOM_EDITORIALPLAN_MODEL',
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
  // #574: 주 1회 전환에 맞춰 source collection lookback 기본값을 35일로 둔다(메인 21일 +
  // reference 백스톱 35일). newsletters-01-source-collect-pr.yml 도 동일하게 LOOKBACK_DAYS=35를
  // 명시 전달한다. 이 기본값은 LOOKBACK_DAYS를 설정하지 않은 run에 적용된다.
  lookbackDays: 35,
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
    editorialPlan: 'code_default',
    sourceDiscovery: 'code_default'
  },
  geminiModel: DEFAULT_LLM_MODEL,
  geminiFallbackModels: DEFAULT_LLM_FALLBACK_MODELS,
  geminiMaxRetries: 2,
  geminiRetryDelaysMs: [20000, 10000],
  geminiRetryMaxDelayMs: 300000,
  // Wall-clock ceiling for a single LLM call. A hanging model is abandoned after
  // this many ms so the retry/fallback machinery can progress instead of stalling
  // the whole run (see #649; 2026-06-18 editor hang ran 24+ minutes). 480000ms is
  // 8 minutes: conservative headroom over a legitimately slow editor/factcheck
  // call while still bounding a hang far below the old unbounded behaviour. 0 disables.
  geminiCallTimeoutMs: 480000,
  newsroomMaxQualityRetries: 1,
  newsroomMaxSectionRepairs: 1,
  // weekly run 실측(2026-06-29 ~ 07-27) 정상 대역은 0.17~0.45 USD다. 경보가 매 run 울리면
  // 이상치를 가려내지 못하므로, 정상 주는 조용하고 튀는 주만 걸리도록 대역 위에 둔다.
  newsroomWarnCostUsd: 0.5,
  newsroomMaxCostUsd: 0.7,
  geminiThinkingBudgetReporter: 512,
  geminiThinkingBudgetEditor: 1024,
  geminiThinkingBudgetRepair: 1024,
  geminiThinkingBudgetFactcheck: 2048,
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
  newsroomEnableGeminiSourceDiscovery: true,
  // #429 linked evidence expansion은 Gemini source discovery가 켜진 run 안에서만 동작하고
  // non-failing이므로 기본 켜되, 문제 시 source discovery 전체를 끄지 않고 이 단계만 끌 수 있게 한다.
  newsroomEnableLinkedEvidenceDiscovery: true,
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
    geminiCallTimeoutMs: parseInteger(
      envValue(env, 'GEMINI_CALL_TIMEOUT_MS', DEFAULT_RUNTIME_CONFIG.geminiCallTimeoutMs),
      'GEMINI_CALL_TIMEOUT_MS',
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
      { min: 0, defaultValue: DEFAULT_RUNTIME_CONFIG.newsroomWarnCostUsd, defaultOnEmpty: true }
    ),
    newsroomMaxCostUsd: parseNumber(
      envValue(env, 'NEWSROOM_MAX_COST_USD', DEFAULT_RUNTIME_CONFIG.newsroomMaxCostUsd),
      'NEWSROOM_MAX_COST_USD',
      { min: 0, defaultValue: DEFAULT_RUNTIME_CONFIG.newsroomMaxCostUsd, defaultOnEmpty: true }
    ),
    deprecatedProEnvKeys: deprecatedProEnvKeys(env),
    geminiThinkingBudgetReporter: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_REPORTER', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetReporter),
      'GEMINI_THINKING_BUDGET_REPORTER',
      { min: 0, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetReporter, defaultOnEmpty: true }
    ),
    geminiThinkingBudgetEditor: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_EDITOR', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetEditor),
      'GEMINI_THINKING_BUDGET_EDITOR',
      { min: 0, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetEditor, defaultOnEmpty: true }
    ),
    geminiThinkingBudgetRepair: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_REPAIR', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetRepair),
      'GEMINI_THINKING_BUDGET_REPAIR',
      { min: 0, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetRepair, defaultOnEmpty: true }
    ),
    geminiThinkingBudgetFactcheck: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_FACTCHECK', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetFactcheck),
      'GEMINI_THINKING_BUDGET_FACTCHECK',
      { min: 0, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetFactcheck, defaultOnEmpty: true }
    ),
    geminiThinkingBudgetJudge: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_JUDGE', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetJudge),
      'GEMINI_THINKING_BUDGET_JUDGE',
      { min: 0, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetJudge, defaultOnEmpty: true }
    ),
    geminiThinkingBudgetScoring: parseInteger(
      envValue(env, 'GEMINI_THINKING_BUDGET_SCORING', DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetScoring),
      'GEMINI_THINKING_BUDGET_SCORING',
      { min: 0, defaultValue: DEFAULT_RUNTIME_CONFIG.geminiThinkingBudgetScoring, defaultOnEmpty: true }
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
    newsroomEnableLinkedEvidenceDiscovery: parseBoolean(
      envValue(
        env,
        'NEWSROOM_ENABLE_LINKED_EVIDENCE_DISCOVERY',
        DEFAULT_RUNTIME_CONFIG.newsroomEnableLinkedEvidenceDiscovery
      ),
      'NEWSROOM_ENABLE_LINKED_EVIDENCE_DISCOVERY',
      { defaultValue: DEFAULT_RUNTIME_CONFIG.newsroomEnableLinkedEvidenceDiscovery }
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
  if (!Number.isInteger(config.geminiCallTimeoutMs) || config.geminiCallTimeoutMs < 0) {
    errors.push('GEMINI_CALL_TIMEOUT_MS must be an integer >= 0.');
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
    geminiCallTimeoutMs: config.geminiCallTimeoutMs,
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
    newsroomEnableLinkedEvidenceDiscovery:
      config.newsroomEnableLinkedEvidenceDiscovery ?? DEFAULT_RUNTIME_CONFIG.newsroomEnableLinkedEvidenceDiscovery,
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
