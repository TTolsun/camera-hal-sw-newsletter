'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  collectFromSource,
  summarizeDatedArticleCollection,
  createSourceCollectionDiagnostics,
  usesDatedArticleResolver
} = require('../../../cli/collect-news-candidates');
const { createBoundedFetchClient, MAX_BYTES_PER_SOURCE_RUN } =
  require('../../../collect/bounded-fetch-client');
const { FOLLOWED_SOURCE_RESOLVERS } = require('../../../collect/followed-source-item-resolvers');

const readFixture = name =>
  fs.readFileSync(path.join(__dirname, '..', '..', 'fixtures', name), 'utf8');

const CLAUDE_BLOG = {
  id: 'claude-blog', name: 'Claude Blog',
  url: 'https://claude.com/blog', sourceUrl: 'https://claude.com/blog',
  category: 'ai', section: 'ai-tooling', priority: 'medium',
  reliability: 'official', usageHint: 'official', keywords: ['Claude'],
  sourceRole: 'generic_trend_source'
};

test('인덱스와 기사가 소스당 하나의 예산 인스턴스를 공유한다', async () => {
  const index = readFixture('source-html/claude-blog-index-cards.html');
  const article = readFixture('source-html/claude-blog-ai-ci-cd-on-call.html');
  const requested = [];
  const created = [];

  await collectFromSource(CLAUDE_BLOG, {
    now: new Date('2026-08-22T00:00:00Z'),
    lookbackDays: 21,
    fetchTextImpl: async () => '',
    createClient: options => {
      const client = createBoundedFetchClient({
        ...options,
        fetchImpl: async url => {
          requested.push(String(url));
          return new Response(String(url).endsWith('/blog') ? index : article, { status: 200 });
        }
      });
      created.push(client);
      return client;
    },
    onDiagnostic: () => {}
  });

  assert.equal(created.length, 1,
    '소스당 client는 하나다 — 둘이면 6MiB 카운터가 갈라져 실제로는 최대 12MiB가 흐른다');
  assert.ok(requested.includes('https://claude.com/blog'),
    '목록도 bounded client로 받아야 maxBytesPerIndexPage가 실제로 강제된다');
  assert.ok(requested.some(url => url.startsWith('https://claude.com/blog/')),
    '기사도 같은 client로 받는다');
  assert.ok(created[0].consumedBytes() >= index.length,
    '인덱스 바이트가 같은 카운터에 쌓여야 한다');
  assert.equal(created[0].maxBytesPerSourceRun, MAX_BYTES_PER_SOURCE_RUN);
});

// 아래 세 건은 "목록을 못 받았다"의 서로 다른 원인이 서로 다른 진단으로 갈리는지 잰다.
// 조치가 다르기 때문이다 — 예산은 상한을, 404는 소스 URL을, 빈 2xx는 마크업 가정을 고쳐야 한다.
function collectWithIndexResponse(makeResponse, over = {}) {
  return collectFromSource(CLAUDE_BLOG, {
    now: new Date('2026-08-22T00:00:00Z'),
    lookbackDays: 21,
    fetchTextImpl: async () => '',
    createClient: options => createBoundedFetchClient({
      ...options,
      ...(over.clientOptions || {}),
      fetchImpl: async () => makeResponse()
    }),
    onDiagnostic: over.onDiagnostic,
    onSourceBytes: over.onSourceBytes
  });
}

test('예산에 걸린 목록은 파싱하지 않고 skipped_index_budget으로 닫힌다', async () => {
  const seen = [];
  const bytes = {};
  await assert.rejects(
    () => collectWithIndexResponse(() => new Response('x'.repeat(4096), { status: 200 }), {
      clientOptions: { maxBytesPerSourceRun: 512 },
      onDiagnostic: event => seen.push(event),
      onSourceBytes: (id, value) => { bytes[id] = value; }
    }),
    /skipped_index_budget/
  );
  assert.deepEqual(seen.map(event => event.kind), ['skipped_index_budget'],
    'resolver는 이 사건을 관찰할 수 없다 — collector가 내지 않으면 진단이 통째로 사라진다');
  assert.equal(seen[0].limitedBy, 'source-run');
  assert.ok(seen[0].receivedBytes > 0);
  assert.ok(bytes['claude-blog'] > 0,
    '예외로 끝난 소스도 수신 바이트가 남아야 한다 — 안 그러면 "예산 초과"와 "0바이트"가 동시에 기록된다');
});

