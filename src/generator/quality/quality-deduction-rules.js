'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  candidateUrls,
  candidateCanonicalUrl
} = require('./candidate-claim-matching');
const {
  IMPACT_TYPES,
  RECOMMENDED_ARTICLE_TYPES
} = require('../../shared/evidence/impact-classifier');
const {
  findFieldHygieneIssues
} = require('../reporter/article-field-builder');
const {
  normalizeArticleSections
} = require('../reporter/article-section-contract');
const {
  validateDateSource,
  validateEventType,
  dateQualityForCandidate
} = require('../../shared/common/date-signals');
const {
  SOURCE_QUALITY_FIELD_DRIFT,
  normalizeSourceQuality,
  sourceQualityFieldDrift
} = require('../../shared/collect/source-quality-classifier');
const {
  LINKED_EVIDENCE_UNRESOLVED_STATUSES,
  LINKED_EVIDENCE_RUNTIME_TERMS,
  LINKED_EVIDENCE_RUNTIME_CLAIM,
  LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM,
  LINKED_EVIDENCE_HIGH_IMPACT_CLAIM,
  LINKED_EVIDENCE_LIMITATION_NOTE
} = require('../../shared/common/quality-gate-policy');
const { text } = require('./quality-text');
// claim 이슈 카테고리 매핑은 레지스트리 모듈로 분리했다(OCP). 여기서는 그대로 재노출한다.
const { claimIssueCategory } = require('./claim-issue-category');

// Per-rule deduction logic: candidate-selection eligibility, CameraX source-extraction
// integrity, linked-evidence overclaim, claim-validation, and the field/source/image
// deduction descriptors. Moved verbatim out of newsletter-quality.js as part of the
// SRP split (issue #52 phase 6); these rules are the publish gate, so the deduction
// weights and blocking semantics are byte-for-byte identical.

function candidateSelectionViolation(candidate) {
  if (!candidate) return '';
  const violations = [];
  const finalSelectionEligibility = text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
  const hasDatedEvidence = typeof candidate.hasDatedEvidence === 'boolean'
    ? candidate.hasDatedEvidence
    : candidate.has_dated_evidence;
  const isWatchPage = typeof candidate.isWatchPage === 'boolean'
    ? candidate.isWatchPage
    : candidate.is_watch_page;
  if (!['main', 'short'].includes(finalSelectionEligibility)) {
    violations.push(`finalSelectionEligibility=${finalSelectionEligibility || 'unknown'}`);
  }
  if (hasDatedEvidence !== true) violations.push('missing dated evidence');
  if (text(candidate.event_type)) {
    const eventTypeError = validateEventType(candidate.event_type);
    if (eventTypeError) violations.push(`invalid event_type=${text(candidate.event_type)}`);
  }
  if (text(candidate.date_source)) {
    const dateSourceError = validateDateSource(candidate.date_source);
    if (dateSourceError) violations.push(`invalid date_source=${text(candidate.date_source)}`);
  }
  if (text(candidate.effective_date || candidate.effectiveDate)) {
    const dateQuality = dateQualityForCandidate(candidate);
    if (dateQuality.main_article_date_eligible !== true) {
      violations.push(`effective_date not publish-ready: date_source=${dateQuality.date_source}`);
    }
    if (['snapshot_detected_at', 'content_hash_changed_without_date', 'missing'].includes(dateQuality.date_source)) {
      violations.push(`weak source event date_source=${dateQuality.date_source}`);
    }
  }
  if (isWatchPage === true && hasDatedEvidence !== true) {
    violations.push('watch page lacks dated evidence');
  }
  if (candidate.main_eligible === false) violations.push('main_eligible=false');
  if (candidate.source_gap_risk === true) violations.push('source_gap_risk=true');
  if (candidate.reference_only === true) violations.push('reference_only=true');
  const hasCanonicalSourceQuality = Boolean(candidate.source_quality && typeof candidate.source_quality === 'object' && !Array.isArray(candidate.source_quality));
  if (candidate.source_quality_required === true && !hasCanonicalSourceQuality) {
    violations.push('missing canonical source_quality');
  }
  if (hasCanonicalSourceQuality) {
    const sourceQuality = normalizeSourceQuality(candidate);
    const drift = sourceQualityFieldDrift(candidate);
    if (!candidateCanonicalUrl(candidate)) violations.push('missing_url');
    if (drift.length > 0) violations.push(SOURCE_QUALITY_FIELD_DRIFT);
    if (sourceQuality.source_url_quality === 'unknown') violations.push('unresolved source_url_quality=unknown');
    if (sourceQuality.source_quality_status === 'blocked') violations.push('source_quality_status=blocked');
    if (sourceQuality.main_article_source_allowed !== true) violations.push('main_article_source_allowed=false');
    for (const blocker of ensureArray(sourceQuality.main_article_source_blockers)) {
      violations.push(`source_quality_blocker=${blocker}`);
    }
  }
  return violations.join('; ');
}

