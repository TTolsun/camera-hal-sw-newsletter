'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  exclusionReasons,
  freshnessWindowMetadata,
  normalizeTitle,
  normalizeUrl,
  summarizeExclusionReasons
} = require('../../../generator/select/newsroom-selection');
const {
  extractRoundupChildTopics
} = require('../../collect/roundup-child-topic-extractor');
const {
  articlePolicy
} = require('../../common/newsletter-policy');
const {
  emptyHeadlineState,
  headlineSnapshotFromCandidate
} = require('../../../generator/reporter/homepage-headline');
const { candidate } = require('../helpers/newsroom-builders');
const {
  buildShortlistReport,
  policyPrimaryCandidate
} = require('../helpers/selection-builders');

test('normalizeTitle preserves Korean so titles differing only in Hangul stay distinct', () => {
  // NFKD decomposed Hangul out of the 가-힣 allow-list, collapsing distinct Korean titles
  // to identical Latin remnants. NFC must keep the Korean so dedup does not merge them.
  const left = normalizeTitle('Camera HAL 버퍼 관리 동작 변경');
  const right = normalizeTitle('Camera HAL 스트림 구성 동작 변경');
  assert.notEqual(left, right);
  assert.equal(normalizeTitle('카메라 드라이버 업데이트').length > 0, true);
});

test('Issue #238 scope expansion leaves publication count policy unchanged', () => {
  const { publishReadyCompositionPolicy } = require('../../common/newsletter-policy');
  assert.deepEqual(articlePolicy.mainArticleCount, { min: 1, max: 5 });
  assert.equal(articlePolicy.primaryCameraStack.minRequired, 0);
  assert.equal(publishReadyCompositionPolicy.supportingMainMaxAllowed, 1);
  assert.ok(articlePolicy.supportingMainBuckets.includes('android_supporting'));
  assert.equal(
    Object.prototype.hasOwnProperty.call(articlePolicy.primaryCameraStack, 'directCameraMinimum'),
    false
  );
});

test('prefilter excludes source gaps, undated watch pages, missing evidence, and duplicate URLs', () => {
  const report = buildShortlistReport('2026-05-10', [
    candidate({ title: 'Android Camera HAL release note', url: 'https://example.com/a' }),
    candidate({ title: 'Duplicate URL', url: 'https://example.com/a?utm=1' }),
    candidate({ title: 'Source gap', url: 'https://example.com/b', source_gap_risk: true }),
    candidate({ title: 'Watch page', url: 'https://example.com/c', isWatchPage: true, hasDatedEvidence: false, finalSelectionEligibility: 'watchlist' }),
    candidate({ title: 'Missing date', url: 'https://example.com/d', published_date: '', hasDatedEvidence: false })
  ], { minArticles: 1 });

  assert.equal(report.shortlisted_candidates.length, 1);
  assert.equal(report.shortlisted_candidates[0].title, 'Android Camera HAL release note');
  assert.deepEqual(
    report.excluded_candidates.map(item => item.exclusion_reasons[0]),
    ['duplicate URL or near-duplicate title', 'source_gap_risk=true', 'missing dated evidence', 'missing dated evidence']
  );
});

test('effective_date can satisfy selection only with publish-ready date quality', () => {
  const strongEffectiveDate = policyPrimaryCandidate(0, {
    title: 'AOSP Camera provider effective date update',
    url: 'https://example.com/effective-strong',
    published_date: '',
    effective_date: '2026-05-02',
    date_source: 'visible_last_updated',
    date_confidence: 85,
    hasDatedEvidence: true
  });
  const weakEffectiveDate = policyPrimaryCandidate(1, {
    title: 'AOSP Camera provider content hash only update',
    url: 'https://example.com/effective-weak',
    published_date: '',
    effective_date: '2026-05-02',
    date_source: 'content_hash_changed_without_date',
    date_confidence: 40,
    hasDatedEvidence: true
  });

  assert.deepEqual(exclusionReasons(strongEffectiveDate), []);
  assert.ok(exclusionReasons(weakEffectiveDate).includes('missing dated evidence'));

  const strongWindow = freshnessWindowMetadata(strongEffectiveDate, '2026-05-10');
  assert.equal(strongWindow.freshness_window, 'primary');
  assert.match(strongWindow.selection_window_reason, /based on effective_date/);
});

