// 발행 orchestrator의 reviewable repair-failure artifact writer(#655).
// writeReviewableRepairFailureArtifacts는 repair가 유효한 editor draft 이후에 실패했을 때
// last-known-valid editor로 fallback해 FAILED_REPAIR_REVIEWABLE 리뷰 묶음(repair-failure.json,
// editor-draft.*, fact-check-report.*, quality-report.*, retry-history.*, recovery-prompt.md,
// generation-status.json + date review package)을 쓰는 orchestrator 진입점이다. 협력자는 모두
// 이미 분리된 sibling 모듈에서 직접 import한다: status builder는 orchestrator-status-builders,
// recovery prompt는 orchestrator-recovery-writers, date review package는
// orchestrator-review-package-writer, editor 검증·last-known-valid 기록은
// orchestrator-editor-validation, seed evidence pack 조회는 orchestrator-validate-runner,
// generationRunState는 orchestrator-run-state에서 가져온다. 이 모듈들은 god-file을 import하지
// 않아 순환이 없다. STATUS_FAILED_REPAIR_REVIEWABLE 상수와 root/runtimeConfig는 publish-status.js·
// resolve-reviewable-artifacts.js와 동일하게 같은 리터럴·process.cwd()/readRuntimeConfig로 파생해
// god-file과 byte-identical 동작을 유지한다.
const { ensureArray } = require('../../shared/common/value-coercion');
const fs = require('fs');
const path = require('path');
const { writeJson } = require('../../shared/common/common');
const { newsroomRelPath } = require('../../shared/common/artifact-paths');
const { readRuntimeConfig } = require('../../shared/common/runtime-config');
const { qualityGatePolicy } = require('../../shared/common/newsletter-policy');
const { COMPOSITION_MODES } = require('../select/newsroom-selection');
const {
  serializeEditorValidationError
} = require('../editor/editor-output-contract');
const {
  buildMarkdown,
  buildFactCheckMarkdown
} = require('../render/newsletter-renderer');
const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown
} = require('../quality/newsletter-quality');
const { sectionLabel, cloneJson } = require('./orchestrator-shared-helpers');
const { finalArticleSlotDistribution } = require('./orchestrator-repair-plan');
const {
  lockedArticleHeadlines,
  sourceGapSections
} = require('./orchestrator-section-locking');
const {
  editorRenderedGroupKeys,
  editorExplicitlyDemotedGroups,
  editorHardBlockedGroups,
  buildRetryHistoryMarkdown
} = require('./orchestrator-report-builders');
const {
  fallbackFactCheckForRepairFailure
} = require('./orchestrator-targeted-repair');
const {
  writeEditorDraftJson,
  writeNewsletterDate,
  writeGenerationStatus,
  writeCostReport
} = require('./orchestrator-artifact-writers');
const { generationRunState } = require('./orchestrator-run-state');
const { readSeedEvidencePackForDate } = require('./orchestrator-validate-runner');
const {
  buildGenerationStatus,
  recordEditorSemanticStatus,
  editorSemanticStatusExtra,
  selectionStatusExtra
} = require('./orchestrator-status-builders');
const { writeDateReviewPackage } = require('./orchestrator-review-package-writer');
const { writeRecoveryPrompt } = require('./orchestrator-recovery-writers');
const { editorRequestsStoryContract } = require('./orchestrator-editor-retry-contract');
const { validateEditor } = require('./orchestrator-editor-validation');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);
const STATUS_FAILED_REPAIR_REVIEWABLE = 'FAILED_REPAIR_REVIEWABLE';

