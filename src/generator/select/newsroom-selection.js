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
  freshnessAnchorDate,
  candidateUrl,
  candidateSource
} = require('./selection-candidate-fields');
const {
  coverageForAnchorDate,
  coverageAgeDays,
  classifyCoverageWindow
} = require('../../shared/common/coverage-week');
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
} = require('../../shared/domain/aosp-camera-scope');
const {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  NATIVE_TOOLING_WORKFLOW_TYPE,
  attachRelatedContextToSelected,
  excludeParentRoundupContainers,
  candidateGroupKey,
  groupCoverageSummary,
  isNativeToolingWorkflow,
  seriesKey,
  seriesPatchNumber
} = require('../../shared/common/article-groups');
const {
  dateQualityForCandidate,
  monthRangeOverlapsWindow
} = require('../../shared/common/date-signals');
const {
  articleIdentityKey
} = require('../../shared/common/article-identity');
const {
  annotateArticleExposure,
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
  getMailingListPatchMainArticlePolicy,
  getPublishModePolicy,
  getPublishReadyCompositionPolicy,
  getSelectionWindowPolicy
} = require('../../shared/common/newsletter-policy');
const { resolvePublishMode } = require('./publish-mode');
const {
  applyMailingListPatchEligibilityToCandidate
} = require('./mailing-list-patch-eligibility');

const publishReadyCompositionPolicy = getPublishReadyCompositionPolicy();

// month 정밀도 후보(AOSP Site Updates의 월별 묶음 행)는 그 달 어느 날의 변경인지 알 수 없어
// 날짜가 달의 1일로 채워진다. 나이는 계속 1일 기준(가장 오래된 쪽)으로 보수적으로 재서 main
// 선정 창 등급을 느슨하게 만들지 않는다. 다만 stale 탈락만은 달 범위 겹침으로 구제한다 —
// 수집(withinLookback)도 같은 겹침 판정을 쓰는데 선정만 1일 기준 점으로 잘라내면 같은 후보가
// 수집에는 들어오고 선정에서 통째로 사라진다. 실측 2026-08-10: AOSP Camera ITS 문서 갱신
// 2건("sub-camera testing 가이드", "scene0 fast-FAIL 설명")이 40일령으로 계산돼 reference
// 창(35일) 밖으로 밀려 참고 섹션에도 남지 않았다.
// 겹침 판정 방식만 같고 창 길이는 서로 다른 knob이다(수집=runtimeConfig.lookbackDays,
// 선정=policy.referenceContextDays). 두 값을 계약으로 묶지는 않는다.
// 창 상한만 coverage 주의 끝(E, coverage_end_exclusive_at)으로 바꾼다 — 실행일(오늘)을
// 상한으로 쓰면 같은 후보가 실행 요일에 따라 구제 여부가 흔들린다. coverage 앵커는 실행
// 요일과 무관하게 고정되므로 이 겹침 판정도 고정된다.
function monthRangeStillInReferenceWindow(candidate, coverage, policy) {
  if (datePrecision(candidate) !== 'month') return false;
  const windowEndMs = new Date(coverage.coverage_end_exclusive_at).getTime();
  const windowStartMs = windowEndMs - policy.referenceContextDays * 24 * 60 * 60 * 1000;
  return monthRangeOverlapsWindow(selectionDate(candidate), windowStartMs, windowEndMs);
}

