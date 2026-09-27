'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { renderSourceFollowupIssues } = require('../../../publish/pr-body-diagnostic-sections');

// 소스 후속 이슈 초안(#479)은 워크플로 03이 쓰는 참고용 산출물이다. PR 본문은 초안이 있을 때만
// 섹션을 만들고, 파일이 없거나 0건이면 아무것도 붙이지 않는다. 대부분의 주가 0건이므로 매주
// 빈 섹션이 실리면 리뷰어가 이 섹션을 읽지 않게 된다.

function newsroomRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-followup-section-'));
  const date = '2026-09-14';
  fs.mkdirSync(path.join(root, 'articles', 'content', 'newsroom', date), { recursive: true });
  return { root, date };
}

function writeReport(root, date, report) {
  fs.writeFileSync(
    path.join(root, 'articles', 'content', 'newsroom', date, 'source-followup-issues.json'),
    JSON.stringify(report),
    'utf8'
  );
}

function item(index) {
  return {
    title: `[Source] 소스 유지, 파서 수정: Source ${index}`,
    consecutive_runs: 10 + index,
    recommended_action: 'KEEP_AND_FIX_PARSER',
    source_ids: [`source-${index}`]
  };
}

test('renders nothing when the draft report is missing or empty', () => {
  const { root, date } = newsroomRoot();
  assert.equal(renderSourceFollowupIssues(root, date), '');
  assert.equal(renderSourceFollowupIssues(root, ''), '');

  writeReport(root, date, { minimum_consecutive_runs: 10, items: [], warnings: [] });
  assert.equal(renderSourceFollowupIssues(root, date), '');
});

test('renders each draft with its run count, action, and source id', () => {
  const { root, date } = newsroomRoot();
  writeReport(root, date, {
    minimum_consecutive_runs: 10,
    items: [
      {
        title: '[Source] 소스 유지, 파서 수정: Android Developers Latest Updates',
        consecutive_runs: 12,
        recommended_action: 'KEEP_AND_FIX_PARSER',
        source_ids: ['android-developers-latest-updates']
      },
      {
        title: '[Source] 일반 소스 강등: Example Blog',
        consecutive_runs: 10,
        recommended_action: 'DOWNGRADE_GENERIC_SOURCE',
        source_ids: ['example-blog']
      }
    ],
    warnings: []
  });

  const section = renderSourceFollowupIssues(root, date);

  assert.match(section, /^## 소스 후속 이슈 초안$/m);
  assert.match(section, /같은 소스에 같은 권고가 10회 연속 실행에서 붙었거나/);
  assert.match(section, /articles\/content\/newsroom\/2026-09-14\/source-followup-issues\.md/);
  assert.match(section, /^- \[Source\] 소스 유지, 파서 수정: Android Developers Latest Updates: 연속 12회, 권고 KEEP_AND_FIX_PARSER, 소스 android-developers-latest-updates$/m);
  assert.match(section, /^- \[Source\] 일반 소스 강등: Example Blog: 연속 10회, 권고 DOWNGRADE_GENERIC_SOURCE, 소스 example-blog$/m);
  assert.doesNotMatch(section, /외 \d+건/);
});

// 잘린 목록이 완전한 목록처럼 보이면 안 된다. 잘렸다는 사실과 건수를 함께 적는다.
test('caps the rows and says how many drafts were left out', () => {
  const { root, date } = newsroomRoot();
  writeReport(root, date, {
    minimum_consecutive_runs: 10,
    items: Array.from({ length: 12 }, (_, index) => item(index + 1)),
    warnings: []
  });

  const section = renderSourceFollowupIssues(root, date);
  const rows = section.split('\n').filter(line => /^- \[Source\]/.test(line));

  assert.equal(rows.length, 10);
  assert.match(section, /^- 외 2건은 초안 전문에 있습니다\.$/m);
});

// 리뷰 지적: "Prepare pull request body" 스텝에는 continue-on-error가 없어, 렌더러가 throw하면
// 그 주 PR이 만들어지지 않는다. 생산자는 항상 객체를 push하지만, 손으로 고친 파일이 들어와도
// 본문 렌더가 죽지 않도록 비객체 항목은 건너뛴다.
test('skips items that are not objects instead of throwing', () => {
  const { root, date } = newsroomRoot();
  writeReport(root, date, {
    minimum_consecutive_runs: 10,
    items: [null, 7, 'text', item(1)],
    warnings: []
  });

  const section = renderSourceFollowupIssues(root, date);
  const rows = section.split('\n').filter(line => /^- \[Source\]/.test(line));

  assert.equal(rows.length, 1);
  assert.doesNotMatch(section, /외 \d+건/);

  writeReport(root, date, { minimum_consecutive_runs: 10, items: [null], warnings: [] });
  assert.equal(renderSourceFollowupIssues(root, date), '');
});

// 실행 전체 진단(taxonomy_missing) draft는 소스가 없다. 빈 소스 목록을 "unknown"으로 찍으면
// 리뷰어가 소스 id가 빠진 결함으로 읽는다. 범위를 그대로 적는다.
test('renders a run-scoped draft with its scope instead of an unknown source', () => {
  const { root, date } = newsroomRoot();
  writeReport(root, date, {
    minimum_consecutive_runs: 10,
    items: [
      {
        scope: 'run',
        title: '[Taxonomy] 알려진 카메라 bucket에 매핑되지 않은 카메라 후보',
        consecutive_runs: 1,
        recommended_action: 'ADD_MULTIMEDIA_BUCKET',
        source_ids: []
      },
      item(1)
    ],
    warnings: []
  });

  const section = renderSourceFollowupIssues(root, date);

  assert.match(section, /^- \[Taxonomy\] 알려진 카메라 bucket에 매핑되지 않은 카메라 후보: 연속 1회, 권고 ADD_MULTIMEDIA_BUCKET, 범위 실행 전체$/m);
  assert.match(section, /실행 전체 진단 `taxonomy_missing`이 이번 실행에서 참/);
  assert.doesNotMatch(section, /소스 unknown/);
  assert.match(section, /^- \[Source\] 소스 유지, 파서 수정: Source 1: 연속 11회, 권고 KEEP_AND_FIX_PARSER, 소스 source-1$/m);
});
