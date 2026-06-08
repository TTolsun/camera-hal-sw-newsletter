const LLM_STAGE_GROUPS = Object.freeze({
  REPORTER: 'reporter',
  EDITOR: 'editor',
  FACTCHECK: 'factcheck',
  REPAIR: 'repair',
  JUDGE: 'judge',
  SOURCE_DISCOVERY: 'sourceDiscovery'
});
const LLM_STAGE_GROUP_VALUES = Object.freeze(Object.values(LLM_STAGE_GROUPS));
const UNKNOWN_STAGE_ROUTING_WARNING = 'unknown_stage_defaulted_to_reporter';

function normalizeModelName(value) {
  return String(value || '').trim().toLowerCase();
}

function isGeminiProModel(value) {
  return /^gemini-[\w.-]*pro\b/.test(normalizeModelName(value));
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

function modelGroupInfoForStage(stage) {
  const normalized = normalizeModelName(stage);
  if (/source[-\s]?discovery/.test(normalized)) {
    return { group: LLM_STAGE_GROUPS.SOURCE_DISCOVERY, known: true, warning: '' };
  }
  if (/public[-\s]?article[-\s]?judge|\bjudge\b/.test(normalized)) {
    return { group: LLM_STAGE_GROUPS.JUDGE, known: true, warning: '' };
  }
  if (/background-context|reporter/.test(normalized)) {
    return { group: LLM_STAGE_GROUPS.REPORTER, known: true, warning: '' };
  }
  if (/fact[-\s]?checker|fact[-\s]?check/.test(normalized)) {
    return { group: LLM_STAGE_GROUPS.FACTCHECK, known: true, warning: '' };
  }
  if (/semantic repair|editor repair|completion|repair/.test(normalized)) {
    return { group: LLM_STAGE_GROUPS.REPAIR, known: true, warning: '' };
  }
  if (/editor/.test(normalized)) {
    return { group: LLM_STAGE_GROUPS.EDITOR, known: true, warning: '' };
  }
  return {
    group: LLM_STAGE_GROUPS.REPORTER,
    known: false,
    warning: UNKNOWN_STAGE_ROUTING_WARNING
  };
}

function modelGroupForStage(stage) {
  return modelGroupInfoForStage(stage).group;
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
  return dedupeModels(models);
}

function configuredModels(config) {
  if (config?.llmStageModels && typeof config.llmStageModels === 'object') {
    const models = [
      ...LLM_STAGE_GROUP_VALUES.map(group => config.llmStageModels[group]),
      ...fallbackModels(config)
    ];
    return dedupeModels(models);
  }
  return configuredModelsForStage(config, LLM_STAGE_GROUPS.REPORTER);
}

module.exports = {
  LLM_STAGE_GROUPS,
  UNKNOWN_STAGE_ROUTING_WARNING,
  configuredModels,
  configuredModelsForStage,
  isGeminiProModel,
  modelGroupInfoForStage,
  modelGroupForStage,
  normalizeModelName,
  primaryModelForStage
};
