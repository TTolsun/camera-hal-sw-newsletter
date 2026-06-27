'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('schedule cutover leaves only the daily auto PR workflow on the newsroom schedule', () => {
  const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');
  const legacyWeeklyFile = ['01', 'weekly', 'newsroom', 'pr.yml'].join('-');
  const legacyWeeklyPath = path.join(workflowDir, legacyWeeklyFile);
  const stage1 = fs.readFileSync(path.join(workflowDir, '01-newsletters-source-collect-pr.yml'), 'utf8');
  const stage2 = fs.readFileSync(path.join(workflowDir, '02-newsletters-source-discovery-pr.yml'), 'utf8');
  const stage3 = fs.readFileSync(path.join(workflowDir, '03-newsletters-editor-pr.yml'), 'utf8');
  const dailyAuto = fs.readFileSync(path.join(workflowDir, '00-newsletters-auto-daily-pr.yml'), 'utf8');
  const scheduledWorkflowFiles = fs
    .readdirSync(workflowDir)
    .filter((file) => file.endsWith('.yml'))
    .filter((file) => fs.readFileSync(path.join(workflowDir, file), 'utf8').includes('cron: "0 0 * * 1"'));

  assert.equal(fs.existsSync(legacyWeeklyPath), false);
  assert.deepEqual(scheduledWorkflowFiles, ['00-newsletters-auto-daily-pr.yml']);
  assert.doesNotMatch(stage1, /^\s*schedule:/m);
  assert.match(dailyAuto, /^\s*schedule:/m);
  assert.match(dailyAuto, /cron: "0 0 \* \* 1"/);
  assert.doesNotMatch(stage2, /^\s*schedule:/m);
  assert.doesNotMatch(stage3, /^\s*schedule:/m);
  assert.doesNotMatch(stage3, /npm run collect/);
});

test('01 workflow accepts workflow_call trigger for auto mode', () => {
  const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');
  const stage1 = fs.readFileSync(path.join(workflowDir, '01-newsletters-source-collect-pr.yml'), 'utf8');

  assert.match(stage1, /^\s*workflow_call:/m);
  assert.match(stage1, /value: \$\{\{ jobs\.create-raw-candidate-pr\.outputs\.date \}\}/);
  assert.match(stage1, /Commit candidates to main \(auto mode\)/);
  assert.match(stage1, /inputs\.auto_mode == true/);
  assert.match(stage1, /inputs\.auto_mode != true/);
  assert.match(stage1, /git push origin HEAD:main/);
});

test('01 collect workflow honors workflow_call inputs in its concurrency group', () => {
  const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');
  const stage1 = fs.readFileSync(path.join(workflowDir, '01-newsletters-source-collect-pr.yml'), 'utf8');

  // When 00 calls 01 via workflow_call, the concurrency key must derive from the
  // reusable `inputs.newsletter_date` (matching 02/03), not the old run_id fallback
  // that ignored the input and skipped same-date serialization.
  assert.match(stage1, /group: newsroom-raw-\$\{\{ inputs\.newsletter_date \|\| github\.event\.inputs\.newsletter_date \|\| 'auto-kst-today' \}\}/);
  assert.doesNotMatch(stage1, /group: newsroom-raw-\$\{\{ github\.event\.inputs\.newsletter_date \|\| github\.run_id \}\}/);
});

test('newsroom and site-validation workflows install with npm ci on a cached node setup', () => {
  const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');
  const installWorkflows = [
    '01-newsletters-source-collect-pr.yml',
    '02-newsletters-source-discovery-pr.yml',
    '03-newsletters-editor-pr.yml',
    'validate-site.yml'
  ];

  for (const file of installWorkflows) {
    const yaml = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    assert.match(yaml, /cache: npm/, `${file} setup-node must enable the npm cache`);
    assert.match(yaml, /run: npm ci\b/, `${file} must install dependencies with npm ci`);
    assert.doesNotMatch(yaml, /npm install/, `${file} must not keep the dead npm install fallback`);
  }
});
