'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FAIL_CLOSED_REASONS,
  resolveDatedArticleIndexItems
} = require('../../../collect/dated-article-index-resolver');
const { createBoundedFetchClient, MAX_BYTES_PER_ARTICLE } = require('../../../collect/bounded-fetch-client');
const { normalizeCandidate } = require('../../../cli/collect-news-candidates');
const { buildArticleCapsule } = require('../../../../generator/select/article-capsules');
const { readTextFixture } = require('../../helpers/fixture-loader');

const ORIGIN = 'https://claude.com';
const PATH_PREFIX = '/blog';
const INDEX_URL = `${ORIGIN}${PATH_PREFIX}`;
const CONFIG = { pathPrefix: PATH_PREFIX, origin: ORIGIN, componentLabel: 'Claude Code' };

// normalizeCandidate는 registry entry 수준의 source 필드를 읽는다(aosp-release-camera-changes.test.js와
// 같은 패턴) — candidate.source는 이 객체를 그대로 들고 있다가 normalizeCandidate가 source.name 등을
// 평면 문자열 필드로 풀어낸다.
const SOURCE = {
  id: 'claude-blog',
  name: 'Claude Blog',
  sourceUrl: INDEX_URL,
  url: INDEX_URL,
  category: 'ai-agents',
  section: 'AI / Agents / Workflow',
  priority: 'medium',
  reliability: 'official',
  candidateOnly: false,
  requiresCrossCheck: false,
  keywords: ['Claude Code', 'CI/CD', 'agent']
};

const DEFAULT_NOW = new Date('2026-08-22T00:00:00Z');

const INDEX_HTML = readTextFixture('source-html/claude-blog-index-cards.html');
const ARTICLE_HTML = readTextFixture('source-html/claude-blog-ai-ci-cd-on-call.html');

// ---- 합성 HTML 빌더 ----

// Task 1의 카드 파서가 요구하는 최소 조건(role="listitem" 블록 안에 slug 링크 하나 + 날짜 하나)만
// 채운 카드 한 장. claude-blog-broken-cards.html 픽스처가 쓰는 것과 같은 최소 마크업이다.
function oneCardHtml({ slug, dateText, title = 'Test article' }) {
  return `<div role="listitem" class="blog_cms_item w-dyn-item">`
    + `<div class="u-text-style-caption">${dateText}</div>`
    + `<a href="${PATH_PREFIX}/${slug}">${title}</a>`
    + `</div>`;
}

// 개별 기사 페이지 최소 골격. <h2>Body</h2>로 헤더 날짜 스캔 구간을 명시적으로 닫아서, 뒤에
// 붙는 bodyHtml에 우연히 날짜처럼 보이는 문자열이 섞여도 articleHeaderDate가 잘못 집지 않게 한다.
function minimalArticleHtml({
  canonical = '',
  headerDateText = '',
  jsonLdDateText = '',
  title = 'Test Article',
  bodyHtml = '<p>Body text without any workflow anchor words.</p>'
} = {}) {
  const canonicalTag = canonical ? `<link href="${canonical}" rel="canonical"/>` : '';
  const jsonLdTag = jsonLdDateText
    ? `<script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', datePublished: jsonLdDateText })}</script>`
    : '';
  const headerDateTag = headerDateText ? `<div>${headerDateText}</div>` : '';
  return `${canonicalTag}${jsonLdTag}<h1>${title}</h1>${headerDateTag}<h2>Body</h2>${bodyHtml}`;
}

// ---- stub fetch client ----

function makeClient({ indexHtml = INDEX_HTML, indexUrl = INDEX_URL, defaultArticleHtml = ARTICLE_HTML, ...clientOptions } = {}) {
  const fetchImpl = async target => {
    if (target === indexUrl) return { status: 200, headers: {}, text: async () => indexHtml };
    return { status: 200, headers: {}, text: async () => defaultArticleHtml };
  };
  return createBoundedFetchClient({ fetchImpl, retryDelayMs: 0, ...clientOptions });
}

function withOnFetch(client, onFetch) {
  return {
    ...client,
    fetchBounded: (url, options) => {
      onFetch(url);
      return client.fetchBounded(url, options);
    }
  };
}

