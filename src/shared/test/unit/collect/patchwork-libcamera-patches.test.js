const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_PATCH_PAGES,
  resolvePatchworkLibcameraPatchItems
} = require('../../../collect/patchwork-libcamera-patches');

const LIST_API = 'https://patchwork.libcamera.org/api/patches/?order=-date&per_page=250&format=json';

function source(overrides = {}) {
  return {
    id: 'patchwork-libcamera-patches',
    name: 'libcamera Patchwork (patch review)',
    url: LIST_API,
    sourceUrl: LIST_API,
    ...overrides
  };
}

// Representative patchwork REST API page: a bare JSON array, newest-first. Includes
// a substantive uAPI patch, a churn patch, and two malformed rows to drop.
function apiJson() {
  return JSON.stringify([
    {
      id: 27198,
      web_url: 'https://patchwork.libcamera.org/patch/27198/',
      date: '2026-07-03T22:48:16',
      name: '[v2,1/2] libcamera: Add SensorSequence metadata control',
      state: 'new',
      submitter: { name: 'Jane Dev', email: 'jane@example.org' },
      series: [{ id: 880, name: 'Add SensorSequence metadata control', version: 2 }]
    },
    {
      id: 27196,
      web_url: 'https://patchwork.libcamera.org/patch/27196/',
      date: '2026-07-03T15:38:19',
      name: '[RFC,v1,17/17] ipa: simple: agc: Port to AgcMeanLuminance',
      state: 'new',
      submitter: { name: 'Sam Rev' }
    },
    {
      id: 27100,
      web_url: 'https://patchwork.libcamera.org/patch/27100/',
      date: '',
      name: 'build: bump meson version',
      state: 'accepted'
    },
    {
      id: 27101,
      web_url: '',
      date: '2026-07-01T10:00:00',
      name: 'utils: tidy checkstyle script',
      state: 'new'
    }
  ]);
}

test('parses patchwork JSON patches into dated rss_item candidates', async () => {
  const items = await resolvePatchworkLibcameraPatchItems(apiJson(), source());
  assert.equal(items.length, 2, 'only patches with both a date and web_url survive');

  const first = items[0];
  assert.equal(first.title, '[v2,1/2] libcamera: Add SensorSequence metadata control');
  assert.equal(first.url, 'https://patchwork.libcamera.org/patch/27198/');
  assert.equal(first.publishedAt, '2026-07-03');
  assert.equal(first.sourceKind, 'rss_item');
  assert.equal(first.collectionMode, 'rss-item');
  assert.equal(first.parentTitle, 'libcamera Patchwork (patch review)');
});

test('captures the REST series id so a patch series collapses into one candidate (#795)', async () => {
  // patchwork 후보는 URL(패치별 고유)·message-id로는 시리즈를 못 묶는다. REST의 series id를 후보에
  // 실어 dedup(article-groups seriesKey)이 같은 시리즈 조각을 하나로 collapse하게 한다.
  const items = await resolvePatchworkLibcameraPatchItems(apiJson(), source());
  assert.equal(items[0].seriesId, 880);
  // series 필드가 없는 patch는 seriesId 없음(무회귀, 단일 patch로 취급).
  assert.equal(items[1].seriesId, undefined);
});

test('does not set a relevance bucket hint so the classifier decides camera relevance', async () => {
  const items = await resolvePatchworkLibcameraPatchItems(apiJson(), source());
  for (const item of items) {
    assert.equal(item.relevanceBucketHint, undefined);
    assert.equal(item.relevance_bucket_hint, undefined);
  }
});

test('summary carries no scoring keyword so technicalDepth stays title-driven', async () => {
  // technicalDepth (mailing-list eligibility gate) reads title + summary. If the
  // summary injected a camera/metadata term, EVERY patch — docs and build churn
  // included — would clear the technicalDepth floor and could be upgraded to a main
  // slot. The summary must stay neutral so only the real patch subject drives depth.
  const items = await resolvePatchworkLibcameraPatchItems(apiJson(), source());
  for (const item of items) {
    assert.doesNotMatch(
      item.summary || '',
      /camera|image|sensor|release|metadata|driver|kernel|V4L2|ISP|buffer|stream/i,
      `summary must not inject scoring keywords: ${item.summary}`
    );
  }
});

