const assert = require('node:assert/strict');
const test = require('node:test');

const {
  candidateRankOrder,
  capPerSource,
  collapseSeriesRepresentatives,
  withinLookback,
  MAX_CANDIDATES_PER_SOURCE,
  MAX_FINAL_CANDIDATES
} = require('../../../cli/collect-news-candidates');

function item(sourceId, title) {
  return { source_id: sourceId, source: sourceId, title };
}

function seriesItem(sourceId, title, seriesId) {
  return { source_id: sourceId, source: sourceId, title, seriesId };
}

test('capPerSource limits each source to the cap while preserving order', () => {
  const ranked = [
    ...Array.from({ length: 12 }, (_, i) => item('android-developers-blog', `android-${i}`)),
    item('lore-linux-media-list', 'lore-0'),
    item('lore-linux-media-list', 'lore-1')
  ];
  const capped = capPerSource(ranked, 8);
  const androidCount = capped.filter(c => c.source_id === 'android-developers-blog').length;
  const loreCount = capped.filter(c => c.source_id === 'lore-linux-media-list').length;
  assert.equal(androidCount, 8, 'high-volume source is capped at the per-source limit');
  assert.equal(loreCount, 2, 'lower-ranked driver source still survives the cap');
  assert.equal(capped[0].title, 'android-0', 'sort order is preserved within the cap');
});

test('a single roundup source cannot evict other sources before the final slice', () => {
  // Mirrors the CI failure: one source explodes into many child topics and would
  // otherwise fill the entire pool, starving camera-driver leads.
  const ranked = [
    ...Array.from({ length: 28 }, (_, i) => item('android-developers-blog', `android-${i}`)),
    ...Array.from({ length: 22 }, (_, i) => item('lore-linux-media-list', `lore-${i}`))
  ];
  const capped = capPerSource(ranked, MAX_CANDIDATES_PER_SOURCE).slice(0, MAX_FINAL_CANDIDATES);
  assert.ok(
    capped.some(c => c.source_id === 'lore-linux-media-list'),
    'driver content reaches the final pool instead of being crowded out'
  );
  assert.ok(
    capped.filter(c => c.source_id === 'android-developers-blog').length <= MAX_CANDIDATES_PER_SOURCE,
    'roundup source respects the per-source cap'
  );
});

test('capPerSource with a non-positive cap returns all candidates unchanged', () => {
  const ranked = [item('a', 'a-0'), item('a', 'a-1')];
  assert.deepEqual(capPerSource(ranked, 0).map(c => c.title), ['a-0', 'a-1']);
});

test('collapseSeriesRepresentatives keeps one top-ranked candidate per (source, seriesId)', () => {
  // A large patch series must not consume the per-source cap with its fragments;
  // it should compete as a single representative. Input is already rank-sorted, so
  // the first fragment of each series is its top-ranked representative.
  const ranked = [
    ...Array.from({ length: 35 }, (_, i) => seriesItem('patchwork-libcamera-patches', `libipa-${i}`, 6048)),
    ...Array.from({ length: 6 }, (_, i) => seriesItem('patchwork-libcamera-patches', `lsc-${i}`, 6049)),
    seriesItem('patchwork-libcamera-patches', 'dw100', 6050),
    item('patchwork-libcamera-patches', 'git-url-churn')
  ];
  const collapsed = collapseSeriesRepresentatives(ranked);
  const patchworkTitles = collapsed
    .filter(c => c.source_id === 'patchwork-libcamera-patches')
    .map(c => c.title);
  assert.deepEqual(patchworkTitles, ['libipa-0', 'lsc-0', 'dw100', 'git-url-churn'],
    'each series collapses to its first (top-ranked) fragment; non-series candidate passes through');
  // The whole in-window series survives the per-source cap as one representative.
  const capped = capPerSource(collapsed, MAX_CANDIDATES_PER_SOURCE);
  assert.ok(capped.some(c => c.title === 'libipa-0'),
    'a 35-patch series is no longer starved out of the per-source cap by its own fragments');
});

