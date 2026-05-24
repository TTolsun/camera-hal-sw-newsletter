const BUCKETS = Object.freeze({
  DIRECT_AOSP_CAMERA: 'direct_aosp_camera',
  CAMERA_DRIVER_IMAGE_PIPELINE: 'camera_driver_image_pipeline',
  ANDROID_PLATFORM_CAMERA_ADJACENT: 'android_platform_camera_adjacent',
  ANDROID_MULTIMEDIA_CAMERA_OUTPUT: 'android_multimedia_camera_output',
  SOC_PLATFORM_SIGNAL: 'soc_platform_signal',
  CPP_AI_TOOLING_FALLBACK: 'cpp_ai_tooling_fallback',
  GENERIC_TECH_WATCHLIST: 'generic_tech_watchlist'
});

const BUCKET_PRIORITY = Object.freeze({
  [BUCKETS.DIRECT_AOSP_CAMERA]: 1,
  [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 2,
  [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 3,
  [BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT]: 4,
  [BUCKETS.SOC_PLATFORM_SIGNAL]: 5,
  [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 6,
  [BUCKETS.GENERIC_TECH_WATCHLIST]: 7
});

const BUCKET_DEFINITIONS = Object.freeze({
  [BUCKETS.DIRECT_AOSP_CAMERA]: 'AOSP Camera Framework, Camera HAL, CameraProvider, CameraService, Camera2, CameraX, ImageReader, Surface, AHardwareBuffer, stream, buffer, metadata, request/result, or camera CTS/VTS/ITS/CDD evidence.',
  [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 'Linux camera driver, V4L2, media controller, libcamera, image sensor, ISP, MIPI CSI-2, DMA-BUF, video capture pipeline, or Linux media subsystem evidence.',
  [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 'Android platform, compatibility, graphics buffer, Surface, media framework, power, thermal, scheduler, memory pressure, or security evidence with a camera-impact path.',
  [BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT]: 'Android camera-output or multimedia evidence such as APV, Ultra HDR, HDR video, MediaCodec, Media3, MediaRecorder, MediaProvider, MediaStore, Photo Picker, preview output, gallery/media access, media output, video call camera path, camera/audio sync, social app camera capture, or captured image/video result behavior.',
  [BUCKETS.SOC_PLATFORM_SIGNAL]: 'Public SoC platform evidence with concrete ISP, image pipeline, camera performance, sensor, media pipeline, video capture, camera thermal, latency, or power impact.',
  [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 'C++, LLVM, Clang, GCC, sanitizer, native performance, build/test tooling, AI coding tools, on-device AI, or LLM agent workflow evidence.',
  [BUCKETS.GENERIC_TECH_WATCHLIST]: 'General technology news with weak camera, driver, SoC, or native-development connection; keep for briefing/watchlist rather than automatic main article promotion.'
});

const DIRECT_AOSP_PATTERNS = [
  /\bCamera\s*HAL\b/i,
  /\bHAL3\b[^.\n]{0,100}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,100}\bHAL3\b/i,
  /\bcamera3\b/i,
  /\bICamera(?:Device|DeviceSession|Provider|Service|Session)?\b/i,
  /\b(?:AIDL|HIDL)\b[^.\n]{0,100}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,100}\b(?:AIDL|HIDL)\b/i,
  /\bCamera(?:Provider|Service)\b/i,
  /\bAndroid Camera Framework\b/i,
  /\bAOSP Camera\b/i,
  /\bCamera2\b/i,
  /\bCameraX\b/i,
  /\bCameraPipe\b/i,
  /\bSessionConfig\b/i,
  /\bImageAnalysis\b/i,
  /\bVideoCapture\b/i,
  /\bPreviewView\b/i,
  /\bCameraController\b/i,
  /\bCameraEffect\b/i,
  /\bCamera images automation\b/i,
  /\bTest camera images\b/i,
  /\bAutomotive Camera Service\b/i,
  /\bcamera image(?:s)? automation\b/i,
  /\bImageReader\b/i,
  /\bcapture request\b/i,
  /\bcapture result\b/i,
  /\bstream configuration\b/i,
  /\bcamera metadata\b/i,
  /\b(?:CTS|VTS|CDD|Camera ITS)\b[^.\n]{0,120}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,120}\b(?:CTS|VTS|CDD|Camera ITS)\b/i,
  /\bCDD\b[^.\n]{0,120}\bcamera orientation\b/i
];

const DRIVER_PATTERNS = [
  /\bV4L2\b/i,
  /\blibcamera\b/i,
  /\bmedia controller\b/i,
  /\bLinux media subsystem\b/i,
  /\bcamera driver\b/i,
  /\bLinux\b[^.\n]{0,120}\bcamera\s+(?:subsystem|pipeline|driver)\b/i,
  /\bcamera\s+(?:subsystem|pipeline|driver)\b[^.\n]{0,120}\bLinux\b/i,
  /\bcamera sensor\b/i,
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
  /\bCameraPipe\b/i,
  /\bSessionConfig\b/i,
  /\bImageAnalysis\b/i,
  /\bVideoCapture\b/i,
  /\bPreviewView\b/i,
  /\bCameraController\b/i,
  /\bCameraEffect\b/i,
  /\bAutomotive Camera Service\b/i,
  /\bCamera2\b/i,
  /\bImageReader\b/i,
  /\bSurface\b/i,
  /\bstream\b/i,
  /\bbuffer\b/i,
  /\bmetadata\b/i,
  /\bframe\b/i,
  /\bISP\b/i,
  /\bthermal\b/i,
  /\blatency\b/i
];

const ANDROID_ADAPTIVE_UI_CONTEXT_PATTERNS = [
  /\bJetpack\s+Compose\b/i,
  /\bJetpack\s+Navigation\s*3\b/i,
  /\bCompose\b[^.\n]{0,120}\b(?:adaptive|Navigation\s*3|foldable|large[-\s]?screen|tablet|multi[-\s]?window|device experience|UI)\b/i,
  /\b(?:adaptive|large[-\s]?screen|foldable|tablet|multi[-\s]?window|device experience)\b[^.\n]{0,120}\b(?:Compose|Jetpack|Android)\b/i
];

const DIRECT_CAMERA_RUNTIME_CONTEXT_PATTERNS = [
  /\bCamera\s*HAL\b/i,
  /\bcamera3\b/i,
  /\bICamera(?:Device|DeviceSession|Provider|Service|Session)?\b/i,
  /\bCamera(?:Provider|Service)\b/i,
  /\bAndroid Camera Framework\b/i,
  /\bAOSP Camera\b/i,
  /\bCamera2\s+interop\b/i,
  /\bCameraX\s+\d+\.\d+\.\d+(?:[-\w.]*)?\b/i,
  /\bandroidx\.camera\b[^.\n]{0,120}\b(?:release|fix|regression|SessionConfig|ImageAnalysis|VideoCapture|PreviewView|CameraController|CameraEffect|Camera2\s+interop)\b/i,
  /\b(?:SessionConfig|ImageAnalysis|VideoCapture|PreviewView|CameraController|CameraEffect)\b[^.\n]{0,120}\b(?:release|fix|regression|behavior|API)\b/i,
  /\bImageReader\b/i,
  /\bcapture request\b/i,
  /\bcapture result\b/i,
  /\bstream configuration\b/i,
  /\bcamera metadata\b/i,
  /\b(?:CTS|VTS|CDD|Camera ITS)\b[^.\n]{0,120}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,120}\b(?:CTS|VTS|CDD|Camera ITS)\b/i
];

const MULTIMEDIA_CAMERA_OUTPUT_STRONG_PATTERNS = [
  /\bcamera\s+output\b/i,
  /\bgallery\s+output\b/i,
  /\b(?:camera|capture|captured|recording|gallery)\b[^.\n]{0,100}\bmedia\s+output\b/i,
  /\bmedia\s+output\b[^.\n]{0,100}\b(?:camera|capture|captured|recording|gallery)\b/i,
  /\bcamera\s*\/\s*audio\s+sync\b/i,
  /\baudio\s*\/\s*video\s+sync\b[^.\n]{0,120}\b(?:camera|preview|video\s+(?:recording|call)|capture)\b/i,
  /\b(?:camera|preview|video\s+(?:recording|call)|capture)\b[^.\n]{0,120}\baudio\s*\/\s*video\s+sync\b/i,
  /\bsocial\s+app\s+camera\s+capture\b/i,
  /\bcaptured\s+image\s*\/\s*video\s+output\b/i,
  /\bcaptured\s+image\s+and\s+video\s+output\b/i,
  /\bcaptured\s+(?:image|video)\s+output\b/i,
  /\bcamera\s+output\s+result\b/i
];

const MULTIMEDIA_CAMERA_OUTPUT_CONTEXT_REQUIRED_PATTERNS = [
  /\bUltra\s+HDR\b/i,
  /\bHDR\s+video\b/i,
  /\bAPV\b/i,
  /\bAdvanced\s+Professional\s+Video\b/i,
  /\bMediaCodec\b/i,
  /\bMedia3\b/i,
  /\bMediaRecorder\b/i,
  /\bSurfaceView\b/i,
  /\bTextureView\b/i,
  /\bWebRTC\b/i,
  /\bvideo\s+call\b[^.\n]{0,100}\b(?:camera|capture|preview|A\/V|audio\s*\/\s*video|sync|switch(?:ing)?)\b/i,
  /\b(?:camera|capture|preview|A\/V|audio\s*\/\s*video|sync|switch(?:ing)?)\b[^.\n]{0,100}\bvideo\s+call\b/i,
  /\bcamera-generated\b[^.\n]{0,100}\bplayback\b/i,
  /\bcamera-recorded\b[^.\n]{0,100}\bplayback\b/i,
  /\bcaptured\s+video\b[^.\n]{0,100}\bplayback\b/i,
  /\brecording\s+validation\b/i,
  /\bcamera\s+generated\s+(?:image|video)\b/i
];

const MULTIMEDIA_CAMERA_OUTPUT_STORAGE_PATTERNS = [
  /\bMediaProvider\b/i,
  /\bmedia\s+provider\b/i,
  /\bMediaStore\b/i,
  /\bmedia\s+store\b/i,
  /\bPhoto\s+Picker\b/i,
  /\bphoto\s+picker\b/i,
  /\bEXIF\b/i
];

const CAMERA_OUTPUT_CONTEXT_PATTERNS = [
  /\bcamera\b/i,
  /\bcaptur(?:e|ed|es|ing)\b/i,
  /\brecord(?:ed|ing)?\b/i,
  /\bpreview\b/i,
  /\bvideo\s+recording\b/i,
  /\bgallery\s+output\b/i,
  /\bgallery\s*\/\s*media\s+access\b/i,
  /\bmedia\s+access\b/i,
  /\bmedia\s+output\b/i,
  /\bcamera\s+output\b/i,
  /\bsharing\b/i,
  /\bsocial\s+app\s+camera\b/i,
  /\bcaptured\s+image\b/i,
  /\bcaptured\s+video\b/i,
  /\bWebRTC\b[^.\n]{0,100}\bcamera\b/i,
  /\bcamera\b[^.\n]{0,100}\bWebRTC\b/i,
  /\bcamera\s+switch(?:ing)?\b/i
];

const STORAGE_CAMERA_OUTPUT_CONTEXT_PATTERNS = [
  /\bcamera\b/i,
  /\bcaptur(?:e|ed|es|ing)\b/i,
  /\brecord(?:ed|ing)?\b/i,
  /\bgallery\s+output\b/i,
  /\bgallery\s*\/\s*media\s+access\b/i,
  /\bmedia\s+access\b/i,
  /\bmedia\s+output\b/i,
  /\bcamera\s+output\b/i,
  /\bcaptured\s+image\b/i,
  /\bcaptured\s+video\b/i,
  /\bsharing\b/i,
  /\bindex(?:ing)?\b[^.\n]{0,100}\b(?:camera|capture|captured|photo|video)\b/i,
  /\b(?:camera|capture|captured|photo|video)\b[^.\n]{0,100}\bindex(?:ing)?\b/i
];

const MULTIMEDIA_ENGINEERING_CHANGE_PATTERNS = [
  /\brelease\s+notes?\b/i,
  /\bversion\s+\d+\.\d+/i,
  /\bAPI\b/i,
  /\bbehavior\b/i,
  /\bbug\s+fix\b/i,
  /\bfix(?:ed|es)?\b/i,
  /\bregression\b/i,
  /\bcompatibility\b/i,
  /\blatency\b/i,
  /\bjank\b/i,
  /\bframe\s+(?:drop|drops|dropped|timing|pacing|latency)\b/i,
  /\bA\/V\s+sync\b/i,
  /\baudio\s*\/\s*video\s+sync\b/i,
  /\bsync\b[^.\n]{0,80}\b(?:camera|preview|recording|video\s+call|capture)\b/i,
  /\b(?:camera|preview|recording|video\s+call|capture)\b[^.\n]{0,80}\bsync\b/i,
  /\bperformance\b/i,
  /\bencode(?:r|d|s|ing)?\b/i,
  /\bdecode(?:r|d|s|ing)?\b/i,
  /\btranscod(?:e|ed|es|ing)\b/i,
  /\bformat\s+(?:support|compatibility|negotiation)\b/i,
  /\badd(?:ed|s)?\b/i,
  /\bchange(?:d|s)?\b/i,
  /\bintroduc(?:e|ed|es|ing)\b/i,
  /\bsupport(?:ed|s)?\b/i,
  /\bupdate(?:d|s)?\b/i,
  /\bimprove(?:d|s|ment)?\b/i,
  /\bavailable\b/i
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

const STRONG_SOC_PATTERNS = [
  /\bSoC\b/i,
  /\bNPU\b/i,
  /\bISP\b/i,
  /\bDSP\b/i,
  /\bmemory bandwidth\b/i,
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

const SOC_CAMERA_IMPACT_PATTERNS = [
  /\bISP\b/i,
  /\bimage pipeline\b/i,
  /\bcamera performance\b/i,
  /\bcamera thermal\b/i,
  /\bcamera latency\b/i,
  /\bcamera power\b/i,
  /\bcamera\b[^.\n]{0,120}\b(?:performance|thermal|latency|power|pipeline|sensor|capture)\b/i,
  /\b(?:performance|thermal|latency|power|pipeline|sensor|capture)\b[^.\n]{0,120}\bcamera\b/i,
  /\bimage sensor\b/i,
  /\bcamera sensor\b/i,
  /\bmedia pipeline\b/i,
  /\bvideo capture\b/i
];

const NATIVE_TOOLING_PATTERNS = [
  /\bC\+\+\b/i,
  /\bcpp\b/i,
  /\bLLVM\b/i,
  /\bClang\b/i,
  /\bGCC\b[^.\n]{0,120}\b(?:compiler|C\+\+|toolchain|performance|sanitizer|native|build|test)\b/i,
  /\b(?:compiler|C\+\+|toolchain|performance|sanitizer|native|build|test)\b[^.\n]{0,120}\bGCC\b/i,
  /\bGCC\b/i,
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

const ANDROID_TOOLING_PRODUCT_PATTERNS = [
  /\bAndroid\s+Studio\b/i,
  /\bAndroid\s+CLI\b/i,
  /\bGoogle\s+AI\s+Studio\b/i,
  /\bGemini\s+in\s+Android\s+Studio\b/i,
  /\bAI\s+Studio\b[^.\n]{0,120}\bAndroid\b/i,
  /\bAndroid\b[^.\n]{0,120}\bAI\s+Studio\b/i
];

const NATIVE_ANDROID_TOOLING_WORKFLOW_PATTERNS = [
  /\bnative\s+Android\s+app(?:s)?\b/i,
  /\bAndroid\b[^.\n]{0,140}\b(?:build|test|debug|profil(?:e|ing)|run|device execution|agent workflow|coding assistant|native app)\b/i,
  /\b(?:build|test|debug|profil(?:e|ing)|run|device execution|agent workflow|coding assistant|native app)\b[^.\n]{0,140}\bAndroid\b/i,
  /\b(?:Gradle|AGP|Android Gradle Plugin|NDK|JNI|C\+\+|LLDB|Perfetto)\b[^.\n]{0,140}\b(?:build|test|debug|profil(?:e|ing)|run|device|native|Android)\b/i,
  /\b(?:build|test|debug|profil(?:e|ing)|run|device|native|Android)\b[^.\n]{0,140}\b(?:Gradle|AGP|Android Gradle Plugin|NDK|JNI|C\+\+|LLDB|Perfetto)\b/i,
  /\bAndroid\s+CLI\b[^.\n]{0,140}\b(?:agent|build|test|debug|workflow|app)\b/i,
  /\bGemini\b[^.\n]{0,140}\bAndroid\b[^.\n]{0,140}\b(?:app|build|test|debug|code|coding|agent)\b/i
];

const CAMERA_BEHAVIOR_CONTEXT_PATTERNS = [
  /\b(?:API|runtime|workflow|behavior|compatibility|test|testing|validation|debug|profile|profiling|capture|preview|stream|buffer|metadata|request|result|surface)\b/i,
  /\b(?:add(?:ed|s)?|change(?:d|s)?|fix(?:ed|es)?|support(?:ed|s)?|update(?:d|s)?|improve(?:d|s|ment)?|release(?:d|s)?)\b/i
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

function detectNativeAndroidToolingWorkflow(candidate = {}) {
  const body = candidateArticleText(candidate);
  const sourceHint = sourceHintText(candidate);
  const productTerms = patternHits(ANDROID_TOOLING_PRODUCT_PATTERNS, `${body} ${sourceHint}`);
  const workflowTerms = patternHits(NATIVE_ANDROID_TOOLING_WORKFLOW_PATTERNS, body);
  const genericNativeTerms = patternHits(NATIVE_TOOLING_PATTERNS, body);
  const detected = productTerms.length > 0 && workflowTerms.length > 0;
  return {
    detected,
    tooling_workflow_type: detected ? 'native_tooling_workflow' : '',
    native_workflow_evidence_score: detected
      ? Math.min(5, 2 + workflowTerms.length + Math.min(1, genericNativeTerms.length))
      : 0,
    tooling_product_terms: productTerms.slice(0, 6),
    native_workflow_terms: workflowTerms.slice(0, 6)
  };
}

function multimediaCameraOutputHits(value) {
  if (/\b(?:without|no|lacks?|missing)\b[^.\n]{0,100}\b(?:camera\s+output|camera-generated|captured\s+(?:image|video)|media\s+access)\b[^.\n]{0,80}\b(?:impact|path|relevance|change)\b/i.test(value)) {
    return [];
  }
  if (/\b(?:camera\s+output|camera-generated|captured\s+(?:image|video)|media\s+access)\b[^.\n]{0,100}\b(?:without|no|lacks?|missing)\b[^.\n]{0,80}\b(?:impact|path|relevance|change)\b/i.test(value)) {
    return [];
  }
  const strongHits = patternHits(MULTIMEDIA_CAMERA_OUTPUT_STRONG_PATTERNS, value);
  const outputContextHits = patternHits(CAMERA_OUTPUT_CONTEXT_PATTERNS, value);
  const storageContextHits = patternHits(STORAGE_CAMERA_OUTPUT_CONTEXT_PATTERNS, value);
  const engineeringHits = patternHits(MULTIMEDIA_ENGINEERING_CHANGE_PATTERNS, value);
  if (engineeringHits.length === 0) return [];
  const gatedOutputHits = outputContextHits.length > 0
    ? patternHits(MULTIMEDIA_CAMERA_OUTPUT_CONTEXT_REQUIRED_PATTERNS, value)
    : [];
  const gatedStorageHits = storageContextHits.length > 0
    ? patternHits(MULTIMEDIA_CAMERA_OUTPUT_STORAGE_PATTERNS, value)
    : [];
  if (strongHits.length === 0 && gatedOutputHits.length === 0 && gatedStorageHits.length === 0) return [];
  return [
    ...strongHits,
    ...gatedOutputHits,
    ...gatedStorageHits,
    ...outputContextHits,
    ...engineeringHits
  ];
}

function relevanceScoreFromHits(hits, max = 5) {
  return Math.min(max, hits.length === 0 ? 0 : hits.length + 1);
}

function androidAdaptiveUiCameraAdjacentTerms(value) {
  const adaptiveTerms = patternHits(ANDROID_ADAPTIVE_UI_CONTEXT_PATTERNS, value);
  if (adaptiveTerms.length === 0) return [];
  const cameraImpactTerms = patternHits(CAMERA_IMPACT_PATTERNS, value);
  if (cameraImpactTerms.length === 0) return [];
  const directRuntimeTerms = patternHits(DIRECT_CAMERA_RUNTIME_CONTEXT_PATTERNS, value);
  if (directRuntimeTerms.length > 0) return [];
  return [...adaptiveTerms, ...cameraImpactTerms];
}

function hasCameraBehaviorContext(value) {
  return patternHits(CAMERA_BEHAVIOR_CONTEXT_PATTERNS, value).length > 0;
}

function validBucketHint(value) {
  const bucket = text(value);
  return Object.values(BUCKETS).includes(bucket) && bucket !== BUCKETS.GENERIC_TECH_WATCHLIST
    ? bucket
    : '';
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
  const adaptiveUiAdjacentTerms = androidAdaptiveUiCameraAdjacentTerms(body);
  const cameraImpactTerms = patternHits(CAMERA_IMPACT_PATTERNS, body);
  const multimediaCameraOutputTerms = multimediaCameraOutputHits(body);
  const socTerms = patternHits(SOC_PATTERNS, body);
  const strongSocTerms = patternHits(STRONG_SOC_PATTERNS, body);
  const socCameraImpactTerms = patternHits(SOC_CAMERA_IMPACT_PATTERNS, body);
  const nativeTerms = patternHits(NATIVE_TOOLING_PATTERNS, body);
  const nativeAndroidTooling = detectNativeAndroidToolingWorkflow(candidate);
  const nativeAndroidToolingTerms = nativeAndroidTooling.detected
    ? [...nativeAndroidTooling.tooling_product_terms, ...nativeAndroidTooling.native_workflow_terms]
    : [];
  const bucketHint = validBucketHint(candidate.relevance_bucket_hint || candidate.relevanceBucketHint);
  const sourceHintTerms = patternHits([
    ...DIRECT_AOSP_PATTERNS,
    ...DRIVER_PATTERNS,
    ...ANDROID_ADJACENT_PATTERNS,
    ...MULTIMEDIA_CAMERA_OUTPUT_STRONG_PATTERNS,
    ...MULTIMEDIA_CAMERA_OUTPUT_CONTEXT_REQUIRED_PATTERNS,
    ...MULTIMEDIA_CAMERA_OUTPUT_STORAGE_PATTERNS,
    ...SOC_PATTERNS,
    ...NATIVE_TOOLING_PATTERNS,
    ...ANDROID_TOOLING_PRODUCT_PATTERNS,
    ...NATIVE_ANDROID_TOOLING_WORKFLOW_PATTERNS
  ], sourceHint);

  let bucket = BUCKETS.GENERIC_TECH_WATCHLIST;
  let evidenceTerms = [];
  const articleTerms = [
    ...directTerms,
    ...driverTerms,
    ...androidAdjacentTerms,
    ...adaptiveUiAdjacentTerms,
    ...multimediaCameraOutputTerms,
    ...cameraImpactTerms,
    ...socTerms,
    ...socCameraImpactTerms,
    ...nativeTerms,
    ...nativeAndroidToolingTerms
  ];
  const hasArticleCameraBehavior = cameraImpactTerms.length > 0 && hasCameraBehaviorContext(body);
  const canUseBucketHint = bucketHint && articleTerms.length > 0 &&
    (
      bucketHint !== BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT ||
      adaptiveUiAdjacentTerms.length > 0 ||
      (androidAdjacentTerms.length > 0 && hasArticleCameraBehavior)
    ) &&
    (
      bucketHint !== BUCKETS.SOC_PLATFORM_SIGNAL ||
      (socTerms.length > 0 && socCameraImpactTerms.length > 0)
    ) &&
    (
      bucketHint !== BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT ||
      multimediaCameraOutputTerms.length > 0
    );
  if (driverTerms.length > 0 && directTerms.length === 0) {
    bucket = BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE;
    evidenceTerms = driverTerms;
  } else if (adaptiveUiAdjacentTerms.length > 0) {
    bucket = BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT;
    evidenceTerms = adaptiveUiAdjacentTerms;
  } else if (canUseBucketHint && bucketHint === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT) {
    bucket = bucketHint;
    evidenceTerms = [...androidAdjacentTerms, ...cameraImpactTerms, ...articleTerms];
  } else if (directTerms.length > 0) {
    bucket = BUCKETS.DIRECT_AOSP_CAMERA;
    evidenceTerms = directTerms;
  } else if (canUseBucketHint && bucketHint === BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT) {
    bucket = bucketHint;
    evidenceTerms = multimediaCameraOutputTerms;
  } else if (multimediaCameraOutputTerms.length > 0) {
    bucket = BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT;
    evidenceTerms = multimediaCameraOutputTerms;
  } else if (androidAdjacentTerms.length > 0 && hasArticleCameraBehavior) {
    bucket = BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT;
    evidenceTerms = [...androidAdjacentTerms, ...cameraImpactTerms];
  } else if (
    socTerms.length > 0 &&
    socCameraImpactTerms.length > 0 &&
    !(nativeTerms.length > 0 && strongSocTerms.length === 0)
  ) {
    bucket = BUCKETS.SOC_PLATFORM_SIGNAL;
    evidenceTerms = [...strongSocTerms, ...socCameraImpactTerms];
  } else if (nativeAndroidTooling.detected) {
    bucket = BUCKETS.CPP_AI_TOOLING_FALLBACK;
    evidenceTerms = nativeAndroidToolingTerms;
  } else if (nativeTerms.length > 0) {
    bucket = BUCKETS.CPP_AI_TOOLING_FALLBACK;
    evidenceTerms = nativeTerms;
  } else if (canUseBucketHint) {
    bucket = bucketHint;
    evidenceTerms = articleTerms;
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
  const multimediaCameraOutputRelevance = bucket === BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT
    ? Math.max(3, relevanceScoreFromHits(multimediaCameraOutputTerms))
    : 0;
  const nativeToolingRelevance = bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK
    ? Math.max(3, relevanceScoreFromHits(nativeTerms))
    : 0;

  return normalizeAospCameraScope(candidate, {
    editorial_priority: BUCKET_PRIORITY[bucket],
    relevance_bucket: bucket,
    aosp_camera_directness: aospCameraDirectness,
    driver_stack_relevance: driverStackRelevance,
    multimedia_camera_output_relevance: multimediaCameraOutputRelevance,
    soc_platform_relevance: socPlatformRelevance,
    native_tooling_relevance: nativeToolingRelevance,
    counts_as_primary_camera_topic: countsAsPrimaryCameraTopic,
    counts_as_driver_topic: countsAsDriverTopic,
    counts_as_soc_topic: countsAsSocTopic,
    counts_as_fallback_topic: countsAsFallbackTopic,
    tooling_workflow_type: bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK && nativeAndroidTooling.detected
      ? nativeAndroidTooling.tooling_workflow_type
      : text(candidate.tooling_workflow_type),
    native_workflow_evidence_score: nativeAndroidTooling.native_workflow_evidence_score,
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
  });
}

function normalizeAospCameraScope(candidate = {}, scope = {}) {
  const bucket = text(scope.relevance_bucket);
  if (bucket !== BUCKETS.DIRECT_AOSP_CAMERA) return scope;
  const evidenceTerms = androidAdaptiveUiCameraAdjacentTerms(candidateArticleText(candidate));
  if (evidenceTerms.length === 0) return scope;
  const reason = bucketReason(BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT, evidenceTerms, 'article_text');
  return {
    ...scope,
    editorial_priority: BUCKET_PRIORITY[BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT],
    relevance_bucket: BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT,
    aosp_camera_directness: 2,
    counts_as_primary_camera_topic: true,
    counts_as_driver_topic: false,
    counts_as_soc_topic: false,
    counts_as_fallback_topic: false,
    evidence_origin: scope.evidence_origin || 'article_text',
    scope_evidence_terms: evidenceTerms.slice(0, 8),
    aospCameraStackBucket: BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT,
    aosp_camera_stack_bucket: BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT,
    aospCameraDirect: true,
    aosp_camera_direct: true,
    aospCameraEvidenceTerms: evidenceTerms.slice(0, 8),
    aosp_camera_evidence_terms: evidenceTerms.slice(0, 8),
    aospCameraRelevanceReason: reason,
    aosp_camera_relevance_reason: reason
  };
}

module.exports = {
  BUCKETS,
  BUCKET_DEFINITIONS,
  BUCKET_PRIORITY,
  classifyAospCameraStackCandidate,
  detectNativeAndroidToolingWorkflow,
  normalizeAospCameraScope,
  candidateArticleText
};
