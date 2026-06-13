function createDiagnosticsState() {
  const diagnostics = {
    quota_error_count: 0,
    invalid_json_count: 0,
    model_usage: {},
    model_routing: {},
    cost_report: {
      calls: []
    }
  };
  const modelUsageByStage = new Map();

  function usageFor(stage, modelName) {
    if (!diagnostics.model_usage[stage]) diagnostics.model_usage[stage] = {};
    if (!diagnostics.model_usage[stage][modelName]) {
      diagnostics.model_usage[stage][modelName] = {
        requests: 0,
        successes: 0,
        invalid_json: 0,
        quota_errors: 0,
        api_errors: 0
      };
    }
    return diagnostics.model_usage[stage][modelName];
  }

  return {
    clone() {
      return JSON.parse(JSON.stringify(diagnostics));
    },

    costCalls() {
      return this.clone().cost_report.calls;
    },

    getModelUsage(stage) {
      return modelUsageByStage.get(stage) || '';
    },

    recordApiError(stage, modelName) {
      usageFor(stage, modelName).api_errors += 1;
    },

    recordCostCall(call) {
      diagnostics.cost_report.calls.push(call);
    },

    recordModelRouting(stage, routing) {
      diagnostics.model_routing[stage] = {
        ...routing
      };
    },

    recordInvalidJson(stage, modelName) {
      diagnostics.invalid_json_count += 1;
      usageFor(stage, modelName).invalid_json += 1;
    },

    recordQuotaError(stage, modelName) {
      diagnostics.quota_error_count += 1;
      usageFor(stage, modelName).quota_errors += 1;
    },

    recordRequest(stage, modelName) {
      usageFor(stage, modelName).requests += 1;
    },

    recordSuccess(stage, modelName) {
      usageFor(stage, modelName).successes += 1;
      modelUsageByStage.set(stage, modelName);
    },

    reset() {
      diagnostics.quota_error_count = 0;
      diagnostics.invalid_json_count = 0;
      diagnostics.model_usage = {};
      diagnostics.model_routing = {};
      diagnostics.cost_report = { calls: [] };
      modelUsageByStage.clear();
    }
  };
}

module.exports = {
  createDiagnosticsState
};
