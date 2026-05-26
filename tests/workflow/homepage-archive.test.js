const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const NewsletterArchive = require('../../assets/js/newsletter-archive');

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

function updateLocationFromUrl(location, url) {
  const parsed = new URL(url, 'https://example.com');
  location.pathname = parsed.pathname;
  location.search = parsed.search;
  location.hash = parsed.hash;
}

async function renderHomepage(newsletters, headlineState = null, options = {}) {
  const script = extractHomepageScript();
  const errors = [];
  const elements = {
    headline: createElement(),
    'headline-card': createElement(),
    'latest-card': createElement(),
    'archive-list': createElement(),
    subscribe: createElement({ hidden: true }),
    'subscription-action': createElement()
  };
  const historyUpdates = [];
  const location = {
    pathname: options.pathname || '/index.html',
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
      assert.equal(url, 'data/newsletters.json');
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

  return { elements, errors, context, historyUpdates, location };
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

function classAttribute(attrs) {
  const match = String(attrs || '').match(/\bclass="([^"]*)"/);
  return match ? match[1].split(/\s+/).filter(Boolean) : [];
}

function attrValue(attrs, name) {
  const pattern = new RegExp(`\\b${name}="([^"]*)"`);
  const match = String(attrs || '').match(pattern);
  return match ? match[1] : '';
}

function assertNoNestedInteractive(html) {
  assert.doesNotMatch(String(html), /<a\b|<button\b|\brole="button"/i);
}

function childKind(tag, attrs) {
  const classes = classAttribute(attrs);
  if (classes.includes('card-meta')) return 'card-meta';
  if (classes.includes('archive-tags')) return 'archive-tags';
  if (classes.includes('card-title')) return 'card-title';
  if (classes.includes('card-summary')) return 'card-summary';
  if (classes.includes('card-actions')) return 'card-actions';
  return tag;
}

function topLevelChildKinds(html) {
  const kinds = [];
  let depth = 0;
  for (const match of String(html).matchAll(/<\/?([a-z0-9]+)\b([^>]*)>/gi)) {
    const [source, rawTag, attrs = ''] = match;
    const tag = rawTag.toLowerCase();
    const isClosing = source.startsWith('</');
    const isSelfClosing = source.endsWith('/>');
    if (isClosing) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) {
      kinds.push(childKind(tag, attrs));
    }
    if (!isSelfClosing) depth += 1;
  }
  return kinds;
}

function readStylesheet() {
  return fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
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

test('homepage shows empty states when there are no newsletters', async () => {
  const { elements } = await renderHomepage([]);

  assert.match(elements['latest-card'].innerHTML, /등록된 뉴스레터가 없습니다/);
  assert.match(elements['archive-list'].innerHTML, /아카이브가 비어 있습니다/);
});

test('homepage keeps the latest issue visible and shows an archive empty state for one issue', async () => {
  const items = [newsletter('2026-05-09', 'Current issue')];
  const { elements } = await renderHomepage(items);

  assert.match(elements['latest-card'].innerHTML, /2026-05-09/);
  assert.match(elements['latest-card'].innerHTML, /Current issue/);
  assert.match(elements['latest-card'].innerHTML, /<span class="status-chip">Latest<\/span>/);
  assert.match(elements['latest-card'].innerHTML, /<div class="tag-row latest-tags"><span class="tag">Camera HAL<\/span><\/div>/);
  assert.equal(elements['latest-card'].href, 'newsletters/2026-05-09/index.html');
  assert.match(elements['latest-card']['aria-label'], /2026-05-09 Current issue 최신 뉴스레터 열기/);
  assertNoNestedInteractive(elements['latest-card'].innerHTML);
  assert.doesNotMatch(elements['latest-card'].innerHTML, /Markdown|button|card-actions/);
  assert.doesNotMatch(elements['latest-card'].innerHTML, /Latest issue/);
  assert.doesNotMatch(elements['latest-card'].innerHTML, />기사 보기<\/a>/);
  assert.match(elements['archive-list'].innerHTML, /이전 뉴스레터가 없습니다/);
});

test('homepage excludes the latest issue from archive after sorting a copy', async () => {
  const items = [
    newsletter('2026-05-07', 'Older issue'),
    newsletter('2026-05-09', 'Current issue'),
    newsletter('2026-05-08', 'Middle issue')
  ];
  const originalOrder = items.map(item => item.date);

  const { elements } = await renderHomepage(items);

  assert.match(elements['latest-card'].innerHTML, /2026-05-09/);
  assert.match(elements['latest-card'].innerHTML, /Current issue/);
  assert.match(elements['latest-card'].innerHTML, /<span class="status-chip">Latest<\/span>/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /2026-05-09/);
  assert.match(elements['archive-list'].innerHTML, /2026-05-08/);
  assert.match(elements['archive-list'].innerHTML, /2026-05-07/);
  const cards = archiveCardElements(elements['archive-list'].innerHTML);
  assert.equal(cards.length, 2);
  assert.equal(attrValue(cards[0].attrs, 'href'), 'newsletters/2026-05-08/index.html');
  assert.equal(attrValue(cards[1].attrs, 'href'), 'newsletters/2026-05-07/index.html');
  for (const card of cards) assertNoNestedInteractive(card.body);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /기사 보기|Markdown|card-actions/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /이슈 보기/);
  assert.deepEqual(items.map(item => item.date), originalOrder);
});