test('near-duplicate titles are prevented', () => {
  const report = buildShortlistReport('2026-05-10', [
    candidate({ title: 'CameraX 1.5 release improves compatibility', url: 'https://example.com/a' }),
    candidate({ title: 'CameraX 1.5 release improves Android compatibility', url: 'https://example.com/b' })
  ], { minArticles: 1 });

  assert.equal(report.shortlisted_candidates.length, 1);
  assert.equal(report.excluded_candidates[0].exclusion_reasons[0], 'duplicate URL or near-duplicate title');
});

test('two camera sections of one roundup stay separate candidates after the honest title change', () => {
  // titleSimilarity는 토큰 집합 겹침/max라, 제목 형식이 후보마다 같은 단어를 하나라도 더 붙이면
  // 유사도가 항상 올라간다. 그러면 한 묶음글의 서로 다른 섹션이 중복 판정 임계(같은 소스·같은 날짜
  // 0.68)를 넘겨 조용히 하나로 합쳐진다. 각 섹션이 바깥 링크를 들고 있으면 URL이 서로 달라 URL
  // 중복으로는 걸러지지 않으므로(라이브 goo.gle 링크가 이 경우다) 제목 유사도가 유일한 판정 기준이다.
  // fixture는 그 밴드 안(부모 8토큰, heading 3·4토큰)으로 골랐다 — 상용구 단어를 하나만 붙여도
  // 0.6667에서 0.6923으로 올라 이 테스트가 실패한다.
  const html = [
    '<h2>Advanced Professional Video</h2>',
    '<p>Android introduces a new media framework format for professional capture. <a href="https://goo.gle/APV_IO26">Learn more</a></p>',
    '<p>Developers can review the format in Android creator workflows and camera output tests.</p>',
    '<h2>Ultra HDR image capture</h2>',
    '<p>CameraX adds Ultra HDR image capture support for preview and capture streams. <a href="https://goo.gle/UltraHDR_IO26">Learn more</a></p>',
    '<p>Developers can enable the capture path in Android camera output tests.</p>'
  ].join('');
  const children = extractRoundupChildTopics({
    source: { id: 'android-developers-blog', name: 'Android Developers Blog' },
    parentTitle: 'Google I/O 2026 recap for Android developers',
    parentUrl: 'https://android-developers.googleblog.com/2026/05/io-2026-recap.html',
    publishedAt: 'Wed, 20 May 2026 10:00:00 GMT',
    html,
    rawText: html
  });
  assert.equal(children.length, 2);

  const report = buildShortlistReport('2026-05-28', children.map(child => candidate({
    title: child.title,
    url: child.url,
    source: 'Android Developers Blog',
    published_date: '2026-05-20T00:00:00Z'
  })), { minArticles: 1 });

  assert.equal(report.shortlisted_candidates.length, 2);
});

test('URL normalization removes tracking query and hash', () => {
  assert.equal(
    normalizeUrl('https://Example.com/path/?utm_source=x#section'),
    'https://example.com/path'
  );
});

test('exclusion reason reports reference-only candidates', () => {
  assert.ok(exclusionReasons(candidate({ reference_only: true })).includes('reference_only=true'));
});

test('derived editorial do_not_claim text does not increase Camera HAL directness score', () => {
  const { scoreCandidate } = require('../../../generator/select/newsroom-selection');
  const baseCandidate = candidate({
    title: 'CameraX Release Notes - CameraX 1.6.1',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    summary: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.',
    published_date: '2026-05-06',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.',
    relevance_bucket: 'android',
    editorial_priority: 3,
    aosp_camera_directness: 2,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    camera_hal_relevance_score: 0,
    counts_as_primary_camera_topic: true,
    hasDatedEvidence: true,
    finalSelectionEligibility: 'main'
  });

  const base = scoreCandidate(baseCandidate, '2026-05-12');
  const withHints = scoreCandidate({
    ...baseCandidate,
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      hal_boundary: 'framework_adjacent_not_direct_hal_contract',
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  }, '2026-05-12');

  assert.equal(withHints.camera_hal_directness, base.camera_hal_directness);
  assert.equal(withHints.scope_relevance, base.scope_relevance);
  assert.equal(withHints.relevance_bucket, base.relevance_bucket);
});

