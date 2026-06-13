const assert = require('node:assert/strict');
const test = require('node:test');

const { formatReasonSummary } = require('../../../../core/common/status-format');

test('formatReasonSummary counts reasons correctly', () => {
  const items = [
    { reason: 'a', count: 2 },
    { reason: 'a', count: 1 },
    { reason: 'b', count: 3 }
  ];
  const result = formatReasonSummary(items);
  assert.equal(result, 'a (2); a (1); b (3)');
});

test('formatReasonSummary returns none for empty array', () => {
  assert.equal(formatReasonSummary([], { topN: 5 }), 'none');
});

test('formatReasonSummary limits to topN items', () => {
  const items = [
    { reason: 'x', count: 1 },
    { reason: 'y', count: 2 },
    { reason: 'z', count: 3 },
    { reason: 'w', count: 4 },
    { reason: 'v', count: 5 },
    { reason: 'u', count: 6 },
    { reason: 't', count: 7 },
    { reason: 's', count: 8 },
    { reason: 'r', count: 9 },
    { reason: 'q', count: 10 }
  ];
  const result = formatReasonSummary(items, { topN: 3 });
  const parts = result.split('; ');
  assert.equal(parts.length, 3);
  assert.equal(parts[0], 'x (1)');
  assert.equal(parts[1], 'y (2)');
  assert.equal(parts[2], 'z (3)');
});

test('formatReasonSummary defaults to topN=5', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ reason: `r${i}`, count: i }));
  const result = formatReasonSummary(items);
  const parts = result.split('; ');
  assert.equal(parts.length, 5);
});

test('formatReasonSummary handles missing reason and count', () => {
  const items = [{ reason: '', count: null }, {}];
  const result = formatReasonSummary(items);
  assert.equal(result, 'unknown (n/a); unknown (n/a)');
});
