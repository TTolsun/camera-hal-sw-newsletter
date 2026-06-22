const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const {
  writeReviewableRepairFailureArtifacts
} = require('../../publish/orchestrator-repair-failure-artifacts');
const godFile = require('../../publish/gemini-newsroom-newsletter');
const { generationRunState } = require('../../publish/orchestrator-run-state');
const { tempRoot } = require('../../../shared/test/helpers/fs');

// god-file에서 분리한 reviewable repair-failure artifact writer를 입력→동작으로 고정한다.
// 전체 fallback 산출(유효 editor draft + 15개 리뷰 파일)은 targeted-retry.test.js가 이미
// 검증하므로, 여기서는 분리 모듈의 진입 계약 두 가지를 고정한다.
//  1) lastKnownValidEditor가 없으면 받은 error를 그대로 throw(아무 artifact도 쓰지 않음).
//  2) god-file이 같은 함수 참조를 재노출한다(module.exports + targeted-retry.test.js 직접 호출 보존).

function withClearedLastKnownValidEditor(run) {
  const previous = generationRunState.lastKnownValidEditor;
  generationRunState.lastKnownValidEditor = null;
  try {
    return run();
  } finally {
    generationRunState.lastKnownValidEditor = previous;
  }
}

test('writeReviewableRepairFailureArtifacts: lastKnownValidEditor가 없으면 받은 error를 그대로 throw한다', () => {
  const rootDir = tempRoot('repair-failure-');
  const date = '2026-05-08';
  const newsroomDir = path.join(rootDir, 'articles', 'content', 'newsroom', date);
  const sentinel = new Error('repair failed without a last known valid editor');

  withClearedLastKnownValidEditor(() => {
    assert.throws(
      () => writeReviewableRepairFailureArtifacts({
        date,
        newsroomDir,
        rootDir,
        error: sentinel,
        attempt: 1,
        stage: 'editor repair attempt 1/2'
      }),
      err => err === sentinel
    );
  });

  // 빠른 throw 경로는 어떤 리뷰 artifact도 쓰지 않는다.
  assert.equal(fs.existsSync(path.join(newsroomDir, 'repair-failure.json')), false);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'generation-status.json')), false);
});

test('god-file이 분리 모듈의 writeReviewableRepairFailureArtifacts를 같은 참조로 재노출한다', () => {
  assert.equal(typeof writeReviewableRepairFailureArtifacts, 'function');
  assert.equal(godFile.writeReviewableRepairFailureArtifacts, writeReviewableRepairFailureArtifacts);
});