test('collapseSeriesRepresentatives leaves candidates without a seriesId untouched', () => {
  const ranked = [item('a', 'a-0'), item('a', 'a-1'), item('b', 'b-0')];
  assert.deepEqual(collapseSeriesRepresentatives(ranked).map(c => c.title), ['a-0', 'a-1', 'b-0']);
});

// 2026-08-03(W32) 회귀: 랭킹에 최신성 항이 없어 35일 lookback 풀에서 지난 주 후보가 소스당 캡을
// 차지했다. lore 8칸 중 3칸이 07-24~07-26 항목으로 가면서 창 안 R-Car ISP 시리즈 등이 통째로 잘렸다.
function datedItem(sourceId, title, publishedAt, relevanceScore = 50) {
  return {
    source_id: sourceId,
    source: sourceId,
    title,
    publishedAt,
    relevanceScore,
    source_priority: 'high',
    source_reliability: 'project-official'
  };
}

test('primary-window candidates win the per-source cap over older ones', () => {
  const now = new Date('2026-08-03T23:59:59.999Z');
  const ranked = [
    ...Array.from({ length: 8 }, (_, i) =>
      datedItem('lore-linux-media-list', `stale-${i}`, '2026-07-24T00:00:00Z', 90)),
    datedItem('lore-linux-media-list', 'in-window-rcar-isp', '2026-07-30T00:00:00Z', 40)
  ].sort(candidateRankOrder(now));
  const capped = capPerSource(ranked, MAX_CANDIDATES_PER_SOURCE);

  assert.equal(capped[0].title, 'in-window-rcar-isp',
    'in-window candidate outranks higher-scoring candidates from before the selection window');
  assert.ok(capped.some(c => c.title === 'in-window-rcar-isp'),
    'the cap no longer drops this week signals in favour of last week leftovers');
});

test('primary-window preference never overrides source priority or reliability', () => {
  const now = new Date('2026-08-03T23:59:59.999Z');
  const fresh = datedItem('low-priority-blog', 'fresh-but-low-priority', '2026-08-02T00:00:00Z');
  fresh.source_priority = 'low';
  fresh.source_reliability = 'community';
  const stale = datedItem('lore-linux-media-list', 'stale-but-official', '2026-07-20T00:00:00Z');

  assert.deepEqual([fresh, stale].sort(candidateRankOrder(now)).map(c => c.title),
    ['stale-but-official', 'fresh-but-low-priority']);
});

// 2026-08-17(W34) 회귀: primary-window 가점이 withinLookback을 그대로 썼는데, 그 함수는 날짜를
// 못 읽으면 true를 돌려준다. 그건 수집 풀 필터에서 "날짜 없다고 버리지 않는다"는 뜻이지 "이번
// 주 신호다"라는 뜻이 아니다. 그 결과 문서형 소스의 nodate 페이지-제목 후보가 창 안 후보와 같은
// 등급을 받아, priority/reliability가 같은 dated 카메라 신호를 랭킹에서 밀어냈다.
function undatedItem(sourceId, title, relevanceScore = 50, publishedAt = '') {
  return {
    source_id: sourceId,
    source: sourceId,
    title,
    publishedAt,
    relevanceScore,
    source_priority: 'medium',
    source_reliability: 'official'
  };
}

function sameTierDatedItem(sourceId, title, publishedAt, relevanceScore) {
  const candidate = datedItem(sourceId, title, publishedAt, relevanceScore);
  candidate.source_priority = 'medium';
  candidate.source_reliability = 'official';
  return candidate;
}

// source-monitor가 만드는 후보. publishedAt은 항상 비어 있고 날짜는 effective_date에 담긴다.
function sourceChangeEventItem(sourceId, title, effectiveDate, relevanceScore = 85) {
  return {
    source_id: sourceId,
    source: sourceId,
    title,
    publishedAt: '',
    published_date: '',
    source_kind: 'source_change_event',
    collection_mode: 'source-change-event',
    effective_date: effectiveDate,
    date_precision: 'day',
    datePrecision: 'day',
    has_dated_evidence: true,
    main_eligible: true,
    relevanceScore,
    source_priority: 'medium',
    source_reliability: 'official'
  };
}

