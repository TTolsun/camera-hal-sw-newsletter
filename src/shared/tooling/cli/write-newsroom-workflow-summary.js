'use strict';

// 뉴스룸 워크플로 실행 요약 (#398).
//
// GitHub Actions 기본 화면은 job 박스 하나만 보여줘서 어디서 멈췄는지 알기 어렵다.
// 이 CLI는 GITHUB_STEP_SUMMARY에 Mermaid flowchart + 단계 표 + 최초 실패/skip 사유 +
// artifact 링크를 출력한다. 진단 전용이며 워크플로 결과를 바꾸지 않는다.
//
// renderWorkflowSummary는 순수 함수(IO 없음)라 단위 테스트가 쉽다. main()만 파일/환경을
// 읽고 쓴다. 시크릿, raw LLM 응답, 기사 본문은 출력하지 않는다.

const { ensureArray } = require('../../common/value-coercion');
const fs = require('fs');
const path = require('path');

// 워크플로별 프로필. newsroom-final만 내부 역할 시퀀스를 stage_status_log로 색칠하고,
// 나머지는 GitHub step outcome으로 단순 색칠한다.
const PROFILES = Object.freeze({
  'newsroom-final': {
    title: 'Newsroom Final',
    kind: 'internal',
    nodes: [
      { key: 'reporter', label: 'Reporter' },
      { key: 'editor', label: 'Editor' },
      { key: 'factcheck', label: 'Fact-check' },
      { key: 'quality_gate', label: 'Quality' },
      { key: 'repair', label: 'Repair' },
      { key: 'render', label: 'Render' },
      { key: 'publish', label: 'Publish' }
    ]
  },
  'source-collect': {
    title: 'Source Collect',
    kind: 'steps',
    nodes: [{ key: 'collect', label: 'Collect' }]
  },
  'source-discovery': {
    title: 'Source Discovery',
    kind: 'steps',
    nodes: [{ key: 'discovery', label: 'Discovery' }]
  },
  'auto-daily': {
    title: 'Auto Daily',
    kind: 'steps',
    nodes: [
      { key: 'collect', label: 'Collect (01)' },
      { key: 'discovery', label: 'Discovery (02)' },
      { key: 'editor', label: 'Editor (03)' }
    ]
  }
});

const STATUS_DISPLAY = Object.freeze({
  passed: '✅ passed',
  failed: '❌ failed',
  skipped: '⏭️ skipped',
  pending: '⏳ pending'
});

const STATUS_CLASS = Object.freeze({
  passed: 'passed',
  failed: 'failed',
  skipped: 'skipped',
  pending: 'pending'
});

