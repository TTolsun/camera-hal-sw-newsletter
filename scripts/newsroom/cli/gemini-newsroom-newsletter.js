const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  kstDate,
  readJson,
  readTextIfExists,
  writeJson
} = require('../common/common');
const {
  collectedCandidatesRelPath,
  newsroomDir: artifactNewsroomDir,
  newsroomRelPath
} = require('../common/artifact-paths');
const {
  CandidateArtifactValidationError,
  resolveCandidateInputArtifact
} = require('../common/candidate-artifacts');
const { readRuntimeConfig } = require('../common/runtime-config');
const {
  buildCostReport,
  buildCostReportMarkdown,
  callLlmJson,
  getLlmDiagnostics,
  getLlmCostCalls,
  getLlmModelUsage
} = require('../llm/llm-client');
const {
  reporterSchema,
  editorSchema,
  editorCompletionSchema,
  factCheckSchema,
  backgroundContextSchema
} = require('../render/newsletter-schema');
const { isSafeExternalImageUrl } = require('../render/image-candidates');
const { resolveIssueArticleImages } = require('../render/article-image-resolver');
const {
  COMPOSITION_MODES,
  buildShortlistReport,
  normalizeUrl,
  normalizedUrlHash,
  reporterInputFromShortlist
} = require('../generate/newsroom-selection');
const { BUCKETS, BUCKET_PRIORITY } = require('../common/aosp-camera-scope');
const {
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext
} = require('../generate/article-capsules');
const {
  buildStaticBackgroundContextReport
} = require('../generate/background-context');
const {
  inferImpactClaimLevel
} = require('../generate/article-field-builder');
const {
  annotateCandidatesWithCache,
  buildSummaryCacheReport,
  buildSummaryCacheReportMarkdown,
  writeCacheRecord
} = require('../generate/news-summary-cache');
const {
  isFinalSelected,
  normalizeReporterReport,
  normalizeShortlistReport,
  renderCandidateSelectionDiagnostics,
  selectionDiagnosticsFromReports
} = require('../generate/selection-diagnostics');
const {
  buildStaleClaimReportMarkdown,
  pruneResolvedStaleFactCheckItems,
  scrubStaleClaims
} = require('../common/stale-claims');
const {
  articlePolicy,
  articleCountRangeText,
  qualityGatePolicy,
  publishGateCriteriaText
} = require('../common/newsletter-policy');
const {
  pruneResolvedFallbackImageFactCheckItems
} = require('../common/fact-check-repair');
const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown,
  deductionMatchesSection,
  sectionHasSourceGap,
  sectionPassesArticleGate
} = require('../validate/newsletter-quality');
const {
  EditorSemanticValidationError,
  repairEditorOutputContract,
  serializeEditorValidationError,
  validateEditorOutputContract
} = require('../validate/editor-output-contract');
const {
  validateRenderedIssueStructure
} = require('../validate/rendered-issue-structure');
const {
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief,
  buildReleaseQaReport,
  issueTags,
  ensureArray
} = require('../render/newsletter-renderer');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);
const dataPath = path.join(root, 'data', 'newsletters.json');
const sourceRegistryPath = path.join(root, 'data', 'news-sources.json');
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
  repairAttempted: false,
  repairSucceeded: false,
  candidateInput: null
};

function fail(message) {
  throw new Error(message);
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function linkedEvidencePromptGuardrails() {
  return [
    'Linked evidence diagnostics are not included in the prompt payload. Do not infer Gerrit, IssueTracker, GitHub, mailing-list, CVE, or linked-page details unless they appear in the supplied article capsule or source fields.',
    'Editor draft text is not linked evidence. Treat draft mentions of Gerrit, IssueTracker, GitHub, mailing-list, CVE, or linked-page details as claims to verify, not as source-backed facts.',
    'Do not describe blocked, failed, skipped, or unsupported linked evidence as confirmed detail.',
    'Do not treat build_dependency_fix, test_only_change, or documentation_only signals as HAL runtime, stream, buffer, metadata, request/result, implementation, or product behavior changes.',
    'Do not claim high HAL/runtime impact unless supplied evidence explicitly names stream, buffer, metadata, request, result, ImageCapture, VideoCapture, Surface, or CameraPipe behavior.'
  ].join('\n');
}

function sourceExtractionPromptGuardrails() {
  return [
    'Source extraction contract: treat source_extraction as source-confirmed structured facts only, and treat derived_editorial_hints as editorial guidance only.',
    'Source quality contract: consume canonical source_quality as supplied. Do not infer, repair, or override missing source quality fields inside Stage 3 generation.',
    'Treat main_article_source_allowed=false as a hard blocker for main article generation. Mention blocked candidates only as watchlist/context when selection input explicitly allows it.',
    'Do not override source_quality.main_article_source_blockers[] or main_article_source_blockers[] from prose reasoning.',
    'Do not use blocked or failed linked evidence as factual support.',
    'Seed evidence contract: use only supplied seed_evidence.compact_evidence facts and evidence ids; do not re-fetch, crawl, browse, or independently inspect seed URLs in Stage 3.',
    'Keyword hints are discovery hints only. Never present keyword_hints as source-backed facts.',
    'If seed_evidence evidence_pack_ids or primary_evidence_ids are missing for a seed-derived claim, demote the claim instead of inventing traceability.',
    'For CameraX / AndroidX release notes, source_extraction.release.sections[].items[].text is the source-confirmed release-note behavior evidence. Do not replace it with artifact tables, dependency declarations, page navigation, or generic update text.',
    'Do not copy derived_editorial_hints into article_sections.verified_facts or present HAL boundary, validation_targets, do_not_claim, warnings, or relevance hints as facts from the source.',
    'Do not analyze the source URL or full source page independently. Use only the supplied article capsule, source_extraction JSON, derived_editorial_hints JSON, and source fields.',
    'If source_extraction is missing release date, release version, API/component, or a concrete release-note bullet, demote or exclude that item instead of inventing missing release evidence.',
    'For CameraX main articles, explicitly name the release version, release date, concrete release-note bullet, HAL boundary, and validation checklist when those fields are supplied.'
  ].join('\n');
}

function articleSectionContractPrompt() {
  return [
    'Article section contract: for newly generated editor, repair, and completion outputs, every main article must include article_sections.',
    'article_sections must contain exactly these five keys: verified_facts, background_context, hal_driver_impact, action_items, and team_share_points.',
    'article_sections remains optional only for legacy artifact compatibility; do not rely on legacy fields to satisfy this contract.',
    'article_sections.verified_facts must be an array of source-backed facts only. Keep HAL interpretation and recommendations out of verified_facts.',
    'article_sections.background_context must be a string explaining the context needed by an AOSP Camera / Camera HAL / driver / SoC platform reader.',
    'article_sections.hal_driver_impact must be a string that interprets practical Camera HAL, driver, stream, buffer, metadata, native tooling, or SoC platform impact without claiming direct runtime/API behavior unless the supplied source explicitly supports it.',
    'article_sections.action_items must be an array of concrete actions that name a test, log, metric, device class, API/component, stream combination, owner, or PoC handoff.',
    'article_sections.team_share_points must be a string with the team-review takeaway.',
    'HAL Signal contract: every main article must include hal_signal_capsule with exactly these keys: why_now, reader_owners, check_within_2_weeks, impact_axes, do_not_overstate.',
    'hal_signal_capsule.reader_owners and hal_signal_capsule.impact_axes must be arrays. Use only supplied capsule metadata and article evidence; do not invent missing source claims.',
    'hal_signal_capsule.check_within_2_weeks must name a concrete owner/test/log/metric/API/stream/buffer/metadata follow-up, not a generic review.',
    'Include additive HAL signal fields when available: hal_impact_axes, reader_owners, actionability_level, effective_actionability_level, actionability_upgrade_reason, signal_quality_status, do_not_overstate, fallback_promotion_allowed, fallback_promotion_reason, fallback_guard_notes, soc_signal_type, soc_signal_source_allowed, and camera_pipeline_link.'
  ].join('\n');
}

function articleClaimContractPrompt() {
  return [
    'Claim binding contract: every main article must include claims[].',
    'Each claims[] item must include claim_id, text, claim_type, evidence_ids, source_urls, impact_level, and overclaim_risk.',
    'claim_type must be one of: fact, inference, recommendation, risk_note, limitation.',
    'Any source-backed verified_facts[], confirmed_facts[], or concrete evidence_summary text must have at least one matching claim_type=fact claim.',
    'Fact claims must cite item-level evidence ids from supplied seed_evidence.primary_evidence_ids, seed_evidence.linked_evidence_ids, candidate evidence_ids, or source_extraction facts. Do not use evidence_pack_ids alone as fact support.',
    'Preserve release/version/section URL fragments in source_urls when the evidence URL contains a fragment, especially CameraX release-note anchors.',
    'Do not contradict do_not_claim or do_not_overstate guardrails. Direct HAL/API/runtime wording requires direct source evidence.'
  ].join('\n');
}

function writeNewsletterDate(date, rootDir = root) {
  const tmpDir = path.join(rootDir, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'newsletter-date.txt'), date, 'utf8');
}

function writeGenerationStatus(value, rootDir = root) {
  const tmpDir = path.join(rootDir, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(path.join(tmpDir, 'newsletter-generation-status.json'), content, 'utf8');
  if (value?.date) {
    const targetNewsroomDir = artifactNewsroomDir(rootDir, value.date);
    if (fs.existsSync(targetNewsroomDir)) {
      fs.writeFileSync(path.join(targetNewsroomDir, 'generation-status.json'), content, 'utf8');
    }
  }
}

function buildRunContext(env = process.env) {
  return {
    github_run_id: env.GITHUB_RUN_ID || '',
    github_sha: env.GITHUB_SHA || '',
    github_ref: env.GITHUB_REF || ''
  };
}

function writeCostReport(date, rootDir = root) {
  const report = buildCostReport({
    date,
    calls: getLlmCostCalls(),
    warnCostUsd: runtimeConfig.newsroomWarnCostUsd,
    maxCostUsd: runtimeConfig.newsroomMaxCostUsd
  });
  const tmpDir = path.join(rootDir, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'newsroom-cost-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  const targetNewsroomDir = artifactNewsroomDir(rootDir, date);
  if (fs.existsSync(targetNewsroomDir)) {
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'cost-report.md'),
      buildCostReportMarkdown(report),
      'utf8'
    );
  }

  for (const warning of ensureArray(report.warnings)) {
    console.warn(`[cost] ${warning}`);
  }
  console.log(`[cost] Estimated LLM API cost: $${Number(report.totals.estimated_cost_usd || 0).toFixed(6)} USD across ${report.totals.request_count || 0} request(s).`);
  return report;
}

function writeSummaryCacheReport(date, diagnostics) {
  const report = buildSummaryCacheReport(date, diagnostics);
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'summary-cache-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  const targetNewsroomDir = artifactNewsroomDir(root, date);
  if (fs.existsSync(targetNewsroomDir)) {
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'summary-cache-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'summary-cache-report.md'),
      buildSummaryCacheReportMarkdown(report),
      'utf8'
    );
  }

  console.log(`[cache] Summary cache hits: ${report.totals.hit_count}/${report.totals.candidate_count}; misses: ${report.totals.miss_count}.`);
  return report;
}

function failureStageFromError(error) {
  if (error?.stage) return error.stage;
  const match = String(error?.message || '').match(/^\[([^\]]+)]/);
  return match ? match[1] : 'generation';
}

function buildGenerationStatus({
  date,
  status,
  failureStage = '',
  failureReason = '',
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
    fact_check_status: factCheck?.status || 'UNKNOWN',
    must_fix_count: mustFixCount,
    quality_status: qualityReport?.status || 'UNKNOWN',
    quality_attempt_count: retryHistory.length,
    quality_score: qualityReport?.score ?? null,
    quality_threshold: qualityReport?.threshold ?? qualityGatePolicy.threshold,
    quality_deduction_count: ensureArray(qualityReport?.deductions).length,
    quota_error_count: diagnostics.quota_error_count,
    invalid_json_count: diagnostics.invalid_json_count,
    model_usage: diagnostics.model_usage,
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
    Number(primaryCameraStackTopicCount) >= articlePolicy.primaryCameraStack.minRequired &&
    Number(forbiddenMainArticleCount) === 0 &&
    Number(primaryCameraStackTopicCount) + Number(supportingMainArticleCount) === Number(selectedArticleCount)
  );
  const publishGatePassed = options.publishGatePassed ?? selectionPublishGatePassed;
  return {
    input_candidate_count: report.input_candidate_count ?? null,
    eligible_candidate_count: report.eligible_candidate_count ?? null,
    selected_article_count: selectedArticleCount,
    deterministic_selected_count: diagnostics.deterministic_selected_count ?? report.deterministic_selected_count ?? report.selected_article_count ?? null,
    rendered_main_article_count: renderedMainArticleCount,
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
    soc_platform_signal_count: compositionSummary.soc_platform_signal_count ?? ensureArray(report.selected_articles).filter(candidate =>
      candidate.relevance_bucket === 'soc_platform_signal'
    ).length,
    cpp_ai_tooling_fallback_count: compositionSummary.cpp_ai_tooling_fallback_count ?? null,
    generic_tech_watchlist_count: compositionSummary.generic_tech_watchlist_count ?? null,
    selection_warnings: ensureArray(report.selection_warnings),
    selection_errors: ensureArray(report.selection_errors),
    selection_shortage_hints: ensureArray(report.selection_shortage_hints),
    exclusion_reason_summary: ensureArray(report.exclusion_reason_summary).slice(0, 10),
    final_exclusion_reason_summary: ensureArray(diagnostics.final_exclusion_reason_summary).slice(0, 10),
    candidate_selection_note: diagnostics.note
  };
}

