const assert = require('node:assert/strict');
const test = require('node:test');

const { buildReferenceArticles } = require('../../../render/reference-articles');

function candidate(overrides = {}) {
  return {
    title: 'CameraX 1.6.0 Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
    published_date: '2026-03-25',
    relevance_bucket: 'direct_aosp_camera',
    source: 'CameraX Release Notes',
    ...overrides
  };
}

test('keeps only qualified buckets and shapes each item', () => {
  const items = buildReferenceArticles([
    candidate(),
    candidate({ title: 'Generic doc', url: 'https://example.com/x', relevance_bucket: 'generic_tech_watchlist' })
  ]);

  assert.equal(items.length, 1);
  assert.deepEqual(Object.keys(items[0]).sort(), ['note', 'published_date', 'source', 'title', 'url']);
  assert.equal(items[0].title, 'CameraX 1.6.0 Release Notes');
  assert.equal(items[0].source, 'CameraX Release Notes');
  assert.equal(items[0].published_date, '2026-03-25');
  assert.ok(items[0].note);
});

test('includes the C++/AI native tooling bucket', () => {
  const items = buildReferenceArticles([
    candidate({
      title: 'GCC 16.1 released',
      url: 'https://isocpp.org/blog/2026/04/gcc-16-1',
      relevance_bucket: 'cpp_ai_tooling_fallback',
      source: 'ISO C++ Blog'
    })
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'GCC 16.1 released');
  assert.match(items[0].note, /C\+\+|AI|툴링|tooling/i);
});

test('requires dated and sourced items', () => {
  const items = buildReferenceArticles([
    candidate({ url: 'https://a.example/1', published_date: '' }),
    candidate({ url: 'https://a.example/2', source: '' }),
    candidate({ url: '', published_date: '2026-03-01' }),
    candidate({ url: 'https://a.example/4' })
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://a.example/4');
});

test('excludes main-article URLs and de-duplicates', () => {
  const mainUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0';
  const items = buildReferenceArticles(
    [
      candidate({ url: mainUrl }),
      candidate({ title: 'Dup', url: 'https://dup.example/x' }),
      candidate({ title: 'Dup again', url: 'https://dup.example/x' })
    ],
    { excludeUrls: [mainUrl] }
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://dup.example/x');
});

test('respects the item cap (default 4)', () => {
  const many = Array.from({ length: 9 }, (_, index) =>
    candidate({ url: `https://m.example/${index}`, title: `Item ${index}` })
  );
  assert.equal(buildReferenceArticles(many).length, 4);
  assert.equal(buildReferenceArticles(many, { limit: 2 }).length, 2);
});

test('rejects items whose URL is not http or https', () => {
  const items = buildReferenceArticles([
    candidate({ url: 'javascript:alert(1)', title: 'js' }),
    candidate({ url: 'ftp://x.example/f', title: 'ftp' }),
    candidate({ url: 'https://ok.example/x', title: 'ok' })
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://ok.example/x');
});

test('returns empty for empty or non-array input', () => {
  assert.deepEqual(buildReferenceArticles([]), []);
  assert.deepEqual(buildReferenceArticles(undefined), []);
});
