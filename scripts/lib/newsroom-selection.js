const crypto = require('crypto');

const SHORTLIST_CAP = 12;
const MIN_FINAL_ARTICLES = 4;
const MAX_FINAL_ARTICLES = 5;

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

function normalizedUrlHash(value) {
  return crypto.createHash('sha256').update(normalizeUrl(value)).digest('hex');
}

function normalizeTitle(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&[#a-z0-9]+;/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const left = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const right = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  const overlap = [...left].filter(token => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function publishedDate(candidate) {
  return text(candidate.published_date || candidate.publishedAt || candidate.published_at);
}

function candidateUrl(candidate) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl);
}

function candidateSource(candidate) {
  return text(candidate.source || candidate.source_name);
}

function fieldBoolean(candidate, camel, snake, fallback = false) {
  if (typeof candidate[camel] === 'boolean') return candidate[camel];
  if (typeof candidate[snake] === 'boolean') return candidate[snake];
  return fallback;
}

function finalSelectionEligibility(candidate) {
  return text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
}

function exclusionReasons(candidate) {
  const reasons = [];
  const eligibility = finalSelectionEligibility(candidate);
  const isWatchPage = fieldBoolean(candidate, 'isWatchPage', 'is_watch_page');
  const hasDatedEvidence = fieldBoolean(candidate, 'hasDatedEvidence', 'has_dated_evidence');
  const sourceGapRisk = bool(candidate.source_gap_risk);
  const mainEligible = candidate.main_eligible !== false;
  const briefingOnly = bool(candidate.briefing_only);
  const referenceOnly = bool(candidate.reference_only);

  if (!candidateUrl(candidate)) reasons.push('missing URL evidence');
  if (!publishedDate(candidate) || !hasDatedEvidence) reasons.push('missing dated evidence');
  if (isWatchPage && !hasDatedEvidence) reasons.push('watch page without dated evidence');
  if (!['main', 'short'].includes(eligibility)) reasons.push(`finalSelectionEligibility=${eligibility || 'unknown'}`);
  if (sourceGapRisk) reasons.push('source_gap_risk=true');
  if (!mainEligible) reasons.push('main_eligible=false');
  if (briefingOnly) reasons.push('briefing_only=true');
  if (referenceOnly) reasons.push('reference_only=true');
  return [...new Set(reasons)];
}

function reliabilityScore(candidate) {
  const reliability = text(candidate.reliability || candidate.source_reliability).toLowerCase();
  if (reliability === 'official') return 5;
  if (['project-official', 'official-community'].includes(reliability)) return 4;
  if (['expert-media', 'community-doc'].includes(reliability)) return 2;
  if (['community', 'newsletter'].includes(reliability)) return 1;
  return 0;
}

function freshnessScore(candidate, newsletterDate) {
  const rawDate = publishedDate(candidate);
  const published = rawDate ? new Date(rawDate) : null;
  const base = newsletterDate ? new Date(`${newsletterDate}T00:00:00Z`) : new Date();
  if (!published || Number.isNaN(published.getTime()) || Number.isNaN(base.getTime())) return 0;
  const ageDays = Math.max(0, (base.getTime() - published.getTime()) / (24 * 60 * 60 * 1000));
  if (ageDays <= 7) return 3;
  if (ageDays <= 21) return 2;
  if (ageDays <= 45) return 1;
  return 0;
}

function candidateBody(candidate) {
  return [
    candidate.title,
    candidate.summary,
    candidate.category,
    candidate.section,
    candidate.source_category,
    candidate.source_section,
    candidate.version_or_release,
    candidate.api_or_component,
    candidate.behavior_change,
    candidate.reason,
    candidate.collection_reason
  ].map(text).join(' ');
}

function hasAiValue(candidate) {
  const body = candidateBody(candidate);
  return /AI|agent|LLM|Gemini|NPU|GPU|on-device|inference|model|Firebase AI|Copilot|Codex/i.test(body);
}

function hasCameraPlatformValue(candidate) {
  return /Camera HAL|Android Camera|CameraX|AOSP Camera|Camera2|camera|stream|buffer|metadata|request|result|CTS|VTS|Camera ITS|CDD|libcamera|V4L2/i
    .test(candidateBody(candidate));
}

function hasCppFallbackValue(candidate) {
  return /C\+\+|cpp|LLVM|Clang|NDK|native|toolchain|build|test|sanitizer/i.test(candidateBody(candidate));
}

