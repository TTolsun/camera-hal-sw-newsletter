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

// KNOWN_COMPONENT_PATTERN의 여섯 토큰(Claude Code, GitHub Actions, GitHub, PagerDuty, Grafana,
// Kubernetes) 중 어느 것도 담지 않은 본문. evidenceMetadata(collect-news-candidates.js)의
// API_OR_COMPONENT_PATTERN·STRONG_CAMERA_DRIVER_PATTERNS·VERSION_OR_RELEASE_PATTERN 토큰도 함께
// 피한다 — 그중 하나라도 걸리면 이 resolver가 남긴 빈 api_or_component를 collector가 대신
// 채워버려서, 이 test가 재려는 "resolver 단계에서 증거 없음" 상태가 다른 경로로 오염된다.
// workflow anchor(agent/incident/pull request)는 남겨 둔다 — behavior_change 추출 자체는
// 정상 동작해야 하고, 이 test가 재려는 것은 api_or_component 하나뿐이다.
function noComponentEvidenceArticleHtml() {
  const canonical = `${ORIGIN}${PATH_PREFIX}/team-workflow-notes`;
  const jsonLdTag = `<script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', datePublished: 'Aug 20, 2026' })}</script>`;
  const bodyHtml = '<p>Our small operations team spent the quarter tightening how we hand off overnight '
    + 'shifts between teammates. We rewrote the onboarding notes, cleaned up the shared calendar, and '
    + 'agreed on a lighter rotation schedule so nobody carries a pager two weekends in a row. Feedback '
    + 'from the last retro was mostly about clarity: who owns what, and when to escalate versus wait '
    + 'until morning. We also spent time trimming the noisy channels that had grown cluttered over the '
    + 'past year, moving casual chatter into a separate space so the primary channel stays focused on '
    + 'actionable items only.</p>'
    + '<p>When something goes sideways, an agent now walks through the incident timeline first and '
    + 'drafts a short pull request with the proposed fix for a teammate to review before anything '
    + 'ships.</p>';
  return `<link href="${canonical}" rel="canonical"/>${jsonLdTag}<h1>Team workflow notes</h1>`
    + `<div>Aug 20, 2026</div><h2>Body</h2>${bodyHtml}`;
}

async function resolveWithoutComponentEvidence(over = {}) {
  const indexHtml = oneCardHtml({ slug: 'team-workflow-notes', dateText: 'Aug 20, 2026', title: 'Team workflow notes' });
  const articleHtml = noComponentEvidenceArticleHtml();
  const items = await runResolver({ html: indexHtml, fetchClient: makeClient({ indexHtml, defaultArticleHtml: articleHtml }), over });
  assert.equal(items.length, 1, 'expected exactly one resolved item from the no-component-evidence body');
  return items[0];
}

