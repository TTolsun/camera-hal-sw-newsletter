const fs = require('fs');
const path = require('path');

const {
  kstDate,
  readJson,
  writeJson
} = require('../common/common');
const {
  collectedCandidatesRelPath,
  newsroomDir,
  newsroomRelPath
} = require('../common/artifact-paths');

const SCHEMA_VERSION = 1;
const MAX_EVIDENCE_PER_ARTICLE = 3;
const MAX_EVIDENCE_TEXT_LENGTH = 180;
const MAX_EXCLUDED_CANDIDATES = 10;
const MAX_HAL_IMPACT_AXES = 12;

const MINIMUM_ARTIFACT_NAMES = [
  'generation_status',
  'selection_report',
  'shortlisted_candidates',
  'collected_candidates'
];

const OPTIONAL_ARTIFACT_NAMES = [
  'article_capsules',
  'reporter_candidates',
  'quality_report',
  'fact_check_report',
  'source_effectiveness_report',
  'repair_failure',
  'fallback_public_issue',
  'fallback_public_issue_diagnostics',
  'stale_claim_report'
];

function artifactSpecs(date) {
  return {
    generation_status: {
      key: 'generationStatus',
      tier: 'preferred',
      relPath: newsroomRelPath(date, 'generation-status.json')
    },
    selection_report: {
      key: 'selectionReport',
      tier: 'preferred',
      relPath: newsroomRelPath(date, 'selection-report.json')
    },
    shortlisted_candidates: {
      key: 'shortlistReport',
      tier: 'preferred',
      relPath: newsroomRelPath(date, 'shortlisted-candidates.json')
    },
    collected_candidates: {
      key: 'collectedCandidates',
      tier: 'preferred',
      relPath: collectedCandidatesRelPath(date)
    },
    article_capsules: {
      key: 'articleCapsules',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'article-capsules.json')
    },
    reporter_candidates: {
      key: 'reporterCandidates',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'reporter-candidates.json')
    },
    quality_report: {
      key: 'qualityReport',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'quality-report.json')
    },
    fact_check_report: {
      key: 'factCheckReport',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'fact-check-report.json')
    },
    source_effectiveness_report: {
      key: 'sourceEffectivenessReport',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'source-effectiveness-report.json')
    },
    repair_failure: {
      key: 'repairFailure',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'repair-failure.json')
    },
    fallback_public_issue: {
      key: 'fallbackPublicIssue',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'fallback-public-issue.json')
    },
    fallback_public_issue_diagnostics: {
      key: 'fallbackPublicIssueDiagnostics',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'fallback-public-issue-diagnostics.json')
    },
    stale_claim_report: {
      key: 'staleClaimReport',
      tier: 'optional',
      relPath: newsroomRelPath(date, 'stale-claim-report.json')
    }
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function firstText(...values) {
  for (const value of values) {
    const parsed = text(value);
    if (parsed) return parsed;
  }
  return '';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = numberOrNull(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function arrayLengthOrNull(value) {
  return Array.isArray(value) ? value.length : null;
}

function sumNumbersOrNull(...values) {
  const parsed = values.map(numberOrNull).filter(value => value !== null);
  if (parsed.length === 0) return null;
  return parsed.reduce((sum, value) => sum + value, 0);
}

function boolOrNull(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return null;
}

function firstBoolean(...values) {
  for (const value of values) {
    const parsed = boolOrNull(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const parsed = text(value);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    out.push(parsed);
  }
  return out;
}

function stripHtml(value) {
  return text(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength = MAX_EVIDENCE_TEXT_LENGTH) {
  const cleaned = stripHtml(value);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function diagnosticText(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return truncateText(value);
  }
  const item = objectValue(value);
  return truncateText(firstText(
    item.reason,
    item.message,
    item.error,
    item.issue,
    item.problem,
    item.failure_reason,
    item.title,
    item.claim,
    item.path
  ));
}

function compactDiagnostics(values, limit = 20) {
  return unique(ensureArray(values).map(diagnosticText)).slice(0, limit);
}

function defaultFailureDiagnostics() {
  return {
    quality_hard_failures: [],
    fact_check_must_fix: [],
    repair_failures: [],
    fallback_builder_failures: [],
    candidate_shortage_hints: [],
    source_gap_warnings: [],
    missing_artifacts: [],
    invalid_artifacts: []
  };
}

function defaultInputs(date) {
  const specs = artifactSpecs(date);
  return {
    required: [],
    preferred: MINIMUM_ARTIFACT_NAMES.map(name => specs[name].relPath),
    optional: OPTIONAL_ARTIFACT_NAMES.map(name => specs[name].relPath),
    missing: [],
    used: []
  };
}

function defaultLoadState(date) {
  return {
    inputs: defaultInputs(date),
    failure_diagnostics: defaultFailureDiagnostics(),
    warnings: [],
    preferred_invalid: false
  };
}

function relToPath(root, relPath) {
  return path.join(root, ...String(relPath).split('/'));
}

function readArtifact(root, spec, state) {
  const filePath = relToPath(root, spec.relPath);
  if (!fs.existsSync(filePath)) {
    state.inputs.missing.push(spec.relPath);
    state.failure_diagnostics.missing_artifacts.push(spec.relPath);
    state.warnings.push(`Missing ${spec.tier} artifact: ${spec.relPath}`);
    return null;
  }

  try {
    const parsed = readJson(filePath);
    state.inputs.used.push(spec.relPath);
    return parsed;
  } catch (error) {
    if (spec.tier === 'preferred') state.preferred_invalid = true;
    state.failure_diagnostics.invalid_artifacts.push({
      path: spec.relPath,
      error: truncateText(error.message)
    });
    state.warnings.push(`Invalid ${spec.tier} artifact skipped: ${spec.relPath}: ${error.message}`);
    return null;
  }
}

function loadEvidencePackInputs(root, date) {
  const resolvedRoot = path.resolve(root || process.cwd());
  const state = defaultLoadState(date);
  const specs = artifactSpecs(date);
  const artifacts = {};
  for (const name of [...MINIMUM_ARTIFACT_NAMES, ...OPTIONAL_ARTIFACT_NAMES]) {
    const spec = specs[name];
    artifacts[spec.key] = readArtifact(resolvedRoot, spec, state);
  }

  if (!state.inputs.used.some(relPath => MINIMUM_ARTIFACT_NAMES.some(name => specs[name].relPath === relPath))) {
    state.warnings.push('No minimum Evidence Pack input artifact was available; summary contains defaults only.');
  }

  return {
    date,
    inputState: state,
    ...artifacts
  };
}

function candidateUrl(candidate = {}) {
  return firstText(
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.normalized_url,
    candidate.source_candidate_url
  );
}

function candidateId(candidate = {}) {
  return firstText(
    candidate.candidate_id,
    candidate.candidateId,
    candidate.url_hash,
    candidate.source_candidate_hash,
    candidate.normalized_url,
    candidateUrl(candidate),
    candidate.title
  ) || 'unknown';
}

function candidateSourceName(candidate = {}) {
  return firstText(
    candidate.source_name,
    typeof candidate.source === 'string' ? candidate.source : '',
    objectValue(candidate.source).name,
    objectValue(candidate.source).id,
    candidate.source_id
  ) || 'unknown';
}

function sourceTier(candidate = {}) {
  return firstText(
    candidate.source_tier,
    candidate.sourceTier,
    candidate.priority,
    candidate.source_priority,
    candidate.sourcePriority
  ) || 'unknown';
}

function sourceRole(candidate = {}) {
  return firstText(
    candidate.source_role,
    candidate.sourceRole,
    objectValue(candidate.source).source_role,
    objectValue(candidate.source).sourceRole
  ) || 'unknown';
}

function sourceUrlQuality(candidate = {}) {
  return firstText(
    candidate.source_url_quality,
    candidate.sourceUrlQuality,
    candidate.source_url_status,
    candidate.sourceUrlStatus
  ) || 'unknown';
}

function sourceReliability(candidate = {}) {
  return firstText(
    candidate.source_reliability,
    candidate.sourceReliability,
    candidate.reliability,
    objectValue(candidate.source).reliability
  ) || 'unknown';
}

function freshnessWindow(candidate = {}) {
  return firstText(
    candidate.freshness_window,
    candidate.freshnessWindow,
    objectValue(candidate.freshness).window,
    objectValue(candidate.freshness).freshness_window
  ) || 'unknown';
}

function finalSelectionEligibility(candidate = {}) {
  return firstText(candidate.finalSelectionEligibility, candidate.final_selection_eligibility) || 'unknown';
}

function evidenceScore(candidate = {}) {
  return firstNumber(
    candidate.evidence_score,
    candidate.evidenceScore,
    objectValue(candidate.score).evidence_score,
    objectValue(candidate.score).evidenceScore
  );
}

function collectHalImpactAxes(candidate = {}) {
  return unique([
    ...ensureArray(candidate.hal_impact_axes),
    ...ensureArray(candidate.halImpactAxes),
    ...ensureArray(objectValue(candidate.impact_classification).hal_impact_axes),
    ...ensureArray(objectValue(candidate.impact_classification).axes),
    ...ensureArray(candidate.aosp_camera_evidence_terms),
    ...ensureArray(candidate.aospCameraEvidenceTerms)
  ]);
}

function evidenceItemText(item) {
  if (typeof item === 'string') return item;
  const value = objectValue(item);
  return firstText(
    value.text,
    value.quote,
    value.evidence,
    value.summary,
    value.reason,
    value.claim,
    value.title
  );
}

function collectEvidence(candidate = {}, capsule = {}) {
  const values = [
    ...ensureArray(candidate.key_evidence),
    ...ensureArray(candidate.evidence),
    ...ensureArray(candidate.linked_evidence_summary),
    ...ensureArray(objectValue(candidate.source_extraction).evidence),
    ...ensureArray(candidate.source_extraction),
    ...ensureArray(candidate.derived_editorial_hints),
    ...ensureArray(capsule.evidence),
    ...ensureArray(capsule.overclaim_guardrails),
    ...ensureArray(capsule.why_hal_engineer_cares)
  ];

  return unique(values
    .map(evidenceItemText)
    .map(value => truncateText(value))
    .filter(Boolean))
    .slice(0, MAX_EVIDENCE_PER_ARTICLE);
}

function selectionReason(candidate = {}) {
  return firstText(
    candidate.selection_reason,
    candidate.reason,
    candidate.collection_reason,
    objectValue(candidate.selection).reason,
    objectValue(candidate.score).reason
  ) || 'unknown';
}

function normalizeClaimValidation(candidate = {}, capsule = {}) {
  const claimValidation = objectValue(candidate.claim_validation || capsule.claim_validation);
  const status = firstText(claimValidation.status);
  return {
    status: status || 'not_available',
    bound_claims: firstNumber(claimValidation.bound_claims, claimValidation.boundClaims),
    total_claims: firstNumber(claimValidation.total_claims, claimValidation.totalClaims),
    overclaim_risk: firstText(claimValidation.overclaim_risk, claimValidation.overclaimRisk) || 'unknown'
  };
}

function articleByUrl(capsules = []) {
  const byUrl = new Map();
  for (const capsule of ensureArray(capsules)) {
    const url = candidateUrl(capsule);
    if (url && !byUrl.has(url)) byUrl.set(url, capsule);
  }
  return byUrl;
}

function addCompatibilityWarnings(article, warnings) {
  const title = article.title || article.candidate_id;
  for (const field of ['source_tier', 'source_role', 'source_url_quality', 'source_reliability', 'freshness_window']) {
    if (article[field] === 'unknown') {
      warnings.push(`Fallback ${field}=unknown for selected article: ${title}`);
    }
  }
  if (article.claim_validation.status === 'not_available') {
    warnings.push(`Fallback claim_validation.status=not_available for selected article: ${title}`);
  }
  if (article.hal_impact_axes.length === 0) {
    warnings.push(`Fallback hal_impact_axes=[] for selected article: ${title}`);
  }
}

function normalizeArticle(candidate = {}, capsule = {}, warnings = null) {
  const article = {
    candidate_id: candidateId(candidate),
    title: firstText(candidate.title, capsule.title) || 'unknown',
    url: firstText(candidateUrl(candidate), candidateUrl(capsule)) || 'unknown',
    source: candidateSourceName(candidate),
    source_tier: sourceTier(candidate),
    source_role: sourceRole(candidate),
    source_url_quality: sourceUrlQuality(candidate),
    source_reliability: sourceReliability(candidate),
    freshness_window: freshnessWindow(candidate),
    relevance_bucket: firstText(candidate.relevance_bucket, capsule.relevance_bucket) || 'unknown',
    finalSelectionEligibility: finalSelectionEligibility(candidate),
    source_gap_risk: firstBoolean(candidate.source_gap_risk, candidate.sourceGapRisk),
    has_dated_evidence: firstBoolean(candidate.has_dated_evidence, candidate.hasDatedEvidence),
    evidence_score: evidenceScore(candidate),
    hal_impact_axes: collectHalImpactAxes(candidate),
    key_evidence: collectEvidence(candidate, capsule),
    selection_reason: selectionReason(candidate),
    claim_validation: normalizeClaimValidation(candidate, capsule)
  };
  if (warnings) addCompatibilityWarnings(article, warnings);
  return article;
}

function claimValidationSummary(articles = []) {
  const validations = ensureArray(articles).map(article => objectValue(article.claim_validation));
  const availableCount = validations.filter(validation => {
    const status = lower(validation.status);
    return status && status !== 'not_available' && status !== 'unknown';
  }).length;
  const notAvailableCount = validations.length - availableCount;
  const boundClaims = sumNumbersOrNull(...validations.map(validation =>
    firstNumber(validation.bound_claims, validation.boundClaims)
  ));
  const totalClaims = sumNumbersOrNull(...validations.map(validation =>
    firstNumber(validation.total_claims, validation.totalClaims)
  ));
  const riskRank = new Map([
    ['low', 1],
    ['medium', 2],
    ['high', 3]
  ]);
  const overclaimRisk = validations
    .map(validation => lower(validation.overclaim_risk || validation.overclaimRisk))
    .filter(value => riskRank.has(value))
    .sort((left, right) => riskRank.get(right) - riskRank.get(left))[0] || 'unknown';

  return {
    status: validations.length === 0
      ? 'not_available'
      : availableCount === 0
        ? 'not_available'
        : notAvailableCount > 0
          ? 'partial'
          : 'available',
    bound_claims: boundClaims,
    total_claims: totalClaims,
    overclaim_risk: overclaimRisk,
    available_article_count: availableCount,
    not_available_article_count: notAvailableCount
  };
}

function halImpactSummary(articles = []) {
  const selected = ensureArray(articles);
  const axes = unique(selected.flatMap(article => ensureArray(article.hal_impact_axes)))
    .slice(0, MAX_HAL_IMPACT_AXES);
  return {
    axes,
    article_count_with_axes: selected.filter(article => ensureArray(article.hal_impact_axes).length > 0).length,
    article_count_without_axes: selected.filter(article => ensureArray(article.hal_impact_axes).length === 0).length
  };
}

function exclusionReasons(candidate = {}) {
  return unique([
    ...ensureArray(candidate.final_exclusion_reasons),
    ...ensureArray(candidate.exclusion_reasons),
    candidate.selection_exclusion_reason,
    candidate.watchlist_reason,
    candidate.verification_hint,
    candidate.reason,
    candidate.main_eligible === false ? 'main_eligible=false' : '',
    candidate.source_gap_risk === true ? 'source_gap_risk=true' : '',
    candidate.reference_only === true ? 'reference_only=true' : '',
    candidate.briefing_only === true ? 'briefing_only=true' : '',
    firstBoolean(candidate.has_dated_evidence, candidate.hasDatedEvidence) === false ? 'hasDatedEvidence=false' : '',
    !['unknown', 'main', 'short', 'eligible'].includes(lower(finalSelectionEligibility(candidate)))
      ? `finalSelectionEligibility=${finalSelectionEligibility(candidate)}`
      : ''
  ]);
}

function normalizeExcludedCandidate(candidate = {}) {
  return {
    candidate_id: candidateId(candidate),
    title: firstText(candidate.title) || 'unknown',
    url: candidateUrl(candidate) || 'unknown',
    source: candidateSourceName(candidate),
    source_role: sourceRole(candidate),
    source_url_quality: sourceUrlQuality(candidate),
    freshness_window: freshnessWindow(candidate),
    relevance_bucket: firstText(candidate.relevance_bucket) || 'unknown',
    exclusion_reason: exclusionReasons(candidate)[0] || 'unknown'
  };
}

function isFinalSelectedCandidate(candidate = {}) {
  return candidate.final_selected === true ||
    candidate.selected_for_editor === true ||
    candidate.primary_selected === true ||
    (
      candidate.selected === true &&
      candidate.reserve_candidate !== true &&
      ensureArray(candidate.final_exclusion_reasons).length === 0 &&
      ensureArray(candidate.exclusion_reasons).length === 0
    );
}

function isReserveCandidate(candidate = {}) {
  return candidate.reserve_candidate === true ||
    candidate.selection_stage === 'deterministic-reserve';
}

function selectedCandidates(shortlistReport = {}, articleCapsules = {}) {
  const primary = ensureArray(shortlistReport.primary_selected_articles);
  if (primary.length > 0) return primary;
  const selected = ensureArray(shortlistReport.selected_articles);
  if (selected.length > 0) return selected;
  const fromShortlisted = ensureArray(shortlistReport.shortlisted_candidates)
    .filter(isFinalSelectedCandidate);
  if (fromShortlisted.length > 0) return fromShortlisted;
  return ensureArray(articleCapsules.selected_capsules);
}

function reserveCandidates(shortlistReport = {}, articleCapsules = {}) {
  const reserve = ensureArray(shortlistReport.reserve_candidates);
  if (reserve.length > 0) return reserve;
  const fromShortlisted = ensureArray(shortlistReport.shortlisted_candidates)
    .filter(candidate => isReserveCandidate(candidate) && !isFinalSelectedCandidate(candidate));
  if (fromShortlisted.length > 0) return fromShortlisted;
  return ensureArray(articleCapsules.reserve_capsules);
}

function excludedCandidates(shortlistReport = {}, collectedCandidates = {}, selected = [], reserve = []) {
  const explicit = [
    ...ensureArray(shortlistReport.excluded_candidates),
    ...ensureArray(shortlistReport.demoted_candidates)
  ];
  if (explicit.length > 0) return explicit;

  const fromShortlisted = ensureArray(shortlistReport.shortlisted_candidates)
    .filter(candidate => !isFinalSelectedCandidate(candidate) && !isReserveCandidate(candidate));
  if (fromShortlisted.length > 0) return fromShortlisted;

  const selectedUrls = new Set([...selected, ...reserve].map(candidateUrl).filter(Boolean));
  return ensureArray(collectedCandidates.candidates)
    .filter(candidate => !selectedUrls.has(candidateUrl(candidate)));
}

function sourceGapWarnings(factCheckReport = {}, sourceEffectivenessReport = {}) {
  const sourceEffectivenessWarnings = ensureArray(sourceEffectivenessReport.warnings)
    .filter(warning => lower(warning).includes('source gap'));
  return compactDiagnostics([
    ...ensureArray(factCheckReport.source_gaps),
    ...sourceEffectivenessWarnings
  ]);
}

function hardFailures(qualityReport = {}) {
  const articleFailures = ensureArray(qualityReport.article_results)
    .flatMap(result => ensureArray(result.hard_fail_reasons));
  const deductionFailures = ensureArray(qualityReport.deductions)
    .filter(item => objectValue(item).hard_fail === true || /hard/i.test(firstText(objectValue(item).severity, objectValue(item).reason)))
    .map(item => firstText(objectValue(item).reason, objectValue(item).message));
  return compactDiagnostics([
    ...articleFailures,
    ...deductionFailures,
    ...ensureArray(qualityReport.hard_failures)
  ]);
}

function repairFailures(repairFailure = {}) {
  if (!repairFailure) return [];
  return compactDiagnostics([
    repairFailure,
    ...ensureArray(repairFailure.failures),
    ...ensureArray(repairFailure.errors),
    ...ensureArray(repairFailure.changedArtifacts)
  ]);
}

function fallbackFailures(fallbackPublicIssue = {}, fallbackPublicIssueDiagnostics = {}) {
  return compactDiagnostics([
    fallbackPublicIssue.failure_reason,
    fallbackPublicIssue.error,
    ...ensureArray(fallbackPublicIssue.errors),
    ...ensureArray(fallbackPublicIssueDiagnostics.errors),
    ...ensureArray(fallbackPublicIssueDiagnostics.structural_errors),
    ...ensureArray(fallbackPublicIssueDiagnostics.fallback_builder_failures)
  ]);
}

function candidateShortageHints(...sources) {
  return compactDiagnostics(sources.flatMap(source => ensureArray(source?.selection_shortage_hints)));
}

function firstPresentTextField(field, ...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    const value = source[field];
    if (value === null || value === undefined) return '';
    return text(value);
  }
  return '';
}

function fallbackCandidatesPromotedCount(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const numeric = numberOrNull(source.fallback_candidates_promoted_count);
    if (numeric !== null) return numeric;
    const arrayLength = arrayLengthOrNull(source.fallback_candidates_promoted);
    if (arrayLength !== null) return arrayLength;
  }
  return null;
}

function factCheckMustFix(factCheckReport = {}, staleClaimReport = {}) {
  return compactDiagnostics([
    ...ensureArray(factCheckReport.must_fix),
    ...ensureArray(factCheckReport.mustFix),
    ...ensureArray(staleClaimReport.must_fix),
    ...ensureArray(staleClaimReport.stale_claims)
  ]);
}

function countFromComposition(composition = {}, key) {
  return firstNumber(
    composition[key],
    objectValue(composition.bucket_counts)[key]
  );
}

function selectedCountFallback(shortlistReport = {}, articleCapsules = {}, selected = []) {
  if (Array.isArray(shortlistReport.primary_selected_articles) ||
    Array.isArray(shortlistReport.selected_articles) ||
    Array.isArray(shortlistReport.shortlisted_candidates) ||
    Array.isArray(articleCapsules.selected_capsules)) {
    return selected.length;
  }
  return null;
}

function reserveCountFallback(shortlistReport = {}, articleCapsules = {}, reserve = []) {
  if (Array.isArray(shortlistReport.reserve_candidates) ||
    Array.isArray(shortlistReport.shortlisted_candidates) ||
    Array.isArray(articleCapsules.reserve_capsules)) {
    return reserve.length;
  }
  return null;
}

function excludedCountFallback(shortlistReport = {}, collectedCandidates = {}, excluded = []) {
  if (Array.isArray(shortlistReport.excluded_candidates) ||
    Array.isArray(shortlistReport.demoted_candidates) ||
    Array.isArray(shortlistReport.shortlisted_candidates) ||
    Array.isArray(collectedCandidates.candidates)) {
    return excluded.length;
  }
  return null;
}

function selectionSummary({
  articleCapsules = {},
  collectedCandidates = {},
  shortlistReport = {},
  selectionReport = {},
  generationStatus = {},
  selected = [],
  reserve = [],
  excluded = []
}) {
  const counts = objectValue(selectionReport.counts);
  const composition = objectValue(
    generationStatus.composition_summary ||
    shortlistReport.composition_summary ||
    selectionReport.composition_summary
  );
  return {
    raw_candidate_count: firstNumber(
      counts.input_candidate_count,
      generationStatus.input_candidate_count,
      shortlistReport.input_candidate_count,
      arrayLengthOrNull(collectedCandidates.candidates)
    ),
    eligible_candidate_count: firstNumber(
      counts.eligible_candidate_count,
      generationStatus.eligible_candidate_count,
      shortlistReport.eligible_candidate_count
    ),
    selected_main_article_count: firstNumber(
      counts.selected_article_count,
      generationStatus.selected_article_count,
      shortlistReport.selected_article_count,
      selectedCountFallback(shortlistReport, articleCapsules, selected)
    ),
    reserve_candidate_count: firstNumber(
      counts.reserve_candidate_count,
      generationStatus.reserve_candidate_count,
      shortlistReport.reserve_candidate_count,
      reserveCountFallback(shortlistReport, articleCapsules, reserve)
    ),
    excluded_candidate_count: firstNumber(
      counts.excluded_candidate_count,
      generationStatus.excluded_candidate_count,
      shortlistReport.excluded_candidate_count,
      excludedCountFallback(shortlistReport, collectedCandidates, excluded)
    ),
    primary_camera_stack_count: firstNumber(
      counts.primary_camera_stack_topic_count,
      composition.primary_camera_stack_topic_count,
      composition.primary_camera_stack_count,
      sumNumbersOrNull(
        countFromComposition(composition, 'direct_aosp_camera'),
        countFromComposition(composition, 'camera_driver_image_pipeline')
      )
    ),
    supporting_bucket_count: firstNumber(
      counts.supporting_main_article_count,
      composition.supporting_main_article_count,
      composition.supporting_bucket_count
    ),
    fallback_window_used: firstBoolean(
      generationStatus.fallback_window_used,
      shortlistReport.fallback_window_used,
      selectionReport.fallback_window_used
    ),
    fallback_window_consulted: firstBoolean(
      generationStatus.fallback_window_consulted,
      shortlistReport.fallback_window_consulted,
      selectionReport.fallback_window_consulted
    ),
    fallback_window_reason: firstPresentTextField(
      'fallback_window_reason',
      generationStatus,
      shortlistReport,
      selectionReport
    ),
    fallback_candidates_promoted_count: fallbackCandidatesPromotedCount(
      generationStatus,
      shortlistReport,
      selectionReport
    ),
    fallback_bucket_used: firstBoolean(
      generationStatus.fallback_bucket_used,
      shortlistReport.fallback_bucket_used,
      selectionReport.fallback_bucket_used,
      firstNumber(generationStatus.fallback_topic_count, composition.fallback_topic_count) > 0 ? true : null
    ),
    candidate_shortage_hints: candidateShortageHints(generationStatus, shortlistReport, selectionReport)
  };
}

function publishStatus({
  generationStatus = {},
  selectionReport = {},
  shortlistReport = {},
  qualityReport = {},
  factCheckReport = {},
  inputState = {}
}) {
  const finalPublishReady = firstBoolean(
    generationStatus.final_publish_ready,
    generationStatus.publish_ready,
    selectionReport.publish_ready,
    selectionReport.publish_gate_passed,
    shortlistReport.publish_ready
  );
  const publicNewsletterReady = firstBoolean(
    generationStatus.public_newsletter_ready,
    generationStatus.has_public_artifacts
  );
  const reviewPrReady = firstBoolean(
    generationStatus.review_pr_ready,
    generationStatus.has_reviewable_artifacts,
    selectionReport.review_gate_passed
  );
  const factCheckStatus = firstText(
    generationStatus.fact_check_status,
    factCheckReport.status
  ) || 'UNKNOWN';
  const qualityStatus = firstText(
    generationStatus.quality_status,
    qualityReport.status
  );
  const rawStatus = lower(firstText(generationStatus.status, selectionReport.status));
  const failureKind = lower(firstText(generationStatus.failure_kind, selectionReport.failure_kind));
  let status = 'unknown';

  if (inputState.preferred_invalid) {
    status = 'unknown';
  } else if (finalPublishReady === true || rawStatus === 'publish_ready' || rawStatus === 'publish-ready') {
    status = 'publish-ready';
  } else if (rawStatus.includes('needs_fix') || rawStatus.includes('needs-fix') ||
    ['NEEDS_FIX', 'FAIL'].includes(factCheckStatus) ||
    ['NEEDS_FIX', 'FAIL'].includes(qualityStatus)) {
    status = 'needs-fix';
  } else if (/candidate_shortage|review_only|review-only|thin_week|thin-week/.test(failureKind) ||
    (reviewPrReady === true && finalPublishReady !== true)) {
    status = 'review-only';
  } else if (rawStatus.includes('fail') || rawStatus.includes('error')) {
    status = 'failed';
  }

  return {
    status,
    run_mode: firstText(
      generationStatus.run_mode,
      generationStatus.runMode,
      objectValue(generationStatus.run_context).mode,
      objectValue(generationStatus.run_context).run_mode
    ) || 'unknown',
    quality_score: firstNumber(generationStatus.quality_score, qualityReport.score),
    quality_threshold: firstNumber(generationStatus.quality_threshold, qualityReport.threshold),
    fact_check_status: factCheckStatus,
    final_publish_ready: finalPublishReady,
    public_newsletter_ready: publicNewsletterReady,
    review_pr_ready: reviewPrReady
  };
}

function mergeInputState(date, inputState = {}) {
  const base = defaultLoadState(date);
  return {
    inputs: {
      ...base.inputs,
      ...objectValue(inputState.inputs),
      missing: unique([
        ...ensureArray(base.inputs.missing),
        ...ensureArray(objectValue(inputState.inputs).missing)
      ]),
      used: unique([
        ...ensureArray(base.inputs.used),
        ...ensureArray(objectValue(inputState.inputs).used)
      ])
    },
    failure_diagnostics: {
      ...base.failure_diagnostics,
      ...objectValue(inputState.failure_diagnostics),
      missing_artifacts: unique([
        ...ensureArray(objectValue(inputState.failure_diagnostics).missing_artifacts)
      ]),
      invalid_artifacts: ensureArray(objectValue(inputState.failure_diagnostics).invalid_artifacts)
    },
    warnings: unique(ensureArray(inputState.warnings)),
    preferred_invalid: inputState.preferred_invalid === true
  };
}

function buildEvidencePackSummary(options = {}) {
  const date = text(options.date) || kstDate();
  const inputState = mergeInputState(date, options.inputState);
  const warnings = [...inputState.warnings];
  const collectedCandidates = options.collectedCandidates || {};
  const shortlistReport = options.shortlistReport || {};
  const selectionReport = options.selectionReport || {};
  const generationStatus = options.generationStatus || {};
  const articleCapsules = options.articleCapsules || {};
  const qualityReport = options.qualityReport || {};
  const factCheckReport = options.factCheckReport || {};
  const sourceEffectivenessReport = options.sourceEffectivenessReport || {};
  const repairFailure = options.repairFailure || null;
  const fallbackPublicIssue = options.fallbackPublicIssue || {};
  const fallbackPublicIssueDiagnostics = options.fallbackPublicIssueDiagnostics || {};
  const staleClaimReport = options.staleClaimReport || {};
  const selected = selectedCandidates(shortlistReport, articleCapsules);
  const reserve = reserveCandidates(shortlistReport, articleCapsules);
  const excluded = excludedCandidates(shortlistReport, collectedCandidates, selected, reserve);
  const capsulesByUrl = articleByUrl(articleCapsules.selected_capsules);
  const selectedMainArticles = selected.map(candidate => {
    const capsule = capsulesByUrl.get(candidateUrl(candidate)) || {};
    return normalizeArticle(candidate, capsule, warnings);
  });
  const reserveArticles = reserve.map(candidate => normalizeArticle(candidate));
  const excludedTop = excluded.slice(0, MAX_EXCLUDED_CANDIDATES).map(normalizeExcludedCandidate);
  const shortageHints = candidateShortageHints(generationStatus, shortlistReport, selectionReport);

  const failureDiagnostics = {
    ...inputState.failure_diagnostics,
    quality_hard_failures: hardFailures(qualityReport),
    fact_check_must_fix: factCheckMustFix(factCheckReport, staleClaimReport),
    repair_failures: repairFailures(repairFailure),
    fallback_builder_failures: fallbackFailures(fallbackPublicIssue, fallbackPublicIssueDiagnostics),
    candidate_shortage_hints: shortageHints,
    source_gap_warnings: sourceGapWarnings(factCheckReport, sourceEffectivenessReport),
    missing_artifacts: unique(inputState.failure_diagnostics.missing_artifacts),
    invalid_artifacts: inputState.failure_diagnostics.invalid_artifacts
  };

  return {
    schema_version: SCHEMA_VERSION,
    date,
    generated_at: text(options.generatedAt) || new Date().toISOString(),
    inputs: inputState.inputs,
    publish_status: publishStatus({
      generationStatus,
      selectionReport,
      shortlistReport,
      qualityReport,
      factCheckReport,
      inputState
    }),
    selection_summary: selectionSummary({
      articleCapsules,
      collectedCandidates,
      shortlistReport,
      selectionReport,
      generationStatus,
      selected,
      reserve,
      excluded
    }),
    claim_validation_summary: claimValidationSummary(selectedMainArticles),
    hal_impact_summary: halImpactSummary(selectedMainArticles),
    selected_main_articles: selectedMainArticles,
    reserve_candidates: reserveArticles,
    excluded_candidates_top: excludedTop,
    excluded_candidates_truncated: excluded.length > MAX_EXCLUDED_CANDIDATES,
    failure_diagnostics: failureDiagnostics,
    warnings: unique(warnings)
  };
}

function writeEvidencePackSummaryArtifacts(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const date = text(options.date) || kstDate();
  const inputs = options.inputs || loadEvidencePackInputs(root, date);
  const report = buildEvidencePackSummary({ ...inputs, date });
  const outDir = newsroomDir(root, date);
  const jsonPath = path.join(outDir, 'evidence-pack-summary.json');
  writeJson(jsonPath, report);
  return { report, jsonPath };
}

module.exports = {
  MAX_EVIDENCE_PER_ARTICLE,
  MAX_EVIDENCE_TEXT_LENGTH,
  MAX_EXCLUDED_CANDIDATES,
  SCHEMA_VERSION,
  buildEvidencePackSummary,
  loadEvidencePackInputs,
  writeEvidencePackSummaryArtifacts
};
