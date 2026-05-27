const crypto = require('crypto');
const {
  normalizeShortlistReport
} = require('./selection-diagnostics');
const {
  BUCKETS,
  classifyAospCameraStackCandidate,
  normalizeAospCameraScope
} = require('../common/aosp-camera-scope');
const {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  NATIVE_TOOLING_WORKFLOW_TYPE,
  attachRelatedContextToSelected,
  candidateGroupKey,
  groupCoverageSummary,
  isNativeToolingWorkflow
} = require('../common/article-groups');
const {
  dateQualityForCandidate,
  resolveCandidateDateEvidence
} = require('../common/date-signals');
const {
  articleIdentityKey
} = require('../common/article-identity');
const {
  applyHomepageHeadlineSelection,
  candidateDateEvidence,
  candidateQualityFlags,
  computeHeadlineScore,
  readHomepageHeadlineState
} = require('../common/homepage-headline');
const {
  POLICY_REL_PATH,
  articlePolicy,
  articleCountRangeText,
  candidatePoolPreflightPolicy,
  getHeadlinePolicy,
  getPublishReadyCompositionPolicy,
  getSelectionWindowPolicy,
  isForbiddenMainBucket,
  isMainArticleAllowedBucket,
  isPrimaryCameraStackBucket,
  isSupportingMainBucket,
  publishGateCriteriaText
} = require('../common/newsletter-policy');

const SHORTLIST_CAP = 12;
const RESERVE_MIN_CANDIDATES = 4;
const RESERVE_MAX_CANDIDATES = 7;
// Legacy compatibility exports only. New selection code should prefer articlePolicy.
const MIN_FINAL_ARTICLES = articlePolicy.mainArticleCount.min;
const MAX_FINAL_ARTICLES = articlePolicy.mainArticleCount.max;
const ABSOLUTE_MIN_REVIEWABLE_ARTICLES = articlePolicy.primaryCameraStack.minRequired;
const publishReadyCompositionPolicy = getPublishReadyCompositionPolicy();
const MIN_NON_FALLBACK_PUBLISH_READY_ARTICLES = publishReadyCompositionPolicy.primaryCameraStackMinRequired;
const DIRECT_AOSP_CAMERA_OR_DRIVER_BUCKETS = Object.freeze([
  BUCKETS.DIRECT_AOSP_CAMERA,
  BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE
]);
const MAIN_ARTICLE_SCORE_THRESHOLD = 42;
const MIN_CAMERA_HAL_DIRECTNESS = 2;
const MIN_SCOPE_RELEVANCE = 2;
const LINKED_EVIDENCE_RUNTIME_BONUS = 2;
const LINKED_EVIDENCE_WATCH_PENALTY = 8;
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

