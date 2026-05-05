const BUCKETS = Object.freeze({
  DIRECT_AOSP_CAMERA: 'direct_aosp_camera',
  CAMERA_DRIVER_IMAGE_PIPELINE: 'camera_driver_image_pipeline',
  ANDROID_PLATFORM_CAMERA_ADJACENT: 'android_platform_camera_adjacent',
  SOC_PLATFORM_SIGNAL: 'soc_platform_signal',
  CPP_AI_TOOLING_FALLBACK: 'cpp_ai_tooling_fallback',
  GENERIC_TECH_WATCHLIST: 'generic_tech_watchlist'
});

const BUCKET_PRIORITY = Object.freeze({
  [BUCKETS.DIRECT_AOSP_CAMERA]: 1,
  [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 2,
  [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 3,
  [BUCKETS.SOC_PLATFORM_SIGNAL]: 4,
  [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 5,
  [BUCKETS.GENERIC_TECH_WATCHLIST]: 6
});

const BUCKET_DEFINITIONS = Object.freeze({
  [BUCKETS.DIRECT_AOSP_CAMERA]: 'AOSP Camera Framework, Camera HAL, CameraProvider, CameraService, Camera2, CameraX, ImageReader, Surface, AHardwareBuffer, stream, buffer, metadata, request/result, or camera CTS/VTS/ITS/CDD evidence.',
  [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 'Linux camera driver, V4L2, media controller, libcamera, image sensor, ISP, MIPI CSI-2, DMA-BUF, video capture pipeline, or Linux media subsystem evidence.',
  [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 'Android platform, compatibility, graphics buffer, Surface, media framework, power, thermal, scheduler, memory pressure, or security evidence with a camera-impact path.',
  [BUCKETS.SOC_PLATFORM_SIGNAL]: 'Public SoC, CPU, GPU, NPU, ISP, DSP, memory bandwidth, cache/interconnect, power, thermal, DVFS, scheduler/EAS, Qualcomm, Samsung, Arm, MediaTek, Exynos, Snapdragon, or Tensor platform evidence.',
  [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 'C++, LLVM, Clang, GCC, sanitizer, native performance, build/test tooling, AI coding tools, on-device AI, or LLM agent workflow evidence.',
  [BUCKETS.GENERIC_TECH_WATCHLIST]: 'General technology news with weak camera, driver, SoC, or native-development connection; keep for briefing/watchlist rather than automatic main article promotion.'
});

const DIRECT_AOSP_PATTERNS = [
  /\bCamera\s*HAL\b/i,
  /\bHAL3\b/i,
  /\bcamera3\b/i,
  /\bICamera(?:Device|Provider|Service)?\b/i,
  /\b(?:AIDL|HIDL)\b[^.\n]{0,100}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,100}\b(?:AIDL|HIDL)\b/i,
  /\bCamera(?:Provider|Service)\b/i,
  /\bAndroid Camera Framework\b/i,
  /\bAOSP Camera\b/i,
  /\bCamera2\b/i,
  /\bCameraX\b/i,
  /\bImageReader\b/i,
  /\bAHardwareBuffer\b/i,
  /\bSurface\b[^.\n]{0,100}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,100}\bSurface\b/i,
  /\b(?:stream|buffer|metadata|request|result)\b[^.\n]{0,120}\b(?:Camera HAL|Android Camera|AOSP Camera|Camera2|CameraX|CameraProvider|CameraService)\b/i,
  /\b(?:Camera HAL|Android Camera|AOSP Camera|Camera2|CameraX|CameraProvider|CameraService)\b[^.\n]{0,120}\b(?:stream|buffer|metadata|request|result)\b/i,
  /\b(?:CTS|VTS|CDD|Camera ITS)\b[^.\n]{0,120}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,120}\b(?:CTS|VTS|CDD|Camera ITS)\b/i
];

const DRIVER_PATTERNS = [
  /\bV4L2\b/i,
  /\blibcamera\b/i,
  /\bmedia controller\b/i,
  /\bLinux media subsystem\b/i,
  /\bcamera driver\b/i,
  /\bLinux\b[^.\n]{0,120}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,120}\bLinux\b/i,
  /\bimage sensor\b/i,
  /\bMIPI\s*CSI-?2\b/i,
  /\bISP\b[^.\n]{0,120}\b(?:camera|image|sensor|pipeline)\b/i,
  /\b(?:camera|image|sensor|pipeline)\b[^.\n]{0,120}\bISP\b/i,
  /\bDMA-?BUF\b[^.\n]{0,120}\b(?:camera|frame|image|buffer|pipeline)\b/i,
  /\b(?:camera|frame|image|buffer|pipeline)\b[^.\n]{0,120}\bDMA-?BUF\b/i,
  /\bvideo capture pipeline\b/i
];

const ANDROID_ADJACENT_PATTERNS = [
  /\bAndroid\b[^.\n]{0,120}\b(?:release|platform|compatibility|CDD|CTS|VTS|security bulletin|media framework|Surface|graphics buffer|power|thermal|scheduler|memory pressure)\b/i,
  /\b(?:compatibility|CDD|CTS|VTS|security bulletin|media framework|Surface|graphics buffer|power|thermal|scheduler|memory pressure)\b[^.\n]{0,120}\bAndroid\b/i
];

const CAMERA_IMPACT_PATTERNS = [
  /\bcamera\b/i,
  /\bCameraX\b/i,
  /\bCamera2\b/i,
  /\bImageReader\b/i,
  /\bImageAnalysis\b/i,
  /\bSurface\b/i,
  /\bstream\b/i,
  /\bbuffer\b/i,
  /\bmetadata\b/i,
  /\bframe\b/i,
  /\bISP\b/i,
  /\bthermal\b/i,
  /\blatency\b/i
];

const SOC_PATTERNS = [
  /\bSoC\b/i,
  /\bCPU\b/i,
  /\bGPU\b/i,
  /\bNPU\b/i,
  /\bISP\b/i,
  /\bDSP\b/i,
  /\bmemory bandwidth\b/i,
  /\bcache\b/i,
  /\binterconnect\b/i,
  /\bpower\b/i,
  /\bthermal\b/i,
  /\bDVFS\b/i,
  /\bscheduler\b/i,
  /\bEAS\b/i,
  /\bQualcomm\b/i,
  /\bSamsung\b/i,
  /\bArm\b/i,
  /\bMediaTek\b/i,
  /\bExynos\b/i,
  /\bSnapdragon\b/i,
  /\bTensor\b/i
];

const NATIVE_TOOLING_PATTERNS = [
  /\bC\+\+\b/i,
  /\bcpp\b/i,
  /\bLLVM\b/i,
  /\bClang\b/i,
  /\bGCC\b[^.\n]{0,120}\b(?:compiler|C\+\+|toolchain|performance|sanitizer|native|build|test)\b/i,
  /\b(?:compiler|C\+\+|toolchain|performance|sanitizer|native|build|test)\b[^.\n]{0,120}\bGCC\b/i,
  /\blibc\+\+\b/i,
  /\bNDK\b/i,
  /\bsanitizer\b/i,
  /\bnative\b[^.\n]{0,120}\b(?:performance|profiling|debug|build|test|tooling)\b/i,
  /\b(?:build|test|debug|profiling|tooling)\b[^.\n]{0,120}\bnative\b/i,
  /\bAI coding tool\b/i,
  /\bLLM\b[^.\n]{0,120}\b(?:agent|workflow|coding|developer)\b/i,
  /\bagent\b[^.\n]{0,120}\b(?:workflow|coding|developer)\b/i,
  /\bon-device AI\b/i
];

function text(value) {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return String(value || '').trim();
}

function candidateArticleText(candidate = {}) {
  return [
    candidate.title,
    candidate.summary,
    candidate.version_or_release,
    candidate.versionOrRelease,
    candidate.api_or_component,
    candidate.apiOrComponent,
    candidate.behavior_change,
    candidate.behaviorChange,
    candidate.reason,
    candidate.collection_reason,
    candidate.relevance_reason
  ].map(text).join(' ');
}

function sourceHintText(candidate = {}) {
  return [
    candidate.source,
    candidate.source_name,
    candidate.category,
    candidate.section,
    candidate.source_category,
    candidate.source_section,
    candidate.usageHint,
    candidate.source_usage_hint
  ].map(text).join(' ');
}

function patternHits(patterns, value) {
  return patterns
    .filter(pattern => pattern.test(value))
    .map(pattern => pattern.source);
}

function relevanceScoreFromHits(hits, max = 5) {
  return Math.min(max, hits.length === 0 ? 0 : hits.length + 1);
}

function bucketReason(bucket, terms, evidenceOrigin) {
  if (bucket === BUCKETS.GENERIC_TECH_WATCHLIST) {
    return `${BUCKET_DEFINITIONS[bucket]} Article-level evidence was weak; source hints alone do not make a main article.`;
  }
  return `${BUCKET_DEFINITIONS[bucket]} Matched ${terms.length} article-level signal(s) from ${evidenceOrigin}.`;
}

function classifyAospCameraStackCandidate(candidate = {}) {
  const body = candidateArticleText(candidate);
  const sourceHint = sourceHintText(candidate);
  const directTerms = patternHits(DIRECT_AOSP_PATTERNS, body);
  const driverTerms = patternHits(DRIVER_PATTERNS, body);
  const androidAdjacentTerms = patternHits(ANDROID_ADJACENT_PATTERNS, body);
  const cameraImpactTerms = patternHits(CAMERA_IMPACT_PATTERNS, body);
  const socTerms = patternHits(SOC_PATTERNS, body);
  const nativeTerms = patternHits(NATIVE_TOOLING_PATTERNS, body);
  const sourceHintTerms = patternHits([
    ...DIRECT_AOSP_PATTERNS,
    ...DRIVER_PATTERNS,
    ...ANDROID_ADJACENT_PATTERNS,
    ...SOC_PATTERNS,
    ...NATIVE_TOOLING_PATTERNS
  ], sourceHint);

  let bucket = BUCKETS.GENERIC_TECH_WATCHLIST;
  let evidenceTerms = [];
  if (driverTerms.length > 0 && directTerms.length === 0) {
    bucket = BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE;
    evidenceTerms = driverTerms;
  } else if (directTerms.length > 0) {
    bucket = BUCKETS.DIRECT_AOSP_CAMERA;
    evidenceTerms = directTerms;
  } else if (androidAdjacentTerms.length > 0 && cameraImpactTerms.length > 0) {
    bucket = BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT;
    evidenceTerms = [...androidAdjacentTerms, ...cameraImpactTerms];
  } else if (socTerms.length > 0) {
    bucket = BUCKETS.SOC_PLATFORM_SIGNAL;
    evidenceTerms = socTerms;
  } else if (nativeTerms.length > 0) {
    bucket = BUCKETS.CPP_AI_TOOLING_FALLBACK;
    evidenceTerms = nativeTerms;
  }

  const evidenceOrigin = evidenceTerms.length > 0
    ? 'article_text'
    : sourceHintTerms.length > 0 ? 'source_hint_only' : 'none';
  const countsAsPrimaryCameraTopic = bucket === BUCKETS.DIRECT_AOSP_CAMERA ||
    bucket === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT;
  const countsAsDriverTopic = bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE;
  const countsAsSocTopic = bucket === BUCKETS.SOC_PLATFORM_SIGNAL;
  const countsAsFallbackTopic = bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK;
  const aospCameraDirectness = bucket === BUCKETS.DIRECT_AOSP_CAMERA
    ? Math.max(3, relevanceScoreFromHits(directTerms))
    : bucket === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT ? 2 : 0;
  const driverStackRelevance = bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE
    ? Math.max(3, relevanceScoreFromHits(driverTerms))
    : 0;
  const socPlatformRelevance = bucket === BUCKETS.SOC_PLATFORM_SIGNAL
    ? Math.max(3, relevanceScoreFromHits(socTerms))
    : 0;
  const nativeToolingRelevance = bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK
    ? Math.max(3, relevanceScoreFromHits(nativeTerms))
    : 0;

  return {
    editorial_priority: BUCKET_PRIORITY[bucket],
    relevance_bucket: bucket,
    aosp_camera_directness: aospCameraDirectness,
    driver_stack_relevance: driverStackRelevance,
    soc_platform_relevance: socPlatformRelevance,
    native_tooling_relevance: nativeToolingRelevance,
    counts_as_primary_camera_topic: countsAsPrimaryCameraTopic,
    counts_as_driver_topic: countsAsDriverTopic,
    counts_as_soc_topic: countsAsSocTopic,
    counts_as_fallback_topic: countsAsFallbackTopic,
    evidence_origin: evidenceOrigin,
    source_hint: text(candidate.usageHint || candidate.source_usage_hint || sourceHint).slice(0, 240),
    scope_evidence_terms: evidenceTerms.slice(0, 8),
    aospCameraStackBucket: bucket,
    aosp_camera_stack_bucket: bucket,
    aospCameraDirect: countsAsPrimaryCameraTopic,
    aosp_camera_direct: countsAsPrimaryCameraTopic,
    aospCameraEvidenceTerms: evidenceTerms.slice(0, 8),
    aosp_camera_evidence_terms: evidenceTerms.slice(0, 8),
    aospCameraRelevanceReason: bucketReason(bucket, evidenceTerms, evidenceOrigin),
    aosp_camera_relevance_reason: bucketReason(bucket, evidenceTerms, evidenceOrigin)
  };
}

module.exports = {
  BUCKETS,
  BUCKET_DEFINITIONS,
  BUCKET_PRIORITY,
  classifyAospCameraStackCandidate,
  candidateArticleText
};
