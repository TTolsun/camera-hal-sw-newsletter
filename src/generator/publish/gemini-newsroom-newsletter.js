const fs = require('fs');
const path = require('path');
const {
  kstDate,
  readJson,
  readTextIfExists,
  writeJson
} = require('../../shared/common/common');
const {
  collectedCandidatesRelPath,
  newsroomDir: artifactNewsroomDir,
  newsroomRelPath
} = require('../../shared/common/artifact-paths');
const {
  resolveCandidateInputArtifact
} = require('../../shared/common/candidate-artifacts');
const { readRuntimeConfig } = require('../../shared/common/runtime-config');
const {
  getLlmModelUsage
} = require('../../shared/llm/llm-client');
const {
  reporterSchema,
  editorSchema,
  editorCompletionSchema,
  editorRepairPatchSchema,
  factCheckSchema
} = require('../render/newsletter-schema');
const { isSafeExternalImageUrl } = require('../../shared/render/image-candidates');
const { resolveIssueArticleImages } = require('../render/article-image-resolver');
const {
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
  normalizeShortlistReport
} = require('../select/selection-diagnostics');
const {
  articlePolicy,
  qualityGatePolicy
} = require('../../shared/common/newsletter-policy');
const { classifyHalImpact } = require('../reporter/hal-impact-classifier');
const {
  mergePublicArticleFromLlm
} = require('../reporter/public-article-contract');
const {
  buildQualityReportMarkdown,
  deductionMatchesSection,
  hardBlockedGroupsForDroppedSections,
  salvagePublishableSubset
} = require('../quality/newsletter-quality');
const {
  dropVerifiedFactsClassifiedAsNonFact,
  EditorSemanticValidationError,
  reconcileFactClaimEvidence
} = require('../editor/editor-output-contract');
const {
  applyRepairPatches,
  REPAIR_PATCH_CONTRACT_VIOLATION
} = require('../repair/repair-patch-contract');
const {
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief,
  ensureArray
} = require('../render/newsletter-renderer');
const {
  buildReferenceArticles
} = require('../render/reference-articles');
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
  backgroundContextStageEnabled,
  buildRetryHistoryMarkdown
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

// callLlmJson 계측 래퍼(#398)는 orchestrator-llm-instrumentation.js로 분리했다(#655).
// 모든 LLM 단계가 이 한 지점을 통과하는 핵심 seam이라 같은 이름으로 import해 모든 호출처와
// publicArticleJudgeDeps 주입을 그대로 유지한다. runNpmScript/runValidate/containsTodo/
// readSeedEvidencePackForDate process·IO 헬퍼는 orchestrator-validate-runner.js로 분리했다.
const { callLlmJson } = require('./orchestrator-llm-instrumentation');
const {
  readSeedEvidencePackForDate
} = require('./orchestrator-validate-runner');

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

// 00-review-guide.md / release-qa-report.md / artifact-manifest.json을 한 묶음으로 쓰는
// near-pure writer는 orchestrator-review-package-writer.js로 분리했다(#655). 같은 이름으로
// 재노출해 호출처와 io 주입을 그대로 유지한다.
const {
  writeDateReviewPackage
} = require('./orchestrator-review-package-writer');

const {
  buildEditorRetryContract,
  assertEditorRetryOutputContract
} = require('./orchestrator-editor-retry-contract');

// editor-validation cluster(buildBackgroundContextReport / currentPublishMode / validateEditor /
// validateTargetedRepairResult / applyRepairPatchesAndValidate / recordLastKnownValidEditor /
// validateOrRepairEditor)와 publicArticleJudgeDeps는 orchestrator-editor-validation.js로 분리했다(#655).
// 모두 publish-mode(generationRunState)에 결합된 editor 검증 seam이라 같은 이름으로 import해
// main()의 모든 호출처와 module.exports를 그대로 유지한다. publicArticleJudgeDeps도 거기서 만들어
// main()의 두 validatePublicArticleJudgeOrRepair 호출처에 그대로 주입한다.
const {
  buildBackgroundContextReport,
  currentPublishMode,
  validateEditor,
  validateTargetedRepairResult,
  applyRepairPatchesAndValidate,
  recordLastKnownValidEditor,
  validateOrRepairEditor,
  publicArticleJudgeDeps
} = require('./orchestrator-editor-validation');

// repair가 유효한 editor draft 이후에 실패했을 때 last-known-valid editor로 fallback해
// FAILED_REPAIR_REVIEWABLE 리뷰 묶음을 쓰는 writeReviewableRepairFailureArtifacts는
// orchestrator-repair-failure-artifacts.js로 분리했다(#655). 모든 협력자가 이미 분리된 sibling
// 모듈에서 직접 import되는 clean importer라 god-file-local 주입이 없고, 같은 이름으로 재노출해
// main()의 호출처와 module.exports(+targeted-retry.test.js 직접 호출)를 그대로 유지한다.
const {
  writeReviewableRepairFailureArtifacts
} = require('./orchestrator-repair-failure-artifacts');

