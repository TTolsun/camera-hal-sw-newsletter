const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const clientPath = path.resolve(__dirname, '..', 'scripts', 'lib', 'gemini-client.js');
const rawDir = path.resolve(__dirname, '..', '.tmp', 'gemini-raw');

function loadClient(env = {}) {
  delete require.cache[clientPath];
  for (const key of [
    'GEMINI_API_KEY',
    'GEMINI_MODEL',
    'GEMINI_FALLBACK_MODELS',
    'GEMINI_MAX_RETRIES',
    'GEMINI_RETRY_DELAYS_MS',
    'GEMINI_RETRY_MAX_DELAY_MS',
    'GEMINI_RAW_OUTPUT_DIR',
    'NEWSROOM_WARN_COST_USD',
    'NEWSROOM_MAX_COST_USD'
  ]) {
    delete process.env[key];
  }
  Object.assign(process.env, {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'primary-model',
    GEMINI_FALLBACK_MODELS: '',
    GEMINI_MAX_RETRIES: '0',
    GEMINI_RETRY_DELAYS_MS: '0',
    GEMINI_RETRY_MAX_DELAY_MS: '1000',
    GEMINI_RAW_OUTPUT_DIR: rawDir,
    ...env
  });
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
  assert.equal(call.model, 'gemini-2.5-flash');
  assert.equal(call.attempt, 1);
  assert.equal(call.prompt_tokens, 1000);
  assert.equal(call.output_tokens, 200);
  assert.equal(call.thinking_tokens, 50);
  assert.equal(call.cached_tokens, 100);
  assert.equal(call.total_tokens, 1250);
  assert.equal(call.billable_input_tokens, 900);
  assert.equal(call.billable_output_tokens, 250);
  assert.equal(call.estimated_cost_usd, 0.000898);
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