test('archive preview ignores old topic and sort query parameters without mutating history', async () => {
  const items = [
    newsletter('2026-05-10', 'Latest issue'),
    { ...newsletter('2026-05-09', 'Android archive issue'), tags: ['Android'] },
    { ...newsletter('2026-05-08', 'Camera archive issue'), tags: ['Camera HAL'] }
  ];

  const { elements, historyUpdates, location } = await renderHomepage(items, null, {
    search: '?topic=android&sort=oldest&keep=1',
    hash: '#archive'
  });

  const archiveHtml = elements['archive-list'].innerHTML;
  assert.match(archiveHtml, /Android archive issue/);
  assert.match(archiveHtml, /Camera archive issue/);
  assert.ok(archiveHtml.indexOf('Android archive issue') < archiveHtml.indexOf('Camera archive issue'));
  assert.deepEqual(historyUpdates, []);
  assert.equal(location.search, '?topic=android&sort=oldest&keep=1');
  assert.equal(location.hash, '#archive');
});

test('homepage archive preview keeps filter and sort controls delegated to archive page', async () => {
  const items = [
    newsletter('2026-05-11', 'Latest issue'),
    { ...newsletter('2026-05-10', 'Camera archive issue'), tags: ['Camera HAL'] },
    { ...newsletter('2026-05-09', 'Newer Android archive issue'), tags: ['Android'] },
    { ...newsletter('2026-05-08', 'Older Android archive issue'), tags: ['Android'] }
  ];

  const { elements, historyUpdates } = await renderHomepage(items);

  const archiveHtml = elements['archive-list'].innerHTML;
  assert.match(archiveHtml, /Camera archive issue/);
  assert.match(archiveHtml, /Newer Android archive issue/);
  assert.match(archiveHtml, /Older Android archive issue/);
  assert.ok(archiveHtml.indexOf('Camera archive issue') < archiveHtml.indexOf('Newer Android archive issue'));
  assert.ok(archiveHtml.indexOf('Newer Android archive issue') < archiveHtml.indexOf('Older Android archive issue'));
  assert.equal(elements['topic-filter-list'], undefined);
  assert.equal(elements['archive-sort'], undefined);
  assert.equal(elements['archive-filter-shortcut'], undefined);
  assert.deepEqual(historyUpdates, []);
});

test('archive preview shows fetch error without toolbar state', async () => {
  const { elements, errors } = await renderHomepage([], null, { newsletterFetchError: true });

  assert.match(elements['latest-card'].innerHTML, /뉴스레터 정보를 불러오지 못했습니다/);
  assert.match(elements['archive-list'].innerHTML, /아카이브 정보를 불러오지 못했습니다/);
  assert.equal(errors.length, 1);
});

test('renders at most four archive preview cards after sorting and excluding the latest newsletter', async () => {
  const items = [
    newsletter('2026-05-19'),
    newsletter('2026-05-20'),
    newsletter('2026-05-26', 'Latest issue'),
    newsletter('2026-05-21'),
    newsletter('2026-05-25'),
    newsletter('2026-05-22'),
    newsletter('2026-05-24'),
    newsletter('2026-05-23')
  ];

  const { elements } = await renderHomepage(items);
  const cards = archiveCards(elements['archive-list'].innerHTML);

  assert.equal(cards.length, 4);
  assert.match(elements['latest-card'].innerHTML, /2026-05-26/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /2026-05-26/);
  for (const date of ['2026-05-25', '2026-05-24', '2026-05-23', '2026-05-22']) {
    assert.match(elements['archive-list'].innerHTML, new RegExp(date));
  }
  assert.doesNotMatch(elements['archive-list'].innerHTML, /2026-05-21/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /2026-05-20/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /2026-05-19/);
});