function scoreCandidate(candidate, newsletterDate) {
  const cameraRaw = Math.max(
    number(candidate.camera_hal_relevance_score),
    number(candidate.cameraHalRelevanceScore),
    number(candidate.relevanceScore),
    number(candidate.relevance_score)
  );
  const cameraHal = Math.min(5, Math.round(cameraRaw / 20));
  const androidCamera = hasCameraPlatformValue(candidate) ? 5 : 0;
  const ai = hasAiValue(candidate) ? 3 : 0;
  const cppFallback = hasCppFallbackValue(candidate) ? 2 : 0;
  const evidence = Math.min(5, number(candidate.evidence_score));
  const sourceReliability = reliabilityScore(candidate);
  const freshness = freshnessScore(candidate, newsletterDate);
  const total =
    sourceReliability * 2 +
    freshness +
    cameraHal * 3 +
    androidCamera * 2 +
    ai +
    cppFallback +
    evidence * 2;

  return {
    source_reliability: sourceReliability,
    freshness,
    camera_hal_relevance: cameraHal,
    android_camera_relevance: androidCamera,
    ai_required_slot_fit: ai,
    cpp_fallback_value: cppFallback,
    evidence_quality: evidence,
    total
  };
}

function candidatesAreDuplicate(left, right) {
  const leftUrl = normalizeUrl(candidateUrl(left));
  const rightUrl = normalizeUrl(candidateUrl(right));
  if (leftUrl && rightUrl && leftUrl === rightUrl) return true;
  if (normalizeTitle(left.title) && normalizeTitle(left.title) === normalizeTitle(right.title)) return true;
  if (titleSimilarity(left.title, right.title) >= 0.82) return true;
  const leftSource = normalizeTitle(candidateSource(left));
  const rightSource = normalizeTitle(candidateSource(right));
  return leftSource &&
    leftSource === rightSource &&
    publishedDate(left) &&
    publishedDate(left) === publishedDate(right) &&
    titleSimilarity(left.title, right.title) >= 0.68;
}

function decorateCandidate(candidate, newsletterDate) {
  const score_breakdown = scoreCandidate(candidate, newsletterDate);
  return {
    ...candidate,
    url: candidateUrl(candidate),
    published_date: publishedDate(candidate),
    source: candidateSource(candidate),
    selected: false,
    selected_for_editor: false,
    deterministic_score: score_breakdown.total,
    score_breakdown,
    exclusion_reasons: exclusionReasons(candidate),
    normalized_url: normalizeUrl(candidateUrl(candidate)),
    url_hash: normalizedUrlHash(candidateUrl(candidate)),
    ai_slot_candidate: hasAiValue(candidate),
    camera_platform_candidate: hasCameraPlatformValue(candidate),
    cpp_fallback_candidate: hasCppFallbackValue(candidate)
  };
}

function buildEligibleShortlist(rawCandidates, newsletterDate, cap = SHORTLIST_CAP) {
  const excluded = [];
  const eligible = [];
  for (const candidate of ensureArray(rawCandidates).map(item => decorateCandidate(item, newsletterDate))) {
    if (candidate.exclusion_reasons.length > 0) {
      excluded.push(candidate);
      continue;
    }
    if (eligible.some(existing => candidatesAreDuplicate(existing, candidate))) {
      excluded.push({
        ...candidate,
        exclusion_reasons: ['duplicate URL or near-duplicate title']
      });
      continue;
    }
    eligible.push(candidate);
  }

  eligible.sort((a, b) =>
    b.deterministic_score - a.deterministic_score ||
    b.score_breakdown.camera_hal_relevance - a.score_breakdown.camera_hal_relevance ||
    b.score_breakdown.ai_required_slot_fit - a.score_breakdown.ai_required_slot_fit ||
    normalizeTitle(a.title).localeCompare(normalizeTitle(b.title))
  );

  return {
    shortlist: eligible.slice(0, cap),
    excluded
  };
}

function pushUnique(selected, candidate, slot) {
  if (!candidate) return false;
  if (selected.some(existing => candidatesAreDuplicate(existing, candidate))) return false;
  selected.push({
    ...candidate,
    selected: true,
    selected_for_editor: true,
    selection_slot: slot
  });
  return true;
}

