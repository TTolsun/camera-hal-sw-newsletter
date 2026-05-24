const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');

function extractHomepageScript() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>\s*([\s\S]*?)\s*<\/script>/gi)]
    .map(match => match[1]);
  const homepageScript = scripts.find(script =>
    /\basync function loadNewsletters\b/.test(script) &&
    /\basync function loadHomepageHeadline\b/.test(script) &&
    /\bloadNewsletters\(\);\s*$/.test(script)
  );
  assert.ok(homepageScript, 'index.html should include the homepage newsletter script');
  return homepageScript.replace(
    /\bloadHomepageHeadline\(\);\s*\n\s*loadNewsletters\(\);\s*$/,
    'globalThis.__headlineReady = loadHomepageHeadline();\n    globalThis.__homepageReady = loadNewsletters();'
  );
}

function createElement() {
  return {
    innerHTML: '',
    hidden: false,
    classList: {
      add() {},
      remove() {}
    }
  };
}

async function renderHomepage(newsletters, headlineState = null) {
  const script = extractHomepageScript();
  const errors = [];
  const elements = {
    headline: createElement(),
    'headline-card': createElement(),
    'latest-card': createElement(),
    'archive-list': createElement()
  };

  const context = {
    document: {
      getElementById(id) {
        return elements[id];
      }
    },
    fetch: async (url, options) => {
      assert.equal(options.cache, 'no-store');
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
      assert.equal(url, 'data/newsletters.json');
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
  await context.__headlineReady;
  await context.__homepageReady;

  return { elements, errors, context };
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

function archiveCards(html) {
  return [...String(html).matchAll(/<article class="archive-card">([\s\S]*?)<\/article>/g)]
    .map(match => match[1]);
}

function classAttribute(attrs) {
  const match = String(attrs || '').match(/\bclass="([^"]*)"/);
  return match ? match[1].split(/\s+/).filter(Boolean) : [];
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
  assert.match(elements['latest-card'].innerHTML, /<a class="button button-primary" href="newsletters\/2026-05-09\/index\.html">최신호 보기<\/a>/);
  assert.match(elements['latest-card'].innerHTML, /<a class="button button-secondary" href="newsletters\/2026-05-09\/newsletter\.md">Markdown<\/a>/);
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
  assert.match(elements['archive-list'].innerHTML, /<article class="archive-card">/);
  assert.match(elements['archive-list'].innerHTML, /기사 보기/);
  assert.match(elements['archive-list'].innerHTML, /Markdown/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /이슈 보기/);
  assert.deepEqual(items.map(item => item.date), originalOrder);
});

test('renders archive cards for all newsletters except the latest newsletter', async () => {
  const items = [
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

  assert.equal(cards.length, 6);
  assert.match(elements['latest-card'].innerHTML, /2026-05-26/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /2026-05-26/);
  for (const date of ['2026-05-25', '2026-05-24', '2026-05-23', '2026-05-22', '2026-05-21', '2026-05-20']) {
    assert.match(elements['archive-list'].innerHTML, new RegExp(date));
  }
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
    'card-summary',
    'card-actions'
  ]);
  assert.match(card, /<h3 class="card-title clamp-2">Archive card title<\/h3>/);
  assert.match(card, /<p class="card-summary clamp-3">Archive card summary<\/p>/);
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
    'card-summary',
    'card-actions'
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
  assert.match(elements['latest-card'].innerHTML, /newsletters\/2026-05-14\/index\.html/);
  assert.match(elements['archive-list'].innerHTML, /2026-05-13/);
});

test('homepage and archive accept single-article public issues as normal entries', async () => {
  const items = [
    newsletter('2026-05-20', 'Previous one-article issue'),
    newsletter('2026-05-21', 'Latest one-article issue')
  ];

  const { elements } = await renderHomepage(items);

  assert.match(elements['latest-card'].innerHTML, /2026-05-21/);
  assert.match(elements['latest-card'].innerHTML, /Latest one-article issue/);
  assert.match(elements['latest-card'].innerHTML, /newsletters\/2026-05-21\/index\.html/);
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

  assert.match(html, /<section id="headline"[\s\S]*?<div class="section-heading section-heading-row">[\s\S]*?<h2 id="headline-title">Featured Headline<\/h2>/);
  assert.match(html, /<section id="latest"[\s\S]*?<div class="section-heading section-heading-row">[\s\S]*?<h2 id="latest-title">Latest Newsletter<\/h2>/);
  assert.match(html, /<article id="headline-card" class="headline-card"><\/article>/);
  assert.match(html, /<div id="latest-card" class="newsletter-card latest-newsletter-card loading-card">/);
});

test('archive grid CSS caps columns and preserves card interaction layout contracts', () => {
  const css = readStylesheet();
  const archiveGrid = exactSelectorBlock(css, '.archive-grid');
  const archiveCard = exactSelectorBlock(css, '.archive-card');
  const archiveActions = exactSelectorBlock(css, '.archive-card .card-actions');
  const archiveFocus = exactSelectorBlock(css, '.archive-card:focus-within');
  const mediumGrid = exactSelectorBlock(mediaBlock(css, '(min-width: 700px)'), '.archive-grid');
  const wideGrid = exactSelectorBlock(mediaBlock(css, '(min-width: 1100px)'), '.archive-grid');

  assertCssDeclaration(archiveGrid, 'display', 'grid');
  assertCssDeclaration(archiveGrid, 'grid-template-columns', '1fr');
  assertCssDeclaration(mediumGrid, 'grid-template-columns', 'repeat(2, minmax(0, 1fr))');
  assertCssDeclaration(wideGrid, 'grid-template-columns', 'repeat(3, minmax(0, 1fr))');
  assertCssDeclaration(archiveCard, 'display', 'flex');
  assertCssDeclaration(archiveCard, 'flex-direction', 'column');
  assertCssDeclaration(archiveActions, 'margin-top', 'auto');
  assert.match(archiveFocus, /outline\s*:\s*3px solid var\(--focus-ring\)\s*;/);
  assertCssDeclaration(archiveFocus, 'outline-offset', '4px');
});
