const assert = require('node:assert/strict');
const test = require('node:test');

const {
  classifyProbeError,
  editorAcceptanceModels,
  probeSchemaAcceptance,
  redactReason,
  summarizeAcceptance
} = require('../../../tooling/cli/check-editor-schema-acceptance');
const { configuredModelsForGroup } = require('../../../llm/model-policy');
const { LLM_STAGES } = require('../../../llm/stage-catalog');
const { readRuntimeConfig } = require('../../../common/runtime-config');
const geminiProvider = require('../../../llm/providers/gemini-provider');
const { editorSchema } = require('../../../../generator/render/newsletter-schema');
const { LlmCallTimeoutError } = require('../../../llm/llm-errors');

function fakeProvider(overrides = {}) {
  return {
    displayName: 'Fake',
    missingCredentialMessage: 'Missing key.',
    getApiKey: () => 'test-key',
    createModelContext: ({ modelName, config }) => ({ modelName, config }),
    buildRequest: args => ({ request: { model: args.model, config: args.config }, thinkingBudget: 0 }),
    execute: async () => ({ text: '{}' }),
    textFromResponse: response => response.text,
    ...overrides
  };
}

function testConfig(env = {}) {
  return readRuntimeConfig({ GEMINI_API_KEY: 'test-key', ...env });
}

test('the probe measures whatever models the editor stage is actually routed to', () => {
  const config = testConfig();

  assert.deepEqual(editorAcceptanceModels(config), configuredModelsForGroup(config, LLM_STAGES.EDITOR.modelGroup));

  // 라우팅이 바뀌면 재는 대상도 따라 바뀌어야 한다. 하드코딩이면 쓰이지도 않는 모델을 재고
  // "통과"를 보고하게 된다.
  const overridden = testConfig({ NEWSROOM_EDITOR_MODEL: 'gemini-9.9-flash' });
  assert.equal(editorAcceptanceModels(overridden)[0], 'gemini-9.9-flash');
  assert.notDeepEqual(editorAcceptanceModels(overridden), editorAcceptanceModels(config));
});

test('the probe sends the same request shape the editor stage sends', async () => {
  const seen = [];
  const provider = fakeProvider({
    buildRequest(args) {
      seen.push(args);
      return { request: { model: args.model }, thinkingBudget: 0 };
    }
  });
  const config = testConfig();

  await probeSchemaAcceptance({ provider, config, models: ['gemini-3.5-flash'], env: { GEMINI_API_KEY: 'test-key' } });

  assert.equal(seen.length, 1);
  assert.equal(seen[0].stage, 'editor');
  // 모듈 네임스페이스가 아니라 실제 설정이어야 temperature·thinking 값이 살아 있다.
  assert.equal(seen[0].config, config);
  assert.equal(typeof seen[0].config.geminiTemperatureEditor, 'number');
  assert.equal(seen[0].responseSchema, editorSchema);
});

test('called with only an environment, the probe still builds a real runtime config', async () => {
  // config를 안 넘기는 경로가 실제 실행 경로다. 여기서 모듈 네임스페이스가 새어 들어가면
  // temperature와 thinking 설정이 undefined가 되어 실제 editor 요청과 다른 것을 재게 된다.
  const seen = [];
  const provider = fakeProvider({
    buildRequest(args) {
      seen.push(args.config);
      return { request: {}, thinkingBudget: 0 };
    }
  });

  await probeSchemaAcceptance({ provider, models: ['gemini-3.5-flash'], env: { GEMINI_API_KEY: 'test-key' } });

  assert.equal(typeof seen[0].geminiTemperatureEditor, 'number');
  assert.equal(typeof seen[0].geminiThinkingBudgetEditor, 'number');
  assert.equal(typeof seen[0].geminiCallTimeoutMs, 'number');
});

test('called with only an environment, the probe measures the routed editor models', async () => {
  const seen = [];
  const provider = fakeProvider({
    buildRequest(args) {
      seen.push(args.model);
      return { request: {}, thinkingBudget: 0 };
    }
  });

  await probeSchemaAcceptance({ provider, env: { GEMINI_API_KEY: 'test-key' } });

  assert.deepEqual(seen, configuredModelsForGroup(testConfig(), LLM_STAGES.EDITOR.modelGroup));
});

test('the default schema is the editor schema the pipeline actually uses', async () => {
  const seen = [];
  const provider = fakeProvider({
    buildRequest(args) {
      seen.push(args.responseSchema);
      return { request: {}, thinkingBudget: 0 };
    }
  });

  await probeSchemaAcceptance({ provider, config: testConfig(), models: ['gemini-3.5-flash'], env: { GEMINI_API_KEY: 'test-key' } });

  assert.equal(seen[0], editorSchema);
});

test('the real gemini provider exposes every call the probe makes', () => {
  for (const method of ['getApiKey', 'createModelContext', 'buildRequest', 'execute', 'textFromResponse']) {
    assert.equal(typeof geminiProvider[method], 'function', `gemini provider must expose ${method}`);
  }
  const built = geminiProvider.buildRequest({
    model: 'gemini-3.5-flash',
    sampling: LLM_STAGES.EDITOR.sampling,
    systemInstruction: 'probe',
    prompt: 'probe',
    responseSchema: editorSchema,
    config: testConfig()
  });
  // 프로브는 built.request만 쓴다. provider 계약이 바뀌면 여기서 먼저 깨져야 한다.
  assert.equal(typeof built.request, 'object');
  assert.equal(built.request.model, 'gemini-3.5-flash');
});

