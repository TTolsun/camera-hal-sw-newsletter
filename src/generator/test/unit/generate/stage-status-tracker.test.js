'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  STAGE_STATUSES,
  roleFromStageLabel,
  createStageStatusTracker
} = require('../../../scripts/newsroom/generate/stage-status-tracker');

test('roleFromStageLabel maps runtime stage labels to canonical roles', () => {
  assert.equal(roleFromStageLabel('reporter attempt 1/2'), 'reporter');
  assert.equal(roleFromStageLabel('editor attempt 1/2'), 'editor');
  assert.equal(roleFromStageLabel('editor completion attempt 1/2'), 'editor');
  assert.equal(roleFromStageLabel('editor repair attempt 1/2'), 'repair');
  assert.equal(roleFromStageLabel('fact-checker attempt 1/2'), 'factcheck');
  assert.equal(roleFromStageLabel('background-context attempt 1/2'), 'background-context');
  assert.equal(roleFromStageLabel('editor public article judge'), 'judge');
  assert.equal(roleFromStageLabel('editor public article judge repair'), 'repair');
  assert.equal(roleFromStageLabel(''), 'unknown');
});

test('start then pass records a passed entry for the same role/attempt', () => {
  const tracker = createStageStatusTracker();
  tracker.start('reporter', 1, 'reporter attempt 1/2');
  tracker.pass('reporter', 1, 'reporter attempt 1/2');
  const log = tracker.toLog();
  assert.equal(log.length, 1);
  assert.deepEqual(
    { role: log[0].role, attempt: log[0].attempt, status: log[0].status },
    { role: 'reporter', attempt: 1, status: STAGE_STATUSES.PASSED }
  );
});

test('fail overrides started and keeps a reason', () => {
  const tracker = createStageStatusTracker();
  tracker.start('editor', 1, 'editor attempt 1/2');
  tracker.fail('editor', 1, 'editor attempt 1/2', 'invalid JSON');
  const log = tracker.toLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].status, STAGE_STATUSES.FAILED);
  assert.equal(log[0].reason, 'invalid JSON');
});

test('same role across different attempts produces distinct ordered entries', () => {
  const tracker = createStageStatusTracker();
  tracker.start('editor', 1);
  tracker.fail('editor', 1, '', 'attempt 1 failed');
  tracker.start('editor', 2);
  tracker.pass('editor', 2);
  const log = tracker.toLog();
  assert.equal(log.length, 2);
  assert.deepEqual(log.map(e => `${e.role}#${e.attempt}:${e.status}`), [
    'editor#1:failed',
    'editor#2:passed'
  ]);
});

test('deterministic stages can be marked directly', () => {
  const tracker = createStageStatusTracker();
  tracker.pass('quality_gate', 1);
  tracker.pass('render', 1);
  tracker.fail('publish_gate', 1, '', 'gate not passed');
  const log = tracker.toLog();
  assert.deepEqual(log.map(e => `${e.role}:${e.status}`), [
    'quality_gate:passed',
    'render:passed',
    'publish_gate:failed'
  ]);
});

test('toLog returns copies that cannot mutate internal state', () => {
  const tracker = createStageStatusTracker();
  tracker.pass('reporter', 1);
  const log = tracker.toLog();
  log[0].status = 'tampered';
  assert.equal(tracker.toLog()[0].status, STAGE_STATUSES.PASSED);
});
