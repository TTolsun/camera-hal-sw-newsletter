#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

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
  return output.toString('utf8').split('\0').filter(Boolean);
}

function issue(filePath, detail) {
  return {
    path: normalizePath(filePath),
    type: 'tracked_agent_scratch',
    detail
  };
}

function isOfficialDocumentPath(filePath) {
  return filePath === 'README.md' || filePath === 'AGENTS.md' || filePath.startsWith('docs/');
}

function findRepoHygieneIssues(files) {
  const issues = [];

  for (const inputPath of files || []) {
    const filePath = normalizePath(inputPath);
    if (!filePath || isOfficialDocumentPath(filePath)) continue;

    if (filePath === 'PLAN.md' || filePath === 'PLAN.local.md') {
      issues.push(issue(filePath, 'root plan files must stay local-only'));
    } else if (filePath.startsWith('.codex/')) {
      issues.push(issue(filePath, '.codex files must stay local-only'));
    } else if (filePath.startsWith('.tmp/codex/')) {
      issues.push(issue(filePath, '.tmp/codex files must stay local-only'));
    } else if (/^codex-[^/]*\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'root codex markdown scratch files must stay local-only'));
    } else if (/^[^/]+-codex-plan\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'root codex plan markdown files must stay local-only'));
    } else if (/^[^/]+-scratch\.md$/.test(filePath)) {
      issues.push(issue(filePath, 'root scratch markdown files must stay local-only'));
    }
  }

  return issues;
}

function formatIssue(item) {
  return `${item.path}: ${item.type}: ${item.detail}`;
}

function main() {
  const root = repoRoot();
  const issues = findRepoHygieneIssues(trackedFiles(root));

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
  findRepoHygieneIssues,
  formatIssue,
  normalizePath,
  repoRoot,
  trackedFiles
};
