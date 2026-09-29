const assert = require('node:assert/strict');
const test = require('node:test');
const { buildCollectionCounts } = require('../../../cli/collect-news-candidates');

test('collection stages account for duplicate, filter and cap losses per source', () => {
  const a = { source_id: 'a' };
  const b = { source_id: 'b' };
  const result = buildCollectionCounts([
    { items: [a, a, a, b] },
    { reason: 'duplicate', items: [a, a, b] },
    { reason: 'relevance', items: [a, a] },
    { reason: 'global_cap', items: [a] }
  ], ['a', 'b', 'empty']);
  assert.deepEqual(result.a, {
    raw_collected_count: 3, candidate_count: 1, filtered_out_count: 2,
    filter_counts: { duplicate: 1, relevance: 0, global_cap: 1 }
  });
  assert.equal(result.b.raw_collected_count, 1);
  assert.equal(result.b.filter_counts.relevance, 1);
  assert.equal(result.b.candidate_count, 0);
  assert.equal(result.empty.raw_collected_count, 0);
});
