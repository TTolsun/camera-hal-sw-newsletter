const { GoogleGenAI } = require('@google/genai');
const { TOKENS_PER_MILLION, number, roundUsd } = require('../llm-cost');
const {
  configuredModelsForStage,
  isGeminiProModel
} = require('../../../core/llm/model-policy');
const { isFreeTierQuotaExhausted } = require('../llm-errors');

const PRICING_SOURCE_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
const PRICE_TABLE = [
  {
    match: /^gemini-3\.5-flash$/i,
    inputUsdPerMillion: 1.5,
    outputUsdPerMillion: 9,
    cachedInputUsdPerMillion: 0.15
  },
  {
    match: /^gemini-2\.5-flash-lite\b/i,
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
    cachedInputUsdPerMillion: 0.01
  },
  {
    match: /^gemini-2\.5-flash\b/i,
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
    cachedInputUsdPerMillion: 0.03
  },
  {
    match: /^gemini-2\.0-flash\b/i,
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
    cachedInputUsdPerMillion: 0.025
  }
];

function findPricing(model, promptTokens = 0) {
  const modelName = String(model || '').trim();
  const pricing = PRICE_TABLE.find(item => item.match.test(modelName));
  if (!pricing) return null;
  const largePrompt = pricing.largePromptThresholdTokens &&
    number(promptTokens) > pricing.largePromptThresholdTokens;
  return {
    input_usd_per_million: largePrompt && pricing.inputUsdPerMillionLargePrompt
      ? pricing.inputUsdPerMillionLargePrompt
      : pricing.inputUsdPerMillion,
    output_usd_per_million: largePrompt && pricing.outputUsdPerMillionLargePrompt
      ? pricing.outputUsdPerMillionLargePrompt
      : pricing.outputUsdPerMillion,
    cached_input_usd_per_million: largePrompt && pricing.cachedInputUsdPerMillionLargePrompt
      ? pricing.cachedInputUsdPerMillionLargePrompt
      : pricing.cachedInputUsdPerMillion,
    large_prompt_threshold_tokens: pricing.largePromptThresholdTokens || null,
    large_prompt_applied: Boolean(largePrompt)
  };
}

function firstNumber(source, names) {
  if (!source || typeof source !== 'object') return 0;
  for (const name of names) {
    if (Number.isFinite(Number(source[name]))) return number(source[name]);
  }
  return 0;
}

function usageMetadataFromResponse(response) {
  const metadata = response?.usageMetadata || response?.usage_metadata || null;
  if (!metadata || typeof metadata !== 'object') {
    return {
      usage_metadata_present: false,
      prompt_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0
    };
  }
  const promptTokens = firstNumber(metadata, ['promptTokenCount', 'prompt_token_count']);
  const outputTokens = firstNumber(metadata, ['candidatesTokenCount', 'candidateTokenCount', 'candidates_token_count', 'candidate_token_count']);
  const thinkingTokens = firstNumber(metadata, ['thoughtsTokenCount', 'thinkingTokenCount', 'thoughts_token_count', 'thinking_token_count']);
  const cachedTokens = firstNumber(metadata, ['cachedContentTokenCount', 'cached_content_token_count']);
  const totalTokens = firstNumber(metadata, ['totalTokenCount', 'total_token_count']) ||
    promptTokens + outputTokens + thinkingTokens;
  return {
    usage_metadata_present: true,
    prompt_tokens: promptTokens,
    output_tokens: outputTokens,
    thinking_tokens: thinkingTokens,
    cached_tokens: cachedTokens,
    total_tokens: totalTokens
  };
}

