const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const clientPath = path.resolve(__dirname, '..', '..', '..', 'scripts', 'newsroom', 'generate', 'gemini-client.js');
const rawDir = path.resolve(__dirname, '..', '..', '..', '.tmp', 'gemini-raw');

function loadClient(env = {}) {
  delete require.cache[clientPath];
  for (const key of [
    'GEMINI_API_KEY',
    'LLM_PROVIDER',
    'LLM_MODEL',
    'LLM_FALLBACK_MODELS',
    'LLM_RAW_OUTPUT_DIR',
    'INTERNAL_LLM_API_KEY',
    'INTERNAL_LLM_ENDPOINT',
    'INTERNAL_LLM_API_VERSION',
    'GEMINI_MODEL',
    'GEMINI_FALLBACK_MODELS',
    'GEMINI_MAX_RETRIES',
    'GEMINI_RETRY_DELAYS_MS',
    'GEMINI_RETRY_MAX_DELAY_MS',
    'GEMINI_RAW_OUTPUT_DIR',
    'NEWSROOM_WARN_COST_USD',
    'NEWSROOM_MAX_COST_USD',
    'NEWSROOM_ALLOW_PRO_ON_SCHEDULE',
    'NEWSROOM_ALLOW_PRO_ON_MANUAL',
    'NEWSROOM_PRO_ESCALATION',
    'GEMINI_THINKING_BUDGET_REPORTER',
    'GEMINI_THINKING_BUDGET_EDITOR',
    'GEMINI_THINKING_BUDGET_REPAIR',
    'GEMINI_THINKING_BUDGET_FACTCHECK',
    'GEMINI_THINKING_BUDGET_JUDGE',
    'GEMINI_THINKING_BUDGET_SCORING',
    'NEWSROOM_REPORTER_MODEL',
    'NEWSROOM_EDITOR_MODEL',
    'NEWSROOM_FACTCHECK_MODEL',
    'NEWSROOM_REPAIR_MODEL',
    'NEWSROOM_JUDGE_MODEL',
    'GITHUB_EVENT_NAME'
  ]) {
    delete process.env[key];
  }
  const {
    __omitDefaultGeminiModel = false,
    ...envOverrides
  } = env;
  const defaults = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'primary-model',
    GEMINI_FALLBACK_MODELS: '',
    GEMINI_MAX_RETRIES: '0',
    GEMINI_RETRY_DELAYS_MS: '0',
    GEMINI_RETRY_MAX_DELAY_MS: '1000',
    GEMINI_RAW_OUTPUT_DIR: rawDir
  };
  if (__omitDefaultGeminiModel) delete defaults.GEMINI_MODEL;
  Object.assign(process.env, defaults, envOverrides);
  return require(clientPath);
}

function fakeGemini(sequence) {
  class FakeGoogleGenAI {
    constructor() {
      this.models = {
        generateContent: async request => {
          FakeGoogleGenAI.requests.push(request);
          const next = sequence.shift();
          if (next instanceof Error) throw next;
          if (next && typeof next === 'object') return next;
          return { text: () => next };
        }
      };
    }
  }
  FakeGoogleGenAI.requests = [];
  return FakeGoogleGenAI;
}

test.beforeEach(() => {
  fs.rmSync(rawDir, { recursive: true, force: true });
});

test.afterEach(() => {
  fs.rmSync(rawDir, { recursive: true, force: true });
});

test('invalid JSON throws a normal parse error without calling process.exit', () => {
  const client = loadClient();
  const originalExit = process.exit;
  process.exit = () => {
    throw new Error('process.exit should not be called');
  };
  try {
    assert.throws(
      () => client.extractJson('not json', 'unit stage'),
      client.GeminiJsonParseError
    );
  } finally {
    process.exit = originalExit;
  }
});