function sourceExtractionFor(section = {}, candidate = {}) {
  return section.source_extraction || candidate?.source_extraction || null;
}

function derivedHintsFor(section = {}, candidate = {}) {
  return section.derived_editorial_hints || candidate?.derived_editorial_hints || null;
}

function extractionQualityFor(section = {}, candidate = {}) {
  return section.extraction_quality ||
    candidate?.extraction_quality ||
    section.source_extraction?.extraction_quality ||
    candidate?.source_extraction?.extraction_quality ||
    null;
}

function sourceExtractionItems(value = {}) {
  return [
    ...(Array.isArray(value?.release?.sections) ? value.release.sections : []),
    ...(Array.isArray(value?.minor_line_context?.sections) ? value.minor_line_context.sections : [])
  ].flatMap(section => ensureArray(section?.items));
}

function hasSourceExtractionBullet(value = {}) {
  return sourceExtractionItems(value).some(item => text(item?.text || item?.source_text));
}

function cameraXReleaseUrl(value = '') {
  const raw = text(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera';
  } catch {
    return /developer\.android\.com\/jetpack\/androidx\/releases\/camera/i.test(raw);
  }
}

function isCameraXReleaseArticle(section = {}, candidate = {}) {
  const extraction = sourceExtractionFor(section, candidate);
  if (extraction?.adapter_id === 'android-developers-jetpack-release') return true;
  return [
    section.source_candidate_url,
    candidate?.url,
    candidate?.article_url,
    candidate?.source_candidate_url,
    ...ensureArray(section.sources).map(source => source?.url),
    ...candidateUrls(candidate || {})
  ].some(cameraXReleaseUrl);
}

function articleText(section = {}) {
  const articleSections = normalizeArticleSections(section);
  return [
    section.category,
    section.headline,
    section.what_changed,
    section.confirmed_facts,
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes,
    section.camera_hal_checks,
    section.action_items,
    articleSections.verified_facts,
    articleSections.background_context,
    articleSections.hal_driver_impact,
    articleSections.action_items,
    articleSections.team_share_points,
    section.sources
  ].map(text).join(' ');
}

function fieldBuilderWarningsFor(section = {}, candidate = {}) {
  return [
    ...ensureArray(section.field_builder_warnings),
    ...ensureArray(candidate?.field_builder_warnings)
  ].map(text);
}

function hasRawCameraXTableArtifact(section = {}) {
  return /Maven Group versions?|View the Camera Library|Close\b|camera-[a-z0-9-]+\s+(?:-|\d+\.\d+\S*)\s+(?:-|\d+\.\d+\S*)/i
    .test(articleText(section));
}

function hasGenericCameraXFallbackText(section = {}) {
  const value = text(section.what_changed || section.evidence_summary || section.headline);
  return /^CameraX(?:\s*\/\s*androidx\.camera)?\s+(?:update|updates|updated|release|released|업데이트|릴리스)(?:입니다|입니다\.|\.?)?$/i
    .test(value);
}

