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

const TAXONOMY_REASON = '3 camera-relevant candidate(s) were not mapped to a known camera bucket.';

// lastRuns 만큼의 최근 회차에만 내용을 싣고, 그 앞은 비운다. taxonomy_missing도 같은 방식으로
// taxonomyMissingLastRuns 만큼의 최근 회차에만 참으로 둔다.
//
// duplicate_or_noop_source_discovery는 모든 회차에서 참으로 둔다. 커밋된 31회분의 기록이
// 전부 그렇고(#1180), 그래도 draft가 나오지 않아야 한다는 것이 이 파일의 전제다. #1186 이후의
// 새 진단에는 이 키가 없지만, 과거 호의 커밋된 진단을 계속 읽으므로 이 모양을 그대로 둔다.
function stageRuns(root, {
  sourceRows = [],
  recommendedIssues = [],
  lastRuns = RUN_DATES.length,
  gapAt = null,
  taxonomyMissingLastRuns = 0
} = {}) {
  RUN_DATES.forEach((date, index) => {
    const withinWindow = index >= RUN_DATES.length - lastRuns;
    const isGap = gapAt === date;
    const taxonomyMissing = index >= RUN_DATES.length - taxonomyMissingLastRuns;
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'source-quality-diagnosis.json'), {
      schema_version: 1,
      report_type: 'source-quality-diagnosis',
      date,
      diagnosis: { duplicate_or_noop_source_discovery: true, taxonomy_missing: taxonomyMissing },
      diagnosis_reasons: {
        duplicate_or_noop_source_discovery: [
          { reason: 'Duplicate discovery signal detected: gemini_manual_duplicate_url_count=4, duplicate_discovery_gap_count=0.' }
        ],
        taxonomy_missing: taxonomyMissing ? [{ reason: TAXONOMY_REASON }] : []
      },
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

// duplicate_or_noop_source_discovery는 커밋된 31회분 기록에서 매번 참이라, 초안으로 연결하면 매 실행
// 같은 draft가 나온다. owner 결정으로 이 진단은 초안 대상에서 빼고 #1180에서 따로 다룬다.
// recommended_issues에 그 권고가 있어도, 진단 플래그가 참이어도 draft가 나오면 안 된다.
test('the duplicate discovery diagnosis never becomes a draft (#479, #1180)', () => {
  const root = tempRoot('followup-duplicate-discovery-excluded');
  stageRuns(root, {
    sourceRows: [],
    recommendedIssues: [
      { action: 'REPAIR_SOURCE_DISCOVERY_DUPLICATES', source_id: '', reason: 'duplicate discovery' }
    ]
  });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.deepEqual(report.items, []);
  assert.equal(report.actionable_recommendation_count, 0);
});

// taxonomy_missing은 PR #1125가 빈 bucket을 누락으로 세지 않게 고친 뒤로, 현재 코드로 커밋된
// 진단을 다시 계산하면 재계산 가능한 23회 중 0회 참이다. 그래서 연속을 기다리지 않고 이번 실행에서 참이면 바로
// draft를 낸다.
test('a taxonomy gap in the latest run becomes a run-scoped draft (#479)', () => {
  const root = tempRoot('followup-taxonomy-latest');
  stageRuns(root, { taxonomyMissingLastRuns: 1 });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.equal(report.items.length, 1);
  const [item] = report.items;
  assert.equal(item.scope, 'run');
  assert.equal(item.consecutive_runs, 1);
  assert.equal(item.recommended_action, 'ADD_MULTIMEDIA_BUCKET');
  assert.deepEqual(item.source_ids, []);
  assert.ok(item.reason.includes(TAXONOMY_REASON));
  assert.ok(item.diagnosis_refs.includes('source-quality-diagnosis.json'));
  assert.ok(item.suggested_labels.length > 0);
  assert.ok(item.suggested_workflow.length > 0);
  // 소스 권고 건수와 섞지 않는다. 그 값은 "이번 실행의 조치 대상 소스 권고"다.
  assert.equal(report.actionable_recommendation_count, 0);
});

test('a taxonomy gap that cleared in the latest run is not a draft (#479)', () => {
  const root = tempRoot('followup-taxonomy-cleared');
  stageRuns(root, { taxonomyMissingLastRuns: 0 });
  // 직전 회차까지 참이었다가 이번 실행에서 풀린 경우.
  const previous = path.join(root, 'articles', 'content', 'newsroom', '2026-08-31', 'source-quality-diagnosis.json');
  const diagnosis = JSON.parse(fs.readFileSync(previous, 'utf8'));
  diagnosis.diagnosis.taxonomy_missing = true;
  writeJson(previous, diagnosis);

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.deepEqual(report.items, []);
});

test('a lingering taxonomy gap reports how many runs it has lasted (#479)', () => {
  const root = tempRoot('followup-taxonomy-streak');
  stageRuns(root, { taxonomyMissingLastRuns: 3 });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].consecutive_runs, 3);
  assert.match(report.items[0].reason, /3회 연속/);
});

// 읽을 수 없는 회차는 결손이 분명하므로 소스 연속과 마찬가지로 taxonomy 연속도 끊는다.
// 깨진 파일을 "참"으로 이어 붙이면 연속 횟수가 실제보다 길게 보고된다.
test('an unreadable diagnosis breaks the taxonomy streak (#479)', () => {
  const root = tempRoot('followup-taxonomy-unreadable');
  stageRuns(root, { taxonomyMissingLastRuns: 3 });
  fs.writeFileSync(
    path.join(root, 'articles', 'content', 'newsroom', '2026-08-31', 'source-quality-diagnosis.json'),
    '{ this is not json',
    'utf8'
  );

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].consecutive_runs, 1);
  assert.ok(report.warnings.some(warning => /2026-08-31/.test(warning)));
});

// PR 본문은 초안을 10건까지만 싣는다. 실행 전체 진단은 한 건뿐이고 소스 draft와 성격이 달라서,
// 소스 draft가 많은 주에 목록 밖으로 밀려나지 않게 맨 앞에 둔다.
test('the run-scoped draft is listed before source drafts (#479)', () => {
  const root = tempRoot('followup-taxonomy-first');
  stageRuns(root, {
    sourceRows: [sourceRow('camerax-release-notes', 'KEEP_AND_FIX_PARSER')],
    taxonomyMissingLastRuns: 1
  });

  const report = buildSourceFollowupIssues({ root, date: TARGET_DATE });

  assert.equal(report.items.length, 2);
  assert.equal(report.items[0].scope, 'run');
  assert.equal(report.items[1].scope, 'source');
  assert.equal(report.items[1].source_ids[0], 'camerax-release-notes');
});

test('the markdown draft names the run scope instead of an empty source list (#479)', () => {
  const root = tempRoot('followup-taxonomy-markdown');
  stageRuns(root, { taxonomyMissingLastRuns: 1 });

  const markdown = renderSourceFollowupIssuesMarkdown(buildSourceFollowupIssues({ root, date: TARGET_DATE }));

  assert.match(markdown, /^- 범위: 실행 전체$/m);
  assert.doesNotMatch(markdown, /^- 소스: $/m);
  assert.match(markdown, /taxonomy_missing/);
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
