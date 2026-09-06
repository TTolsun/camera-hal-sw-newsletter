const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUCKETS
} = require('../../../domain/aosp-camera-scope');
const {
  extractRoundupChildTopics
} = require('../../../collect/roundup-child-topic-extractor');
const { parseSourceSpecificItems } = require('../../../collect/source-item-parsers');
const {
  canonicalContentUrl,
  dedupe,
  fetchUrlForContent,
  newsletterDateWindowEnd,
  normalizeCandidate,
  parseRss,
  resolveLinkedReleaseNoteEvidenceItems,
  withinLookback
} = require('../../../cli/collect-news-candidates');
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

test('collector dedupe prefers source change event candidate for the same URL and title', () => {
  const generic = {
    title: 'Camera release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    source_kind: 'html_page',
    source_type: 'html_page'
  };
  const sourceEvent = {
    ...generic,
    source_kind: 'source_change_event',
    source_type: 'source_change_event',
    collectionMode: 'source-change-event',
    evidence_id: 'evidence-source-event'
  };

  const result = dedupe([generic, sourceEvent]);

  assert.equal(result.length, 1);
  assert.equal(result[0].source_kind, 'source_change_event');
  assert.equal(result[0].evidence_id, 'evidence-source-event');
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
    relevanceBucketHint: BUCKETS.ANDROID
  }));

  assert.equal(candidate.url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.5.0-beta01');
  assert.equal(candidate.relevance_bucket, BUCKETS.ANDROID);
  assert.ok(['main', 'short'].includes(candidate.finalSelectionEligibility));
});

test('RSS roundup child extraction is additive and uses normal evidence derivation', () => {
  const rss = readTextFixture('source-html/android-developers-roundup-rss.xml');
  const androidSource = source({
    id: 'android-developers-blog',
    name: 'Android Developers Blog',
    url: 'https://android-developers.googleblog.com/',
    sourceUrl: 'https://android-developers.googleblog.com/',
    category: 'android',
    section: 'Android / AOSP / Camera',
    priority: 'high',
    reliability: 'official',
    keywords: ['Android', 'CameraX', 'camera', 'media']
  });
  const rawDescription = (rss.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || [])[1] || '';
  const rawChildren = extractRoundupChildTopics({
    source: androidSource,
    parentTitle: '17 Things to know for Android developers at Google I/O',
    parentUrl: 'https://android-developers.googleblog.com/2026/05/17-things-google-io.html',
    publishedAt: 'Wed, 20 May 2026 10:00:00 GMT',
    html: rawDescription,
    rawText: rawDescription
  });
  const items = parseRss(rss, androidSource);

  const parent = items.find(item => item.title === '17 Things to know for Android developers at Google I/O');
  const sibling = items.find(item => item.title === 'Unrelated Android platform article');
  const child = items.find(item => item.source_extraction?.mode === 'roundup_child_topic');

  assert.equal(rawChildren.length, 1);
  assert.ok(parent);
  assert.ok(sibling);
  assert.ok(child);
  assert.equal(items.filter(item => item.source_extraction?.mode === 'roundup_child_topic').length, 1);
  assert.equal(parent.source_kind, 'rss_item');
  assert.ok(['watchlist', 'exclude'].includes(parent.finalSelectionEligibility));
  assert.equal(sibling.source_kind, 'rss_item');
  assert.equal(child.source_kind, 'blog_post_item');
  assert.equal(child.collectionMode, 'article-item');
  assert.equal(child.version_or_release, '');
  assert.equal(child.parent_url, 'https://android-developers.googleblog.com/2026/05/17-things-google-io.html');
  assert.equal(child.parent_title, '17 Things to know for Android developers at Google I/O');
  assert.equal(child.url, 'https://android-developers.googleblog.com/2026/05/17-things-google-io.html#roundup-child-1-advanced-professional-video');
  assert.equal(child.source_extraction.child_heading, 'Advanced Professional Video');
  assert.match(child.source_extraction.evidence_blocks[0].text, /introduces a new media framework format/);
  assert.match(child.summary, /introduces a new media framework format/);
  assert.equal(child.api_or_component, 'Android media/camera output');
  assert.equal(rawChildren[0].relevanceBucketHint, 'android_multimedia_camera_output');
  assert.equal(child.has_behavior_change, true);
  assert.equal(child.source_gap_risk, false);
  assert.ok(['main', 'short'].includes(child.finalSelectionEligibility));
  assert.ok([
    BUCKETS.ANDROID,
    BUCKETS.ANDROID,
    BUCKETS.DIRECT_AOSP_CAMERA
  ].includes(child.relevance_bucket));
  assert.equal(items.some(item => /Compose|audio routing|Screen recording/i.test(item.title) && item.source_extraction?.mode === 'roundup_child_topic'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rawChildren[0], 'source_gap_risk'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rawChildren[0], 'finalSelectionEligibility'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rawChildren[0], 'main_eligible'), false);
});

