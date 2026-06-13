const { ensureArray } = require('../../shared/common/value-coercion');
const {
  normalizeShortlistReport
} = require('./selection-diagnostics');
const {
  SHORTLIST_CAP,
  RESERVE_MIN_CANDIDATES,
  RESERVE_MAX_CANDIDATES,
  MIN_FINAL_ARTICLES,
  MAX_FINAL_ARTICLES,
  ABSOLUTE_MIN_REVIEWABLE_ARTICLES,
  MIN_NON_FALLBACK_PUBLISH_READY_ARTICLES,
  DIRECT_AOSP_CAMERA_OR_DRIVER_BUCKETS,
  MAIN_ARTICLE_SCORE_THRESHOLD,
  MIN_CAMERA_HAL_DIRECTNESS,
  MIN_SCOPE_RELEVANCE,
  LINKED_EVIDENCE_RUNTIME_BONUS,
  LINKED_EVIDENCE_WATCH_PENALTY,
  COMPOSITION_MODES
} = require('./selection-policy-constants');
const {
  normalizeUrl,
  normalizedUrlHash,
  normalizeTitle,
  titleSimilarity
} = require('../../shared/common/selection-normalizers');
const {
  text,
  number,
  publishedDate,
  selectionDateEvidence,
  selectionDate,
  datePrecision,
  candidateUrl,
  candidateSource
} = require('./selection-candidate-fields');
const {
  candidateScope,
  isForbiddenMainScope,
  exclusionReasons,
  hasConcreteApiComponent,
  hasFallbackRelevanceHint,
  hasPlatformSignalTerm,
  hasAiValue,
  hasCameraPlatformValue,
  hasCppFallbackValue,
  optionalAiCppBonus,
  scoreCandidate,
  scoreFilterReasons
} = require('./selection-candidate-scoring');
const {
  selectionWarnings,
  selectionErrors,
  reviewCompositionGatePasses,
  publishReadyGateReasonSummary,
  publishReadyGateReasonCodes,
  publishGatePasses,
  summarizeExclusionReasons,
  summarizeBuckets,
  groupSummary,
  compositionSummary,
  candidatePoolPreflightSummary,
  candidatePoolShortageReasonCodes,
  sourceParserHintsFromShortage,
  selectionShortageHints,
  compositionMode,
  compositionReason
} = require('./selection-composition-gates');
const {
  cameraReleasePageKey,
  cameraReleaseVersionRank,
  hasSourceExtractionBullet,
  selectedHasSameCameraReleasePage
} = require('./camera-release-notes');
const {
  BUCKETS
} = require('../../shared/common/aosp-camera-scope');
const {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  NATIVE_TOOLING_WORKFLOW_TYPE,
  attachRelatedContextToSelected,
  candidateGroupKey,
  groupCoverageSummary,
  isNativeToolingWorkflow,
  loreSeriesKey,
  loreSeriesPatchNumber
} = require('../../shared/common/article-groups');
const {
  dateQualityForCandidate
} = require('../../shared/common/date-signals');
const {
  articleIdentityKey
} = require('../../shared/common/article-identity');
const {
  everCoveredAsNewsletterArticle,
  readExposureHistory
} = require('../reporter/article-exposure-history');
const {
  applyHomepageHeadlineSelection,
  candidateDateEvidence,
  candidateQualityFlags,
  computeHeadlineScore,
  readHomepageHeadlineState
} = require('../reporter/homepage-headline');
const {
  POLICY_REL_PATH,
  articlePolicy,
  candidatePoolPreflightPolicy,
  getCatchUpPolicy,
  getHeadlinePolicy,
  getPublishModePolicy,
  getPublishReadyCompositionPolicy,
  getSelectionWindowPolicy
} = require('../../shared/common/newsletter-policy');
const { resolvePublishMode } = require('./publish-mode');

const publishReadyCompositionPolicy = getPublishReadyCompositionPolicy();