function estimateCallCost(model, usage) {
  const tokens = {
    prompt_tokens: number(usage?.prompt_tokens),
    output_tokens: number(usage?.output_tokens),
    thinking_tokens: number(usage?.thinking_tokens),
    cached_tokens: number(usage?.cached_tokens),
    total_tokens: number(usage?.total_tokens)
  };
  const pricing = findPricing(model, tokens.prompt_tokens);
  const billableInputTokens = Math.max(0, tokens.prompt_tokens - tokens.cached_tokens);
  const billableOutputTokens = tokens.output_tokens + tokens.thinking_tokens;
  if (!pricing) {
    return {
      ...tokens,
      billable_input_tokens: billableInputTokens,
      billable_output_tokens: billableOutputTokens,
      estimated_cost_usd: null,
      pricing_usd_per_million: null,
      pricing_source: PRICING_SOURCE_URL,
      pricing_warning: `No local Gemini pricing entry for model ${model || 'unknown'}.`
    };
  }
  const estimatedCost =
    (billableInputTokens * pricing.input_usd_per_million +
      tokens.cached_tokens * pricing.cached_input_usd_per_million +
      billableOutputTokens * pricing.output_usd_per_million) / TOKENS_PER_MILLION;
  return {
    ...tokens,
    billable_input_tokens: billableInputTokens,
    billable_output_tokens: billableOutputTokens,
    estimated_cost_usd: roundUsd(estimatedCost),
    pricing_usd_per_million: pricing,
    pricing_source: PRICING_SOURCE_URL,
    pricing_warning: ''
  };
}

function temperatureForStage(stage, config) {
  const normalized = String(stage || '').toLowerCase();
  if (/public[-\s]?article[-\s]?judge|\bjudge\b/.test(normalized)) return config.geminiTemperatureJudge;
  if (/fact[-\s]?check|factchecker/.test(normalized)) return config.geminiTemperatureFactcheck;
  if (/\brepair\b/.test(normalized)) return config.geminiTemperatureRepair;
  if (/\breporter\b/.test(normalized)) return config.geminiTemperatureReporter;
  if (/source[-\s]?discovery/.test(normalized)) return config.geminiTemperatureSourceDiscovery;
  if (/editor|completion/.test(normalized)) return config.geminiTemperatureEditor;
  // scoring stage는 현재 LLM 호출이 없어 default temperature로 흡수
  return config.geminiTemperatureDefault;
}

function thinkingBudgetForStage(stage, config) {
  const normalized = String(stage || '').toLowerCase();
  if (/public[-\s]?article[-\s]?judge|\bjudge\b/.test(normalized)) return config.geminiThinkingBudgetJudge;
  if (/fact[-\s]?check|factchecker/.test(normalized)) return config.geminiThinkingBudgetFactcheck;
  if (/\brepair\b/.test(normalized)) return config.geminiThinkingBudgetRepair;
  if (/\breporter\b/.test(normalized)) return config.geminiThinkingBudgetReporter;
  if (/scoring|selection|deterministic/.test(normalized)) return config.geminiThinkingBudgetScoring;
  if (/editor|completion/.test(normalized)) return config.geminiThinkingBudgetEditor;
  return 0;
}

const FLASH_LITE_MIN_THINKING_BUDGET = 512;
const MAX_THINKING_BUDGET = 24576;

// Gemini 모델 패밀리별 thinking 설정 방식이 다르다.
// - 3.x(gemini-3.x): thinkingLevel(LOW/MEDIUM/HIGH)만 허용, thinkingBudget 동봉 금지(보내면 400).
// - flash-lite: thinkingBudget 512~24576만 유효(0 불가, 기본 off).
// - 그 외(2.5/2.0-flash, 미상): thinkingBudget 그대로(0=off 허용).
function geminiThinkingFamily(model) {
  const name = String(model || '').trim().toLowerCase();
  if (/^gemini-3/.test(name)) return 'thinking_level';
  if (/^gemini-2\.5-flash-lite\b/.test(name)) return 'budget_positive';
  return 'budget';
}

// 단계별 thinkingBudget 의도를 3.x의 thinkingLevel로 번역한다.
function budgetToThinkingLevel(budget) {
  const value = Number.isInteger(budget) ? budget : 0;
  if (value <= 512) return 'LOW';
  if (value <= 2048) return 'MEDIUM';
  return 'HIGH';
}

