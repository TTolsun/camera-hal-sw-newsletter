#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_TEST_ALLOWLIST_RELATIVE_PATH = 'src/core/test/root-test-allowlist.json';
const ONE_OFF_SCRIPT_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.ps1', '.sh']);
const ONE_OFF_DIRECTORY_SEGMENTS = new Set([
  'tmp',
  'temp',
  'scratch',
  'local',
  'one-off',
  'probe',
  'repro',
  'experiment'
]);
const ONE_OFF_BASENAME_TOKENS = new Set([
  'tmp',
  'temp',
  'scratch',
  'local',
  'probe',
  'repro',
  'experiment'
]);

function normalizePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function repoRoot(cwd = process.cwd()) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8'
  }).trim();
}

function trackedFiles(root) {
  const output = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'buffer'
  });
  return output.toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter(filePath => fs.existsSync(path.join(root, filePath)));
}

function issue(filePath, type, detail) {
  return {
    path: normalizePath(filePath),
    type,
    detail
  };
}

function isOfficialDocumentPath(filePath) {
  return filePath === 'README.md' || filePath === 'AGENTS.md' || filePath.startsWith('docs/');
}

function isTrackedWorklogDocumentPath(filePath) {
  return filePath.startsWith('docs/plans/') ||
    filePath.startsWith('docs/debug/') ||
    filePath.startsWith('docs/refactoring/') ||
    filePath.startsWith('docs/archive/') ||
    filePath.startsWith('docs/testing/');
}

function isTrackedScratchMarkdownPath(filePath) {
  return /\.md$/i.test(filePath) &&
    (/^(?:notes|memory|checkpoint|checkpoints)\//.test(filePath));
}

function splitNameTokens(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[._\-\s]+/)
    .filter(Boolean);
}

function hasOneOffPhrase(value) {
  return /(?:^|[._\-\s])one[-_\s]off(?:$|[._\-\s])/.test(String(value || '').toLowerCase());
}

function isOneOffScriptPath(filePath) {
  const normalizedPath = normalizePath(filePath);
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments[0] !== 'scripts' && segments[0] !== 'src') return false;

  const extension = path.posix.extname(normalizedPath).toLowerCase();
  if (!ONE_OFF_SCRIPT_EXTENSIONS.has(extension)) return false;

  const directorySegments = segments.slice(1, -1).map(segment => segment.toLowerCase());
  if (directorySegments.some(segment => ONE_OFF_DIRECTORY_SEGMENTS.has(segment))) return true;

  const basename = path.posix.basename(normalizedPath, extension).toLowerCase();
  if (hasOneOffPhrase(basename)) return true;

  return splitNameTokens(basename).some(token => ONE_OFF_BASENAME_TOKENS.has(token));
}

// 정상 위치: 각 layer 옆 nested test 폴더(src/<layer>/test/.../*.test.js).
function isProperlyPlacedTestFile(filePath) {
  return /^src\/[^/]+\/test\/.+\.test\.js$/.test(filePath);
}

// misplaced: repo root 직속이거나 src/<layer>/test/ 밖에 있는 *.test.js.
// 예) foo.test.js, tests/foo.test.js, src/generator/foo.test.js.
function isMisplacedTestFile(filePath) {
  return /\.test\.js$/.test(filePath) && !isProperlyPlacedTestFile(filePath);
}

function loadRootTestAllowlist(root) {
  const allowlistPath = path.join(root, ROOT_TEST_ALLOWLIST_RELATIVE_PATH);
  if (!fs.existsSync(allowlistPath)) return [];
  const value = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  if (!Array.isArray(value)) {
    throw new Error(`${ROOT_TEST_ALLOWLIST_RELATIVE_PATH} must contain a JSON array`);
  }
  return value.map(normalizePath);
}

function findRootTestStructureIssues(files, allowlist) {
  const issues = [];
  const normalizedFiles = (files || []).map(normalizePath).filter(Boolean);

  for (const inputPath of allowlist || []) {
    const filePath = normalizePath(inputPath);
    issues.push(issue(
      filePath,
      'root_test_structure',
      'root test allowlist must remain empty after root migration'
    ));
  }

  for (const filePath of normalizedFiles) {
    if (isMisplacedTestFile(filePath)) {
      issues.push(issue(
        filePath,
        'root_test_structure',
        'stray *.test.js files must live under src/<layer>/test/ nested folders'
      ));
    }
  }

  return issues;
}

function findRepoHygieneIssues(files, options = {}) {
  const issues = [];

  for (const inputPath of files || []) {
    const filePath = normalizePath(inputPath);
    if (!filePath) continue;

    if (isTrackedWorklogDocumentPath(filePath)) {
      issues.push(issue(
        filePath,
        'tracked_worklog_document',
        'plans, debug baselines, refactoring worklogs, archive notes, and dated testing inventories must stay local-only or be integrated into current canonical docs'
      ));
    } else if (isOfficialDocumentPath(filePath)) {
      continue;
    } else if (filePath === 'PLAN.md' || filePath === 'PLAN.local.md') {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'root plan files must stay local-only'));
    } else if (filePath.startsWith('.codex/')) {
      issues.push(issue(filePath, 'tracked_agent_scratch', '.codex files must stay local-only'));
    } else if (filePath.startsWith('.tmp/')) {
      issues.push(issue(filePath, 'tracked_agent_scratch', '.tmp files must stay local-only'));
    } else if (isTrackedScratchMarkdownPath(filePath)) {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'notes, memory, and checkpoint markdown files must stay local-only'));
    } else if (/^codex-[^/]*\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'root codex markdown scratch files must stay local-only'));
    } else if (/^[^/]+-codex-plan\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'root codex plan markdown files must stay local-only'));
    } else if (/^[^/]+-scratch\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'root scratch markdown files must stay local-only'));
    } else if (isOneOffScriptPath(filePath)) {
      issues.push(issue(filePath, 'tracked_one_off_script', 'one-off scripts under scripts/ and src/ must stay outside the repo or become maintained project tools'));
    }
  }

  if (Array.isArray(options.rootTestAllowlist)) {
    issues.push(...findRootTestStructureIssues(files, options.rootTestAllowlist));
  }

  return issues;
}

function formatIssue(item) {
  return `${item.path}: ${item.type}: ${item.detail}`;
}

function main() {
  const root = repoRoot();
  const issues = findRepoHygieneIssues(trackedFiles(root), {
    rootTestAllowlist: loadRootTestAllowlist(root)
  });

  if (issues.length > 0) {
    console.error(issues.map(formatIssue).join('\n'));
    process.exit(1);
  }

  console.log('Repository hygiene validation passed.');
}

if (require.main === module) {
  main();
}

module.exports = {
  findRootTestStructureIssues,
  findRepoHygieneIssues,
  formatIssue,
  isOneOffScriptPath,
  isTrackedScratchMarkdownPath,
  isTrackedWorklogDocumentPath,
  loadRootTestAllowlist,
  normalizePath,
  repoRoot,
  trackedFiles
};
