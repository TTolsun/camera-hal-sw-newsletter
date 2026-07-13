const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeCandidate } = require('../../../cli/collect-news-candidates');
const { resolvePatchworkLibcameraPatchItems } = require('../../../collect/patchwork-libcamera-patches');
const { seriesKey } = require('../../../common/article-groups');

// #795 후속(프로덕션 갭): 수집기(patchCandidate)가 실은 patchwork REST series id는 candidate 정규화
// (normalizeCandidate)의 field whitelist를 통과해야 candidates.json에 남고, 그래야 선정 단계 dedup
// (article-groups seriesKey)이 같은 시리즈 조각을 하나로 collapse한다. seriesId가 whitelist에 없으면
// 단위 dedup 테스트는 통과해도(raw 후보에 seriesId가 있으므로) 실제 파이프라인에선 collapse가 안 된다.

function patchworkSource(overrides = {}) {
  return {
    id: 'patchwork-libcamera-patches',
    name: 'libcamera Patchwork (patch review)',
    url: 'https://patchwork.libcamera.org/api/patches/?order=-date&per_page=50&format=json',
    sourceUrl: 'https://patchwork.libcamera.org/api/patches/?order=-date&per_page=50&format=json',
    category: 'camera-hal',
    section: 'Kernel / Media',
    priority: 'high',
    reliability: 'project-official',
    keywords: ['libcamera', 'camera'],
    requiresCrossCheck: true,
    candidateOnly: false,
    ...overrides
  };
}

test('normalizeCandidate preserves patchwork seriesId through the field whitelist (#795)', () => {
  const item = normalizeCandidate({
    source: patchworkSource(),
    title: '[RFC,v7,1/6] libcamera: software_isp: egl: Add filter parameter',
    url: 'https://patchwork.libcamera.org/patch/27346/',
    publishedAt: '2026-07-08',
    summary: 'Patch under review on the project patch tracker; state new, a proposed change not yet landed.',
    seriesId: 880,
    sourceKind: 'rss_item',
    collectionMode: 'rss-item'
  });
  assert.equal(item.seriesId, 880);
  assert.equal(item.series_id, 880);
});

test('normalizeCandidate tolerates a missing seriesId (non-series / non-patchwork candidate)', () => {
  const item = normalizeCandidate({
    source: patchworkSource(),
    title: 'build: bump meson version',
    url: 'https://patchwork.libcamera.org/patch/27100/',
    publishedAt: '2026-07-07',
    summary: 'Patch under review on the project patch tracker; state accepted.',
    sourceKind: 'rss_item',
    collectionMode: 'rss-item'
  });
  assert.ok(item.seriesId === null || item.seriesId === undefined, 'missing seriesId normalizes to null');
});

test('patchwork collector -> normalizeCandidate -> seriesKey groups a real series end to end (#795)', () => {
  const api = JSON.stringify([
    {
      id: 27346,
      web_url: 'https://patchwork.libcamera.org/patch/27346/',
      date: '2026-07-08T10:00:00',
      name: '[RFC,v7,1/6] libcamera: software_isp: egl: Add filter parameter',
      state: 'new',
      series: [{ id: 880, version: 7, name: 'software_isp egl LSC' }]
    },
    {
      id: 27347,
      web_url: 'https://patchwork.libcamera.org/patch/27347/',
      date: '2026-07-08T10:01:00',
      name: '[RFC,v7,2/6] libcamera: software_isp: Add LSC data to DebayerParams',
      state: 'new',
      series: [{ id: 880, version: 7, name: 'software_isp egl LSC' }]
    }
  ]);
  const rawItems = resolvePatchworkLibcameraPatchItems(api, patchworkSource());
  assert.equal(rawItems.length, 2);
  const normalized = rawItems.map(raw => normalizeCandidate(raw));

  const key0 = seriesKey(normalized[0]);
  assert.ok(key0, 'series key should be non-empty after full collect->normalize path');
  assert.ok(key0.startsWith('patchwork-series:'));
  assert.equal(seriesKey(normalized[1]), key0, 'both fragments share one series key so dedup collapses them');
});
