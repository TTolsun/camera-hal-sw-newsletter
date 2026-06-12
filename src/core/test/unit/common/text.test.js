const assert = require('node:assert/strict');
const test = require('node:test');

const { stripHtml, truncateText } = require('../../../common/text');

test('stripHtml(null) returns empty string', () => {
  assert.equal(stripHtml(null), '');
});

test('stripHtml removes tags and decodes HTML entities', () => {
  assert.equal(stripHtml('<p>hello &amp; world</p>'), 'hello & world');
});

test('stripHtml normalizes whitespace', () => {
  assert.equal(stripHtml('  a   b  '), 'a b');
});

test('truncateText truncates when value exceeds maxLength', () => {
  assert.equal(truncateText('hello world', 5), 'hello...');
});

test('truncateText returns value unchanged when within maxLength', () => {
  assert.equal(truncateText('hello', 100), 'hello');
});

test('truncateText does not truncate when maxLength is 0', () => {
  assert.equal(truncateText('hello', 0), 'hello');
});

test('truncateText normalizes whitespace', () => {
  assert.equal(truncateText('  multi   space  ', 20), 'multi space');
});

test('truncateText with stripHtmlFirst strips HTML before truncating', () => {
  assert.equal(truncateText('<p>html</p>', 10, { stripHtmlFirst: true }), 'html');
});
