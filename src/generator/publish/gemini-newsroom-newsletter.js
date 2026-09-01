const fs = require('fs');
const path = require('path');
const { ensureArray } = require('../../shared/common/value-coercion');
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
  factCheckSchema
} = require('../render/newsletter-schema');
const { isSafeExternalImageUrl } = require('../../shared/render/image-candidates');
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
  buildStaticBackgroundContextReport,
  filterBackgroundContextToSelected
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
  deductionMatchesSection
} = require('../quality/newsletter-quality');
const {
  dropVerifiedFactsClassifiedAsNonFact
} = require('../editor/editor-output-contract');
const {
  applyRepairPatches
} = require('../repair/repair-patch-contract');
const {
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief
} = require('../render/newsletter-renderer');
const {
  buildReferenceArticlesForIssue
} = require('../render/reference-articles');
const {
  buildPromptContexts
} = require('../reporter/newsletter-prompts');
const {
  numberOrDefault,
  sectionLabel,
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
  sectionMatchesRepairItem
} = require('./orchestrator-repair-plan');
const {
  fallbackCategories,
  booleanFromCandidate,
  imageCandidatesForReporterCandidate,
  collectedCandidateFor,
  validateReporter,
  enforceDeterministicReporterSelection,
  syncReporterSelectionToMain,
  selectedReporterCapsules,
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
  remapRepairPatchSections,
  validateCompletionSections
} = targetedRepairModule;
const {
  writeEditorDraftJson,
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
  factCheckSystemPrompt
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
  DERIVED_STAGE_KINDS,
  LLM_STAGES,
  derivedStageRun,
  stageRun
} = require('../../shared/llm/stage-catalog');
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
// main()의 두 validatePublicArticleJudgeOrRepair 호출처에 그대로 주입한다. validateOrRepairEditor는
// editor 단계(orchestrator-editor-stage.js)로 옮겨가 거기서 직접 import하므로 여기선 더 이상 받지 않는다.
const {
  buildBackgroundContextReport,
  currentPublishMode,
  validateEditor,
  validateTargetedRepairResult,
  applyRepairPatchesAndValidate,
  recordLastKnownValidEditor,
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
  availableCompletionCandidates
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

// attempt loop 안의 editor 단계(생성→검증/repair→결정론적 후처리)는 orchestrator-editor-stage.js로
// 분리했다(#655). 이 블록은 reviewable repair-failure로 main()을 early return 하던 유일한 지점을
// 포함하므로, plain 함수로는 그 return을 재현할 수 없다. 정상 경로는 reassign된 loop local
// (editor / attemptedSections / rejectedGeneratedSections)을, reviewable 경로는
// { reviewableReturn: true }를 반환해 호출처가 `if (reviewableReturn) return;`으로 원래 동작을
// 그대로 재현한다. 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접 import하는 clean
// importer라 god-file-local 주입이 없다.
const {
  runEditorStage
} = require('./orchestrator-editor-stage');
const {
  buildEditorialPlanReport
} = require('./orchestrator-editorial-plan-stage');
const {
  reconcileCoverage,
  candidateKey
} = require('../select/coverage-reconciliation');
const {
  compositionSummary,
  reviewCompositionGatePasses,
  publishReadyGateReasonSummary
} = require('../select/selection-composition-gates');

// attempt loop 안의 repair 패스 + completion 패스(editor + fact-check 단계 직후)는
// orchestrator-repair-completion.js로 분리했다(#655). 두 패스는 main()을 reviewable
// repair-failure로 early return 하던 지점을 두 군데 포함하므로(salvage 불가 repair 실패,
// pre-completion 비-PASS인 completion 실패), plain 함수로는 그 return을 재현할 수 없다. 정상
// 경로는 reassign된 loop local(editor/factCheck/qualityReport/demotedSections/repairActions/
// eligibilityFindings/attemptedSections/rejectedGeneratedSections + retry-history가 쓰는 나머지)을,
// reviewable 경로는 { reviewableReturn: true }를 반환해 호출처가 `if (reviewableReturn) return;`으로
// 원래 두 `return;`을 그대로 재현한다. 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접
// import하는 clean importer라 god-file-local 주입이 없다.
const {
  runRepairAndCompletionPasses
} = require('./orchestrator-repair-completion');

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
  // root를 넘겨야 선정이 state/article-exposure-history.json을 읽는다. 없으면 exposureHistory가
  // 항상 null이 되어 재게재 쿨다운 필터와 catch-up의 게재 이력 필터가 둘 다 조용히 죽는다(#963).
  // exposureHistory를 직접 만들어 넘기지 않고 root를 넘겨 기존 읽기 경로를 그대로 쓴다.
  let shortlistReport = buildShortlistReport(date, candidates, {
    root,
    selectionWindowPolicy: runtimeConfig.selectionWindowPolicy,
    coverageWeekKeyOverride: runtimeConfig.coverageWeekKeyOverride || undefined
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

  // #724 always-on: coverage 재조정은 매 attempt pristine 결정론 baseline에서 파생돼야 품질
  // 재시도에 누적되지 않는다. selected는 primary_selected_articles(재조정이 안 건드림)가 앵커하고,
  // reserve 풀과 결정론 publish_ready는 재조정이 shortlistReport를 mutate하기 전인 아래 pristine
  // 스냅샷이 앵커한다. 이 값들을 재조정 입력·publish_ready 기준으로 써서 attempt 간 멱등성을 지킨다.
  const pristineReserveCandidates = ensureArray(shortlistReport.reserve_candidates);
  const deterministicPublishReady = shortlistReport.publish_ready === true;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    generationRunState.currentQualityAttempt = attempt;
    // #909: 재조정 provenance는 이번 attempt의 사실이다. attempt가 재조정 전에 죽으면 직전
    // attempt의 강등 기록이 그대로 status에 실려 다른 편성의 사유를 이번 실행 것으로 읽게 된다.
    // 그래서 attempt 시작마다 비우고, 재조정이 실제로 돈 뒤에만 다시 채운다.
    shortlistReport.reconciliation_demoted_group_keys = [];
    shortlistReport.reconciliation_demoted_groups = [];
    // #1034: 채점 투영도 같은 수명이다. 직전 attempt의 채점 기록이 남으면 다른 편성의 판단을
    // 이번 실행 것으로 읽게 된다.
    shortlistReport.editorial_plan_scored_candidates = [];
    const lockedContext = buildLockedArticleContext(lockedSections, excludedSections);
    const reporterStage = stageRun(LLM_STAGES.REPORTER, { qualityAttempt: attempt, totalAttempts });
    const editorStage = stageRun(LLM_STAGES.EDITOR, { qualityAttempt: attempt, totalAttempts });
    const factCheckStage = stageRun(LLM_STAGES.FACT_CHECKER, { qualityAttempt: attempt, totalAttempts });
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
      stage: stageRun(LLM_STAGES.BACKGROUND_CONTEXT, { qualityAttempt: attempt, totalAttempts })
    });
    writeJson(path.join(newsroomDir, 'background-context.json'), backgroundContextReport);
    // #700: editorial plan(전용 LLM 호출, 필수 단계). 실패/빈 결과면 throw해서 editor 등 뒤 단계
    // 비용을 들이기 전에 파이프라인을 멈춘다. 성공하면 항상 유효한 plan이라 artifact를 기록하고
    // editor 작성을 안내한다.
    const editorialPlanReport = await buildEditorialPlanReport({
      date,
      articleCapsuleReport,
      commonContext,
      stage: stageRun(LLM_STAGES.EDITORIAL_PLAN, { qualityAttempt: attempt, totalAttempts })
    });
    writeJson(path.join(newsroomDir, 'editorial-plan.json'), editorialPlanReport);
    // #724: LLM coverage 등급을 결정론 재조정으로 main-set에 항상 반영한다(toggle 없음). 재조정
    // 입력은 항상 pristine 결정론 baseline(selected=primary_selected_articles, reserve=루프 밖에서
    // 캡처한 pristineReserveCandidates)이라 attempt 재시도에도 누적되지 않는다 — 이전 attempt가
    // shortlistReport.reserve_candidates를 mutate해도 재조정 입력은 pristine을 쓴다.
    const deterministicSelectedBaseline = ensureArray(shortlistReport.primary_selected_articles).length > 0
      ? shortlistReport.primary_selected_articles
      : shortlistReport.selected_articles;
    const coverageReconciliation = reconcileCoverage({
      shortlistReport: {
        selected_articles: deterministicSelectedBaseline,
        reserve_candidates: pristineReserveCandidates,
        // #1034: 판정 입력이 아니라 채점 투영 전용 우주다. 편집 계획은 바로 위에서
        // capsuleInputFromReport(articleCapsuleReport, 'shortlisted')로 채점하고, 그 capsule은
        // buildArticleCapsuleReport가 reporter.candidates에서 1:1로 만든다. 같은 배열을 넘겨야
        // 투영 우주와 채점 우주가 일치한다 — 좁히면 매주 채점된 후보 1~2건이 기록에서 빠진다.
        shortlisted_candidates: reporter.candidates
      },
      editorialPlanReport
    });
    writeJson(path.join(newsroomDir, 'coverage-reconciliation.json'), coverageReconciliation.diff);
    const reconciledSelected = coverageReconciliation.selected;
    const reconciledSelectedKeys = new Set(reconciledSelected.map(candidateKey));
    shortlistReport.selected_articles = reconciledSelected;
    // 승급된 reserve는 reserve_candidates에서 제거해 selected/reserve 캡슐 중복을 막는다.
    shortlistReport.reserve_candidates = ensureArray(shortlistReport.reserve_candidates)
      .filter(candidate => !reconciledSelectedKeys.has(candidateKey(candidate)));
    // 재조정된 편성으로 composition_summary·publish_ready를 재계산한다. publish_ready는 결정론
    // 값(deterministicPublishReady)에서 단조 하향만 한다 — 결정론이 not-ready였으면 그대로 두고,
    // 재조정 편성이 composition/publish 게이트를 못 넘으면 false로 낮춘다(결정론 편성 불변식을
    // 재조정이 우회하지 못하게). 기준을 shortlistReport.publish_ready가 아닌 결정론 스냅샷으로
    // 두어, 이전 attempt의 일시적 false가 다음 attempt를 영구 차단하지 않게 한다.
    const reconciledSummary = compositionSummary(reconciledSelected);
    shortlistReport.composition_summary = reconciledSummary;
    // #837: main 집합에서 파생되는 요약도 같이 갱신한다. 정본(selected_articles)만
    // 갈아끼우고 selected_article_count/selected_group_count/
    // selected_representative_group_keys를 결정론 시점 값으로 두면, 같은 artifact 안에서
    // composition_summary(재조정 후)와 top-level 카운트(재조정 전)가 모순되고
    // generation-status의 coverage 등식 좌변만 재조정 前 값이 되어 정상 발행에도
    // group_coverage_ok=false가 찍힌다(실측: 2026-07-20·2026-08-03).
    Object.assign(shortlistReport, coverageReconciliation.selection_summary);
    // 강등/승급 사실은 coverage 등식에 참여하지 않는 별도 필드로 남긴다.
    // explicitly_demoted_group_keys는 editor가 스스로 선언한 강등 전용이고
    // (article-groups.js의 explicitDemotedGroups가 editor 출력만 읽는다), 거기에 합치면
    // 등식이 selected 4 !== rendered 4 + demoted 1로 새로 깨진다. 유일하게 이 사실을
    // 담고 있던 coverage-reconciliation.json은 커밋되지 않으므로, 여기서 남기지 않으면
    // "결정론 5건이 왜 4건이 됐는지"를 발행 후에 추적할 방법이 사라진다.
    shortlistReport.deterministic_selected_representative_group_keys =
      coverageReconciliation.diff.deterministic_selected_group_keys;
    shortlistReport.reconciliation_demoted_group_keys = coverageReconciliation.diff.demoted_group_keys;
    // #909: 키 옆에 사유를 함께 남긴다. 원본 판단(coverage_decision)과 실제 전환 원인
    // (reason_code=cap_clamp | editorial_plan_*)이 갈라져 있어야 "왜 빠졌나"에 답할 수 있다.
    shortlistReport.reconciliation_demoted_groups = coverageReconciliation.diff.demoted_groups;
    // #1034: 강등되지 않은 채점 후보(reserve·shortlisted·catch-up pool)는 위 목록에 나타나지
    // 않는다. 계획이 채점한 후보 전부를 함께 남겨야 "왜 이 후보는 main이 아니었나"에 답할 수
    // 있다. 사유는 강등·승급 차단·floor backfill 복귀·승급에만 붙고, 아무 일도 없던 후보는 null이다.
    shortlistReport.editorial_plan_scored_candidates = coverageReconciliation.diff.editorial_plan_scored_candidates;
    shortlistReport.reconciliation_promoted_group_keys = coverageReconciliation.diff.promoted_group_keys;
    shortlistReport.publish_ready = deterministicPublishReady
      && reviewCompositionGatePasses(reconciledSummary)
      && publishReadyGateReasonSummary(reconciledSummary).length === 0;
    generationRunState.selectedInputs = shortlistReport.selected_articles;
    // 재조정된 main-set에 맞춰 reporter 선택 플래그를 재동기화한다. 이것이 없으면
    // editor/fact-check/repair/completion/judge(전부 selectedReporterCapsules 소비)가 재조정 前
    // 집합을 작성·검증해 발행 콘텐츠가 publish_ready/composition 게이트가 승인한 편성과 어긋난다.
    reporter = syncReporterSelectionToMain(reporter, reconciledSelected);
    articleCapsuleReport = buildArticleCapsuleReport(date, shortlistReport, { date, candidates: reporter.candidates }, {
      seedEvidencePack
    });
    writeJson(path.join(newsroomDir, 'article-capsules.json'), articleCapsuleReport);
    for (const candidate of ensureArray(reporter.candidates)) {
      writeCacheRecord(candidate, cacheDir, { stage: reporterStage.label, model: getLlmModelUsage(reporterStage) || 'unknown' });
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
    // editor 단계(생성→검증/repair→결정론적 후처리)는 orchestrator-editor-stage.js로 분리했다(#655).
    // 이 블록만 reviewable repair-failure로 main()을 early return 하던 지점을 품고 있어, plain
    // 함수로는 그 return을 재현할 수 없다. 그래서 정상 경로는 reassign된 loop local
    // (editor / attemptedSections / rejectedGeneratedSections)을 반환하고, reviewable 경로는
    // { reviewableReturn: true }를 반환한다. 아래 `if (editorStageResult.reviewableReturn) return;`는
    // 원래 catch 안의 `return;`(값 없이 main() 종료, 이후 코드 미실행)과 동일하다.
    let rejectedGeneratedSections;
    const editorStageResult = await runEditorStage({
      date,
      reporter,
      attempt,
      editorStage,
      editorRetryContract,
      publishMode,
      commonContext,
      lockedContext,
      lockedSections,
      excludedSections,
      newsroomDir,
      articleCapsuleReport,
      // #908: background context는 재조정 前 selected 뷰로 만들어졌다(위 buildBackgroundContextReport).
      // 재조정이 main에서 뺀 기사의 배경 설명까지 editor에 넘기면 editor가 그 기사도 다뤄야 할 대상으로
      // 보고 explicitly_demoted_groups에 선언하고, 그 선언은 선택 집합 밖이라 커버리지 등식을 깨뜨린다
      // (2026-08-17 실측: selected 1 !== rendered 1 + demoted 4라 발행 전체가 diagnostics-only).
      // 좁히기는 이 인자에만 건다 — 공유 변수를 덮어쓰면 completion 단계까지 좁혀져 reserve 후보를
      // 추가 기사로 승격할 때 그 후보의 배경이 사라진다. artifact도 원본을 그대로 남긴다.
      // editorialPlanReport는 거르지 않는다 — 설계상 shortlisted(후보 풀) 뷰이고(#724) editor용 사본은
      // coverage_decision/impact_level이 제거된다(#700). 거르면 reserve 승급 등급이 사라진다.
      backgroundContextReport: filterBackgroundContextToSelected(backgroundContextReport, reconciledSelected),
      editorialPlanReport,
      shortlistReport,
      seedEvidencePack,
      editor,
      attemptedSections,
      factCheck,
      qualityReport,
      retryHistory,
      root
    });
    if (editorStageResult.reviewableReturn) return;
    ({ editor, attemptedSections, rejectedGeneratedSections } = editorStageResult);

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
    // editor + fact-check 단계 직후의 repair 패스 + completion 패스는
    // orchestrator-repair-completion.js로 분리했다(#655). 두 reviewable repair-failure return을
    // { reviewableReturn: true }로 표면화해 호출처가 원래 두 `return;`을 그대로 재현하고, 정상
    // 경로는 reassign된 loop local을 반환해 main()이 되묶는다. 아래 loop local들은 분리 전 블록
    // 시작부에서 `let`으로 선언되던 값으로, 이후 loop tail(retry-history 기록)에서 읽히므로 호출
    // 직전에 main() loop scope로 옮겨 선언하고 정상 경로 반환값으로 되묶는다.
    let demotedSections;
    let repairActions;
    let replacedSections;
    let failedSections;
    let regeneratedSections;
    let rejectedRetryOutputs;
    let reserveCandidatesUsed;
    let reservePoolOpened;
    let reserveOpenReason;
    let candidateRejections;
    let underfilledReason;
    let completionFallbackToPrepass;
    let repairPlan;
    let skippedRepairPlan;
    const passResult = await runRepairAndCompletionPasses({
      date,
      reporter,
      attempt,
      totalAttempts,
      commonContext,
      lockedContext,
      lockedSections,
      excludedSections,
      newsroomDir,
      articleCapsuleReport,
      backgroundContextReport,
      shortlistReport,
      seedEvidencePack,
      root,
      retryHistory,
      qualityGateContext,
      mainArticleCountBeforeRepair,
      editor,
      factCheck,
      qualityReport,
      attemptedSections,
      eligibilityFindings,
      rejectedGeneratedSections
    });
    if (passResult.reviewableReturn) return;
    ({
      editor,
      factCheck,
      qualityReport,
      attemptedSections,
      eligibilityFindings,
      rejectedGeneratedSections,
      demotedSections,
      repairActions,
      replacedSections,
      failedSections,
      regeneratedSections,
      rejectedRetryOutputs,
      reserveCandidatesUsed,
      reservePoolOpened,
      reserveOpenReason,
      candidateRejections,
      underfilledReason,
      completionFallbackToPrepass,
      repairPlan,
      skippedRepairPlan
    } = passResult);

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
        `public-article-judge=${getLlmModelUsage(derivedStageRun(editorStage, DERIVED_STAGE_KINDS.PUBLIC_ARTICLE_JUDGE)) || 'unknown'}`,
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
  generationRunState.stageTracker.start({ stageId: 'render', role: 'render', attempt: renderAttempt });
  let newsletterMarkdown;
  let newsletterHtmlContent;
  try {
    // 결정론적 '참고 / 더 읽을거리' 섹션: 적격 버킷의 dated+sourced 후보를 메인과 중복 없이
    // 주입한다(LLM claim 없음). reference 윈도우 후보만 넣으면 primary/fallback 창에서 main
    // 경쟁에 진 카메라 코어 후보가 뉴스레터에 흔적 없이 사라진다 — 실측 2026-08-10: 창 안
    // 적격 후보 12건 중 기사는 2건뿐이었고, AOSP Camera ITS 문서 갱신 2건을 포함한 나머지는
    // 어느 섹션에도 나오지 않았다. 풀 조립·제외 규칙은 reference-articles 모듈이 단일 출처다.
    editor.reference_articles = buildReferenceArticlesForIssue(shortlistReport);
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
    generationRunState.stageTracker.pass({ stageId: 'render', role: 'render', attempt: renderAttempt });
  } catch (error) {
    generationRunState.stageTracker.fail({
      stageId: 'render',
      role: 'render',
      attempt: renderAttempt,
      reason: error && error.message
    });
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
