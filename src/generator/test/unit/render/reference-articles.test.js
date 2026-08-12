const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildReferenceArticles,
  buildReferenceArticlesForIssue,
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

// 라이브 결함을 실제로 고친 것은 "shortlistReport에서 풀을 조립해 참고 섹션을 만든다"는 배선이다.
// 발행 파이프라인이 부르는 그 조합을 그대로 잠근다.
test('builds the issue reference section from a shortlist report end to end', () => {
  const items = buildReferenceArticlesForIssue({
    shortlisted_candidates: [
      candidate({ title: 'Selected main', url: 'https://a.example/selected', published_date: '2026-08-09' }),
      candidate({ title: 'Unselected shortlist', url: 'https://a.example/shortlist', published_date: '2026-08-08' }),
      candidate({ title: 'Demoted', url: 'https://a.example/demoted', published_date: '2026-08-07' })
    ],
    reference_context_candidates: [
      candidate({ title: 'Reference window', url: 'https://a.example/reference', published_date: '2026-07-10' })
    ],
    selected_articles: [{ url: 'https://a.example/selected' }],
    demoted_candidates: [{ url: 'https://a.example/demoted' }]
  });

  assert.deepEqual(items.map(item => item.title), ['Unselected shortlist', 'Reference window']);
});

// 참고 섹션도 발행 링크다. main에서 증거 부족으로 막힌 후보가 링크로 우회 노출되면 안 된다.
test('the candidate pool applies the same evidence floor as the catch-up lane', () => {
  const pool = referenceArticleCandidatePool({
    shortlisted_candidates: [
      candidate({ title: 'Weak evidence', url: 'https://a.example/weak', main_article_score_eligible: false }),
      candidate({ title: 'Source gap', url: 'https://a.example/gap', source_gap_risk: true }),
      candidate({ title: 'Strong', url: 'https://a.example/strong' })
    ]
  });

  assert.deepEqual(pool.map(item => item.title), ['Strong']);
});

// month 정밀도 후보는 그 달 어느 날인지 모른다. 아는 만큼만(YYYY-MM) 표기해야 한다.
test('renders month-precision candidates with month granularity, not a fabricated day', () => {
  const items = buildReferenceArticles([
    candidate({
      title: 'AOSP Site Updates - Camera ITS tests',
      url: 'https://source.android.com/docs/compatibility/cts/camera-its-tests',
      published_date: '2026-07-01',
      datePrecision: 'month'
    })
  ]);

  assert.equal(items[0].published_date, '2026-07');
});

// 소스마다 published_date 원문 표기가 다르다. 그대로 찍으면 한 목록 안에서 정밀도가 뒤섞인다
// (실측 2026-08-03호 126~127줄: 'July 01, 2026' 다음 줄이 '2026-07-10T11:12:38+01:00').
// 아래 네 형식은 발행된 issue.json에서 실제로 관측된 전부다.
test('normalizes every observed source date shape to YYYY-MM-DD', () => {
  const items = buildReferenceArticles([
    candidate({ url: 'https://a.example/iso-timestamp', published_date: '2026-07-10T11:12:38+01:00' }),
    candidate({ url: 'https://a.example/month-name', published_date: 'July 01, 2026' }),
    candidate({ url: 'https://a.example/rss-pubdate', published_date: 'Thu, 30 Apr 2026 22:36:23 +0000' }),
    candidate({ url: 'https://a.example/already-clean', published_date: '2026-03-25' })
  ]);

  assert.deepEqual(Object.fromEntries(items.map(item => [item.url, item.published_date])), {
    'https://a.example/iso-timestamp': '2026-07-10',
    // 로컬 타임존 Date 파싱을 타면 '2026-06-30'으로 하루 밀린다. 월 이름은 표로 옮겨야 한다.
    'https://a.example/month-name': '2026-07-01',
    'https://a.example/rss-pubdate': '2026-04-30',
    'https://a.example/already-clean': '2026-03-25'
  });
});

// 아는 형식이 아니면 날짜를 지어내지 않는다. 기존 dated 게이트가 항목을 통째로 뺀다
// (새 검사기를 더하지 않는다).
test('drops items whose published date is in an unrecognized shape', () => {
  const items = buildReferenceArticles([
    candidate({ title: 'Unparseable date', url: 'https://a.example/unparseable', published_date: 'last Tuesday' }),
    candidate({ title: 'Parseable date', url: 'https://a.example/ok' })
  ]);

  assert.deepEqual(items.map(item => item.title), ['Parseable date']);
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
