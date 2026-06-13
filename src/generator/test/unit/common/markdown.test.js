const assert = require('node:assert/strict');
const test = require('node:test');

const {
  sanitizeMarkdownTableCell,
  sanitizeMarkdownLinkUrl,
  trustedMarkdownTableCell,
  renderMarkdownTable
} = require('../../../../shared/common/markdown');

test('sanitizeMarkdownTableCell escapes pipe characters', () => {
  assert.equal(sanitizeMarkdownTableCell('a|b'), 'a\\|b');
});

test('sanitizeMarkdownTableCell replaces newline with space', () => {
  assert.equal(sanitizeMarkdownTableCell('multi\nline'), 'multi line');
});

test('sanitizeMarkdownTableCell uses fallback for empty value', () => {
  assert.equal(sanitizeMarkdownTableCell(''), 'unknown');
});

test('sanitizeMarkdownTableCell uses custom fallback option', () => {
  assert.equal(sanitizeMarkdownTableCell(null, { fallback: 'n/a' }), 'n/a');
});

test('sanitizeMarkdownLinkUrl encodes spaces and pipes', () => {
  const result = sanitizeMarkdownLinkUrl('https://example.com/a b|c');
  assert.equal(result, 'https://example.com/a%20b%7Cc');
});

test('trustedMarkdownTableCell returns sentinel object', () => {
  const result = trustedMarkdownTableCell('safe content');
  assert.equal(result.__markdownTableCell, true);
  assert.equal(result.value, 'safe content');
});

test('renderMarkdownTable produces header, separator, body rows', () => {
  const result = renderMarkdownTable(['h1', 'h2'], [['a', 'b'], ['c', 'd']]);
  const lines = result.split('\n');
  assert.equal(lines[0], '| h1 | h2 |');
  assert.equal(lines[1], '| ---: | --- |');
  assert.equal(lines[2], '| a | b |');
  assert.equal(lines[3], '| c | d |');
});

test('renderMarkdownTable escapes pipe in cell values', () => {
  const result = renderMarkdownTable(['col'], [['val|ue']]);
  assert.ok(result.includes('val\\|ue'));
});