test('archive card order, clamps, and tag overflow keep archive cards scannable', async () => {
  const archiveItem = {
    ...newsletter('2026-05-24', 'Archive card title'),
    summary: 'Archive card summary',
    tags: ['Camera HAL', 'Camera "HAL" & Android', 'CameraX', 'Image Processing', 'AOSP <Camera>']
  };
  const { elements } = await renderHomepage([
    newsletter('2026-05-25', 'Latest issue'),
    archiveItem
  ]);
  const [card] = archiveCards(elements['archive-list'].innerHTML);

  assert.deepEqual(topLevelChildKinds(card), [
    'card-meta',
    'archive-tags',
    'card-title',
    'card-summary'
  ]);
  assert.match(card, /<h3 class="card-title clamp-2">Archive card title<\/h3>/);
  assert.match(card, /<p class="card-summary archive-card-summary clamp-3">Archive card summary<\/p>/);
  assert.match(card, /<span class="tag">Camera HAL<\/span>/);
  assert.match(card, /<span class="tag">Camera &quot;HAL&quot; &amp; Android<\/span>/);
  assert.match(card, /<span class="tag">CameraX<\/span>/);
  assert.match(card, /class="tag tag-more" aria-label="추가 태그 2개: Image Processing, AOSP &lt;Camera&gt;" title="Image Processing, AOSP &lt;Camera&gt;">\+2<\/span>/);
});

test('archive cards omit empty tag rows while preserving the remaining child order', async () => {
  const archiveItem = {
    ...newsletter('2026-05-24', 'No tags archive card'),
    tags: []
  };
  const { elements } = await renderHomepage([
    newsletter('2026-05-25', 'Latest issue'),
    archiveItem
  ]);
  const [card] = archiveCards(elements['archive-list'].innerHTML);

  assert.deepEqual(topLevelChildKinds(card), [
    'card-meta',
    'card-title',
    'card-summary'
  ]);
  assert.doesNotMatch(card, /archive-tags/);
});

test('does not remove the featured headline newsletter from archive unless it is the latest newsletter', async () => {
  const { elements } = await renderHomepage([
    newsletter('2026-05-25', 'Latest issue'),
    newsletter('2026-05-24', 'Featured archive issue'),
    newsletter('2026-05-23', 'Older archive issue')
  ], {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: 'Featured archive headline',
      summary: 'Featured archive summary',
      source_url: 'https://example.com/source',
      newsletter_date: '2026-05-24',
      newsletter_url: 'newsletters/2026-05-24/index.html',
      selected_at: '2026-05-24',
      snapshot: {
        source_name: 'Example Source'
      }
    },
    headline_history: []
  });

  assert.match(elements['headline-card'].innerHTML, /Featured archive headline/);
  assert.match(elements['archive-list'].innerHTML, /Featured archive issue/);
  assert.match(elements['archive-list'].innerHTML, /Older archive issue/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /Latest issue/);
});

test('homepage shows review publication issues when data entry paths are present', async () => {
  const items = [
    newsletter('2026-05-13', 'Previous issue'),
    newsletter('2026-05-14', 'Review publication issue')
  ];

  const { elements } = await renderHomepage(items);

  assert.match(elements['latest-card'].innerHTML, /2026-05-14/);
  assert.match(elements['latest-card'].innerHTML, /Review publication issue/);
  assert.equal(elements['latest-card'].href, 'newsletters/2026-05-14/index.html');
  assert.match(elements['archive-list'].innerHTML, /2026-05-13/);
});

test('only Latest appears beside a homepage date while archive keeps fallback tags below metadata', async () => {
  const { elements } = await renderHomepage([
    fallbackNewsletter('2026-05-20', 'Archived fallback issue'),
    fallbackNewsletter('2026-05-24', 'Current fallback issue')
  ]);
  const [archiveCard] = archiveCards(elements['archive-list'].innerHTML);
  const latestMeta = elements['latest-card'].innerHTML.match(/<div class="card-meta">([\s\S]*?)<\/div>/)?.[1] || '';
  const archiveMeta = archiveCard.match(/<div class="card-meta archive-card-meta">([\s\S]*?)<\/div>/)?.[1] || '';

  assert.match(latestMeta, /<span class="issue-date">2026-05-24<\/span>\s*<span class="status-chip">Latest<\/span>/);
  assert.doesNotMatch(latestMeta, /Tooling Watch Edition/);
  assert.match(elements['latest-card'].innerHTML, /Current fallback issue/);
  assert.match(archiveMeta, /<span class="issue-date">2026-05-20<\/span>/);
  assert.doesNotMatch(archiveMeta, /status-chip|Tooling Watch Edition/);
  assert.match(archiveCard, /<div class="tag-row archive-tags"><span class="tag">Tooling Watch Edition<\/span><span class="tag">Tooling Watch<\/span><\/div>/);
  assertNoNestedInteractive(archiveCard);
});

