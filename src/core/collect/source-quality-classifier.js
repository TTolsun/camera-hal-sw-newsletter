const MAIN_ARTICLE_POLICIES = Object.freeze([
  'allowed',
  'conditional',
  'watchlist_only',
  'reference_only',
  'blocked'
]);

const SOURCE_QUALITY_STATUSES = Object.freeze([
  'allowed',
  'conditional',
  'blocked',
  'unknown'
]);

const CROSS_CHECK_STATUSES = Object.freeze([
  'not_required',
  'required_missing',
  'required_satisfied',
  'required_blocked',
  'not_evaluated'
]);

const SOURCE_QUALITY_BLOCKERS = Object.freeze([
  'missing_url',
  'undated_reference_page',
  'source_gap_risk',
  'reference_only',
  'generic_trend_without_hal_workflow_link',
  'cross_check_required_but_missing',
  'candidate_only_without_primary_confirmation',
  'community_signal_primary_source_disallowed',
  'fallback_without_concrete_source_fact',
  'unknown_source_quality',
  'linked_evidence_blocked',
  'linked_evidence_failed'
]);

const SOURCE_URL_QUALITIES = Object.freeze([
  'official_release_note_anchor',
  'official_dated_release',
  'official_site_update_row',
  'official_documentation_reference',
  'project_release',
  'project_mailing_list_release',
  'engineering_blog_with_camera_evidence',
  'tech_media_lead_requires_cross_check',
  'community_lead_requires_cross_check',
  'generic_ai_or_it_trend',
  'undated_reference_page',
  'fallback_context',
  'unknown'
]);

const SOURCE_ROLES = Object.freeze([
  'official_release_source',
  'official_documentation_reference',
  'project_release_source',
  'project_mailing_list_source',
  'engineering_blog_source',
  'tech_media_lead_source',
  'community_lead_source',
  'generic_trend_source',
  'fallback_context_source',
  'unknown_source'
]);

const SOURCE_POLICY_MAPPING = Object.freeze({
  allowed: {
    source_quality_status: 'allowed',
    main_article_source_allowed: true
  },
  conditional: {
    source_quality_status: 'conditional',
    main_article_source_allowed: false
  },
  watchlist_only: {
    source_quality_status: 'blocked',
    main_article_source_allowed: false
  },
  reference_only: {
    source_quality_status: 'blocked',
    main_article_source_allowed: false
  },
  blocked: {
    source_quality_status: 'blocked',
    main_article_source_allowed: false
  }
});

const FLAT_FIELD_MAP = Object.freeze({
  source_role: ['source_role', 'sourceRole'],
  source_url_quality: ['source_url_quality', 'sourceUrlQuality'],
  source_quality_status: ['source_quality_status', 'sourceQualityStatus'],
  main_article_source_allowed: ['main_article_source_allowed', 'mainArticleSourceAllowed'],
  main_article_source_allowed_reason: ['main_article_source_allowed_reason', 'mainArticleSourceAllowedReason'],
  main_article_source_blockers: ['main_article_source_blockers', 'mainArticleSourceBlockers'],
  cross_check_status: ['cross_check_status', 'crossCheckStatus'],
  requires_cross_check: ['requires_cross_check', 'requiresCrossCheck'],
  requires_conditional_evidence: ['requires_conditional_evidence', 'requiresConditionalEvidence'],
  conditional_evidence_type: ['conditional_evidence_type', 'conditionalEvidenceType'],
  evidence_granularity: ['evidence_granularity', 'evidenceGranularity'],
  source_quality_notes: ['source_quality_notes', 'sourceQualityNotes']
});

const SOURCE_QUALITY_FIELD_DRIFT = 'SOURCE_QUALITY_FIELD_DRIFT';

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function text(value) {
  return String(value || '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values.map(text).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function firstText(...values) {
  for (const value of values) {
    const out = text(value);
    if (out) return out;
  }
  return '';
}

function validOr(value, allowed, fallback) {
  const normalized = lower(value).replace(/-/g, '_');
  return allowed.includes(normalized) ? normalized : fallback;
}

function candidateUrl(candidate = {}) {
  return firstText(
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.source_candidate_url,
    candidate.normalized_url
  );
}

function urlHost(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    return new URL(raw).host.toLowerCase();
  } catch (_error) {
    return '';
  }
}

