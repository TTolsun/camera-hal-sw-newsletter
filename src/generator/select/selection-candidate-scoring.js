'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  text,
  bool,
  number,
  clamp,
  rounded,
  selectionDate,
  hasPublishReadyDateEvidence,
  datePrecision,
  candidateUrl,
  fieldBoolean
} = require('./selection-candidate-fields');
const {
  reliabilityScore
} = require('./selection-scoring');
const {
  MAIN_ARTICLE_SCORE_THRESHOLD,
  MIN_CAMERA_HAL_DIRECTNESS,
  MIN_SCOPE_RELEVANCE,
  LINKED_EVIDENCE_RUNTIME_BONUS,
  LINKED_EVIDENCE_WATCH_PENALTY
} = require('./selection-policy-constants');
const {
  cameraReleaseExtractionViolation
} = require('./camera-release-notes');
const {
  BUCKETS,
  classifyAospCameraStackCandidate,
  normalizeAospCameraScope
} = require('../../shared/common/aosp-camera-scope');
const {
  isNativeToolingWorkflow
} = require('../../shared/common/article-groups');
const { isPlaylistCollectionUrl } = require('../../shared/common/playlist-url');
const {
  isForbiddenMainBucket,
  isMainArticleAllowedBucket,
  isPrimaryCameraStackBucket
} = require('../../shared/common/newsletter-policy');

function finalSelectionEligibility(candidate) {
  return text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
}

function exclusionReasons(candidate) {
  const reasons = [];
  const eligibility = finalSelectionEligibility(candidate);
  const isWatchPage = fieldBoolean(candidate, 'isWatchPage', 'is_watch_page');
  const hasDatedEvidence = fieldBoolean(candidate, 'hasDatedEvidence', 'has_dated_evidence');
  const sourceGapRisk = bool(candidate.source_gap_risk);
  const finalSelectionBlocked = bool(candidate.final_selection_blocked || candidate.finalSelectionBlocked);
  const mainEligible = candidate.main_eligible !== false;
  const briefingOnly = bool(candidate.briefing_only);
  const referenceOnly = bool(candidate.reference_only);

  if (!candidateUrl(candidate)) reasons.push('missing URL evidence');
  if (isPlaylistCollectionUrl(candidateUrl(candidate))) reasons.push('playlist/collection URL is not a dated main article');
  if (!selectionDate(candidate) || !hasDatedEvidence || !hasPublishReadyDateEvidence(candidate)) reasons.push('missing dated evidence');
  if (isWatchPage && !hasDatedEvidence) reasons.push('watch page without dated evidence');
  if (!['main', 'short'].includes(eligibility)) reasons.push(`finalSelectionEligibility=${eligibility || 'unknown'}`);
  if (finalSelectionBlocked) reasons.push('final_selection_blocked=true');
  if (sourceGapRisk) reasons.push('source_gap_risk=true');
  if (!mainEligible) reasons.push('main_eligible=false');
  if (briefingOnly) reasons.push('briefing_only=true');
  if (referenceOnly) reasons.push('reference_only=true');
  const extractionViolation = cameraReleaseExtractionViolation(candidate);
  if (extractionViolation) reasons.push(extractionViolation);
  return [...new Set(reasons)];
}

function freshnessScore(candidate, newsletterDate) {
  const rawDate = selectionDate(candidate);
  const published = rawDate ? new Date(rawDate) : null;
  const base = newsletterDate ? new Date(`${newsletterDate}T00:00:00Z`) : new Date();
  if (!published || Number.isNaN(published.getTime()) || Number.isNaN(base.getTime())) return 0;
  const ageDays = Math.max(0, (base.getTime() - published.getTime()) / (24 * 60 * 60 * 1000));
  if (datePrecision(candidate) === 'month') {
    return ageDays <= 45 ? 1 : 0;
  }
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
    candidate.source_extraction,
    candidate.reason,
    candidate.collection_reason
  ].map(text).join(' ');
}

