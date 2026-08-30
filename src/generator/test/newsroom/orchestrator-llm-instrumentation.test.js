const assert = require('node:assert/strict');
const test = require('node:test');

// callLlmJson 계측 래퍼를 입력→출력으로 고정한다(#655). 책임은 callLlmJsonRaw를 그대로
// 위임하면서 generationRunState.stageTracker에 start→pass(성공)/start→fail+rethrow(실패)를
// 기록하는 것이다. raw 호출과 run-state 싱글톤을 require 캐시로 주입해 결정론적으로 검증한다.

const INSTRUMENTATION_PATH = require.resolve('../../publish/orchestrator-llm-instrumentation');
const LLM_CLIENT_PATH = require.resolve('../../../shared/llm/llm-client');
const RUN_STATE_PATH = require.resolve('../../publish/orchestrator-run-state');
const { LLM_STAGES, stageRun } = require('../../../shared/llm/stage-catalog');
const { createStageStatusTracker } = require('../../select/stage-status-tracker');

// role은 stage definition이 선언한 값을 쓰고, callLlmJsonRaw와 generationRunState는 stub으로
// 교체한다. 로드 후 캐시를 비워 다른 테스트가 실제 모듈을 받도록 복원한다.
function loadWithStubs({ rawImpl, tracker, attempt = 3 }) {
  const realLlmClient = require.cache[LLM_CLIENT_PATH];
  const realRunState = require.cache[RUN_STATE_PATH];

  require.cache[LLM_CLIENT_PATH] = {
    id: LLM_CLIENT_PATH,
    filename: LLM_CLIENT_PATH,
    loaded: true,
    exports: { callLlmJson: rawImpl }
  };
  require.cache[RUN_STATE_PATH] = {
    id: RUN_STATE_PATH,
    filename: RUN_STATE_PATH,
    loaded: true,
    exports: { generationRunState: { currentQualityAttempt: attempt, stageTracker: tracker } }
  };
  delete require.cache[INSTRUMENTATION_PATH];

  const mod = require(INSTRUMENTATION_PATH);

  function restore() {
    delete require.cache[INSTRUMENTATION_PATH];
    if (realLlmClient) require.cache[LLM_CLIENT_PATH] = realLlmClient; else delete require.cache[LLM_CLIENT_PATH];
    if (realRunState) require.cache[RUN_STATE_PATH] = realRunState; else delete require.cache[RUN_STATE_PATH];
  }
  return { callLlmJson: mod.callLlmJson, restore };
}

function recordingTracker(events) {
  const record = kind => call => events.push([kind, call.stageId, call.role, call.attempt, call.label, call.reason]);
  return {
    start: record('start'),
    pass: record('pass'),
    fail: record('fail')
  };
}

test('성공 시 raw 결과를 그대로 반환하고 start→pass를 기록한다', async () => {
  const events = [];
  let rawArgs = null;
  const { callLlmJson, restore } = loadWithStubs({
    rawImpl: async (stage, ...args) => { rawArgs = [stage, ...args]; return { ok: true }; },
    tracker: recordingTracker(events),
    attempt: 3
  });
  try {
    const editorRun = stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 1, totalAttempts: 2 });
    const result = await callLlmJson(editorRun, 'system', 'prompt', { schema: true });
    assert.deepEqual(result, { ok: true });
    // raw 위임은 stage와 나머지 인자를 그대로 전달한다.
    assert.deepEqual(rawArgs, [editorRun, 'system', 'prompt', { schema: true }]);
    // role도 attempt도 definition/run에서 온다. run state 싱글톤의 currentQualityAttempt(3)가
    // 아니라 run의 qualityAttempt(1)를 쓴다 -- 그래야 진단 아티팩트의 canonical key와 이 로그가
    // 같은 호출에 같은 attempt를 적는다.
    assert.deepEqual(events, [
      ['start', 'editor', 'editor', 1, 'editor attempt 1/2', undefined],
      ['pass', 'editor', 'editor', 1, 'editor attempt 1/2', undefined]
    ]);
  } finally {
    restore();
  }
});

