const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findRepoHygieneIssues,
  formatIssue,
  normalizePath
} = require('../../tooling/check-repo-hygiene');

test('findRepoHygieneIssues reports tracked root agent scratch files', () => {
  const issues = findRepoHygieneIssues([
    'PLAN.md',
    'PLAN.local.md',
    '.codex/PLAN.local.md',
    '.tmp/codex/local-plan.md',
    'codex-notes.md',
    'feature-codex-plan.md',
    'feature-scratch.md',
    '.tmp/newsletter-date.txt'
  ]);

  assert.deepEqual(issues.map(item => item.path), [
    'PLAN.md',
    'PLAN.local.md',
    '.codex/PLAN.local.md',
    '.tmp/codex/local-plan.md',
    'codex-notes.md',
    'feature-codex-plan.md',
    'feature-scratch.md',
    '.tmp/newsletter-date.txt'
  ]);
  assert.equal(issues.every(item => item.type === 'tracked_agent_scratch'), true);
  assert.match(formatIssue(issues[0]), /^PLAN\.md: tracked_agent_scratch: /);
});

test('findRepoHygieneIssues allows official docs and nested markdown names', () => {
  const issues = findRepoHygieneIssues([
    'README.md',
    'AGENTS.md',
    'docs/operations/manual-run.ko.md',
    'docs/evidence/source-aware-linked-evidence-contract.md',
    'nested/codex-notes.md'
  ]);

  assert.deepEqual(issues, []);
});

test('findRepoHygieneIssues reports tracked scratch markdown folders', () => {
  const issues = findRepoHygieneIssues([
    'notes/codex-notes.md',
    'memory/checkpoint.md',
    'checkpoint/review.md',
    'checkpoints/review-status.md',
    'notes/raw.txt'
  ]);

  assert.deepEqual(issues.map(item => item.path), [
    'notes/codex-notes.md',
    'memory/checkpoint.md',
    'checkpoint/review.md',
    'checkpoints/review-status.md'
  ]);
  assert.equal(issues.every(item => item.type === 'tracked_agent_scratch'), true);
});

test('findRepoHygieneIssues reports tracked worklog document folders', () => {
  const issues = findRepoHygieneIssues([
    'docs/plans/root-docs-audit.md',
    'docs/debug/source-url-prompt-quality-rollout.md',
    'docs/refactoring/pr-body-publish-gate-consistency-plan.md',
    'docs/archive/handoff-2026-05-05.md',
    'docs/testing/test-baseline.md'
  ]);

  assert.deepEqual(issues.map(item => item.path), [
    'docs/plans/root-docs-audit.md',
    'docs/debug/source-url-prompt-quality-rollout.md',
    'docs/refactoring/pr-body-publish-gate-consistency-plan.md',
    'docs/archive/handoff-2026-05-05.md',
    'docs/testing/test-baseline.md'
  ]);
  assert.equal(issues.every(item => item.type === 'tracked_worklog_document'), true);
});

test('findRepoHygieneIssues normalizes Windows path separators', () => {
  const issues = findRepoHygieneIssues([
    '.codex\\PLAN.local.md',
    '.tmp\\codex\\local-plan.md',
    'codex-notes.md',
    'nested\\codex-notes.md'
  ]);

  assert.deepEqual(issues.map(item => item.path), [
    '.codex/PLAN.local.md',
    '.tmp/codex/local-plan.md',
    'codex-notes.md'
  ]);
  assert.equal(normalizePath('docs\\operations\\example.md'), 'docs/operations/example.md');
});

test('findRepoHygieneIssues reports one-off script paths by exact segment or basename token', () => {
  const issues = findRepoHygieneIssues([
    'scripts/tmp/probe.js',
    'scripts/temp/foo.mjs',
    'scripts/scratch/check.js',
    'scripts/local/repro.js',
    'scripts/one-off/repair.ps1',
    'scripts/one-off-repair.js',
    'scripts/repro-camera-issue.js',
    'scripts/probe-source-quality.js',
    'scripts/experiment-ranking.mjs',
    'scripts/one.js',
    'scripts/off.js'
  ]);

  assert.deepEqual(issues.map(item => item.path), [
    'scripts/tmp/probe.js',
    'scripts/temp/foo.mjs',
    'scripts/scratch/check.js',
    'scripts/local/repro.js',
    'scripts/one-off/repair.ps1',
    'scripts/one-off-repair.js',
    'scripts/repro-camera-issue.js',
    'scripts/probe-source-quality.js',
    'scripts/experiment-ranking.mjs'
  ]);
  assert.equal(issues.every(item => item.type === 'tracked_one_off_script'), true);
});

test('findRepoHygieneIssues avoids substring false positives for maintained scripts', () => {
  const issues = findRepoHygieneIssues([
    'scripts/audit-historical-newsletters.js',
    'scripts/newsroom/localization-helper.js',
    'scripts/render/temperature-scale.js',
    'scripts/diagnostics/reproduction-policy.js',
    'scripts/experiments-summary.js',
    'scripts/newsroom/reproduce-policy-docs.js',
    'scripts/newsroom/probe-notes.md'
  ]);

  assert.deepEqual(issues, []);
});

test('findRepoHygieneIssues reports stray tests outside src/<layer>/test/ even when allowlisted', () => {
  const issues = findRepoHygieneIssues([
    'src/core/foo.test.js',
    'bar.test.js',
    'tests/legacy.test.js',
    'src/core/test/unit/baz.test.js'
  ], {
    rootTestAllowlist: ['src/core/foo.test.js']
  });

  assert.deepEqual(issues.map(item => item.path), [
    'src/core/foo.test.js',
    'src/core/foo.test.js',
    'bar.test.js',
    'tests/legacy.test.js'
  ]);
  assert.equal(issues.every(item => item.type === 'root_test_structure'), true);
  assert.match(issues[0].detail, /allowlist must remain empty/);
  assert.match(formatIssue(issues[2]), /^bar\.test\.js: root_test_structure: /);
});

test('findRepoHygieneIssues reports non-empty root test allowlist entries as migration debt', () => {
  const issues = findRepoHygieneIssues(['src/core/test/unit/not-root.test.js'], {
    rootTestAllowlist: [
      'src/core/foo.test.js',
      'src/core/test/missing.test.js',
      'src/core/test/unit/not-root.test.js'
    ]
  });

  assert.deepEqual(issues.map(item => item.path), [
    'src/core/foo.test.js',
    'src/core/test/missing.test.js',
    'src/core/test/unit/not-root.test.js'
  ]);
  assert.equal(issues.every(item => item.type === 'root_test_structure'), true);
  assert.equal(
    issues.every(item => item.detail === 'root test allowlist must remain empty after root migration'),
    true
  );
});
