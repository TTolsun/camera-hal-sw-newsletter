const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FOLLOWED_SOURCE_RESOLVERS,
  followedSourceResolverIds,
  resolveFollowedSourceItems,
  shouldSuppressGenericFallback
} = require('../../../collect/followed-source-item-resolvers');
const { createBoundedFetchClient } = require('../../../collect/bounded-fetch-client');
const { normalizeEnabledSources } = require('../../../collect/news-source-section-resolver');
const { readTextFixture } = require('../../helpers/fixture-loader');

// 보안 게시판 리졸버는 indexItems(첫 인자)에서 최신 게시판 URL을 골라 fetch하고,
// libcamera 리졸버는 text(첫 인자, 인덱스 HTML)에서 월 아카이브 디렉터리를 뽑아 fetch한다.
// 그래서 디스패치가 각 리졸버에 맞는 첫 인자를 넘겼는지 fetch된 URL로 관찰할 수 있다.
const SECURITY_JUNE_URL = 'https://source.android.com/docs/security/bulletin/2026/2026-06-01';
const LIBCAMERA_INDEX_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/';
const LIBCAMERA_MAY_LISTING_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/date.html';
const LIBCAMERA_MESSAGE_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/000123.html';

function securityIndexItems() {
  return [
    { url: SECURITY_JUNE_URL, publishedAt: '2026-06-01', title: 'June 2026', sourceKind: 'release_note_item' }
  ];
}

test('registers exactly the known followed-source resolver ids', () => {
  assert.deepEqual(
    followedSourceResolverIds().sort(),
    [
      'android-security-bulletin',
      'anthropic-news',
      'aosp-gerrit-camera-changes',
      'aosp-release-camera-changes',
      'chromeos-gerrit-camera-changes',
      'claude-blog',
      'libcamera-release-announcements',
      'mediatek-security-bulletin',
      'patchwork-libcamera-patches',
      'raspberrypi-libcamera-releases'
    ]
  );
  assert.equal(FOLLOWED_SOURCE_RESOLVERS.length, 10);
});

test('routes raspberrypi-libcamera-releases to the release resolver with text (atom) as the first arg', async () => {
  const atom = [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry><updated>2026-06-09T07:36:01Z</updated>',
    '<link rel="alternate" href="https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609"/>',
    '<title>v0.7.1+rpt20260609</title></entry>',
    '<entry><updated>2026-05-22T10:41:17Z</updated>',
    '<link rel="alternate" href="https://github.com/raspberrypi/libcamera/releases/tag/pios%2F0.7.1"/>',
    '<title>pios/0.7.1+rpt20260429-1</title></entry>',
    '</feed>'
  ].join('');
  let fetchCount = 0;
  const items = await resolveFollowedSourceItems(
    { id: 'raspberrypi-libcamera-releases', name: 'Raspberry Pi libcamera Releases', url: 'https://github.com/raspberrypi/libcamera/releases' },
    { indexItems: [], text: atom, fetchTextImpl: async () => { fetchCount += 1; return ''; } }
  );

  // 리졸버는 text(atom)만 파싱하고 추가 fetch는 하지 않는다.
  assert.equal(fetchCount, 0);
  assert.equal(items.length, 1, 'only the v* release survives, packaging tag dropped');
  assert.equal(items[0].version_or_release, 'v0.7.1+rpt20260609');
  assert.equal(items[0].relevanceBucketHint, 'camera_driver_image_pipeline');
});

const PATCHWORK_LIST_API = 'https://patchwork.libcamera.org/api/patches/?order=-date&per_page=250&format=json';

function patchworkSource() {
  return {
    id: 'patchwork-libcamera-patches',
    name: 'libcamera Patchwork (patch review)',
    url: PATCHWORK_LIST_API,
    sourceUrl: PATCHWORK_LIST_API
  };
}