function thinkingConfigForStage(stage, config, model) {
  const requested = thinkingBudgetForStage(stage, config);
  const family = geminiThinkingFamily(model);

  if (family === 'thinking_level') {
    const thinkingLevel = budgetToThinkingLevel(requested);
    return {
      requested,
      applied: requested,
      note: `gemini 3.x: thinkingBudget ${requested} -> thinkingLevel=${thinkingLevel}`,
      mode: 'thinking_level',
      thinkingLevel
    };
  }

  if (family === 'budget_positive') {
    if (!Number.isInteger(requested) || requested <= 0) {
      return {
        requested,
        applied: 0,
        note: 'flash-lite: thinkingBudget 0 -> thinkingConfig 생략',
        mode: 'omit'
      };
    }
    if (requested < FLASH_LITE_MIN_THINKING_BUDGET) {
      return {
        requested,
        applied: FLASH_LITE_MIN_THINKING_BUDGET,
        note: `flash-lite: thinkingBudget ${requested} -> ${FLASH_LITE_MIN_THINKING_BUDGET} 클램프`,
        mode: 'budget'
      };
    }
    if (requested > MAX_THINKING_BUDGET) {
      return {
        requested,
        applied: MAX_THINKING_BUDGET,
        note: `flash-lite: thinkingBudget ${requested} -> ${MAX_THINKING_BUDGET} 클램프`,
        mode: 'budget'
      };
    }
    return { requested, applied: requested, note: '', mode: 'budget' };
  }

  // 2.5/2.0-flash 및 미상: budget 그대로(0=off 허용), 유효 상한만 클램프.
  if (Number.isInteger(requested) && requested > MAX_THINKING_BUDGET) {
    return {
      requested,
      applied: MAX_THINKING_BUDGET,
      note: `thinkingBudget ${requested} -> ${MAX_THINKING_BUDGET} 클램프`,
      mode: 'budget'
    };
  }
  return { requested, applied: requested, note: '', mode: 'budget' };
}

function schemaConfig(responseSchema, temperature) {
  return {
    responseMimeType: 'application/json',
    responseSchema,
    temperature
  };
}

function apiVersionForModel() {
  if (process.env.GEMINI_API_VERSION) return process.env.GEMINI_API_VERSION;
  return undefined;
}

function buildGeminiRequest({ model, stage, systemInstruction, prompt, responseSchema, config }) {
  const thinkingBudget = thinkingConfigForStage(stage, config, model);
  const requestConfig = {
    systemInstruction,
    ...schemaConfig(responseSchema, temperatureForStage(stage, config))
  };
  if (thinkingBudget.mode === 'thinking_level') {
    requestConfig.thinkingConfig = { thinkingLevel: thinkingBudget.thinkingLevel };
  } else if (thinkingBudget.mode === 'budget' && Number.isInteger(thinkingBudget.applied)) {
    requestConfig.thinkingConfig = { thinkingBudget: thinkingBudget.applied };
  }
  return {
    request: {
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: requestConfig
    },
    thinkingBudget
  };
}

function createModelContext({ modelName, apiKey, config, options }) {
  const apiVersion = apiVersionForModel(modelName);
  const ClientCtor = options.GoogleGenAI || GoogleGenAI;
  const ai = options.ai || new ClientCtor(apiVersion ? { apiKey, apiVersion } : { apiKey });
  return {
    ai,
    apiVersion,
    requestState: null,
    modelName,
    config
  };
}

module.exports = {
  id: 'gemini',
  displayName: 'Gemini',
  pricingSource: PRICING_SOURCE_URL,

  buildRequest(args) {
    return buildGeminiRequest(args);
  },

  configuredModels: configuredModelsForStage,
  configuredModelsForStage,

  createModelContext,

  describeModelContext(context) {
    return `(apiVersion ${context.apiVersion || 'sdk-default'})`;
  },

  estimateCallCost,

  findPricing,

  getApiKey({ options, env }) {
    return options.apiKey || env.GEMINI_API_KEY;
  },

  isProModel: isGeminiProModel,

  missingCredentialMessage: 'Missing GEMINI_API_KEY. Add it in GitHub repository Settings > Secrets and variables > Actions.',

  proPolicySummary() {
    return { status: 'disabled' };
  },

  async execute({ context, request }) {
    return context.ai.models.generateContent(request);
  },

  textFromResponse(response) {
    return typeof response?.text === 'function' ? response.text() : response?.text;
  },

  temperatureForStage,

  thinkingBudgetForStage,
  thinkingConfigForStage,
  budgetToThinkingLevel,
  geminiThinkingFamily,

  usageMetadataFromResponse,

  warnModelSelection(stage, modelName) {
    if (isGeminiProModel(modelName)) {
      console.warn(`[${stage}] Gemini Pro model selected despite disabled policy: ${modelName}.`);
    }
  },

  shouldStopRetriesAfter(error, retryableStatuses) {
    return isFreeTierQuotaExhausted(error, retryableStatuses);
  }
};
