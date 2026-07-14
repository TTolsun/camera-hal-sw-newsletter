const assert = require('node:assert/strict');
const test = require('node:test');

const {
  capPerSource,
  collapseSeriesRepresentatives,
  MAX_CANDIDATES_PER_SOURCE
} = require('../../../cli/collect-news-candidates');

function item(sourceId, title) {
  return { source_id: sourceId, source: sourceId, title };
}

function seriesItem(sourceId, title, seriesId) {
  return { source_id: sourceId, source: sourceId, title, seriesId };
}

test('capPerSource limits each source to the cap while preserving order', () => {
  const ranked = [
    ...Array.from({ length: 12 }, (_, i) => item('android-developers-blog', `android-${i}`)),
    item('lore-linux-media-list', 'lore-0'),
    item('lore-linux-media-list', 'lore-1')
  ];
  const capped = capPerSource(ranked, 8);
  const androidCount = capped.filter(c => c.source_id === 'android-developers-blog').length;
  const loreCount = capped.filter(c => c.source_id === 'lore-linux-media-list').length;
  assert.equal(androidCount, 8, 'high-volume source is capped at the per-source limit');
  assert.equal(loreCount, 2, 'lower-ranked driver source still survives the cap');
  assert.equal(capped[0].title, 'android-0', 'sort order is preserved within the cap');
});

test('a single roundup source cannot evict other sources before the final slice', () => {
  // Mirrors the CI failure: one source explodes into many child topics and would
  // otherwise fill the entire pool, starving camera-driver leads.
  const ranked = [
    ...Array.from({ length: 28 }, (_, i) => item('android-developers-blog', `android-${i}`)),
    ...Array.from({ length: 22 }, (_, i) => item('lore-linux-media-list', `lore-${i}`))
  ];
  const capped = capPerSource(ranked, MAX_CANDIDATES_PER_SOURCE).slice(0, 40);
  assert.ok(
    capped.some(c => c.source_id === 'lore-linux-media-list'),
    'driver content reaches the final pool instead of being crowded out'
  );
  assert.ok(
    capped.filter(c => c.source_id === 'android-developers-blog').length <= MAX_CANDIDATES_PER_SOURCE,
    'roundup source respects the per-source cap'
  );
});

test('capPerSource with a non-positive cap returns all candidates unchanged', () => {
  const ranked = [item('a', 'a-0'), item('a', 'a-1')];
  assert.deepEqual(capPerSource(ranked, 0).map(c => c.title), ['a-0', 'a-1']);
});

test('collapseSeriesRepresentatives keeps one top-ranked candidate per (source, seriesId)', () => {
  // A large patch series must not consume the per-source cap with its fragments;
  // it should compete as a single representative. Input is already rank-sorted, so
  // the first fragment of each series is its top-ranked representative.
  const ranked = [
    ...Array.from({ length: 35 }, (_, i) => seriesItem('patchwork-libcamera-patches', `libipa-${i}`, 6048)),
    ...Array.from({ length: 6 }, (_, i) => seriesItem('patchwork-libcamera-patches', `lsc-${i}`, 6049)),
    seriesItem('patchwork-libcamera-patches', 'dw100', 6050),
    item('patchwork-libcamera-patches', 'git-url-churn')
  ];
  const collapsed = collapseSeriesRepresentatives(ranked);
  const patchworkTitles = collapsed
    .filter(c => c.source_id === 'patchwork-libcamera-patches')
    .map(c => c.title);
  assert.deepEqual(patchworkTitles, ['libipa-0', 'lsc-0', 'dw100', 'git-url-churn'],
    'each series collapses to its first (top-ranked) fragment; non-series candidate passes through');
  // The whole in-window series survives the per-source cap as one representative.
  const capped = capPerSource(collapsed, MAX_CANDIDATES_PER_SOURCE);
  assert.ok(capped.some(c => c.title === 'libipa-0'),
    'a 35-patch series is no longer starved out of the per-source cap by its own fragments');
});

test('collapseSeriesRepresentatives leaves candidates without a seriesId untouched', () => {
  const ranked = [item('a', 'a-0'), item('a', 'a-1'), item('b', 'b-0')];
  assert.deepEqual(collapseSeriesRepresentatives(ranked).map(c => c.title), ['a-0', 'a-1', 'b-0']);
});
