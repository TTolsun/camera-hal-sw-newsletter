const { ensureArray } = require('../../core/common/value-coercion');
const fs = require('fs');
const path = require('path');

const {
  articleIdentityKey,
  contentHash,
  sourceUrl
} = require('../../core/common/article-identity');
const {
  articlePolicy,
  getHeadlinePolicy
} = require('../../core/common/newsletter-policy');
const { isPlaylistCollectionUrl } = require('./playlist-url');

const HEADLINE_STATE_REL_PATH = path.join('data', 'homepage-headline.json');
const SCHEMA_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const DECISION_REASONS = Object.freeze({
  // 단순 규칙: 소스 날짜가 가장 최신인 Camera HAL 연관 기사를 헤드라인으로.
  LATEST_CAMERA_HAL_ARTICLE: 'latest_camera_hal_article',
  RETAINED_CURRENT_NEWER: 'retained_current_newer',
  RETAINED_NO_ELIGIBLE_CANDIDATE: 'retained_no_eligible_candidate',
  NO_ELIGIBLE_CANDIDATE: 'no_eligible_candidate'
});
const HEADLINE_STATE_REMEDIATION = 'Run newsletter generation to refresh or clear homepage headline state.';
const HEADLINE_POLICY_SNAPSHOT_REMEDIATION = 'Re-run generation or update data/homepage-headline.json policy snapshot.';
const REMOVED_DUE_TO_HEADLINE_INCLUSION_REASON = 'max_article_count_after_headline_injection';