test('returns [] for empty, non-JSON, error-object, or non-array input (graceful)', async () => {
  assert.deepEqual(await resolvePatchworkLibcameraPatchItems('', source()), []);
  assert.deepEqual(await resolvePatchworkLibcameraPatchItems('<html>not json</html>', source()), []);
  assert.deepEqual(await resolvePatchworkLibcameraPatchItems('{"detail":"Not found"}', source()), []);
  assert.deepEqual(await resolvePatchworkLibcameraPatchItems('[]', source()), []);
});

// #970 회귀: 등록부 URL 한 번으로 최신 한 페이지만 읽으면, 이 소스가 실제로 보는 창은
// "응답 한 페이지가 덮는 시간"이지 파이프라인 lookback(35일)이 아니다. 2026-08-24 실측으로
// 최신 50건이 09:06:35~09:14:06 = 7.5분만 덮었고, 같은 커버리지 주(08-17~08-23)의 patch
// 171건은 통째로 창 밖에 있었다. 바쁜 주일수록 창이 좁아지고, 진단에는 "수집 0건"으로만
// 남아 채널 무신호와 구분되지 않는다.
const BUSY_WEEK_NOW = new Date('2026-08-24T12:00:00Z');

function patch(id, date, name, seriesId) {
  return {
    id,
    web_url: `https://patchwork.libcamera.org/patch/${id}/`,
    date,
    name,
    state: 'new',
    submitter: { name: 'Jane Dev' },
    ...(seriesId === undefined ? {} : { series: [{ id: seriesId, name, version: 1 }] })
  };
}

// 실측 형태 재현: 1페이지는 수집 당일(08-24) 버스트로만 채워지고, 커버리지 주 신호는
// 2~3페이지에 있으며, 4페이지에서 lookback(35일) 밖으로 넘어간다.
function busyWeekPages() {
  return {
    1: [
      patch(28401, '2026-08-24T09:14:06', '[1/3] libcamera: ipa: rkisp1: burst churn', 9101),
      patch(28400, '2026-08-24T09:06:35', '[2/3] libcamera: ipa: rkisp1: burst churn', 9101)
    ],
    2: [
      patch(28320, '2026-08-23T18:02:11', '[v3,1/6] libcamera: Add SensorSequence metadata control', 9050),
      patch(28311, '2026-08-21T10:15:00', '[v3,2/6] libcamera: Add SensorSequence metadata control', 9050),
      patch(28300, '2026-08-20T08:44:02', 'pipeline: rkisp1: fix stride for NV12', 9051)
    ],
    3: [
      patch(28210, '2026-08-19T22:01:59', '[RFC] ipa: simple: agc: Port to AgcMeanLuminance', 9020),
      patch(28200, '2026-08-17T13:40:41', 'v4l2: subdev: expose embedded data stream', 9021)
    ],
    4: [
      patch(27000, '2026-07-01T09:00:00', 'build: bump meson version', 8000)
    ]
  };
}

function pagedFetch(pages, fetched = []) {
  return async (url) => {
    fetched.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    return JSON.stringify(pages[page] || []);
  };
}

