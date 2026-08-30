const fs = require('fs');
const path = require('path');
const { readRuntimeConfig } = require('../common/runtime-config');
const { createDiagnosticsState } = require('./llm-diagnostics');
const {
  buildCostReport: buildLlmCostReport,
  buildCostReportMarkdown
} = require('./llm-cost');
const {
  LlmCallTimeoutError,
  LlmJsonParseError,
  errorStatus,
  extractJson,
  isQuotaError,
  isRetryableError,
  isSchemaComplexityError,
  lastStatus,
  parseRetryDelayMs
} = require('./llm-errors');
const { resolveProvider } = require('./providers/provider-registry');
const { assertStageRun, stageRunIdentity } = require('./stage-catalog');

const geminiProvider = resolveProvider('gemini');

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

// stage 정체성을 에러에 구조화 필드로 싣는다(#981). 예전에는 호출자가 메시지의
// `[label]` prefix를 정규식으로 잘라 failure_stage를 만들었는데, 그건 sanitize가 아니라
// 의미 해석이라 label 철자에 묶여 있었다.
function failStage(run, message) {
  const error = new Error(message);
  error.stage = run.label;
  error.stage_id = run.definition.id;
  throw error;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Put a wall-clock ceiling on a single provider call. Node cannot cancel the
// underlying SDK request, so we stop awaiting it (Promise.race) and swallow any
// late settlement to avoid an unhandled rejection. timeoutMs <= 0 disables the
// ceiling entirely, preserving the original behaviour for offline/fixture runs.
function callWithTimeout(execPromise, timeoutMs, stage, modelName) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return execPromise;
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new LlmCallTimeoutError(stage, modelName, timeoutMs)), timeoutMs);
  });
  execPromise.catch(() => {});
  return Promise.race([execPromise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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

function recordUsageMetadata(run, provider, modelName, attempt, response, requestState = {}, routing = {}) {
  const usage = provider.usageMetadataFromResponse(response);
  const cost = provider.estimateCallCost(modelName, usage);
  const thinkingBudget = requestState.thinkingBudget || {};
  const fallbackIndex = Number.isInteger(routing.fallback_index) ? routing.fallback_index : null;
  diagnostics.recordCostCall({
    provider: provider.id,
    ...stageRunIdentity(run),
    stage_group: routing.stage_group,
    stage_group_known: routing.stage_group_known !== false,
    routing_warning: routing.routing_warning || '',
    model: modelName,
    primary_model: routing.primary_model || modelName,
    attempt_model: routing.attempt_model || modelName,
    fallback_models: Array.isArray(routing.fallback_models) ? [...routing.fallback_models] : [],
    primary_resolved_by: routing.primary_resolved_by || routing.resolved_by || 'unknown',
    attempt_resolved_by: routing.attempt_resolved_by || routing.resolved_by || 'unknown',
    resolved_by: routing.resolved_by || routing.attempt_resolved_by || 'unknown',
    fallback_index: fallbackIndex,
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

function routingForAttempt(baseRouting, modelName, modelIndex) {
  const isPrimary = modelIndex === 0;
  const attemptResolvedBy = isPrimary ? baseRouting.primary_resolved_by : 'fallback';
  return {
    ...baseRouting,
    attempt_model: modelName,
    attempt_resolved_by: attemptResolvedBy,
    resolved_by: attemptResolvedBy,
    fallback_index: isPrimary ? null : modelIndex - 1
  };
}

async function generateContentJsonWithRetry(run, provider, context, requestState, modelName, routing = {}) {
  const stage = run.label;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      diagnostics.recordRequest(run, modelName);
      console.log(`[${stage}] ${provider.displayName} request attempt ${attempt}/${maxRetries + 1} using model ${modelName}.`);
      const response = await callWithTimeout(
        provider.execute({ context, request: requestState.request, modelName, stage }),
        runtimeConfig.geminiCallTimeoutMs,
        stage,
        modelName
      );
      recordUsageMetadata(run, provider, modelName, attempt, response, requestState, routing);
      const text = provider.textFromResponse(response);
      const json = extractJson(text, stage, provider.displayName);
      diagnostics.recordSuccess(run, modelName);
      return json;
    } catch (error) {
      lastError = error;

      if (error instanceof LlmCallTimeoutError) {
        // The model is hanging; retrying the same model would likely hang again.
        // Abandon it and let the outer loop fall through to the next fallback.
        diagnostics.recordApiError(run, modelName);
        console.warn(`${error.message} Abandoning model ${modelName} and trying the next fallback if configured.`);
        break;
      }

      if (error instanceof LlmJsonParseError) {
        diagnostics.recordInvalidJson(run, modelName);
        const rawPath = saveRawLlmOutput(stage, attempt, modelName, error.rawText);
        if (attempt > maxRetries) break;
        const delayMs = retryDelay(attempt, error);
        console.warn(
          `[${stage}] ${provider.displayName} returned invalid JSON for model ${modelName}; raw output saved to ${path.relative(process.cwd(), rawPath)}. Retrying in ${delayMs}ms.`
        );
        await sleep(delayMs);
        continue;
      }

      if (isQuotaError(error, retryableStatuses)) diagnostics.recordQuotaError(run, modelName);
      else diagnostics.recordApiError(run, modelName);

      const retryable = isRetryableError(error, retryableStatuses);
      if (!retryable || attempt > maxRetries) break;

      if (typeof provider.shouldStopRetriesAfter === 'function' && provider.shouldStopRetriesAfter(error, retryableStatuses)) {
        console.warn(`[${stage}] ${provider.displayName} quota appears exhausted for model ${modelName}; skipping remaining retries for this model.`);
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

async function callLlmJson(stageRunArg, systemInstruction, prompt, responseSchema, options = {}) {
  // production boundary. catalog 밖의 값(예전 자유 문자열 label)은 여기서 막는다.
  const run = assertStageRun(stageRunArg);
  const stage = run.label;
  const provider = options.provider || resolveProvider(runtimeConfig.llmProvider);
  const key = provider.getApiKey({ options, env: process.env, config: runtimeConfig });
  if (!key) {
    fail(provider.missingCredentialMessage);
  }

  const failures = [];
  // stage -> group 변환은 이 지점 하나만 한다. model-policy는 group만 알고 stage를 모른다.
  const stageGroup = run.definition.modelGroup;
  const modelNames = provider.configuredModelsForGroup(runtimeConfig, stageGroup);
  const primaryResolvedBy = runtimeConfig.llmStageModelSources?.[stageGroup] || runtimeConfig.llmModelSource || 'unknown';
  const routing = {
    stage_group: stageGroup,
    stage_group_known: true,
    routing_warning: '',
    primary_model: modelNames[0] || '',
    fallback_models: modelNames.slice(1),
    primary_resolved_by: primaryResolvedBy,
    resolved_by: primaryResolvedBy,
    global_override_applied: runtimeConfig.llmGlobalModelExplicitlyConfigured === true
  };
  diagnostics.recordModelRouting(run, routing);

  for (const [modelIndex, modelName] of modelNames.entries()) {
    const attemptRouting = routingForAttempt(routing, modelName, modelIndex);
    let context;
    try {
      context = provider.createModelContext({ modelName, apiKey: key, config: runtimeConfig, options });
    } catch (error) {
      failStage(run, `[${stage}] ${provider.displayName} provider configuration failed: ${error.message}`);
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
        sampling: run.definition.sampling,
        systemInstruction,
        prompt,
        responseSchema,
        config: runtimeConfig
      });
      const requestState = {
        request: builtRequest.request || builtRequest,
        thinkingBudget: builtRequest.thinkingBudget || null
      };
      const json = await generateContentJsonWithRetry(run, provider, context, requestState, modelName, attemptRouting);
      console.log(`[${stage}] ${provider.displayName} API succeeded with model ${modelName}.`);
      return json;
    } catch (error) {
      failures.push({
        model: modelName,
        status: lastStatus(error, retryableStatuses),
        message: error.message
      });

      if (
        !(error instanceof LlmJsonParseError) &&
        !(error instanceof LlmCallTimeoutError) &&
        !isRetryableError(error, retryableStatuses)
      ) {
        if (error?.code === 'provider_not_implemented') {
          failStage(run, `[${stage}] ${provider.displayName} provider_not_implemented: ${error.message}`);
        }
        if (isSchemaComplexityError(error)) {
          // Permanent schema drift, not a capacity issue. Fail fast with a clear
          // root cause: the weaker fallback models would reject the same schema, so
          // there is nothing to gain by burning calls on them.
          failStage(
            run,
            `[${stage}] ${provider.displayName} rejected the response schema as too complex on model ${modelName} ` +
            `(constrained-decoding "too many states"). The response schema for this stage likely drifted past the ` +
            `model's state limit; slim optional/enum fields (see PR #633) or route this stage to a model that ` +
            `accepts it. Underlying error: ${error.message}`
          );
        }
        failStage(run, `[${stage}] ${provider.displayName} API failed with non-retryable error on model ${modelName}: ${error.message}`);
      }

      console.warn(`[${stage}] ${provider.displayName} model ${modelName} failed after ${maxRetries} retries. Trying fallback model if configured.`);
    }
  }

  failStage(run, failureSummary(stage, provider, failures));
}

async function callLlmJsonBudgeted(stageRunArg, systemInstruction, prompt, responseSchema, options = {}) {
  const run = assertStageRun(stageRunArg);
  const budget = options.budget || null;
  if (budget && typeof budget.assertCanRequest === 'function') {
    // 예산 config는 stage id 어휘를 쓴다(#993). label로 조회하면 label 철자에 묶인다.
    budget.assertCanRequest(run.definition.id);
  }
  try {
    return await callLlmJson(run, systemInstruction, prompt, responseSchema, options);
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

function getLlmModelUsage(stageRunArg) {
  return diagnostics.getModelUsage(assertStageRun(stageRunArg));
}

// quality attempt를 특정할 수 없는 호출자를 위한 조회. 이 stage가 이번 실행에서 마지막으로
// 성공한 model을 돌려준다.
function getLastLlmModelForStage(definition) {
  return diagnostics.getLastModelForStage(definition);
}

function resetLlmDiagnostics() {
  diagnostics.reset();
}

module.exports = {
  LlmCallTimeoutError,
  LlmJsonParseError,
  buildCostReport,
  buildCostReportMarkdown,
  callLlmJson,
  callLlmJsonBudgeted,
  callWithTimeout,
  estimateCallCost: geminiProvider.estimateCallCost,
  extractJson,
  findPricing: geminiProvider.findPricing,
  getLastLlmModelForStage,
  getLlmCostCalls,
  getLlmDiagnostics,
  getLlmModelUsage,
  parseRetryDelayMs,
  resetLlmDiagnostics,
  safeFilenamePart,
  saveRawLlmOutput,
  usageMetadataFromResponse: geminiProvider.usageMetadataFromResponse
};