function selectFinalArticles(shortlist, options = {}) {
  const minArticles = options.minArticles || MIN_FINAL_ARTICLES;
  const maxArticles = options.maxArticles || MAX_FINAL_ARTICLES;
  const candidates = ensureArray(shortlist).map(candidate =>
    candidate.score_breakdown ? candidate : decorateCandidate(candidate, options.date || '')
  );
  const selected = [];
  const cameraPool = candidates.filter(candidate => candidate.camera_platform_candidate && !candidate.cpp_fallback_candidate);
  const aiPool = candidates.filter(candidate => candidate.ai_slot_candidate);
  const fallbackPool = candidates.filter(candidate => !candidate.camera_platform_candidate && candidate.cpp_fallback_candidate);
  const remainingPool = candidates.filter(candidate => !cameraPool.includes(candidate) && !fallbackPool.includes(candidate));

  pushUnique(selected, aiPool.find(candidate => candidate.camera_platform_candidate) || aiPool[0], 'ai-required');
  for (const candidate of cameraPool) {
    if (selected.length >= Math.min(maxArticles, 4)) break;
    pushUnique(selected, candidate, 'camera-platform');
  }
  for (const candidate of remainingPool) {
    if (selected.length >= minArticles) break;
    pushUnique(selected, candidate, candidate.ai_slot_candidate ? 'ai-required' : 'platform-adjacent');
  }
  for (const candidate of fallbackPool) {
    if (selected.length >= minArticles) break;
    pushUnique(selected, candidate, 'cpp-fallback');
  }
  for (const candidate of candidates) {
    if (selected.length >= maxArticles) break;
    if (selected.length >= minArticles && !candidate.camera_platform_candidate && !candidate.ai_slot_candidate) continue;
    pushUnique(selected, candidate, candidate.ai_slot_candidate ? 'ai-required' : 'camera-platform');
  }

  return selected.slice(0, maxArticles);
}

function buildShortlistReport(date, collectedCandidates, options = {}) {
  const rawCandidates = ensureArray(collectedCandidates?.candidates || collectedCandidates);
  const cap = options.cap || SHORTLIST_CAP;
  const { shortlist, excluded } = buildEligibleShortlist(rawCandidates, date, cap);
  const selected = selectFinalArticles(shortlist, options);
  const selectedUrls = new Set(selected.map(candidate => candidate.normalized_url));
  const markedShortlist = shortlist.map(candidate => {
    const match = selected.find(item => item.normalized_url === candidate.normalized_url);
    return match || {
      ...candidate,
      selected: false,
      selected_for_editor: false
    };
  });

  return {
    schema_version: 1,
    date,
    generated_at: new Date().toISOString(),
    input_candidate_count: rawCandidates.length,
    eligible_candidate_count: shortlist.length,
    selected_article_count: selected.length,
    ai_selected_article_count: selected.filter(candidate => candidate.ai_slot_candidate).length,
    shortlist_cap: cap,
    selection_policy: {
      min_final_articles: MIN_FINAL_ARTICLES,
      max_final_articles: MAX_FINAL_ARTICLES,
      cxx_fallback: 'Use C++ / developer productivity only when fewer than 4 strong camera/platform articles remain.',
      ai_requirement: 'At least one final main article must be AI-related.'
    },
    shortlisted_candidates: markedShortlist,
    selected_articles: selected,
    excluded_candidates: excluded,
    selection_errors: selected.length < MIN_FINAL_ARTICLES
      ? [`Only ${selected.length} eligible non-duplicate final article input(s) remain after deterministic filtering.`]
      : selected.every(candidate => !candidate.ai_slot_candidate)
      ? ['No AI-related eligible final article input remains after deterministic filtering.']
      : []
  };
}

function reporterInputFromShortlist(shortlistReport) {
  const selectedUrls = new Set(ensureArray(shortlistReport.selected_articles).map(candidate => candidate.normalized_url));
  return {
    date: shortlistReport.date,
    candidates: ensureArray(shortlistReport.shortlisted_candidates).map(candidate => ({
      ...candidate,
      selected: selectedUrls.has(candidate.normalized_url),
      selected_for_editor: selectedUrls.has(candidate.normalized_url)
    }))
  };
}

module.exports = {
  SHORTLIST_CAP,
  MIN_FINAL_ARTICLES,
  MAX_FINAL_ARTICLES,
  buildShortlistReport,
  candidatesAreDuplicate,
  exclusionReasons,
  normalizeTitle,
  normalizeUrl,
  normalizedUrlHash,
  reporterInputFromShortlist,
  scoreCandidate,
  selectFinalArticles,
  titleSimilarity
};