async function runResolver({ html, fetchClient, over = {} }) {
  return resolveDatedArticleIndexItems({
    html,
    source: SOURCE,
    fetchClient,
    now: over.now || DEFAULT_NOW,
    lookbackDays: over.lookbackDays ?? 21,
    config: CONFIG,
    onDiagnostic: over.onDiagnostic
  });
}

// ---- 테스트 헬퍼 (표 그대로) ----

async function resolveAll(over = {}) {
  const base = makeClient();
  const fetchClient = typeof over.onFetch === 'function' ? withOnFetch(base, over.onFetch) : base;
  return runResolver({ html: INDEX_HTML, fetchClient, over });
}

async function firstResolvedItem(over = {}) {
  const items = await resolveAll(over);
  const item = items.find(candidate => candidate.url.endsWith('/blog/ai-ci-cd-on-call'));
  assert.ok(item, 'expected the ai-ci-cd-on-call candidate to resolve');
  return item;
}

async function resolvedItemFrom(fixturePath, over = {}) {
  const indexHtml = oneCardHtml({ slug: 'ai-ci-cd-on-call', dateText: 'Aug 18, 2026' });
  const articleHtml = readTextFixture(fixturePath);
  const items = await runResolver({
    html: indexHtml,
    fetchClient: makeClient({ indexHtml, defaultArticleHtml: articleHtml }),
    over
  });
  assert.equal(items.length, 1, `expected exactly one resolved item from ${fixturePath}`);
  return items[0];
}

async function resolveWithMismatchedDates(over = {}) {
  const indexHtml = oneCardHtml({ slug: 'ai-ci-cd-on-call', dateText: 'Aug 18, 2026' });
  // JSON-LD를 넣지 않는다 — 넣으면 header(08-11)와 JSON-LD가 페이지 내부에서 먼저 충돌해
  // resolveDatedArticlePage가 published_date를 ''로 접어버린다. 그러면 이 테스트가 재려는
  // "목록 날짜 vs 페이지 날짜" 충돌이 아니라 "페이지 내부" 충돌을 재게 된다.
  const articleHtml = minimalArticleHtml({
    canonical: `${ORIGIN}${PATH_PREFIX}/ai-ci-cd-on-call`,
    headerDateText: 'Aug 11, 2026'
  });
  return runResolver({ html: indexHtml, fetchClient: makeClient({ indexHtml, defaultArticleHtml: articleHtml }), over });
}

// 페이지 자기 내부에서 헤더 가시 날짜와 JSON-LD datePublished가 서로 다르다
// (dated-article-page-parsing.js가 이 경우 published_date를 ''로 접는다: date_conflict: true).
// 목록 날짜(Aug 18)를 헤더 날짜(Aug 18)와 일부러 같게 둔다 — "페이지가 스스로 못 믿는다고
// 밝힌 날짜가 목록 날짜로 감쪽같이 세탁된다"는 실제 위험(리뷰 지적)을 그대로 재현하기 위해서다.
async function resolveWithPageInternalDateConflict(over = {}) {
  const indexHtml = oneCardHtml({ slug: 'ai-ci-cd-on-call', dateText: 'Aug 18, 2026' });
  const articleHtml = minimalArticleHtml({
    canonical: `${ORIGIN}${PATH_PREFIX}/ai-ci-cd-on-call`,
    headerDateText: 'Aug 18, 2026',
    jsonLdDateText: 'Aug 19, 2026'
  });
  return runResolver({ html: indexHtml, fetchClient: makeClient({ indexHtml, defaultArticleHtml: articleHtml }), over });
}

async function resolveWithCanonicalMismatch(over = {}) {
  const indexHtml = oneCardHtml({ slug: 'ai-ci-cd-on-call', dateText: 'Aug 18, 2026' });
  const articleHtml = minimalArticleHtml({
    canonical: `${ORIGIN}${PATH_PREFIX}/a-completely-different-slug`,
    headerDateText: 'Aug 18, 2026'
  });
  return runResolver({ html: indexHtml, fetchClient: makeClient({ indexHtml, defaultArticleHtml: articleHtml }), over });
}

