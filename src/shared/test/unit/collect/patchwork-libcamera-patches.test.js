const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUSIEST_MEASURED_LOOKBACK_WINDOW_PATCHES,
  MAX_PATCH_PAGES,
  resolvePatchworkLibcameraPatchItems
} = require('../../../collect/patchwork-libcamera-patches');
const { DATED_ARTICLE_DIAGNOSTIC_KINDS } = require('../../../collect/dated-article-index-resolver');
const newsSources = require('../../../data/news-sources.json');

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
// 파이프라인 lookback(35일)이 아니라 "응답 한 페이지가 덮는 시간"이다. 2026-08-24 실측으로
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

// 실측 형태 재현: 1페이지는 수집 당일(08-24) 버스트로만 채워지고, 커버리지 주 신호는 2~3페이지에
// 있다. 3페이지는 경계를 걸친다 — 창 안(08-19, 08-17)과 창 밖(07-01)이 한 페이지에 섞여 있으므로,
// 순회 종료를 정하는 것은 가장 오래된 patch여야 하고 가장 최신 patch면 안 된다. 4페이지는 그
// 판단이 틀렸을 때만 요청된다.
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
      patch(28200, '2026-08-17T13:40:41', 'v4l2: subdev: expose embedded data stream', 9021),
      patch(27000, '2026-07-01T09:00:00', 'build: bump meson version', 8000)
    ],
    4: [
      patch(26000, '2026-06-20T09:00:00', 'utils: tidy checkstyle script', 7000)
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

// 종료 경로가 관측되는지 보려면 console.warn을 읽어야 한다. 상한 도달이 조용하면 산출물에서
// "이번 주 신호 적음"과 구분되지 않는다(#970이 지목한 그 서명).
async function captureWarnings(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(' '));
  try {
    const value = await run();
    return { value, warnings };
  } finally {
    console.warn = original;
  }
}

test('pages past the newest response so the whole coverage week reaches the candidate pool (#970)', async () => {
  const pages = busyWeekPages();
  const fetched = [];
  const { value: items, warnings } = await captureWarnings(() => resolvePatchworkLibcameraPatchItems(
    JSON.stringify(pages[1]),
    source(),
    { fetchTextImpl: pagedFetch(pages, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
  ));

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
  assert.deepEqual(warnings, [], 'reaching the lookback edge is a normal stop and stays quiet');
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
    ['2', '3'],
    'pages are requested in order from 2'
  );
});

test('stops at the page that straddles the lookback edge, judged by its oldest patch (#970)', async () => {
  const pages = busyWeekPages();
  const fetched = [];
  await resolvePatchworkLibcameraPatchItems(
    JSON.stringify(pages[1]),
    source(),
    { fetchTextImpl: pagedFetch(pages, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
  );

  // 3페이지는 창 안(08-19)과 창 밖(07-01)이 섞여 있다. 가장 오래된 patch가 창을 넘었으므로
  // 여기서 멈춘다 — 가장 최신 patch로 판단하면 4페이지까지 파고 들어간다.
  assert.equal(fetched.length, 2, 'paging stops at the page whose oldest patch crosses the lookback cutoff');
  assert.ok(!fetched.some(url => url.endsWith('page=4')), 'the page beyond the lookback edge is never requested');
});

test('honours a lookbackDays other than the default (#970)', async () => {
  // 수집 workflow(newsletters-01-source-collect-pr.yml)가 lookback_days를 입력으로 노출한다.
  // 옵션을 무시하고 기본값 35만 쓰면 3일 실행에서도 2페이지를 판다.
  const pages = busyWeekPages();
  const fetched = [];
  await resolvePatchworkLibcameraPatchItems(
    JSON.stringify(pages[1]),
    source(),
    { fetchTextImpl: pagedFetch(pages, fetched), now: BUSY_WEEK_NOW, lookbackDays: 3 }
  );

  // 창은 08-21T12:00까지다. 2페이지의 가장 오래된 patch(08-20)가 이미 그 밖이라 거기서 끝난다.
  assert.equal(fetched.length, 1, 'a 3-day window stops one page earlier than the 35-day default');
});

test('stops at the page ceiling and says so when every page stays inside the window (#970)', async () => {
  // 모든 페이지가 창 안이면 lookback 종료 조건이 영원히 안 걸린다. 상한이 유일한 종료 조건이고,
  // 그 종료는 관측돼야 한다 — 조용히 끊기면 "이번 주 신호 적음"과 산출물에서 같은 모양이 된다.
  const fetched = [];
  const alwaysInWindow = async (url) => {
    fetched.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    return JSON.stringify([patch(29000 + page, '2026-08-23T00:00:00', `[${page}/9] libcamera: churn`, 9500 + page)]);
  };
  const { warnings } = await captureWarnings(() => resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]),
    source(),
    { fetchTextImpl: alwaysInWindow, now: BUSY_WEEK_NOW, lookbackDays: 35 }
  ));

  assert.equal(MAX_PATCH_PAGES, 4, 'the page ceiling is the value the counts below assume');
  assert.equal(fetched.length, 3, 'the ceiling bounds an unbounded in-window stream to 4 pages total');
  assert.equal(warnings.length, 1, 'hitting the ceiling is reported, not silent');
  assert.match(warnings[0], /ceiling/, 'the warning names the ceiling as the reason the window was cut short');
  assert.match(warnings[0], /lower bound/, 'the warning says the collected patches are a lower bound');
});

