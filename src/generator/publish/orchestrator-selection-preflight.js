// deterministic selection preflight 가드 — main()이 LLM 생성 전에 거치는 early-exit 3종(#655).
//
// candidate 부족·selection 경고·selection 오류를 각각 review-only / 경고 / 실패로 처리한다.
// 이 함수들은 generationRunState/fs/root에 직접 접근하지 않고, 그 결합을 가진 orchestrator
// 함수들(status·review-package·recovery writer, selectionStatusExtra, fail)을 io로 주입받는다.
// 본문은 추출 전 main() 인라인 블록과 동일하다(동작 불변).

const { ensureArray } = require('../../shared/common/value-coercion');
const { COMPOSITION_MODES } = require('../select/newsroom-selection');
const { newsroomRelPath } = require('../../shared/common/artifact-paths');

// candidate pool preflight가 review-only면 status + review package를 쓰고 true를 반환한다.
// 호출자(main)는 true일 때 즉시 return해 LLM 생성을 건너뛴다.
function maybeHandleSelectionShortage({ date, shortlistReport, io }) {
  if (shortlistReport.candidate_shortage_reviewable !== true) return false;
  const { buildGenerationStatus, writeGenerationStatus, writeDateReviewPackage, selectionStatusExtra } = io;
  const failureReason = ensureArray(shortlistReport.shortage_reason_codes).join('; ') ||
    ensureArray(shortlistReport.selection_errors).join('; ') ||
    'Not enough publishable candidates before LLM generation.';
  const generationStatus = buildGenerationStatus({
    date,
    status: 'UNDERFILLED_NEEDS_FIX',
    extra: {
      ...selectionStatusExtra(shortlistReport),
      failure_kind: 'candidate_shortage_reviewable',
      failure_stage: 'candidate_pool_preflight',
      failure_reason: failureReason,
      public_output_expected: false,
      publish_ready: false,
      selection_publish_ready: false,
      final_publish_ready: false,
      publish_gate_passed: false,
      review_gate_passed: true,
      composition_mode: COMPOSITION_MODES.NEEDS_FIX,
      editor_review_required: true
    }
  });
  writeGenerationStatus(generationStatus);
  writeDateReviewPackage({
    date,
    files: [
      newsroomRelPath(date, 'shortlisted-candidates.json'),
      newsroomRelPath(date, 'selection-diagnostics.md'),
      newsroomRelPath(date, 'selection-report.json'),
      newsroomRelPath(date, 'selection-report.md'),
      newsroomRelPath(date, 'article-capsules.json'),
      newsroomRelPath(date, 'generation-status.json')
    ],
    validateText: 'candidate_shortage_reviewable: LLM editor generation was skipped because candidate pool preflight is review-only.',
    runContext: {
      status: generationStatus.status,
      seedUsed: generationStatus.seed_used ?? generationStatus.candidate_input?.seed_used,
      publicOutputExpected: false
    }
  });
  console.warn(`Candidate pool preflight is review-only: ${failureReason}`);
  return true;
}

// deterministic selection이 underfill 경고를 내면 status + recovery prompt를 쓰고 계속 진행한다(early-exit 없음).
function warnSelectionUnderfill({ date, newsroomDir, shortlistReport, io }) {
  if (!(shortlistReport.selection_warnings.length > 0)) return;
  const { buildGenerationStatus, writeGenerationStatus, writeRecoveryPrompt, selectionStatusExtra } = io;
  writeGenerationStatus(buildGenerationStatus({
    date,
    status: 'UNDERFILLED_NEEDS_FIX',
    extra: {
      failure_stage: 'deterministic selection',
      failure_reason: shortlistReport.selection_warnings.join('; '),
      ...selectionStatusExtra(shortlistReport)
    }
  }));
  writeRecoveryPrompt(newsroomDir, {
    date,
    stage: 'deterministic selection',
    reason: shortlistReport.selection_warnings.join('; '),
    shortlistReport,
    selectedInputs: shortlistReport.selected_articles
  });
  console.warn(`Deterministic selection is underfilled: ${shortlistReport.selection_warnings.join('; ')}`);
}

// deterministic selection이 오류를 내면 status + recovery + review package를 쓰고 fail()로 종료한다(반환하지 않음).
function maybeFailOnSelectionErrors({ date, newsroomDir, shortlistReport, io }) {
  if (!(shortlistReport.selection_errors.length > 0)) return;
  const { buildGenerationStatus, writeGenerationStatus, writeDateReviewPackage, writeRecoveryPrompt, selectionStatusExtra, fail } = io;
  const failureReason = shortlistReport.selection_errors.join('; ');
  const generationStatus = buildGenerationStatus({
    date,
    status: 'FAILED',
    failureStage: 'deterministic selection',
    failureReason,
    extra: {
      failure_stage: 'deterministic selection',
      failure_reason: failureReason,
      public_output_expected: false,
      publish_ready: false,
      selection_publish_ready: false,
      final_publish_ready: false,
      publish_gate_passed: false,
      review_gate_passed: false,
      composition_mode: COMPOSITION_MODES.NEEDS_FIX,
      editor_review_required: true,
      ...selectionStatusExtra(shortlistReport)
    }
  });
  writeRecoveryPrompt(newsroomDir, {
    date,
    stage: 'deterministic selection',
    reason: failureReason,
    shortlistReport,
    selectedInputs: shortlistReport.selected_articles
  });
  writeGenerationStatus(generationStatus);
  writeDateReviewPackage({
    date,
    files: [
      newsroomRelPath(date, 'shortlisted-candidates.json'),
      newsroomRelPath(date, 'selection-diagnostics.md'),
      newsroomRelPath(date, 'selection-report.json'),
      newsroomRelPath(date, 'selection-report.md'),
      newsroomRelPath(date, 'article-capsules.json'),
      newsroomRelPath(date, 'recovery-prompt.md'),
      newsroomRelPath(date, 'generation-status.json'),
      newsroomRelPath(date, '00-review-guide.md'),
      newsroomRelPath(date, 'release-qa-report.md'),
      newsroomRelPath(date, 'artifact-manifest.json')
    ],
    validateText: `deterministic selection failed: ${failureReason}`,
    runContext: {
      status: generationStatus.status,
      seedUsed: generationStatus.seed_used ?? generationStatus.candidate_input?.seed_used,
      publicOutputExpected: false
    }
  });
  fail(`[deterministic selection] ${failureReason}`);
}

module.exports = {
  maybeHandleSelectionShortage,
  warnSelectionUnderfill,
  maybeFailOnSelectionErrors
};