function writeReviewableRepairFailureArtifacts({
  date,
  newsroomDir,
  error,
  reporter = null,
  factCheck = null,
  qualityReport = null,
  retryHistory = [],
  shortlistReport = null,
  attempt = 0,
  stage = 'repair',
  rootDir = root
}) {
  if (!generationRunState.lastKnownValidEditor) {
    throw error;
  }

  const fallbackReporter = cloneJson(reporter || generationRunState.lastKnownValidReporter || { candidates: [] });
  const fallbackRequiresStoryContract = editorRequestsStoryContract(generationRunState.lastKnownValidEditor);
  const fallbackEditor = validateEditor(cloneJson(generationRunState.lastKnownValidEditor), date, fallbackReporter, {
    strictClaims: true,
    requireStoryContract: fallbackRequiresStoryContract
  });
  const fallbackFactCheck = fallbackFactCheckForRepairFailure(error, factCheck || generationRunState.lastKnownValidFactCheck);
  const existingQualityReport = qualityReport || generationRunState.lastKnownValidQualityReport;
  const fallbackQualityReport = existingQualityReport?.metrics
    ? cloneJson(existingQualityReport)
    : buildNewsletterQualityReport(date, fallbackEditor, fallbackReporter, fallbackFactCheck, {
      threshold: qualityGatePolicy.threshold,
      shortlistReport: shortlistReport || generationRunState.shortlistReport,
      strictClaimValidation: true,
      seedEvidencePack: readSeedEvidencePackForDate(date, rootDir)
    });
  const serializedError = serializeEditorValidationError(error, {
    stage,
    attempt,
    status: STATUS_FAILED_REPAIR_REVIEWABLE,
    lastKnownValidAttempt: generationRunState.lastKnownValidAttempt,
    fallbackEditorSectionCount: ensureArray(fallbackEditor.sections).length
  });
  recordEditorSemanticStatus({
    editor_semantic_validation: serializedError,
    repairAttempted: true,
    repairSucceeded: false
  });
  const fallbackRetryHistory = [
    ...ensureArray(retryHistory),
    {
      attempt,
      model: 'repair-fallback',
      score: fallbackQualityReport.score,
      threshold: fallbackQualityReport.threshold,
      status: STATUS_FAILED_REPAIR_REVIEWABLE,
      rendered_main_article_count: ensureArray(fallbackEditor.sections).length,
      locked_article_count: 0,
      demoted_article_count: 0,
      reserve_pool_opened: false,
      reserve_open_reason: '',
      reserve_candidates_used: [],
      candidate_rejections: [],
      underfilled_reason: '',
      deductions: ensureArray(fallbackQualityReport.deductions),
      selected_article_headlines: lockedArticleHeadlines(fallbackEditor.sections),
      locked_article_headlines: [],
      source_gap_sections: sourceGapSections(fallbackEditor, fallbackFactCheck).map(sectionLabel),
      demoted_sections: [],
      replaced_sections: [],
      locked_sections: [],
      failed_sections: [],
      regenerated_sections: [],
      rejected_retry_outputs: [],
      repair_actions: [`${stage}: fallback-to-last-known-valid-editor`],
      max_section_repairs: runtimeConfig.newsroomMaxSectionRepairs,
      repair_plan: [],
      skipped_repair_sections: [],
      article_locks: [],
      final_article_slot_distribution: finalArticleSlotDistribution(fallbackEditor.sections),
      reporter_eligibility_blocked_sections: [],
      rejected_main_ineligible_candidates: [],
      lock_blockers: [],
      rejected_duplicate_headlines: [],
      source_gap_count: fallbackQualityReport.metrics?.source_gap_count ?? fallbackFactCheck.source_gap_count ?? 0,
      must_fix_count: fallbackQualityReport.metrics?.must_fix_count ?? ensureArray(fallbackFactCheck.must_fix).length,
      repair_failure: serializedError
    }
  ];

  writeNewsletterDate(date, rootDir);
  fs.mkdirSync(newsroomDir, { recursive: true });
  writeJson(path.join(newsroomDir, 'repair-failure.json'), serializedError);
  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), fallbackReporter);
  writeEditorDraftJson(path.join(newsroomDir, 'editor-draft.json'), fallbackEditor, date, {
    warnings: ['failed repair fallback used last known valid editor draft']
  });
  fs.writeFileSync(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(fallbackEditor), 'utf8');
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), fallbackFactCheck);
  fs.writeFileSync(path.join(newsroomDir, 'fact-check-report.md'), buildFactCheckMarkdown(date, fallbackFactCheck), 'utf8');
  writeJson(path.join(newsroomDir, 'quality-report.json'), fallbackQualityReport);
  fs.writeFileSync(path.join(newsroomDir, 'quality-report.md'), buildQualityReportMarkdown(fallbackQualityReport), 'utf8');
  writeJson(path.join(newsroomDir, 'retry-history.json'), fallbackRetryHistory);
  fs.writeFileSync(
    path.join(newsroomDir, 'retry-history.md'),
    buildRetryHistoryMarkdown(date, fallbackRetryHistory, selectionStatusExtra(shortlistReport || generationRunState.shortlistReport, {
      renderedMainArticleCount: ensureArray(fallbackEditor.sections).length,
      renderedGroupKeys: editorRenderedGroupKeys(fallbackEditor),
      explicitlyDemotedGroups: editorExplicitlyDemotedGroups(fallbackEditor),
      hardBlockedGroups: editorHardBlockedGroups(fallbackEditor),
      finalPublishReady: false,
      publishGatePassed: false,
      compositionMode: COMPOSITION_MODES.NEEDS_FIX,
      editorReviewRequired: true
    })),
    'utf8'
  );
  writeCostReport(date, rootDir);
  writeRecoveryPrompt(newsroomDir, {
    date,
    stage,
    reason: String(error?.message || error || 'Unknown repair failure.'),
    shortlistReport: shortlistReport || generationRunState.shortlistReport,
    selectedInputs: ensureArray((shortlistReport || generationRunState.shortlistReport)?.selected_articles),
    qualityReport: fallbackQualityReport,
    factCheck: fallbackFactCheck
  });

  generationRunState.factCheck = fallbackFactCheck;
  generationRunState.qualityReport = fallbackQualityReport;
  generationRunState.retryHistory = fallbackRetryHistory;

  const generationStatus = buildGenerationStatus({
    date,
    status: STATUS_FAILED_REPAIR_REVIEWABLE,
    failureStage: stage,
    failureReason: String(error?.message || error || 'Unknown repair failure.'),
    retryHistory: fallbackRetryHistory,
    qualityReport: fallbackQualityReport,
    factCheck: fallbackFactCheck,
    extra: {
      quality_status: fallbackQualityReport.status,
      quality_score: fallbackQualityReport.score,
      quality_threshold: fallbackQualityReport.threshold,
      quality_deduction_count: ensureArray(fallbackQualityReport.deductions).length,
      validate_ok: false,
      public_output_expected: false,
      todo_found: false,
      empty_source_sections: [],
      source_gap_count: fallbackFactCheck.source_gap_count ?? fallbackQualityReport.metrics.source_gap_count,
      ...editorSemanticStatusExtra(error),
      ...selectionStatusExtra(shortlistReport || generationRunState.shortlistReport, {
        renderedMainArticleCount: ensureArray(fallbackEditor.sections).length,
        renderedGroupKeys: editorRenderedGroupKeys(fallbackEditor),
        explicitlyDemotedGroups: editorExplicitlyDemotedGroups(fallbackEditor),
        hardBlockedGroups: editorHardBlockedGroups(fallbackEditor),
        lockedArticleCount: 0,
        demotedArticleCount: 0,
        finalPublishReady: false,
        publishGatePassed: false,
        compositionMode: COMPOSITION_MODES.NEEDS_FIX,
        editorReviewRequired: true
      }),
      publish_ready: false,
      selection_publish_ready: false,
      review_gate_passed: true,
      final_publish_ready: false,
      publish_gate_passed: false,
      composition_mode: COMPOSITION_MODES.NEEDS_FIX,
      editor_review_required: true
    }
  });
  writeJson(path.join(newsroomDir, 'generation-status.json'), generationStatus);
  writeGenerationStatus(generationStatus, rootDir);
  writeDateReviewPackage({
    rootDir,
    date,
    files: [
      newsroomRelPath(date, 'repair-failure.json'),
      newsroomRelPath(date, 'reporter-candidates.json'),
      newsroomRelPath(date, 'editor-draft.json'),
      newsroomRelPath(date, 'editor-draft.md'),
      newsroomRelPath(date, 'fact-check-report.json'),
      newsroomRelPath(date, 'fact-check-report.md'),
      newsroomRelPath(date, 'quality-report.json'),
      newsroomRelPath(date, 'quality-report.md'),
      newsroomRelPath(date, 'retry-history.json'),
      newsroomRelPath(date, 'retry-history.md'),
      newsroomRelPath(date, 'recovery-prompt.md'),
      newsroomRelPath(date, 'generation-status.json'),
      newsroomRelPath(date, '00-review-guide.md'),
      newsroomRelPath(date, 'release-qa-report.md'),
      newsroomRelPath(date, 'artifact-manifest.json')
    ],
    validateText: `${STATUS_FAILED_REPAIR_REVIEWABLE}: skipped public validation because repair failed after a valid editor draft.`,
    factCheck: fallbackFactCheck,
    qualityReport: fallbackQualityReport,
    runContext: {
      status: generationStatus.status,
      seedUsed: generationStatus.seed_used ?? generationStatus.candidate_input?.seed_used,
      publicOutputExpected: false
    }
  });

  console.warn(`Repair failed after a valid editor draft was created. Wrote reviewable ${STATUS_FAILED_REPAIR_REVIEWABLE} artifacts for ${date}.`);
  return {
    editor: fallbackEditor,
    factCheck: fallbackFactCheck,
    qualityReport: fallbackQualityReport,
    retryHistory: fallbackRetryHistory
  };
}

module.exports = {
  writeReviewableRepairFailureArtifacts
};