test('derived editorial relevance bucket hint does not classify a generic candidate', () => {
  const { scoreCandidate } = require('../../../generator/select/newsroom-selection');
  const baseCandidate = candidate({
    title: 'Generic platform release notes',
    url: 'https://example.com/platform-release-notes',
    summary: 'The release updates documentation, dashboards, and sorting behavior.',
    published_date: '2026-05-06',
    api_or_component: '',
    behavior_change: 'Documentation and dashboard sorting were updated.',
    camera_hal_relevance_score: 0,
    hasDatedEvidence: true,
    finalSelectionEligibility: 'main'
  });

  const base = scoreCandidate(baseCandidate, '2026-05-12');
  const withHints = scoreCandidate({
    ...baseCandidate,
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  }, '2026-05-12');

  assert.equal(base.relevance_bucket, 'generic_tech_watchlist');
  assert.equal(withHints.relevance_bucket, base.relevance_bucket);
  assert.equal(withHints.scope_relevance, base.scope_relevance);
});

function cameraXSourceExtraction(version, bullet, overrides = {}) {
  return {
    adapter_id: 'android-developers-jetpack-release',
    source_type: 'release_note',
    source: {
      name: 'CameraX Release Notes',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera'
    },
    release: {
      version: `CameraX ${version}`,
      date: '2026-05-06',
      component: 'CameraX / androidx.camera',
      sections: [{
        category: 'bug_fixes',
        heading: 'Bug Fixes',
        items: [{
          text: bullet,
          source_text: bullet,
          links: [],
          issue_ids: [],
          artifact_names: ['androidx.camera:camera-core']
        }]
      }]
    },
    minor_line_context: null,
    extraction_quality: {
      has_concrete_behavior_change: true,
      used_fallback: false,
      raw_table_used_as_body: false,
      main_article_allowed: true,
      warnings: [],
      ...overrides.extraction_quality
    }
  };
}

function cameraXReleaseCandidate(version, overrides = {}) {
  const bullet = overrides.behavior_change || `Fixed CameraX ${version} compatibility behavior.`;
  const extraction = overrides.source_extraction || cameraXSourceExtraction(version, bullet);
  return candidate({
    title: `CameraX Release Notes - CameraX ${version}`,
    url: `https://developer.android.com/jetpack/androidx/releases/camera#${version}`,
    published_date: '2026-05-06',
    version_or_release: `CameraX ${version}`,
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: bullet,
    summary: bullet,
    relevance_bucket: 'android',
    editorial_priority: 3,
    aosp_camera_directness: 2,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: true,
    source_extraction: extraction,
    extraction_quality: extraction.extraction_quality,
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      hal_boundary: 'framework_adjacent_not_direct_hal_contract',
      validation_targets: ['Camera2 interop regression validation'],
      device_specific_notes: [],
      do_not_claim: ['Do not claim direct Camera HAL API changes.'],
      main_article_allowed_hint: true,
      warnings: []
    },
    ...overrides
  });
}

test('CameraX release-note body candidate supersedes latest-updates discovery row for same version URL', () => {
  const versionUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const discoveryRow = candidate({
    title: 'CameraX 1.6.1 - Camera Maven Group versions',
    url: versionUrl,
    source: 'Android Developers Latest Updates',
    published_date: '2026-05-06',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'Fixed Camera2 interop behavior for CameraX apps.',
    summary: 'Fixed Camera2 interop behavior for CameraX apps.',
    relevance_bucket: 'android',
    editorial_priority: 3,
    aosp_camera_directness: 2,
    counts_as_primary_camera_topic: true
  });
  const releaseBody = cameraXReleaseCandidate('1.6.1', {
    title: 'CameraX Release Notes - CameraX 1.6.1',
    behavior_change: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.'
  });

  const report = buildShortlistReport('2026-05-12', [discoveryRow, releaseBody], {
    minArticles: 1,
    maxArticles: 1
  });

  assert.equal(report.selected_articles.length, 1);
  assert.equal(report.selected_articles[0].title, 'CameraX Release Notes - CameraX 1.6.1');
  assert.ok(report.excluded_candidates.some(item =>
    item.title === discoveryRow.title &&
    item.exclusion_reasons.includes('duplicate CameraX release-note body candidate supersedes discovery row')
  ));
});