// 1위(앵커 5개)와 2위(앵커 4개) 문장을 본문에서 바로 이웃하게 둔 합성 본문. 각 문장을
// ANCHOR_PAD(240)로 넓히면 1위 문단이 2위 문장까지 삼키고 2위 문단은 1위 문장 뒤부터를 담아
// 두 문단이 같은 구간을 공유한다(#946). 3위(앵커 3개) 문장은 그 뒤로 500자 넘는 중립 문단만큼
// 떨어뜨려 둔다 — ANCHOR_PAD가 양쪽 240자씩이므로 480자보다 멀면 3위 문단은 1위 문단과 절대
// 겹치지 않는다. 그래서 이 본문 하나로 "겹치는 2위는 건너뛴다"와 "그 자리를 다음 순위가
// 채운다"를 함께 잴 수 있다.
//
// 도입부(첫 500자)는 SUMMARY_LIMIT이 summary로 가져가므로 근거 추출에서 빠진다. 도입부와
// 중립 채우기 문장에는 WORKFLOW_ANCHORS 토큰(build/test/CI/CD/debug/log/trace/metric/artifact/
// regression/incident/verification/verify/pull request/approval/agent 등)을 하나도 넣지 않는다 —
// 하나라도 섞이면 순위가 흔들려 이 본문이 재려는 배치 자체가 깨진다.
const ADJACENT_ANCHOR_BODY = 'Our small kitchen team spent the spring rewriting the family cookbook that had been '
  + 'sitting in a drawer since the house was painted. Most of the pages were handwritten, some of '
  + 'them in pencil, and a few had been copied twice over from older notebooks that nobody could '
  + 'find anymore. We sorted the recipes by season first, then by the number of people they feed, '
  + 'because that is how the kitchen actually gets used on a weekday evening. The soup chapter grew '
  + 'far longer than anyone expected once we added the variations that each grandparent insisted on. '
  + 'Photographs were the hardest part, since the kitchen window faces north and the light turns grey '
  + 'by the middle of the afternoon in that season. '
  // 여기서부터가 근거 구간(rest)이다.
  + 'The onboarding notes mention a single metric that nobody looks at. '
  + 'We build and test every change with CI and CD so the debug loop stays short. ' // 1위: 앵커 5개
  + 'The logs, trace output and metrics land in an artifact bundle. ' // 2위: 앵커 4개, 1위 바로 뒤
  + 'Dinner was late again that evening because the oven ran cold. '
  // 1위 문단과 3위 문단을 떼어 놓는 중립 구간(500자 이상).
  + 'The bread chapter came together on a rainy Saturday when nobody wanted to leave the house. '
  + 'We measured every flour by weight rather than by cup so the numbers would mean the same thing in '
  + 'another kitchen. A neighbour lent us a scale that reads to one gram and we kept it on the counter '
  + 'for a month. Someone suggested we print the whole thing on heavy paper so it would survive the '
  + 'steam from the stove. The cover took three evenings of arguing about colour before we gave up and '
  + 'chose plain linen. Nobody has opened the drawer since. '
  + 'Every incident needs verification before we verify the rollback. ' // 3위: 앵커 3개
  + 'The last chapter is a list of the pots we still want to buy someday. ';

async function resolveWithAdjacentTopSentences(over = {}) {
  const slug = 'adjacent-anchor-sentences';
  const indexHtml = oneCardHtml({ slug, dateText: 'Aug 18, 2026', title: 'Adjacent anchors' });
  const articleHtml = minimalArticleHtml({
    canonical: `${ORIGIN}${PATH_PREFIX}/${slug}`,
    headerDateText: 'Aug 18, 2026',
    title: 'Adjacent anchors',
    bodyHtml: `<p>${ADJACENT_ANCHOR_BODY}</p>`
  });
  const items = await runResolver({
    html: indexHtml,
    fetchClient: makeClient({ indexHtml, defaultArticleHtml: articleHtml }),
    over
  });
  assert.equal(items.length, 1, 'expected exactly one resolved item from the adjacent-top-sentence body');
  return items[0];
}

// 섹션 텍스트를 resolver와 같은 문장 경계(마침표·불릿 + 공백)로 자른다.
function sectionSentences(value) {
  return String(value || '').split(/(?<=[.•])\s+/).map(part => part.trim()).filter(Boolean);
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

  // resolver 자신의 MAX_WORKFLOW_SECTIONS(:36)는 article-capsules.js의 MAX_WORKFLOW_SECTIONS와
  // 반드시 같은 값이어야 한다(주석이 그렇게 요구한다) — resolver 쪽만 올리면 여기서 만든
  // source_extraction.workflow.sections가 먼저 늘어나고, capsule 쪽 slice가 그 초과분을
  // 조용히 잘라내 capsule.evidence 관찰만으로는 절대 드러나지 않는다. 그래서 capsule 이전,
  // resolver가 실제로 만든 섹션 개수를 여기서 직접 잰다.
  assert.equal(item.source_extraction.workflow.sections.length, 2,
    'resolver의 MAX_WORKFLOW_SECTIONS가 article-capsules.js와 어긋나면(예: 5로 올라가면) ' +
    'capsule의 자체 slice가 초과분을 조용히 가려 이 어긋남을 아래 capsule 단언만으로는 못 잡는다');

  // 이 케이스는 "페이지가 날짜를 직접 준" 주경로다(list-row 폴백이 아니다) — list-row 폴백은
  // 아래 'falls back to the list-row date only...' test가 이미 잠갔지만, 주경로의 provenance
  // 네 필드는 어디서도 재지 않았다. dateSource를 'release_row_date'로, dateEvidenceUrl을
  // parentUrl로 바꿔치기해도(주경로가 목록-폴백 경로로 조용히 퇴화해도) 이 test는 통과했다.
  assert.equal(item.publishedAt, '2026-08-18');
  assert.equal(item.date_source, 'structured_date_published');
  assert.equal(item.date_confidence, 95);
  assert.equal(item.date_evidence_url, 'https://claude.com/blog/ai-ci-cd-on-call');

  const normalized = normalizeCandidate(item);
  assert.match(normalized.behavior_change, /requires approval to merge/i);

  const capsule = buildArticleCapsule(normalized, []);
  assert.ok(capsule.evidence.length <= 3, 'capsule은 evidence를 3개로 자른다(MAX_EVIDENCE_ITEMS=3)');
  assert.ok(
    capsule.evidence.some(line => /^behavior_change: /.test(line) && /requires approval to merge/i.test(line)),
    'version_or_release/api_or_component가 앞 두 칸을 차지해도 앵커 문장이 3칸 안에 남아야 한다'
  );
});

