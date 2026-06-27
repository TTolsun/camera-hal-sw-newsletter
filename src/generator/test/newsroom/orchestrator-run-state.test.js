const assert = require('node:assert/strict');
const test = require('node:test');

// 이 테스트는 god-file에서 분리한 generationRunState 싱글톤을 입력→출력으로 고정한다.
// 추출 전 gemini-newsroom-newsletter.js 안의 const generationRunState = {...}와
// 동일한 초기 필드/초기값을 가져야 하고(동작 불변), require 캐시로 같은 인스턴스를
// 공유해야 한다(분리해도 모든 모듈이 같은 run state를 보는 CommonJS 싱글톤 의미 보존).

const MODULE_PATH = require.resolve('../../publish/orchestrator-run-state');

function freshRunState() {
  delete require.cache[MODULE_PATH];
  return require(MODULE_PATH).generationRunState;
}

test('초기 generationRunState는 추출 전과 동일한 초기값을 가진다', () => {
  const state = freshRunState();
  assert.equal(state.date, '');
  assert.deepEqual(state.retryHistory, []);
  assert.equal(state.currentQualityAttempt, 0);
  assert.equal(state.qualityReport, null);
  assert.equal(state.factCheck, null);
  assert.equal(state.shortlistReport, null);
  assert.deepEqual(state.selectedInputs, []);
  assert.equal(state.lastKnownValidEditor, null);
  assert.equal(state.lastKnownValidReporter, null);
  assert.equal(state.lastKnownValidFactCheck, null);
  assert.equal(state.lastKnownValidQualityReport, null);
  assert.equal(state.lastKnownValidAttempt, 0);
  assert.equal(state.editorSemanticValidation, null);
  assert.equal(state.editorPublicArticleJudge, null);
  assert.deepEqual(state.editorDeskAdvisory, []);
  assert.equal(state.repairAttempted, false);
  assert.equal(state.repairSucceeded, false);
  assert.equal(state.candidateInput, null);
});

test('정확히 이 키들만 가진다(필드 누락/추가 방지)', () => {
  const state = freshRunState();
  assert.deepEqual(Object.keys(state).sort(), [
    'candidateInput',
    'currentQualityAttempt',
    'date',
    'editorDeskAdvisory',
    'editorPublicArticleJudge',
    'editorSemanticValidation',
    'factCheck',
    'lastKnownValidAttempt',
    'lastKnownValidEditor',
    'lastKnownValidFactCheck',
    'lastKnownValidQualityReport',
    'lastKnownValidReporter',
    'qualityReport',
    'repairAttempted',
    'repairSucceeded',
    'retryHistory',
    'selectedInputs',
    'shortlistReport',
    'stageTracker'
  ]);
});

test('stageTracker는 단계 추적 인터페이스(start/pass/fail)를 제공한다', () => {
  const state = freshRunState();
  assert.equal(typeof state.stageTracker.start, 'function');
  assert.equal(typeof state.stageTracker.pass, 'function');
  assert.equal(typeof state.stageTracker.fail, 'function');
});

test('require 캐시로 같은 싱글톤 인스턴스를 공유한다', () => {
  delete require.cache[MODULE_PATH];
  const first = require(MODULE_PATH).generationRunState;
  const second = require(MODULE_PATH).generationRunState;
  assert.equal(first, second);
});
