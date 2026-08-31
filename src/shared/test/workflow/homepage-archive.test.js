const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..', '..', '..');
const NewsletterArchive = require('../../../../articles/assets/js/newsletter-archive');
const { withLearningFooterLink } = require('../../../generator/publish/assemble-site');
const { headlineSnapshotFromCandidate } = require('../../../generator/reporter/homepage-headline');
const { mediaBlock, exactSelectorBlock, selectorGroupBlock, assertCssDeclaration } = require('../helpers/css-blocks');
const { assertSharedNav } = require('../helpers/site-nav');

function extractHomepageScript() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>\s*([\s\S]*?)\s*<\/script>/gi)]
    .map(match => match[1]);
  const homepageScript = scripts.find(script =>
    /\basync function loadNewsletters\b/.test(script) &&
    /\basync function loadHomepageHeadline\b/.test(script) &&
    /\basync function loadSubscription\b/.test(script) &&
    /\bloadSubscription\(\);\s*$/.test(script)
  );
  assert.ok(homepageScript, 'index.html should include the homepage newsletter script');
  return homepageScript.replace(
    /\bloadHomepageHeadline\(\);\s*\n\s*loadNewsletters\(\);\s*\n\s*loadSubscription\(\);\s*$/,
    'globalThis.__headlineReady = loadHomepageHeadline();\n    globalThis.__homepageReady = loadNewsletters();\n    globalThis.__subscriptionReady = loadSubscription();'
  );
}

