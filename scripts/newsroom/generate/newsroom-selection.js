const crypto = require('crypto');
const {
  normalizeShortlistReport
} = require('./selection-diagnostics');
const {
  BUCKETS,
  classifyAospCameraStackCandidate
} = require('../common/aosp-camera-scope');

const SHORTLIST_CAP = 12;
const RESERVE_MIN_CANDIDATES = 4;
const RESERVE_MAX_CANDIDATES = 7;
const MIN_FINAL_ARTICLES = 4;
const ABSOLUTE_MIN_REVIEWABLE_ARTICLES = 3;
const MAX_FINAL_ARTICLES = 5;
const MAIN_ARTICLE_SCORE_THRESHOLD = 42;
const MIN_CAMERA_HAL_DIRECTNESS = 2;
const MIN_SCOPE_RELEVANCE = 2;
const COMPOSITION_MODES = Object.freeze({
  NORMAL: 'NORMAL',
  FALLBACK_COMPOSITION: 'FALLBACK_COMPOSITION',
  THIN_WEEK_REVIEW: 'THIN_WEEK_REVIEW',
  NEEDS_FIX: 'NEEDS_FIX'
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

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rounded(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
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

function candidateScope(candidate) {
  if (candidate && candidate.relevance_bucket) {
    return {
      editorial_priority: number(candidate.editorial_priority, 6),
      relevance_bucket: text(candidate.relevance_bucket),
      aosp_camera_directness: number(candidate.aosp_camera_directness),
      driver_stack_relevance: number(candidate.driver_stack_relevance),
      soc_platform_relevance: number(candidate.soc_platform_relevance),
      native_tooling_relevance: number(candidate.native_tooling_relevance),
      counts_as_primary_camera_topic: bool(candidate.counts_as_primary_camera_topic),
      counts_as_driver_topic: bool(candidate.counts_as_driver_topic),
      counts_as_soc_topic: bool(candidate.counts_as_soc_topic),
      counts_as_fallback_topic: bool(candidate.counts_as_fallback_topic),
      evidence_origin: text(candidate.evidence_origin),
      source_hint: text(candidate.source_hint),
      scope_evidence_terms: ensureArray(candidate.scope_evidence_terms)
    };
  }
  return classifyAospCameraStackCandidate(candidate);
}

function scopeRelevanceScore(candidate) {
  const scope = candidateScope(candidate);
  return Math.max(
    number(scope.aosp_camera_directness),
    number(scope.driver_stack_relevance),
    number(scope.soc_platform_relevance),
    number(scope.native_tooling_relevance)
  );
}

function isGenericTechWatchlist(candidate) {
  return candidateScope(candidate).relevance_bucket === BUCKETS.GENERIC_TECH_WATCHLIST;
}

function hasSelectableScope(candidate) {
  return !isGenericTechWatchlist(candidate) && scopeRelevanceScore(candidate) >= MIN_SCOPE_RELEVANCE;
}

function hasAiValue(candidate) {
  const body = candidateBody(candidate);
  return /AI|agent|LLM|Gemini|NPU|GPU|on-device|inference|model|Firebase AI|Copilot|Codex/i.test(body);
}

function hasCameraPlatformValue(candidate) {
  if (hasSelectableScope(candidate)) return true;
  return /Camera HAL|Android Camera|CameraX|AOSP Camera|Camera2|camera|stream|buffer|metadata|request|result|CTS|VTS|Camera ITS|CDD|libcamera|V4L2/i
    .test(candidateBody(candidate));
}

function hasCppFallbackValue(candidate) {
  return /C\+\+|cpp|LLVM|Clang|GCC|NDK|toolchain|sanitizer|AI coding|LLM agent|on-device AI/i.test(candidateBody(candidate));
}

function hasPlatformSignalTerm(candidate) {
  return /\b(power|thermal|scheduler|cache|memory|memory bandwidth|performance|latency|interconnect|DVFS|EAS|native|build|test|tooling)\b/i
    .test(candidateBody(candidate));
}

function hasFallbackRelevanceHint(candidate) {
  return hasPlatformSignalTerm(candidate) ||
    /C\+\+|\b(SoC|CPU|cpp|LLVM|Clang|GCC|NDK|toolchain|sanitizer|AI coding|LLM agent|on-device AI)\b/i
      .test(candidateBody(candidate));
}

function hasGoogleTensorSocComponent(candidate) {
  const body = candidateBody(candidate);
  return /\bGoogle\s+Tensor\b|\bTensor\s+G\d+\b|\bPixel\s+Tensor\s+(?:SoC|chip|processor)\b|\bTensor\s+(?:SoC|chip|processor)\b/i
    .test(body);
}

function hasConcreteApiComponent(candidate) {
  if (text(candidate.api_or_component || candidate.apiOrComponent)) return true;
  return hasGoogleTensorSocComponent(candidate) ||
    /Camera HAL|CameraProvider|CameraService|CameraX|Camera2|AOSP Camera|AIDL|HIDL|ICamera|camera3|camera provider|capture request|capture result|stream configuration|camera metadata|ImageReader|AHardwareBuffer|NDK camera|Camera ITS|CTS.{0,80}camera|camera.{0,80}CTS|VTS.{0,80}camera|camera.{0,80}VTS|CDD.{0,80}camera|camera.{0,80}CDD|libcamera|V4L2|media controller|MIPI\s*CSI-?2|CSI-2|DMA-?BUF|image sensor|\bISP\b|\bGPU\b|\bNPU\b|\bDSP\b|Exynos|Snapdragon|\b(?:LLVM|Clang|GCC)\s*\d+(?:\.\d+)*|\b\d+(?:\.\d+)*\s*(?:LLVM|Clang|GCC)\b|AddressSanitizer|ThreadSanitizer|UndefinedBehaviorSanitizer|MemorySanitizer|\b(?:ASan|TSan|UBSan|MSan)\b/i
      .test(candidateBody(candidate));
}

function hasBehaviorEvidence(candidate) {
  if (text(candidate.behavior_change || candidate.behaviorChange)) return true;
  return /release|fix|regression|compatibility|validation|behavior|breaking|deprecated|migration|latency|frame|crash|bug|test|CTS|VTS|Camera ITS|CDD/i
    .test(candidateBody(candidate));
}

function cameraHalDirectnessScore(candidate) {
  const body = candidateBody(candidate);
  const scope = candidateScope(candidate);
  const rawScore = Math.max(
    number(scope.aosp_camera_directness),
    number(candidate.camera_hal_relevance_score),
    number(candidate.cameraHalRelevanceScore),
    number(candidate.relevanceScore),
    number(candidate.relevance_score)
  );
  let score = rawScore > 0 ? rawScore / 20 : 0;
  if (/Camera HAL|camera provider|camera3|ICamera|HAL3|HAL/i.test(body)) score = Math.max(score, 5);
  if (/Android Camera|AOSP Camera|CameraX|Camera2|Camera ITS/i.test(body)) score = Math.max(score, 4);
  if (/metadata|capture request|capture result|stream|buffer|CTS|VTS|CDD|libcamera|V4L2/i.test(body)) score = Math.max(score, 3);
  if (/\bcamera\b/i.test(body)) score = Math.max(score, 1);
  return clamp(rounded(score), 0, 5);
}

function evidenceSpecificityScore(candidate) {
  let score = clamp(number(candidate.evidence_score), 0, 5);
  if (publishedDate(candidate) && fieldBoolean(candidate, 'hasDatedEvidence', 'has_dated_evidence')) score += 1;
  if (hasConcreteApiComponent(candidate)) score += 1;
  if (hasBehaviorEvidence(candidate)) score += 1;
  if (text(candidate.version_or_release || candidate.versionOrRelease)) score += 1;
  return clamp(score, 0, 5);
}

function practicalActionabilityScore(candidate) {
  const raw = Math.max(
    number(candidate.practical_actionability_score),
    number(candidate.actionability_score)
  );
  if (raw > 0) return clamp(raw > 5 ? raw / 20 : raw, 0, 5);

  let score = 0;
  const body = candidateBody(candidate);
  if (hasConcreteApiComponent(candidate)) score += 2;
  if (hasBehaviorEvidence(candidate)) score += 1;
  if (/test|validate|CTS|VTS|Camera ITS|migration|compatibility|debug|trace|perf|latency|frame|buffer|metadata/i.test(body)) score += 2;
  return clamp(score, 0, 5);
}

function optionalAiCppBonus(candidate) {
  const cameraDirectness = cameraHalDirectnessScore(candidate);
  const scope = candidateScope(candidate);
  if (cameraDirectness < MIN_CAMERA_HAL_DIRECTNESS && !scope.counts_as_soc_topic && !scope.counts_as_fallback_topic) return 0;
  let score = 0;
  if (hasAiValue(candidate)) score += 2;
  if (hasCppFallbackValue(candidate)) score += 1;
  if (scope.counts_as_soc_topic) score += 1;
  if (scope.counts_as_fallback_topic) score += 1;
  return clamp(score, 0, 5);
}

function genericAiPenalty(candidate) {
  return hasAiValue(candidate) && !hasSelectableScope(candidate) && cameraHalDirectnessScore(candidate) < MIN_CAMERA_HAL_DIRECTNESS ? 12 : 0;
}

function watchPagePenalty(candidate) {
  return fieldBoolean(candidate, 'isWatchPage', 'is_watch_page') ? 10 : 0;
}

function noDatePenalty(candidate) {
  return !publishedDate(candidate) || !fieldBoolean(candidate, 'hasDatedEvidence', 'has_dated_evidence') ? 20 : 0;
}

function noApiComponentPenalty(candidate) {
  return hasConcreteApiComponent(candidate) ? 0 : 14;
}

function sourceGapPenalty(candidate) {
  return bool(candidate.source_gap_risk) ? 25 : 0;
}

function scoreCandidate(candidate, newsletterDate) {
  const scope = candidateScope(candidate);
  const cameraHal = cameraHalDirectnessScore(candidate);
  const scopeScore = scopeRelevanceScore(candidate);
  const androidCamera = hasCameraPlatformValue(candidate) ? 5 : 0;
  const ai = hasAiValue(candidate) ? 3 : 0;
  const cppFallback = hasCppFallbackValue(candidate) ? 2 : 0;
  const optionalBonus = optionalAiCppBonus(candidate);
  const evidence = evidenceSpecificityScore(candidate);
  const sourceReliability = reliabilityScore(candidate);
  const freshness = freshnessScore(candidate, newsletterDate);
  const actionability = practicalActionabilityScore(candidate);
  const penalties = {
    generic_ai_penalty: genericAiPenalty(candidate),
    watch_page_penalty: watchPagePenalty(candidate),
    no_date_penalty: noDatePenalty(candidate),
    no_api_component_penalty: noApiComponentPenalty(candidate),
    source_gap_penalty: sourceGapPenalty(candidate),
    generic_tech_watchlist_penalty: isGenericTechWatchlist(candidate) ? 30 : 0
  };
  const penaltyTotal = Object.values(penalties).reduce((sum, value) => sum + value, 0);
  const total = rounded(
    cameraHal * 9 +
    scopeScore * 8 +
    evidence * 4 +
    freshness * 5 +
    actionability * 2 +
    sourceReliability +
    optionalBonus -
    penaltyTotal
  );

  return {
    camera_hal_directness: cameraHal,
    scope_relevance: scopeScore,
    editorial_priority: scope.editorial_priority,
    relevance_bucket: scope.relevance_bucket,
    aosp_camera_directness: scope.aosp_camera_directness,
    driver_stack_relevance: scope.driver_stack_relevance,
    soc_platform_relevance: scope.soc_platform_relevance,
    native_tooling_relevance: scope.native_tooling_relevance,
    evidence_specificity: evidence,
    freshness_score: freshness,
    practical_actionability: actionability,
    optional_ai_cpp_bonus: optionalBonus,
    ...penalties,
    penalty_total: penaltyTotal,
    main_article_score_threshold: MAIN_ARTICLE_SCORE_THRESHOLD,
    minimum_camera_hal_directness: MIN_CAMERA_HAL_DIRECTNESS,
    minimum_scope_relevance: MIN_SCOPE_RELEVANCE,
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

function scoreFilterReasons(scoreBreakdown) {
  const reasons = [];
  if (scoreBreakdown.total < MAIN_ARTICLE_SCORE_THRESHOLD) {
    reasons.push(`deterministic_score<${MAIN_ARTICLE_SCORE_THRESHOLD}`);
  }
  if (scoreBreakdown.scope_relevance < MIN_SCOPE_RELEVANCE) {
    reasons.push(`scope_relevance<${MIN_SCOPE_RELEVANCE}`);
  }
  if (
    scoreBreakdown.relevance_bucket === BUCKETS.DIRECT_AOSP_CAMERA &&
    scoreBreakdown.camera_hal_directness < MIN_CAMERA_HAL_DIRECTNESS
  ) {
    reasons.push(`camera_hal_directness<${MIN_CAMERA_HAL_DIRECTNESS}`);
  }
  if (scoreBreakdown.relevance_bucket === BUCKETS.GENERIC_TECH_WATCHLIST) {
    reasons.push('relevance_bucket=generic_tech_watchlist');
  }
  if (scoreBreakdown.no_date_penalty > 0) reasons.push('missing dated evidence');
  if (scoreBreakdown.source_gap_penalty > 0) reasons.push('source_gap_risk=true');
  if (scoreBreakdown.no_api_component_penalty > 0) reasons.push('missing concrete API/component evidence');
  return [...new Set(reasons)];
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
  const scope = candidateScope(candidate);
  const score_breakdown = scoreCandidate(candidate, newsletterDate);
  const score_filter_reasons = scoreFilterReasons(score_breakdown);
  return {
    ...candidate,
    ...scope,
    url: candidateUrl(candidate),
    published_date: publishedDate(candidate),
    source: candidateSource(candidate),
    selected: false,
    selected_for_editor: false,
    deterministic_score: score_breakdown.total,
    score_breakdown,
    main_article_score_eligible: score_filter_reasons.length === 0,
    score_filter_reasons,
    exclusion_reasons: exclusionReasons(candidate),
    normalized_url: normalizeUrl(candidateUrl(candidate)),
    url_hash: normalizedUrlHash(candidateUrl(candidate)),
    ai_slot_candidate: hasAiValue(candidate),
    camera_platform_candidate: hasCameraPlatformValue(candidate),
    cpp_fallback_candidate: hasCppFallbackValue(candidate),
    optional_ai_cpp_candidate: optionalAiCppBonus(candidate) > 0
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
    number(a.editorial_priority, 6) - number(b.editorial_priority, 6) ||
    b.deterministic_score - a.deterministic_score ||
    b.score_breakdown.camera_hal_directness - a.score_breakdown.camera_hal_directness ||
    b.score_breakdown.scope_relevance - a.score_breakdown.scope_relevance ||
    b.score_breakdown.evidence_specificity - a.score_breakdown.evidence_specificity ||
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

function reserveCandidates(shortlist, selected, options = {}) {
  const minReserve = options.minReserve || RESERVE_MIN_CANDIDATES;
  const maxReserve = options.maxReserve || RESERVE_MAX_CANDIDATES;
  const selectedUrls = new Set(ensureArray(selected).map(candidate => candidate.normalized_url));
  const reserve = [];
  for (const candidate of ensureArray(shortlist)) {
    if (reserve.length >= maxReserve) break;
    if (selectedUrls.has(candidate.normalized_url)) continue;
    if (candidate.main_article_score_eligible === false) continue;
    if (candidateScope(candidate).relevance_bucket === BUCKETS.GENERIC_TECH_WATCHLIST) continue;
    reserve.push({
      ...candidate,
      selected: false,
      selected_for_editor: false,
      final_selected: false,
      reserve_candidate: true,
      selection_stage: 'deterministic-reserve',
      selection_slot: 'reserve'
    });
  }
  if (reserve.length < minReserve) {
    for (const candidate of ensureArray(shortlist)) {
      if (reserve.length >= maxReserve) break;
      if (selectedUrls.has(candidate.normalized_url)) continue;
      if (reserve.some(existing => existing.normalized_url === candidate.normalized_url)) continue;
      if (candidate.main_article_score_eligible === false) continue;
      reserve.push({
        ...candidate,
        selected: false,
        selected_for_editor: false,
        final_selected: false,
        reserve_candidate: true,
        selection_stage: 'deterministic-reserve',
        selection_slot: candidateScope(candidate).relevance_bucket === BUCKETS.GENERIC_TECH_WATCHLIST
          ? 'thin-week-watchlist-reserve'
          : 'reserve'
      });
    }
  }
  return reserve;
}

function selectFinalArticles(shortlist, options = {}) {
  const minArticles = options.minArticles || MIN_FINAL_ARTICLES;
  const maxArticles = options.maxArticles || MAX_FINAL_ARTICLES;
  const candidates = ensureArray(shortlist).map(candidate =>
    candidate.score_breakdown ? candidate : decorateCandidate(candidate, options.date || '')
  );
  const selected = [];
  const mainEligible = candidates.filter(candidate => candidate.main_article_score_eligible !== false);
  const strongCameraPool = mainEligible.filter(candidate => candidate.camera_platform_candidate);
  const optionalCameraPool = mainEligible.filter(candidate =>
    candidate.optional_ai_cpp_candidate && candidate.camera_platform_candidate
  );
  const adjacentPool = mainEligible.filter(candidate => !strongCameraPool.includes(candidate));

  for (const candidate of strongCameraPool) {
    if (selected.length >= maxArticles) break;
    const slot = candidate.optional_ai_cpp_candidate ? 'camera-platform-optional-ai-cpp' : 'camera-platform';
    pushUnique(selected, candidate, slot);
  }
  for (const candidate of optionalCameraPool) {
    if (selected.length >= Math.min(maxArticles, minArticles)) break;
    pushUnique(selected, candidate, 'camera-platform-optional-ai-cpp');
  }
  for (const candidate of adjacentPool) {
    if (selected.length >= minArticles) break;
    pushUnique(selected, candidate, candidate.optional_ai_cpp_candidate ? 'optional-ai-cpp' : 'platform-adjacent');
  }

  return selected.slice(0, maxArticles);
}

function selectionWarnings(selected) {
  const count = ensureArray(selected).length;
  if (count >= ABSOLUTE_MIN_REVIEWABLE_ARTICLES && count < MIN_FINAL_ARTICLES) {
    return [
      `Thin-week review path: only ${count} eligible non-duplicate final article input(s) remain after deterministic filtering. Review artifacts may be generated, but publication is not ready.`
    ];
  }
  return [];
}

function selectionErrors(selected) {
  const items = ensureArray(selected);
  const errors = [];
  if (items.length < ABSOLUTE_MIN_REVIEWABLE_ARTICLES) {
    errors.push(`Only ${items.length} eligible non-duplicate final article input(s) remain after deterministic filtering.`);
  }
  if (items.length > 0 && items.every(candidate => !hasSelectableScope(candidate))) {
    errors.push('No AOSP Camera / Camera Driver / SoC Platform / native tooling eligible final article input remains after deterministic filtering.');
  }
  return errors;
}

function summarizeExclusionReasons(excluded) {
  const counts = new Map();
  for (const candidate of ensureArray(excluded)) {
    for (const reason of ensureArray(candidate.exclusion_reasons)) {
      const key = text(reason) || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function summarizeBuckets(candidates) {
  const counts = new Map();
  for (const candidate of ensureArray(candidates)) {
    const bucket = text(candidate.relevance_bucket || candidateScope(candidate).relevance_bucket) || 'unknown';
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => number(a.bucket === BUCKETS.GENERIC_TECH_WATCHLIST) - number(b.bucket === BUCKETS.GENERIC_TECH_WATCHLIST) || a.bucket.localeCompare(b.bucket));
}

function bucketCountMap(candidates) {
  const counts = {
    [BUCKETS.DIRECT_AOSP_CAMERA]: 0,
    [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 0,
    [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 0,
    [BUCKETS.SOC_PLATFORM_SIGNAL]: 0,
    [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 0,
    [BUCKETS.GENERIC_TECH_WATCHLIST]: 0
  };
  for (const candidate of ensureArray(candidates)) {
    const bucket = text(candidate.relevance_bucket || candidateScope(candidate).relevance_bucket);
    if (Object.prototype.hasOwnProperty.call(counts, bucket)) {
      counts[bucket] += 1;
    }
  }
  return counts;
}

function compositionSummary(candidates) {
  const bucket_counts = bucketCountMap(candidates);
  const primary_camera_stack_topic_count =
    bucket_counts[BUCKETS.DIRECT_AOSP_CAMERA] +
    bucket_counts[BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE] +
    bucket_counts[BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT];
  const fallback_topic_count =
    bucket_counts[BUCKETS.SOC_PLATFORM_SIGNAL] +
    bucket_counts[BUCKETS.CPP_AI_TOOLING_FALLBACK];
  const selected_article_count = ensureArray(candidates).length;
  return {
    selected_article_count,
    bucket_counts,
    direct_aosp_camera_count: bucket_counts[BUCKETS.DIRECT_AOSP_CAMERA],
    camera_driver_image_pipeline_count: bucket_counts[BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE],
    android_platform_camera_adjacent_count: bucket_counts[BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT],
    soc_platform_signal_count: bucket_counts[BUCKETS.SOC_PLATFORM_SIGNAL],
    cpp_ai_tooling_fallback_count: bucket_counts[BUCKETS.CPP_AI_TOOLING_FALLBACK],
    generic_tech_watchlist_count: bucket_counts[BUCKETS.GENERIC_TECH_WATCHLIST],
    primary_camera_stack_topic_count,
    fallback_topic_count
  };
}

function compositionMode(selected, errors = []) {
  const summary = compositionSummary(selected);
  if (
    ensureArray(errors).length > 0 ||
    summary.selected_article_count < ABSOLUTE_MIN_REVIEWABLE_ARTICLES ||
    (
      summary.selected_article_count > 0 &&
      summary.generic_tech_watchlist_count === summary.selected_article_count
    )
  ) {
    return COMPOSITION_MODES.NEEDS_FIX;
  }
  if (summary.selected_article_count < MIN_FINAL_ARTICLES) {
    return COMPOSITION_MODES.THIN_WEEK_REVIEW;
  }
  if (summary.primary_camera_stack_topic_count < 2 && summary.fallback_topic_count > 0) {
    return COMPOSITION_MODES.FALLBACK_COMPOSITION;
  }
  return COMPOSITION_MODES.NORMAL;
}

function compositionReason(mode, summary) {
  if (mode === COMPOSITION_MODES.FALLBACK_COMPOSITION) {
    return `Primary AOSP Camera/driver/platform-adjacent candidates were below the normal target (${summary.primary_camera_stack_topic_count}); SoC/platform or C++/AI fallback topics filled the 4-5 article review set.`;
  }
  if (mode === COMPOSITION_MODES.THIN_WEEK_REVIEW) {
    return `Only ${summary.selected_article_count} main article candidate(s) are available after deterministic filtering; keep this PR review-only.`;
  }
  if (mode === COMPOSITION_MODES.NEEDS_FIX) {
    return 'Deterministic selection is not publish-ready because too few eligible candidates remain or the composition is generic/watchlist-only.';
  }
  return 'Normal composition: primary AOSP Camera, camera driver/image pipeline, or Android camera-adjacent topics meet the expected coverage.';
}

function buildShortlistReport(date, collectedCandidates, options = {}) {
  const rawCandidates = ensureArray(collectedCandidates?.candidates || collectedCandidates);
  const cap = options.cap || SHORTLIST_CAP;
  const { shortlist, excluded } = buildEligibleShortlist(rawCandidates, date, cap);
  const selected = selectFinalArticles(shortlist, options);
  const reserve = reserveCandidates(shortlist, selected, options);
  const warnings = selectionWarnings(selected);
  const errors = selectionErrors(selected);
  const composition = compositionSummary(selected);
  const mode = compositionMode(selected, errors);
  const reserveUrls = new Set(reserve.map(candidate => candidate.normalized_url));
  const markedShortlist = shortlist.map(candidate => {
    const match = selected.find(item => item.normalized_url === candidate.normalized_url);
    if (match) {
      return {
        ...match,
        primary_selected: true,
        reserve_candidate: false
      };
    }
    const reserveMatch = reserve.find(item => item.normalized_url === candidate.normalized_url);
    return reserveMatch || {
      ...candidate,
      selected: false,
      selected_for_editor: false,
      reserve_candidate: reserveUrls.has(candidate.normalized_url)
    };
  });

  return normalizeShortlistReport({
    schema_version: 3,
    date,
    generated_at: new Date().toISOString(),
    input_candidate_count: rawCandidates.length,
    eligible_candidate_count: shortlist.length,
    deterministic_selected_count: selected.length,
    selected_article_count: selected.length,
    primary_selected_article_count: selected.length,
    reserve_candidate_count: reserve.length,
    demoted_candidate_count: 0,
    composition_mode: mode,
    selection_composition_mode: mode,
    composition_reason: compositionReason(mode, composition),
    composition_summary: composition,
    editor_review_required: mode !== COMPOSITION_MODES.NORMAL,
    ai_selected_article_count: selected.filter(candidate => candidate.ai_slot_candidate).length,
    optional_ai_cpp_selected_article_count: selected.filter(candidate => candidate.optional_ai_cpp_candidate).length,
    relevance_bucket_summary: summarizeBuckets(shortlist),
    selected_relevance_bucket_summary: summarizeBuckets(selected),
    reserve_relevance_bucket_summary: summarizeBuckets(reserve),
    shortlist_cap: cap,
    absolute_min_reviewable_articles: ABSOLUTE_MIN_REVIEWABLE_ARTICLES,
    underfilled: warnings.length > 0,
    publish_ready: errors.length === 0 && warnings.length === 0 && mode !== COMPOSITION_MODES.NEEDS_FIX,
    selection_policy: {
      min_final_articles: MIN_FINAL_ARTICLES,
      absolute_min_reviewable_articles: ABSOLUTE_MIN_REVIEWABLE_ARTICLES,
      max_final_articles: MAX_FINAL_ARTICLES,
      shortlist_target_range: '8-12 candidates before Gemini reporter/editor prompts.',
      main_article_score_threshold: MAIN_ARTICLE_SCORE_THRESHOLD,
      minimum_camera_hal_directness: MIN_CAMERA_HAL_DIRECTNESS,
      minimum_scope_relevance: MIN_SCOPE_RELEVANCE,
      editorial_scope: 'AOSP Camera + Camera Driver + SoC Platform, with C++/AI/tooling as lower-priority fallback.',
      priority_order: [
        BUCKETS.DIRECT_AOSP_CAMERA,
        BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
        BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT,
        BUCKETS.SOC_PLATFORM_SIGNAL,
        BUCKETS.CPP_AI_TOOLING_FALLBACK,
        BUCKETS.GENERIC_TECH_WATCHLIST
      ],
      soc_platform_fallback: 'Public SoC / CPU / GPU / NPU / ISP / power / thermal / performance signals are lower-priority fallback, not excluded.',
      cxx_fallback: 'Use C++ / AI / developer productivity as fallback when it supports native camera, driver, SoC, build, test, debugging, or performance work.',
      generic_watchlist: 'generic_tech_watchlist is not automatically promoted to main article selection.'
    },
    primary_selected_articles: selected,
    shortlisted_candidates: markedShortlist,
    selected_articles: selected,
    reserve_candidates: reserve,
    demoted_candidates: [],
    excluded_candidates: excluded,
    selection_warnings: warnings,
    selection_errors: errors,
    exclusion_reason_summary: summarizeExclusionReasons(excluded)
  });
}

function reporterInputFromShortlist(shortlistReport) {
  const selectedUrls = new Set(ensureArray(shortlistReport.selected_articles).map(candidate => candidate.normalized_url));
  return {
    date: shortlistReport.date,
    candidates: ensureArray(shortlistReport.shortlisted_candidates).map(candidate => ({
      ...candidate,
      selected: false,
      final_selected: selectedUrls.has(candidate.normalized_url),
      selected_for_editor: selectedUrls.has(candidate.normalized_url)
    }))
  };
}

module.exports = {
  ABSOLUTE_MIN_REVIEWABLE_ARTICLES,
  COMPOSITION_MODES,
  SHORTLIST_CAP,
  RESERVE_MIN_CANDIDATES,
  RESERVE_MAX_CANDIDATES,
  MIN_FINAL_ARTICLES,
  MAX_FINAL_ARTICLES,
  MAIN_ARTICLE_SCORE_THRESHOLD,
  MIN_CAMERA_HAL_DIRECTNESS,
  buildShortlistReport,
  candidatesAreDuplicate,
  compositionMode,
  compositionSummary,
  exclusionReasons,
  hasConcreteApiComponent,
  hasFallbackRelevanceHint,
  hasPlatformSignalTerm,
  normalizeTitle,
  normalizeUrl,
  normalizedUrlHash,
  reporterInputFromShortlist,
  scoreCandidate,
  selectFinalArticles,
  selectionErrors,
  selectionWarnings,
  summarizeExclusionReasons,
  titleSimilarity
};
