'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  text,
  number
} = require('./selection-candidate-fields');
const {
  candidateScope,
  hasSelectableScope,
  isPrimaryCameraStackScope,
  isForbiddenMainScope
} = require('./selection-candidate-scoring');
const {
  COMPOSITION_MODES
} = require('./selection-policy-constants');
const {
  BUCKETS,
  ANDROID_SUPPORTING,
  compositionBucket
} = require('../../shared/domain/aosp-camera-scope');
const {
  candidateGroupKey
} = require('../../shared/common/article-groups');
const {
  annotateArticleExposure
} = require('../reporter/article-exposure-history');
const {
  articlePolicy,
  articleCountRangeText,
  candidatePoolPreflightPolicy,
  getPublishReadyCompositionPolicy,
  publishGateCriteriaText
} = require('../../shared/common/newsletter-policy');

function resolvePublishReadyCompositionPolicy(policy = getPublishReadyCompositionPolicy()) {
  if (policy?.articlePolicy?.publishReadyComposition) {
    return policy.articlePolicy.publishReadyComposition;
  }
  if (policy?.publishReadyComposition) {
    return policy.publishReadyComposition;
  }
  return policy;
}

function selectionWarnings(selected, options = {}) {
  const warnings = [];
  const items = ensureArray(selected);
  if (!options.exposureHistory) return warnings;
  for (const article of items) {
    // 이슈 date 기준으로 판정해야 리플레이·carry 실행에서 같은 입력이 같은 경고를 낸다.
    const annotated = annotateArticleExposure(article, options.exposureHistory, { date: options.date });
    if (annotated.published_within_cooldown) {
      // newsletter_article_date가 생기기 전 레코드는 cooldown_until만 갖는다. 차단은 그것만으로
      // 성립하지만 발행일은 모르므로, 문장이 "last published "로 끊기지 않게 모른다고 쓴다.
      warnings.push(
        `repeated_event_within_cooldown: "${article.title || article.headline || article.article_identity_key}" — last published ${annotated.last_newsletter_date || 'date unknown'}`
      );
    }
  }
  return warnings;
}

function selectionErrors(selected) {
  const items = ensureArray(selected);
  const errors = [];
  const primaryCount = items.filter(isPrimaryCameraStackScope).length;
  const forbiddenCount = items.filter(isForbiddenMainScope).length;
  if (items.length < articlePolicy.mainArticleCount.min) {
    errors.push(`Only ${items.length} eligible non-duplicate final article input(s) remain after deterministic filtering; Newsletter Policy requires at least ${articlePolicy.mainArticleCount.min}.`);
  }
  if (items.length > articlePolicy.mainArticleCount.max) {
    errors.push(`${items.length} eligible final article input(s) were selected; Newsletter Policy allows at most ${articlePolicy.mainArticleCount.max}.`);
  }
  if (primaryCount < articlePolicy.primaryCameraStack.minRequired) {
    errors.push(`Only ${primaryCount} Primary Camera Stack final article input(s) remain after deterministic filtering; Newsletter Policy requires at least ${articlePolicy.primaryCameraStack.minRequired}.`);
  }
  if (forbiddenCount > 0) {
    errors.push(`${forbiddenCount} forbidden bucket final article input(s) remain after deterministic filtering; forbidden buckets: ${articlePolicy.forbiddenMainBuckets.join(', ')}.`);
  }
  if (items.length > 0 && items.every(candidate => !hasSelectableScope(candidate))) {
    errors.push('No Newsletter Policy-allowed final article input remains after deterministic filtering.');
  }
  return errors;
}

function reviewCompositionGatePasses(summary) {
  const selectedCount = number(summary.selected_article_count);
  const primaryCount = number(summary.primary_camera_stack_topic_count);
  const supportingCount = number(summary.supporting_main_article_count);
  const forbiddenCount = number(summary.forbidden_main_article_count);
  return selectedCount >= articlePolicy.mainArticleCount.min &&
    selectedCount <= articlePolicy.mainArticleCount.max &&
    primaryCount >= articlePolicy.primaryCameraStack.minRequired &&
    forbiddenCount === 0 &&
    primaryCount + supportingCount === selectedCount;
}

