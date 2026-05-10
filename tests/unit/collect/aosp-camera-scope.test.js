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
  assert.equal(soc.editorial_priority, 4);
  assert.equal(soc.counts_as_soc_topic, true);
  assert.ok(soc.soc_platform_relevance > 0);
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
  assert.equal(fallback.editorial_priority, 5);
  assert.equal(fallback.counts_as_fallback_topic, true);
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