test('routes patchwork-libcamera-patches to the patch resolver with text (JSON) as the first arg', async () => {
  const json = JSON.stringify([
    {
      web_url: 'https://patchwork.libcamera.org/patch/27198/',
      date: '2026-07-03T22:48:16',
      name: '[v2,1/2] libcamera: Add SensorSequence metadata control',
      state: 'new'
    }
  ]);
  const fetched = [];
  const items = await resolveFollowedSourceItems(
    patchworkSource(),
    {
      indexItems: [],
      text: json,
      fetchTextImpl: async (url) => { fetched.push(url); return '[]'; },
      now: new Date('2026-07-06T00:00:00Z'),
      lookbackDays: 35
    }
  );

  // text(JSON)가 첫 인자로 전달돼야 patch가 후보로 나온다.
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceKind, 'rss_item');
  assert.equal(items[0].publishedAt, '2026-07-03');
  // 창 안 페이지 다음은 등록부 sourceUrl에서 파생한 page=2를 조회한다 — fetchTextImpl 배선 확인(#970).
  assert.deepEqual(fetched, [`${PATCHWORK_LIST_API}&page=2`]);
});

test('passes the collection window to patchwork so paging stops at the lookback edge (#970)', async () => {
  // 창(now/lookbackDays)이 리졸버까지 안 오면 첫 페이지가 이미 창 밖인데도 계속 페이지를 판다.
  const json = JSON.stringify([
    {
      web_url: 'https://patchwork.libcamera.org/patch/27198/',
      date: '2026-07-03T22:48:16',
      name: '[v2,1/2] libcamera: Add SensorSequence metadata control',
      state: 'new'
    }
  ]);
  const fetched = [];
  const items = await resolveFollowedSourceItems(
    patchworkSource(),
    {
      indexItems: [],
      text: json,
      fetchTextImpl: async (url) => { fetched.push(url); return '[]'; },
      now: new Date('2026-09-01T00:00:00Z'),
      lookbackDays: 35
    }
  );

  assert.equal(items.length, 1, 'the first page is still parsed');
  assert.deepEqual(fetched, [], 'a first page already past the lookback edge ends the walk');
});

test('routes aosp-release-camera-changes to the release resolver with text (build-numbers HTML) as the first arg', async () => {
  // 리졸버는 릴리스가 수집 창 안일 때만 git을 조회한다. 디스패치를 관찰하려면 릴리스가 신선해야
  // 하므로 실행 시점의 오늘 날짜를 표에 넣는다(고정 날짜를 쓰면 시간이 지나 조회가 사라져
  // 라우팅이 깨져도 통과하는 테스트가 된다).
  const today = new Date().toISOString().slice(0, 10);
  const html = '<table><tbody>'
    + `<tr><td>CP2A.260605.016</td><td>android-17.0.0_r1</td><td>Android17</td><td></td><td>${today}</td></tr>`
    + '<tr><td>BP4A.251205.006</td><td>android-16.0.0_r4</td><td>Android16</td><td></td><td>2025-12-05</td></tr>'
    + '</tbody></table>';
  const fetched = [];
  const items = await resolveFollowedSourceItems(
    { id: 'aosp-release-camera-changes', name: 'AOSP Release Source Drop (camera changes)' },
    {
      indexItems: [],
      text: html,
      fetchTextImpl: async (url) => {
        fetched.push(url);
        return ')]}\'\n{"log":[]}';
      }
    }
  );

  // text(build-numbers HTML)가 첫 인자로 전달돼야 릴리스 태그를 뽑아 gitiles 범위를 조회한다.
  assert.ok(fetched.length > 0, 'dispatched to the release resolver with the build-numbers HTML');
  for (const url of fetched) {
    assert.match(url, /\+log\/android-16\.0\.0_r4\.\.android-17\.0\.0_r1\?format=JSON/);
  }
  assert.deepEqual(items, [], 'no camera commits in the stubbed delta');
});

