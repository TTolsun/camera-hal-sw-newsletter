const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const {
  DERIVED_STAGE_KINDS,
  LLM_STAGES,
  derivedStageRun,
  stageRun
} = require('../../../llm/stage-catalog');
const { createDiagnosticsState } = require('../../../llm/llm-diagnostics');

// 진단·비용 아티팩트의 키가 canonical stage run key인지 확인한다(#982).
//
// 예전에는 사람이 읽는 label이 곧 키였다. 그래서 조회하는 쪽이 키를 얻으려고 label을 byte
// 단위로 다시 조립해야 했고, 총 재시도 수가 바뀌면 같은 회차의 키가 달라졌다.
//
// LLM은 부르지 않는다. provider를 통째로 가짜로 주입해 호출 경로 전체를 결정론으로 만든다.

const clientPath = path.resolve(__dirname, '..', '..', '..', 'llm', 'llm-client.js');

function loadClient() {
  delete require.cache[clientPath];
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MAX_RETRIES = '0';
  process.env.GEMINI_RETRY_DELAYS_MS = '0';
  return require(clientPath);
}

// 응답을 순서대로 돌려주는 가짜 provider. Error를 넣으면 그 호출은 실패한다.
function fakeProvider(responses = [], models = ['fake-primary']) {
  let index = 0;
  return {
    id: 'fake',
    displayName: 'Fake',
    pricingSource: 'fake://pricing',
    getApiKey() { return 'fake-key'; },
    missingCredentialMessage: 'missing fake credential',
    configuredModelsForGroup() { return [...models]; },
    createModelContext() { return {}; },
    describeModelContext() { return ''; },
    buildRequest({ model, sampling }) {
      return { request: { model, sampling }, thinkingBudget: { requested: 0, applied: 0, note: '' } };
    },
    async execute() {
      const next = responses[Math.min(index, responses.length - 1)];
      index += 1;
      if (next instanceof Error) throw next;
      return next;
    },
    textFromResponse(response) { return response.text; },
    usageMetadataFromResponse() { return { usage_metadata_present: true }; },
    estimateCallCost() {
      return {
        prompt_tokens: 10,
        output_tokens: 5,
        thinking_tokens: 0,
        cached_tokens: 0,
        total_tokens: 15,
        billable_input_tokens: 10,
        billable_output_tokens: 5,
        estimated_cost_usd: 0.001,
        pricing_usd_per_million: {},
        pricing_source: 'fake://pricing',
        pricing_warning: ''
      };
    },
    isProModel() { return false; },
    proPolicySummary() { return { status: 'disabled' }; }
  };
}

function editorRun(qualityAttempt, totalAttempts = 3) {
  return stageRun(LLM_STAGES.EDITOR, { qualityAttempt, totalAttempts });
}

async function callOnce(client, run, provider) {
  return client.callLlmJson(run, 'system', 'prompt', {}, { provider });
}

test('model_usage는 canonical key로 묶이고 항목이 stage 정체성을 함께 싣는다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  await callOnce(client, editorRun(2), fakeProvider([{ text: '{"ok":true}' }]));

  const diagnostics = client.getLlmDiagnostics();
  assert.deepEqual(Object.keys(diagnostics.model_usage), ['editor#2']);
  const entry = diagnostics.model_usage['editor#2'];
  assert.equal(entry.stage_key, 'editor#2');
  assert.equal(entry.stage_id, 'editor');
  assert.equal(entry.quality_attempt, 2);
  assert.equal(entry.label, 'editor attempt 2/3');
  assert.equal(entry.parent_run_key, null);
  // model별 계수는 별도 하위 객체에 있다. 정체성 필드와 model 이름이 같은 층에 섞이면
  // 읽는 쪽이 둘을 구분할 수 없다.
  assert.deepEqual(entry.models['fake-primary'], {
    requests: 1,
    successes: 1,
    invalid_json: 0,
    quota_errors: 0,
    api_errors: 0
  });
});

test('model_routing도 같은 키를 쓰고, 파생 stage는 parent_run_key로 부모를 가리킨다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  const parent = editorRun(1);
  const judge = derivedStageRun(parent, DERIVED_STAGE_KINDS.PUBLIC_ARTICLE_JUDGE);
  const provider = fakeProvider([{ text: '{"ok":true}' }]);

  await callOnce(client, parent, provider);
  await callOnce(client, judge, provider);

  const routing = client.getLlmDiagnostics().model_routing;
  assert.deepEqual(Object.keys(routing).sort(), ['editor#1', 'editor.public_article_judge#1']);
  assert.equal(routing['editor#1'].parent_run_key, null);
  assert.equal(routing['editor.public_article_judge#1'].parent_run_key, 'editor#1');
  assert.equal(routing['editor.public_article_judge#1'].label, 'editor attempt 1/3 public article judge');
  assert.equal(routing['editor.public_article_judge#1'].stage_group, 'judge');
});