function text(value) {
  return String(value || '').trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function todayKstDate() {
  return kstDateKey(new Date());
}

function kstDateKey(value) {
  if (!value) return todayKstDate();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return todayKstDate();
    return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return todayKstDate();
  return new Date(parsed.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function kstDayMs(value) {
  const date = kstDateKey(value);
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function computeKstAgeDays(selectedAt, now = todayKstDate()) {
  const start = kstDayMs(selectedAt);
  const end = kstDayMs(now);
  if (start === null || end === null) return 0;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function statePath(root = process.cwd()) {
  return path.join(root, HEADLINE_STATE_REL_PATH);
}

function policySnapshot(policy = getHeadlinePolicy()) {
  return {
    decay_model: policy.decayModel,
    decay_rate_per_day: policy.decayRatePerDay,
    replacement_margin: policy.replacementMargin,
    minimum_headline_score: policy.minimumHeadlineScore
  };
}

function emptyHeadlineState({ date = todayKstDate(), policy = getHeadlinePolicy() } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    updated_at: `${date}T00:00:00+09:00`,
    current_headline: null,
    headline_history: [],
    policy: policySnapshot(policy)
  };
}

function stableFallbackScore(candidate = {}) {
  const hash = contentHash(candidate);
  const bucket = Number.parseInt(hash.slice(0, 6), 16);
  return 45 + (bucket % 16);
}

function candidateBody(candidate = {}) {
  return [
    candidate.title,
    candidate.summary,
    candidate.category,
    candidate.source,
    candidate.source_name,
    candidate.relevance_bucket,
    candidate.api_or_component,
    candidate.behavior_change
  ].map(text).join(' ');
}

function isOfficialSource(candidate = {}) {
  const reliability = text(candidate.reliability || candidate.source_reliability).toLowerCase();
  const source = text(candidate.source || candidate.source_name || candidate.snapshot?.source_name).toLowerCase();
  return reliability === 'official' ||
    reliability === 'project-official' ||
    /android|aosp|source\.android\.com|developer\.android\.com|kernel\.org|libcamera/i.test(source);
}

function isGenericTopic(candidate = {}) {
  return text(candidate.relevance_bucket || candidate.category) === 'generic_tech_watchlist' ||
    candidate.generic_tech_watchlist === true;
}

function isFallbackTopic(candidate = {}) {
  return text(candidate.relevance_bucket || candidate.category) === 'cpp_ai_tooling_fallback' ||
    candidate.fallback_only === true ||
    candidate.fallback_topic === true;
}

// "Camera HAL 연관" = 직접 카메라 스택 버킷 + 카메라 출력(멀티미디어). soc/AI/generic은 제외.
const CAMERA_HAL_HEADLINE_BUCKETS = new Set([
  ...ensureArray(articlePolicy.primaryCameraStack?.buckets),
  'android_multimedia_camera_output'
]);

function isCameraHalRelatedHeadline(candidate = {}) {
  // 후보(top-level relevance_bucket)와 저장된 헤드라인 스냅샷(snapshot.category) 둘 다 본다.
  return CAMERA_HAL_HEADLINE_BUCKETS.has(
    text(candidate.relevance_bucket || candidate.category || candidate.snapshot?.category)
  );
}

// 비교용 소스 날짜(타임스탬프). 파싱 불가하면 NaN -> 헤드라인 후보에서 제외.
function headlineSourceTimestamp(candidate = {}) {
  const date = candidateDateEvidence(candidate).date;
  if (!date) return NaN;
  return Date.parse(date);
}

// 헤드라인이 될 수 있는 유효한 기사: 소스 URL 있음, 재생목록 아님, Camera HAL 연관,
// 비교 가능한 소스 날짜 있음, blocked source 아님.
function isEligibleHeadlineArticle(candidate = {}) {
  const url = sourceUrl(candidate);
  if (!url) return false;
  if (isPlaylistCollectionUrl(url)) return false;
  if (!isCameraHalRelatedHeadline(candidate)) return false;
  if (Number.isNaN(headlineSourceTimestamp(candidate))) return false;
  if (candidateQualityFlags(candidate).blocked_source === true) return false;
  return true;
}

function computeHeadlineScore(candidate = {}, policy = getHeadlinePolicy()) {
  const baseScore = number(
    candidate.headline_score ??
    candidate.deterministic_score ??
    candidate.score_breakdown?.total ??
    candidate.score ??
    candidate.relevance_score,
    stableFallbackScore(candidate)
  );
  const officialSourceBonus = isOfficialSource(candidate) ? 8 : 0;
  const cameraBucketBonus = articlePolicy.primaryCameraStack.buckets.includes(text(candidate.relevance_bucket))
    ? 6
    : 0;
  const driverOrSoCBonus = ['camera_driver_image_pipeline', 'android_multimedia_camera_output', 'soc_platform_signal']
    .includes(text(candidate.relevance_bucket))
    ? 3
    : 0;
  const fallbackPenalty = isFallbackTopic(candidate) ? 10 : 0;
  const genericPenalty = isGenericTopic(candidate) ? 30 : 0;
  const sourceGapPenalty = candidate.source_gap_risk === true ? 40 : 0;
  const watchPenalty = candidate.isWatchPage === true || candidate.is_watch_page === true ? 8 : 0;
  const total = clamp(
    Math.round(baseScore + officialSourceBonus + cameraBucketBonus + driverOrSoCBonus - fallbackPenalty - genericPenalty - sourceGapPenalty - watchPenalty),
    0,
    100
  );
  return {
    headline_score: total,
    score_breakdown: {
      base_score: baseScore,
      official_source_bonus: officialSourceBonus,
      camera_bucket_bonus: cameraBucketBonus,
      driver_or_soc_bonus: driverOrSoCBonus,
      fallback_penalty: fallbackPenalty,
      generic_topic_penalty: genericPenalty,
      source_gap_penalty: sourceGapPenalty,
      watch_page_penalty: watchPenalty,
      minimum_headline_score: policy.minimumHeadlineScore,
      total
    }
  };
}

function candidateDateEvidence(candidate = {}) {
  const existing = candidate.date_evidence && typeof candidate.date_evidence === 'object'
    ? candidate.date_evidence
    : {};
  const date = text(
    existing.date ||
    candidate.published_date ||
    candidate.effective_date ||
    candidate.publishedAt ||
    candidate.published_at ||
    candidate.source_extraction?.release?.date
  );
  const publishReady = existing.publish_ready_date_evidence === true ||
    candidate.publish_ready_date_evidence === true ||
    candidate.hasDatedEvidence === true ||
    candidate.has_dated_evidence === true;
  return {
    date,
    date_field: text(existing.date_field || (candidate.effective_date ? 'effective_date' : 'published_date')),
    // publish_ready_date_evidence 가 실제 게이트이므로 evidence_level 디폴트는 빈 문자열로 유지.
    evidence_level: text(existing.evidence_level || candidate.decision?.evidenceLevel || candidate.evidenceLevel || candidate.evidence_level || ''),
    publish_ready_date_evidence: Boolean(date && publishReady)
  };
}

function candidateQualityFlags(candidate = {}) {
  const existing = candidate.quality_flags && typeof candidate.quality_flags === 'object'
    ? candidate.quality_flags
    : {};
  return {
    source_gap_risk: existing.source_gap_risk === true || candidate.source_gap_risk === true,
    fact_check_must_fix_unresolved: existing.fact_check_must_fix_unresolved === true ||
      candidate.fact_check_must_fix_unresolved === true ||
      candidate.fact_check_status === 'NEEDS_FIX' ||
      number(candidate.must_fix_count) > 0,
    stale_claim_hard_failure: existing.stale_claim_hard_failure === true ||
      candidate.stale_claim_hard_failure === true ||
      number(candidate.stale_claim_hard_failure_count) > 0,
    blocked_source: existing.blocked_source === true ||
      candidate.blocked_source === true ||
      text(candidate.source_quality_status).toLowerCase() === 'blocked'
  };
}

function headlineEligibilityRejection(candidate = {}, { policy = getHeadlinePolicy(), runtimeScore = null } = {}) {
  const source = sourceUrl(candidate);
  if (!source) return 'missing_source_url';
  if (isPlaylistCollectionUrl(source)) return 'playlist_collection_url';
  const key = articleIdentityKey(candidate);
  if (!key) return 'missing_article_identity_key';
  const dateEvidence = candidateDateEvidence(candidate);
  if (dateEvidence.publish_ready_date_evidence !== true) return 'missing_dated_evidence';
  const qualityFlags = candidateQualityFlags(candidate);
  if (qualityFlags.blocked_source === true) return 'blocked_source';
  if (qualityFlags.source_gap_risk === true) return 'source_gap_risk';
  if (qualityFlags.fact_check_must_fix_unresolved === true) return 'fact_check_must_fix_unresolved';
  if (qualityFlags.stale_claim_hard_failure === true) return 'stale_claim_hard_failure';
  if (candidate.reference_only === true) return 'reference_only';
  if (candidate.fallback_only === true) return 'fallback_only';
  if (isGenericTopic(candidate)) return 'generic_tech_watchlist';
  if (text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility) &&
    !['main', 'short'].includes(text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility))) {
    return 'final_selection_eligibility_not_main';
  }
  if (candidate.main_eligible === false) return 'main_eligible_false';
  if (candidate.main_article_score_eligible === false) return 'main_article_score_ineligible';
  if (ensureArray(candidate.score_filter_reasons).length > 0) return 'score_filter_reasons_present';
  const score = runtimeScore === null ? computeHeadlineScore(candidate, policy).headline_score : runtimeScore;
  if (score < policy.minimumHeadlineScore) return 'headline_score_below_minimum';
  return '';
}

function isHeadlineEligible(candidate = {}, options = {}) {
  return headlineEligibilityRejection(candidate, options) === '';
}

function decayHeadlineScore(baseScore, selectedAt, scoredAt, policy = getHeadlinePolicy()) {
  const ageDays = computeKstAgeDays(selectedAt, scoredAt);
  if (policy.decayModel !== 'linear') return number(baseScore);
  return Math.max(0, number(baseScore) - ageDays * number(policy.decayRatePerDay));
}

function normalizeHeadlineImageUrl(imageUrl, newsletterUrl) {
  const raw = String(imageUrl || '').trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  const nlUrl = String(newsletterUrl || '').replace(/\\/g, '/');
  if (!nlUrl) {
    return raw.replace(/^(?:\.\.\/)+/, '');
  }
  if (!/^\.\.?\//.test(raw)) return raw;
  const dir = path.posix.dirname(nlUrl);
  const resolved = path.posix.normalize(path.posix.join(dir, raw));
  if (resolved.startsWith('../')) {
    return raw.replace(/^(?:\.\.\/)+/, '');
  }
  return resolved;
}

function headlineSnapshotFromCandidate(candidate = {}, {
  date = todayKstDate(),
  newsletterUrl = '',
  policy = getHeadlinePolicy(),
  scoredAt = date
} = {}) {
  const score = computeHeadlineScore(candidate, policy);
  const articleKey = articleIdentityKey(candidate);
  const newsletterArticleUrl = text(candidate.newsletter_article_url || candidate.newsletterArticleUrl);
  const newsletterUrlForImage = text(candidate.newsletter_url || newsletterUrl);
  const imageUrl = normalizeHeadlineImageUrl(
    text(candidate.image_url || candidate.imageUrl || candidate.selectedImage || candidate.selected_image),
    newsletterUrlForImage
  );
  const imageAlt = text(candidate.image_alt || candidate.imageAlt || candidate.imageAltText);
  const snapshot = {
    article_identity_key: articleKey,
    title: text(candidate.title),
    summary: text(candidate.summary || candidate.description || candidate.reason),
    source_url: sourceUrl(candidate),
    newsletter_date: text(candidate.newsletter_date || date),
    newsletter_url: text(candidate.newsletter_url || newsletterUrl),
    selected_at: text(candidate.selected_at || date),
    base_score: score.headline_score,
    current_score: decayHeadlineScore(score.headline_score, candidate.selected_at || date, scoredAt, policy),
    last_scored_at: kstDateKey(scoredAt),
    date_evidence: candidateDateEvidence(candidate),
    quality_flags: candidateQualityFlags(candidate),
    score_breakdown: score.score_breakdown,
    snapshot: {
      category: text(candidate.relevance_bucket || candidate.category || candidate.snapshot?.category),
      source_name: text(candidate.source || candidate.source_name || candidate.snapshot?.source_name)
    }
  };
  if (newsletterArticleUrl) snapshot.newsletter_article_url = newsletterArticleUrl;
  if (imageUrl) snapshot.image_url = imageUrl;
  if (imageAlt) snapshot.image_alt = imageAlt;
  return snapshot;
}

function validateCurrentHeadline(headline, { policy = getHeadlinePolicy(), scoredAt = todayKstDate() } = {}) {
  if (headline === null) return { ok: true, reason: 'current_headline_null' };
  if (!headline || typeof headline !== 'object' || Array.isArray(headline)) {
    return { ok: false, reason: 'current_headline_not_object' };
  }
  const runtimeScore = decayHeadlineScore(headline.base_score, headline.selected_at, scoredAt, policy);
  const reason = headlineEligibilityRejection(headline, { policy, runtimeScore });
  return {
    ok: !reason,
    reason,
    runtime_decayed_score: runtimeScore,
    previous_stored_current_score: number(headline.current_score, null),
    last_scored_at: text(headline.last_scored_at),
    scored_at: kstDateKey(scoredAt)
  };
}

function validateHomepageHeadlineState(state, { policy = getHeadlinePolicy(), strict = true, scoredAt = todayKstDate() } = {}) {
  const errors = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, errors: ['homepage headline state must be an object'] };
  }
  if (Number(state.schemaVersion) !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (!text(state.updated_at)) errors.push('updated_at is required');
  if (!Array.isArray(state.headline_history)) errors.push('headline_history must be an array');
  if (state.current_headline !== null) {
    const validation = validateCurrentHeadline(state.current_headline, { policy, scoredAt });
    if (!validation.ok) {
      errors.push(`current_headline failed validation: ${validation.reason}. ${HEADLINE_STATE_REMEDIATION}`);
    }
    for (const field of ['article_identity_key', 'title', 'summary', 'source_url', 'newsletter_date', 'newsletter_url', 'selected_at', 'base_score', 'current_score', 'last_scored_at']) {
      if (state.current_headline[field] === undefined || state.current_headline[field] === null || state.current_headline[field] === '') {
        errors.push(`current_headline.${field} is required`);
      }
    }
    if (!state.current_headline.date_evidence || typeof state.current_headline.date_evidence !== 'object') {
      errors.push('current_headline.date_evidence is required');
    }
    if (!state.current_headline.quality_flags || typeof state.current_headline.quality_flags !== 'object') {
      errors.push('current_headline.quality_flags is required');
    }
    if (!state.current_headline.score_breakdown || typeof state.current_headline.score_breakdown !== 'object') {
      errors.push('current_headline.score_breakdown is required');
    }
    if (!state.current_headline.snapshot || typeof state.current_headline.snapshot !== 'object') {
      errors.push('current_headline.snapshot is required');
    }
  }
  if (strict && state.policy && typeof state.policy === 'object') {
    const snapshot = policySnapshot(policy);
    for (const [key, value] of Object.entries(snapshot)) {
      if (state.policy[key] !== value) {
        errors.push(`policy.${key} must match newsletter policy (${value}). ${HEADLINE_POLICY_SNAPSHOT_REMEDIATION}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function readHomepageHeadlineState(root = process.cwd(), options = {}) {
  const filePath = statePath(root);
  if (!fs.existsSync(filePath)) return emptyHeadlineState(options);
  const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return state && typeof state === 'object'
    ? state
    : emptyHeadlineState(options);
}

function writeHomepageHeadlineState(root = process.cwd(), state) {
  const filePath = statePath(root);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return filePath;
}

function updatedState({ date, currentHeadline, previousHeadline, decision, policy }) {
  const history = previousHeadline && previousHeadline.article_identity_key !== currentHeadline?.article_identity_key
    ? [{
        ...previousHeadline,
        replaced_at: date,
        replacement_reason: decision.reason
      }]
    : [];
  const existingHistory = ensureArray(decision.previous_state?.headline_history);
  return {
    schemaVersion: SCHEMA_VERSION,
    updated_at: `${date}T00:00:00+09:00`,
    current_headline: currentHeadline,
    headline_history: [...history, ...existingHistory].slice(0, policy.historyMaxEntries),
    policy: policySnapshot(policy)
  };
}

function buildDecision(base) {
  return {
    decision: base.reason,
    reason: base.reason,
    current_headline_key: base.current_headline_key || null,
    replacement_headline_key: base.replacement_headline_key || null,
    previous_stored_current_score: base.previous_stored_current_score ?? null,
    runtime_decayed_score: base.runtime_decayed_score ?? null,
    last_scored_at: base.last_scored_at || null,
    scored_at: base.scored_at || null,
    retained: Boolean(base.retained),
    replaced: Boolean(base.replaced),
    cleared: Boolean(base.cleared),
    seeded: Boolean(base.seeded),
    injected: Boolean(base.injected),
    snapshot_revalidated: Boolean(base.snapshot_revalidated),
    revalidation_failure_reason: base.revalidation_failure_reason || '',
    selected_normally: Boolean(base.selected_normally),
    latest_inclusion_required: Boolean(base.latest_inclusion_required),
    removed_due_to_headline_inclusion_count: Number(base.removed_due_to_headline_inclusion_count || 0)
  };
}

function applyHomepageHeadlineSelection({
  date = todayKstDate(),
  selectedArticles = [],
  eligibleCandidates = [],
  currentState = null,
  policy = getHeadlinePolicy(),
  newsletterUrl = `newsletters/${date}/index.html`
} = {}) {
  const previousState = currentState || emptyHeadlineState({ date, policy });
  const current = previousState.current_headline || null;
  // inclusion 제거: 헤드라인은 이슈에 강제 삽입하지 않으므로 selected는 입력 그대로 둔다.
  const selected = ensureArray(selectedArticles).map(article => ({ ...article, article_identity_key: articleIdentityKey(article) }));

  // 이번 이슈의 Camera HAL 연관 + 유효한 기사 + (유효하면) 현재 헤드라인을 비교 풀로.
  const issueCandidates = ensureArray(selectedArticles).filter(isEligibleHeadlineArticle);
  const currentEligible = current && isEligibleHeadlineArticle(current) ? current : null;
  const rankPool = currentEligible ? [...issueCandidates, currentEligible] : issueCandidates;

  // 소스 날짜가 가장 최신인 기사를 선택. 동률이면 먼저 온 것(이슈 후보 우선) 유지.
  let chosen = null;
  for (const candidate of rankPool) {
    if (!chosen || headlineSourceTimestamp(candidate) > headlineSourceTimestamp(chosen)) {
      chosen = candidate;
    }
  }

  let headline;
  let reason;
  if (!chosen) {
    // 이번 이슈에 Camera HAL 기사 없음 + current 무효 → current 유지(있으면) 또는 빈 상태.
    headline = current || null;
    reason = current ? DECISION_REASONS.RETAINED_NO_ELIGIBLE_CANDIDATE : DECISION_REASONS.NO_ELIGIBLE_CANDIDATE;
  } else if (chosen === currentEligible) {
    // 현재 헤드라인이 이번 이슈 후보보다 최신(또는 이슈에 후보 없음) → 그대로 유지(주입 없음).
    headline = current;
    reason = issueCandidates.length === 0
      ? DECISION_REASONS.RETAINED_NO_ELIGIBLE_CANDIDATE
      : DECISION_REASONS.RETAINED_CURRENT_NEWER;
  } else {
    headline = headlineSnapshotFromCandidate(chosen, { date, newsletterUrl, policy, scoredAt: date });
    reason = DECISION_REASONS.LATEST_CAMERA_HAL_ARTICLE;
  }

  const retained = reason === DECISION_REASONS.RETAINED_CURRENT_NEWER ||
    reason === DECISION_REASONS.RETAINED_NO_ELIGIBLE_CANDIDATE;
  const decision = buildDecision({
    reason,
    current_headline_key: current ? current.article_identity_key : null,
    replacement_headline_key: headline ? headline.article_identity_key : null,
    scored_at: date,
    retained,
    replaced: Boolean(headline) && !retained && Boolean(current),
    seeded: Boolean(headline) && !retained && !current,
    snapshot_revalidated: Boolean(headline),
    selected_normally: true
  });
  decision.previous_state = previousState;
  const nextState = updatedState({
    date,
    currentHeadline: headline,
    previousHeadline: current,
    decision,
    policy
  });
  delete decision.previous_state;

  return {
    selected_articles: selected,
    headline_decision: decision,
    homepage_headline_state: nextState,
    headline_latest_inclusion: {
      included: false,
      mode: 'none',
      injected_from_snapshot: false,
      snapshot_revalidated: Boolean(headline),
      removed_due_to_headline_inclusion_count: 0
    },
    removed_due_to_headline_inclusion: []
  };
}

module.exports = {
  DECISION_REASONS,
  HEADLINE_POLICY_SNAPSHOT_REMEDIATION,
  HEADLINE_STATE_REL_PATH,
  HEADLINE_STATE_REMEDIATION,
  REMOVED_DUE_TO_HEADLINE_INCLUSION_REASON,
  applyHomepageHeadlineSelection,
  candidateDateEvidence,
  candidateQualityFlags,
  computeHeadlineScore,
  computeKstAgeDays,
  decayHeadlineScore,
  emptyHeadlineState,
  headlineEligibilityRejection,
  headlineSnapshotFromCandidate,
  isHeadlineEligible,
  normalizeHeadlineImageUrl,
  policySnapshot,
  readHomepageHeadlineState,
  statePath,
  validateCurrentHeadline,
  validateHomepageHeadlineState,
  writeHomepageHeadlineState
};