test('shouldSuppressGenericFallback is true for followed-resolver, reference-only, and explicitly marked sources', () => {
  assert.equal(shouldSuppressGenericFallback({ id: 'libcamera-release-announcements' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'android-security-bulletin' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'raspberrypi-libcamera-releases' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'patchwork-libcamera-patches' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'claude-blog' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'anthropic-news' }), true);

  // 설정상 참고 자료인 소스. 분류기가 이 둘을 main article에서 하드 제외하므로
  // (collect-news-candidates.js의 referenceIndex, source-quality-classifier.js의
  // reference_only blocker) 제너릭 폴백이 만드는 날짜 없는 페이지 제목 후보는 쓸 곳이 없다.
  assert.equal(shouldSuppressGenericFallback({
    id: 'aosp-camera-documentation',
    sourceRole: 'official_documentation_reference',
    mainArticlePolicy: 'reference_only'
  }), true);
  // 두 필드는 각각 단독으로도 "참고 자료"라는 뜻이다.
  assert.equal(shouldSuppressGenericFallback({
    id: 'documentation-role-only',
    sourceRole: 'official_documentation_reference',
    mainArticlePolicy: 'allowed'
  }), true);
  assert.equal(shouldSuppressGenericFallback({
    id: 'reference-policy-only',
    sourceRole: 'official_release_source',
    mainArticlePolicy: 'reference_only'
  }), true);

  // 역할 표기는 그대로 두고 등록부 표식으로만 폴백을 끈 소스. dated 릴리스 소스를
  // 참고자료로 재분류하는 우회는 사실과 다르므로 채택하지 않았다(#880).
  assert.equal(shouldSuppressGenericFallback({
    id: 'samsung-mobile-security-updates',
    sourceRole: 'official_release_source',
    mainArticlePolicy: 'allowed',
    suppressGenericCandidateFallback: true
  }), true);

  // 참고 자료가 아니고 표식도 없는 소스는 그대로 제너릭 폴백을 쓴다.
  assert.equal(shouldSuppressGenericFallback({
    id: 'lore-linux-media-list',
    sourceRole: 'project_mailing_list_source',
    mainArticlePolicy: 'allowed'
  }), false);
  assert.equal(shouldSuppressGenericFallback({
    id: 'libcamera-blog',
    sourceRole: 'official_release_source',
    mainArticlePolicy: 'allowed'
  }), false);
  assert.equal(shouldSuppressGenericFallback({
    id: 'libcamera-blog',
    sourceRole: 'official_release_source',
    mainArticlePolicy: 'allowed',
    suppressGenericCandidateFallback: false
  }), false);
  assert.equal(shouldSuppressGenericFallback({ id: 'libcamera-blog' }), false);
  assert.equal(shouldSuppressGenericFallback(null), false);
});

test('every registry entry the collector must not generically scrape suppresses the page-title fallback', () => {
  // collector가 술어에 넘기는 것은 raw JSON 항목이 아니라 normalizeEnabledSources를 지난
  // 런타임 source 객체다(news-source-section-resolver.js가 sourceRole/mainArticlePolicy/
  // suppressGenericCandidateFallback을 여기 싣는다). 그 정규화 홉까지 덮어야 registry-술어
  // 배선이 실제로 검증된다 — normalizeSourceEntry가 새 필드를 안 실으면 아래 id 단언이 깨진다.
  const registry = require('../../../data/news-sources.json');
  const { sources } = normalizeEnabledSources(registry);
  const suppressedSources = sources.filter(source =>
    source.sourceRole === 'official_documentation_reference'
    || source.mainArticlePolicy === 'reference_only'
    || source.suppressGenericCandidateFallback === true);

  assert.ok(suppressedSources.length > 0, 'registry has entries that must skip the generic fallback');
  for (const source of suppressedSources) {
    assert.equal(
      shouldSuppressGenericFallback(source),
      true,
      `${source.id} must not fall back to the generic page scrape`
    );

    // 표시들은 서로의 보험이다. 하나가 드리프트해도 억제는 유지돼야 하므로, 각 항목이 실제로
    // 가진 표시 하나만 남겨서도 확인한다. 술어에서 어느 한 절이 빠지면 여기서 잡힌다 —
    // 위 한 줄만으로는 참고 소스가 두 필드를 다 갖고 있어 절 삭제를 놓친다.
    if (source.sourceRole === 'official_documentation_reference') {
      assert.equal(
        shouldSuppressGenericFallback({ id: source.id, sourceRole: source.sourceRole }),
        true,
        `${source.id} must stay suppressed on sourceRole alone`
      );
    }
    if (source.mainArticlePolicy === 'reference_only') {
      assert.equal(
        shouldSuppressGenericFallback({ id: source.id, mainArticlePolicy: source.mainArticlePolicy }),
        true,
        `${source.id} must stay suppressed on mainArticlePolicy alone`
      );
    }
    if (source.suppressGenericCandidateFallback === true) {
      assert.equal(
        shouldSuppressGenericFallback({ id: source.id, suppressGenericCandidateFallback: true }),
        true,
        `${source.id} must stay suppressed on the registry marker alone`
      );
    }
  }

  const ids = suppressedSources.map(source => source.id);

  // 이슈 #880이 "매주 날짜 없는 페이지 제목만 만든다"고 지목한 소스가 실제로 이 집합에 있어야 한다.
  for (const id of [
    'aosp-camera-documentation',
    'android-compatibility-definition-document',
    'android-developer-newsletter',
    'aosp-whats-new-release-notes'
  ]) {
    assert.ok(ids.includes(id), `${id} must be registered as a reference source`);
  }

  // samsung은 위 네 소스와 달리 역할 표기가 official_release_source 그대로다. 등록부 표식이
  // 지워지거나 normalizeSourceEntry가 그 표식을 안 실으면 이 소스만 집합에서 빠진다.
  assert.ok(
    ids.includes('samsung-mobile-security-updates'),
    'samsung-mobile-security-updates must carry suppressGenericCandidateFallback through normalizeEnabledSources'
  );
  const samsung = sources.find(source => source.id === 'samsung-mobile-security-updates');
  assert.equal(
    samsung.sourceRole,
    'official_release_source',
    '역할 표기를 참고자료로 바꾸는 우회를 쓰지 않았음을 고정한다'
  );
  assert.equal(samsung.mainArticlePolicy, 'allowed');
});