test('does not put the same paragraph into two workflow evidence sections', async () => {
  const item = await resolveWithAdjacentTopSentences();
  const sections = item.source_extraction.workflow.sections;

  assert.equal(sections.length, 2,
    '겹치는 2위 문장을 건너뛴 뒤 그 자리를 다음 순위 문장이 채워야 한다 — 상위 MAX_WORKFLOW_SECTIONS개만 ' +
    '시도하고 끝내면 건너뛴 만큼 섹션이 그냥 비어 근거가 1건으로 줄어든다');

  const first = sections[0].items[0].text;
  const second = sections[1].items[0].text;

  assert.ok(!first.includes(second) && !second.includes(first),
    '한쪽이 다른 쪽을 통째로 담으면 근거 2건이 아니라 문단 1건이다');

  const firstSentences = sectionSentences(first);
  const shared = sectionSentences(second).filter(sentence => firstSentences.includes(sentence));
  assert.deepEqual(shared, [],
    '두 섹션이 같은 문장을 나눠 가지면 캡슐을 읽는 LLM에게 독립 근거가 둘 있는 것처럼 보이고, ' +
    '중복 텍스트가 WORKFLOW_EVIDENCE_BUDGET을 먹어 다른 구간의 근거가 못 들어온다');

  // behavior_change와 섹션의 중복은 그대로 두기로 한 결정(workflowEvidence 주석)을 여기서 잠근다.
  // 1위 문장을 섹션에서 빼는 변경은 이 두 단언에서 걸린다.
  assert.match(item.behavior_change, /debug loop stays short/,
    '앵커 밀도가 가장 높은 문장이 behavior_change가 돼야 한다');
  assert.ok(first.includes(item.behavior_change),
    'behavior_change 문장은 첫 섹션 문단에도 그대로 들어간다 — 두 값은 캡슐의 서로 다른 필드' +
    '(evidence 줄 vs source_extraction.workflow.sections)로 가므로 독립 근거 2건으로 세어지지 않는다');
});

test('api_or_component carries the measured token, not the source registry constant', async () => {
  const item = await firstResolvedItem();
  // 이 픽스처 본문에는 KNOWN_COMPONENT_PATTERN의 여섯 토큰 중 "Claude Code"가 가장 먼저
  // 나온다(hero detail의 Category 목록 세 번째 항목) — GitHub/PagerDuty/Grafana/Kubernetes는
  // 본문 훨씬 뒤 Triage 문단에서야 나온다. by-value로 잰다 — truthy만 재면 이 값이 여전히
  // 레지스트리 상수(과거 componentLabel)로 새는지 구분할 수 없다.
  assert.equal(item.api_or_component, 'Claude Code',
    '본문에서 실제로 매치된 첫 토큰이어야 한다');
});

