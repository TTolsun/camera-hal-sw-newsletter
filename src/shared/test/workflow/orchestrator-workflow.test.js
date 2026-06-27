'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('newsletters orchestrator calls 01 02 03 via workflow_call', () => {
  const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');
  const coordinator = fs.readFileSync(path.join(workflowDir, 'newsletters-00-orchestrator.yml'), 'utf8');

  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/newsletters-01-source-collect-pr\.yml/);
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/newsletters-02-source-discovery-pr\.yml/);
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/newsletters-03-editor-pr\.yml/);

  assert.doesNotMatch(coordinator, /npm run collect/);
  assert.doesNotMatch(coordinator, /npm run generate/);
  assert.doesNotMatch(coordinator, /npm run test/);

  assert.match(coordinator, /needs:\s*\[collect,\s*discover\]/);

  // Source discovery is optional enrichment: its failure must not block generate.
  // generate keeps sequencing after discover but runs whenever collect succeeded.
  assert.match(coordinator, /if:\s*\$\{\{\s*always\(\)\s*&&\s*needs\.collect\.result\s*==\s*'success'\s*\}\}/);

  assert.match(coordinator, /^\s*schedule:/m);
  assert.match(coordinator, /cron: "0 0 \* \* 1"/);

  assert.match(coordinator, /secrets:\s*inherit/);
});