// Reddit / community-signal candidates are discovery sensors only: their own URL is
// never a primary main-article source, even when an unrelated cross-check is satisfied.
function isCommunitySignalCandidate(candidate = {}, source = {}) {
  if (candidate.community_signal === true) return true;
  if (lower(candidate.community_signal_source) === 'reddit') return true;
  if (lower(candidate.source_id || candidate.sourceId).startsWith('reddit-')) return true;
  if (lower(source.id).startsWith('reddit-')) return true;
  const hosts = [
    source.sourceUrl, source.url, source.rssUrl,
    candidate.url, candidate.article_url, candidate.source_url
  ].map(urlHost);
  return hosts.includes('reddit.com') || hosts.includes('www.reddit.com');
}

function hasDate(candidate = {}, metadata = {}) {
  return Boolean(
    bool(candidate.hasDatedEvidence, bool(candidate.has_dated_evidence)) ||
    bool(metadata.has_published_date) ||
    firstText(candidate.published_date, candidate.publishedAt, candidate.published_at)
  );
}

function hasConcreteEvidence(candidate = {}, metadata = {}) {
  return Boolean(
    bool(metadata.has_api_or_component) ||
    bool(metadata.has_behavior_change) ||
    firstText(candidate.api_or_component, metadata.api_or_component) ||
    firstText(candidate.behavior_change, metadata.behavior_change) ||
    ensureArray(candidate.evidence_notes).length > 0 ||
    ensureArray(candidate.specificity_checks).length > 0
  );
}

function hasConcreteDatedEvidence(candidate = {}, metadata = {}) {
  return hasDate(candidate, metadata) && hasConcreteEvidence(candidate, metadata);
}

function linkedEvidenceBlocked(candidate = {}) {
  const byStatus = candidate.linked_evidence_summary?.by_fetch_status ||
    candidate.source_aware_linked_evidence_summary?.by_fetch_status ||
    {};
  return Number(byStatus.blocked || 0) > 0 ||
    ensureArray(candidate.impact_classification?.warnings).includes('linked_evidence_blocked');
}

function linkedEvidenceFailed(candidate = {}) {
  const byStatus = candidate.linked_evidence_summary?.by_fetch_status ||
    candidate.source_aware_linked_evidence_summary?.by_fetch_status ||
    {};
  return Number(byStatus.failed || 0) > 0 ||
    ensureArray(candidate.impact_classification?.warnings).includes('linked_evidence_failed');
}

function normalizeSourceRole(value, source = {}) {
  const raw = lower(value || source.sourceRole || source.source_role);
  if (raw === 'reference_index') return 'official_documentation_reference';
  if (SOURCE_ROLES.includes(raw)) return raw;
  if (['tech-media', 'expert-media'].includes(lower(source.reliability))) return 'tech_media_lead_source';
  if (lower(source.reliability).includes('community')) return 'community_lead_source';
  if (lower(source.category).includes('ai') || lower(source.category).includes('tech')) return 'generic_trend_source';
  if (lower(source.collectionModeHint).includes('documentation')) return 'official_documentation_reference';
  if (lower(source.collectionModeHint).includes('release')) return 'official_release_source';
  if (['official', 'project-official', 'official-community'].includes(lower(source.reliability))) {
    return 'official_release_source';
  }
  return 'unknown_source';
}

