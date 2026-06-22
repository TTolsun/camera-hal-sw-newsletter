const assert = require('node:assert/strict');
const test = require('node:test');

// 이 테스트는 god-file에서 분리한 status/extra builder(#655)의 입력→출력을 고정한다.
// 네 함수는 generationRunState 싱글톤과 정책 import에만 의존하며 분리 후에도 동작이
// 불변이어야 한다. buildGenerationStatus는 입력을 status artifact 형태로 매핑하고,
// selectionStatusExtra는 sample shortlistReport를 selection 진단 extra로 환산하며,
// recordEditorSemanticStatus/editorSemanticStatusExtra는 run state를 경유해 왕복한다.

const {
  buildGenerationStatus,
  recordEditorSemanticStatus,
  editorSemanticStatusExtra,
  selectionStatusExtra
} = require('../../publish/orchestrator-status-builders');
const { generationRunState } = require('../../publish/orchestrator-run-state');
const { articlePolicy } = require('../../../shared/common/newsletter-policy');

function resetEditorSemanticState() {
  generationRunState.editorSemanticValidation = null;
  generationRunState.editorPublicArticleJudge = null;
  generationRunState.repairAttempted = false;
  generationRunState.repairSucceeded = false;
}

test('buildGenerationStatus는 입력을 status artifact 형태로 매핑한다', () => {
  const status = buildGenerationStatus({
    date: '2026-06-23',
    status: 'STARTED',
    factCheck: { status: 'PASS', must_fix: [{}, {}] },
    qualityReport: { status: 'PASS', score: 96, threshold: 60, deductions: [{}] },
    retryHistory: [{}, {}]
  });
  assert.equal(status.date, '2026-06-23');
  assert.equal(status.status, 'STARTED');
  assert.equal(status.fact_check_status, 'PASS');
  assert.equal(status.must_fix_count, 2);
  assert.equal(status.quality_status, 'PASS');
  assert.equal(status.quality_score, 96);
  assert.equal(status.quality_threshold, 60);
  assert.equal(status.quality_deduction_count, 1);
  assert.equal(status.quality_attempt_count, 2);
  assert.ok(status.run_context && typeof status.run_context === 'object');
  assert.ok('model_usage' in status);
});

test('buildGenerationStatus는 빈 입력에서 안전한 기본값을 채운다', () => {
  const status = buildGenerationStatus({ date: '2026-06-23', status: 'FAILED' });
  assert.equal(status.fact_check_status, 'UNKNOWN');
  assert.equal(status.quality_status, 'UNKNOWN');
  assert.equal(status.must_fix_count, 0);
  assert.equal(status.quality_attempt_count, 0);
  assert.equal(status.quality_score, null);
});

test('selectionStatusExtra는 sample shortlistReport를 selection 진단 extra로 환산한다', () => {
  const extra = selectionStatusExtra({
    input_candidate_count: 40,
    eligible_candidate_count: 18,
    selected_article_count: 5,
    underfilled: false,
    publish_ready: true,
    composition_summary: {
      primary_camera_stack_topic_count: 5,
      supporting_main_article_count: 0,
      forbidden_main_article_count: 0
    },
    selected_articles: []
  });
  assert.equal(extra.input_candidate_count, 40);
  assert.equal(extra.eligible_candidate_count, 18);
  assert.equal(extra.selected_article_count, 5);
  assert.equal(extra.primary_camera_stack_topic_count, 5);
  assert.equal(extra.underfilled, false);
  assert.equal(extra.publish_ready, true);
  assert.equal(extra.selection_publish_ready, true);
  assert.equal(typeof extra.review_gate_passed, 'boolean');
  assert.equal(typeof extra.publish_gate_passed, 'boolean');
  assert.ok(Array.isArray(extra.selection_warnings));
  assert.ok(Array.isArray(extra.selection_errors));
});

test('selectionStatusExtra는 빈 report에서 정책 기본값(min_final_articles)을 사용한다', () => {
  const extra = selectionStatusExtra({});
  assert.equal(extra.min_final_articles, articlePolicy.mainArticleCount.min);
  assert.equal(extra.max_final_articles, articlePolicy.mainArticleCount.max);
  assert.equal(extra.selected_article_count, null);
  assert.equal(extra.publish_ready, null);
});

test('recordEditorSemanticStatus와 editorSemanticStatusExtra는 run state를 경유해 왕복한다', () => {
  resetEditorSemanticState();
  recordEditorSemanticStatus({
    editor_semantic_validation: { ok: false },
    editor_public_article_judge: { status: 'BLOCKED' },
    repairAttempted: true,
    repairSucceeded: false
  });
  assert.deepEqual(generationRunState.editorSemanticValidation, { ok: false });
  assert.deepEqual(generationRunState.editorPublicArticleJudge, { status: 'BLOCKED' });
  assert.equal(generationRunState.repairAttempted, true);

  const extra = editorSemanticStatusExtra();
  assert.deepEqual(extra.editor_semantic_validation, { ok: false });
  assert.deepEqual(extra.editor_public_article_judge, { status: 'BLOCKED' });
  assert.equal(extra.repairAttempted, true);
  assert.equal(extra.repairSucceeded, false);
  resetEditorSemanticState();
});

test('recordEditorSemanticStatus는 repair 플래그를 단조 증가(OR)로만 갱신한다', () => {
  resetEditorSemanticState();
  recordEditorSemanticStatus({ repairSucceeded: true });
  recordEditorSemanticStatus({ repairSucceeded: false });
  assert.equal(generationRunState.repairSucceeded, true);
  resetEditorSemanticState();
});

test('editorSemanticStatusExtra는 error 인자에서 값을 우선 추출한다', () => {
  resetEditorSemanticState();
  const extra = editorSemanticStatusExtra({
    editorSemanticValidation: { ok: true },
    editorPublicArticleJudge: { status: 'PASS' },
    repairAttempted: true,
    repairSucceeded: true
  });
  assert.deepEqual(extra.editor_semantic_validation, { ok: true });
  assert.deepEqual(extra.editor_public_article_judge, { status: 'PASS' });
  assert.equal(extra.repairAttempted, true);
  assert.equal(extra.repairSucceeded, true);
  resetEditorSemanticState();
});
