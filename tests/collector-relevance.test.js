const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUCKETS
} = require('../scripts/lib/aosp-camera-scope');
const {
  canonicalContentUrl,
  fetchUrlForContent,
  normalizeCandidate
} = require('../scripts/newsroom/cli/collect-news-candidates');

function source(overrides = {}) {
  return {
    id: 'phoronix-linux-camera-media',
    name: 'Phoronix Linux Camera / Media',
    url: 'https://www.phoronix.com/',
    sourceUrl: 'https://www.phoronix.com/',
    category: 'linux-kernel',
    section: 'Linux Kernel / Platform Watch',
    priority: 'medium',
    reliability: 'tech-media',
    keywords: ['Linux', 'kernel', 'V4L2', 'media', 'driver', 'camera'],
    usageHint: 'Linux kernel, V4L2, media subsystem, driver release lead',
    candidateOnly: false,
    requiresCrossCheck: true,
    ...overrides
  };
}

function raw(overrides = {}) {
  return {
    source: source(),
    title: 'FreeBSD 15.1 Beta Released',
    url: 'https://www.phoronix.com/news/freebsd-15.1-beta',
    publishedAt: '2026-05-05T00:00:00Z',
    summary: 'FreeBSD 15.1 Beta is available with general filesystem and networking changes.',
    sourceKind: 'rss_item',
    collectionMode: 'rss-item',
    ...overrides
  };
}

test('collector does not use source metadata to promote FreeBSD into camera driver relevance', () => {
  const candidate = normalizeCandidate(raw());

  assert.equal(candidate.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(candidate.counts_as_driver_topic, false);
  assert.equal(candidate.api_or_component, '');
  assert.equal(candidate.has_api_or_component, false);
  assert.ok(candidate.evidence_score < 6);
  assert.notEqual(candidate.finalSelectionEligibility, 'main');
});

test('collector keeps Linux audio fixes out of camera driver bucket without article camera evidence', () => {
  const candidate = normalizeCandidate(raw({
    title: 'Linux 7.1-rc2 Fixes Steam Deck Audio Regression',
    url: 'https://www.phoronix.com/news/linux-7.1-rc2-audio',
    summary: 'The release candidate fixes an audio regression and general driver bugs.'
  }));

  assert.equal(candidate.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(candidate.counts_as_driver_topic, false);
  assert.equal(candidate.api_or_component, '');
});

test('collector classifies GCC benchmark as fallback, not direct camera topic', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'gcc-toolchain-news',
      name: 'GCC Toolchain News',
      category: 'toolchain',
      section: 'C++ / Native / Toolchain',
      keywords: ['GCC', 'compiler', 'C++', 'toolchain']
    }),
    title: 'GCC 16 Benchmark Shows Native Compiler Performance',
    url: 'https://example.com/gcc-16-benchmark',
    summary: 'The benchmark compares GCC 16 native C++ performance across build and runtime tests.'
  }));

  assert.equal(candidate.relevance_bucket, BUCKETS.CPP_AI_TOOLING_FALLBACK);
  assert.equal(candidate.counts_as_primary_camera_topic, false);
  assert.equal(candidate.counts_as_driver_topic, false);
});

test('collector keeps CameraX and V4L2 article text in the expected buckets', () => {
  const cameraX = normalizeCandidate(raw({
    source: source({ category: 'camera-api', section: 'Android / AOSP / Camera', keywords: ['CameraX'] }),
    title: 'CameraX 1.5.0 Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.5.0',
    summary: 'CameraX 1.5.0 changes Camera2 interop and Android Camera compatibility behavior.',
    version_or_release: 'CameraX 1.5.0',
    behavior_change: 'CameraX 1.5.0 changes Camera2 interop behavior.'
  }));
  const v4l2 = normalizeCandidate(raw({
    source: source(),
    title: 'V4L2 media controller patch updates image sensor routing',
    url: 'https://example.com/v4l2-media-controller',
    summary: 'The Linux media subsystem patch changes video capture and camera sensor routing.',
    behavior_change: 'The patch updates video capture routing.'
  }));

  assert.equal(cameraX.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.equal(cameraX.counts_as_primary_camera_topic, true);
  assert.equal(v4l2.relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE);
  assert.equal(v4l2.counts_as_driver_topic, true);
});

test('collector canonicalizes Android docs locale URLs and keeps Latest Updates CameraX rows adjacent', () => {
  assert.equal(
    canonicalContentUrl('https://developer.android.google.cn/jetpack/androidx/releases/camera?hl=ko#1.5.0-beta01'),
    'https://developer.android.com/jetpack/androidx/releases/camera#1.5.0-beta01'
  );
  assert.equal(
    fetchUrlForContent('https://source.android.com/docs/whatsnew/site-updates'),
    'https://source.android.com/docs/whatsnew/site-updates?hl=en'
  );

  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'android-developers-latest-updates',
      name: 'Android Developers Latest Updates',
      url: 'https://developer.android.com/latest-updates',
      sourceUrl: 'https://developer.android.com/latest-updates',
      category: 'android',
      section: 'Android / AOSP / Camera',
      reliability: 'official',
      keywords: ['Android', 'CameraX']
    }),
    title: 'Camera Maven Group versions',
    url: 'https://developer.android.google.cn/jetpack/androidx/releases/camera?hl=ko#1.5.0-beta01',
    summary: 'Added CameraX compatibility updates for Android camera apps.',
    version_or_release: 'CameraX 1.5.0-beta01',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'Added CameraX compatibility updates for Android camera apps.',
    sourceKind: 'release_note_item',
    collectionMode: 'release-note-item',
    relevanceBucketHint: BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT
  }));

  assert.equal(candidate.url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.5.0-beta01');
  assert.equal(candidate.relevance_bucket, BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT);
  assert.ok(['main', 'short'].includes(candidate.finalSelectionEligibility));
});