function inferSourceUrlQuality(candidate = {}, source = {}, metadata = {}, sourceRole = '') {
  const explicit = firstText(
    candidate.source_url_quality,
    candidate.sourceUrlQuality,
    source.sourceUrlQualityHint,
    source.source_url_quality_hint
  );
  const normalized = validOr(explicit, SOURCE_URL_QUALITIES, '');
  if (normalized === 'official_documentation_reference' && !hasConcreteDatedEvidence(candidate, metadata)) {
    return 'undated_reference_page';
  }
  if (normalized) return normalized;
  const role = normalizeSourceRole(sourceRole, source);
  const mode = lower(source.collectionModeHint || candidate.sourceCollectionMode || candidate.source_collection_mode);
  const kind = lower(candidate.source_kind || metadata.source_kind);
  const category = lower(source.category || candidate.category || candidate.source_category);
  const reliability = lower(source.reliability || candidate.reliability || candidate.source_reliability);
  if (role === 'official_documentation_reference' || mode.includes('documentation')) {
    return hasConcreteDatedEvidence(candidate, metadata) ? 'official_dated_release' : 'undated_reference_page';
  }
  if (kind === 'release_note_item' || mode.includes('release')) return 'official_release_note_anchor';
  if (['official', 'project-official', 'official-community'].includes(reliability)) {
    return role === 'project_mailing_list_source' ? 'project_mailing_list_release' : 'official_dated_release';
  }
  if (['tech-media', 'expert-media'].includes(reliability)) return 'tech_media_lead_requires_cross_check';
  if (reliability.includes('community')) return 'community_lead_requires_cross_check';
  if (category.includes('ai') || category.includes('tech') || category.includes('software')) return 'generic_ai_or_it_trend';
  if (kind.includes('fallback') || candidate.counts_as_fallback_topic === true) return 'fallback_context';
  return 'unknown';
}

function normalizeMainArticlePolicy(value, source = {}) {
  const explicit = validOr(value || source.mainArticlePolicy || source.main_article_policy, MAIN_ARTICLE_POLICIES, '');
  if (explicit) return explicit;
  if (source.candidateOnly === true) return 'watchlist_only';
  if (source.requiresCrossCheck === true) return 'conditional';
  const role = normalizeSourceRole(source.sourceRole || source.source_role, source);
  if (role === 'official_documentation_reference') return 'reference_only';
  if (role === 'tech_media_lead_source' || role === 'community_lead_source' || role === 'generic_trend_source') {
    return 'conditional';
  }
  if (role === 'unknown_source') return 'conditional';
  return 'allowed';
}

function normalizeCrossCheckStatus(candidate = {}, source = {}, required = false) {
  const explicit = validOr(candidate.cross_check_status || candidate.crossCheckStatus, CROSS_CHECK_STATUSES, '');
  if (explicit) return explicit;
  if (!required) return 'not_required';
  const hasConfirmation = Boolean(
    candidate.primary_confirmation === true ||
    candidate.cross_check_satisfied === true ||
    candidate.has_primary_confirmation === true ||
    ensureArray(candidate.primary_confirmation_sources).length > 0 ||
    ensureArray(candidate.cross_check_evidence).length > 0
  );
  if (hasConfirmation) return 'required_satisfied';
  if (linkedEvidenceBlocked(candidate)) return 'required_blocked';
  if (linkedEvidenceFailed(candidate)) return 'required_blocked';
  return 'required_missing';
}

function conditionalEvidenceType(sourceUrlQuality, requiresCrossCheck, mainArticlePolicy) {
  if (mainArticlePolicy !== 'conditional') return '';
  if (requiresCrossCheck) return 'primary_confirmation';
  if (sourceUrlQuality === 'generic_ai_or_it_trend' ||
    sourceUrlQuality === 'engineering_blog_with_camera_evidence') {
    return 'native_hal_workflow';
  }
  if (sourceUrlQuality === 'project_release') return 'project_release_evidence';
  return 'source_policy_review';
}

function reasonFor(blockers, allowed) {
  if (allowed) return 'Source policy allows this candidate with concrete source evidence.';
  const first = blockers[0] || 'unknown_source_quality';
  const reasons = {
    missing_url: 'Candidate is missing a usable source URL.',
    undated_reference_page: 'Reference page does not provide dated article evidence.',
    source_gap_risk: 'Candidate still has source gap risk.',
    reference_only: 'Source is reference/background only and cannot be promoted as a dated main article.',
    generic_trend_without_hal_workflow_link: 'Generic AI/IT trend lacks explicit Camera HAL, Android Camera, driver, SoC, or native workflow evidence.',
    cross_check_required_but_missing: 'Source requires primary confirmation before main promotion.',
    candidate_only_without_primary_confirmation: 'Candidate-only source lacks primary confirmation.',
    community_signal_primary_source_disallowed: 'Community-signal source is a discovery sensor and cannot be a primary main-article source.',
    fallback_without_concrete_source_fact: 'Fallback candidate lacks concrete dated source facts.',
    unknown_source_quality: 'Source URL quality is unresolved.',
    linked_evidence_blocked: 'Linked evidence is blocked and cannot support the claim.',
    linked_evidence_failed: 'Linked evidence failed and cannot support the claim.'
  };
  return reasons[first] || `Source quality blocker: ${first}.`;
}

