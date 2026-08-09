const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EDITOR_SCHEMA_ACCEPTANCE_MODELS,
  classifyProbeError,
  probeSchemaAcceptance,
  summarizeAcceptance
} = require('../../../tooling/cli/check-editor-schema-acceptance');

function okProvider() {
  return {
    getApiKey: () => 'test-key',
    createModelContext: ({ modelName }) => ({ modelName }),
    buildRequest: ({ model }) => ({ model, contents: [] }),
    execute: async () => ({ text: '{}' })
  };
}

test('acceptance run covers the editor primary model and both fallbacks', () => {
  assert.deepEqual(EDITOR_SCHEMA_ACCEPTANCE_MODELS, [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ]);
});

test('a model that answers with the schema is recorded as accepted', async () => {
  const results = await probeSchemaAcceptance({
    provider: okProvider(),
    models: ['gemini-3.5-flash'],
    schema: { type: 'OBJECT', properties: {} },
    env: { GEMINI_API_KEY: 'test-key' }
  });

  assert.deepEqual(results, [{ model: 'gemini-3.5-flash', accepted: true, reason: '' }]);
});

test('a model that rejects the schema is recorded with the provider reason', async () => {
  const provider = okProvider();
  provider.execute = async () => {
    throw new Error('got status: 400 Bad Request. Schema has too many states for serving');
  };

  const results = await probeSchemaAcceptance({
    provider,
    models: ['gemini-2.5-flash-lite'],
    schema: { type: 'OBJECT', properties: {} },
    env: { GEMINI_API_KEY: 'test-key' }
  });

  assert.equal(results[0].accepted, false);
  assert.match(results[0].reason, /too many states/);
});

test('schema rejection is told apart from an outage', () => {
  assert.equal(classifyProbeError(new Error('400 Bad Request: too many states for serving')).schemaRejected, true);
  assert.equal(classifyProbeError(new Error('Invalid JSON payload received. Unknown name "foo" at request')).schemaRejected, true);
  assert.equal(classifyProbeError(new Error('503 Service Unavailable')).schemaRejected, false);
  assert.equal(classifyProbeError(new Error('429 Too Many Requests')).schemaRejected, false);
});

test('a run passes only when the editor primary model accepts the schema', () => {
  const allAccepted = summarizeAcceptance([
    { model: 'gemini-3.5-flash', accepted: true, reason: '' },
    { model: 'gemini-2.5-flash', accepted: true, reason: '' },
    { model: 'gemini-2.5-flash-lite', accepted: true, reason: '' }
  ]);
  assert.equal(allAccepted.ok, true);
  assert.equal(allAccepted.acceptedCount, 3);

  // primary가 거부하면 editor 단계가 통째로 막히므로 실패다.
  const primaryRejected = summarizeAcceptance([
    { model: 'gemini-3.5-flash', accepted: false, reason: 'too many states' },
    { model: 'gemini-2.5-flash', accepted: true, reason: '' },
    { model: 'gemini-2.5-flash-lite', accepted: true, reason: '' }
  ]);
  assert.equal(primaryRejected.ok, false);
  assert.match(primaryRejected.text, /gemini-3\.5-flash/);

  // fallback이 거부하면 503 때 쓸 안전망이 사라지므로 이것도 실패로 본다.
  const fallbackRejected = summarizeAcceptance([
    { model: 'gemini-3.5-flash', accepted: true, reason: '' },
    { model: 'gemini-2.5-flash', accepted: false, reason: 'too many states' },
    { model: 'gemini-2.5-flash-lite', accepted: true, reason: '' }
  ]);
  assert.equal(fallbackRejected.ok, false);
});

test('an outage is not reported as a schema rejection', () => {
  const summary = summarizeAcceptance([
    { model: 'gemini-3.5-flash', accepted: true, reason: '' },
    { model: 'gemini-2.5-flash', accepted: null, reason: '503 Service Unavailable' },
    { model: 'gemini-2.5-flash-lite', accepted: true, reason: '' }
  ]);

  assert.equal(summary.ok, false);
  assert.equal(summary.inconclusiveCount, 1);
  assert.match(summary.text, /확인 못 함/);
});
