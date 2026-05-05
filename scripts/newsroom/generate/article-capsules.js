const CAPSULE_TOKEN_TARGET = '500-800';
const MAX_TEXT = 420;
const MAX_EVIDENCE_ITEMS = 6;
const MAX_IMAGE_CANDIDATES = 3;

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

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compactText(value, max = MAX_TEXT) {
  const raw = text(value).replace(/\s+/g, ' ');
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1).trim()}...`;
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function candidateUrl(candidate) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl);
}

function candidateBody(candidate) {
  return [
    candidate.title,
    candidate.summary,
    candidate.section,
    candidate.source_section,
    candidate.category,
    candidate.api_or_component,
    candidate.behavior_change,
    candidate.relevance_reason,
    candidate.collection_reason
  ].map(text).join(' ');
}

function topicType(candidate) {
  const body = candidateBody(candidate);
  if (/Camera HAL|camera provider|camera3|HAL3|ICamera/i.test(body)) return 'camera-hal';
  if (/Android Camera|AOSP Camera|CameraX|Camera2|Camera ITS|CTS|VTS/i.test(body)) return 'android-camera';
  if (/\b(C\+\+|cpp|LLVM|Clang|NDK|native|toolchain)\b/i.test(body)) return 'cpp';
  if (/\b(AI|agent|LLM|Gemini|NPU|GPU|on-device|inference|model)\b/i.test(body)) return 'ai';
  return 'general';
}

function summaryCacheText(candidate) {
  const cache = candidate.summary_cache || {};
  return compactText(cache.summary || cache.text || '');
}

function evidenceItems(candidate) {
  const items = [
    candidate.version_or_release ? `version_or_release: ${candidate.version_or_release}` : '',
    candidate.api_or_component ? `api_or_component: ${candidate.api_or_component}` : '',
    candidate.behavior_change ? `behavior_change: ${candidate.behavior_change}` : '',
    ...ensureArray(candidate.evidence_notes).map(item => `evidence_note: ${item}`),
    summaryCacheText(candidate) ? `summary_cache: ${summaryCacheText(candidate)}` : '',
    candidate.summary ? `summary: ${candidate.summary}` : ''
  ].map(item => compactText(item, 260)).filter(Boolean);
  return [...new Set(items)].slice(0, MAX_EVIDENCE_ITEMS);
}

function score(candidate) {
  const breakdown = candidate.score_breakdown || {};
  return {
    total: number(candidate.deterministic_score ?? breakdown.total),
    camera_hal_directness: number(breakdown.camera_hal_directness ?? breakdown.camera_hal_relevance ?? candidate.camera_hal_relevance_score),
    evidence_specificity: number(breakdown.evidence_specificity ?? candidate.evidence_score),
    freshness: number(breakdown.freshness_score ?? breakdown.freshness ?? candidate.freshness_score),
    practical_actionability: number(breakdown.practical_actionability ?? candidate.practical_actionability_score),
    source_reliability: number(breakdown.source_reliability ?? candidate.source_reliability_score),
    optional_ai_cpp_bonus: number(breakdown.optional_ai_cpp_bonus)
  };
}

function risk(candidate) {
  const hasDatedEvidence = typeof candidate.hasDatedEvidence === 'boolean'
    ? candidate.hasDatedEvidence
    : bool(candidate.has_dated_evidence);
  return {
    source_gap: bool(candidate.source_gap_risk),
    watch_page: bool(candidate.isWatchPage, bool(candidate.is_watch_page)),
    no_dated_evidence: !text(candidate.published_date || candidate.publishedAt || candidate.published_at) || !hasDatedEvidence,
    candidate_only: bool(candidate.candidateOnly, bool(candidate.candidate_only)),
    requires_cross_check: bool(candidate.requiresCrossCheck, bool(candidate.requires_cross_check)),
    final_selection_eligibility: text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility)
  };
}

function eligibility(candidate) {
  return {
    collectionMode: text(candidate.collectionMode || candidate.collection_mode),
    isArticleCandidate: bool(candidate.isArticleCandidate, bool(candidate.is_article_candidate)),
    isWatchPage: bool(candidate.isWatchPage, bool(candidate.is_watch_page)),
    hasDatedEvidence: bool(candidate.hasDatedEvidence, bool(candidate.has_dated_evidence)),
    evidenceLevel: text(candidate.evidenceLevel || candidate.evidence_level),
    finalSelectionEligibility: text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility),
    source_kind: text(candidate.source_kind),
    source_gap_risk: bool(candidate.source_gap_risk),
    main_eligible: candidate.main_eligible !== false,
    briefing_only: bool(candidate.briefing_only),
    reference_only: bool(candidate.reference_only),
    evidence_score: number(candidate.evidence_score),
    cross_check_status: text(candidate.cross_check_status || 'not-required')
  };
}

function compactImageCandidates(candidate) {
  return ensureArray(candidate.imageCandidates || candidate.image_candidates)
    .filter(image => image && image.url)
    .slice(0, MAX_IMAGE_CANDIDATES)
    .map(image => ({
      url: text(image.url),
      sourceUrl: text(image.sourceUrl),
      articleUrl: text(image.articleUrl),
      licenseStatus: text(image.licenseStatus),
      attribution: compactText(image.attribution, 120),
      validationStatus: text(image.validationStatus)
    }));
}

function estimatedTokens(value) {
  return Math.ceil(JSON.stringify(value).length / 4);
}

function isFinalSelected(candidate) {
  if (typeof candidate.final_selected === 'boolean') return candidate.final_selected;
  if (typeof candidate.selected_for_editor === 'boolean') return candidate.selected_for_editor;
  return bool(candidate.selected);
}

function buildArticleCapsule(candidate) {
  const capsule = {
    title: compactText(candidate.title, 180),
    url: candidateUrl(candidate),
    source: compactText(candidate.source || candidate.source_name, 120),
    published_date: text(candidate.published_date || candidate.publishedAt || candidate.published_at),
    topic_type: topicType(candidate),
    editorial_priority: number(candidate.editorial_priority, 6),
    relevance_bucket: text(candidate.relevance_bucket),
    scope_relevance: {
      aosp_camera_directness: number(candidate.aosp_camera_directness),
      driver_stack_relevance: number(candidate.driver_stack_relevance),
      soc_platform_relevance: number(candidate.soc_platform_relevance),
      native_tooling_relevance: number(candidate.native_tooling_relevance),
      counts_as_primary_camera_topic: bool(candidate.counts_as_primary_camera_topic),
      counts_as_driver_topic: bool(candidate.counts_as_driver_topic),
      counts_as_soc_topic: bool(candidate.counts_as_soc_topic),
      counts_as_fallback_topic: bool(candidate.counts_as_fallback_topic),
      evidence_origin: text(candidate.evidence_origin)
    },
    component: compactText(candidate.api_or_component || candidate.version_or_release, 160),
    what_changed: compactText(candidate.behavior_change || candidate.summary || summaryCacheText(candidate), MAX_TEXT),
    why_hal_engineer_cares: compactText(
      candidate.relevance_reason ||
      candidate.collection_reason ||
      candidate.reason ||
      candidate.camera_hal_perspective ||
      candidate.summary,
      MAX_TEXT
    ),
    evidence: evidenceItems(candidate),
    risk: risk(candidate),
    eligibility: eligibility(candidate),
    score: score(candidate),
    selection: {
      final_selected: isFinalSelected(candidate),
      primary_selected: bool(candidate.primary_selected, isFinalSelected(candidate)),
      reserve_candidate: bool(candidate.reserve_candidate),
      selected_for_editor: bool(candidate.selected_for_editor, isFinalSelected(candidate)),
      selection_slot: text(candidate.selection_slot),
      main_article_score_eligible: candidate.main_article_score_eligible !== false,
      score_filter_reasons: ensureArray(candidate.score_filter_reasons).slice(0, 5),
      exclusion_reasons: ensureArray(candidate.exclusion_reasons).slice(0, 5)
    },
    url_hash: text(candidate.url_hash),
    imageCandidates: compactImageCandidates(candidate)
  };
  return {
    ...capsule,
    estimated_tokens: estimatedTokens(capsule)
  };
}

function capsuleMap(capsules) {
  return new Map(ensureArray(capsules).map(capsule => [normalizeUrl(capsule.url), capsule]));
}

function capsulesForCandidates(candidates, capsules = []) {
  const byUrl = capsuleMap(capsules);
  return ensureArray(candidates).map(candidate => {
    const key = normalizeUrl(candidateUrl(candidate));
    return byUrl.get(key) || buildArticleCapsule(candidate);
  });
}

function buildArticleCapsuleReport(date, shortlistReport, reporterInput = null) {
  const shortlistedCandidates = ensureArray(reporterInput?.candidates).length > 0
    ? ensureArray(reporterInput.candidates)
    : ensureArray(shortlistReport?.shortlisted_candidates);
  const shortlistedCapsules = shortlistedCandidates.map(buildArticleCapsule);
  const selectedCapsules = capsulesForCandidates(
    ensureArray(shortlistReport?.selected_articles),
    shortlistedCapsules
  );
  const reserveCapsules = capsulesForCandidates(
    ensureArray(shortlistReport?.reserve_candidates),
    shortlistedCapsules
  );
  return {
    schema_version: 2,
    date,
    generated_at: new Date().toISOString(),
    capsule_token_target: CAPSULE_TOKEN_TARGET,
    shortlisted_capsule_count: shortlistedCapsules.length,
    selected_capsule_count: selectedCapsules.length,
    reserve_capsule_count: reserveCapsules.length,
    shortlisted_capsules: shortlistedCapsules,
    selected_capsules: selectedCapsules,
    reserve_capsules: reserveCapsules
  };
}

function capsuleInputFromReport(report, type = 'shortlisted') {
  const candidates = type === 'selected'
    ? ensureArray(report?.selected_capsules)
    : type === 'reserve'
      ? ensureArray(report?.reserve_capsules)
      : ensureArray(report?.shortlisted_capsules);
  return {
    date: report?.date || '',
    capsule_token_target: report?.capsule_token_target || CAPSULE_TOKEN_TARGET,
    candidates
  };
}

function capsuleInputForCandidates(date, candidates, report = null) {
  const capsules = [
    ...ensureArray(report?.shortlisted_capsules),
    ...ensureArray(report?.selected_capsules),
    ...ensureArray(report?.reserve_capsules)
  ];
  return {
    date,
    capsule_token_target: report?.capsule_token_target || CAPSULE_TOKEN_TARGET,
    candidates: capsulesForCandidates(candidates, capsules)
  };
}

function compactSelectionContext(shortlistReport) {
  return {
    date: shortlistReport?.date || '',
    input_candidate_count: shortlistReport?.input_candidate_count ?? null,
    eligible_candidate_count: shortlistReport?.eligible_candidate_count ?? null,
    selected_article_count: shortlistReport?.selected_article_count ?? null,
    deterministic_selected_count: shortlistReport?.deterministic_selected_count ?? shortlistReport?.selected_article_count ?? null,
    primary_selected_article_count: shortlistReport?.primary_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    reserve_candidate_count: shortlistReport?.reserve_candidate_count ?? null,
    shortlist_cap: shortlistReport?.shortlist_cap ?? null,
    underfilled: Boolean(shortlistReport?.underfilled),
    publish_ready: shortlistReport?.publish_ready !== undefined ? Boolean(shortlistReport.publish_ready) : null,
    selection_policy: shortlistReport?.selection_policy || {},
    selection_warnings: ensureArray(shortlistReport?.selection_warnings),
    selection_errors: ensureArray(shortlistReport?.selection_errors),
    selected_articles: ensureArray(shortlistReport?.selected_articles).map(candidate => ({
      title: compactText(candidate.title, 180),
      url: candidateUrl(candidate),
      deterministic_score: number(candidate.deterministic_score),
      selection_slot: text(candidate.selection_slot),
      editorial_priority: number(candidate.editorial_priority, 6),
      relevance_bucket: text(candidate.relevance_bucket)
    })),
    primary_selected_articles: ensureArray(shortlistReport?.primary_selected_articles).map(candidate => ({
      title: compactText(candidate.title, 180),
      url: candidateUrl(candidate),
      deterministic_score: number(candidate.deterministic_score),
      selection_slot: text(candidate.selection_slot),
      editorial_priority: number(candidate.editorial_priority, 6),
      relevance_bucket: text(candidate.relevance_bucket)
    })),
    reserve_candidates: ensureArray(shortlistReport?.reserve_candidates).map(candidate => ({
      title: compactText(candidate.title, 180),
      url: candidateUrl(candidate),
      deterministic_score: number(candidate.deterministic_score),
      selection_slot: text(candidate.selection_slot),
      editorial_priority: number(candidate.editorial_priority, 6),
      relevance_bucket: text(candidate.relevance_bucket)
    })),
    selected_relevance_bucket_summary: ensureArray(shortlistReport?.selected_relevance_bucket_summary),
    reserve_relevance_bucket_summary: ensureArray(shortlistReport?.reserve_relevance_bucket_summary),
    exclusion_reason_summary: ensureArray(shortlistReport?.exclusion_reason_summary).slice(0, 10)
  };
}

module.exports = {
  CAPSULE_TOKEN_TARGET,
  buildArticleCapsule,
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext,
  estimatedTokens
};