async function resolveWithTinyArticleBudget(over = {}) {
  // MAX_BYTES_PER_ARTICLE 자체를 넘는 본문을 준다 — 이 resolver는 매 기사 fetch에 항상
  // MAX_BYTES_PER_ARTICLE을 요청 상한으로 쓰므로(브리프 §"기사 fetch 결과 판정"), 요청 상한을
  // 실제로 넘겨야 request-limited truncation이 재현된다.
  const oversizedArticleHtml = `${ARTICLE_HTML}${' '.repeat(MAX_BYTES_PER_ARTICLE + 4096)}`;
  return runResolver({ html: INDEX_HTML, fetchClient: makeClient({ defaultArticleHtml: oversizedArticleHtml }), over });
}

async function resolveWithFailingArticle(failure, over = {}) {
  const indexHtml = [
    oneCardHtml({ slug: 'gone', dateText: 'Aug 20, 2026', title: 'Gone article' }),
    oneCardHtml({ slug: 'ai-ci-cd-on-call', dateText: 'Aug 18, 2026', title: 'AI CI/CD on call' })
  ].join('');
  const goneUrl = `${ORIGIN}${PATH_PREFIX}/gone`;
  const fetchImpl = async target => {
    if (target === INDEX_URL) return { status: 200, headers: {}, text: async () => indexHtml };
    if (target === goneUrl) {
      if (failure.status === 0) throw new Error(failure.error);
      return { status: failure.status, headers: {}, text: async () => '' };
    }
    return { status: 200, headers: {}, text: async () => ARTICLE_HTML };
  };
  const fetchClient = createBoundedFetchClient({ fetchImpl, retryDelayMs: 0 });
  return runResolver({ html: indexHtml, fetchClient, over });
}

async function resolveWithRelatedArticlesTail(over = {}) {
  // 관련 기사 목록은 인덱스와 같은 카드 마크업을 쓴다 — 자르지 않으면 이 카드의 제목·날짜가
  // 본문 파싱으로 새어 들어간다.
  const tail = '<section class="blog_related_section_wrap">'
    + '<div role="listitem" class="blog_cms_item w-dyn-item">'
    + '<div class="u-text-style-caption">Jul 24, 2026</div>'
    + '<a href="/blog/foreign-related">FOREIGN_RELATED_TITLE</a>'
    + '</div></section>';
  const articleHtml = `${ARTICLE_HTML}${tail}`;
  const items = await runResolver({ html: INDEX_HTML, fetchClient: makeClient({ defaultArticleHtml: articleHtml }), over });
  const item = items.find(candidate => candidate.url.endsWith('/blog/ai-ci-cd-on-call'));
  assert.ok(item, 'expected the ai-ci-cd-on-call candidate to resolve despite the related-articles tail');
  return item;
}

async function resolveWithExhaustedSourceBudget(over = {}) {
  const articleBytes = Buffer.byteLength(ARTICLE_HTML, 'utf8');
  // 최근 7일 기사(기본 목록에는 3건: 08-21 x2, 08-18) 2건분보다 작게 — 1건은 온전히 받고
  // 2건째부터 source-run 상한에 걸리게 한다.
  const fetchClient = makeClient({
    defaultArticleHtml: ARTICLE_HTML,
    maxBytesPerSourceRun: Math.floor(articleBytes * 1.2)
  });
  return runResolver({ html: INDEX_HTML, fetchClient, over });
}

// 9장 모두 같은 날짜(같은 tier)로 둔다 — parseDatedArticleCards는 날짜가 같으면 문서 위치로
// 안정 정렬하므로, filler 8장을 앞에 두고 신호 있는 카드를 맨 뒤(9번째)에 두면 tie-break 없이는
// 그 카드가 8건 컷 밖으로 밀려난다는 것을 결정론적으로 만들 수 있다.
const WORKFLOW_SIGNAL_FILLER_SLUGS = [
  'company-milestone-one', 'design-partner-story', 'customer-spotlight-retail',
  'product-launch-recap', 'team-offsite-recap', 'partnership-announcement',
  'brand-refresh-notes', 'holiday-schedule-update'
];
const WORKFLOW_SIGNAL_SLUG = 'nightly-ci-build-debug-report'; // -> 'nightly ci build debug report'