function classifySourceQuality(input = {}) {
  const candidate = input.candidate || {};
  const source = input.source || {};
  const metadata = input.metadata || {};
  const sourceRole = normalizeSourceRole(
    candidate.source_role || candidate.sourceRole || metadata.source_role || source.sourceRole,
    source
  );
  const mainArticlePolicy = normalizeMainArticlePolicy(
    candidate.mainArticlePolicy || candidate.main_article_policy,
    source
  );
  let sourceUrlQuality = inferSourceUrlQuality(candidate, source, metadata, sourceRole);
  const sourcePolicy = SOURCE_POLICY_MAPPING[mainArticlePolicy] || SOURCE_POLICY_MAPPING.conditional;
  const requiresCrossCheck = bool(source.requiresCrossCheckDefault, bool(source.requiresCrossCheck, bool(candidate.requires_cross_check, bool(candidate.requiresCrossCheck))));
  const requiresConditionalEvidence = mainArticlePolicy === 'conditional';
  const conditionalType = conditionalEvidenceType(sourceUrlQuality, requiresCrossCheck, mainArticlePolicy);
  const crossCheckStatus = normalizeCrossCheckStatus(candidate, source, requiresCrossCheck);
  const blockers = [];
  const url = candidateUrl(candidate);
  const concreteDatedEvidence = hasConcreteDatedEvidence(candidate, metadata);

  if (!url) blockers.push('missing_url');
  if (sourceUrlQuality === 'unknown') blockers.push('unknown_source_quality');
  if (sourceUrlQuality === 'undated_reference_page') blockers.push('undated_reference_page');
  if (candidate.source_gap_risk === true || metadata.source_gap_risk === true) blockers.push('source_gap_risk');
  if (candidate.reference_only === true || metadata.reference_only === true || mainArticlePolicy === 'reference_only') blockers.push('reference_only');
  if (candidate.candidateOnly === true || candidate.candidate_only === true || source.candidateOnly === true) {
    if (crossCheckStatus !== 'required_satisfied') blockers.push('candidate_only_without_primary_confirmation');
  }
  if (crossCheckStatus === 'required_missing') blockers.push('cross_check_required_but_missing');
  if (crossCheckStatus === 'required_blocked') blockers.push('candidate_only_without_primary_confirmation');
  if (linkedEvidenceBlocked(candidate)) blockers.push('linked_evidence_blocked');
  if (linkedEvidenceFailed(candidate)) blockers.push('linked_evidence_failed');
  if (sourceUrlQuality === 'fallback_context' && !concreteDatedEvidence) blockers.push('fallback_without_concrete_source_fact');

  const conditionalSatisfied = mainArticlePolicy === 'conditional' &&
    (!requiresCrossCheck || crossCheckStatus === 'required_satisfied') &&
    concreteDatedEvidence &&
    blockers.length === 0;

  const remainingBlockers = unique(blockers);
  let status = sourcePolicy.source_quality_status;
  let allowed = sourcePolicy.main_article_source_allowed;
  if (mainArticlePolicy === 'conditional' && conditionalSatisfied) {
    status = 'allowed';
    allowed = true;
  }
  if (remainingBlockers.length > 0) {
    status = remainingBlockers.includes('unknown_source_quality') ? 'unknown' : 'blocked';
    allowed = false;
  }
  if (sourceUrlQuality === 'unknown') {
    status = 'unknown';
    allowed = false;
  }
  if (isCommunitySignalCandidate(candidate, source)) {
    allowed = false;
    if (status === 'allowed' || status === 'conditional') {
      status = 'blocked';
    }
    if (!remainingBlockers.includes('community_signal_primary_source_disallowed')) {
      remainingBlockers.push('community_signal_primary_source_disallowed');
    }
  }

  return {
    source_role: sourceRole,
    source_url_quality: sourceUrlQuality,
    source_quality_status: status,
    main_article_source_allowed: allowed,
    main_article_source_allowed_reason: reasonFor(remainingBlockers, allowed),
    main_article_source_blockers: remainingBlockers,
    cross_check_status: crossCheckStatus,
    requires_cross_check: requiresCrossCheck,
    requires_conditional_evidence: requiresConditionalEvidence,
    conditional_evidence_type: conditionalType,
    evidence_granularity: firstText(source.evidenceGranularityHint, candidate.evidence_granularity, candidate.evidenceGranularity) || 'candidate_item',
    source_quality_notes: unique([
      ...ensureArray(source.sourceQualityNotes),
      ...ensureArray(candidate.source_quality_notes),
      ...ensureArray(candidate.sourceQualityNotes)
    ])
  };
}

