const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolvePatchworkLibcameraPatchItems
} = require('../../../collect/patchwork-libcamera-patches');

const LIST_API = 'https://patchwork.libcamera.org/api/patches/?order=-date&per_page=50&format=json';

function source(overrides = {}) {
  return {
    id: 'patchwork-libcamera-patches',
    name: 'libcamera Patchwork (patch review)',
    url: LIST_API,
    sourceUrl: LIST_API,
    ...overrides
  };
}

// Representative patchwork REST API page: a bare JSON array, newest-first. Includes
// a substantive uAPI patch, a churn patch, and two malformed rows to drop.
function apiJson() {
  return JSON.stringify([
    {
      id: 27198,
      web_url: 'https://patchwork.libcamera.org/patch/27198/',
      date: '2026-07-03T22:48:16',
      name: '[v2,1/2] libcamera: Add SensorSequence metadata control',
      state: 'new',
      submitter: { name: 'Jane Dev', email: 'jane@example.org' },
      series: [{ id: 880, name: 'Add SensorSequence metadata control', version: 2 }]
    },
    {
      id: 27196,
      web_url: 'https://patchwork.libcamera.org/patch/27196/',
      date: '2026-07-03T15:38:19',
      name: '[RFC,v1,17/17] ipa: simple: agc: Port to AgcMeanLuminance',
      state: 'new',
      submitter: { name: 'Sam Rev' }
    },
    {
      id: 27100,
      web_url: 'https://patchwork.libcamera.org/patch/27100/',
      date: '',
      name: 'build: bump meson version',
      state: 'accepted'
    },
    {
      id: 27101,
      web_url: '',
      date: '2026-07-01T10:00:00',
      name: 'utils: tidy checkstyle script',
      state: 'new'
    }
  ]);
}

test('parses patchwork JSON patches into dated rss_item candidates', () => {
  const items = resolvePatchworkLibcameraPatchItems(apiJson(), source());
  assert.equal(items.length, 2, 'only patches with both a date and web_url survive');

  const first = items[0];
  assert.equal(first.title, '[v2,1/2] libcamera: Add SensorSequence metadata control');
  assert.equal(first.url, 'https://patchwork.libcamera.org/patch/27198/');
  assert.equal(first.publishedAt, '2026-07-03');
  assert.equal(first.sourceKind, 'rss_item');
  assert.equal(first.collectionMode, 'rss-item');
  assert.equal(first.parentTitle, 'libcamera Patchwork (patch review)');
});

test('captures the REST series id so a patch series collapses into one candidate (#795)', () => {
  // patchwork 후보는 URL(패치별 고유)·message-id로는 시리즈를 못 묶는다. REST의 series id를 후보에
  // 실어 dedup(article-groups seriesKey)이 같은 시리즈 조각을 하나로 collapse하게 한다.
  const items = resolvePatchworkLibcameraPatchItems(apiJson(), source());
  assert.equal(items[0].seriesId, 880);
  // series 필드가 없는 patch는 seriesId 없음(무회귀, 단일 patch로 취급).
  assert.equal(items[1].seriesId, undefined);
});

test('does not set a relevance bucket hint so the classifier decides camera relevance', () => {
  const items = resolvePatchworkLibcameraPatchItems(apiJson(), source());
  for (const item of items) {
    assert.equal(item.relevanceBucketHint, undefined);
    assert.equal(item.relevance_bucket_hint, undefined);
  }
});

test('summary carries no scoring keyword so technicalDepth stays title-driven', () => {
  // technicalDepth (mailing-list eligibility gate) reads title + summary. If the
  // summary injected a camera/metadata term, EVERY patch — docs and build churn
  // included — would clear the technicalDepth floor and could be upgraded to a main
  // slot. The summary must stay neutral so only the real patch subject drives depth.
  const items = resolvePatchworkLibcameraPatchItems(apiJson(), source());
  for (const item of items) {
    assert.doesNotMatch(
      item.summary || '',
      /camera|image|sensor|release|metadata|driver|kernel|V4L2|ISP|buffer|stream/i,
      `summary must not inject scoring keywords: ${item.summary}`
    );
  }
});

test('returns [] for empty, non-JSON, error-object, or non-array input (graceful)', () => {
  assert.deepEqual(resolvePatchworkLibcameraPatchItems('', source()), []);
  assert.deepEqual(resolvePatchworkLibcameraPatchItems('<html>not json</html>', source()), []);
  assert.deepEqual(resolvePatchworkLibcameraPatchItems('{"detail":"Not found"}', source()), []);
  assert.deepEqual(resolvePatchworkLibcameraPatchItems('[]', source()), []);
});