test('404는 예산 진단이 아니라 원래 HTTP 오류로 올라간다', async () => {
  const seen = [];
  await assert.rejects(
    () => collectWithIndexResponse(() => new Response('', { status: 404 }), {
      onDiagnostic: event => seen.push(event)
    }),
    /http_404/
  );
  assert.deepEqual(seen, [],
    'body가 비었다는 이유로 404를 예산 초과로 기록하면 예산을 올려도 안 고쳐진다');
});

test('예산에 걸리지 않은 빈 2xx는 empty_index_body로 닫힌다', async () => {
  const seen = [];
  await assert.rejects(
    () => collectWithIndexResponse(() => new Response('', { status: 200 }), {
      onDiagnostic: event => seen.push(event)
    }),
    /empty_index_body/
  );
  assert.deepEqual(seen, [], '마크업이 바뀐 것이지 예산을 넘긴 것이 아니다');
});

test('resolver가 낸 진단이 collector의 accumulator까지 도달한다', async () => {
  const index = readFixture('source-html/claude-blog-index-cards.html');
  const seen = [];
  await collectFromSource(CLAUDE_BLOG, {
    now: new Date('2026-08-22T00:00:00Z'),
    lookbackDays: 21,
    fetchTextImpl: async () => '',
    createClient: options => createBoundedFetchClient({
      ...options,
      // 기사만 MAX_BYTES_PER_ARTICLE(750KiB)를 넘긴다.
      fetchImpl: async url => new Response(
        String(url).endsWith('/blog') ? index : 'x'.repeat(800 * 1024),
        { status: 200 }
      )
    }),
    onDiagnostic: event => seen.push(event)
  });
  assert.ok(seen.some(event => event.kind === 'skipped_article_budget'),
    '레지스트리 항목이 onDiagnostic을 풀어 넘기지 않으면 이 단언이 깨진다 — 예외 없이 진단만 사라진다');
});

test('다른 소스는 주입된 fetchTextImpl을 그대로 쓰고 bounded client도 진단도 타지 않는다', async () => {
  const seen = [];
  const created = [];
  const fetched = [];
  const other = { ...CLAUDE_BLOG, id: 'linux-media-ml', name: 'linux-media' };
  await collectFromSource(other, {
    now: new Date('2026-08-22T00:00:00Z'),
    lookbackDays: 21,
    fetchTextImpl: async url => { fetched.push(String(url)); return '<html></html>'; },
    createClient: options => {
      const client = createBoundedFetchClient(options);
      created.push(client);
      return client;
    },
    onDiagnostic: event => seen.push(event)
  });
  assert.deepEqual(created, [], '두 소스 밖에서는 fetch 경로가 바뀌지 않는다');
  assert.deepEqual(seen, []);
  assert.equal(fetched.length, 1,
    '주입된 impl을 무시하고 전역 fetchText를 부르면 이 테스트가 실제 네트워크를 탄다');
});

