const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..', '..', '..');
const NewsletterArchive = require('../../../../articles/assets/js/newsletter-archive');

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

function blockAt(css, startIndex) {
  const openIndex = css.indexOf('{', startIndex);
  assert.notEqual(openIndex, -1, 'CSS block should contain an opening brace');
  let depth = 0;
  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    } else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openIndex + 1, index);
      }
    }
  }
  assert.fail('CSS block should contain a matching closing brace');
}

function mediaBlock(css, query) {
  const index = css.indexOf(`@media ${query}`);
  assert.notEqual(index, -1, `@media ${query} block should exist`);
  return blockAt(css, index);
}

function exactSelectorBlock(css, selector) {
  const pattern = new RegExp(`(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g');
  for (const match of css.matchAll(pattern)) {
    const selectorIndex = match.index + match[0].indexOf(selector);
    const previous = css.slice(0, match.index).trimEnd();
    if (previous.endsWith(',')) continue;
    return blockAt(css, selectorIndex);
  }
  assert.fail(`${selector} exact block should exist`);
}

function assertCssDeclaration(block, property, value) {
  const normalized = String(block).replace(/\s+/g, ' ');
  assert.match(normalized, new RegExp(`${property}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`));
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
  assert.match(html, /<div class="card-meta archive-card-meta"><span class="issue-date">W28<\/span> · 2026\.07\.06 – 07\.12 · 총 3건<\/div>/);
  assert.doesNotMatch(html, /card-summary|tag-row/);
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
  assert.match(html, /<h1 id="featured-title" class="featured-title">보이지 않는 카메라의 오늘, 그러나 미래<\/h1>/);
  assert.match(html, /<p class="featured-kicker">Camera SW Newsroom<\/p>/);
  // 최신 소식 grid section with sort + topic filter + grid hooks.
  assert.match(html, /<h2 id="latest-title">최신 소식<\/h2>/);
  assert.match(html, /<select id="latest-sort" class="nc-sort"[\s\S]*?<option value="latest">최신순<\/option>[\s\S]*?<option value="oldest">오래된순<\/option>/);
  assert.match(html, /<div id="latest-topics" class="keyword-row latest-topics"/);
  assert.match(html, /<div id="latest-grid" class="archive-grid latest-grid">/);
  assert.match(html, /<a class="section-link" href="archive\.html">전체 아카이브 보기<\/a>/);
  // Shared nav and subscription hooks are preserved.
  assert.match(html, /class="nav-links homepage-nav-links"[\s\S]*href="index\.html">홈<\/a>[\s\S]*href="archive\.html">아카이브<\/a>[\s\S]*href="https:\/\/github\.com\/TTolsun\/camera-hal-sw-newsletter">GitHub<\/a>/);
  assert.match(html, /<section id="subscribe"[\s\S]*data-subscription-section hidden>/);
  assert.doesNotMatch(html, /homepage-header-actions|icon-menu|icon-search/);
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
