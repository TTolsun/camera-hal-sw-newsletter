const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const clientPath = path.resolve(__dirname, '..', '..', '..', '..', '..', 'src', 'shared', 'llm', 'llm-client.js');
const rawDir = path.resolve(__dirname, '..', '..', '..', '..', '..', '.tmp', 'llm-raw');
const { readRuntimeConfig } = require('../../../common/runtime-config');

function clearLlmEnv() {
  for (const key of [
    'GEMINI_API_KEY', 'LLM_PROVIDER', 'LLM_MODEL', 'LLM_FALLBACK_MODELS',
    'LLM_RAW_OUTPUT_DIR', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODELS',
    'GEMINI_MAX_RETRIES', 'GEMINI_RETRY_DELAYS_MS', 'GEMINI_RETRY_MAX_DELAY_MS',
    'GEMINI_CALL_TIMEOUT_MS',
    'NEWSROOM_REPORTER_MODEL', 'NEWSROOM_EDITOR_MODEL', 'NEWSROOM_FACTCHECK_MODEL',
    'NEWSROOM_REPAIR_MODEL', 'NEWSROOM_JUDGE_MODEL'
  ]) {
    delete process.env[key];
  }
}

function loadLlmClient(env = {}) {
  delete require.cache[clientPath];
  clearLlmEnv();
  Object.assign(process.env, {
    LLM_PROVIDER: 'openapi',
    LLM_MODEL: 'test-model',
    LLM_FALLBACK_MODELS: '',
    GEMINI_MAX_RETRIES: '0',
    GEMINI_RETRY_DELAYS_MS: '0',
    GEMINI_RETRY_MAX_DELAY_MS: '1000',
    LLM_RAW_OUTPUT_DIR: rawDir,
    ...env
  });
  return require(clientPath);
}

test.afterEach(() => {
  fs.rmSync(rawDir, { recursive: true, force: true });
  clearLlmEnv();
});

test('LLM_PROVIDER=internal is rejected by runtime config', () => {
  assert.throws(
    () => readRuntimeConfig({ LLM_PROVIDER: 'internal' }),
    /LLM_PROVIDER must be one of: gemini, openapi/
  );
});

test('openapi reserved provider fails fast without HTTP request', async () => {
  const client = loadLlmClient({
    LLM_PROVIDER: 'openapi',
    LLM_MODEL: 'openapi-reserved',
    LLM_FALLBACK_MODELS: ''
  });

  await assert.rejects(
    () => client.callLlmJson('reserved provider', 'system', 'prompt', {}),
    /provider_not_implemented/
  );
});

// A provider stub that lets each test decide how execute() behaves per model.
function fakeProvider(execute) {
  return {
    id: 'fake',
    displayName: 'Fake',
    missingCredentialMessage: 'no key',
    getApiKey: () => 'key',
    configuredModels: () => ['hang-model', 'ok-model'],
    createModelContext: ({ modelName }) => ({ modelName }),
    describeModelContext: () => '',
    buildRequest: ({ model }) => ({ request: { model }, thinkingBudget: null }),
    execute,
    textFromResponse: response => response.text,
    usageMetadataFromResponse: () => ({ usage_metadata_present: false }),
    estimateCallCost: () => ({
      prompt_tokens: 0, output_tokens: 0, thinking_tokens: 0, cached_tokens: 0,
      total_tokens: 0, billable_input_tokens: 0, billable_output_tokens: 0,
      estimated_cost_usd: 0, pricing_usd_per_million: 0, pricing_source: '', pricing_warning: ''
    }),
    isProModel: () => false
  };
}

const okResponse = { text: JSON.stringify({ result: 'ok' }) };

test('callWithTimeout rejects with LlmCallTimeoutError when the call hangs', async () => {
  const client = loadLlmClient();
  await assert.rejects(
    () => client.callWithTimeout(new Promise(() => {}), 30, 'unit', 'hang-model'),
    error => error instanceof client.LlmCallTimeoutError &&
      error.timeoutMs === 30 && error.modelName === 'hang-model'
  );
});

test('callWithTimeout resolves with the value when the call finishes first', async () => {
  const client = loadLlmClient();
  assert.equal(await client.callWithTimeout(Promise.resolve('done'), 1000, 'unit', 'm'), 'done');
});

test('callWithTimeout with timeoutMs<=0 disables the ceiling (passthrough)', () => {
  const client = loadLlmClient();
  const promise = Promise.resolve('raw');
  assert.equal(client.callWithTimeout(promise, 0, 'unit', 'm'), promise);
});

test('callLlmJson abandons a hanging model and falls through to the next fallback', async () => {
  const client = loadLlmClient({ GEMINI_CALL_TIMEOUT_MS: '40' });
  const provider = fakeProvider(({ modelName }) =>
    modelName === 'hang-model' ? new Promise(() => {}) : Promise.resolve(okResponse));
  const result = await client.callLlmJson('unit stage', 'system', 'prompt', {}, { provider });
  assert.deepEqual(result, { result: 'ok' });
});

test('callLlmJson throws after every fallback model times out', async () => {
  const client = loadLlmClient({ GEMINI_CALL_TIMEOUT_MS: '40' });
  const provider = fakeProvider(() => new Promise(() => {}));
  await assert.rejects(
    () => client.callLlmJson('unit stage', 'system', 'prompt', {}, { provider }),
    error => /Fake API failed for all configured models/.test(error.message) &&
      // The failure summary distinguishes a timeout from a generic 'unknown' status.
      /status timeout/.test(error.message)
  );
});

test('callLlmJson reports a schema-too-complex rejection as a schema-drift error', async () => {
  const client = loadLlmClient();
  let attempts = 0;
  // The model rejects an over-complex constrained-decoding schema with a 400.
  const provider = fakeProvider(() => {
    attempts += 1;
    return Promise.reject(Object.assign(
      new Error('400 INVALID_ARGUMENT: the response schema has too many states for a constrained decoding request'),
      { status: 400 }
    ));
  });
  await assert.rejects(
    () => client.callLlmJson('editor attempt 1/3', 'system', 'prompt', {}, { provider }),
    // Distinctive schema-drift diagnosis, not the generic "API failed" message.
    error => /rejected the response schema as too complex/i.test(error.message) &&
      /state limit/i.test(error.message)
  );
  // Fail fast on the first schema rejection: do NOT burn the weaker fallback model,
  // which has equal-or-lower schema capacity and would reject the same schema.
  assert.equal(attempts, 1);
});