test('routes android-security-bulletin to the CVE resolver with indexItems as the first arg', async () => {
  const monthly = readTextFixture('source-html/android-security-bulletin-2026-06.html');
  const fetched = [];
  const fetchTextImpl = async (url) => {
    fetched.push(url);
    if (url === SECURITY_JUNE_URL) return monthly;
    throw new Error(`unexpected fetch: ${url}`);
  };

  const items = await resolveFollowedSourceItems(
    { id: 'android-security-bulletin', name: 'Android Security Bulletin' },
    { indexItems: securityIndexItems(), text: 'IGNORED INDEX HTML', fetchTextImpl }
  );

  // indexItems가 첫 인자로 전달돼야 게시판 URL을 골라 fetch한다(text는 보안 리졸버가 무시).
  assert.deepEqual(fetched, [SECURITY_JUNE_URL]);
  assert.ok(items.length > 0, 'CVE candidates emitted');
  for (const item of items) {
    assert.equal(item.sourceKind, 'release_note_item');
    assert.match(item.api_or_component, /Android Security Bulletin/);
  }
});

// 형제 리졸버(android-security-bulletin)는 indexItems를, mediatek은 text(인덱스 HTML)를
// 첫 인자로 받는다. 배선이 바뀌면 예외 없이 후보 0건이 되어 소스가 조용히 사라지므로
// "어느 URL을 fetch했는가"로 배선을 관찰해 고정한다.
test('routes mediatek-security-bulletin to the CVE resolver with text (index HTML) as the first arg', async () => {
  // 리졸버가 로케일 파라미터(?hsLang=en)를 떼고 fetch한다.
  const MEDIATEK_AUGUST_URL = 'https://www.mediatek.com/product-security-bulletin/august-2026';
  const monthly = readTextFixture('source-html/mediatek-security-bulletin-2026-08.html');
  const fetched = [];
  const fetchTextImpl = async (url) => {
    fetched.push(url);
    if (url === MEDIATEK_AUGUST_URL) return monthly;
    throw new Error(`unexpected fetch: ${url}`);
  };

  const items = await resolveFollowedSourceItems(
    {
      id: 'mediatek-security-bulletin',
      name: 'MediaTek Security Bulletin',
      sourceUrl: 'https://www.mediatek.com/product-security-bulletin'
    },
    {
      indexItems: [{ url: 'https://example.com/IGNORED', publishedAt: '2026-08-01', title: 'IGNORED' }],
      text: readTextFixture('source-html/mediatek-security-bulletin-index.html'),
      fetchTextImpl
    }
  );

  assert.deepEqual(fetched, [MEDIATEK_AUGUST_URL]);
  assert.ok(items.length > 0, 'camera CVE candidates emitted');
  for (const item of items) {
    assert.equal(item.sourceKind, 'release_note_item');
    assert.match(item.api_or_component, /MediaTek Security Bulletin/);
  }
});

