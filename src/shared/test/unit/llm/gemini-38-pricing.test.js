const assert = require('node:assert/strict');
const test = require('node:test');
const { findPricing, estimateCallCost } = require('../../../llm/providers/gemini-provider');
const { buildCostReport } = require('../../../llm/llm-cost');

const usage = {
  prompt_tokens: 1000, cached_tokens: 100,
  output_tokens: 100, thinking_tokens: 25, total_tokens: 1125
};

test('Gemini 3.8 Standard pricing switches at the published UTC boundary', () => {
  for (const [date, input, output, cached] of [
    ['2026-10-15T00:00:00Z', 0.75, 3.75, 0.075],
    ['2026-12-31T23:59:59.999Z', 0.75, 3.75, 0.075],
    ['2027-01-01T00:00:00Z', 1.5, 7.5, 0.15],
    ['2027-01-01T08:59:59+09:00', 0.75, 3.75, 0.075]
  ]) {
    assert.deepEqual(findPricing('gemini-3.8-flash', 250000, date), {
      input_usd_per_million: input,
      output_usd_per_million: output,
      cached_input_usd_per_million: cached,
      large_prompt_threshold_tokens: null,
      large_prompt_applied: false
    });
  }
});

test('3.8 costs include thinking and cached input without double charging cache', () => {
  const cost = estimateCallCost('gemini-3.8-flash', usage, '2026-10-15');
  assert.equal(cost.billable_input_tokens, 900);
  assert.equal(cost.billable_output_tokens, 125);
  assert.equal(cost.estimated_cost_usd, 0.00115125);
  assert.equal(cost.pricing_warning, '');
  assert.equal(cost.pricing_source, 'https://ai.google.dev/gemini-api/docs/pricing');
  assert.equal(estimateCallCost('gemini-3.8-flash', usage, '2027-01-01').estimated_cost_usd, 0.0023025);
  assert.equal(estimateCallCost('gemini-3.8-flash', {}, '2026-10-15').estimated_cost_usd, 0);
});

test('unlisted 3.8 variants remain unpriced rather than inheriting Standard rates', () => {
  for (const model of ['gemini-3.8-flash-preview', 'gemini-3.8-flash-lite', 'gemini-3.8-flash-tts', 'unknown']) {
    const cost = estimateCallCost(model, usage, '2026-10-15');
    assert.equal(cost.estimated_cost_usd, null);
    assert.match(cost.pricing_warning, /No local Gemini pricing entry/);
  }
  assert.throws(() => findPricing('gemini-3.8-flash', 0, 'invalid-date'), RangeError);
});

test('3.8 cost enters model and stage totals and retains warning-only budget thresholds', () => {
  const calls = [1, 2].map(attempt => ({
    provider: 'gemini', model: 'gemini-3.8-flash', stage_key: 'editor', attempt,
    ...estimateCallCost('gemini-3.8-flash', usage, '2026-10-15')
  }));
  const report = buildCostReport({ calls, warnCostUsd: 0.001, maxCostUsd: 0.002 });
  assert.equal(report.totals.estimated_cost_usd, 0.0023025);
  assert.equal(report.by_model[0].estimated_cost_usd, 0.0023025);
  assert.equal(report.by_stage[0].estimated_cost_usd, 0.0023025);
  assert.equal(report.enforcement, 'warning-only');
  assert.equal(report.warnings.length, 2);
  assert.ok(report.warnings.every(warning => /reached NEWSROOM_/.test(warning)));
});
