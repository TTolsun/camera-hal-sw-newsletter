const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function extractHomepageScript() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, 'index.html should include the homepage inline script');
  return match[1].replace(/\bloadNewsletters\(\);\s*$/, 'globalThis.__homepageReady = loadNewsletters();');
}

function createElement() {
  const element = {
    innerHTML: '',
    removedClasses: [],
    classList: {
      remove(...classNames) {
        element.removedClasses.push(...classNames);
      }
    }
  };
  return element;
}

async function renderHomepage(newsletters) {
  const script = extractHomepageScript();
  const elements = {
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
      assert.equal(url, 'data/newsletters.json');
      assert.equal(options.cache, 'no-store');
      return {
        ok: true,
        json: async () => newsletters
      };
    },
    console: {
      error(error) {
        throw error;
      }
    }
  };

  vm.runInNewContext(script, context, { filename: 'index.html' });
  assert.equal(typeof context.__homepageReady?.then, 'function');
  await context.__homepageReady;

  return elements;
}

function newsletter(date, title = `Issue ${date}`) {
  return {
    date,
    title,
    summary: `Summary ${date}`,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL']
  };
}

test('homepage shows empty states when there are no newsletters', async () => {
  const elements = await renderHomepage([]);

  assert.match(elements['latest-card'].innerHTML, /등록된 뉴스레터가 없습니다/);
  assert.match(elements['archive-list'].innerHTML, /아카이브가 비어 있습니다/);
});

test('homepage keeps the latest issue visible and shows an archive empty state for one issue', async () => {
  const items = [newsletter('2026-05-09', 'Latest issue')];
  const elements = await renderHomepage(items);

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

  const elements = await renderHomepage(items);

  assert.match(elements['latest-card'].innerHTML, /2026-05-09/);
  assert.match(elements['latest-card'].innerHTML, /Latest issue/);
  assert.doesNotMatch(elements['archive-list'].innerHTML, /2026-05-09/);
  assert.match(elements['archive-list'].innerHTML, /2026-05-08/);
  assert.match(elements['archive-list'].innerHTML, /2026-05-07/);
  assert.deepEqual(items.map(item => item.date), originalOrder);
});