function publishReadyGateReasonSummary(summary, policy = getPublishReadyCompositionPolicy()) {
  const publishPolicy = resolvePublishReadyCompositionPolicy(policy);
  const selectedCount = number(summary.selected_article_count);
  const primaryCount = number(summary.primary_camera_stack_topic_count);
  const directOrDriverCount =
    number(summary.direct_aosp_camera_count) +
    number(summary.camera_driver_image_pipeline_count);
  const supportingCount = number(summary.supporting_main_article_count);
  const forbiddenCount = number(summary.forbidden_main_article_count);
  const reasons = [];
  const addReason = (code, actual, required) => {
    reasons.push({ code, actual, required });
  };

  if (selectedCount < articlePolicy.mainArticleCount.min) {
    addReason('publish_ready_article_count_under_min', selectedCount, articlePolicy.mainArticleCount.min);
  }
  if (selectedCount > articlePolicy.mainArticleCount.max) {
    addReason('publish_ready_article_count_over_max', selectedCount, articlePolicy.mainArticleCount.max);
  }
  if (primaryCount < publishPolicy.primaryCameraStackMinRequired) {
    addReason('publish_ready_primary_camera_stack_shortage', primaryCount, publishPolicy.primaryCameraStackMinRequired);
  }
  if (directOrDriverCount < publishPolicy.directAospCameraOrDriverMinRequired) {
    addReason('publish_ready_direct_camera_or_driver_shortage', directOrDriverCount, publishPolicy.directAospCameraOrDriverMinRequired);
  }
  if (supportingCount > publishPolicy.supportingMainMaxAllowed) {
    addReason('publish_ready_supporting_main_over_limit', supportingCount, publishPolicy.supportingMainMaxAllowed);
  }
  if (forbiddenCount > 0) {
    addReason('publish_ready_forbidden_main_bucket', forbiddenCount, 0);
  }
  const accountedCount = primaryCount + supportingCount;
  if (accountedCount !== selectedCount && forbiddenCount === 0) {
    addReason('publish_ready_forbidden_main_bucket', selectedCount - accountedCount, 0);
  }
  return reasons;
}

function publishReadyGateReasonCodes(summary, policy = getPublishReadyCompositionPolicy()) {
  return publishReadyGateReasonSummary(summary, policy).map(reason => reason.code);
}

