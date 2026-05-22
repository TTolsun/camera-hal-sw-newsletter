const fs = require('fs');
const path = require('path');

const {
  articleIdentityKey,
  contentHash,
  sourceUrl
} = require('./article-identity');
const {
  articlePolicy,
  getHeadlinePolicy
} = require('./newsletter-policy');

const HEADLINE_STATE_REL_PATH = path.join('data', 'homepage-headline.json');
const SCHEMA_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const DECISION_REASONS = Object.freeze({
  RETAINED_CURRENT_ABOVE_MARGIN: 'retained_current_above_margin',
  REPLACED_BY_NEW_CANDIDATE: 'replaced_by_new_candidate',
  CLEARED_BELOW_MINIMUM_SCORE: 'cleared_below_minimum_score',
  CLEARED_FAILED_REVALIDATION: 'cleared_failed_revalidation',
  SEEDED_FROM_CURRENT_ISSUE: 'seeded_from_current_issue',
  NO_ELIGIBLE_CANDIDATE: 'no_eligible_candidate'
});
const HEADLINE_STATE_REMEDIATION = 'Run newsletter generation to refresh or clear homepage headline state.';
const HEADLINE_POLICY_SNAPSHOT_REMEDIATION = 'Re-run generation or update data/homepage-headline.json policy snapshot.';
const REMOVED_DUE_TO_HEADLINE_INCLUSION_REASON = 'max_article_count_after_headline_injection';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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
    evidence_level: text(existing.evidence_level || candidate.evidence_level || candidate.evidenceLevel || 'dated_release'),
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