function normalizeSourceQuality(value = {}) {
  const explicitCanonical = isPlainObject(value.source_quality)
    ? value.source_quality
    : isPlainObject(value.sourceQuality)
      ? value.sourceQuality
      : null;
  const canonical = explicitCanonical || classifySourceQuality({
    candidate: value,
    source: {
      reliability: firstText(value.source_reliability, value.reliability),
      sourceRole: firstText(value.source_role, value.sourceRole),
      sourceUrlQualityHint: firstText(value.source_url_quality, value.sourceUrlQuality),
      mainArticlePolicy: value.mainArticlePolicy || value.main_article_policy,
      collectionModeHint: firstText(value.collectionModeHint, value.collection_mode_hint, value.sourceCollectionMode, value.source_collection_mode),
      requiresCrossCheck: value.requiresCrossCheck,
      requiresCrossCheckDefault: value.requiresCrossCheckDefault,
      evidenceGranularityHint: firstText(value.evidenceGranularityHint, value.evidence_granularity)
    },
    metadata: value.metadata || {}
  });
  const sourceQuality = {
    source_role: firstText(canonical.source_role, value.source_role, value.sourceRole) || 'unknown_source',
    source_url_quality: validOr(firstText(canonical.source_url_quality, value.source_url_quality, value.sourceUrlQuality), SOURCE_URL_QUALITIES, 'unknown'),
    source_quality_status: validOr(firstText(canonical.source_quality_status, value.source_quality_status, value.sourceQualityStatus), SOURCE_QUALITY_STATUSES, 'unknown'),
    main_article_source_allowed: typeof canonical.main_article_source_allowed === 'boolean'
      ? canonical.main_article_source_allowed
      : typeof value.main_article_source_allowed === 'boolean'
        ? value.main_article_source_allowed
        : value.mainArticleSourceAllowed === true,
    main_article_source_allowed_reason: firstText(canonical.main_article_source_allowed_reason, value.main_article_source_allowed_reason, value.mainArticleSourceAllowedReason),
    main_article_source_blockers: unique([
      ...ensureArray(canonical.main_article_source_blockers),
      ...ensureArray(value.main_article_source_blockers),
      ...ensureArray(value.mainArticleSourceBlockers)
    ]),
    cross_check_status: validOr(firstText(canonical.cross_check_status, value.cross_check_status, value.crossCheckStatus), CROSS_CHECK_STATUSES, 'not_evaluated'),
    requires_cross_check: typeof canonical.requires_cross_check === 'boolean'
      ? canonical.requires_cross_check
      : typeof value.requires_cross_check === 'boolean'
        ? value.requires_cross_check
        : value.requiresCrossCheck === true,
    requires_conditional_evidence: typeof canonical.requires_conditional_evidence === 'boolean'
      ? canonical.requires_conditional_evidence
      : typeof value.requires_conditional_evidence === 'boolean'
        ? value.requires_conditional_evidence
        : value.requiresConditionalEvidence === true,
    conditional_evidence_type: firstText(canonical.conditional_evidence_type, value.conditional_evidence_type, value.conditionalEvidenceType),
    evidence_granularity: firstText(canonical.evidence_granularity, value.evidence_granularity, value.evidenceGranularity),
    source_quality_notes: unique([
      ...ensureArray(canonical.source_quality_notes),
      ...ensureArray(value.source_quality_notes),
      ...ensureArray(value.sourceQualityNotes)
    ])
  };
  if (sourceQuality.source_url_quality === 'unknown' &&
    !sourceQuality.main_article_source_blockers.includes('unknown_source_quality')) {
    sourceQuality.main_article_source_blockers.push('unknown_source_quality');
  }
  if (!sourceQuality.main_article_source_allowed_reason) {
    sourceQuality.main_article_source_allowed_reason = reasonFor(
      sourceQuality.main_article_source_blockers,
      sourceQuality.main_article_source_allowed
    );
  }
  return sourceQuality;
}

