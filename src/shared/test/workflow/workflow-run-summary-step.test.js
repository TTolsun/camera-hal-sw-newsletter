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
  ['newsletters-01-source-collect-pr.yml', 'source-collect'],
  ['newsletters-02-source-discovery-pr.yml', 'source-discovery'],
  ['newsletters-03-editor-pr.yml', 'newsroom-final']
];

for (const [file, profile] of STEP_PROFILES) {
  test(`${file} wires a non-blocking run-summary step (${profile})`, () => {
    const step = workflowStep(read(file), 'Write workflow run summary');
    assert.match(step, /if: always\(\)/);
    assert.match(step, /continue-on-error:\s*true/);
    assert.match(step, new RegExp(`SUMMARY_PROFILE: ${profile}`));
    assert.match(step, /run: node src\/shared\/tooling\/cli\/write-newsroom-workflow-summary\.js/);
  });
}

// #896: run summary는 라벨·PR 본문과 함께 세 번째 리뷰 표면이다. summary가 감사 outcome을 못 받으면
// 감사 강등 주에 라벨은 review-only-publication인데 summary는 publish-ready로 찍힌다. summary가 읽는
// has_ai_publish_ready는 audit-images보다 먼저 도는 스텝의 출력이라 감사를 모르기 때문이다.
test('03 run-summary step receives the image lineage audit outcome', () => {
  const workflow = read('newsletters-03-editor-pr.yml');
  const step = workflowStep(workflow, 'Write workflow run summary');

  assert.match(step, /IMAGE_AUDIT_OUTCOME: \$\{\{ steps\.audit-images\.outcome \|\| 'skipped' \}\}/);
  assert.match(step, /PUBLIC_NEWSLETTER_READY: \$\{\{ steps\.meta\.outputs\.public_newsletter_ready \}\}/);
  // 감사 스텝이 먼저 끝나야 outcome 주입이 성립한다.
  assert.ok(
    workflow.indexOf('- name: Audit newsletter image lineage') <
      workflow.indexOf('- name: Write workflow run summary')
  );
});

test('00 auto-daily adds an always-run summary job over the child workflows', () => {
  const coordinator = read('newsletters-00-orchestrator.yml');
  assert.match(coordinator, /summary:\s*\n\s*needs: \[collect, discover, generate\]\s*\n\s*if: always\(\)/);
  assert.match(coordinator, /SUMMARY_PROFILE: auto-daily/);
  assert.match(coordinator, /OUTCOME_COLLECT: \$\{\{ needs\.collect\.result \}\}/);
  assert.match(coordinator, /OUTCOME_EDITOR: \$\{\{ needs\.generate\.result \}\}/);
  assert.match(coordinator, /run: node src\/shared\/tooling\/cli\/write-newsroom-workflow-summary\.js/);
});
