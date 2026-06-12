const { ensureArray } = require('../../core/common/value-coercion');
const TOKENS_PER_MILLION = 1000000;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function roundUsd(value) {
  return Number(value.toFixed(8));
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

function pricingSourceForCalls(calls, fallback = null) {
  const sources = [...new Set(ensureArray(calls).map(call => call.pricing_source).filter(Boolean))];
  if (sources.length === 1) return sources[0];
  if (sources.length > 1) return 'multiple';
  return fallback;
}

function buildCostReport({
  date = '',
  calls = [],
  warnCostUsd = 0.15,
  maxCostUsd = 0.25,
  generatedAt = new Date().toISOString(),
  proPolicy = null,
  pricingSource = null
} = {}) {
  const totals = emptyCostTotals();
  const warnings = [];
  for (const call of ensureArray(calls)) {
    addCostTotals(totals, call);
    if (call.pricing_warning) warnings.push(call.pricing_warning);
    if (call.usage_metadata_present === false) {
      warnings.push(`No usage metadata for ${call.stage || 'unknown'} using ${call.model || 'unknown'}.`);
    }
  }
  const finalTotals = finalizeCostTotals(totals);
  if (warnCostUsd > 0 && finalTotals.estimated_cost_usd >= warnCostUsd) {
    warnings.push(`Estimated LLM cost ${finalTotals.estimated_cost_usd} USD reached NEWSROOM_WARN_COST_USD ${warnCostUsd} USD.`);
  }
  if (maxCostUsd > 0 && finalTotals.estimated_cost_usd >= maxCostUsd) {
    warnings.push(`Estimated LLM cost ${finalTotals.estimated_cost_usd} USD reached NEWSROOM_MAX_COST_USD ${maxCostUsd} USD. This PR is warning-only.`);
  }
  const proCalls = ensureArray(calls).filter(call => call.provider === 'gemini' && call.pro_model === true);
  if (proCalls.length > 0) {
    warnings.push(`Gemini Pro model call recorded in ${proCalls.length} call(s) while Pro policy is disabled.`);
  }
  return {
    schema_version: 1,
    date,
    generated_at: generatedAt,
    currency: 'USD',
    pricing_source: pricingSourceForCalls(calls, pricingSource),
    enforcement: 'warning-only',
    warning_threshold_usd: warnCostUsd,
    max_threshold_usd: maxCostUsd,
    pro_policy: proPolicy,
    totals: finalTotals,
    by_provider: groupedCostTotals(calls, 'provider'),
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
    `| ${call.provider || 'unknown'} `,
    ` ${call.stage || 'unknown'} `,
    ` ${call.stage_group || 'unknown'} `,
    ` ${call.primary_model || call.model || 'unknown'} `,
    ` ${call.attempt_model || call.model || 'unknown'} `,
    ` ${call.resolved_by || call.attempt_resolved_by || 'unknown'} `,
    ` ${ensureArray(call.fallback_models).join(', ') || 'none'} `,
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
  ].join('|')).join('\n') || '| none | none | none | none | none | none | none | none | 0 | 0 | 0 | 0 | 0 | 0 | 0 | no | 0.000000 |';
  const warnings = ensureArray(report.warnings).map(item => `- ${item}`).join('\n') || '- none';
  const proPolicy = report.pro_policy || {};
  const proPolicyStatus = proPolicy.status || 'n/a';
  return `# LLM cost report - ${report.date || 'unknown'}

## Summary

- Enforcement: ${report.enforcement || 'warning-only'}
- Pricing source: ${report.pricing_source || 'n/a'}
- Warning threshold USD: ${report.warning_threshold_usd}
- Max threshold USD: ${report.max_threshold_usd}
- Pro policy: ${proPolicyStatus}
- Request count: ${totals.request_count || 0}
- Prompt tokens: ${totals.prompt_tokens || 0}
- Output tokens: ${totals.output_tokens || 0}
- Thinking tokens: ${totals.thinking_tokens || 0}
- Cached tokens: ${totals.cached_tokens || 0}
- Total tokens: ${totals.total_tokens || 0}
- Estimated cost USD: ${Number(totals.estimated_cost_usd || 0).toFixed(6)}

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
${callRows}

## Warnings

${warnings}
`;
}

module.exports = {
  TOKENS_PER_MILLION,
  buildCostReport,
  buildCostReportMarkdown,
  ensureArray,
  number,
  roundUsd
};
