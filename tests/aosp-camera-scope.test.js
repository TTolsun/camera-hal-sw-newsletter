const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUCKETS,
  classifyAospCameraStackCandidate
} = require('../scripts/lib/aosp-camera-scope');

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

test('classifies V4L2, libcamera, ISP, image sensor, and driver evidence', () => {
  const camera = classifyAospCameraStackCandidate({
    title: 'V4L2 media controller patch fixes camera sensor format negotiation',
    summary: 'The Linux camera driver update changes DMA-BUF frame handling in the ISP buffer pipeline.'
  });

  assert.equal(camera.relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE);
  assert.equal(camera.counts_as_driver_topic, true);
  assert.ok(camera.driver_stack_relevance > 0);
});

test('classifies public SoC platform signals without excluding them', () => {
  const soc = classifyAospCameraStackCandidate({
    title: 'Qualcomm Snapdragon platform update improves GPU and NPU DVFS',
    summary: 'The public SoC note discusses memory bandwidth, thermal limits, interconnect, and CPU scheduler behavior.'
  });

  assert.equal(soc.relevance_bucket, BUCKETS.SOC_PLATFORM_SIGNAL);
  assert.equal(soc.editorial_priority, 4);
  assert.equal(soc.counts_as_soc_topic, true);
  assert.ok(soc.soc_platform_relevance > 0);
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

test('keeps generic Linux, FreeBSD, and GCC items in watchlist without source-keyword promotion', () => {
  const generic = classifyAospCameraStackCandidate({
    title: 'Linux 6.18, FreeBSD, and GCC updates arrive',
    summary: 'General filesystem, networking, release engineering, and community updates are available.',
    source: 'Phoronix Linux Camera / Media',
    source_section: 'Linux Camera / Driver',
    source_usage_hint: 'Linux kernel, V4L2, media subsystem, driver release lead'
  });

  assert.equal(generic.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(generic.counts_as_primary_camera_topic, false);
  assert.equal(generic.evidence_origin, 'source_hint_only');
});