test('진단 요약이 설계서 §4.12의 네 항목을 모두 담는다', () => {
  const summary = summarizeDatedArticleCollection({
    events: [
      { kind: 'skipped_index_budget', url: 'https://www.anthropic.com/news', receivedBytes: 1572864, limitedBy: 'request', detail: '' },
      { kind: 'skipped_article_budget', url: 'https://claude.com/blog/a', receivedBytes: 768000, limitedBy: 'request', detail: '' },
      { kind: 'article_fetch_failed', url: 'https://claude.com/blog/gone', receivedBytes: 0, limitedBy: '', status: 404, attempts: 1, error: 'http_404', detail: '' },
      { kind: 'fail_closed', url: 'https://claude.com/blog/b', reason: 'date_conflict', receivedBytes: 0, limitedBy: '', detail: '' },
      { kind: 'fail_closed', url: 'https://claude.com/blog/c', reason: 'month_precision', receivedBytes: 0, limitedBy: '', detail: '' },
      { kind: 'fail_closed', url: 'https://claude.com/blog/d', reason: 'date_confclit', receivedBytes: 0, limitedBy: '', detail: '' },
      { kind: 'not_a_kind', url: '', receivedBytes: 0, limitedBy: '', detail: '' }
    ],
    candidates: [
      { source_id: 'claude-blog', date_source: 'visible_date' },
      { source_id: 'claude-blog', date_source: 'release_row_date' },
      { source_id: 'claude-blog', date_source: '' },
      { source_id: 'linux-media-ml', date_source: 'visible_date' }
    ],
    receivedBytesBySource: { 'claude-blog': 5213692, 'anthropic-news': 1572864 }
  });

  assert.equal(summary.kind_counts.skipped_index_budget, 1);
  assert.equal(summary.kind_counts.skipped_article_budget, 1);
  assert.equal(summary.kind_counts.article_fetch_failed, 1,
    '개별 기사 fetch 실패도 artifact에 저장돼야 "fetch 실패가 진단으로 남는다"가 성립한다');
  assert.equal(summary.kind_counts.recent_window_budget_exhausted, 0,
    '0건도 키가 있어야 "안 났다"와 "안 셌다"가 구분된다');
  assert.equal(summary.kind_counts.index_collection_failed, 0,
    '이번 이벤트 목록에는 안 났다 — 그래도 어휘 안 kind라 0으로 존재해야 한다');
  assert.equal(summary.kind_counts.fail_closed, 3);
  assert.equal(summary.kind_counts.unknown, 1,
    '어휘 밖 kind(not_a_kind)는 조용히 버려지지 않고 unknown으로 집계돼야 한다 — ' +
    'FAIL_CLOSED_REASONS의 unknown 정규화와 같은 규칙이다');
  assert.deepEqual(summary.fail_closed_reasons,
    { date_conflict: 1, month_precision: 1, unknown: 1 },
    '어휘 밖 사유(오타 date_confclit)는 새 사유가 아니라 unknown으로 모인다');
  assert.deepEqual(summary.date_source_counts, { visible_date: 1, release_row_date: 1, missing: 1 },
    '다른 소스 후보는 이 분포에 섞이지 않는다');
  assert.equal(summary.received_bytes_by_source['claude-blog'], 5213692);
  assert.equal(summary.events.length, 7, '원본 이벤트는 정규화 전 값 그대로 보존한다');
});

// 목록 카드 하나(3-2-of-21)를 붕어빵으로 복제해 21건 만든다. 전부 같은 날짜(now 기준 2일 전)로
// 두면 전부 recent tier라 window 필터에서 하나도 빠지지 않는다 — MAX_ARTICLES_PER_RUN=8만이
// 유일한 컷 지점이 된다.
function claudeBlogCardHtml(slug, dateText) {
  return `<div role="listitem" class="blog_cms_item w-dyn-item">`
    + `<div class="u-text-style-caption">${dateText}</div>`
    + `<a href="/blog/${slug}">Title ${slug}</a>`
    + `</div>`;
}