test('routes libcamera-release-announcements to the release resolver with text as the first arg', async () => {
  const index = readTextFixture('source-html/libcamera-pipermail-index.html');
  const may = readTextFixture('source-html/libcamera-pipermail-2026-may.html');
  const message = readTextFixture('source-html/libcamera-release-v0.8.0.html');
  const fetched = [];
  const fetchTextImpl = async (url) => {
    fetched.push(url);
    if (url === LIBCAMERA_MAY_LISTING_URL) return may;
    if (url === LIBCAMERA_MESSAGE_URL) return message;
    throw new Error(`unexpected fetch: ${url}`);
  };

  const items = await resolveFollowedSourceItems(
    { id: 'libcamera-release-announcements', name: 'libcamera Release Announcements', url: LIBCAMERA_INDEX_URL, sourceUrl: LIBCAMERA_INDEX_URL },
    // indexItems는 비워두고 text(인덱스 HTML)만 넘긴다 -> 월 아카이브를 따라가야 한다.
    { indexItems: [], text: index, fetchTextImpl }
  );

  // text가 첫 인자로 전달돼야 월 디렉터리를 뽑아 아카이브를 fetch한다.
  assert.ok(fetched.includes(LIBCAMERA_MAY_LISTING_URL), 'followed the month archive derived from text');
  assert.equal(items.length, 1);
  assert.equal(items[0].version_or_release, 'libcamera v0.8.0');
});

// 레지스트리는 항목마다 컨텍스트를 손으로 풀어 넘기고 지금 now/lookbackDays를 넘기는 건
// aosp-release-camera-changes 하나뿐이었다. 새 항목이 이 전달을 빠뜨리면 예외 없이 resolver가
// new Date()로 떨어져 catch-up run에서 조용히 창이 어긋난다.
test('forwards now and lookbackDays to the claude-blog resolver', async () => {
  const claudeBlog = { id: 'claude-blog', name: 'Claude Blog', url: 'https://claude.com/blog', sourceUrl: 'https://claude.com/blog' };
  // 새 resolver는 fetchTextImpl이 아니라 fetchClient를 받는다(Task 3의 bounded client).
  // 고정 응답을 주는 fetchImpl로 client를 만들어 넘긴다.
  function stubClient(html) {
    return createBoundedFetchClient({
      fetchImpl: async () => new Response(html, { status: 200 })
    });
  }
  const context = {
    indexItems: [],
    text: readTextFixture('source-html/claude-blog-index-cards.html')
  };
  const article = readTextFixture('source-html/claude-blog-ai-ci-cd-on-call.html');

  const inWindow = await resolveFollowedSourceItems(claudeBlog, {
    ...context, fetchClient: stubClient(article), now: new Date('2026-08-22T00:00:00Z'), lookbackDays: 21
  });
  const outOfWindow = await resolveFollowedSourceItems(claudeBlog, {
    ...context, fetchClient: stubClient(article), now: new Date('2027-08-22T00:00:00Z'), lookbackDays: 21
  });

  assert.ok(inWindow.length > 0, '창 안이면 후보가 나온다');
  assert.deepEqual(outOfWindow, [], 'now/lookbackDays를 안 넘기면 이 단언이 깨진다 — 레지스트리 항목 배선 누락을 잡는다');
});

// onArticleCapCounts는 onDiagnostic·now·lookbackDays와 같은 방식으로 레지스트리가 손으로
// 풀어 넘긴다. 항목 하나가 이 전달을 빠뜨리면 예외 없이 콜백이 그냥 안 불려서, 그 소스의
// article_cap_counts_by_source가 조용히 통째로 빠진다 — 그래서 claude-blog·anthropic-news
// 둘 다 직접 잰다.
function datedArticleCardHtml({ pathPrefix, slug, dateText }) {
  return `<div role="listitem" class="blog_cms_item w-dyn-item">`
    + `<div class="u-text-style-caption">${dateText}</div>`
    + `<a href="${pathPrefix}/${slug}">Title ${slug}</a>`
    + `</div>`;
}