test('roundup extraction quality alone does not make an underfilled child selectable', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'android-developers-blog',
      name: 'Android Developers Blog',
      url: 'https://android-developers.googleblog.com/',
      sourceUrl: 'https://android-developers.googleblog.com/',
      category: 'android',
      section: 'Android / AOSP / Camera',
      priority: 'high',
      reliability: 'official',
      keywords: ['Android', 'camera']
    }),
    title: 'Camera output child topic',
    url: 'https://android-developers.googleblog.com/2026/05/roundup.html#roundup-child-1-camera-output',
    publishedAt: 'Wed, 20 May 2026 10:00:00 GMT',
    summary: 'Camera output topic.',
    sourceKind: 'blog_post_item',
    collectionMode: 'article-item',
    version_or_release: '',
    api_or_component: 'Android media/camera output',
    behavior_change: '',
    source_extraction: {
      mode: 'roundup_child_topic',
      extraction_quality: {
        has_concrete_child_topic_evidence: false,
        main_article_allowed: true,
        used_fallback: false
      }
    },
    extraction_quality: {
      has_concrete_child_topic_evidence: false,
      main_article_allowed: true,
      used_fallback: false
    }
  }));

  assert.equal(candidate.source_gap_risk, true);
  assert.equal(['main', 'short'].includes(candidate.finalSelectionEligibility), false);
});

test('roundup behavior wording does not promote generic announcements without camera evidence', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'android-developers-blog',
      name: 'Android Developers Blog',
      url: 'https://android-developers.googleblog.com/',
      sourceUrl: 'https://android-developers.googleblog.com/',
      category: 'android',
      section: 'Android / AOSP / Camera',
      priority: 'high',
      reliability: 'official',
      keywords: ['Android']
    }),
    title: 'Generic developer announcement',
    url: 'https://android-developers.googleblog.com/2026/05/roundup.html#roundup-child-2-generic',
    publishedAt: 'Wed, 20 May 2026 10:00:00 GMT',
    summary: 'Android introduces product updates for developer workflow planning.',
    sourceKind: 'blog_post_item',
    collectionMode: 'article-item',
    version_or_release: '',
    api_or_component: '',
    behavior_change: 'Android introduces product updates for developer workflow planning.',
    source_extraction: {
      mode: 'roundup_child_topic',
      extraction_quality: {
        has_concrete_child_topic_evidence: true,
        main_article_allowed: true,
        used_fallback: false
      }
    }
  }));

  assert.equal(candidate.has_behavior_change, true);
  assert.equal(candidate.source_gap_risk, true);
  assert.equal(['main', 'short'].includes(candidate.finalSelectionEligibility), false);
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
    BUCKETS.ANDROID
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

  const fetchUrls = [];
  const secondUnresolved = {
    ...unresolved[0],
    title: 'CameraX 1.6.0',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
    linked_release_note_target_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
    version_or_release: 'CameraX 1.6.0',
    publishedAt: 'March 25, 2026',
    source_extraction: {
      ...unresolved[0].source_extraction,
      release: {
        ...unresolved[0].source_extraction.release,
        version: 'CameraX 1.6.0',
        date: 'March 25, 2026'
      }
    }
  };
  const resolved = await resolveLinkedReleaseNoteEvidenceItems([unresolved[0], secondUnresolved], latestUpdatesSource, {
    fetchTextImpl: async (url) => {
      fetchUrls.push(url);
      return readTextFixture('source-html/camerax-release-notes-live-structure.html');
    }
  });
  const candidate = normalizeCandidate(resolved[0]);
  const cachedCandidate = normalizeCandidate(resolved[1]);

  assert.deepEqual(fetchUrls, ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']);
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
  assert.equal(cachedCandidate.article_url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0');
  assert.equal(cachedCandidate.version_or_release, 'CameraX 1.6.0');
  assert.match(cachedCandidate.behavior_change, /CameraPipe SessionConfig support/);
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
  assert.ok(['official_documentation_reference', 'undated_reference_page'].includes(candidate.source_quality.source_url_quality));
  assert.equal(candidate.finalSelectionEligibility, 'exclude');
  assert.equal(candidate.main_eligible, false);
  assert.equal(candidate.reference_only, true);
  assert.equal(candidate.url, 'https://source.android.com/docs/core/camera');
});