function publishGatePasses(summary, policy = getPublishReadyCompositionPolicy()) {
  return publishReadyGateReasonSummary(summary, policy).length === 0;
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

function groupSummary(candidates) {
  const counts = new Map();
  for (const candidate of ensureArray(candidates)) {
    const key = candidateGroupKey(candidate);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([article_group_key, count]) => ({ article_group_key, count }))
    .sort((a, b) => a.article_group_key.localeCompare(b.article_group_key));
}

function bucketCountMap(candidates) {
  const counts = {
    [BUCKETS.DIRECT_AOSP_CAMERA]: 0,
    [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 0,
    [BUCKETS.ANDROID]: 0,
    [ANDROID_SUPPORTING]: 0,
    [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 0,
    [BUCKETS.GENERIC_TECH_WATCHLIST]: 0
  };
  for (const candidate of ensureArray(candidates)) {
    // 실효 버킷으로 센다. relevance_bucket 은 android 하나지만 보조 등급은 유지해야 한다.
    const scope = candidateScope(candidate);
    const bucket = compositionBucket({
      relevance_bucket: candidate.relevance_bucket || scope.relevance_bucket,
      counts_as_soc_topic: candidate.counts_as_soc_topic ?? scope.counts_as_soc_topic,
      multimedia_camera_output_relevance: candidate.multimedia_camera_output_relevance ?? scope.multimedia_camera_output_relevance
    });
    if (Object.prototype.hasOwnProperty.call(counts, bucket)) {
      counts[bucket] += 1;
    }
  }
  return counts;
}

// 버킷은 android 하나지만 리포트는 근거별로 나눈다. 분류가 남긴 신호를 그대로 센다.
function evidenceCountMap(candidates) {
  const counts = { multimedia: 0, soc: 0 };
  for (const candidate of ensureArray(candidates)) {
    const scope = candidateScope(candidate);
    if ((candidate.counts_as_soc_topic ?? scope.counts_as_soc_topic) === true) counts.soc += 1;
    else if (number(candidate.multimedia_camera_output_relevance ?? scope.multimedia_camera_output_relevance) > 0) counts.multimedia += 1;
  }
  return counts;
}

function compositionSummary(candidates) {
  const bucket_counts = bucketCountMap(candidates);
  const evidence_counts = evidenceCountMap(candidates);
  const primary_camera_stack_topic_count = articlePolicy.primaryCameraStack.buckets
    .reduce((sum, bucket) => sum + number(bucket_counts[bucket]), 0);
  const forbidden_main_article_count = articlePolicy.forbiddenMainBuckets
    .reduce((sum, bucket) => sum + number(bucket_counts[bucket]), 0);
  const supporting_main_article_count = articlePolicy.supportingMainBuckets
    .reduce((sum, bucket) => sum + number(bucket_counts[bucket]), 0);
  // 옛 multimedia + soc 자리를 android_supporting 이 그대로 받는다. 두 항목은 원래
  // non_fallback_reviewable 에 들어갔고 soc 는 fallback_topic 에도 들어갔다 — 이제
  // 구분되지 않으므로 합쳐진 값을 두 곳 모두에 쓴다.
  const non_fallback_reviewable_article_count =
    primary_camera_stack_topic_count + bucket_counts[ANDROID_SUPPORTING];
  const fallback_topic_count =
    bucket_counts[ANDROID_SUPPORTING] + bucket_counts[BUCKETS.CPP_AI_TOOLING_FALLBACK];
  const selected_article_count = ensureArray(candidates).length;
  return {
    selected_article_count,
    bucket_counts,
    direct_aosp_camera_count: bucket_counts[BUCKETS.DIRECT_AOSP_CAMERA],
    camera_driver_image_pipeline_count: bucket_counts[BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE],
    android_count: bucket_counts[BUCKETS.ANDROID],
    // 버킷은 android 하나지만 리포트는 근거별로 나눠 본다. 근거가 사라진 것이 아니라
    // 버킷 이름이 합쳐진 것뿐이다.
    android_multimedia_camera_output_count: evidence_counts.multimedia,
    soc_platform_signal_count: evidence_counts.soc,
    cpp_ai_tooling_fallback_count: bucket_counts[BUCKETS.CPP_AI_TOOLING_FALLBACK],
    generic_tech_watchlist_count: bucket_counts[BUCKETS.GENERIC_TECH_WATCHLIST],
    primary_camera_stack_topic_count,
    supporting_main_article_count,
    forbidden_main_article_count,
    non_fallback_reviewable_article_count,
    fallback_topic_count
  };
}

function candidatePoolPreflightSummary(shortlist, selected, reserve, policy = candidatePoolPreflightPolicy) {
  const eligibleSummary = compositionSummary(shortlist);
  const selectedSummary = compositionSummary(selected);
  return {
    publishable_candidate_count: ensureArray(shortlist).length,
    required_publishable_candidate_count: policy.publishableCandidateMin,
    reserve_candidate_count: ensureArray(reserve).length,
    required_reserve_candidate_count: policy.reserveMin,
    primary_camera_stack_candidate_count: eligibleSummary.primary_camera_stack_topic_count,
    required_primary_camera_stack_candidate_count: policy.primaryCameraStackCandidateMin,
    camera_stack_candidate_count: eligibleSummary.primary_camera_stack_topic_count,
    required_camera_stack_candidate_count: policy.cameraStackCandidateMin,
    direct_camera_or_driver_candidate_count:
      eligibleSummary.direct_aosp_camera_count +
      eligibleSummary.camera_driver_image_pipeline_count,
    camera_adjacent_candidate_count: eligibleSummary.android_count,
    supporting_candidate_count: eligibleSummary.supporting_main_article_count,
    selected_article_count: selectedSummary.selected_article_count,
    selected_primary_camera_stack_count: selectedSummary.primary_camera_stack_topic_count
  };
}

function candidatePoolShortageReasonCodes(summary = {}) {
  const codes = [];
  if (number(summary.publishable_candidate_count) < number(summary.required_publishable_candidate_count)) {
    codes.push('publishable_candidate_shortage');
  }
  if (number(summary.reserve_candidate_count) < number(summary.required_reserve_candidate_count)) {
    codes.push('reserve_candidate_shortage');
  }
  if (number(summary.primary_camera_stack_candidate_count) < number(summary.required_primary_camera_stack_candidate_count)) {
    codes.push('primary_camera_stack_candidate_shortage');
  }
  if (number(summary.camera_stack_candidate_count) < number(summary.required_camera_stack_candidate_count)) {
    codes.push('camera_stack_candidate_shortage');
  }
  return codes;
}

function sourceParserHintCode(reason = '') {
  const textValue = text(reason).toLowerCase();
  if (/camerax|android developers|androidx\.camera|maven group|parser/.test(textValue)) {
    return 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR';
  }
  if (/v4l2|libcamera|driver|image sensor|isp/.test(textValue)) {
    return 'CAMERA_DRIVER_SOURCE_SHORTAGE';
  }
  if (/soc|gpu|npu|power|thermal/.test(textValue)) {
    return 'SOC_PLATFORM_SOURCE_SHORTAGE';
  }
  return 'CANDIDATE_POOL_SHORTAGE';
}

function sourceParserHintsFromShortage(summary = {}, selectionHints = []) {
  return ensureArray(selectionHints).map(reason => ({
    code: sourceParserHintCode(reason),
    source_id: 'unknown',
    reason
  })).concat(
    number(summary.reserve_candidate_count) < number(summary.required_reserve_candidate_count)
      ? [{
          code: 'RESERVE_POOL_SHORTAGE',
          source_id: 'selection-preflight',
          reason: `Only ${summary.reserve_candidate_count} reserve candidate(s) are available; candidatePoolPreflight.reserveMin requires ${summary.required_reserve_candidate_count}.`
        }]
      : []
  );
}

// summary는 "수집·파싱이 각 버킷을 만들어 냈는가"에 답하는 구성이고, poolSummary는 "지금 쓸 수
// 있는 후보가 충분한가"에 답하는 구성이다. 두 질문은 재게재 쿨다운처럼 후보를 사후에 빼는 필터가
// 있을 때 갈라진다 — 파서 질문은 차단 전 구성을, 풀 충분성 질문은 차단 뒤 구성을 봐야 한다.
// 필터가 없는 호출부는 두 값이 같으므로 인자를 하나만 넘긴다.
function selectionShortageHints(summary = {}, poolSummary = summary) {
  const hints = [];
  if (number(summary.direct_aosp_camera_count) === 0) {
    hints.push('Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.');
  }
  if (number(summary.android_count) === 0) {
    hints.push('Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.');
  }
  if (number(summary.camera_driver_image_pipeline_count) === 0) {
    hints.push('Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.');
  }
  if (number(summary.soc_platform_signal_count) === 0) {
    hints.push('Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.');
  }
  if (number(summary.primary_camera_stack_topic_count) < articlePolicy.primaryCameraStack.minRequired) {
    hints.push(`Collect at least ${articlePolicy.primaryCameraStack.minRequired} Primary Camera Stack candidate(s): ${articlePolicy.primaryCameraStack.buckets.join(', ')}.`);
  }
  if (number(poolSummary.selected_article_count) < articlePolicy.mainArticleCount.min) {
    hints.push(`Collect enough eligible candidates to satisfy the Newsletter Policy article count range (${articleCountRangeText()}).`);
  }
  if (number(summary.forbidden_main_article_count) > 0) {
    hints.push(`Keep forbidden buckets out of main article selection: ${articlePolicy.forbiddenMainBuckets.join(', ')}.`);
  }
  return hints;
}

function compositionMode(selected, errors = []) {
  const summary = compositionSummary(selected);
  if (
    ensureArray(errors).length > 0 ||
    !reviewCompositionGatePasses(summary)
  ) {
    return COMPOSITION_MODES.NEEDS_FIX;
  }
  if (summary.supporting_main_article_count > 0) {
    return COMPOSITION_MODES.FALLBACK_COMPOSITION;
  }
  return COMPOSITION_MODES.NORMAL;
}

function compositionReason(mode, summary) {
  if (mode === COMPOSITION_MODES.FALLBACK_COMPOSITION) {
    return `Article Composition Policy passed with ${summary.primary_camera_stack_topic_count} Primary Camera Stack article(s) and ${summary.supporting_main_article_count} supporting main article(s).`;
  }
  if (mode === COMPOSITION_MODES.THIN_WEEK_REVIEW) {
    return `Only ${summary.selected_article_count} main article candidate(s) are available after deterministic filtering; keep this PR review-only.`;
  }
  if (mode === COMPOSITION_MODES.NEEDS_FIX) {
    return `Deterministic selection is not publish-ready because it does not satisfy Newsletter Policy: ${publishGateCriteriaText()}.`;
  }
  return 'Normal composition: Primary Camera Stack topics satisfy the Newsletter Policy without supporting main articles.';
}

module.exports = {
  resolvePublishReadyCompositionPolicy,
  selectionWarnings,
  selectionErrors,
  reviewCompositionGatePasses,
  publishReadyGateReasonSummary,
  publishReadyGateReasonCodes,
  publishGatePasses,
  summarizeExclusionReasons,
  summarizeBuckets,
  groupSummary,
  bucketCountMap,
  compositionSummary,
  candidatePoolPreflightSummary,
  candidatePoolShortageReasonCodes,
  sourceParserHintCode,
  sourceParserHintsFromShortage,
  selectionShortageHints,
  compositionMode,
  compositionReason
};
