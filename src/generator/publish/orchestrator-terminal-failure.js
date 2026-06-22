// 발행 orchestrator의 terminal failure 상태 집계기(#655).
// writeTerminalFailureStatus는 main()이 던진 어떤 실패든 받아 reviewable diagnostics PR로
// 라우팅하는 마지막 방어선이다: editor가 유효 draft 이후 실패했고 last-known-valid editor가
// 있으면 reviewable repair-failure 묶음을 쓰고, 그 외에는 recovery-prompt와 selection
// diagnostics를 남긴 뒤 실패 등급(FAILED_RAW_ARTIFACT_VALIDATION / FAILED_EDITOR_REVIEWABLE /
// FAILED)으로 generation-status.json과 cost-report를 기록한다. job을 죽이는 대신 사람이 리뷰할
// 수 있는 artifact를 남기는 게 책임이다.
// 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접 import한다: 실패 분류는
// generation-failure-classification, raw-artifact/editor-semantic 에러 타입은 candidate-artifacts·
// editor-output-contract, reviewable repair 묶음은 orchestrator-repair-failure-artifacts,
// recovery/selection-diagnostics writer는 orchestrator-recovery-writers, status builder·extra는
// orchestrator-status-builders, generation-status/cost-report writer는 orchestrator-artifact-writers,
// generationRunState는 orchestrator-run-state에서 가져온다. 이 모듈들은 god-file을 import하지 않아
// 순환이 없다. root와 runtimeConfig는 god-file과 동일하게 process.cwd()/readRuntimeConfig로
// load 시점에 한 번 파생한다.
const { kstDate } = require('../../shared/common/common');
const { newsroomDir: artifactNewsroomDir } = require('../../shared/common/artifact-paths');
const {
  CandidateArtifactValidationError
} = require('../../shared/common/candidate-artifacts');
const { readRuntimeConfig } = require('../../shared/common/runtime-config');
const {
  EditorSemanticValidationError
} = require('../editor/editor-output-contract');
const {
  failureStageFromError,
  failureClassFromError
} = require('./generation-failure-classification');
const {
  buildGenerationStatus,
  editorSemanticStatusExtra,
  selectionStatusExtra
} = require('./orchestrator-status-builders');
const {
  writeRecoveryPrompt,
  writeSelectionDiagnosticsArtifact
} = require('./orchestrator-recovery-writers');
const {
  writeGenerationStatus,
  writeCostReport
} = require('./orchestrator-artifact-writers');
const {
  writeReviewableRepairFailureArtifacts
} = require('./orchestrator-repair-failure-artifacts');
const { generationRunState } = require('./orchestrator-run-state');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);

function writeTerminalFailureStatus(error) {
  const date = generationRunState.date || runtimeConfig.newsletterDate || kstDate();
  const newsroomDir = artifactNewsroomDir(root, date);
  const failedRawArtifactValidation = error instanceof CandidateArtifactValidationError;
  if (error instanceof EditorSemanticValidationError && generationRunState.lastKnownValidEditor) {
    try {
      writeReviewableRepairFailureArtifacts({
        date,
        newsroomDir,
        error,
        reporter: generationRunState.lastKnownValidReporter,
        factCheck: generationRunState.factCheck || generationRunState.lastKnownValidFactCheck,
        qualityReport: generationRunState.qualityReport || generationRunState.lastKnownValidQualityReport,
        retryHistory: generationRunState.retryHistory,
        shortlistReport: generationRunState.shortlistReport,
        attempt: generationRunState.currentQualityAttempt || generationRunState.lastKnownValidAttempt,
        stage: failureStageFromError(error)
      });
      return;
    } catch (fallbackError) {
      console.error(`Failed to preserve reviewable repair artifacts: ${fallbackError.message}`);
    }
  }
  try {
    writeRecoveryPrompt(newsroomDir, {
      date,
      stage: failureStageFromError(error),
      reason: String(error?.message || error || 'Unknown generation failure.'),
      shortlistReport: generationRunState.shortlistReport,
      selectedInputs: generationRunState.selectedInputs,
      qualityReport: generationRunState.qualityReport,
      factCheck: generationRunState.factCheck
    });
    writeSelectionDiagnosticsArtifact(newsroomDir, generationRunState.shortlistReport);
  } catch (_) {
    // The status file below is the minimum required failure artifact.
  }
  // editor가 유효 draft 없이 총체적으로 실패해도 결정론적 selection 아티팩트는 남아 있으므로, job을
  // 죽이는 FAILED 대신 reviewable diagnostics PR로 라우팅한다(#503 정신).
  const failedEditorReviewable = error instanceof EditorSemanticValidationError &&
    !failedRawArtifactValidation &&
    Boolean(generationRunState.shortlistReport);
  writeGenerationStatus(buildGenerationStatus({
    date,
    status: failedRawArtifactValidation
      ? 'FAILED_RAW_ARTIFACT_VALIDATION'
      : failedEditorReviewable
        ? 'FAILED_EDITOR_REVIEWABLE'
        : 'FAILED',
    failureStage: failureStageFromError(error),
    failureReason: String(error?.message || error || 'Unknown generation failure.'),
    failureClass: failureClassFromError(error),
    retryHistory: generationRunState.retryHistory,
    qualityReport: generationRunState.qualityReport,
    factCheck: generationRunState.factCheck,
    extra: {
      quality_attempt_count: Math.max(
        generationRunState.retryHistory.length,
        generationRunState.currentQualityAttempt
      ),
      raw_artifact_validation_error: failedRawArtifactValidation ? error.details : null,
      failure_kind: failedEditorReviewable ? 'editor_failed_reviewable' : '',
      review_gate_passed: failedEditorReviewable ? true : undefined,
      editor_review_required: failedEditorReviewable ? true : undefined,
      public_output_expected: failedEditorReviewable ? false : undefined,
      ...editorSemanticStatusExtra(error),
      ...selectionStatusExtra(generationRunState.shortlistReport)
    }
  }));
  writeCostReport(date);
}

module.exports = {
  writeTerminalFailureStatus
};
