const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildReferenceArticles,
  referenceArticleCandidatePool,
  referenceArticleExcludeUrls
} = require('../../../render/reference-articles');

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

// 실측 2026-08-10: 창 안 적격 후보 12건 중 기사는 2건뿐이었고, AOSP Camera ITS 문서 갱신
// 2건을 포함한 나머지는 어느 섹션에도 나오지 않았다. 참고 풀은 reference 창 후보만이 아니라
// 선정되지 않은 shortlist 후보까지 봐야 한다.
test('the candidate pool includes unselected shortlist candidates, not just reference-window ones', () => {
  const pool = referenceArticleCandidatePool({
    shortlisted_candidates: [candidate({ title: 'Unselected shortlist', url: 'https://a.example/shortlist' })],
    reference_context_candidates: [candidate({ title: 'Reference window', url: 'https://a.example/reference' })]
  });

  assert.deepEqual(pool.map(item => item.title), ['Unselected shortlist', 'Reference window']);
});

// selection이 "기사 source로 쓰면 안 된다"고 판정한 묶음글 컨테이너가 shortlist 경로로
// 참고 섹션에 다시 실리면 안 된다. main 경로와 같은 헬퍼로 뺀다.
test('the candidate pool drops parent-roundup container candidates', () => {
  const container = candidate({ title: 'Roundup container', url: 'https://a.example/roundup' });
  const child = candidate({
    title: 'Child article',
    url: 'https://a.example/roundup#child',
    related_context_candidates: [{ url: 'https://a.example/roundup', context_role: 'parent_roundup_context_only' }]
  });

  const pool = referenceArticleCandidatePool({ shortlisted_candidates: [container, child] });

  assert.deepEqual(pool.map(item => item.title), ['Child article']);
});

// 강등 기록이 render보다 먼저 채워진다는 실행 순서에 기대지 않는다.
test('the exclude list covers both selected and demoted candidates', () => {
  const urls = referenceArticleExcludeUrls({
    selected_articles: [{ url: 'https://a.example/selected' }],
    demoted_candidates: [{ url: 'https://a.example/demoted' }]
  });

  assert.deepEqual(urls.sort(), ['https://a.example/demoted', 'https://a.example/selected']);
});

test('skips null or non-object entries without throwing', () => {
  const items = buildReferenceArticles([null, undefined, 'not-a-candidate', candidate()]);

  assert.equal(items.length, 1);
});

// 같은 버킷 안에서는 오래된 reference 창 항목이 이번 주 항목보다 먼저 상한을 채우면 안 된다.
test('orders same-bucket items by published date, newest first', () => {
  const items = buildReferenceArticles([
    candidate({ title: 'Older', url: 'https://a.example/older', published_date: '2026-07-10' }),
    candidate({ title: 'Newer', url: 'https://a.example/newer', published_date: '2026-08-07' })
  ], { limit: 1 });

  assert.deepEqual(items.map(item => item.title), ['Newer']);
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
