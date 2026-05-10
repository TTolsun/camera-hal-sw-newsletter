const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findRepoHygieneIssues,
  formatIssue,
  normalizePath
} = require('../../scripts/check-repo-hygiene');

test('findRepoHygieneIssues reports tracked root agent scratch files', () => {
  const issues = findRepoHygieneIssues([
    'PLAN.md',
    'PLAN.local.md',
    '.codex/PLAN.local.md',
    '.tmp/codex/issue-68.md',
    'codex-notes.md',
    'issue-68-codex-plan.md',
    'issue-68-scratch.md',
    '.tmp/newsletter-date.txt'
  ]);

  assert.deepEqual(issues.map(item => item.path), [
    'PLAN.md',
    'PLAN.local.md',
    '.codex/PLAN.local.md',
    '.tmp/codex/issue-68.md',
    'codex-notes.md',
    'issue-68-codex-plan.md',
    'issue-68-scratch.md'
  ]);
  assert.equal(issues.every(item => item.type === 'tracked_agent_scratch'), true);
  assert.match(formatIssue(issues[0]), /^PLAN\.md: tracked_agent_scratch: /);
});

test('findRepoHygieneIssues allows official docs and nested markdown names', () => {
  const issues = findRepoHygieneIssues([
    'README.md',
    'AGENTS.md',
    'docs/plans/PLAN.md',
    'docs/plans/codex-notes.md',
    'docs/plans/issue-68-codex-plan.md',
    'docs/plans/issue-68-scratch.md',
    'notes/codex-notes.md'
  ]);

  assert.deepEqual(issues, []);
});

test('findRepoHygieneIssues normalizes Windows path separators', () => {
  const issues = findRepoHygieneIssues([
    '.codex\\PLAN.local.md',
    '.tmp\\codex\\issue-68.md',
    'codex-notes.md',
    'nested\\codex-notes.md'
  ]);

  assert.deepEqual(issues.map(item => item.path), [
    '.codex/PLAN.local.md',
    '.tmp/codex/issue-68.md',
    'codex-notes.md'
  ]);
  assert.equal(normalizePath('docs\\plans\\example.md'), 'docs/plans/example.md');
});

test('findRepoHygieneIssues reports root tests even when they are allowlisted', () => {
  const issues = findRepoHygieneIssues([
    'tests/existing.test.js',
    'tests/new-root.test.js',
    'tests/unit/new-root.test.js'
  ], {
    rootTestAllowlist: ['tests/existing.test.js']
  });

  assert.deepEqual(issues.map(item => item.path), [
    'tests/existing.test.js',
    'tests/existing.test.js',
    'tests/new-root.test.js'
  ]);
  assert.equal(issues.every(item => item.type === 'root_test_structure'), true);
  assert.match(issues[0].detail, /allowlist must remain empty/);
  assert.match(formatIssue(issues[2]), /^tests\/new-root\.test\.js: root_test_structure: /);
});

test('findRepoHygieneIssues reports non-empty root test allowlist entries as migration debt', () => {
  const issues = findRepoHygieneIssues(['tests/unit/not-root.test.js'], {
    rootTestAllowlist: [
      'tests/existing.test.js',
      'tests/missing.test.js',
      'tests/unit/not-root.test.js'
    ]
  });

  assert.deepEqual(issues.map(item => item.path), [
    'tests/existing.test.js',
    'tests/missing.test.js',
    'tests/unit/not-root.test.js'
  ]);
  assert.equal(issues.every(item => item.type === 'root_test_structure'), true);
  assert.equal(
    issues.every(item => item.detail === 'root test allowlist must remain empty after root migration'),
    true
  );
});
