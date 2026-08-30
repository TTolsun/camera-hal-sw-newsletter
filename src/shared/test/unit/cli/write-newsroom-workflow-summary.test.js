'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  renderWorkflowSummary,
  classifyPublication,
  statusFromOutcome
} = require('../../../tooling/cli/write-newsroom-workflow-summary');

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

// LOCK RETARGETED (#896). 이전 계약은 2번째 분기가 review_publication_ready를 읽는 것이었다.
// 03 라벨 스텝이 라벨 정의(공개 파일 존재 = public_newsletter_ready)로 판정하도록 바뀌었으므로,
// summary도 같은 입력을 봐야 한다. 이 파일의 계약이 존재하는 이유가 "summary와 PR label이
// 어긋나지 않도록"이니, 입력이 갈라지는 순간 계약 자체가 무의미해진다.
test('classifyPublication follows the workflow label precedence', () => {
  assert.equal(classifyPublication({ has_ai_publish_ready: 'true' }), 'publish-ready');
  assert.equal(classifyPublication({ public_newsletter_ready: 'true' }), 'review-only-publication');
  assert.equal(classifyPublication({ diagnostics_only: 'true' }), 'diagnostics-only');
  assert.equal(
    classifyPublication({ diagnostics_only: 'true', generation_status: 'FAILED_REPAIR_REVIEWABLE' }),
    'diagnostics-only (failed-repair-reviewable)'
  );
  assert.equal(classifyPublication({}), 'needs-fix');
});

// #896: has_ai_publish_ready는 audit-images보다 먼저 도는 스텝의 출력이라 감사를 모른다. summary가
// 그 값을 그대로 믿으면 감사 강등 주에 라벨은 review-only-publication, 본문은 "강등", summary는
// publish-ready라고 찍혀 세 리뷰 표면이 서로 다른 말을 한다.
test('classifyPublication demotes publish-ready when the image lineage audit failed', () => {
  assert.equal(
    classifyPublication({
      has_ai_publish_ready: 'true',
      public_newsletter_ready: 'true',
      image_audit_outcome: 'failure'
    }),
    'review-only-publication'
  );
  // 감사가 돌지 않은 outcome(skipped·cancelled)도 통과로 치지 않는다. 라벨 스텝과 같은 규칙이다.
  assert.equal(
    classifyPublication({ has_ai_publish_ready: 'true', image_audit_outcome: 'skipped' }),
    'needs-fix'
  );
  // 감사가 성공했거나 outcome을 보고하지 않은 실행은 그대로 publish-ready다.
  assert.equal(
    classifyPublication({ has_ai_publish_ready: 'true', image_audit_outcome: 'success' }),
    'publish-ready'
  );
  assert.equal(classifyPublication({ has_ai_publish_ready: 'true' }), 'publish-ready');
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

test('review-only run (publish_gate_passed=false, upstream passed) shows Publish skipped, not failed', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    status: { stage_status_log: passLog(), publish_gate_passed: false },
    meta: { review_publication_ready: 'true' }
  });
  assert.match(md, /publish\["Publish"\]:::skipped/);
  assert.doesNotMatch(md, /publish\["Publish"\]:::failed/);
  assert.match(md, /최초 실패:\*\* 없음/);
});

test('terminal failure with stale publish_gate_passed=true does not paint an all-green pipeline', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    status: {
      stage_status_log: passLog(),
      publish_gate_passed: true,
      failure_stage: 'generation',
      failure_reason: 'Terminal structural validation failed.'
    },
    meta: { diagnostics_only: 'true' }
  });
  assert.doesNotMatch(md, /publish\["Publish"\]:::passed/);
  assert.match(md, /publish\["Publish"\]:::skipped/);
  assert.match(md, /최초 실패:\*\* `generation`/);
});

test('render failure in the log colors Render failed and Publish skipped (not passed)', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    status: {
      stage_status_log: [
        { role: 'reporter', attempt: 1, status: 'passed' },
        { role: 'editor', attempt: 1, status: 'passed' },
        { role: 'factcheck', attempt: 1, status: 'passed' },
        { role: 'quality_gate', attempt: 1, status: 'passed' },
        { role: 'render', attempt: 1, status: 'failed' }
      ],
      publish_gate_passed: true,
      failure_stage: 'render',
      failure_reason: 'buildHtml threw.'
    },
    meta: { diagnostics_only: 'true' }
  });
  assert.match(md, /render\["Render"\]:::failed/);
  assert.match(md, /publish\["Publish"\]:::skipped/);
  assert.doesNotMatch(md, /publish\["Publish"\]:::passed/);
});

test('pipeline diagram pins no theme (GitHub auto light/dark) and uses a both-mode status palette', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    status: { stage_status_log: passLog(), publish_gate_passed: true },
    meta: { has_ai_publish_ready: 'true' }
  });
  // no fixed theme or panel fill: GitHub renders a light canvas in light mode and a dark canvas in dark mode
  assert.doesNotMatch(md, /%%\{init/);
  assert.doesNotMatch(md, /style panel fill/);
  assert.doesNotMatch(md, /linkStyle/);
  // nodes are framed by an auto-theming panel titled after the profile
  assert.match(md, /subgraph panel\["Newsroom Final"\]/);
  // solid status palette chosen to read on both light and dark canvases
  assert.match(md, /classDef passed fill:#1f9d57/);
  assert.match(md, /classDef pending fill:#e3b341/);
});

test('single-node profile renders inside a panel', () => {
  const md = renderWorkflowSummary({
    profile: 'source-collect',
    step_outcomes: { collect: 'success' }
  });
  assert.match(md, /subgraph panel\["Source Collect"\]/);
  assert.match(md, /collect\["Collect"\]:::passed/);
});

// #979 3·4·8번: stage_status_log가 role당 한 행이 아니라 stage당 한 행이 됐다. 다이어그램은
// 예전부터 role별 마지막 행을 읽으므로 행이 늘어도 색칠 규칙은 그대로다 -- 이 테스트가 그
// 계약을 잠근다(역방향으로도: 렌더러가 stage_id를 요구하지 않는다).
test('role을 공유하는 여러 행이 있어도 role별 마지막 상태로 색칠한다', () => {
  const md = renderWorkflowSummary({
    profile: 'newsroom-final',
    status: {
      stage_status_log: [
        // stage_id 없는 옛 형식 행. 렌더러가 새 필드를 요구하게 되면 여기서 깨진다.
        { role: 'reporter', attempt: 1, status: 'passed' },
        // 같은 attempt, 같은 role, 다른 stage. 예전에는 이 둘이 한 행으로 뭉개졌다.
        { stage_id: 'editorial_plan', role: 'editor', attempt: 1, status: 'passed' },
        { stage_id: 'editor', role: 'editor', attempt: 1, status: 'failed' }
      ],
      failure_stage: 'editor attempt 1/2',
      failure_reason: 'Gemini output was not valid JSON.'
    },
    meta: { diagnostics_only: 'true' }
  });
  assert.match(md, /reporter\["Reporter"\]:::passed/);
  assert.match(md, /editor\["Editor"\]:::failed/);
  assert.match(md, /factcheck\["Fact-check"\]:::skipped/);
});
