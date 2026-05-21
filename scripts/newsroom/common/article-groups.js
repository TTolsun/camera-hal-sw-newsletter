const ANDROID_NATIVE_TOOLING_GROUP_KEY = 'android_native_tooling_workflow';
const NATIVE_TOOLING_WORKFLOW_TYPE = 'native_tooling_workflow';

const CONTEXT_LABELS = Object.freeze({
  ALLOWED_SUPPORTING_CONTEXT: 'allowed_supporting_context',
  BLOCKED_CONTEXT_REFERENCE: 'blocked_context_reference',
  PARENT_ROUNDUP_CONTEXT_ONLY: 'parent_roundup_context_only',
  DEDUPE_SHADOW_CONTEXT: 'dedupe_shadow_context'
});

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').trim();
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function normalizeSourceUrlPreserveAnchor(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function normalizeCanonicalUrlStripAnchor(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.search = '';
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

const normalizeUrl = normalizeSourceUrlPreserveAnchor;

function candidateUrl(candidate = {}) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl || candidate.normalized_url);
}

function candidateTitle(candidate = {}) {
  return text(candidate.title || candidate.headline || candidate.category);
}

function isNativeToolingWorkflow(candidate = {}) {
  return text(candidate.tooling_workflow_type || candidate.toolingWorkflowType) === NATIVE_TOOLING_WORKFLOW_TYPE ||
    (
      text(candidate.relevance_bucket || candidate.relevanceBucket) === 'cpp_ai_tooling_fallback' &&
      text(candidate.article_group_key || candidate.articleGroupKey) === ANDROID_NATIVE_TOOLING_GROUP_KEY
    );
}

function fallbackGroupKey(candidate = {}) {
  const key = normalizeUrl(candidateUrl(candidate)) || candidateTitle(candidate);
  return key ? `article:${key}` : '';
}

function candidateGroupKey(candidate = {}) {
  const explicit = text(candidate.article_group_key || candidate.articleGroupKey);
  if (explicit) return explicit;
  if (isNativeToolingWorkflow(candidate)) return ANDROID_NATIVE_TOOLING_GROUP_KEY;
  return fallbackGroupKey(candidate);
}

function candidateContextLabel(candidate = {}, options = {}) {
  if (options.parentRoundup === true || text(candidate.context_role) === CONTEXT_LABELS.PARENT_ROUNDUP_CONTEXT_ONLY) {
    return CONTEXT_LABELS.PARENT_ROUNDUP_CONTEXT_ONLY;
  }
  if (options.dedupeShadow === true || text(candidate.context_role) === CONTEXT_LABELS.DEDUPE_SHADOW_CONTEXT) {
    return CONTEXT_LABELS.DEDUPE_SHADOW_CONTEXT;
  }
  const eligibility = text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
  const sourceAllowed = candidate.main_article_source_allowed === true || candidate.mainArticleSourceAllowed === true;
  const contextAllowed = candidate.context_usage_allowed === true || candidate.contextUsageAllowed === true;
  const rawSourceQualityStatus = text(candidate.source_quality_status || candidate.sourceQualityStatus);
  const sourceQualityStatus = rawSourceQualityStatus || (contextAllowed ? 'allowed' : 'unknown');
  const blocked = bool(candidate.source_gap_risk) ||
    bool(candidate.reference_only) ||
    bool(candidate.briefing_only) ||
    sourceQualityStatus === 'blocked' ||
    sourceQualityStatus === 'unknown';

  if ((contextAllowed || (['main', 'short'].includes(eligibility) && sourceAllowed)) && !blocked) {
    return CONTEXT_LABELS.ALLOWED_SUPPORTING_CONTEXT;
  }
  return CONTEXT_LABELS.BLOCKED_CONTEXT_REFERENCE;
}

function blockedReason(candidate = {}, label = '') {
  if (label === CONTEXT_LABELS.PARENT_ROUNDUP_CONTEXT_ONLY) return 'parent_roundup_context_only';
  if (label === CONTEXT_LABELS.DEDUPE_SHADOW_CONTEXT) return 'dedupe_shadow_context';
  if (bool(candidate.source_gap_risk)) return 'source_gap_risk';
  if (bool(candidate.reference_only)) return 'reference_only';
  if (bool(candidate.briefing_only)) return 'watchlist_only';
  const eligibility = text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
  if (eligibility && !['main', 'short'].includes(eligibility)) return `${eligibility}_only`;
  const contextAllowed = candidate.context_usage_allowed === true || candidate.contextUsageAllowed === true;
  const rawSourceQualityStatus = text(candidate.source_quality_status || candidate.sourceQualityStatus);
  const sourceQualityStatus = rawSourceQualityStatus || (contextAllowed ? 'allowed' : 'unknown');
  if (sourceQualityStatus === 'blocked' || sourceQualityStatus === 'unknown') {
    return `source_quality_${sourceQualityStatus}`;
  }
  return 'tooling_context_only';
}

function contextUsageAllowed(label) {
  return label === CONTEXT_LABELS.ALLOWED_SUPPORTING_CONTEXT;
}

