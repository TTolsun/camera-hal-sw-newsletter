const assert = require('node:assert/strict');
const test = require('node:test');

const {
  capPerSource,
  MAX_CANDIDATES_PER_SOURCE
} = require('../../../cli/collect-news-candidates');

function item(sourceId, title) {
  return { source_id: sourceId, source: sourceId, title };
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
