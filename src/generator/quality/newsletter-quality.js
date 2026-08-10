const { ensureArray } = require('../../shared/common/value-coercion');
const {
  isFinalSelected
} = require('../select/selection-diagnostics');
const {
  normalizedUrlHash
} = require('../../shared/common/selection-normalizers');
const {
  normalizeForMatch,
  urlKeys,
  normalizedUrlKey,
  candidateUrls,
  candidateCanonicalUrl,
  candidateHash,
  candidateIdentity,
  pushCandidateEntries,
  candidateBindingIndex,
  sourceEvidence
} = require('./candidate-claim-matching');
const {
  BUCKETS,
  BUCKET_PRIORITY,
  classifyAospCameraStackCandidate
} = require('../../shared/domain/aosp-camera-scope');
const {
  articlePolicy,
  publishReadyCompositionPolicy,
  qualityGatePolicy,
  articleCountRangeText,
  isForbiddenMainBucket,
  isPrimaryCameraStackBucket,
  isSupportingMainBucket,
  publishGateCriteriaText
} = require('../../shared/common/newsletter-policy');
const {
  IMPACT_TYPES,
  RECOMMENDED_ARTICLE_TYPES
} = require('../../shared/evidence/impact-classifier');
const {
  findFieldHygieneIssues,
  inferGuardrailImpactClass
} = require('../reporter/article-field-builder');
const {
  ARTICLE_SECTION_KEYS,
  LIMITATION_VISIBILITY,
  articleSectionSummary,
  normalizeArticleSections
} = require('../reporter/article-section-contract');
const {
  articleSectionContractRows,
  articleSectionContractRowValues
} = require('../reporter/article-structure-summary');
const {
  buildHalSignalQualitySummary,
  buildMainArticleSignalChecks,
  normalizeHalSignalCapsule,
  normalizeHalSignalFields
} = require('../reporter/hal-signal-quality');
const {
  dateQualityForCandidate,
  validateDateSource,
  validateEventType
} = require('../../shared/common/date-signals');
const {
  candidateGroupKey
} = require('../../shared/common/article-groups');
const {
  SOURCE_QUALITY_FIELD_DRIFT,
  normalizeSourceQuality,
  sourceQualityFieldDrift
} = require('../../shared/collect/source-quality-classifier');
const {
  summarizeClaimValidation,
  validateArticleClaims
} = require('./claim-source-binding');
const {
  bindMissingFactClaimEvidence
} = require('../editor/editor-output-contract');
const {
  toLegacyEditorIssue
} = require('../../shared/domain/newsletter-domain-normalize');
const {
  EDITORIAL_STORY_KEYS,
  STORY_CONTRACT_VERSION,
  STORY_PUBLIC_CONTRACT_VERSION,
  validatePublicArticle
} = require('../reporter/public-article-contract');
const { PUBLIC_CONTRACT_VERSIONS } = require('../../shared/common/story-contract-version');
const {
  PRODUCT_VERSION_TOKEN_PATTERN,
  RELEASE_BOILERPLATE_TOKEN_PATTERN,
  LINKED_EVIDENCE_UNRESOLVED_STATUSES,
  LINKED_EVIDENCE_RUNTIME_TERMS,
  LINKED_EVIDENCE_RUNTIME_CLAIM,
  LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM,
  LINKED_EVIDENCE_HIGH_IMPACT_CLAIM,
  LINKED_EVIDENCE_LIMITATION_NOTE,
  SCOPE_SCORE_FIELDS,
  TOPIC_TIER_BUCKETS,
  BRIEFING_WHAT_PATTERN,
  BRIEFING_READER_PATTERN,
  BRIEFING_ACTION_PATTERN
} = require('../../shared/common/quality-gate-policy');

// Legacy compatibility exports only. New quality code should prefer qualityGatePolicy and articlePolicy.
const QUALITY_THRESHOLD = qualityGatePolicy.threshold;
const MIN_MAIN_ARTICLES = articlePolicy.mainArticleCount.min;
const MAX_MAIN_ARTICLES = articlePolicy.mainArticleCount.max;

const {
  text,
  objectValue,
  sectionText
} = require('./quality-text');
const {
  sourceTitleHasRawCopySignal,
  bindCandidateForSection
} = require('./quality-section-binding');
const {
  boundedDeduct,
  addLinkedEvidenceQualityDeductions,
  addClaimValidationDeductions,
  blockingDeductions,
  softDeductions,
  requiredFieldDeductions,
  fieldHygieneDeductions,
  sourceBindingDeductions,
  cameraXDeductions,
  imageFallbackDeductions,
  applyDeductionDescriptors
} = require('./quality-deduction-rules');
const {
  buildQualityReportMarkdown
} = require('./quality-markdown');

function halSignalInput(section = {}, candidate = {}, scope = {}) {
  return {
    ...objectValue(candidate),
    ...section,
    relevance_bucket: text(section.relevance_bucket) || text(candidate?.relevance_bucket) || text(scope?.relevance_bucket),
    scope_count: scope
  };
}



function hasPattern(value, pattern) {
  return pattern.test(text(value));
}



// 섹션 scope fallback 규칙도 순서있는 테이블로 분리했다(OCP).
const SECTION_SCOPE_FALLBACK_RULES = require('./section-scope-fallback-rules');