function compactContextCandidate(candidate = {}, options = {}) {
  const label = candidateContextLabel(candidate, options);
  const allowed = contextUsageAllowed(label);
  const rawSourceQualityStatus = text(candidate.source_quality_status || candidate.sourceQualityStatus);
  const sourceQualityStatus = rawSourceQualityStatus || (allowed ? 'allowed' : 'unknown');
  const sourceUrl = candidateUrl(candidate);
  return {
    title: candidateTitle(candidate),
    url: sourceUrl,
    normalized_url: normalizeSourceUrlPreserveAnchor(sourceUrl),
    canonical_url: normalizeCanonicalUrlStripAnchor(sourceUrl),
    source: text(candidate.source || candidate.source_name),
    published_date: text(candidate.published_date || candidate.publishedAt || candidate.published_at),
    relevance_bucket: text(candidate.relevance_bucket),
    finalSelectionEligibility: text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility),
    context_role: label,
    context_usage_label: label,
    source_quality_status: sourceQualityStatus,
    context_usage_allowed: allowed,
    can_create_independent_article: false,
    blocked_from_independent_main_reason: blockedReason(candidate, label),
    article_group_key: candidateGroupKey(candidate)
  };
}

function parentRoundupContext(candidate = {}) {
  const parentUrl = text(candidate.parentUrl || candidate.parent_url);
  if (!parentUrl) return null;
  return compactContextCandidate({
    title: text(candidate.parentTitle || candidate.parent_title) || 'Parent roundup',
    url: parentUrl,
    source: text(candidate.source || candidate.source_name),
    relevance_bucket: text(candidate.relevance_bucket),
    finalSelectionEligibility: 'exclude',
    source_quality_status: 'unknown',
    article_group_key: candidateGroupKey(candidate)
  }, { parentRoundup: true });
}

function uniqueByUrlAndTitle(items = []) {
  const seen = new Set();
  const output = [];
  for (const item of ensureArray(items)) {
    const key = `${normalizeSourceUrlPreserveAnchor(item.url)}|${candidateTitle(item)}`;
    if (!key.trim() || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function attachRelatedContextToSelected(selected = [], pools = []) {
  const allCandidates = ensureArray(pools).flatMap(ensureArray);
  return ensureArray(selected).map(candidate => {
    const groupKey = candidateGroupKey(candidate);
    const selfUrl = normalizeSourceUrlPreserveAnchor(candidateUrl(candidate));
    const related = allCandidates
      .filter(item => candidateGroupKey(item) === groupKey)
      .filter(item => normalizeSourceUrlPreserveAnchor(candidateUrl(item)) !== selfUrl || candidateTitle(item) !== candidateTitle(candidate))
      .map(item => compactContextCandidate(item));
    const parentContext = parentRoundupContext(candidate);
    const relatedContexts = uniqueByUrlAndTitle(parentContext ? [parentContext, ...related] : related);
    return {
      ...candidate,
      article_group_key: groupKey,
      related_context_candidates: relatedContexts
    };
  });
}

function selectedRepresentativeGroupKeys(candidates = []) {
  return [...new Set(ensureArray(candidates)
    .filter(candidate => candidate.final_selected === true || candidate.selected_for_editor === true || candidate.primary_selected === true)
    .map(candidateGroupKey)
    .filter(Boolean))];
}

function explicitDemotedGroups(editor = {}) {
  return ensureArray(editor.explicitly_demoted_groups || editor.demoted_groups)
    .map(item => typeof item === 'string'
      ? { article_group_key: item, demotion_reason: '' }
      : {
          article_group_key: text(item?.article_group_key || item?.group_key || item?.key),
          demotion_reason: text(item?.demotion_reason || item?.reason)
        })
    .filter(item => item.article_group_key);
}

function groupCoverageSummary({ selectedGroupKeys = [], renderedGroupKeys = [], demotedGroups = [] } = {}) {
  const selected = new Set(ensureArray(selectedGroupKeys).filter(Boolean));
  const rendered = new Set(ensureArray(renderedGroupKeys).filter(Boolean));
  const demoted = new Set(ensureArray(demotedGroups).map(item => text(item.article_group_key || item)).filter(Boolean));
  const missing = [...selected].filter(key => !rendered.has(key) && !demoted.has(key));
  const overlap = [...rendered].filter(key => demoted.has(key));
  const demotionMissingReason = ensureArray(demotedGroups)
    .filter(item => selected.has(text(item.article_group_key || item)) && !text(item.demotion_reason))
    .map(item => text(item.article_group_key || item));
  return {
    selected_group_count: selected.size,
    rendered_group_count: rendered.size,
    explicitly_demoted_group_count: demoted.size,
    selected_representative_group_keys: [...selected],
    rendered_group_keys: [...rendered],
    explicitly_demoted_group_keys: [...demoted],
    missing_group_keys: missing,
    overlapping_group_keys: overlap,
    demotion_missing_reason_group_keys: demotionMissingReason,
    ok: missing.length === 0 && overlap.length === 0 && demotionMissingReason.length === 0 &&
      selected.size === rendered.size + demoted.size
  };
}

module.exports = {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  CONTEXT_LABELS,
  NATIVE_TOOLING_WORKFLOW_TYPE,
  attachRelatedContextToSelected,
  candidateContextLabel,
  candidateGroupKey,
  compactContextCandidate,
  explicitDemotedGroups,
  groupCoverageSummary,
  isNativeToolingWorkflow,
  normalizeCanonicalUrlStripAnchor,
  normalizeSourceUrlPreserveAnchor,
  normalizeUrl,
  selectedRepresentativeGroupKeys
};
