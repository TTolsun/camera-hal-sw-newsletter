const { configuredModels } = require('../model-policy');
const { number } = require('../llm-cost');

function buildInternalHeaders(apiKey, config) {
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`
  };
  if (config.internalLlmApiVersion) {
    headers['x-api-version'] = config.internalLlmApiVersion;
  }
  return headers;
}

function buildInternalRequest({ model, systemInstruction, prompt, responseSchema, config }) {
  const request = {
    model,
    system_instruction: systemInstruction,
    prompt,
    response_schema: responseSchema
  };
  if (config.internalLlmApiVersion) {
    request.api_version = config.internalLlmApiVersion;
  }
  return request;
}

function stringifyJsonValue(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseInternalResponse(responseJson) {
  if (!responseJson || typeof responseJson !== 'object') {
    throw new Error('Internal LLM response must be a JSON object.');
  }
  if (Object.prototype.hasOwnProperty.call(responseJson, 'json')) {
    return stringifyJsonValue(responseJson.json);
  }
  if (Object.prototype.hasOwnProperty.call(responseJson, 'output_json')) {
    return stringifyJsonValue(responseJson.output_json);
  }
  if (typeof responseJson.text === 'string') {
    return responseJson.text;
  }
  const choiceContent = responseJson.choices?.[0]?.message?.content;
  if (typeof choiceContent === 'string') {
    return choiceContent;
  }
  throw new Error('Internal LLM response did not include json, output_json, text, or choices[0].message.content.');
}

function firstNumber(source, names) {
  if (!source || typeof source !== 'object') return 0;
  for (const name of names) {
    if (Number.isFinite(Number(source[name]))) return number(source[name]);
  }
  return 0;
}

function usageMetadataFromResponse(response) {
  const usage = response?.usage || response?.usage_metadata || null;
  if (!usage || typeof usage !== 'object') {
    return {
      usage_metadata_present: false,
      prompt_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0
    };
  }
  const promptTokens = firstNumber(usage, ['prompt_tokens', 'promptTokenCount', 'input_tokens']);
  const outputTokens = firstNumber(usage, ['completion_tokens', 'output_tokens', 'candidatesTokenCount']);
  const thinkingTokens = firstNumber(usage, ['thinking_tokens', 'thoughtsTokenCount']);
  const cachedTokens = firstNumber(usage, ['cached_tokens', 'cachedContentTokenCount']);
  const totalTokens = firstNumber(usage, ['total_tokens', 'totalTokenCount']) ||
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
  const billableInputTokens = Math.max(0, tokens.prompt_tokens - tokens.cached_tokens);
  const billableOutputTokens = tokens.output_tokens + tokens.thinking_tokens;
  return {
    ...tokens,
    billable_input_tokens: billableInputTokens,
    billable_output_tokens: billableOutputTokens,
    estimated_cost_usd: null,
    pricing_usd_per_million: null,
    pricing_source: null,
    pricing_warning: `No internal LLM pricing table configured for model ${model || 'unknown'}.`
  };
}

async function responseBodyText(response) {
  if (typeof response.text === 'function') {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }
  return '';
}

async function responseJson(response) {
  if (typeof response.json === 'function') {
    return response.json();
  }
  const text = await responseBodyText(response);
  return JSON.parse(text);
}

function createModelContext({ apiKey, config, options }) {
  const endpoint = String(options.endpoint || config.internalLlmEndpoint || '').trim();
  if (!endpoint) {
    throw new Error('INTERNAL_LLM_ENDPOINT must be configured for internal LLM generation.');
  }
  const fetchImpl = options.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Internal LLM provider requires fetch support.');
  }
  return {
    endpoint,
    fetchImpl,
    headers: buildInternalHeaders(apiKey, config),
    config
  };
}

module.exports = {
  id: 'internal',
  displayName: 'Internal LLM',
  pricingSource: null,

  buildInternalHeaders,
  buildInternalRequest,

  buildRequest(args) {
    return buildInternalRequest(args);
  },

  configuredModels,

  createModelContext,

  describeModelContext() {
    return '';
  },

  estimateCallCost,

  getApiKey({ options, env }) {
    return options.apiKey || env.INTERNAL_LLM_API_KEY;
  },

  isProModel() {
    return false;
  },

  missingCredentialMessage: 'Missing INTERNAL_LLM_API_KEY. Add it in GitHub repository Settings > Secrets and variables > Actions.',

  parseInternalResponse,

  proPolicySummary() {
    return null;
  },

  async execute({ context, request }) {
    const response = await context.fetchImpl(context.endpoint, {
      method: 'POST',
      headers: context.headers,
      body: JSON.stringify(request)
    });
    if (!response || response.ok === false) {
      const error = new Error(`Internal LLM API request failed with status ${response?.status || 'unknown'}.`);
      error.status = response?.status;
      error.body = await responseBodyText(response || {});
      throw error;
    }
    return responseJson(response);
  },

  textFromResponse(response) {
    return parseInternalResponse(response);
  },

  usageMetadataFromResponse
};
