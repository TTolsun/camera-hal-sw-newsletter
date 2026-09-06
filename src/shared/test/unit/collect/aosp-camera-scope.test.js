const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUCKETS,
  classifyAospCameraStackCandidate
} = require('../../../domain/aosp-camera-scope');

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

  assert.equal(adaptiveUi.relevance_bucket, BUCKETS.ANDROID);
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

test('does not leak non-camera V4L2 media (video decoder) into the camera driver bucket (#795)', () => {
  // meson vdec 같은 V4L2 M2M video decoder는 공용 V4L2/vidioc_ 토큰을 쓰지만 카메라가 아니다.
  // 카메라 특정 토큰(sensor/ISP/camera/libcamera/벤더 카메라 드라이버명)이 없고 비카메라 미디어
  // 신호(vdec/decode/vp9/bitstream)가 지배하면 camera_driver로 승격하지 않고 watchlist로 흘려보낸다.
  const vdec = classifyAospCameraStackCandidate({
    title: 'media: meson: vdec: Fix vp9 header update failure',
    summary: 'The V4L2 stateless video decoder driver updates vidioc_ decoder ops for VP9 bitstream handling.'
  });
  assert.equal(vdec.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(vdec.counts_as_driver_topic, false);
});

test('keeps real camera drivers that also touch shared V4L2/decode tokens (#795 no over-exclusion)', () => {
  // 카메라 특정 토큰(image sensor / rkisp / camss)이 있으면 V4L2·decode 언급이 섞여도 camera driver 유지.
  const cameraV4l2 = classifyAospCameraStackCandidate({
    title: 'media: rkisp1: fix V4L2 image sensor format negotiation',
    summary: 'The camera ISP driver updates vidioc_ ops for the image sensor capture pipeline.'
  });
  assert.equal(cameraV4l2.relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE);
  assert.equal(cameraV4l2.counts_as_driver_topic, true);
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

test('classifies vendor ISP driver names (atomisp, rkisp1, camss, mtk-isp) as camera driver topic', () => {
  // Short lore linux-media patch titles carry the vendor ISP driver name but no
  // "image sensor" / "camera pipeline" literal, so \bISP\b (word boundary) misses
  // the ISP inside "atomisp"/"rkisp1". The driver name itself is camera evidence.
  const titles = [
    'staging: media: atomisp: use kvmalloc_objs() for object allocation',
    'media: rkisp1: use fwnode_graph_for_each_endpoint_scoped()',
    'media: qcom: camss: fix VFE buffer done handling',
    'media: mediatek: mtk-isp: correct clock disable ordering'
  ];

  for (const title of titles) {
    const result = classifyAospCameraStackCandidate({
      title,
      summary: 'Kernel driver refactor for allocation and endpoint iteration helpers.'
    });
    assert.equal(result.relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE, title);
    assert.equal(result.counts_as_driver_topic, true, title);
    assert.equal(result.evidence_origin, 'article_text', title);
    assert.ok(result.driver_stack_relevance > 0, title);
  }
});

test('classifies uvcvideo driver and VIDIOC_ ioctl patch titles as camera driver topic', () => {
  // Camera/V4L2-specific linux-media titles whose only camera signal is the USB Video
  // Class driver name (uvcvideo) or a V4L2 ioctl identifier (VIDIOC_*) carry no separate
  // "V4L2"/"camera"/"sensor" literal, so \bV4L2\b and the descriptive patterns miss them
  // and they slipped to generic_tech_watchlist. The driver name / uAPI ioctl is the evidence.
  const titles = [
    'media: uvcvideo: fix race condition in status queue',
    'media: uvcvideo: correct bandwidth calculation for usb bulk endpoints',
    'media: reject invalid VIDIOC_SUBDEV_S_FMT flags in the subdev core'
  ];

  for (const title of titles) {
    const result = classifyAospCameraStackCandidate({
      title,
      summary: 'Kernel patch reworks queue handling and format validation helpers.'
    });
    assert.equal(result.relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE, title);
    assert.equal(result.counts_as_driver_topic, true, title);
    assert.equal(result.evidence_origin, 'article_text', title);
    assert.ok(result.driver_stack_relevance > 0, title);
  }
});

test('classifies public SoC platform signals without excluding them', () => {
  const soc = classifyAospCameraStackCandidate({
    title: 'Qualcomm Snapdragon platform update improves camera performance latency',
    summary: 'The public SoC note discusses GPU power, thermal limits, NPU scheduling, and camera latency for video capture workloads.'
  });

  assert.equal(soc.relevance_bucket, BUCKETS.ANDROID);
  assert.equal(soc.editorial_priority, 4);
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
    assert.equal(item.relevance_bucket, BUCKETS.ANDROID);
    assert.equal(item.editorial_priority, 4);
    assert.equal(item.counts_as_primary_camera_topic, false);
    assert.equal(item.counts_as_fallback_topic, false);
    assert.ok(item.multimedia_camera_output_relevance >= 2);
  }
});

test('accepts multimedia scope only with camera-output anchor and engineering signal', () => {
  const cases = [
    {
      title: 'MediaCodec encoder latency regression fixed for camera recording',
      summary: 'Android release notes describe a MediaCodec behavior change that improves camera recording encode latency.'
    },
    {
      title: 'A/V sync fix for recorded video playback in video calls',
      summary: 'Media3 fixes audio/video sync when camera-recorded clips are played back for video communication validation.'
    },
    {
      title: 'SurfaceView preview jank regression fixed',
      summary: 'Android updates SurfaceView preview behavior to reduce frame drop jank for camera preview output.'
    },
    {
      title: 'Photo Picker access update for captured camera videos',
      summary: 'Android changes Photo Picker and MediaStore compatibility for camera-generated video sharing.'
    },
    {
      title: 'WebRTC camera switching compatibility update',
      summary: 'A WebRTC camera switching regression fix changes video-call camera capture behavior.'
    },
    {
      title: 'Media3 playback fix for camera-generated HDR video output',
      summary: 'Media3 release notes fix camera-generated playback compatibility for captured HDR video output.'
    }
  ].map(classifyAospCameraStackCandidate);

  for (const item of cases) {
    assert.equal(item.relevance_bucket, BUCKETS.ANDROID);
    assert.equal(item.counts_as_primary_camera_topic, false);
    assert.ok(item.multimedia_camera_output_relevance >= 3);
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

test('rejects generic Media3 playback, streaming, OTT, gallery UI, and audio-only updates', () => {
  const rejected = [
    classifyAospCameraStackCandidate({
      title: 'Media3 release fixes ExoPlayer playback controls',
      summary: 'The release improves generic player UI behavior for media playback.'
    }),
    classifyAospCameraStackCandidate({
      title: 'Streaming playback update improves OTT app buffering',
      summary: 'Media3 updates streaming-only playback performance for TV clients.'
    }),
    classifyAospCameraStackCandidate({
      title: 'Music app DRM update',
      summary: 'The audio-only release fixes DRM behavior for music playback.'
    }),
    classifyAospCameraStackCandidate({
      title: 'Gallery UI consumer update',
      summary: 'The consumer gallery app changes layout and sharing buttons without camera output access impact.'
    }),
    classifyAospCameraStackCandidate({
      title: 'MediaCodec reference page updated',
      summary: 'The documentation page describes MediaCodec lifecycle concepts.'
    })
  ];

  for (const item of rejected) {
    assert.notEqual(item.relevance_bucket, BUCKETS.ANDROID);
  }
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

  assert.notEqual(mediaStore.relevance_bucket, BUCKETS.ANDROID);
  assert.notEqual(mediaProvider.relevance_bucket, BUCKETS.ANDROID);
  assert.notEqual(videoCallUi.relevance_bucket, BUCKETS.ANDROID);
  assert.notEqual(ultraHdrDisplay.relevance_bucket, BUCKETS.ANDROID);
});

test('direct camera candidates keep direct bucket despite multimedia source context', () => {
  const direct = classifyAospCameraStackCandidate({
    title: 'CameraX 1.7.0 fixes Camera2 interop behavior',
    summary: 'CameraX release notes change Camera2 interop validation for VideoCapture.',
    category: 'android-media',
    source_category: 'android-media',
    source: 'Media3 Release Notes'
  });
  const aosp = classifyAospCameraStackCandidate({
    title: 'AOSP CameraProvider AIDL update changes camera3 session metadata',
    summary: 'The Android Camera framework update changes ICameraDeviceSession request/result behavior.',
    category: 'android-media'
  });

  assert.equal(direct.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.equal(direct.editorial_priority, 1);
  assert.equal(aosp.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.equal(aosp.counts_as_primary_camera_topic, true);
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
  assert.equal(capturedOutput.relevance_bucket, BUCKETS.ANDROID);
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
  assert.equal(fallback.editorial_priority, 3);
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
    relevance_bucket_hint: BUCKETS.ANDROID
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

test('classifies security-bulletin camera RAW/DNG and image-codec CVEs as multimedia camera output', () => {
  // buildCveItem은 컴포넌트를 References href의 AOSP 경로(external/dng_sdk)로 채운다.
  const dng = classifyAospCameraStackCandidate({
    title: 'June 2026 Android Security Bulletin: CVE-2026-0008 — external/dng_sdk',
    api_or_component: 'Android Security Bulletin / external/dng_sdk',
    behavior_change: 'Security vulnerability (Critical severity) in external/dng_sdk; security fix shipped in the June 2026 Android Security Bulletin (CVE-2026-0008).',
    relevanceBucketHint: 'android_multimedia_camera_output'
  });
  const png = classifyAospCameraStackCandidate({
    title: 'June 2026 Android Security Bulletin: CVE-2026-0009 — external/libpng',
    api_or_component: 'Android Security Bulletin / external/libpng',
    behavior_change: 'Security vulnerability (Critical severity) in external/libpng; security fix shipped in the June 2026 Android Security Bulletin (CVE-2026-0009).',
    relevanceBucketHint: 'android_multimedia_camera_output'
  });

  for (const item of [dng, png]) {
    assert.equal(item.relevance_bucket, BUCKETS.ANDROID);
    assert.notEqual(item.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
    assert.equal(item.counts_as_primary_camera_topic, false);
    assert.ok(item.multimedia_camera_output_relevance >= 3);
  }
});

test('keeps generic image-codec releases without an AOSP source path out of the camera output bucket', () => {
  // libpng/libjpeg는 범용 코덱이라, external/ AOSP 경로 컨텍스트 없이 라이브러리명만 언급된
  // 일반 릴리스/CVE 기사는 카메라 출력으로 승격되면 안 된다(over-broad 회귀 방지).
  const png = classifyAospCameraStackCandidate({
    title: 'libpng 1.6.44 released with a security fix',
    summary: 'The libpng library fixes a heap buffer overflow in PNG decoding used by browsers and document viewers.'
  });
  const jpeg = classifyAospCameraStackCandidate({
    title: 'libjpeg-turbo update patches a vulnerability',
    summary: 'A libjpeg-turbo release fixes a buffer overflow in server-side image processing.'
  });

  for (const item of [png, jpeg]) {
    assert.notEqual(item.relevance_bucket, BUCKETS.ANDROID);
  }
});

// --- 버킷 병합 회귀 방지 (코드 리뷰에서 나온 것) ---

test('플랫폼-인접 힌트는 media 단어가 섞여도 주력으로 남는다', () => {
  // 병합 직후 한 판에서는 multimedia 용어 유무로 분기를 갈랐다. 그러면 플랫폼-인접
  // 후보가 media 단어 하나 때문에 보조로 강등되고 directness 가 2에서 0으로 떨어져
  // MIN_CAMERA_HAL_DIRECTNESS 게이트에서 통째로 탈락한다.
  const scope = classifyAospCameraStackCandidate({
    title: 'Android 17 compatibility update changes camera buffer handling',
    summary: 'The platform compatibility update changes graphics buffer and Surface behavior for camera preview, and mentions MediaCodec.',
    behavior_change: 'Camera preview buffer handling changed for apps targeting Android 17.',
    relevance_bucket_hint: 'android_platform_camera_adjacent'
  });

  assert.equal(scope.relevance_bucket, BUCKETS.ANDROID);
  assert.equal(scope.counts_as_primary_camera_topic, true);
  assert.equal(scope.aosp_camera_directness, 2);
});

test('힌트 폴백은 옛 보조 힌트를 주력으로 승격하지 않는다', () => {
  // 마지막 canUseBucketHint 분기가 무조건 platform_adjacent 로 채우면 옛 멀티미디어·SoC
  // 힌트가 directness 2 를 받는다. 병합 전에는 둘 다 directness 0 의 보조 버킷이었다.
  for (const hint of ['android_multimedia_camera_output', 'soc_platform_signal']) {
    const scope = classifyAospCameraStackCandidate({
      title: 'Ultra HDR capture output update',
      summary: 'Ultra HDR camera capture output behavior changed for gallery and media output.',
      behavior_change: 'Captured image output changed.',
      relevance_bucket_hint: hint
    });
    assert.equal(scope.relevance_bucket, BUCKETS.ANDROID, hint);
    assert.equal(scope.counts_as_primary_camera_topic, false, hint);
    assert.equal(scope.aosp_camera_directness, 0, hint);
  }
});