function cameraXSourceExtractionViolations(section = {}, candidate = {}) {
  if (!isCameraXReleaseArticle(section, candidate)) return [];
  const extraction = sourceExtractionFor(section, candidate);
  const quality = extractionQualityFor(section, candidate) || {};
  const hints = derivedHintsFor(section, candidate) || {};
  const violations = [];
  if (quality.used_fallback === true) violations.push('source_extraction.used_fallback=true');
  if (quality.main_article_allowed === false) violations.push('source_extraction.main_article_allowed=false');
  if (fieldBuilderWarningsFor(section, candidate).includes('behavior_fallback_from_metadata')) {
    violations.push('behavior_fallback_from_metadata');
  }
  if (hasRawCameraXTableArtifact(section)) violations.push('raw CameraX artifact table remains in article text');
  if (!extraction || !hasSourceExtractionBullet(extraction)) {
    violations.push('source_extraction.release.sections has no concrete release-note bullet');
  }
  if (hasGenericCameraXFallbackText(section)) violations.push('generic CameraX fallback text used as main article body');
  // HAL-boundary discussion and validation-checklist depth are editorial-quality concerns
  // (is this useful to a Camera HAL SW engineer?) judged by the fact-checker LLM, not source
  // extraction integrity — so they are no longer deterministic publish blockers.
  return [...new Set(violations)];
}

function boundedDeduct(state, category, points, reason, location = '', options = {}) {
  if (points <= 0) return;
  const blocking = options.blocking !== false;
  state.deductions.push({
    category,
    points,
    reason,
    location,
    blocking,
    severity: options.severity || (blocking ? 'hard' : 'soft'),
    reason_code: options.reason_code || '',
    dedupe_key: options.dedupe_key || ''
  });
}

function linkedEvidenceArticleText(section) {
  const articleSections = normalizeArticleSections(section || {});
  return [
    section?.headline,
    section?.what_changed,
    articleSections.background_context,
    articleSections.hal_driver_impact,
    articleSections.team_share_points,
    section?.evidence_summary,
    section?.confirmed_facts,
    section?.source_verification_notes,
    section?.action_items
  ].map(text).join(' ');
}

function linkedEvidenceEvidenceText(section) {
  return [
    section?.evidence_summary,
    section?.confirmed_facts,
    section?.source_verification_notes
  ].map(text).join(' ');
}

function linkedEvidenceNotesText(section) {
  return text(section?.source_verification_notes);
}

function linkedEvidenceDiagnostics(candidate = {}) {
  const hasSummary = Object.prototype.hasOwnProperty.call(candidate, 'linked_evidence_summary') ||
    Object.prototype.hasOwnProperty.call(candidate, 'linkedEvidenceSummary');
  const hasImpact = Object.prototype.hasOwnProperty.call(candidate, 'impact_classification') ||
    Object.prototype.hasOwnProperty.call(candidate, 'impactClassification');
  if (!hasSummary && !hasImpact) {
    return {
      present: false,
      malformed: false,
      hasLinkedEvidence: false,
      hasUnresolvedEvidence: false,
      summary: null,
      impact: null
    };
  }

  const summary = candidate.linked_evidence_summary || candidate.linkedEvidenceSummary;
  const impact = candidate.impact_classification || candidate.impactClassification;
  const summaryIsObject = !hasSummary || (summary && typeof summary === 'object' && !Array.isArray(summary));
  const impactIsObject = !hasImpact || (impact && typeof impact === 'object' && !Array.isArray(impact));
  let malformed = hasSummary !== hasImpact || !summaryIsObject || !impactIsObject;
  const totalCount = summaryIsObject ? Number(summary?.total_count) : 0;
  if (hasSummary && !Number.isFinite(totalCount)) malformed = true;
  if (Number.isFinite(totalCount) && totalCount > 0 && !impactIsObject) malformed = true;

  const byFetchStatus = summaryIsObject && summary?.by_fetch_status && typeof summary.by_fetch_status === 'object'
    ? summary.by_fetch_status
    : {};
  const hasUnresolvedEvidence = summaryIsObject && (
    summary?.has_unresolved_evidence === true ||
    LINKED_EVIDENCE_UNRESOLVED_STATUSES.some(status => Number(byFetchStatus[status] || 0) > 0)
  );
  return {
    present: true,
    malformed,
    hasLinkedEvidence: Number.isFinite(totalCount) && totalCount > 0,
    hasUnresolvedEvidence,
    summary: summaryIsObject ? summary : null,
    impact: impactIsObject ? impact : null
  };
}

