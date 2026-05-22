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

  return { elements, errors };
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

test('homepage shows empty states when there are no newsletters', async () => {
  const { elements } = await renderHomepage([]);

  assert.match(elements['latest-card'].innerHTML, /등록된 뉴스레터가 없습니다/);
  assert.match(elements['archive-list'].innerHTML, /아카이브가 비어 있습니다/);
});

test('homepage keeps the latest issue visible and shows an archive empty state for one issue', async () => {
  const items = [newsletter('2026-05-09', 'Latest issue')];
  const { elements } = await renderHomepage(items);

  assert.match(elements['latest-card'].innerHTML, /2026-05-09/);
  assert.match(elements['latest-card'].innerHTML, /Latest issue/);
  assert.match(elements['archive-list'].innerHTML, /이전 뉴스레터가 없습니다/);
});

test('homepage excludes the latest issue from archive after sorting a copy', async () => {
  const items = [
    newsletter('2026-05-07', 'Older issue'),
    newsletter('2026-05-09', 'Latest issue'),
    newsletter('2026-05-08', 'Middle issue')
  ];
  const originalOrder = items.map(item => item.date);

  const { elements } = await renderHomepage(items);

  assert.match(elements['latest-card'].innerHTML, /2026-05-09/);
  assert.match(elements['latest-card'].innerHTML, /Latest issue/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /2026-05-09/);
  assert.match(elements['archive-list'].innerHTML, /2026-05-08/);
  assert.match(elements['archive-list'].innerHTML, /2026-05-07/);
  assert.deepEqual(items.map(item => item.date), originalOrder);
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
  const { elements, errors } = await renderHomepage([newsletter('2026-05-23', 'Latest issue')], null);

  assert.equal(elements.headline.hidden, true);
  assert.match(elements['latest-card'].innerHTML, /Latest issue/);
  assert.equal(errors.length, 0);
});

test('homepage hides null headline state', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Latest issue')], {
    schemaVersion: 1,
    current_headline: null,
    headline_history: []
  });

  assert.equal(elements.headline.hidden, true);
  assert.match(elements['latest-card'].innerHTML, /Latest issue/);
});

test('homepage malformed headline state is a headline-only fallback', async () => {
  const { elements, errors } = await renderHomepage([newsletter('2026-05-23', 'Latest issue')], 'malformed');

  assert.equal(elements.headline.hidden, true);
  assert.match(elements['latest-card'].innerHTML, /Latest issue/);
  assert.equal(errors.length, 1);
});

test('homepage renders valid headline state with newsletter URL priority and escaped text', async () => {
  const { elements } = await renderHomepage([newsletter('2026-05-23', 'Latest issue')], {
    schemaVersion: 1,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: '<Camera HAL headline>',
      summary: 'Summary & details',
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
  assert.match(elements['headline-card'].innerHTML, /&lt;Camera HAL headline&gt;/);
  assert.match(elements['headline-card'].innerHTML, /Summary &amp; details/);
  assert.match(elements['headline-card'].innerHTML, /href="newsletters\/2026-05-23\/index\.html"/);
  assert.match(elements['headline-card'].innerHTML, /뉴스레터에서 보기/);
  assert.doesNotMatch(elements['headline-card'].innerHTML, /rel="noopener"/);
});