test('a model that answers with parseable JSON is recorded as accepted', async () => {
  const results = await probeSchemaAcceptance({
    provider: fakeProvider(),
    config: testConfig(),
    models: ['gemini-3.5-flash'],
    env: { GEMINI_API_KEY: 'test-key' }
  });

  assert.deepEqual(results, [{ model: 'gemini-3.5-flash', accepted: true, reason: '' }]);
});

test('a 200 response that is not usable JSON does not count as acceptance', async () => {
  const provider = fakeProvider({ execute: async () => ({ text: '' }) });

  const results = await probeSchemaAcceptance({
    provider,
    config: testConfig(),
    models: ['gemini-3.5-flash'],
    env: { GEMINI_API_KEY: 'test-key' }
  });

  // 프로덕션은 텍스트 추출 + JSON 파싱까지 통과해야 성공으로 본다. 예외가 안 났다는 것만으로
  // 수용 처리하면 프로덕션이 못 쓰는 스키마가 초록불을 받는다.
  assert.notEqual(results[0].accepted, true);
});

test('a model that rejects the schema is recorded with the provider reason', async () => {
  const provider = fakeProvider({
    execute: async () => {
      throw new Error('got status: 400 Bad Request. Schema has too many states for serving');
    }
  });

  const results = await probeSchemaAcceptance({
    provider,
    config: testConfig(),
    models: ['gemini-2.5-flash-lite'],
    env: { GEMINI_API_KEY: 'test-key' }
  });

  assert.equal(results[0].accepted, false);
  assert.match(results[0].reason, /too many states/);
});

test('an outage during the probe is recorded as inconclusive, not as a rejection', async () => {
  const provider = fakeProvider({
    execute: async () => {
      throw new Error('got status: 503 Service Unavailable');
    }
  });

  const results = await probeSchemaAcceptance({
    provider,
    config: testConfig(),
    models: ['gemini-2.5-flash'],
    env: { GEMINI_API_KEY: 'test-key' }
  });

  assert.equal(results[0].accepted, null);
});

test('an invalid credential is not reported as a schema rejection', async () => {
  const provider = fakeProvider({
    execute: async () => {
      throw new Error('got status: 400 Bad Request. API key not valid. Please pass a valid API key.');
    }
  });

  const results = await probeSchemaAcceptance({
    provider,
    config: testConfig(),
    models: ['gemini-3.5-flash'],
    env: { GEMINI_API_KEY: 'test-key' }
  });

  // 400이라고 다 스키마 거부가 아니다. 키 문제를 거부로 세면 멀쩡한 스키마를 되돌리게 된다.
  assert.equal(results[0].accepted, null);
});

test('schema rejection is told apart from outages, timeouts and credential errors', () => {
  assert.equal(classifyProbeError(new Error('400 Bad Request: too many states for serving')).schemaRejected, true);
  assert.equal(classifyProbeError(new Error('the maximum number of states is exceeded')).schemaRejected, true);
  assert.equal(classifyProbeError(new Error('503 Service Unavailable')).schemaRejected, false);
  assert.equal(classifyProbeError(new Error('429 Too Many Requests')).schemaRejected, false);
  assert.equal(classifyProbeError(new Error('400 API key not valid')).schemaRejected, false);
  assert.equal(classifyProbeError(new LlmCallTimeoutError('editor', 'gemini-3.5-flash', 1000)).schemaRejected, false);
});

test('reported reasons do not carry credential-looking strings', () => {
  // Google API 키 모양을 소스에 그대로 적으면 비밀 스캐너가 진짜 키로 오인한다. 그래서
  // 조각을 이어 붙여 만든다 — 검사하려는 것은 값 자체가 아니라 그 모양이다.
  const googleKeyShape = ['AI', 'za', 'Sy', 'B'].join('') + 'FAKEfakeFAKEfake0123456789_-';
  const redacted = redactReason(`request failed: api_key=${googleKeyShape} rejected`);

  assert.equal(redacted.includes(googleKeyShape), false);
  assert.match(redacted, /\[redacted\]/);
  assert.ok(redactReason('x'.repeat(500)).length <= 301);
});

test('a run passes only when every routed model accepts the schema', () => {
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
    { model: 'gemini-2.5-flash', accepted: true, reason: '' }
  ]);
  assert.equal(primaryRejected.ok, false);
  assert.match(primaryRejected.text, /gemini-3\.5-flash/);

  // fallback이 거부하면 503 때 쓸 안전망이 사라지므로 이것도 실패로 본다.
  const fallbackRejected = summarizeAcceptance([
    { model: 'gemini-3.5-flash', accepted: true, reason: '' },
    { model: 'gemini-2.5-flash', accepted: false, reason: 'too many states' }
  ]);
  assert.equal(fallbackRejected.ok, false);
});

test('an inconclusive run is not reported as a pass', () => {
  const summary = summarizeAcceptance([
    { model: 'gemini-3.5-flash', accepted: true, reason: '' },
    { model: 'gemini-2.5-flash', accepted: null, reason: '503 Service Unavailable' }
  ]);

  assert.equal(summary.ok, false);
  assert.equal(summary.inconclusiveCount, 1);
  assert.match(summary.text, /확인 못 함/);
});