function addLinkedEvidenceQualityDeductions(state, section, candidate, location) {
  const diagnostics = linkedEvidenceDiagnostics(candidate);
  if (!diagnostics.present) return;

  if (diagnostics.malformed) {
    boundedDeduct(
      state,
      'linked-evidence-malformed',
      2,
      'Bound candidate has malformed linked evidence diagnostics; treat linked evidence as diagnostic-only.',
      location,
      { blocking: false }
    );
  }
  if (!diagnostics.hasLinkedEvidence || !diagnostics.impact) return;

  const articleText = linkedEvidenceArticleText(section);
  const evidenceText = linkedEvidenceEvidenceText(section);
  const notesText = linkedEvidenceNotesText(section);
  const impactType = text(diagnostics.impact.impact_type);
  const recommendedArticleType = text(diagnostics.impact.recommended_article_type);
  const runtimeClaim = LINKED_EVIDENCE_RUNTIME_CLAIM.test(articleText);
  const explicitRuntimeEvidence = LINKED_EVIDENCE_RUNTIME_TERMS.test(evidenceText);
  const overclaimReasons = [];

  if (diagnostics.hasUnresolvedEvidence && LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM.test(articleText)) {
    overclaimReasons.push('Article describes unresolved linked evidence as confirmed detail.');
  }
  if (impactType === IMPACT_TYPES.BUILD_DEPENDENCY_FIX && runtimeClaim) {
    overclaimReasons.push('Article frames build_dependency_fix linked evidence as HAL runtime or camera pipeline behavior change.');
  }
  if (impactType === IMPACT_TYPES.TEST_ONLY_CHANGE && runtimeClaim) {
    overclaimReasons.push('Article frames test_only_change linked evidence as product or runtime behavior change.');
  }
  if (impactType === IMPACT_TYPES.DOCUMENTATION_ONLY && runtimeClaim) {
    overclaimReasons.push('Article frames documentation_only linked evidence as implementation or runtime change.');
  }
  if (recommendedArticleType === RECOMMENDED_ARTICLE_TYPES.WATCH && !explicitRuntimeEvidence) {
    overclaimReasons.push('Article promotes watch-only linked evidence to main framing without explicit runtime or pipeline evidence.');
  }
  if (
    (diagnostics.impact.hal_runtime_impact !== true && diagnostics.impact.camera_pipeline_impact !== true) &&
    LINKED_EVIDENCE_HIGH_IMPACT_CLAIM.test(articleText) &&
    !explicitRuntimeEvidence
  ) {
    overclaimReasons.push('Article claims high HAL/runtime impact without explicit stream, buffer, metadata, request/result, ImageCapture, VideoCapture, Surface, or CameraPipe evidence.');
  }

  for (const reason of overclaimReasons) {
    boundedDeduct(state, 'linked-evidence-overclaim', 8, reason, location);
  }

  if (diagnostics.hasUnresolvedEvidence && !LINKED_EVIDENCE_LIMITATION_NOTE.test(notesText)) {
    boundedDeduct(
      state,
      'linked-evidence-limitation',
      2,
      'Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.',
      location,
      { blocking: false }
    );
  }
}

function addClaimValidationDeductions(state, validation, location, seenKeys) {
  const claimIssues = [
    ...ensureArray(validation.issues).map(item => ({
      ...item,
      claim_id: '',
      category: claimIssueCategory(item.reason_code)
    })),
    ...ensureArray(validation.claim_results).flatMap(claim =>
      ensureArray(claim.issues).map(item => ({
        ...item,
        claim_id: claim.claim_id,
        category: claimIssueCategory(item.reason_code)
      }))
    )
  ];
  for (const item of claimIssues) {
    const dedupeKey = [
      validation.article_index,
      item.claim_id || 'article',
      item.reason_code || item.message
    ].join(':');
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    boundedDeduct(
      state,
      item.category,
      item.blocking === false ? 1 : 8,
      item.message || item.reason_code || 'Claim validation issue.',
      location,
      {
        blocking: item.blocking !== false,
        severity: item.severity || (item.blocking === false ? 'soft' : 'hard'),
        reason_code: item.reason_code,
        dedupe_key: dedupeKey
      }
    );
  }
}