function utcDayStart(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysSincePublished(candidate, newsletterDate) {
  const rawDate = selectionDate(candidate);
  const published = rawDate ? new Date(rawDate) : null;
  const base = newsletterDate ? new Date(`${newsletterDate}T00:00:00Z`) : new Date();
  const publishedDay = utcDayStart(published);
  const baseDay = utcDayStart(base);
  if (publishedDay === null || baseDay === null) return null;
  return Math.max(0, Math.floor((baseDay - publishedDay) / (24 * 60 * 60 * 1000)));
}

function freshnessWindowMetadata(candidate, newsletterDate, policy = getSelectionWindowPolicy()) {
  const ageDays = daysSincePublished(candidate, newsletterDate);
  const precision = datePrecision(candidate);
  const precisionNote = precision === 'month' ? 'month-level date precision; ' : '';
  const dateEvidence = selectionDateEvidence(candidate);
  const dateLabel = dateEvidence.date_field === 'effective_date' ? 'effective_date' : 'published';

  if (ageDays === null) {
    return {
      freshness_window: 'unknown',
      days_since_published: null,
      selection_window_reason: 'missing or invalid published date'
    };
  }

  if (ageDays <= policy.primarySelectionDays) {
    return {
      freshness_window: 'primary',
      days_since_published: ageDays,
      selection_window_reason: `${precisionNote}${ageDays} day(s) since ${dateLabel}; within primary ${policy.primarySelectionDays} day window`
    };
  }

  if (ageDays <= policy.fallbackSelectionDays) {
    return {
      freshness_window: 'fallback',
      days_since_published: ageDays,
      selection_window_reason: `${precisionNote}${ageDays} day(s) since ${dateLabel}; within fallback ${policy.fallbackSelectionDays} day window`
    };
  }

  if (ageDays <= policy.referenceContextDays) {
    return {
      freshness_window: 'reference',
      days_since_published: ageDays,
      selection_window_reason: `${precisionNote}${ageDays} day(s) since ${dateLabel}; within reference ${policy.referenceContextDays} day window`
    };
  }

  return {
    freshness_window: 'stale',
    days_since_published: ageDays,
    selection_window_reason: `${precisionNote}${ageDays} day(s) since ${dateLabel}; older than reference ${policy.referenceContextDays} day window`
  };
}

function candidatesAreDuplicate(left, right) {
  // 같은 lore.kernel.org 패치 시리즈(cover letter + 각 패치)는 URL/title이 모두 달라도
  // 하나의 main 기사로 묶어야 한다. 시리즈 키가 같으면 즉시 중복으로 본다.
  const leftSeries = loreSeriesKey(left);
  if (leftSeries && leftSeries === loreSeriesKey(right)) return true;
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

function shouldPreferDuplicateCandidate(candidate, existing) {
  // 같은 패치 시리즈면 patch 번호가 낮은 쪽(cover letter 0)을 대표로 남긴다.
  const candidateSeries = loreSeriesKey(candidate);
  if (candidateSeries && candidateSeries === loreSeriesKey(existing)) {
    return loreSeriesPatchNumber(candidate) < loreSeriesPatchNumber(existing);
  }
  const candidateCameraPage = cameraReleasePageKey(candidate);
  const existingCameraPage = cameraReleasePageKey(existing);
  if (candidateCameraPage && existingCameraPage && candidateCameraPage === existingCameraPage) {
    if (hasSourceExtractionBullet(candidate) && !hasSourceExtractionBullet(existing)) return true;
    if (!hasSourceExtractionBullet(candidate) && hasSourceExtractionBullet(existing)) return false;
    const candidateRank = cameraReleaseVersionRank(candidate);
    const existingRank = cameraReleaseVersionRank(existing);
    return candidateRank.kind < existingRank.kind ||
      (candidateRank.kind === existingRank.kind && candidateRank.weight > existingRank.weight);
  }
  return false;
}

function decorateCandidate(candidate, newsletterDate, options = {}) {
  const selectionWindowPolicy = options.selectionWindowPolicy || getSelectionWindowPolicy();
  const scope = candidateScope(candidate);
  const score_breakdown = scoreCandidate(candidate, newsletterDate);
  const headline = computeHeadlineScore({
    ...candidate,
    ...scope,
    score_breakdown
  }, options.headlinePolicy || getHeadlinePolicy());
  const score_filter_reasons = scoreFilterReasons(score_breakdown);
  const windowMetadata = freshnessWindowMetadata(candidate, newsletterDate, selectionWindowPolicy);
  return {
    ...candidate,
    ...scope,
    article_group_key: candidate.article_group_key ||
      (scope.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK &&
        text(scope.tooling_workflow_type || candidate.tooling_workflow_type) === NATIVE_TOOLING_WORKFLOW_TYPE
        ? ANDROID_NATIVE_TOOLING_GROUP_KEY
        : candidateGroupKey({ ...candidate, ...scope })),
    tooling_workflow_type: text(candidate.tooling_workflow_type || scope.tooling_workflow_type),
    native_workflow_evidence_score: number(candidate.native_workflow_evidence_score ?? scope.native_workflow_evidence_score),
    ...windowMetadata,
    url: candidateUrl(candidate),
    published_date: publishedDate(candidate),
    effective_date: text(candidate.effective_date || candidate.effectiveDate),
    date_source: text(candidate.date_source),
    date_confidence: number(candidate.date_confidence),
    date_quality: dateQualityForCandidate(candidate),
    source: candidateSource(candidate),
    selected: false,
    selected_for_editor: false,
    article_identity_key: articleIdentityKey({ ...candidate, ...scope }),
    deterministic_score: score_breakdown.total,
    score_breakdown,
    headline_score: headline.headline_score,
    headline_score_breakdown: headline.score_breakdown,
    date_evidence: candidateDateEvidence(candidate),
    quality_flags: candidateQualityFlags(candidate),
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

function deterministicCandidateSort(a, b) {
  const bothNativeToolingGroup = a.article_group_key === ANDROID_NATIVE_TOOLING_GROUP_KEY &&
    b.article_group_key === ANDROID_NATIVE_TOOLING_GROUP_KEY;
  if (bothNativeToolingGroup) {
    const sourceQualityRank = value => text(value.source_quality_status) === 'allowed' ? 1 : 0;
    const datedOfficialRank = value => (text(value.reliability) === 'official' && publishedDate(value)) ? 1 : 0;
    const childRank = value => text(value.sourceType || value.source_type) === 'roundup_child' || text(value.parentUrl || value.parent_url) ? 1 : 0;
    return sourceQualityRank(b) - sourceQualityRank(a) ||
      number(b.source_gap_risk === false) - number(a.source_gap_risk === false) ||
      datedOfficialRank(b) - datedOfficialRank(a) ||
      number(b.native_workflow_evidence_score) - number(a.native_workflow_evidence_score) ||
      childRank(b) - childRank(a) ||
      number(b.context_usage_allowed === true) - number(a.context_usage_allowed === true) ||
      normalizeUrl(candidateUrl(a)).localeCompare(normalizeUrl(candidateUrl(b))) ||
      normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
  }
  return number(a.editorial_priority, 6) - number(b.editorial_priority, 6) ||
    cameraReleaseVersionRank(a).kind - cameraReleaseVersionRank(b).kind ||
    cameraReleaseVersionRank(b).weight - cameraReleaseVersionRank(a).weight ||
    b.deterministic_score - a.deterministic_score ||
    b.score_breakdown.camera_hal_directness - a.score_breakdown.camera_hal_directness ||
    b.score_breakdown.scope_relevance - a.score_breakdown.scope_relevance ||
    b.score_breakdown.evidence_specificity - a.score_breakdown.evidence_specificity ||
    normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
}

function selectionWindowExclusionReason(candidate) {
  const window = text(candidate.freshness_window);
  if (window === 'reference') return 'reference_not_main';
  if (window === 'stale') return 'stale_not_main';
  if (window === 'unknown') return 'unknown_not_main';
  return '';
}

function appendSelectionWindowExclusion(candidate) {
  const reason = selectionWindowExclusionReason(candidate);
  if (!reason) return candidate;
  const marker = `selection_window=${reason}`;
  return {
    ...candidate,
    selection_window_exclusion_reason: reason,
    exclusion_reasons: [...new Set([...ensureArray(candidate.exclusion_reasons), marker])]
  };
}

function isMainSelectionWindow(candidate) {
  return ['primary', 'fallback'].includes(text(candidate.freshness_window));
}

function partitionSelectionWindows(candidates) {
  const primary = [];
  const fallback = [];
  const reference = [];
  const windowExcluded = [];

  for (const candidate of ensureArray(candidates)) {
    const window = text(candidate.freshness_window);
    if (window === 'primary') {
      primary.push(candidate);
    } else if (window === 'fallback') {
      fallback.push(candidate);
    } else {
      const excluded = appendSelectionWindowExclusion(candidate);
      windowExcluded.push(excluded);
      if (window === 'reference') {
        reference.push(excluded);
      }
    }
  }

  return {
    primary,
    fallback,
    reference,
    windowExcluded
  };
}

function summarizeSelectionWindowExclusions(excluded) {
  const counts = new Map();
  for (const candidate of ensureArray(excluded)) {
    const reason = text(candidate.selection_window_exclusion_reason);
    if (!reason) continue;
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function buildEligibleShortlist(rawCandidates, newsletterDate, cap = SHORTLIST_CAP, options = {}) {
  const excluded = [];
  const eligible = [];
  const decorateOptions = { selectionWindowPolicy: options.selectionWindowPolicy };
  for (const candidate of ensureArray(rawCandidates).map(item => decorateCandidate(item, newsletterDate, decorateOptions))) {
    if (candidate.exclusion_reasons.length > 0) {
      excluded.push(appendSelectionWindowExclusion(candidate));
      continue;
    }
    const duplicateIndex = eligible.findIndex(existing => candidatesAreDuplicate(existing, candidate));
    if (duplicateIndex >= 0) {
      if (shouldPreferDuplicateCandidate(candidate, eligible[duplicateIndex])) {
        excluded.push(appendSelectionWindowExclusion({
          ...eligible[duplicateIndex],
          exclusion_reasons: ['duplicate CameraX release-note body candidate supersedes discovery row']
        }));
        eligible[duplicateIndex] = candidate;
        continue;
      }
      excluded.push(appendSelectionWindowExclusion({
        ...candidate,
        exclusion_reasons: ['duplicate URL or near-duplicate title']
      }));
      continue;
    }
    eligible.push(candidate);
  }

  eligible.sort(deterministicCandidateSort);
  const windows = partitionSelectionWindows(eligible);
  const mainSelectionCandidates = [...windows.primary, ...windows.fallback];

  return {
    shortlist: mainSelectionCandidates.slice(0, cap),
    selectionPools: {
      primary: windows.primary,
      fallback: windows.fallback
    },
    excluded: excluded.concat(windows.windowExcluded),
    referenceContextCandidates: windows.reference.slice(0, cap),
    windowCandidateCounts: {
      primary: windows.primary.length,
      fallback: windows.fallback.length,
      reference: windows.reference.length,
      excluded: windows.windowExcluded.length
    }
  };
}

function pushUnique(selected, candidate, slot) {
  if (!candidate) return false;
  if (selectedHasSameCameraReleasePage(selected, candidate)) return false;
  if (selected.some(existing => candidatesAreDuplicate(existing, candidate))) return false;
  const isFallback = text(candidate.freshness_window) === 'fallback';
  selected.push({
    ...candidate,
    selected: true,
    selected_for_editor: true,
    fallback_window_promoted: isFallback,
    selection_window_stage: isFallback ? 'fallback' : 'primary',
    selection_slot: slot
  });
  return true;
}

function reserveCandidates(shortlist, selected, options = {}) {
  const minReserve = options.minReserve ?? RESERVE_MIN_CANDIDATES;
  const maxReserve = options.maxReserve ?? RESERVE_MAX_CANDIDATES;
  const selectedUrls = new Set(ensureArray(selected).map(candidate => candidate.normalized_url));
  const reserve = [];
  const mainSelectionCandidates = ensureArray(shortlist).filter(isMainSelectionWindow);
  const primaryReserveCandidates = mainSelectionCandidates.filter(candidate => text(candidate.freshness_window) === 'primary');
  const fallbackReserveCandidates = mainSelectionCandidates.filter(candidate => text(candidate.freshness_window) === 'fallback');
  for (const candidate of primaryReserveCandidates) {
    if (reserve.length >= maxReserve) break;
    if (selectedUrls.has(candidate.normalized_url)) continue;
    if (candidate.main_article_score_eligible === false) continue;
    if (isForbiddenMainScope(candidate)) continue;
    reserve.push({
      ...candidate,
      selected: false,
      selected_for_editor: false,
      final_selected: false,
      fallback_window_reserve: false,
      reserve_candidate: true,
      selection_stage: 'deterministic-reserve',
      selection_window_stage: 'primary_reserve',
      selection_slot: 'reserve'
    });
  }
  if (reserve.length < minReserve) {
    for (const candidate of fallbackReserveCandidates) {
      if (reserve.length >= maxReserve) break;
      if (selectedUrls.has(candidate.normalized_url)) continue;
      if (reserve.some(existing => existing.normalized_url === candidate.normalized_url)) continue;
      if (candidate.main_article_score_eligible === false) continue;
      reserve.push({
        ...candidate,
        selected: false,
        selected_for_editor: false,
        final_selected: false,
        fallback_window_reserve: true,
        reserve_candidate: true,
        selection_stage: 'deterministic-reserve',
        selection_window_stage: 'fallback_reserve',
        selection_slot: isForbiddenMainScope(candidate)
          ? 'thin-week-watchlist-reserve'
          : 'reserve'
      });
    }
  }
  return reserve;
}

function selectFinalArticlesFromPool(shortlist, options = {}) {
  const minArticles = options.minArticles ?? MIN_FINAL_ARTICLES;
  const maxArticles = options.maxArticles ?? MAX_FINAL_ARTICLES;
  const candidates = ensureArray(shortlist).map(candidate =>
    candidate.score_breakdown ? candidate : decorateCandidate(candidate, options.date || '', {
      selectionWindowPolicy: options.selectionWindowPolicy
    })
  );
  const selected = [];
  const mainEligible = candidates.filter(candidate => candidate.main_article_score_eligible !== false);
  const nativeToolingPool = mainEligible.filter(candidate =>
    isNativeToolingWorkflow(candidate) ||
    candidate.article_group_key === ANDROID_NATIVE_TOOLING_GROUP_KEY ||
    text(candidate.tooling_workflow_type) === NATIVE_TOOLING_WORKFLOW_TYPE
  );
  const nativeToolingUrls = new Set(nativeToolingPool.map(candidate => candidate.normalized_url).filter(Boolean));
  const strongCameraPool = mainEligible.filter(candidate => candidate.camera_platform_candidate);
  const optionalCameraPool = mainEligible.filter(candidate =>
    candidate.optional_ai_cpp_candidate && candidate.camera_platform_candidate
  );
  const adjacentPool = mainEligible.filter(candidate =>
    !strongCameraPool.includes(candidate) &&
    !nativeToolingUrls.has(candidate.normalized_url)
  );

  for (const candidate of strongCameraPool) {
    if (selected.length >= maxArticles) break;
    const slot = candidate.optional_ai_cpp_candidate ? 'camera-platform-optional-ai-cpp' : 'camera-platform';
    pushUnique(selected, candidate, slot);
  }
  if (
    selected.length < maxArticles &&
    nativeToolingPool.length > 0 &&
    compositionSummary(selected).supporting_main_article_count < publishReadyCompositionPolicy.supportingMainMaxAllowed
  ) {
    pushUnique(selected, nativeToolingPool[0], 'android-native-tooling-supporting');
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

function fallbackWindowReason(primarySelectedCount, minArticles) {
  return `primary window selected ${primarySelectedCount} article(s), below min ${minArticles}`;
}

function selectFinalArticlesWithDiagnostics(shortlist, options = {}) {
  const minArticles = options.minArticles ?? MIN_FINAL_ARTICLES;
  const rawCandidates = ensureArray(shortlist);
  const enforceSelectionWindow = rawCandidates.some(candidate => text(candidate.freshness_window)) ||
    Boolean(options.date);
  if (!enforceSelectionWindow) {
    const selected = selectFinalArticlesFromPool(rawCandidates, options);
    return {
      selected,
      diagnostics: {
        primary_window_candidate_count: 0,
        primary_window_selected_count: selected.length,
        fallback_window_candidate_count: 0,
        fallback_window_consulted: false,
        fallback_window_used: false,
        fallback_window_reason: '',
        fallback_candidates_promoted: []
      }
    };
  }
  const decoratedCandidates = rawCandidates.map(candidate =>
    candidate.score_breakdown && text(candidate.freshness_window)
      ? candidate
      : decorateCandidate(candidate, options.date || '', {
        selectionWindowPolicy: options.selectionWindowPolicy
      })
  );
  const primaryCandidates = decoratedCandidates.filter(candidate => text(candidate.freshness_window) === 'primary');
  const fallbackCandidates = decoratedCandidates.filter(candidate => text(candidate.freshness_window) === 'fallback');
  const primarySelected = selectFinalArticlesFromPool(primaryCandidates, options);
  const fallbackNeeded = primarySelected.length < minArticles;
  const selectionPool = fallbackNeeded
    ? [...primaryCandidates, ...fallbackCandidates]
    : primaryCandidates;
  const selected = fallbackNeeded
    ? selectFinalArticlesFromPool(selectionPool, options)
    : primarySelected;
  const fallbackCandidatesPromoted = selected.filter(candidate => candidate.fallback_window_promoted === true);

  return {
    selected,
    diagnostics: {
      primary_window_candidate_count: primaryCandidates.length,
      primary_window_selected_count: primarySelected.length,
      fallback_window_candidate_count: fallbackCandidates.length,
      fallback_window_consulted: fallbackNeeded && fallbackCandidates.length > 0,
      fallback_window_used: fallbackCandidatesPromoted.length > 0,
      fallback_window_reason: fallbackNeeded
        ? fallbackWindowReason(primarySelected.length, minArticles)
        : '',
      fallback_candidates_promoted: fallbackCandidatesPromoted.map(candidate => ({
        title: candidate.title,
        url: candidate.url,
        normalized_url: candidate.normalized_url,
        freshness_window: candidate.freshness_window,
        days_since_published: candidate.days_since_published
      }))
    }
  };
}

function selectFinalArticles(shortlist, options = {}) {
  return selectFinalArticlesFromPool(shortlist, options);
}

function shortlistCandidateKey(candidate) {
  return text(candidate?.article_identity_key) || text(candidate?.normalized_url) || normalizeUrl(candidateUrl(candidate)) || candidateUrl(candidate) || text(candidate?.title);
}

function shortlistWithFinalCandidates(shortlist, selected, reserve, cap = SHORTLIST_CAP) {
  const requiredCandidates = [...ensureArray(selected), ...ensureArray(reserve)];
  const requiredByKey = new Map();
  for (const candidate of requiredCandidates) {
    const key = shortlistCandidateKey(candidate);
    if (key && !requiredByKey.has(key)) {
      requiredByKey.set(key, candidate);
    }
  }
  const requiredKeys = new Set(requiredByKey.keys());
  const combined = [];
  const seen = new Set();
  const addCandidate = (candidate) => {
    const key = shortlistCandidateKey(candidate);
    if (!key || seen.has(key)) return;
    seen.add(key);
    combined.push(requiredByKey.get(key) || candidate);
  };

  for (const candidate of ensureArray(shortlist)) addCandidate(candidate);
  for (const candidate of requiredCandidates) addCandidate(candidate);

  const limit = Number.isSafeInteger(cap) && cap > 0 ? cap : SHORTLIST_CAP;
  if (combined.length <= limit) return combined;

  let optionalDropCount = combined.length - limit;
  const kept = [];
  for (let index = combined.length - 1; index >= 0; index -= 1) {
    const candidate = combined[index];
    const key = shortlistCandidateKey(candidate);
    if (optionalDropCount > 0 && !requiredKeys.has(key)) {
      optionalDropCount -= 1;
      continue;
    }
    kept.push(candidate);
  }

  return kept.reverse().slice(0, limit);
}

function catchUpCandidateHasEvidence(candidate) {
  return Boolean(
    text(candidate.version_or_release) ||
    text(candidate.api_or_component) ||
    text(candidate.behavior_change) ||
    text(candidate.evidence_summary)
  );
}

function buildCatchUpPool(referenceCandidates, exposureHistory, catchUpPolicy = getCatchUpPolicy()) {
  if (!catchUpPolicy || catchUpPolicy.enabled !== true) return [];
  const eligibleBuckets = new Set(ensureArray(catchUpPolicy.eligibleBuckets));
  const maxAge = Number(catchUpPolicy.maxAgeDays) || 0;
  const history = exposureHistory || { articles: [] };
  return ensureArray(referenceCandidates).filter(candidate => {
    const bucket = text(candidate.relevance_bucket || candidateScope(candidate).relevance_bucket);
    if (!eligibleBuckets.has(bucket)) return false;
    const age = Number(candidate.days_since_published);
    if (!Number.isFinite(age) || age > maxAge) return false;
    if (everCoveredAsNewsletterArticle(articleIdentityKey(candidate), history)) return false;
    if (!catchUpCandidateHasEvidence(candidate)) return false;
    return true;
  });
}

function buildShortlistReport(date, collectedCandidates, options = {}) {
  const rawCandidates = ensureArray(collectedCandidates?.candidates || collectedCandidates);
  const cap = options.cap ?? SHORTLIST_CAP;
  const selectionWindowPolicy = options.selectionWindowPolicy || getSelectionWindowPolicy();
  const {
    shortlist,
    selectionPools,
    excluded,
    referenceContextCandidates,
    windowCandidateCounts
  } = buildEligibleShortlist(rawCandidates, date, cap, { selectionWindowPolicy });
  const selectionCandidatePool = [
    ...ensureArray(selectionPools?.primary),
    ...ensureArray(selectionPools?.fallback)
  ];
  const selectionResult = selectFinalArticlesWithDiagnostics(selectionCandidatePool, {
    ...options,
    selectionWindowPolicy
  });
  let selected = attachRelatedContextToSelected(selectionResult.selected, [
    rawCandidates,
    shortlist,
    excluded,
    referenceContextCandidates
  ]);
  const headlinePolicy = options.headlinePolicy || getHeadlinePolicy();
  const homepageHeadlineState = options.homepageHeadlineState ||
    readHomepageHeadlineState(options.root || process.cwd(), { date, policy: headlinePolicy });
  const headlineSelection = applyHomepageHeadlineSelection({
    date,
    selectedArticles: selected,
    eligibleCandidates: selectionCandidatePool,
    currentState: homepageHeadlineState,
    policy: headlinePolicy,
    newsletterUrl: options.newsletterUrl || `newsletters/${date}/index.html`
  });
  selected = headlineSelection.selected_articles;
  const windowDiagnostics = selectionResult.diagnostics;
  const reserve = reserveCandidates(selectionCandidatePool, selected, options);
  const exposureHistory = options.exposureHistory ||
    (options.root ? readExposureHistory(options.root, date) : null);
  const catchUpPolicy = options.catchUpPolicy || getCatchUpPolicy();
  let catchUpSelected = [];
  const catchUpTarget = Number(catchUpPolicy.targetMainArticles) || articlePolicy.mainArticleCount.min;
  if (catchUpPolicy.enabled === true && selected.length < catchUpTarget) {
    const selectedKeys = new Set(selected.map(item => articleIdentityKey(item)));
    const pool = buildCatchUpPool(referenceContextCandidates, exposureHistory, catchUpPolicy)
      .filter(candidate => !selectedKeys.has(articleIdentityKey(candidate)))
      // Thin-week guard: only promote catch-up candidates that clear the same deterministic
      // selection floor as fresh main articles. The normal path (selectFinalArticlesFromPool)
      // already selects from mainEligible; catch-up otherwise bypasses it and pads the lineup
      // with weak fillers that the fact-checker later drops. main_article_score_eligible already
      // subsumes dated-evidence/source-gap/scope checks, so this single test is enough.
      .filter(candidate => candidate.main_article_score_eligible !== false);
    pool.sort(deterministicCandidateSort);
    const openSlots = Math.max(0, catchUpTarget - selected.length);
    const roomUnderMax = Math.max(0, articlePolicy.mainArticleCount.max - selected.length);
    const take = Math.max(0, Math.min(catchUpPolicy.maxCatchUpArticles, openSlots, roomUnderMax));
    // The catch-up lane must enforce the same release-note dedup that pushUnique applies to primary
    // selection (#500). Otherwise a fresh main article and an older catch-up article from the same
    // CameraX release-note page are both promoted, sharing one source URL across sections, which
    // trips the "Duplicate source URL"/"Shared release-note URL" hard fails on thin days. The growing
    // lineup is checked so two catch-up candidates from the same page cannot slip through together.
    const catchUpAccepted = [];
    for (const candidate of pool) {
      if (catchUpAccepted.length >= take) break;
      const lineup = [...selected, ...catchUpAccepted];
      if (selectedHasSameCameraReleasePage(lineup, candidate)) continue;
      if (lineup.some(existing => candidatesAreDuplicate(existing, candidate))) continue;
      catchUpAccepted.push(candidate);
    }
    catchUpSelected = catchUpAccepted.map(candidate => {
      // Promoting a reference-window candidate to a catch-up main article: clear the
      // reference-window exclusion markers so the editor group-coverage validation does
      // not try to demote it as selection_window_reference_not_main (an invalid reason).
      const cleared = { ...candidate };
      cleared.exclusion_reasons = ensureArray(candidate.exclusion_reasons)
        .filter(reason => !/^selection_window=/.test(text(reason)));
      delete cleared.selection_window_exclusion_reason;
      delete cleared.fallback_window_promoted;
      return {
        ...cleared,
        freshness_window: 'fallback',
        coverage_type: 'catch_up',
        catch_up_age_days: Number(candidate.days_since_published),
        catch_up_origin_window: text(candidate.freshness_window) || 'reference',
        selected: true,
        selected_for_editor: true,
        final_selected: true,
        final_selection_eligibility: 'main'
      };
    });
    selected = [...selected, ...catchUpSelected];
  }
  const warnings = selectionWarnings(selected, { exposureHistory });
  const errors = selectionErrors(selected);
  const composition = compositionSummary(selected);
  const eligibleComposition = compositionSummary(shortlist);
  const groupCoverage = groupCoverageSummary({
    selectedGroupKeys: selected.map(candidateGroupKey),
    renderedGroupKeys: [],
    demotedGroups: []
  });
  const preflightSummary = candidatePoolPreflightSummary(shortlist, selected, reserve);
  const shortageReasonCodes = candidatePoolShortageReasonCodes(preflightSummary);
  const mode = compositionMode(selected, errors);
  const reviewGatePassed = errors.length === 0 && reviewCompositionGatePasses(composition);
  const publishGateReasonSummary = publishReadyGateReasonSummary(composition);
  const publishGateReasonCodes = publishGateReasonSummary.map(reason => reason.code);
  const publishGatePassed = reviewGatePassed && publishGateReasonCodes.length === 0;
  const publishModeResult = resolvePublishMode(composition, getPublishModePolicy());
  const publishReady = publishGatePassed && warnings.length === 0 && mode !== COMPOSITION_MODES.NEEDS_FIX;
  const reserveUrls = new Set(reserve.map(candidate => candidate.normalized_url));
  const reportShortlist = shortlistWithFinalCandidates(shortlist, selected, reserve, cap);
  const markedShortlist = reportShortlist.map(candidate => {
    const candidateKey = shortlistCandidateKey(candidate);
    const match = selected.find(item => shortlistCandidateKey(item) === candidateKey);
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
    selected_group_count: groupCoverage.selected_group_count,
    rendered_group_count: null,
    explicitly_demoted_group_count: 0,
    selected_representative_group_keys: groupCoverage.selected_representative_group_keys,
    rendered_group_keys: [],
    explicitly_demoted_group_keys: [],
    selected_group_summary: groupSummary(selected),
    primary_selected_article_count: selected.length,
    reserve_candidate_count: reserve.length,
    demoted_candidate_count: 0,
    composition_mode: mode,
    selection_composition_mode: mode,
    composition_reason: compositionReason(mode, composition),
    publish_mode: publishModeResult.mode,
    publish_mode_detail: publishModeResult,
    composition_summary: composition,
    eligible_composition_summary: eligibleComposition,
    selection_shortage_hints: selectionShortageHints(eligibleComposition),
    primary_window_candidate_count: windowDiagnostics.primary_window_candidate_count,
    primary_window_selected_count: windowDiagnostics.primary_window_selected_count,
    fallback_window_candidate_count: windowDiagnostics.fallback_window_candidate_count,
    fallback_window_consulted: windowDiagnostics.fallback_window_consulted,
    fallback_window_used: windowDiagnostics.fallback_window_used,
    fallback_window_reason: windowDiagnostics.fallback_window_reason,
    fallback_candidates_promoted: windowDiagnostics.fallback_candidates_promoted,
    selection_window_candidate_counts: windowCandidateCounts,
    selection_window_exclusion_summary: summarizeSelectionWindowExclusions(excluded),
    candidate_pool_preflight_passed: shortageReasonCodes.length === 0,
    candidate_shortage_reviewable: shortageReasonCodes.length > 0,
    candidate_shortage_summary: preflightSummary,
    shortage_reason_codes: shortageReasonCodes,
    source_parser_hints: sourceParserHintsFromShortage(preflightSummary, selectionShortageHints(eligibleComposition)),
    editor_review_required: !publishReady && (mode !== COMPOSITION_MODES.NORMAL || shortageReasonCodes.length > 0),
    ai_selected_article_count: selected.filter(candidate => candidate.ai_slot_candidate).length,
    optional_ai_cpp_selected_article_count: selected.filter(candidate => candidate.optional_ai_cpp_candidate).length,
    relevance_bucket_summary: summarizeBuckets(shortlist),
    selected_relevance_bucket_summary: summarizeBuckets(selected),
    selected_article_group_summary: groupSummary(selected),
    reserve_relevance_bucket_summary: summarizeBuckets(reserve),
    shortlist_cap: cap,
    absolute_min_reviewable_articles: ABSOLUTE_MIN_REVIEWABLE_ARTICLES,
    min_non_fallback_publish_ready_articles: MIN_NON_FALLBACK_PUBLISH_READY_ARTICLES,
    min_final_articles: MIN_FINAL_ARTICLES,
    review_gate_passed: reviewGatePassed,
    publish_gate_passed: publishGatePassed,
    publish_ready_composition_policy: {
      primaryCameraStackMinRequired: publishReadyCompositionPolicy.primaryCameraStackMinRequired,
      directAospCameraOrDriverMinRequired: publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired,
      supportingMainMaxAllowed: publishReadyCompositionPolicy.supportingMainMaxAllowed,
      directAospCameraOrDriverBuckets: [...DIRECT_AOSP_CAMERA_OR_DRIVER_BUCKETS]
    },
    publish_gate_reason_codes: publishGateReasonCodes,
    publish_gate_reason_summary: publishGateReasonSummary,
    underfilled: warnings.length > 0,
    publish_ready: publishReady,
    selection_policy: {
      min_final_articles: MIN_FINAL_ARTICLES,
      candidate_pool_preflight: candidatePoolPreflightPolicy,
      absolute_min_reviewable_articles: ABSOLUTE_MIN_REVIEWABLE_ARTICLES,
      min_non_fallback_publish_ready_articles: MIN_NON_FALLBACK_PUBLISH_READY_ARTICLES,
      publish_ready_composition: {
        primaryCameraStackMinRequired: publishReadyCompositionPolicy.primaryCameraStackMinRequired,
        directAospCameraOrDriverMinRequired: publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired,
        supportingMainMaxAllowed: publishReadyCompositionPolicy.supportingMainMaxAllowed,
        directAospCameraOrDriverBuckets: [...DIRECT_AOSP_CAMERA_OR_DRIVER_BUCKETS]
      },
      max_final_articles: MAX_FINAL_ARTICLES,
      policy_config: POLICY_REL_PATH.replace(/\\/g, '/'),
      article_policy: articlePolicy,
      headline_policy: headlinePolicy,
      shortlist_target_range: '8-12 candidates before Gemini reporter/editor prompts.',
      main_article_score_threshold: MAIN_ARTICLE_SCORE_THRESHOLD,
      minimum_camera_hal_directness: MIN_CAMERA_HAL_DIRECTNESS,
      minimum_scope_relevance: MIN_SCOPE_RELEVANCE,
      selection_window_policy: {
        primarySelectionDays: selectionWindowPolicy.primarySelectionDays,
        fallbackSelectionDays: selectionWindowPolicy.fallbackSelectionDays,
        referenceContextDays: selectionWindowPolicy.referenceContextDays,
        enforcement: 'main_selection_enforced'
      },
      editorial_scope: 'AOSP Camera + Camera Driver + SoC Platform, with configured supporting main buckets allowed by Newsletter Policy.',
      priority_order: [
        ...articlePolicy.primaryCameraStack.buckets,
        ...articlePolicy.supportingMainBuckets,
        ...articlePolicy.forbiddenMainBuckets
      ],
      supporting_main: `Supporting main buckets are allowed when the required Primary Camera Stack count is satisfied: ${articlePolicy.supportingMainBuckets.join(', ')}.`,
      forbidden_main: `Forbidden buckets are not promoted to main article selection: ${articlePolicy.forbiddenMainBuckets.join(', ')}.`
    },
    primary_selected_articles: selected,
    shortlisted_candidates: markedShortlist,
    selected_articles: selected,
    reserve_candidates: reserve,
    reference_context_candidates: referenceContextCandidates,
    demoted_candidates: [],
    excluded_candidates: excluded,
    catch_up_used_count: catchUpSelected.length,
    catch_up_articles: catchUpSelected.map(item => ({
      title: item.title, url: item.url, catch_up_age_days: item.catch_up_age_days
    })),
    selection_warnings: warnings,
    selection_errors: errors,
    headline_decision: headlineSelection.headline_decision,
    headline_latest_inclusion: headlineSelection.headline_latest_inclusion,
    removed_due_to_headline_inclusion: headlineSelection.removed_due_to_headline_inclusion || [],
    homepage_headline_state: headlineSelection.homepage_headline_state,
    headline_policy: headlinePolicy,
    exclusion_reason_summary: summarizeExclusionReasons(excluded)
  });
}

function omitLinkedEvidencePromptFields(candidate = {}) {
  const {
    linked_evidence_summary,
    linkedEvidenceSummary,
    impact_classification,
    impactClassification,
    linked_evidence,
    linkedEvidence,
    linkedEvidenceContext,
    linked_evidence_context,
    raw_excerpt,
    rawExcerpt,
    resolved,
    ...promptCandidate
  } = candidate;
  if (promptCandidate.score_breakdown && typeof promptCandidate.score_breakdown === 'object') {
    const {
      base_total,
      linked_evidence_runtime_bonus,
      linked_evidence_watch_penalty,
      linked_evidence_adjustment,
      ...scoreBreakdown
    } = promptCandidate.score_breakdown;
    return {
      ...promptCandidate,
      score_breakdown: scoreBreakdown
    };
  }
  return promptCandidate;
}

function reporterInputFromShortlist(shortlistReport) {
  const selectedUrls = new Set(ensureArray(shortlistReport.selected_articles).map(candidate => candidate.normalized_url));
  const shortlisted = ensureArray(shortlistReport.shortlisted_candidates);
  const baseIds = shortlisted.map(candidate =>
    text(candidate.source_candidate_hash) ||
    text(candidate.url_hash) ||
    (candidateUrl(candidate) ? normalizedUrlHash(candidateUrl(candidate)) : '') ||
    text(candidate.article_identity_key) ||
    'candidate'
  );
  const baseIdCounts = baseIds.reduce((counts, id) => {
    counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map());
  return {
    date: shortlistReport.date,
    candidates: shortlisted.map((candidate, index) => {
      const baseId = baseIds[index];
      const candidateId = baseIdCounts.get(baseId) > 1 ? `${baseId}-${index + 1}` : baseId;
      return {
        ...omitLinkedEvidencePromptFields(candidate),
        candidate_id: candidateId,
        selected: false,
        final_selected: selectedUrls.has(candidate.normalized_url),
        selected_for_editor: selectedUrls.has(candidate.normalized_url)
      };
    })
  };
}

module.exports = {
  ABSOLUTE_MIN_REVIEWABLE_ARTICLES,
  MIN_NON_FALLBACK_PUBLISH_READY_ARTICLES,
  COMPOSITION_MODES,
  SHORTLIST_CAP,
  RESERVE_MIN_CANDIDATES,
  RESERVE_MAX_CANDIDATES,
  MIN_FINAL_ARTICLES,
  MAX_FINAL_ARTICLES,
  MAIN_ARTICLE_SCORE_THRESHOLD,
  LINKED_EVIDENCE_RUNTIME_BONUS,
  LINKED_EVIDENCE_WATCH_PENALTY,
  MIN_CAMERA_HAL_DIRECTNESS,
  buildCatchUpPool,
  buildShortlistReport,
  candidatePoolPreflightSummary,
  candidatePoolShortageReasonCodes,
  candidatesAreDuplicate,
  compositionMode,
  compositionSummary,
  exclusionReasons,
  hasConcreteApiComponent,
  hasFallbackRelevanceHint,
  hasPlatformSignalTerm,
  freshnessWindowMetadata,
  normalizeTitle,
  normalizeUrl,
  normalizedUrlHash,
  publishGatePasses,
  publishReadyGateReasonCodes,
  publishReadyGateReasonSummary,
  reviewCompositionGatePasses,
  reporterInputFromShortlist,
  scoreCandidate,
  selectFinalArticles,
  selectionErrors,
  selectionShortageHints,
  selectionWarnings,
  summarizeExclusionReasons,
  titleSimilarity
};