function sourceQualityFlatFields(sourceQuality = {}) {
  const normalized = normalizeSourceQuality({ source_quality: sourceQuality });
  return {
    sourceRole: normalized.source_role,
    source_role: normalized.source_role,
    sourceUrlQuality: normalized.source_url_quality,
    source_url_quality: normalized.source_url_quality,
    sourceQualityStatus: normalized.source_quality_status,
    source_quality_status: normalized.source_quality_status,
    mainArticleSourceAllowed: normalized.main_article_source_allowed,
    main_article_source_allowed: normalized.main_article_source_allowed,
    mainArticleSourceAllowedReason: normalized.main_article_source_allowed_reason,
    main_article_source_allowed_reason: normalized.main_article_source_allowed_reason,
    mainArticleSourceBlockers: normalized.main_article_source_blockers,
    main_article_source_blockers: normalized.main_article_source_blockers,
    crossCheckStatus: normalized.cross_check_status,
    cross_check_status: normalized.cross_check_status,
    requiresCrossCheck: normalized.requires_cross_check,
    requires_cross_check: normalized.requires_cross_check,
    requiresConditionalEvidence: normalized.requires_conditional_evidence,
    requires_conditional_evidence: normalized.requires_conditional_evidence,
    conditionalEvidenceType: normalized.conditional_evidence_type,
    conditional_evidence_type: normalized.conditional_evidence_type,
    evidenceGranularity: normalized.evidence_granularity,
    evidence_granularity: normalized.evidence_granularity,
    sourceQualityNotes: normalized.source_quality_notes,
    source_quality_notes: normalized.source_quality_notes
  };
}

function valuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(ensureArray(left)) === JSON.stringify(ensureArray(right));
  }
  return left === right;
}

function sourceQualityFieldDrift(value = {}) {
  if (!isPlainObject(value.source_quality) && !isPlainObject(value.sourceQuality)) return [];
  const canonical = normalizeSourceQuality(value);
  const flat = sourceQualityFlatFields(canonical);
  const issues = [];
  for (const [field, names] of Object.entries(FLAT_FIELD_MAP)) {
    for (const name of names) {
      if (!Object.prototype.hasOwnProperty.call(value, name)) continue;
      if (value[name] === undefined) continue;
      if (!valuesEqual(canonical[field], flat[name]) || !valuesEqual(value[name], flat[name])) {
        issues.push({
          code: SOURCE_QUALITY_FIELD_DRIFT,
          field: name,
          canonical_field: field,
          canonical_value: canonical[field],
          flat_value: value[name]
        });
      }
    }
  }
  return issues;
}

const OFFICIAL_RELEASE_SOURCE_ROLES = new Set([
  'official_release_source',
  'project_release_source',
  'engineering_blog_source'
]);

function mapSourceQualityToBaseDecision(sourceQuality = {}, metadata = {}, classification = {}) {
  const role = text(sourceQuality.source_role);
  const status = text(sourceQuality.source_quality_status);
  const allowed = sourceQuality.main_article_source_allowed === true;
  const crossCheck = text(sourceQuality.cross_check_status);
  const blockers = ensureArray(sourceQuality.main_article_source_blockers);

  if (
    role === 'official_documentation_reference' ||
    role === 'reference_index' ||
    blockers.includes('reference_only') ||
    blockers.includes('undated_reference_page')
  ) {
    return { baseEvidenceLevel: 'reference', baseReasonKey: 'reference' };
  }

  if (crossCheck === 'required_satisfied') {
    return { baseEvidenceLevel: 'verified', baseReasonKey: 'cross_check_satisfied' };
  }

  if (
    allowed &&
    status === 'allowed' &&
    classification.hasDatedEvidence === true &&
    OFFICIAL_RELEASE_SOURCE_ROLES.has(role)
  ) {
    return { baseEvidenceLevel: 'primary', baseReasonKey: 'primary' };
  }

  if (
    blockers.includes('community_signal_primary_source_disallowed') ||
    ['tech_media_lead_source', 'community_lead_source', 'project_mailing_list_source'].includes(role)
  ) {
    return { baseEvidenceLevel: 'watch', baseReasonKey: 'watch_mailing_lead' };
  }

  if (blockers.includes('generic_trend_without_hal_workflow_link')) {
    return { baseEvidenceLevel: 'watch', baseReasonKey: 'watch_generic_trend' };
  }

  if (blockers.includes('source_gap_risk')) {
    return { baseEvidenceLevel: 'watch', baseReasonKey: 'watch_source_gap' };
  }

  if (
    crossCheck === 'required_missing' ||
    blockers.includes('cross_check_required_but_missing') ||
    blockers.includes('candidate_only_without_primary_confirmation')
  ) {
    return { baseEvidenceLevel: 'watch', baseReasonKey: 'watch_cross_check' };
  }

  if (allowed && status === 'allowed' && classification.hasDatedEvidence === true) {
    return { baseEvidenceLevel: 'primary', baseReasonKey: 'primary' };
  }

  return { baseEvidenceLevel: 'watch', baseReasonKey: 'watch_default' };
}