test('키는 회차마다 갈리고, 총 재시도 수가 바뀌어도 같은 회차면 같은 키다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  const provider = fakeProvider([{ text: '{"ok":true}' }]);

  await callOnce(client, editorRun(1, 3), provider);
  // 총 재시도 수만 다른 같은 회차. 예전 label('editor attempt 1/3' vs 'editor attempt 1/5')은
  // 여기서 갈라졌고, 그래서 같은 호출이 두 항목으로 쪼개졌다.
  await callOnce(client, editorRun(1, 5), provider);
  await callOnce(client, editorRun(2, 5), provider);

  const usage = client.getLlmDiagnostics().model_usage;
  assert.deepEqual(Object.keys(usage).sort(), ['editor#1', 'editor#2']);
  assert.equal(usage['editor#1'].models['fake-primary'].requests, 2);
});

test('model 조회는 run key 조회와 stage 단위 조회 두 갈래다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();

  await callOnce(client, editorRun(1), fakeProvider([{ text: '{"ok":true}' }], ['first-model']));
  await callOnce(client, editorRun(2), fakeProvider([{ text: '{"ok":true}' }], ['second-model']));

  assert.equal(client.getLlmModelUsage(editorRun(1)), 'first-model');
  assert.equal(client.getLlmModelUsage(editorRun(2)), 'second-model');
  // quality attempt를 모르는 호출자를 위한 조회. 마지막으로 성공한 model을 준다.
  assert.equal(client.getLastLlmModelForStage(LLM_STAGES.EDITOR), 'second-model');
  // 기록이 없는 stage는 빈 문자열이다(호출자가 자기 fallback을 쓴다).
  assert.equal(client.getLastLlmModelForStage(LLM_STAGES.REPORTER), '');
});

test('catalog 밖의 값으로는 조회할 수 없다', () => {
  const client = loadClient();
  assert.throws(() => client.getLlmModelUsage('editor attempt 1/3'), /stage run/);
  assert.throws(() => client.getLastLlmModelForStage('editor'), /stage definition/);
  assert.throws(() => client.getLastLlmModelForStage({ id: 'editor' }), /stage definition/);
});

test('비용 리포트는 canonical key로 묶고 각 호출에 정체성을 싣는다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  const provider = fakeProvider([{ text: '{"ok":true}' }]);

  await callOnce(client, editorRun(1), provider);
  await callOnce(client, editorRun(1), provider);
  await callOnce(client, editorRun(2), provider);

  const calls = client.getLlmCostCalls();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].stage_key, 'editor#1');
  assert.equal(calls[0].stage_id, 'editor');
  assert.equal(calls[0].quality_attempt, 1);
  assert.equal(calls[0].label, 'editor attempt 1/3');
  assert.equal(calls[0].parent_run_key, null);

  const report = client.buildCostReport({ date: '2026-08-30', calls });
  assert.deepEqual(
    report.by_stage.map(item => [item.stage_key, item.request_count]).sort(),
    [['editor#1', 2], ['editor#2', 1]]
  );
});

test('키 형식 표식이 진단과 비용 리포트 양쪽에 있다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  await callOnce(client, editorRun(1), fakeProvider([{ text: '{"ok":true}' }]));

  assert.equal(client.getLlmDiagnostics().stage_key_format, 'canonical-v1');
  assert.equal(client.buildCostReport({ date: '2026-08-30', calls: [] }).stage_key_format, 'canonical-v1');
});

test('실패한 호출도 같은 키 아래 계수된다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  const quotaError = new Error('RESOURCE_EXHAUSTED: quota');
  quotaError.status = 429;

  await assert.rejects(() => callOnce(client, editorRun(1), fakeProvider([quotaError])));

  const diagnostics = client.getLlmDiagnostics();
  assert.equal(diagnostics.quota_error_count, 1);
  assert.equal(diagnostics.model_usage['editor#1'].models['fake-primary'].quota_errors, 1);
  assert.equal(diagnostics.model_usage['editor#1'].models['fake-primary'].successes, 0);
});

