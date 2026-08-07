'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildShortlistReport } = require('../../../select/newsroom-selection');
const {
  renderCandidateSelectionDiagnostics,
  selectionDiagnosticsFromReports
} = require('../../../select/selection-diagnostics');
const { buildSelectionReport } = require('../../../publish/orchestrator-report-builders');

// release-class 레인(#825): release 채널(collectionModeHint: release-note-watch) 후보는
// 주간 발행 주기와 신선도 창 사이에 끼면 thin week가 올 때까지 영원히 기회가 없다.
// 실측(libcamera v0.7.2, 2026-07-10 발행): W29는 소스 미등록, W30/W31은 primary 창 밖
// fallback 창인데 fallback은 primary가 min을 못 채울 때만 참조돼 3주 연속 어느 선정
// 산출물에도 등장하지 못했다. 이 레인은 신규 선정이 target을 채운 주에도 max 아래 여유
// 슬롯을 릴리스에 내주되, 같은 품질 하한·중복 가드·게재 이력 검사를 그대로 통과시킨다.

const EMPTY_HEADLINE_STATE = {
  schemaVersion: 1,
  updated_at: '2026-07-27T00:00:00+09:00',
  current_headline: null,
  headline_history: [],
  policy: {}
};

const CATCH_UP_POLICY = {
  enabled: true, maxCatchUpArticles: 2, maxReleaseClassArticles: 1, maxAgeDays: 35,
  targetMainArticles: 3, eligibleBuckets: ['direct_aosp_camera'], activationMode: 'fill_open_slots'
};

// main_article_score_eligible을 통과하는 강한 후보 골격(기존 catch-up 테스트와 동일한 형태).
function strongCandidate(overrides = {}) {
  return {
    relevance_bucket: 'direct_aosp_camera',
    aosp_camera_directness: 4,
    counts_as_primary_camera_topic: true,
    has_dated_evidence: true,
    finalSelectionEligibility: 'main',
    api_or_component: 'CameraX',
    ...overrides
  };
}

// 2026-07-27 기준 primary 창(7일) 안의 강한 신규 3건 — target(3)을 채우는 강한 주.
function freshWeek() {
  return [
    strongCandidate({
      title: 'Fresh camera A', url: 'https://developer.android.com/jetpack/androidx/releases/camera#fresh-a',
      published_date: '2026-07-24', version_or_release: 'a1', behavior_change: 'API change A'
    }),
    strongCandidate({
      title: 'Fresh camera B', url: 'https://source.android.com/docs/core/camera/fresh-b',
      published_date: '2026-07-25', version_or_release: 'b1', behavior_change: 'API change B'
    }),
    strongCandidate({
      title: 'Fresh camera C', url: 'https://developer.android.com/media/camera/camera2/fresh-c',
      published_date: '2026-07-26', version_or_release: 'c1', behavior_change: 'API change C'
    })
  ];
}

// 실측 v0.7.2 모양: 2026-07-27 기준 17일령 → fallback 창(8~21일), release 채널 소스.
function releaseCandidate(overrides = {}) {
  return strongCandidate({
    title: 'v0.7.2', url: 'https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2',
    published_date: '2026-07-10', version_or_release: 'v0.7.2',
    api_or_component: 'libcamera', behavior_change: 'libcamera 0.7.2 release',
    source_collection_mode: 'release-note-watch',
    ...overrides
  });
}

function report(candidates, options = {}) {
  return buildShortlistReport('2026-07-27', { candidates }, {
    exposureHistory: { articles: [] },
    homepageHeadlineState: EMPTY_HEADLINE_STATE,
    catchUpPolicy: CATCH_UP_POLICY,
    ...options
  });
}

test('a fallback-window release fills a slot under max even when the week already hit target', () => {
  const result = report([...freshWeek(), releaseCandidate()]);
  assert.equal(result.selected_articles.length, 4, '강한 주(3 main)에도 릴리스가 4번째 슬롯을 받아야 한다');
  const release = result.selected_articles.find(a => a.coverage_type === 'catch_up');
  assert.ok(release, '릴리스는 catch_up 커버리지로 승격돼야 한다');
  assert.equal(release.title, 'v0.7.2');
  assert.equal(release.catch_up_lane, 'release_class');
  assert.equal(release.catch_up_origin_window, 'fallback');
  assert.equal(release.catch_up_age_days, 17);
});

