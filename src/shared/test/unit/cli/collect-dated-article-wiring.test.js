'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  collectFromSource,
  summarizeDatedArticleCollection
} = require('../../../cli/collect-news-candidates');
const { createBoundedFetchClient, MAX_BYTES_PER_SOURCE_RUN } =
  require('../../../collect/bounded-fetch-client');

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
  assert.equal(summary.kind_counts.fail_closed, 3);
  assert.deepEqual(summary.fail_closed_reasons,
    { date_conflict: 1, month_precision: 1, unknown: 1 },
    '어휘 밖 사유(오타 date_confclit)는 새 사유가 아니라 unknown으로 모인다');
  assert.deepEqual(summary.date_source_counts, { visible_date: 1, release_row_date: 1, missing: 1 },
    '다른 소스 후보는 이 분포에 섞이지 않는다');
  assert.equal(summary.received_bytes_by_source['claude-blog'], 5213692);
  assert.equal(summary.events.length, 7, '원본 이벤트는 정규화 전 값 그대로 보존한다');
});