test('pages past the newest response so the whole coverage week reaches the candidate pool (#970)', async () => {
  const pages = busyWeekPages();
  const fetched = [];
  const items = await resolvePatchworkLibcameraPatchItems(
    JSON.stringify(pages[1]),
    source(),
    { fetchTextImpl: pagedFetch(pages, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
  );

  const dates = items.map(item => item.publishedAt);
  // 커버리지 주(08-17~08-23) 후보가 한 건도 없던 것이 이 이슈의 증상이다.
  const coverageWeek = items.filter(item => item.publishedAt >= '2026-08-17' && item.publishedAt <= '2026-08-23');
  assert.equal(coverageWeek.length, 5, 'every coverage-week patch across pages 2 and 3 becomes a candidate');
  assert.deepEqual(
    [...new Set(coverageWeek.map(item => item.publishedAt))].sort(),
    ['2026-08-17', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-23'],
    'the whole coverage week is represented, not just the newest response'
  );
  assert.ok(dates.includes('2026-08-24'), 'the newest page is still collected');
  // 리졸버는 창 밖 후보를 버리지 않는다. 창의 정본은 수집 풀 필터(withinLookback)이고,
  // 리졸버는 그 창을 "어디까지 읽을지"에만 쓴다(catch-up 레인이 읽는 풀을 좁히지 않는다).
  assert.ok(dates.includes('2026-07-01'), 'out-of-window candidates stay for the pool filter to judge');
});

test('derives page URLs from source.sourceUrl instead of hardcoding the API path (#970)', async () => {
  const pages = busyWeekPages();
  const fetched = [];
  await resolvePatchworkLibcameraPatchItems(
    JSON.stringify(pages[1]),
    source({ sourceUrl: 'https://patchwork.example.test/api/patches/?order=-date&per_page=250&format=json' }),
    { fetchTextImpl: pagedFetch(pages, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
  );

  assert.ok(fetched.length > 0, 'follow-up pages are fetched');
  for (const url of fetched) {
    assert.match(url, /^https:\/\/patchwork\.example\.test\/api\/patches\/\?/, 'registry URL is the origin of every page request');
    assert.match(url, /per_page=250/, 'the registry query is preserved, only page is added');
  }
  assert.deepEqual(
    fetched.map(url => new URL(url).searchParams.get('page')),
    ['2', '3', '4'],
    'pages are requested in order from 2'
  );
});

test('stops paging at the first page that reaches past the lookback window (#970)', async () => {
  const pages = busyWeekPages();
  const fetched = [];
  await resolvePatchworkLibcameraPatchItems(
    JSON.stringify(pages[1]),
    source(),
    { fetchTextImpl: pagedFetch(pages, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
  );

  // 4페이지의 가장 오래된 patch(2026-07-01)가 lookback(35일 -> 2026-07-20) 밖이므로 여기서 멈춘다.
  assert.equal(fetched.length, 3, 'paging stops once a page crosses the lookback cutoff');
});

test('stops at the page ceiling when every page stays inside the lookback window (#970)', async () => {
  // 모든 페이지가 창 안이면 중단 조건 ①이 영원히 안 걸린다. 상한이 유일한 종료 조건이다.
  const fetched = [];
  const alwaysInWindow = async (url) => {
    fetched.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    return JSON.stringify([patch(29000 + page, '2026-08-23T00:00:00', `[${page}/9] libcamera: churn`, 9500 + page)]);
  };
  await resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]),
    source(),
    { fetchTextImpl: alwaysInWindow, now: BUSY_WEEK_NOW, lookbackDays: 35 }
  );

  assert.equal(fetched.length, MAX_PATCH_PAGES - 1, 'the page ceiling bounds an unbounded in-window stream');
  assert.ok(MAX_PATCH_PAGES >= 3, 'the ceiling must cover the busiest measured 35-day window');
});

test('stops paging when a page comes back empty (#970)', async () => {
  const fetched = [];
  const items = await resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]),
    source(),
    { fetchTextImpl: pagedFetch({}, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
  );

  assert.equal(fetched.length, 1, 'an empty page ends the walk instead of burning the whole ceiling');
  assert.equal(items.length, 1);
});

test('without a fetch impl only the first page is parsed (graceful degrade, #970)', async () => {
  // 기존 호출부(2인자)와 fetch를 못 주는 경로는 이슈 이전 동작 그대로여야 한다.
  const items = await resolvePatchworkLibcameraPatchItems(apiJson(), source());
  assert.equal(items.length, 2);
  const withOptions = await resolvePatchworkLibcameraPatchItems(apiJson(), source(), { now: BUSY_WEEK_NOW, lookbackDays: 35 });
  assert.equal(withOptions.length, 2);
});

test('a page fetch failure keeps the pages already collected (#970)', async () => {
  const items = await resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]),
    source(),
    {
      fetchTextImpl: async () => { throw new Error('network down'); },
      now: BUSY_WEEK_NOW,
      lookbackDays: 35
    }
  );
  assert.equal(items.length, 1, 'the first page survives a failed follow-up page');
});