function createElement(overrides = {}) {
  const listeners = {};
  const classNames = new Set();
  return {
    innerHTML: '',
    hidden: false,
    value: '',
    listeners,
    classList: {
      add(value) {
        classNames.add(value);
      },
      remove(value) {
        classNames.delete(value);
      },
      toggle(value, force) {
        const enabled = force === undefined ? !classNames.has(value) : Boolean(force);
        if (enabled) classNames.add(value);
        else classNames.delete(value);
        return enabled;
      },
      contains(value) {
        return classNames.has(value);
      }
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    getAttribute(name) {
      return this[name];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    removeAttribute(name) {
      delete this[name];
    },
    ...overrides
  };
}

async function renderHomepage(newsletters, headlineState = null, options = {}) {
  const script = extractHomepageScript();
  const errors = [];
  const elements = {
    'featured-card': createElement(),
    'latest-grid': createElement(),
    'latest-topics': createElement(),
    'latest-sort': createElement({ value: 'latest' }),
    'latest-empty': createElement({ hidden: true }),
    subscribe: createElement({ hidden: true }),
    'subscription-action': createElement()
  };
  const window = {
    location: { pathname: '/index.html', search: '', hash: '' },
    NewsletterArchive
  };

  const context = {
    window,
    URL,
    URLSearchParams,
    document: {
      getElementById(id) {
        return elements[id];
      },
      querySelector(selector) {
        if (selector === '[data-subscription-section]') return elements.subscribe;
        if (selector === '[data-subscription-action]') return elements['subscription-action'];
        return null;
      }
    },
    fetch: async (url, fetchOptions) => {
      assert.equal(fetchOptions.cache, 'no-store');
      if (url === 'data/homepage-headline.json') {
        if (headlineState === null) {
          return { ok: false, status: 404 };
        }
        if (headlineState === 'malformed') {
          return {
            ok: true,
            json: async () => {
              throw new Error('bad headline json');
            }
          };
        }
        return {
          ok: true,
          json: async () => headlineState
        };
      }
      if (url === 'config/subscription.json') {
        return { ok: false, status: 404 };
      }
      assert.equal(url, 'data/newsletters-weekly.json');
      if (options.newsletterFetchError) {
        return { ok: false, status: 500 };
      }
      return {
        ok: true,
        json: async () => newsletters
      };
    },
    console: {
      error(error) {
        errors.push(error);
      }
    }
  };

  vm.runInNewContext(script, context, { filename: 'index.html' });
  assert.equal(typeof context.__homepageReady?.then, 'function');
  assert.equal(typeof context.__headlineReady?.then, 'function');
  assert.equal(typeof context.__subscriptionReady?.then, 'function');
  await context.__headlineReady;
  await context.__homepageReady;
  await context.__subscriptionReady;

  return { elements, errors, context };
}

// A minimal event target for a topic chip, matching the homepage delegated-click contract.
function createTopicTarget(key, disabled = false) {
  const button = {
    getAttribute(name) {
      return name === 'data-latest-topic' ? key : '';
    },
    hasAttribute(name) {
      return name === 'disabled' && disabled;
    },
    closest(selector) {
      assert.equal(selector, '[data-latest-topic]');
      return button;
    }
  };
  return button;
}

function newsletter(date, title = `Issue ${date}`) {
  return {
    date,
    title,
    summary: `Summary ${date}`,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    article_count: 1,
    tags: ['Camera HAL']
  };
}

function fallbackNewsletter(date, title = `Issue ${date}`) {
  return {
    ...newsletter(date, title),
    tags: ['Tooling Watch Edition', 'Tooling Watch'],
    publication_mode: 'fallback_public',
    homepage_visibility: 'visible_with_fallback_badge',
    fallback_only: true,
    camera_anchor_count: 0,
    homepage_badge: 'Tooling Watch Edition'
  };
}

function archiveCards(html) {
  return archiveCardElements(html).map(card => card.body);
}

function archiveCardElements(html) {
  return [...String(html).matchAll(/<a\b([^>]*\bclass="[^"]*\barchive-card\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)]
    .map(match => ({
      attrs: match[1],
      body: match[2],
      html: match[0]
    }));
}

function assertNoNestedInteractive(html) {
  assert.doesNotMatch(String(html), /<a\b|<button\b|\brole="button"/i);
}

function readStylesheet() {
  return fs.readFileSync(path.join(root, 'articles', 'css', 'styles.css'), 'utf8');
}

function validHeadlineState(overrides = {}) {
  return {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: 'Camera HAL headline',
      summary: 'Camera HAL summary',
      source_url: 'https://example.com/source',
      newsletter_date: '2026-05-23',
      selected_at: '2026-05-23',
      snapshot: { source_name: 'Example Source' },
      ...overrides
    },
    headline_history: []
  };
}

// ---- Featured hero (from homepage-headline.json) ----

test('featured hero renders the current headline with escaped copy, image, kicker, and article link', async () => {
  const weekly = {
    ...newsletter('2026-05-23', 'Weekly issue'),
    weeklyKey: '2026-W21',
    weekStartDate: '2026-05-18',
    weekEndDate: '2026-05-24',
    html: 'newsletters/2026-W21/index.html',
    tags: ['Camera HAL']
  };
  const { elements } = await renderHomepage([weekly], validHeadlineState({
    title: '<Camera HAL headline>',
    summary: 'Summary & details',
    newsletter_url: 'newsletters/2026-W21/index.html',
    newsletter_article_url: 'newsletters/2026-W21/index.html#article-camerax-preview',
    image_url: 'https://example.com/headline.png',
    image_alt: '<Camera preview image>'
  }));

  const html = elements['featured-card'].innerHTML;
  assert.match(html, /<h1 id="featured-title" class="featured-title">&lt;Camera HAL headline&gt;<\/h1>/);
  assert.match(html, /<p class="featured-lead">Summary &amp; details<\/p>/);
  assert.match(html, /<img class="featured-img" src="https:\/\/example\.com\/headline\.png" alt="&lt;Camera preview image&gt;"/);
  assert.match(html, /<p class="featured-kicker">Camera HAL<\/p>/);
  assert.match(html, /<div class="featured-meta">2026-05-23 · Example Source<\/div>/);
  assert.match(html, /href="newsletters\/2026-W21\/index\.html#article-camerax-preview"[^>]*>기사 읽기 →<\/a>/);
  assert.doesNotMatch(html, /rel="noopener"/);
});

// DESIGN.md(#1008): 동봉 fallback 그래픽 4종은 실제 기사 이미지와 같이 16:9 풀커버다.
// .is-brand(44% 중앙 + drop-shadow)는 투명 배경 마스코트 전용이라 여기서는 붙지 않는다 —
// 붙이면 불투명 SVG 가 패널 위에 얹힌 사각형으로 보인다.
// alt 가 비는 것도 같이 잠근다 — fallback 은 기사 정보를 담지 않는 장식이고, image_alt 는 기사
// 제목에서 파생돼 그대로 두면 바로 아래 h1 과 같은 문장이 두 번 읽힌다.
test('featured hero renders bundled fallback graphics full-cover with an empty alt', async () => {
  for (const name of ['ai', 'android', 'cpp', 'newsletter-default']) {
    const imageSrc = `assets/images/fallback/${name}.svg`;
    const { elements } = await renderHomepage(
      [newsletter('2026-05-23', 'Weekly issue')],
      validHeadlineState({ image_url: imageSrc, image_alt: 'Camera HAL headline image' })
    );
    const html = elements['featured-card'].innerHTML;
    assert.match(
      html,
      new RegExp(`<img class="featured-img" src="${imageSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" alt=""`),
      `${imageSrc} must render full-cover with an empty alt`
    );
    assert.doesNotMatch(html, /is-brand/, `${imageSrc} must not get the transparent-mascot treatment`);
  }
});

// 로드 실패로 fallback 으로 갈아탈 때도 alt 를 비운다: 갈아탄 그림은 기사가 아니라 장식이다.
test('featured hero clears the alt when a real image falls back at load time', async () => {
  const { elements } = await renderHomepage(
    [newsletter('2026-05-23', 'Weekly issue')],
    validHeadlineState({ image_url: 'https://example.com/headline.png', image_alt: 'Camera HAL headline image' })
  );
  const html = elements['featured-card'].innerHTML;
  assert.match(html, /<img class="featured-img" src="https:\/\/example\.com\/headline\.png" alt="Camera HAL headline image"/);
  assert.match(html, /onerror="this\.onerror=null;this\.alt='';this\.src='assets\/images\/fallback\/newsletter-default\.svg'"/);
});

test('featured hero leaves the static brand hero in place when the headline is missing', async () => {
  const { elements, errors } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], null);
  // The harness starts the featured card empty; a missing headline must not inject article markup.
  assert.equal(elements['featured-card'].innerHTML, '');
  assert.equal(errors.length, 0);
});

test('featured hero ignores a malformed headline payload without throwing', async () => {
  const { elements, errors } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], 'malformed');
  assert.equal(elements['featured-card'].innerHTML, '');
  assert.equal(errors.length, 1);
});

test('featured hero ignores a null headline while keeping the grid working', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], {
    schemaVersion: 1,
    current_headline: null,
    headline_history: []
  });
  assert.equal(elements['featured-card'].innerHTML, '');
  assert.match(elements['latest-grid'].innerHTML, /Current issue/);
});

test('featured hero emits no lead paragraph when the headline has no summary', async () => {
  // summary 가 없으면 lead 문단을 만들지 않는다. 빈 문단이나 대체 문구를 채우지 않는 것이 계약이다.
  // 선정 쪽 자격 조건(isEligibleHeadlineArticle 의 표시 문장 검사)이 생긴 뒤로 파이프라인은 이
  // 상태를 만들지 않는다. 손으로 편집된 상태 파일이나 옛 스냅샷을 대비한 렌더 계층 방어선으로 남긴다.
  const { elements, errors } = await renderHomepage(
    [newsletter('2026-05-23', 'Current issue')],
    validHeadlineState({ summary: '' })
  );

  assert.doesNotMatch(elements['featured-card'].innerHTML, /featured-lead/);
  assert.equal(errors.length, 0);
});