function workflowSignalIndexHtml() {
  const dateText = 'Aug 20, 2026'; // now(2026-08-22) 기준 2일 전 — 전부 recent tier
  const cards = [
    ...WORKFLOW_SIGNAL_FILLER_SLUGS.map(slug => oneCardHtml({ slug, dateText, title: 'Filler post' })),
    oneCardHtml({ slug: WORKFLOW_SIGNAL_SLUG, dateText, title: 'Signal post' })
  ];
  return cards.join('');
}

// ---- 테스트 ----

test('anchor-extracted workflow evidence reaches the article capsule', async () => {
  const item = await firstResolvedItem();
  // 앵커를 재려면 summary가 그 문구를 담고 있으면 안 된다(담고 있으면 앵커 없이도 통과한다).
  assert.doesNotMatch(String(item.summary || ''), /requires approval to merge/i,
    'summary가 문구를 담으면 이 test는 앵커가 아니라 summary를 재게 된다');
  assert.match(item.behavior_change, /requires approval to merge/i,
    'resolver는 앵커 문장을 behavior_change에 싣는다');

  const normalized = normalizeCandidate(item);
  assert.match(normalized.behavior_change, /requires approval to merge/i);

  const capsule = buildArticleCapsule(normalized, []);
  assert.ok(capsule.evidence.length <= 3, 'capsule은 evidence를 3개로 자른다(MAX_EVIDENCE_ITEMS=3)');
  assert.ok(
    capsule.evidence.some(line => /^behavior_change: /.test(line) && /requires approval to merge/i.test(line)),
    'version_or_release/api_or_component가 앞 두 칸을 차지해도 앵커 문장이 3칸 안에 남아야 한다'
  );
});

test('emits blog_post_item and lets the collector derive the collection mode', async () => {
  const item = await firstResolvedItem();
  assert.equal(item.sourceKind, 'blog_post_item');
  assert.equal(item.collectionMode, undefined, 'resolver는 collectionMode를 설정하지 않는다');
  assert.equal(normalizeCandidate(item).collectionMode, 'article-item');
});

test('never emits the index url as a candidate', async () => {
  const items = await resolveAll();
  for (const item of items) {
    assert.notEqual(item.url, 'https://claude.com/blog');
    assert.match(item.url, /^https:\/\/claude\.com\/blog\/[a-z0-9-]+$/);
  }
});

test('a missing/invalid fetchClient is loud, not a silent empty array', async () => {
  // 배선 실수(레지스트리에는 등록됐지만 collector가 bounded client를 못 만들어 넘긴 경우)를
  // 재현한다. 빈 배열만 돌려주면 이 사건은 artifact 어디에도 안 남는다.
  const seen = [];
  const items = await resolveDatedArticleIndexItems({
    html: INDEX_HTML,
    source: SOURCE,
    fetchClient: null,
    now: DEFAULT_NOW,
    lookbackDays: 21,
    config: CONFIG,
    onDiagnostic: event => seen.push(event)
  });
  assert.deepEqual(items, []);
  const failures = seen.filter(event => event.kind === 'index_collection_failed');
  assert.equal(failures.length, 1,
    'fetchClient가 없다는 이유로 조용히 빈 배열만 돌려주면 배선 실수가 진단 없이 사라진다');
});

test('falls back to the list-row date only when the canonical url matches exactly', async () => {
  const item = await resolvedItemFrom('source-html/claude-blog-post-no-date.html');
  assert.equal(item.publishedAt, '');
  assert.equal(item.effective_date, '2026-08-18');
  assert.equal(item.date_source, 'release_row_date');
  assert.equal(item.date_confidence, 95);
  assert.equal(item.date_evidence_url, 'https://claude.com/blog');
});

test('drops the candidate when the page and the list row disagree', async () => {
  const seen = [];
  const items = await resolveWithMismatchedDates({ onDiagnostic: event => seen.push(event) });
  assert.deepEqual(items, []);
  const failClosed = seen.filter(event => event.kind === 'fail_closed');
  assert.equal(failClosed.length, 1, '빈 배열만으로는 fail-closed와 "글이 없음"을 구분할 수 없다');
  assert.equal(failClosed[0].reason, 'date_conflict');
});