test('상한이 자른 카드 수가 실제 artifact 요약까지 도달한다(cap이 보인다)', async () => {
  const indexHtml = Array.from({ length: 21 }, (_, index) => claudeBlogCardHtml(`post-${index}`, 'Aug 20, 2026')).join('');
  const diagnostics = createSourceCollectionDiagnostics();

  // main()과 같은 배선: collectFromSource에 세 콜백(record/recordSourceBytes/recordArticleCapCounts)을
  // 그대로 넘긴다 — resolver 반환값이 아니라 이 경로로 실제 artifact에 닿는지를 잰다.
  const result = await collectFromSource(CLAUDE_BLOG, {
    now: new Date('2026-08-22T00:00:00Z'),
    lookbackDays: 21,
    fetchTextImpl: async () => '',
    createClient: options => createBoundedFetchClient({
      ...options,
      // 인덱스든 개별 기사든 항상 같은 최소 응답을 준다 — 상한 카운터는 fetch 결과와
      // 무관하게 큐 구성 시점에 이미 계산·통보되므로 기사 fetch 성패는 이 테스트의 관심사가 아니다.
      fetchImpl: async url => new Response(
        String(url).endsWith('/blog') ? indexHtml : '<h1>Placeholder</h1><p>No anchors.</p>',
        { status: 200 }
      )
    }),
    onDiagnostic: diagnostics.record,
    onSourceBytes: diagnostics.recordSourceBytes,
    onArticleCapCounts: diagnostics.recordArticleCapCounts
  });

  const summary = summarizeDatedArticleCollection({
    events: diagnostics.events(),
    candidates: result.candidates,
    receivedBytesBySource: diagnostics.receivedBytesBySource(),
    articleCapCountsBySource: diagnostics.articleCapCountsBySource()
  });

  assert.deepEqual(summary.article_cap_counts_by_source['claude-blog'], {
    in_window_card_count: 21,
    scheduled_article_count: 8,
    skipped_article_cap_count: 13
  }, '카운터가 배선을 안 타면 이 소스 키 자체가 summary에서 빠진다');
});

test('마크업이 안 맞아 카드가 0건이면 index_collection_failed가 크게(loudly) 남는다', async () => {
  // href가 pathPrefix 상대경로가 아니라 절대 URL로 바뀐 인덱스 — 카드 파서의 앵커 정규식이
  // 하나도 매치하지 않는다(dated-article-cards.test.js의 "link markup changed" 케이스와 같은 모양).
  // "이번 주 신규 없음"이 아니라 마크업이 깨진 수집 실패다.
  const changedMarkupIndex = '<div role="listitem" class="blog_cms_item w-dyn-item">'
    + '<div class="u-text-style-caption">Aug 18, 2026</div>'
    + '<a href="https://claude.com/blog/some-post">Some post</a>'
    + '</div>';
  const diagnostics = createSourceCollectionDiagnostics();

  const result = await collectFromSource(CLAUDE_BLOG, {
    now: new Date('2026-08-22T00:00:00Z'),
    lookbackDays: 21,
    fetchTextImpl: async () => '',
    createClient: options => createBoundedFetchClient({
      ...options,
      fetchImpl: async () => new Response(changedMarkupIndex, { status: 200 })
    }),
    onDiagnostic: diagnostics.record,
    onSourceBytes: diagnostics.recordSourceBytes,
    onArticleCapCounts: diagnostics.recordArticleCapCounts
  });

  // 빈 배열만으로는 "이번 주 신규 없음"과 "수집 실패"를 구분할 수 없다 — 그래서 candidates가
  // 비어 있다는 것과 index_collection_failed가 났다는 것을 함께 확인한다.
  assert.deepEqual(result.candidates, []);

  const summary = summarizeDatedArticleCollection({
    events: diagnostics.events(),
    candidates: result.candidates,
    receivedBytesBySource: diagnostics.receivedBytesBySource(),
    articleCapCountsBySource: diagnostics.articleCapCountsBySource()
  });

  assert.equal(summary.kind_counts.index_collection_failed, 1,
    'console.warn으로만 남으면 이 카운트가 0으로 조용히 지나간다');
  const failure = summary.events.find(event => event.kind === 'index_collection_failed');
  assert.ok(failure, 'artifact에 저장된 원본 이벤트에서도 찾을 수 있어야 한다');
  assert.equal(failure.anchor_count, 0);
  assert.equal(failure.anchor_slug_count, 0);
  assert.equal(failure.resolved_card_count, 0);
  assert.equal(failure.unresolved_count, 0);
  assert.equal(failure.conflicted_count, 0);
});

