'use strict';

const fs = require('fs');
const path = require('path');

// 후속 이슈 draft를 낼 기준. 같은 대상에 같은 권고가 이만큼 연속된 실행에서 붙으면 사람이 볼
// 값이다.
//
// "주"가 아니라 "실행"을 센다. 지금 발행은 주 1회지만 저장소 역사에는 데일리 실행이 섞여 있고,
// 재실행이나 복구 실행도 한 회로 잡힌다. 필드 이름과 문구를 전부 실행 기준으로 맞춰 두면
// 케이던스가 바뀌어도 값의 뜻이 흔들리지 않는다.
//
// 이 숫자는 커밋된 진단 산출물 29회분(2026-05-22 ~ 2026-09-07)을 전수 재계산해서 골랐다.
// 주간 케이던스로 들어선 2026-07-06 이후 10회를 기준별로 세면 이렇다(중앙값은 짝수 개의
// 아래쪽 값).
//
//   연속  4회   14,12,11,10,10, 9, 8, 6, 6, 1   중앙값  9   합계 87
//   연속  6회   14,12,11, 8, 6, 7, 8, 6, 6, 0   중앙값  7   합계 78
//   연속  8회    5, 6,11, 8, 6, 6, 6, 5, 6, 0   중앙값  6   합계 59
//   연속 10회    4, 4, 4, 5, 6, 6, 6, 4, 4, 0   중앙값  4   합계 43
//   연속 12회    4, 4, 4, 4, 4, 5, 6, 4, 4, 0   중앙값  4   합계 39
//
// 10을 골랐다. 기준은 "중앙값이 더 줄지 않는 가장 작은 값"이다. 4~9는 올릴 때마다 중앙값이
// 계속 줄어들어 어디서 멈춰야 할지가 데이터에서 나오지 않고, 10에서 4가 되어 12까지 평평하다.
// 그보다 더 올리면 기다리는 회차만 늘고 나오는 건수는 같다.
//
// 마지막 열의 0은 정상 상태가 아니다. #1094가 그 직전에 권고 판정을 좁혀 대부분의 연속이 1로
// 잘린 회차다. 그 회차 하나에 맞춰 기준을 고르면 리셋에 맞춘 값이 된다.
//
// 참고로 이 이슈(#479)가 원래 제안한 트리거는 쓸 수 없다. `parser_extraction_failure`는 29회
// 중 29회가 참이라 변별력이 없다.
const FOLLOWUP_CONSECUTIVE_RUNS = 10;

// 소스 하나를 가리키는 조치형 권고. 화이트리스트로 둔다 — 진단 모듈에 새 권고가 생겼을 때
// 자동으로 draft를 내지 않게 하려는 것이다. 이 모듈의 목적이 잡음을 줄이는 것이기 때문이다.
//
// KEEP_AND_MONITOR가 여기 없는 것은 의도다. 그 값은 진단 모듈이 아무 문제도 못 찾았을 때
// 떨어뜨리는 기본값이고, 진단 자신이 recommended_issues를 만들 때 명시적으로 제외한다.
// 그것을 여기서 다시 주워 담으면 막힌 것도 없고 main 기사 자격까지 통과한 소스에 작업을
// 시키게 된다.
const ACTIONABLE_SOURCE_ACTIONS = new Set([
  'KEEP_AND_FIX_PARSER',
  'REVIEW_SOURCE_GAP',
  'DOWNGRADE_GENERIC_SOURCE'
]);

// 이슈가 트리거 후보로 적은 것 중 duplicate/no-op discovery와 taxonomy gap은 여기 없다.
// 그 둘은 소스가 아니라 실행 전체를 가리키는 진단이고, 연속 조건으로는 다룰 수 없다.
//
// 커밋된 29회분에서 `duplicate_or_noop_source_discovery`는 29회 모두 참이다. 도달 가능하게
// 만들면 매 실행 draft가 나온다 — 이 이슈가 쓸 수 없다고 판정한 `parser_extraction_failure`와
// 정확히 같은 모양이다. `taxonomy_missing`도 21/29회 참이라 사정이 크게 다르지 않다.
//
// 그래서 이 두 갈래는 연속이 아닌 다른 조건이 필요하고, 그 조건을 정하는 것은 별건이다.
// 이슈 수용 기준 5번은 그만큼 남는다.
const DIAGNOSIS_FILE = 'source-quality-diagnosis.json';

const SUGGESTED_WORKFLOW = {
  KEEP_AND_FIX_PARSER: [
    '해당 소스의 후보 산출물로 현재 파서 동작을 재현한다',
    '실패하는 입력을 파서 fixture로 추가한다',
    '소스 어댑터를 고친다',
    'npm.cmd run validate:config 와 해당 단위 테스트를 돌린다'
  ],
  REVIEW_SOURCE_GAP: [
    '이 소스가 내는 신호가 실제로 카메라 범위인지 1차 출처로 확인한다',
    'evidence 추출이 api_or_component를 채우는지 본다',
    '범위 밖이면 등록부에서 우선순위를 내린다'
  ],
  DOWNGRADE_GENERIC_SOURCE: [
    '이 소스가 몇 회 동안 렌더된 main 기사에 기여했는지 센다',
    '기여가 없으면 등록부에서 candidateOnly 또는 우선순위 하향을 검토한다'
  ]
};

