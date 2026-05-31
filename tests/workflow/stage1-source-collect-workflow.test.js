'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('schedule cutover leaves only the RAW workflow on the daily newsroom schedule', () => {
  const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  const legacyWeeklyFile = ['01', 'weekly', 'newsroom', 'pr.yml'].join('-');
  const legacyWeeklyPath = path.join(workflowDir, legacyWeeklyFile);
  const stage1 = fs.readFileSync(path.join(workflowDir, '01-newsroom-manual-source-collect-pr.yml'), 'utf8');
  const stage2 = fs.readFileSync(path.join(workflowDir, '02-newsroom-gemini-source-discovery-pr.yml'), 'utf8');
  const stage3 = fs.readFileSync(path.join(workflowDir, '03-newsroom-final-pr.yml'), 'utf8');
  const scheduledWorkflowFiles = fs
    .readdirSync(workflowDir)
    .filter((file) => file.endsWith('.yml'))
    .filter((file) => fs.readFileSync(path.join(workflowDir, file), 'utf8').includes('cron: "0 0 * * *"'));

  assert.equal(fs.existsSync(legacyWeeklyPath), false);
  assert.deepEqual(scheduledWorkflowFiles, ['01-newsroom-manual-source-collect-pr.yml']);
  assert.match(stage1, /^\s*schedule:/m);
  assert.match(stage1, /cron: "0 0 \* \* \*"/);
  assert.doesNotMatch(stage2, /^\s*schedule:/m);
  assert.doesNotMatch(stage3, /^\s*schedule:/m);
  assert.doesNotMatch(stage3, /npm run collect/);
});