test('a promoted release is evicted from reserve_candidates (no selected/reserve duplication)', () => {
  // reserve는 catch-up 전에 계산되고 fallback 좌석이 release-class 레인과 같은 창을 본다.
  // 승급된 릴리스가 reserve에 남으면 리뷰 산출물(reserve_capsules)이 자기모순이 된다.
  const result = report([...freshWeek(), releaseCandidate()]);
  const inReserve = (result.reserve_candidates || [])
    .filter(candidate => candidate.url === 'https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2');
  assert.equal(inReserve.length, 0, '승급된 릴리스는 reserve_candidates에서 빠져야 한다');
});

test('catch_up_articles report entries carry the admitting lane', () => {
  const result = report([...freshWeek(), releaseCandidate()]);
  assert.equal(result.catch_up_articles.length, 1);
  assert.equal(result.catch_up_articles[0].catch_up_lane, 'release_class');
});

test('a non-release fallback-window candidate is NOT admitted on a strong week', () => {
  // release 채널 표식이 없으면 fallback 창 후보는 기존대로 강한 주에 승격되지 않는다.
  const notRelease = releaseCandidate({ source_collection_mode: undefined });
  const result = report([...freshWeek(), notRelease]);
  assert.equal(result.selected_articles.length, 3);
  assert.equal(result.catch_up_used_count, 0);
});

test('the release-class lane is capped at maxReleaseClassArticles per issue', () => {
  const second = releaseCandidate({
    title: 'v0.7.2+rpt20260715', url: 'https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2-rpt1',
    published_date: '2026-07-15', version_or_release: 'v0.7.2+rpt20260715'
  });
  const result = report([...freshWeek(), releaseCandidate(), second]);
  const releases = result.selected_articles.filter(a => a.catch_up_lane === 'release_class');
  assert.equal(releases.length, 1, '호당 release-class 승격은 정책 상한(1)을 넘지 않는다');
  assert.equal(result.selected_articles.length, 4);
});

test('the lane is off when maxReleaseClassArticles is absent (backwards compatible)', () => {
  const { maxReleaseClassArticles, ...withoutKey } = CATCH_UP_POLICY;
  const result = report([...freshWeek(), releaseCandidate()], { catchUpPolicy: withoutKey });
  assert.equal(result.selected_articles.length, 3);
  assert.equal(result.catch_up_used_count, 0);
});

test('a reference-window release is also admitted on a strong week', () => {
  const referenceRelease = releaseCandidate({ published_date: '2026-06-30' }); // 27일령 → reference 창
  const result = report([...freshWeek(), referenceRelease]);
  const release = result.selected_articles.find(a => a.catch_up_lane === 'release_class');
  assert.ok(release);
  assert.equal(release.catch_up_origin_window, 'reference');
});

test('a release older than maxAgeDays is not admitted', () => {
  const expired = releaseCandidate({ published_date: '2026-06-10' }); // 47일령 > maxAgeDays 35
  const result = report([...freshWeek(), expired]);
  assert.equal(result.catch_up_used_count, 0);
});

test('an already-covered release is not re-selected', () => {
  const history = { articles: [
    {
      article_identity_key: 'url:https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2',
      exposure_type: 'newsletter_article',
      newsletter_date: '2026-07-20'
    }
  ] };
  const result = report([...freshWeek(), releaseCandidate()], { exposureHistory: history });
  assert.equal(result.catch_up_used_count, 0);
});

// #838: 레인이 아무것도 승급하지 않은 주에는 산출물에 흔적이 전혀 남지 않아
// "자격 있는 후보가 없었다"와 "자리가 없었다"를 사후에 구분할 수 없었다(실측 W32).
// 아래 테스트들은 레인 진단이 항상 기록되고, 커밋되는 selection-report.json까지
// 도달하는지를 고정한다.

// 2026-07-27 기준 primary 창 안의 강한 신규 5건 — mainArticleCount.max를 채우는 주.
function maxedWeek() {
  return [
    ...freshWeek(),
    strongCandidate({
      title: 'Fresh camera D', url: 'https://git.kernel.org/linux/c/fresh-d',
      published_date: '2026-07-23', version_or_release: 'd1', behavior_change: 'API change D'
    }),
    strongCandidate({
      title: 'Fresh camera E', url: 'https://source.android.com/docs/core/camera/fresh-e',
      published_date: '2026-07-22', version_or_release: 'e1', behavior_change: 'API change E'
    })
  ];
}