// 위 테스트는 유일한 시나리오가 다섯 카운터 전부 0(anchor_count 자체가 0)이라, 다섯 필드를
// 전부 그냥 0으로 하드코딩해도 값이 우연히 맞아 통과한다. 앵커는 있지만(슬러그 링크는 있다)
// 카드는 하나도 못 읽는(날짜가 없는) 인덱스로 다섯 카운터를 서로 다른 값으로 갈라, 하드코딩이면
// 반드시 틀리게 만든다.
test('앵커는 있지만 카드를 하나도 못 읽으면 카운터가 서로 다른 값으로 갈린다', async () => {
  const anchorsWithoutDatesIndex = '<div role="listitem" class="blog_cms_item w-dyn-item">'
    + '<a href="/blog/no-date-a">No date A</a></div>'
    + '<div role="listitem" class="blog_cms_item w-dyn-item">'
    + '<a href="/blog/no-date-b">No date B</a></div>';
  const diagnostics = createSourceCollectionDiagnostics();

  const result = await collectFromSource(CLAUDE_BLOG, {
    now: new Date('2026-08-22T00:00:00Z'),
    lookbackDays: 21,
    fetchTextImpl: async () => '',
    createClient: options => createBoundedFetchClient({
      ...options,
      fetchImpl: async () => new Response(anchorsWithoutDatesIndex, { status: 200 })
    }),
    onDiagnostic: diagnostics.record,
    onSourceBytes: diagnostics.recordSourceBytes,
    onArticleCapCounts: diagnostics.recordArticleCapCounts
  });

  assert.deepEqual(result.candidates, []);

  const summary = summarizeDatedArticleCollection({
    events: diagnostics.events(),
    candidates: result.candidates,
    receivedBytesBySource: diagnostics.receivedBytesBySource(),
    articleCapCountsBySource: diagnostics.articleCapCountsBySource()
  });

  assert.equal(summary.kind_counts.index_collection_failed, 1);
  const failure = summary.events.find(event => event.kind === 'index_collection_failed');
  assert.ok(failure, 'artifact에 저장된 원본 이벤트에서도 찾을 수 있어야 한다');
  assert.equal(failure.anchor_count, 2, '슬러그 링크 두 개가 앵커로 잡혀야 한다');
  assert.equal(failure.anchor_slug_count, 2);
  assert.equal(failure.resolved_card_count, 0, '날짜가 없어 어떤 카드도 완성되지 않는다');
  assert.equal(failure.unresolved_count, 2, '앵커는 있는데 카드로 못 읽은 슬러그 둘 다 남는다');
  assert.equal(failure.conflicted_count, 0);
});

// usesDatedArticleResolver가 별도로 유지하는 소스 id 목록이 아니라
// followed-source-item-resolvers.js 레지스트리의 requiresFetchClient 마커에서 직접 파생되는지
// 잰다. 레지스트리에 세 번째 dated-article 소스를 requiresFetchClient: true로 등록하고
// collector 쪽 어떤 목록도 손대지 않은 채로 즉시 인식되는지 확인한다 — 등록과 client 배선이
// 항상 같은 자리(레지스트리)에서 일어나야, 등록 후 별도 목록에 추가하는 걸 잊어 fetchClient가
// null로 들어가는 사고(리뷰가 지적한 "run ends with zero candidates, zero diagnostics")가
// 구조적으로 불가능해진다.
test('usesDatedArticleResolver는 레지스트리의 requiresFetchClient 마커에서 파생된다(별도 하드코딩 목록 아님)', () => {
  const syntheticId = 'synthetic-dated-source-for-test';
  assert.equal(usesDatedArticleResolver({ id: syntheticId }), false,
    '레지스트리에 없는 소스는 당연히 false여야 이 테스트의 전제가 성립한다');

  FOLLOWED_SOURCE_RESOLVERS.push({ id: syntheticId, requiresFetchClient: true, resolve: async () => [] });
  try {
    assert.equal(usesDatedArticleResolver({ id: syntheticId }), true,
      '레지스트리에 requiresFetchClient: true로만 등록해도 collector가 즉시 client를 배선해야 한다 — ' +
      '별도 목록에 id를 또 추가해야 한다면 그 목록에 추가를 빠뜨리는 사고가 재발한다');
  } finally {
    FOLLOWED_SOURCE_RESOLVERS.pop();
  }
  assert.equal(usesDatedArticleResolver({ id: syntheticId }), false,
    '테스트 정리 후에는 원래대로 돌아와야 한다(다른 테스트 오염 방지 확인)');
});
