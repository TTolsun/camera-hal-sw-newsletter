'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  FOLLOWUP_CONSECUTIVE_RUNS,
  buildSourceFollowupIssues,
  renderSourceFollowupIssuesMarkdown
} = require('../../diagnostics/source-followup-issues');
const { tempRoot, writeJson } = require('../../../shared/test/helpers/fs');

// 픽스처 회차 수를 상수에서 파생시키지 않는다. 그렇게 하면 임계값을 바꿔도 픽스처가 함께
// 움직여서 어떤 값이든 통과하는 자기참조 테스트가 된다.
const RUN_DATES = [
  '2026-06-22', '2026-06-29', '2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27',
  '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07'
];
const TARGET_DATE = '2026-09-07';

// 이 파일이 쓰는 리터럴(연속 10회 → draft, 9회 → 없음)이 실제 기준과 맞는지 못 박는다.
// 상수만 바꾸고 픽스처를 그대로 두면 여기서 먼저 걸린다.
test('the follow-up threshold this file is written against is ten runs (#479)', () => {
  assert.equal(FOLLOWUP_CONSECUTIVE_RUNS, 10);
});

function sourceRow(sourceId, action, overrides = {}) {
  return {
    source_id: sourceId,
    source_name: `${sourceId} name`,
    reliability: 'official',
    priority: 'high',
    raw_count: 3,
    eligible_count: 0,
    blocked_count: 3,
    main_eligible_count: 0,
    top_blockers: ['main_eligible=false'],
    parser_failure_signals: [`${action} signal from the diagnosis`],
    source_effectiveness_recommendation: 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR',
    recommended_action: action,
    recommended_action_label: `${action} label`,
    ...overrides
  };
}

// lastRuns 만큼의 최근 회차에만 내용을 싣고, 그 앞은 비운다.
function stageRuns(root, { sourceRows = [], recommendedIssues = [], lastRuns = RUN_DATES.length, gapAt = null } = {}) {
  RUN_DATES.forEach((date, index) => {
    const withinWindow = index >= RUN_DATES.length - lastRuns;
    const isGap = gapAt === date;
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'source-quality-diagnosis.json'), {
      schema_version: 1,
      report_type: 'source-quality-diagnosis',
      date,
      diagnosis: { duplicate_or_noop_source_discovery: true, taxonomy_missing: true },
      source_breakdown: withinWindow && !isGap ? sourceRows : [],
      recommended_issues: recommendedIssues
    });
  });
}

test('a source recommendation that stuck for ten runs becomes a draft (#479)', () => {
  const root = tempRoot('followup-ten-runs');
  stageRuns(root, { sourceRows: [sourceRow('camerax-release-notes', 'KEEP_AND_FIX_PARSER')], lastRuns: 10 });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.equal(report.items.length, 1);
  const [item] = report.items;
  assert.equal(item.source_ids[0], 'camerax-release-notes');
  assert.equal(item.consecutive_runs, 10);
  // 이슈가 요구한 draft 구성 요소.
  assert.match(item.title, /camerax-release-notes/);
  assert.ok(item.reason.length > 0);
  assert.ok(item.diagnosis_refs.includes('source-quality-diagnosis.json'));
  assert.ok(item.suggested_labels.length > 0);
  assert.ok(item.suggested_workflow.length > 0);
});

// 기준 미만은 나오면 안 된다. 이 경계가 무너지면 조치 대상 권고 대부분이 그대로 draft가 되어,
// 소유자가 29회 측정으로 무효화한 원래 트리거와 같은 잡음이 된다.
test('a source recommendation one run short of the threshold is not a draft (#479)', () => {
  const root = tempRoot('followup-nine-runs');
  stageRuns(root, { sourceRows: [sourceRow('lore-linux-media-list', 'REVIEW_SOURCE_GAP')], lastRuns: 9 });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.deepEqual(report.items, []);
});

// #1094처럼 권고 판정을 좁히는 변경이 들어오면 연속이 실제로 끊긴다. 그때 오래된 기록으로
// draft를 내면 이미 고쳐진 소스를 다시 올린다.
test('a gap in the middle resets the streak (#479)', () => {
  const root = tempRoot('followup-streak-reset');
  stageRuns(root, {
    sourceRows: [sourceRow('android-developers-latest-updates', 'KEEP_AND_FIX_PARSER')],
    gapAt: '2026-08-17'
  });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.deepEqual(report.items, []);
});