test('an in-window dated candidate outranks a higher-scoring undated one', () => {
  const now = new Date('2026-08-17T23:59:59.999Z');
  const undated = undatedItem('claude-code-changelog', 'undated-page-title', 90);
  const dated = sameTierDatedItem('vendor-security-bulletin', 'in-window-camera-cve', '2026-08-15T00:00:00Z', 10);

  assert.deepEqual([undated, dated].sort(candidateRankOrder(now)).map(c => c.title),
    ['in-window-camera-cve', 'undated-page-title'],
    'an undated page-title candidate no longer claims the primary-window bonus');
});

test('an unparseable published date is treated the same as a missing one', () => {
  // 가드가 `!candidate.publishedAt`으로 좁아지면 이 케이스가 통과해 버린다.
  const now = new Date('2026-08-17T23:59:59.999Z');
  const unparseable = undatedItem('claude-code-changelog', 'unparseable-date', 90, 'unknown');
  const dated = sameTierDatedItem('vendor-security-bulletin', 'in-window-camera-cve', '2026-08-15T00:00:00Z', 10);

  assert.deepEqual([unparseable, dated].sort(candidateRankOrder(now)).map(c => c.title),
    ['in-window-camera-cve', 'unparseable-date']);
});

test('an undated candidate no longer beats an out-of-window dated one on the window key alone', () => {
  // 창 밖 dated 후보와 nodate 후보는 이제 둘 다 가점이 없으므로 relevanceScore가 정한다.
  // 이전에는 nodate가 창 안으로 취급돼 점수와 무관하게 앞섰다.
  const now = new Date('2026-08-17T23:59:59.999Z');
  const undated = undatedItem('claude-code-changelog', 'undated-page-title', 38);
  const dated = sameTierDatedItem('vendor-security-bulletin', 'out-of-window-camera-cve', '2026-08-03T00:00:00Z', 60);

  assert.deepEqual([undated, dated].sort(candidateRankOrder(now)).map(c => c.title),
    ['out-of-window-camera-cve', 'undated-page-title']);
});

test('a source_change_event candidate keeps its rank even though publishedAt is empty', () => {
  // 이 lane은 날짜를 effective_date에 담고, 최종 후보로 살아남아야 evidence_id 스냅샷이
  // 처리됨으로 적립된다. 랭킹에서 강등되면 매주 재발화하고 매주 잘리는 기아 루프가 된다.
  const now = new Date('2026-08-17T23:59:59.999Z');
  const event = sourceChangeEventItem('aosp-site-updates', 'camera-its-page-changed', '2026-08-14');
  const undated = undatedItem('claude-code-changelog', 'undated-page-title', 90);
  const staleDated = sameTierDatedItem('vendor-security-bulletin', 'out-of-window-cve', '2026-08-03T00:00:00Z', 95);

  assert.deepEqual([undated, staleDated, event].sort(candidateRankOrder(now)).map(c => c.title),
    ['camera-its-page-changed', 'out-of-window-cve', 'undated-page-title'],
    'the monitor lane still receives the primary-window bonus');
});

test('the 35-day pool filter keeps undated candidates', () => {
  // 가점 제거가 수집 풀 필터까지 좁히지 않았는지 직접 확인한다(:1624의 withinLookback 호출 경로).
  const now = new Date('2026-08-17T23:59:59.999Z');
  assert.equal(withinLookback(undatedItem('photo-picker-documentation', 'undated-doc'), now, 35), true);
  assert.equal(withinLookback(undatedItem('claude-code-changelog', 'unparseable', 50, 'unknown'), now, 35), true);
});

test('a dated camera signal survives the global slice that undated page titles used to fill', () => {
  // 실측 형태 재현: 같은 medium/official 등급의 nodate 페이지 제목들이 전역 캡 꼬리를 채우고,
  // 그 뒤로 dated 카메라 신호가 밀려 잘리던 배치. 절단 폭은 프로덕션 상수를 그대로 쓴다.
  const now = new Date('2026-08-17T23:59:59.999Z');
  const ranked = [
    ...Array.from({ length: MAX_FINAL_CANDIDATES }, (_, i) =>
      undatedItem(`documentation-source-${i}`, `undated-${i}`, 90)),
    sameTierDatedItem('vendor-security-bulletin', 'in-window-camera-cve', '2026-08-15T00:00:00Z', 10)
  ].sort(candidateRankOrder(now));
  const finalPool = capPerSource(ranked, MAX_CANDIDATES_PER_SOURCE).slice(0, MAX_FINAL_CANDIDATES);

  assert.ok(finalPool.some(c => c.title === 'in-window-camera-cve'),
    'the dated camera signal is inside the final pool instead of being cut by undated page titles');
});

