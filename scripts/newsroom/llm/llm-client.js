const fs = require('fs');
const path = require('path');
const { readRuntimeConfig } = require('../common/runtime-config');
const { createDiagnosticsState } = require('./llm-diagnostics');
const {
  buildCostReport: buildLlmCostReport,
  buildCostReportMarkdown
} = require('./llm-cost');
const {
  LlmJsonParseError,
  errorStatus,
  extractJson,
  isFreeTierQuotaExhausted,
  isQuotaError,
  isRetryableError,
  lastStatus,
  parseRetryDelayMs
} = require('./llm-errors');
const geminiProvider = require('./providers/gemini-provider');
const internalProvider = require('./providers/internal-provider');
const { modelGroupForStage } = require('./model-policy');

const runtimeConfig = readRuntimeConfig(process.env);
const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const maxRetries = runtimeConfig.geminiMaxRetries;
const effectiveRetryDelaysMs = runtimeConfig.geminiRetryDelaysMs;
const maxRetryDelayMs = runtimeConfig.geminiRetryMaxDelayMs;
const rawOutputRoot = process.env.LLM_RAW_OUTPUT_DIR ||
  process.env.GEMINI_RAW_OUTPUT_DIR ||
  path.join(process.cwd(), '.tmp', 'gemini-raw');
const diagnostics = createDiagnosticsState();

function fail(message) {
  throw new Error(message);
}