for (const registryCase of [
  { id: 'claude-blog', name: 'Claude Blog', pathPrefix: '/blog', origin: 'https://claude.com' },
  { id: 'anthropic-news', name: 'Anthropic News', pathPrefix: '/news', origin: 'https://www.anthropic.com' }
]) {
  test(`forwards onArticleCapCounts to the ${registryCase.id} resolver`, async () => {
    const now = new Date('2026-08-22T00:00:00Z');
    // MAX_ARTICLES_PER_RUN(8)보다 많은 10건을 모두 창 안(최근 2일)에 둔다 — 상한이 실제로
    // 걸려야 in_window_card_count(10) != scheduled_article_count(8)가 성립한다.
    const cards = Array.from({ length: 10 }, (_, index) =>
      datedArticleCardHtml({ pathPrefix: registryCase.pathPrefix, slug: `article-${index}`, dateText: 'Aug 20, 2026' }));
    const indexHtml = cards.join('');
    const fetchClient = createBoundedFetchClient({
      // 개별 기사 fetch 결과는 상관없다 — 카운터는 fetch 루프 이전에 이미 계산·통보된다.
      fetchImpl: async () => new Response('<h1>Placeholder</h1><p>No workflow anchors here.</p>', { status: 200 })
    });

    const seenCounts = [];
    await resolveFollowedSourceItems(
      { id: registryCase.id, name: registryCase.name, url: `${registryCase.origin}${registryCase.pathPrefix}`, sourceUrl: `${registryCase.origin}${registryCase.pathPrefix}` },
      {
        indexItems: [],
        text: indexHtml,
        fetchClient,
        now,
        lookbackDays: 21,
        onArticleCapCounts: counts => seenCounts.push(counts)
      }
    );

    assert.equal(seenCounts.length, 1,
      '레지스트리 항목이 onArticleCapCounts를 풀어 넘기지 않으면 콜백이 아예 안 불려 이 단언이 깨진다');
    assert.deepEqual(seenCounts[0], {
      in_window_card_count: 10,
      scheduled_article_count: 8,
      skipped_article_cap_count: 2
    });
  });
}

// 목록 origin·경로의 정본은 registry(news-sources.json)의 sourceUrl 하나다. 이 표가 그 값을
// 상수로 또 들고 있으면(항목의 config든 source 재작성이든) registry의 URL만 바꿨을 때 인덱스는
// 새 주소로 받고 카드 매칭·기사 URL 조립은 옛 경로로 돈다.
// resolver를 직접 부르는 테스트로는 이 표를 안 지나가서 그 재하드코딩을 못 잡는다. 그래서
// 여기서는 반드시 표(FOLLOWED_SOURCE_RESOLVERS)를 통과시키고, registry 운영값
// (claude.com/blog, www.anthropic.com/news)과 한 글자도 안 겹치는 stub sourceUrl로 구동한다 —
// 표에 상수가 되살아나면 fetch 대상부터 그 stub에서 벗어나 아래 단언이 깨진다.
function derivedArticleHtml(articleUrl, dateText) {
  return `<link href="${articleUrl}" rel="canonical"/>`
    + `<h1>Registry derived article</h1><div>${dateText}</div>`
    + `<h2>Body</h2><p>Body text without any workflow anchor words.</p>`;
}

for (const registryCase of [
  { id: 'claude-blog', name: 'Claude Blog', sourceUrl: 'https://claude.test/blog-v2', pathPrefix: '/blog-v2' },
  { id: 'anthropic-news', name: 'Anthropic News', sourceUrl: 'https://anthropic.test/newsroom', pathPrefix: '/newsroom' }
]) {
  test(`derives the ${registryCase.id} fetch target and article URLs from the registry sourceUrl`, async () => {
    const slug = 'registry-derived-post';
    const articleUrl = `${registryCase.sourceUrl}/${slug}`;
    const indexHtml = datedArticleCardHtml({
      pathPrefix: registryCase.pathPrefix, slug, dateText: 'Aug 20, 2026'
    });
    const fetched = [];
    const fetchClient = createBoundedFetchClient({
      fetchImpl: async (url) => {
        fetched.push(url);
        return new Response(derivedArticleHtml(articleUrl, 'Aug 20, 2026'), { status: 200 });
      }
    });

    const items = await resolveFollowedSourceItems(
      {
        id: registryCase.id,
        name: registryCase.name,
        url: registryCase.sourceUrl,
        sourceUrl: registryCase.sourceUrl
      },
      {
        indexItems: [],
        text: indexHtml,
        fetchClient,
        now: new Date('2026-08-22T00:00:00Z'),
        lookbackDays: 21
      }
    );

    assert.deepEqual(fetched, [articleUrl],
      '표에 origin·경로 상수가 남아 있으면 fetch가 stub sourceUrl이 아니라 그 상수로 나간다');
    assert.equal(items.length, 1,
      '카드 매칭이 registry sourceUrl에서 파생한 경로를 따라가야 후보가 나온다');
    assert.equal(items[0].url, articleUrl);
    assert.equal(items[0].parentUrl, registryCase.sourceUrl);
  });
}

