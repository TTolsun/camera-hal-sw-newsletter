'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  STAGE_STATUSES,
  createStageStatusTracker
} = require('../../../select/stage-status-tracker');

test('start then pass records one entry for the same stage/attempt', () => {
  const tracker = createStageStatusTracker();
  const call = { stageId: 'reporter', role: 'reporter', attempt: 1, label: 'reporter attempt 1/2' };
  tracker.start(call);
  tracker.pass(call);
  const log = tracker.toLog();
  assert.equal(log.length, 1);
  assert.deepEqual(
    { stage_id: log[0].stage_id, role: log[0].role, attempt: log[0].attempt, status: log[0].status },
    { stage_id: 'reporter', role: 'reporter', attempt: 1, status: STAGE_STATUSES.PASSED }
  );
});

test('fail overrides started and keeps a reason', () => {
  const tracker = createStageStatusTracker();
  const call = { stageId: 'editor', role: 'editor', attempt: 1, label: 'editor attempt 1/2' };
  tracker.start(call);
  tracker.fail({ ...call, reason: 'invalid JSON' });
  const log = tracker.toLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].status, STAGE_STATUSES.FAILED);
  assert.equal(log[0].reason, 'invalid JSON');
});

test('same stage across different attempts produces distinct ordered entries', () => {
  const tracker = createStageStatusTracker();
  tracker.start({ stageId: 'editor', role: 'editor', attempt: 1 });
  tracker.fail({ stageId: 'editor', role: 'editor', attempt: 1, reason: 'attempt 1 failed' });
  tracker.start({ stageId: 'editor', role: 'editor', attempt: 2 });
  tracker.pass({ stageId: 'editor', role: 'editor', attempt: 2 });
  const log = tracker.toLog();
  assert.equal(log.length, 2);
  assert.deepEqual(log.map(entry => `${entry.stage_id}#${entry.attempt}:${entry.status}`), [
    'editor#1:failed',
    'editor#2:passed'
  ]);
});

// #979 3·4·8번이 고친 것. role은 다이어그램에 칠할 묶음이라 stage보다 거칠다 -- LLM stage
// 21개가 role 8개를 나눠 쓰고 `repair` 하나에 9개가 몰린다. role이 행의 키였을 때는 같은
// attempt 안에서 나중 stage가 앞선 stage를 덮어 기록이 사라졌다.
test('role이 같아도 stage가 다르면 같은 attempt에서 행이 갈린다', () => {
  const tracker = createStageStatusTracker();
  tracker.pass({ stageId: 'editorial_plan', role: 'editor', attempt: 1, label: 'editorial-plan attempt 1/2' });
  tracker.pass({ stageId: 'editor', role: 'editor', attempt: 1, label: 'editor attempt 1/2' });
  tracker.fail({ stageId: 'editor.repair', role: 'repair', attempt: 1, reason: 'repair failed' });
  tracker.pass({ stageId: 'editor.completion.semantic_repair', role: 'repair', attempt: 1 });

  const log = tracker.toLog();
  assert.equal(log.length, 4);
  assert.deepEqual(log.map(entry => entry.stage_id), [
    'editorial_plan',
    'editor',
    'editor.repair',
    'editor.completion.semantic_repair'
  ]);
  // 실패한 repair가 나중에 성공한 다른 repair에 덮이지 않는다.
  assert.equal(log[2].status, STAGE_STATUSES.FAILED);
  assert.equal(log[2].reason, 'repair failed');
  assert.equal(log[3].status, STAGE_STATUSES.PASSED);
  // role은 그대로라 다이어그램은 지금처럼 role로 묶어 읽는다.
  assert.deepEqual([...new Set(log.map(entry => entry.role))], ['editor', 'repair']);
});

test('결정론 단계는 role이 곧 사람이 읽는 이름이다', () => {
  const tracker = createStageStatusTracker();
  tracker.pass({ stageId: 'quality_gate', role: 'quality_gate', attempt: 1 });
  tracker.pass({ stageId: 'render', role: 'render', attempt: 1 });
  tracker.fail({ stageId: 'publish_gate', role: 'publish_gate', attempt: 1, reason: 'gate not passed' });
  const log = tracker.toLog();
  assert.deepEqual(log.map(entry => `${entry.role}:${entry.status}`), [
    'quality_gate:passed',
    'render:passed',
    'publish_gate:failed'
  ]);
  assert.deepEqual(log.map(entry => entry.stage_id), ['quality_gate', 'render', 'publish_gate']);
  // label을 안 주면 role이 stage 필드를 채운다.
  assert.deepEqual(log.map(entry => entry.stage), ['quality_gate', 'render', 'publish_gate']);
});

// reason은 지금 status를 설명하는 값이다. 실패했다 다시 통과한 행에 옛 reason이 남으면
// "passed인데 reason=NEEDS_FIX"인 모순 행이 된다 -- 커밋된 06-20·07-27·08-10 로그에 실재했다.
test('실패 후 통과로 갱신되면 이전 reason이 남지 않는다', () => {
  const tracker = createStageStatusTracker();
  const call = { stageId: 'quality_gate', role: 'quality_gate', attempt: 1 };
  tracker.fail({ ...call, reason: 'NEEDS_FIX' });
  assert.equal(tracker.toLog()[0].reason, 'NEEDS_FIX');
  tracker.pass(call);
  const entry = tracker.toLog()[0];
  assert.equal(entry.status, STAGE_STATUSES.PASSED);
  assert.equal('reason' in entry, false);
});

// 기록 전용 계측이라 잘못 부른 호출이 발행을 죽이면 안 된다. 대신 경고를 남긴다.
test('잘못 부른 호출도 던지지 않고 경고만 남긴다', () => {
  const tracker = createStageStatusTracker();
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    assert.doesNotThrow(() => tracker.pass(undefined));
    // 예전 위치 인자 방식으로 부른 경우. 조용히 통과하면 그 단계가 다이어그램에서 사라진다.
    assert.doesNotThrow(() => tracker.pass('render', 1));
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every(message => message.includes('[stage-status]')));
});

test('toLog returns copies that cannot mutate internal state', () => {
  const tracker = createStageStatusTracker();
  tracker.pass({ stageId: 'reporter', role: 'reporter', attempt: 1 });
  const log = tracker.toLog();
  log[0].status = 'tampered';
  assert.equal(tracker.toLog()[0].status, STAGE_STATUSES.PASSED);
});
