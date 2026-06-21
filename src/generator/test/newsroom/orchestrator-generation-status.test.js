const assert = require('node:assert/strict');
const test = require('node:test');

const {
  GENERATION_STATUSES,
  classifyGenerationStatus,
  isEditorialReviewableStatus
} = require('../../publish/orchestrator-generation-status');

// 이 테스트는 추출 전 orchestrator main()의 generationStatus 결정 로직
// (let generationStatus = 'PASS' ... if/else 사다리)을 입력→출력으로 고정한다.
// 추출 후에도 같은 입력에서 같은 등급이 나와야 한다(동작 불변 보증).

test('결함이 없으면 PASS', () => {
  assert.equal(
    classifyGenerationStatus({
      underfilled: false,
      factCheckStatus: 'PASS',
      mustFixCount: 0,
      qualityStatus: 'PASS'
    }),
    GENERATION_STATUSES.PASS
  );
});

test('underfill은 다른 모든 결함보다 우선한다', () => {
  assert.equal(
    classifyGenerationStatus({
      underfilled: true,
      factCheckStatus: 'NEEDS_FIX',
      mustFixCount: 5,
      qualityStatus: 'NEEDS_FIX'
    }),
    GENERATION_STATUSES.UNDERFILLED_NEEDS_FIX
  );
});

test('fact-check NEEDS_FIX + must-fix가 있으면 NEEDS_FIX', () => {
  assert.equal(
    classifyGenerationStatus({
      underfilled: false,
      factCheckStatus: 'NEEDS_FIX',
      mustFixCount: 2,
      qualityStatus: 'PASS'
    }),
    GENERATION_STATUSES.NEEDS_FIX
  );
});

test('fact-check NEEDS_FIX여도 must-fix가 0이면 NEEDS_FIX가 아니다', () => {
  assert.equal(
    classifyGenerationStatus({
      underfilled: false,
      factCheckStatus: 'NEEDS_FIX',
      mustFixCount: 0,
      qualityStatus: 'PASS'
    }),
    GENERATION_STATUSES.PASS
  );
});

test('must-fix가 0이고 quality가 미통과면 QUALITY_NEEDS_FIX', () => {
  assert.equal(
    classifyGenerationStatus({
      underfilled: false,
      factCheckStatus: 'NEEDS_FIX',
      mustFixCount: 0,
      qualityStatus: 'NEEDS_FIX'
    }),
    GENERATION_STATUSES.QUALITY_NEEDS_FIX
  );
});

test('fact-check는 통과했지만 quality가 미통과면 QUALITY_NEEDS_FIX', () => {
  assert.equal(
    classifyGenerationStatus({
      underfilled: false,
      factCheckStatus: 'PASS',
      mustFixCount: 0,
      qualityStatus: 'NEEDS_FIX'
    }),
    GENERATION_STATUSES.QUALITY_NEEDS_FIX
  );
});

test('fact-check must-fix는 quality 미통과보다 우선한다', () => {
  assert.equal(
    classifyGenerationStatus({
      underfilled: false,
      factCheckStatus: 'NEEDS_FIX',
      mustFixCount: 1,
      qualityStatus: 'NEEDS_FIX'
    }),
    GENERATION_STATUSES.NEEDS_FIX
  );
});

test('isEditorialReviewableStatus는 fact-check/quality 결함에만 true', () => {
  assert.equal(isEditorialReviewableStatus(GENERATION_STATUSES.NEEDS_FIX), true);
  assert.equal(isEditorialReviewableStatus(GENERATION_STATUSES.QUALITY_NEEDS_FIX), true);
});

test('isEditorialReviewableStatus는 PASS/underfill/미지정에 false', () => {
  assert.equal(isEditorialReviewableStatus(GENERATION_STATUSES.PASS), false);
  assert.equal(isEditorialReviewableStatus(GENERATION_STATUSES.UNDERFILLED_NEEDS_FIX), false);
  assert.equal(isEditorialReviewableStatus(''), false);
  assert.equal(isEditorialReviewableStatus(undefined), false);
});