test('collector forces reference_index source out of final article inputs', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'aosp-camera-documentation',
      name: 'AOSP Camera Documentation',
      url: 'https://source.android.com/docs/core/camera',
      sourceUrl: 'https://source.android.com/docs/core/camera',
      sourceRole: 'reference_index',
      category: 'camera-hal',
      section: 'Android / AOSP / Camera',
      reliability: 'official',
      keywords: ['Camera HAL', 'Camera ITS']
    }),
    title: 'AOSP Camera Documentation',
    url: 'https://source.android.com/docs/core/camera?hl=ko',
    publishedAt: '2026-05-01',
    summary: 'Camera HAL, Camera version support, and Camera ITS background documentation.',
    sourceKind: 'documentation_page',
    collectionMode: 'html-watch-page',
    version_or_release: 'AOSP Camera docs',
    api_or_component: 'Camera HAL',
    behavior_change: 'Updated documentation index.'
  }));

  assert.equal(candidate.source_role, 'reference_index');
  assert.equal(candidate.finalSelectionEligibility, 'exclude');
  assert.equal(candidate.main_eligible, false);
  assert.equal(candidate.reference_only, true);
  assert.equal(candidate.url, 'https://source.android.com/docs/core/camera');
});

test('collector keeps article-level ICamera and Linux camera pipeline candidates selectable', () => {
  const icamera = normalizeCandidate(raw({
    source: source({ category: 'camera-hal', section: 'Android / AOSP / Camera', keywords: ['Camera HAL', 'AIDL'] }),
    title: 'ICameraProvider AIDL update changes camera3 behavior',
    url: 'https://example.com/icamera-aidl',
    summary: 'The camera HAL interface update affects ICameraDeviceSession capture request handling.',
    behavior_change: 'The ICameraProvider AIDL update changes capture request handling.'
  }));
  const linuxCamera = normalizeCandidate(raw({
    source: source(),
    title: 'Linux camera subsystem update improves image pipeline routing',
    url: 'https://example.com/linux-camera-subsystem',
    summary: 'The camera pipeline change affects Linux capture devices and sensor routing.',
    behavior_change: 'The Linux camera subsystem update changes sensor routing.'
  }));

  assert.equal(icamera.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.equal(icamera.counts_as_primary_camera_topic, true);
  assert.notEqual(icamera.finalSelectionEligibility, 'watchlist');
  assert.equal(linuxCamera.relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE);
  assert.equal(linuxCamera.counts_as_driver_topic, true);
  assert.notEqual(linuxCamera.finalSelectionEligibility, 'watchlist');
});

test('collector allows public SoC platform signals as soc fallback', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'soc-platform-news',
      name: 'Public SoC Platform News',
      category: 'soc',
      section: 'SoC Platform / Performance',
      keywords: ['SoC', 'CPU', 'GPU', 'thermal', 'power']
    }),
    title: 'Snapdragon SoC update improves GPU DVFS and thermal behavior',
    url: 'https://example.com/snapdragon-gpu-dvfs',
    summary: 'The public platform note discusses CPU scheduler, GPU power, thermal limits, and memory bandwidth.'
  }));

  assert.equal(candidate.relevance_bucket, BUCKETS.SOC_PLATFORM_SIGNAL);
  assert.equal(candidate.counts_as_soc_topic, true);
});
