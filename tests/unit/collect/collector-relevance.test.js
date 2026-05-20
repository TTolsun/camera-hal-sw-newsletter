const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUCKETS
} = require('../../../scripts/lib/aosp-camera-scope');
const { parseSourceSpecificItems } = require('../../../scripts/lib/source-item-parsers');
const {
  canonicalContentUrl,
  fetchUrlForContent,
  newsletterDateWindowEnd,
  normalizeCandidate,
  resolveLinkedReleaseNoteEvidenceItems,
  withinLookback
} = require('../../../scripts/newsroom/cli/collect-news-candidates');
const { readTextFixture } = require('../../helpers/fixture-loader');

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

test('collector keeps compiler CPU and GPU benchmarks out of SoC fallback without strong platform evidence', () => {
  const candidate = normalizeCandidate(raw({
    title: 'GCC 16 compiler benchmark shows CPU and GPU performance gains',
    url: 'https://www.phoronix.com/review/gcc-16-benchmarks',
    summary: 'The benchmark compares native C++ compiler performance across build and runtime tests.'
  }));

  assert.equal(candidate.relevance_bucket, BUCKETS.CPP_AI_TOOLING_FALLBACK);
  assert.equal(candidate.counts_as_soc_topic, false);
  assert.equal(candidate.counts_as_fallback_topic, true);
});

test('collector keeps generic GPU/NPU/SoC benchmark only coverage out of SoC non-fallback', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'soc-platform-news',
      name: 'Public SoC Platform News',
      category: 'soc',
      section: 'SoC Platform / Performance',
      keywords: ['SoC', 'CPU', 'GPU', 'NPU', 'benchmark']
    }),
    title: 'SoC benchmark compares GPU, NPU, and CPU scores',
    url: 'https://example.com/soc-gpu-npu-benchmark',
    summary: 'The benchmark compares synthetic GPU, NPU, CPU, cache, and memory bandwidth scores.'
  }));

  assert.equal(candidate.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(candidate.counts_as_soc_topic, false);
  assert.equal(candidate.finalSelectionEligibility, 'watchlist');
});

test('collector does not backfill derived editorial relevance bucket hint into classification', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'generic-platform-news',
      name: 'Generic Platform News',
      category: 'platform',
      section: 'Platform Watch',
      keywords: ['platform', 'release'],
      usageHint: 'Generic platform release notes'
    }),
    title: 'Generic platform release notes',
    url: 'https://example.com/platform-release-notes',
    summary: 'The release updates documentation, dashboards, and sorting behavior.',
    behavior_change: 'Documentation and dashboard sorting were updated.',
    derived_editorial_hints: {
      relevance_bucket_hint: BUCKETS.DIRECT_AOSP_CAMERA,
      hal_boundary: 'framework_adjacent_not_direct_hal_contract',
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  }));

  assert.equal(candidate.derived_editorial_hints.relevance_bucket_hint, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.equal(candidate.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.equal(candidate.counts_as_primary_camera_topic, false);
  assert.equal(candidate.source_gap_risk, true);
});

