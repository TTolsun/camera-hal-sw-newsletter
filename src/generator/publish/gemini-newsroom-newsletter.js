const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  kstDate,
  readJson,
  readTextIfExists,
  writeJson
} = require('../../shared/common/common');
const {
  collectedCandidatesRelPath,
  newsroomDir: artifactNewsroomDir,
  newsroomRelPath,
  seedEvidencePackPath
} = require('../../shared/common/artifact-paths');
const {
  CandidateArtifactValidationError,
  resolveCandidateInputArtifact
} = require('../../shared/common/candidate-artifacts');
const { readRuntimeConfig } = require('../../shared/common/runtime-config');
const {
  callLlmJson: callLlmJsonRaw,
  getLlmDiagnostics,
  getLlmModelUsage
} = require('../../shared/llm/llm-client');
const {
  reporterSchema,
  editorSchema,
  editorCompletionSchema,
  editorRepairPatchSchema,
  factCheckSchema,
  publicArticleJudgeSchema,
  backgroundContextSchema
} = require('../render/newsletter-schema');
const { isSafeExternalImageUrl } = require('../../shared/render/image-candidates');
const { resolveIssueArticleImages } = require('../render/article-image-resolver');
const {
  COMPOSITION_MODES,
  buildShortlistReport,
  normalizedUrlHash,
  reporterInputFromShortlist
} = require('../select/newsroom-selection');
const {
  candidateDuplicatesSections,
  normalizeTitle,
  protectedRepairFieldsMatch,
  protectedRepairSignature,
  sameSectionLabel,
  sameStringSet,
  sectionLabelKey,
  sectionRepairSignature,
  sectionSummary,
  sectionsAreDuplicate,
  signaturesMatch,
  sourceDateTitle,
  sourceUrlSignature,
  stableSectionKey,
  stableSectionKeySet,
  titleSimilarity,
  urlKeys
} = require('../../shared/common/section-identity');
const {
  pruneCatchUpFramingFactCheckItems,
  sanitizeClaimEvidenceIds,
  stampCoverageType,
  validateFactCheck
} = require('./fact-check-postprocess');
const { BUCKETS, BUCKET_PRIORITY } = require('../../shared/domain/aosp-camera-scope');
const {
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext
} = require('../select/article-capsules');
const {
  buildStaticBackgroundContextReport
} = require('../reporter/background-context');
const {
  annotateCandidatesWithCache,
  writeCacheRecord
} = require('../reporter/news-summary-cache');
const {
  normalizeReporterReport,
  normalizeShortlistReport,
  renderCandidateSelectionDiagnostics,
  selectionDiagnosticsFromReports
} = require('../select/selection-diagnostics');
const {
  roleFromStageLabel,
  createStageStatusTracker
} = require('../select/stage-status-tracker');
const {
  candidateGroupKey,
  groupCoverageSummary
} = require('../../shared/common/article-groups');
const {
  buildStaleClaimReportMarkdown,
  pruneResolvedStaleFactCheckItems,
  scrubStaleClaims
} = require('../quality/stale-claims');
const {
  articlePolicy,
  articleCountRangeText,
  qualityGatePolicy,
  publishGateCriteriaText,
  publishReadyCompositionPolicy
} = require('../../shared/common/newsletter-policy');
const {
  readExposureHistory,
  recordArticleExposure,
  recordNewsletterArticles,
  writeExposureHistory
} = require('../reporter/article-exposure-history');
const {
  buildDateReviewManifest,
  buildReviewArtifactInventory,
  renderReviewGuideMarkdown
} = require('./review-artifact-inventory');
const {
  writeHomepageHeadlineState
} = require('../reporter/homepage-headline');
const {
  renderedHeadlineState
} = require('../reporter/headline-render-reconciliation');
const {
  pruneResolvedFallbackImageFactCheckItems
} = require('../reporter/fact-check-repair');
const { classifyHalImpact } = require('../reporter/hal-impact-classifier');
const {
  failureStageFromError,
  failureClassFromError
} = require('./generation-failure-classification');
const {
  mergePublicArticleFromLlm
} = require('../reporter/public-article-contract');
const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown,
  deductionMatchesSection,
  hardBlockedGroupsForDroppedSections,
  salvagePublishableSubset
} = require('../quality/newsletter-quality');
const {
  assertSectionsAndSourcesPreserved,
  dropVerifiedFactsClassifiedAsNonFact,
  EditorSemanticValidationError,
  reconcileFactClaimEvidence,
  repairEditorOutputContract,
  serializeEditorValidationError,
  validateEditorOutputContract
} = require('../editor/editor-output-contract');
const {
  validateRenderedIssueStructure
} = require('../quality/rendered-issue-structure');
const {
  applyRepairPatches,
  REPAIR_PATCH_CONTRACT_VIOLATION
} = require('../repair/repair-patch-contract');
const {
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief,
  buildReleaseQaReport,
  issueTags,
  ensureArray
} = require('../render/newsletter-renderer');
const {
  buildReferenceArticles
} = require('../render/reference-articles');
const {
  writeWeeklyNewsletterArtifacts
} = require('../render/weekly-newsletter-output');
const {
  buildWeeklyMergeResolver
} = require('../editor/weekly-merge');
const {
  linkedEvidencePromptGuardrails,
  sourceExtractionPromptGuardrails,
  articleSectionContractPrompt,
  publicArticleContractPrompt,
  publicationBoundaryPrompt,
  publicArticleJudgePrompt,
  articleClaimContractPrompt,
  claimRepairEvidencePrompt,
  editorRepairPatchPrompt,
  factCheckSeverityPrompt,
  cameraDeveloperToolingFactCheckPrompt,
  articleQualityVerdictPrompt,
  dateFramingGuardrail,
  buildPromptContexts
} = require('../reporter/newsletter-prompts');
const {
  numberOrDefault,
  sectionLabel,
  cloneJson,
  fail
} = require('./orchestrator-shared-helpers');
const {
  reporterCandidateId,
  reporterTitleUrlKey,
  addReporterIndexEntry,
  buildReporterCandidateIndexes,
  reporterMergeWarning,
  uniqueStrings,
  mergeReporterEvidenceFields,
  reporterMatchFromIndex,
  matchReporterOutputCandidate
} = require('./orchestrator-reporter-match');
const {
  sourceCandidateForJudgeSection,
  publicArticleJudgeInput,
  normalizePublicArticleJudgeReport,
  publicArticleJudgeBlockingIssues,
  publicArticleJudgeError,
  publicArticleJudgeArtifactScope
} = require('./orchestrator-judge-helpers');
const {
  finalArticleSlotDistribution,
  deductionRepairPolicy,
  mergeRepairPolicies,
  recommendedFixMentionsSection,
  articleResultMatchesSection,
  articleResultForSection,
  buildSectionRepairPlan,
  buildFullSectionRepairPlan,
  sectionMatchesRepairItem,
  sectionsMatchingRepairPlan,
  sectionsOutsideRepairPlan,
  hasTooFewMainArticlesDeduction,
  completionRefillTargetCount
} = require('./orchestrator-repair-plan');
const {
  fallbackCategories,
  booleanFromCandidate,
  imageCandidatesForReporterCandidate,
  collectedCandidateFor,
  isReserveCandidate,
  validateReporter,
  enforceDeterministicReporterSelection,
  selectedReporterCapsules,
  reserveReporterCapsules,
  reporterCandidateCapsules,
  reporterImageCandidatesForSection,
  authoritativeImageProvenanceByUrl,
  restoreImageProvenance,
  isHttpsUrl,
  firstHttpsUrl,
  normalizeSectionImageFields,
  sourceCandidateMetadataForSection,
  normalizeEditorSection
} = require('./orchestrator-reporter-normalize');
const {
  classifyGenerationStatus,
  isEditorialReviewableStatus
} = require('./orchestrator-generation-status');
const {
  reviewPackageFactCheck,
  buildRunContext,
  backgroundContextStageEnabled,
  normalizeBackgroundContextReport,
  editorRenderedGroupKeys,
  editorExplicitlyDemotedGroups,
  buildRetryHistoryMarkdown,
  buildSelectionReport,
  validateMergedWeeklyArticle
} = require('./orchestrator-report-builders');
const {
  removeNewsletterIndexEntry
} = require('./public-state-reconciliation');
const {
  maybeHandleSelectionShortage,
  warnSelectionUnderfill,
  maybeFailOnSelectionErrors
} = require('./orchestrator-selection-preflight');
const targetedRepairModule = require('./orchestrator-targeted-repair');
const {
  targetedRepairError,
  remapRepairPatchSections,
  fallbackFactCheckForRepairFailure,
  validateCompletionSections
} = targetedRepairModule;
const {
  writeEditorDraftJson,
  writeCanonicalReviewArtifacts,
  writeReporterArtifactsForAttempt,
  writeNewsletterDate,
  writeGenerationStatus,
  writeCostReport,
  writeSummaryCacheReport
} = require('./orchestrator-artifact-writers');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);
const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
const sourceRegistryPath = path.join(root, 'src', 'shared', 'data', 'news-sources.json');
const STATUS_FAILED_REPAIR_REVIEWABLE = 'FAILED_REPAIR_REVIEWABLE';
const FAILURE_KIND_EDITORIAL_REVIEWABLE = 'editorial_reviewable';
const generationRunState = {
  date: '',
  retryHistory: [],
  currentQualityAttempt: 0,
  qualityReport: null,
  factCheck: null,
  shortlistReport: null,
  selectedInputs: [],
  lastKnownValidEditor: null,
  lastKnownValidReporter: null,
  lastKnownValidFactCheck: null,
  lastKnownValidQualityReport: null,
  lastKnownValidAttempt: 0,
  editorSemanticValidation: null,
  editorPublicArticleJudge: null,
  repairAttempted: false,
  repairSucceeded: false,
  candidateInput: null,
  stageTracker: createStageStatusTracker()
};

// callLlmJson 계측 래퍼 (#398). 모든 LLM 단계(reporter/editor/repair/factcheck/
// background-context/judge)가 이 한 지점을 통과하므로, 여기서 start/pass/fail만
// 기록하면 내부 시퀀스 전체가 잡힌다. 기록 전용이라 결과나 게이트 판정에 영향 없다.
async function callLlmJson(stage, ...args) {
  const role = roleFromStageLabel(stage);
  const attempt = generationRunState.currentQualityAttempt;
  generationRunState.stageTracker.start(role, attempt, stage);
  try {
    const result = await callLlmJsonRaw(stage, ...args);
    generationRunState.stageTracker.pass(role, attempt, stage);
    return result;
  } catch (error) {
    generationRunState.stageTracker.fail(role, attempt, stage, error && error.message);
    throw error;
  }
}

function writeDateReviewPackage({
  rootDir = root,
  date,
  files = [],
  validateText = '',
  factCheck = null,
  todoFound = false,
  emptySourceSections = [],
  qualityReport = null,
  runContext = {}
}) {
  const newsroomDir = artifactNewsroomDir(rootDir, date);
  fs.mkdirSync(newsroomDir, { recursive: true });
  const changedArtifacts = [...new Set([
    ...files.filter(Boolean),
    newsroomRelPath(date, '00-review-guide.md'),
    newsroomRelPath(date, 'release-qa-report.md'),
    newsroomRelPath(date, 'artifact-manifest.json')
  ])];
  const reviewGuidePath = path.join(newsroomDir, '00-review-guide.md');
  const releaseQaPath = path.join(newsroomDir, 'release-qa-report.md');
  const writeReviewGuide = inventory => {
    fs.writeFileSync(reviewGuidePath, renderReviewGuideMarkdown(inventory), 'utf8');
  };
  const writeReleaseQa = inventory => {
    fs.writeFileSync(releaseQaPath, buildReleaseQaReport(
      date,
      files,
      validateText,
      reviewPackageFactCheck(factCheck),
      todoFound,
      emptySourceSections,
      qualityReport,
      inventory
    ), 'utf8');
  };

  let inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReviewGuide(inventory);
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReleaseQa(inventory);
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReviewGuide(inventory);
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReleaseQa(inventory);
  const manifestPath = path.join(newsroomDir, 'artifact-manifest.json');
  writeJson(manifestPath, buildDateReviewManifest({ root: rootDir, date, changedArtifacts, runContext }));
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReviewGuide(inventory);
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReleaseQa(inventory);
  writeJson(manifestPath, buildDateReviewManifest({ root: rootDir, date, changedArtifacts, runContext }));
}

