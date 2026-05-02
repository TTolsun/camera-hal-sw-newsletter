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
    'GEMINI_RAW_OUTPUT_DIR'
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