function candidateScope(candidate) {
  if (candidate && candidate.relevance_bucket) {
    return normalizeAospCameraScope(candidate, {
      editorial_priority: number(candidate.editorial_priority, 6),
      relevance_bucket: text(candidate.relevance_bucket),
      aosp_camera_directness: number(candidate.aosp_camera_directness),
      driver_stack_relevance: number(candidate.driver_stack_relevance),
      multimedia_camera_output_relevance: number(candidate.multimedia_camera_output_relevance),
      soc_platform_relevance: number(candidate.soc_platform_relevance),
      native_tooling_relevance: number(candidate.native_tooling_relevance),
      counts_as_primary_camera_topic: bool(candidate.counts_as_primary_camera_topic),
      counts_as_driver_topic: bool(candidate.counts_as_driver_topic),
      counts_as_soc_topic: bool(candidate.counts_as_soc_topic),
      counts_as_fallback_topic: bool(candidate.counts_as_fallback_topic),
      evidence_origin: text(candidate.evidence_origin),
      source_hint: text(candidate.source_hint),
      scope_evidence_terms: ensureArray(candidate.scope_evidence_terms)
    });
  }
  return classifyAospCameraStackCandidate(candidate);
}

function scopeRelevanceScore(candidate) {
  const scope = candidateScope(candidate);
  return Math.max(
    number(scope.aosp_camera_directness),
    number(scope.driver_stack_relevance),
    number(scope.multimedia_camera_output_relevance),
    number(scope.soc_platform_relevance),
    number(scope.native_tooling_relevance)
  );
}

function isGenericTechWatchlist(candidate) {
  return candidateScope(candidate).relevance_bucket === BUCKETS.GENERIC_TECH_WATCHLIST;
}

function candidateBucket(candidate) {
  return candidateScope(candidate).relevance_bucket;
}

function hasSelectableScope(candidate) {
  return isMainArticleAllowedBucket(candidateBucket(candidate)) &&
    scopeRelevanceScore(candidate) >= MIN_SCOPE_RELEVANCE;
}

function isNonFallbackReviewableScope(candidate) {
  const bucket = candidateBucket(candidate);
  return [
    BUCKETS.DIRECT_AOSP_CAMERA,
    BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
    BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT,
    BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT,
    BUCKETS.SOC_PLATFORM_SIGNAL
  ].includes(bucket);
}

function isPrimaryCameraStackScope(candidate) {
  return isPrimaryCameraStackBucket(candidateBucket(candidate));
}


function isForbiddenMainScope(candidate) {
  return isForbiddenMainBucket(candidateBucket(candidate));
}

function hasAiValue(candidate) {
  const body = candidateBody(candidate);
  return /AI|agent|LLM|Gemini|NPU|GPU|on-device|inference|model|Firebase AI|Copilot|Codex/i.test(body);
}

function hasCameraPlatformValue(candidate) {
  const bucket = candidateBucket(candidate);
  if (bucket === BUCKETS.GENERIC_TECH_WATCHLIST) return false;
  if (isNativeToolingWorkflow({
    ...candidate,
    ...candidateScope(candidate)
  })) {
    return false;
  }
  if (hasSelectableScope(candidate)) return true;
  return /Camera HAL|Android Camera|CameraX|AOSP Camera|Camera2|camera|stream|buffer|metadata|request|result|CTS|VTS|Camera ITS|CDD|libcamera|V4L2/i
    .test(candidateBody(candidate));
}