test('does not launder a page-internal date conflict into a release_row_date candidate', async () => {
  // 페이지가 스스로 "내 날짜를 못 믿는다"(date_conflict)고 밝히면, published_date가 ''라는 이유로
  // 목록 날짜(release_row_date, 신뢰도 95, publish-ready)로 메우면 안 된다 — 그건 목록-vs-페이지
  // 불일치(date_conflict)가 아니라 페이지 내부 자기모순인데, 메우는 순간 더 약한 근거가 더 강한
  // 신뢰도 라벨을 달고 통과한다.
  const seen = [];
  const items = await resolveWithPageInternalDateConflict({ onDiagnostic: event => seen.push(event) });
  assert.deepEqual(items, [], '빈 배열만으로는 fail-closed와 "글이 없음"을 구분할 수 없다 — 아래에서 이벤트로 확인한다');

  const failClosed = seen.filter(event => event.kind === 'fail_closed');
  assert.equal(failClosed.length, 1,
    '페이지 내부 충돌도 fail-closed로 기록돼야 한다 — 안 그러면 release_row_date로 조용히 새는 경로가 남는다');
  assert.equal(failClosed[0].reason, 'date_conflict');
  assert.doesNotMatch(failClosed[0].detail, /list card date/,
    '목록-vs-페이지 충돌과 같은 문구를 쓰면 운영자가 두 사유를 구분할 수 없다');
  assert.match(failClosed[0].detail, /own date/,
    '페이지 내부 충돌임을 detail에서 알아볼 수 있어야 한다');
});

test('does not fetch an article that is outside the lookback window', async () => {
  const fetched = [];
  await resolveAll({ now: new Date('2026-08-22T00:00:00Z'), lookbackDays: 7, onFetch: url => fetched.push(url) });
  assert.ok(fetched.length <= 8, 'maxArticlesPerRun 상한');
  assert.ok(fetched.every(url => !url.includes('/blog/harnessing-claudes-intelligence')),
    '4월 2일 글이 최근 7일 창에서 받아지면 안 된다');
});

test('records skipped_article_budget instead of using a truncated body', async () => {
  const seen = [];
  const items = await resolveWithTinyArticleBudget({ onDiagnostic: event => seen.push(event) });
  assert.deepEqual(items, [], '잘린 본문으로 후보를 만들면 안 된다');
  const skipped = seen.filter(event => event.kind === 'skipped_article_budget');
  assert.ok(skipped.length > 0, '빈 배열만으로는 예산 소진과 후보 없음을 구분할 수 없다');
  assert.equal(skipped[0].limitedBy, 'request');
  assert.ok(skipped[0].receivedBytes > 0);
});

test('classifies every fail-closed drop with a reason from the closed vocabulary', async () => {
  const seen = [];
  // 개별 페이지 canonical이 카드 링크와 다른 경우 — 목록에서 사라졌거나 다른 글로 리다이렉트된 항목.
  const items = await resolveWithCanonicalMismatch({ onDiagnostic: event => seen.push(event) });
  assert.deepEqual(items, []);
  const failClosed = seen.filter(event => event.kind === 'fail_closed');
  assert.equal(failClosed.length, 1,
    'fail-closed로 닫은 건수가 진단에 남아야 §4.12 사유별 집계가 성립한다');
  assert.equal(failClosed[0].reason, 'canonical_mismatch');
  assert.deepEqual(failClosed.filter(event => !FAIL_CLOSED_REASONS.includes(event.reason)), [],
    '어휘 밖 사유는 summarizeDatedArticleCollection이 세지 않고 조용히 버린다');
  assert.ok(seen.every(event => event.kind !== 'skipped_index_budget'),
    '목록 예산은 collector 소유다 — resolver가 내면 같은 사건이 두 번 세어진다');
});

