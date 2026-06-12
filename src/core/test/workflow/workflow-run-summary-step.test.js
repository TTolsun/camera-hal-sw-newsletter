'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { workflowStep } = require('../helpers/workflow-yaml');

const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');

function read(file) {
  return fs.readFileSync(path.join(workflowDir, file), 'utf8');
}

// #398: every newsroom workflow emits a visual run summary via the shared CLI.
const STEP_PROFILES = [
  ['01-newsletters-source-collect-pr.yml', 'source-collect'],
  ['02-newsletters-source-discovery-pr.yml', 'source-discovery'],
  ['03-newsletters-editor-pr.yml', 'newsroom-final']
];

for (const [file, profile] of STEP_PROFILES) {
  test(`${file} wires a non-blocking run-summary step (${profile})`, () => {
    const step = workflowStep(read(file), 'Write workflow run summary');
    assert.match(step, /if: always\(\)/);
    assert.match(step, /continue-on-error:\s*true/);
    assert.match(step, new RegExp(`SUMMARY_PROFILE: ${profile}`));
    assert.match(step, /run: node src\/core\/tooling\/cli\/write-newsroom-workflow-summary\.js/);
  });
}

test('00 auto-daily adds an always-run summary job over the child workflows', () => {
  const coordinator = read('00-newsletters-auto-daily-pr.yml');
  assert.match(coordinator, /summary:\s*\n\s*needs: \[collect, discover, generate\]\s*\n\s*if: always\(\)/);
  assert.match(coordinator, /SUMMARY_PROFILE: auto-daily/);
  assert.match(coordinator, /OUTCOME_COLLECT: \$\{\{ needs\.collect\.result \}\}/);
  assert.match(coordinator, /OUTCOME_EDITOR: \$\{\{ needs\.generate\.result \}\}/);
  assert.match(coordinator, /run: node src\/core\/tooling\/cli\/write-newsroom-workflow-summary\.js/);
});