// main()이 던진 어떤 실패든 받아 reviewable diagnostics PR로 라우팅하는 terminal failure 집계기
// writeTerminalFailureStatus는 orchestrator-terminal-failure.js로 분리했다(#655). 협력자(실패 분류,
// reviewable repair 묶음, recovery/selection-diagnostics writer, status builder/extra,
// generation-status/cost-report writer, generationRunState)는 모두 이미 분리된 sibling/shared
// 모듈에서 직접 import되는 clean importer라 god-file-local 주입이 없고, 같은 이름으로 재노출해
// require.main bootstrap catch의 호출처를 그대로 유지한다. root/runtimeConfig는 거기서
// process.cwd()/readRuntimeConfig로 동일하게 재파생한다.
const {
  writeTerminalFailureStatus
} = require('./orchestrator-terminal-failure');

// publish-ready 종착점에서 공개 산출물 계약을 단언하는 terminal publication 헬퍼
// (assertJsonArtifactsReadable / assertTerminalPublicationContracts)는
// orchestrator-terminal-contracts.js로 분리했다(#655). 협력자는 모두 이미 분리된 sibling/shared
// 모듈에서 직접 import되는 clean importer라 god-file-local 주입이 없고, 같은 이름으로 재노출해
// main()의 호출처를 그대로 유지한다. root/dataPath는 거기서 process.cwd() 기준으로 동일하게
// 재파생한다. 공개 산출물 기록(updateNewsletterData / persistHeadlineStateArtifacts)은
// orchestrator-publish-decision.js가 직접 import해 발행 가부 결정 블록 안에서 호출한다.
const {
  assertJsonArtifactsReadable,
  assertTerminalPublicationContracts
} = require('./orchestrator-terminal-contracts');

// 이미지 fallback 경고/오탐 정리(warnResolvedImageFallbacks /
// pruneResolvedFallbackImageFalsePositives)는 orchestrator-image-warnings.js로 분리했다(#655).
// 의존성은 ensureArray와 pruneResolvedFallbackImageFactCheckItems(+root)뿐인 clean importer라
// god-file-local 주입이 없고, 같은 이름으로 재노출해 main()의 호출처와 module.exports를 그대로
// 유지한다.
const {
  warnResolvedImageFallbacks,
  pruneResolvedFallbackImageFalsePositives
} = require('./orchestrator-image-warnings');

const {
  candidateDuplicateReason,
  retryRejectionRecord,
  reserveUsageForSections,
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

const {
  availableCompletionCandidates,
  buildCompletionExclusionContext
} = require('./orchestrator-completion');

// recovery-prompt.md / selection-diagnostics.md(+ selection-report) writer는
// orchestrator-recovery-writers.js로 분리했다(#655). 같은 이름으로 재노출해 호출처와
// module.exports를 그대로 유지한다.
const {
  writeRecoveryPrompt,
  writeSelectionDiagnosticsArtifact
} = require('./orchestrator-recovery-writers');

// attempt loop 종료 후 한 번만 실행되는 결정론적 finalize 블록(runtime-demoted shortlist 반영 +
// stale-claim scrub/산출물 + thin-week salvage)은 orchestrator-finalize.js로 분리했다(#655).
// 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접 import하는 clean importer라
// god-file-local 주입이 없고, main()의 loop local을 reads로 받아 reassign된 상태를 반환한다.
const {
  finalizeDraftAfterAttempts
} = require('./orchestrator-finalize');

// render/headline 기록 직후, terminal recovery routing 직전의 결정론적 발행 가부 결정 +
// generation-status 기록 블록은 orchestrator-publish-decision.js로 분리했다(#655). 협력자는 모두
// 이미 분리된 sibling/shared 모듈에서 직접 import하는 clean importer라 god-file-local 주입이 없고,
// main()의 reads를 받아 이후 terminal routing이 쓰는 값만 반환한다. 공개 산출물 기록과 npm validate
// 실행(side effect)은 거기서 그대로 수행한다.
const {
  decidePublishReadinessAndWriteStatus
} = require('./orchestrator-publish-decision');

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

  // attempt loop 종료 후 한 번만 실행되는 결정론적 finalize 블록(runtime-demoted
  // shortlist 반영 + stale-claim scrub/산출물 + thin-week salvage)은 orchestrator-finalize.js로
  // 분리했다(#655). loop local을 그대로 넘기고 reassign된 editor/factCheck/qualityReport/
  // shortlistReport와 이후 main()에서 쓰이는 staleScrub을 받아 같은 값으로 되묶는다.
  let staleScrub;
  ({ editor, factCheck, qualityReport, shortlistReport, staleScrub } = finalizeDraftAfterAttempts({
    date,
    editor,
    factCheck,
    qualityReport,
    reporter,
    shortlistReport,
    newsroomDir,
    seedEvidencePack,
    excludedSections,
    attemptedSections
  }));

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
  const {
    editorialReviewable,
    shouldWritePublicArtifacts,
    failureKind,
    validateResult,
    generationStatus,
    files,
    generationStatusArtifact
  } = await decidePublishReadinessAndWriteStatus({
    date,
    editor,
    factCheck,
    qualityReport,
    shortlistReport,
    retryHistory,
    staleScrub,
    newsroomDir,
    newsletterDir,
    newsletterMarkdown,
    newsletterHtmlContent,
    mustFixCount,
    todoFound,
    emptySourceSections,
    baseFiles
  });
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