function readSeedEvidencePackForDate(date, rootDir = root) {
  const filePath = seedEvidencePackPath(rootDir, date);
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function buildGenerationStatus({
  date,
  status,
  failureStage = '',
  failureReason = '',
  failureClass = '',
  retryHistory = [],
  qualityReport = null,
  factCheck = null,
  extra = {}
}) {
  const diagnostics = getLlmDiagnostics();
  const mustFixCount = ensureArray(factCheck?.must_fix).length;
  const { run_context: extraRunContext, ...restExtra } = extra || {};
  return {
    date,
    status,
    failure_stage: failureStage,
    failure_reason: failureReason,
    failure_class: failureClass,
    fact_check_status: factCheck?.status || 'UNKNOWN',
    must_fix_count: mustFixCount,
    quality_status: qualityReport?.status || 'UNKNOWN',
    quality_attempt_count: retryHistory.length,
    quality_score: qualityReport?.score ?? null,
    quality_threshold: qualityReport?.threshold ?? qualityGatePolicy.threshold,
    quality_deduction_count: ensureArray(qualityReport?.deductions).length,
    stage_status_log: generationRunState.stageTracker.toLog(),
    quota_error_count: diagnostics.quota_error_count,
    invalid_json_count: diagnostics.invalid_json_count,
    model_usage: diagnostics.model_usage,
    model_routing: diagnostics.model_routing || {},
    candidate_input: restExtra.candidate_input || generationRunState.candidateInput || null,
    run_context: {
      ...buildRunContext(),
      ...(extraRunContext || {})
    },
    ...restExtra
  };
}

function recordEditorSemanticStatus(status = {}) {
  if (status.editor_semantic_validation != null) {
    generationRunState.editorSemanticValidation = status.editor_semantic_validation;
  }
  if (status.editor_public_article_judge != null) {
    generationRunState.editorPublicArticleJudge = status.editor_public_article_judge;
  }
  if ('repairAttempted' in status) {
    generationRunState.repairAttempted =
      generationRunState.repairAttempted || Boolean(status.repairAttempted);
  }
  if ('repairSucceeded' in status) {
    generationRunState.repairSucceeded =
      generationRunState.repairSucceeded || Boolean(status.repairSucceeded);
  }
}

function editorSemanticStatusExtra(error = null) {
  const editorSemanticValidation =
    error?.editorSemanticValidation ||
    generationRunState.editorSemanticValidation ||
    null;
  const repairAttempted =
    generationRunState.repairAttempted || Boolean(error?.repairAttempted);
  const repairSucceeded =
    generationRunState.repairSucceeded || Boolean(error?.repairSucceeded);
  return {
    editor_semantic_validation: editorSemanticValidation,
    editor_public_article_judge:
      error?.editorPublicArticleJudge ||
      generationRunState.editorPublicArticleJudge ||
      null,
    repairAttempted: Boolean(repairAttempted),
    repairSucceeded: Boolean(repairSucceeded)
  };
}

function selectionStatusExtra(shortlistReport = generationRunState.shortlistReport, options = {}) {
  const report = shortlistReport || {};
  const diagnostics = selectionDiagnosticsFromReports(report, null);
  const qualityArticleCount = generationRunState.qualityReport?.metrics?.article_count ?? null;
  const renderedMainArticleCount = options.renderedMainArticleCount ?? qualityArticleCount;
  const finalPublishReady = options.finalPublishReady ?? null;
  const selectionCompositionMode = report.selection_composition_mode || report.composition_mode || diagnostics.selection_composition_mode || diagnostics.composition_mode || null;
  const compositionMode = options.compositionMode || selectionCompositionMode;
  const editorReviewRequired = options.editorReviewRequired ?? report.editor_review_required ?? diagnostics.editor_review_required ?? compositionMode !== COMPOSITION_MODES.NORMAL;
  const compositionSummary = report.composition_summary || diagnostics.composition_summary || {};
  const eligibleCompositionSummary = report.eligible_composition_summary || {};
  const selectedArticleCount = report.selected_article_count ?? diagnostics.final_selected_article_count ?? null;
  const nonFallbackReviewableCount = compositionSummary.non_fallback_reviewable_article_count ?? null;
  const primaryCameraStackTopicCount = compositionSummary.primary_camera_stack_topic_count ?? null;
  const supportingMainArticleCount = compositionSummary.supporting_main_article_count ?? null;
  const forbiddenMainArticleCount = compositionSummary.forbidden_main_article_count ?? null;
  const directAospCameraOrDriverCount = Number(compositionSummary.direct_aosp_camera_count ?? 0) +
    Number(compositionSummary.camera_driver_image_pipeline_count ?? 0);
  const selectionPolicy = report.selection_policy || {};
  const minFinalArticles = report.min_final_articles ?? selectionPolicy.min_final_articles ?? articlePolicy.mainArticleCount.min;
  const maxFinalArticles = selectionPolicy.max_final_articles ?? articlePolicy.mainArticleCount.max;
  const absoluteMinReviewable = report.absolute_min_reviewable_articles ??
    selectionPolicy.absolute_min_reviewable_articles ??
    articlePolicy.primaryCameraStack.minRequired;
  const minNonFallbackPublishReady = report.min_non_fallback_publish_ready_articles ??
    selectionPolicy.min_non_fallback_publish_ready_articles ??
    articlePolicy.primaryCameraStack.minRequired;
  const reviewGatePassed = report.review_gate_passed ?? (
    Number(selectedArticleCount) >= minFinalArticles &&
    Number(selectedArticleCount) <= maxFinalArticles &&
    Number(primaryCameraStackTopicCount) >= articlePolicy.primaryCameraStack.minRequired &&
    Number(forbiddenMainArticleCount) === 0
  );
  const selectionPublishGatePassed = report.publish_gate_passed ?? (
    Number(selectedArticleCount) >= minFinalArticles &&
    Number(selectedArticleCount) <= maxFinalArticles &&
    Number(primaryCameraStackTopicCount) >= publishReadyCompositionPolicy.primaryCameraStackMinRequired &&
    Number(directAospCameraOrDriverCount) >= publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired &&
    Number(supportingMainArticleCount) <= publishReadyCompositionPolicy.supportingMainMaxAllowed &&
    Number(forbiddenMainArticleCount) === 0 &&
    Number(primaryCameraStackTopicCount) + Number(supportingMainArticleCount) === Number(selectedArticleCount)
  );
  const publishGatePassed = options.publishGatePassed ?? selectionPublishGatePassed;
  const selectedGroupKeys = ensureArray(options.selectedGroupKeys).length > 0
    ? ensureArray(options.selectedGroupKeys)
    : ensureArray(report.selected_representative_group_keys).length > 0
      ? ensureArray(report.selected_representative_group_keys)
      : ensureArray(report.selected_articles).map(candidateGroupKey).filter(Boolean);
  const renderedGroupKeys = ensureArray(options.renderedGroupKeys).length > 0
    ? ensureArray(options.renderedGroupKeys)
    : ensureArray(report.rendered_group_keys);
  const hasRenderedGroupObservation = options.renderedGroupKeys !== undefined ||
    ensureArray(report.rendered_group_keys).length > 0;
  const explicitlyDemotedGroups = ensureArray(options.explicitlyDemotedGroups).length > 0
    ? ensureArray(options.explicitlyDemotedGroups)
    : ensureArray(report.explicitly_demoted_group_keys).map(key => ({ article_group_key: key, demotion_reason: 'status' }));
  const hardBlockedGroups = ensureArray(options.hardBlockedGroups).length > 0
    ? ensureArray(options.hardBlockedGroups)
    : ensureArray(report.hard_blocked_group_keys).map(key => ({ article_group_key: key, hard_block_reason: 'status' }));
  const groupCoverage = groupCoverageSummary({
    selectedGroupKeys,
    renderedGroupKeys,
    demotedGroups: explicitlyDemotedGroups,
    hardBlockedGroups
  });
  return {
    input_candidate_count: report.input_candidate_count ?? null,
    eligible_candidate_count: report.eligible_candidate_count ?? null,
    selected_article_count: selectedArticleCount,
    deterministic_selected_count: diagnostics.deterministic_selected_count ?? report.deterministic_selected_count ?? report.selected_article_count ?? null,
    rendered_main_article_count: renderedMainArticleCount,
    selected_group_count: groupCoverage.selected_group_count,
    rendered_group_count: hasRenderedGroupObservation ? groupCoverage.rendered_group_count : report.rendered_group_count ?? null,
    explicitly_demoted_group_count: groupCoverage.explicitly_demoted_group_count,
    hard_blocked_group_count: groupCoverage.hard_blocked_group_count,
    selected_representative_group_keys: groupCoverage.selected_representative_group_keys,
    rendered_group_keys: groupCoverage.rendered_group_keys,
    explicitly_demoted_group_keys: groupCoverage.explicitly_demoted_group_keys,
    hard_blocked_group_keys: groupCoverage.hard_blocked_group_keys,
    group_coverage_ok: hasRenderedGroupObservation ? groupCoverage.ok : null,
    reserve_candidate_count: diagnostics.reserve_candidate_count ?? report.reserve_candidate_count ?? null,
    demoted_article_count: options.demotedArticleCount ?? diagnostics.demoted_candidate_count ?? report.demoted_candidate_count ?? null,
    locked_article_count: options.lockedArticleCount ?? null,
    fallback_topic_count: compositionSummary.fallback_topic_count ?? ensureArray(report.selected_articles).filter(candidate =>
      ['soc_platform_signal', 'cpp_ai_tooling_fallback'].includes(candidate.relevance_bucket)
    ).length,
    reporter_candidate_count: diagnostics.reporter_candidate_count,
    reporter_selected_count: diagnostics.reporter_selected_count,
    final_input_candidate_count: diagnostics.final_input_candidate_count,
    final_eligible_candidate_count: diagnostics.final_eligible_candidate_count,
    final_selected_article_count: diagnostics.final_selected_article_count,
    reporter_selected_but_final_excluded_count: diagnostics.reporter_selected_but_final_excluded_count,
    ai_selected_article_count: report.ai_selected_article_count ?? null,
    underfilled: Boolean(report.underfilled),
    publish_ready: report.publish_ready !== undefined ? Boolean(report.publish_ready) : null,
    selection_publish_ready: report.publish_ready !== undefined ? Boolean(report.publish_ready) : null,
    final_publish_ready: finalPublishReady,
    review_gate_passed: Boolean(reviewGatePassed),
    publish_gate_passed: Boolean(publishGatePassed),
    min_final_articles: minFinalArticles,
    max_final_articles: maxFinalArticles,
    absolute_min_reviewable_articles: absoluteMinReviewable,
    min_non_fallback_publish_ready_articles: minNonFallbackPublishReady,
    composition_mode: compositionMode,
    publish_mode: report.publish_mode ?? diagnostics.publish_mode ?? null,
    publish_mode_detail: report.publish_mode_detail ?? diagnostics.publish_mode_detail ?? null,
    selection_composition_mode: selectionCompositionMode,
    composition_reason: options.compositionReason || report.composition_reason || diagnostics.composition_reason || '',
    composition_summary: compositionSummary,
    eligible_composition_summary: eligibleCompositionSummary,
    candidate_pool_preflight_passed: report.candidate_pool_preflight_passed !== false,
    candidate_shortage_reviewable: report.candidate_shortage_reviewable === true,
    candidate_shortage_summary: report.candidate_shortage_summary || null,
    shortage_reason_codes: ensureArray(report.shortage_reason_codes),
    publish_gate_reason_codes: ensureArray(report.publish_gate_reason_codes),
    publish_gate_reason_summary: ensureArray(report.publish_gate_reason_summary),
    publish_ready_composition_policy: report.publish_ready_composition_policy || report.selection_policy?.publish_ready_composition || null,
    source_parser_hints: ensureArray(report.source_parser_hints),
    editor_review_required: Boolean(editorReviewRequired),
    non_fallback_reviewable_article_count: compositionSummary.non_fallback_reviewable_article_count ?? null,
    eligible_non_fallback_reviewable_article_count: eligibleCompositionSummary.non_fallback_reviewable_article_count ?? null,
    primary_camera_stack_topic_count: primaryCameraStackTopicCount,
    supporting_main_article_count: supportingMainArticleCount,
    forbidden_main_article_count: forbiddenMainArticleCount,
    direct_aosp_camera_count: compositionSummary.direct_aosp_camera_count ?? null,
    camera_driver_image_pipeline_count: compositionSummary.camera_driver_image_pipeline_count ?? null,
    android_platform_camera_adjacent_count: compositionSummary.android_platform_camera_adjacent_count ?? null,
    android_multimedia_camera_output_count: compositionSummary.android_multimedia_camera_output_count ?? null,
    soc_platform_signal_count: compositionSummary.soc_platform_signal_count ?? ensureArray(report.selected_articles).filter(candidate =>
      candidate.relevance_bucket === 'soc_platform_signal'
    ).length,
    cpp_ai_tooling_fallback_count: compositionSummary.cpp_ai_tooling_fallback_count ?? null,
    generic_tech_watchlist_count: compositionSummary.generic_tech_watchlist_count ?? null,
    selection_warnings: ensureArray(report.selection_warnings),
    selection_errors: ensureArray(report.selection_errors),
    selection_shortage_hints: ensureArray(report.selection_shortage_hints),
    headline_decision: report.headline_decision || diagnostics.headline_decision || null,
    headline_latest_inclusion: report.headline_latest_inclusion || diagnostics.headline_latest_inclusion || null,
    removed_due_to_headline_inclusion: ensureArray(report.removed_due_to_headline_inclusion || diagnostics.removed_due_to_headline_inclusion),
    article_exposure_coverage: report.article_exposure_coverage || diagnostics.article_exposure_coverage || null,
    exclusion_reason_summary: ensureArray(report.exclusion_reason_summary).slice(0, 10),
    final_exclusion_reason_summary: ensureArray(diagnostics.final_exclusion_reason_summary).slice(0, 10),
    candidate_selection_note: diagnostics.note
  };
}

async function buildBackgroundContextReport({ date, articleCapsuleReport, commonContext, stage }) {
  const fallbackReport = buildStaticBackgroundContextReport(date, articleCapsuleReport);
  if (!backgroundContextStageEnabled()) return fallbackReport;
  try {
    const result = await callLlmJson(
      stage,
      [
        'AOSP Camera / Driver / SoC Platform Newsletter의 optional background context를 생성합니다.',
        '한국어 technical background만 반환하세요. web browsing은 하지 마세요.',
        '제공된 article capsules와 Android Camera, CameraX, Camera2, Camera HAL, libcamera, V4L2, SoC, native build/test/debug workflows에 대한 model knowledge만 사용하세요.',
        'raw source table text, UI fragments, release table dumps, source snippets를 background_context에 복사하지 마세요.',
        'title, url, source_candidate_hash는 제공된 article capsule 또는 static fallback item에서 정확히 보존하세요.',
        'background_basis는 context가 external source lookup이 아니라 supplied capsule metadata와 model knowledge에 기반했음을 설명해야 합니다.',
        'background_sources_used는 출력하지 마세요. 대신 background_basis를 사용하세요.',
        'background_context는 what_changed와 구분하고, HAL/driver 영향성은 source facts가 직접 뒷받침하는 범위로만 설명하세요.',
        'Jetpack Compose, Jetpack Navigation 3, CameraX-adjacent, Android adaptive UI capsule은 Android UI/platform 개념 배경을 간단히 설명하고 camera preview/capture UX 검증과 연결하세요. direct HAL change로 승격하지 마세요.',
        'schema와 일치하는 JSON만 반환하세요.'
      ].join('\n'),
      `${commonContext}\n\nArticle capsule context JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, 'selected'), null, 2)}\n\nStatic fallback background context JSON:\n${JSON.stringify(fallbackReport, null, 2)}`,
      backgroundContextSchema
    );
    const normalized = normalizeBackgroundContextReport(result, date, fallbackReport);
    if (ensureArray(normalized.background_contexts).length > 0) return normalized;
  } catch (error) {
    console.warn(`Gemini background-context stage failed; using deterministic static background: ${error.message}`);
  }
  return {
    ...fallbackReport,
    stage: 'static-fallback-after-background-context-error',
    background_context_error: 'gemini background-context stage unavailable'
  };
}

function currentPublishMode(shortlistReport = generationRunState.shortlistReport) {
  return (shortlistReport && shortlistReport.publish_mode) || 'DEEP';
}

function validateEditor(value, date, reporter = { candidates: [] }, options = {}) {
  return validateEditorOutputContract(value, date, {
    reporter,
    normalizeSection: (section, index) => normalizeEditorSection(section, index, reporter),
    strictClaims: options.strictClaims === true,
    requireStoryContract: options.requireStoryContract === true,
    seedEvidencePack: options.seedEvidencePack || null,
    publishMode: options.publishMode || currentPublishMode()
  });
}

// targeted-repair 모듈의 두 함수는 publish-mode(generationRunState)에 결합된 validateEditor를
// 주입받아야 한다. orchestrator에서 validateEditor와 generationRunState.date 기본값을 바인딩한
// 얇은 래퍼로 노출해, 기존 호출처(production·test)의 시그니처를 그대로 유지한다(#655).
function validateTargetedRepairResult(args = {}) {
  return targetedRepairModule.validateTargetedRepairResult({ date: generationRunState.date, ...args, validateEditor });
}

function applyRepairPatchesAndValidate(args = {}) {
  return targetedRepairModule.applyRepairPatchesAndValidate({ date: generationRunState.date, ...args, validateEditor });
}

const {
  editorRequestsStoryContract,
  buildEditorRetryContract,
  assertEditorRetryOutputContract
} = require('./orchestrator-editor-retry-contract');

function recordLastKnownValidEditor(editor, {
  date,
  reporter = { candidates: [] },
  factCheck = null,
  qualityReport = null,
  attempt = 0,
  strictClaims = true,
  requireStoryContract = false,
  seedEvidencePack = null
} = {}) {
  const validated = validateEditor(cloneJson(editor), date, reporter, {
    strictClaims,
    requireStoryContract,
    seedEvidencePack
  });
  generationRunState.lastKnownValidEditor = cloneJson(validated);
  generationRunState.lastKnownValidReporter = cloneJson(reporter);
  generationRunState.lastKnownValidFactCheck = cloneJson(factCheck);
  generationRunState.lastKnownValidQualityReport = cloneJson(qualityReport);
  generationRunState.lastKnownValidAttempt = attempt;
  return validated;
}


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

async function repairEditorSemanticWithLlm({
  date,
  editorStage,
  commonContext,
  lockedContext,
  reporter,
  articleCapsuleReport,
  seedEvidencePack = null,
  invalidEditor,
  validationError
}) {
  const beforeSectionCount = ensureArray(invalidEditor?.sections).length;
  return callLlmJson(
    `${editorStage} semantic repair`,
    [
      'AOSP Camera / Driver / SoC Platform Newsletter editor JSON draft를 repair하세요.',
      '같은 schema와 일치하는 complete editor JSON object 하나를 반환하세요.',
      'Editor semantic validation error JSON에 표시된 validation error만 수정하세요.',
      'Validation repair에 필요한 local edit가 아니면 한국어 reader-facing prose를 보존하세요. 새로 쓰는 reader-facing text는 반드시 한국어여야 합니다.',
      `현재 editor draft는 정확히 ${beforeSectionCount}개의 main sections를 가집니다. Repaired output도 동일한 sections 수를 같은 순서로 유지하세요.`,
      'Section을 추가, 제거, 합치기, 분할, 재정렬, 교체하지 마세요. Validation error가 명시한 field만 in-place로 수정하세요.',
      'Validation error가 명시적으로 해당 field를 가리키지 않으면 article headline, category, source URL, image field, action_items, references를 변경하지 마세요.',
      claimRepairEvidencePrompt(),
      'sections.group_coverage failure는 missing selected representative group을 selected capsule만 사용해 article로 복구하세요. 해당 group을 render할 수 없으면 article_group_key, reason_code, reason text를 포함해 explicitly_demoted_groups[] 또는 hard_blocked_groups[]에 기록하세요.',
      'sections.blocked_context failure는 article sources와 headline에서 blocked context URL/title을 제거하세요. Blocked context는 diagnostic context로만 남길 수 있습니다.',
      'sections.claims failure는 source-backed article_sections.verified_facts[]의 각 항목마다 matching claim_type=fact claim이 있도록 claims를 추가하거나 조정하세요. (confirmed_facts / evidence_summary는 claim 바인딩 대상이 아닙니다.)',
      'validation error JSON의 details.issues[].uncovered_facts[](article_index/field/text)와 deterministic_repair_failure_reason_codes를 먼저 읽고, 그 verified_fact에만 정확히 대응하는 claim_type=fact claim을 추가하세요. 목록에 없는 fact나 section은 건드리지 말고, 새 fact·evidence_id·source URL은 만들지 마세요.',
      'Claim repair에는 허용된 claim_type과 impact_level 값만 사용하세요. 직접 HAL contract를 뒷받침하는 근거가 없으면 CameraX/adaptive UI impact는 app_api_or_framework_adjacent로 매핑하세요.',
      'briefing failure는 briefing을 정확히 3개 item으로 고치고 draft의 나머지는 보존하세요.',
      'Source fact 또는 source material을 만들지 마세요.',
      'Schema-compliant JSON만 반환하세요.'
    ].join('\n'),
    [
      commonContext,
      lockedContext,
      `Primary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter || { candidates: [] }, articleCapsuleReport, { seedEvidencePack }), null, 2)}`,
      `Editor semantic validation error JSON:\n${JSON.stringify(validationError, null, 2)}`,
      `Invalid editor draft JSON:\n${JSON.stringify(invalidEditor, null, 2)}`
    ].filter(Boolean).join('\n\n'),
    editorSchema
  );
}

function writePublicArticleJudgeArtifact(newsroomDir, attempt, phase, report, error = null, stage = '') {
  if (!newsroomDir) return;
  const scope = publicArticleJudgeArtifactScope(stage);
  const baseSuffix = phase === 'repair' ? `repair-attempt-${attempt}` : `attempt-${attempt}`;
  const suffix = scope === 'editor' ? baseSuffix : `${scope}-${baseSuffix}`;
  writeJson(path.join(newsroomDir, `editor-public-article-judge-${suffix}.json`), report);
  if (error) {
    writeJson(path.join(newsroomDir, `editor-public-article-judge-error-${suffix}.json`), serializeEditorValidationError(error, {
      stage: error.stage || '',
      attempt
    }));
  }
}

async function runPublicArticleJudge({ date, editor, reporter, stage, attempt, newsroomDir, phase = 'attempt' }) {
  const rawReport = await callLlmJson(
    stage,
    publicArticleJudgePrompt(),
    `Public article judge input JSON:\n${JSON.stringify(publicArticleJudgeInput(date, editor, reporter), null, 2)}`,
    publicArticleJudgeSchema
  );
  const report = normalizePublicArticleJudgeReport(rawReport, editor, date);
  const blockingIssues = publicArticleJudgeBlockingIssues(report);
  if (blockingIssues.length === 0) {
    writePublicArticleJudgeArtifact(newsroomDir, attempt, phase, report, null, stage);
    recordEditorSemanticStatus({ editor_public_article_judge: report });
    return { ok: true, report };
  }
  const error = publicArticleJudgeError(report, stage, attempt, phase);
  writePublicArticleJudgeArtifact(newsroomDir, attempt, phase, report, error, stage);
  return { ok: false, report, error };
}

async function validatePublicArticleJudgeOrRepair({
  date,
  editor,
  reporter,
  attempt,
  editorStage,
  commonContext,
  lockedContext,
  newsroomDir
}) {
  const judgeStage = `${editorStage} public article judge`;
  const initialJudge = await runPublicArticleJudge({
    date,
    editor,
    reporter,
    stage: judgeStage,
    attempt,
    newsroomDir,
    phase: 'attempt'
  });
  if (initialJudge.ok) return editor;

  const initialDetails = serializeEditorValidationError(initialJudge.error, {
    stage: judgeStage,
    attempt,
    repairAttempted: false,
    repairSucceeded: false
  });
  let repairedRaw;
  try {
    repairedRaw = await repairEditorSemanticWithLlm({
      date,
      editorStage,
      commonContext,
      lockedContext,
      invalidEditor: cloneJson(editor),
      validationError: initialDetails
    });
    const repairedEditor = validateEditor(repairedRaw, date, reporter, {
      strictClaims: true,
      requireStoryContract: true
    });
    assertSectionsAndSourcesPreserved(editor, repairedRaw);
    const repairedJudge = await runPublicArticleJudge({
      date,
      editor: repairedEditor,
      reporter,
      stage: `${editorStage} public article judge repair`,
      attempt,
      newsroomDir,
      phase: 'repair'
    });
    if (repairedJudge.ok) {
      recordEditorSemanticStatus({
        editor_semantic_validation: initialDetails,
        editor_public_article_judge: repairedJudge.report,
        repairAttempted: true,
        repairSucceeded: true
      });
      return repairedEditor;
    }
    throw repairedJudge.error;
  } catch (repairError) {
    const semanticRepairError = repairError instanceof EditorSemanticValidationError
      ? repairError
      : new EditorSemanticValidationError(`Public article judge repair failed: ${repairError.message}`, {
        field: 'sections.public_article',
        cause: repairError.message,
        sectionCount: Array.isArray(repairedRaw?.sections) ? repairedRaw.sections.length : null,
        initial: initialDetails
      });
    const repairDetails = {
      ...serializeEditorValidationError(semanticRepairError),
      stage: `${editorStage} public article judge repair`,
      attempt,
      initial: initialDetails
    };
    recordEditorSemanticStatus({
      editor_semantic_validation: repairDetails,
      editor_public_article_judge: semanticRepairError.editorPublicArticleJudge || initialJudge.report,
      repairAttempted: true,
      repairSucceeded: false
    });
    semanticRepairError.editorSemanticValidation = repairDetails;
    semanticRepairError.editorPublicArticleJudge = semanticRepairError.editorPublicArticleJudge || initialJudge.report;
    semanticRepairError.repairAttempted = true;
    semanticRepairError.repairSucceeded = false;
    throw semanticRepairError;
  }
}

async function validateOrRepairEditor(value, {
  date,
  reporter,
  attempt,
  editorStage,
  commonContext,
  lockedContext,
  newsroomDir,
  articleCapsuleReport = null,
  seedEvidencePack = null,
  publishMode = currentPublishMode()
}) {
  // editor LLM이 일부 fact claim에 capsule이 제공한 evidence_id/source_urls를 빠뜨려도(부분 누락),
  // 그 정보는 candidate의 allowed_claim_evidence에 있으므로 claim binding 검증 전에 결정론적으로
  // 재바인딩한다. 그러지 않으면 reconcile가 검증 이후(#502 지점)에 돌아, 복구 가능한 evidence_id
  // 누락이 editor 단계에서 먼저 hard-fail해 발행 가능한 draft가 통째로 막힌다. reconcile는 strict
  // 오라클이 evidence가 claim을 실제 뒷받침한다고 확인할 때만 채우므로(없던 근거를 만들지 않음)
  // 게이트 약화가 아니다.
  value = reconcileFactClaimEvidence(value, { reporter, seedEvidencePack });
  const result = await repairEditorOutputContract({
    value,
    date,
    reporter,
    attempt,
    stage: editorStage,
    newsroomDir,
    strictClaims: true,
    requireStoryContract: true,
    publishMode,
    seedEvidencePack,
    normalizeSection: (section, index) => normalizeEditorSection(section, index, reporter),
    repairFn: async ({ invalidEditor, validationError }) => repairEditorSemanticWithLlm({
      date,
      editorStage,
      commonContext,
      lockedContext,
      reporter,
      articleCapsuleReport,
      seedEvidencePack,
      invalidEditor,
      validationError
    })
  });
  recordEditorSemanticStatus(result);
  return validatePublicArticleJudgeOrRepair({
    date,
    editor: result.editor,
    reporter,
    attempt,
    editorStage,
    commonContext,
    lockedContext,
    newsroomDir
  });
}

function containsTodo(files) {
  return files.some(file => fs.existsSync(file) && /\bTODO\b/.test(fs.readFileSync(file, 'utf8')));
}

function updateNewsletterData(date, issue) {
  const entry = {
    date,
    title: issue.title,
    summary: issue.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: issueTags(issue)
  };

  const newsletters = fs.existsSync(dataPath) ? readJson(dataPath) : [];
  const updated = newsletters
    .filter(item => item.date !== date)
    .concat(entry)
    .sort((a, b) => b.date.localeCompare(a.date));
  writeJson(dataPath, updated);
}

function persistHeadlineStateArtifacts({ date, shortlistReport, shouldWritePublicArtifacts, editor }) {
  if (!shouldWritePublicArtifacts || !shortlistReport?.homepage_headline_state) {
    return { files: [], exposureCoverage: shortlistReport?.article_exposure_coverage || null };
  }
  const files = [];
  // persist/validate 전에 헤드라인을 방금 렌더된 공개 이슈에 맞춰 reconcile한다.
  // article anchor는 실행마다 달라지는 영문 헤드라인에서 파생되므로, retained 헤드라인의
  // newsletter_article_url anchor가 이번 render에 없을 수 있고 validate:site는 그 anchor를 요구한다.
  // ensure-public-newsletter-artifacts가 이후 동일하게 reconcile(멱등)하지만,
  // generate가 먼저 해야 자체 validate:site가 일관된 상태를 본다.
  const reconciled = renderedHeadlineState({
    root,
    date,
    state: shortlistReport.homepage_headline_state,
    shortlist: shortlistReport
  });
  const state = reconciled.state;
  shortlistReport.homepage_headline_state = state;
  if (reconciled.reconciliation?.applied) {
    shortlistReport.headline_public_render_reconciliation = reconciled.reconciliation;
    shortlistReport.headline_decision = {
      ...(shortlistReport.headline_decision || {}),
      public_rendered_headline_key: reconciled.reconciliation.rendered_headline_key,
      public_render_reconciled: true,
      public_render_reconciliation_reason: reconciled.reconciliation.reason
    };
  }
  const headlinePath = writeHomepageHeadlineState(root, state);
  files.push(path.relative(root, headlinePath).replace(/\\/g, '/'));

  let history = readExposureHistory(root, date);
  if (state.current_headline) {
    history = recordArticleExposure(history, state.current_headline, {
      date,
      type: 'homepage_headline',
      score: state.current_headline.current_score,
      reuseReason: shortlistReport.headline_decision?.reason || shortlistReport.headline_decision?.decision || '',
      newsletterUrl: state.current_headline.newsletter_url
    });
  }
  const sections = ensureArray(editor?.sections);
  if (sections.length > 0) {
    history = recordNewsletterArticles(history, sections, {
      date,
      newsletterUrl: `newsletters/${date}/index.html`,
      cooldownDays: 21
    });
  }
  const historyPath = writeExposureHistory(root, history);
  files.push(path.relative(root, historyPath).replace(/\\/g, '/'));
  shortlistReport.article_exposure_coverage = history.coverage;
  return { files, exposureCoverage: history.coverage };
}

function assertJsonArtifactsReadable(filePaths) {
  for (const filePath of filePaths) {
    readJson(filePath);
  }
}

function assertTerminalPublicationContracts({
  date,
  editor,
  markdown,
  html,
  newsroomDir,
  shortlistReport,
  qualityReport,
  factCheck
}) {
  const result = validateRenderedIssueStructure({ date, editor, markdown, html, root });
  if (result.ok) return;

  if (newsroomDir) {
    writeRecoveryPrompt(newsroomDir, {
      date,
      stage: 'structural validation',
      reason: `Terminal structural validation failed:\n${result.text}`,
      shortlistReport,
      selectedInputs: ensureArray(shortlistReport?.selected_articles),
      qualityReport,
      factCheck
    });
  }
  fail(`Terminal structural validation failed:\n${result.text}`);
}

function runNpmScript(scriptName) {
  const options = {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  };
  if (process.platform === 'win32') {
    return execFileSync('cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${scriptName}`], options);
  }
  return execFileSync('npm', ['run', scriptName], options);
}

function runValidate() {
  try {
    const siteOutput = runNpmScript('validate:site');
    const imageOutput = runNpmScript('validate:images');
    const output = [siteOutput, imageOutput].join('\n').trim();
    return { ok: true, text: output || 'npm run validate:site and validate:images passed.' };
  } catch (error) {
    return {
      ok: false,
      text: [error.stdout, error.stderr].filter(Boolean).join('\n').trim() || error.message
    };
  }
}

function warnResolvedImageFallbacks(issue) {
  for (const section of ensureArray(issue.sections)) {
    const resolved = section.resolvedImage || {};
    if (!resolved.usedFallback) continue;
    console.warn([
      'Warning: article image fallback applied',
      `  section: ${section.category || 'unknown section'}`,
      `  article: ${section.headline || 'unknown article'}`,
      `  original: ${resolved.originalUrl || resolved.originalSrc || section.originalImage || 'n/a'}`,
      `  fallback: ${resolved.url || resolved.src}`,
      `  reason: ${resolved.reason || 'unknown'}`
    ].join('\n'));
  }
}

const {
  candidateDuplicateReason,
  retryRejectionRecord,
  reserveUsageForSections,
  candidatesForSections,
  removeDisallowedSelections,
  mergeLockedSections,
  sectionLockRecord,
  buildLockedArticleContext,
  lockedArticleHeadlines,
  selectLockedArticles,
  appendUniqueLockedArticles,
  appendUniqueSections,
  sourceGapSections,
  reporterEligibilityFindings,
  applyReporterEligibilityFindingsToFactCheck
} = require('./orchestrator-section-locking');

function pruneResolvedFallbackImageFalsePositives(factCheck, editor) {
  const result = pruneResolvedFallbackImageFactCheckItems(factCheck, editor, { root });
  if (result.removed.length > 0) {
    console.warn(`Pruned ${result.removed.length} resolved fallback image fact-check false positive(s).`);
  }
  return result.factCheck;
}

const {
  availableCompletionCandidates,
  buildCompletionExclusionContext
} = require('./orchestrator-completion');

function writeRecoveryPrompt(newsroomDir, context = {}) {
  fs.mkdirSync(newsroomDir, { recursive: true });
  const date = context.date || generationRunState.date || runtimeConfig.newsletterDate || kstDate();
  const shortlist = context.shortlistReport || generationRunState.shortlistReport || null;
  const selectionDiagnostics = selectionStatusExtra(shortlist);
  const selectionDiagnosticsMarkdown = renderCandidateSelectionDiagnostics(selectionDiagnostics);
  const lines = [
    `# 복구 프롬프트 - ${date}`,
    '',
    'newsroom automation이 publication readiness 전에 멈췄습니다. 아래 artifact를 사용해 diagnostics를 잃지 않고 수정하거나 다시 실행합니다.',
    '',
    '## 실패',
    '',
    `- 단계: ${context.stage || 'generation'}`,
    `- 사유: ${context.reason || 'Unknown failure.'}`,
    '',
    selectionDiagnosticsMarkdown,
    '',
    '## Deterministic Final Selection 상태',
    '',
    `- Final input candidate: ${selectionDiagnostics.final_input_candidate_count ?? selectionDiagnostics.input_candidate_count ?? 'unknown'}`,
    `- Final eligible candidate: ${selectionDiagnostics.final_eligible_candidate_count ?? selectionDiagnostics.eligible_candidate_count ?? 'unknown'}`,
    `- Final selected article: ${selectionDiagnostics.final_selected_article_count ?? selectionDiagnostics.selected_article_count ?? 'unknown'}`,
    `- Deterministic primary article: ${selectionDiagnostics.deterministic_selected_count ?? 'unknown'}`,
    `- Reserve candidate: ${selectionDiagnostics.reserve_candidate_count ?? 'unknown'}`,
    `- Demoted candidate: ${selectionDiagnostics.demoted_article_count ?? selectionDiagnostics.demoted_candidate_count ?? 'unknown'}`,
    `- AI selected input: ${selectionDiagnostics.ai_selected_article_count ?? 'unknown'}`,
    `- Publish ready: ${selectionDiagnostics.publish_ready ?? 'unknown'}`,
    `- Underfilled: ${selectionDiagnostics.underfilled}`,
    `- Selection warning: ${selectionDiagnostics.selection_warnings.join('; ') || '없음'}`,
    `- Selection error: ${selectionDiagnostics.selection_errors.join('; ') || '없음'}`,
    `- direct_aosp_camera: ${selectionDiagnostics.direct_aosp_camera_count ?? 'unknown'}`,
    `- android_platform_camera_adjacent: ${selectionDiagnostics.android_platform_camera_adjacent_count ?? 'unknown'}`,
    `- camera_driver_image_pipeline: ${selectionDiagnostics.camera_driver_image_pipeline_count ?? 'unknown'}`,
    `- android_multimedia_camera_output: ${selectionDiagnostics.android_multimedia_camera_output_count ?? 'unknown'}`,
    `- soc_platform_signal: ${selectionDiagnostics.soc_platform_signal_count ?? 'unknown'}`,
    `- cpp_ai_tooling_fallback: ${selectionDiagnostics.cpp_ai_tooling_fallback_count ?? 'unknown'}`,
    `- Non-fallback reviewable: ${selectionDiagnostics.non_fallback_reviewable_article_count ?? 'unknown'}`,
    `- Source/parser hint: ${selectionDiagnostics.selection_shortage_hints.join('; ') || 'none'}`,
    `- 주요 final exclusion reason: ${selectionDiagnostics.final_exclusion_reason_summary.map(item => `${item.reason} (${item.count})`).join('; ') || '없음'}`,
    '',
    '## 다시 실행',
    '',
    '```powershell',
    `$env:NEWSLETTER_DATE="${date}"`,
    'npm.cmd run generate',
    'npm.cmd run validate',
    '```',
    '',
    '## Shortlist',
    '',
    '```json',
    JSON.stringify(shortlist, null, 2),
    '```',
    '',
    '## Selected Input',
    '',
    '```json',
    JSON.stringify(context.selectedInputs || generationRunState.selectedInputs || [], null, 2),
    '```',
    '',
    '## 실패 Section',
    '',
    '```json',
    JSON.stringify(context.failedSections || [], null, 2),
    '```',
    '',
    '## 품질 감점',
    '',
    '```json',
    JSON.stringify(ensureArray((context.qualityReport || generationRunState.qualityReport)?.deductions), null, 2),
    '```',
    '',
    '## Fact-check 결과',
    '',
    '```json',
    JSON.stringify(context.factCheck || generationRunState.factCheck || null, null, 2),
    '```',
    '',
    '## Artifact 체크리스트',
    '',
    `- ${newsroomRelPath(date, 'shortlisted-candidates.json')}`,
    `- ${newsroomRelPath(date, 'article-capsules.json')}`,
    `- ${newsroomRelPath(date, 'background-context.json')}`,
    `- ${newsroomRelPath(date, 'reporter-candidates.json')}`,
    `- ${newsroomRelPath(date, 'editor-draft.json')}`,
    `- ${newsroomRelPath(date, 'fact-check-report.json')}`,
    `- ${newsroomRelPath(date, 'quality-report.json')}`,
    `- ${newsroomRelPath(date, 'retry-history.json')}`,
    '- .tmp/newsletter-generation-status.json',
    '- .tmp/gemini-raw/**'
  ];
  const filePath = path.join(newsroomDir, 'recovery-prompt.md');
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

function writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport = generationRunState.shortlistReport) {
  fs.mkdirSync(newsroomDir, { recursive: true });
  const date = shortlistReport?.date || generationRunState.date || runtimeConfig.newsletterDate || kstDate();
  const selectionDiagnostics = selectionStatusExtra(shortlistReport);
  const selectionReport = buildSelectionReport(date, shortlistReport, selectionDiagnostics);
  const lines = [
    `# Candidate Selection Diagnostics - ${date}`,
    '',
    renderCandidateSelectionDiagnostics(selectionDiagnostics),
    '',
    '## Gate Summary',
    '',
    `- Review Gate: ${selectionDiagnostics.review_gate_passed ? 'PASS' : 'FAIL'} (Newsletter Policy selection checks)`,
    `- Publish Gate: ${selectionDiagnostics.publish_gate_passed ? 'PASS' : 'FAIL'} (${publishGateCriteriaText()})`,
    `- selection_publish_ready: ${selectionDiagnostics.selection_publish_ready}`,
    `- final_publish_ready: ${selectionDiagnostics.final_publish_ready}`,
    `- selection_errors: ${selectionDiagnostics.selection_errors.length}`,
    `- selection_shortage_hints: ${selectionDiagnostics.selection_shortage_hints.length}`,
    ''
  ];
  const filePath = path.join(newsroomDir, 'selection-diagnostics.md');
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  writeJson(path.join(newsroomDir, 'selection-report.json'), selectionReport);
  const reportLines = [
    `# Selection Report - ${date}`,
    '',
    `- status: ${selectionReport.status}`,
    `- failure_stage: ${selectionReport.failure_stage || 'n/a'}`,
    `- failure_reason: ${selectionReport.failure_reason || 'n/a'}`,
    `- review_gate_passed: ${selectionReport.review_gate_passed}`,
    `- publish_gate_passed: ${selectionReport.publish_gate_passed}`,
    '',
    '## Selection Errors',
    '',
    ...(
      selectionReport.selection_errors.length > 0
        ? selectionReport.selection_errors.map(error => `- ${error}`)
        : ['- none']
    ),
    '',
    '## Shortage Hints',
    '',
    ...(
      selectionReport.selection_shortage_hints.length > 0
        ? selectionReport.selection_shortage_hints.map(hint => `- ${hint}`)
        : ['- none']
    ),
    '',
    '## Candidate Pool Preflight',
    '',
    `- candidate_shortage_reviewable: ${selectionReport.candidate_shortage_reviewable}`,
    `- candidate_pool_preflight_passed: ${selectionReport.candidate_pool_preflight_passed}`,
    `- shortage_reason_codes: ${selectionReport.shortage_reason_codes.join('; ') || 'none'}`,
    `- publishable_candidate_count: ${selectionReport.candidate_shortage_summary.publishable_candidate_count ?? 'unknown'}`,
    `- required_publishable_candidate_count: ${selectionReport.candidate_shortage_summary.required_publishable_candidate_count ?? 'unknown'}`,
    `- reserve_candidate_count: ${selectionReport.candidate_shortage_summary.reserve_candidate_count ?? 'unknown'}`,
    `- required_reserve_candidate_count: ${selectionReport.candidate_shortage_summary.required_reserve_candidate_count ?? 'unknown'}`,
    `- Reserve requirement: ${Number(selectionReport.candidate_shortage_summary.required_reserve_candidate_count) === 0 ? 'diagnostics only' : 'blocking preflight requirement'}`,
    '',
    '## Homepage Headline',
    '',
    `- decision: ${selectionReport.headline_decision?.reason || selectionReport.headline_decision?.decision || 'unknown'}`,
    `- current_headline_key: ${selectionReport.headline_decision?.current_headline_key || 'unknown'}`,
    `- replacement_headline_key: ${selectionReport.headline_decision?.replacement_headline_key || 'unknown'}`,
    `- public_render_reconciled: ${selectionReport.headline_decision?.public_render_reconciled === true || selectionReport.headline_public_render_reconciliation?.applied === true}`,
    `- public_rendered_headline_key: ${selectionReport.headline_decision?.public_rendered_headline_key || selectionReport.headline_public_render_reconciliation?.rendered_headline_key || 'unknown'}`,
    `- public_render_reconciliation_reason: ${selectionReport.headline_decision?.public_render_reconciliation_reason || selectionReport.headline_public_render_reconciliation?.reason || 'unknown'}`,
    `- previous_stored_current_score: ${selectionReport.headline_decision?.previous_stored_current_score ?? 'unknown'}`,
    `- runtime_decayed_score: ${selectionReport.headline_decision?.runtime_decayed_score ?? 'unknown'}`,
    `- last_scored_at: ${selectionReport.headline_decision?.last_scored_at || 'unknown'}`,
    `- scored_at: ${selectionReport.headline_decision?.scored_at || 'unknown'}`,
    `- latest_inclusion_mode: ${selectionReport.headline_latest_inclusion?.mode || 'none'}`,
    `- injected_from_snapshot: ${selectionReport.headline_latest_inclusion?.injected_from_snapshot === true}`,
    `- removed_due_to_headline_inclusion_count: ${selectionReport.removed_due_to_headline_inclusion.length}`,
    ...(
      selectionReport.removed_due_to_headline_inclusion.length > 0
        ? selectionReport.removed_due_to_headline_inclusion.slice(0, 5).map(item =>
          `  - ${item.title || 'unknown'} (${item.article_identity_key || 'unknown'}): ${item.reason || 'unknown'}`
        )
        : []
    ),
    `- exposure_history_coverage: ${selectionReport.article_exposure_coverage?.mode || 'unknown'} since ${selectionReport.article_exposure_coverage?.coverage_starts_at || 'unknown'}`,
    '',
    '## Source Parser Hints',
    '',
    ...(
      selectionReport.source_parser_hints.length > 0
        ? selectionReport.source_parser_hints.map(hint => `- ${hint.code || 'UNKNOWN'}: ${hint.reason || 'unknown'}`)
        : ['- none']
    ),
    '',
    '## Gate Summary',
    '',
    `- non_fallback_reviewable_article_count: ${selectionReport.gate_summary.non_fallback_reviewable_article_count ?? 'unknown'}`,
    `- primary_camera_stack_topic_count: ${selectionReport.gate_summary.primary_camera_stack_topic_count ?? 'unknown'}`,
    `- supporting_main_article_count: ${selectionReport.gate_summary.supporting_main_article_count ?? 'unknown'}`,
    `- forbidden_main_article_count: ${selectionReport.gate_summary.forbidden_main_article_count ?? 'unknown'}`,
    `- Minimum publishable article count: ${selectionReport.gate_summary.min_final_articles ?? 'unknown'}`,
    `- Primary camera stack requirement: ${Number(selectionReport.gate_summary.absolute_min_reviewable_articles) === 0 ? 'disabled by one-article policy' : selectionReport.gate_summary.absolute_min_reviewable_articles ?? 'unknown'}`,
    `- min_final_articles: ${selectionReport.gate_summary.min_final_articles ?? 'unknown'}`,
    `- max_final_articles: ${selectionReport.gate_summary.max_final_articles ?? 'unknown'}`
  ];
  fs.writeFileSync(path.join(newsroomDir, 'selection-report.md'), `${reportLines.join('\n')}\n`, 'utf8');
  return filePath;
}

async function main() {
  const date = runtimeConfig.newsletterDate || kstDate();
  generationRunState.date = date;
  writeNewsletterDate(date);

  const candidateInput = resolveCandidateInputArtifact({
    root,
    date,
    env: process.env
  });
  generationRunState.candidateInput = candidateInput.status_extra;
  writeGenerationStatus(buildGenerationStatus({ date, status: 'STARTED' }));

  const candidatePath = candidateInput.path;
  const sourcesPath = path.join(root, 'docs', 'NEWS_SOURCES.md');
  const editorialPolicyPath = path.join(root, 'docs', 'EDITORIAL_POLICY.md');
  const newsletterTemplatePath = path.join(root, 'docs', 'NEWSLETTER_TEMPLATE.md');
  const goldenExamplePath = path.join(root, 'docs', 'golden-examples', 'MANUAL_QUALITY_NEWSLETTER.md');
  const newsroomDir = artifactNewsroomDir(root, date);
  const newsletterDir = path.join(root, 'articles', 'newsletters', date);

  if (!fs.existsSync(sourceRegistryPath) && !fs.existsSync(sourcesPath)) {
    fail('Missing src/shared/data/news-sources.json and docs/NEWS_SOURCES.md.');
  }

  const candidates = readJson(candidatePath);
  const sourcesMarkdown = readTextIfExists(sourcesPath);
  const editorialPolicy = readTextIfExists(editorialPolicyPath);
  const newsletterTemplate = readTextIfExists(newsletterTemplatePath);
  const goldenExample = readTextIfExists(goldenExamplePath);
  const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : null;
  const seedEvidencePack = readSeedEvidencePackForDate(date);
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.mkdirSync(newsletterDir, { recursive: true });

  const cacheDir = path.join(root, 'cache', 'news-summary');
  let shortlistReport = buildShortlistReport(date, candidates, {
    selectionWindowPolicy: runtimeConfig.selectionWindowPolicy
  });
  generationRunState.shortlistReport = shortlistReport;
  generationRunState.selectedInputs = shortlistReport.selected_articles;
  writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
  writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);
  const reporterInput = reporterInputFromShortlist(shortlistReport);
  reporterInput.candidates = annotateCandidatesWithCache(reporterInput.candidates, cacheDir);
  const summaryCacheDiagnostics = reporterInput.candidates.cache_diagnostics || [];
  writeSummaryCacheReport(date, summaryCacheDiagnostics);
  let articleCapsuleReport = buildArticleCapsuleReport(date, shortlistReport, reporterInput, {
    seedEvidencePack
  });
  writeJson(path.join(newsroomDir, 'article-capsules.json'), articleCapsuleReport);
  const selectionPreflightIo = {
    buildGenerationStatus,
    writeGenerationStatus,
    writeDateReviewPackage,
    writeRecoveryPrompt,
    selectionStatusExtra,
    fail
  };
  if (maybeHandleSelectionShortage({ date, shortlistReport, io: selectionPreflightIo })) return;
  warnSelectionUnderfill({ date, newsroomDir, shortlistReport, io: selectionPreflightIo });
  maybeFailOnSelectionErrors({ date, newsroomDir, shortlistReport, io: selectionPreflightIo });

  let backgroundContextReport = buildStaticBackgroundContextReport(date, articleCapsuleReport);
  writeJson(path.join(newsroomDir, 'background-context.json'), backgroundContextReport);

  const { commonContext, reporterContext } = buildPromptContexts({ date, editorialPolicy, newsletterTemplate, goldenExample });

  const maxQualityRetries = runtimeConfig.newsroomMaxQualityRetries;
  const totalAttempts = 1 + maxQualityRetries;
  const retryHistory = [];
  generationRunState.retryHistory = retryHistory;
  let lockedSections = [];
  let reporter = null;
  let editor = null;
  let factCheck = null;
  let qualityReport = null;
  let excludedSections = [];
  let attemptedSections = [];

  // 품질 게이트 빌드 + last-known-valid 기록 + 표준/시도별 아티팩트 영속화를 한 곳에 모은다.
  // attempt/repair/completion 세 경로가 동일 시퀀스를 반복하던 것을 단일 함수로 통합한다.
  // attemptType별 파일명 infix만 다르며, editor/qualityReport를 갱신해 반환한다.
  const qualityReportFilenameInfix = { attempt: '', repair: 'repair-', completion: 'completion-' };
  const runQualityGateAndPersist = (currentEditor, currentFactCheck, attempt, attemptType) => {
    const infix = qualityReportFilenameInfix[attemptType] || '';
    const qualityReport = buildNewsletterQualityReport(date, currentEditor, reporter, currentFactCheck, {
      threshold: qualityGatePolicy.threshold,
      shortlistReport,
      strictClaimValidation: true,
      seedEvidencePack
    });
    generationRunState.qualityReport = qualityReport;
    const persistedEditor = recordLastKnownValidEditor(currentEditor, { date, reporter, factCheck: currentFactCheck, qualityReport, attempt, requireStoryContract: true, seedEvidencePack });
    writeCanonicalReviewArtifacts({ date, newsroomDir, reporter, editor: persistedEditor, factCheck: currentFactCheck, qualityReport });
    writeJson(path.join(newsroomDir, `quality-report-${infix}attempt-${attempt}.json`), qualityReport);
    fs.writeFileSync(path.join(newsroomDir, `quality-report-${infix}attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');
    if (qualityReport && qualityReport.status === 'PASS') {
      generationRunState.stageTracker.pass('quality_gate', attempt);
    } else {
      generationRunState.stageTracker.fail('quality_gate', attempt, '', qualityReport && qualityReport.status);
    }
    return { editor: persistedEditor, qualityReport };
  };

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    generationRunState.currentQualityAttempt = attempt;
    const lockedContext = buildLockedArticleContext(lockedSections, excludedSections);
    const reporterStage = `reporter attempt ${attempt}/${totalAttempts}`;
    const editorStage = `editor attempt ${attempt}/${totalAttempts}`;
    const factCheckStage = `fact-checker attempt ${attempt}/${totalAttempts}`;
    console.log(`Starting LLM newsroom quality attempt ${attempt}/${totalAttempts}. Locked articles: ${lockedSections.length}.`);

    reporter = validateReporter(await callLlmJson(
      reporterStage,
      [
        '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI reporter입니다.',
        'local deterministic selector가 이미 final article inputs를 filtering, ranking, choosing했습니다. 최종 selection decision을 다시 하지 마세요.',
        'candidate_id, title, source, url은 matching을 위한 echo-only field입니다. 입력값과 다르게 만들거나 canonical URL로 바꾸지 마세요.',
        '제공된 shortlisted article capsules에 대해서만 evidence fields를 요약하고 보강하세요.',
        'article capsule fields, risk, score, selection, imageCandidates, evidence는 context로만 사용하세요. score, selection flag, imageCandidates, source_quality는 출력하지 마세요.',
        linkedEvidencePromptGuardrails(),
        sourceExtractionPromptGuardrails(),
        'Reporter stage는 evidence-backed candidate facts와 guardrails만 제공해야 합니다. final article-level claims[]를 만들지 마세요. article claims[]는 editor가 담당합니다.',
        '가능하면 version_or_release, api_or_component, behavior_change, evidence_notes, cross_check_status 같은 concrete evidence를 추출하세요.',
        'source가 rolling page, release-note watch page, documentation watch page, homepage 또는 다른 watch page이면 evidence_notes에 명시하세요. candidate가 date/version/API/component/behavior evidence를 제공하지 않으면 dated release처럼 쓰지 마세요.',
        'rolling release-note page는 정확한 date, version/release, API/component, behavior change를 evidence_notes에 명명하세요. 없으면 누락 사실을 적고 만들어내지 마세요.',
        'cross_check_status는 not-required, official-source, cross-checked, needs-cross-check 중 하나여야 합니다.',
        'Candidate-only 또는 requiresCrossCheck lead는 cross_check_status에 검증 필요 상태를 명시하고 unsupported fact를 만들지 마세요.',
        'HAL/driver 직접 영향이 아니면 evidence_notes와 do_not_overstate에서 app/API/tooling/debug/repro 맥락으로 제한하세요.',
        lockedSections.length > 0 ? 'retry context에 있는 locked article URLs, titles, sources, source-date-title 조합과 중복되는 candidate는 evidence_notes에 중복 가능성을 명시하세요.' : '',
        'schema와 일치하는 JSON만 반환하세요.'
      ].filter(Boolean).join('\n'),
      `${reporterContext}\n\n${lockedContext}\n\nArticle capsule shortlist JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, 'shortlisted'), null, 2)}\n\nCompact selection context JSON:\n${JSON.stringify(compactSelectionContext(shortlistReport), null, 2)}`,
      reporterSchema
    ), date, reporterInput.candidates);
    reporter = enforceDeterministicReporterSelection(reporter, shortlistReport);
    shortlistReport = normalizeShortlistReport(shortlistReport, reporter);
    generationRunState.shortlistReport = shortlistReport;
    generationRunState.selectedInputs = shortlistReport.selected_articles;
    writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
    writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);
    articleCapsuleReport = buildArticleCapsuleReport(date, shortlistReport, { date, candidates: reporter.candidates }, {
      seedEvidencePack
    });
    writeJson(path.join(newsroomDir, 'article-capsules.json'), articleCapsuleReport);
    backgroundContextReport = await buildBackgroundContextReport({
      date,
      articleCapsuleReport,
      commonContext,
      stage: `background-context attempt ${attempt}/${totalAttempts}`
    });
    writeJson(path.join(newsroomDir, 'background-context.json'), backgroundContextReport);
    for (const candidate of ensureArray(reporter.candidates)) {
      writeCacheRecord(candidate, cacheDir, { stage: reporterStage, model: getLlmModelUsage(reporterStage) || 'unknown' });
    }
    const rejectedReporterDuplicates = removeDisallowedSelections(reporter, lockedSections, excludedSections);
    writeReporterArtifactsForAttempt(newsroomDir, reporter, attempt);

    const editorRetryContract = lockedSections.length > 0
      ? buildEditorRetryContract({
        lastKnownValidEditor: generationRunState.lastKnownValidEditor,
        currentEditor: editor,
        lockedSections
      })
      : null;
    const publishMode = currentPublishMode();
    const editorDraft = await callLlmJson(
      editorStage,
      [
        '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI editor입니다.',
        'AOSP Camera, Camera HAL, Camera Driver, SoC platform engineer가 10분 안에 읽을 수 있는 한국어 technical newsletter draft를 작성하세요.',
        dateFramingGuardrail(),
        'docs/EDITORIAL_POLICY.md와 docs/NEWSLETTER_TEMPLATE.md를 정확히 따르세요.',
        `중복되지 않는 source material이 충분하면 Newsletter Policy range (${articleCountRangeText()}) 안에서 main articles를 작성하세요.`,
        `Final main article count는 ${publishGateCriteriaText()}를 만족해야 합니다.`,
        'final-selected article capsules를 main article inputs로 사용하세요. final_selected=false, finalSelectionEligibility=watchlist/exclude, hasDatedEvidence 없는 isWatchPage=true, main_eligible=false, source_gap_risk=true, briefing_only, reference_only candidate를 main article로 만들지 마세요.',
        'related_context_candidates는 selected representative article 안에서만 사용하세요. related_context_candidates로 별도 main article을 만들지 마세요.',
        'context_usage_allowed=true인 related_context_candidates만 supporting context로 사용하세요. blocked_context_candidates, blocked_context_reference, parent_roundup_context_only, dedupe_shadow_context를 article source로 cite하지 마세요.',
        'article_group_key가 있으면 보존하세요. Selected group은 article 1개로 render하거나, explicitly_demoted_groups에 reason_code=duplicate_or_near_duplicate|forbidden_bucket|explicit_editor_hold 중 하나로 기록하거나, hard_blocked_groups에 reason_code=source_gap_risk|missing_dated_evidence|blocked_source_quality|fact_check_must_fix|quality_hard_blocker 중 하나로 기록해야 합니다.',
        'source-ready cpp_ai_tooling_fallback native_tooling_workflow group을 primary Camera runtime stack article이 아니라는 이유만으로 demote하지 마세요.',
        linkedEvidencePromptGuardrails(),
        sourceExtractionPromptGuardrails(),
        articleSectionContractPrompt(),
        publicArticleContractPrompt(),
        publicationBoundaryPrompt(),
        articleClaimContractPrompt(),
        '초기 editor draft는 primary selected article capsule만 사용해야 합니다. reserve candidate는 repair 또는 completion 중 primary article이 demote/remove된 뒤에만 사용할 수 있습니다.',
        `우선순위: ${[...articlePolicy.primaryCameraStack.buckets, ...articlePolicy.supportingMainBuckets].join(', ')}. 금지 bucket은 briefing/watchlist로만 남깁니다: ${articlePolicy.forbiddenMainBuckets.join(', ')}.`,
        'SoC/platform article은 낮은 우선순위 fallback이지만, final-selected 상태이고 Camera framework, HAL, driver, image pipeline 또는 platform performance 관점에서 설명할 수 있으면 공개 CPU/GPU/NPU/ISP/power/thermal/performance 정보를 제외하지 마세요.',
        'AI/C++ articles는 final-selected inputs가 구체적인 native camera, driver, SoC, build/test, debugging, performance, workflow value를 포함할 때만 optional fallback item입니다. generic AI article을 만들거나 억지로 넣지 마세요.',
        editorRetryContract ? `Editor retry output contract: sections가 정확히 ${editorRetryContract.target_section_count}개인 complete editor JSON을 반환하세요.` : '',
        editorRetryContract ? `최종 sections array에는 locked section ${editorRetryContract.locked_section_count}개를 변경 없이 포함하고, replacement/new section ${editorRetryContract.replacement_required_count}개를 포함해야 합니다.` : '',
        editorRetryContract ? 'locked section만 반환하면 invalid입니다. sections array는 partial handoff가 아니라 전체 target draft여야 합니다.' : '',
        lockedSections.length > 0 ? 'Previous attempt에서 quality-passing 상태였던 locked article은 그대로 유지하세요. Complete final sections array 안에는 missing replacement article만 새로 생성하세요.' : '',
        lockedSections.length > 0 ? 'locked article URLs, titles/headlines, source names, 또는 같은 source + published date + similar title 조합을 중복하지 마세요.' : '',
        'marketing tone은 피하세요. 모든 article에는 confirmed_facts, sources, 그리고 article_sections(verified_facts, background_context, hal_driver_impact, action_items, team_share_points)를 포함하세요.',
        'article_sections.background_context는 background-context.json의 background_context를 먼저 사용하세요. 없으면 article capsule의 background_context_static을 사용합니다. raw source UI/table snippet을 background_context에 복사하지 마세요.',
        'Jetpack Compose, Jetpack Navigation 3, CameraX-adjacent, Android adaptive UI article은 바로 결론으로 가지 말고 Compose/Navigation/adaptive UI가 왜 camera preview/capture UX 검증과 연결되는지 한 문단의 배경설명을 먼저 제공하세요.',
        'candidate와 background context의 source facts를 보고 article_sections.hal_driver_impact, public_article.camera_hal_takeaway, claims[].impact_level에서 public-facing impact wording과 claim-level classification을 작성하세요.',
        '모든 article은 evidence_summary, specificity_checks, source_verification_notes를 포함해야 합니다.',
        'candidate metadata에 field가 있으면 모든 main article은 release date, version/release, API/component 또는 library/artifact, concrete behavior change, relevance_bucket, AOSP Camera / driver / SoC / native tooling relevance를 명시해야 합니다.',
        'specificity_checks에는 version, release date, API/component, source page, behavior change, 또는 source가 rolling/watch page인 경우 정확한 source gap 같은 구체 evidence를 적으세요.',
        '제공된 candidate/source data에서 release date, version/release, API/component, behavior change, expanded editorial-scope relevance를 확인할 수 없으면 main article로 쓰지 말고 briefing/watchlist로 강등하거나 제외하세요.',
        '정확한 source, version/release, API/component, date, behavior를 명명하지 않는 한 "monitor AOSP updates" 또는 "review CameraX changes" 같은 generic advice를 쓰지 마세요.',
        'SoC, AI, C++, Linux, tooling article은 AOSP Camera, Camera HAL, Camera Driver, V4L2/libcamera, image pipeline/ISP/sensor, SoC performance/power/thermal, native development productivity와의 연결을 명시하세요.',
        'cpp_ai_tooling_fallback article에서는 Android native development가 Clang / LLVM / libc++ 중심임을 명시하세요. GCC, C++ standard, C++ library news가 Android HAL toolchain migration을 뜻한다고 암시하지 마세요.',
        '각 action_items entry는 2주 안에 실행 가능해야 하며 concrete test, log, metric, device class, API/component, stream combination, code-owner style handoff 중 하나 이상을 포함해야 합니다.',
        'action_items는 막연한 "정상 구성되는지 검증하세요" / "로그로 확인하세요"로 끝내지 말고, 검증 대상(대표 device class 또는 구성)과 확인할 구체 신호(구체적 log 태그·패턴 또는 metric·임계값)를 함께 명시하세요. 단 source가 뒷받침하는 범위 안에서만 구체화하고, source가 말하지 않는 수치나 사실을 지어내지 마세요.',
        'C++ tooling action_items에는 HAL/native owner, target structure 또는 API, experiment 또는 serialization target, CPU time, latency, binary size, boilerplate LOC 같은 metric을 명명하세요.',
        '각 article은 해당 article imageCandidates에서 selectedImage를 최대 1개만 고르세요. relevance, rights risk, logo-only content, screenshot text density, source fit이 불명확하면 selectedImage는 empty string으로 두세요.',
        'image URL을 만들지 마세요. selectedImage는 imageCandidates.url 값 중 하나와 정확히 일치하거나 empty string이어야 합니다.',
        'generic, logo-only, promotional image보다 source article의 직접 관련된 16:9 또는 4:3 clean image를 우선하세요.',
        'selectedImage를 설정하면 imageSource, imageAttribution, imageAlt, imageLicenseStatus, 짧은 imageUsageDecisionReason을 반드시 제공하세요. imageAlt는 article context 안에서 이미지를 설명해야 합니다.',
        'imageSource는 image source 또는 article로 연결되는 HTTPS URL이어야 합니다.',
        'imageAttribution은 비어 있지 않은 source 또는 article title text여야 합니다.',
        'imageSource, imageAttribution, imageAlt, imageLicenseStatus를 제공할 수 없으면 image를 선택하지 말고 selectedImage를 비워 두세요.',
        '불완전한 selected image metadata는 validation 중 제거되며 publication validation failure를 일으킬 수 있습니다.',
        '이미지를 선택하지 않으면 selectedImage, imageSource, imageAttribution, imageAlt는 비우고 imageLicenseStatus는 none으로 두며, imageUsageDecisionReason에 제외 이유를 짧게 설명하세요.',
        publishMode === 'CONTEXT' ? [
          '이번 발행은 CONTEXT 모드입니다. 카메라 코어 직접 변경 기사가 없으므로 메인 기사를 억지로 만들지 마세요.',
          '"이번 기간 카메라 코어는 조용했습니다"를 명시하고, SoC/도구/표준 변화가 Camera HAL/driver/검증 워크플로우에 왜·어떻게 닿는지 실무 레이더 관점으로 정리하세요.',
          '근거 없는 단정을 금지합니다. "~한 검증 포인트를 점검할 만하다"처럼 검증 가능한 행동으로 연결하세요.',
          'EDITORIAL_POLICY.md의 해석 기준(stream/buffer/metadata/request/result, CTS/VTS/Camera ITS, thermal/latency/frame drop/memory/contention)으로 relevance를 설명하세요.'
        ].join('\n') : '',
        publishMode === 'QUIET' ? [
          '이번 발행은 QUIET 모드입니다. 발행할 만한 신호가 빈약합니다.',
          '3줄 브리핑과 "다음 관전 포인트"만 간결하게 작성하고 메인 기사를 만들지 마세요.'
        ].join('\n') : '',
        '각 기사의 article_sections.verified_facts 모든 항목은 대응하는 claim_type=fact claim으로 binding되어야 합니다. verified_facts 개수보다 적은 수의 fact claim을 만들지 마세요.',
        '각 claim의 evidence_ids는 해당 기사 candidate의 source_extraction.evidence_ids에 실제로 존재하는 ID만 사용하세요. candidate에 evidence_ids가 없거나 source_extraction이 없으면 evidence_ids를 빈 배열([])로 두세요. 존재하지 않는 ID를 만들어 쓰지 마세요.',
        '각 기사의 public_article.editorial_story를 반드시 채우세요: reader_scenario(현업 HAL 엔지니어가 실제로 겪을 법한 디버깅/CI/리뷰 상황 — 가정법, 1~2문장), what_happened(source에서 확인되는 사실 요약, 1~2문장), why_it_matters(Camera HAL / Driver / native tooling 관점의 의미, 1~2문장), field_scenario(실제 capture session/HAL 설정/CI 시나리오 연결, 1~2문장), not_to_overclaim(source가 명시하지 않은 수치/API/계층 주장 한 줄 경고), editor_take(편집자 한 줄 판단). 모든 필드는 빈 문자열이 아니어야 합니다.',
        ensureArray(shortlistReport?.selected_articles).some(item => item.coverage_type === 'catch_up')
          ? '입력 capsule에 coverage_type=catch_up으로 표시된 기사는 "지난 소식"입니다. 이 기사는 수 주 전 릴리스를 다시 정리하는 회고이므로 속보처럼 쓰지 말고 "N주 전 릴리스된 ~를 아직 확인하지 않았다면" 같은 회고 톤으로 작성하세요. 릴리스 날짜를 숨기지 말고 본문에 명시하세요.'
          : '',
        '사실과 해석을 분리하세요. source links를 보존하세요. schema와 일치하는 JSON만 반환하세요.',
        'briefing은 정확히 3개 item이어야 합니다.'
      ].filter(Boolean).join('\n'),
      [
        commonContext,
        lockedContext,
        editorRetryContract ? `Editor retry output contract JSON:\n${JSON.stringify(editorRetryContract, null, 2)}` : '',
        `Primary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}`,
        `Background context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}`
      ].filter(Boolean).join('\n\n'),
      editorSchema
    );
    try {
      editor = await validateOrRepairEditor(editorDraft, {
        date,
        reporter,
        attempt,
        editorStage,
        commonContext,
        lockedContext,
        newsroomDir,
        articleCapsuleReport,
        seedEvidencePack,
        publishMode: currentPublishMode()
      });
      assertEditorRetryOutputContract(editor, editorRetryContract, reporter);
    } catch (error) {
      if (error instanceof EditorSemanticValidationError && generationRunState.lastKnownValidEditor) {
        writeReviewableRepairFailureArtifacts({
          date,
          newsroomDir,
          error,
          reporter,
          factCheck,
          qualityReport,
          retryHistory,
          shortlistReport,
          attempt,
          stage: editorStage
        });
        return;
      }
      throw error;
    }
    attemptedSections = appendUniqueSections(attemptedSections, editor.sections);

    const merged = mergeLockedSections(lockedSections, editor.sections, excludedSections);
    let rejectedGeneratedSections = [...merged.rejected];
    editor.sections = merged.sections;
    attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
    await resolveIssueArticleImages(editor, { root });
    warnResolvedImageFallbacks(editor);
    // #502: editor draft 확정 직후, fact-check/quality/render 이전에 미해결 evidence_id를 한 번
    // 결정론적으로 재바인딩한다(strict 오라클 통과 시에만; 미지원이면 unbound 유지). 이렇게 해야
    // fact-check / quality 점수 / render 산출물 / publish 판정이 동일한 reconciled draft를 본다.
    editor = reconcileFactClaimEvidence(editor, { reporter, seedEvidencePack });
    editor = recordLastKnownValidEditor(editor, { date, reporter, attempt, requireStoryContract: true, seedEvidencePack });
    writeCanonicalReviewArtifacts({ date, newsroomDir, reporter, editor });
    writeJson(path.join(newsroomDir, `editor-draft-attempt-${attempt}.json`), editor);
    fs.writeFileSync(path.join(newsroomDir, `editor-draft-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

    factCheck = validateFactCheck(await callLlmJson(
      factCheckStage,
      [
        '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI fact checker입니다.',
        'factuality, missing sources, exaggerated language, missing dates를 확인하세요.',
        linkedEvidencePromptGuardrails(),
        sourceExtractionPromptGuardrails(),
        'article이 rolling page나 generic watch item을 concrete update처럼 제시했는데 version, release date, API/component name, behavior change가 없으면 must_fix로 다루세요.',
        'dated evidence 없이 finalSelectionEligibility=watchlist/exclude candidate 또는 watch page가 main article로 사용되면 must_fix로 다루세요.',
        'source 없는 claim은 must_fix로 분류해야 합니다.',
        articleSectionContractPrompt(),
        publicArticleContractPrompt(),
        publicationBoundaryPrompt(),
        articleClaimContractPrompt(),
        factCheckSeverityPrompt(),
        cameraDeveloperToolingFactCheckPrompt(),
        articleQualityVerdictPrompt(),
        'AOSP Camera, camera driver, SoC platform, native development 또는 Camera developer workflow 해석이 전혀 없는 일반 AI/C++/SoC news는 must_fix[]에 넣으세요.',
        'cpp_ai_tooling_fallback article이 Android native development를 Clang / LLVM / libc++ 중심으로 framing하지 않고 GCC, C++ standard, C++ library news에서 Android HAL toolchain migration을 암시하면 must_fix[]에 넣으세요.',
        'HAL/native owner, target structure 또는 API, experiment 또는 serialization target, measurable metrics가 빠진 C++ tooling action item은 같은 source 안에서 보강 가능하면 recommended_fixes[]에 넣고, 보강할 source evidence가 없으면 must_fix[]에 넣으세요.',
        '구체적인 Action Item content가 없는 main article은 같은 source 안에서 실행 가능한 action을 만들 수 있으면 recommended_fixes[]에 넣고, source가 실무 action을 뒷받침하지 못하면 must_fix[]에 넣으세요.',
        'action_items가 막연하지만 같은 source가 더 구체적인 action을 뒷받침하면 must_fix가 아니라 recommended_fixes[]로 분류하세요. must_fix[]는 발행을 막아야 하는 factual/source 오류 전용입니다.',
        'claims[].impact_level, claim_type, overclaim_risk는 고정 enum입니다. 허용된 enum 목록에 없는 값(예: stream_configuration_behavior, buffer_lifecycle_management)을 suggestion으로 제시하지 말고, 유효한 enum 값을 단지 "too broad" 또는 "too specific"라는 이유로 must_fix하지 마세요. 분류가 실제로 틀렸을 때만 허용된 enum 값 중 하나를 suggestion으로 제시하세요.',
        'sections[*].public_article.decision_metadata.{impact, scope, action, overclaim_risk}는 deterministic builder가 public output 직전에 derive/overwrite하는 internal metadata입니다. enum 위반은 deterministic validator(validateDecisionMetadataShape)가 담당하므로 fact-checker는 이 field 값을 must_fix[] 또는 recommended_fixes[]에 넣지 마세요.',
        'Camera HAL perspective가 약하거나 engineering relevance가 빠진 main article은 source-backed 보강이 가능하면 recommended_fixes[]에 넣고, source가 Camera developer relevance를 뒷받침하지 못하면 must_fix[] 또는 source_gaps[]에 넣으세요.',
        'Editor가 official-source 또는 cross-checked verification을 설명하지 않는 candidate-only 또는 requiresCrossCheck source 사용은 must_fix[]와 source_gaps[]에 모두 기록하세요.',
        'selectedImage가 repo-local fallback path이고 originalImage 또는 resolvedImage.originalUrl이 external original을 보존하면 resolvedImage.usedFallback=true를 must_fix로 다루지 마세요. selectedImage가 여전히 깨진 external image URL이거나 fallback path가 누락된 경우에만 must_fix로 다루세요.',
        'coverage_type=catch_up인 "지난 소식" 기사는 수 주 전 릴리스를 회고로 다루도록 의도된 것입니다. headline/lead에 "지난 소식", "N주 전 릴리스된 ~" 같은 회고 editorial framing이 있어도 must_fix로 다루지 마세요. 이는 의도된 catch-up 프레이밍이며 source 날짜를 숨기지 않는 한 factual 위반이 아닙니다.',
        'editor schema에 정의된 유효한 필드의 존재 자체를 deprecated/legacy로 판정하거나 must_fix로 올리지 마세요. 존재하지 않는 폐기(deprecation)/legacy 정책이나 출처를 지어내지 마세요. must_fix[]는 source가 직접 반증하는 factual 오류, 누락/위조된 출처, 명시된 editorial-policy 위반 전용입니다.',
        'style rewrite는 하지 마세요. factual errors, source problems, editorial-policy violations에만 집중하세요.',
        'schema와 일치하는 JSON만 반환하세요.'
      ].join('\n'),
      `${commonContext}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nEditor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
      factCheckSchema
    ));
    let eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections);
    factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
    factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
    editor = sanitizeClaimEvidenceIds(editor, reporter, seedEvidencePack);
    editor = stampCoverageType(editor, shortlistReport);
    factCheck = pruneCatchUpFramingFactCheckItems(factCheck, editor);
    generationRunState.factCheck = factCheck;
    writeJson(path.join(newsroomDir, `fact-check-report-attempt-${attempt}.json`), factCheck);
    fs.writeFileSync(path.join(newsroomDir, `fact-check-report-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

    ({ editor, qualityReport } = runQualityGateAndPersist(editor, factCheck, attempt, 'attempt'));

    // #632: 결정론 demote가 줄인 슬롯을 completion이 reserve로 되채워 기사 수를 보존하도록,
    // repair 패스(demote) 이전의 main article 수를 기억해 둔다.
    const mainArticleCountBeforeRepair = ensureArray(editor.sections).length;
    let repairActions = [];
    let demotedSections = appendUniqueSections(
      sourceGapSections(editor, factCheck),
      eligibilityFindings.map(finding => finding.section)
    );
    let replacedSections = [];
    let failedSections = [];
    let regeneratedSections = [];
    let rejectedRetryOutputs = [];
    let reserveCandidatesUsed = [];
    let reservePoolOpened = false;
    let reserveOpenReason = '';
    let candidateRejections = [];
    let underfilledReason = '';
    // completion(target 채우기)이 실패했지만 직전 pre-completion draft가 이미 PASS라 그 상태로
    // 되돌려 발행한 경우(자동 복구)를 정상 thin-week underfill과 구분하기 위한 구조 플래그.
    let completionFallbackToPrepass = false;
    const fullRepairPlan = buildFullSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings);
    const repairPlan = buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings, {
      maxSectionRepairs: runtimeConfig.newsroomMaxSectionRepairs
    });
    const skippedRepairPlan = fullRepairPlan.slice(repairPlan.length);
    demotedSections = appendUniqueSections(
      demotedSections,
      sectionsMatchingRepairPlan(
        editor.sections,
        repairPlan.filter(item => item.action === 'replace-or-demote')
      )
    );
    // repair 패스가 reserve candidate를 쓸 수 있는지. demote된 섹션이 있으면 reserve로 보충 가능하다는
    // 의미다. 공유 후처리(reporterEligibilityFindings)와 두 repair 분기 모두에서 참조하므로 if/else
    // 바깥, demote 보강 직후(regen/demote 이전 값)에 선언한다.
    const repairAllowsReserve = demotedSections.length > 0;
    if (qualityReport.status !== 'PASS' && repairPlan.length > 0) {
      const repairStage = `editor repair attempt ${attempt}/${totalAttempts}`;
      // #628 salvage용 일관 snapshot. repair try 안에서 editor/factCheck/qualityReport는
      // 재할당되지만(특히 structural 경로는 mergeLockedSections로 section 순서/구성이 바뀜),
      // 이 시점의 셋은 직전 runQualityGateAndPersist가 만든 정합 셋이다. salvage는 article_results를
      // editor.sections 인덱스에 위치 대응시키므로, 재할당된 editor에 stale qualityReport를 쓰면
      // 인덱스가 어긋난다. 그래서 항상 이 정합 pre-repair snapshot에서만 salvage한다(이 섹션들은
      // 이미 image/evidence 재조정을 거친 검증된 draft이기도 하다).
      const preRepairEditor = editor;
      const preRepairFactCheck = factCheck;
      const preRepairQualityReport = qualityReport;
      try {
        repairActions = repairPlan.map(item => `${item.action}: ${item.headline}`);
        failedSections = sectionsMatchingRepairPlan(editor.sections, repairPlan);
        const preservedSections = sectionsOutsideRepairPlan(editor.sections, repairPlan);
        const repairFactCheckStage = `fact-checker repair attempt ${attempt}/${totalAttempts}`;
        console.warn(`Quality attempt ${attempt}/${totalAttempts} is below threshold; running editor repair pass for ${repairPlan.length} section(s).`);
        // #482: repair-section만 있는 plan은 article-preserving이므로 field-level
        // patch를 결정론적으로 적용해 모델이 어떤 기사가 존재하는지 바꾸지 못하게
        // 한다. 구조 변경 action(replace-section / replace-or-demote)은 정당하게
        // section을 재구성하므로 아래 else 분기의 full-section 경로와 가드를 쓴다.
        const structuralRepairPlan = repairPlan.filter(item => item.action !== 'repair-section');
        if (structuralRepairPlan.length === 0) {
          repairActions = repairPlan.map(item => `repair-section(patch): ${item.headline}`);
          const failedKeys = new Set(failedSections.map(stableSectionKey));
          const patchTargets = ensureArray(editor.sections)
            .map((section, index) => ({ section, index }))
            .filter(({ section }) => failedKeys.has(stableSectionKey(section)))
            .map(({ section, index }) => ({
              section_index: index,
              section_key: stableSectionKey(section),
              summary: sectionSummary(section, index),
              article_sections: section.article_sections,
              public_article: section.public_article
            }));
          const patchResponse = await callLlmJson(
            repairStage,
            [
              '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI repair editor입니다.',
              dateFramingGuardrail(),
              editorRepairPatchPrompt(),
              linkedEvidencePromptGuardrails(),
              sourceExtractionPromptGuardrails(),
              articleSectionContractPrompt(),
              publicArticleContractPrompt(),
              publicationBoundaryPrompt(),
              articleClaimContractPrompt(),
              claimRepairEvidencePrompt(),
              'schema와 일치하는 {patches:[...]} JSON만 반환하세요.'
            ].join('\n'),
            `${commonContext}\n\nFailed sections to patch JSON:\n${JSON.stringify(patchTargets, null, 2)}\n\nRepair plan JSON:\n${JSON.stringify(repairPlan, null, 2)}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nCurrent fact-check JSON:\n${JSON.stringify(factCheck, null, 2)}\n\nCurrent quality deductions JSON:\n${JSON.stringify(ensureArray(qualityReport?.deductions), null, 2)}`,
            editorRepairPatchSchema
          );
          const patches = ensureArray(patchResponse && patchResponse.patches);
          writeJson(path.join(newsroomDir, `editor-repair-patches-attempt-${attempt}.json`), { patches });
          const patchResult = applyRepairPatchesAndValidate({ editor, patches, reporter, date });
          if (!patchResult.ok) {
            throw targetedRepairError('Editor repair violated the article-preserving patch contract.', {
              field: 'sections.repair_patch',
              reason: REPAIR_PATCH_CONTRACT_VIOLATION,
              violations: patchResult.violations,
              sectionCount: ensureArray(editor.sections).length
            });
          }
          editor = validateEditor(patchResult.editor, date, reporter, { strictClaims: true, requireStoryContract: true });
        } else {
        // #632: replace/demote를 LLM 전체-재생성 대신 결정론 강등으로 처리한다. 실패(structural)
        // 섹션을 떨어뜨리고 통과 섹션만 남긴다. 이로써 #628의 identity-drift throw와 evidence_id 반복
        // 루프를 일으키던 regen 호출(callLlmJson + mergeLockedSections + validateTargetedRepairResult)이
        // 사라진다. 아래 공유 후처리(judge / fact-check 재실행 / 재게이트)가 강등된 draft를 다시 검증하고,
        // 그 다음 completion 패스가 부족분을 reserve candidate로 채워 기사 수를 보존한다.
        // 기본 newsroomMaxSectionRepairs=1이라 plan은 1개 섹션(여기선 structural 1개)이다. >1로 설정해
        // repair-section과 structural이 섞이면 structural만 강등되고 repair-section은 이번 attempt에선
        // 미수정으로 남는다(재게이트 NEEDS_FIX→재시도/ salvage로 안전 처리; 발행 안전 구멍은 아님).
        const structuralFailed = sectionsMatchingRepairPlan(editor.sections, structuralRepairPlan);
        const keptSections = sectionsOutsideRepairPlan(editor.sections, structuralRepairPlan);
        repairActions = structuralRepairPlan.map(item => `${item.action}(deterministic-demote): ${item.headline}`);
        demotedSections = appendUniqueSections(demotedSections, structuralFailed);
        regeneratedSections = [];
        replacedSections = structuralFailed.map(sectionLabel);
        editor = validateEditor({
          ...editor,
          sections: keptSections,
          hard_blocked_groups: [
            ...ensureArray(editor.hard_blocked_groups),
            ...hardBlockedGroupsForDroppedSections(structuralFailed)
          ]
        }, date, reporter, { strictClaims: true, requireStoryContract: true });
        }
        editor = await validatePublicArticleJudgeOrRepair({
          date,
          editor,
          reporter,
          attempt,
          editorStage: repairStage,
          commonContext,
          lockedContext,
          newsroomDir
        });
        attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
        await resolveIssueArticleImages(editor, { root });
        warnResolvedImageFallbacks(editor);
        // #502: 영속화·fact-check 이전에 미해결 evidence_id를 결정론적으로 재바인딩(fail-closed).
        editor = reconcileFactClaimEvidence(editor, { reporter, seedEvidencePack });
        writeJson(path.join(newsroomDir, `editor-repair-attempt-${attempt}.json`), editor);
        writeJson(path.join(newsroomDir, `editor-repair-sections-attempt-${attempt}.json`), {
          locked_sections: preservedSections.map((section, index) => sectionSummary(section, index)),
          failed_sections: failedSections.map((section, index) => sectionSummary(section, index)),
          regenerated_sections: regeneratedSections.map((section, index) => sectionSummary(section, index)),
          rejected_retry_outputs: rejectedRetryOutputs,
          max_section_repairs: runtimeConfig.newsroomMaxSectionRepairs,
          repair_plan: repairPlan,
          skipped_repair_plan: skippedRepairPlan
        });
        fs.writeFileSync(path.join(newsroomDir, `editor-repair-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

        factCheck = validateFactCheck(await callLlmJson(
          repairFactCheckStage,
          [
          '당신은 repaired AOSP Camera / Driver / SoC Platform Newsletter draft의 AI fact checker입니다.',
          'factuality, missing sources, exaggerated language, missing dates, source gaps, editorial-policy violations를 확인하세요.',
          'editor schema에 정의된 유효한 필드의 존재 자체를 deprecated/legacy로 판정하거나 must_fix로 올리지 마세요. 존재하지 않는 폐기 정책이나 출처를 지어내지 마세요. must_fix[]는 source가 직접 반증하는 factual 오류, 누락/위조된 출처, 명시된 editorial-policy 위반 전용입니다.',
          linkedEvidencePromptGuardrails(),
          sourceExtractionPromptGuardrails(),
          articleSectionContractPrompt(),
          publicArticleContractPrompt(),
          publicationBoundaryPrompt(),
          articleClaimContractPrompt(),
          factCheckSeverityPrompt(),
          cameraDeveloperToolingFactCheckPrompt(),
          articleQualityVerdictPrompt(),
          'main article에서 release date, version/release, API/component 또는 library/artifact, concrete behavior change, expanded editorial-scope relevance가 누락되면 must_fix로 다루세요.',
          '남아 있는 source gap 또는 main article로 사용된 watchlist/reference page는 must_fix로 다루세요.',
          'cpp_ai_tooling_fallback article이 Android native development를 Clang / LLVM / libc++ 중심으로 framing하지 않고 GCC, C++ standard, C++ library news에서 Android HAL toolchain migration을 암시하면 must_fix[]에 넣으세요.',
          'HAL/native owner, target structure 또는 API, experiment 또는 serialization target, measurable metrics가 빠진 C++ tooling action item은 같은 source 안에서 보강 가능하면 recommended_fixes[]에 넣고, 보강할 source evidence가 없으면 must_fix[]에 넣으세요.',
          'selectedImage가 repo-local fallback path이고 originalImage 또는 resolvedImage.originalUrl이 external original을 보존하면 resolvedImage.usedFallback=true를 must_fix로 다루지 마세요. selectedImage가 여전히 깨진 external image URL이거나 fallback path가 누락된 경우에만 must_fix로 다루세요.',
          'schema와 일치하는 JSON만 반환하세요.'
        ].join('\n'),
        `${commonContext}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nReserve article capsule pool JSON:\n${JSON.stringify(reserveReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nRepaired editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
          factCheckSchema
        ));
        eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections, {
          allowReserve: repairAllowsReserve
        });
        factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
        factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
        editor = sanitizeClaimEvidenceIds(editor, reporter, seedEvidencePack);
        editor = stampCoverageType(editor, shortlistReport);
        factCheck = pruneCatchUpFramingFactCheckItems(factCheck, editor);
        generationRunState.factCheck = factCheck;
        writeJson(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.json`), factCheck);
        fs.writeFileSync(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

        ({ editor, qualityReport } = runQualityGateAndPersist(editor, factCheck, attempt, 'repair'));
        demotedSections = appendUniqueSections(
          demotedSections,
          sourceGapSections(editor, factCheck).concat(eligibilityFindings.map(finding => finding.section))
        );
      } catch (error) {
        // #628: 약한 섹션 하나의 repair 실패가 발행 가능한 강한 카메라 기사 전체를 막지
        // 않게 한다. 정합 pre-repair snapshot에서 실패 섹션을 demote하고 나머지가 같은 quality
        // gate를 통과하면 그 subset만 발행한다. salvagePublishableSubset은 subset에 게이트를
        // 재적용해 PASS일 때만 결과를 반환(아니면 null)하므로 게이트를 약화하지 않는다. 루프 뒤
        // thin-week salvage(아래)와 같은 메커니즘이며, repair catch가 그 경로에 닿기 전에 return하던
        // 갭만 메운다. salvage/검증 자체가 throw하면(드문 oracle 불일치) FAILED 경로로 안전하게
        // 떨어뜨려, 이 catch 밖 terminal FAILED로 새지 않게 한다.
        let repairSalvage = null;
        try {
          const candidate = salvagePublishableSubset(
            date, preRepairEditor, reporter, preRepairFactCheck, preRepairQualityReport,
            { threshold: qualityGatePolicy.threshold, shortlistReport, strictClaimValidation: true, seedEvidencePack }
          );
          if (candidate) {
            const salvagedEditor = validateEditor(candidate.editor, date, reporter, { strictClaims: true, requireStoryContract: true });
            repairSalvage = { ...candidate, editor: salvagedEditor };
          }
        } catch (salvageError) {
          console.warn(`Repair-failure salvage could not produce a valid subset: ${salvageError.message}`);
          repairSalvage = null;
        }
        if (repairSalvage) {
          const keptKeys = new Set(ensureArray(repairSalvage.editor.sections).map(stableSectionKey).filter(Boolean));
          const droppedSections = ensureArray(preRepairEditor.sections).filter(before => {
            const key = stableSectionKey(before);
            return key ? !keptKeys.has(key) : true;
          });
          console.warn(`Repair pass failed for ${repairPlan.length} section(s); salvaging ${repairSalvage.kept_section_count} publishable article(s) and demoting ${droppedSections.length}. (${error.message})`);
          editor = repairSalvage.editor;
          factCheck = repairSalvage.factCheck;
          qualityReport = repairSalvage.qualityReport;
          generationRunState.factCheck = factCheck;
          generationRunState.qualityReport = qualityReport;
          demotedSections = appendUniqueSections(demotedSections, droppedSections);
          // 발행 가능한 PASS subset을 확보했으므로 return하지 않는다. 이번 attempt의 나머지
          // (completion은 PASS라 skip, lock/retryHistory 기록)를 정상 통과한 뒤 PASS로 자연
          // 종료(break)하고 일반 발행 경로로 진행한다. FAILED 아티팩트를 쓰지 않으므로 #627의
          // "FAILED + public 노출 공존 → validate:site 깨짐" 문제는 발생하지 않는다.
        } else {
          writeReviewableRepairFailureArtifacts({
            date,
            newsroomDir,
            error,
            reporter,
            factCheck,
            qualityReport,
            retryHistory,
            shortlistReport,
            attempt,
            stage: repairStage
          });
          // salvage 불가: repair 실패는 그 자체로 종착점이다. writeReviewableRepairFailureArtifacts가
          // 이미 FAILED_REPAIR_REVIEWABLE 리뷰 패키지(public 노출 없음)를 기록했으므로 여기서 return해
          // 발행 가능 경로로 떨어지지 않게 한다. break로 떨어지면 후처리가 품질을 PASS로 다시 계산해
          // newsletters.json 노출을 쓰고, 그 뒤 validate:site retention이 깨지며 terminal FAILED로 리뷰
          // PR이 사라진다. 형제 catch(editor-validate/completion)도 동일하게 return한다.
          return;
        }
      }
    }

    // #632: 결정론 demote로 줄어든 슬롯을 reserve로 되채워 기사 수를 보존한다(min 미만 보충은
    // 기존 동작 그대로). target = demote 이전 수(단, max 이내, 최소 min). reserve가 없으면 아래
    // 내부 가드(completionCandidates.length > 0)에서 생성하지 않으므로 얇은 날엔 줄어든 채 발행된다.
    const completionTargetCount = completionRefillTargetCount(mainArticleCountBeforeRepair);
    const currentMainArticleCount = ensureArray(editor.sections).length;
    const belowDemoteTarget = demotedSections.length > 0 && currentMainArticleCount < completionTargetCount;
    if (hasTooFewMainArticlesDeduction(qualityReport) || belowDemoteTarget) {
      const missingArticleCount = Math.max(
        articlePolicy.mainArticleCount.min - currentMainArticleCount,
        belowDemoteTarget ? completionTargetCount - currentMainArticleCount : 0
      );
      const completionExcludedSections = appendUniqueSections(
        excludedSections,
        demotedSections.concat(eligibilityFindings.map(finding => finding.section))
      );
      const completionCandidateRejections = [];
      const completionAllowsReserve = completionExcludedSections.length > 0;
      const completionCandidates = availableCompletionCandidates(
        reporter,
        editor.sections,
        completionExcludedSections,
        completionCandidateRejections,
        { allowReserve: completionAllowsReserve }
      );
      if (completionAllowsReserve && completionCandidates.some(isReserveCandidate)) {
        reservePoolOpened = true;
        reserveOpenReason = reserveOpenReason || `completion_missing_${missingArticleCount}_article_after_demote_or_remove`;
      }
      candidateRejections = candidateRejections.concat(completionCandidateRejections);
      if (missingArticleCount > 0 && completionCandidates.length > 0) {
        const completionStage = `editor completion attempt ${attempt}/${totalAttempts}`;
        // completion(target 채우기) 실패 시 되돌릴, 이미 quality gate를 통과한 pre-completion 스냅샷.
        const preCompletionEditor = cloneJson(editor);
        const preCompletionFactCheck = cloneJson(factCheck);
        const preCompletionQualityReport = cloneJson(qualityReport);
        try {
          const completionFactCheckStage = `fact-checker completion attempt ${attempt}/${totalAttempts}`;
          console.warn(`Quality attempt ${attempt}/${totalAttempts} has only ${editor.sections.length} main article(s); requesting ${missingArticleCount} completion article(s).`);
          const beforeCompletionSections = editor.sections;
          const completionSections = validateCompletionSections(await callLlmJson(
            completionStage,
            [
            '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI completion editor입니다.',
            dateFramingGuardrail(),
            `${missingArticleCount}개의 추가 main article section만 반환하세요. full newsletter rewrite는 하지 마세요.`,
            '기존 valid sections는 URLs, titles, source names, source-date-title combinations를 exclusion해서 보존하세요.',
            '이 prompt에 제공된 eligible reporter candidates만 사용하세요. eligible list에서 빠진 candidate는 사용하지 마세요.',
            linkedEvidencePromptGuardrails(),
            sourceExtractionPromptGuardrails(),
            articleSectionContractPrompt(),
            publicArticleContractPrompt(),
            publicationBoundaryPrompt(),
            articleClaimContractPrompt(),
            'exclusion context에 있는 locked, duplicate/rejected, source-gap, ineligible sections를 중복하지 마세요.',
            '각 새 section은 같은 editorial contract인 confirmed_facts, evidence_summary, specificity_checks, source_verification_notes, camera_hal_checks, sources, 그리고 article_sections(verified_facts, background_context, hal_driver_impact, action_items, team_share_points)를 만족해야 합니다.',
            '각 new section은 제공된 candidate metadata/source text만 사용해 release date, version/release, API/component 또는 library/artifact, concrete behavior change, relevance_bucket, AOSP Camera / driver / SoC / native tooling relevance를 명명해야 합니다.',
            'Exclusion context에 있는 duplicate URL, duplicate title, duplicate source-date-title combination을 거부하세요.',
            'facts를 검증할 수 없으면 해당 candidate로 main article을 만들지 말고 newsletter를 underfilled 상태로 남겨 editor review에 넘기세요.',
            '각 article은 해당 article imageCandidates에서 selectedImage를 최대 하나만 선택하세요. attribution 또는 relevance가 불확실하면 selectedImage는 empty string을 사용하세요.',
            '최종 newsletter text는 한국어로 작성하세요. schema와 일치하는 JSON만 반환하세요.'
          ].join('\n'),
          `${commonContext}\n\nCompletion exclusion context JSON:\n${buildCompletionExclusionContext(lockedSections, editor.sections, completionExcludedSections)}\n\nCurrent editor section summaries JSON:\n${JSON.stringify(editor.sections.map((section, index) => sectionSummary(section, index)), null, 2)}\n\nEligible primary/reserve article capsules for additional articles JSON:\n${JSON.stringify(reporterCandidateCapsules(date, completionCandidates, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nCandidate rejection diagnostics JSON:\n${JSON.stringify(completionCandidateRejections, null, 2)}\n\nCurrent quality deductions JSON:\n${JSON.stringify(ensureArray(qualityReport?.deductions), null, 2)}`,
            editorCompletionSchema
          ), date, reporter);
          const completionMerged = mergeLockedSections(editor.sections, completionSections, completionExcludedSections);
          validateTargetedRepairResult({
            beforeSections: beforeCompletionSections,
            repairSections: completionSections,
            afterSections: completionMerged.sections,
            lockedSections: beforeCompletionSections,
            mode: 'completion',
            allowCountChange: true,
            date,
            reporter
          });
          rejectedGeneratedSections = rejectedGeneratedSections.concat(completionMerged.rejected);
          reserveCandidatesUsed = reserveCandidatesUsed.concat(reserveUsageForSections(completionMerged.sections, reporter));
          editor = validateEditor({
            ...editor,
            sections: completionMerged.sections
          }, date, reporter, { strictClaims: true, requireStoryContract: true });
          editor = await validatePublicArticleJudgeOrRepair({
            date,
            editor,
            reporter,
            attempt,
            editorStage: completionStage,
            commonContext,
            lockedContext,
            newsroomDir
          });
          attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
          await resolveIssueArticleImages(editor, { root });
          warnResolvedImageFallbacks(editor);
          // #502: 영속화·fact-check 이전에 미해결 evidence_id를 결정론적으로 재바인딩(fail-closed).
          editor = reconcileFactClaimEvidence(editor, { reporter, seedEvidencePack });
          writeJson(path.join(newsroomDir, `editor-completion-attempt-${attempt}.json`), editor);
          fs.writeFileSync(path.join(newsroomDir, `editor-completion-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

          factCheck = validateFactCheck(await callLlmJson(
            completionFactCheckStage,
            [
            '당신은 completed AOSP Camera / Driver / SoC Platform Newsletter draft의 AI fact checker입니다.',
            'factuality, missing sources, exaggerated language, missing dates, source gaps, editorial-policy violations를 확인하세요.',
            'editor schema에 정의된 유효한 필드의 존재 자체를 deprecated/legacy로 판정하거나 must_fix로 올리지 마세요. 존재하지 않는 폐기 정책이나 출처를 지어내지 마세요. must_fix[]는 source가 직접 반증하는 factual 오류, 누락/위조된 출처, 명시된 editorial-policy 위반 전용입니다.',
            linkedEvidencePromptGuardrails(),
            sourceExtractionPromptGuardrails(),
            articleSectionContractPrompt(),
            publicArticleContractPrompt(),
            publicationBoundaryPrompt(),
            articleClaimContractPrompt(),
            factCheckSeverityPrompt(),
            cameraDeveloperToolingFactCheckPrompt(),
            articleQualityVerdictPrompt(),
            'Added section이 eligible reporter candidates만 사용하는지, full draft가 Newsletter Policy article composition contract를 만족하는지에 집중하세요.',
            'cpp_ai_tooling_fallback article이 Android native development를 Clang / LLVM / libc++ 중심으로 framing하지 않고 GCC, C++ standard, C++ library news에서 Android HAL toolchain migration을 암시하면 must_fix[]에 넣으세요.',
            'HAL/native owner, target structure 또는 API, experiment 또는 serialization target, measurable metrics가 빠진 C++ tooling action item은 같은 source 안에서 보강 가능하면 recommended_fixes[]에 넣고, 보강할 source evidence가 없으면 must_fix[]에 넣으세요.',
            'selectedImage가 repo-local fallback path이고 originalImage 또는 resolvedImage.originalUrl이 external original을 보존하면 resolvedImage.usedFallback=true를 must_fix로 다루지 마세요. selectedImage가 여전히 깨진 external image URL이거나 fallback path가 누락된 경우에만 must_fix로 다루세요.',
            'schema와 일치하는 JSON만 반환하세요.'
          ].join('\n'),
          `${commonContext}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nReserve article capsule pool JSON:\n${JSON.stringify(reserveReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nCompleted editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
            factCheckSchema
          ));
          eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections, {
            allowReserve: completionAllowsReserve
          });
          factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
          factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
          editor = sanitizeClaimEvidenceIds(editor, reporter, seedEvidencePack);
          editor = stampCoverageType(editor, shortlistReport);
          factCheck = pruneCatchUpFramingFactCheckItems(factCheck, editor);
          generationRunState.factCheck = factCheck;
          writeJson(path.join(newsroomDir, `fact-check-completion-attempt-${attempt}.json`), factCheck);
          fs.writeFileSync(path.join(newsroomDir, `fact-check-completion-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

          ({ editor, qualityReport } = runQualityGateAndPersist(editor, factCheck, attempt, 'completion'));
          repairActions.push(`complete-missing-articles: requested ${missingArticleCount}, added ${Math.max(0, editor.sections.length - (articlePolicy.mainArticleCount.min - missingArticleCount))}`);
          demotedSections = appendUniqueSections(
            demotedSections,
            sourceGapSections(editor, factCheck).concat(eligibilityFindings.map(finding => finding.section))
          );
        } catch (error) {
          // completion은 target(catchUpPolicy.targetMainArticles) 채우기용 best-effort다. completion
          // 직전 draft가 이미 quality gate를 PASS(min 충족)했다면, target 보충 실패가 그 발행을 막지
          // 않게 pre-completion 상태로 되돌려 정상 발행 경로를 진행한다. (#629 salvagePublishableSubset은
          // '일부 실패 섹션을 drop한 subset' 용도라 전부 PASS인 pre-completion에는 부적합 — 전부 keep
          // 이면 null을 반환한다. 그래서 여기서는 재검증 없이 이미 PASS인 스냅샷을 그대로 복원한다.)
          // pre-completion이 PASS가 아니면(completion이 필수 보충이었던 경우) 기존대로
          // FAILED_REPAIR_REVIEWABLE을 기록하고 return해 발행 경로로 떨어지지 않게 한다.
          if (preCompletionQualityReport && preCompletionQualityReport.status === 'PASS') {
            console.warn(`Completion top-up for ${missingArticleCount} article(s) failed; publishing ${ensureArray(preCompletionEditor.sections).length} already-passing main article(s) below target ${completionTargetCount}. (${error.message})`);
            editor = preCompletionEditor;
            factCheck = preCompletionFactCheck;
            qualityReport = preCompletionQualityReport;
            generationRunState.factCheck = factCheck;
            generationRunState.qualityReport = qualityReport;
            completionFallbackToPrepass = true;
            underfilledReason = `completion top-up failed; published ${ensureArray(editor.sections).length} passing article(s) below target ${completionTargetCount}`;
          } else {
            writeReviewableRepairFailureArtifacts({
              date,
              newsroomDir,
              error,
              reporter,
              factCheck,
              qualityReport,
              retryHistory,
              shortlistReport,
              attempt,
              stage: completionStage
            });
            return;
          }
        }
      } else {
        underfilledReason = missingArticleCount > 0
          ? `missing ${missingArticleCount} article(s); no eligible non-duplicate primary/reserve completion candidate remains`
          : '';
        console.warn(`Quality attempt ${attempt}/${totalAttempts} has too few main articles, but no eligible non-duplicate completion candidates remain.`);
      }
    }

    excludedSections = appendUniqueSections(excludedSections, demotedSections);
    const lockSelection = selectLockedArticles(editor, qualityReport, factCheck);
    lockedSections = appendUniqueLockedArticles(lockedSections, lockSelection.articles);
    const rejectedDuplicateHeadlines = [...rejectedReporterDuplicates, ...rejectedGeneratedSections];
    const lockBlockers = lockSelection.blockers.map(deduction => `${deduction.category}: ${deduction.reason}`);
    retryHistory.push({
      attempt,
      model: [
        `reporter=${getLlmModelUsage(reporterStage) || 'unknown'}`,
        `editor=${getLlmModelUsage(editorStage) || 'unknown'}`,
        `public-article-judge=${getLlmModelUsage(`${editorStage} public article judge`) || 'unknown'}`,
        `fact-checker=${getLlmModelUsage(factCheckStage) || 'unknown'}`
      ].join(', '),
      score: qualityReport.score,
      threshold: qualityReport.threshold,
      status: qualityReport.status,
      rendered_main_article_count: ensureArray(editor.sections).length,
      locked_article_count: lockedSections.length,
      demoted_article_count: demotedSections.length,
      reserve_pool_opened: reservePoolOpened,
      reserve_open_reason: reserveOpenReason,
      reserve_candidates_used: reserveCandidatesUsed,
      candidate_rejections: candidateRejections.concat(rejectedDuplicateHeadlines),
      underfilled_reason: underfilledReason,
      completion_fallback_to_prepass: completionFallbackToPrepass,
      deductions: ensureArray(qualityReport.deductions),
      selected_article_headlines: lockedArticleHeadlines(editor.sections),
      locked_article_headlines: lockedArticleHeadlines(lockedSections),
      source_gap_sections: sourceGapSections(editor, factCheck).map(sectionLabel),
      demoted_sections: demotedSections.map(sectionLabel),
      replaced_sections: replacedSections,
      locked_sections: lockedSections.map((section, index) => sectionSummary(section, index)),
      failed_sections: failedSections.map((section, index) => sectionSummary(section, index)),
      regenerated_sections: regeneratedSections.map((section, index) => sectionSummary(section, index)),
      rejected_retry_outputs: rejectedRetryOutputs,
      repair_actions: repairActions,
      max_section_repairs: runtimeConfig.newsroomMaxSectionRepairs,
      repair_plan: repairPlan,
      skipped_repair_sections: skippedRepairPlan,
      article_locks: lockedSections.map((section, index) => sectionLockRecord(section, index)),
      final_article_slot_distribution: finalArticleSlotDistribution(editor.sections),
      reporter_eligibility_blocked_sections: eligibilityFindings.map(finding => ({
        headline: finding.headline,
        source_url: finding.source_url,
        reason: finding.reason
      })),
      rejected_main_ineligible_candidates: ensureArray(reporter.rejected_main_ineligible_candidates),
      lock_blockers: lockBlockers,
      rejected_duplicate_headlines: rejectedDuplicateHeadlines,
      source_gap_count: qualityReport.metrics.source_gap_count,
      must_fix_count: qualityReport.metrics.must_fix_count
    });
    console.log(`Quality attempt ${attempt}/${totalAttempts}: score ${qualityReport.score}/${qualityReport.threshold}, status ${qualityReport.status}, deductions ${ensureArray(qualityReport.deductions).length}, locked articles ${lockedSections.length}, rejected duplicates ${rejectedDuplicateHeadlines.length}.`);
    if (lockBlockers.length > 0) {
      console.warn(`Quality attempt ${attempt}/${totalAttempts} has issue-level lock blocker(s): ${lockBlockers.join('; ')}.`);
    }

    if (qualityReport.status === 'PASS' && qualityReport.score >= qualityReport.threshold) break;
    if (attempt < totalAttempts) {
      console.warn(`Quality attempt ${attempt}/${totalAttempts} did not pass; retrying with ${lockedSections.length} locked article(s).`);
    }
  }

  const runtimeDemotedCandidates = candidatesForSections(excludedSections, reporter);
  if (runtimeDemotedCandidates.length > 0) {
    shortlistReport = normalizeShortlistReport({
      ...shortlistReport,
      demoted_candidates: runtimeDemotedCandidates,
      demoted_candidate_count: runtimeDemotedCandidates.length
    }, reporter);
    generationRunState.shortlistReport = shortlistReport;
    writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
    writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);
  }

  const removedSections = appendUniqueSections(
    attemptedSections.filter(section => !ensureArray(editor.sections).some(finalSection => sectionsAreDuplicate(section, finalSection))),
    excludedSections
  );
  const staleScrub = scrubStaleClaims(editor, {
    date,
    removedSections,
    reporter
  });
  editor = validateEditor(staleScrub.editor, date, reporter, { strictClaims: true, requireStoryContract: true });
  factCheck = pruneResolvedStaleFactCheckItems(factCheck, staleScrub.report);
  factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
  generationRunState.factCheck = factCheck;
  writeJson(path.join(newsroomDir, 'stale-claim-report.json'), staleScrub.report);
  fs.writeFileSync(
    path.join(newsroomDir, 'stale-claim-report.md'),
    buildStaleClaimReportMarkdown(staleScrub.report),
    'utf8'
  );
  editor = sanitizeClaimEvidenceIds(editor, reporter, seedEvidencePack);
  editor = stampCoverageType(editor, shortlistReport);
  factCheck = pruneCatchUpFramingFactCheckItems(factCheck, editor);
  generationRunState.factCheck = factCheck;
  qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
    threshold: qualityGatePolicy.threshold,
    shortlistReport,
    staleClaimReport: staleScrub.report,
    strictClaimValidation: true,
    seedEvidencePack
  });
  generationRunState.qualityReport = qualityReport;

  // Per-article 발행 회복력(thin-week salvage). 전체 draft가 일부 기사의
  // per-article binding 실패(예: 한 소스의 claim-binding 분산) 때문에만 NEEDS_FIX이고,
  // mainArticleCount.min 이상의 기사가 깨끗이 통과하면, 전체를 실패시키지 않고
  // 통과한 subset만 발행한다. salvagePublishableSubset은 subset에 quality gate를
  // 다시 적용해 PASS일 때만 결과를 반환(아니면 null)하므로, bound 안 된 콘텐츠를
  // 발행하지 않고 이번 실행에서 바인딩 실패한 기사만 drop한다. attempt loop 종료
  // 후(맨 끝)에 연결해 retry/lock 제어 흐름에 영향을 주지 않는다.
  if (qualityReport.status !== 'PASS') {
    const salvage = salvagePublishableSubset(date, editor, reporter, factCheck, qualityReport, {
      threshold: qualityGatePolicy.threshold,
      shortlistReport,
      staleClaimReport: staleScrub.report,
      strictClaimValidation: true,
      seedEvidencePack
    });
    if (salvage) {
      console.warn(`Thin-week salvage: dropped ${salvage.dropped_section_count} unpublishable article(s); publishing ${salvage.kept_section_count}.`);
      editor = validateEditor(salvage.editor, date, reporter, { strictClaims: true, requireStoryContract: true });
      factCheck = salvage.factCheck;
      qualityReport = salvage.qualityReport;
      generationRunState.factCheck = factCheck;
      generationRunState.qualityReport = qualityReport;
    }
  }

  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  writeEditorDraftJson(path.join(newsroomDir, 'editor-draft.json'), editor, date);
  fs.writeFileSync(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(editor), 'utf8');
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
  fs.writeFileSync(path.join(newsroomDir, 'fact-check-report.md'), buildFactCheckMarkdown(date, factCheck), 'utf8');
  writeJson(path.join(newsroomDir, 'quality-report.json'), qualityReport);
  fs.writeFileSync(path.join(newsroomDir, 'quality-report.md'), buildQualityReportMarkdown(qualityReport), 'utf8');
  writeJson(path.join(newsroomDir, 'retry-history.json'), retryHistory);
  fs.writeFileSync(
    path.join(newsroomDir, 'retry-history.md'),
    buildRetryHistoryMarkdown(date, retryHistory, selectionStatusExtra(shortlistReport)),
    'utf8'
  );
  writeCostReport(date);

  editor.publish_mode = currentPublishMode(shortlistReport);
  // render는 callLlmJson 초크포인트를 거치지 않으므로 여기서 직접 계측한다(기록 전용).
  // 빌드/터미널 검증이 실패하면 render를 'failed'로 남겨 요약 다이어그램이 실패와 일치하게 한다.
  const renderAttempt = generationRunState.currentQualityAttempt;
  generationRunState.stageTracker.start('render', renderAttempt);
  let newsletterMarkdown;
  let newsletterHtmlContent;
  try {
    // 결정론적 '참고 / 더 읽을거리' 섹션: reference 윈도우(22~90일) 후보 중 적격 버킷의
    // dated+sourced 항목을 메인과 중복 없이 주입한다(LLM claim 없음).
    editor.reference_articles = buildReferenceArticles(
      ensureArray(shortlistReport?.reference_context_candidates),
      { excludeUrls: ensureArray(shortlistReport?.selected_articles).map(article => article && article.url).filter(Boolean) }
    );
    newsletterMarkdown = buildMarkdown(editor);
    newsletterHtmlContent = buildHtml(editor);
    assertTerminalPublicationContracts({
      date,
      editor,
      markdown: newsletterMarkdown,
      html: newsletterHtmlContent,
      newsroomDir,
      shortlistReport,
      qualityReport,
      factCheck
    });
    assertJsonArtifactsReadable([
      path.join(newsroomDir, 'editor-draft.json'),
      path.join(newsroomDir, 'background-context.json'),
      path.join(newsroomDir, 'fact-check-report.json'),
      path.join(newsroomDir, 'quality-report.json')
    ]);
    generationRunState.stageTracker.pass('render', renderAttempt);
  } catch (error) {
    generationRunState.stageTracker.fail('render', renderAttempt, 'render', error && error.message);
    throw error;
  }

  const baseFiles = [
    generationRunState.candidateInput?.candidate_artifact || collectedCandidatesRelPath(date),
    generationRunState.candidateInput?.manifest || '',
    newsroomRelPath(date, 'shortlisted-candidates.json'),
    newsroomRelPath(date, 'article-capsules.json'),
    newsroomRelPath(date, 'background-context.json'),
    newsroomRelPath(date, 'reporter-candidates.json'),
    newsroomRelPath(date, `editor-public-article-judge-attempt-${generationRunState.lastKnownValidAttempt || 1}.json`),
    newsroomRelPath(date, 'editor-draft.json'),
    newsroomRelPath(date, 'editor-draft.md'),
    newsroomRelPath(date, 'fact-check-report.json'),
    newsroomRelPath(date, 'fact-check-report.md'),
    newsroomRelPath(date, 'quality-report.json'),
    newsroomRelPath(date, 'quality-report.md'),
    newsroomRelPath(date, 'stale-claim-report.json'),
    newsroomRelPath(date, 'stale-claim-report.md'),
    newsroomRelPath(date, 'retry-history.json'),
    newsroomRelPath(date, 'retry-history.md'),
    newsroomRelPath(date, 'cost-report.md'),
    newsroomRelPath(date, 'recovery-prompt.md'),
    newsroomRelPath(date, '00-review-guide.md'),
    newsroomRelPath(date, 'editor-in-chief-brief.md'),
    newsroomRelPath(date, 'release-qa-report.md'),
    newsroomRelPath(date, 'artifact-manifest.json')
  ].filter(Boolean);

  fs.writeFileSync(
    path.join(newsroomDir, 'editor-in-chief-brief.md'),
    buildEditorChiefBrief(date, editor, factCheck, qualityReport, selectionStatusExtra(shortlistReport), staleScrub.report),
    'utf8'
  );

  const emptySourceSections = [];
  const todoFound = false;
  const mustFixCount = ensureArray(factCheck.must_fix).length;
  const generationStatus = classifyGenerationStatus({
    underfilled: shortlistReport.underfilled,
    factCheckStatus: factCheck.status,
    mustFixCount,
    qualityStatus: qualityReport.status
  });
  const editorialReviewable = isEditorialReviewableStatus(generationStatus);
  const failureKind = editorialReviewable ? FAILURE_KIND_EDITORIAL_REVIEWABLE : '';
  const newsletterMd = path.join(newsletterDir, 'newsletter.md');
  const newsletterHtml = path.join(newsletterDir, 'index.html');
  const shouldWritePublicArtifacts = !editorialReviewable;
  let weeklyArtifactFiles = [];
  if (shouldWritePublicArtifacts) {
    fs.writeFileSync(newsletterMd, newsletterMarkdown, 'utf8');
    fs.writeFileSync(newsletterHtml, newsletterHtmlContent, 'utf8');
    updateNewsletterData(date, editor);
    // 추가 weekly 출력(#486~#490): publish-ready일 때만 weekly 디렉터리 페이지/별도 인덱스를 생성하고,
    // 같은 주 안의 중복 기사는 LLM이 append/merge/reject로 결정하며 merge는 검증 통과 시에만 교체한다.
    // 데일리 산출물은 위에서 이미 기록했으므로, weekly 실패가 데일리 실행을 깨지 않도록 try/catch로 감싼다.
    try {
      const weeklyMerge = buildWeeklyMergeResolver({
        callLlmJson,
        validateMergedArticle: validateMergedWeeklyArticle
      });
      const weeklyResult = await writeWeeklyNewsletterArtifacts({
        root, date, editor, tags: issueTags(editor), ...weeklyMerge
      });
      weeklyArtifactFiles = weeklyResult.files;
      if (ensureArray(weeklyResult.mergeWarnings).length > 0 ||
        ensureArray(weeklyResult.mergeDecisions).some(decision => /merge/.test(decision.decision))) {
        writeJson(path.join(newsroomDir, 'weekly-merge-report.json'), {
          schema_version: 1,
          date,
          weekly_key: weeklyResult.weeklyKey,
          decisions: weeklyResult.mergeDecisions,
          warnings: weeklyResult.mergeWarnings
        });
      }
    } catch (error) {
      console.error(`weekly newsletter output skipped: ${error.message}`);
    }
  }
  const headlineArtifactResult = persistHeadlineStateArtifacts({
    date,
    shortlistReport,
    shouldWritePublicArtifacts,
    editor
  });
  if (headlineArtifactResult.exposureCoverage) {
    shortlistReport.article_exposure_coverage = headlineArtifactResult.exposureCoverage;
    writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
    writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);
  }
  const validateResult = editorialReviewable
    ? {
        ok: false,
        text: `${FAILURE_KIND_EDITORIAL_REVIEWABLE}: skipped public validation because this review PR is not publishable.`
      }
    : runValidate();
  const finalPublishReady =
    !editorialReviewable &&
    shortlistReport.publish_ready === true &&
    ensureArray(editor.sections).length >= articlePolicy.mainArticleCount.min &&
    ensureArray(editor.sections).length <= articlePolicy.mainArticleCount.max &&
    generationStatus === 'PASS' &&
    qualityReport.status === 'PASS' &&
    validateResult.ok &&
    !todoFound &&
    emptySourceSections.length === 0 &&
    mustFixCount === 0;
  const finalCompositionMode = finalPublishReady
    ? shortlistReport.composition_mode
    : generationStatus === 'UNDERFILLED_NEEDS_FIX'
      ? COMPOSITION_MODES.THIN_WEEK_REVIEW
      : COMPOSITION_MODES.NEEDS_FIX;
  const finalEditorReviewRequired =
    finalPublishReady === true
      ? false
      : editorialReviewable ||
        shortlistReport.editor_review_required === true ||
        finalCompositionMode !== COMPOSITION_MODES.NORMAL;
  const files = shouldWritePublicArtifacts
    ? baseFiles.concat([
        // changedArtifacts/review-inventory에 쓰이는 디스크-상대 경로(articles/ 아래).
        `articles/newsletters/${date}/newsletter.md`,
        `articles/newsletters/${date}/index.html`,
        'articles/data/newsletters.json',
        ...headlineArtifactResult.files,
        ...weeklyArtifactFiles
      ])
    : baseFiles;
  const generationStatusArtifact = buildGenerationStatus({
    date,
    status: generationStatus,
    retryHistory,
    qualityReport,
    factCheck,
    extra: {
      failure_stage: '',
      failure_reason: '',
      quality_status: qualityReport.status,
      quality_score: qualityReport.score,
      quality_threshold: qualityReport.threshold,
      quality_deduction_count: ensureArray(qualityReport.deductions).length,
      locked_article_count: retryHistory.at(-1)?.locked_article_headlines.length || 0,
      repaired_section_count: retryHistory.reduce((sum, item) => sum + ensureArray(item.regenerated_sections).length, 0),
      failed_section_count: retryHistory.at(-1)?.failed_sections.length || 0,
      skipped_repair_section_count: retryHistory.reduce((sum, item) => sum + ensureArray(item.skipped_repair_sections).length, 0),
      rejected_duplicate_article_count: retryHistory.reduce((sum, item) => sum + item.rejected_duplicate_headlines.length, 0),
      validate_ok: validateResult.ok,
      failure_kind: failureKind,
      public_output_expected: shouldWritePublicArtifacts,
      todo_found: todoFound,
      empty_source_sections: emptySourceSections,
      source_gap_count: factCheck.source_gap_count,
      stale_claim_status: staleScrub.report?.status || 'UNKNOWN',
      stale_claim_removed_count: ensureArray(staleScrub.report?.stale_claim_items_removed).length +
        ensureArray(staleScrub.report?.unsupported_release_claims_removed).length +
        ensureArray(staleScrub.report?.unused_references_removed).length,
      stale_claim_hard_failure_count: ensureArray(staleScrub.report?.hard_failures).length,
      completion_fallback_to_prepass: retryHistory.some(item => item.completion_fallback_to_prepass === true),
      ...editorSemanticStatusExtra(),
      ...selectionStatusExtra(shortlistReport, {
        renderedMainArticleCount: ensureArray(editor.sections).length,
        renderedGroupKeys: editorRenderedGroupKeys(editor),
        explicitlyDemotedGroups: editorExplicitlyDemotedGroups(editor),
        lockedArticleCount: retryHistory.at(-1)?.locked_article_headlines.length || 0,
        demotedArticleCount: retryHistory.at(-1)?.demoted_article_count ?? retryHistory.at(-1)?.demoted_sections?.length ?? 0,
        finalPublishReady,
        publishGatePassed: finalPublishReady,
        compositionMode: finalCompositionMode,
        editorReviewRequired: finalEditorReviewRequired
      })
    }
  });
  writeGenerationStatus(generationStatusArtifact);
  const reviewRunContext = {
    status: generationStatusArtifact.status,
    seedUsed: generationStatusArtifact.seed_used ?? generationStatusArtifact.candidate_input?.seed_used,
    publicOutputExpected: shouldWritePublicArtifacts
  };
  assertJsonArtifactsReadable([
    path.join(newsroomDir, 'generation-status.json')
  ]);

  if (todoFound) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: 'Generated newsletter contains TODO.', shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    writeDateReviewPackage({
      date,
      files,
      validateText: validateResult.text,
      factCheck,
      todoFound,
      emptySourceSections,
      qualityReport,
      runContext: reviewRunContext
    });
    fail('Generated newsletter contains TODO.');
  }
  if (emptySourceSections.length > 0) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: `Generated sections without sources: ${emptySourceSections.join(', ')}`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    writeDateReviewPackage({
      date,
      files,
      validateText: validateResult.text,
      factCheck,
      todoFound,
      emptySourceSections,
      qualityReport,
      runContext: reviewRunContext
    });
    fail(`Generated sections without sources: ${emptySourceSections.join(', ')}`);
  }
  if (!validateResult.ok && !shortlistReport.underfilled) {
    if (editorialReviewable) {
      writeRecoveryPrompt(newsroomDir, { date, stage: failureKind, reason: 'Editorial reviewable failure is not publishable.', shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
      writeDateReviewPackage({
        date,
        files,
        validateText: validateResult.text,
        factCheck,
        todoFound,
        emptySourceSections,
        qualityReport,
        runContext: reviewRunContext
      });
      console.warn(`${failureKind}: review artifacts were written without public newsletter files or data/newsletters.json updates.`);
      return;
    }
    // 품질/팩트체크는 통과(generationStatus === 'PASS')했지만 결정론적 발행 검증
    // (이미지 fallback, site retention 등)에 실패한 draft다. 발행 불가이므로, 발행 가능
    // 경로가 이미 쓴 newsletters.json 노출 항목을 되돌려서 일관된 diagnostics-only 리뷰
    // PR로 강등한다. 여기서 throw하면 terminal handler가 reviewable이 아닌 FAILED 상태로
    // 덮어써 리뷰 PR이 아예 안 생긴다.
    const unexposeResult = removeNewsletterIndexEntry(root, date);
    // 노출 제거가 실제로 실패하면(파일 손상/쓰기 오류) diagnostics-only로 강등할 수 없다.
    // 노출된 채 graceful return하면 merge 시 검증 실패한 뉴스레터가 발행되므로, 이 경우엔
    // 안전하게 fail()로 종료한다(리뷰 PR은 못 만들지만 잘못된 발행보다 낫다). 항목이 이미
    // 없으면 error는 빈 문자열이라 안전하게 통과한다.
    if (unexposeResult.error) {
      fail(`npm run validate failed and the newsletters.json entry could not be un-exposed (${unexposeResult.error}):\n${validateResult.text}`);
    }
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: `npm run validate failed:\n${validateResult.text}`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    writeDateReviewPackage({
      date,
      files,
      validateText: validateResult.text,
      factCheck,
      todoFound,
      emptySourceSections,
      qualityReport,
      runContext: reviewRunContext
    });
    console.warn(`npm run validate failed:\n${validateResult.text}\nPublishable draft failed publish validation; un-exposed the newsletters.json entry and downgraded to a diagnostics-only review PR.`);
    return;
  }
  if (!validateResult.ok && shortlistReport.underfilled) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'thin-week validation', reason: `Underfilled review-only draft did not pass publication validation:\n${validateResult.text}`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    console.warn('Underfilled review-only draft did not pass publication validation. Artifacts were written and publish_ready remains false.');
  } else if (generationStatus === 'NEEDS_FIX') {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'fact-check', reason: 'LLM fact checker returned NEEDS_FIX with must_fix items.', shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    console.warn('LLM fact checker returned NEEDS_FIX with must_fix items. Artifacts were written for editor review.');
  } else if (generationStatus === 'QUALITY_NEEDS_FIX') {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'quality', reason: `Newsletter quality score ${qualityReport.score}, threshold ${qualityReport.threshold}, result ${qualityReport.status}.`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    console.warn(`Newsletter quality score ${qualityReport.score}, threshold ${qualityReport.threshold}, result ${qualityReport.status}. Artifacts were written for editor review.`);
  } else if (generationStatus === 'UNDERFILLED_NEEDS_FIX') {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'thin-week selection', reason: shortlistReport.selection_warnings.join('; '), shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    console.warn('Underfilled thin-week draft is review-only. Artifacts were written for editor review.');
  }
  writeDateReviewPackage({
    date,
    files,
    validateText: validateResult.text,
    factCheck,
    todoFound,
    emptySourceSections,
    qualityReport,
    runContext: reviewRunContext
  });

  console.log(`LLM newsroom newsletter generated for ${date}`);
}

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

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    try {
      writeTerminalFailureStatus(error);
    } catch (statusError) {
      console.error(`Failed to write terminal generation status: ${statusError.message}`);
    }
    process.exit(1);
  });
}

module.exports = {
  STATUS_FAILED_REPAIR_REVIEWABLE,
  assertEditorRetryOutputContract,
  buildEditorRetryContract,
  buildGenerationStatus,
  editorSemanticStatusExtra,
  main,
  recordEditorSemanticStatus,
  availableCompletionCandidates,
  backgroundContextStageEnabled,
  applyRepairPatchesAndValidate,
  mergeLockedSections,
  normalizeSectionImageFields,
  recordLastKnownValidEditor,
  remapRepairPatchSections,
  validateCompletionSections,
  validateReporter,
  validateTargetedRepairResult,
  writeReviewableRepairFailureArtifacts,
  selectionStatusExtra,
  writeGenerationStatus,
  writeNewsletterDate,
  writeSelectionDiagnosticsArtifact
};