// KEEP_AND_MONITOR는 진단 모듈이 아무 문제도 못 찾았을 때 떨어뜨리는 기본값이고, 진단 자신이
// recommended_issues에서 명시적으로 제외한다. 그것을 여기서 주워 담으면 막힌 것도 없고 main
// 기사 자격까지 통과한 소스에 작업을 시키게 된다.
test('the healthy-source default recommendation never becomes a draft (#479)', () => {
  const root = tempRoot('followup-monitor-excluded');
  stageRuns(root, {
    sourceRows: [
      sourceRow('healthy-source', 'KEEP_AND_MONITOR', {
        raw_count: 1, eligible_count: 1, blocked_count: 0, main_eligible_count: 1
      }),
      sourceRow('quiet-source', 'NO_ACTION_THIN_WEEK'),
      sourceRow('kept-source', 'KEEP')
    ]
  });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.deepEqual(report.items, []);
  assert.equal(report.actionable_recommendation_count, 0);
});

// 실행 전체를 가리키는 진단(discovery 중복, taxonomy gap)은 연속 조건의 대상이 아니다.
// duplicate_or_noop_source_discovery는 커밋된 29회분에서 29회 모두 참이라, 연속으로 세면
// 매 실행 draft가 나온다 — 이 이슈가 쓸 수 없다고 판정한 트리거와 같은 모양이다.
test('run-scoped diagnoses do not become drafts (#479)', () => {
  const root = tempRoot('followup-run-scope-excluded');
  stageRuns(root, {
    sourceRows: [],
    recommendedIssues: [
      { action: 'REPAIR_SOURCE_DISCOVERY_DUPLICATES', source_id: '', reason: 'duplicate discovery' },
      { action: 'ADD_MULTIMEDIA_BUCKET', source_id: '', reason: 'taxonomy gap' }
    ]
  });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.deepEqual(report.items, []);
  assert.equal(report.actionable_recommendation_count, 0);
});

// 진단이 이미 계산한 사유를 버리고 건수만 나열하면 조작 가능한 정보가 줄어든다.
// source_breakdown 행에는 reason 필드가 없고 같은 문장이 parser_failure_signals에 들어 있다.
test('a draft carries the reason the diagnosis already computed (#479)', () => {
  const root = tempRoot('followup-reason');
  stageRuns(root, {
    sourceRows: [sourceRow('parser-source', 'KEEP_AND_FIX_PARSER', {
      parser_failure_signals: ['Official source produced candidates but parser rejections blocked eligibility.']
    })]
  });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.equal(report.items.length, 1);
  assert.match(report.items[0].reason, /parser rejections blocked eligibility\./);
  assert.equal(report.items[0].source_effectiveness_recommendation, 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR');
});

// 읽을 수 없는 진단을 "문제 없음"과 같이 다루면, 파일이 깨진 회차가 조용히 연속을 끊는다.
test('an unreadable diagnosis is reported rather than treated as clean (#479)', () => {
  const root = tempRoot('followup-unreadable');
  stageRuns(root, { sourceRows: [sourceRow('parser-source', 'KEEP_AND_FIX_PARSER')] });
  fs.writeFileSync(
    path.join(root, 'articles', 'content', 'newsroom', '2026-08-17', 'source-quality-diagnosis.json'),
    '{ this is not json',
    'utf8'
  );

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.deepEqual(report.items, []);
  assert.ok(report.warnings.some(warning => /2026-08-17/.test(warning)));
});

test('a run without its own diagnosis reports a warning instead of guessing (#479)', () => {
  const root = tempRoot('followup-missing-diagnosis');
  writeJson(path.join(root, 'articles', 'content', 'newsroom', '2026-08-31', 'source-quality-diagnosis.json'), {
    date: '2026-08-31',
    source_breakdown: []
  });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.deepEqual(report.items, []);
  assert.equal(report.warnings.length, 1);
});

test('the markdown draft says it changes no publish decision (#479)', () => {
  const root = tempRoot('followup-markdown');
  stageRuns(root, { sourceRows: [sourceRow('camerax-release-notes', 'KEEP_AND_FIX_PARSER')] });

  const markdown = renderSourceFollowupIssuesMarkdown(buildSourceFollowupIssues({ root, date: TARGET_DATE }));

  assert.match(markdown, /발행 판정에 영향을 주지 않습니다/);
  assert.match(markdown, /GitHub 이슈를 자동으로 만들지도 않습니다/);
  assert.match(markdown, /camerax-release-notes/);
});