test('homepage headline is never injected into the issue selection', () => {
  // 과거 이슈의 더 최신 소스 헤드라인을 유지하더라도 이슈 기사 목록에 주입하지 않는다.
  const retained = headlineSnapshotFromCandidate(policyPrimaryCandidate(90, {
    title: 'Retained Camera HAL metadata headline',
    url: 'https://source.android.com/docs/camera/retained-headline',
    source: 'source.android.com',
    published_date: '2026-06-05',
    hasDatedEvidence: true
  }), {
    date: '2026-06-05',
    scoredAt: '2026-06-05'
  });
  const report = buildShortlistReport('2026-05-21', [
    policyPrimaryCandidate(1, {
      url: 'https://source.android.com/docs/camera/current-candidate',
      source: 'source.android.com',
      published_date: '2026-05-15'
    })
  ], {
    homepageHeadlineState: {
      ...emptyHeadlineState({ date: '2026-06-05' }),
      current_headline: retained
    }
  });

  assert.equal(report.headline_latest_inclusion.injected_from_snapshot, false);
  assert.ok(report.selected_articles.every(article => article.injected_from_headline_snapshot !== true));
  assert.equal(report.removed_due_to_headline_inclusion.length, 0);
});

test('homepage headline does not add or drop issue articles', () => {
  const candidates = Array.from({ length: 7 }, (_, index) => policyPrimaryCandidate(index, {
    url: `https://source.android.com/docs/camera/current-${index}`,
    source: 'source.android.com',
    published_date: `2026-05-${10 + index}`
  }));
  const report = buildShortlistReport('2026-05-21', candidates, {
    homepageHeadlineState: emptyHeadlineState({ date: '2026-05-20' })
  });

  // 헤드라인은 이슈에 주입/제거되지 않으므로 inclusion 흔적이 전혀 없다.
  assert.equal(report.selected_articles.length <= articlePolicy.mainArticleCount.max, true);
  assert.equal(report.removed_due_to_headline_inclusion.length, 0);
  assert.ok(report.selected_articles.every(article => article.injected_from_headline_snapshot !== true));
});

test('generic CameraX metadata fallback cannot become a main candidate without source_extraction bullet', () => {
  const generic = candidate({
    title: 'CameraX 1.6.1 - Camera Maven Group versions',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    source: 'Android Developers Latest Updates',
    published_date: '2026-05-06',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'CameraX / androidx.camera update.',
    summary: 'CameraX / androidx.camera update.',
    relevance_bucket: 'android',
    editorial_priority: 3,
    aosp_camera_directness: 2,
    counts_as_primary_camera_topic: true
  });

  assert.ok(exclusionReasons(generic).includes('CameraX release-note candidate has no concrete source_extraction bullet'));
  const report = buildShortlistReport('2026-05-12', [generic], {
    minArticles: 1,
    maxArticles: 1
  });
  assert.equal(report.selected_articles.length, 0);
});

