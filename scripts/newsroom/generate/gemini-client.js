const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { readRuntimeConfig } = require('../common/runtime-config');

const PRICING_SOURCE_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
const TOKENS_PER_MILLION = 1000000;
const PRICE_TABLE = [
  {
    match: /^gemini-2\.5-pro\b/i,
    inputUsdPerMillion: 1.25,
    inputUsdPerMillionLargePrompt: 2.5,
    outputUsdPerMillion: 10,
    outputUsdPerMillionLargePrompt: 15,
    cachedInputUsdPerMillion: 0.125,
    cachedInputUsdPerMillionLargePrompt: 0.25,
    largePromptThresholdTokens: 200000
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

const runtimeConfig = readRuntimeConfig(process.env);
const apiKey = process.env.GEMINI_API_KEY;
const primaryModel = runtimeConfig.geminiModel;
const fallbackModels = runtimeConfig.geminiFallbackModels;
const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const maxRetries = runtimeConfig.geminiMaxRetries;
const effectiveRetryDelaysMs = runtimeConfig.geminiRetryDelaysMs;
const maxRetryDelayMs = runtimeConfig.geminiRetryMaxDelayMs;
const rawOutputRoot = process.env.GEMINI_RAW_OUTPUT_DIR || path.join(process.cwd(), '.tmp', 'gemini-raw');

class GeminiJsonParseError extends Error {
  constructor(stage, message, rawText = '') {
    super(`[${stage}] ${message}`);
    this.name = 'GeminiJsonParseError';
    this.stage = stage;
    this.rawText = String(rawText || '');
  }
}

const diagnostics = {
  quota_error_count: 0,
  invalid_json_count: 0,
  model_usage: {},
  cost_report: {
    calls: []
  }
};
const modelUsageByStage = new Map();

function fail(message) {
  throw new Error(message);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isProModelName(value) {
  return /^gemini-[\w.-]*pro\b/.test(String(value || '').trim().toLowerCase());
}

function proPolicySummary() {
  const configuredModels = [primaryModel, ...fallbackModels].filter(Boolean);
  const proModels = configuredModels.filter(isProModelName);
  const eventName = String(runtimeConfig.githubEventName || '').trim();
  const allowed = proModels.length > 0 &&
    (
      (eventName === 'schedule' && runtimeConfig.newsroomAllowProOnSchedule === true) ||
      (eventName === 'workflow_dispatch' && runtimeConfig.newsroomAllowProOnManual === true)
    );
  return {
    escalation: runtimeConfig.newsroomProEscalation,
    github_event_name: eventName,
    allow_pro_on_schedule: runtimeConfig.newsroomAllowProOnSchedule,
    allow_pro_on_manual: runtimeConfig.newsroomAllowProOnManual,
    pro_model_configured: proModels.length > 0,
    pro_model_allowed: Boolean(allowed),
    pro_models: proModels
  };
}

function thinkingBudgetForStage(stage) {
  const normalized = String(stage || '').toLowerCase();
  if (/fact[-\s]?check|factchecker/.test(normalized)) return runtimeConfig.geminiThinkingBudgetFactcheck;
  if (/\brepair\b/.test(normalized)) return runtimeConfig.geminiThinkingBudgetRepair;
  if (/\breporter\b/.test(normalized)) return runtimeConfig.geminiThinkingBudgetReporter;
  if (/scoring|selection|deterministic/.test(normalized)) return runtimeConfig.geminiThinkingBudgetScoring;
  if (/editor|completion/.test(normalized)) return runtimeConfig.geminiThinkingBudgetEditor;
  return 0;
}

function thinkingConfigForStage(stage, modelName) {
  const requested = thinkingBudgetForStage(stage);
  if (isProModelName(modelName) && requested === 0) {
    return {
      requested,
      applied: null,
      note: 'Gemini Pro may not support disabling thinking; thinkingConfig omitted for requested budget 0.'
    };
  }
  return {
    requested,
    applied: requested,
    note: ''
  };
}

function roundUsd(value) {
  return Number(value.toFixed(8));
}

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

function emptyCostTotals() {
  return {
    request_count: 0,
    prompt_tokens: 0,
    output_tokens: 0,
    thinking_tokens: 0,
    cached_tokens: 0,
    total_tokens: 0,
    billable_input_tokens: 0,
    billable_output_tokens: 0,
    estimated_cost_usd: 0
  };
}

function addCostTotals(target, call) {
  target.request_count += 1;
  for (const field of [
    'prompt_tokens',
    'output_tokens',
    'thinking_tokens',
    'cached_tokens',
    'total_tokens',
    'billable_input_tokens',
    'billable_output_tokens'
  ]) {
    target[field] += number(call[field]);
  }
  if (Number.isFinite(Number(call.estimated_cost_usd))) {
    target.estimated_cost_usd += Number(call.estimated_cost_usd);
  }
}

function finalizeCostTotals(totals) {
  return {
    ...totals,
    estimated_cost_usd: roundUsd(Number(totals.estimated_cost_usd || 0))
  };
}

function groupedCostTotals(calls, field) {
  const groups = new Map();
  for (const call of ensureArray(calls)) {
    const key = String(call[field] || 'unknown');
    if (!groups.has(key)) groups.set(key, emptyCostTotals());
    addCostTotals(groups.get(key), call);
  }
  return [...groups.entries()]
    .map(([name, totals]) => ({
      [field]: name,
      ...finalizeCostTotals(totals)
    }))
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd || String(a[field]).localeCompare(String(b[field])));
}

function buildCostReport({ date = '', calls = [], warnCostUsd = 0.15, maxCostUsd = 0.25, generatedAt = new Date().toISOString(), proPolicy = proPolicySummary() } = {}) {
  const totals = emptyCostTotals();
  const warnings = [];
  for (const call of ensureArray(calls)) {
    addCostTotals(totals, call);
    if (call.pricing_warning) warnings.push(call.pricing_warning);
    if (call.usage_metadata_present === false) {
      warnings.push(`No usage metadata for ${call.stage || 'unknown'} using ${call.model || 'unknown'}.`);
    }
    if (call.pro_model === true && call.thinking_budget_requested === 0 && call.thinking_budget_applied === null) {
      warnings.push(`Gemini Pro call ${call.stage || 'unknown'} did not apply thinkingBudget=0 because Pro may not support disabling thinking.`);
    }
  }
  const finalTotals = finalizeCostTotals(totals);
  if (warnCostUsd > 0 && finalTotals.estimated_cost_usd >= warnCostUsd) {
    warnings.push(`Estimated Gemini cost ${finalTotals.estimated_cost_usd} USD reached NEWSROOM_WARN_COST_USD ${warnCostUsd} USD.`);
  }
  if (maxCostUsd > 0 && finalTotals.estimated_cost_usd >= maxCostUsd) {
    warnings.push(`Estimated Gemini cost ${finalTotals.estimated_cost_usd} USD reached NEWSROOM_MAX_COST_USD ${maxCostUsd} USD. This PR is warning-only.`);
  }
  const proCalls = ensureArray(calls).filter(call => call.pro_model === true);
  if (proCalls.length > 0) {
    warnings.push(`Gemini Pro was used in ${proCalls.length} call(s); escalation=${proPolicy?.escalation || 'unknown'}.`);
  }
  return {
    schema_version: 1,
    date,
    generated_at: generatedAt,
    currency: 'USD',
    pricing_source: PRICING_SOURCE_URL,
    enforcement: 'warning-only',
    warning_threshold_usd: warnCostUsd,
    max_threshold_usd: maxCostUsd,
    pro_policy: proPolicy,
    totals: finalTotals,
    by_stage: groupedCostTotals(calls, 'stage'),
    by_model: groupedCostTotals(calls, 'model'),
    calls: ensureArray(calls),
    warnings: [...new Set(warnings)]
  };
}

function buildCostReportMarkdown(report) {
  const totals = report.totals || emptyCostTotals();
  const calls = ensureArray(report.calls);
  const callRows = calls.map(call => [
    `| ${call.stage || 'unknown'} `,
    ` ${call.model || 'unknown'} `,
    ` ${call.attempt || 0} `,
    ` ${call.prompt_tokens || 0} `,
    ` ${call.output_tokens || 0} `,
    ` ${call.thinking_tokens || 0} `,
    ` ${call.thinking_budget_requested ?? 'n/a'} `,
    ` ${call.thinking_budget_applied ?? 'n/a'} `,
    ` ${call.cached_tokens || 0} `,
    ` ${call.pro_model === true ? 'yes' : 'no'} `,
    ` ${Number.isFinite(Number(call.estimated_cost_usd)) ? Number(call.estimated_cost_usd).toFixed(6) : 'n/a'} |`
  ].join('|')).join('\n') || '| none | none | 0 | 0 | 0 | 0 | 0 | 0 | 0 | no | 0.000000 |';
  const warnings = ensureArray(report.warnings).map(item => `- ${item}`).join('\n') || '- none';
  const proPolicy = report.pro_policy || {};
  return `# Gemini 비용 리포트 - ${report.date || 'unknown'}

## Summary

- Enforcement: ${report.enforcement || 'warning-only'}
- Pricing source: ${report.pricing_source || PRICING_SOURCE_URL}
- Warning threshold USD: ${report.warning_threshold_usd}
- Max threshold USD: ${report.max_threshold_usd}
- Pro escalation: ${proPolicy.escalation || 'n/a'}
- Pro model configured: ${proPolicy.pro_model_configured === true ? 'yes' : 'no'}
- Pro model allowed: ${proPolicy.pro_model_allowed === true ? 'yes' : 'no'}
- Request count: ${totals.request_count || 0}
- Prompt tokens: ${totals.prompt_tokens || 0}
- Output tokens: ${totals.output_tokens || 0}
- Thinking tokens: ${totals.thinking_tokens || 0}
- Cached tokens: ${totals.cached_tokens || 0}
- Total tokens: ${totals.total_tokens || 0}
- Estimated cost USD: ${Number(totals.estimated_cost_usd || 0).toFixed(6)}

## Calls

| Stage | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
${callRows}

## Warnings

${warnings}
`;
}

function safeFilenamePart(value) {
  const safe = String(value || 'unknown')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return safe || 'unknown';
}

function extractJson(text, stage) {
  const rawText = String(text || '');
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new GeminiJsonParseError(stage, 'Gemini returned an empty response.', rawText);
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const firstObject = candidate.indexOf('{');
    const lastObject = candidate.lastIndexOf('}');
    const firstArray = candidate.indexOf('[');
    const lastArray = candidate.lastIndexOf(']');

    const objectJson = firstObject !== -1 && lastObject > firstObject
      ? candidate.slice(firstObject, lastObject + 1)
      : '';
    const arrayJson = firstArray !== -1 && lastArray > firstArray
      ? candidate.slice(firstArray, lastArray + 1)
      : '';

    for (const value of [objectJson, arrayJson]) {
      if (!value) continue;
      try {
        return JSON.parse(value);
      } catch (_) {
        // Try the next extraction shape.
      }
    }
  }

  throw new GeminiJsonParseError(stage, 'Gemini output was not valid JSON.', rawText);
}

function schemaConfig(responseSchema) {
  return {
    responseMimeType: 'application/json',
    responseSchema,
    temperature: 0.35
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function configuredModels() {
  return [primaryModel, ...fallbackModels].filter((item, index, items) => items.indexOf(item) === index);
}

function apiVersionForModel(modelName) {
  if (process.env.GEMINI_API_VERSION) return process.env.GEMINI_API_VERSION;
  return undefined;
}

function clientOptions(apiVersion) {
  return apiVersion ? { apiKey, apiVersion } : { apiKey };
}

function errorText(error) {
  return [
    error?.message,
    error?.statusDetails,
    error?.details,
    error?.response?.data,
    error?.response?.body,
    error?.cause?.message
  ].map(value => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }).filter(Boolean).join('\n');
}

function errorStatus(error) {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.code,
    error?.response?.status,
    error?.cause?.status
  ];

  for (const value of candidates) {
    const status = Number(value);
    if (retryableStatuses.has(status)) return status;
  }

  const match = errorText(error).match(/\b(429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

function lastStatus(error) {
  const directStatus = errorStatus(error);
  if (directStatus) return directStatus;

  const candidates = [
    error?.status,
    error?.statusCode,
    error?.code,
    error?.response?.status,
    error?.cause?.status
  ];

  for (const value of candidates) {
    const status = Number(value);
    if (Number.isFinite(status)) return status;
  }

  const match = errorText(error).match(/\b([1-5]\d\d)\b/);
  return match ? Number(match[1]) : 'unknown';
}

function parseDurationToMs(value, unit = 's') {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  const normalizedUnit = String(unit || 's').toLowerCase();
  if (normalizedUnit.startsWith('ms') || normalizedUnit.startsWith('milli')) return Math.round(number);
  if (normalizedUnit.startsWith('m') && !normalizedUnit.startsWith('milli')) return Math.round(number * 60 * 1000);
  return Math.round(number * 1000);
}

function parseRetryDelayMs(error) {
  const text = errorText(error);
  const retryIn = text.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)\s*(ms|milliseconds?|s|seconds?|m|minutes?)?/i);
  if (retryIn) return parseDurationToMs(retryIn[1], retryIn[2] || 's');

  const retryDelay = text.match(/["']?retryDelay["']?\s*:\s*["']?([0-9]+(?:\.[0-9]+)?)(ms|s|m)?["']?/i);
  if (retryDelay) return parseDurationToMs(retryDelay[1], retryDelay[2] || 's');

  return null;
}

function isRetryableError(error) {
  if (errorStatus(error)) return true;
  return /\b(UNAVAILABLE|RESOURCE_EXHAUSTED|rate limit|high demand|temporarily unavailable|quota)\b/i
    .test(errorText(error));
}

function isQuotaError(error) {
  const text = errorText(error);
  return errorStatus(error) === 429 ||
    /\b(RESOURCE_EXHAUSTED|quota|rate limit|too many requests)\b/i.test(text);
}

function isFreeTierQuotaExhausted(error) {
  const text = errorText(error);
  return isQuotaError(error) &&
    /(daily|per\s*day|GenerateRequestsPerDay|RequestsPerDay|free[_\s-]*tier.*(?:daily|per\s*day)|(?:daily|per\s*day).*free[_\s-]*tier)/i.test(text);
}

function retryDelay(attempt, error) {
  const hintedDelay = parseRetryDelayMs(error);
  if (hintedDelay !== null) return Math.min(hintedDelay, maxRetryDelayMs);
  return effectiveRetryDelaysMs[attempt - 1] ?? effectiveRetryDelaysMs[effectiveRetryDelaysMs.length - 1];
}

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

function cloneDiagnostics() {
  return JSON.parse(JSON.stringify(diagnostics));
}

function resetGeminiDiagnostics() {
  diagnostics.quota_error_count = 0;
  diagnostics.invalid_json_count = 0;
  diagnostics.model_usage = {};
  diagnostics.cost_report = { calls: [] };
  modelUsageByStage.clear();
}

function recordQuotaError(stage, modelName) {
  diagnostics.quota_error_count += 1;
  usageFor(stage, modelName).quota_errors += 1;
}

function recordApiError(stage, modelName) {
  usageFor(stage, modelName).api_errors += 1;
}

function recordInvalidJson(stage, modelName) {
  diagnostics.invalid_json_count += 1;
  usageFor(stage, modelName).invalid_json += 1;
}

function saveRawGeminiOutput(stage, attempt, modelName, text) {
  fs.mkdirSync(rawOutputRoot, { recursive: true });
  const fileName = `${safeFilenamePart(stage)}-attempt-${attempt}-${safeFilenamePart(modelName)}.txt`;
  const filePath = path.join(rawOutputRoot, fileName);
  fs.writeFileSync(filePath, String(text || ''), 'utf8');
  return filePath;
}

function recordUsageMetadata(stage, modelName, attempt, response, thinkingBudget = {}) {
  const usage = usageMetadataFromResponse(response);
  const cost = estimateCallCost(modelName, usage);
  diagnostics.cost_report.calls.push({
    stage,
    model: modelName,
    attempt,
    pro_model: isProModelName(modelName),
    usage_metadata_present: usage.usage_metadata_present,
    prompt_tokens: cost.prompt_tokens,
    output_tokens: cost.output_tokens,
    thinking_tokens: cost.thinking_tokens,
    thinking_budget_requested: thinkingBudget.requested,
    thinking_budget_applied: thinkingBudget.applied,
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

async function generateContentJsonWithRetry(stage, ai, request, modelName, thinkingBudget) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      usageFor(stage, modelName).requests += 1;
      console.log(`[${stage}] Gemini request attempt ${attempt}/${maxRetries + 1} using model ${modelName}.`);
      const response = await ai.models.generateContent(request);
      recordUsageMetadata(stage, modelName, attempt, response, thinkingBudget);
      const text = typeof response.text === 'function' ? response.text() : response.text;
      const json = extractJson(text, stage);
      usageFor(stage, modelName).successes += 1;
      return json;
    } catch (error) {
      lastError = error;

      if (error instanceof GeminiJsonParseError) {
        recordInvalidJson(stage, modelName);
        const rawPath = saveRawGeminiOutput(stage, attempt, modelName, error.rawText);
        if (attempt > maxRetries) break;
        const delayMs = retryDelay(attempt, error);
        console.warn(
          `[${stage}] Gemini returned invalid JSON for model ${modelName}; raw output saved to ${path.relative(process.cwd(), rawPath)}. Retrying in ${delayMs}ms.`
        );
        await sleep(delayMs);
        continue;
      }

      if (isQuotaError(error)) recordQuotaError(stage, modelName);
      else recordApiError(stage, modelName);

      const retryable = isRetryableError(error);
      if (!retryable || attempt > maxRetries) break;

      if (isFreeTierQuotaExhausted(error)) {
        console.warn(`[${stage}] Gemini quota appears exhausted for model ${modelName}; skipping remaining retries for this model.`);
        break;
      }

      const delayMs = retryDelay(attempt, error);
      const status = errorStatus(error) || 'unknown';
      console.warn(
        `[${stage}] Gemini API retry ${attempt}/${maxRetries} for model ${modelName} after status ${status}: ${error.message}. Waiting ${delayMs}ms.`
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function failureSummary(stage, failures) {
  const lines = [
    `[${stage}] Gemini API failed for all configured models.`,
    `Tried models: ${failures.map(item => item.model).join(', ')}`,
    `Retries per model: ${maxRetries}`,
    'Last error by model:'
  ];

  for (const item of failures) {
    lines.push(`- ${item.model}: status ${item.status}; ${item.message}`);
  }

  lines.push('Gemini API capacity or model-output quality issue is likely. Review .tmp/gemini-raw artifacts, re-run the job, or check fallback model availability.');
  return lines.join('\n');
}

async function callGeminiJson(stage, systemInstruction, prompt, responseSchema, options = {}) {
  const key = options.apiKey || apiKey;
  if (!key) {
    fail('Missing GEMINI_API_KEY. Add it in GitHub repository Settings > Secrets and variables > Actions.');
  }

  const ClientCtor = options.GoogleGenAI || GoogleGenAI;
  const failures = [];
  for (const modelName of configuredModels()) {
    const apiVersion = apiVersionForModel(modelName);
    const ai = options.ai || new ClientCtor(apiVersion ? { apiKey: key, apiVersion } : { apiKey: key });
    console.log(`[${stage}] Gemini model selected: ${modelName} (apiVersion ${apiVersion || 'sdk-default'}).`);
    if (isProModelName(modelName)) {
      console.warn(`[${stage}] Gemini Pro model selected through ${runtimeConfig.newsroomProEscalation || 'manual'} escalation policy: ${modelName}.`);
    }

    try {
      const thinkingBudget = thinkingConfigForStage(stage, modelName);
      const config = {
        systemInstruction,
        ...schemaConfig(responseSchema)
      };
      if (Number.isInteger(thinkingBudget.applied)) {
        config.thinkingConfig = {
          thinkingBudget: thinkingBudget.applied
        };
      }
      const json = await generateContentJsonWithRetry(stage, ai, {
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config
      }, modelName, thinkingBudget);
      console.log(`[${stage}] Gemini API succeeded with model ${modelName}.`);
      modelUsageByStage.set(stage, modelName);
      return json;
    } catch (error) {
      failures.push({
        model: modelName,
        status: lastStatus(error),
        message: error.message
      });

      if (!(error instanceof GeminiJsonParseError) && !isRetryableError(error)) {
        fail(`[${stage}] Gemini API failed with non-retryable error on model ${modelName}: ${error.message}`);
      }

      console.warn(`[${stage}] Gemini model ${modelName} failed after ${maxRetries} retries. Trying fallback model if configured.`);
    }
  }

  fail(failureSummary(stage, failures));
}

module.exports = {
  GeminiJsonParseError,
  buildCostReport,
  buildCostReportMarkdown,
  callGeminiJson,
  estimateCallCost,
  extractJson,
  findPricing,
  getGeminiDiagnostics: cloneDiagnostics,
  getGeminiCostCalls() {
    return cloneDiagnostics().cost_report.calls;
  },
  thinkingBudgetForStage,
  getGeminiModelUsage(stage) {
    return modelUsageByStage.get(stage) || '';
  },
  parseRetryDelayMs,
  resetGeminiDiagnostics,
  safeFilenamePart,
  saveRawGeminiOutput,
  usageMetadataFromResponse
};
