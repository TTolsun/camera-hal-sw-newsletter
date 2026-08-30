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

test('결정론 단계는 role을 생략하면 stage id를 그대로 쓴다', () => {
  const tracker = createStageStatusTracker();
  tracker.pass({ stageId: 'quality_gate', attempt: 1 });
  tracker.pass({ stageId: 'render', attempt: 1 });
  tracker.fail({ stageId: 'publish_gate', attempt: 1, reason: 'gate not passed' });
  const log = tracker.toLog();
  assert.deepEqual(log.map(entry => `${entry.role}:${entry.status}`), [
    'quality_gate:passed',
    'render:passed',
    'publish_gate:failed'
  ]);
  assert.deepEqual(log.map(entry => entry.stage_id), ['quality_gate', 'render', 'publish_gate']);
});

test('toLog returns copies that cannot mutate internal state', () => {
  const tracker = createStageStatusTracker();
  tracker.pass({ stageId: 'reporter', role: 'reporter', attempt: 1 });
  const log = tracker.toLog();
  log[0].status = 'tampered';
  assert.equal(tracker.toLog()[0].status, STAGE_STATUSES.PASSED);
});