function countBy(items, pick) {
  const out = {};
  for (const item of items) {
    const key = text(pick(item)) || 'unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function sourceQualitySummaryForCandidates(candidates = []) {
  const rows = ensureArray(candidates).map(candidate => ({
    sourceQuality: normalizeSourceQuality(candidate),
    drift: sourceQualityFieldDrift(candidate),
    hasCanonical: isPlainObject(candidate?.source_quality)
  }));
  const candidateList = ensureArray(candidates);
  const selectedMain = rows.filter((row, index) => {
    const candidate = candidateList[index] || {};
    return candidate.final_selected === true ||
      candidate.selected_for_editor === true ||
      candidate.primary_selected === true ||
      candidate.selection_slot === 'main';
  });
  const mainEligible = rows.filter((row, index) => {
    const candidate = candidateList[index] || {};
    return candidate.finalSelectionEligibility === 'main' ||
      candidate.final_selection_eligibility === 'main';
  });
  return {
    source_url_quality_distribution: countBy(rows, row => row.sourceQuality.source_url_quality),
    source_quality_status_summary: countBy(rows, row => row.sourceQuality.source_quality_status),
    source_quality_blocker_summary: countBy(
      rows.flatMap(row => row.sourceQuality.main_article_source_blockers),
      blocker => blocker
    ),
    selected_main_source_quality_coverage: {
      selected_main_count: selectedMain.length,
      with_source_quality_count: selectedMain.filter(row => row.hasCanonical).length
    },
    main_eligible_source_quality_coverage: {
      main_eligible_candidate_count: mainEligible.length,
      with_source_quality_count: mainEligible.filter(row => row.hasCanonical).length
    },
    conditional_source_promoted_count: rows.filter(row =>
      row.sourceQuality.requires_conditional_evidence === true &&
      row.sourceQuality.source_quality_status === 'allowed' &&
      row.sourceQuality.main_article_source_allowed === true
    ).length,
    conditional_source_blocked_count: rows.filter(row =>
      row.sourceQuality.requires_conditional_evidence === true &&
      row.sourceQuality.main_article_source_allowed !== true
    ).length,
    unknown_source_quality_count: rows.filter(row =>
      row.sourceQuality.source_url_quality === 'unknown' ||
      row.sourceQuality.source_quality_status === 'unknown'
    ).length,
    source_quality_field_drift_count: rows.reduce((sum, row) => sum + row.drift.length, 0),
    legacy_source_quality_warning_count: rows.filter(row => !row.hasCanonical).length
  };
}

module.exports = {
  CROSS_CHECK_STATUSES,
  FLAT_FIELD_MAP,
  MAIN_ARTICLE_POLICIES,
  SOURCE_POLICY_MAPPING,
  SOURCE_QUALITY_BLOCKERS,
  SOURCE_QUALITY_FIELD_DRIFT,
  SOURCE_QUALITY_STATUSES,
  SOURCE_ROLES,
  SOURCE_URL_QUALITIES,
  classifySourceQuality,
  isCommunitySignalCandidate,
  hasConcreteDatedEvidence,
  mapSourceQualityToBaseDecision,
  normalizeMainArticlePolicy,
  normalizeSourceQuality,
  sourceQualityFieldDrift,
  sourceQualityFlatFields,
  sourceQualitySummaryForCandidates
};