test('featured hero never renders the collector rationale as the headline lead', async () => {
  // 수집기 내부 판단 문자열(candidate.reason)이 스냅샷 -> homepage-headline.json -> 히어로 lead 로
  // 승격되던 경로를 스냅샷 생성부터 렌더까지 이어서 막는다.
  const collectorReason = 'LWN.net (high, p1, score 74): camera_driver_image_pipeline (camera pipeline signal detected)';
  const snapshot = headlineSnapshotFromCandidate({
    title: 'Camera HAL 이미지 파이프라인 드라이버 패치 제안',
    summary: '',
    description: '',
    reason: collectorReason,
    collection_reason: collectorReason,
    source_url: 'https://lwn.net/Articles/1000001/',
    source: 'LWN.net',
    published_date: '2026-05-23',
    hasDatedEvidence: true,
    relevance_bucket: 'camera_driver_image_pipeline'
  }, { date: '2026-05-23', newsletterUrl: 'newsletters/2026-05-23/index.html', scoredAt: '2026-05-23' });

  assert.equal(snapshot.summary, '');

  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], {
    schemaVersion: 1,
    current_headline: snapshot,
    headline_history: []
  });

  const html = elements['featured-card'].innerHTML;
  assert.doesNotMatch(html, /featured-lead/);
  assert.doesNotMatch(html, /score 74/);
  assert.doesNotMatch(html, /LWN\.net \(/);
});

test('featured hero falls back to the external source link when no internal URL exists', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], validHeadlineState({
    newsletter_date: '',
    snapshot: {}
  }));
  const html = elements['featured-card'].innerHTML;
  assert.match(html, /href="https:\/\/example\.com\/source" rel="noopener">원문 보기 →<\/a>/);
});

test('featured hero uses the site fallback image when the headline image is unusable', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], validHeadlineState());
  assert.match(elements['featured-card'].innerHTML, /src="assets\/images\/fallback\/newsletter-default\.svg"/);
});

test('featured hero escapes a long headline title without truncating the DOM text', async () => {
  const longTitle = '<Camera HAL headline with a very long title that should stay fully present in the DOM>';
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], validHeadlineState({ title: longTitle }));
  assert.match(
    elements['featured-card'].innerHTML,
    /&lt;Camera HAL headline with a very long title that should stay fully present in the DOM&gt;/
  );
});

// ---- 최신 소식 grid (from newsletters-weekly.json) ----

test('최신 소식 grid renders every weekly issue as an image-forward card in date order', async () => {
  const { elements } = await renderHomepage([
    newsletter('2026-05-23', 'Older issue'),
    newsletter('2026-05-25', 'Latest issue'),
    newsletter('2026-05-24', 'Middle issue')
  ], null);
  const html = elements['latest-grid'].innerHTML;
  const cards = archiveCards(html);

  assert.equal(cards.length, 3);
  // The homepage grid keeps the latest issue (unlike the old preview that hid it).
  assert.ok(html.indexOf('Latest issue') < html.indexOf('Middle issue'));
  assert.ok(html.indexOf('Middle issue') < html.indexOf('Older issue'));
  assert.equal(elements['latest-empty'].hidden, true);
  for (const card of cards) assertNoNestedInteractive(card);
});

test('최신 소식 grid shows an empty message when there are no newsletters', async () => {
  const { elements } = await renderHomepage([], null);
  assert.match(elements['latest-grid'].innerHTML, /등록된 뉴스레터가 없습니다/);
});

test('최신 소식 grid surfaces a fetch error without throwing', async () => {
  const { elements, errors } = await renderHomepage([], null, { newsletterFetchError: true });
  assert.match(elements['latest-grid'].innerHTML, /뉴스레터 정보를 불러오지 못했습니다/);
  assert.equal(errors.length, 1);
});

test('최신 소식 grid filters by topic on chip click and shows the empty state for no matches', async () => {
  const { elements } = await renderHomepage([
    newsletter('2026-05-25', 'Camera issue'),
    { ...newsletter('2026-05-24', 'Android issue'), tags: ['Android'] }
  ], null);
  const topicHandler = elements['latest-topics'].listeners.click;

  topicHandler({ target: createTopicTarget('android') });
  assert.match(elements['latest-grid'].innerHTML, /Android issue/);
  assert.doesNotMatch(elements['latest-grid'].innerHTML, /Camera issue/);
  assert.match(elements['latest-topics'].innerHTML, /data-latest-topic="android" aria-pressed="true"/);
  assert.equal(elements['latest-empty'].hidden, true);

  topicHandler({ target: createTopicTarget('soc-platform') });
  assert.equal(elements['latest-grid'].innerHTML, '');
  assert.equal(elements['latest-empty'].hidden, false);
});

test('최신 소식 grid reorders when the sort control changes', async () => {
  const { elements } = await renderHomepage([
    newsletter('2026-05-25', 'Newer issue'),
    newsletter('2026-05-23', 'Older issue')
  ], null);
  const sortHandler = elements['latest-sort'].listeners.change;

  assert.ok(elements['latest-grid'].innerHTML.indexOf('Newer issue') < elements['latest-grid'].innerHTML.indexOf('Older issue'));
  elements['latest-sort'].value = 'oldest';
  sortHandler();
  const html = elements['latest-grid'].innerHTML;
  assert.ok(html.indexOf('Older issue') < html.indexOf('Newer issue'));
});

test('최신 소식 topic chips reflect counts and disable empty topics', async () => {
  const { elements } = await renderHomepage([
    newsletter('2026-05-25', 'Camera issue'),
    { ...newsletter('2026-05-24', 'Android issue'), tags: ['Android'] }
  ], null);
  const chips = elements['latest-topics'].innerHTML;

  assert.match(chips, /data-latest-topic="all" aria-pressed="true"/);
  assert.match(chips, /data-latest-topic="camera-hal"[^>]*>Camera HAL<\/button>/);
  assert.match(chips, /data-latest-topic="soc-platform"[^>]*disabled aria-disabled="true"/);
});

