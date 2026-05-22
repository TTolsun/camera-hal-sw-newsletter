#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_TEST_ALLOWLIST_RELATIVE_PATH = 'tests/root-test-allowlist.json';

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
    filePath.startsWith('docs/refactoring/');
}

function isRootTestFile(filePath) {
  return /^tests\/[^/]+\.test\.js$/.test(filePath);
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
    if (isRootTestFile(filePath)) {
      issues.push(issue(
        filePath,
        'root_test_structure',
        'root tests/*.test.js files must move into nested test folders'
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
        'plans, debug baselines, and refactoring worklogs must stay local-only or be integrated into canonical docs'
      ));
    } else if (isOfficialDocumentPath(filePath)) {
      continue;
    } else if (filePath === 'PLAN.md' || filePath === 'PLAN.local.md') {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'root plan files must stay local-only'));
    } else if (filePath.startsWith('.codex/')) {
      issues.push(issue(filePath, 'tracked_agent_scratch', '.codex files must stay local-only'));
    } else if (filePath.startsWith('.tmp/codex/')) {
      issues.push(issue(filePath, 'tracked_agent_scratch', '.tmp/codex files must stay local-only'));
    } else if (/^codex-[^/]*\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'root codex markdown scratch files must stay local-only'));
    } else if (/^[^/]+-codex-plan\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'root codex plan markdown files must stay local-only'));
    } else if (/^[^/]+-scratch\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'tracked_agent_scratch', 'root scratch markdown files must stay local-only'));
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
  isTrackedWorklogDocumentPath,
  loadRootTestAllowlist,
  normalizePath,
  repoRoot,
  trackedFiles
};