test('실패 시 fail을 기록하고 에러를 rethrow한다(pass 미기록)', async () => {
  const events = [];
  const boom = new Error('llm exploded');
  const { callLlmJson, restore } = loadWithStubs({
    rawImpl: async () => { throw boom; },
    tracker: recordingTracker(events),
    attempt: 1
  });
  try {
    const factCheckRun = stageRun(LLM_STAGES.FACT_CHECKER, { qualityAttempt: 1, totalAttempts: 2 });
    await assert.rejects(() => callLlmJson(factCheckRun), /llm exploded/);
    assert.deepEqual(events, [
      ['start', 'fact_checker', 'factcheck', 1, 'fact-checker attempt 1/2', undefined],
      ['fail', 'fact_checker', 'factcheck', 1, 'fact-checker attempt 1/2', 'llm exploded']
    ]);
    // 성공 경로가 아니므로 pass는 기록되지 않는다.
    assert.equal(events.some(e => e[0] === 'pass'), false);
  } finally {
    restore();
  }
});

test('행의 정체성은 stage id이고 role은 definition이 선언한 표시값이다', async () => {
  // 계측 래퍼는 label을 다시 해석하지 않는다(#981).
  const events = [];
  const { callLlmJson, restore } = loadWithStubs({
    rawImpl: async () => ({}),
    tracker: recordingTracker(events),
    attempt: 2
  });
  try {
    const reporterRun = stageRun(LLM_STAGES.REPORTER, { qualityAttempt: 1, totalAttempts: 2 });
    await callLlmJson(reporterRun);
    assert.equal(events[0][1], LLM_STAGES.REPORTER.id);
    assert.equal(events[0][2], LLM_STAGES.REPORTER.statusRole);
  } finally {
    restore();
  }
});

// #979 3·4·8번: role이 행의 키였을 때 사라지던 호출. editorial-plan과 editor는 role이 둘 다
// 'editor'라 같은 attempt에서 한 행으로 뭉개졌고, 나중에 도는 editor가 앞선 호출을 덮었다.
test('role이 같은 두 stage가 같은 attempt에서 서로 다른 행으로 간다', async () => {
  const events = [];
  const { callLlmJson, restore } = loadWithStubs({
    rawImpl: async () => ({}),
    tracker: recordingTracker(events),
    attempt: 1
  });
  try {
    await callLlmJson(stageRun(LLM_STAGES.EDITORIAL_PLAN, { qualityAttempt: 1, totalAttempts: 2 }));
    await callLlmJson(stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 1, totalAttempts: 2 }));

    const started = events.filter(event => event[0] === 'start');
    assert.deepEqual(started.map(event => event[1]), ['editorial_plan', 'editor']);
    // 표시용 role은 여전히 둘 다 editor다 -- 다이어그램은 지금처럼 role로 묶어 읽는다.
    assert.deepEqual(started.map(event => event[2]), ['editor', 'editor']);
  } finally {
    restore();
  }
});

// 위 테스트는 래퍼가 서로 다른 stageId를 넘긴다는 것까지만 증명한다. 실제 기록기를 끼워
// 행이 실제로 갈리는지 -- 래퍼와 기록기의 조합 -- 를 여기서 확인한다.
test('실제 기록기를 끼우면 role이 같은 두 stage가 두 행으로 남는다', async () => {
  const tracker = createStageStatusTracker();
  const { callLlmJson, restore } = loadWithStubs({
    rawImpl: async () => ({}),
    tracker,
    attempt: 1
  });
  try {
    await callLlmJson(stageRun(LLM_STAGES.EDITORIAL_PLAN, { qualityAttempt: 1, totalAttempts: 2 }));
    await callLlmJson(stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 1, totalAttempts: 2 }));
    const log = tracker.toLog();
    assert.equal(log.length, 2);
    assert.deepEqual(log.map(entry => entry.stage_id), ['editorial_plan', 'editor']);
    assert.deepEqual(log.map(entry => entry.stage), ['editorial-plan attempt 1/2', 'editor attempt 1/2']);
  } finally {
    restore();
  }
});

// attempt는 run state 싱글톤이 아니라 run에서 온다. attempt 루프 밖에서 도는 stage는
// qualityAttempt가 0인데, 싱글톤에서 읽으면 루프에 남은 값을 물려받아 진단 아티팩트의
// canonical key(weekly_merge#0)와 이 로그의 attempt가 어긋난다.
test('attempt는 run에서 읽는다 -- 루프 밖 stage가 남은 값을 물려받지 않는다', async () => {
  const tracker = createStageStatusTracker();
  const { callLlmJson, restore } = loadWithStubs({
    rawImpl: async () => ({}),
    tracker,
    attempt: 7
  });
  try {
    await callLlmJson(stageRun(LLM_STAGES.WEEKLY_MERGE));
    assert.equal(tracker.toLog()[0].attempt, 0);
  } finally {
    restore();
  }
});
