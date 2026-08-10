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

// 실측 2026-08-10: 상한(4)이 lore 센서 패치들로 먼저 차서 그 주의 유일한 AOSP Camera 항목
// (Camera ITS 문서 갱신 2건)이 잘려 나갔다. 상한까지만 담으므로 관련도가 높은 버킷부터 채운다.
test('fills the cap in domain bucket priority order, not input order', () => {
  const items = buildReferenceArticles([
    candidate({ title: 'Tooling', url: 'https://a.example/tooling', relevance_bucket: 'cpp_ai_tooling_fallback' }),
    candidate({ title: 'Driver patch A', url: 'https://a.example/driver-a', relevance_bucket: 'camera_driver_image_pipeline' }),
    candidate({ title: 'Driver patch B', url: 'https://a.example/driver-b', relevance_bucket: 'camera_driver_image_pipeline' }),
    candidate({ title: 'Driver patch C', url: 'https://a.example/driver-c', relevance_bucket: 'camera_driver_image_pipeline' }),
    candidate({ title: 'Camera ITS tests', url: 'https://a.example/its', relevance_bucket: 'direct_aosp_camera' })
  ]);

  assert.equal(items.length, 4);
  assert.equal(items[0].title, 'Camera ITS tests', 'direct_aosp_camera가 먼저 채워진다');
  assert.deepEqual(
    items.slice(1).map(item => item.title),
    ['Driver patch A', 'Driver patch B', 'Driver patch C'],
    '같은 버킷 안에서는 입력 순서를 유지한다'
  );
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
