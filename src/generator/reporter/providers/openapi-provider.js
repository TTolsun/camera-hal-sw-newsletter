const { configuredModelsForStage } = require('../../../../src/core/llm/model-policy');

function providerNotImplemented() {
  const error = new Error('provider_not_implemented: openapi is a reserved LLM provider enum and has no production HTTP client in this issue.');
  error.code = 'provider_not_implemented';
  return error;
}

module.exports = {
  id: 'openapi',
  displayName: 'Open API',
  pricingSource: null,

  buildRequest(args) {
    return {
      request: args,
      thinkingBudget: null
    };
  },

  configuredModels: configuredModelsForStage,
  configuredModelsForStage,

  createModelContext() {
    return {};
  },

  describeModelContext() {
    return '(reserved provider stub)';
  },

  estimateCallCost() {
    return {
      prompt_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0,
      billable_input_tokens: 0,
      billable_output_tokens: 0,
      estimated_cost_usd: null,
      pricing_usd_per_million: null,
      pricing_source: null,
      pricing_warning: 'Open API provider is reserved and not implemented.'
    };
  },

  getApiKey() {
    return '__openapi_reserved_provider__';
  },

  isProModel() {
    return false;
  },

  missingCredentialMessage: 'Open API provider is reserved and not implemented.',

  proPolicySummary() {
    return null;
  },

  async execute() {
    throw providerNotImplemented();
  },

  textFromResponse() {
    throw providerNotImplemented();
  },

  usageMetadataFromResponse() {
    return {
      usage_metadata_present: false,
      prompt_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0
    };
  },

  shouldStopRetriesAfter() {
    return false;
  }
};