test('최신 소식 grid surfaces a fallback edition as the card kicker', async () => {
  const { elements } = await renderHomepage([fallbackNewsletter('2026-05-24', 'Fallback issue')], null);
  const [card] = archiveCards(elements['latest-grid'].innerHTML);
  assert.match(card, /<div class="card-kicker">Tooling Watch Edition<\/div>/);
  assertNoNestedInteractive(card);
});

// ---- Shared card renderer ----

test('renderArchiveCard builds an image-forward card with kicker, headline, and week meta', () => {
  const html = NewsletterArchive.renderArchiveCard({
    weeklyKey: '2026-W28',
    date: '2026-07-06',
    title: '2026 W28',
    weekStartDate: '2026-07-06',
    weekEndDate: '2026-07-12',
    article_count: 3,
    summary: '기사 A\n기사 B',
    tags: ['Camera HAL', 'Android'],
    html: 'newsletters/2026-W28/index.html',
    article_images: ['https://example.com/thumb.png']
  });

  assert.ok(html.indexOf('card-thumb') < html.indexOf('card-body'));
  assert.match(html, /<img class="card-thumb-img" src="https:\/\/example\.com\/thumb\.png"[^>]*onerror=/);
  assert.match(html, /<div class="card-kicker">Camera HAL<\/div>/);
  // Headline is the issue's top article title (first summary line), not the issue label.
  assert.match(html, /<h3 class="card-title clamp-2 nc-h">기사 A<\/h3>/);
  // 표시 계약 v2: coverage 필드가 전혀 없는 weekly entry는 "발행 WNN · 대상 기간 미확인"으로
  // 보여준다(발행 주의 실제 달력 날짜를 대상 기간인 것처럼 꾸미지 않는다 — 의도된 변경).
  assert.match(html, /<div class="card-meta archive-card-meta"><span class="issue-date">발행 W28<\/span> · 대상 기간 미확인 · 총 3건<\/div>/);
  assert.doesNotMatch(html, /card-summary|tag-row/);
});

// 표시 계약 v2: coverage 필드(coverage_week_key/coverage_start_date/coverage_end_date, optional,
// Task 3, 11이 채움)가 있으면 카드는 대상 주(coverage)와 발행 주(weeklyKey)를 항상 함께 보여준다
// (서로 다른 두 identity를 하나만 보여주면 다른 기사가 같은 카드로 겹쳐 보이는 아카이브 중복
// 문제가 생긴다). 발행 identity(weeklyKey)는 라우팅에도 쓰인다.
test('renderArchiveCard shows both the coverage week and the published week when coverage fields are present', () => {
  const html = NewsletterArchive.renderArchiveCard({
    weeklyKey: '2026-W34',
    date: '2026-08-17',
    title: '2026 W34',
    weekStartDate: '2026-08-17',
    weekEndDate: '2026-08-23',
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-16',
    article_count: 2,
    summary: '기사 C\n기사 D',
    tags: ['Camera HAL', 'Android'],
    html: 'newsletters/2026-W34/index.html',
    article_images: ['https://example.com/thumb2.png']
  });

  assert.match(
    html,
    /<div class="card-meta archive-card-meta"><span class="issue-date">대상 W33<\/span> · 2026\.08\.10 – 08\.16 · <span class="issue-publish-badge">발행 W34<\/span> · 총 2건<\/div>/
  );
  // 발행 identity(2026-W34)는 라우팅에도 쓰인다. URL은 변하지 않는다.
  assert.match(html, /href="newsletters\/2026-W34\/index\.html"/);
});

// coverage_week_key만 있고 날짜가 없는 부분 누락 상태에서는 라벨(coverage 33)과 range(발행 주
// 17~23)가 서로 다른 주를 가리키는 화면 불일치가 생길 수 있었다 — 셋 다 유효할 때만 통째로 쓰고,
// 하나라도 빠지면 라벨·range 모두 발행 주로 폴백해야 한다.
test('renderArchiveCard falls back to the published week label and range when coverage dates are missing', () => {
  const html = NewsletterArchive.renderArchiveCard({
    weeklyKey: '2026-W34',
    date: '2026-08-17',
    title: '2026 W34',
    weekStartDate: '2026-08-17',
    weekEndDate: '2026-08-23',
    // coverage_week_key만 있고 coverage_start_date/coverage_end_date는 누락된 상태.
    coverage_week_key: '2026-W33',
    article_count: 2,
    summary: '기사 C\n기사 D',
    tags: ['Camera HAL', 'Android'],
    html: 'newsletters/2026-W34/index.html',
    article_images: ['https://example.com/thumb2.png']
  });

  assert.match(html, /<div class="card-meta archive-card-meta"><span class="issue-date">W34<\/span> · 2026\.08\.17 – 08\.23 · 총 2건<\/div>/);
});

// 리뷰 fix 3 + 표시 계약 v2: legacy_rolling은 ISO 주 라벨을 붙일 근거가 없다(실제 rolling 조회
// 범위일 뿐이라). 대상(coverage)은 날짜 range만("대상 2026.08.10 – 08.17")으로 보여주고, 발행
// 주(weeklyKey)는 별도 배지("발행 W34")로 함께 보여준다 — iso_week 케이스와 다른 discriminated
// union 분기지만 두 identity를 항상 같이 보여준다는 원칙은 같다.
test('renderArchiveCard shows the rolling date range as the coverage identity alongside the published week badge when coverage_mode is legacy_rolling', () => {
  const html = NewsletterArchive.renderArchiveCard({
    weeklyKey: '2026-W34',
    date: '2026-08-17',
    title: '2026 W34',
    weekStartDate: '2026-08-17',
    weekEndDate: '2026-08-23',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-17',
    coverage_mode: 'legacy_rolling',
    // coverage_week_key 없음 — legacy_rolling은 의도적으로 기록하지 않는다.
    article_count: 2,
    summary: '기사 C\n기사 D',
    tags: ['Camera HAL', 'Android'],
    html: 'newsletters/2026-W34/index.html',
    article_images: ['https://example.com/thumb2.png']
  });

  assert.match(
    html,
    /<div class="card-meta archive-card-meta"><span class="issue-date">대상 2026\.08\.10 – 08\.17<\/span> · <span class="issue-publish-badge">발행 W34<\/span> · 총 2건<\/div>/
  );
  assert.match(html, /href="newsletters\/2026-W34\/index\.html"/);
});