test('CameraX source extraction violation depends on concrete release-note bullets', () => {
  const concrete = cameraXReleaseCandidate('1.6.1', {
    behavior_change: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.'
  });
  const missingExtraction = cameraXReleaseCandidate('1.6.1', {
    title: 'CameraX 1.6.1 - Camera Maven Group versions',
    behavior_change: 'CameraX / androidx.camera update.',
    summary: 'CameraX / androidx.camera update.',
    source_extraction: null,
    extraction_quality: null,
    derived_editorial_hints: null
  });
  const emptyExtraction = cameraXReleaseCandidate('1.6.1', {
    title: 'CameraX Release Notes - CameraX 1.6.1 empty extraction',
    behavior_change: 'CameraX / androidx.camera update.',
    summary: 'CameraX / androidx.camera update.',
    source_extraction: cameraXSourceExtraction('1.6.1', 'CameraX / androidx.camera update.')
  });
  emptyExtraction.source_extraction.release.sections = [];
  emptyExtraction.source_extraction.extraction_quality.has_concrete_behavior_change = false;

  assert.equal(
    exclusionReasons(concrete).includes('CameraX release-note candidate has no concrete source_extraction bullet'),
    false
  );
  assert.ok(exclusionReasons(missingExtraction).includes('CameraX release-note candidate has no concrete source_extraction bullet'));
  assert.ok(exclusionReasons(emptyExtraction).includes('CameraX release-note candidate has no concrete source_extraction bullet'));

  const report = buildShortlistReport('2026-05-12', [missingExtraction, emptyExtraction, concrete], {
    minArticles: 1,
    maxArticles: 1
  });
  assert.equal(report.selected_articles.length, 1);
  assert.equal(report.selected_articles[0].title, concrete.title);
  assert.ok(report.excluded_candidates.some(item =>
    item.title === missingExtraction.title &&
    item.exclusion_reasons.includes('CameraX release-note candidate has no concrete source_extraction bullet')
  ));
});

test('AndroidX Camera release page keeps one main article and prefers latest stable patch', () => {
  const patch = cameraXReleaseCandidate('1.6.1', {
    behavior_change: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.'
  });
  const minor = cameraXReleaseCandidate('1.6.0', {
    published_date: '2026-03-25',
    behavior_change: 'Added CameraPipe SessionConfig support for dynamic range handling.'
  });
  const beta = cameraXReleaseCandidate('1.7.0-alpha01', {
    behavior_change: 'Updated CameraX alpha API behavior for testing.'
  });

  const report = buildShortlistReport('2026-05-12', [minor, beta, patch], {
    minArticles: 1,
    maxArticles: 3
  });
  const selectedCameraReleases = report.selected_articles.filter(item =>
    item.url.startsWith('https://developer.android.com/jetpack/androidx/releases/camera')
  );

  assert.equal(selectedCameraReleases.length, 1);
  assert.equal(selectedCameraReleases[0].version_or_release, 'CameraX 1.6.1');
});

test('exclusion reason summary sorts by count descending then reason name', () => {
  const summary = summarizeExclusionReasons([
    { exclusion_reasons: ['z reason', 'a reason'] },
    { exclusion_reasons: ['a reason'] },
    { exclusion_reasons: ['m reason'] }
  ]);

  assert.deepEqual(summary, [
    { reason: 'a reason', count: 2 },
    { reason: 'm reason', count: 1 },
    { reason: 'z reason', count: 1 }
  ]);
});

test('undated watch and reference candidates remain excluded from final selection', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B updates stream compatibility', url: 'https://example.com/b' }),
    candidate({ title: 'On-device AI camera path update C', url: 'https://example.com/c', summary: 'AI inference update affects Android camera frame processing.' }),
    candidate({ title: 'Android Camera API change D fixes metadata behavior', url: 'https://example.com/d' }),
    candidate({
      title: 'Undated rolling Camera documentation',
      url: 'https://example.com/watch',
      published_date: '',
      isWatchPage: true,
      hasDatedEvidence: false,
      finalSelectionEligibility: 'watchlist'
    }),
    candidate({
      title: 'Reference-only Camera background',
      url: 'https://example.com/reference',
      reference_only: true
    })
  ]);

  const selectedUrls = new Set(report.selected_articles.map(item => item.url));
  assert.equal(selectedUrls.has('https://example.com/watch'), false);
  assert.equal(selectedUrls.has('https://example.com/reference'), false);
  assert.ok(report.excluded_candidates.some(item => item.title === 'Undated rolling Camera documentation'));
  assert.ok(report.excluded_candidates.some(item => item.title === 'Reference-only Camera background'));
});

