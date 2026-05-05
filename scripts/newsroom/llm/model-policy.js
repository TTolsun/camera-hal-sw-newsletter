function normalizeModelName(value) {
  return String(value || '').trim().toLowerCase();
}

function isGeminiProModel(value) {
  return /^gemini-[\w.-]*pro\b/.test(normalizeModelName(value));
}

function configuredModels(config) {
  const models = [
    config?.llmModel ?? config?.geminiModel,
    ...(Array.isArray(config?.llmFallbackModels)
      ? config.llmFallbackModels
      : Array.isArray(config?.geminiFallbackModels)
        ? config.geminiFallbackModels
        : [])
  ].filter(Boolean);
  return models.filter((item, index, items) => items.indexOf(item) === index);
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
  configuredModels,
  geminiProPolicySummary,
  isGeminiProModel,
  normalizeModelName
};
