const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUCKETS,
  classifyAospCameraStackCandidate
} = require('../../../scripts/lib/aosp-camera-scope');

test('classifies direct AOSP Camera framework and CameraX evidence', () => {
  const framework = classifyAospCameraStackCandidate({
    title: 'CameraService update changes CameraProvider stream configuration',
    summary: 'Android Camera framework metadata behavior changed for capture result handling.'
  });
  const camerax = classifyAospCameraStackCandidate({
    title: 'CameraX 1.5.0 fixes Camera2 interop',
    summary: 'The release updates Android camera compatibility behavior.'
  });

  assert.equal(framework.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.equal(framework.editorial_priority, 1);
  assert.equal(framework.counts_as_primary_camera_topic, true);
  assert.equal(camerax.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
});

test('classifies Jetpack Compose adaptive UI with CameraX usage as Android adjacent, not direct camera', () => {
  const adaptiveUi = classifyAospCameraStackCandidate({
    title: 'Google I/O highlights Jetpack Compose adaptive Android device experiences',
    summary: 'Jetpack Compose and Jetpack Navigation 3 help build foldable, tablet, and multi-window Android experiences where CameraX preview screens need layout validation.',
    api_or_component: 'Jetpack Compose / Jetpack Navigation 3',
    behavior_change: 'Compose adaptive UI guidance changes how app teams structure camera preview experiences across device classes.'
  });

  assert.equal(adaptiveUi.relevance_bucket, BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT);
  assert.equal(adaptiveUi.counts_as_primary_camera_topic, true);
  assert.equal(adaptiveUi.aosp_camera_directness, 2);
  assert.notEqual(adaptiveUi.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
});

test('classifies article-level ICamera, camera3, and camera AIDL aliases as direct camera', () => {
  const aidl = classifyAospCameraStackCandidate({
    title: 'ICameraProvider AIDL update changes camera3 session behavior',
    summary: 'The HAL interface change affects ICameraDeviceSession request handling.'
  });

  assert.equal(aidl.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.equal(aidl.counts_as_primary_camera_topic, true);
  assert.equal(aidl.evidence_origin, 'article_text');
});

test('classifies V4L2, libcamera, ISP, image sensor, and driver evidence', () => {
  const camera = classifyAospCameraStackCandidate({
    title: 'V4L2 media controller patch fixes camera sensor format negotiation',
    summary: 'The Linux camera driver update changes DMA-BUF frame handling in the ISP buffer pipeline.'
  });

  assert.equal(camera.relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE);
  assert.equal(camera.counts_as_driver_topic, true);
  assert.ok(camera.driver_stack_relevance > 0);
});

test('classifies article-level Linux camera subsystem and pipeline evidence as driver topic', () => {
  const camera = classifyAospCameraStackCandidate({
    title: 'Linux camera subsystem update improves sensor routing',
    summary: 'The camera pipeline changes Linux frame routing for capture devices.'
  });

  assert.equal(camera.relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE);
  assert.equal(camera.counts_as_driver_topic, true);
  assert.equal(camera.evidence_origin, 'article_text');
});

test('classifies public SoC platform signals without excluding them', () => {
  const soc = classifyAospCameraStackCandidate({
    title: 'Qualcomm Snapdragon platform update improves camera performance latency',
    summary: 'The public SoC note discusses GPU power, thermal limits, NPU scheduling, and camera latency for video capture workloads.'
  });

  assert.equal(soc.relevance_bucket, BUCKETS.SOC_PLATFORM_SIGNAL);
  assert.equal(soc.editorial_priority, 5);
  assert.equal(soc.counts_as_soc_topic, true);
  assert.ok(soc.soc_platform_relevance > 0);
});

test('classifies Android multimedia camera output as supporting, not primary', () => {
  const apv = classifyAospCameraStackCandidate({
    title: 'Android Advanced Professional Video capture output arrives',
    summary: 'Android introduces APV for professional camera capture output and video creator workflows.'
  });
  const ultraHdr = classifyAospCameraStackCandidate({
    title: 'Android Ultra HDR video output update',
    summary: 'The Android update makes Ultra HDR video output available for camera capture results.'
  });
  const gallery = classifyAospCameraStackCandidate({
    title: 'Android MediaProvider update affects captured image gallery output',
    summary: 'The MediaStore and MediaProvider behavior changes how captured image and video output appears in gallery apps.'
  });
  const videoCall = classifyAospCameraStackCandidate({
    title: 'Video call camera/audio sync regression fixed',
    summary: 'Android fixes a video call camera/audio sync regression for social app camera capture.'
  });

  for (const item of [apv, ultraHdr, gallery, videoCall]) {
    assert.equal(item.relevance_bucket, BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT);
    assert.equal(item.editorial_priority, 4);
    assert.equal(item.counts_as_primary_camera_topic, false);
    assert.equal(item.counts_as_fallback_topic, false);
    assert.ok(item.multimedia_camera_output_relevance >= 2);
  }
});

test('keeps audio and media playback UI out of multimedia camera-output bucket', () => {
  const audio = classifyAospCameraStackCandidate({
    title: 'Android audio routing update',
    summary: 'Android introduces audio routing updates for media playback and call controls.'
  });
  const playback = classifyAospCameraStackCandidate({
    title: 'Android media playback UI update',
    summary: 'The media playback UI adds new controls for developer workflow demos.'
  });
  const compose = classifyAospCameraStackCandidate({
    title: 'Compose preview sample update',
    summary: 'The Android Studio sample updates Compose UI preview documentation.'
  });

  assert.equal(audio.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(playback.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(compose.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
});

test('requires camera-output context for weak multimedia terms', () => {
  const mediaStore = classifyAospCameraStackCandidate({
    title: 'Android MediaStore storage cleanup update',
    summary: 'The platform update changes MediaStore permission cleanup and storage indexing behavior.'
  });
  const mediaProvider = classifyAospCameraStackCandidate({
    title: 'MediaProvider indexing update for downloads',
    summary: 'The Android update improves MediaProvider indexing behavior for downloaded files.'
  });
  const videoCallUi = classifyAospCameraStackCandidate({
    title: 'Video call reactions UI update',
    summary: 'The meeting app update adds video call reaction buttons and UI controls.'
  });
  const ultraHdrDisplay = classifyAospCameraStackCandidate({
    title: 'Ultra HDR display settings update',
    summary: 'Android updates Ultra HDR display settings for viewing and screen controls.'
  });

  assert.notEqual(mediaStore.relevance_bucket, BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT);
  assert.notEqual(mediaProvider.relevance_bucket, BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT);
  assert.notEqual(videoCallUi.relevance_bucket, BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT);
  assert.notEqual(ultraHdrDisplay.relevance_bucket, BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT);
});

test('keeps capture result metadata direct while captured output remains multimedia', () => {
  const captureResult = classifyAospCameraStackCandidate({
    title: 'Capture result metadata update',
    summary: 'Android Camera framework changes capture result metadata handling.'
  });
  const capturedOutput = classifyAospCameraStackCandidate({
    title: 'Captured image output shown in gallery',
    summary: 'Android changes captured image output behavior for gallery output validation.'
  });

  assert.equal(captureResult.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.equal(capturedOutput.relevance_bucket, BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT);
});

test('keeps generic SoC, GPU, and NPU benchmark coverage out of non-fallback SoC bucket', () => {
  const soc = classifyAospCameraStackCandidate({
    title: 'SoC benchmark compares GPU and NPU performance',
    summary: 'The benchmark discusses CPU scores, GPU throughput, NPU performance, cache, memory bandwidth, and scheduler behavior.'
  });

  assert.equal(soc.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(soc.counts_as_soc_topic, false);
});

test('classifies C++ AI and tooling as fallback', () => {
  const fallback = classifyAospCameraStackCandidate({
    title: 'LLVM sanitizer update improves native C++ profiling',
    summary: 'The toolchain release changes diagnostics for native performance and build/test work.'
  });

  assert.equal(fallback.relevance_bucket, BUCKETS.CPP_AI_TOOLING_FALLBACK);
  assert.equal(fallback.editorial_priority, 6);
  assert.equal(fallback.counts_as_fallback_topic, true);
});

test('classifies official Android tooling workflow as cpp fallback rather than camera adjacent', () => {
  const cli = classifyAospCameraStackCandidate({
    title: 'Android CLI Now Stable 1.0: Accelerate developing for Android using any agent',
    summary: 'Android CLI 1.0 helps agents build, test, debug, and run native Android apps on devices.',
    source: 'Android Developers Blog'
  });
  const aiStudio = classifyAospCameraStackCandidate({
    title: 'Start building today - Build native Android apps in Google AI Studio',
    summary: 'Google AI Studio can generate, modify, and test native Android apps with Gemini assisted workflows.',
    source: 'Android Developers Blog',
    relevance_bucket_hint: BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT
  });
  const studio = classifyAospCameraStackCandidate({
    title: 'Android Studio I/O Edition: What’s new in Android Developer tools',
    summary: 'Android Studio updates device execution, Gradle sync, profiling, and debugging workflow for Android apps.',
    source: 'Android Developers Blog'
  });

  for (const item of [cli, aiStudio, studio]) {
    assert.equal(item.relevance_bucket, BUCKETS.CPP_AI_TOOLING_FALLBACK);
    assert.equal(item.tooling_workflow_type, 'native_tooling_workflow');
    assert.equal(item.counts_as_primary_camera_topic, false);
    assert.equal(item.counts_as_fallback_topic, true);
    assert.ok(item.native_workflow_evidence_score > 0);
  }
});

test('keeps Android tooling marketing without concrete workflow behavior on watchlist path', () => {
  const generic = classifyAospCameraStackCandidate({
    title: 'Google AI features for Android developers',
    summary: 'Google announced AI features and developer program updates for Android UI demos.',
    source: 'Android Developers Blog'
  });

  assert.equal(generic.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(generic.tooling_workflow_type || '', '');
});

test('keeps generic Linux, FreeBSD, and audio-fix items out of camera and driver buckets', () => {
  const generic = classifyAospCameraStackCandidate({
    title: 'Linux 7.1-rc2 fixes Steam Deck audio and FreeBSD 15.1 Beta arrives',
    summary: 'General filesystem, networking, release engineering, and audio driver updates are available.',
    source: 'Phoronix Linux Camera / Media',
    source_section: 'Linux Camera / Driver',
    source_usage_hint: 'Linux kernel, V4L2, media subsystem, driver release lead'
  });

  assert.equal(generic.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(generic.counts_as_primary_camera_topic, false);
  assert.equal(generic.counts_as_driver_topic, false);
  assert.equal(generic.evidence_origin, 'source_hint_only');
});

test('classifies GCC benchmark as native tooling fallback, not direct camera', () => {
  const gcc = classifyAospCameraStackCandidate({
    title: 'GCC 16 benchmark shows compiler performance changes',
    summary: 'The benchmark compares native C++ build and runtime performance.'
  });

  assert.equal(gcc.relevance_bucket, BUCKETS.CPP_AI_TOOLING_FALLBACK);
  assert.equal(gcc.counts_as_primary_camera_topic, false);
  assert.equal(gcc.counts_as_driver_topic, false);
});

test('keeps compiler CPU and GPU benchmark coverage in native tooling fallback without strong SoC evidence', () => {
  const gcc = classifyAospCameraStackCandidate({
    title: 'GCC 16 compiler benchmark shows CPU and GPU performance gains',
    summary: 'The benchmark compares native C++ compiler performance across build and runtime tests.',
    source: 'Phoronix Linux Camera / Media',
    source_section: 'Linux Camera / Driver',
    source_usage_hint: 'Linux kernel, V4L2, media subsystem, driver release lead'
  });

  assert.equal(gcc.relevance_bucket, BUCKETS.CPP_AI_TOOLING_FALLBACK);
  assert.equal(gcc.counts_as_soc_topic, false);
  assert.equal(gcc.counts_as_fallback_topic, true);
});
