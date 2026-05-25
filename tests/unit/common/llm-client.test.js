const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const clientPath = path.resolve(__dirname, '..', '..', '..', 'scripts', 'newsroom', 'llm', 'llm-client.js');
const internalProvider = require('../../../scripts/newsroom/llm/providers/internal-provider');
const rawDir = path.resolve(__dirname, '..', '..', '..', '.tmp', 'llm-raw');

function clearLlmEnv() {
  for (const key of [
    'GEMINI_API_KEY',
    'LLM_PROVIDER',
    'LLM_MODEL',
    'LLM_FALLBACK_MODELS',
    'LLM_RAW_OUTPUT_DIR',
    'GEMINI_MODEL',
    'GEMINI_FALLBACK_MODELS',
    'GEMINI_MAX_RETRIES',
    'GEMINI_RETRY_DELAYS_MS',
    'GEMINI_RETRY_MAX_DELAY_MS',
    'INTERNAL_LLM_API_KEY',
    'INTERNAL_LLM_ENDPOINT',
    'INTERNAL_LLM_API_VERSION',
    'NEWSROOM_REPORTER_MODEL',
    'NEWSROOM_EDITOR_MODEL',
    'NEWSROOM_FACTCHECK_MODEL',
    'NEWSROOM_REPAIR_MODEL',
    'NEWSROOM_JUDGE_MODEL'
  ]) {
    delete process.env[key];
  }
}

function loadLlmClient(env = {}) {
  delete require.cache[clientPath];
  clearLlmEnv();
  Object.assign(process.env, {
    LLM_PROVIDER: 'internal',
    LLM_MODEL: 'internal-primary',
    LLM_FALLBACK_MODELS: '',
    GEMINI_MAX_RETRIES: '0',
    GEMINI_RETRY_DELAYS_MS: '0',
    GEMINI_RETRY_MAX_DELAY_MS: '1000',
    LLM_RAW_OUTPUT_DIR: rawDir,
    INTERNAL_LLM_API_KEY: 'internal-test-key',
    INTERNAL_LLM_ENDPOINT: 'https://internal.example.test/llm',
    ...env
  });
  return require(clientPath);
}

function fakeFetch(sequence) {
  const calls = [];
  const fetchImpl = async (url, request) => {
    calls.push({ url, request, body: JSON.parse(request.body) });
    const next = sequence.shift();
    if (next instanceof Error) throw next;
    const value = next || {};
    return {
      ok: value.ok ?? true,
      status: value.status || 200,
      json: async () => value.body ?? value,
      text: async () => value.textBody || ''
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test.beforeEach(() => {
  fs.rmSync(rawDir, { recursive: true, force: true });
});

test.afterEach(() => {
  fs.rmSync(rawDir, { recursive: true, force: true });
  clearLlmEnv();
});

test('internal provider parses supported response shapes', () => {
  assert.equal(internalProvider.parseInternalResponse({ json: { ok: true } }), '{"ok":true}');
  assert.equal(internalProvider.parseInternalResponse({ output_json: { ok: true } }), '{"ok":true}');
  assert.equal(internalProvider.parseInternalResponse({ text: '{"ok":true}' }), '{"ok":true}');
  assert.equal(
    internalProvider.parseInternalResponse({ choices: [{ message: { content: '{"ok":true}' } }] }),
    '{"ok":true}'
  );
});

test('internal provider uses fake fetch without requiring Gemini API key', async () => {
  const client = loadLlmClient({ GEMINI_API_KEY: '' });
  const fetchImpl = fakeFetch([{ json: { ok: true } }]);

  const result = await client.callLlmJson('internal stage', 'system', 'prompt', {}, { fetch: fetchImpl });

  assert.deepEqual(result, { ok: true });
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].url, 'https://internal.example.test/llm');
  assert.equal(fetchImpl.calls[0].request.headers.authorization, 'Bearer internal-test-key');
  assert.equal(fetchImpl.calls[0].body.model, 'internal-primary');
  assert.equal(fetchImpl.calls[0].body.system_instruction, 'system');
  const [call] = client.getLlmCostCalls();
  assert.equal(call.provider, 'internal');
  assert.equal(call.stage_group, 'reporter');
  assert.equal(call.stage_group_known, false);
  assert.equal(call.routing_warning, 'unknown_stage_defaulted_to_reporter');
  assert.equal(call.primary_model, 'internal-primary');
  assert.equal(call.attempt_model, 'internal-primary');
  assert.deepEqual(call.fallback_models, []);
  assert.equal(call.primary_resolved_by, 'LLM_MODEL');
  assert.equal(call.attempt_resolved_by, 'LLM_MODEL');
  assert.equal(call.resolved_by, 'LLM_MODEL');
  assert.equal(call.fallback_index, null);
  assert.equal(call.global_override_applied, true);
  assert.equal(call.estimated_cost_usd, null);
  assert.match(call.pricing_warning, /No internal LLM pricing table/);
});

test('invalid JSON retry is shared across providers', async () => {
  const client = loadLlmClient({ GEMINI_MAX_RETRIES: '1' });
  const fetchImpl = fakeFetch([
    { text: 'not json' },
    { output_json: { ok: true } }
  ]);

  const result = await client.callLlmJson('internal retry', 'system', 'prompt', {}, { fetch: fetchImpl });

  assert.deepEqual(result, { ok: true });
  assert.equal(fetchImpl.calls.length, 2);
  const rawFiles = fs.readdirSync(rawDir);
  assert.equal(rawFiles.length, 1);
  assert.match(rawFiles[0], /^internal-retry-attempt-1-internal-primary\.txt$/);
  assert.equal(client.getLlmDiagnostics().invalid_json_count, 1);
});
