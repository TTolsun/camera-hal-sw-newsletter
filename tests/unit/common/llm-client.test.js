const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const clientPath = path.resolve(__dirname, '..', '..', '..', 'scripts', 'newsroom', 'llm', 'llm-client.js');
const rawDir = path.resolve(__dirname, '..', '..', '..', '.tmp', 'llm-raw');
const { readRuntimeConfig } = require('../../../scripts/newsroom/common/runtime-config');

function clearLlmEnv() {
  for (const key of [
    'GEMINI_API_KEY', 'LLM_PROVIDER', 'LLM_MODEL', 'LLM_FALLBACK_MODELS',
    'LLM_RAW_OUTPUT_DIR', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODELS',
    'GEMINI_MAX_RETRIES', 'GEMINI_RETRY_DELAYS_MS', 'GEMINI_RETRY_MAX_DELAY_MS',
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