// 표시 계약 v2: coverage_mode가 명시적으로 unverified면 필드가 남아 있어도(검증기가 막지만,
// 렌더 계층은 방어적으로) 대상 기간을 모른다고 보여준다.
test('renderArchiveCard shows the published week and an unconfirmed coverage period when coverage_mode is unverified', () => {
  const html = NewsletterArchive.renderArchiveCard({
    weeklyKey: '2026-W19',
    date: '2026-05-04',
    title: '2026 W19',
    weekStartDate: '2026-05-04',
    weekEndDate: '2026-05-10',
    coverage_mode: 'unverified',
    article_count: 1,
    summary: '기사 E',
    tags: ['Camera HAL'],
    html: 'newsletters/2026-W19/index.html'
  });

  assert.match(
    html,
    /<div class="card-meta archive-card-meta"><span class="issue-date">발행 W19<\/span> · 대상 기간 미확인 · 총 1건<\/div>/
  );
});

test('renderArchiveCard falls back to the site newsletter image and a kicker when data is sparse', () => {
  const html = NewsletterArchive.renderArchiveCard({
    date: '2026-06-03',
    title: 'Daily issue',
    summary: '',
    tags: [],
    html: 'newsletters/2026-06-03/index.html'
  });

  assert.match(html, /src="assets\/images\/fallback\/newsletter-default\.svg"/);
  assert.match(html, /<div class="card-kicker">Camera HAL<\/div>/);
  assert.match(html, /<h3 class="card-title clamp-2 nc-h">Daily issue<\/h3>/);
});

// ---- Static homepage markup contracts ----

test('homepage renders a static brand featured hero and a 최신 소식 grid with sort and topic hooks', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  // A static brand hero keeps a single H1 present before the headline data loads.
  assert.match(html, /<article id="featured-card" class="featured-hero">/);
  // 이 마스코트가 `.featured-img.is-brand` 의 유일한 소비자다(#1008 이후). DESIGN.md elevation 이
  // 허용한 단 하나의 product drop-shadow 예외가 이 한 줄에 걸려 있으므로 함께 잠근다 —
  // 여기서 빠지면 styles.css 의 .featured-img.is-brand 가 조용히 dead 규칙이 된다.
  assert.match(html, /<img class="featured-img is-brand" src="assets\/images\/brand\/HALley\.png"/);
  assert.match(html, /<h1 id="featured-title" class="featured-title">보이지 않는 카메라의 오늘, 그러나 미래<\/h1>/);
  assert.match(html, /<p class="featured-kicker">Camera SW Newsroom<\/p>/);
  // 최신 소식 grid section with sort + topic filter + grid hooks.
  assert.match(html, /<h2 id="latest-title">최신 소식<\/h2>/);
  assert.match(html, /<select id="latest-sort" class="nc-sort"[\s\S]*?<option value="latest">최신순<\/option>[\s\S]*?<option value="oldest">오래된순<\/option>/);
  assert.match(html, /<div id="latest-topics" class="keyword-row latest-topics"/);
  assert.match(html, /<div id="latest-grid" class="archive-grid latest-grid">/);
  assert.match(html, /<a class="section-link" href="archive\.html">전체 아카이브 보기<\/a>/);
  // 헤더 나브는 컨테이너로 스코프해서 본다. 열린 `[\s\S]*` 로 쓰면 푸터의 같은 라벨이 뒤쪽 절을
  // 만족시켜, 헤더를 통째로 영어로 바꿔도 통과한다(실측).
  assertSharedNav(html);
  assert.match(html, /<footer class="site-footer">[\s\S]*href="learning\/ai-engineering\/index\.html">AI Engineering Lab<\/a>/);
  assert.match(html, /<section id="subscribe"[\s\S]*data-subscription-section hidden>/);
  assert.doesNotMatch(html, /homepage-header-actions|icon-menu|icon-search/);
});

test('site assembly makes every deployed public page footer link to the AI Engineering lab', () => {
  const newsletterPages = fs.readdirSync(path.join(root, 'articles', 'newsletters'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, 'articles', 'newsletters', entry.name, 'index.html'))
    .filter(file => fs.existsSync(file));
  const publicPages = [
    { file: path.join(root, 'index.html'), href: 'learning/ai-engineering/index.html' },
    { file: path.join(root, 'articles', 'archive.html'), href: 'learning/ai-engineering/index.html' },
    { file: path.join(root, 'articles', 'learning', 'ai-engineering', 'index.html'), href: 'index.html' },
    ...newsletterPages.map(file => ({ file, href: '../../learning/ai-engineering/index.html' }))
  ];

  for (const { file, href } of publicPages) {
    const pageLabel = path.relative(root, file);
    const html = withLearningFooterLink(fs.readFileSync(file, 'utf8'), href, pageLabel);
    const footer = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] || '';
    assert.ok(
      footer.includes(`<a class="footer-link" href="${href}">AI Engineering Lab</a>`),
      pageLabel
    );
  }
});

