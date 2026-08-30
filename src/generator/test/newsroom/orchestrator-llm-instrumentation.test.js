const assert = require('node:assert/strict');
const test = require('node:test');

// callLlmJson 계측 래퍼를 입력→출력으로 고정한다(#655). 책임은 callLlmJsonRaw를 그대로
// 위임하면서 generationRunState.stageTracker에 start→pass(성공)/start→fail+rethrow(실패)를
// 기록하는 것이다. raw 호출과 run-state 싱글톤을 require 캐시로 주입해 결정론적으로 검증한다.

const INSTRUMENTATION_PATH = require.resolve('../../publish/orchestrator-llm-instrumentation');
const LLM_CLIENT_PATH = require.resolve('../../../shared/llm/llm-client');
const RUN_STATE_PATH = require.resolve('../../publish/orchestrator-run-state');
const { LLM_STAGES, stageRun } = require('../../../shared/llm/stage-catalog');

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
  return {
    start: (role, attempt, stage) => events.push(['start', role, attempt, stage]),
    pass: (role, attempt, stage) => events.push(['pass', role, attempt, stage]),
    fail: (role, attempt, stage, message) => events.push(['fail', role, attempt, stage, message])
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
    // role은 definition이 선언한 값이고, attempt는 run-state에서 가져온다.
    assert.deepEqual(events, [
      ['start', 'editor', 3, 'editor attempt 1/2'],
      ['pass', 'editor', 3, 'editor attempt 1/2']
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
      ['start', 'factcheck', 1, 'fact-checker attempt 1/2'],
      ['fail', 'factcheck', 1, 'fact-checker attempt 1/2', 'llm exploded']
    ]);
    // 성공 경로가 아니므로 pass는 기록되지 않는다.
    assert.equal(events.some(e => e[0] === 'pass'), false);
  } finally {
    restore();
  }
});

test('role은 stage definition이 선언한 값을 그대로 쓴다', async () => {
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
    assert.equal(events[0][1], LLM_STAGES.REPORTER.statusRole);
  } finally {
    restore();
  }
});
