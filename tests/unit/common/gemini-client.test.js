const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const clientPath = path.resolve(__dirname, '..', '..', '..', 'scripts', 'lib', 'gemini-client.js');
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
    'GEMINI_THINKING_BUDGET_SCORING',
    'NEWSROOM_REPORTER_MODEL',
    'NEWSROOM_EDITOR_MODEL',
    'NEWSROOM_FACTCHECK_MODEL',
    'NEWSROOM_REPAIR_MODEL',
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
    primary_model: 'primary-model',
    fallback_models: ['fallback-model'],
    resolved_by: 'GEMINI_MODEL',
    global_override_applied: true
  });
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
  assert.equal(call.model, 'gemini-2.5-flash');
  assert.equal(call.primary_model, 'gemini-2.5-flash');
  assert.equal(call.attempt_model, 'gemini-2.5-flash');
  assert.deepEqual(call.fallback_models, []);
  assert.equal(call.resolved_by, 'GEMINI_MODEL');
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

test('stage-specific thinking budgets are applied to Gemini request config', async () => {
  const client = loadClient({
    GEMINI_THINKING_BUDGET_EDITOR: '1024'
  });
  const FakeGoogleGenAI = fakeGemini([
    '{"ok":"reporter"}',
    '{"ok":"editor"}',
    '{"ok":"repair"}',
    '{"ok":"factcheck"}',
    '{"ok":"scoring"}'
  ]);

  await client.callGeminiJson('reporter attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('editor attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('editor repair attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('fact-checker attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('deterministic scoring', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });

  assert.deepEqual(
    FakeGoogleGenAI.requests.map(request => request.config.thinkingConfig),
    [
      { thinkingBudget: 0 },
      { thinkingBudget: 1024 },
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
    NEWSROOM_REPAIR_MODEL: 'repair-model'
  });
  const FakeGoogleGenAI = fakeGemini([
    '{"ok":"reporter"}',
    '{"ok":"background"}',
    '{"ok":"editor"}',
    '{"ok":"factcheck"}',
    '{"ok":"factcheck-repair"}',
    '{"ok":"repair"}',
    '{"ok":"completion"}'
  ]);

  await client.callGeminiJson('reporter attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('background-context attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
  await client.callGeminiJson('editor attempt 1/1', 'system', 'prompt', {}, { GoogleGenAI: FakeGoogleGenAI });
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
    primary_model: 'editor-model',
    fallback_models: ['fallback-model'],
    resolved_by: 'NEWSROOM_EDITOR_MODEL',
    global_override_applied: false
  });
  assert.deepEqual(diagnostics.model_routing['fact-checker repair attempt 1/1'], {
    stage: 'fact-checker repair attempt 1/1',
    stage_group: 'factcheck',
    primary_model: 'factcheck-model',
    fallback_models: ['fallback-model'],
    resolved_by: 'NEWSROOM_FACTCHECK_MODEL',
    global_override_applied: false
  });
  assert.equal(client.getGeminiCostCalls()[2].stage_group, 'editor');
  assert.equal(client.getGeminiCostCalls()[2].resolved_by, 'NEWSROOM_EDITOR_MODEL');
});

test('Pro models omit thinkingBudget 0 and record the limitation in cost report', async () => {
  const client = loadClient({
    GEMINI_MODEL: 'gemini-2.5-pro',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true'
  });
  const FakeGoogleGenAI = fakeGemini([{
    text: () => '{"ok":true}',
    usageMetadata: {
      promptTokenCount: 1000,
      candidatesTokenCount: 100,
      thoughtsTokenCount: 25,
      totalTokenCount: 1125
    }
  }]);

  const result = await client.callGeminiJson('reporter attempt 1/1', 'system', 'prompt', {}, {
    GoogleGenAI: FakeGoogleGenAI
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(FakeGoogleGenAI.requests[0].config.thinkingConfig, undefined);
  const [call] = client.getGeminiCostCalls();
  assert.equal(call.thinking_tokens, 25);
  assert.equal(call.thinking_budget_requested, 0);
  assert.equal(call.thinking_budget_applied, null);
  assert.match(call.thinking_budget_note, /Pro may not support disabling thinking/);
  const report = client.buildCostReport({
    date: '2026-05-04',
    calls: client.getGeminiCostCalls()
  });
  assert.ok(report.warnings.some(item => item.includes('did not apply thinkingBudget=0')));
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

test('pro pricing switches at the large prompt threshold', () => {
  const client = loadClient();

  assert.equal(client.findPricing('gemini-2.5-pro', 200000).input_usd_per_million, 1.25);
  assert.equal(client.findPricing('gemini-2.5-pro', 200001).input_usd_per_million, 2.5);
  assert.equal(client.findPricing('gemini-2.5-pro', 200001).output_usd_per_million, 15);
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
});

test('manual Pro usage is marked in cost calls and report warnings', async () => {
  const client = loadClient({
    GEMINI_MODEL: 'gemini-2.5-pro',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    NEWSROOM_ALLOW_PRO_ON_MANUAL: 'true'
  });
  const FakeGoogleGenAI = fakeGemini([{
    text: () => '{"ok":true}',
    usageMetadata: {
      promptTokenCount: 1000,
      candidatesTokenCount: 100,
      totalTokenCount: 1100
    }
  }]);

  const result = await client.callGeminiJson('manual pro stage', 'system', 'prompt', {}, {
    GoogleGenAI: FakeGoogleGenAI
  });

  assert.deepEqual(result, { ok: true });
  const [call] = client.getGeminiCostCalls();
  assert.equal(call.model, 'gemini-2.5-pro');
  assert.equal(call.pro_model, true);
  const report = client.buildCostReport({
    date: '2026-05-04',
    calls: client.getGeminiCostCalls()
  });
  assert.equal(report.pro_policy.pro_model_configured, true);
  assert.equal(report.pro_policy.pro_model_allowed, true);
  assert.ok(report.warnings.some(item => item.includes('Gemini Pro was used')));
  assert.match(client.buildCostReportMarkdown(report), /Pro model configured: yes/);
});
