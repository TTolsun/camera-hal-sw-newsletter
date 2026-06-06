'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  renderWorkflowSummary,
  classifyPublication,
  statusFromOutcome
} = require('../../../scripts/newsroom/cli/write-newsroom-workflow-summary');

function passLog() {
  return [
    { role: 'reporter', attempt: 1, status: 'passed' },
    { role: 'editor', attempt: 1, status: 'passed' },
    { role: 'factcheck', attempt: 1, status: 'passed' },
    { role: 'quality_gate', attempt: 1, status: 'passed' },
    { role: 'render', attempt: 1, status: 'passed' }
  ];
}

test('statusFromOutcome maps GitHub outcomes', () => {
  assert.equal(statusFromOutcome('success'), 'passed');
  assert.equal(statusFromOutcome('failure'), 'failed');
  assert.equal(statusFromOutcome('skipped'), 'skipped');
  assert.equal(statusFromOutcome(''), 'pending');
});

test('classifyPublication follows the workflow label precedence', () => {
  assert.equal(classifyPublication({ has_ai_publish_ready: 'true' }), 'publish-ready');
  assert.equal(classifyPublication({ review_publication_ready: 'true' }), 'review-only-publication');
  assert.equal(classifyPublication({ diagnostics_only: 'true' }), 'diagnostics-only');
  assert.equal(
    classifyPublication({ diagnostics_only: 'true', generation_status: 'FAILED_REPAIR_REVIEWABLE' }),
    'diagnostics-only (failed-repair-reviewable)'
  );
  assert.equal(classifyPublication({}), 'needs-fix');
});

test('success run renders all-passed pipeline, publish-ready, and PR link', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    date: '2026-06-06',
    pr_number: '541',
    status: { stage_status_log: passLog(), publish_gate_passed: true },
    meta: { has_ai_publish_ready: 'true' }
  });
  assert.match(md, /publish-ready/);
  assert.match(md, /#541/);
  assert.match(md, /```mermaid/);
  assert.match(md, /reporter\["Reporter"\]:::passed/);
  assert.match(md, /publish\["Publish"\]:::passed/);
  assert.match(md, /최초 실패:\*\* 없음/);
});

test('generate failure marks the stage failed and downstream skipped', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    status: {
      stage_status_log: [
        { role: 'reporter', attempt: 1, status: 'passed' },
        { role: 'editor', attempt: 1, status: 'failed' }
      ],
      failure_stage: 'editor attempt 1/2',
      failure_reason: 'Gemini output was not valid JSON.'
    },
    meta: { diagnostics_only: 'true' }
  });
  assert.match(md, /editor\["Editor"\]:::failed/);
  assert.match(md, /factcheck\["Fact-check"\]:::skipped/);
  assert.match(md, /publish\["Publish"\]:::skipped/);
  assert.match(md, /최초 실패:\*\* `editor attempt 1\/2`/);
  assert.match(md, /diagnostics-only/);
});

test('public-artifact block surfaces skip reasons for validate and PR', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    status: { stage_status_log: passLog() },
    meta: {
      public_newsletter_ready: 'false',
      public_newsletter_reason: 'missing public files',
      review_pr_ready: 'false',
      reviewable_artifact_reason: 'no reviewable artifact'
    }
  });
  assert.match(md, /Validate site \/ Public artifacts: missing public files/);
  assert.match(md, /PR creation: no reviewable artifact/);
});

test('step profiles color nodes from step outcomes', () => {
  const md = renderWorkflowSummary({
    profile: 'auto-daily',
    step_outcomes: { collect: 'success', discovery: 'failure', editor: 'skipped' }
  });
  assert.match(md, /collect\["Collect \(01\)"\]:::passed/);
  assert.match(md, /discovery\["Discovery \(02\)"\]:::failed/);
  assert.match(md, /editor\["Editor \(03\)"\]:::skipped/);
});

test('redaction: no secret or body sentinels leak into the summary', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    status: {
      stage_status_log: passLog(),
      // these fields are intentionally not rendered by the summary
      raw_llm_response: 'SENTINEL_RAW_LLM',
      api_key: 'SENTINEL_SECRET'
    },
    meta: { has_ai_publish_ready: 'true', api_key: 'SENTINEL_SECRET' }
  });
  assert.doesNotMatch(md, /SENTINEL_RAW_LLM/);
  assert.doesNotMatch(md, /SENTINEL_SECRET/);
});

test('malformed input still renders a non-empty summary without throwing', () => {
  const md = renderWorkflowSummary({ profile: 'newsroom-final' });
  assert.ok(md.length > 0);
  assert.match(md, /```mermaid/);
  const unknown = renderWorkflowSummary({ profile: 'does-not-exist' });
  assert.ok(unknown.length > 0);
});