test('homepage script fetches the weekly source of truth, headline, and subscription config only', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(html, /fetch\('data\/newsletters-weekly\.json'/);
  assert.match(html, /fetch\('data\/homepage-headline\.json'/);
  assert.match(html, /fetch\('config\/subscription\.json'/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|document\.cookie/);
});

test('archive grid CSS caps columns and preserves card interaction layout contracts', () => {
  const css = readStylesheet();
  const archiveGrid = exactSelectorBlock(css, '.archive-grid');
  const archiveCard = exactSelectorBlock(css, '.archive-card');
  const archivePageGrid = exactSelectorBlock(css, '.archive-page .archive-grid');
  const archivePageCard = exactSelectorBlock(css, '.archive-page .archive-card');
  const archiveFocus = exactSelectorBlock(css, '.archive-card:focus-visible');
  const cardThumb = exactSelectorBlock(css, '.card-thumb');
  const archivePagination = exactSelectorBlock(css, '.archive-pagination');
  const archivePageButton = exactSelectorBlock(css, '.archive-page-button');
  const archivePageCurrent = exactSelectorBlock(css, '.archive-page-button.is-current');
  const mediumGrid = exactSelectorBlock(mediaBlock(css, '(min-width: 700px)'), '.archive-grid');
  const wideGrid = exactSelectorBlock(mediaBlock(css, '(min-width: 1000px)'), '.archive-page .archive-grid');

  assertCssDeclaration(archiveGrid, 'display', 'grid');
  assertCssDeclaration(archiveGrid, 'grid-template-columns', '1fr');
  assertCssDeclaration(mediumGrid, 'grid-template-columns', 'repeat(2, minmax(0, 1fr))');
  // The archive page fans out to three image-forward columns on wide viewports.
  assertCssDeclaration(wideGrid, 'grid-template-columns', 'repeat(3, minmax(0, 1fr))');
  assertCssDeclaration(archiveCard, 'display', 'flex');
  assertCssDeclaration(archiveCard, 'flex-direction', 'column');
  // 카드 프레임은 flat(투명·무테두리), 경계선은 16:9 썸네일에만 둔다. 흰 배경 소셜 카드
  // 이미지가 흰 캔버스에 묻히지 않게 하는 hairline이라, 둘을 바꿔 다는 회귀를 막는다.
  assertCssDeclaration(archiveCard, 'border', 'none');
  assertCssDeclaration(archiveCard, 'background', 'transparent');
  assertCssDeclaration(cardThumb, 'border', '1px solid var(--line)');
  assertCssDeclaration(cardThumb, 'aspect-ratio', '16 / 9');
  // mockup 카드 그리드 리듬: 세로 46px / 가로 28px.
  assertCssDeclaration(archivePageGrid, 'gap', '46px 28px');
  assertCssDeclaration(archivePageCard, 'padding', '0');
  assert.match(archiveFocus, /outline\s*:\s*3px solid var\(--focus-ring\)\s*;/);
  assertCssDeclaration(archiveFocus, 'outline-offset', '4px');
  assertCssDeclaration(archivePagination, 'justify-content', 'center');
  assertCssDeclaration(archivePageButton, 'min-width', '42px');
  assertCssDeclaration(archivePageButton, 'border-radius', 'var(--radius-pill)');
  assertCssDeclaration(archivePageCurrent, 'background', '#0066cc');
});

test('homepage shell is full-bleed with the newsroom translucent header', () => {
  const css = readStylesheet();
  const homepageNav = exactSelectorBlock(css, '.homepage-nav');
  const homepageWrap = exactSelectorBlock(css, '.homepage .content-wrap');
  const siteHeader = exactSelectorBlock(css, '.site-header');

  assertCssDeclaration(homepageNav, 'justify-content', 'space-between');
  // mockup: 콘텐츠 폭 1080px에 좌우 22px 거터(실제 콘텐츠 1036px), 58px sticky 헤더.
  assertCssDeclaration(homepageWrap, 'width', 'min(100% - 44px, 1036px)');
  assertCssDeclaration(homepageNav, 'min-height', '58px');
  assertCssDeclaration(siteHeader, 'backdrop-filter', 'saturate(180%) blur(20px)');
  assertCssDeclaration(siteHeader, 'background', 'rgba(255, 255, 255, 0.82)');
  // 풀블리드 chrome: 헤더/메인/푸터를 감싸는 라운드 프레임 셀렉터가 되살아나면 안 된다.
  assert.doesNotMatch(css, /\.homepage \.site-header,\n\.homepage \.site-main,\n\.homepage \.site-footer/);
  assert.doesNotMatch(css, /homepage-header-actions|icon-link|icon-menu|icon-search|section-icon-bolt/);
});

test('tertiary meta text keeps WCAG AA contrast on the white and parchment canvases', () => {
  const css = readStylesheet();
  const rootTokens = exactSelectorBlock(css, ':root');

  // #86868b (the handoff literal) measures 3.62:1 on #ffffff and 3.33:1 on #f5f5f7, below the
  // WCAG AA 4.5:1 floor for normal-size text. #6e6e73 measures 5.07:1 and 4.65:1.
  assertCssDeclaration(rootTokens, '--text-tertiary', '#6e6e73');
  // The sort chevron data URI cannot use var(), so it repeats the same value by hand.
  assert.match(css, /stroke='%236e6e73'/);
});

// focus 신호는 사이트 전체에 하나다(DESIGN.md 「색」). 링 색은 불투명 액센트라야 하고
// — 35% 틴트는 흰 배경 1.72:1 로 WCAG 1.4.11(3:1) 미달이었다 —, tabindex 로만 초점을 받는
// 요소도 브라우저 기본 링이 아니라 같은 링을 써야 한다(#1009).
test('the shared focus ring covers non-native focus targets at an opaque accent', () => {
  const css = readStylesheet();
  assertCssDeclaration(exactSelectorBlock(css, ':root'), '--focus-ring', '#0066cc');

  const focusRule = selectorGroupBlock(css, '[tabindex]:focus-visible');
  assertCssDeclaration(focusRule, 'outline', '3px solid var(--focus-ring)');
  assertCssDeclaration(focusRule, 'outline-offset', '3px');
  // 같은 규칙이어야 한다 — 별도 블록으로 갈라지면 두 값이 따로 흘러간다.
  assert.equal(focusRule, selectorGroupBlock(css, 'a:focus-visible'));
});

test('font weights stay on the DESIGN.md 400/500/600 ramp', () => {
  const css = readStylesheet();

  // DESIGN.md Do & Don't: 400(본문) / 500(리드·나브·chip) / 600(헤드라인·라벨), 700 이상 금지.
  // 개별 규칙이 없는 heading은 브라우저 기본 bold(700)로 떨어지므로 base 규칙에서 못박는다.
  for (const heading of ['h1', 'h2', 'h3']) {
    assertCssDeclaration(exactSelectorBlock(css, heading), 'font-weight', '600');
  }

  // 램프 밖 값은 이제 하나도 없다. 유일한 예외였던 .section-icon-star(900)는 도달 불가 규칙이라
  // dead CSS 정리에서 제거했다. 새 예외를 만들려면 DESIGN.md 램프를 먼저 고쳐야 한다.
  const offRamp = [...css.matchAll(/font-weight:\s*([^;]+);/g)]
    .map(match => match[1].trim())
    .filter(value => !['400', '500', '600', 'inherit'].includes(value));
  assert.deepEqual(offRamp, []);
});

test('homepage featured hero and latest grid CSS cover the rebuilt layout', () => {
  const css = readStylesheet();
  const featuredHero = exactSelectorBlock(css, '.featured-hero');
  const featuredThumb = exactSelectorBlock(css, '.featured-thumb');
  const featuredCopy = exactSelectorBlock(css, '.featured-copy');
  const featuredTitle = exactSelectorBlock(css, '.featured-title');
  const wideLatestGrid = exactSelectorBlock(mediaBlock(css, '(min-width: 1000px)'), '.latest-grid');

  // The rebuilt homepage renders `.featured-hero`/`.latest-grid` (not `.site-hero`); assert the
  // live layout so a regression in the new hero is caught, not just the retained dead-CSS pins.
  assertCssDeclaration(featuredHero, 'display', 'grid');
  assertCssDeclaration(featuredThumb, 'aspect-ratio', '16 / 9');
  assertCssDeclaration(featuredThumb, 'border', '1px solid var(--line)');
  assertCssDeclaration(featuredThumb, 'border-radius', 'var(--radius-lg)');
  assertCssDeclaration(featuredCopy, 'text-align', 'center');
  assertCssDeclaration(featuredTitle, 'font-size', 'clamp(1.9rem, 3.4vw, 2.9rem)');
  assertCssDeclaration(wideLatestGrid, 'grid-template-columns', 'repeat(3, minmax(0, 1fr))');
});

test('latest and archive card CSS preserves whole-card links and mobile summary behavior', () => {
  const css = readStylesheet();
  const cardLink = exactSelectorBlock(css, '.newsletter-card,\n.archive-card');
  const emptyState = exactSelectorBlock(css, '.archive-empty-state');
  const mobile = mediaBlock(css, '(max-width: 640px)');

  assertCssDeclaration(cardLink, 'text-decoration', 'none');
  assertCssDeclaration(emptyState, 'grid-column', '1 / -1');
  assert.doesNotMatch(mobile, /latest-card-summary\s*\{[\s\S]*?display\s*:\s*none\s*;/);
  assert.doesNotMatch(css, /archive-toolbar/);
  assert.doesNotMatch(css, /filter-shortcut/);
});

test('newsletter issue page CSS follows the newsroom flat article layout', () => {
  const css = readStylesheet();
  const pageBackground = exactSelectorBlock(css, '.homepage,\n.newsletter-issue-page');
  const issueArticlePage = exactSelectorBlock(css, '.newsletter-issue-page .article-page');
  const issueWrap = exactSelectorBlock(css, '.newsletter-issue-page .wrap');
  const issueHero = exactSelectorBlock(css, '.newsletter-issue-page .issue-hero');
  const issueKicker = exactSelectorBlock(css, '.newsletter-issue-page .issue-kicker');
  const issueTitle = exactSelectorBlock(css, '.newsletter-issue-page .article-header h1');
  const issueArticleTitle = exactSelectorBlock(css, '.newsletter-issue-page .article-title');
  const issueSection = exactSelectorBlock(css, '.newsletter-issue-page .issue-section');
  const issueStoryFlow = exactSelectorBlock(css, '.newsletter-issue-page .issue-story.issue-section');
  const issueStoryNumber = exactSelectorBlock(css, '.issue-story-number');
  const issueStoryCategory = exactSelectorBlock(css, '.issue-story-category');
  const issueBriefingCard = exactSelectorBlock(css, '.issue-briefing-card');
  const issueTakeaway = exactSelectorBlock(css, '.newsletter-issue-page .camera-hal-takeaway');
  const issueArticleSubheading = exactSelectorBlock(css, '.newsletter-issue-page .article-card h3.article-subheading');
  const issuePublishBadge = exactSelectorBlock(css, '.newsletter-issue-page .issue-hero .issue-publish-badge');
  const issueBack = exactSelectorBlock(css, '.issue-back');
  const issueSourceList = exactSelectorBlock(css, '.newsletter-issue-page .source-list');
  const issueReferences = exactSelectorBlock(css, '.newsletter-issue-page .issue-references');
  const issueFooterNavigation = exactSelectorBlock(css, '.issue-footer-navigation');
  const issueMobileArticlePage = exactSelectorBlock(mediaBlock(css, '(max-width: 860px)'), '.newsletter-issue-page .article-page');
  const issueCompactWrap = exactSelectorBlock(mediaBlock(css, '(max-width: 640px)'), '.newsletter-issue-page .wrap');
  const issueCompactStory = exactSelectorBlock(mediaBlock(css, '(max-width: 640px)'), '.newsletter-issue-page .issue-story.issue-section');

  // mockup: 홈·이슈 페이지 캔버스는 그라디언트 없는 순백 풀블리드.
  assertCssDeclaration(pageBackground, 'background', '#ffffff');
  assertCssDeclaration(issueArticlePage, 'padding', '34px 0 0');
  // Issue pages read in a narrow single column (mockup): 760px wrap, 80px bottom exit.
  assertCssDeclaration(issueWrap, 'width', 'min(100% - 44px, 760px)');
  assertCssDeclaration(issueWrap, 'max-width', 'none');
  assertCssDeclaration(issueWrap, 'padding-bottom', '80px');
  assertCssDeclaration(issueHero, 'grid-template-columns', '1fr');
  // 히어로가 grid 라서 직접 자식은 inline 계열 display 가 blockify 되고 stretch 로 컬럼을 채운다.
  // 내용 폭으로 남아야 하는 자식(발행 배지 알약, 뒤로 가기 링크의 클릭 영역)은 명시해 잠근다.
  assertCssDeclaration(issuePublishBadge, 'justify-self', 'start');
  assertCssDeclaration(issueBack, 'justify-self', 'start');
  // mockup 히어로는 장식 glow·마스코트 없는 평문 흐름.
  assert.doesNotMatch(css, /\.newsletter-issue-page \.issue-hero::before/);
  assert.doesNotMatch(css, /issue-hero-mascot/);
  assert.doesNotMatch(css, /issue-actions|bottom-nav|newsletter-actions/);
  // 주차 range 는 알약이 아닌 uppercase 평문 눈썹.
  assertCssDeclaration(issueKicker, 'background', 'transparent');
  assertCssDeclaration(issueKicker, 'text-transform', 'uppercase');
  assertCssDeclaration(issueTitle, 'font-size', 'clamp(2.125rem, 4vw, 3.25rem)');
  assertCssDeclaration(issueTitle, 'letter-spacing', '-0.022em');
  assertCssDeclaration(issueArticleTitle, 'font-size', 'clamp(1.5rem, 2.4vw, 2rem)');
  // Story Contract v2 기사별 소제목: 본문(17px)과 기사 h2 사이 단계, weight 램프의 헤드라인 값.
  assertCssDeclaration(issueArticleSubheading, 'font-size', '1.1875rem');
  assertCssDeclaration(issueArticleSubheading, 'font-weight', '600');
  assertCssDeclaration(issueArticleSubheading, 'letter-spacing', '-0.014em');
  // 기사 섹션은 카드 프레임 없이 hairline 위 평문 흐름(60px 리듬).
  assertCssDeclaration(issueSection, 'border-top', '1px solid var(--line)');
  assertCssDeclaration(issueSection, 'background', 'transparent');
  assertCssDeclaration(issueSection, 'box-shadow', 'none');
  assertCssDeclaration(issueStoryFlow, 'margin-top', '60px');
  assertCssDeclaration(issueStoryFlow, 'padding-left', '0');
  // mockup 번호 배지: 30px 아웃라인 원.
  assertCssDeclaration(issueStoryNumber, 'border-radius', '50%');
  assertCssDeclaration(issueStoryNumber, 'border', '1px solid #d2d2d7');
  assertCssDeclaration(issueStoryNumber, 'background', 'transparent');
  assertCssDeclaration(issueStoryCategory, 'text-transform', 'uppercase');
  // 브리핑·관점·참고자료는 파치먼트 박스 언어.
  assertCssDeclaration(issueBriefingCard, 'background', 'var(--bg)');
  assertCssDeclaration(issueBriefingCard, 'border-radius', 'var(--radius-lg)');
  assertCssDeclaration(issueTakeaway, 'border-radius', 'var(--radius-md)');
  assertCssDeclaration(issueTakeaway, 'background', 'var(--bg)');
  // 출처는 박스 없는 세로 불릿 목록.
  assertCssDeclaration(issueSourceList, 'border', 'none');
  assertCssDeclaration(issueSourceList, 'background', 'transparent');
  assertCssDeclaration(issueReferences, 'background', 'var(--bg)');
  assertCssDeclaration(issueReferences, 'border-radius', 'var(--radius-lg)');
  // 하단 내비("← 뉴스룸으로 · 아카이브 전체 보기 →")가 있어야 한다.
  assertCssDeclaration(issueFooterNavigation, 'margin-top', '48px');
  assertCssDeclaration(issueMobileArticlePage, 'padding-top', '28px');
  assertCssDeclaration(issueCompactWrap, 'width', 'min(100% - var(--content-gutter-mobile), 760px)');
  assertCssDeclaration(issueCompactStory, 'padding-top', '28px');
});

test('getSafeNewsletterHref resolves a weekly entry to its weekly directory route (#486)', () => {
  const weekly = {
    weeklyKey: '2026-W23', date: '2026-06-01', title: 'Camera HAL Weekly 2026-W23',
    html: 'newsletters/2026-W23/index.html', tags: ['Camera HAL']
  };
  assert.equal(NewsletterArchive.getSafeNewsletterHref(weekly), 'newsletters/2026-W23/index.html');
  // a tampered weekly href falls back to the safe weekly route, never a per-date path
  assert.equal(
    NewsletterArchive.getSafeNewsletterHref({ ...weekly, html: 'https://evil.example/x' }),
    'newsletters/2026-W23/index.html'
  );
  // daily entries are unchanged
  assert.equal(
    NewsletterArchive.getSafeNewsletterHref({ date: '2026-06-03', html: 'newsletters/2026-06-03/index.html' }),
    'newsletters/2026-06-03/index.html'
  );
});