const SUGGESTED_LABELS = {
  KEEP_AND_FIX_PARSER: ['area:newsroom', 'source-coverage'],
  REVIEW_SOURCE_GAP: ['area:newsroom', 'source-coverage'],
  DOWNGRADE_GENERIC_SOURCE: ['area:newsroom', 'area:source-policy']
};

function readDiagnosis(root, date) {
  const filePath = path.join(root, 'articles', 'content', 'newsroom', date, DIAGNOSIS_FILE);
  if (!fs.existsSync(filePath)) return { exists: false, value: null, unreadable: false };
  try {
    return { exists: true, value: JSON.parse(fs.readFileSync(filePath, 'utf8')), unreadable: false };
  } catch {
    // 읽을 수 없는 진단을 "문제 없음"과 같이 다루면, 파일이 깨진 회차가 조용히 연속을 끊는다.
    return { exists: true, value: null, unreadable: true };
  }
}

// 세는 대상은 정확히 "진단을 낸 실행"이다. 진단 산출물이 없는 뉴스룸 회차는 목록에 들어오지
// 않으므로 연속을 끊지도, 한 회로 세지도 않는다. 진단 도입 이후에도 그런 회차가 14개 있다
// (전부 데일리 시절). 파일이 없는 이유가 그 실행의 정상 결과인지 결손인지 여기서는 알 수
// 없어서, 없는 것을 결손으로 단정하지 않는다. 반면 파일이 있는데 읽히지 않으면 연속을 끊고
// 경고를 남긴다 — 그쪽은 결손이 분명하기 때문이다.
function diagnosisDates(root) {
  const base = path.join(root, 'articles', 'content', 'newsroom');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .filter(entry => fs.existsSync(path.join(base, entry, DIAGNOSIS_FILE)))
    .sort();
}

// 소스별 권고는 source_breakdown에서 읽는다. recommended_issues는 상위 10건으로 잘려서
// (source-quality-diagnosis.js의 slice), 순위가 밀린 소스가 그 회차에 없는 것처럼 보이고
// 연속이 실제 문제와 무관하게 끊긴다. 조치 대상 소스가 22개였던 회차도 있다.
function actionableRecommendations(root, date) {
  const diagnosis = readDiagnosis(root, date);
  const map = new Map();
  if (!diagnosis.value) return { map, unreadable: diagnosis.unreadable, exists: diagnosis.exists };

  for (const row of (Array.isArray(diagnosis.value.source_breakdown) ? diagnosis.value.source_breakdown : [])) {
    const action = String(row?.recommended_action || '');
    const sourceId = String(row?.source_id || '');
    if (!sourceId || !ACTIONABLE_SOURCE_ACTIONS.has(action)) continue;
    map.set(`${sourceId}|${action}`, { row, action });
  }
  return { map, unreadable: diagnosis.unreadable, exists: diagnosis.exists };
}

function draftTitle({ row, action }) {
  const label = row?.recommended_action_label || action;
  return `[Source] ${label}: ${row?.source_name || row?.source_id}`;
}

function draftReason({ row, action }, consecutiveRuns) {
  // 진단이 이미 계산해 둔 사유를 쓴다. 건수만 나열하는 문장을 새로 만들면 조작 가능한 정보가
  // 오히려 줄어든다. source_breakdown 행에는 reason 필드가 없고, 같은 문장이
  // parser_failure_signals의 첫 항목으로 들어 있다.
  const signal = String(
    (Array.isArray(row?.parser_failure_signals) ? row.parser_failure_signals[0] : '') ||
    (Array.isArray(row?.top_blockers) ? row.top_blockers[0] : '') ||
    ''
  ).trim();
  const head = `${row?.source_name || row?.source_id}에 ${action} 권고가 ${consecutiveRuns}회 연속 붙었습니다.`;
  if (signal) return `${head} 진단이 적은 사유: ${signal}`;
  return head;
}

// 연속 횟수는 최신 회차부터 거꾸로 세어, 권고가 끊긴 회차에서 멈춘다.
function consecutiveRunCount(runs, index, key) {
  let count = 0;
  for (let position = index; position >= 0; position -= 1) {
    if (!runs[position].recommendations.has(key)) break;
    count += 1;
  }
  return count;
}