test('candidates from before the selection window stay in the pool for the catch-up lane', () => {
  const now = new Date('2026-08-03T23:59:59.999Z');
  const ranked = [
    datedItem('lore-linux-media-list', 'older-release', '2026-07-10T00:00:00Z'),
    datedItem('lore-linux-media-list', 'in-window', '2026-08-01T00:00:00Z')
  ].sort(candidateRankOrder(now));

  assert.deepEqual(ranked.map(c => c.title), ['in-window', 'older-release']);
  assert.equal(capPerSource(ranked, MAX_CANDIDATES_PER_SOURCE).length, 2,
    'older candidates are re-ranked, not dropped');
});

// #970 회귀: patchwork 수집 창이 응답 한 페이지(= 바쁜 주엔 하루치 버스트)에 갇혀 있으면 소스별
// 상한 8칸 중 2칸만 차고, 나머지 6칸은 다른 시리즈에 가지도 못하고 그냥 빈다. 창을 커버리지 주까지
// 넓히면 8칸이 서로 다른 시리즈로 찬다. 아래 형태는 2026-08-24 라이브 실측 그대로다: 08-24 버스트가
// 47조각짜리 software_isp 시리즈(6138)와 3조각 rkisp2 시리즈(6137) 둘뿐이고, 커버리지 주
// (08-17~08-23)에 서로 다른 시리즈 6개가 더 있었다. 상한은 그대로 8이다.
function patchworkSeriesItem(title, publishedAt, seriesId) {
  return {
    source_id: 'patchwork-libcamera-patches',
    source: 'patchwork-libcamera-patches',
    title,
    publishedAt,
    seriesId,
    relevanceScore: 50,
    source_priority: 'high',
    source_reliability: 'project-official'
  };
}

test('widening the patchwork window fills the per-source cap with distinct series (#970)', () => {
  const now = new Date('2026-08-24T23:59:59.999Z');
  const burstDay = [
    ...Array.from({ length: 47 }, (_, i) =>
      patchworkSeriesItem(`software_isp fragment ${i}`, '2026-08-24T09:10:00Z', 6138)),
    ...Array.from({ length: 3 }, (_, i) =>
      patchworkSeriesItem(`rkisp2 tuning fragment ${i}`, '2026-08-24T09:12:00Z', 6137))
  ];
  const coverageWeek = [6128, 6129, 6130, 6133, 6134, 6135].map((seriesId, i) =>
    patchworkSeriesItem(`coverage week series ${seriesId}`, `2026-08-${18 + i}T10:00:00Z`, seriesId));

  const cap = pool => capPerSource(
    collapseSeriesRepresentatives([...pool].sort(candidateRankOrder(now))),
    MAX_CANDIDATES_PER_SOURCE
  );

  // 창이 한 페이지에 갇힌 상태(이슈 이전): 하루치 버스트 안에 시리즈가 둘뿐이라 8칸 중 2칸만 찬다.
  const before = cap(burstDay);
  assert.equal(before.length, 2, 'a single-day burst only has two series to offer the eight-slot cap');

  // 창을 커버리지 주까지 넓힌 상태: 8칸이 다 차고, 47조각 시리즈는 여전히 한 칸만 쓴다.
  const after = cap([...burstDay, ...coverageWeek]);
  assert.equal(after.length, MAX_CANDIDATES_PER_SOURCE, 'the widened window fills every per-source slot');
  assert.equal(new Set(after.map(c => c.seriesId)).size, MAX_CANDIDATES_PER_SOURCE,
    'every slot goes to a different series');
  assert.equal(after.filter(c => c.seriesId === 6138).length, 1,
    'the 47-fragment series still competes as one representative, so widening does not let it eat the cap');
});