// #1033: Gerrit 변경 후보와 AOSP 릴리스 드롭 후보는 제목도 URL도 절대 겹치지 않는다 — 드롭 후보는
// 저장소당 집계 1건이기 때문이다. 같은 변경인지 아는 유일한 길이 Change-Id/commit SHA이고, 그 길이
// 막히면 같은 변경이 제안 기사와 landed 기사로 두 번 나간다.
function gerritChangeCandidate(overrides = {}) {
  return candidate({
    title: 'VirtualCamera: prevent integer underflow in outBufferSize - platform/frameworks/av',
    url: 'https://android-review.googlesource.com/c/platform/frameworks/av/+/4228184',
    source: 'AOSP Gerrit (camera changes under review)',
    published_date: '2026-05-04',
    summary: 'Gerrit change 4228184 on platform/frameworks/av is merged (submitted 2026-05-04).',
    api_or_component: 'platform/frameworks/av/services/camera/virtualcamera/VirtualCameraImagePassthroughHandler.cc',
    behavior_change: 'Merged change updates 1 camera source file(s) in platform/frameworks/av +10/-0.',
    relevance_bucket: 'direct_aosp_camera',
    editorial_priority: 1,
    aosp_camera_directness: 5,
    counts_as_primary_camera_topic: true,
    gerrit_change_id: 'I41b74d543e8b8a7ad46a261d49ee311543e1ed8d',
    gerrit_commit_sha: 'b'.repeat(40),
    ...overrides
  });
}

function releaseDropCandidate(overrides = {}) {
  return candidate({
    title: 'AOSP android-17.0.0_r1 source release - camera path changes in platform/frameworks/av',
    url: 'https://android.googlesource.com/platform/frameworks/av/+log/android-16.0.0_r4..android-17.0.0_r1',
    source: 'AOSP Release Source Drop (camera changes)',
    published_date: '2026-05-05',
    summary: 'AOSP source release android-17.0.0_r1 carries 51 commit(s) touching camera paths in platform/frameworks/av.',
    api_or_component: 'AOSP platform/frameworks/av / camera',
    behavior_change: 'The release drop changes camera paths in platform/frameworks/av.',
    relevance_bucket: 'direct_aosp_camera',
    editorial_priority: 1,
    aosp_camera_directness: 5,
    counts_as_primary_camera_topic: true,
    covered_gerrit_change_ids: ['I41b74d543e8b8a7ad46a261d49ee311543e1ed8d'],
    covered_commit_shas: ['c'.repeat(40)],
    ...overrides
  });
}

test('a release drop that carries the same Change-Id supersedes the Gerrit change candidate', () => {
  const report = buildShortlistReport('2026-05-12', [gerritChangeCandidate(), releaseDropCandidate()], {
    minArticles: 1,
    maxArticles: 2
  });

  const selectedUrls = report.selected_articles.map(item => item.url);
  assert.equal(selectedUrls.length, 1, 'landed 집계와 제안 후보가 두 기사로 나가면 안 된다');
  assert.ok(selectedUrls[0].includes('android.googlesource.com'), '남는 쪽은 나머지 커밋까지 담은 릴리스 드롭이다');
  assert.ok(report.excluded_candidates.some(item =>
    item.url.includes('android-review.googlesource.com') &&
    item.exclusion_reasons.includes('landed AOSP release drop covers the same Change-Id as the Gerrit change candidate')
  ));
});

test('the same match works on commit SHA and survives the reverse arrival order', () => {
  const gerrit = gerritChangeCandidate({ gerrit_change_id: '', gerrit_commit_sha: 'c'.repeat(40) });
  const report = buildShortlistReport('2026-05-12', [releaseDropCandidate(), gerrit], {
    minArticles: 1,
    maxArticles: 2
  });
  assert.equal(report.selected_articles.length, 1);
  assert.ok(report.selected_articles[0].url.includes('android.googlesource.com'));
});

test('an unrelated Gerrit change is not folded into the release drop', () => {
  const unrelated = gerritChangeCandidate({
    gerrit_change_id: 'I0000000000000000000000000000000000000000',
    gerrit_commit_sha: 'd'.repeat(40)
  });
  const report = buildShortlistReport('2026-05-12', [unrelated, releaseDropCandidate()], {
    minArticles: 1,
    maxArticles: 2
  });
  assert.equal(report.selected_articles.length, 2);
});