test('the lane records pool size, admissions, and no blocked reason when it admits', () => {
  const result = report([...freshWeek(), releaseCandidate()]);
  assert.deepEqual(result.release_class_catch_up, {
    pool_size: 1,
    admitted: 1,
    blocked_reason: ''
  });
});

test('a full lineup is recorded as lineup_at_max, not as a missing candidate', () => {
  // 실측 W32: deterministic_selected_count 5 == mainArticleCount.max 5.
  // 자격을 갖춘 릴리스가 pool에 있었는데도 루프가 첫 반복에서 빠져나갔다.
  const result = report([...maxedWeek(), releaseCandidate()]);
  assert.equal(result.selected_articles.length, 5);
  assert.equal(result.catch_up_used_count, 0);
  assert.deepEqual(result.release_class_catch_up, {
    pool_size: 1,
    admitted: 0,
    blocked_reason: 'lineup_at_max'
  });
});

test('an empty release pool is recorded as no_eligible_candidate', () => {
  const result = report(freshWeek());
  assert.deepEqual(result.release_class_catch_up, {
    pool_size: 0,
    admitted: 0,
    blocked_reason: 'no_eligible_candidate'
  });
});

test('a release sharing a selected release page is recorded as duplicate_release_page', () => {
  // freshWeek()[0]은 CameraX 릴리스 노트 페이지다. 같은 페이지의 다른 버전은
  // release-note dedup(#500)에 걸려 승급되지 않는다 — 자리가 없어서가 아니다.
  const sameReleasePage = releaseCandidate({
    title: 'CameraX 1.5.0', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.5.0',
    version_or_release: '1.5.0', api_or_component: 'CameraX'
  });
  const result = report([...freshWeek(), sameReleasePage]);
  assert.equal(result.catch_up_used_count, 0);
  assert.deepEqual(result.release_class_catch_up, {
    pool_size: 1,
    admitted: 0,
    blocked_reason: 'duplicate_release_page'
  });
});

test('a disabled lane is recorded as lane_disabled instead of looking candidate-starved', () => {
  const { maxReleaseClassArticles, ...withoutKey } = CATCH_UP_POLICY;
  const result = report([...freshWeek(), releaseCandidate()], { catchUpPolicy: withoutKey });
  assert.equal(result.release_class_catch_up.admitted, 0);
  assert.equal(result.release_class_catch_up.blocked_reason, 'lane_disabled');
});

test('the lane diagnostics reach the committed selection-report.json', () => {
  // shortlisted-candidates.json은 .gitignore 대상이라 커밋되지 않는다. 진단이
  // buildSelectionReport 투영을 통과하지 못하면 다음 run에서도 판정할 수 없다.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const diagnostics = selectionDiagnosticsFromReports(shortlist, null);
  const selectionReport = buildSelectionReport('2026-07-27', shortlist, diagnostics);
  assert.deepEqual(selectionReport.release_class_catch_up, {
    pool_size: 1,
    admitted: 0,
    blocked_reason: 'lineup_at_max'
  });
});

test('the lane diagnostics are rendered into selection-diagnostics.md', () => {
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const markdown = renderCandidateSelectionDiagnostics(selectionDiagnosticsFromReports(shortlist, null));
  assert.match(markdown, /- release_class_pool_size: 1/);
  assert.match(markdown, /- release_class_admitted: 0/);
  assert.match(markdown, /- release_class_blocked_reason: lineup_at_max/);
});

test('thin-week general lane and release lane compose without double-counting', () => {
  // 신규 1건(target 3 미달) + reference 창 일반 후보 1건 + fallback 창 릴리스 1건:
  // 일반 레인은 reference 후보를, release-class 레인은 릴리스를 승격한다.
  const generalReference = strongCandidate({
    title: 'Camera HAL AIDL v3 interface update', url: 'https://source.android.com/docs/core/camera/aidl-v3',
    published_date: '2026-06-30', version_or_release: 'AIDL v3', behavior_change: 'interface change'
  });
  const result = report([freshWeek()[0], generalReference, releaseCandidate()]);
  const lanes = result.selected_articles
    .filter(a => a.coverage_type === 'catch_up')
    .map(a => a.catch_up_lane)
    .sort();
  assert.deepEqual(lanes, ['fill_open_slots', 'release_class']);
  assert.equal(result.selected_articles.length, 3);
});