function hasCppFallbackValue(candidate) {
  return /C\+\+|cpp|LLVM|Clang|GCC|NDK|toolchain|sanitizer|AI coding|LLM agent|on-device AI|Android Studio|Android CLI|Google AI Studio|Gemini in Android Studio|native Android app/i.test(candidateBody(candidate));
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

function hasCameraOutputContext(body = '') {
  return /\b(?:camera|captur(?:e|ed|es|ing)|preview|video\s+recording|gallery\s+output|media\s+output|camera\s+output|social\s+app\s+camera|captured\s+image|captured\s+video)\b/i
    .test(body);
}

function hasStorageCameraOutputContext(body = '') {
  return /\b(?:camera|captur(?:e|ed|es|ing)|gallery\s+output|media\s+output|camera\s+output|captured\s+image|captured\s+video)\b/i
    .test(body);
}

function hasConcreteMultimediaCameraOutputComponent(candidate) {
  const scope = candidateScope(candidate);
  if (
    scope.relevance_bucket === BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT &&
    number(scope.multimedia_camera_output_relevance) >= MIN_SCOPE_RELEVANCE
  ) {
    return true;
  }
  const body = candidateBody(candidate);
  const hasStrongOutput = /\b(?:camera\s+output|media\s+output|gallery\s+output|social\s+app\s+camera\s+capture|captured\s+image\s*\/\s*video\s+output|captured\s+image\s+and\s+video\s+output|captured\s+(?:image|video)\s+output|camera\s+output\s+result)\b/i.test(body);
  const hasContextRequiredOutput = /\b(?:Ultra\s+HDR|HDR\s+video|APV|Advanced\s+Professional\s+Video|MediaCodec|Media3|MediaRecorder|SurfaceView|TextureView|WebRTC|video\s+call)\b/i.test(body) &&
    hasCameraOutputContext(body);
  const hasStorageOutput = /\b(?:MediaProvider|media\s+provider|MediaStore|media\s+store|Photo\s+Picker|photo\s+picker|EXIF)\b/i.test(body) &&
    hasStorageCameraOutputContext(body);
  return hasStrongOutput || hasContextRequiredOutput || hasStorageOutput ||
    /\bcamera\s*\/\s*audio\s+sync\b/i.test(body) ||
    /\baudio\s*\/\s*video\s+sync\b[^.\n]{0,120}\b(?:camera|preview|video\s+(?:recording|call)|capture)\b/i.test(body) ||
    /\b(?:camera|preview|video\s+(?:recording|call)|capture)\b[^.\n]{0,120}\baudio\s*\/\s*video\s+sync\b/i.test(body);
}

function hasConcreteApiComponent(candidate) {
  if (text(candidate.api_or_component || candidate.apiOrComponent)) return true;
  return hasGoogleTensorSocComponent(candidate) ||
    hasConcreteMultimediaCameraOutputComponent(candidate) ||
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
  // 카메라 본질은 키워드보다 분류된 relevance_bucket이 정확하다. 강한 카메라 스택 버킷
  // (direct_aosp_camera / camera_driver_image_pipeline / android_platform_camera_adjacent)은
  // 키워드 누락으로 과소평가되지 않게 directness를 보장하고, 비-카메라스택(C++ 도구 등)은 본문의
  // 부수적 'HAL'/'camera' 언급만으로 최고점을 받지 않게 cap한다. 이래야 진짜 카메라 드라이버/ISP
  // 기사가 비-카메라 도구 기사에 밀려 main에서 탈락하지 않는다.
  if (isPrimaryCameraStackBucket(scope.relevance_bucket)) {
    score = Math.max(score, 5);
  } else {
    score = Math.min(score, 3);
  }
  return clamp(rounded(score), 0, 5);
}

function evidenceSpecificityScore(candidate) {
  let score = clamp(number(candidate.evidence_score), 0, 5);
  if (selectionDate(candidate) && fieldBoolean(candidate, 'hasDatedEvidence', 'has_dated_evidence') && hasPublishReadyDateEvidence(candidate)) score += 1;
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
  return !selectionDate(candidate) || !fieldBoolean(candidate, 'hasDatedEvidence', 'has_dated_evidence') || !hasPublishReadyDateEvidence(candidate) ? 20 : 0;
}

function noApiComponentPenalty(candidate) {
  return hasConcreteApiComponent(candidate) ? 0 : 14;
}

function sourceGapPenalty(candidate) {
  return bool(candidate.source_gap_risk) ? 25 : 0;
}

function linkedEvidenceCount(candidate) {
  return Math.max(0, number(candidate?.linked_evidence_summary?.total_count));
}

function linkedEvidenceAdjustment(candidate) {
  if (linkedEvidenceCount(candidate) <= 0) {
    return {
      linked_evidence_runtime_bonus: 0,
      linked_evidence_watch_penalty: 0,
      linked_evidence_adjustment: 0
    };
  }

  const impact = candidate?.impact_classification;
  if (!impact || typeof impact !== 'object') {
    return {
      linked_evidence_runtime_bonus: 0,
      linked_evidence_watch_penalty: 0,
      linked_evidence_adjustment: 0
    };
  }

  const recommendedArticleType = text(impact.recommended_article_type);
  const runtimeBonus = recommendedArticleType === 'main' &&
    (impact.hal_runtime_impact === true || impact.camera_pipeline_impact === true)
    ? LINKED_EVIDENCE_RUNTIME_BONUS
    : 0;
  const watchPenalty = recommendedArticleType === 'watch'
    ? LINKED_EVIDENCE_WATCH_PENALTY
    : 0;
  return {
    linked_evidence_runtime_bonus: runtimeBonus,
    linked_evidence_watch_penalty: watchPenalty,
    linked_evidence_adjustment: runtimeBonus - watchPenalty
  };
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
  const baseTotal = rounded(
    cameraHal * 9 +
    scopeScore * 8 +
    evidence * 4 +
    freshness * 5 +
    actionability * 2 +
    sourceReliability +
    optionalBonus -
    penaltyTotal
  );
  const linkedEvidence = linkedEvidenceAdjustment(candidate);
  const total = rounded(baseTotal + linkedEvidence.linked_evidence_adjustment);

  return {
    camera_hal_directness: cameraHal,
    scope_relevance: scopeScore,
    editorial_priority: scope.editorial_priority,
    relevance_bucket: scope.relevance_bucket,
    aosp_camera_directness: scope.aosp_camera_directness,
    driver_stack_relevance: scope.driver_stack_relevance,
    multimedia_camera_output_relevance: scope.multimedia_camera_output_relevance,
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
    base_total: baseTotal,
    ...linkedEvidence,
    total
  };
}

function scoreFilterReasons(scoreBreakdown) {
  const reasons = [];
  if (number(scoreBreakdown.base_total, scoreBreakdown.total) < MAIN_ARTICLE_SCORE_THRESHOLD) {
    reasons.push(`base_total<${MAIN_ARTICLE_SCORE_THRESHOLD}`);
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

module.exports = {
  finalSelectionEligibility,
  exclusionReasons,
  freshnessScore,
  candidateBody,
  candidateScope,
  scopeRelevanceScore,
  isGenericTechWatchlist,
  candidateBucket,
  hasSelectableScope,
  isNonFallbackReviewableScope,
  isPrimaryCameraStackScope,
  isForbiddenMainScope,
  hasAiValue,
  hasCameraPlatformValue,
  hasCppFallbackValue,
  hasPlatformSignalTerm,
  hasFallbackRelevanceHint,
  hasGoogleTensorSocComponent,
  hasCameraOutputContext,
  hasStorageCameraOutputContext,
  hasConcreteMultimediaCameraOutputComponent,
  hasConcreteApiComponent,
  hasBehaviorEvidence,
  cameraHalDirectnessScore,
  evidenceSpecificityScore,
  practicalActionabilityScore,
  optionalAiCppBonus,
  genericAiPenalty,
  watchPagePenalty,
  noDatePenalty,
  noApiComponentPenalty,
  sourceGapPenalty,
  linkedEvidenceCount,
  linkedEvidenceAdjustment,
  scoreCandidate,
  scoreFilterReasons
};