test('does not fall back to the index when an article fetch fails', async () => {
  // 404와 전송 실패(timeout)를 함께 잰다. 둘 다 "받지 못했다"이므로 같은 계약을 따른다.
  for (const failure of [
    { status: 404, error: 'http_404' },
    { status: 0, error: 'request_timeout' }
  ]) {
    const seen = [];
    const items = await resolveWithFailingArticle(failure, { onDiagnostic: event => seen.push(event) });

    assert.equal(items.length, 1, '실패한 기사만 빠지고 나머지 기사는 계속 처리한다');
    assert.ok(items.every(item => item.url !== 'https://claude.com/blog'),
      '목록 URL이 후보가 되면 이 PR이 없애려던 인덱스 후보가 이름만 바꿔 돌아온다');
    assert.ok(items.every(item => item.url !== 'https://claude.com/blog/gone'),
      '목록 카드에 날짜가 있어도 fetch 실패 기사는 후보가 되지 않는다 — canonical을 확인할 방법이 없다');

    const failed = seen.filter(event => event.kind === 'article_fetch_failed');
    assert.equal(failed.length, 1);
    assert.equal(failed[0].url, 'https://claude.com/blog/gone');
    assert.equal(failed[0].status, failure.status);
    assert.equal(failed[0].error, failure.error);
    assert.ok(failed[0].attempts >= 1, '재시도 횟수를 기록해야 일시 장애와 영구 404를 가른다');
    assert.equal(typeof failed[0].receivedBytes, 'number');
    assert.ok(seen.every(event => event.kind !== 'fail_closed'),
      'fetch 실패는 날짜 근거 판정 이전 단계다 — fail_closed로 세면 사유별 집계가 오염된다');
    assert.ok(seen.every(event => event.kind !== 'skipped_article_budget'),
      '예산 초과와 fetch 실패는 조치가 다르므로 같은 kind로 묶지 않는다');
  }
});

test('stops reading the body at the related-articles section', async () => {
  // Task 2의 fixture는 이 구간을 이미 잘라 뒀으므로, 마커 동작은 합성 HTML로 잰다.
  // 관련 기사 목록은 인덱스와 같은 카드 마크업을 쓰기 때문에, 자르지 않으면 남의 기사
  // 제목과 날짜가 이 기사의 summary·sections로 들어간다.
  const item = await resolveWithRelatedArticlesTail();
  const haystack = [
    String(item.summary || ''),
    String(item.behavior_change || ''),
    JSON.stringify(item.source_extraction || {})
  ].join(' ');
  assert.doesNotMatch(haystack, /FOREIGN_RELATED_TITLE/,
    '관련 기사 제목이 본문으로 새면 이 단언이 깨진다');
  assert.doesNotMatch(haystack, /Jul 24, 2026/,
    '관련 기사 카드의 날짜도 본문으로 새면 안 된다');
});

test('reports when the source budget runs out with recent articles still queued', async () => {
  const seen = [];
  await resolveWithExhaustedSourceBudget({ onDiagnostic: event => seen.push(event) });
  const exhausted = seen.find(event => event.kind === 'recent_window_budget_exhausted');
  assert.ok(exhausted, '최근 7일 기사가 예산 때문에 생략되면 진단이 남아야 한다');
  assert.match(exhausted.detail, /\d+/, '남은 건수를 적는다');
});

test('prioritizes a workflow-signal slug within its window tier even when the article cap would otherwise cut it', async () => {
  // 9장 전부 같은 tier(recent)에 있고, 신호 있는 카드는 문서 순서상 9번째다.
  // MAX_ARTICLES_PER_RUN=8이므로 tie-break가 없으면 이 카드는 절대 fetch되지 않는다.
  const indexHtml = workflowSignalIndexHtml();
  const fetched = [];
  await runResolver({
    html: indexHtml,
    fetchClient: withOnFetch(makeClient({ indexHtml }), url => fetched.push(url)),
    over: {}
  });

  assert.equal(fetched.length, 8, 'maxArticlesPerRun 상한(8)까지만 fetch한다');

  const signalUrl = `${ORIGIN}${PATH_PREFIX}/${WORKFLOW_SIGNAL_SLUG}`;
  assert.ok(fetched.includes(signalUrl),
    'slug에 CI/CD/debug 신호가 있으면 문서 순서상 9번째라도 tie-break가 상위 8건 안으로 끌어올려야 한다');

  const fetchedFillerCount = WORKFLOW_SIGNAL_FILLER_SLUGS
    .filter(slug => fetched.includes(`${ORIGIN}${PATH_PREFIX}/${slug}`)).length;
  assert.ok(fetchedFillerCount < WORKFLOW_SIGNAL_FILLER_SLUGS.length,
    '신호 없는 filler 슬러그 중 최소 1건은 8건 컷 밖으로 밀려야 tie-break가 실제로 순서를 바꿨다고 말할 수 있다');
});