// 선정 창(primary/fallback/reference/stale)의 시간 anchor는 실행일(오늘)이 아니라 직전
// 완결 UTC ISO 주(coverage)다 — 같은 기사가 실행 요일에 따라 다른 창에 떨어지는 mislabel을
// 막는다. classifyCoverageWindow가 나이 등급을 매기고, 여기서는 문구·month 겹침 구제만 얹는다.
// newsletterDate가 비었거나 형식이 안 맞으면(레거시 호출부 호환) 오늘(KST)로 채운다 — 이
// 함수 자체는 항상 이렇게 동작했고, anchor 누락을 막는 책임은 상위 진입점
// (selectFinalArticlesWithDiagnostics)의 throw가 진다.
function freshnessWindowMetadata(candidate, newsletterDate, policy = getSelectionWindowPolicy(), options = {}) {
  const anchorDate = freshnessAnchorDate(newsletterDate);
  const coverage = coverageForAnchorDate(anchorDate, options.coverageWeekKeyOverride);
  const publishedAt = selectionDate(candidate);
  const ageDays = coverageAgeDays(publishedAt, coverage);
  // primarySelectionDays는 coverage 주(ISO 7일) 구조 자체라 분류에 쓰지 않는다 — fallback/
  // reference 경계만 정책값을 그대로 넘겨 노브가 실제로 동작하게 한다(기본 21/35).
  const classification = classifyCoverageWindow(publishedAt, coverage, {
    fallbackDays: policy.fallbackSelectionDays,
    referenceDays: policy.referenceContextDays
  });
  const precision = datePrecision(candidate);
  const precisionNote = precision === 'month' ? 'month-level date precision; ' : '';
  const dateEvidence = selectionDateEvidence(candidate);
  const dateLabel = dateEvidence.date_field === 'effective_date' ? 'effective_date' : 'published';
  const coverageWeekLabel = `coverage week ${coverage.coverage_week_key} (${coverage.coverage_start_date} to ${coverage.coverage_end_date})`;

  if (classification === 'unknown') {
    return {
      freshness_window: 'unknown',
      days_since_published: null,
      selection_window_reason: 'missing or invalid published date'
    };
  }

  if (classification === 'not_yet_eligible') {
    return {
      freshness_window: 'not_yet_eligible',
      days_since_published: ageDays,
      selection_window_reason: `${precisionNote}${dateLabel} date is after ${coverageWeekLabel} ends; not yet eligible for this coverage week`
    };
  }

  if (classification === 'primary') {
    return {
      freshness_window: 'primary',
      days_since_published: ageDays,
      selection_window_reason: `${precisionNote}within ${coverageWeekLabel} (based on ${dateLabel})`
    };
  }

  if (classification === 'fallback') {
    return {
      freshness_window: 'fallback',
      days_since_published: ageDays,
      selection_window_reason: `${precisionNote}${ageDays} day(s) before ${coverageWeekLabel}; within fallback window (based on ${dateLabel})`
    };
  }

  if (classification === 'reference') {
    return {
      freshness_window: 'reference',
      days_since_published: ageDays,
      selection_window_reason: `${precisionNote}${ageDays} day(s) before ${coverageWeekLabel}; within reference window (based on ${dateLabel})`
    };
  }

  if (monthRangeStillInReferenceWindow(candidate, coverage, policy)) {
    return {
      freshness_window: 'reference',
      days_since_published: ageDays,
      selection_window_reason: `${precisionNote}month range still overlaps ${coverageWeekLabel}'s reference window (based on ${dateLabel})`
    };
  }

  return {
    freshness_window: 'stale',
    days_since_published: ageDays,
    selection_window_reason: `${precisionNote}older than ${coverageWeekLabel}'s reference window (based on ${dateLabel})`
  };
}