test('homepage and archive accept single-article public issues as normal entries', async () => {
  const items = [
    newsletter('2026-05-20', 'Previous one-article issue'),
    newsletter('2026-05-21', 'Latest one-article issue')
  ];

  const { elements } = await renderHomepage(items);

  assert.match(elements['latest-card'].innerHTML, /2026-05-21/);
  assert.match(elements['latest-card'].innerHTML, /Latest one-article issue/);
  assert.equal(elements['latest-card'].href, 'newsletters/2026-05-21/index.html');
  assert.match(elements['archive-list'].innerHTML, /2026-05-20/);
  assert.match(elements['archive-list'].innerHTML, /Previous one-article issue/);
  assert.doesNotMatch(elements['latest-card'].innerHTML, /review-only|diagnostics-only|Tooling Watch Edition/i);
});

test('homepage headline fetch absence does not block latest/archive rendering', async () => {
  const { elements, errors } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], null);

  assert.equal(elements.headline.hidden, true);
  assert.match(elements['latest-card'].innerHTML, /Current issue/);
  assert.equal(errors.length, 0);
});

test('homepage hides null headline state', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], {
    schemaVersion: 1,
    current_headline: null,
    headline_history: []
  });

  assert.equal(elements.headline.hidden, true);
  assert.match(elements['latest-card'].innerHTML, /Current issue/);
});

test('homepage malformed headline state is a headline-only fallback', async () => {
  const { elements, errors } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], 'malformed');

  assert.equal(elements.headline.hidden, true);
  assert.match(elements['latest-card'].innerHTML, /Current issue/);
  assert.equal(errors.length, 1);
});

test('homepage renders valid headline state with article URL priority, image, and escaped text', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: '<Camera HAL headline>',
      summary: 'Summary & details',
      source_url: 'https://example.com/source',
      newsletter_date: '2026-05-23',
      newsletter_url: 'newsletters/2026-05-23/index.html',
      newsletter_article_url: 'newsletters/2026-05-23/index.html#article-camerax-preview',
      image_url: 'https://example.com/headline.png',
      image_alt: '<Camera preview image>',
      selected_at: '2026-05-23',
      snapshot: {
        source_name: 'Example Source'
      }
    },
    headline_history: []
  });

  assert.equal(elements.headline.hidden, false);
  assert.match(elements['headline-card'].innerHTML, /<figure class="headline-media">/);
  assert.match(elements['headline-card'].innerHTML, /&lt;Camera HAL headline&gt;/);
  assert.match(elements['headline-card'].innerHTML, /Summary &amp; details/);
  assert.match(elements['headline-card'].innerHTML, /<img src="https:\/\/example\.com\/headline\.png" alt="&lt;Camera preview image&gt;" loading="lazy" decoding="async" data-homepage-image-fallback>/);
  assert.match(elements['headline-card'].innerHTML, /<div class="tag-row headline-tags"><span class="tag">Camera HAL<\/span><\/div>/);
  assert.match(elements['headline-card'].innerHTML, /class="card-title clamp-2"/);
  assert.match(elements['headline-card'].innerHTML, /class="card-summary clamp-3"/);
  assert.match(elements['headline-card'].innerHTML, /href="newsletters\/2026-05-23\/index\.html#article-camerax-preview"/);
  assert.match(elements['headline-card'].innerHTML, /기사 보기/);
  assert.match(elements['headline-card'].innerHTML, /href="newsletters\/2026-05-23\/newsletter\.md">Markdown<\/a>/);
  assert.match(elements['headline-card'].innerHTML, /Headline/);
  assert.doesNotMatch(elements['headline-card'].innerHTML, /rel="noopener"/);
});

test('homepage headline renders missing image fallback without hiding metadata', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: 'Camera HAL headline',
      summary: 'Camera HAL summary',
      source_url: 'https://example.com/source',
      newsletter_date: '2026-05-23',
      newsletter_url: 'newsletters/2026-05-23/index.html',
      selected_at: '2026-05-23',
      snapshot: {
        source_name: 'Example Source'
      }
    },
    headline_history: []
  });

  assert.equal(elements.headline.hidden, false);
  assert.match(elements['headline-card'].innerHTML, /<div class="headline-media is-image-unavailable" aria-hidden="true">/);
  assert.match(elements['headline-card'].innerHTML, /이미지 없음/);
  assert.match(elements['headline-card'].innerHTML, /2026-05-23/);
  assert.match(elements['headline-card'].innerHTML, /Example Source/);
});