function numberOrDefault(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function stringOrEmpty(value) {
  return String(value || '').trim();
}

function booleanFromCandidate(collected, candidate, field, fallback = false) {
  if (typeof collected[field] === 'boolean') return collected[field];
  if (typeof candidate[field] === 'boolean') return candidate[field];
  return fallback;
}

function imageCandidatesForReporterCandidate(candidate, collectedByUrl) {
  const collected = collectedByUrl.get(candidate.url) || collectedByUrl.get(candidate.article_url) || {};
  const images = ensureArray(candidate.imageCandidates).length > 0
    ? ensureArray(candidate.imageCandidates)
    : ensureArray(collected.imageCandidates);
  return images.filter(image => image && image.url && isSafeExternalImageUrl(image.url));
}

function collectedCandidateFor(candidate, collectedByUrl) {
  return collectedByUrl.get(candidate.url) ||
    collectedByUrl.get(candidate.article_url) ||
    collectedByUrl.get(candidate.articleUrl) ||
    {};
}

function backgroundContextStageEnabled(env = process.env) {
  const value = String(env.NEWSROOM_BACKGROUND_CONTEXT_STAGE ?? 'gemini').trim();
  if (!value) return true;
  if (/^(0|false|off|static|static-fallback|disabled?)$/i.test(value)) return false;
  return /^(1|true|on|gemini|enabled?)$/i.test(value);
}

function normalizeBackgroundContextReport(value, date, fallbackReport) {
  const fallbackItems = ensureArray(fallbackReport?.background_contexts);
  const fallbackByHash = new Map(fallbackItems
    .map(item => [stringOrEmpty(item.source_candidate_hash), item])
    .filter(([key]) => key));
  const fallbackByUrl = new Map(fallbackItems
    .map(item => [normalizeUrl(item.url), item])
    .filter(([key]) => key));
  return {
    ...fallbackReport,
    ...value,
    schema_version: Number(value?.schema_version || fallbackReport?.schema_version || 1),
    date,
    generated_at: new Date().toISOString(),
    stage: value?.stage || 'gemini-background-context',
    background_contexts: ensureArray(value?.background_contexts).map(item => {
      const fallback =
        fallbackByHash.get(stringOrEmpty(item?.source_candidate_hash)) ||
        fallbackByUrl.get(normalizeUrl(item?.url)) ||
        {};
      return {
        title: stringOrEmpty(item?.title || fallback.title),
        url: stringOrEmpty(item?.url || fallback.url),
        source_candidate_hash: stringOrEmpty(item?.source_candidate_hash || fallback.source_candidate_hash),
        relevance_bucket: stringOrEmpty(item?.relevance_bucket || fallback.relevance_bucket),
        impact_claim_level: stringOrEmpty(item?.impact_claim_level || fallback.impact_claim_level),
        background_context: stringOrEmpty(item?.background_context || fallback.background_context),
        background_basis: stringOrEmpty(item?.background_basis || 'supplied capsule and model knowledge'),
        background_confidence: stringOrEmpty(item?.background_confidence || 'medium'),
        background_warnings: ensureArray(item?.background_warnings).map(stringOrEmpty).filter(Boolean)
      };
    }).filter(item => item.background_context)
  };
}

async function buildBackgroundContextReport({ date, articleCapsuleReport, commonContext, stage }) {
  const fallbackReport = buildStaticBackgroundContextReport(date, articleCapsuleReport);
  if (!backgroundContextStageEnabled()) return fallbackReport;
  try {
    const result = await callLlmJson(
      stage,
      [
        'You generate optional background context for AOSP Camera / Driver / SoC Platform Newsletter.',
        'Return Korean technical background only. Do not browse the web.',
        'Use only the supplied article capsules plus model knowledge about Android Camera, CameraX, Camera2, Camera HAL, libcamera, V4L2, SoC, native build/test/debug workflows.',
        'Do not copy raw source table text, UI fragments, release table dumps, or source snippets into background_context.',
        'Preserve title, url, source_candidate_hash, and impact_claim_level exactly from the supplied article capsule or static fallback item.',
        'background_basis must explain that the context is based on supplied capsule metadata and model knowledge, not external source lookup.',
        'Do not emit background_sources_used. Use background_basis instead.',
        'Keep background_context distinct from what_changed and keep claim strength aligned with impact_claim_level.',
        'Return only JSON matching the schema.'
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

function reporterCandidateRejectionReason(candidate) {
  const halActionability =
    Number(candidate.camera_hal_relevance_score || 0) +
    Number(candidate.android_camera_relevance_score || 0) +
    Number(candidate.practical_actionability_score || 0);
  if (!['main', 'short'].includes(candidate.finalSelectionEligibility)) {
    return `finalSelectionEligibility=${candidate.finalSelectionEligibility || 'unknown'}`;
  }
  if (candidate.isWatchPage === true && candidate.hasDatedEvidence !== true) {
    return 'watch page without dated evidence';
  }
  if (candidate.main_eligible === false) return 'main_eligible=false';
  if (candidate.source_gap_risk === true) return 'source_gap_risk=true';
  if (Number(candidate.evidence_score || 0) < 6) return `evidence_score=${Number(candidate.evidence_score || 0)} < 6`;
  if (halActionability < 8) return `HAL/actionability score ${halActionability} < 8`;
  return '';
}

function reporterCandidateMainArticleBlockReason(candidate, options = {}) {
  const reason = reporterCandidateRejectionReason(candidate);
  if (reason) return reason;
  if (isReserveCandidate(candidate) && options.allowReserve !== true) {
    return 'premature_reserve_candidate';
  }
  if (!isFinalSelected(candidate) && !isReserveCandidate(candidate)) return 'final_selected=false';
  return '';
}

function isReserveCandidate(candidate = {}) {
  return candidate.reserve_candidate === true || candidate.selection_stage === 'deterministic-reserve';
}

function isMainSupplementBucket(candidate = {}) {
  return Boolean(candidate.relevance_bucket) && candidate.relevance_bucket !== BUCKETS.GENERIC_TECH_WATCHLIST;
}

function candidatePriority(candidate = {}) {
  return BUCKET_PRIORITY[candidate.relevance_bucket] || 99;
}

function validateReporter(value, date, collectedCandidates = []) {
  const collectedByUrl = new Map();
  for (const candidate of ensureArray(collectedCandidates)) {
    if (candidate.url) collectedByUrl.set(candidate.url, candidate);
    if (candidate.article_url) collectedByUrl.set(candidate.article_url, candidate);
    if (candidate.articleUrl) collectedByUrl.set(candidate.articleUrl, candidate);
  }

  if (value.date !== date) value.date = date;
  if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
    fail('Reporter output must contain at least one candidate.');
  }
  const rejectedMainIneligible = [];
  for (const candidate of value.candidates) {
    if (!candidate.title || !candidate.url || !candidate.source) {
      fail('Reporter candidate is missing title, source, or url.');
    }
    const collected = collectedCandidateFor(candidate, collectedByUrl);
    candidate.camera_hal_relevance_score = numberOrDefault(candidate.camera_hal_relevance_score);
    candidate.android_camera_relevance_score = numberOrDefault(candidate.android_camera_relevance_score);
    candidate.practical_actionability_score = numberOrDefault(candidate.practical_actionability_score);
    candidate.source_reliability_score = numberOrDefault(candidate.source_reliability_score);
    candidate.freshness_score = numberOrDefault(candidate.freshness_score);
    candidate.ai_required_slot_fit_score = numberOrDefault(candidate.ai_required_slot_fit_score);
    candidate.cpp_fallback_value_score = numberOrDefault(candidate.cpp_fallback_value_score);
    candidate.version_or_release = stringOrEmpty(candidate.version_or_release || collected.version_or_release);
    candidate.api_or_component = stringOrEmpty(candidate.api_or_component || collected.api_or_component);
    candidate.behavior_change = stringOrEmpty(candidate.behavior_change || collected.behavior_change);
    candidate.collectionMode = stringOrEmpty(collected.collectionMode || collected.collection_mode || candidate.collectionMode);
    candidate.isArticleCandidate = booleanFromCandidate(collected, candidate, 'isArticleCandidate',
      Boolean(collected.is_article_candidate));
    candidate.isWatchPage = booleanFromCandidate(collected, candidate, 'isWatchPage',
      Boolean(collected.is_watch_page));
    candidate.hasDatedEvidence = booleanFromCandidate(collected, candidate, 'hasDatedEvidence',
      Boolean(collected.has_dated_evidence));
    candidate.evidenceLevel = stringOrEmpty(collected.evidenceLevel || collected.evidence_level || candidate.evidenceLevel);
    candidate.finalSelectionEligibility = stringOrEmpty(
      collected.finalSelectionEligibility ||
      collected.final_selection_eligibility ||
      candidate.finalSelectionEligibility
    );
    candidate.source_kind = stringOrEmpty(collected.source_kind || candidate.source_kind);
    candidate.source_gap_risk = typeof collected.source_gap_risk === 'boolean'
      ? collected.source_gap_risk
      : Boolean(candidate.source_gap_risk);
    candidate.main_eligible = typeof collected.main_eligible === 'boolean'
      ? collected.main_eligible
      : Boolean(candidate.main_eligible);
    candidate.briefing_only = typeof collected.briefing_only === 'boolean'
      ? collected.briefing_only
      : Boolean(candidate.briefing_only);
    candidate.reference_only = typeof collected.reference_only === 'boolean'
      ? collected.reference_only
      : Boolean(candidate.reference_only);
    candidate.evidence_score = numberOrDefault(collected.evidence_score ?? candidate.evidence_score);
    candidate.evidence_notes = ensureArray(candidate.evidence_notes);
    candidate.cross_check_status = stringOrEmpty(candidate.cross_check_status || 'not-required');
    candidate.editorial_priority = numberOrDefault(collected.editorial_priority ?? candidate.editorial_priority, 6);
    candidate.relevance_bucket = stringOrEmpty(collected.relevance_bucket || candidate.relevance_bucket || 'generic_tech_watchlist');
    candidate.aosp_camera_directness = numberOrDefault(collected.aosp_camera_directness ?? candidate.aosp_camera_directness);
    candidate.driver_stack_relevance = numberOrDefault(collected.driver_stack_relevance ?? candidate.driver_stack_relevance);
    candidate.soc_platform_relevance = numberOrDefault(collected.soc_platform_relevance ?? candidate.soc_platform_relevance);
    candidate.native_tooling_relevance = numberOrDefault(collected.native_tooling_relevance ?? candidate.native_tooling_relevance);
    candidate.counts_as_primary_camera_topic = booleanFromCandidate(collected, candidate, 'counts_as_primary_camera_topic');
    candidate.counts_as_driver_topic = booleanFromCandidate(collected, candidate, 'counts_as_driver_topic');
    candidate.counts_as_soc_topic = booleanFromCandidate(collected, candidate, 'counts_as_soc_topic');
    candidate.counts_as_fallback_topic = booleanFromCandidate(collected, candidate, 'counts_as_fallback_topic');
    candidate.impact_claim_level = stringOrEmpty(collected.impact_claim_level || candidate.impact_claim_level) ||
      inferImpactClaimLevel(candidate);
    candidate.evidence_origin = stringOrEmpty(collected.evidence_origin || candidate.evidence_origin || 'unknown');
    candidate.source_hint = stringOrEmpty(collected.source_hint || candidate.source_hint || collected.usageHint || collected.source_usage_hint);
    candidate.imageCandidates = imageCandidatesForReporterCandidate(candidate, collectedByUrl);
    if (typeof candidate.selected !== 'boolean') {
      const total =
        candidate.camera_hal_relevance_score +
        candidate.android_camera_relevance_score +
        candidate.practical_actionability_score +
        candidate.source_reliability_score +
        candidate.freshness_score +
        candidate.ai_required_slot_fit_score +
        candidate.cpp_fallback_value_score;
      candidate.selected = total >= 12;
    }
    const rejectionReason = reporterCandidateRejectionReason(candidate);
    if (candidate.selected && rejectionReason) {
      candidate.selected = false;
      rejectedMainIneligible.push({
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        reason: rejectionReason
      });
    }
  }
  value.rejected_main_ineligible_candidates = rejectedMainIneligible;
  return value;
}

function enforceDeterministicReporterSelection(reporter, shortlistReport) {
  const finalByUrl = new Map([
    ...ensureArray(shortlistReport?.primary_selected_articles),
    ...ensureArray(shortlistReport?.selected_articles),
    ...ensureArray(shortlistReport?.reserve_candidates),
    ...ensureArray(shortlistReport?.shortlisted_candidates),
    ...ensureArray(shortlistReport?.demoted_candidates),
    ...ensureArray(shortlistReport?.excluded_candidates)
  ].map(candidate => [normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl), candidate]));

  reporter.candidates = ensureArray(reporter.candidates).map(candidate => {
    const url = normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl);
    const deterministic = finalByUrl.get(url) || {};
    return {
      ...deterministic,
      ...candidate,
      deterministic_score: deterministic.deterministic_score ?? candidate.deterministic_score,
      score_breakdown: deterministic.score_breakdown || candidate.score_breakdown,
      final_selected: isFinalSelected(deterministic),
      selected_for_editor: isFinalSelected(deterministic),
      primary_selected: isFinalSelected(deterministic),
      reserve_candidate: isReserveCandidate(deterministic),
      selection_slot: isFinalSelected(deterministic)
        ? deterministic.selection_slot || candidate.selection_slot || 'deterministic-final'
        : isReserveCandidate(deterministic)
          ? deterministic.selection_slot || candidate.selection_slot || 'reserve'
          : ''
    };
  });
  return normalizeReporterReport(reporter, shortlistReport);
}

function selectedReporterCapsules(date, reporter, capsuleReport) {
  return capsuleInputForCandidates(date, ensureArray(reporter.candidates).filter(isFinalSelected), capsuleReport);
}

function reserveReporterCapsules(date, reporter, capsuleReport) {
  return capsuleInputForCandidates(date, ensureArray(reporter.candidates).filter(isReserveCandidate), capsuleReport);
}

function reporterCandidateCapsules(date, candidates, capsuleReport) {
  return capsuleInputForCandidates(date, candidates, capsuleReport);
}

function reporterImageCandidatesForSection(section, reporter) {
  const sourceUrls = new Set(ensureArray(section.sources).map(source => source && source.url).filter(Boolean));
  const matching = ensureArray(reporter.candidates)
    .filter(candidate => sourceUrls.has(candidate.url))
    .flatMap(candidate => ensureArray(candidate.imageCandidates));
  const fallback = ensureArray(reporter.candidates).flatMap(candidate => ensureArray(candidate.imageCandidates));
  const seen = new Set();
  const images = (matching.length > 0 ? matching : fallback)
    .filter(image => image && image.url && isSafeExternalImageUrl(image.url))
    .filter(image => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
  return images.slice(0, 6);
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function firstHttpsUrl(...values) {
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (isHttpsUrl(trimmed)) return trimmed;
  }
  return '';
}

const fallbackCategories = ['AOSP Camera Watch', 'Camera Driver / SoC Platform Watch', 'C++ / AI Practical Tip'];

function normalizeSectionImageFields(section, reporter) {
  const sectionImages = ensureArray(section.imageCandidates).filter(image => image && image.url && isSafeExternalImageUrl(image.url));
  const imageCandidates = sectionImages.length > 0 ? sectionImages : reporterImageCandidatesForSection(section, reporter);
  const allowed = new Set(imageCandidates.map(image => image.url));
  const requestedImage = allowed.has(section.selectedImage) ? section.selectedImage : '';
  const selected = imageCandidates.find(image => image.url === requestedImage);

  if (requestedImage) {
    const imageSource = firstHttpsUrl(
      section.imageSource,
      selected?.articleUrl,
      selected?.sourceUrl,
      ensureArray(section.sources)[0]?.url
    );
    const imageAttribution = String(section.imageAttribution || selected?.attribution || ensureArray(section.sources)[0]?.title || '').trim();
    const imageAlt = String(section.imageAlt || selected?.alt || section.headline || 'Article image').trim();
    const imageLicenseStatus = String(section.imageLicenseStatus || selected?.licenseStatus || 'unknown').trim();

    if (imageSource && imageAttribution && imageAlt && imageLicenseStatus) {
      return {
        imageCandidates,
        selectedImage: requestedImage,
        imageSource,
        imageAttribution,
        imageAlt,
        imageLicenseStatus,
        imageUsageDecisionReason: section.imageUsageDecisionReason || 'Editor-selected image with HTTPS source attribution.'
      };
    }
  }

  return {
    imageCandidates,
    selectedImage: '',
    imageSource: '',
    imageAttribution: '',
    imageAlt: '',
    imageLicenseStatus: 'none',
    imageUsageDecisionReason: section.imageUsageDecisionReason ||
      'No suitable image with complete HTTPS attribution metadata selected; local fallback visual will be used.'
  };
}

function sourceCandidateMetadataForSection(section, reporter) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const candidate = ensureArray(section.sources)
    .map(source => candidateForSourceUrl(source?.url, candidateMap))
    .find(Boolean);
  if (!candidate) return {};
  const candidateUrl = candidate.url || candidate.article_url || candidate.articleUrl || '';
  return {
    source_candidate_url: candidateUrl,
    source_candidate_hash: candidate.url_hash || normalizedUrlHash(candidateUrl),
    relevance_bucket: candidate.relevance_bucket || '',
    editorial_priority: candidate.editorial_priority ?? null,
    aosp_camera_directness: candidate.aosp_camera_directness ?? null,
    driver_stack_relevance: candidate.driver_stack_relevance ?? null,
    soc_platform_relevance: candidate.soc_platform_relevance ?? null,
    native_tooling_relevance: candidate.native_tooling_relevance ?? null,
    counts_as_primary_camera_topic: candidate.counts_as_primary_camera_topic === true,
    counts_as_driver_topic: candidate.counts_as_driver_topic === true,
    counts_as_soc_topic: candidate.counts_as_soc_topic === true,
    counts_as_fallback_topic: candidate.counts_as_fallback_topic === true,
    impact_claim_level: candidate.impact_claim_level || inferImpactClaimLevel(candidate),
    evidence_origin: candidate.evidence_origin || 'candidate_metadata',
    source_hint: candidate.source_hint || ''
  };
}

function normalizeEditorSection(section, index, reporter) {
  const actionItems = ensureArray(section.action_items);
  const actionHints = ensureArray(section.action_hints);
  const normalized = {
    ...section,
    category: section.category || fallbackCategories[index] || `Main Article ${index + 1}`,
    confirmed_facts: ensureArray(section.confirmed_facts).length > 0
      ? ensureArray(section.confirmed_facts)
      : [section.what_changed].filter(Boolean),
    evidence_summary: stringOrEmpty(section.evidence_summary),
    specificity_checks: ensureArray(section.specificity_checks),
    source_verification_notes: ensureArray(section.source_verification_notes),
    camera_hal_perspective: section.camera_hal_perspective || section.why_it_matters || '',
    action_items: actionItems.length > 0 ? actionItems : actionHints,
    action_hints: actionHints.length > 0 ? actionHints : actionItems,
    team_summary: section.team_summary || section.why_it_matters || '',
    is_ai_related: Boolean(section.is_ai_related),
    article_type: section.article_type || (section.is_ai_related ? 'ai' : 'camera-hal'),
    sources: ensureArray(section.sources).filter(source => source && source.url)
  };
  return {
    ...normalized,
    ...sourceCandidateMetadataForSection(normalized, reporter),
    ...normalizeSectionImageFields(normalized, reporter)
  };
}

function validateEditor(value, date, reporter = { candidates: [] }) {
  return validateEditorOutputContract(value, date, {
    reporter,
    normalizeSection: (section, index) => normalizeEditorSection(section, index, reporter),
    strictClaims: ensureArray(reporter?.candidates).length > 0
  });
}

function buildEditorRetryContract({
  lastKnownValidEditor = null,
  currentEditor = null,
  lockedSections = []
} = {}) {
  const previousValidSections = ensureArray(lastKnownValidEditor?.sections);
  const currentSections = ensureArray(currentEditor?.sections);
  const locked = ensureArray(lockedSections);
  const targetSectionCount = previousValidSections.length > 0
    ? previousValidSections.length
    : currentSections.length > 0
      ? currentSections.length
      : articlePolicy.mainArticleCount.min;
  return {
    target_section_count: targetSectionCount,
    locked_section_count: locked.length,
    replacement_required_count: Math.max(0, targetSectionCount - locked.length),
    locked_section_signatures: locked.map(sectionRepairSignature),
    locked_section_summaries: locked.map((section, index) => sectionSummary(section, index))
  };
}

function assertEditorRetryOutputContract(editor, contract, reporter = { candidates: [] }) {
  if (!contract) return true;
  const sections = ensureArray(editor?.sections);
  const targetSectionCount = Number(contract.target_section_count);
  const lockedSectionCount = Number(contract.locked_section_count);
  const replacementRequiredCount = Number(contract.replacement_required_count);
  const lockedSignatureStrings = ensureArray(contract.locked_section_signatures)
    .map(signature => JSON.stringify(signature));
  const outputSignatureStrings = sections.map(section =>
    JSON.stringify(sectionRepairSignature(normalizeEditorSection(section, 0, reporter)))
  );
  const returnedOnlyLockedSections = sections.length === lockedSectionCount &&
    replacementRequiredCount > 0 &&
    lockedSignatureStrings.length === lockedSectionCount &&
    lockedSignatureStrings.every(signature => outputSignatureStrings.includes(signature));
  if (returnedOnlyLockedSections) {
    throw new EditorSemanticValidationError('Editor retry output returned only locked sections instead of the complete target draft.', {
      field: 'sections',
      reason: 'locked_only_retry_output',
      expectedCount: targetSectionCount,
      actualCount: sections.length,
      target_section_count: targetSectionCount,
      locked_section_count: lockedSectionCount,
      replacement_required_count: replacementRequiredCount,
      actualType: 'array',
      sectionCount: sections.length
    });
  }
  if (Number.isFinite(targetSectionCount) && sections.length !== targetSectionCount) {
    throw new EditorSemanticValidationError(`Editor retry output must contain exactly ${targetSectionCount} sections; got ${sections.length}.`, {
      field: 'sections',
      reason: 'editor_retry_section_count_drift',
      expectedCount: targetSectionCount,
      actualCount: sections.length,
      target_section_count: targetSectionCount,
      locked_section_count: lockedSectionCount,
      replacement_required_count: replacementRequiredCount,
      actualType: 'array',
      sectionCount: sections.length
    });
  }
  for (const expected of ensureArray(contract.locked_section_signatures)) {
    const found = outputSignatureStrings.includes(JSON.stringify(expected));
    if (!found) {
      throw new EditorSemanticValidationError('Editor retry output omitted or changed a locked section.', {
        field: 'sections',
        reason: 'locked_section_missing_from_retry_output',
        expected,
        target_section_count: targetSectionCount,
        locked_section_count: lockedSectionCount,
        replacement_required_count: replacementRequiredCount,
        actualType: 'array',
        sectionCount: sections.length
      });
    }
  }
  return true;
}

function recordLastKnownValidEditor(editor, {
  date,
  reporter = { candidates: [] },
  factCheck = null,
  qualityReport = null,
  attempt = 0
} = {}) {
  const validated = validateEditor(cloneJson(editor), date, reporter);
  generationRunState.lastKnownValidEditor = cloneJson(validated);
  generationRunState.lastKnownValidReporter = cloneJson(reporter);
  generationRunState.lastKnownValidFactCheck = cloneJson(factCheck);
  generationRunState.lastKnownValidQualityReport = cloneJson(qualityReport);
  generationRunState.lastKnownValidAttempt = attempt;
  return validated;
}

function sourceUrlSignature(section) {
  return [...new Set(
    ensureArray(section?.sources)
      .map(source => normalizeUrl(source?.url))
      .filter(Boolean)
  )].sort();
}

function sectionRepairSignature(section) {
  return {
    headline: stringOrEmpty(section?.headline),
    category: stringOrEmpty(section?.category),
    source_candidate_hash: stringOrEmpty(section?.source_candidate_hash),
    source_urls: sourceUrlSignature(section)
  };
}

function sectionLabelKey(section) {
  const label = [
    normalizeTitle(section?.headline),
    normalizeTitle(section?.category)
  ].filter(Boolean).join('|');
  return label ? `label:${label}` : '';
}

function stableSectionKey(section) {
  const hash = stringOrEmpty(section?.source_candidate_hash);
  if (hash) return `hash:${hash}`;
  const urls = sourceUrlSignature(section);
  if (urls.length > 0) return `urls:${urls.join('|')}`;
  return sectionLabelKey(section);
}

function sameSectionLabel(left, right) {
  const leftLabel = normalizeTitle(left?.headline || left?.category);
  const rightLabel = normalizeTitle(right?.headline || right?.category);
  return Boolean(leftLabel && rightLabel && leftLabel === rightLabel);
}

function signaturesMatch(left, right) {
  return JSON.stringify(sectionRepairSignature(left)) === JSON.stringify(sectionRepairSignature(right));
}

function targetedRepairError(message, details = {}) {
  return new EditorSemanticValidationError(message, {
    field: 'sections',
    ...details
  });
}

function validateTargetedRepairResult({
  beforeSections = [],
  repairSections = [],
  afterSections = [],
  lockedSections = [],
  mode = 'targeted-repair',
  allowCountChange = false,
  date = generationRunState.date,
  reporter = { candidates: [] }
} = {}) {
  const before = ensureArray(beforeSections);
  const repair = ensureArray(repairSections);
  const after = ensureArray(afterSections);
  const locked = ensureArray(lockedSections);

  if (mode === 'targeted-repair' && after.length !== before.length) {
    throw targetedRepairError('Targeted repair changed main article count outside completion/replacement mode.', {
      reason: 'section_count_drift',
      mode,
      expectedCount: before.length,
      actualCount: after.length,
      expectedMinCount: articlePolicy.mainArticleCount.min,
      expectedMaxCount: articlePolicy.mainArticleCount.max,
      actualType: 'array',
      sectionCount: after.length
    });
  }

  for (const generated of repair) {
    const generatedKey = stableSectionKey(generated);
    const matchingLocked = locked.find(section =>
      (generatedKey && stableSectionKey(section) === generatedKey) ||
      sameSectionLabel(section, generated)
    );
    if (matchingLocked && !signaturesMatch(matchingLocked, generated)) {
      throw targetedRepairError('Targeted repair attempted to mutate a locked section source binding.', {
        reason: 'locked_section_source_drift',
        mode,
        expected: sectionRepairSignature(matchingLocked),
        actual: sectionRepairSignature(generated),
        sectionCount: after.length
      });
    }
  }

  const usedBeforeIndexes = new Set();
  for (const lockedSection of locked) {
    const key = stableSectionKey(lockedSection);
    let originalIndex = before.findIndex((section, index) =>
      !usedBeforeIndexes.has(index) &&
      key &&
      stableSectionKey(section) === key &&
      signaturesMatch(section, lockedSection)
    );
    if (originalIndex < 0) {
      originalIndex = before.findIndex((section, index) =>
        !usedBeforeIndexes.has(index) &&
        key &&
        stableSectionKey(section) === key
      );
    }
    if (originalIndex < 0) {
      originalIndex = before.findIndex((section, index) =>
        !usedBeforeIndexes.has(index) &&
        sameSectionLabel(section, lockedSection)
      );
    }
    if (originalIndex < 0) {
      throw targetedRepairError('Targeted repair could not find a locked section in the original draft.', {
        reason: 'locked_section_missing_from_before',
        mode,
        expected: sectionRepairSignature(lockedSection),
        sectionCount: after.length
      });
    }
    usedBeforeIndexes.add(originalIndex);
    const actual = after[originalIndex];
    if (!actual || !signaturesMatch(lockedSection, actual)) {
      throw targetedRepairError('Targeted repair changed locked section order or source binding.', {
        reason: 'locked_section_order_or_source_drift',
        mode,
        index: originalIndex + 1,
        expected: sectionRepairSignature(lockedSection),
        actual: actual ? sectionRepairSignature(actual) : null,
        sectionCount: after.length
      });
    }
  }

  if (!allowCountChange && after.length !== before.length) {
    throw targetedRepairError('Targeted repair changed main article count outside completion/replacement mode.', {
      reason: 'section_count_drift',
      mode,
      expectedCount: before.length,
      actualCount: after.length,
      expectedMinCount: articlePolicy.mainArticleCount.min,
      expectedMaxCount: articlePolicy.mainArticleCount.max,
      actualType: 'array',
      sectionCount: after.length
    });
  }

  validateEditor({
    date,
    title: `Camera HAL SW Newsletter - ${date}`,
    summary: 'targeted repair validation',
    briefing: ['validation', 'validation', 'validation'],
    sections: after,
    action_items: [],
    references: []
  }, date, reporter);
  return true;
}

function writeCanonicalReviewArtifacts({
  date,
  newsroomDir,
  reporter = null,
  editor = null,
  factCheck = null,
  qualityReport = null
}) {
  fs.mkdirSync(newsroomDir, { recursive: true });
  if (reporter) {
    writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  }
  if (editor) {
    writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
    fs.writeFileSync(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(editor), 'utf8');
  }
  if (factCheck) {
    writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
    fs.writeFileSync(path.join(newsroomDir, 'fact-check-report.md'), buildFactCheckMarkdown(date, factCheck), 'utf8');
  }
  if (qualityReport) {
    writeJson(path.join(newsroomDir, 'quality-report.json'), qualityReport);
    fs.writeFileSync(path.join(newsroomDir, 'quality-report.md'), buildQualityReportMarkdown(qualityReport), 'utf8');
  }
}

function fallbackFactCheckForRepairFailure(error, factCheck = null) {
  if (factCheck) return cloneJson(factCheck);
  return {
    status: 'NEEDS_FIX',
    must_fix: [],
    recommended_fixes: [],
    source_gaps: [`Repair failure prevented follow-up fact-check: ${String(error?.message || error || 'Unknown repair failure.')}`],
    source_gap_count: 1,
    final_comment: 'Repair failed after a schema and policy valid editor draft was created. Use this draft for editor review only.'
  };
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
  const fallbackEditor = validateEditor(cloneJson(generationRunState.lastKnownValidEditor), date, fallbackReporter);
  const fallbackFactCheck = fallbackFactCheckForRepairFailure(error, factCheck || generationRunState.lastKnownValidFactCheck);
  const existingQualityReport = qualityReport || generationRunState.lastKnownValidQualityReport;
  const fallbackQualityReport = existingQualityReport?.metrics
    ? cloneJson(existingQualityReport)
    : buildNewsletterQualityReport(date, fallbackEditor, fallbackReporter, fallbackFactCheck, {
      threshold: qualityGatePolicy.threshold,
      shortlistReport: shortlistReport || generationRunState.shortlistReport,
      strictClaimValidation: true
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
  writeJson(path.join(newsroomDir, 'editor-draft.json'), fallbackEditor);
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
      todo_found: false,
      empty_source_sections: [],
      source_gap_count: fallbackFactCheck.source_gap_count ?? fallbackQualityReport.metrics.source_gap_count,
      ...editorSemanticStatusExtra(error),
      ...selectionStatusExtra(shortlistReport || generationRunState.shortlistReport, {
        renderedMainArticleCount: ensureArray(fallbackEditor.sections).length,
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

  console.warn(`Repair failed after a valid editor draft was created. Wrote reviewable ${STATUS_FAILED_REPAIR_REVIEWABLE} artifacts for ${date}.`);
  return {
    editor: fallbackEditor,
    factCheck: fallbackFactCheck,
    qualityReport: fallbackQualityReport,
    retryHistory: fallbackRetryHistory
  };
}

async function repairEditorBriefingWithLlm({
  date,
  editorStage,
  commonContext,
  lockedContext,
  invalidEditor,
  validationError
}) {
  return callLlmJson(
    `${editorStage} semantic repair`,
    [
      'You are repairing a valid JSON editor draft for AOSP Camera / Driver / SoC Platform Newsletter.',
      'Return the complete editor JSON object matching the same schema.',
      'Only fix the briefing field so it contains exactly 3 Korean briefing items.',
      'Do not change any field except briefing.',
      'Do not change sections, sources, source URLs, factual claims, article order, image fields, action_items, or references.',
      'Do not add new articles, remove articles, rewrite source facts, or invent new source material.',
      'Preserve all non-briefing JSON values byte-for-byte when possible.',
      'Return only JSON matching the schema.'
    ].join('\n'),
    [
      commonContext,
      lockedContext,
      `Editor semantic validation error JSON:\n${JSON.stringify(validationError, null, 2)}`,
      `Invalid editor draft JSON:\n${JSON.stringify(invalidEditor, null, 2)}`
    ].filter(Boolean).join('\n\n'),
    editorSchema
  );
}

async function validateOrRepairEditor(value, {
  date,
  reporter,
  attempt,
  editorStage,
  commonContext,
  lockedContext,
  newsroomDir
}) {
  const result = await repairEditorOutputContract({
    value,
    date,
    reporter,
    attempt,
    stage: editorStage,
    newsroomDir,
    normalizeSection: (section, index) => normalizeEditorSection(section, index, reporter),
    repairFn: async ({ invalidEditor, validationError }) => repairEditorBriefingWithLlm({
      date,
      editorStage,
      commonContext,
      lockedContext,
      invalidEditor,
      validationError
    })
  });
  recordEditorSemanticStatus(result);
  return result.editor;
}

function validateFactCheck(value) {
  if (!['PASS', 'NEEDS_FIX'].includes(value.status)) {
    value.status = ensureArray(value.must_fix).length > 0 ? 'NEEDS_FIX' : 'PASS';
  }
  value.must_fix = ensureArray(value.must_fix);
  value.recommended_fixes = ensureArray(value.recommended_fixes);
  value.source_gaps = ensureArray(value.source_gaps);
  value.source_gap_count = numberOrDefault(value.source_gap_count, value.source_gaps.length);
  value.final_comment = value.final_comment || '';
  return value;
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

function isEditorialReviewableStatus(status) {
  return status === 'NEEDS_FIX' || status === 'QUALITY_NEEDS_FIX';
}

function runValidate() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const siteOutput = execFileSync(npmCommand, ['run', 'validate:site'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const imageOutput = execFileSync(npmCommand, ['run', 'validate:images'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
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

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const left = new Set(normalizeTitle(a).split(' ').filter(token => token.length > 1));
  const right = new Set(normalizeTitle(b).split(' ').filter(token => token.length > 1));
  if (left.size === 0 || right.size === 0) return 0;
  const overlap = [...left].filter(token => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function sourceDateTitle(section) {
  const firstSource = ensureArray(section.sources)[0] || {};
  return {
    source: normalizeTitle(firstSource.title || section.source),
    publishedDate: String(section.published_date || section.publishedDate || '').trim(),
    title: section.headline || firstSource.title || ''
  };
}

function sectionUrls(section) {
  return ensureArray(section.sources).map(source => source && source.url).filter(Boolean);
}

function urlKeys(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const keys = new Set([raw]);
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    const normalized = parsed.toString().replace(/\/$/, '');
    keys.add(normalized);
    keys.add(normalized.toLowerCase());
  } catch {
    keys.add(raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase());
  }
  return [...keys].filter(Boolean);
}

function reporterCandidateUrlMap(reporter) {
  const map = new Map();
  function add(key, candidate) {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, candidate);
      return;
    }
    if (map.get(key) !== candidate) {
      map.set(key, null);
    }
  }

  for (const candidate of ensureArray(reporter.candidates)) {
    for (const value of [candidate.url, candidate.article_url, candidate.articleUrl]) {
      for (const key of urlKeys(value)) add(key, candidate);
    }
  }
  return map;
}

function candidateForSourceUrl(sourceUrl, candidateMap) {
  for (const key of urlKeys(sourceUrl)) {
    const candidate = candidateMap.get(key);
    if (candidate) return candidate;
  }
  return null;
}

function sectionsAreDuplicate(left, right) {
  const leftUrls = new Set(sectionUrls(left));
  if (sectionUrls(right).some(url => leftUrls.has(url))) return true;
  if (normalizeTitle(left.headline) && normalizeTitle(left.headline) === normalizeTitle(right.headline)) return true;
  if (titleSimilarity(left.headline, right.headline) >= 0.82) return true;
  const leftKey = sourceDateTitle(left);
  const rightKey = sourceDateTitle(right);
  return leftKey.source &&
    leftKey.source === rightKey.source &&
    leftKey.publishedDate &&
    leftKey.publishedDate === rightKey.publishedDate &&
    titleSimilarity(leftKey.title, rightKey.title) >= 0.68;
}

function duplicateReasonForSections(left, right, context = 'locked') {
  const leftUrls = new Set(sectionUrls(left));
  if (sectionUrls(right).some(url => leftUrls.has(url))) {
    return context === 'locked' ? 'duplicate_locked_url' : 'duplicate_demoted_url';
  }
  if (normalizeTitle(left.headline) && normalizeTitle(left.headline) === normalizeTitle(right.headline)) {
    return context === 'locked' ? 'duplicate_locked_title' : 'duplicate_source_date_title';
  }
  if (titleSimilarity(left.headline, right.headline) >= 0.82) {
    return context === 'locked' ? 'duplicate_locked_title' : 'duplicate_source_date_title';
  }
  const leftKey = sourceDateTitle(left);
  const rightKey = sourceDateTitle(right);
  if (
    leftKey.source &&
    leftKey.source === rightKey.source &&
    leftKey.publishedDate &&
    leftKey.publishedDate === rightKey.publishedDate &&
    titleSimilarity(leftKey.title, rightKey.title) >= 0.68
  ) {
    return 'duplicate_source_date_title';
  }
  return '';
}

function candidateDuplicatesSections(candidate, sections) {
  const candidateSection = {
    headline: candidate.title,
    published_date: candidate.published_date,
    sources: [{ title: candidate.source, url: candidate.url }]
  };
  return sections.some(section => sectionsAreDuplicate(candidateSection, section));
}

function candidateDuplicateReason(candidate, sections, context = 'locked') {
  const candidateSection = {
    headline: candidate.title,
    published_date: candidate.published_date,
    sources: [{ title: candidate.source, url: candidate.url }]
  };
  for (const section of ensureArray(sections)) {
    const reason = duplicateReasonForSections(candidateSection, section, context);
    if (reason) return reason;
  }
  return '';
}

function retryRejectionRecord(candidate, reason) {
  return {
    title: candidate.title || candidate.headline || candidate.category || 'untitled article',
    url: candidate.url || sectionUrls(candidate)[0] || '',
    source: candidate.source || ensureArray(candidate.sources)[0]?.title || '',
    relevance_bucket: candidate.relevance_bucket || '',
    editorial_priority: candidate.editorial_priority ?? null,
    reason
  };
}

function reserveUsageForSections(sections, reporter) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const records = ensureArray(sections).flatMap(section =>
    sectionUrls(section)
      .map(url => candidateForSourceUrl(url, candidateMap))
      .filter(candidate => candidate && isReserveCandidate(candidate))
      .map(candidate => retryRejectionRecord(candidate, 'used_reserve_candidate'))
  );
  return [...new Map(records.map(record => [record.url || record.title, record])).values()];
}

function candidatesForSections(sections, reporter) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const records = ensureArray(sections).flatMap(section =>
    sectionUrls(section)
      .map(url => candidateForSourceUrl(url, candidateMap))
      .filter(Boolean)
  );
  return [...new Map(records.map(candidate => [normalizeUrl(candidate.url), candidate])).values()];
}

function removeDisallowedSelections(reporter, lockedSections, excludedSections = []) {
  const rejected = [];
  for (const candidate of ensureArray(reporter.candidates)) {
    if (!isFinalSelected(candidate)) continue;
    const lockedReason = candidateDuplicateReason(candidate, lockedSections, 'locked');
    if (lockedReason) {
      candidate.final_selected = false;
      candidate.selected_for_editor = false;
      rejected.push(retryRejectionRecord(candidate, lockedReason));
      continue;
    }
    const excludedReason = candidateDuplicateReason(candidate, excludedSections, 'demoted');
    if (excludedReason) {
      candidate.final_selected = false;
      candidate.selected_for_editor = false;
      rejected.push(retryRejectionRecord(candidate, excludedReason));
    }
  }
  return rejected;
}

function mergeLockedSections(lockedSections, generatedSections, excludedSections = []) {
  const merged = [];
  const rejected = [];
  for (const section of lockedSections) {
    if (merged.length >= articlePolicy.mainArticleCount.max) break;
    merged.push(section);
  }
  for (const section of generatedSections) {
    if (merged.length >= articlePolicy.mainArticleCount.max) break;
    const lockedReason = merged
      .map(existing => duplicateReasonForSections(existing, section, 'locked'))
      .find(Boolean);
    if (lockedReason) {
      rejected.push(retryRejectionRecord(section, lockedReason));
      continue;
    }
    const excludedReason = ensureArray(excludedSections)
      .map(existing => duplicateReasonForSections(existing, section, 'demoted'))
      .find(Boolean);
    if (excludedReason) {
      rejected.push(retryRejectionRecord(section, excludedReason));
      continue;
    }
    merged.push(section);
  }
  return { sections: merged, rejected };
}

function sectionSummary(section, index) {
  return {
    index: index + 1,
    headline: section.headline,
    category: section.category,
    relevance_bucket: section.relevance_bucket || '',
    impact_claim_level: section.impact_claim_level || '',
    urls: sectionUrls(section),
    source_titles: ensureArray(section.sources).map(source => source.title).filter(Boolean)
  };
}

function sectionLockRecord(section, index, status = 'PASS', reason = '') {
  return {
    ...sectionSummary(section, index),
    status,
    reason,
    locked: status === 'PASS'
  };
}

function buildLockedArticleContext(lockedSections, excludedSections = []) {
  if (lockedSections.length === 0 && excludedSections.length === 0) return '';
  const lockedSummary = lockedSections.map((section, index) => ({
    ...sectionSummary(section, index)
  }));
  const excludedSummary = excludedSections.map((section, index) => sectionSummary(section, index));
  return [
    lockedSections.length > 0 ? 'Passed articles locked from previous quality attempts:' : '',
    lockedSections.length > 0 ? JSON.stringify(lockedSummary, null, 2) : '',
    lockedSections.length > 0 ? 'Keep these passed articles unchanged. Do not rewrite them except for formatting consistency.' : '',
    excludedSections.length > 0 ? 'Excluded source-gap/demoted articles from previous attempts:' : '',
    excludedSections.length > 0 ? JSON.stringify(excludedSummary, null, 2) : '',
    excludedSections.length > 0 ? 'Do not select candidates or generate articles that duplicate these excluded URLs, titles, source names, or same source + published_date + similar title.' : '',
    'Generate only missing replacement articles. Avoid duplicate URLs, duplicate or near-identical headlines, and same source + same published_date + similar title.'
  ].filter(Boolean).join('\n');
}

function lockedArticleHeadlines(lockedSections) {
  return lockedSections.map(section => section.headline || section.category || 'untitled article');
}

function issueLevelLockBlockers(qualityReport) {
  return ensureArray(qualityReport?.deductions).filter(deduction => {
    if (stringOrEmpty(deduction.location)) return false;
    if (deduction.category === 'composition') {
      return /main articles|No AI article/i.test(deduction.reason);
    }
    if (deduction.category === 'hal-relevance') {
      return /No AI|Expected at least|weak HAL|Camera HAL \/ Android Camera/i.test(deduction.reason);
    }
    return false;
  });
}

function selectLockedArticles(editor, qualityReport, factCheck) {
  const blockers = issueLevelLockBlockers(qualityReport);
  if (blockers.length > 0) {
    return { articles: [], blockers };
  }
  return {
    articles: ensureArray(editor.sections)
      .filter(section => sectionPassesArticleGate(section, qualityReport, factCheck))
      .slice(0, articlePolicy.mainArticleCount.max),
    blockers
  };
}

function appendUniqueLockedArticles(currentLocked, candidates) {
  const locked = [...currentLocked];
  for (const section of candidates) {
    if (locked.length >= articlePolicy.mainArticleCount.max) break;
    if (!locked.some(existing => sectionsAreDuplicate(existing, section))) {
      locked.push(section);
    }
  }
  return locked;
}

function appendUniqueSections(currentSections, candidates) {
  const sections = [...currentSections];
  for (const section of candidates) {
    if (!sections.some(existing => sectionsAreDuplicate(existing, section))) {
      sections.push(section);
    }
  }
  return sections;
}

function sectionLabel(section) {
  return section.headline || section.category || 'untitled article';
}

function sourceGapSections(editor, factCheck) {
  return ensureArray(editor.sections).filter(section => sectionHasSourceGap(section, factCheck));
}

function reporterEligibilityFindings(editor, reporter, lockedSections = [], options = {}) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const findings = [];
  for (const section of ensureArray(editor.sections)) {
    if (lockedSections.some(locked => sectionsAreDuplicate(section, locked))) continue;
    for (const source of ensureArray(section.sources)) {
      const candidate = candidateForSourceUrl(source?.url, candidateMap);
      if (!candidate) continue;
      const reason = reporterCandidateMainArticleBlockReason(candidate, options);
      if (!reason) continue;
      findings.push({
        section,
        headline: sectionLabel(section),
        source_title: source.title || candidate.source || candidate.title || 'unknown source',
        source_url: source.url,
        candidate_title: candidate.title,
        candidate_url: candidate.url,
        reason
      });
    }
  }
  return findings;
}

function eligibilitySourceGapMessage(finding) {
  return [
    'Reporter eligibility violation',
    `section="${finding.headline}"`,
    `source="${finding.source_title}"`,
    `url=${finding.source_url || finding.candidate_url || 'unknown'}`,
    `candidate="${finding.candidate_title || 'unknown'}"`,
    `reason=${finding.reason}`,
    'action=replace-or-demote'
  ].join('; ');
}

function applyReporterEligibilityFindingsToFactCheck(factCheck, findings) {
  if (findings.length === 0) return factCheck;
  const sourceGaps = [...ensureArray(factCheck.source_gaps)];
  const seen = new Set(sourceGaps);
  for (const finding of findings) {
    const message = eligibilitySourceGapMessage(finding);
    if (!seen.has(message)) {
      seen.add(message);
      sourceGaps.push(message);
    }
  }
  return {
    ...factCheck,
    status: 'NEEDS_FIX',
    source_gaps: sourceGaps,
    source_gap_count: sourceGaps.length,
    final_comment: [
      factCheck.final_comment,
      'Reporter eligibility violations were added as source gaps and require replacement or demotion.'
    ].filter(Boolean).join(' ')
  };
}

function pruneResolvedFallbackImageFalsePositives(factCheck, editor) {
  const result = pruneResolvedFallbackImageFactCheckItems(factCheck, editor, { root });
  if (result.removed.length > 0) {
    console.warn(`Pruned ${result.removed.length} resolved fallback image fact-check false positive(s).`);
  }
  return result.factCheck;
}

function finalArticleSlotDistribution(sections) {
  const distribution = {
    android_camera_platform_api: 0,
    camerax_aosp_camera_compatibility: 0,
    linux_camera_libcamera_v4l2: 0,
    ai_camera_path_hal_workflow: 0,
    cpp_toolchain_fallback: 0,
    other: 0
  };
  for (const section of ensureArray(sections)) {
    const body = [
      section.category,
      section.headline,
      section.evidence_summary,
      section.camera_hal_perspective,
      section.article_type,
      ensureArray(section.sources).map(source => `${source.title} ${source.url}`).join(' ')
    ].join(' ');
    if (/AI|agent|LLM|NPU|GPU|on-device|inference|model/i.test(body) &&
      /camera|HAL|stream|buffer|ImageAnalysis|workflow|latency|thermal|power/i.test(body)) {
      distribution.ai_camera_path_hal_workflow += 1;
    } else if (/libcamera|V4L2|Linux camera|media controller/i.test(body)) {
      distribution.linux_camera_libcamera_v4l2 += 1;
    } else if (/CameraX|AOSP Camera|CDD|CTS|VTS|Camera ITS|compatibility/i.test(body)) {
      distribution.camerax_aosp_camera_compatibility += 1;
    } else if (/Android Camera|Camera2|platform API|Camera HAL|request|result|metadata|stream|buffer/i.test(body)) {
      distribution.android_camera_platform_api += 1;
    } else if (/C\+\+|LLVM|Clang|NDK|toolchain/i.test(body)) {
      distribution.cpp_toolchain_fallback += 1;
    } else {
      distribution.other += 1;
    }
  }
  return distribution;
}

function deductionRepairPolicy(deduction = {}) {
  const category = stringOrEmpty(deduction.category);
  const reason = stringOrEmpty(deduction.reason);
  const haystack = `${category} ${reason}`;
  if (/source gap|source_gap|watchlist|watch page|ineligible|main_eligible=false|missing dated evidence|no dated release/i.test(haystack)) {
    return {
      failure_type: 'source-gap',
      action: 'replace-or-demote',
      allow_rewrite: false,
      reason: 'source gap or ineligible source must be demoted or replaced'
    };
  }
  if (/duplicate|source URL is used across main sections/i.test(haystack)) {
    return {
      failure_type: 'duplicate',
      action: 'replace-section',
      allow_rewrite: false,
      reason: 'duplicate source or article must be replaced'
    };
  }
  if (/scope-relevance|generic_tech_watchlist|expanded AOSP Camera \/ driver \/ SoC \/ native relevance|lacks article-level AOSP Camera/i.test(haystack)) {
    return {
      failure_type: 'scope-demotion',
      action: 'replace-or-demote',
      allow_rewrite: false,
      reason: 'structured scope demotion must open replacement or reserve path'
    };
  }
  if (/hal-depth|hal-relevance|weak HAL|Camera HAL perspective|engineering depth/i.test(haystack)) {
    return {
      failure_type: 'weak-hal-relevance',
      action: 'replace-section',
      allow_rewrite: false,
      reason: 'weak HAL relevance should use a stronger candidate'
    };
  }
  if (/actionability|action item/i.test(haystack)) {
    return {
      failure_type: 'missing-actionability',
      action: 'repair-section',
      allow_rewrite: true,
      reason: 'same-source actionability repair is allowed once'
    };
  }
  if (/required-fields|evidence-specificity/i.test(haystack)) {
    return {
      failure_type: category || 'evidence',
      action: 'repair-section',
      allow_rewrite: true,
      reason: 'same-source evidence or required-field repair is allowed once'
    };
  }
  return {
    failure_type: category || 'unknown',
    action: 'repair-section',
    allow_rewrite: true,
    reason: 'section-scoped repair is allowed'
  };
}

function mergeRepairPolicies(policies) {
  const priority = ['replace-or-demote', 'replace-section', 'repair-section'];
  const items = ensureArray(policies);
  return items.sort((a, b) => priority.indexOf(a.action) - priority.indexOf(b.action))[0] || null;
}

function recommendedFixMentionsSection(item, section) {
  const haystack = normalizeTitle(item);
  const labels = [
    section.headline,
    section.category,
    ...ensureArray(section.sources).flatMap(source => [source.title, source.url])
  ].map(normalizeTitle).filter(Boolean);
  return labels.some(label => haystack.includes(label) || label.includes(haystack));
}

function articleResultMatchesSection(result, section) {
  const resultUrls = new Set(ensureArray(result?.sources).map(source => stringOrEmpty(source?.url)).filter(Boolean));
  if (ensureArray(section.sources).some(source => resultUrls.has(stringOrEmpty(source.url)))) return true;
  const resultLabels = [
    result?.headline,
    result?.category
  ].map(normalizeTitle).filter(Boolean);
  if (resultLabels.length === 0) return false;
  const sectionLabels = [
    section.headline,
    section.category,
    ...ensureArray(section.sources).flatMap(source => [source.title, source.url])
  ].map(normalizeTitle).filter(Boolean);
  return sectionLabels.some(sectionLabel =>
    resultLabels.some(resultLabel =>
      resultLabel === sectionLabel ||
      resultLabel.includes(sectionLabel) ||
      sectionLabel.includes(resultLabel)
    )
  );
}

function articleResultForSection(section, qualityReport) {
  return ensureArray(qualityReport?.article_results)
    .find(result => articleResultMatchesSection(result, section)) || null;
}

function buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings = [], options = {}) {
  const maxSectionRepairs = Number.isInteger(options.maxSectionRepairs) ? options.maxSectionRepairs : Infinity;
  const sectionPlans = ensureArray(editor.sections).map(section => {
    const deductions = ensureArray(qualityReport?.deductions)
      .filter(deduction => deductionMatchesSection(deduction, section));
    const recommendedFixes = ensureArray(factCheck?.recommended_fixes)
      .filter(item => recommendedFixMentionsSection(item, section));
    const sectionEligibilityFindings = eligibilityFindings.filter(finding => finding.section === section);
    const hasSourceGap = sectionHasSourceGap(section, factCheck);
    const hasReporterEligibilityBlock = sectionEligibilityFindings.length > 0;
    const articleResult = articleResultForSection(section, qualityReport);
    const policies = [
      ...deductions.map(deductionRepairPolicy),
      ...recommendedFixes.map(item => deductionRepairPolicy({ category: 'recommended-fix', reason: item }))
    ];
    if (articleResult?.status === 'DEMOTE') {
      policies.push({
        failure_type: 'scope-demotion',
        action: 'replace-or-demote',
        allow_rewrite: false,
        reason: `article gate status DEMOTE requires replacement path (${articleResult.repair_action || 'demote-or-replace'})`
      });
    } else if (articleResult?.status === 'FAIL') {
      policies.push({
        failure_type: 'article-gate-fail',
        action: 'replace-or-demote',
        allow_rewrite: false,
        reason: `article gate status FAIL requires replacement path (${articleResult.repair_action || 'replace-or-demote'})`
      });
    }
    if (hasSourceGap || hasReporterEligibilityBlock) {
      policies.push({
        failure_type: 'source-gap',
        action: 'replace-or-demote',
        allow_rewrite: false,
        reason: 'source gap or reporter eligibility violation must be demoted or replaced'
      });
    }
    const policy = mergeRepairPolicies(policies);
    const action = policy ? policy.action : 'preserve';
    return {
      headline: sectionLabel(section),
      sources: sectionUrls(section),
      action,
      failure_type: policy?.failure_type || '',
      allow_rewrite: policy?.allow_rewrite !== false,
      policy_reason: policy?.reason || '',
      source_gap: hasSourceGap,
      reporter_eligibility_violations: sectionEligibilityFindings.map(finding => ({
        source_title: finding.source_title,
        source_url: finding.source_url,
        candidate_title: finding.candidate_title,
        reason: finding.reason
      })),
      deductions: deductions.map(deduction => ({
        category: deduction.category,
        points: deduction.points,
        reason: deduction.reason,
        location: deduction.location || ''
      })),
      recommended_fixes: recommendedFixes
    };
  }).filter(item => item.action !== 'preserve');
  const priority = { 'replace-or-demote': 0, 'replace-section': 1, 'repair-section': 2 };
  return sectionPlans
    .sort((a, b) => (priority[a.action] ?? 9) - (priority[b.action] ?? 9))
    .slice(0, maxSectionRepairs);
}

function buildFullSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings = []) {
  return buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings, {
    maxSectionRepairs: Infinity
  });
}

function sectionMatchesRepairItem(section, item) {
  if (!section || !item) return false;
  if (sectionLabel(section) === item.headline) return true;
  const urls = new Set(sectionUrls(section));
  return ensureArray(item.sources).some(url => urls.has(url));
}

function sectionsMatchingRepairPlan(sections, repairPlan) {
  return ensureArray(sections).filter(section =>
    ensureArray(repairPlan).some(item => sectionMatchesRepairItem(section, item))
  );
}

function sectionsOutsideRepairPlan(sections, repairPlan) {
  return ensureArray(sections).filter(section =>
    !ensureArray(repairPlan).some(item => sectionMatchesRepairItem(section, item))
  );
}

function hasTooFewMainArticlesDeduction(qualityReport) {
  return ensureArray(qualityReport?.deductions).some(deduction =>
    deduction?.category === 'composition' &&
    /main articles/i.test(String(deduction.reason || '')) &&
    Number(qualityReport?.metrics?.article_count || 0) < articlePolicy.mainArticleCount.min
  );
}

function availableCompletionCandidates(reporter, currentSections, excludedSections = [], rejected = [], options = {}) {
  const allCandidates = ensureArray(reporter?.candidates).filter(candidate =>
    isFinalSelected(candidate) || (options.allowReserve === true && isReserveCandidate(candidate))
  );
  const hasStrongerReserve = allCandidates.some(candidate =>
    isReserveCandidate(candidate) &&
    isMainSupplementBucket(candidate) &&
    !reporterCandidateRejectionReason(candidate) &&
    !candidateDuplicateReason(candidate, currentSections, 'locked') &&
    !candidateDuplicateReason(candidate, excludedSections, 'demoted')
  );
  const accepted = [];
  for (const candidate of allCandidates) {
    let reason = '';
    const eligibilityReason = reporterCandidateRejectionReason(candidate);
    if (eligibilityReason) {
      reason = /source_gap_risk=true|watch page|missing dated evidence|evidence_score=/i.test(eligibilityReason)
        ? 'source_gap_candidate'
        : eligibilityReason;
    } else if (!isMainSupplementBucket(candidate)) {
      reason = hasStrongerReserve ? 'weaker_priority_than_available_reserve' : 'ineligible_bucket';
    } else {
      reason =
        candidateDuplicateReason(candidate, currentSections, 'locked') ||
        candidateDuplicateReason(candidate, excludedSections, 'demoted');
    }
    if (reason) {
      rejected.push(retryRejectionRecord(candidate, reason));
      continue;
    }
    accepted.push(candidate);
  }
  return accepted.sort((a, b) =>
    candidatePriority(a) - candidatePriority(b) ||
    Number(b.deterministic_score || 0) - Number(a.deterministic_score || 0) ||
    String(a.title || '').localeCompare(String(b.title || ''))
  );
}

function buildCompletionExclusionContext(lockedSections, duplicateSections, sourceGapOrIneligibleSections) {
  const context = {
    locked_sections: lockedSections.map((section, index) => sectionSummary(section, index)),
    duplicate_or_rejected_sections: duplicateSections.map((section, index) => sectionSummary(section, index)),
    source_gap_or_ineligible_sections: sourceGapOrIneligibleSections.map((section, index) => sectionSummary(section, index))
  };
  return JSON.stringify(context, null, 2);
}

function validateCompletionSections(value, date, reporter) {
  const sections = ensureArray(value?.sections);
  if (sections.length === 0) fail('Editor completion output must contain at least one section.');
  const normalizedSections = sections.map((section, index) => normalizeEditorSection(section, index, reporter));
  const emptySourceSections = normalizedSections
    .filter(section => section.sources.length === 0)
    .map(section => section.category);
  if (emptySourceSections.length > 0) {
    fail(`Editor completion output has sections without sources: ${emptySourceSections.join(', ')}`);
  }
  return normalizedSections;
}

function buildRetryHistoryMarkdown(date, attempts, selectionDiagnostics = null) {
  const rows = attempts.map(item => [
    item.attempt,
    item.model || 'default',
    `${item.score}/${item.threshold}`,
    item.status,
    item.rendered_main_article_count ?? ensureArray(item.selected_article_headlines).length,
    ensureArray(item.locked_sections).length,
    item.demoted_article_count ?? ensureArray(item.demoted_sections).length,
    ensureArray(item.reserve_candidates_used).length,
    ensureArray(item.rejected_duplicate_headlines).length,
    item.source_gap_count,
    item.must_fix_count
  ]);
  return `# 뉴스레터 재시도 기록 - ${date}

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}

${selectionDiagnostics ? renderCandidateSelectionDiagnostics(selectionDiagnostics) : ''}

${attempts.map(item => `## 시도 ${item.attempt}

- 선택 기사: ${item.selected_article_headlines.join('; ') || '없음'}
- Lock된 기사: ${item.locked_article_headlines.join('; ') || '없음'}
- Source gap section: ${ensureArray(item.source_gap_sections).join('; ') || '없음'}
- Demoted section: ${ensureArray(item.demoted_sections).join('; ') || '없음'}
- Replaced section: ${ensureArray(item.replaced_sections).join('; ') || '없음'}
- Reserve candidate used: ${ensureArray(item.reserve_candidates_used).map(entry => `${entry.title || 'untitled'} (${entry.url || entry.source || 'unknown'})`).join('; ') || '없음'}
- Candidate rejection: ${ensureArray(item.candidate_rejections).map(entry => `${entry.title || 'untitled'} (${entry.reason || 'rejected'})`).join('; ') || '없음'}
- Underfilled reason: ${item.underfilled_reason || '없음'}
- 실패 section: ${ensureArray(item.failed_sections).map(section => section.headline || section.category || 'untitled').join('; ') || '없음'}
- 재생성 section: ${ensureArray(item.regenerated_sections).map(section => section.headline || section.category || 'untitled').join('; ') || '없음'}
- 거절된 retry output: ${ensureArray(item.rejected_retry_outputs).map(entry => `${entry.title || 'untitled'} (${entry.reason || 'rejected'})`).join('; ') || '없음'}
- Repair action: ${ensureArray(item.repair_actions).join('; ') || '없음'}
- Final slot distribution: ${JSON.stringify(item.final_article_slot_distribution || {})}
- Reporter eligibility blocked section: ${ensureArray(item.reporter_eligibility_blocked_sections).map(item => `${item.headline || 'untitled'} (${item.reason || 'blocked'})`).join('; ') || '없음'}
- Rejected main-ineligible candidate: ${ensureArray(item.rejected_main_ineligible_candidates).map(candidate => `${candidate.title || candidate} (${candidate.reason || 'rejected'})`).join('; ') || '없음'}
- Lock blocker: ${ensureArray(item.lock_blockers).join('; ') || '없음'}
- 거절된 중복 기사: ${ensureArray(item.rejected_duplicate_headlines).map(entry => typeof entry === 'string' ? entry : `${entry.title || 'untitled'} (${entry.reason || 'rejected'})`).join('; ') || '없음'}
- 감점: ${item.deductions.length === 0 ? '없음' : item.deductions.map(deduction => `${deduction.points}pt ${deduction.category}${deduction.location ? ` (${deduction.location})` : ''}: ${deduction.reason}`).join('; ')}
`).join('\n')}`;
}

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

function buildSelectionReport(date, shortlistReport, selectionDiagnostics) {
  const report = shortlistReport || {};
  const selectionErrors = ensureArray(report.selection_errors);
  const selectionWarnings = ensureArray(report.selection_warnings);
  const selectionShortageHints = ensureArray(report.selection_shortage_hints);
  const candidateShortage = report.candidate_shortage_reviewable === true;
  const failureStage = candidateShortage
    ? 'candidate_pool_preflight'
    : selectionErrors.length > 0 ? 'deterministic selection' : '';
  const failureReason = candidateShortage
    ? ensureArray(report.shortage_reason_codes).join('; ') || 'Not enough publishable candidates before LLM generation.'
    : selectionErrors.join('; ');
  return {
    schema_version: 1,
    date,
    generated_at: new Date().toISOString(),
    status: candidateShortage
      ? 'UNDERFILLED_NEEDS_FIX'
      : selectionErrors.length > 0
      ? 'FAILED'
      : selectionWarnings.length > 0 ? 'UNDERFILLED_NEEDS_FIX' : 'OK',
    failure_stage: failureStage,
    failure_reason: failureReason,
    selection_errors: selectionErrors,
    selection_warnings: selectionWarnings,
    selection_shortage_hints: selectionShortageHints,
    review_gate_passed: Boolean(selectionDiagnostics.review_gate_passed),
    publish_gate_passed: Boolean(selectionDiagnostics.publish_gate_passed),
    gate_summary: {
      review_gate_passed: Boolean(selectionDiagnostics.review_gate_passed),
      publish_gate_passed: Boolean(selectionDiagnostics.publish_gate_passed),
      non_fallback_reviewable_article_count: selectionDiagnostics.non_fallback_reviewable_article_count,
      primary_camera_stack_topic_count: selectionDiagnostics.primary_camera_stack_topic_count,
      supporting_main_article_count: selectionDiagnostics.supporting_main_article_count,
      forbidden_main_article_count: selectionDiagnostics.forbidden_main_article_count,
      eligible_non_fallback_reviewable_article_count: selectionDiagnostics.eligible_non_fallback_reviewable_article_count,
      min_final_articles: selectionDiagnostics.min_final_articles,
      max_final_articles: selectionDiagnostics.max_final_articles,
      absolute_min_reviewable_articles: selectionDiagnostics.absolute_min_reviewable_articles,
      min_non_fallback_publish_ready_articles: selectionDiagnostics.min_non_fallback_publish_ready_articles,
      selected_article_count: selectionDiagnostics.selected_article_count
    },
    composition_mode: selectionDiagnostics.composition_mode,
    composition_reason: selectionDiagnostics.composition_reason,
    composition_summary: selectionDiagnostics.composition_summary || {},
    eligible_composition_summary: selectionDiagnostics.eligible_composition_summary || {},
    candidate_pool_preflight_passed: report.candidate_pool_preflight_passed !== false,
    candidate_shortage_reviewable: report.candidate_shortage_reviewable === true,
    candidate_shortage_summary: report.candidate_shortage_summary || {},
    shortage_reason_codes: ensureArray(report.shortage_reason_codes),
    source_parser_hints: ensureArray(report.source_parser_hints),
    counts: {
      input_candidate_count: selectionDiagnostics.input_candidate_count,
      eligible_candidate_count: selectionDiagnostics.eligible_candidate_count,
      selected_article_count: selectionDiagnostics.selected_article_count,
      deterministic_selected_count: selectionDiagnostics.deterministic_selected_count,
      reserve_candidate_count: selectionDiagnostics.reserve_candidate_count,
      direct_aosp_camera_count: selectionDiagnostics.direct_aosp_camera_count,
      camera_driver_image_pipeline_count: selectionDiagnostics.camera_driver_image_pipeline_count,
      android_platform_camera_adjacent_count: selectionDiagnostics.android_platform_camera_adjacent_count,
      soc_platform_signal_count: selectionDiagnostics.soc_platform_signal_count,
      cpp_ai_tooling_fallback_count: selectionDiagnostics.cpp_ai_tooling_fallback_count,
      generic_tech_watchlist_count: selectionDiagnostics.generic_tech_watchlist_count,
      primary_camera_stack_topic_count: selectionDiagnostics.primary_camera_stack_topic_count,
      supporting_main_article_count: selectionDiagnostics.supporting_main_article_count,
      forbidden_main_article_count: selectionDiagnostics.forbidden_main_article_count,
      non_fallback_reviewable_article_count: selectionDiagnostics.non_fallback_reviewable_article_count
    },
    exclusion_reason_summary: selectionDiagnostics.exclusion_reason_summary || [],
    final_exclusion_reason_summary: selectionDiagnostics.final_exclusion_reason_summary || [],
    candidate_selection_note: selectionDiagnostics.candidate_selection_note || ''
  };
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
    `- absolute_min_reviewable_articles: ${selectionReport.gate_summary.absolute_min_reviewable_articles ?? 'unknown'}`,
    `- min_non_fallback_publish_ready_articles: ${selectionReport.gate_summary.min_non_fallback_publish_ready_articles ?? 'unknown'}`,
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
  const sourcesPath = path.join(root, 'docs', 'news-sources.md');
  const editorialPolicyPath = path.join(root, 'docs', 'editorial-policy.md');
  const newsletterTemplatePath = path.join(root, 'docs', 'newsletter-template.md');
  const goldenExamplePath = path.join(root, 'docs', 'golden-examples', 'manual-quality-newsletter.md');
  const newsroomDir = artifactNewsroomDir(root, date);
  const newsletterDir = path.join(root, 'newsletters', date);

  if (!fs.existsSync(sourceRegistryPath) && !fs.existsSync(sourcesPath)) {
    fail('Missing data/news-sources.json and docs/news-sources.md.');
  }

  const candidates = readJson(candidatePath);
  const sourcesMarkdown = readTextIfExists(sourcesPath);
  const editorialPolicy = readTextIfExists(editorialPolicyPath);
  const newsletterTemplate = readTextIfExists(newsletterTemplatePath);
  const goldenExample = readTextIfExists(goldenExamplePath);
  const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : null;
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
  let articleCapsuleReport = buildArticleCapsuleReport(date, shortlistReport, reporterInput);
  writeJson(path.join(newsroomDir, 'article-capsules.json'), articleCapsuleReport);
  if (shortlistReport.candidate_shortage_reviewable === true) {
    const failureReason = ensureArray(shortlistReport.shortage_reason_codes).join('; ') ||
      ensureArray(shortlistReport.selection_errors).join('; ') ||
      'Not enough publishable candidates before LLM generation.';
    writeGenerationStatus(buildGenerationStatus({
      date,
      status: 'UNDERFILLED_NEEDS_FIX',
      extra: {
        ...selectionStatusExtra(shortlistReport),
        failure_kind: 'candidate_shortage_reviewable',
        failure_stage: 'candidate_pool_preflight',
        failure_reason: failureReason,
        publish_ready: false,
        selection_publish_ready: false,
        final_publish_ready: false,
        publish_gate_passed: false,
        review_gate_passed: true,
        composition_mode: COMPOSITION_MODES.NEEDS_FIX,
        editor_review_required: true
      }
    }));
    console.warn(`Candidate pool preflight is review-only: ${failureReason}`);
    return;
  }
  if (shortlistReport.selection_warnings.length > 0) {
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
  if (shortlistReport.selection_errors.length > 0) {
    writeRecoveryPrompt(newsroomDir, {
      date,
      stage: 'deterministic selection',
      reason: shortlistReport.selection_errors.join('; '),
      shortlistReport,
      selectedInputs: shortlistReport.selected_articles
    });
    fail(`[deterministic selection] ${shortlistReport.selection_errors.join('; ')}`);
  }

  let backgroundContextReport = buildStaticBackgroundContextReport(date, articleCapsuleReport);
  writeJson(path.join(newsroomDir, 'background-context.json'), backgroundContextReport);

  const commonContext = [
    `Newsletter date: ${date}`,
    'Audience: AOSP Camera / Camera HAL / Camera Driver / SoC Platform / C++ engineer',
    'Use only the collected candidate JSON, data/news-sources.json, docs/news-sources.md, and the editorial documents below. Do not browse the web.',
    'Keep source names and source URLs unchanged. Distinguish confirmed facts from interpretation.',
    'Final newsletter text must be Korean.',
    '',
    'docs/editorial-policy.md:',
    editorialPolicy,
    '',
    'docs/newsletter-template.md:',
    newsletterTemplate,
    '',
    'docs/golden-examples/manual-quality-newsletter.md:',
    goldenExample,
    '',
    'Use the golden example only as a style and structure reference. Do not copy facts, dates, versions, API/component names, behavior changes, sources, or action items unless they are present in the current candidate JSON.'
  ].join('\n');

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
      [
        'You are the AI reporter for AOSP Camera / Driver / SoC Platform Newsletter.',
        'The local deterministic selector has already filtered, ranked, and chosen final article inputs. Do not make final selection decisions.',
        'Use selected only for reporter-stage judgment. Deterministic final article inputs are marked separately as final_selected=true and selected_for_editor=true after validation.',
        'Preserve primary_selected and reserve_candidate flags exactly. Reserve candidates are replacement pool inputs, not initial main article choices.',
        'Summarize, tag, and refine evidence fields only for the supplied shortlisted article capsules.',
        'Use article capsule fields, risk, score, selection, imageCandidates, and evidence only as context. Do not assume omitted source text exists.',
        linkedEvidencePromptGuardrails(),
        sourceExtractionPromptGuardrails(),
        'Reporter stage must provide evidence-backed candidate facts and guardrails only. Do not create final article-level claims[]; the editor owns article claims[].',
        'For every final_selected candidate, extract concrete evidence when available: version_or_release, api_or_component, behavior_change, evidence_notes, and cross_check_status.',
        'Preserve eligibility and risk values from the article capsule. If a required schema field is not present, infer only from the capsule evidence and risk object.',
        'If the source is a rolling page, release-note watch page, documentation watch page, homepage, or other watch page, say that explicitly in evidence_notes and do not present it as a dated release unless the candidate provides date/version/API/component/behavior evidence.',
        'Rolling release-note pages require evidence_notes that name the exact date, version/release, API/component, and behavior change before they can be selected.',
        'cross_check_status must be one of: not-required, official-source, cross-checked, needs-cross-check.',
        'Candidate-only or requiresCrossCheck leads must not be selected unless cross_check_status is official-source or cross-checked.',
        'Fallback SoC/platform, C++, native, toolchain, Linux, and AI items can remain reporter-selected only when they satisfy the reporter-stage evidence and relevance rules.',
        'Preserve editorial_priority, relevance_bucket, impact_claim_level, aosp_camera_directness, driver_stack_relevance, soc_platform_relevance, native_tooling_relevance, counts_as_* flags, evidence_origin, and source_hint from the capsule/candidate metadata.',
        'Preserve imageCandidates exactly from the collected candidate JSON. Do not invent image URLs, rewrite image URLs, or add image candidates.',
        lockedSections.length > 0 ? 'Do not select candidates that duplicate the locked article URLs, titles, sources, or source-date-title combinations listed in the retry context.' : '',
        'For every candidate, provide these numeric scores:',
        '- camera_hal_relevance_score: 0-5',
        '- android_camera_relevance_score: 0-5',
        '- practical_actionability_score: 0-5',
        '- source_reliability_score: 0-5',
        '- freshness_score: 0-3',
        '- ai_required_slot_fit_score: 0-3',
        '- cpp_fallback_value_score: 0-3',
        'Return only JSON matching the schema.'
      ].filter(Boolean).join('\n'),
      `${commonContext}\n\n${lockedContext}\n\nArticle capsule shortlist JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, 'shortlisted'), null, 2)}\n\nCompact selection context JSON:\n${JSON.stringify(compactSelectionContext(shortlistReport), null, 2)}`,
      reporterSchema
    ), date, reporterInput.candidates);
    reporter = enforceDeterministicReporterSelection(reporter, shortlistReport);
    shortlistReport = normalizeShortlistReport(shortlistReport, reporter);
    generationRunState.shortlistReport = shortlistReport;
    generationRunState.selectedInputs = shortlistReport.selected_articles;
    writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
    writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);
    articleCapsuleReport = buildArticleCapsuleReport(date, shortlistReport, { date, candidates: reporter.candidates });
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
    writeJson(path.join(newsroomDir, `reporter-candidates-attempt-${attempt}.json`), reporter);

    const editorRetryContract = lockedSections.length > 0
      ? buildEditorRetryContract({
        lastKnownValidEditor: generationRunState.lastKnownValidEditor,
        currentEditor: editor,
        lockedSections
      })
      : null;
    const editorDraft = await callLlmJson(
      editorStage,
      [
        'You are the AI editor for AOSP Camera / Driver / SoC Platform Newsletter.',
        'Write a Korean technical newsletter draft that an AOSP Camera, Camera HAL, Camera Driver, or SoC platform engineer can read in 10 minutes.',
        'Follow docs/editorial-policy.md and docs/newsletter-template.md exactly.',
        `Create main articles within the Newsletter Policy range (${articleCountRangeText()}) when enough non-duplicate source material exists.`,
        `Final main article count must satisfy ${publishGateCriteriaText()}.`,
        'Use final-selected article capsules as main article inputs. Do not turn final_selected=false, finalSelectionEligibility=watchlist/exclude, isWatchPage=true without hasDatedEvidence, main_eligible=false, source_gap_risk=true, briefing_only, or reference_only candidates into main articles.',
        linkedEvidencePromptGuardrails(),
        sourceExtractionPromptGuardrails(),
        articleSectionContractPrompt(),
        articleClaimContractPrompt(),
        'Initial editor drafts must use only primary selected article capsules. Reserve candidates are not available until a primary article is demoted/removed during repair or completion.',
        `Priority order: ${[...articlePolicy.primaryCameraStack.buckets, ...articlePolicy.supportingMainBuckets].join(', ')}. Forbidden buckets stay briefing/watchlist only: ${articlePolicy.forbiddenMainBuckets.join(', ')}.`,
        'SoC/platform articles are lower-priority fallback, but do not exclude public CPU/GPU/NPU/ISP/power/thermal/performance information when it is final-selected and can be explained from Camera framework, HAL, driver, image pipeline, or platform performance perspective.',
        'AI/C++ articles are optional fallback items only when final-selected inputs contain concrete native camera, driver, SoC, build/test, debugging, performance, or workflow value. Do not invent or force a generic AI article.',
        editorRetryContract ? `Editor retry output contract: return the complete editor JSON with exactly ${editorRetryContract.target_section_count} sections.` : '',
        editorRetryContract ? `The final sections array must include all ${editorRetryContract.locked_section_count} locked section(s) unchanged and ${editorRetryContract.replacement_required_count} replacement/new section(s).` : '',
        editorRetryContract ? 'Returning only the locked sections is invalid. The sections array must be the full target draft, not a partial handoff.' : '',
        lockedSections.length > 0 ? 'Locked articles from previous attempts are already quality-passing. Keep these passed articles unchanged and generate only missing replacement articles inside the complete final sections array.' : '',
        lockedSections.length > 0 ? 'Do not duplicate locked article URLs, titles/headlines, source names, or same source + published date + similar title.' : '',
        'Avoid marketing tone. Include confirmed_facts, background, camera_hal_perspective, action_items, team_summary, and sources in every article.',
        'For background, use background-context.json background_context first when present. If it is missing, use article capsule background_context_static. Never copy raw source UI/table snippets into background.',
        'Preserve impact_claim_level from candidate or background context. Use it to control claim strength: direct_hal_change, camera_stack_direct, android_framework_adjacent, tooling_supporting, watch_only.',
        'Every article must include evidence_summary, specificity_checks, and source_verification_notes.',
        'Every main article must explicitly name the release date, version/release, API/component or library/artifact, concrete behavior change, relevance_bucket, and AOSP Camera / driver / SoC / native tooling relevance when those fields exist in the candidate metadata.',
        'specificity_checks must name concrete evidence such as version, release date, API/component, source page, behavior change, or the exact source gap if the source is a rolling/watch page.',
        'If release date, version/release, API/component, behavior change, or expanded editorial-scope relevance cannot be verified from the supplied candidate/source data, demote the item to briefing/watchlist or exclude it instead of writing it as a main article.',
        'Do not write generic advice like "monitor AOSP updates" or "review CameraX changes" unless the sentence names the exact source, version/release, API/component, date, or behavior to watch.',
        'For SoC, AI, C++, Linux, or tooling articles, explicitly connect the item to AOSP Camera, Camera HAL, Camera Driver, V4L2/libcamera, image pipeline/ISP/sensor, SoC performance/power/thermal, or native development productivity.',
        'For cpp_ai_tooling_fallback articles, explicitly state Android native development is Clang / LLVM / libc++ centric; do not imply GCC, C++ standard, or C++ library news means an Android HAL toolchain migration.',
        'Each action_items entry must be executable within 2 weeks and include at least one concrete test, log, metric, device class, API/component, stream combination, or code-owner style handoff.',
        'For C++ tooling action_items, name the HAL/native owner, target structure or API, experiment or serialization target, and metrics such as CPU time, latency, binary size, or boilerplate LOC.',
        'For each article, choose at most one selectedImage from that article imageCandidates. If relevance, rights risk, logo-only content, screenshot text density, or source fit is unclear, set selectedImage to an empty string.',
        'Do not invent image URLs. selectedImage must exactly match one imageCandidates.url value, or be an empty string.',
        'Prefer directly relevant 16:9 or 4:3 clean images from the source article over generic, logo-only, or promotional images.',
        'When selectedImage is set, ALWAYS provide imageSource, imageAttribution, imageAlt, imageLicenseStatus, and a short imageUsageDecisionReason. imageAlt must describe the image in article context.',
        'imageSource MUST be an HTTPS URL that links to the image source or article.',
        'imageAttribution MUST be non-empty source or article title text.',
        'If you cannot provide imageSource, imageAttribution, imageAlt, and imageLicenseStatus, do not select an image; leave selectedImage empty.',
        'Incomplete selected image metadata will be removed during validation and may cause publication validation failure.',
        'When no image is selected, keep selectedImage, imageSource, imageAttribution, and imageAlt empty, set imageLicenseStatus to none, and explain the rejection briefly in imageUsageDecisionReason.',
        'Separate facts and interpretation. Preserve source links. Return only JSON matching the schema.',
        'briefing must have exactly 3 items.'
      ].filter(Boolean).join('\n'),
      [
        commonContext,
        lockedContext,
        editorRetryContract ? `Editor retry output contract JSON:\n${JSON.stringify(editorRetryContract, null, 2)}` : '',
        `Primary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}`,
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
        newsroomDir
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
    editor = recordLastKnownValidEditor(editor, { date, reporter, attempt });
    writeCanonicalReviewArtifacts({ date, newsroomDir, reporter, editor });
    writeJson(path.join(newsroomDir, `editor-draft-attempt-${attempt}.json`), editor);
    fs.writeFileSync(path.join(newsroomDir, `editor-draft-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

    factCheck = validateFactCheck(await callLlmJson(
      factCheckStage,
      [
        'You are the AI fact checker for AOSP Camera / Driver / SoC Platform Newsletter.',
        'Check factuality, missing sources, exaggerated language, and missing dates.',
        linkedEvidencePromptGuardrails(),
        sourceExtractionPromptGuardrails(),
        'Treat missing version, release date, API/component name, or behavior change as must_fix when an article presents a rolling page or generic watch item as a concrete update.',
        'Treat any finalSelectionEligibility=watchlist/exclude candidate or watch page without dated evidence used as a main article as must_fix.',
        'Any claim without a source must be classified as must_fix.',
        articleSectionContractPrompt(),
        articleClaimContractPrompt(),
        'Flag general AI/C++/SoC news that lacks AOSP Camera, camera driver, SoC platform, or native development interpretation.',
        'Flag cpp_ai_tooling_fallback articles that imply Android HAL toolchain migration from GCC, C++ standard, or C++ library news instead of framing Android native development as Clang / LLVM / libc++ centric.',
        'Flag C++ tooling action items that do not name the HAL/native owner, target structure or API, experiment or serialization target, and measurable metrics.',
        'Flag any main article without concrete Action Item content.',
        'Flag any main article with weak Camera HAL perspective or missing engineering relevance.',
        'Flag candidate-only or requiresCrossCheck source usage unless the editor explains official-source or cross-checked verification.',
        'Do not treat resolvedImage.usedFallback=true as must_fix when selectedImage is a repo-local fallback path and originalImage or resolvedImage.originalUrl preserves the external original. Treat it as must_fix only when selectedImage still contains the broken external image URL or the fallback path is missing.',
        'Do not rewrite for style. Focus only on factual errors, source problems, and editorial-policy violations.',
        'Return only JSON matching the schema.'
      ].join('\n'),
      `${commonContext}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nEditor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
      factCheckSchema
    ));
    let eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections);
    factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
    factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
    generationRunState.factCheck = factCheck;
    writeJson(path.join(newsroomDir, `fact-check-report-attempt-${attempt}.json`), factCheck);
    fs.writeFileSync(path.join(newsroomDir, `fact-check-report-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

    qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
      threshold: qualityGatePolicy.threshold,
      shortlistReport,
      strictClaimValidation: true
    });
    generationRunState.qualityReport = qualityReport;
    editor = recordLastKnownValidEditor(editor, { date, reporter, factCheck, qualityReport, attempt });
    writeCanonicalReviewArtifacts({ date, newsroomDir, reporter, editor, factCheck, qualityReport });
    writeJson(path.join(newsroomDir, `quality-report-attempt-${attempt}.json`), qualityReport);
    fs.writeFileSync(path.join(newsroomDir, `quality-report-attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');

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
    if (qualityReport.status !== 'PASS' && repairPlan.length > 0) {
      const repairStage = `editor repair attempt ${attempt}/${totalAttempts}`;
      try {
        repairActions = repairPlan.map(item => `${item.action}: ${item.headline}`);
        failedSections = sectionsMatchingRepairPlan(editor.sections, repairPlan);
        const preservedSections = sectionsOutsideRepairPlan(editor.sections, repairPlan);
        const repairFactCheckStage = `fact-checker repair attempt ${attempt}/${totalAttempts}`;
        console.warn(`Quality attempt ${attempt}/${totalAttempts} is below threshold; running editor repair pass for ${repairPlan.length} section(s).`);
        const repairCandidateRejections = [];
        const repairAllowsReserve = demotedSections.length > 0;
        const repairCandidatePool = availableCompletionCandidates(
          reporter,
          preservedSections,
          excludedSections.concat(demotedSections),
          repairCandidateRejections,
          { allowReserve: repairAllowsReserve }
        );
        if (repairAllowsReserve && repairCandidatePool.some(isReserveCandidate)) {
          reservePoolOpened = true;
          reserveOpenReason = reserveOpenReason || 'repair_after_primary_demote_or_source_gap';
        }
        candidateRejections = candidateRejections.concat(repairCandidateRejections);
        const beforeRepairSections = editor.sections;
        const repairSections = validateCompletionSections(await callLlmJson(
          repairStage,
          [
          'You are the AI repair editor for AOSP Camera / Driver / SoC Platform Newsletter.',
          'Return only regenerated section JSON for the failed sections listed in the repair plan. Never return a full newsletter draft.',
          'For repair-section actions, repair only the affected section using the same source.',
          'For replace-section actions, replace the section with a stronger supplied candidate instead of rewriting weak evidence.',
          'For replace-or-demote actions, demote the article to briefing/watchlist or replace it. Never rewrite source gaps into publishable facts.',
          'For reporter_eligibility_violations, replace or demote the section. Do not repair text around an ineligible source.',
          'Replacement main articles must use only primary selected capsules that are not locked/excluded or reserve candidate capsules supplied in this prompt.',
          linkedEvidencePromptGuardrails(),
          sourceExtractionPromptGuardrails(),
          articleSectionContractPrompt(),
          articleClaimContractPrompt(),
          'Preserve locked/passing sections unchanged and do not duplicate locked or excluded articles.',
          'Locked/passing sections already satisfied the gate; preserve their source URLs, title/headline, and source-date-title combinations exactly unless they are explicitly listed in the repair plan.',
          'For each regenerated section, explicitly provide release date, version/release, API/component or library/artifact, concrete behavior change, relevance_bucket, and AOSP Camera / driver / SoC / native tooling relevance.',
          'If those facts cannot be verified from the supplied candidate/source data, demote to briefing/watchlist or exclude; do not invent or infer missing release evidence.',
          `Keep main article count within the Newsletter Policy range (${articleCountRangeText()}).`,
          `Maintain the Newsletter Policy bucket order: ${[...articlePolicy.primaryCameraStack.buckets, ...articlePolicy.supportingMainBuckets].join(', ')}. Forbidden buckets stay briefing/watchlist only: ${articlePolicy.forbiddenMainBuckets.join(', ')}.`,
          'Use the golden example only for article structure and evidence/actionability style. Do not copy facts absent from current reporter candidates.',
          'Return only JSON matching the schema.'
        ].join('\n'),
        `${commonContext}\n\n${lockedContext}\n\nRepair plan JSON:\n${JSON.stringify(repairPlan, null, 2)}\n\nLocked/passing sections JSON:\n${JSON.stringify(preservedSections.map((section, index) => sectionSummary(section, index)), null, 2)}\n\nFailed sections JSON:\n${JSON.stringify(failedSections.map((section, index) => sectionSummary(section, index)), null, 2)}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nReserve candidate capsule pool JSON:\n${JSON.stringify(reporterCandidateCapsules(date, repairCandidatePool, articleCapsuleReport), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nCandidate rejection diagnostics JSON:\n${JSON.stringify(repairCandidateRejections, null, 2)}\n\nCurrent fact-check JSON:\n${JSON.stringify(factCheck, null, 2)}\n\nCurrent quality deductions JSON:\n${JSON.stringify(ensureArray(qualityReport?.deductions), null, 2)}`,
          editorCompletionSchema
        ), date, reporter);
        const repairMerged = mergeLockedSections(preservedSections, repairSections, excludedSections.concat(demotedSections));
        validateTargetedRepairResult({
          beforeSections: beforeRepairSections,
          repairSections,
          afterSections: repairMerged.sections,
          lockedSections: preservedSections,
          mode: 'targeted-repair',
          allowCountChange: false,
          date,
          reporter
        });
        rejectedGeneratedSections = rejectedGeneratedSections.concat(repairMerged.rejected);
        rejectedRetryOutputs = repairMerged.rejected;
        replacedSections = repairMerged.rejected
          .filter(item => ['duplicate_demoted_url', 'duplicate_source_date_title', 'source_gap_candidate'].includes(item.reason))
          .map(item => item.title);
        regeneratedSections = repairSections;
        reserveCandidatesUsed = reserveCandidatesUsed.concat(reserveUsageForSections(repairMerged.sections, reporter));
        editor = validateEditor({
          ...editor,
          sections: repairMerged.sections
        }, date, reporter);
        attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
        await resolveIssueArticleImages(editor, { root });
        warnResolvedImageFallbacks(editor);
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
          'You are the AI fact checker for the repaired AOSP Camera / Driver / SoC Platform Newsletter draft.',
          'Check factuality, missing sources, exaggerated language, missing dates, source gaps, and editorial-policy violations.',
          linkedEvidencePromptGuardrails(),
          sourceExtractionPromptGuardrails(),
          articleSectionContractPrompt(),
          articleClaimContractPrompt(),
          'Treat missing release date, version/release, API/component or library/artifact, concrete behavior change, or expanded editorial-scope relevance as must_fix for any main article.',
          'Treat any remaining source gap or watchlist/reference page used as a main article as must_fix.',
          'Flag cpp_ai_tooling_fallback articles that imply Android HAL toolchain migration from GCC, C++ standard, or C++ library news instead of framing Android native development as Clang / LLVM / libc++ centric.',
          'Flag C++ tooling action items that do not name the HAL/native owner, target structure or API, experiment or serialization target, and measurable metrics.',
          'Do not treat resolvedImage.usedFallback=true as must_fix when selectedImage is a repo-local fallback path and originalImage or resolvedImage.originalUrl preserves the external original. Treat it as must_fix only when selectedImage still contains the broken external image URL or the fallback path is missing.',
          'Return only JSON matching the schema.'
        ].join('\n'),
        `${commonContext}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nReserve article capsule pool JSON:\n${JSON.stringify(reserveReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nRepaired editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
          factCheckSchema
        ));
        eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections, {
          allowReserve: repairAllowsReserve
        });
        factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
        factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
        generationRunState.factCheck = factCheck;
        writeJson(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.json`), factCheck);
        fs.writeFileSync(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

        qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
          threshold: qualityGatePolicy.threshold,
          shortlistReport,
          strictClaimValidation: true
        });
        generationRunState.qualityReport = qualityReport;
        editor = recordLastKnownValidEditor(editor, { date, reporter, factCheck, qualityReport, attempt });
        writeCanonicalReviewArtifacts({ date, newsroomDir, reporter, editor, factCheck, qualityReport });
        writeJson(path.join(newsroomDir, `quality-report-repair-attempt-${attempt}.json`), qualityReport);
        fs.writeFileSync(path.join(newsroomDir, `quality-report-repair-attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');
        demotedSections = appendUniqueSections(
          demotedSections,
          sourceGapSections(editor, factCheck).concat(eligibilityFindings.map(finding => finding.section))
        );
      } catch (error) {
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
        return;
      }
    }

    if (hasTooFewMainArticlesDeduction(qualityReport)) {
      const missingArticleCount = articlePolicy.mainArticleCount.min - ensureArray(editor.sections).length;
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
        try {
          const completionFactCheckStage = `fact-checker completion attempt ${attempt}/${totalAttempts}`;
          console.warn(`Quality attempt ${attempt}/${totalAttempts} has only ${editor.sections.length} main article(s); requesting ${missingArticleCount} completion article(s).`);
          const beforeCompletionSections = editor.sections;
          const completionSections = validateCompletionSections(await callLlmJson(
            completionStage,
            [
            'You are the AI completion editor for AOSP Camera / Driver / SoC Platform Newsletter.',
            `Return only ${missingArticleCount} additional main article section(s), never a full newsletter rewrite.`,
            'Preserve existing valid sections by excluding their URLs, titles, source names, and source-date-title combinations.',
            'Use only the eligible reporter candidates supplied in this prompt. Do not use candidates omitted from the eligible list.',
            linkedEvidencePromptGuardrails(),
            sourceExtractionPromptGuardrails(),
            articleSectionContractPrompt(),
            articleClaimContractPrompt(),
            'Do not duplicate locked, duplicate/rejected, source-gap, or ineligible sections from the exclusion context.',
            'Each new section must satisfy the same editorial contract: confirmed_facts, background, camera_hal_perspective, action_items, team_summary, evidence_summary, specificity_checks, source_verification_notes, camera_hal_checks, and sources.',
            'Each new section must name release date, version/release, API/component or library/artifact, concrete behavior change, relevance_bucket, and AOSP Camera / driver / SoC / native tooling relevance using only supplied candidate metadata/source text.',
            'Reject duplicate URLs, duplicate titles, and duplicate source-date-title combinations from the exclusion context.',
            'If the facts cannot be verified, do not create a main article from that candidate; leave the newsletter underfilled for editor review instead.',
            'For each article, choose at most one selectedImage from that article imageCandidates; use an empty selectedImage when attribution or relevance is uncertain.',
            'Final newsletter text must be Korean. Return only JSON matching the schema.'
          ].join('\n'),
          `${commonContext}\n\nCompletion exclusion context JSON:\n${buildCompletionExclusionContext(lockedSections, editor.sections, completionExcludedSections)}\n\nCurrent editor section summaries JSON:\n${JSON.stringify(editor.sections.map((section, index) => sectionSummary(section, index)), null, 2)}\n\nEligible primary/reserve article capsules for additional articles JSON:\n${JSON.stringify(reporterCandidateCapsules(date, completionCandidates, articleCapsuleReport), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nCandidate rejection diagnostics JSON:\n${JSON.stringify(completionCandidateRejections, null, 2)}\n\nCurrent quality deductions JSON:\n${JSON.stringify(ensureArray(qualityReport?.deductions), null, 2)}`,
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
          }, date, reporter);
          attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
          await resolveIssueArticleImages(editor, { root });
          warnResolvedImageFallbacks(editor);
          writeJson(path.join(newsroomDir, `editor-completion-attempt-${attempt}.json`), editor);
          fs.writeFileSync(path.join(newsroomDir, `editor-completion-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

          factCheck = validateFactCheck(await callLlmJson(
            completionFactCheckStage,
            [
            'You are the AI fact checker for the completed AOSP Camera / Driver / SoC Platform Newsletter draft.',
            'Check factuality, missing sources, exaggerated language, missing dates, source gaps, and editorial-policy violations.',
            linkedEvidencePromptGuardrails(),
            sourceExtractionPromptGuardrails(),
            articleSectionContractPrompt(),
            articleClaimContractPrompt(),
            'Focus on whether the added sections use only eligible reporter candidates and whether the full draft now satisfies the Newsletter Policy article composition contract.',
            'Flag cpp_ai_tooling_fallback articles that imply Android HAL toolchain migration from GCC, C++ standard, or C++ library news instead of framing Android native development as Clang / LLVM / libc++ centric.',
            'Flag C++ tooling action items that do not name the HAL/native owner, target structure or API, experiment or serialization target, and measurable metrics.',
            'Do not treat resolvedImage.usedFallback=true as must_fix when selectedImage is a repo-local fallback path and originalImage or resolvedImage.originalUrl preserves the external original. Treat it as must_fix only when selectedImage still contains the broken external image URL or the fallback path is missing.',
            'Return only JSON matching the schema.'
          ].join('\n'),
          `${commonContext}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nReserve article capsule pool JSON:\n${JSON.stringify(reserveReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nCompleted editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
            factCheckSchema
          ));
          eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections, {
            allowReserve: completionAllowsReserve
          });
          factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
          factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
          generationRunState.factCheck = factCheck;
          writeJson(path.join(newsroomDir, `fact-check-completion-attempt-${attempt}.json`), factCheck);
          fs.writeFileSync(path.join(newsroomDir, `fact-check-completion-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

          qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
            threshold: qualityGatePolicy.threshold,
            shortlistReport,
            strictClaimValidation: true
          });
          generationRunState.qualityReport = qualityReport;
          editor = recordLastKnownValidEditor(editor, { date, reporter, factCheck, qualityReport, attempt });
          writeCanonicalReviewArtifacts({ date, newsroomDir, reporter, editor, factCheck, qualityReport });
          writeJson(path.join(newsroomDir, `quality-report-completion-attempt-${attempt}.json`), qualityReport);
          fs.writeFileSync(path.join(newsroomDir, `quality-report-completion-attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');
          repairActions.push(`complete-missing-articles: requested ${missingArticleCount}, added ${Math.max(0, editor.sections.length - (articlePolicy.mainArticleCount.min - missingArticleCount))}`);
          demotedSections = appendUniqueSections(
            demotedSections,
            sourceGapSections(editor, factCheck).concat(eligibilityFindings.map(finding => finding.section))
          );
        } catch (error) {
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
  editor = validateEditor(staleScrub.editor, date, reporter);
  factCheck = pruneResolvedStaleFactCheckItems(factCheck, staleScrub.report);
  factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
  generationRunState.factCheck = factCheck;
  writeJson(path.join(newsroomDir, 'stale-claim-report.json'), staleScrub.report);
  fs.writeFileSync(
    path.join(newsroomDir, 'stale-claim-report.md'),
    buildStaleClaimReportMarkdown(staleScrub.report),
    'utf8'
  );
  qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
    threshold: qualityGatePolicy.threshold,
    shortlistReport,
    staleClaimReport: staleScrub.report,
    strictClaimValidation: true
  });
  generationRunState.qualityReport = qualityReport;

  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
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

  const newsletterMarkdown = buildMarkdown(editor);
  const newsletterHtmlContent = buildHtml(editor);
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

  const baseFiles = [
    generationRunState.candidateInput?.candidate_artifact || collectedCandidatesRelPath(date),
    generationRunState.candidateInput?.manifest || '',
    newsroomRelPath(date, 'shortlisted-candidates.json'),
    newsroomRelPath(date, 'article-capsules.json'),
    newsroomRelPath(date, 'background-context.json'),
    newsroomRelPath(date, 'reporter-candidates.json'),
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
    newsroomRelPath(date, 'editor-in-chief-brief.md'),
    newsroomRelPath(date, 'release-qa-report.md')
  ].filter(Boolean);

  fs.writeFileSync(
    path.join(newsroomDir, 'editor-in-chief-brief.md'),
    buildEditorChiefBrief(date, editor, factCheck, qualityReport, selectionStatusExtra(shortlistReport), staleScrub.report),
    'utf8'
  );

  const emptySourceSections = [];
  const todoFound = false;
  const mustFixCount = ensureArray(factCheck.must_fix).length;
  let generationStatus = 'PASS';
  if (shortlistReport.underfilled) {
    generationStatus = 'UNDERFILLED_NEEDS_FIX';
  } else if (factCheck.status === 'NEEDS_FIX' && mustFixCount > 0) {
    generationStatus = 'NEEDS_FIX';
  } else if (qualityReport.status !== 'PASS') {
    generationStatus = 'QUALITY_NEEDS_FIX';
  }
  const editorialReviewable = isEditorialReviewableStatus(generationStatus);
  const failureKind = editorialReviewable ? FAILURE_KIND_EDITORIAL_REVIEWABLE : '';
  const newsletterMd = path.join(newsletterDir, 'newsletter.md');
  const newsletterHtml = path.join(newsletterDir, 'index.html');
  const shouldWritePublicArtifacts = !editorialReviewable;
  if (shouldWritePublicArtifacts) {
    fs.writeFileSync(newsletterMd, newsletterMarkdown, 'utf8');
    fs.writeFileSync(newsletterHtml, newsletterHtmlContent, 'utf8');
    updateNewsletterData(date, editor);
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
    editorialReviewable ||
    shortlistReport.editor_review_required === true ||
    finalCompositionMode !== COMPOSITION_MODES.NORMAL ||
    finalPublishReady !== true;
  const files = shouldWritePublicArtifacts
    ? baseFiles.concat([
        `newsletters/${date}/newsletter.md`,
        `newsletters/${date}/index.html`,
        'data/newsletters.json'
      ])
    : baseFiles;
  fs.writeFileSync(
    path.join(newsroomDir, 'release-qa-report.md'),
    buildReleaseQaReport(date, files, validateResult.text, factCheck, todoFound, emptySourceSections, qualityReport),
    'utf8'
  );

  writeGenerationStatus(buildGenerationStatus({
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
      todo_found: todoFound,
      empty_source_sections: emptySourceSections,
      source_gap_count: factCheck.source_gap_count,
      stale_claim_status: staleScrub.report?.status || 'UNKNOWN',
      stale_claim_removed_count: ensureArray(staleScrub.report?.stale_claim_items_removed).length +
        ensureArray(staleScrub.report?.unsupported_release_claims_removed).length +
        ensureArray(staleScrub.report?.unused_references_removed).length,
      stale_claim_hard_failure_count: ensureArray(staleScrub.report?.hard_failures).length,
      ...editorSemanticStatusExtra(),
      ...selectionStatusExtra(shortlistReport, {
        renderedMainArticleCount: ensureArray(editor.sections).length,
        lockedArticleCount: retryHistory.at(-1)?.locked_article_headlines.length || 0,
        demotedArticleCount: retryHistory.at(-1)?.demoted_article_count ?? retryHistory.at(-1)?.demoted_sections?.length ?? 0,
        finalPublishReady,
        publishGatePassed: finalPublishReady,
        compositionMode: finalCompositionMode,
        editorReviewRequired: finalEditorReviewRequired
      })
    }
  }));
  assertJsonArtifactsReadable([
    path.join(newsroomDir, 'generation-status.json')
  ]);

  if (todoFound) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: 'Generated newsletter contains TODO.', shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    fail('Generated newsletter contains TODO.');
  }
  if (emptySourceSections.length > 0) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: `Generated sections without sources: ${emptySourceSections.join(', ')}`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    fail(`Generated sections without sources: ${emptySourceSections.join(', ')}`);
  }
  if (!validateResult.ok && !shortlistReport.underfilled) {
    if (editorialReviewable) {
      writeRecoveryPrompt(newsroomDir, { date, stage: failureKind, reason: 'Editorial reviewable failure is not publishable.', shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
      console.warn(`${failureKind}: review artifacts were written without public newsletter files or data/newsletters.json updates.`);
      return;
    }
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: `npm run validate failed:\n${validateResult.text}`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    fail(`npm run validate failed:\n${validateResult.text}`);
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
  writeGenerationStatus(buildGenerationStatus({
    date,
    status: failedRawArtifactValidation ? 'FAILED_RAW_ARTIFACT_VALIDATION' : 'FAILED',
    failureStage: failureStageFromError(error),
    failureReason: String(error?.message || error || 'Unknown generation failure.'),
    retryHistory: generationRunState.retryHistory,
    qualityReport: generationRunState.qualityReport,
    factCheck: generationRunState.factCheck,
    extra: {
      quality_attempt_count: Math.max(
        generationRunState.retryHistory.length,
        generationRunState.currentQualityAttempt
      ),
      raw_artifact_validation_error: failedRawArtifactValidation ? error.details : null,
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
  buildSectionRepairPlan,
  editorSemanticStatusExtra,
  failureStageFromError,
  hasTooFewMainArticlesDeduction,
  articleSectionContractPrompt,
  linkedEvidencePromptGuardrails,
  sourceExtractionPromptGuardrails,
  main,
  recordEditorSemanticStatus,
  availableCompletionCandidates,
  backgroundContextStageEnabled,
  mergeLockedSections,
  recordLastKnownValidEditor,
  sectionsMatchingRepairPlan,
  sectionsOutsideRepairPlan,
  validateCompletionSections,
  validateEditor,
  validateTargetedRepairResult,
  writeReviewableRepairFailureArtifacts,
  selectionStatusExtra,
  writeGenerationStatus,
  writeNewsletterDate,
  writeSelectionDiagnosticsArtifact,
  writeTerminalFailureStatus
};