function headlineSnapshotFromCandidate(candidate = {}, {
  date = todayKstDate(),
  newsletterUrl = '',
  policy = getHeadlinePolicy(),
  scoredAt = date
} = {}) {
  const score = computeHeadlineScore(candidate, policy);
  const articleKey = articleIdentityKey(candidate);
  return {
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

function headlineCandidatePool(selectedArticles = [], eligibleCandidates = []) {
  const byKey = new Map();
  for (const candidate of [...ensureArray(selectedArticles), ...ensureArray(eligibleCandidates)]) {
    const key = articleIdentityKey(candidate);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, { ...candidate, article_identity_key: key });
  }
  return [...byKey.values()];
}

function bestHeadlineCandidate(candidates = [], policy = getHeadlinePolicy()) {
  return headlineCandidatePool([], candidates)
    .map(candidate => ({
      candidate,
      score: computeHeadlineScore(candidate, policy).headline_score
    }))
    .filter(item => isHeadlineEligible(item.candidate, { policy, runtimeScore: item.score }))
    .sort((a, b) =>
      b.score - a.score ||
      number(a.candidate.editorial_priority, 99) - number(b.candidate.editorial_priority, 99) ||
      text(a.candidate.title).localeCompare(text(b.candidate.title))
    )[0] || null;
}

function markNormalHeadlineArticle(article, headline) {
  const isHeadline = headline && articleIdentityKey(article) === headline.article_identity_key;
  if (!isHeadline) return article;
  return {
    ...article,
    article_identity_key: headline.article_identity_key,
    included_as_headline_latest: true,
    headline_latest_inclusion_mode: 'selected_normally',
    injected_from_headline_snapshot: false,
    snapshot_revalidated: true
  };
}

function injectedArticleFromHeadline(headline) {
  return {
    title: headline.title,
    summary: headline.summary,
    url: headline.source_url,
    source_url: headline.source_url,
    source: headline.snapshot?.source_name || '',
    newsletter_date: headline.newsletter_date,
    newsletter_url: headline.newsletter_url,
    article_identity_key: headline.article_identity_key,
    relevance_bucket: headline.snapshot?.category || '',
    deterministic_score: headline.current_score,
    headline_score: headline.current_score,
    score_breakdown: headline.score_breakdown || {},
    selected: true,
    selected_for_editor: true,
    final_selected: true,
    primary_selected: true,
    included_as_headline_latest: true,
    headline_latest_inclusion_mode: 'injected_from_headline_snapshot',
    injected_from_headline_snapshot: true,
    snapshot_revalidated: true,
    selection_slot: 'homepage-headline-retained',
    selection_stage: 'deterministic-primary',
    date_evidence: headline.date_evidence,
    quality_flags: headline.quality_flags
  };
}

function applyHeadlineInclusion(selected, headline, policy) {
  const marked = ensureArray(selected).map(article => markNormalHeadlineArticle(article, headline));
  const selectedNormally = marked.some(article => article.headline_latest_inclusion_mode === 'selected_normally');
  let injected = false;
  if (policy.latestInclusionRequired && !selectedNormally) {
    marked.push(injectedArticleFromHeadline(headline));
    injected = true;
  }
  return { selected: marked, selectedNormally, injected };
}

function removedDueToHeadlineInclusionRecord(article) {
  return {
    article_identity_key: articleIdentityKey(article),
    title: text(article.title),
    source_url: text(sourceUrl(article) || article.source_url || article.url),
    deterministic_score: number(article.deterministic_score ?? article.headline_score, null),
    editorial_priority: number(article.editorial_priority, null),
    reason: REMOVED_DUE_TO_HEADLINE_INCLUSION_REASON
  };
}

function collapseAndLimitSelected(articles, maxArticles = articlePolicy.mainArticleCount.max) {
  const byKey = new Map();
  for (const article of ensureArray(articles)) {
    const key = articleIdentityKey(article);
    if (!byKey.has(key)) {
      byKey.set(key, { ...article, article_identity_key: key });
      continue;
    }
    const existing = byKey.get(key);
    byKey.set(key, {
      ...existing,
      ...article,
      included_as_headline_latest: existing.included_as_headline_latest || article.included_as_headline_latest,
      injected_from_headline_snapshot: existing.injected_from_headline_snapshot || article.injected_from_headline_snapshot,
      snapshot_revalidated: existing.snapshot_revalidated || article.snapshot_revalidated
    });
  }
  const out = [...byKey.values()];
  if (out.length <= maxArticles) {
    return {
      selected: out,
      removed_due_to_headline_inclusion: []
    };
  }
  const overflow = out.length - maxArticles;
  const dropCandidates = out
    .filter(item => item.injected_from_headline_snapshot !== true)
    .sort((a, b) =>
      number(b.editorial_priority, 99) - number(a.editorial_priority, 99) ||
      number(a.deterministic_score ?? a.headline_score) - number(b.deterministic_score ?? b.headline_score) ||
      text(b.title).localeCompare(text(a.title))
    )
    .slice(0, overflow);
  const dropKeys = dropCandidates.map(articleIdentityKey);
  const dropSet = new Set(dropKeys);
  return {
    selected: out.filter(item => !dropSet.has(articleIdentityKey(item))).slice(0, maxArticles),
    removed_due_to_headline_inclusion: dropCandidates.map(removedDueToHeadlineInclusionRecord)
  };
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
  const pool = headlineCandidatePool(selectedArticles, eligibleCandidates);
  const best = bestHeadlineCandidate(pool, policy);
  const existingValidation = current
    ? validateCurrentHeadline(current, { policy, scoredAt: date })
    : { ok: true, reason: 'current_headline_null' };
  let headline = null;
  let selected = ensureArray(selectedArticles).map(article => ({ ...article, article_identity_key: articleIdentityKey(article) }));
  let decision;

  if (!current) {
    if (best) {
      headline = headlineSnapshotFromCandidate(best.candidate, { date, newsletterUrl, policy, scoredAt: date });
      const inclusion = applyHeadlineInclusion(selected, headline, policy);
      selected = inclusion.selected;
      decision = buildDecision({
        reason: DECISION_REASONS.SEEDED_FROM_CURRENT_ISSUE,
        replacement_headline_key: headline.article_identity_key,
        previous_stored_current_score: null,
        runtime_decayed_score: headline.current_score,
        last_scored_at: null,
        scored_at: date,
        seeded: true,
        injected: inclusion.injected,
        snapshot_revalidated: true,
        selected_normally: inclusion.selectedNormally,
        latest_inclusion_required: policy.latestInclusionRequired
      });
    } else {
      decision = buildDecision({
        reason: DECISION_REASONS.NO_ELIGIBLE_CANDIDATE,
        scored_at: date,
        latest_inclusion_required: policy.latestInclusionRequired
      });
    }
  } else if (!existingValidation.ok) {
    if (best) {
      headline = headlineSnapshotFromCandidate(best.candidate, { date, newsletterUrl, policy, scoredAt: date });
      const inclusion = applyHeadlineInclusion(selected, headline, policy);
      selected = inclusion.selected;
      decision = buildDecision({
        reason: DECISION_REASONS.REPLACED_BY_NEW_CANDIDATE,
        current_headline_key: current.article_identity_key,
        replacement_headline_key: headline.article_identity_key,
        previous_stored_current_score: existingValidation.previous_stored_current_score,
        runtime_decayed_score: existingValidation.runtime_decayed_score,
        last_scored_at: existingValidation.last_scored_at,
        scored_at: date,
        replaced: true,
        injected: inclusion.injected,
        snapshot_revalidated: false,
        revalidation_failure_reason: existingValidation.reason,
        selected_normally: inclusion.selectedNormally,
        latest_inclusion_required: policy.latestInclusionRequired
      });
    } else {
      decision = buildDecision({
        reason: DECISION_REASONS.CLEARED_FAILED_REVALIDATION,
        current_headline_key: current.article_identity_key,
        previous_stored_current_score: existingValidation.previous_stored_current_score,
        runtime_decayed_score: existingValidation.runtime_decayed_score,
        last_scored_at: existingValidation.last_scored_at,
        scored_at: date,
        cleared: true,
        revalidation_failure_reason: existingValidation.reason,
        latest_inclusion_required: policy.latestInclusionRequired
      });
    }
  } else if (existingValidation.runtime_decayed_score < policy.minimumHeadlineScore) {
    if (best) {
      headline = headlineSnapshotFromCandidate(best.candidate, { date, newsletterUrl, policy, scoredAt: date });
      const inclusion = applyHeadlineInclusion(selected, headline, policy);
      selected = inclusion.selected;
      decision = buildDecision({
        reason: DECISION_REASONS.REPLACED_BY_NEW_CANDIDATE,
        current_headline_key: current.article_identity_key,
        replacement_headline_key: headline.article_identity_key,
        previous_stored_current_score: existingValidation.previous_stored_current_score,
        runtime_decayed_score: existingValidation.runtime_decayed_score,
        last_scored_at: existingValidation.last_scored_at,
        scored_at: date,
        replaced: true,
        injected: inclusion.injected,
        snapshot_revalidated: true,
        selected_normally: inclusion.selectedNormally,
        latest_inclusion_required: policy.latestInclusionRequired
      });
    } else {
      decision = buildDecision({
        reason: DECISION_REASONS.CLEARED_BELOW_MINIMUM_SCORE,
        current_headline_key: current.article_identity_key,
        previous_stored_current_score: existingValidation.previous_stored_current_score,
        runtime_decayed_score: existingValidation.runtime_decayed_score,
        last_scored_at: existingValidation.last_scored_at,
        scored_at: date,
        cleared: true,
        snapshot_revalidated: true,
        latest_inclusion_required: policy.latestInclusionRequired
      });
    }
  } else {
    const bestScore = best ? best.score : -1;
    if (best && bestScore >= existingValidation.runtime_decayed_score + policy.replacementMargin) {
      headline = headlineSnapshotFromCandidate(best.candidate, { date, newsletterUrl, policy, scoredAt: date });
      const inclusion = applyHeadlineInclusion(selected, headline, policy);
      selected = inclusion.selected;
      decision = buildDecision({
        reason: DECISION_REASONS.REPLACED_BY_NEW_CANDIDATE,
        current_headline_key: current.article_identity_key,
        replacement_headline_key: headline.article_identity_key,
        previous_stored_current_score: existingValidation.previous_stored_current_score,
        runtime_decayed_score: existingValidation.runtime_decayed_score,
        last_scored_at: existingValidation.last_scored_at,
        scored_at: date,
        replaced: true,
        injected: inclusion.injected,
        snapshot_revalidated: true,
        selected_normally: inclusion.selectedNormally,
        latest_inclusion_required: policy.latestInclusionRequired
      });
    } else {
      headline = {
        ...current,
        current_score: existingValidation.runtime_decayed_score,
        last_scored_at: date
      };
      selected = selected.map(article => markNormalHeadlineArticle(article, headline));
      const selectedNormally = selected.some(article => article.headline_latest_inclusion_mode === 'selected_normally');
      let injected = false;
      if (policy.latestInclusionRequired && !selectedNormally) {
        selected.push(injectedArticleFromHeadline(headline));
        injected = true;
      }
      decision = buildDecision({
        reason: DECISION_REASONS.RETAINED_CURRENT_ABOVE_MARGIN,
        current_headline_key: current.article_identity_key,
        previous_stored_current_score: existingValidation.previous_stored_current_score,
        runtime_decayed_score: existingValidation.runtime_decayed_score,
        last_scored_at: existingValidation.last_scored_at,
        scored_at: date,
        retained: true,
        injected,
        snapshot_revalidated: true,
        selected_normally: selectedNormally,
        latest_inclusion_required: policy.latestInclusionRequired
      });
    }
  }

  const collapseResult = collapseAndLimitSelected(selected, articlePolicy.mainArticleCount.max);
  selected = collapseResult.selected;
  const removedDueToHeadlineInclusion = collapseResult.removed_due_to_headline_inclusion;
  decision.removed_due_to_headline_inclusion_count = removedDueToHeadlineInclusion.length;
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
      included: selected.some(article => article.included_as_headline_latest === true),
      mode: selected.find(article => article.included_as_headline_latest === true)?.headline_latest_inclusion_mode || 'none',
      injected_from_snapshot: selected.some(article => article.injected_from_headline_snapshot === true),
      snapshot_revalidated: selected.some(article => article.snapshot_revalidated === true),
      removed_due_to_headline_inclusion_count: removedDueToHeadlineInclusion.length
    },
    removed_due_to_headline_inclusion: removedDueToHeadlineInclusion
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
  policySnapshot,
  readHomepageHeadlineState,
  statePath,
  validateCurrentHeadline,
  validateHomepageHeadlineState,
  writeHomepageHeadlineState
};
