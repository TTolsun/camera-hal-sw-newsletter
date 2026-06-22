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
  getLlmModelUsage
} = require('../../shared/llm/llm-client');
const {
  reporterSchema,
  editorSchema,
  editorCompletionSchema,
  editorRepairPatchSchema,
  factCheckSchema,
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
  renderCandidateSelectionDiagnostics
} = require('../select/selection-diagnostics');
const {
  roleFromStageLabel
} = require('../select/stage-status-tracker');
const {
  buildStaleClaimReportMarkdown,
  pruneResolvedStaleFactCheckItems,
  scrubStaleClaims
} = require('../quality/stale-claims');
const {
  articlePolicy,
  qualityGatePolicy,
  publishGateCriteriaText
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
const { generationRunState } = require('./orchestrator-run-state');
const { runQualityGateAndPersist } = require('./orchestrator-quality-gate-runner');
const {
  repairEditorSemanticWithLlm,
  validatePublicArticleJudgeOrRepair
} = require('./orchestrator-public-article-judge');
const {
  reporterSystemPrompt,
  editorSystemPrompt,
  factCheckSystemPrompt,
  editorRepairPatchSystemPrompt,
  factCheckRepairSystemPrompt,
  editorCompletionSystemPrompt,
  factCheckCompletionSystemPrompt
} = require('./orchestrator-stage-prompts');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);
const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
const sourceRegistryPath = path.join(root, 'src', 'shared', 'data', 'news-sources.json');
const STATUS_FAILED_REPAIR_REVIEWABLE = 'FAILED_REPAIR_REVIEWABLE';
const FAILURE_KIND_EDITORIAL_REVIEWABLE = 'editorial_reviewable';

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

// generation-status artifact 본체와 editor-semantic/selection extra builder는
// orchestrator-status-builders.js로 분리했다(#655). 네 함수의 의존성은 모두 module-level
// import 또는 generationRunState라 god-file-local 주입이 필요 없고, 같은 이름으로 재노출해
// 호출처와 module.exports를 그대로 유지한다.
const {
  buildGenerationStatus,
  recordEditorSemanticStatus,
  editorSemanticStatusExtra,
  selectionStatusExtra
} = require('./orchestrator-status-builders');

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

// editor public-article judge / semantic repair 비동기 흐름은
// orchestrator-public-article-judge.js로 분리되어 있다. callLlmJson/recordEditorSemanticStatus/
// validateEditor는 god-file local(run-state 결합)이라 deps 객체로 묶어 주입한다.
const publicArticleJudgeDeps = { callLlmJson, recordEditorSemanticStatus, validateEditor };

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
    }, publicArticleJudgeDeps)
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
  }, publicArticleJudgeDeps);
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

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    generationRunState.currentQualityAttempt = attempt;
    const lockedContext = buildLockedArticleContext(lockedSections, excludedSections);
    const reporterStage = `reporter attempt ${attempt}/${totalAttempts}`;
    const editorStage = `editor attempt ${attempt}/${totalAttempts}`;
    const factCheckStage = `fact-checker attempt ${attempt}/${totalAttempts}`;
    console.log(`Starting LLM newsroom quality attempt ${attempt}/${totalAttempts}. Locked articles: ${lockedSections.length}.`);

    reporter = validateReporter(await callLlmJson(
      reporterStage,
      reporterSystemPrompt({ hasLockedSections: lockedSections.length > 0 }),
      `${reporterContext}\n\n${lockedContext}\n\nArticle capsule shortlist JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, 'shortlisted'), null, 2)}\n\nCompact selection context JSON:\n${JSON.stringify(compactSelectionContext(shortlistReport), null, 2)}`,
      reporterSchema
    ), date, reporterInput.candidates);
    reporter = enforceDeterministicReporterSelection(reporter, shortlistReport);
    shortlistReport = normalizeShortlistReport(shortlistReport, reporter);
    generationRunState.shortlistReport = shortlistReport;
    generationRunState.selectedInputs = shortlistReport.selected_articles;
    // 이 attempt의 품질 게이트 실행에 필요한, attempt 내내 변하지 않는 입력/협력자 묶음.
    // reporter/shortlistReport는 여기서 확정된 뒤 attempt/repair/completion 호출까지
    // 재할당되지 않는다(다음 normalizeShortlistReport는 completion 호출 이후). 가변
    // editor/factCheck/attempt만 호출 시점에 넘기고 나머지는 runner로 전달한다.
    // recordLastKnownValidEditor는 god-file local(editor 검증 체인)이라 주입한다.
    const qualityGateContext = {
      date,
      reporter,
      shortlistReport,
      seedEvidencePack,
      newsroomDir,
      qualityThreshold: qualityGatePolicy.threshold,
      recordLastKnownValidEditor
    };
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
      editorSystemPrompt({ editorRetryContract, publishMode, hasLockedSections: lockedSections.length > 0, hasCatchUpCoverage: ensureArray(shortlistReport?.selected_articles).some(item => item.coverage_type === 'catch_up') }),
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
      factCheckSystemPrompt(),
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

    ({ editor, qualityReport } = runQualityGateAndPersist(editor, factCheck, attempt, 'attempt', qualityGateContext));

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
            editorRepairPatchSystemPrompt(),
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
        }, publicArticleJudgeDeps);
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
          factCheckRepairSystemPrompt(),
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

        ({ editor, qualityReport } = runQualityGateAndPersist(editor, factCheck, attempt, 'repair', qualityGateContext));
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
            editorCompletionSystemPrompt({ missingArticleCount }),
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
          }, publicArticleJudgeDeps);
          attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
          await resolveIssueArticleImages(editor, { root });
          warnResolvedImageFallbacks(editor);
          // #502: 영속화·fact-check 이전에 미해결 evidence_id를 결정론적으로 재바인딩(fail-closed).
          editor = reconcileFactClaimEvidence(editor, { reporter, seedEvidencePack });
          writeJson(path.join(newsroomDir, `editor-completion-attempt-${attempt}.json`), editor);
          fs.writeFileSync(path.join(newsroomDir, `editor-completion-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

          factCheck = validateFactCheck(await callLlmJson(
            completionFactCheckStage,
            factCheckCompletionSystemPrompt(),
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

          ({ editor, qualityReport } = runQualityGateAndPersist(editor, factCheck, attempt, 'completion', qualityGateContext));
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