function candidatesAreDuplicate(left, right) {
  // 같은 패치 시리즈(lore.kernel.org cover letter + 각 패치, patchwork.libcamera.org 시리즈 조각)는
  // URL/title이 모두 달라도 하나의 main 기사로 묶어야 한다. 시리즈 키가 같으면 즉시 중복으로 본다.
  const leftSeries = seriesKey(left);
  if (leftSeries && leftSeries === seriesKey(right)) return true;
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
  const candidateSeries = seriesKey(candidate);
  if (candidateSeries && candidateSeries === seriesKey(existing)) {
    return seriesPatchNumber(candidate) < seriesPatchNumber(existing);
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

function decorateCandidate(rawCandidate, newsletterDate, options = {}) {
  // Upgrade strong-evidence project mailing-list patches to main-article
  // eligible here, at the single per-candidate decoration point, so the
  // upgraded source quality flows through the shortlist, reporter input,
  // editor validation, and the quality gate alike.
  const candidate = applyMailingListPatchEligibilityToCandidate(
    rawCandidate,
    options.mailingListPatchPolicy || getMailingListPatchMainArticlePolicy()
  );
  const selectionWindowPolicy = options.selectionWindowPolicy || getSelectionWindowPolicy();
  const scope = candidateScope(candidate);
  const score_breakdown = scoreCandidate(candidate, newsletterDate, options.coverageWeekKeyOverride);
  const headline = computeHeadlineScore({
    ...candidate,
    ...scope,
    score_breakdown
  }, options.headlinePolicy || getHeadlinePolicy());
  const score_filter_reasons = scoreFilterReasons(score_breakdown);
  const windowMetadata = freshnessWindowMetadata(candidate, newsletterDate, selectionWindowPolicy, {
    coverageWeekKeyOverride: options.coverageWeekKeyOverride
  });
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
    date_evidence_url: text(candidate.date_evidence_url || candidate.dateEvidenceUrl),
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
  if (window === 'not_yet_eligible') return 'not_yet_eligible_not_main';
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
  const notYetEligible = [];

  for (const candidate of ensureArray(candidates)) {
    const window = text(candidate.freshness_window);
    if (window === 'primary') {
      primary.push(candidate);
    } else if (window === 'fallback') {
      fallback.push(candidate);
    } else if (window === 'not_yet_eligible') {
      // E(coverage 주 끝) 이후에 발행된 후보는 stale/reference와 다른 이유로 제외된다 —
      // 오래된 게 아니라 아직 이 coverage 주에 들어오지 않았을 뿐이다. 참고 섹션에도
      // 넣지 않는다(참고는 지난 신호를 보여주는 자리이지, 아직 오지 않은 다음 주 신호를
      // 미리 보여주는 자리가 아니다). 별도 진단 카운트(not_yet_eligible_count)로만 남긴다.
      notYetEligible.push(appendSelectionWindowExclusion(candidate));
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
    windowExcluded,
    notYetEligible
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
  const decorateOptions = {
    selectionWindowPolicy: options.selectionWindowPolicy,
    coverageWeekKeyOverride: options.coverageWeekKeyOverride
  };
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
    excluded: excluded.concat(windows.windowExcluded).concat(windows.notYetEligible),
    referenceContextCandidates: windows.reference.slice(0, cap),
    windowCandidateCounts: {
      primary: windows.primary.length,
      fallback: windows.fallback.length,
      reference: windows.reference.length,
      excluded: windows.windowExcluded.length,
      not_yet_eligible: windows.notYetEligible.length
    },
    notYetEligibleCount: windows.notYetEligible.length
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
      selectionWindowPolicy: options.selectionWindowPolicy,
      coverageWeekKeyOverride: options.coverageWeekKeyOverride
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
  const alreadyWindowed = rawCandidates.some(candidate => text(candidate.freshness_window));
  const hasCoverageAnchor = Boolean(options.date) || Boolean(options.coverageWeekKeyOverride);
  // coverage 앵커 없이 조용히 오늘로 폴백하면 같은 후보가 실행 요일에 따라 다른
  // freshness_window로 mislabel된다 — coverage 정합의 전제가 깨진다. 후보가 이미
  // freshness_window를 갖고 있으면(상위에서 decorate를 마쳤으면) 여기서 다시 anchor가
  // 필요하지 않으므로 그 경우는 통과시킨다.
  if (!alreadyWindowed && rawCandidates.length > 0 && !hasCoverageAnchor) {
    throw new Error(
      'selectFinalArticlesWithDiagnostics requires options.date (coverage anchor, YYYY-MM-DD) ' +
      'or options.coverageWeekKeyOverride; silently defaulting to the run date risks mislabeling the coverage week.'
    );
  }
  const enforceSelectionWindow = alreadyWindowed || hasCoverageAnchor;
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
        selectionWindowPolicy: options.selectionWindowPolicy,
        coverageWeekKeyOverride: options.coverageWeekKeyOverride
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

// release 채널 후보(#825): collectionModeHint가 release-note-watch인 소스에서 온 후보.
// 릴리스 이벤트는 빈도가 낮고 반감기가 길어 catch-up에서 별도 상한(release-class 레인)을 갖는다.
function isReleaseClassCandidate(candidate = {}) {
  return text(candidate.source_collection_mode || candidate.sourceCollectionMode) === 'release-note-watch';
}

// release-class 레인이 아무것도 승급하지 않으면 산출물에 흔적이 전혀 남지 않아, 나중에
// "자격 있는 릴리스가 없었다"와 "자리가 없었다"를 구분할 수 없다(#838, 실측 2026-08-03).
// 레인이 열려 있는 한 아래 사유 중 하나를 항상 기록한다.
//
// 순서가 곧 계약이다. 승급이 있었으면 다른 사유는 성립하지 않으므로 admitted가 최우선이고
// (레인이 꺼진 주에도 일반 레인이 릴리스를 가져갈 수 있다), 자리가 없어 후보를 평가조차
// 못 한 주는 중복보다 먼저 보고한다 — 슬롯 기아는 이 진단이 찾으려는 신호 자체라 중복
// 스킵 1건에 가려지면 안 된다. 마지막 반환은 사실과 어긋나는 사유를 재사용하는 대신
// 분류 실패임을 그대로 드러낸다(pool_size > 0인데 no_eligible_candidate를 찍지 않는다).
function releaseClassBlockedReason(observation) {
  if (observation.admitted > 0) return '';
  if (!observation.lane_enabled) return 'lane_disabled';
  if (observation.pool_size === 0) return 'no_eligible_candidate';
  if (observation.lineup_reached_max) return 'lineup_at_max';
  if (observation.release_page_skips > 0) return 'duplicate_release_page';
  return 'unclassified';
}

// date는 이 호의 이슈 날짜다. 게재 이력 필터가 쿨다운 검사와 같은 as-of 기준을 써야 같은 date
// 재실행이 그 호가 catch-up 레인으로 낸 기사를 자기 이력으로 배제하지 않는다.
function buildCatchUpPool(referenceCandidates, exposureHistory, catchUpPolicy = getCatchUpPolicy(), date) {
  if (!catchUpPolicy || catchUpPolicy.enabled !== true) return [];
  const eligibleBuckets = new Set(ensureArray(catchUpPolicy.eligibleBuckets));
  const maxAge = Number(catchUpPolicy.maxAgeDays) || 0;
  const history = exposureHistory || { articles: [] };
  return ensureArray(referenceCandidates).filter(candidate => {
    // month 정밀도 후보는 날짜가 달의 1일로 채워진 값이라 그 달 어느 날인지 모른다. catch-up이
    // main 기사로 올리면 모르는 날짜가 기사 날짜로 발행된다. 참고 레인까지만 남긴다.
    if (datePrecision(candidate) === 'month') return false;
    const bucket = text(candidate.relevance_bucket || candidateScope(candidate).relevance_bucket);
    if (!eligibleBuckets.has(bucket)) return false;
    const age = Number(candidate.days_since_published);
    if (!Number.isFinite(age) || age > maxAge) return false;
    if (everCoveredAsNewsletterArticle(articleIdentityKey(candidate), history, { date })) return false;
    if (!catchUpCandidateHasEvidence(candidate)) return false;
    return true;
  });
}

// 수집(01) 또는 병합 단계가 만든 후보 payload가 top-level에 실어 온 coverage lineage다.
// collectedCandidates가 배열(레거시 호출부·테스트 fixture)이면 이 필드들은 애초에 없으므로
// 전부 빈 값으로 떨어진다 — buildShortlistReport 자체는 그 값 없이도 동작해 왔으므로 안전하다.
function collectedCoverageLineage(collectedCandidates) {
  const coverage = collectedCandidates && typeof collectedCandidates === 'object' && !Array.isArray(collectedCandidates)
    ? collectedCandidates.coverage
    : null;
  const hasCoverage = coverage && typeof coverage === 'object';
  return {
    coverage_week_key: hasCoverage ? String(coverage.coverage_week_key || '') : '',
    coverage_start_date: hasCoverage ? String(coverage.coverage_start_date || '') : '',
    coverage_end_date: hasCoverage ? String(coverage.coverage_end_date || '') : '',
    generation_anchor_date: String(collectedCandidates?.generation_anchor_date || ''),
    carry_forward_status: String(collectedCandidates?.carry_forward_status || ''),
    carry_source: collectedCandidates?.carry_source || null,
    not_yet_eligible_overflow: collectedCandidates?.not_yet_eligible_overflow === true
  };
}

const REPUBLICATION_COOLDOWN_EXCLUSION_REASON = 'published as a main article within the republication cooldown';

// 이미 main 기사로 발행된 URL을 쿨다운 안에 다시 올리지 못하게, 선정 상류에서 걷어낸다.
//
// 상류인 이유: reconcileCoverage가 reserve를 main으로 승급시키므로(gemini-newsroom-newsletter.js)
// selected만 걸러서는 구멍이 남는다. selected와 reserve가 함께 읽는 selectionPools에서 빼야 두
// 통로가 같이 닫힌다.
//
// 술어가 쿨다운(21일)인 이유: everCoveredAsNewsletterArticle은 시간 제한이 없어서, 같은 URL로
// 내용이 갱신되는 페이지(developer.android.com/latest-updates, ASB overview — 둘 다 실제 이력에
// 있다)를 영원히 못 쓰게 만든다. 그건 쓸 수 있는 기사를 막는 결함이다.
//
// main_article_score_eligible에 이력 사유를 섞지 않은 것도 의도다: 그건 점수 게이트이고 catch-up
// 레인이 재사용하는 공유 길목이라, 좁히면 이 이슈와 무관한 판정까지 함께 좁아진다.
function withoutRepublicationCooldown(eligible, exposureHistory, date, cap) {
  const selectionPools = eligible.selectionPools;
  if (!exposureHistory) return { shortlist: eligible.shortlist, selectionPools, blocked: [] };
  const blocked = [];
  const blockedKeys = new Set();
  const poolCandidates = [
    ...ensureArray(selectionPools?.primary),
    ...ensureArray(selectionPools?.fallback)
  ];
  for (const candidate of poolCandidates) {
    const key = articleIdentityKey(candidate);
    if (blockedKeys.has(key)) continue;
    if (!annotateArticleExposure(candidate, exposureHistory, { date }).published_within_cooldown) continue;
    blockedKeys.add(key);
    blocked.push({
      ...candidate,
      exclusion_reasons: [
        ...ensureArray(candidate.exclusion_reasons),
        REPUBLICATION_COOLDOWN_EXCLUSION_REASON
      ]
    });
  }
  if (blocked.length === 0) return { shortlist: eligible.shortlist, selectionPools, blocked };
  const keep = candidates => ensureArray(candidates)
    .filter(candidate => !blockedKeys.has(articleIdentityKey(candidate)));
  const primary = keep(selectionPools?.primary);
  const fallback = keep(selectionPools?.fallback);
  return {
    // shortlist는 cap을 필터 뒤에 적용해 다시 만든다. buildEligibleShortlist가 이미 자른 결과에서
    // 빼기만 하면 cap에 걸린 주에 빈자리가 cap 밖 후보로 채워지지 않아, eligible_candidate_count와
    // 거기서 파생되는 eligible_composition_summary·selection_shortage_hints·
    // candidate_pool_preflight가 실제 후보 풀보다 작게 보고된다(2026-08-03 실측: 12 → 9).
    // 선정과 reserve는 cap 없는 selectionPools를 읽으므로 편성은 이 순서와 무관하다.
    shortlist: [...primary, ...fallback].slice(0, cap),
    selectionPools: { primary, fallback },
    blocked
  };
}

function buildShortlistReport(date, collectedCandidates, options = {}) {
  const rawCandidates = ensureArray(collectedCandidates?.candidates || collectedCandidates);
  const coverageLineage = collectedCoverageLineage(collectedCandidates);
  const cap = options.cap ?? SHORTLIST_CAP;
  const selectionWindowPolicy = options.selectionWindowPolicy || getSelectionWindowPolicy();
  const eligible = buildEligibleShortlist(rawCandidates, date, cap, {
    selectionWindowPolicy,
    coverageWeekKeyOverride: options.coverageWeekKeyOverride
  });
  const {
    referenceContextCandidates,
    windowCandidateCounts,
    notYetEligibleCount
  } = eligible;
  const exposureHistory = options.exposureHistory ||
    (options.root ? readExposureHistory(options.root, date) : null);
  const cooldownFiltered = withoutRepublicationCooldown(eligible, exposureHistory, date, cap);
  const shortlist = cooldownFiltered.shortlist;
  const selectionPools = cooldownFiltered.selectionPools;
  const excluded = eligible.excluded.concat(cooldownFiltered.blocked);
  const selectionCandidatePool = [
    ...ensureArray(selectionPools?.primary),
    ...ensureArray(selectionPools?.fallback)
  ];
  const selectionResult = selectFinalArticlesWithDiagnostics(selectionCandidatePool, {
    ...options,
    date,
    selectionWindowPolicy
  });
  let selected = attachRelatedContextToSelected(selectionResult.selected, [
    rawCandidates,
    shortlist,
    excluded,
    referenceContextCandidates
  ]);
  // parent-roundup 컨테이너 페이지는 standalone main에서 제외한다(자식 개별 기사는 유지). 제외된
  // 컨테이너는 selected에서 빠져 reserve/watch로 남고, editor가 묶음글 URL을 기사 source로 쓰다
  // blocked_context로 막히는 일을 애초에 없앤다.
  selected = excludeParentRoundupContainers(selected).kept;
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
  let reserve = reserveCandidates(selectionCandidatePool, selected, options);
  const catchUpPolicy = options.catchUpPolicy || getCatchUpPolicy();
  let catchUpSelected = [];
  const catchUpTarget = Number(catchUpPolicy.targetMainArticles) || articlePolicy.mainArticleCount.min;
  // release-class 레인(#825): release 채널 후보는 주간 발행 주기와 신선도 창 사이에 끼면
  // thin week가 올 때까지 영원히 기회가 없다(실측: libcamera v0.7.2 — W29 소스 미등록,
  // W30/W31은 primary 창 밖 fallback 창인데 fallback은 primary가 min을 못 채울 때만 참조돼
  // 3주 연속 어느 선정 산출물에도 등장 0). 릴리스는 빈도가 낮고 반감기가 길므로, 신규
  // 선정이 target을 채운 주에도 mainArticleCount.max 아래 여유 슬롯을 정책 상한만큼 내준다.
  // 일반 레인과 같은 pool 필터(main_article_score_eligible 포함)·중복 가드·게재 이력을
  // 그대로 지나므로 품질 게이트 약화는 없다. 일반(thin-week) 레인은 기존대로 reference 창만
  // 보고, release-class 레인만 fallback 창 후보까지 본다(fallback 창이 릴리스가 실제로
  // 갇히는 지점이다).
  const maxReleaseClassArticles = Number(catchUpPolicy.maxReleaseClassArticles) || 0;
  const thinWeek = selected.length < catchUpTarget;
  const releaseClassObservation = {
    lane_enabled: catchUpPolicy.enabled === true && maxReleaseClassArticles > 0,
    pool_size: 0,
    admitted: 0,
    // 릴리스 페이지 dedup만 센다. 일반 중복(candidatesAreDuplicate)은 같은 함수로
    // shortlist 단계(buildEligibleShortlist)가 먼저 걸러 사실상 여기까지 오지 않으므로,
    // 그 가드를 사유에 섞으면 이름과 실제가 어긋난다. 제목 유사도 판정이 비추이적이라
    // 드물게 도달할 수는 있는데, 그때는 카운터가 오르지 않아 unclassified로 떨어진다 —
    // 틀린 사유를 찍는 대신 분류 실패가 그대로 드러난다.
    release_page_skips: 0,
    lineup_reached_max: false
  };
  if (catchUpPolicy.enabled === true && (thinWeek || maxReleaseClassArticles > 0)) {
    const selectedKeys = new Set(selected.map(item => articleIdentityKey(item)));
    const poolSourceCandidates = maxReleaseClassArticles > 0
      ? [...ensureArray(selectionPools?.fallback), ...ensureArray(referenceContextCandidates)]
      : referenceContextCandidates;
    const pool = buildCatchUpPool(poolSourceCandidates, exposureHistory, catchUpPolicy, date)
      .filter(candidate => !selectedKeys.has(articleIdentityKey(candidate)))
      // Thin-week guard: only promote catch-up candidates that clear the same deterministic
      // selection floor as fresh main articles. The normal path (selectFinalArticlesFromPool)
      // already selects from mainEligible; catch-up otherwise bypasses it and pads the lineup
      // with weak fillers that the fact-checker later drops. main_article_score_eligible already
      // subsumes dated-evidence/source-gap/scope checks, so this single test is enough.
      .filter(candidate => candidate.main_article_score_eligible !== false);
    pool.sort(deterministicCandidateSort);
    releaseClassObservation.pool_size = pool.filter(isReleaseClassCandidate).length;
    const openSlots = thinWeek ? Math.max(0, catchUpTarget - selected.length) : 0;
    const generalTake = Math.max(0, Math.min(catchUpPolicy.maxCatchUpArticles, openSlots));
    // The catch-up lane must enforce the same release-note dedup that pushUnique applies to primary
    // selection (#500). Otherwise a fresh main article and an older catch-up article from the same
    // CameraX release-note page are both promoted, sharing one source URL across sections, which
    // trips the "Duplicate source URL"/"Shared release-note URL" hard fails on thin days. The growing
    // lineup is checked so two catch-up candidates from the same page cannot slip through together.
    const catchUpAccepted = [];
    const laneByCandidate = new Map();
    let generalAdmitted = 0;
    let releaseClassAdmitted = 0;
    for (const candidate of pool) {
      const lineup = [...selected, ...catchUpAccepted];
      if (lineup.length >= articlePolicy.mainArticleCount.max) {
        releaseClassObservation.lineup_reached_max = true;
        break;
      }
      if (selectedHasSameCameraReleasePage(lineup, candidate)) {
        if (isReleaseClassCandidate(candidate)) releaseClassObservation.release_page_skips += 1;
        continue;
      }
      if (lineup.some(existing => candidatesAreDuplicate(existing, candidate))) continue;
      // 일반 레인은 기존 계약 유지: reference 창 후보만 채운다.
      if (generalAdmitted < generalTake && text(candidate.freshness_window) === 'reference') {
        catchUpAccepted.push(candidate);
        laneByCandidate.set(candidate, 'fill_open_slots');
        generalAdmitted += 1;
        continue;
      }
      if (releaseClassAdmitted < maxReleaseClassArticles && isReleaseClassCandidate(candidate)) {
        catchUpAccepted.push(candidate);
        laneByCandidate.set(candidate, 'release_class');
        releaseClassAdmitted += 1;
      }
    }
    // 승급 수는 레인 라벨이 아니라 후보의 release 채널 여부로 센다. reference 창 릴리스는
    // 일반 레인이 먼저 가져갈 수 있는데, 그걸 미승급으로 세면 진단이 사실과 어긋난다.
    // PR body의 release-class 건수(pr-body-diagnostic-sections.js)는 레인 라벨로 세므로
    // 그 주에는 두 수가 다를 수 있다. 서로 다른 질문에 답하는 값이라 의도된 차이다.
    releaseClassObservation.admitted = catchUpAccepted.filter(isReleaseClassCandidate).length;
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
        catch_up_lane: laneByCandidate.get(candidate) || 'fill_open_slots',
        catch_up_age_days: Number(candidate.days_since_published),
        catch_up_origin_window: text(candidate.freshness_window) || 'reference',
        selected: true,
        selected_for_editor: true,
        final_selected: true,
        final_selection_eligibility: 'main'
      };
    });
    selected = [...selected, ...catchUpSelected];
    // 승급된 catch-up 후보는 reserve에서 뺀다. release-class 레인이 fallback 창을 쓰면서
    // reserve의 fallback 좌석과 같은 후보를 잡을 수 있게 됐는데, 그대로 두면 같은 기사가
    // selected_articles와 reserve_candidates(그리고 article-capsules의 reserve_capsules)에
    // 동시에 실려 리뷰 산출물이 자기모순이 된다(선례: gemini-newsroom-newsletter.js의
    // coverage-reconciliation 승급 eviction).
    if (catchUpSelected.length > 0) {
      const catchUpKeys = new Set(catchUpSelected.map(item => articleIdentityKey(item)));
      reserve = reserve.filter(candidate => !catchUpKeys.has(articleIdentityKey(candidate)));
    }
  }
  const warnings = selectionWarnings(selected, { exposureHistory, date });
  const errors = selectionErrors(selected);
  const composition = compositionSummary(selected);
  const eligibleComposition = compositionSummary(shortlist);
  // 부족 힌트는 "수집·파싱이 이 버킷을 만들어 냈는가"에 답하는 값이다(렌더 라벨도 Source/parser
  // recovery hint다). 재게재 차단은 후보가 없어서가 아니라 이미 발행해서 빠진 것이므로, 차단분을
  // 되돌린 구성으로 힌트를 만든다. 안 그러면 한 버킷의 유일한 후보가 막힌 주에
  // OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR가 새로 붙어 멀쩡한 파서를 고치라고 지시한다.
  // 풀이 실제로 얇다는 신호는 preflightSummary(차단 뒤 shortlist로 계산)가 그대로 낸다.
  const shortageHints = selectionShortageHints(
    compositionSummary([...shortlist, ...cooldownFiltered.blocked]));
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
    selection_shortage_hints: shortageHints,
    primary_window_candidate_count: windowDiagnostics.primary_window_candidate_count,
    primary_window_selected_count: windowDiagnostics.primary_window_selected_count,
    fallback_window_candidate_count: windowDiagnostics.fallback_window_candidate_count,
    fallback_window_consulted: windowDiagnostics.fallback_window_consulted,
    fallback_window_used: windowDiagnostics.fallback_window_used,
    fallback_window_reason: windowDiagnostics.fallback_window_reason,
    fallback_candidates_promoted: windowDiagnostics.fallback_candidates_promoted,
    selection_window_candidate_counts: windowCandidateCounts,
    not_yet_eligible_count: notYetEligibleCount,
    // 수집 단계가 계산한 대상 주(coverage)와 carry-forward 판정을 그대로 옮긴다(coverage
    // lineage). generation-status·selection-report·PR 본문이 이 값을 그대로 인용하므로,
    // 여기서 빠지면 하류 전부가 다시 'unknown'으로 샌다.
    ...coverageLineage,
    selection_window_exclusion_summary: summarizeSelectionWindowExclusions(excluded),
    candidate_pool_preflight_passed: shortageReasonCodes.length === 0,
    candidate_shortage_reviewable: shortageReasonCodes.length > 0,
    candidate_shortage_summary: preflightSummary,
    shortage_reason_codes: shortageReasonCodes,
    source_parser_hints: sourceParserHintsFromShortage(preflightSummary, shortageHints),
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
    release_class_catch_up: {
      pool_size: releaseClassObservation.pool_size,
      admitted: releaseClassObservation.admitted,
      blocked_reason: releaseClassBlockedReason(releaseClassObservation)
    },
    // 재게재 차단은 exclusion_reason_summary에도 실리지만 그쪽은 상위 10개로 잘린다(사유 하나에
    // 후보 1~2건이면 늘 뒤로 밀린다). 선례(#838의 release_class_catch_up)와 같은 이유로 전용
    // 자리를 둔다: 전체 shortlistReport가 담기는 shortlisted-candidates.json은 커밋되지 않으므로,
    // 이 값이 selection-report.json까지 가야 과차단을 커밋 이력만으로 판정할 수 있다.
    republication_cooldown_blocked: {
      // 게이트가 돌고 아무것도 안 막은 주와 이력이 아예 안 실린 주를 구별한다. 둘 다 count 0으로
      // 접히면 #963의 실패 유형(배선이 끊겨 게이트가 조용히 죽음)이 건강한 주와 산출물이
      // 바이트 동일이라, 배선이 다시 회귀해도 커밋 이력으로 판정할 수 없다.
      history_loaded: Boolean(exposureHistory),
      count: cooldownFiltered.blocked.length,
      urls: cooldownFiltered.blocked.map(candidate => text(candidate.url)).filter(Boolean)
    },
    catch_up_used_count: catchUpSelected.length,
    catch_up_articles: catchUpSelected.map(item => ({
      title: item.title, url: item.url, catch_up_age_days: item.catch_up_age_days,
      catch_up_lane: item.catch_up_lane
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
  decorateCandidate,
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
  selectFinalArticlesWithDiagnostics,
  selectionErrors,
  selectionShortageHints,
  selectionWarnings,
  summarizeExclusionReasons,
  titleSimilarity
};