test('homepage headline image error handler hides broken image and marks fallback state', async () => {
  const { context } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: 'Camera HAL headline',
      summary: 'Camera HAL summary',
      source_url: 'https://example.com/source',
      newsletter_date: '2026-05-23',
      newsletter_url: 'newsletters/2026-05-23/index.html',
      image_url: 'https://example.com/broken.png',
      image_alt: 'Broken image',
      selected_at: '2026-05-23',
      snapshot: {
        source_name: 'Example Source'
      }
    },
    headline_history: []
  });
  const addedClasses = [];
  const image = {
    hidden: false,
    closest(selector) {
      assert.equal(selector, '.headline-media');
      return {
        classList: {
          add(value) {
            addedClasses.push(value);
          }
        }
      };
    }
  };

  context.handleHomepageImageError({ currentTarget: image });

  assert.equal(image.hidden, true);
  assert.deepEqual(addedClasses, ['is-image-unavailable']);
});

test('homepage headline omits malformed matched tags while keeping source metadata', async () => {
  const malformedNewsletter = {
    ...newsletter('2026-05-23', 'Current issue'),
    tags: 'Camera HAL'
  };
  const { elements } = await renderHomepage([malformedNewsletter], {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: 'Camera HAL headline',
      summary: 'Camera HAL summary',
      source_url: 'https://example.com/source',
      newsletter_date: '2026-05-23',
      newsletter_url: 'newsletters/2026-05-23/index.html',
      selected_at: '2026-05-23',
      snapshot: {
        source_name: 'Example Source'
      }
    },
    headline_history: []
  });

  assert.equal(elements.headline.hidden, false);
  assert.doesNotMatch(elements['headline-card'].innerHTML, /headline-tags/);
  assert.match(elements['headline-card'].innerHTML, /2026-05-23/);
  assert.match(elements['headline-card'].innerHTML, /Example Source/);
});

test('homepage clamps long card copy without truncating escaped DOM text', async () => {
  const longTitle = '<Camera HAL headline with a very long title that should stay fully present in the DOM>';
  const longSummary = 'Summary & details with enough words to represent a long homepage card summary that is visually clamped but not removed from the markup.';
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: longTitle,
      summary: longSummary,
      source_url: 'https://example.com/source',
      newsletter_date: '2026-05-23',
      newsletter_url: 'newsletters/2026-05-23/index.html',
      selected_at: '2026-05-23',
      snapshot: {
        source_name: 'Example Source'
      }
    },
    headline_history: []
  });

  assert.match(elements['headline-card'].innerHTML, /class="card-title clamp-2"/);
  assert.match(elements['headline-card'].innerHTML, /&lt;Camera HAL headline with a very long title that should stay fully present in the DOM&gt;/);
  assert.match(elements['headline-card'].innerHTML, /class="card-summary clamp-3"/);
  assert.match(elements['headline-card'].innerHTML, /Summary &amp; details with enough words to represent a long homepage card summary that is visually clamped but not removed from the markup\./);
});

test('homepage headline falls back to external source CTA when no newsletter URL is available', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Current issue')], {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: 'Camera HAL headline',
      summary: 'Camera HAL summary',
      source_url: 'https://example.com/source',
      selected_at: '2026-05-23',
      snapshot: {}
    },
    headline_history: []
  });

  assert.equal(elements.headline.hidden, false);
  assert.match(elements['headline-card'].innerHTML, /출처/);
  assert.match(elements['headline-card'].innerHTML, /href="https:\/\/example\.com\/source" rel="noopener"/);
  assert.match(elements['headline-card'].innerHTML, /원문 보기/);
});

test('homepage exposes clear Featured and Latest heading rows without changing heading levels', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(html, /모바일 카메라의[\s\S]*hero-title-nowrap[\s\S]*어제와 오늘,[\s\S]*그리고 내일/);
  assert.match(html, /Camera HAL, Android, Linux Driver, AI 기술을 중심으로 모바일 카메라 기술의 변화를 추적합니다\./);
  assert.match(html, /class="nav-links homepage-nav-links"[\s\S]*href="index\.html">Home<\/a>[\s\S]*href="archive\.html">Archive<\/a>[\s\S]*href="https:\/\/github\.com\/TTolsun\/camera-hal-sw-newsletter">GitHub<\/a>/);
  assert.match(html, /<a class="button button-secondary" href="#archive">/);
  assert.doesNotMatch(html, /homepage-header-actions|icon-menu|icon-search|Archive로 이동|Archive 탐색/);
  assert.match(html, /<section id="headline"[\s\S]*?<div class="section-heading section-heading-row">[\s\S]*?<h2 id="headline-title">Featured Headline<\/h2>/);
  assert.match(html, /<section id="latest"[\s\S]*?<span class="section-icon section-icon-latest" aria-hidden="true"><\/span>[\s\S]*?<h2 id="latest-title">Latest Newsletter<\/h2>[\s\S]*?<\/div>\s*<\/div>\s*<a id="latest-card"/);
  assert.match(html, /<section id="archive"[\s\S]*?<span class="section-icon section-icon-archive" aria-hidden="true"><\/span>[\s\S]*?<h2 id="archive-title">Archive<\/h2>[\s\S]*?<div class="archive-controls">\s*<a class="section-link" href="archive\.html">전체 아카이브 보기<\/a>\s*<\/div>/);
  assert.match(html, /<article id="headline-card" class="headline-card"><\/article>/);
  assert.match(html, /<a id="latest-card" class="newsletter-card latest-newsletter-card loading-card">/);
});