test('invalid JSON retries and writes raw model output', async () => {
  const client = loadClient({ GEMINI_MAX_RETRIES: '1' });
  const FakeGoogleGenAI = fakeGemini(['not json', '{"ok":true}']);

  const result = await client.callGeminiJson('editor stage', 'system', 'prompt', {}, {
    GoogleGenAI: FakeGoogleGenAI
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(FakeGoogleGenAI.requests.length, 2);
  const rawFiles = fs.readdirSync(rawDir);
  assert.equal(rawFiles.length, 1);
  assert.match(rawFiles[0], /^editor-stage-attempt-1-primary-model\.txt$/);
  assert.equal(fs.readFileSync(path.join(rawDir, rawFiles[0]), 'utf8'), 'not json');
  assert.equal(client.getGeminiDiagnostics().invalid_json_count, 1);
  assert.equal(client.getGeminiCostCalls().length, 2);
});

test('invalid JSON falls back to the next model after retry budget is exhausted', async () => {
  const client = loadClient({
    GEMINI_MODEL: 'primary-model',
    GEMINI_FALLBACK_MODELS: 'fallback-model',
    GEMINI_MAX_RETRIES: '0'
  });
  const FakeGoogleGenAI = fakeGemini(['not json', '{"ok":true}']);

  const result = await client.callGeminiJson('reporter', 'system', 'prompt', {}, {
    GoogleGenAI: FakeGoogleGenAI
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(FakeGoogleGenAI.requests.map(request => request.model), ['primary-model', 'fallback-model']);
  assert.equal(client.getGeminiModelUsage('reporter'), 'fallback-model');
  assert.deepEqual(client.getGeminiDiagnostics().model_routing.reporter, {
    stage: 'reporter',
    stage_group: 'reporter',
    stage_group_known: true,
    routing_warning: '',
    primary_model: 'primary-model',
    fallback_models: ['fallback-model'],
    primary_resolved_by: 'GEMINI_MODEL',
    resolved_by: 'GEMINI_MODEL',
    global_override_applied: true
  });
  const [primaryCall, fallbackCall] = client.getGeminiCostCalls();
  assert.equal(primaryCall.resolved_by, 'GEMINI_MODEL');
  assert.equal(primaryCall.primary_resolved_by, 'GEMINI_MODEL');
  assert.equal(primaryCall.attempt_resolved_by, 'GEMINI_MODEL');
  assert.equal(primaryCall.fallback_index, null);
  assert.equal(fallbackCall.model, 'fallback-model');
  assert.equal(fallbackCall.attempt_model, 'fallback-model');
  assert.equal(fallbackCall.primary_model, 'primary-model');
  assert.equal(fallbackCall.resolved_by, 'fallback');
  assert.equal(fallbackCall.primary_resolved_by, 'GEMINI_MODEL');
  assert.equal(fallbackCall.attempt_resolved_by, 'fallback');
  assert.equal(fallbackCall.fallback_index, 0);
});

test('retry delay parsing handles Gemini human and JSON retry hints', () => {
  const client = loadClient();

  assert.equal(
    client.parseRetryDelayMs({ message: 'Please retry in 36.837637419s.' }),
    36838
  );
  assert.equal(
    client.parseRetryDelayMs({ message: '{"retryDelay":"36s"}' }),
    36000
  );
});

test('free-tier daily quota exhaustion skips remaining retries for that model', async () => {
  const quotaError = new Error('RESOURCE_EXHAUSTED: Free tier daily quota exceeded. Please retry in 36s.');
  quotaError.status = 429;
  const client = loadClient({
    GEMINI_MODEL: 'primary-model',
    GEMINI_FALLBACK_MODELS: 'fallback-model',
    GEMINI_MAX_RETRIES: '3'
  });
  const FakeGoogleGenAI = fakeGemini([quotaError, '{"ok":true}']);

  const result = await client.callGeminiJson('quota stage', 'system', 'prompt', {}, {
    GoogleGenAI: FakeGoogleGenAI
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(FakeGoogleGenAI.requests.map(request => request.model), ['primary-model', 'fallback-model']);
  const diagnostics = client.getGeminiDiagnostics();
  assert.equal(diagnostics.quota_error_count, 1);
  assert.equal(diagnostics.model_usage['quota stage']['primary-model'].requests, 1);
});

test('successful Gemini calls record usage metadata and estimated cost', async () => {
  const client = loadClient({ GEMINI_MODEL: 'gemini-2.5-flash' });
  const FakeGoogleGenAI = fakeGemini([{
    text: () => '{"ok":true}',
    usageMetadata: {
      promptTokenCount: 1000,
      candidatesTokenCount: 200,
      thoughtsTokenCount: 50,
      cachedContentTokenCount: 100,
      totalTokenCount: 1250
    }
  }]);

  const result = await client.callGeminiJson('cost stage', 'system', 'prompt', {}, {
    GoogleGenAI: FakeGoogleGenAI
  });

  assert.deepEqual(result, { ok: true });
  const [call] = client.getGeminiCostCalls();
  assert.equal(call.stage, 'cost stage');
  assert.equal(call.stage_group, 'reporter');
  assert.equal(call.stage_group_known, false);
  assert.equal(call.routing_warning, 'unknown_stage_defaulted_to_reporter');
  assert.equal(call.model, 'gemini-2.5-flash');
  assert.equal(call.primary_model, 'gemini-2.5-flash');
  assert.equal(call.attempt_model, 'gemini-2.5-flash');
  assert.deepEqual(call.fallback_models, []);
  assert.equal(call.primary_resolved_by, 'GEMINI_MODEL');
  assert.equal(call.attempt_resolved_by, 'GEMINI_MODEL');
  assert.equal(call.resolved_by, 'GEMINI_MODEL');
  assert.equal(call.fallback_index, null);
  assert.equal(call.global_override_applied, true);
  assert.equal(call.attempt, 1);
  assert.equal(call.prompt_tokens, 1000);
  assert.equal(call.output_tokens, 200);
  assert.equal(call.thinking_tokens, 50);
  assert.equal(call.thinking_budget_requested, 0);
  assert.equal(call.thinking_budget_applied, 0);
  assert.equal(call.cached_tokens, 100);
  assert.equal(call.total_tokens, 1250);
  assert.equal(call.billable_input_tokens, 900);
  assert.equal(call.billable_output_tokens, 250);
  assert.equal(call.estimated_cost_usd, 0.000898);
});

test('unknown stage defaults to reporter and records routing warning', async () => {
  const client = loadClient({ GEMINI_MODEL: 'gemini-2.5-flash' });
  const FakeGoogleGenAI = fakeGemini(['{"ok":true}']);

  await client.callGeminiJson('weird-stage', 'system', 'prompt', {}, {
    GoogleGenAI: FakeGoogleGenAI
  });

  assert.deepEqual(client.getGeminiDiagnostics().model_routing['weird-stage'], {
    stage: 'weird-stage',
    stage_group: 'reporter',
    stage_group_known: false,
    routing_warning: 'unknown_stage_defaulted_to_reporter',
    primary_model: 'gemini-2.5-flash',
    fallback_models: [],
    primary_resolved_by: 'GEMINI_MODEL',
    resolved_by: 'GEMINI_MODEL',
    global_override_applied: true
  });
  const [call] = client.getGeminiCostCalls();
  assert.equal(call.stage_group, 'reporter');
  assert.equal(call.stage_group_known, false);
  assert.equal(call.routing_warning, 'unknown_stage_defaulted_to_reporter');
});

test('stage-specific thinking budgets are applied to Gemini request config', async () => {
  const client = loadClient({
    GEMINI_THINKING_BUDGET_EDITOR: '1024'
  });
  const FakeGoogleGenAI = fakeGemini([
    '{"ok":"reporter"}',
    '{"ok":"editor"}',
    '{"ok":"repair"}',
    '{"ok":"factcheck"}',
    '{"ok":"judge"}',
    '{"ok":"scoring"}'
  ]);

  await client.callGeminiJson('reporter attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('editor attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('editor repair attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('fact-checker attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('public article judge attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('deterministic scoring', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });

  assert.deepEqual(
    FakeGoogleGenAI.requests.map(request => request.config.thinkingConfig),
    [
      { thinkingBudget: 0 },
      { thinkingBudget: 1024 },
      { thinkingBudget: 0 },
      { thinkingBudget: 0 },
      { thinkingBudget: 0 },
      { thinkingBudget: 0 }
    ]
  );
  assert.equal(client.thinkingBudgetForStage('editor completion attempt 1/1'), 1024);
  assert.equal(client.thinkingBudgetForStage('unknown stage'), 0);
});

test('stage-specific model routing selects the configured model for each newsroom stage', async () => {
  const client = loadClient({
    __omitDefaultGeminiModel: true,
    GEMINI_FALLBACK_MODELS: 'fallback-model',
    NEWSROOM_REPORTER_MODEL: 'reporter-model',
    NEWSROOM_EDITOR_MODEL: 'editor-model',
    NEWSROOM_FACTCHECK_MODEL: 'factcheck-model',
    NEWSROOM_REPAIR_MODEL: 'repair-model',
    NEWSROOM_JUDGE_MODEL: 'judge-model'
  });
  const FakeGoogleGenAI = fakeGemini([
    '{"ok":"reporter"}',
    '{"ok":"background"}',
    '{"ok":"editor"}',
    '{"ok":"judge"}',
    '{"ok":"factcheck"}',
    '{"ok":"factcheck-repair"}',
    '{"ok":"repair"}',
    '{"ok":"completion"}'
  ]);

  await client.callGeminiJson('reporter attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('background-context attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('editor attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('public article judge attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('fact-checker attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('fact-checker repair attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('editor repair attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('editor completion attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });

  assert.deepEqual(
    FakeGoogleGenAI.requests.map(request => request.model),
    [
      'reporter-model',
      'reporter-model',
      'editor-model',
      'judge-model',
      'factcheck-model',
      'factcheck-model',
      'repair-model',
      'repair-model'
    ]
  );

  const diagnostics = client.getGeminiDiagnostics();
  assert.deepEqual(diagnostics.model_routing['editor attempt 1/1'], {
    stage: 'editor attempt 1/1',
    stage_group: 'editor',
    stage_group_known: true,
    routing_warning: '',
    primary_model: 'editor-model',
    fallback_models: ['fallback-model'],
    primary_resolved_by: 'NEWSROOM_EDITOR_MODEL',
    resolved_by: 'NEWSROOM_EDITOR_MODEL',
    global_override_applied: false
  });
  assert.deepEqual(diagnostics.model_routing['fact-checker repair attempt 1/1'], {
    stage: 'fact-checker repair attempt 1/1',
    stage_group: 'factcheck',
    stage_group_known: true,
    routing_warning: '',
    primary_model: 'factcheck-model',
    fallback_models: ['fallback-model'],
    primary_resolved_by: 'NEWSROOM_FACTCHECK_MODEL',
    resolved_by: 'NEWSROOM_FACTCHECK_MODEL',
    global_override_applied: false
  });
  assert.deepEqual(diagnostics.model_routing['public article judge attempt 1/1'], {
    stage: 'public article judge attempt 1/1',
    stage_group: 'judge',
    stage_group_known: true,
    routing_warning: '',
    primary_model: 'judge-model',
    fallback_models: ['fallback-model'],
    primary_resolved_by: 'NEWSROOM_JUDGE_MODEL',
    resolved_by: 'NEWSROOM_JUDGE_MODEL',
    global_override_applied: false
  });
  assert.equal(client.getGeminiCostCalls()[2].stage_group, 'editor');
  assert.equal(client.getGeminiCostCalls()[2].resolved_by, 'NEWSROOM_EDITOR_MODEL');
  assert.equal(client.getGeminiCostCalls()[3].stage_group, 'judge');
  assert.equal(client.getGeminiCostCalls()[3].resolved_by, 'NEWSROOM_JUDGE_MODEL');
});

test('configured Gemini Pro model is rejected before API calls', () => {
  assert.throws(
    () => loadClient({ GEMINI_MODEL: 'gemini-2.5-pro' }),
    /Gemini Pro models are disabled; configured Pro model\(s\): gemini-2\.5-pro/
  );
});

test('usage metadata extraction supports Gemini SDK camelCase fields', () => {
  const client = loadClient();
  const usage = client.usageMetadataFromResponse({
    usageMetadata: {
      promptTokenCount: 1200,
      candidatesTokenCount: 300,
      thoughtsTokenCount: 20,
      cachedContentTokenCount: 100,
      totalTokenCount: 1520
    }
  });

  assert.deepEqual(usage, {
    usage_metadata_present: true,
    prompt_tokens: 1200,
    output_tokens: 300,
    thinking_tokens: 20,
    cached_tokens: 100,
    total_tokens: 1520
  });
});

test('cost estimation separates cached input and output including thinking tokens', () => {
  const client = loadClient();
  const cost = client.estimateCallCost('gemini-2.5-flash-lite', {
    prompt_tokens: 1000,
    output_tokens: 200,
    thinking_tokens: 50,
    cached_tokens: 100,
    total_tokens: 1250
  });

  assert.equal(cost.billable_input_tokens, 900);
  assert.equal(cost.billable_output_tokens, 250);
  assert.equal(cost.estimated_cost_usd, 0.000191);
  assert.equal(cost.pricing_usd_per_million.input_usd_per_million, 0.1);
  assert.equal(cost.pricing_usd_per_million.cached_input_usd_per_million, 0.01);
});

test('Gemini 3.5 Flash pricing uses official standard rates for stable model only', () => {
  const client = loadClient();

  assert.deepEqual(client.findPricing('gemini-3.5-flash'), {
    input_usd_per_million: 1.5,
    output_usd_per_million: 9,
    cached_input_usd_per_million: 0.15,
    large_prompt_threshold_tokens: null,
    large_prompt_applied: false
  });
  assert.equal(client.findPricing('gemini-3.5-flash-preview'), null);
  const cost = client.estimateCallCost('gemini-3.5-flash', {
    prompt_tokens: 1000,
    output_tokens: 100,
    thinking_tokens: 25,
    cached_tokens: 100,
    total_tokens: 1125
  });
  assert.equal(cost.estimated_cost_usd, 0.00249);
  assert.equal(cost.pricing_warning, '');
});

test('cost report aggregates calls and emits warning-only threshold messages', () => {
  const client = loadClient();
  const calls = [
    {
      stage: 'reporter',
      model: 'gemini-2.5-flash',
      attempt: 1,
      prompt_tokens: 1000,
      output_tokens: 100,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 1100,
      billable_input_tokens: 1000,
      billable_output_tokens: 100,
      estimated_cost_usd: 0.00055
    },
    {
      stage: 'editor',
      model: 'gemini-2.5-flash',
      attempt: 1,
      prompt_tokens: 2000,
      output_tokens: 200,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 2200,
      billable_input_tokens: 2000,
      billable_output_tokens: 200,
      estimated_cost_usd: 0.0011
    }
  ];

  const report = client.buildCostReport({
    date: '2026-05-04',
    calls,
    warnCostUsd: 0.001,
    maxCostUsd: 0.002
  });

  assert.equal(report.enforcement, 'warning-only');
  assert.equal(report.totals.request_count, 2);
  assert.equal(report.totals.prompt_tokens, 3000);
  assert.equal(report.totals.estimated_cost_usd, 0.00165);
  assert.ok(report.warnings.some(item => item.includes('NEWSROOM_WARN_COST_USD')));
  assert.equal(report.warnings.some(item => item.includes('NEWSROOM_MAX_COST_USD')), false);
  assert.match(client.buildCostReportMarkdown(report), /Estimated cost USD: 0\.001650/);
  assert.match(client.buildCostReportMarkdown(report), /\| Provider \| Stage \| Group \| Primary \| Attempt Model \| Resolved By \| Fallbacks \|/);
  assert.match(client.buildCostReportMarkdown(report), /Pro policy: disabled/);
  assert.doesNotMatch(client.buildCostReportMarkdown(report), /Pro escalation/);
  assert.doesNotMatch(client.buildCostReportMarkdown(report), /Pro model allowed/);
  assert.doesNotMatch(client.buildCostReportMarkdown(report), /manual_pro_fallback/);
});

test('default stage model synthetic usage keeps cost thresholds warning-only', () => {
  const client = loadClient();
  const calls = [
    {
      stage: 'reporter attempt 1/1',
      stage_group: 'reporter',
      model: 'gemini-2.5-flash',
      attempt: 1,
      prompt_tokens: 1000,
      output_tokens: 100,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 1100,
      billable_input_tokens: 1000,
      billable_output_tokens: 100,
      estimated_cost_usd: 0.00055
    },
    {
      stage: 'editor attempt 1/1',
      stage_group: 'editor',
      model: 'gemini-3.5-flash',
      attempt: 1,
      prompt_tokens: 2000,
      output_tokens: 200,
      thinking_tokens: 50,
      cached_tokens: 0,
      total_tokens: 2250,
      billable_input_tokens: 2000,
      billable_output_tokens: 250,
      estimated_cost_usd: 0.00525
    },
    {
      stage: 'fact-checker attempt 1/1',
      stage_group: 'factcheck',
      model: 'gemini-2.5-flash',
      attempt: 1,
      prompt_tokens: 1000,
      output_tokens: 100,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 1100,
      billable_input_tokens: 1000,
      billable_output_tokens: 100,
      estimated_cost_usd: 0.00055
    },
    {
      stage: 'editor repair attempt 1/1',
      stage_group: 'repair',
      model: 'gemini-3.5-flash',
      attempt: 1,
      prompt_tokens: 2000,
      output_tokens: 200,
      thinking_tokens: 50,
      cached_tokens: 0,
      total_tokens: 2250,
      billable_input_tokens: 2000,
      billable_output_tokens: 250,
      estimated_cost_usd: 0.00525
    }
  ];

  const report = client.buildCostReport({
    date: '2026-05-04',
    calls,
    warnCostUsd: 0.001,
    maxCostUsd: 0.002
  });

  assert.equal(report.enforcement, 'warning-only');
  assert.equal(report.totals.estimated_cost_usd, 0.0116);
  assert.ok(report.warnings.some(item => item.includes('NEWSROOM_WARN_COST_USD')));
  assert.ok(report.warnings.some(item => item.includes('NEWSROOM_MAX_COST_USD')));
  assert.ok(report.warnings.every(item => !item.includes('failed')));
});

test('cost report keeps call-level Pro audit marker while policy remains disabled', () => {
  const client = loadClient();
  const report = client.buildCostReport({
    date: '2026-05-04',
    calls: [{
      provider: 'gemini',
      stage: 'synthetic audit',
      stage_group: 'reporter',
      model: 'gemini-2.5-pro',
      attempt: 1,
      prompt_tokens: 1000,
      output_tokens: 100,
      thinking_tokens: 0,
      cached_tokens: 0,
      total_tokens: 1100,
      billable_input_tokens: 1000,
      billable_output_tokens: 100,
      estimated_cost_usd: 0.00055,
      pro_model: true
    }]
  });
  assert.deepEqual(report.pro_policy, { status: 'disabled' });
  assert.ok(report.warnings.some(item => item.includes('Pro policy is disabled')));
  assert.match(client.buildCostReportMarkdown(report), /\| gemini \| synthetic audit /);
  assert.match(client.buildCostReportMarkdown(report), /Pro policy: disabled/);
  assert.doesNotMatch(client.buildCostReportMarkdown(report), /Pro escalation/);
  assert.doesNotMatch(client.buildCostReportMarkdown(report), /Pro model allowed/);
});