test('returns [] for an unknown source.id without fetching', async () => {
  let fetchCount = 0;
  const items = await resolveFollowedSourceItems(
    { id: 'some-other-source', name: 'Other' },
    {
      indexItems: securityIndexItems(),
      text: 'whatever',
      fetchTextImpl: async () => {
        fetchCount += 1;
        return '';
      }
    }
  );

  assert.deepEqual(items, []);
  assert.equal(fetchCount, 0, 'no resolver invoked for an unregistered id');
});

test('returns [] when called with no options (preserves the original default)', async () => {
  const items = await resolveFollowedSourceItems({ id: 'some-other-source' });
  assert.deepEqual(items, []);
});

// #1059: 진짜 갭은 리졸버가 아니라 여기 등록부 entry였다. resolveFollowedSourceItems는 이미
// onDiagnostic을 entry.resolve에 넘기고 있었는데, 세 entry가 그것을 destructure하지 않아 절단이
// console.warn 밖으로 못 나갔다. entry가 인자를 흘리면 리졸버 쪽 테스트는 전부 통과하면서도
// 프로덕션에서는 이벤트가 0건이 된다 — 그래서 배선을 따로 잠근다.
test('the page-walking resolvers receive onDiagnostic so their truncation is not log-only (#1059)', async () => {
  const gerritSource = (id) => ({
    id,
    name: id,
    url: 'https://android-review.googlesource.com/changes/?q=x&n=100',
    sourceUrl: 'https://android-review.googlesource.com/changes/?q=x&n=100'
  });
  // 창 안 항목 하나뿐인 목록은 "이 페이지가 창을 못 덮었다"가 참이라 목록 절단이 난다.
  const gerritListBody = ")]}'\n" + JSON.stringify([{
    _number: 4228183,
    project: 'platform/frameworks/av',
    branch: 'android17-release',
    status: 'NEW',
    subject: 'VirtualCamera: validate blobSizeBytes',
    created: '2026-08-30 00:00:00.000000000',
    updated: '2026-08-31 00:00:00.000000000'
  }]);

  const cases = [
    {
      source: patchworkSource(),
      // 첫 페이지가 창 안이고 다음 페이지 조회가 실패하면 창을 다 못 읽은 채 끝난다.
      text: JSON.stringify([{
        web_url: 'https://patchwork.libcamera.org/patch/28401/',
        date: '2026-08-31T09:14:06',
        name: 'libcamera: burst churn',
        state: 'new'
      }]),
      fetchTextImpl: async () => { throw new Error('network down'); }
    },
    {
      source: gerritSource('aosp-gerrit-camera-changes'),
      text: gerritListBody,
      fetchTextImpl: async () => { throw new Error('network down'); }
    },
    {
      source: gerritSource('chromeos-gerrit-camera-changes'),
      text: gerritListBody,
      fetchTextImpl: async () => { throw new Error('network down'); }
    }
  ];

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const { source, text, fetchTextImpl } of cases) {
      const events = [];
      await resolveFollowedSourceItems(source, {
        indexItems: [],
        text,
        fetchTextImpl,
        now: new Date('2026-09-02T00:00:00Z'),
        lookbackDays: 35,
        onDiagnostic: event => events.push(event)
      });
      const truncations = events.filter(event => event.kind === 'collection_window_truncated');
      assert.equal(truncations.length, 1, `${source.id} announces its truncation through the registry entry`);
      assert.equal(truncations[0].source_id, source.id, `${source.id} names itself in the event`);
    }
  } finally {
    console.warn = originalWarn;
  }
});
