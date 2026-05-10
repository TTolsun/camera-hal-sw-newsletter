const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CONFIRMED_MOJIBAKE_FRAGMENTS,
  containsNulByte,
  detectTextEncodingIssues,
  formatIssue,
  isCandidateTextPath
} = require('../scripts/check-text-encoding');

function issuesFor(value, filePath = 'example.md') {
  return detectTextEncodingIssues(Buffer.from(value, 'utf8'), filePath);
}

test('detectTextEncodingIssues reports BOM and replacement character issues', () => {
  const utf8Bom = detectTextEncodingIssues(Buffer.from([0xef, 0xbb, 0xbf, 0x61]), 'bom.md');
  assert.deepEqual(utf8Bom.map(item => item.type), ['utf8_bom']);

  const utf16Bom = detectTextEncodingIssues(Buffer.from([0xff, 0xfe, 0x61, 0x00]), 'utf16.txt');
  assert.deepEqual(utf16Bom.map(item => item.type), ['utf16_bom']);

  const replacement = issuesFor('broken \uFFFD text', 'replacement.md');
  assert.deepEqual(replacement.map(item => item.type), ['replacement_character']);
});

test('detectTextEncodingIssues reports only confirmed repository mojibake fragments', () => {
  const issues = issuesFor(`bad ${CONFIRMED_MOJIBAKE_FRAGMENTS[0]} text`, 'bad.md');

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, 'bad.md');
  assert.equal(issues[0].type, 'confirmed_mojibake_fragment');
  assert.match(formatIssue(issues[0]), /^bad\.md: confirmed_mojibake_fragment: /);
});

test('detectTextEncodingIssues skips binary buffers with NUL bytes', () => {
  const buffer = Buffer.from([0x00, 0xef, 0xbb, 0xbf, 0x61]);

  assert.equal(containsNulByte(buffer), true);
  assert.deepEqual(detectTextEncodingIssues(buffer, 'image.bin'), []);
});

test('isCandidateTextPath is extension allowlist based', () => {
  assert.equal(isCandidateTextPath('docs/readme.md'), true);
  assert.equal(isCandidateTextPath('scripts/file.js'), true);
  assert.equal(isCandidateTextPath('assets/image.png'), false);
  assert.equal(isCandidateTextPath('README'), false);
});