test('Media3 release notes promote only concrete camera-output items', () => {
  const media3Source = source({
    id: 'androidx-media3-release-notes',
    name: 'Media3 Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/media3',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/media3',
    sourceRole: 'official_release_source',
    sourceUrlQualityHint: 'official_release_note_anchor',
    mainArticlePolicy: 'allowed',
    requiresCrossCheckDefault: false,
    evidenceGranularityHint: 'versioned_release_row',
    sourceQualityNotes: ['official source'],
    category: 'android-media',
    section: 'Android Media / Camera Output',
    priority: 'medium',
    reliability: 'official',
    keywords: ['Media3', 'MediaCodec', 'camera output', 'recording', 'A/V sync']
  });
  const html = `
    <h2 id="media3">Media3</h2>
    <p>Code Sample API Reference androidx.media3.common Support libraries for media use cases. Version 1.8.0 was updated on May 20, 2026.</p>
    <h2 id="1.8.0">Version 1.8.0</h2>
    <p>May 20, 2026</p>
    <ul>
      <li>Fixed Media3 audio/video sync regression when playing back camera-recorded videos in video call validation flows.</li>
    </ul>
    <h2 id="1.7.0">Version 1.7.0</h2>
    <p>May 10, 2026</p>
    <ul>
      <li>Improved ExoPlayer streaming-only playback buffering for OTT apps.</li>
    </ul>
  `;
  const items = parseSourceSpecificItems(html, media3Source).map(item => normalizeCandidate(item));
  const cameraOutput = items.find(item => item.version_or_release === 'Media3 1.8.0');
  const streamingOnly = items.find(item => item.version_or_release === 'Media3 1.7.0');

  assert.equal(items.length, 2);
  assert.equal(items.some(item => item.url.endsWith('#media3')), false);
  assert.ok(cameraOutput);
  assert.equal(cameraOutput.relevance_bucket, BUCKETS.ANDROID);
  assert.equal(cameraOutput.reference_only, false);
  assert.equal(cameraOutput.source_gap_risk, false);
  assert.ok(['main', 'short'].includes(cameraOutput.finalSelectionEligibility));
  assert.ok(streamingOnly);
  assert.notEqual(streamingOnly.relevance_bucket, BUCKETS.ANDROID);
  assert.equal(streamingOnly.finalSelectionEligibility, 'watchlist');
});

test('official Android media reference docs remain reference-only without dated camera-output change', () => {
  const candidate = normalizeCandidate(raw({
    source: source({
      id: 'android-mediacodec-reference',
      name: 'MediaCodec Reference',
      url: 'https://developer.android.com/reference/android/media/MediaCodec',
      sourceUrl: 'https://developer.android.com/reference/android/media/MediaCodec',
      sourceRole: 'official_documentation_reference',
      sourceUrlQualityHint: 'official_documentation_reference',
      mainArticlePolicy: 'reference_only',
      requiresCrossCheckDefault: false,
      evidenceGranularityHint: 'reference_page',
      sourceQualityNotes: ['reference/background source only'],
      category: 'android-media',
      section: 'Android Media / Camera Output',
      reliability: 'official',
      keywords: ['MediaCodec', 'Android media']
    }),
    title: 'MediaCodec Reference',
    url: 'https://developer.android.com/reference/android/media/MediaCodec?hl=ko',
    publishedAt: '',
    summary: 'Reference documentation for MediaCodec lifecycle and buffers.',
    sourceKind: 'documentation_page',
    collectionMode: 'html-watch-page',
    version_or_release: '',
    api_or_component: 'MediaCodec',
    behavior_change: ''
  }));

  assert.equal(candidate.source_role, 'official_documentation_reference');
  assert.ok(['official_documentation_reference', 'undated_reference_page'].includes(candidate.source_quality.source_url_quality));
  assert.equal(candidate.finalSelectionEligibility, 'exclude');
  assert.equal(candidate.main_eligible, false);
  assert.equal(candidate.reference_only, true);
  assert.equal(candidate.source_quality.main_article_source_allowed, false);
  assert.ok(candidate.source_quality.main_article_source_blockers.includes('reference_only'));
  assert.notEqual(candidate.relevance_bucket, BUCKETS.ANDROID);
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

  assert.equal(candidate.relevance_bucket, BUCKETS.ANDROID);
  assert.equal(candidate.counts_as_soc_topic, true);
});

test('reddit search.rss yields a community-signal candidate that never reaches main/short', () => {
  const rss = readTextFixture('source-html/reddit-search-camera.rss');
  const redditSource = source({
    id: 'reddit-androiddev-camera',
    name: 'Reddit r/androiddev',
    url: 'https://www.reddit.com/r/androiddev/',
    sourceUrl: 'https://www.reddit.com/r/androiddev/',
    category: 'android',
    section: 'Android / AOSP / Camera',
    priority: 'low',
    reliability: 'community',
    candidateOnly: true,
    requiresCrossCheck: true,
    keywords: ['camera', 'HAL', 'Android']
  });

  const items = parseRss(rss, redditSource);

  assert.ok(items.length >= 1);
  const candidate = items[0];
  assert.equal(candidate.community_signal, true);
  assert.equal(candidate.community_signal_source, 'reddit');
  assert.equal(candidate.community_signal_role, 'candidate_discovery');
  assert.equal(candidate.reddit_subreddit, 'androiddev');
  assert.equal(candidate.candidate_only, true);
  assert.ok(['watchlist', 'exclude'].includes(candidate.finalSelectionEligibility));
  assert.equal(['main', 'short'].includes(candidate.finalSelectionEligibility), false);
  assert.equal(candidate.source_quality.main_article_source_allowed, false);
});

test('non-reddit candidates are not marked as community signals', () => {
  const candidate = normalizeCandidate(raw());

  assert.equal(candidate.community_signal, false);
  assert.equal(candidate.community_signal_source, undefined);
});
