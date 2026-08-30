const LLM_STAGE_GROUPS = Object.freeze({
  REPORTER: 'reporter',
  EDITOR: 'editor',
  FACTCHECK: 'factcheck',
  REPAIR: 'repair',
  JUDGE: 'judge',
  EDITORIAL_PLAN: 'editorialPlan',
  SOURCE_DISCOVERY: 'sourceDiscovery'
});
const LLM_STAGE_GROUP_VALUES = Object.freeze(Object.values(LLM_STAGE_GROUPS));

/**
 * group 어휘와 group -> model 선택을 같은 모듈이 소유하므로, 이 검증도 여기 둔다.
 * stage-catalog는 이 함수를 import해 definition을 만들 때 group을 검증한다. 반대 방향
 * (model-policy가 catalog를 import)은 만들지 않는다 -- model-policy는 stage를 모른다.
 * enum이 있어도 JavaScript에서는 잘못된 값이 들어올 수 있으므로 public boundary에서 막는다.
 */
function assertLlmStageGroup(group) {
  if (!LLM_STAGE_GROUP_VALUES.includes(group)) {
    throw new Error(`unknown_llm_stage_group: ${String(group)}`);
  }
  return group;
}

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

function primaryModelForGroup(config, group) {
  assertLlmStageGroup(group);
  const stageModels = config?.llmStageModels && typeof config.llmStageModels === 'object'
    ? config.llmStageModels
    : null;
  return stageModels?.[group] || config?.llmModel || config?.geminiModel;
}

function configuredModelsForGroup(config, group) {
  const models = [
    primaryModelForGroup(config, group),
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
  return configuredModelsForGroup(config, LLM_STAGE_GROUPS.REPORTER);
}

module.exports = {
  LLM_STAGE_GROUPS,
  assertLlmStageGroup,
  configuredModels,
  configuredModelsForGroup,
  isGeminiProModel,
  normalizeModelName,
  primaryModelForGroup
};