function isValidSourceUrl(value) {
  const raw = text(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function blockingDeductions(deductions) {
  return ensureArray(deductions).filter(deduction => deduction?.blocking !== false);
}

function softDeductions(deductions) {
  return ensureArray(deductions).filter(deduction => deduction?.blocking === false);
}

function requiredFieldDeductions(section, sectionContract, location) {
  const out = [];
  for (const field of ['headline', 'evidence_summary']) {
    if (!text(section[field])) {
      out.push({ category: 'required-fields', points: 3, reason: `Missing required article field: ${field}.`, location });
    }
  }
  for (const field of ['specificity_checks', 'source_verification_notes', 'camera_hal_checks', 'sources']) {
    if (ensureArray(section[field]).length === 0) {
      out.push({ category: 'required-fields', points: 4, reason: `Missing required article list: ${field}.`, location });
    }
  }
  for (const missingKey of sectionContract.missing_keys) {
    out.push({
      category: 'article-section-contract',
      points: missingKey === 'hal_driver_impact' ? 4 : 3,
      reason: `Missing normalized article section: ${missingKey}.`,
      location,
      options: { blocking: false }
    });
  }
  return out;
}

function fieldHygieneDeductions(section, articleSections, guardrailImpactClass, location) {
  return findFieldHygieneIssues({
    ...section,
    confirmed_facts: articleSections.verified_facts,
    guardrail_impact_class: guardrailImpactClass
  }).map(issue => ({
    category: 'field-hygiene',
    points: issue.blocking === false ? 2 : 8,
    reason: issue.reason,
    location,
    options: issue.blocking === false ? { blocking: false, severity: issue.severity || 'soft' } : {}
  }));
}

function sourceBindingDeductions(section, binding, scope, location) {
  const out = [];
  for (const source of ensureArray(section.sources)) {
    if (!isValidSourceUrl(source?.url)) {
      out.push({ category: 'source-integrity', points: 8, reason: `Missing or invalid source URL: ${source?.url || 'empty'}.`, location });
    }
  }
  if (binding.status !== 'bound') {
    out.push({
      category: 'source-integrity',
      points: 8,
      reason: binding.status === 'ambiguous'
        ? binding.reason
        : binding.status === 'evidence_mismatch'
          ? binding.reason
          : 'Main article source URL does not bind to reporter/shortlist candidate metadata.',
      location
    });
    return out;
  }
  const violation = candidateSelectionViolation(binding.candidate);
  if (violation) {
    out.push({ category: 'source-integrity', points: 8, reason: `Main article source maps to ineligible reporter/shortlist candidate: ${violation}.`, location });
  }
  if (scope?.publishable_scope !== true) {
    out.push({ category: 'source-integrity', points: 8, reason: 'Bound source candidate lacks publishable relevance_bucket and scope score metadata.', location });
  }
  return out;
}

function cameraXDeductions(section, binding, location) {
  const violations = cameraXSourceExtractionViolations(section, binding.status === 'bound' ? binding.candidate : null);
  if (violations.length === 0) return [];
  return [{ category: 'source-integrity', points: 8, reason: `CameraX source extraction failure: ${violations.join('; ')}.`, location }];
}

function imageFallbackDeductions(section, location) {
  if (section.resolvedImage?.usedFallback !== true) return [];
  return [{ category: 'image-fallback', points: 1, reason: 'Article image uses a local fallback visual.', location, options: { blocking: false } }];
}

function applyDeductionDescriptors(state, descriptors) {
  let sourceIntegrity = 0;
  for (const descriptor of ensureArray(descriptors)) {
    boundedDeduct(state, descriptor.category, descriptor.points, descriptor.reason, descriptor.location, descriptor.options || {});
    if (descriptor.category === 'source-integrity') sourceIntegrity += 1;
  }
  return sourceIntegrity;
}

module.exports = {
  candidateSelectionViolation,
  sourceExtractionFor,
  derivedHintsFor,
  extractionQualityFor,
  sourceExtractionItems,
  hasSourceExtractionBullet,
  cameraXReleaseUrl,
  isCameraXReleaseArticle,
  articleText,
  fieldBuilderWarningsFor,
  hasRawCameraXTableArtifact,
  hasGenericCameraXFallbackText,
  cameraXSourceExtractionViolations,
  boundedDeduct,
  linkedEvidenceArticleText,
  linkedEvidenceEvidenceText,
  linkedEvidenceNotesText,
  linkedEvidenceDiagnostics,
  addLinkedEvidenceQualityDeductions,
  addClaimValidationDeductions,
  isValidSourceUrl,
  blockingDeductions,
  softDeductions,
  requiredFieldDeductions,
  fieldHygieneDeductions,
  sourceBindingDeductions,
  cameraXDeductions,
  imageFallbackDeductions,
  applyDeductionDescriptors
};