test('leaves api_or_component empty when the body has no known component token, and the evidence gate reflects it', async () => {
  const item = await resolveWithoutComponentEvidence();
  assert.equal(item.api_or_component, '',
    '본문에 KNOWN_COMPONENT_PATTERN 토큰이 없으면 레지스트리 상수로 메우지 않고 빈 채로 둬야 한다 — ' +
    '이 assert가 과거 componentLabel 폴백이 무력화하던 바로 그 자리다');

  const normalized = normalizeCandidate(item);
  assert.equal(normalized.has_api_or_component, false,
    'componentLabel로 메웠다면 증거가 없어도 has_api_or_component가 참으로 나왔을 것이다');
  assert.equal(normalized.source_gap_risk, true,
    'collect-news-candidates.js의 datedItemMissingEvidence가 이미 !hasApiOrComponent를 OR로 물고 있어 ' +
    'source_gap_risk가 참이 돼야 한다 — 새 코드 없이 기존 배선만으로 따라와야 한다');
  assert.ok(normalized.evidence_score < 6,
    `evidence_score(${normalized.evidence_score})가 6점 게이트 미만이어야 한다 — componentLabel 폴백이 ` +
    '있던 과거엔 이 소스의 모든 후보가 (발행일 2 + api_or_component 2 + behavior_change 2)로 ' +
    '구조적으로 게이트를 통과했다');
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
    onDiagnostic: event => seen.push(event)
  });
  assert.deepEqual(items, []);
  const failures = seen.filter(event => event.kind === 'index_collection_failed');
  assert.equal(failures.length, 1,
    'fetchClient가 없다는 이유로 조용히 빈 배열만 돌려주면 배선 실수가 진단 없이 사라진다');
  // 이 kind는 세 갈래(client 없음 / sourceUrl 파생 실패 / 마크업)가 공유한다. 운영자가
  // `## Collector 실패` 절에서 보는 건 detail 문구뿐이라, 그게 갈래를 가리키는 유일한 신호다.
  assert.match(failures[0].detail, /fetchClient/,
    'detail이 갈래를 안 가리키면 세 원인이 같은 진단 한 줄로 뭉개진다');
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
  // 이 시나리오는 요청 상한(article 자체가 MAX_BYTES_PER_ARTICLE보다 큼)에 걸린 것이지
  // 소스런 예산(remainingBytes())이 바닥난 게 아니다 — remainingBytes() <= 0 조건을 지우면
  // 이 발화 방향(skipped_article_budget)은 그대로 통과하면서 recent_window_budget_exhausted가
  // 거짓으로 함께 찍힌다.
  assert.ok(seen.every(event => event.kind !== 'recent_window_budget_exhausted'),
    '소스런 예산은 남아 있다 — 요청 상한에 걸렸다고 소스런 예산 소진까지 찍히면 안 된다');
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
  // /\d+/만 재면 건수를 0으로 하드코딩해도(0도 숫자다) 통과한다. 이 시나리오는 최근 7일
  // 기사 3건 중 1건만 예산 안에서 받고 나머지 2건이 남는다 — 실제 건수(2)를 값으로 잰다.
  const detailMatch = /^(\d+) recent-window article\(s\) skipped/.exec(exhausted.detail);
  assert.ok(detailMatch, `detail 형식이 예상과 다르다: ${exhausted.detail}`);
  assert.equal(Number(detailMatch[1]), 2,
    '예산 소진으로 남은 recent-window 기사 수는 2건이어야 한다(3건 중 1건만 온전히 받는다)');
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

// ---- registry(news-sources.json)에서 목록 주소를 파생한다 ----

// 목록 origin·경로가 이 resolver 바깥(followed-source 레지스트리)에 상수로 또 적혀 있으면,
// registry의 sourceUrl만 바꿨을 때 인덱스는 새 주소로 받고 카드 매칭과 기사 URL 조립은 옛
// 경로로 돈다. 결과는 카드 0건 -> index_collection_failed인데, 진단이 가리키는 원인
// ("마크업이 바뀌었다")과 실제 원인("registry와 코드가 갈라졌다")이 다르다.
// 아래 세 케이스는 전부 registry 상수(https://claude.com + /blog)와 겹치지 않는 주소다 —
// 하드코딩으로 되돌리면 origin·경로가 모두 어긋나 카드 매칭부터 깨진다.
function derivedIndexHtml(pathPrefix, slug, dateText) {
  return `<div role="listitem" class="blog_cms_item w-dyn-item">`
    + `<div class="u-text-style-caption">${dateText}</div>`
    + `<a href="${pathPrefix}/${slug}">Derived title</a>`
    + `</div>`;
}

