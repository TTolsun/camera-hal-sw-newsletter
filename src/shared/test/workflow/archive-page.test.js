const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const NewsletterArchive = require('../../../../articles/assets/js/newsletter-archive');

const root = path.join(__dirname, '..', '..', '..', '..');

function extractArchiveScript() {
  const html = fs.readFileSync(path.join(root, 'articles', 'archive.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>\s*([\s\S]*?)\s*<\/script>/gi)]
    .map(match => match[1])
    .filter(Boolean);
  const archiveScript = scripts.find(script =>
    /\basync function loadArchiveNewsletters\b/.test(script) &&
    /\bloadArchiveNewsletters\(\);\s*$/.test(script)
  );
  assert.ok(archiveScript, 'archive.html should include the archive bootstrap script');
  return archiveScript.replace(
    /\bloadArchiveNewsletters\(\);\s*$/,
    'globalThis.__archiveReady = loadArchiveNewsletters();'
  );
}

function createElement(overrides = {}) {
  const listeners = {};
  const attrs = {};
  return {
    innerHTML: '',
    textContent: '',
    hidden: false,
    value: '',
    listeners,
    attrs,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    getAttribute(name) {
      return attrs[name] || this[name] || '';
    },
    setAttribute(name, value) {
      attrs[name] = value;
      this[name] = value;
    },
    hasAttribute(name) {
      return Boolean(attrs[name] || this[name]);
    },
    ...overrides
  };
}

function createTopicTarget(key, disabled = false) {
  const button = createElement({
    'data-archive-topic': key,
    disabled,
    closest(selector) {
      assert.equal(selector, '[data-archive-topic]');
      return button;
    },
    getAttribute(name) {
      if (name === 'data-archive-topic') return key;
      return '';
    },
    hasAttribute(name) {
      return name === 'disabled' && disabled;
    }
  });
  return button;
}

function createPageTarget(page, disabled = false) {
  const button = createElement({
    'data-archive-page': String(page),
    disabled,
    closest(selector) {
      assert.equal(selector, '[data-archive-page]');
      return button;
    },
    getAttribute(name) {
      if (name === 'data-archive-page') return String(page);
      return '';
    },
    hasAttribute(name) {
      return name === 'disabled' && disabled;
    }
  });
  return button;
}

function updateLocationFromUrl(location, url) {
  const parsed = new URL(url, 'https://example.com');
  location.pathname = parsed.pathname;
  location.search = parsed.search;
  location.hash = parsed.hash;
}

async function renderArchivePage(newsletters, options = {}) {
  const script = extractArchiveScript();
  const elements = {
    '[data-archive-status]': createElement(),
    '[data-archive-controls]': createElement({ hidden: true }),
    '[data-topic-filter]': createElement(),
    '[data-sort-control]': createElement({ value: 'latest' }),
    '[data-result-summary]': createElement(),
    '[data-archive-grid]': createElement(),
    '[data-archive-pagination]': createElement({ hidden: true }),
    '[data-archive-count]': createElement(),
    '[data-archive-topic-label]': createElement(),
    '[data-archive-sort-label]': createElement(),
    '[data-empty-state]': createElement({ hidden: true }),
    '[data-error-state]': createElement({ hidden: true })
  };
  const historyUpdates = [];
  const errors = [];
  const location = {
    pathname: options.pathname || '/archive.html',
    search: options.search || '',
    hash: options.hash || ''
  };
  const window = {
    location,
    NewsletterArchive,
    history: {
      replaceState(_state, _title, url) {
        historyUpdates.push(url);
        updateLocationFromUrl(location, url);
      }
    }
  };
  const context = {
    window,
    URLSearchParams,
    fetch: async (url, fetchOptions) => {
      assert.equal(url, 'data/newsletters-weekly.json');
      assert.equal(fetchOptions.cache, 'no-store');
      if (options.fetchError) {
        return { ok: false, status: 500 };
      }
      return {
        ok: true,
        json: async () => options.invalidJson ? { entries: newsletters } : newsletters
      };
    },
    document: {
      querySelector(selector) {
        return elements[selector] || null;
      }
    },
    console: {
      error(error) {
        errors.push(error);
      }
    }
  };

  vm.runInNewContext(script, context, { filename: 'archive.html' });
  assert.equal(typeof context.__archiveReady?.then, 'function');
  await context.__archiveReady;

  return { elements, historyUpdates, location, errors, context };
}

function newsletter(date, title = `Issue ${date}`, tags = ['Camera HAL']) {
  return {
    date,
    title,
    summary: `Summary ${date}`,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags
  };
}

function archiveCards(html) {
  return [...String(html).matchAll(/<a\b([^>]*\bclass="[^"]*\barchive-card\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)]
    .map(match => ({ attrs: match[1], body: match[2], html: match[0] }));
}

test('archive page uses homepage shell, shared footer, metadata, and stable hooks', () => {
  const html = fs.readFileSync(path.join(root, 'articles', 'archive.html'), 'utf8');

  assert.match(html, /<title>Archive \| Camera HAL SW Newsletter<\/title>/);
  assert.match(html, /<meta name="description" content="Camera HAL, Android Camera, Driver, Image Processing, AI 뉴스레터 아카이브"/);
  assert.match(html, /<body class="homepage">/);
  assert.match(html, /<header class="site-header homepage-site-header">/);
  assert.match(html, /<section class="archive-hero content-wrap" aria-labelledby="archive-page-title">/);
  assert.match(html, /<h1 id="archive-page-title">아카이브<\/h1>/);
  // mockup 아카이브 헤더는 카피 블록만 — 마스코트 이미지가 되살아나면 안 된다.
  assert.doesNotMatch(html, /archive-hero-mascot/);
  assert.doesNotMatch(html, /archive-hero-actions|<a class="button button-primary" href="index\.html">Home<\/a>/);
  assert.match(html, /class="nav-links homepage-nav-links"[\s\S]*href="index\.html">홈<\/a>[\s\S]*href="archive\.html">아카이브<\/a>[\s\S]*GitHub/);
  for (const hook of [
    'data-page="archive"',
    'data-archive-status',
    'data-archive-controls',
    'data-archive-count',
    'data-archive-topic-label',
    'data-archive-sort-label',
    'data-topic-filter',
    'data-sort-control',
    'data-result-summary',
    'data-archive-grid',
    'data-archive-pagination',
    'data-empty-state',
    'data-error-state'
  ]) {
    assert.match(html, new RegExp(hook));
  }
});

test('archive helper canonicalizes managed query params and preserves unrelated params and hash', () => {
  const state = NewsletterArchive.normalizeArchiveState(new URLSearchParams('topic=invalid&sort=latest&utm_source=x'));

  assert.deepEqual(state, NewsletterArchive.DEFAULT_STATE);
  assert.equal(
    NewsletterArchive.buildCanonicalArchiveUrl({
      pathname: '/archive.html',
      search: '?topic=invalid&sort=latest&utm_source=x&keep=1',
      hash: '#section'
    }, state),
    '/archive.html?utm_source=x&keep=1#section'
  );
  assert.equal(
    NewsletterArchive.buildCanonicalArchiveUrl({
      pathname: '/archive.html',
      search: '?utm_source=x',
      hash: '#section'
    }, { topic: 'android', sort: 'oldest', page: 2 }),
    '/archive.html?utm_source=x&topic=android&sort=oldest&page=2#section'
  );
});

test('archive helper rejects unsafe newsletter hrefs and falls back to date route', () => {
  const entry = newsletter('2026-05-25');

  assert.equal(NewsletterArchive.getSafeNewsletterHref(entry), 'newsletters/2026-05-25/index.html');
  assert.equal(NewsletterArchive.getSafeNewsletterHref({ ...entry, html: 'newsletters/2026-05-25/' }), 'newsletters/2026-05-25/');
  for (const html of [
    'https://example.com/newsletter',
    'http://example.com/newsletter',
    '//example.com/newsletter',
    'javascript:alert(1)',
    '/newsletters/2026-05-25/index.html',
    '../newsletters/2026-05-25/index.html'
  ]) {
    assert.equal(
      NewsletterArchive.getSafeNewsletterHref({ ...entry, html }),
      'newsletters/2026-05-25/index.html',
      html
    );
  }
});

test('archive page renders all newsletters including latest in date-descending order', async () => {
  const { elements } = await renderArchivePage([
    newsletter('2026-05-23', 'Older issue'),
    newsletter('2026-05-25', 'Latest issue'),
    newsletter('2026-05-24', 'Middle issue')
  ]);
  const html = elements['[data-archive-grid]'].innerHTML;
  const cards = archiveCards(html);

  assert.equal(cards.length, 3);
  assert.ok(html.indexOf('Latest issue') < html.indexOf('Middle issue'));
  assert.ok(html.indexOf('Middle issue') < html.indexOf('Older issue'));
  assert.match(elements['[data-result-summary]'].textContent, /전체 3개 아카이브를 최신순으로 표시 중입니다/);
  assert.equal(elements['[data-archive-count]'].textContent, '3호');
  assert.equal(elements['[data-archive-topic-label]'].textContent, '전체');
  assert.equal(elements['[data-archive-sort-label]'].textContent, '최신순');
  assert.equal(elements['[data-archive-controls]'].hidden, false);
  assert.equal(elements['[data-empty-state]'].hidden, true);
  assert.equal(elements['[data-error-state]'].hidden, true);
  assert.equal(elements['[data-archive-pagination]'].hidden, true);
});

test('archive page paginates newsletters twelve per page and keeps page in the URL', async () => {
  const items = Array.from({ length: 15 }, (_, index) => {
    const day = String(25 - index).padStart(2, '0');
    return newsletter(`2026-05-${day}`, `Issue ${day}`);
  });
  const rendered = await renderArchivePage(items);
  const pageHandler = rendered.elements['[data-archive-pagination]'].listeners.click;
  let html = rendered.elements['[data-archive-grid]'].innerHTML;
  let cards = archiveCards(html);

  assert.equal(cards.length, 12);
  assert.match(html, /Issue 25/);
  assert.match(html, /Issue 14/);
  assert.doesNotMatch(html, /Issue 13/);
  assert.match(rendered.elements['[data-result-summary]'].textContent, /전체 15개 아카이브 중 1-12개를 최신순으로 표시 중입니다/);
  assert.equal(rendered.elements['[data-archive-count]'].textContent, '15호');
  assert.equal(rendered.elements['[data-archive-pagination]'].hidden, false);
  assert.match(rendered.elements['[data-archive-pagination]'].innerHTML, /data-archive-page="1" aria-current="page"/);
  assert.match(rendered.elements['[data-archive-pagination]'].innerHTML, /data-archive-page="2"/);

  pageHandler({ target: createPageTarget(2) });
  html = rendered.elements['[data-archive-grid]'].innerHTML;
  cards = archiveCards(html);

  assert.equal(cards.length, 3);
  assert.match(html, /Issue 13/);
  assert.match(html, /Issue 11/);
  assert.doesNotMatch(html, /Issue 14/);
  assert.match(rendered.elements['[data-result-summary]'].textContent, /전체 15개 아카이브 중 13-15개를 최신순으로 표시 중입니다/);
  assert.equal(rendered.location.search, '?page=2');
  assert.deepEqual(rendered.historyUpdates, ['/archive.html?page=2']);
});

test('archive page filters by topic, updates aria-pressed, and changes sort order', async () => {
  const rendered = await renderArchivePage([
    newsletter('2026-05-25', 'Camera issue', ['Camera HAL']),
    newsletter('2026-05-24', 'Newer Android issue', ['Android']),
    newsletter('2026-05-23', 'Older Android issue', ['Android'])
  ]);
  const topicHandler = rendered.elements['[data-topic-filter]'].listeners.click;
  const sortHandler = rendered.elements['[data-sort-control]'].listeners.change;

  topicHandler({ target: createTopicTarget('android') });
  let html = rendered.elements['[data-archive-grid]'].innerHTML;
  assert.match(html, /Newer Android issue/);
  assert.match(html, /Older Android issue/);
  assert.doesNotMatch(html, /Camera issue/);
  assert.match(rendered.elements['[data-topic-filter]'].innerHTML, /data-archive-topic="android" aria-pressed="true"/);
  assert.match(rendered.elements['[data-result-summary]'].textContent, /Android 2개 아카이브를 최신순으로 표시 중입니다/);
  assert.equal(rendered.elements['[data-archive-count]'].textContent, '2/3호');
  assert.equal(rendered.elements['[data-archive-topic-label]'].textContent, 'Android');
  assert.equal(rendered.elements['[data-archive-sort-label]'].textContent, '최신순');
  assert.equal(rendered.elements['[data-archive-pagination]'].hidden, true);

  rendered.elements['[data-sort-control]'].value = 'oldest';
  sortHandler();
  html = rendered.elements['[data-archive-grid]'].innerHTML;
  assert.ok(html.indexOf('Older Android issue') < html.indexOf('Newer Android issue'));
  assert.match(rendered.elements['[data-result-summary]'].textContent, /Android 2개 아카이브를 오래된순으로 표시 중입니다/);
  assert.equal(rendered.elements['[data-archive-sort-label]'].textContent, '오래된순');
});

test('archive page clamps stale page URLs and resets page when filters change', async () => {
  const items = Array.from({ length: 15 }, (_, index) => {
    const day = String(25 - index).padStart(2, '0');
    const tags = index < 2 ? ['Android'] : ['Camera HAL'];
    return newsletter(`2026-05-${day}`, `Issue ${day}`, tags);
  });
  const rendered = await renderArchivePage(items, { search: '?page=9' });
  const topicHandler = rendered.elements['[data-topic-filter]'].listeners.click;

  assert.equal(rendered.location.search, '?page=2');
  assert.deepEqual(rendered.historyUpdates, ['/archive.html?page=2']);
  assert.equal(archiveCards(rendered.elements['[data-archive-grid]'].innerHTML).length, 3);
  assert.match(rendered.elements['[data-result-summary]'].textContent, /전체 15개 아카이브 중 13-15개를 최신순으로 표시 중입니다/);

  topicHandler({ target: createTopicTarget('android') });

  assert.equal(rendered.location.search, '?topic=android');
  assert.match(rendered.elements['[data-result-summary]'].textContent, /Android 2개 아카이브를 최신순으로 표시 중입니다/);
  assert.equal(rendered.elements['[data-archive-pagination]'].hidden, true);
});

test('archive page canonicalizes invalid and default query state with replaceState', async () => {
  const { historyUpdates, location, elements } = await renderArchivePage([
    newsletter('2026-05-25', 'Latest issue')
  ], {
    search: '?topic=invalid&sort=latest&page=0&utm_source=x&keep=1',
    hash: '#archive'
  });

  assert.deepEqual(historyUpdates, ['/archive.html?utm_source=x&keep=1#archive']);
  assert.equal(location.search, '?utm_source=x&keep=1');
  assert.equal(location.hash, '#archive');
  assert.match(elements['[data-result-summary]'].textContent, /전체 1개 아카이브를 최신순으로 표시 중입니다/);
});

test('archive page shows no-result state for direct topic URL with no matches', async () => {
  const { elements } = await renderArchivePage([
    newsletter('2026-05-25', 'Camera issue', ['Camera HAL'])
  ], {
    search: '?topic=soc-platform'
  });

  assert.equal(elements['[data-archive-grid]'].innerHTML, '');
  assert.equal(elements['[data-empty-state]'].hidden, false);
  assert.equal(elements['[data-archive-pagination]'].hidden, true);
  assert.match(elements['[data-result-summary]'].textContent, /SoC Platform 결과가 없습니다/);
  assert.equal(elements['[data-archive-count]'].textContent, '0/1호');
  assert.match(elements['[data-topic-filter]'].innerHTML, /data-archive-topic="soc-platform" aria-pressed="true" disabled aria-disabled="true"/);
});

test('archive page shows fetch error state without exposing controls', async () => {
  const { elements, errors } = await renderArchivePage([], { fetchError: true });

  assert.equal(elements['[data-archive-controls]'].hidden, true);
  assert.equal(elements['[data-empty-state]'].hidden, true);
  assert.equal(elements['[data-error-state]'].hidden, false);
  assert.equal(elements['[data-archive-pagination]'].hidden, true);
  assert.match(elements['[data-archive-status]'].textContent, /아카이브를 불러오지 못했습니다/);
  assert.equal(errors.length, 1);
});

test('archive card date chip shows the ISO week label (W##) for weekly entries', () => {
  const html = NewsletterArchive.renderArchiveCard({
    weeklyKey: '2026-W22',
    date: '2026-05-25',
    title: '2026 W22 (05.25 ~ 05.31)',
    summary: '기사 A · 기사 B',
    tags: []
  });
  assert.match(html, /class="issue-date">W22</);
  // The visible date chip shows the week label, not the raw start date.
  assert.doesNotMatch(html, /class="issue-date">2026-05-25</);
  assert.match(html, /2026 W22 \(05\.25 ~ 05\.31\)/);
});
