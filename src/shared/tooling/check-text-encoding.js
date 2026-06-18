#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { trackedFiles } = require('./tracked-files');

const TEXT_FILE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.txt',
  '.yaml',
  '.yml'
]);

const TEXT_FILE_NAMES = new Set([
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.gitkeep',
  'LICENSE',
  'README'
]);

const CONFIRMED_MOJIBAKE_FRAGMENTS = [
  '\u003f\uc579\uaf66',
  '\u003f\uafa8\ub0ab',
  '\u003f\uc88f\uae6e',
  '\u003f\ub301\ub4aa',
  '\u7570\uc496\ucfc2',
  '\uf9e1\uba78\ud02c',
  '\u5bc3\u0080\uf9dd',
  '\u8adb\uc497\ubefe',
  '\u907a\ub34a\ube18',
  '\u6e90\u2465\ucb4a',
  '\u003f\u317d\ubefe'
];

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function isCandidateTextPath(filePath) {
  return (
    TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase()) ||
    TEXT_FILE_NAMES.has(path.basename(filePath))
  );
}

function containsNulByte(buffer) {
  return Buffer.isBuffer(buffer) && buffer.includes(0);
}

function issue(filePath, type, detail) {
  return {
    path: normalizePath(filePath),
    type,
    detail
  };
}

function detectTextEncodingIssues(buffer, filePath = '') {
  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer || '');
  }
  const issues = [];
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    issues.push(issue(filePath, 'utf8_bom', 'UTF-8 BOM detected'));
  }
  if (
    (buffer[0] === 0xff && buffer[1] === 0xfe) ||
    (buffer[0] === 0xfe && buffer[1] === 0xff)
  ) {
    issues.push(issue(filePath, 'utf16_bom', 'UTF-16 BOM detected'));
  }
  if (issues.length > 0) return issues;
  if (containsNulByte(buffer)) return [];

  const text = buffer.toString('utf8');
  if (text.includes('\uFFFD')) {
    issues.push(issue(filePath, 'replacement_character', 'Unicode replacement character detected'));
  }

  for (const fragment of CONFIRMED_MOJIBAKE_FRAGMENTS) {
    if (text.includes(fragment)) {
      issues.push(issue(filePath, 'confirmed_mojibake_fragment', `confirmed mojibake fragment detected: ${fragment}`));
    }
  }

  return issues;
}

function checkTrackedTextFiles(root = process.cwd()) {
  const issues = [];
  for (const filePath of trackedFiles(root)) {
    if (!isCandidateTextPath(filePath)) continue;
    const absolutePath = path.join(root, filePath);
    const buffer = fs.readFileSync(absolutePath);
    if (containsNulByte(buffer)) continue;
    issues.push(...detectTextEncodingIssues(buffer, filePath));
  }
  return issues;
}

function formatIssue(item) {
  return `${item.path}: ${item.type}: ${item.detail}`;
}

function main() {
  const root = process.cwd();
  const issues = checkTrackedTextFiles(root);
  if (issues.length > 0) {
    console.error(issues.map(formatIssue).join('\n'));
    process.exit(1);
  }
  console.log('Text encoding validation passed.');
}

if (require.main === module) {
  main();
}

module.exports = {
  CONFIRMED_MOJIBAKE_FRAGMENTS,
  TEXT_FILE_EXTENSIONS,
  TEXT_FILE_NAMES,
  checkTrackedTextFiles,
  containsNulByte,
  detectTextEncodingIssues,
  formatIssue,
  isCandidateTextPath,
  trackedFiles
};