test('collector applies exact-day and month-overlap lookback rules', () => {
  const now = newsletterDateWindowEnd('2026-05-06');

  assert.equal(now.toISOString(), '2026-05-06T23:59:59.999Z');
  assert.equal(withinLookback({ publishedAt: '2026-04-01', datePrecision: 'month' }, now, 21), true);
  assert.equal(withinLookback({ publishedAt: '2026-03-01', datePrecision: 'month' }, now, 21), false);
  assert.equal(withinLookback({ publishedAt: 'March 25, 2026' }, now, 21), false);
  assert.equal(withinLookback({ publishedAt: 'March 25, 2026' }, now, 28), false);
  assert.equal(withinLookback({ publishedAt: '2026-04-28' }, now, 21), true);
  assert.equal(withinLookback({ publishedAt: '2026-05-06T23:30:00Z' }, now, 21), true);
  assert.equal(withinLookback({ publishedAt: '2026-05-07T00:00:00Z' }, now, 21), false);
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

test('collector keeps official AOSP and CameraX camera child rows reviewable without promoting non-camera HAL', () => {
  const aospSource = source({
    id: 'aosp-site-updates',
    name: 'AOSP Site Updates',
    url: 'https://source.android.com/docs/whatsnew/site-updates',
    sourceUrl: 'https://source.android.com/docs/whatsnew/site-updates',
    category: 'aosp',
    section: 'Android / AOSP / Camera',
    priority: 'high',
    reliability: 'official',
    keywords: ['AOSP', 'Camera', 'Camera ITS', 'CDD']
  });
  const cameraRows = [
    ...parseSourceSpecificItems(
      readTextFixture('source-html/aosp-site-updates-paragraph-camera.html'),
      aospSource
    )
  ].map(item => normalizeCandidate(item));
  const aospCameraRow = cameraRows.find(item => item.title === 'Camera ITS');

  assert.ok(aospCameraRow);
  assert.equal(aospCameraRow.source_gap_risk, false);
  assert.equal(aospCameraRow.main_eligible, true);
  assert.ok(['main', 'short'].includes(aospCameraRow.finalSelectionEligibility));

  const cameraProviderRow = cameraRows.find(item => item.title === 'Camera Provider');
  assert.ok(cameraProviderRow);
  assert.equal(cameraProviderRow.relevance_bucket, BUCKETS.DIRECT_AOSP_CAMERA);
  assert.ok(['main', 'short'].includes(cameraProviderRow.finalSelectionEligibility));

  const cameraXRows = parseSourceSpecificItems(
    readTextFixture('source-html/camerax-release-notes-1.6.html'),
    source({
      id: 'camerax-release-notes',
      name: 'CameraX Release Notes',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera',
      sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
      category: 'camera-api',
      section: 'Android / AOSP / Camera',
      priority: 'high',
      reliability: 'official',
      keywords: ['CameraX', 'androidx.camera']
    })
  ).map(item => normalizeCandidate(item));

  assert.equal(cameraXRows.length, 2);
  assert.ok(cameraXRows.some(item => item.version_or_release === 'CameraX 1.6.1'));
  assert.ok(cameraXRows.some(item => item.source_extraction?.release?.sections?.some(section =>
    section.items.some(releaseItem => /ListenableFuture compile error/.test(releaseItem.text))
  )));
  assert.ok([
    BUCKETS.DIRECT_AOSP_CAMERA,
    BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT
  ].includes(cameraXRows[0].relevance_bucket));

  const nonCameraHal = normalizeCandidate(raw({
    source: aospSource,
    title: 'KeyMint HAL documentation update',
    url: 'https://source.android.com/docs/security/features/keystore',
    summary: 'Updated KeyMint HAL behavior for secure key management.',
    sourceKind: 'release_note_item',
    collectionMode: 'release-note-item',
    version_or_release: 'AOSP Site Updates - May 2026',
    api_or_component: 'KeyMint HAL',
    behavior_change: 'Updated KeyMint HAL behavior for secure key management.'
  }));

  assert.equal(nonCameraHal.relevance_bucket, BUCKETS.GENERIC_TECH_WATCHLIST);
  assert.ok(['watchlist', 'exclude'].includes(nonCameraHal.finalSelectionEligibility));
});

test('collector resolves link-only Latest Updates CameraX rows through deterministic release-note parse', async () => {
  const latestUpdatesSource = source({
    id: 'android-developers-latest-updates',
    name: 'Android Developers Latest Updates',
    url: 'https://developer.android.com/latest-updates',
    sourceUrl: 'https://developer.android.com/latest-updates',
    category: 'camera-api',
    section: 'Android / AOSP / Camera',
    priority: 'high',
    reliability: 'official',
    keywords: ['CameraX', 'androidx.camera']
  });
  const unresolved = parseSourceSpecificItems(
    readTextFixture('source-html/android-latest-updates-camerax-link-only.html'),
    latestUpdatesSource
  );

  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].behavior_change, '');

  const resolved = await resolveLinkedReleaseNoteEvidenceItems(unresolved, latestUpdatesSource, {
    fetchTextImpl: async (url) => {
      assert.equal(url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1');
      return readTextFixture('source-html/camerax-release-notes-live-structure.html');
    }
  });
  const candidate = normalizeCandidate(resolved[0]);

  assert.equal(candidate.article_url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1');
  assert.equal(candidate.publishedAt, 'May 06, 2026');
  assert.equal(candidate.datePrecision || 'day', 'day');
  assert.equal(candidate.version_or_release, 'CameraX 1.6.1');
  assert.match(candidate.behavior_change, /Cannot access class ListenableFuture/);
  assert.equal(candidate.source_gap_risk, false);
  assert.equal(candidate.main_eligible, true);
  assert.equal(candidate.source_extraction.extraction_quality.used_versioned_release_row_extractor, true);
  assert.equal(candidate.source_extraction.extraction_quality.used_fallback, false);
  assert.deepEqual(
    candidate.source_extraction.bullets,
    candidate.source_extraction.release.sections.flatMap(section => section.items.map(item => item.text))
  );
  assert.ok(candidate.source_extraction.links.some(link => link.role === 'parent_source'));
  assert.ok(candidate.source_extraction.links.some(link => link.role === 'release_note_anchor'));
  assert.equal(
    candidate.source_extraction.links.some(link => link.role === 'issue_or_bug'),
    false
  );
});

test('collector keeps libcamera v0.7.1 release as camera driver image pipeline candidate', () => {
  const items = parseSourceSpecificItems(
    readTextFixture('source-html/libcamera-release-v0.7.1.html'),
    source({
      id: 'libcamera-release-announcements',
      name: 'libcamera Release Announcements',
      url: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html',
      sourceUrl: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html',
      category: 'linux-camera',
      section: 'Linux Camera / Driver',
      priority: 'high',
      reliability: 'project-official',
      keywords: ['libcamera', 'V4L2', 'SoftISP', 'camera', 'pipeline']
    })
  ).map(item => normalizeCandidate(item));

  assert.equal(items.length, 1);
  assert.equal(items[0].publishedAt, '2026-04-28');
  assert.equal(items[0].relevance_bucket, BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE);
  assert.equal(items[0].counts_as_driver_topic, true);
  assert.ok(['main', 'short'].includes(items[0].finalSelectionEligibility));
  assert.match(items[0].behavior_change, /SoftISP/);
  assert.match(items[0].behavior_change, /pipeline handler/);
  assert.match(items[0].behavior_change, /sensor mode configuration/);
});

test('collector forces official documentation reference source out of final article inputs', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'aosp-camera-documentation',
      name: 'AOSP Camera Documentation',
      url: 'https://source.android.com/docs/core/camera',
      sourceUrl: 'https://source.android.com/docs/core/camera',
      sourceRole: 'official_documentation_reference',
      sourceUrlQualityHint: 'official_documentation_reference',
      mainArticlePolicy: 'reference_only',
      requiresCrossCheckDefault: false,
      evidenceGranularityHint: 'reference_page',
      sourceQualityNotes: ['reference/background source only'],
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

  assert.equal(candidate.source_role, 'official_documentation_reference');
  assert.equal(candidate.source_quality.source_url_quality, 'official_documentation_reference');
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

test('collector allows public SoC platform signals only with camera impact evidence', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'soc-platform-news',
      name: 'Public SoC Platform News',
      category: 'soc',
      section: 'SoC Platform / Performance',
      keywords: ['SoC', 'CPU', 'GPU', 'thermal', 'power']
    }),
    title: 'Snapdragon SoC update improves camera performance and video capture latency',
    url: 'https://example.com/snapdragon-gpu-dvfs',
    summary: 'The public platform note discusses NPU scheduling, GPU power, thermal limits, and camera latency for video capture workloads.'
  }));

  assert.equal(candidate.relevance_bucket, BUCKETS.SOC_PLATFORM_SIGNAL);
  assert.equal(candidate.counts_as_soc_topic, true);
});
