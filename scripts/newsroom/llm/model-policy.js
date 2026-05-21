const GEMINI_PRO_FALLBACK_MODEL = 'gemini-2.5-pro';
const LLM_STAGE_GROUPS = Object.freeze({
  REPORTER: 'reporter',
  EDITOR: 'editor',
  FACTCHECK: 'factcheck',
  REPAIR: 'repair'
});
const LLM_STAGE_GROUP_VALUES = Object.freeze(Object.values(LLM_STAGE_GROUPS));

function normalizeModelName(value) {
  return String(value || '').trim().toLowerCase();
}

function isGeminiProModel(value) {
  return /^gemini-[\w.-]*pro\b/.test(normalizeModelName(value));
}

function shouldAppendGeminiProFallback(config) {
  return config?.llmProvider === 'gemini' &&
    config?.githubEventName === 'workflow_dispatch' &&
    config?.newsroomAllowProOnManual === true;
}

function dedupeModels(models) {
  return models.filter((item, index, items) => item && items.indexOf(item) === index);
}

function fallbackModels(config) {
  return Array.isArray(config?.llmFallbackModels)
    ? config.llmFallbackModels
    : Array.isArray(config?.geminiFallbackModels)
      ? config.geminiFallbackModels
      : [];
}

function modelGroupForStage(stage) {
  const normalized = normalizeModelName(stage);
  if (/background-context|reporter/.test(normalized)) return LLM_STAGE_GROUPS.REPORTER;
  if (/fact[-\s]?checker|fact[-\s]?check/.test(normalized)) return LLM_STAGE_GROUPS.FACTCHECK;
  if (/semantic repair|editor repair|completion|repair/.test(normalized)) return LLM_STAGE_GROUPS.REPAIR;
  if (/editor/.test(normalized)) return LLM_STAGE_GROUPS.EDITOR;
  return LLM_STAGE_GROUPS.REPORTER;
}

function primaryModelForStage(config, stage) {
  const group = modelGroupForStage(stage);
  const stageModels = config?.llmStageModels && typeof config.llmStageModels === 'object'
    ? config.llmStageModels
    : null;
  return stageModels?.[group] || config?.llmModel || config?.geminiModel;
}

function configuredModelsForStage(config, stage) {
  const models = [
    primaryModelForStage(config, stage),
    ...fallbackModels(config)
  ].filter(Boolean);
  if (shouldAppendGeminiProFallback(config)) {
    models.push(GEMINI_PRO_FALLBACK_MODEL);
  }
  return dedupeModels(models);
}

function configuredModels(config) {
  if (config?.llmStageModels && typeof config.llmStageModels === 'object') {
    const models = [
      ...LLM_STAGE_GROUP_VALUES.map(group => config.llmStageModels[group]),
      ...fallbackModels(config)
    ];
    if (shouldAppendGeminiProFallback(config)) {
      models.push(GEMINI_PRO_FALLBACK_MODEL);
    }
    return dedupeModels(models);
  }
  return configuredModelsForStage(config, LLM_STAGE_GROUPS.REPORTER);
}

function geminiProPolicySummary(config) {
  const models = configuredModels(config);
  const proModels = models.filter(isGeminiProModel);
  const eventName = String(config?.githubEventName || '').trim();
  const allowed = proModels.length > 0 &&
    (
      (eventName === 'schedule' && config.newsroomAllowProOnSchedule === true) ||
      (eventName === 'workflow_dispatch' && config.newsroomAllowProOnManual === true)
    );
  return {
    escalation: config?.newsroomProEscalation || 'manual',
    github_event_name: eventName,
    allow_pro_on_schedule: config?.newsroomAllowProOnSchedule === true,
    allow_pro_on_manual: config?.newsroomAllowProOnManual === true,
    pro_model_configured: proModels.length > 0,
    pro_model_allowed: Boolean(allowed),
    pro_models: proModels
  };
}

module.exports = {
  GEMINI_PRO_FALLBACK_MODEL,
  LLM_STAGE_GROUPS,
  configuredModels,
  configuredModelsForStage,
  geminiProPolicySummary,
  isGeminiProModel,
  modelGroupForStage,
  normalizeModelName,
  primaryModelForStage,
  shouldAppendGeminiProFallback
};