function resolvePublishReadyCompositionPolicy(policy = getPublishReadyCompositionPolicy()) {
  if (policy?.articlePolicy?.publishReadyComposition) {
    return policy.articlePolicy.publishReadyComposition;
  }
  if (policy?.publishReadyComposition) {
    return policy.publishReadyComposition;
  }
  return policy;
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
    const hash = parsed.hash;
    const preserveHash = parsed.hostname.toLowerCase() === 'developer.android.com' &&
      ['/jetpack/androidx/releases/camera', '/jetpack/androidx/releases/media3'].includes(parsed.pathname) &&
      /^#(?:(?:camera-[a-z0-9-]+|media3)-)?\d+\.\d+\.\d+(?:[-\w.]*)?$/i.test(hash);
    if (!preserveHash) parsed.hash = '';
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
    .normalize('NFC')
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

function selectionDateEvidence(candidate) {
  return resolveCandidateDateEvidence(candidate);
}

function selectionDate(candidate) {
  return selectionDateEvidence(candidate).date;
}

function hasPublishReadyDateEvidence(candidate) {
  return selectionDateEvidence(candidate).publish_ready_date_evidence;
}

function datePrecision(candidate) {
  return text(candidate.datePrecision || candidate.date_precision);
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

function cameraReleasePageKey(candidate) {
  const raw = candidateUrl(candidate);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (
      parsed.hostname.toLowerCase() === 'developer.android.com' &&
      ['/jetpack/androidx/releases/camera', '/jetpack/androidx/releases/media3'].includes(parsed.pathname)
    ) {
      parsed.hash = '';
      parsed.search = '';
      return parsed.toString().replace(/\/$/, '').toLowerCase();
    }
  } catch {
    return '';
  }
  return '';
}

function sourceExtractionItems(candidate) {
  return [
    ...(Array.isArray(candidate?.source_extraction?.release?.sections) ? candidate.source_extraction.release.sections : []),
    ...(Array.isArray(candidate?.source_extraction?.minor_line_context?.sections) ? candidate.source_extraction.minor_line_context.sections : [])
  ].flatMap(section => ensureArray(section?.items));
}

function hasSourceExtractionBullet(candidate) {
  return sourceExtractionItems(candidate).some(item => text(item?.text || item?.source_text));
}

function hasGenericCameraXFallbackMetadata(candidate) {
  const value = text(candidate.behavior_change || candidate.behaviorChange || candidate.what_changed || candidate.summary);
  return /^CameraX(?:\s*\/\s*androidx\.camera)?\s+(?:update|updates|updated|release|released)(?:\.)?$/i.test(value) ||
    /Maven Group versions?|View the Camera Library|This library was last updated on:/i.test(value);
}

function cameraReleaseExtractionViolation(candidate) {
  if (!cameraReleasePageKey(candidate)) return '';
  const quality = candidate.extraction_quality || candidate.source_extraction?.extraction_quality || {};
  if (quality.used_fallback === true) return 'source_extraction.used_fallback=true';
  if (quality.main_article_allowed === false) return 'source_extraction.main_article_allowed=false';
  if (!hasSourceExtractionBullet(candidate) && hasGenericCameraXFallbackMetadata(candidate)) {
    return 'CameraX release-note candidate has no concrete source_extraction bullet';
  }
  if (candidate.source_extraction && !hasSourceExtractionBullet(candidate)) return 'source_extraction.release.sections has no concrete bullet';
  return '';
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

function reliabilityScore(candidate) {
  const reliability = text(candidate.reliability || candidate.source_reliability).toLowerCase();
  if (reliability === 'official') return 5;
  if (['project-official', 'official-community'].includes(reliability)) return 4;
  if (['expert-media', 'community-doc'].includes(reliability)) return 2;
  if (['community', 'newsletter'].includes(reliability)) return 1;
  return 0;
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

function cameraReleaseVersionRank(candidate) {
  if (!cameraReleasePageKey(candidate)) return { kind: 99, weight: 0 };
  const value = text(candidate.version_or_release || candidate.versionOrRelease || candidate.title);
  const match = value.match(/\b(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\d*)?/i);
  if (!match) return { kind: 50, weight: 0 };
  const suffix = text(match[4]).toLowerCase();
  const patch = number(match[3]);
  return {
    kind: suffix ? 2 : patch > 0 ? 0 : 1,
    weight: number(match[1]) * 1000000 + number(match[2]) * 10000 + patch * 100
  };
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

function isSupportingMainScope(candidate) {
  return isSupportingMainBucket(candidateBucket(candidate));
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

function shouldPreferDuplicateCandidate(candidate, existing) {
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

function selectedHasSameCameraReleasePage(selected, candidate) {
  const key = cameraReleasePageKey(candidate);
  return Boolean(key) && ensureArray(selected).some(item => cameraReleasePageKey(item) === key);
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

function selectionWarnings(selected) {
  return [];
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
  if (primaryCount + supportingCount !== selectedCount && forbiddenCount === 0) {
    addReason('publish_ready_forbidden_main_bucket', selectedCount - primaryCount - supportingCount, 0);
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
    [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 0,
    [BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT]: 0,
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
  const primary_camera_stack_topic_count = articlePolicy.primaryCameraStack.buckets
    .reduce((sum, bucket) => sum + number(bucket_counts[bucket]), 0);
  const supporting_main_article_count = articlePolicy.supportingMainBuckets
    .reduce((sum, bucket) => sum + number(bucket_counts[bucket]), 0);
  const forbidden_main_article_count = articlePolicy.forbiddenMainBuckets
    .reduce((sum, bucket) => sum + number(bucket_counts[bucket]), 0);
  const non_fallback_reviewable_article_count =
    primary_camera_stack_topic_count +
    bucket_counts[BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT] +
    bucket_counts[BUCKETS.SOC_PLATFORM_SIGNAL];
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
    android_multimedia_camera_output_count: bucket_counts[BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT],
    soc_platform_signal_count: bucket_counts[BUCKETS.SOC_PLATFORM_SIGNAL],
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
    camera_adjacent_candidate_count: eligibleSummary.android_platform_camera_adjacent_count,
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

function selectionShortageHints(summary = {}) {
  const hints = [];
  if (number(summary.direct_aosp_camera_count) === 0) {
    hints.push('Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.');
  }
  if (number(summary.android_platform_camera_adjacent_count) === 0) {
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
  if (number(summary.selected_article_count) < articlePolicy.mainArticleCount.min) {
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
  const warnings = selectionWarnings(selected);
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
