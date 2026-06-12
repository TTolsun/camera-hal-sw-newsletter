#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function rawMarker(idParts, pattern) {
  return {
    id: idParts.join(''),
    pattern: new RegExp(pattern)
  };
}

const RAW_SHAPE_MARKERS = Object.freeze([
  rawMarker(['candidates', '[0]', '.content', '.parts'], String.raw`candidates\s*\[\s*0\s*\]\s*\.\s*content\s*\.\s*parts`),
  rawMarker(['choices', '[0]', '.message', '.content'], String.raw`choices\s*\[\s*0\s*\]\s*\.\s*message\s*\.\s*content`),
  rawMarker(['output', '_json'], String.raw`\b${['output', 'json'].join('_')}\b`),
  rawMarker(['raw', 'Response'], String.raw`\b${['raw', 'Response'].join('')}\b`),
  rawMarker(['provider', 'Response'], String.raw`\b${['provider', 'Response'].join('')}\b`),
  rawMarker(['gemini', 'Response'], String.raw`\b${['gemini', 'Response'].join('')}\b`),
  rawMarker(['openapi', 'Response'], String.raw`\b${['openapi', 'Response'].join('')}\b`)
]);

const TEXT_EXTENSIONS = Object.freeze(new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.yml',
  '.yaml'
]));

const ALLOWED_PATHS = Object.freeze([
  /^scripts\/newsroom\/llm\//,
  /^scripts\/newsroom\/adapters\/llm\//,
  /^src\/core\/adapters\/llm\//,
  /^src\/.*\/llm\//,
  /^tests\/.*\/llm-response\//,
  /^src\/.*\/llm-response\//,
  /^docs\/workflows\/llm-provider-domain-boundary\.md$/
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function repoRoot(cwd = process.cwd()) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8'
  }).trim();
}

function trackedFiles(root) {
  return execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'buffer'
  }).toString('utf8').split('\0').filter(Boolean);
}

function untrackedFiles(root) {
  return execFileSync('git', ['-C', root, 'ls-files', '--others', '--exclude-standard', '-z'], {
    encoding: 'buffer'
  }).toString('utf8').split('\0').filter(Boolean);
}

function repoFiles(root) {
  return [...new Set([...trackedFiles(root), ...untrackedFiles(root)])];
}

function pathMatches(filePath, rules) {
  return rules.some(rule => rule.test(filePath));
}

function violationsForFile(root, filePath) {
  const normalized = normalizePath(filePath);
  if (pathMatches(normalized, ALLOWED_PATHS)) return [];
  if (!TEXT_EXTENSIONS.has(path.extname(normalized))) return [];
  const absolutePath = path.join(root, filePath);
  if (!fs.existsSync(absolutePath)) return [];
  const text = fs.readFileSync(absolutePath, 'utf8');
  const violations = [];
  for (const marker of RAW_SHAPE_MARKERS) {
    if (marker.pattern.test(text)) {
      violations.push(`${normalized}: raw provider response marker is forbidden outside adapter/llm boundary: ${marker.id}`);
    }
  }
  return violations;
}

function main() {
  const root = repoRoot();
  const violations = repoFiles(root).flatMap(filePath => violationsForFile(root, filePath));
  if (violations.length > 0) {
    console.error(violations.join('\n'));
    process.exit(1);
  }
  console.log('Domain model boundary validation passed.');
}

if (require.main === module) {
  main();
}

module.exports = {
  RAW_SHAPE_MARKERS,
  repoFiles,
  violationsForFile
};