function resolveProvider(providerId = runtimeConfig.llmProvider) {
  if (providerId === 'gemini') return geminiProvider;
  if (providerId === 'internal') return internalProvider;
  fail(`Unsupported LLM provider: ${providerId}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeFilenamePart(value) {
  const safe = String(value || 'unknown')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return safe || 'unknown';
}

function saveRawLlmOutput(stage, attempt, modelName, text) {
  fs.mkdirSync(rawOutputRoot, { recursive: true });
  const fileName = `${safeFilenamePart(stage)}-attempt-${attempt}-${safeFilenamePart(modelName)}.txt`;
  const filePath = path.join(rawOutputRoot, fileName);
  fs.writeFileSync(filePath, String(text || ''), 'utf8');
  return filePath;
}

function retryDelay(attempt, error) {
  const hintedDelay = parseRetryDelayMs(error);
  if (hintedDelay !== null) return Math.min(hintedDelay, maxRetryDelayMs);
  return effectiveRetryDelaysMs[attempt - 1] ?? effectiveRetryDelaysMs[effectiveRetryDelaysMs.length - 1];
}

function recordUsageMetadata(stage, provider, modelName, attempt, response, requestState = {}, routing = {}) {
  const usage = provider.usageMetadataFromResponse(response);
  const cost = provider.estimateCallCost(modelName, usage);
  const thinkingBudget = requestState.thinkingBudget || {};
  diagnostics.recordCostCall({
    provider: provider.id,
    stage,
    stage_group: routing.stage_group || modelGroupForStage(stage),
    model: modelName,
    primary_model: routing.primary_model || modelName,
    attempt_model: modelName,
    fallback_models: Array.isArray(routing.fallback_models) ? [...routing.fallback_models] : [],
    resolved_by: routing.resolved_by || 'unknown',
    global_override_applied: routing.global_override_applied === true,
    attempt,
    pro_model: provider.isProModel(modelName),
    usage_metadata_present: usage.usage_metadata_present,
    prompt_tokens: cost.prompt_tokens,
    output_tokens: cost.output_tokens,
    thinking_tokens: cost.thinking_tokens,
    thinking_budget_requested: thinkingBudget.requested ?? null,
    thinking_budget_applied: thinkingBudget.applied ?? null,
    thinking_budget_note: thinkingBudget.note || '',
    cached_tokens: cost.cached_tokens,
    total_tokens: cost.total_tokens,
    billable_input_tokens: cost.billable_input_tokens,
    billable_output_tokens: cost.billable_output_tokens,
    estimated_cost_usd: cost.estimated_cost_usd,
    pricing_usd_per_million: cost.pricing_usd_per_million,
    pricing_source: cost.pricing_source,
    pricing_warning: cost.pricing_warning
  });
}

async function generateContentJsonWithRetry(stage, provider, context, requestState, modelName, routing = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      diagnostics.recordRequest(stage, modelName);
      console.log(`[${stage}] ${provider.displayName} request attempt ${attempt}/${maxRetries + 1} using model ${modelName}.`);
      const response = await provider.execute({ context, request: requestState.request, modelName, stage });
      recordUsageMetadata(stage, provider, modelName, attempt, response, requestState, routing);
      const text = provider.textFromResponse(response);
      const json = extractJson(text, stage, provider.displayName);
      diagnostics.recordSuccess(stage, modelName);
      return json;
    } catch (error) {
      lastError = error;

      if (error instanceof LlmJsonParseError) {
        diagnostics.recordInvalidJson(stage, modelName);
        const rawPath = saveRawLlmOutput(stage, attempt, modelName, error.rawText);
        if (attempt > maxRetries) break;
        const delayMs = retryDelay(attempt, error);
        console.warn(
          `[${stage}] ${provider.displayName} returned invalid JSON for model ${modelName}; raw output saved to ${path.relative(process.cwd(), rawPath)}. Retrying in ${delayMs}ms.`
        );
        await sleep(delayMs);
        continue;
      }

      if (isQuotaError(error, retryableStatuses)) diagnostics.recordQuotaError(stage, modelName);
      else diagnostics.recordApiError(stage, modelName);

      const retryable = isRetryableError(error, retryableStatuses);
      if (!retryable || attempt > maxRetries) break;

      if (provider.id === 'gemini' && isFreeTierQuotaExhausted(error, retryableStatuses)) {
        console.warn(`[${stage}] Gemini quota appears exhausted for model ${modelName}; skipping remaining retries for this model.`);
        break;
      }

      const delayMs = retryDelay(attempt, error);
      const status = errorStatus(error, retryableStatuses) || 'unknown';
      console.warn(
        `[${stage}] ${provider.displayName} API retry ${attempt}/${maxRetries} for model ${modelName} after status ${status}: ${error.message}. Waiting ${delayMs}ms.`
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function failureSummary(stage, provider, failures) {
  const lines = [
    `[${stage}] ${provider.displayName} API failed for all configured models.`,
    `Tried models: ${failures.map(item => item.model).join(', ')}`,
    `Retries per model: ${maxRetries}`,
    'Last error by model:'
  ];

  for (const item of failures) {
    lines.push(`- ${item.model}: status ${item.status}; ${item.message}`);
  }

  lines.push(`${provider.displayName} capacity or model-output quality issue is likely. Review .tmp/gemini-raw artifacts, re-run the job, or check fallback model availability.`);
  return lines.join('\n');
}

async function callLlmJson(stage, systemInstruction, prompt, responseSchema, options = {}) {
  const provider = options.provider || resolveProvider(runtimeConfig.llmProvider);
  const key = provider.getApiKey({ options, env: process.env, config: runtimeConfig });
  if (!key) {
    fail(provider.missingCredentialMessage);
  }

  const failures = [];
  const modelNames = provider.configuredModels(runtimeConfig, stage);
  const stageGroup = modelGroupForStage(stage);
  const routing = {
    stage,
    stage_group: stageGroup,
    primary_model: modelNames[0] || '',
    fallback_models: modelNames.slice(1),
    resolved_by: runtimeConfig.llmStageModelSources?.[stageGroup] || runtimeConfig.llmModelSource || 'unknown',
    global_override_applied: runtimeConfig.llmGlobalModelExplicitlyConfigured === true
  };
  diagnostics.recordModelRouting(stage, routing);

  for (const modelName of modelNames) {
    let context;
    try {
      context = provider.createModelContext({ modelName, apiKey: key, config: runtimeConfig, options });
    } catch (error) {
      fail(`[${stage}] ${provider.displayName} provider configuration failed: ${error.message}`);
    }
    const contextDescription = provider.describeModelContext(context);
    console.log(`[${stage}] ${provider.displayName} model selected: ${modelName}${contextDescription ? ` ${contextDescription}` : ''}.`);
    if (typeof provider.warnModelSelection === 'function') {
      provider.warnModelSelection(stage, modelName, runtimeConfig);
    }

    try {
      const builtRequest = provider.buildRequest({
        model: modelName,
        stage,
        systemInstruction,
        prompt,
        responseSchema,
        config: runtimeConfig
      });
      const requestState = {
        request: builtRequest.request || builtRequest,
        thinkingBudget: builtRequest.thinkingBudget || null
      };
      const json = await generateContentJsonWithRetry(stage, provider, context, requestState, modelName, routing);
      console.log(`[${stage}] ${provider.displayName} API succeeded with model ${modelName}.`);
      return json;
    } catch (error) {
      failures.push({
        model: modelName,
        status: lastStatus(error, retryableStatuses),
        message: error.message
      });

      if (!(error instanceof LlmJsonParseError) && !isRetryableError(error, retryableStatuses)) {
        fail(`[${stage}] ${provider.displayName} API failed with non-retryable error on model ${modelName}: ${error.message}`);
      }

      console.warn(`[${stage}] ${provider.displayName} model ${modelName} failed after ${maxRetries} retries. Trying fallback model if configured.`);
    }
  }

  fail(failureSummary(stage, provider, failures));
}

async function callLlmJsonBudgeted(stage, systemInstruction, prompt, responseSchema, options = {}) {
  const budget = options.budget || null;
  if (budget && typeof budget.assertCanRequest === 'function') {
    budget.assertCanRequest(stage);
  }
  try {
    return await callLlmJson(stage, systemInstruction, prompt, responseSchema, options);
  } finally {
    if (budget && typeof budget.mergeDiagnostics === 'function') {
      budget.mergeDiagnostics(getLlmDiagnostics());
    }
  }
}

function buildCostReport(options = {}) {
  const provider = resolveProvider(runtimeConfig.llmProvider);
  return buildLlmCostReport({
    pricingSource: provider.pricingSource,
    proPolicy: provider.proPolicySummary(runtimeConfig),
    ...options
  });
}

function getLlmDiagnostics() {
  return diagnostics.clone();
}

function getLlmCostCalls() {
  return diagnostics.costCalls();
}

function getLlmModelUsage(stage) {
  return diagnostics.getModelUsage(stage);
}

function resetLlmDiagnostics() {
  diagnostics.reset();
}

module.exports = {
  LlmJsonParseError,
  buildCostReport,
  buildCostReportMarkdown,
  callLlmJson,
  callLlmJsonBudgeted,
  estimateCallCost: geminiProvider.estimateCallCost,
  extractJson,
  findPricing: geminiProvider.findPricing,
  getLlmCostCalls,
  getLlmDiagnostics,
  getLlmModelUsage,
  parseRetryDelayMs,
  resetLlmDiagnostics,
  safeFilenamePart,
  saveRawLlmOutput,
  thinkingBudgetForStage(stage) {
    return geminiProvider.thinkingBudgetForStage(stage, runtimeConfig);
  },
  usageMetadataFromResponse: geminiProvider.usageMetadataFromResponse
};
