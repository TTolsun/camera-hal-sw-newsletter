// 편집 우선순위 사다리. Camera HAL > Driver > AI > Android 순이다.
//
// 이전에는 7단계였고 Android 계열이 셋(플랫폼 인접 / 멀티미디어 출력 / SoC 신호)으로 갈려
// AI(6위)보다 위에 있었다. 백필 13주 실측에서 멀티미디어와 SoC 버킷은 후보가 **0건**이었고
// 플랫폼 인접만 13건이었다. 셋을 나눠 둘 근거가 데이터에 없어 android 하나로 합치고,
// AI를 Android 위로 올렸다.
//
// 버킷 이름만 합쳤고 **발행 등급은 그대로 두었다.** 어느 근거로 android 에 들어왔는지를
// androidEvidenceKind 로 남겨, 플랫폼 인접은 주력(directness 2)으로, 멀티미디어 출력과
// SoC 신호는 보조(호당 1건 제한)로 계속 다룬다. 등급까지 합치면 제한이 풀려 발행 구성이
// 조용히 바뀐다 — 요청은 분류 단순화였지 구성 정책 변경이 아니었다.
const BUCKETS = Object.freeze({
  DIRECT_AOSP_CAMERA: 'direct_aosp_camera',
  CAMERA_DRIVER_IMAGE_PIPELINE: 'camera_driver_image_pipeline',
  CPP_AI_TOOLING_FALLBACK: 'cpp_ai_tooling_fallback',
  ANDROID: 'android',
  GENERIC_TECH_WATCHLIST: 'generic_tech_watchlist'
});