for (const derivationCase of [
  {
    label: 'a two-segment path',
    sourceUrl: 'https://example.test/x/y',
    pathPrefix: '/x/y',
    parentUrl: 'https://example.test/x/y'
  },
  {
    label: 'a subdomain and an explicit port',
    sourceUrl: 'https://news.example.test:8443/a/b',
    pathPrefix: '/a/b',
    parentUrl: 'https://news.example.test:8443/a/b'
  },
  {
    // 후행 슬래시를 그대로 pathPrefix로 쓰면 링크 패턴이 `href="/blog//slug"`가 돼 카드가 0건이
    // 되고, 기사 URL도 슬래시가 겹친다.
    label: 'a trailing slash',
    sourceUrl: 'https://example.test/blog/',
    pathPrefix: '/blog',
    parentUrl: 'https://example.test/blog'
  },
  {
    // 슬래시를 하나만 지우면 오타 하나('/blog//')가 validate:config를 통과한 채 카드 0건으로
    // 닫히고, 진단은 이 PR이 없애려던 바로 그 오해("markup이 깨졌다")를 다시 가리킨다.
    label: 'repeated trailing slashes',
    sourceUrl: 'https://example.test/blog//',
    pathPrefix: '/blog',
    parentUrl: 'https://example.test/blog'
  }
]) {
  test(`derives the index origin and path from source.sourceUrl with ${derivationCase.label}`, async () => {
    const slug = 'derived-index-post';
    const articleUrl = `${derivationCase.parentUrl}/${slug}`;
    const indexHtml = derivedIndexHtml(derivationCase.pathPrefix, slug, 'Aug 20, 2026');
    const articleHtml = minimalArticleHtml({ canonical: articleUrl, headerDateText: 'Aug 20, 2026' });
    const fetched = [];

    const items = await resolveDatedArticleIndexItems({
      html: indexHtml,
      source: { id: 'claude-blog', name: 'Claude Blog', sourceUrl: derivationCase.sourceUrl },
      fetchClient: withOnFetch(
        makeClient({ indexHtml, defaultArticleHtml: articleHtml }),
        url => fetched.push(url)
      ),
      now: new Date('2026-08-22T00:00:00Z'),
      lookbackDays: 21
    });

    assert.deepEqual(fetched, [articleUrl],
      'fetch 대상이 registry sourceUrl에서 파생되지 않으면 하드코딩된 origin으로 나간다');
    assert.equal(items.length, 1, '카드 매칭이 파생 pathPrefix를 따라가야 후보가 나온다');
    assert.equal(items[0].url, articleUrl);
    assert.equal(items[0].parentUrl, derivationCase.parentUrl);
  });
}

test('closes loudly when the registry sourceUrl is missing instead of silently scanning /blog', async () => {
  // sourceUrl이 없으면 파생할 근거가 없다. `config.pathPrefix || '/blog'` 같은 기본값이 남아
  // 있으면 이 호출은 조용히 /blog를 훑어 엉뚱한 상대 URL로 fetch를 시도하고, 그 실패는
  // canonical_mismatch 같은 다른 사유로 기록돼 진단이 실제 원인을 못 가리킨다.
  const seen = [];
  const fetched = [];
  const items = await resolveDatedArticleIndexItems({
    html: INDEX_HTML,
    source: { id: 'claude-blog', name: 'Claude Blog' },
    fetchClient: withOnFetch(makeClient(), url => fetched.push(url)),
    now: DEFAULT_NOW,
    lookbackDays: 21,
    onDiagnostic: event => seen.push(event)
  });

  assert.deepEqual(items, []);
  assert.deepEqual(fetched, [], 'sourceUrl이 없는데도 fetch가 나갔다면 기본 경로로 조용히 돌았다는 뜻이다');
  const failures = seen.filter(event => event.kind === 'index_collection_failed');
  assert.equal(failures.length, 1,
    '기존 진단 어휘(index_collection_failed)로 명시적으로 닫아야 한다');
  // kind만 맞고 detail이 fetchClient 갈래 문구면, 운영자는 배선을 뒤지느라 진짜 원인
  // (registry에 절대 sourceUrl이 없다)에 못 닿는다 — 이 커밋의 유일한 정당화가 그것이다.
  assert.match(failures[0].detail, /sourceUrl/,
    'detail이 registry sourceUrl을 가리켜야 진단이 실제 원인을 가리킨다');
});