function countSections(sections, pattern) {
  return sections.filter(section => hasPattern(sectionText(section), pattern)).length;
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function knownBucket(value) {
  const bucket = text(value);
  return Object.values(BUCKETS).includes(bucket) ? bucket : '';
}

function fallbackSectionScope(section) {
  const body = sectionText(section);
  // 우선순위 순서의 규칙 테이블에서 첫 매칭을 사용한다(규칙은 별도 모듈로 분리, OCP).
  for (const rule of SECTION_SCOPE_FALLBACK_RULES) {
    if (rule.pattern.test(body)) return { ...rule.scope };
  }
  return classifyAospCameraStackCandidate({
    title: section?.headline,
    summary: sectionText(section),
    api_or_component: section?.category,
    behavior_change: section?.what_changed
  });
}

function hasValidAiRelevance(section) {
  if (!section.is_ai_related && !/\b(?:AI|agent|LLM|NPU|GPU|on-device|inference|model)\b/i.test(sectionText(section))) {
    return false;
  }
  return /camera input|image|frame|stream|buffer|ImageAnalysis|NPU|GPU|ISP|privacy|HAL workflow|developer productivity|latency|thermal|power|agent|Camera HAL|Android Camera/i
    .test(sectionText(section));
}



function sourceGapCount(factCheck) {
  if (Number.isFinite(Number(factCheck?.source_gap_count))) return Number(factCheck.source_gap_count);
  return ensureArray(factCheck?.source_gaps).length;
}

function deductionMatchesSection(deduction, section) {
  const location = normalizeForMatch(deduction?.location);
  if (!location) return false;
  const labels = [
    section?.headline,
    section?.category,
    section?.location
  ].map(normalizeForMatch).filter(Boolean);
  return labels.some(label => location === label || location.includes(label) || label.includes(location));
}

function sectionHasQualityDeductions(section, deductions, categories = [
  'required-fields',
  'evidence-specificity',
  'hal-depth',
  'actionability'
]) {
  const categorySet = new Set(categories);
  return ensureArray(deductions).some(deduction =>
    categorySet.has(deduction?.category) && deductionMatchesSection(deduction, section)
  );
}

function factCheckItemMentionsSection(item, section) {
  const haystack = normalizeForMatch(item);
  if (!haystack) return false;
  const labels = [
    section?.headline,
    section?.category,
    ...ensureArray(section?.sources).flatMap(source => [source?.title, source?.url])
  ].map(normalizeForMatch).filter(Boolean);
  return labels.some(label => haystack.includes(label) || label.includes(haystack));
}

function sectionHasFactCheckMustFix(section, factCheck) {
  return ensureArray(factCheck?.must_fix).some(item => factCheckItemMentionsSection(item, section));
}

function sectionHasSourceGap(section, factCheck) {
  const localGap = /source gap|rolling page|no dated release|missing source|needs cross-check|needs-cross-check|출처\s*공백|소스\s*갭/i
    .test(sectionText(section));
  if (localGap) return true;
  return ensureArray(factCheck?.source_gaps).some(item => factCheckItemMentionsSection(item, section));
}

function articleResultMatchesSection(result, section) {
  const resultUrls = new Set(ensureArray(result?.sources).map(source => text(source?.url)).filter(Boolean));
  if (ensureArray(section?.sources).some(source => resultUrls.has(text(source?.url)))) return true;
  const resultLabels = [
    result?.headline,
    result?.category
  ].map(normalizeForMatch).filter(Boolean);
  if (resultLabels.length === 0) return false;
  const sectionLabels = [
    section?.headline,
    section?.category,
    ...ensureArray(section?.sources).flatMap(source => [source?.title, source?.url])
  ].map(normalizeForMatch).filter(Boolean);
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

function sectionPassesArticleGate(section, qualityReport, factCheck) {
  const articleResult = articleResultForSection(section, qualityReport);
  if (articleResult && articleResult.status !== 'PASS') return false;
  return !sectionHasQualityDeductions(section, qualityReport?.deductions) &&
    !sectionHasFactCheckMustFix(section, factCheck) &&
    !sectionHasSourceGap(section, factCheck);
}


function sectionDeductions(section, deductions) {
  return ensureArray(deductions).filter(deduction => deductionMatchesSection(deduction, section));
}

function sectionSourceSummary(section) {
  return ensureArray(section?.sources).map(source => ({
    title: text(source?.title),
    url: text(source?.url)
  }));
}

function topicTierDistribution(scopeBucketCounts = {}) {
  return Object.fromEntries(
    Object.entries(TOPIC_TIER_BUCKETS).map(([tier, buckets]) => [
      tier,
      buckets.reduce((sum, bucket) => sum + number(scopeBucketCounts[bucket]), 0)
    ])
  );
}

function optionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scopeFromStructuredFields(value, origin) {
  const bucket = knownBucket(value?.relevance_bucket);
  if (!bucket) return null;
  const candidateUrl = candidateCanonicalUrl(value);
  const scores = {};
  const missingScoreFields = [];
  for (const field of SCOPE_SCORE_FIELDS) {
    const parsed = optionalNumber(value?.[field]);
    if (parsed === null) missingScoreFields.push(field);
    scores[field] = parsed ?? 0;
  }
  return {
    source_candidate_url: text(value.source_candidate_url) || candidateUrl,
    source_candidate_hash: text(value.source_candidate_hash || value.url_hash || value.normalized_url_hash) ||
      (candidateUrl ? normalizedUrlHash(candidateUrl) : ''),
    editorial_priority: number(value.editorial_priority, BUCKET_PRIORITY[bucket] || 6),
    relevance_bucket: bucket,
    ...scores,
    counts_as_primary_camera_topic: bool(
      value.counts_as_primary_camera_topic,
      bucket === BUCKETS.DIRECT_AOSP_CAMERA || bucket === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT
    ),
    counts_as_driver_topic: bool(value.counts_as_driver_topic, bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE),
    counts_as_soc_topic: bool(value.counts_as_soc_topic, bucket === BUCKETS.SOC_PLATFORM_SIGNAL),
    counts_as_fallback_topic: bool(value.counts_as_fallback_topic, bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK),
    guardrail_impact_class: inferGuardrailImpactClass(value),
    evidence_origin: text(value.evidence_origin) || origin,
    missing_score_fields: missingScoreFields,
    metadata_source: origin,
    count_source: origin
  };
}

function metadataHasScore(metadata, field) {
  return Boolean(metadata) && !ensureArray(metadata.missing_score_fields).includes(field);
}

function scoreFromMetadata(metadata, field) {
  return metadataHasScore(metadata, field) ? number(metadata[field]) : null;
}

function candidateMetadataForBinding(binding) {
  if (binding?.status !== 'bound' || !binding.candidate) return null;
  const metadata = scopeFromStructuredFields(binding.candidate, binding.binding_source || 'bound_candidate');
  if (!metadata) return null;
  return {
    ...metadata,
    source_candidate_url: candidateCanonicalUrl(binding.candidate),
    source_candidate_hash: candidateHash(binding.candidate),
    binding_status: 'bound',
    binding_source: binding.binding_source || 'bound_candidate',
    binding_tie_score: binding.tie_score ?? null,
    publishable_scope: true
  };
}

function mergeScopeMetadata(sectionMetadata, candidateMetadata) {
  if (!candidateMetadata) return null;
  const candidateBucket = candidateMetadata.relevance_bucket || BUCKETS.GENERIC_TECH_WATCHLIST;
  const sectionBucket = sectionMetadata?.relevance_bucket;
  const sectionCanFill = sectionMetadata &&
    (!sectionBucket || (BUCKET_PRIORITY[sectionBucket] || 99) >= (BUCKET_PRIORITY[candidateBucket] || 99));
  const bucket = candidateBucket;
  const merged = {
    ...candidateMetadata,
    ...(sectionCanFill ? sectionMetadata : {}),
    relevance_bucket: bucket,
    editorial_priority: (sectionCanFill ? optionalNumber(sectionMetadata?.editorial_priority) : null) ??
      optionalNumber(candidateMetadata?.editorial_priority) ??
      BUCKET_PRIORITY[bucket] ??
      6,
    source_candidate_url: text(candidateMetadata?.source_candidate_url),
    source_candidate_hash: text(candidateMetadata?.source_candidate_hash),
    evidence_origin: text(candidateMetadata?.evidence_origin) || 'bound_candidate_metadata',
    metadata_source: sectionCanFill && candidateMetadata
      ? 'merged'
      : candidateMetadata.metadata_source || candidateMetadata.binding_source || 'bound_candidate',
    count_source: sectionCanFill && candidateMetadata
      ? 'merged'
      : candidateMetadata.count_source || candidateMetadata.binding_source || 'bound_candidate',
    binding_status: candidateMetadata.binding_status || 'bound',
    binding_source: candidateMetadata.binding_source || '',
    binding_tie_score: candidateMetadata.binding_tie_score ?? null,
    publishable_scope: true
  };
  const missingScoreFields = [];
  for (const field of SCOPE_SCORE_FIELDS) {
    const value = (sectionCanFill ? scoreFromMetadata(sectionMetadata, field) : null) ?? scoreFromMetadata(candidateMetadata, field);
    if (value === null) missingScoreFields.push(field);
    merged[field] = value ?? 0;
  }
  merged.missing_score_fields = missingScoreFields;
  return merged;
}

function diagnosticFallbackScope(section, binding = null) {
  return {
    ...fallbackSectionScope(section),
    source_candidate_url: binding?.status === 'bound' ? candidateCanonicalUrl(binding.candidate) : '',
    source_candidate_hash: binding?.status === 'bound' ? candidateHash(binding.candidate) : '',
    count_source: 'section_text_fallback',
    metadata_source: 'section_text_fallback',
    binding_status: binding?.status || 'missing',
    binding_source: binding?.binding_source || '',
    binding_reason: binding?.reason || '',
    publishable_scope: false,
    counts_as_primary_camera_topic: false,
    counts_as_driver_topic: false,
    counts_as_soc_topic: false,
    counts_as_fallback_topic: false
  };
}

function sectionScope(section, binding) {
  const sectionMetadata = scopeFromStructuredFields(section, 'section_metadata');
  const candidateMetadata = candidateMetadataForBinding(binding);
  const mergedMetadata = mergeScopeMetadata(sectionMetadata, candidateMetadata);
  if (mergedMetadata) return mergedMetadata;
  return diagnosticFallbackScope(section, binding);
}

function sectionCountDetail(section, scope, index) {
  const bucket = knownBucket(scope?.relevance_bucket) || BUCKETS.GENERIC_TECH_WATCHLIST;
  const publishableScope = scope?.publishable_scope === true;
  const countsAsPrimaryStack = isPrimaryCameraStackBucket(bucket);
  const countsAsSupportingMain = isSupportingMainBucket(bucket);
  const countsAsForbiddenMain = isForbiddenMainBucket(bucket);
  let countReason = `${scope?.count_source || scope?.evidence_origin || 'unknown'} classified this section as ${bucket}.`;
  let exclusionReason = '';
  if (!publishableScope) {
    countReason = `${scope?.count_source || scope?.evidence_origin || 'unknown'} classified this section as ${bucket} for diagnostics only.`;
    exclusionReason = 'Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available.';
  } else if (countsAsPrimaryStack) {
    countReason = `${bucket} counts toward primary_camera_stack_count.`;
  } else if (countsAsSupportingMain) {
    countReason = `${bucket} counts toward supporting_main_article_count, not primary_camera_stack_count.`;
    exclusionReason = 'Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic.';
  } else {
    exclusionReason = countsAsForbiddenMain
      ? `${bucket} is forbidden by Newsletter Policy and cannot remain as a main article.`
      : `${bucket} is not allowed by Newsletter Policy for main article composition.`;
  }
  return {
    index: index + 1,
    headline: section.headline || section.category || `article ${index + 1}`,
    source_candidate_url: scope?.source_candidate_url || text(section.source_candidate_url),
    source_candidate_hash: scope?.source_candidate_hash || text(section.source_candidate_hash),
    relevance_bucket: bucket,
    editorial_priority: number(scope?.editorial_priority, BUCKET_PRIORITY[bucket] || 6),
    counts_as_primary_camera_topic: countsAsPrimaryStack,
    counts_as_driver_topic: bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
    counts_as_soc_topic: bucket === BUCKETS.SOC_PLATFORM_SIGNAL,
    counts_as_fallback_topic: bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK,
    counts_as_supporting_main_article: countsAsSupportingMain,
    counts_as_forbidden_main_article: countsAsForbiddenMain,
    guardrail_impact_class: text(scope?.guardrail_impact_class) ||
      inferGuardrailImpactClass({ ...section, relevance_bucket: bucket }),
    evidence_origin: scope?.evidence_origin || 'unknown',
    metadata_source: scope?.metadata_source || scope?.count_source || 'unknown',
    binding_status: scope?.binding_status || 'unknown',
    binding_source: scope?.binding_source || '',
    binding_reason: scope?.binding_reason || '',
    publishable_scope: publishableScope,
    missing_score_fields: ensureArray(scope?.missing_score_fields),
    count_reason: countReason,
    exclusion_reason_if_not_counted: exclusionReason
  };
}

function articleStatusFor(section, hardItems, factCheck) {
  if (sectionHasSourceGap(section, factCheck)) return 'FAIL';
  if (hardItems.some(item => item.category === 'source-integrity')) return 'FAIL';
  if (hardItems.some(item => item.category === 'field-hygiene')) return 'FAIL';
  if (hardItems.some(item => item.category === 'required-fields' && /sources|source/i.test(item.reason))) return 'FAIL';
  if (hardItems.some(item => item.category === 'evidence-specificity' && /release date|dated|source gap|rolling page|evidence/i.test(item.reason))) return 'FAIL';
  if (hardItems.some(item => item.category === 'hal-relevance' || item.category === 'hal-depth' || item.category === 'scope-relevance')) return 'DEMOTE';
  return hardItems.length > 0 || sectionHasFactCheckMustFix(section, factCheck) ? 'FAIL' : 'PASS';
}

function repairActionForArticleStatus(status, hardItems, factCheck, section) {
  if (status === 'PASS') return 'preserve';
  if (sectionHasSourceGap(section, factCheck) || hardItems.some(item => item.category === 'source-integrity')) {
    return 'replace-or-demote';
  }
  if (status === 'DEMOTE') return 'demote-or-replace';
  return 'repair-section';
}

function buildArticleResults(sections, deductions, factCheck, sectionCountDetails = []) {
  return ensureArray(sections).map((section, index) => {
    const items = sectionDeductions(section, deductions);
    const hardItems = blockingDeductions(items);
    const softItems = softDeductions(items);
    const factCheckMustFix = sectionHasFactCheckMustFix(section, factCheck);
    const sourceGap = sectionHasSourceGap(section, factCheck);
    const status = articleStatusFor(section, hardItems, factCheck);
    const halSignal = normalizeHalSignalCapsule(section);
    const hardReasons = [
      ...hardItems.map(item => item.reason),
      factCheckMustFix ? 'Fact-check must_fix item mentions this section.' : '',
      sourceGap ? 'Source gap or ineligible source evidence mentions this section.' : ''
    ].filter(Boolean);
    return {
      index: index + 1,
      headline: section.headline || section.category || `article ${index + 1}`,
      category: section.category || '',
      status,
      repair_action: repairActionForArticleStatus(status, hardItems, factCheck, section),
      sources: sectionSourceSummary(section),
      section_contract: articleSectionSummary(section),
      scope_count: sectionCountDetails[index] || null,
      guardrail_impact_class: text(sectionCountDetails[index]?.guardrail_impact_class) ||
        inferGuardrailImpactClass(section),
      hal_impact_axes: ensureArray(section.hal_impact_axes).length > 0
        ? ensureArray(section.hal_impact_axes)
        : ensureArray(halSignal.capsule?.impact_axes),
      actionability_level: text(section.actionability_level),
      effective_actionability_level: text(section.effective_actionability_level || section.actionability_level),
      hard_fail_reasons: [...new Set(hardReasons)],
      soft_deductions: softItems.map(item => ({
        category: item.category,
        points: item.points,
        reason: item.reason
      }))
    };
  });
}

function summarizeArticleSectionContracts(sections) {
  const summaries = ensureArray(sections).map(articleSectionSummary);
  const missingKeyCounts = ARTICLE_SECTION_KEYS.reduce((counts, key) => {
    counts[key] = summaries.filter(summary => ensureArray(summary.missing_keys).includes(key)).length;
    return counts;
  }, {});
  const optionalKeyCounts = summaries.reduce((counts, summary) => {
    for (const key of ensureArray(summary.present_optional_keys)) {
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, {});
  const limitationVisibilityCounts = summaries.reduce((counts, summary) => {
    const key = summary.limitation_visibility || LIMITATION_VISIBILITY.NONE;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  return {
    complete_count: summaries.filter(summary => summary.complete === true).length,
    incomplete_count: summaries.filter(summary => summary.complete !== true).length,
    missing_key_counts: missingKeyCounts,
    optional_key_counts: optionalKeyCounts,
    limitation_visibility_counts: limitationVisibilityCounts,
    summaries
  };
}

// #654: the fact-checker's per-article confidence is its own high/medium/low self-assessment.
// We only accept those three values and otherwise report 'unspecified' rather than inventing a
// level — the field is advisory (surfaced for the human reviewer), never a deterministic gate.
const VERDICT_CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);
function normalizeVerdictConfidence(value) {
  const level = text(value).toLowerCase();
  return VERDICT_CONFIDENCE_LEVELS.has(level) ? level : 'unspecified';
}

// Publish gate: a simple boolean AND of objective safety checks plus the fact-checker's
// per-article usefulness verdict. There is no numeric quality threshold — editorial quality
// is the fact-checker's call (factCheck.article_quality), not a deterministic score.
function determineQualityStatus(checks = {}) {
  const sourceGapCountValue = Number(checks.sourceGapCount || 0);
  const blockers = ensureArray(checks.blockingDeductions);
  const unpublishable = ensureArray(checks.unpublishableArticles);
  return sourceGapCountValue === 0 &&
    checks.hasFactCheckMustFix !== true &&
    blockers.length === 0 &&
    unpublishable.length === 0
    ? 'PASS'
    : 'NEEDS_FIX';
}

function summarizeDeductionCategories(deductions) {
  const counts = new Map();
  for (const deduction of ensureArray(deductions)) {
    const category = text(deduction?.category) || 'unknown';
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

function summarizeCandidateExclusions(reporter) {
  const counts = new Map();
  for (const candidate of ensureArray(reporter?.candidates)) {
    if (isFinalSelected(candidate)) continue;
    const reasons = ensureArray(candidate.final_exclusion_reasons).length > 0
      ? candidate.final_exclusion_reasons
      : ensureArray(candidate.exclusion_reasons);
    for (const reason of reasons) {
      const key = text(reason) || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}


function briefingRawCopyFindings(briefing = [], reporter = {}) {
  const findings = [];
  const candidateTitles = ensureArray(reporter.candidates)
    .map(candidate => text(candidate.title))
    .filter(title => title.length >= 12 && sourceTitleHasRawCopySignal(title));
  ensureArray(briefing).forEach((item, index) => {
    const bullet = text(item);
    const normalizedBullet = normalizeForMatch(bullet);
    for (const title of candidateTitles) {
      const normalizedTitleValue = normalizeForMatch(title);
      if (normalizedTitleValue && normalizedBullet.includes(normalizedTitleValue)) {
        findings.push({
          index: index + 1,
          severity: 'fail',
          reason: 'Briefing bullet includes a raw source title phrase.',
          title
        });
      }
    }
    if (/\b(?:has been released|announced|released|adds support|is now available)\b/i.test(bullet) && /[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(bullet)) {
      findings.push({
        index: index + 1,
        severity: 'warning',
        reason: 'Briefing bullet uses raw English release prose instead of Korean editorial framing.'
      });
    }
  });
  return findings;
}

function briefingStoryStructureFindings(briefing = [], editor = {}) {
  // 지원 버전 하나와 등가비교하면 v2 이슈에서 이 검사가 조용히 꺼지고,
  // findings 0이 "문제 없음"과 구분되지 않는다.
  if (!PUBLIC_CONTRACT_VERSIONS.includes(editor.public_contract_version)) return [];
  const findings = [];
  ensureArray(briefing).forEach((item, index) => {
    const bullet = text(item);
    if (!bullet) return;
    const missing = [];
    if (!BRIEFING_WHAT_PATTERN.test(bullet)) missing.push('what_happened');
    if (!BRIEFING_READER_PATTERN.test(bullet)) missing.push('reader_perspective');
    if (!BRIEFING_ACTION_PATTERN.test(bullet)) missing.push('action_hint');
    if (missing.length > 0) {
      findings.push({
        index: index + 1,
        missing,
        severity: 'warning',
        reason: `Briefing bullet misses story structure elements: ${missing.join(', ')}.`
      });
    }
  });
  return findings;
}

// ---------------------------------------------------------------------------
// Per-section quality checks.
//
// Each checker is a pure function returning an array of deduction descriptors
// { category, points, reason, location, options? }. The orchestrator applies them
// in order via boundedDeduct, so behaviour is identical to the previous inline loop
// while each quality domain now has a single, named responsibility (SRP).
// ---------------------------------------------------------------------------


function buildNewsletterQualityReport(date, editor, reporter = {}, factCheck = {}, options = {}) {
  editor = toLegacyEditorIssue(editor, { date });
  // Deterministically complete item-level evidence_ids the editor omitted, but only where the
  // strict claim oracle confirms the candidate evidence genuinely supports the claim. Unsupported
  // claims stay unbound and keep failing closed; this scores true source-backed quality instead of
  // penalizing a missing provenance pointer.
  editor = bindMissingFactClaimEvidence(editor, {
    reporter,
    seedEvidencePack: options.seedEvidencePack || null
  });
  const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : qualityGatePolicy.threshold;
  const sections = ensureArray(editor.sections);
  const state = { deductions: [] };
  const bindingIndex = candidateBindingIndex(reporter, options.shortlistReport || null);
  const staleClaimReport = options.staleClaimReport || null;
  const strictClaimValidation = options.strictClaimValidation === true;
  const seedEvidencePack = options.seedEvidencePack || null;
  const claimValidations = [];
  const claimDeductionKeys = new Set();
  let sourceIntegrityViolationCount = 0;

  if (sections.length < articlePolicy.mainArticleCount.min || sections.length > articlePolicy.mainArticleCount.max) {
    boundedDeduct(state, 'composition', 8, `Main article count ${sections.length} is outside Newsletter Policy range (${articleCountRangeText()}).`);
  }
  if (ensureArray(editor.briefing).length !== 3) {
    boundedDeduct(state, 'composition', 3, `Expected exactly 3 briefing bullets, found ${ensureArray(editor.briefing).length}.`);
  }
  for (const finding of briefingRawCopyFindings(editor.briefing, reporter)) {
    boundedDeduct(
      state,
      'editorial-story',
      finding.severity === 'fail' ? 6 : 2,
      finding.reason,
      `briefing ${finding.index}`,
      finding.severity === 'fail' ? {} : { blocking: false, severity: 'soft' }
    );
  }
  for (const finding of briefingStoryStructureFindings(editor.briefing, editor)) {
    boundedDeduct(
      state,
      'editorial-story',
      1,
      finding.reason,
      `briefing ${finding.index}`,
      { blocking: false, severity: 'soft' }
    );
  }
  const sectionBindings = sections.map(section => bindCandidateForSection(section, bindingIndex));
  const sectionScopes = sections.map((section, index) => sectionScope(section, sectionBindings[index]));
  const sectionCountDetails = sections.map((section, index) => sectionCountDetail(section, sectionScopes[index], index));
  const scopeBucketCounts = sectionScopes.reduce((counts, scope) => {
    if (scope?.publishable_scope !== true) return counts;
    const bucket = text(scope?.relevance_bucket) || 'unknown';
    counts[bucket] = (counts[bucket] || 0) + 1;
    return counts;
  }, {
    [BUCKETS.DIRECT_AOSP_CAMERA]: 0,
    [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 0,
    [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 0,
    [BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT]: 0,
    [BUCKETS.SOC_PLATFORM_SIGNAL]: 0,
    [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 0,
    [BUCKETS.GENERIC_TECH_WATCHLIST]: 0
  });
  const directAospCameraCount = scopeBucketCounts[BUCKETS.DIRECT_AOSP_CAMERA] || 0;
  const cameraDriverImagePipelineCount = scopeBucketCounts[BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE] || 0;
  const androidPlatformCameraAdjacentCount = scopeBucketCounts[BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT] || 0;
  const androidMultimediaCameraOutputCount = scopeBucketCounts[BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT] || 0;
  const socPlatformSignalCount = scopeBucketCounts[BUCKETS.SOC_PLATFORM_SIGNAL] || 0;
  const cppAiToolingFallbackCount = scopeBucketCounts[BUCKETS.CPP_AI_TOOLING_FALLBACK] || 0;
  const genericTechWatchlistCount = scopeBucketCounts[BUCKETS.GENERIC_TECH_WATCHLIST] || 0;
  const topicTierCounts = topicTierDistribution(scopeBucketCounts);
  const primaryCameraStackCount = articlePolicy.primaryCameraStack.buckets
    .reduce((sum, bucket) => sum + number(scopeBucketCounts[bucket]), 0);
  const supportingMainArticleCount = articlePolicy.supportingMainBuckets
    .reduce((sum, bucket) => sum + number(scopeBucketCounts[bucket]), 0);
  const forbiddenMainArticleCount = articlePolicy.forbiddenMainBuckets
    .reduce((sum, bucket) => sum + number(scopeBucketCounts[bucket]), 0);
  const fallbackRelevanceCount = socPlatformSignalCount + cppAiToolingFallbackCount;
  const expandedScopeCoverage = primaryCameraStackCount + supportingMainArticleCount;
  const publishableScopeCount = sectionScopes.filter(scope => scope?.publishable_scope === true).length;
  const compositionMode = publishableScopeCount === 0 && sections.length > 0
    ? 'NEEDS_FIX'
    : forbiddenMainArticleCount > 0
      ? 'NEEDS_FIX'
      : primaryCameraStackCount < articlePolicy.primaryCameraStack.minRequired
        ? 'NEEDS_FIX'
        : supportingMainArticleCount > publishReadyCompositionPolicy.supportingMainMaxAllowed
          ? 'NEEDS_FIX'
        : supportingMainArticleCount > 0
        ? 'FALLBACK_COMPOSITION'
        : 'NORMAL';
  if (primaryCameraStackCount < articlePolicy.primaryCameraStack.minRequired) {
    boundedDeduct(state, 'composition', 8, `Primary Camera Stack article count ${primaryCameraStackCount} is below Newsletter Policy requirement (${articlePolicy.primaryCameraStack.minRequired}).`);
  }
  if (forbiddenMainArticleCount > 0) {
    boundedDeduct(state, 'composition', 8, `Forbidden main bucket count ${forbiddenMainArticleCount} violates Newsletter Policy: ${articlePolicy.forbiddenMainBuckets.join(', ')}.`);
  }
  if (supportingMainArticleCount > publishReadyCompositionPolicy.supportingMainMaxAllowed) {
    boundedDeduct(state, 'composition', 8, `Supporting main article count ${supportingMainArticleCount} exceeds publish-ready policy maximum (${publishReadyCompositionPolicy.supportingMainMaxAllowed}).`);
  }

  const sourceUrlOwners = new Map();
  sections.forEach((section, index) => {
    const location = section.headline || section.category || `article ${index + 1}`;
    const binding = sectionBindings[index];
    const scope = sectionScopes[index];
    const articleSections = normalizeArticleSections(section);
    const sectionContract = articleSectionSummary(section);
    const guardrailImpactClass = text(sectionCountDetails[index]?.guardrail_impact_class) ||
      inferGuardrailImpactClass(section);

    applyDeductionDescriptors(state, requiredFieldDeductions(section, sectionContract, location));
    applyDeductionDescriptors(state, fieldHygieneDeductions(section, articleSections, guardrailImpactClass, location));
    sourceIntegrityViolationCount += applyDeductionDescriptors(state, sourceBindingDeductions(section, binding, scope, location));
    if (binding.status === 'bound') {
      addLinkedEvidenceQualityDeductions(state, section, binding.candidate, location);
    }
    const claimValidation = validateArticleClaims({
      section,
      candidate: binding.status === 'bound' ? binding.candidate : {},
      articleIndex: index,
      strict: strictClaimValidation,
      seedEvidencePack
    });
    claimValidations.push(claimValidation);
    addClaimValidationDeductions(state, claimValidation, location, claimDeductionKeys);
    sourceIntegrityViolationCount += applyDeductionDescriptors(state, cameraXDeductions(section, binding, location));
    // Editorial quality/depth (is this useful to a Camera HAL SW engineer?) is judged by the
    // fact-checker LLM via factCheck.article_quality, not by deterministic topic heuristics.
    applyDeductionDescriptors(state, imageFallbackDeductions(section, location));
    for (const source of ensureArray(section.sources)) {
      const sourceUrl = source?.url || '';
      for (const key of urlKeys(sourceUrl)) {
        if (!sourceUrlOwners.has(key)) {
          sourceUrlOwners.set(key, location);
        } else if (sourceUrlOwners.get(key) !== location) {
          sourceIntegrityViolationCount += 1;
          boundedDeduct(
            state,
            'source-integrity',
            8,
            `Duplicate source URL is used across main sections: ${sourceUrl}.`,
            location
          );
          break;
        }
      }
    }
  });

  const mustFixCount = ensureArray(factCheck.must_fix).length;
  if (factCheck.status === 'NEEDS_FIX' && mustFixCount > 0) {
    boundedDeduct(state, 'source-integrity', Math.min(15, mustFixCount * 5), `Fact checker returned ${mustFixCount} must_fix item(s).`);
  }
  const gaps = sourceGapCount(factCheck);
  if (gaps > 0) {
    boundedDeduct(state, 'source-integrity', Math.min(10, gaps * 3), `Fact checker reported ${gaps} source gap(s).`);
  }
  const staleHardFailures = ensureArray(staleClaimReport?.hard_failures);
  if (staleClaimReport?.status === 'NEEDS_FIX' || staleHardFailures.length > 0) {
    boundedDeduct(
      state,
      'source-integrity',
      Math.min(12, Math.max(6, staleHardFailures.length * 6)),
      `Stale claim report has ${staleHardFailures.length} hard failure(s).`
    );
  }

  // Editorial-quality verdict: the fact-checker LLM judges each article on usefulness to a
  // Camera HAL SW engineer (topic-agnostic). An explicit publishable=false blocks the gate;
  // deterministic code only reads the boolean and surfaces the reason for review.
  // #654: carry the fact-checker's `confidence` self-assessment onto each blocked article so
  // a low-confidence (borderline, run-to-run flip-prone) block is visible to the human
  // reviewer. confidence stays advisory — it never changes whether the article blocks.
  const unpublishableArticles = ensureArray(factCheck.article_quality)
    .filter(item => item && item.publishable === false)
    .map(item => ({
      section_index: Number(item.section_index),
      headline: text(item.headline) || text(sections[Number(item.section_index)]?.headline),
      confidence: normalizeVerdictConfidence(item.confidence),
      reason: text(item.reason)
    }));

  const totalDeductions = state.deductions.reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, 100 - totalDeductions);
  const hasFactCheckMustFix = factCheck.status === 'NEEDS_FIX' || mustFixCount > 0;
  const blockers = blockingDeductions(state.deductions);
  const softItems = softDeductions(state.deductions);
  const articleResults = buildArticleResults(sections, state.deductions, factCheck, sectionCountDetails);
  const articleSectionContract = summarizeArticleSectionContracts(sections);
  const claimValidationSummary = summarizeClaimValidation(claimValidations);
  const claimResults = claimValidations.flatMap(item => ensureArray(item.claim_results));
  const uncoveredFacts = claimValidations.flatMap(item => ensureArray(item.uncovered_facts));
  const halSignalArticles = sections.map((section, index) => halSignalInput(
    section,
    sectionBindings[index]?.status === 'bound' ? sectionBindings[index].candidate : {},
    sectionScopes[index]
  ));
  const halSignalQualitySummary = buildHalSignalQualitySummary(halSignalArticles);
  const mainArticleSignalChecks = buildMainArticleSignalChecks(halSignalArticles);
  const status = determineQualityStatus({
    sourceGapCount: gaps,
    hasFactCheckMustFix,
    blockingDeductions: blockers,
    unpublishableArticles
  });
  return {
    schema_version: 1,
    date,
    score,
    max_score: 100,
    threshold,
    status,
    summary: status === 'PASS'
      ? 'Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.'
      : 'Resolve source gaps, fact-check must-fix items, composition blockers, and any article the fact-checker marked not useful to a Camera HAL SW engineer before publishing.',
    deductions: state.deductions,
    unpublishable_articles: unpublishableArticles,
    article_results: articleResults,
    claim_validation_summary: claimValidationSummary,
    claim_results: claimResults,
    uncovered_facts: uncoveredFacts,
    hal_signal_quality_summary: halSignalQualitySummary,
    main_article_signal_checks: mainArticleSignalChecks,
    metrics: {
      article_count: sections.length,
      briefing_count: ensureArray(editor.briefing).length,
      camera_article_count: primaryCameraStackCount,
      legacy_regex_camera_article_count: countSections(sections, /카메라\s*HAL|안드로이드\s*카메라|카메라2|Camera HAL|Android Camera|CameraX|AOSP Camera|Camera2|CTS|VTS|Camera ITS/i),
      expanded_scope_article_count: expandedScopeCoverage,
      direct_aosp_camera_count: directAospCameraCount,
      camera_driver_image_pipeline_count: cameraDriverImagePipelineCount,
      android_platform_camera_adjacent_count: androidPlatformCameraAdjacentCount,
      android_multimedia_camera_output_count: androidMultimediaCameraOutputCount,
      soc_platform_signal_count: socPlatformSignalCount,
      cpp_ai_tooling_fallback_count: cppAiToolingFallbackCount,
      generic_tech_watchlist_count: genericTechWatchlistCount,
      primary_camera_stack_count: primaryCameraStackCount,
      supporting_main_article_count: supportingMainArticleCount,
      forbidden_main_article_count: forbiddenMainArticleCount,
      fallback_relevance_count: fallbackRelevanceCount,
      publishable_scope_count: publishableScopeCount,
      composition_mode: compositionMode,
      section_count_details: sectionCountDetails,
      relevance_bucket_counts: scopeBucketCounts,
      topic_tier_distribution: topicTierCounts,
      topic_tier_distribution_source: 'relevance_bucket',
      topic_tier_bucket_map: TOPIC_TIER_BUCKETS,
      ai_article_count: sections.filter(hasValidAiRelevance).length,
      fact_check_status: factCheck.status || 'UNKNOWN',
      must_fix_count: mustFixCount,
      source_gap_count: gaps,
      stale_claim_status: staleClaimReport?.status || 'UNKNOWN',
      stale_claim_removed_count: ensureArray(staleClaimReport?.stale_claim_items_removed).length +
        ensureArray(staleClaimReport?.unsupported_release_claims_removed).length,
      stale_claim_hard_failure_count: staleHardFailures.length,
      source_integrity_violation_count: sourceIntegrityViolationCount,
      blocking_deduction_count: blockers.length,
      blocking_deduction_categories: [...new Set(blockers.map(deduction => deduction.category))],
      hard_fail_count: blockers.length,
      soft_deduction_count: softItems.length,
      article_gate_counts: articleResults.reduce((counts, item) => {
        counts[item.status] = (counts[item.status] || 0) + 1;
        return counts;
      }, { PASS: 0, DEMOTE: 0, FAIL: 0 }),
      article_section_contract: articleSectionContract,
      claim_validation_summary: claimValidationSummary,
      derived_evidence_mapping_count: claimValidationSummary.derived_evidence_mapping_count || 0,
      uncovered_fact_count: uncoveredFacts.length,
      hal_signal_quality_summary: halSignalQualitySummary,
      main_article_signal_checks: mainArticleSignalChecks,
      top_deduction_categories: summarizeDeductionCategories(state.deductions).slice(0, 5),
      candidate_exclusion_summary: summarizeCandidateExclusions(reporter).slice(0, 5)
    }
  };
}

// Dropped/demoted sections must be recorded as hard-blocked groups so the editor "selected group
// coverage" contract still holds (every selected group is rendered, demoted, or hard-blocked).
// Shared by thin-week salvage and the #632 deterministic structural demote.
function hardBlockedGroupsForDroppedSections(sections, reason = 'deterministic demote dropped an unpublishable article') {
  return ensureArray(sections)
    .map(section => {
      const key = text(section?.article_group_key || section?.articleGroupKey) ||
        candidateGroupKey({ url: ensureArray(section?.sources)[0]?.url, title: section?.headline });
      return key
        ? { article_group_key: key, hard_block_reason: reason, reason_code: 'quality_hard_blocker' }
        : null;
    })
    .filter(Boolean);
}

// Thin-week salvage: when the full lineup is NEEDS_FIX but a clean subset of articles passes,
// drop the failed/unpublishable articles and publish the clean subset (if it still meets the
// minimum article count). "Clean" = article gate PASS, fact-checker publishable, and no must_fix
// or source_gap referencing the section. Conservative: only salvages when the kept subset has a
// genuinely empty fact-check footprint, so it never lowers the safety bar.
function salvagePublishableSubset(date, editor, reporter, factCheck, qualityReport, options = {}) {
  const sections = ensureArray(editor?.sections);
  const minArticles = Number.isFinite(Number(options.minArticles))
    ? Number(options.minArticles)
    : articlePolicy.mainArticleCount.min;
  if (sections.length <= minArticles) return null;

  const results = ensureArray(qualityReport?.article_results);
  const unpublishable = new Set(ensureArray(qualityReport?.unpublishable_articles).map(item => Number(item.section_index)));

  const referencesSection = (probe, index, section) => {
    const blob = String(probe || '');
    const indexMatch = blob.match(/sections\[(\d+)\]/);
    if (indexMatch) return Number(indexMatch[1]) === index;
    const headline = text(section?.headline);
    const url = text(ensureArray(section?.sources)[0]?.url);
    return Boolean((headline && blob.includes(headline)) || (url && blob.includes(url)));
  };
  const factCheckProbe = item => typeof item === 'string'
    ? item
    : `${text(item?.location)} ${text(item?.source_url)} ${text(item?.problem)} ${text(item?.headline)}`;
  const blockingItems = [
    ...ensureArray(factCheck?.must_fix),
    ...ensureArray(factCheck?.source_gaps)
  ].map(factCheckProbe);

  const debug = options.salvageDebug === true ? msg => console.log(`[salvage] ${msg}`) : () => {};
  const keepIndices = [];
  sections.forEach((section, index) => {
    const status = text(results[index]?.status);
    if (status !== 'PASS') { debug(`drop #${index}: article status ${status || 'unknown'}`); return; }
    if (unpublishable.has(index)) { debug(`drop #${index}: fact-checker publishable=false`); return; }
    const blocker = blockingItems.find(probe => referencesSection(probe, index, section));
    if (blocker) { debug(`drop #${index}: fact-check item references it (${blocker.slice(0, 60)})`); return; }
    keepIndices.push(index);
  });
  debug(`keepIndices=[${keepIndices.join(',')}] of ${sections.length}; min=${minArticles}`);
  if (keepIndices.length < minArticles || keepIndices.length >= sections.length) return null;

  const keepSet = new Set(keepIndices);
  const droppedIndices = sections.map((_, index) => index).filter(index => !keepSet.has(index));
  // Keep only the fact-check items that reference a SURVIVING section. Items that reference a
  // dropped section (or nothing identifiable) belong to removed content and are pruned. Matching
  // against kept sections is robust to headline variants on the dropped ones.
  const refsKept = probe => keepIndices.some(index => referencesSection(probe, index, sections[index]));

  const droppedHardBlockedGroups = hardBlockedGroupsForDroppedSections(
    droppedIndices.map(index => sections[index]),
    'thin-week salvage dropped unpublishable article'
  );

  const subsetEditor = {
    ...editor,
    sections: keepIndices.map(index => sections[index]),
    hard_blocked_groups: [...ensureArray(editor.hard_blocked_groups), ...droppedHardBlockedGroups]
  };
  const subsetFactCheck = {
    ...factCheck,
    must_fix: ensureArray(factCheck?.must_fix).filter(item => refsKept(factCheckProbe(item))),
    source_gaps: ensureArray(factCheck?.source_gaps).filter(item => refsKept(factCheckProbe(item))),
    recommended_fixes: ensureArray(factCheck?.recommended_fixes).filter(item => refsKept(factCheckProbe(item))),
    article_quality: keepIndices.map((originalIndex, newIndex) => {
      const verdict = ensureArray(factCheck?.article_quality).find(item => Number(item?.section_index) === originalIndex);
      return verdict ? { ...verdict, section_index: newIndex } : { section_index: newIndex, publishable: true, reason: '' };
    })
  };
  subsetFactCheck.source_gap_count = subsetFactCheck.source_gaps.length;
  subsetFactCheck.status = subsetFactCheck.must_fix.length > 0 ? 'NEEDS_FIX' : 'PASS';

  const subsetReport = buildNewsletterQualityReport(date, subsetEditor, reporter, subsetFactCheck, options);
  if (subsetReport.status !== 'PASS') {
    debug(`subset re-gate NEEDS_FIX; blockers=${blockingDeductions(subsetReport.deductions).map(d => d.reason).join(' | ')}`);
    return null;
  }
  return {
    editor: subsetEditor,
    factCheck: subsetFactCheck,
    qualityReport: subsetReport,
    dropped_section_count: sections.length - keepIndices.length,
    kept_section_count: keepIndices.length
  };
}


module.exports = {
  QUALITY_THRESHOLD,
  MIN_MAIN_ARTICLES,
  MAX_MAIN_ARTICLES,
  buildNewsletterQualityReport,
  salvagePublishableSubset,
  hardBlockedGroupsForDroppedSections,
  buildQualityReportMarkdown,
  deductionMatchesSection,
  sectionHasQualityDeductions,
  sectionHasFactCheckMustFix,
  sectionHasSourceGap,
  sectionPassesArticleGate,
  blockingDeductions,
  determineQualityStatus
};