const BUCKET_PRIORITY = Object.freeze({
  [BUCKETS.DIRECT_AOSP_CAMERA]: 1,
  [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 2,
  [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 3,
  [BUCKETS.ANDROID]: 4,
  [BUCKETS.GENERIC_TECH_WATCHLIST]: 5
});

// 발행된 아티팩트와 state 파일에 남은 옛 버킷 이름을 읽기 위한 표다.
// 마이그레이션으로 저장된 값은 모두 새 이름으로 바꿨지만, 워크트리 사본이나 아직 돌지 않은
// 실행이 옛 값을 들고 올 수 있어 읽기 경로에서 한 번 더 접는다.
const LEGACY_BUCKET_ALIASES = Object.freeze({
  android_platform_camera_adjacent: BUCKETS.ANDROID,
  android_multimedia_camera_output: BUCKETS.ANDROID,
  soc_platform_signal: BUCKETS.ANDROID
});

// 구성 판정에서만 쓰는 실효 버킷. relevance_bucket 은 android 하나지만, 호당 1건 제한이
// 걸리는 보조 등급은 그대로 유지해야 한다.
const ANDROID_SUPPORTING = 'android_supporting';

function compositionBucket(scope = {}) {
  const raw = typeof (scope.relevance_bucket || scope.relevanceBucket) === 'string'
    ? (scope.relevance_bucket || scope.relevanceBucket).trim()
    : '';
  // 옛 이름이 그대로 들어오면 등급까지 그 이름으로 판정한다. android 로만 접으면
  // 보조였던 항목이 주력으로 올라가 호당 1건 제한이 풀린다.
  if (raw === 'android_multimedia_camera_output' || raw === 'soc_platform_signal') return ANDROID_SUPPORTING;
  const bucket = canonicalBucket(raw);
  if (bucket !== BUCKETS.ANDROID) return bucket;
  if (scope.counts_as_soc_topic === true) return ANDROID_SUPPORTING;
  if (Number(scope.multimedia_camera_output_relevance || 0) > 0) return ANDROID_SUPPORTING;
  return BUCKETS.ANDROID;
}

function canonicalBucket(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return LEGACY_BUCKET_ALIASES[name] || name;
}

const BUCKET_DEFINITIONS = Object.freeze({
  [BUCKETS.DIRECT_AOSP_CAMERA]: 'AOSP Camera Framework, Camera HAL, CameraProvider, CameraService, Camera2, CameraX, ImageReader, Surface, AHardwareBuffer, stream, buffer, metadata, request/result, or camera CTS/VTS/ITS/CDD evidence.',
  [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 'Linux camera driver, V4L2, media controller, libcamera, image sensor, ISP, MIPI CSI-2, DMA-BUF, video capture pipeline, or Linux media subsystem evidence.',
  [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 'C++, LLVM, Clang, GCC, sanitizer, native performance, build/test tooling, AI coding tools, on-device AI, or LLM agent workflow evidence.',
  [BUCKETS.ANDROID]: 'Android platform evidence with a camera-impact path: compatibility, graphics buffer, Surface, media framework, power, thermal, scheduler, memory pressure, or security; Android camera-output and multimedia signals such as APV, Ultra HDR, HDR video, MediaCodec, Media3, MediaRecorder, MediaProvider, MediaStore, Photo Picker, preview output, gallery/media access, video call camera path, camera/audio sync, or captured image/video result behavior; and public SoC platform evidence with concrete ISP, image pipeline, camera performance, sensor, media pipeline, video capture, camera thermal, latency, or power impact.',
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
  /\bCDD\b[^.\n]{0,120}\bcamera orientation\b/i,
  // AOSP 카메라 소스 트리 경로. 변경 단위 후보(Gerrit #1033)는 제목이 "VirtualCamera: prevent integer
  // underflow in outBufferSize"처럼 도메인 문구를 쓰지 않고 바뀐 파일 경로로 말한다. 그 경로 자체가
  // 산문보다 강한 카메라 근거다 - 이 규칙이 없으면 cameraserver 변경이 generic_tech_watchlist로 떨어진다.
  /\bframeworks\/av\/camera\//i,
  /\bservices\/camera\//i,
  /\bhardware\/interfaces\/camera\//i,
  /\bhardware\/google\/camera\//i
];

// 카메라 특정 driver evidence — 무조건 카메라 드라이버 근거로 인정한다. 벤더 카메라/ISP 드라이버명과
// camera/image sensor·CSI-2·libcamera 리터럴은 비카메라 미디어 게이트 뒤로 넣지 않는다(#792가 지키는
// rkisp2/camss 같은 진짜 기사 보호). #792(벤더 ISP 토큰 단일출처)가 재사용할 수 있게 export한다.
const STRONG_CAMERA_DRIVER_PATTERNS = [
  /\blibcamera\b/i,
  /\bcamera driver\b/i,
  /\bLinux\b[^.\n]{0,120}\bcamera\s+(?:subsystem|pipeline|driver)\b/i,
  /\bcamera\s+(?:subsystem|pipeline|driver)\b[^.\n]{0,120}\bLinux\b/i,
  /\bcamera sensor\b/i,
  /\bimage sensor\b/i,
  /\bMIPI\s*CSI-?2\b/i,
  /\bISP\b[^.\n]{0,120}\b(?:camera|image|sensor|pipeline)\b/i,
  /\b(?:camera|image|sensor|pipeline)\b[^.\n]{0,120}\bISP\b/i,
  // Vendor camera/ISP driver module names. The "ISP" is inside the token, so the
  // \bISP\b patterns above miss them, and short lore patch titles ("media: rkisp1: ...")
  // carry no separate "camera/image/sensor" literal. The driver name is the evidence.
  /\batomisp\b/i,        // Intel Atom ISP (drivers/staging/media/atomisp)
  /\brkisp\d*\b/i,       // Rockchip ISP (rkisp, rkisp1)
  /\bcamss\b/i,          // Qualcomm Camera Subsystem (drivers/media/platform/qcom/camss)
  /\bmtk[-_]?isp\b/i,    // MediaTek ISP (drivers/media/platform/mediatek/isp)
  /\bmtk[-_]?cam\b/i,    // MediaTek camera (mtk-cam)
  /\buvcvideo\b/i,       // USB Video Class camera driver (drivers/media/usb/uvc)
  /\blibipa\b/i          // libcamera IPA shared algorithm library (patch prefix "ipa: libipa:")
];

// AOSP 밖 카메라 스택의 소스 트리 경로. 디렉터리 + 확장자라는 모양은 산문에서 나오지 않으므로
// 카메라 스택 근거로 그대로 인정한다. AOSP 트리는 DIRECT_AOSP_PATTERNS가 먼저 잡으니 여기 남는 것은
// ChromeOS platform2의 camera/처럼 Linux 쪽 카메라 스택이다(#1033).
//
// STRONG_CAMERA_DRIVER_PATTERNS에 넣지 않는다. 그 목록은 scoring·evidence·collector 세 소비자가
// 벤더 ISP 토큰 어휘로 재사용하는 단일출처라서, 경로 정규식이 섞이면 api_or_component 추출 같은
// 무관한 자리에 파일 경로가 튀어나온다.
const CAMERA_SOURCE_TREE_PATTERNS = [
  /(?:^|[^\w])camera\/[\w./-]+\.(?:cc|cpp|cxx|c|h|hpp|aidl|mojom|java|kt|py)\b/i,
  /\bcros[-_]camera\b/i
];

// Linux media 프레임워크 공용 API 토큰 — 디코더/인코더/DVB/튜너/HDMI-RX도 공유한다. 카메라 특정
// 토큰이 함께 있을 때만(또는 비카메라 미디어 신호가 없을 때만) 카메라 드라이버 근거로 인정한다
// (driverEvidenceTerms). "video capture pipeline"의 capture는 카메라 쪽이지만 안전하게 문맥 게이트에 둔다.
const SHARED_MEDIA_API_PATTERNS = [
  /\bV4L2\b/i,
  /\bmedia controller\b/i,
  /\bLinux media subsystem\b/i,
  /\bvidioc_[a-z]/i,     // V4L2 VIDIOC_* userspace ioctl identifiers
  /\bDMA-?BUF\b[^.\n]{0,120}\b(?:camera|frame|image|buffer|pipeline)\b/i,
  /\b(?:camera|frame|image|buffer|pipeline)\b[^.\n]{0,120}\bDMA-?BUF\b/i,
  /\bvideo capture pipeline\b/i
];

// 비카메라 미디어 신호 — video decode/encode, codec, DVB/튜너/HDMI-RX 등. 이 신호가 있는데 카메라 특정
// 토큰이 없으면 공용 V4L2 토큰을 카메라 드라이버 근거로 세지 않는다(#795 scope 누수 차단).
const NON_CAMERA_MEDIA_PATTERNS = [
  /\bvdec\b/i,           // video decoder module
  /\bvenc\b/i,           // video encoder module
  /\bvideo\s+(?:decoder|decoding|encoder|encoding)\b/i,
  /\bstateless\s+(?:decoder|encoder)\b/i,
  /\b(?:H\.?26[45]|HEVC|VP[89]|AV1|MPEG-?\d?)\b/i,   // video codecs
  /\bbitstream\b/i,
  /\bDVB\b/i,            // digital video broadcast (tuner)
  /\bdemux\b/i,
  /\btuner\b/i,
  /\bHDMI[\s-]?RX\b/i
];

// 기존 참조(source hint 매칭 등)를 위해 STRONG+SHARED 합집합을 DRIVER_PATTERNS로 유지한다. 실제
// 카메라 드라이버 근거 판정은 driverEvidenceTerms가 비카메라 미디어 문맥 게이트와 함께 수행한다.
const DRIVER_PATTERNS = [...STRONG_CAMERA_DRIVER_PATTERNS, ...SHARED_MEDIA_API_PATTERNS];

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
  /\bcamera\s+output\s+result\b/i,
  // 보안 게시판의 카메라 RAW/DNG·이미지 코덱 CVE(dng_sdk/libpng/libjpeg): 취약 모듈이
  // AOSP source path(external/dng_sdk 등)나 명시적 카메라 RAW 표현으로 표기될 때만 카메라 출력으로
  // 본다. 이 패턴 배열은 모든 후보 분류에 쓰이므로, 범용 코덱 기사("libpng 1.6.44 released")가
  // 카메라로 새지 않도록 external/ 경로 컨텍스트를 요구한다.
  /\bexternal\/(?:dng_sdk|libdng|libpng|libjpeg(?:-turbo)?)\b/i,
  /\bcamera\s+raw\b/i,
  /\bRAW\s*\/\s*DNG\b/i
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
  // 소스 레지스트리와 파서가 아직 옛 버킷 이름을 힌트로 줄 수 있다. 여기서 접지 않으면
  // 유효한 힌트가 빈 문자열이 되어 후보가 generic 으로 떨어진다.
  const bucket = canonicalBucket(text(value));
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

// 카메라 드라이버 근거 토큰. STRONG(카메라 특정)은 항상 인정한다. SHARED(공용 V4L2/media)는 비카메라
// 미디어 신호가 있고 카메라 특정 토큰이 없을 때만 제외한다. 이렇게 해야 meson vdec 같은 순수 video
// decoder가 camera_driver로 새지 않으면서(#795), rkisp2/camss 같은 진짜 카메라 드라이버(디코드 언급이
// 섞여도 카메라 토큰이 있으면)는 유지된다(과도 제외 방지).
function driverEvidenceTerms(body) {
  const strong = patternHits([...STRONG_CAMERA_DRIVER_PATTERNS, ...CAMERA_SOURCE_TREE_PATTERNS], body);
  const shared = patternHits(SHARED_MEDIA_API_PATTERNS, body);
  if (shared.length === 0) return strong;
  const nonCameraMediaPresent = patternHits(NON_CAMERA_MEDIA_PATTERNS, body).length > 0;
  if (nonCameraMediaPresent && strong.length === 0) return strong;
  return [...strong, ...shared];
}

function classifyAospCameraStackCandidate(candidate = {}) {
  const body = candidateArticleText(candidate);
  const sourceHint = sourceHintText(candidate);
  const directTerms = patternHits(DIRECT_AOSP_PATTERNS, body);
  const driverTerms = driverEvidenceTerms(body);
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
  // 옛 SoC·멀티미디어 힌트도 android 로 접히므로(canonicalBucket), android 힌트를 받아들이는
  // 조건은 세 근거 중 하나만 있으면 된다. 셋을 따로 걸면 SoC 근거만 있는 후보가 android
  // 힌트를 못 쓰고 generic 으로 떨어진다.
  const socEvidence = socTerms.length > 0 && socCameraImpactTerms.length > 0;
  const canUseBucketHint = bucketHint && articleTerms.length > 0 &&
    (
      bucketHint !== BUCKETS.ANDROID ||
      adaptiveUiAdjacentTerms.length > 0 ||
      multimediaCameraOutputTerms.length > 0 ||
      socEvidence ||
      (androidAdjacentTerms.length > 0 && hasArticleCameraBehavior)
    );

  // 버킷은 하나로 합쳤지만 어느 근거로 합쳐졌는지는 남긴다. 아래 relevance 점수와
  // counts_as_soc_topic 이 그 구분을 계속 쓰기 때문이다.
  let androidEvidenceKind = '';
  if (driverTerms.length > 0 && directTerms.length === 0) {
    bucket = BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE;
    evidenceTerms = driverTerms;
  } else if (adaptiveUiAdjacentTerms.length > 0) {
    bucket = BUCKETS.ANDROID;
    androidEvidenceKind = 'platform_adjacent';
    evidenceTerms = adaptiveUiAdjacentTerms;
  } else if (canUseBucketHint && bucketHint === BUCKETS.ANDROID && androidAdjacentTerms.length > 0 &&
      multimediaCameraOutputTerms.length === 0) {
    bucket = BUCKETS.ANDROID;
    androidEvidenceKind = 'platform_adjacent';
    evidenceTerms = [...androidAdjacentTerms, ...cameraImpactTerms, ...articleTerms];
  } else if (directTerms.length > 0) {
    bucket = BUCKETS.DIRECT_AOSP_CAMERA;
    evidenceTerms = directTerms;
  } else if (canUseBucketHint && bucketHint === BUCKETS.ANDROID && multimediaCameraOutputTerms.length > 0) {
    bucket = BUCKETS.ANDROID;
    androidEvidenceKind = 'multimedia_output';
    evidenceTerms = multimediaCameraOutputTerms;
  } else if (multimediaCameraOutputTerms.length > 0) {
    bucket = BUCKETS.ANDROID;
    androidEvidenceKind = 'multimedia_output';
    evidenceTerms = multimediaCameraOutputTerms;
  } else if (androidAdjacentTerms.length > 0 && hasArticleCameraBehavior) {
    bucket = BUCKETS.ANDROID;
    androidEvidenceKind = 'platform_adjacent';
    evidenceTerms = [...androidAdjacentTerms, ...cameraImpactTerms];
  } else if (
    socEvidence &&
    !(nativeTerms.length > 0 && strongSocTerms.length === 0)
  ) {
    bucket = BUCKETS.ANDROID;
    androidEvidenceKind = 'soc_platform';
    evidenceTerms = [...strongSocTerms, ...socCameraImpactTerms];
  } else if (nativeAndroidTooling.detected) {
    bucket = BUCKETS.CPP_AI_TOOLING_FALLBACK;
    evidenceTerms = nativeAndroidToolingTerms;
  } else if (nativeTerms.length > 0) {
    bucket = BUCKETS.CPP_AI_TOOLING_FALLBACK;
    evidenceTerms = nativeTerms;
  } else if (canUseBucketHint) {
    bucket = bucketHint;
    if (bucket === BUCKETS.ANDROID && androidEvidenceKind === '') androidEvidenceKind = 'platform_adjacent';
    evidenceTerms = articleTerms;
  }

  const evidenceOrigin = evidenceTerms.length > 0
    ? 'article_text'
    : sourceHintTerms.length > 0 ? 'source_hint_only' : 'none';
  // 버킷은 합쳤지만 주력·보조 등급은 분류 근거를 따른다. 옛 플랫폼-인접만 주력이고
  // 멀티미디어 출력과 SoC 신호는 보조다 — 여기서 버킷 이름에 묶으면 호당 1건 제한이
  // 풀려 발행 구성이 조용히 바뀐다.
  const countsAsPrimaryCameraTopic = bucket === BUCKETS.DIRECT_AOSP_CAMERA ||
    (bucket === BUCKETS.ANDROID && androidEvidenceKind === 'platform_adjacent');
  const countsAsDriverTopic = bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE;
  // SoC 버킷은 사라졌지만 SoC 근거로 분류된 사실은 남는다. 이 플래그를 버킷 이름에 묶어 두면
  // 병합과 함께 신호가 조용히 없어진다.
  const countsAsSocTopic = androidEvidenceKind === 'soc_platform';
  const countsAsFallbackTopic = bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK;
  const aospCameraDirectness = bucket === BUCKETS.DIRECT_AOSP_CAMERA
    ? Math.max(3, relevanceScoreFromHits(directTerms))
    : androidEvidenceKind === 'platform_adjacent' ? 2 : 0;
  const driverStackRelevance = bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE
    ? Math.max(3, relevanceScoreFromHits(driverTerms))
    : 0;
  const socPlatformRelevance = androidEvidenceKind === 'soc_platform'
    ? Math.max(3, relevanceScoreFromHits(socTerms))
    : 0;
  const multimediaCameraOutputRelevance = androidEvidenceKind === 'multimedia_output'
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
  const reason = bucketReason(BUCKETS.ANDROID, evidenceTerms, 'article_text');
  return {
    ...scope,
    editorial_priority: BUCKET_PRIORITY[BUCKETS.ANDROID],
    relevance_bucket: BUCKETS.ANDROID,
    aosp_camera_directness: 2,
    counts_as_primary_camera_topic: true,
    counts_as_driver_topic: false,
    counts_as_soc_topic: false,
    counts_as_fallback_topic: false,
    evidence_origin: scope.evidence_origin || 'article_text',
    scope_evidence_terms: evidenceTerms.slice(0, 8),
    aospCameraStackBucket: BUCKETS.ANDROID,
    aosp_camera_stack_bucket: BUCKETS.ANDROID,
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
  LEGACY_BUCKET_ALIASES,
  ANDROID_SUPPORTING,
  canonicalBucket,
  compositionBucket,
  classifyAospCameraStackCandidate,
  detectNativeAndroidToolingWorkflow,
  normalizeAospCameraScope,
  candidateArticleText,
  // 벤더 카메라/ISP 드라이버명 등 카메라 특정 driver 토큰. #792(벤더 ISP 토큰 단일출처)가 재사용한다.
  STRONG_CAMERA_DRIVER_PATTERNS
};