test('the registry page size and the page ceiling together cover the busiest measured window (#970)', () => {
  // MAX_PATCH_PAGES가 충분한 유일한 이유는 등록부의 per_page다. 등록부만 per_page=50으로 되돌리면
  // 4페이지 = 200건이 되어 가장 바쁜 35일 창(603건)을 못 덮는다 — 이슈 이전 결함 그대로다.
  // 코드 상수와 등록부는 한 쌍이므로 그 곱을 여기서 잠근다.
  const entry = newsSources.sources.find(item => item.id === 'patchwork-libcamera-patches');
  assert.ok(entry, 'the registry still carries the patchwork source');
  const perPage = Number(new URL(entry.sourceUrl).searchParams.get('per_page'));
  assert.ok(Number.isFinite(perPage) && perPage > 0, `the registry sourceUrl must carry a per_page: ${entry.sourceUrl}`);
  assert.ok(
    perPage * MAX_PATCH_PAGES >= BUSIEST_MEASURED_LOOKBACK_WINDOW_PATCHES,
    `per_page(${perPage}) x MAX_PATCH_PAGES(${MAX_PATCH_PAGES}) = ${perPage * MAX_PATCH_PAGES} must cover the `
      + `busiest measured lookback window (${BUSIEST_MEASURED_LOOKBACK_WINDOW_PATCHES} patches)`
  );
});

test('stops paging when a page comes back empty, without a warning (#970)', async () => {
  const fetched = [];
  const { value: items, warnings } = await captureWarnings(() => resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]),
    source(),
    { fetchTextImpl: pagedFetch({}, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
  ));

  assert.equal(fetched.length, 1, 'an empty page ends the walk instead of burning the whole ceiling');
  assert.equal(items.length, 1);
  assert.deepEqual(warnings, [], 'the end of the list is a normal stop, not a fault');
});

test('reads dates that already carry a timezone instead of falling back to one page (#970)', async () => {
  // 오늘 patchwork는 타임존 없는 ISO를 준다. 형식이 바뀌어 Z나 오프셋이 붙는 날, 날짜를 통째로
  // NaN으로 만들면 순회가 첫 페이지에서 끝나 이슈 이전 동작으로 조용히 되돌아간다.
  for (const date of ['2026-08-24T09:14:06Z', '2026-08-24T09:14:06+00:00', '2026-08-24T18:14:06+09:00']) {
    const fetched = [];
    const { warnings } = await captureWarnings(() => resolvePatchworkLibcameraPatchItems(
      JSON.stringify([patch(28401, date, 'libcamera: burst churn', 9101)]),
      source(),
      { fetchTextImpl: pagedFetch({}, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
    ));
    assert.equal(fetched.length, 1, `a ${date} timestamp still drives paging`);
    assert.deepEqual(warnings, [], `a ${date} timestamp is not a parse failure`);
  }
});

test('reports a page whose patches carry no readable date (#970)', async () => {
  const fetched = [];
  const { warnings } = await captureWarnings(() => resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, 'not-a-date', 'libcamera: burst churn', 9101)]),
    source(),
    { fetchTextImpl: pagedFetch({}, fetched), now: BUSY_WEEK_NOW, lookbackDays: 35 }
  ));

  assert.equal(fetched.length, 0, 'an unreadable page cannot claim to be inside the window');
  assert.equal(warnings.length, 1, 'the silent fallback to a single page is reported');
  assert.match(warnings[0], /no parseable date/);
});

test('without a fetch impl only the first page is parsed (graceful degrade, #970)', async () => {
  // 기존 호출부(2인자)와 fetch를 못 주는 경로는 이슈 이전 동작 그대로여야 한다.
  const items = await resolvePatchworkLibcameraPatchItems(apiJson(), source());
  assert.equal(items.length, 2);
  const withOptions = await resolvePatchworkLibcameraPatchItems(apiJson(), source(), { now: BUSY_WEEK_NOW, lookbackDays: 35 });
  assert.equal(withOptions.length, 2);
});

test('a page fetch failure keeps the pages already collected (#970)', async () => {
  const { value: items, warnings } = await captureWarnings(() => resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]),
    source(),
    {
      fetchTextImpl: async () => { throw new Error('network down'); },
      now: BUSY_WEEK_NOW,
      lookbackDays: 35
    }
  ));
  assert.equal(items.length, 1, 'the first page survives a failed follow-up page');
  assert.equal(warnings.length, 1, 'the failed page is reported');
  assert.match(warnings[0], /fetch failed/);
});