function buildSourceFollowupIssues({ root, date, minimumConsecutiveRuns = FOLLOWUP_CONSECUTIVE_RUNS }) {
  const dates = diagnosisDates(root);
  const targetIndex = dates.indexOf(date);
  if (targetIndex < 0) {
    return {
      schema_version: 1,
      report_type: 'source-followup-issues',
      date,
      minimum_consecutive_runs: minimumConsecutiveRuns,
      runs_examined: 0,
      actionable_recommendation_count: 0,
      items: [],
      warnings: [`${DIAGNOSIS_FILE} for ${date} was not found; no follow-up drafts were derived.`]
    };
  }

  const warnings = [];
  const runs = dates.slice(0, targetIndex + 1).map(item => {
    const result = actionableRecommendations(root, item);
    if (result.unreadable) {
      warnings.push(`${DIAGNOSIS_FILE} for ${item} could not be parsed; its recommendations were skipped.`);
    }
    return { date: item, recommendations: result.map };
  });

  const items = [];
  const latest = runs[runs.length - 1];
  for (const [key, entry] of latest.recommendations) {
    const consecutiveRuns = consecutiveRunCount(runs, runs.length - 1, key);
    if (consecutiveRuns < minimumConsecutiveRuns) continue;
    const { row, action } = entry;
    items.push({
      title: draftTitle(entry),
      reason: draftReason(entry, consecutiveRuns),
      consecutive_runs: consecutiveRuns,
      recommended_action: action,
      source_ids: [row.source_id],
      // severity는 source_breakdown 행에 없다. 없는 값을 null로 싣는 대신, 그 행이 실제로
      // 갖고 있는 effectiveness 권고를 그대로 넘긴다.
      source_effectiveness_recommendation: row?.source_effectiveness_recommendation || null,
      source_priority: row?.priority || null,
      source_reliability: row?.reliability || null,
      diagnosis_refs: [DIAGNOSIS_FILE, 'source-effectiveness-report.json'],
      suggested_labels: SUGGESTED_LABELS[action] || ['area:newsroom'],
      suggested_workflow: SUGGESTED_WORKFLOW[action] || ['진단 산출물에서 이 권고의 근거를 확인한다']
    });
  }

  // 오래 끌어온 것이 먼저 보이도록, 같은 횟수면 소스 id로 안정 정렬한다.
  items.sort((left, right) => right.consecutive_runs - left.consecutive_runs ||
    String(left.source_ids[0]).localeCompare(String(right.source_ids[0])));

  return {
    schema_version: 1,
    report_type: 'source-followup-issues',
    date,
    minimum_consecutive_runs: minimumConsecutiveRuns,
    runs_examined: runs.length,
    actionable_recommendation_count: latest.recommendations.size,
    items,
    warnings
  };
}

function renderSourceFollowupIssuesMarkdown(report) {
  const lines = [
    `# Source Follow-up Issue Drafts - ${report.date}`,
    '',
    '이 문서는 제안이며 발행 판정에 영향을 주지 않습니다. GitHub 이슈를 자동으로 만들지도 않습니다.',
    '',
    `- 기준: 같은 대상에 같은 권고가 ${report.minimum_consecutive_runs}회 연속`,
    `- 살펴본 실행: ${report.runs_examined}`,
    `- 이번 실행의 조치 대상 권고: ${report.actionable_recommendation_count ?? 0}건`,
    `- draft: ${report.items.length}건`,
    ''
  ];

  if (report.warnings.length > 0) {
    lines.push('경고', '');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  if (report.items.length === 0) {
    lines.push('기준을 넘긴 대상이 없습니다.', '');
    return lines.join('\n');
  }

  for (const item of report.items) {
    lines.push(
      `## ${item.title}`,
      '',
      `- 연속 ${item.consecutive_runs}회`,
      `- 소스: ${item.source_ids.join(', ')}`,
      `- 권고: ${item.recommended_action}`,
      `- 제안 라벨: ${item.suggested_labels.join(', ')}`,
      '',
      item.reason,
      '',
      '제안 작업 순서',
      ''
    );
    for (const step of item.suggested_workflow) {
      lines.push(`1. ${step}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function writeSourceFollowupIssueArtifacts({ root, date, minimumConsecutiveRuns }) {
  const report = buildSourceFollowupIssues({ root, date, minimumConsecutiveRuns });
  const targetDir = path.join(root, 'articles', 'content', 'newsroom', date);
  fs.mkdirSync(targetDir, { recursive: true });
  const jsonPath = path.join(targetDir, 'source-followup-issues.json');
  const markdownPath = path.join(targetDir, 'source-followup-issues.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, renderSourceFollowupIssuesMarkdown(report), 'utf8');
  return { report, jsonPath, markdownPath };
}

module.exports = {
  ACTIONABLE_SOURCE_ACTIONS,
  FOLLOWUP_CONSECUTIVE_RUNS,
  buildSourceFollowupIssues,
  renderSourceFollowupIssuesMarkdown,
  writeSourceFollowupIssueArtifacts
};