test('homepage removes local archive controls and delegates browsing to archive.html', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.doesNotMatch(html, /주제 키워드로 빠르게 탐색하세요|id="topic-filter-list"|data-homepage-topic/);
  assert.doesNotMatch(html, /id="archive-sort"|id="archive-filter-shortcut"|Archive sort order/);
  assert.doesNotMatch(html, /archive-toolbar|archive-result-summary/);
  assert.doesNotMatch(html, /readArchiveStateFromUrl|replaceArchiveUrl|URLSearchParams|normalizeArchiveState|filterEntries/);
  assert.match(html, /<div class="archive-controls">\s*<a class="section-link" href="archive\.html">전체 아카이브 보기<\/a>\s*<\/div>/);
});

test('archive grid CSS caps columns and preserves card interaction layout contracts', () => {
  const css = readStylesheet();
  const archiveGrid = exactSelectorBlock(css, '.archive-grid');
  const archiveCard = exactSelectorBlock(css, '.archive-card');
  const archivePageSection = exactSelectorBlock(css, '.archive-page-section');
  const archivePageGrid = exactSelectorBlock(css, '.archive-page .archive-grid');
  const archivePageCard = exactSelectorBlock(css, '.archive-page .archive-card');
  const archiveFocus = exactSelectorBlock(css, '.archive-card:focus-visible');
  const archivePagination = exactSelectorBlock(css, '.archive-pagination');
  const archivePageButton = exactSelectorBlock(css, '.archive-page-button');
  const archivePageCurrent = exactSelectorBlock(css, '.archive-page-button.is-current');
  const mediumGrid = exactSelectorBlock(mediaBlock(css, '(min-width: 700px)'), '.archive-grid');

  assertCssDeclaration(archiveGrid, 'display', 'grid');
  assertCssDeclaration(archiveGrid, 'grid-template-columns', '1fr');
  assertCssDeclaration(mediumGrid, 'grid-template-columns', 'repeat(2, minmax(0, 1fr))');
  assert.doesNotMatch(css, /@media \(min-width: 1100px\)[\s\S]*?\.archive-grid[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assertCssDeclaration(archiveCard, 'display', 'flex');
  assertCssDeclaration(archiveCard, 'flex-direction', 'column');
  assertCssDeclaration(archivePageSection, 'min-height', '520px');
  assertCssDeclaration(archivePageGrid, 'gap', 'var(--space-5)');
  assertCssDeclaration(archivePageCard, 'padding', '22px 24px');
  assert.match(archiveFocus, /outline\s*:\s*3px solid var\(--focus-ring\)\s*;/);
  assertCssDeclaration(archiveFocus, 'outline-offset', '4px');
  assertCssDeclaration(archivePagination, 'justify-content', 'center');
  assertCssDeclaration(archivePageButton, 'min-width', '42px');
  assertCssDeclaration(archivePageButton, 'border-radius', 'var(--radius-xs)');
  assertCssDeclaration(archivePageCurrent, 'background', '#0f8f49');
});

test('homepage shell stays wide while hero second line remains unwrapped', () => {
  const css = readStylesheet();
  const homepageNav = exactSelectorBlock(css, '.homepage-nav');
  const homepageWrap = exactSelectorBlock(css, '.homepage .content-wrap');
  const homepageShell = exactSelectorBlock(css, '.homepage .site-header,\n.homepage .site-main,\n.homepage .site-footer');
  const hero = exactSelectorBlock(css, '.homepage .site-hero');
  const heroTitle = exactSelectorBlock(css, '.homepage .site-hero h1');
  const heroPrimaryCta = exactSelectorBlock(css, '.homepage .hero-actions .button-primary');
  const nowrapTitle = exactSelectorBlock(css, '.homepage .hero-title-nowrap');
  const tabletHero = exactSelectorBlock(mediaBlock(css, '(max-width: 860px)'), '.homepage .site-hero');
  const mobile = mediaBlock(css, '(max-width: 640px)');
  const mobileHero = exactSelectorBlock(mobile, '.homepage .site-hero');
  const mobileHeroTitle = exactSelectorBlock(mediaBlock(css, '(max-width: 640px)'), '.homepage .site-hero h1');

  assertCssDeclaration(homepageNav, 'justify-content', 'space-between');
  assertCssDeclaration(homepageWrap, 'width', 'min(100% - 48px, 1120px)');
  assertCssDeclaration(homepageShell, 'width', 'min(100% - 28px, 1200px)');
  assertCssDeclaration(hero, 'width', 'min(100% - 48px, 1120px)');
  assertCssDeclaration(hero, 'grid-template-columns', 'minmax(0, 1.12fr) minmax(260px, 0.52fr)');
  assertCssDeclaration(hero, 'gap', 'clamp(40px, 5.5vw, 80px)');
  assertCssDeclaration(nowrapTitle, 'white-space', 'nowrap');
  assertCssDeclaration(heroTitle, 'font-size', 'clamp(2rem, 4vw, 3.3rem)');
  assertCssDeclaration(heroPrimaryCta, 'border-color', '#0f8f49');
  assert.match(heroPrimaryCta, /background\s*:\s*linear-gradient\(135deg, #0c9650 0%, #08783a 100%\)\s*;/);
  assertCssDeclaration(tabletHero, 'grid-template-columns', '1fr');
  assertCssDeclaration(tabletHero, 'gap', '18px');
  assertCssDeclaration(mobileHero, 'gap', '14px');
  assertCssDeclaration(mobileHeroTitle, 'font-size', 'clamp(1.53rem, 7.2vw, 2.1rem)');
  assert.doesNotMatch(css, /homepage-header-actions|icon-link|icon-menu|icon-search|section-icon-bolt/);
});

test('latest and archive card CSS preserves whole-card links and mobile summary behavior', () => {
  const css = readStylesheet();
  const cardLink = exactSelectorBlock(css, '.newsletter-card,\n.archive-card');
  const latestFocus = exactSelectorBlock(css, '.latest-newsletter-card[href]:focus-visible');
  const emptyState = exactSelectorBlock(css, '.archive-empty-state');
  const mobile = mediaBlock(css, '(max-width: 640px)');

  assertCssDeclaration(cardLink, 'text-decoration', 'none');
  assert.match(latestFocus, /outline\s*:\s*3px solid var\(--focus-ring\)\s*;/);
  assertCssDeclaration(emptyState, 'grid-column', '1 / -1');
  assert.match(mobile, /main:not\(\[data-page="archive"\]\) #archive-list \.archive-card-summary\s*\{[\s\S]*?display\s*:\s*none\s*;/);
  assert.doesNotMatch(mobile, /latest-card-summary\s*\{[\s\S]*?display\s*:\s*none\s*;/);
  assert.doesNotMatch(css, /archive-toolbar/);
  assert.match(css, /main:not\(\[data-page="archive"\]\) #archive-list \.archive-card-summary/);
  assert.doesNotMatch(css, /filter-shortcut/);
});

test('newsletter issue page CSS uses homepage shell with issue landing layout', () => {
  const css = readStylesheet();
  const pageBackground = exactSelectorBlock(css, '.homepage,\n.newsletter-issue-page');
  const issueArticlePage = exactSelectorBlock(css, '.newsletter-issue-page .article-page');
  const issueWrap = exactSelectorBlock(css, '.newsletter-issue-page .wrap');
  const issueHero = exactSelectorBlock(css, '.newsletter-issue-page .issue-hero');
  const issueHeroGlow = exactSelectorBlock(css, '.newsletter-issue-page .issue-hero::before');
  const issueMascotContainer = exactSelectorBlock(css, '.issue-hero-mascot');
  const issueMascot = exactSelectorBlock(css, '.issue-hero-mascot img');
  const issueTitle = exactSelectorBlock(css, '.newsletter-issue-page .article-header h1');
  const issueArticleTitle = exactSelectorBlock(css, '.newsletter-issue-page .article-title');
  const issueCard = exactSelectorBlock(css, '.newsletter-issue-page .issue-section');
  const issueFeatureRow = exactSelectorBlock(css, '.article-feature-row');
  const issueStory = exactSelectorBlock(css, '.issue-story');
  const issueStoryNumber = exactSelectorBlock(css, '.issue-story-number');
  const issueTakeaway = exactSelectorBlock(css, '.newsletter-issue-page .camera-hal-takeaway');
  const issueMobileHeroAndRow = exactSelectorBlock(mediaBlock(css, '(max-width: 860px)'), '.newsletter-issue-page .issue-hero,\n  .newsletter-issue-page .article-feature-row');
  const issueMobileArticlePage = exactSelectorBlock(mediaBlock(css, '(max-width: 860px)'), '.newsletter-issue-page .article-page');
  const issueMobileHero = exactSelectorBlock(mediaBlock(css, '(max-width: 860px)'), '.newsletter-issue-page .issue-hero');
  const issueMobileHeroGlow = exactSelectorBlock(mediaBlock(css, '(max-width: 860px)'), '.site-hero::before,\n  .archive-hero::before,\n  .newsletter-issue-page .issue-hero::before');
  const issueMobileMascot = exactSelectorBlock(mediaBlock(css, '(max-width: 860px)'), '.issue-hero-mascot');
  const issueMobileMascotImage = exactSelectorBlock(mediaBlock(css, '(max-width: 860px)'), '.issue-hero-mascot img');
  const issueCompactHero = exactSelectorBlock(mediaBlock(css, '(max-width: 640px)'), '.newsletter-issue-page .issue-hero');
  const issueCompactMascot = exactSelectorBlock(mediaBlock(css, '(max-width: 640px)'), '.archive-hero-mascot,\n  .issue-hero-mascot');
  const issueCompactMascotImage = exactSelectorBlock(mediaBlock(css, '(max-width: 640px)'), '.hero-mascot img,\n  .archive-hero-mascot img,\n  .issue-hero-mascot img');

  assert.match(pageBackground, /radial-gradient\(circle at 50% -80px, rgba\(24, 128, 56, 0\.09\), transparent 34%\)/);
  assertCssDeclaration(issueArticlePage, 'padding', '52px 0 0');
  assertCssDeclaration(issueWrap, 'width', 'min(100% - 48px, 1120px)');
  assertCssDeclaration(issueWrap, 'max-width', 'none');
  assertCssDeclaration(issueHero, 'grid-template-columns', 'minmax(0, 1.12fr) minmax(260px, 0.52fr)');
  assertCssDeclaration(issueHero, 'padding', '46px 0 42px');
  assertCssDeclaration(issueHeroGlow, 'width', 'min(38vw, 440px)');
  assert.match(issueHeroGlow, /rgba\(24, 128, 56, 0\.12\)/);
  assert.doesNotMatch(css, /issue-actions|bottom-nav|newsletter-actions/);
  assertCssDeclaration(issueMascotContainer, 'transform', 'none');
  assertCssDeclaration(issueMascot, 'width', 'min(100%, clamp(260px, 32vw, 420px))');
  assert.match(issueMascot, /drop-shadow\(0 16px 28px rgba\(15, 23, 42, 0\.11\)\)/);
  assertCssDeclaration(issueTitle, 'font-size', 'clamp(1.75rem, 3.55vw, 2.95rem)');
  assertCssDeclaration(issueArticleTitle, 'font-size', 'clamp(1.24rem, 2.05vw, 1.6rem)');
  assertCssDeclaration(issueCard, 'padding', '28px');
  assertCssDeclaration(issueFeatureRow, 'grid-template-columns', 'minmax(260px, 0.9fr) minmax(0, 1.1fr)');
  assertCssDeclaration(issueStory, 'padding-left', '38px');
  assertCssDeclaration(issueStoryNumber, 'border-radius', '50%');
  assertCssDeclaration(issueTakeaway, 'border-radius', '12px');
  assertCssDeclaration(issueMobileHeroAndRow, 'grid-template-columns', '1fr');
  assertCssDeclaration(issueMobileArticlePage, 'padding-top', '28px');
  assertCssDeclaration(issueMobileHero, 'padding-top', '24px');
  assertCssDeclaration(issueMobileHero, 'padding-bottom', '30px');
  assertCssDeclaration(issueMobileHeroGlow, 'width', 'min(64vw, 340px)');
  assertCssDeclaration(issueMobileMascot, 'justify-content', 'center');
  assertCssDeclaration(issueMobileMascot, 'transform', 'none');
  assertCssDeclaration(issueMobileMascotImage, 'width', 'min(100%, 340px)');
  assertCssDeclaration(issueCompactHero, 'padding-top', '18px');
  assertCssDeclaration(issueCompactHero, 'padding-bottom', '24px');
  assertCssDeclaration(issueCompactMascot, 'transform', 'none');
  assertCssDeclaration(issueCompactMascotImage, 'width', 'min(100%, 300px)');
});