// 파이프라인 다이어그램 상태 색.
// GitHub은 mermaid 테마를 고정하지 않으면 prefers-color-scheme로 라이트 모드엔 밝은 캔버스,
// 다크 모드엔 어두운 캔버스를 자동 렌더한다. 그래서 init 테마나 패널 배경을 지정하지 않고
// (모드별 자동 분기를 살리고), 노드 상태색만 두 모드 모두에서 또렷한 솔리드 채움으로 고정한다.
const DIAGRAM_CLASS_DEFS = Object.freeze([
  'classDef passed fill:#1f9d57,stroke:#0c5a30,color:#ffffff;',
  'classDef failed fill:#e5484d,stroke:#8e1116,color:#ffffff;',
  'classDef skipped fill:#8b98a9,stroke:#5b6b86,color:#ffffff;',
  'classDef pending fill:#e3b341,stroke:#8a6400,color:#241a00;'
]);

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function truncate(value, max = 200) {
  const out = text(value).replace(/\s+/g, ' ').trim();
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

// GitHub step outcome (success|failure|skipped|'') 를 노드 상태로.
function statusFromOutcome(outcome) {
  switch (text(outcome)) {
    case 'success': return 'passed';
    case 'failure': return 'failed';
    case 'skipped': return 'skipped';
    default: return 'pending';
  }
}

// stage_status_log에서 role의 마지막(최종 attempt) 상태를 찾는다.
function latestStatusForRole(log, role) {
  const entries = ensureArray(log).filter(entry => entry && entry.role === role);
  if (!entries.length) return null;
  const last = entries[entries.length - 1].status;
  // 'started'만 남았다면 그 단계에서 멈춘 것으로 본다.
  return last === 'started' ? 'failed' : last;
}

function resolveInternalNodes(profile, input) {
  const status = input.status || {};
  const log = ensureArray(status.stage_status_log);
  const publishGatePassed = status.publish_gate_passed;
  // failure_stage가 있으면 런이 종료 실패한 것 — 다이어그램이 "최초 실패" 텍스트와
  // 모순(전부 초록)되지 않도록 같은 신호로 쓴다.
  const terminallyFailed = Boolean(text(status.failure_stage));

  // 기록된 단계는 실제 상태를 그대로 색칠한다. publish는 단계가 아니라 게이트라
  // 아래에서 따로 판정한다(빨강 'failed'는 실제로 죽은 상위 단계에만 쓴다).
  const raw = profile.nodes.map(node => {
    if (node.key === 'publish') return { ...node, status: null };
    return { ...node, status: latestStatusForRole(log, node.key) };
  });

  const failureIndex = raw.findIndex(node => node.status === 'failed');
  const pipelineFailed = terminallyFailed || failureIndex !== -1;

  return raw.map((node, index) => {
    if (node.status) return node;
    if (node.key === 'publish') {
      // 상위 단계 실패나 종료 실패면 발행은 일어나지 않았다. 발행 게이트 통과일 때만 초록.
      if (pipelineFailed) return { ...node, status: 'skipped' };
      return { ...node, status: publishGatePassed === true ? 'passed' : 'skipped' };
    }
    if (node.key === 'repair') return { ...node, status: 'skipped' };
    if (failureIndex !== -1 && index > failureIndex) return { ...node, status: 'skipped' };
    return { ...node, status: 'pending' };
  });
}

function resolveStepNodes(profile, input) {
  const outcomes = input.step_outcomes || {};
  return profile.nodes.map(node => ({ ...node, status: statusFromOutcome(outcomes[node.key]) }));
}

function resolveNodes(profile, input) {
  return profile.kind === 'internal'
    ? resolveInternalNodes(profile, input)
    : resolveStepNodes(profile, input);
}

// 03 label step과 동일한 우선순위 (summary와 PR label이 어긋나지 않도록).
function classifyPublication(meta = {}) {
  if (text(meta.has_ai_publish_ready) === 'true') return 'publish-ready';
  if (text(meta.review_publication_ready) === 'true') return 'review-only-publication';
  if (text(meta.diagnostics_only) === 'true') {
    return text(meta.generation_status) === 'FAILED_REPAIR_REVIEWABLE'
      ? 'diagnostics-only (failed-repair-reviewable)'
      : 'diagnostics-only';
  }
  return 'needs-fix';
}

function renderMermaid(nodes, panelTitle) {
  const chain = nodes
    .map(node => `${node.key}["${node.label}"]:::${STATUS_CLASS[node.status] || 'pending'}`)
    .join(' --> ');
  // 테마를 고정하지 않아 GitHub이 라이트/다크 모드에 맞는 캔버스를 자동 적용한다. 패널(subgraph)도
  // 채움 없이 두어 모드에 따라 자동 색을 따르고, 노드 상태색만 classDef로 고정한다.
  return [
    '```mermaid',
    'flowchart LR',
    `  subgraph panel["${panelTitle}"]`,
    '  direction LR',
    `    ${chain}`,
    '  end',
    ...DIAGRAM_CLASS_DEFS.map(def => `  ${def}`),
    '```'
  ].join('\n');
}

function renderTable(nodes) {
  const rows = nodes.map(node => `| ${node.label} | ${STATUS_DISPLAY[node.status] || node.status} |`);
  return ['| Stage | Status |', '|---|---|', ...rows].join('\n');
}

function renderFirstFailure(input, nodes) {
  const status = input.status || {};
  if (text(status.failure_stage)) {
    const reason = truncate(status.failure_reason) || 'no reason recorded';
    return `**최초 실패:** \`${text(status.failure_stage)}\` — ${reason}`;
  }
  const failed = nodes.find(node => node.status === 'failed');
  if (failed) return `**최초 실패:** ${failed.label}`;
  return '**최초 실패:** 없음';
}

function renderSkips(input) {
  const meta = input.meta || {};
  const lines = [];
  if (text(meta.public_newsletter_ready) && text(meta.public_newsletter_ready) !== 'true') {
    lines.push(`- Validate site / Public artifacts: ${truncate(meta.public_newsletter_reason) || 'public newsletter not ready'}`);
  }
  if (text(meta.review_pr_ready) && text(meta.review_pr_ready) !== 'true') {
    lines.push(`- PR creation: ${truncate(meta.reviewable_artifact_reason) || 'no reviewable artifact'}`);
  }
  if (!lines.length) return '';
  return ['**Skip 사유:**', ...lines].join('\n');
}

function renderArtifacts(input) {
  const lines = ['**Artifacts:**'];
  if (text(input.run_url)) lines.push(`- [Run artifacts & logs](${text(input.run_url)})`);
  const artifact = input.artifact || {};
  if (text(artifact.debug_name)) lines.push(`- Debug bundle: \`${text(artifact.debug_name)}\``);
  for (const keyPath of ensureArray(artifact.key_paths)) {
    if (text(keyPath)) lines.push(`- \`${text(keyPath)}\``);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function renderWorkflowSummary(input = {}) {
  const profileKey = text(input.profile) || 'newsroom-final';
  const profile = PROFILES[profileKey] || PROFILES['newsroom-final'];
  const nodes = resolveNodes(profile, input);
  const dateText = text(input.date) ? ` — ${text(input.date)}` : '';

  const sections = [`# 📋 ${profile.title}${dateText}`];

  if (profile.kind === 'internal') {
    sections.push(`**발행 판정:** \`${classifyPublication(input.meta || {})}\``);
  }
  if (text(input.pr_number)) {
    sections.push(`**PR:** #${text(input.pr_number)}`);
  }

  sections.push('## Pipeline', renderMermaid(nodes, profile.title));
  sections.push('## Stages', renderTable(nodes));
  sections.push(renderFirstFailure(input, nodes));

  const skips = renderSkips(input);
  if (skips) sections.push(skips);

  const artifacts = renderArtifacts(input);
  if (artifacts) sections.push(artifacts);

  return `${sections.filter(Boolean).join('\n\n')}\n`;
}

function readStatusJson(statusPath) {
  try {
    if (!fs.existsSync(statusPath)) return {};
    return JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch (error) {
    return {};
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--profile') args.profile = argv[++i];
    else if (token === '--output') args.output = argv[++i];
    else if (token === '--status') args.status = argv[++i];
    else if (token === '--input') args.input = argv[++i];
  }
  return args;
}

function buildInputFromEnv(args, env) {
  const profile = args.profile || env.SUMMARY_PROFILE || 'newsroom-final';
  const statusPath = args.status || path.join(process.cwd(), '.tmp', 'newsletter-generation-status.json');
  const status = profile === 'newsroom-final' ? readStatusJson(statusPath) : {};
  return {
    profile,
    date: env.NEWSLETTER_DATE || status.date || '',
    run_url: env.RUN_URL || '',
    pr_number: env.PR_NUMBER || '',
    status,
    step_outcomes: {
      generate: env.OUTCOME_GENERATE,
      collect: env.OUTCOME_COLLECT,
      discovery: env.OUTCOME_DISCOVERY,
      editor: env.OUTCOME_EDITOR,
      ensure_public: env.OUTCOME_ENSURE_PUBLIC,
      validate: env.OUTCOME_VALIDATE
    },
    meta: {
      public_newsletter_ready: env.PUBLIC_NEWSLETTER_READY,
      public_newsletter_reason: env.PUBLIC_NEWSLETTER_REASON,
      review_pr_ready: env.REVIEW_PR_READY,
      reviewable_artifact_reason: env.REVIEWABLE_ARTIFACT_REASON,
      diagnostics_only: env.DIAGNOSTICS_ONLY,
      review_publication_ready: env.REVIEW_PUBLICATION_READY,
      generation_status: env.GENERATION_STATUS || status.status,
      has_ai_publish_ready: env.HAS_AI_PUBLISH_READY,
      composition_mode: env.COMPOSITION_MODE
    },
    artifact: {
      debug_name: env.DEBUG_ARTIFACT_NAME || '',
      key_paths: [
        (env.NEWSLETTER_DATE || status.date) ? `articles/content/newsroom/${env.NEWSLETTER_DATE || status.date}/` : '',
        (env.NEWSLETTER_DATE || status.date) ? `articles/newsletters/${env.NEWSLETTER_DATE || status.date}/` : ''
      ].filter(Boolean)
    }
  };
}

function writeSummary(markdown, outputPath) {
  if (outputPath) {
    fs.appendFileSync(outputPath, markdown);
  } else {
    process.stdout.write(markdown);
  }
}

function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const outputPath = args.output || env.GITHUB_STEP_SUMMARY || '';
  try {
    let input;
    if (args.input) {
      input = JSON.parse(fs.readFileSync(args.input, 'utf8'));
    } else {
      input = buildInputFromEnv(args, env);
    }
    writeSummary(renderWorkflowSummary(input), outputPath);
  } catch (error) {
    // 요약 생성 실패가 워크플로 결과를 바꾸면 안 된다 — 최소 fallback 후 정상 종료.
    writeSummary(`# 워크플로 요약 생성 실패\n\n\`${truncate(error && error.message)}\`\n`, outputPath);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  PROFILES,
  renderWorkflowSummary,
  classifyPublication,
  statusFromOutcome,
  buildInputFromEnv,
  main
};
