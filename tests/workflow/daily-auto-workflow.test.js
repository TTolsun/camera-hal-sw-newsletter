'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('daily auto PR coordinator calls 01 02 03 via workflow_call', () => {
  const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  const coordinator = fs.readFileSync(path.join(workflowDir, '00-newsletters-auto-daily-pr.yml'), 'utf8');

  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/01-newsroom-manual-source-collect-pr\.yml/);
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/02-newsroom-gemini-source-discovery-pr\.yml/);
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/03-newsroom-final-pr\.yml/);

  assert.doesNotMatch(coordinator, /npm run collect/);
  assert.doesNotMatch(coordinator, /npm run generate/);
  assert.doesNotMatch(coordinator, /npm run test/);

  assert.match(coordinator, /needs:\s*\[collect,\s*discover\]/);

  assert.match(coordinator, /^\s*schedule:/m);
  assert.match(coordinator, /cron: "0 0 \* \* \*"/);

  assert.match(coordinator, /secrets:\s*inherit/);
});