test('routing이 같은 이름의 필드를 들고 와도 정체성이 이긴다', () => {
  const diagnostics = createDiagnosticsState();
  const run = editorRun(1);

  diagnostics.recordModelRouting(run, {
    stage_group: 'editor',
    // routing이 정체성 필드 이름을 침범한 경우. 항목이 map 키와 어긋나면 그 항목은
    // 아무것도 가리키지 못한다.
    stage_key: 'wrong#9',
    stage_id: 'wrong',
    label: 'wrong label'
  });

  const entry = diagnostics.clone().model_routing['editor#1'];
  assert.equal(entry.stage_key, 'editor#1');
  assert.equal(entry.stage_id, 'editor');
  assert.equal(entry.label, 'editor attempt 1/3');
  assert.equal(entry.stage_group, 'editor');
});

// 아래 둘은 키가 아니라 llm-client가 자기 출력에 붙이는 stage 정체성 계약이다(#993).

// 예전 characterization 표는 stage마다 known/warning 열을 들고 있었다. 그 열은 삭제된
// resolver가 "모르는 stage를 reporter로 흘려보내고 경고를 남기던" 동작을 기록한 것이라
// #981 뒤에는 존재하지 않는 값이 됐고, 읽는 단언도 없었다. 그 열이 지키려던 성질 --
// 등록된 stage는 경고 없이 라우팅된다 -- 만 여기 남긴다.
test('등록된 stage는 known으로 라우팅되고 경고를 남기지 않는다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  // weekly-merge는 #981 전에 경고를 남기던 유일한 stage였다.
  const run = stageRun(LLM_STAGES.WEEKLY_MERGE);
  await callOnce(client, run, fakeProvider([{ text: '{"ok":true}' }]));

  const routing = client.getLlmDiagnostics().model_routing['weekly_merge#0'];
  assert.equal(routing.stage_group_known, true);
  assert.equal(routing.routing_warning, '');
  assert.equal(routing.stage_group, 'reporter');
});

// 스키마 복잡도 실패만 stage 정체성 없이 던지고 있었다. #981이 메시지의 [label] prefix
// 파싱을 지웠으므로, 그 경로의 failure_stage가 'generation'으로 퇴화했다.
test('스키마 복잡도 실패도 stage 정체성을 싣는다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  const schemaError = new Error('Response schema is too complex: too many states.');
  const run = editorRun(1);

  const error = await callOnce(client, run, fakeProvider([schemaError])).then(
    () => null,
    caught => caught
  );

  assert.ok(error, '스키마 복잡도 실패는 던져야 한다');
  assert.match(error.message, /too complex/);
  assert.equal(error.stage, 'editor attempt 1/3');
  assert.equal(error.stage_id, 'editor');
});

// 예산 게이트가 무엇으로 조회하는지(#993). 이 줄이 전체 스위트에서 실행되지 않아, 어휘가
// 어긋나도 테스트가 초록으로 남았다 -- 리뷰가 커버리지로 잡아냈다.
test('예산 게이트는 label이 아니라 stage id로 조회한다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  const asked = [];
  const budget = {
    assertCanRequest: stage => asked.push(stage),
    mergeDiagnostics: () => {}
  };
  const run = stageRun(LLM_STAGES.SOURCE_DISCOVERY);

  await client.callLlmJsonBudgeted(run, 'system', 'prompt', {}, {
    budget,
    provider: fakeProvider([{ text: '{"ok":true}' }])
  });

  // config/newsroom-budget.json이 stage id 어휘를 쓰므로 id가 와야 한다.
  assert.deepEqual(asked, ['source_discovery']);
  // label('sourceDiscovery')이 오면 config 조회가 빗나가고, 빗나간 조회는 예외 없이
  // optional 기본값으로 떨어져 아무도 모르게 지나간다.
  assert.equal(asked.includes(run.label), false);
});

test('예산이 막으면 호출 자체가 일어나지 않는다', async () => {
  const client = loadClient();
  client.resetLlmDiagnostics();
  const blocked = new Error('budget hard limit');
  const provider = fakeProvider([{ text: '{"ok":true}' }]);
  let executed = 0;
  const countingProvider = { ...provider, execute: async (...args) => { executed += 1; return provider.execute(...args); } };

  await assert.rejects(
    () => client.callLlmJsonBudgeted(stageRun(LLM_STAGES.SOURCE_DISCOVERY), 'system', 'prompt', {}, {
      budget: { assertCanRequest: () => { throw blocked; }, mergeDiagnostics: () => {} },
      provider: countingProvider
    }),
    /budget hard limit/
  );
  assert.equal(executed, 0);
});