// #1059: console.warn은 Actions 로그에만 남고 그 로그는 커밋되지 않는다. 절단이 커밋된 산출물까지
// 가려면 진단 이벤트로도 나와야 한다 — 그러지 않으면 "창을 다 못 읽었다"와 "이번 주 신호 없음"이
// 산출물에서 같은 모양이다.
function captureRun(run) {
  const events = [];
  return captureWarnings(() => run(event => events.push(event))).then(result => ({ ...result, events }));
}

const alwaysInWindowFetch = (fetched) => async (url) => {
  fetched.push(url);
  const page = Number(new URL(url).searchParams.get('page'));
  return JSON.stringify([patch(29000 + page, '2026-08-23T00:00:00', `[${page}/9] libcamera: churn`, 9500 + page)]);
};

test('the page ceiling reaches the committed diagnostics, not just the log (#1059)', async () => {
  const fetched = [];
  const { warnings, events } = await captureRun(onDiagnostic => resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]),
    source(),
    { fetchTextImpl: alwaysInWindowFetch(fetched), now: BUSY_WEEK_NOW, lookbackDays: 35, onDiagnostic }
  ));

  assert.equal(warnings.length, 1, 'the log line stays — the event is an addition, not a replacement');
  assert.equal(events.length, 1, 'the ceiling is announced once');
  const [event] = events;
  assert.equal(event.kind, 'collection_window_truncated');
  assert.ok(
    DATED_ARTICLE_DIAGNOSTIC_KINDS.includes(event.kind),
    'an unregistered kind is folded into "unknown" by summarizeDatedArticleCollection, so the count would say nothing'
  );
  // 이 소스는 fetchClient를 안 써서 리포트의 소스별 표에 행이 없다. id가 없으면 어느 소스가
  // 잘렸는지 기계가 셀 수 없다.
  assert.equal(event.source_id, 'patchwork-libcamera-patches');
  assert.equal(event.lookback_days, 35);
  assert.equal(event.collected_count, 4, 'the event says how many patches the truncated run did collect');
  assert.match(event.detail, /ceiling/);
  assert.match(event.detail, /lower bound/);
});

test('a window read to its edge emits no truncation event (#1059)', async () => {
  // 거짓 양성이 나면 매주 절단이 났다고 말하게 되어, 진짜 절단을 이 이벤트로 못 찾는다.
  const pages = busyWeekPages();
  const { events: reachedEdge } = await captureRun(onDiagnostic => resolvePatchworkLibcameraPatchItems(
    JSON.stringify(pages[1]),
    source(),
    { fetchTextImpl: pagedFetch(pages, []), now: BUSY_WEEK_NOW, lookbackDays: 35, onDiagnostic }
  ));
  assert.deepEqual(reachedEdge, [], 'reaching the lookback edge is a normal stop');

  const { events: listEnded } = await captureRun(onDiagnostic => resolvePatchworkLibcameraPatchItems(
    JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]),
    source(),
    { fetchTextImpl: pagedFetch({}, []), now: BUSY_WEEK_NOW, lookbackDays: 35, onDiagnostic }
  ));
  assert.deepEqual(listEnded, [], 'the end of the list is a normal stop');
});

test('every early stop that cuts the window short is announced (#1059)', async () => {
  const inWindowPage = JSON.stringify([patch(28401, '2026-08-24T09:14:06', 'libcamera: burst churn', 9101)]);
  const cases = [
    {
      what: 'a failed follow-up page',
      firstPage: inWindowPage,
      fetchTextImpl: async () => { throw new Error('network down'); },
      detail: /fetch failed/
    },
    {
      what: 'a follow-up page that is not a patch array',
      firstPage: inWindowPage,
      fetchTextImpl: async () => JSON.stringify({ detail: 'Invalid page.' }),
      detail: /did not return a patch array/
    },
    {
      what: 'a page whose patches carry no readable date',
      firstPage: JSON.stringify([patch(28401, 'not-a-date', 'libcamera: burst churn', 9101)]),
      fetchTextImpl: async () => '[]',
      detail: /no parseable date/
    }
  ];

  for (const { what, firstPage, fetchTextImpl, detail } of cases) {
    const { events } = await captureRun(onDiagnostic => resolvePatchworkLibcameraPatchItems(
      firstPage,
      source(),
      { fetchTextImpl, now: BUSY_WEEK_NOW, lookbackDays: 35, onDiagnostic }
    ));
    assert.equal(events.length, 1, `${what} is announced`);
    assert.equal(events[0].kind, 'collection_window_truncated', what);
    assert.match(events[0].detail, detail, what);
  }
});
