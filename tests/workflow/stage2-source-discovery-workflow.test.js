'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertTextInOrder,
  workflowStep
} = require('../helpers/workflow-yaml');

test('stage 2 and 3 manual workflows resolve empty newsletter dates to KST today', () => {
  const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  const stage2 = fs.readFileSync(path.join(workflowDir, '02-newsroom-gemini-source-discovery-pr.yml'), 'utf8');
  const stage3 = fs.readFileSync(path.join(workflowDir, '03-newsroom-final-pr.yml'), 'utf8');
  const stage2ResolveStep = workflowStep(stage2, 'Resolve newsletter date');
  const stage3ResolveStep = workflowStep(stage3, 'Resolve newsletter date');
  const stage2UploadStep = workflowStep(stage2, 'Upload source discovery debug artifacts');
  const stage2CreatePrStep = workflowStep(stage2, 'Create source discovery pull request');
  const expectedInput = /newsletter_date:\r?\n\s+description: "Newsletter date in YYYY-MM-DD\. Empty means today in KST\."\r?\n\s+required: false\r?\n\s+default: ""\r?\n\s+type: string/;
  const outputDateExpression = /\$\{\{ steps\.resolve-newsletter-date\.outputs\.date \}\}/;

  assert.match(stage2, expectedInput);
  assert.match(stage3, expectedInput);
  assert.match(stage2, /group: newsroom-source-discovery-\$\{\{ github\.event\.inputs\.newsletter_date \|\| 'auto-kst-today' \}\}/);
  assert.match(stage3, /group: newsroom-final-\$\{\{ github\.event\.inputs\.newsletter_date \|\| 'auto-kst-today' \}\}/);
  assert.doesNotMatch(stage2, /group: newsroom-source-discovery-\$\{\{ github\.event\.inputs\.newsletter_date \|\| github\.run_id \}\}/);
  assert.doesNotMatch(stage3, /group: newsroom-final-\$\{\{ github\.event\.inputs\.newsletter_date \|\| github\.run_id \}\}/);

  for (const step of [stage2ResolveStep, stage3ResolveStep]) {
    assert.match(step, /id: resolve-newsletter-date/);
    assert.match(step, /INPUT_NEWSLETTER_DATE: \$\{\{ (?:inputs\.newsletter_date \|\| )?github\.event\.inputs\.newsletter_date(?: \|\| '')? \}\}/);
    assert.match(step, /TZ=Asia\/Seoul date \+%F/);
    assert.match(step, /\^\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}\$/);
    assert.match(step, /newsletter_date must be YYYY-MM-DD: \$DATE/);
    assert.match(step, /Newsletter date in YYYY-MM-DD\. Empty means today in KST\./);
    assert.match(step, /Resolved newsletter date: \$DATE/);
    assert.match(step, /echo "NEWSLETTER_DATE=\$DATE" >> "\$GITHUB_ENV"/);
    assert.match(step, /echo "date=\$DATE" >> "\$GITHUB_OUTPUT"/);
  }

  assertTextInOrder(stage2, [
    '- name: Checkout repository',
    '- name: Resolve newsletter date',
    '- name: Setup Node.js',
    '- name: Validate newsroom source discovery boundary',
    '- name: Run Gemini source discovery'
  ]);
  assertTextInOrder(stage3, [
    '- name: Checkout repository',
    '- name: Resolve newsletter date',
    '- name: Setup Node.js',
    '- name: Apply manual LLM overrides',
    '- name: Doctor runtime config',
    '- name: Generate newsletter with approved candidate artifact'
  ]);

  assert.match(stage2UploadStep, outputDateExpression);
  assert.match(stage2UploadStep, /content\/collected-news\/\$\{\{ steps\.resolve-newsletter-date\.outputs\.date \}\}\/merged-candidates\.json/);
  assert.match(stage2UploadStep, /content\/newsroom\/\$\{\{ steps\.resolve-newsletter-date\.outputs\.date \}\}\/gemini-source-discovery-report\.md/);
  assert.doesNotMatch(stage2UploadStep, /\$\{\{ env\.NEWSLETTER_DATE \}\}/);
  assert.match(stage2CreatePrStep, /commit-message: "Merge Camera HAL candidate artifacts \$\{\{ steps\.resolve-newsletter-date\.outputs\.date \}\}"/);
  assert.match(stage2CreatePrStep, /branch: newsroom-source-discovery\/\$\{\{ steps\.resolve-newsletter-date\.outputs\.date \}\}/);
  assert.match(stage2CreatePrStep, /title: "\[Newsroom Source Discovery\] Candidate boundary - \$\{\{ steps\.resolve-newsletter-date\.outputs\.date \}\}"/);
  assert.doesNotMatch(stage2CreatePrStep, /\$\{\{ env\.NEWSLETTER_DATE \}\}/);
});
