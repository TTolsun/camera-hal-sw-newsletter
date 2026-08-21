'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { tempRoot } = require('../../helpers/fs');
const {
  classifyIssueCoverage,
  planIssueBackfill,
  runBackfill,
  formatReportTable
} = require('../../../tooling/cli/backfill-weekly-coverage');

// buildWeeklyNewsletterPage(newsletter-renderer 경유)가 죽지 않는 최소 renderer-valid section.
// weekly-newsletter-page.test.js의 publishReadyDraft() 섹션 모양을 그대로 따른다.
function freshSection({ headline = '테스트 기사', date, coverageType = 'fresh' } = {}) {
  return {
    category: 'Android Camera',
    headline,
    what_changed: '테스트용 변경 요약입니다.',
    evidence_summary: '테스트용 근거 요약입니다.',
    confirmed_facts: ['근거 문장 1.', '근거 문장 2.'],
    specificity_checks: ['version=1.0.0', 'component=Test'],
    source_verification_notes: ['출처 URL은 공식입니다.'],
    camera_hal_checks: ['stream configuration을 확인합니다.'],
    action_items: ['테스트 액션 아이템.'],
    coverage_type: coverageType,
    date,
    article_sections: {
      verified_facts: ['근거 문장 1.'],
      background_context: '테스트 배경 설명입니다.',
      hal_driver_impact: '테스트 HAL 영향 설명입니다.',
      action_items: ['테스트 액션 아이템.'],
      team_share_points: '테스트 팀 공유 포인트입니다.'
    },
    public_article: {
      headline,
      lead: '테스트 리드 문장입니다.',
      body_paragraphs: ['테스트 본문 문단입니다.'],
      camera_hal_takeaway: '테스트 테이크어웨이입니다.',
      reader_checkpoints: ['테스트 체크포인트.'],
      source_links: [{ title: '테스트 소스', url: 'https://example.com/test', source_role: 'primary' }]
    },
    sources: [{ title: '테스트 소스', url: 'https://example.com/test' }]
  };
}

function baseIssue({ date, sections }) {
  return {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: '테스트 요약입니다.',
    briefing: ['테스트 브리핑입니다.'],
    sections,
    action_items: ['테스트 액션 아이템.'],
    references: [{ title: '테스트 소스', url: 'https://example.com/test' }]
  };
}

function writeIssueFixture(root, weeklyKey, issue) {
  const dir = path.join(root, 'articles', 'newsletters', weeklyKey);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'issue.json'), `${JSON.stringify(issue, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), '<html><body>placeholder</body></html>', 'utf8');
  fs.writeFileSync(path.join(dir, 'newsletter.md'), '# placeholder', 'utf8');
}

function writeEvidence(root, anchor) {
  const dir = path.join(root, 'articles', 'content', 'newsroom', anchor);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'generation-status.json'), `${JSON.stringify({ date: anchor, status: 'PASS' }, null, 2)}\n`, 'utf8');
}

function writeWeeklyIndex(root, entries) {
  const dataPath = path.join(root, 'articles', 'data', 'newsletters-weekly.json');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}

function readIssue(root, weeklyKey) {
  return JSON.parse(fs.readFileSync(path.join(root, 'articles', 'newsletters', weeklyKey, 'issue.json'), 'utf8'));
}

function readWeeklyIndex(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'));
}

// --- classifyIssueCoverage 단위 테스트 (파일 없이 순수 함수만) ---

test('classifyIssueCoverage: catch_up 아닌 기사 날짜가 전부 창 안이면 iso_week', () => {
  const result = classifyIssueCoverage({
    sections: [
      freshSection({ date: '2026-08-12' }),
      freshSection({ date: '2026-08-14' })
    ],
    coverageEndExclusiveAt: '2026-08-17T00:00:00.000Z'
  });
  assert.deepEqual(result, { ok: true, mode: 'iso_week' });
});

test('classifyIssueCoverage: catch_up 기사는 날짜 증거 검사에서 제외된다', () => {
  const result = classifyIssueCoverage({
    sections: [
      freshSection({ date: '2026-09-01', coverageType: 'catch_up' }) // 창 밖 날짜지만 catch_up이라 무시
    ],
    coverageEndExclusiveAt: '2026-08-17T00:00:00.000Z'
  });
  assert.deepEqual(result, { ok: true, mode: 'iso_week' });
});

test('classifyIssueCoverage: 하나라도 coverage_end_exclusive_at 이후면 legacy_rolling', () => {
  const result = classifyIssueCoverage({
    sections: [
      freshSection({ date: '2026-08-12' }),
      freshSection({ date: '2026-08-17' }) // anchor 당일 = E, 창 밖(>=E)
    ],
    coverageEndExclusiveAt: '2026-08-17T00:00:00.000Z'
  });
  assert.deepEqual(result, { ok: true, mode: 'legacy_rolling' });
});

test('classifyIssueCoverage: 날짜가 손상되어 파싱 불가하면 legacy 판정도 하지 않고 fail을 보고한다', () => {
  const result = classifyIssueCoverage({
    sections: [
      freshSection({ date: '2026-08-19' }), // 창 밖 — 단독이면 legacy_rolling을 시사하지만
      freshSection({ date: 'not-a-real-date' }) // 손상된 날짜가 섞이면 전체 판정 불가
    ],
    coverageEndExclusiveAt: '2026-08-17T00:00:00.000Z'
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /손상|파싱/);
});

// --- planIssueBackfill / runBackfill 통합 테스트 (실제 파일 왕복) ---

test('fixture (a): fresh 기사 날짜가 전부 직전 주 안이면 iso_week으로 backfill한다', () => {
  const root = tempRoot('backfill-a-');
  const anchor = '2026-08-17';
  writeEvidence(root, anchor);
  writeIssueFixture(root, '2026-W34', baseIssue({
    date: anchor,
    sections: [freshSection({ date: '2026-08-12' }), freshSection({ headline: '두번째', date: '2026-08-14' })]
  }));
  writeWeeklyIndex(root, [{ weeklyKey: '2026-W34', weekStartDate: anchor, weekEndDate: '2026-08-23', date: anchor, title: '2026 W34', summary: '', html: 'newsletters/2026-W34/index.html', md: 'newsletters/2026-W34/newsletter.md', tags: ['Camera HAL', 'Android'], article_count: 2, article_images: [] }]);

  const rows = runBackfill({ root, dryRun: false, weeklyKey: '2026-W34' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].mode, 'iso_week');
  assert.equal(rows[0].verdict, 'updated');

  const issue = readIssue(root, '2026-W34');
  assert.equal(issue.coverage_week_key, '2026-W33');
  assert.equal(issue.coverage_start_date, '2026-08-10');
  assert.equal(issue.coverage_end_date, '2026-08-16');
  assert.equal(issue.coverage_mode, 'iso_week');
  assert.equal(issue.generation_anchor_date, anchor);

  const indexEntry = readWeeklyIndex(root)[0];
  assert.equal(indexEntry.coverage_week_key, '2026-W33');
  assert.equal(indexEntry.coverage_mode, 'iso_week');
});

test('fixture (b): run-day 기사가 섞이면 legacy_rolling + 실제 rolling 범위를 기록하고 coverage_week_key는 기록하지 않는다', () => {
  const root = tempRoot('backfill-b-');
  const anchor = '2026-08-17';
  writeEvidence(root, anchor);
  writeIssueFixture(root, '2026-W34', baseIssue({
    date: anchor,
    sections: [freshSection({ date: '2026-08-12' }), freshSection({ headline: '실행일 기사', date: '2026-08-17' })]
  }));
  writeWeeklyIndex(root, [{ weeklyKey: '2026-W34', weekStartDate: anchor, weekEndDate: '2026-08-23', date: anchor, title: '2026 W34', summary: '', html: 'newsletters/2026-W34/index.html', md: 'newsletters/2026-W34/newsletter.md', tags: ['Camera HAL', 'Android'], article_count: 2, article_images: [] }]);

  const rows = runBackfill({ root, dryRun: false, weeklyKey: '2026-W34' });
  assert.equal(rows[0].mode, 'legacy_rolling');
  assert.equal(rows[0].verdict, 'updated');

  const issue = readIssue(root, '2026-W34');
  assert.equal(issue.coverage_week_key, undefined);
  assert.equal(issue.coverage_start_date, '2026-08-10');
  assert.equal(issue.coverage_end_date, anchor);
  assert.equal(issue.coverage_mode, 'legacy_rolling');
  assert.equal(issue.generation_anchor_date, anchor);

  const indexEntry = readWeeklyIndex(root)[0];
  assert.equal(indexEntry.coverage_week_key, undefined);
  assert.equal(indexEntry.coverage_mode, 'legacy_rolling');
});

test('fixture (c): newsroom 증거가 없으면 skipped_no_evidence로 보고하고 파일을 건드리지 않는다', () => {
  const root = tempRoot('backfill-c-');
  const anchor = '2026-08-17';
  // writeEvidence(root, anchor)를 일부러 생략한다.
  writeIssueFixture(root, '2026-W34', baseIssue({
    date: anchor,
    sections: [freshSection({ date: '2026-08-12' })]
  }));
  const before = readIssue(root, '2026-W34');

  const rows = runBackfill({ root, dryRun: false, weeklyKey: '2026-W34' });
  assert.equal(rows[0].verdict, 'skipped_no_evidence');

  const after = readIssue(root, '2026-W34');
  assert.deepEqual(after, before);
});

test('fixture (d): 불변식 위반(손상된 날짜)이 있는 이슈만 fail로 보고되고 다른 이슈는 계속 진행된다', () => {
  const root = tempRoot('backfill-d-');
  const anchor = '2026-08-17';
  writeEvidence(root, anchor);

  // 손상된 이슈: W34
  writeIssueFixture(root, '2026-W34', baseIssue({
    date: anchor,
    sections: [freshSection({ date: '2026-08-19' }), freshSection({ headline: '손상', date: 'not-a-real-date' })]
  }));
  // 정상 이슈: W33 (다른 anchor)
  const anchor33 = '2026-08-10';
  writeEvidence(root, anchor33);
  writeIssueFixture(root, '2026-W33', baseIssue({
    date: anchor33,
    sections: [freshSection({ date: '2026-08-05' })]
  }));

  const rows = runBackfill({ root, dryRun: false });
  const row34 = rows.find(row => row.weeklyKey === '2026-W34');
  const row33 = rows.find(row => row.weeklyKey === '2026-W33');

  assert.equal(row34.verdict, 'fail');
  assert.match(row34.reason, /손상|파싱/);
  assert.equal(row33.verdict, 'updated');
  assert.equal(row33.mode, 'iso_week');

  // fail 이슈는 손대지 않는다.
  const issue34 = readIssue(root, '2026-W34');
  assert.equal(issue34.coverage_mode, undefined);
});

test('dry-run은 판정만 계산하고 파일을 전혀 바꾸지 않는다', () => {
  const root = tempRoot('backfill-dryrun-');
  const anchor = '2026-08-17';
  writeEvidence(root, anchor);
  writeIssueFixture(root, '2026-W34', baseIssue({
    date: anchor,
    sections: [freshSection({ date: '2026-08-12' })]
  }));
  writeWeeklyIndex(root, [{ weeklyKey: '2026-W34', weekStartDate: anchor, weekEndDate: '2026-08-23', date: anchor, title: '2026 W34', summary: '', html: 'newsletters/2026-W34/index.html', md: 'newsletters/2026-W34/newsletter.md', tags: ['Camera HAL', 'Android'], article_count: 1, article_images: [] }]);

  const beforeIssue = fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W34', 'issue.json'), 'utf8');
  const beforeHtml = fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W34', 'index.html'), 'utf8');
  const beforeIndex = fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8');

  const rows = runBackfill({ root, dryRun: true, weeklyKey: '2026-W34' });
  assert.equal(rows[0].verdict, 'would_update');
  assert.equal(rows[0].mode, 'iso_week');

  assert.equal(fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W34', 'issue.json'), 'utf8'), beforeIssue);
  assert.equal(fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W34', 'index.html'), 'utf8'), beforeHtml);
  assert.equal(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'), beforeIndex);
});

test('이미 같은 coverage 필드가 기록되어 있으면 unchanged로 보고하고 다시 쓰지 않는다', () => {
  const root = tempRoot('backfill-unchanged-');
  const anchor = '2026-08-17';
  writeEvidence(root, anchor);
  const issue = baseIssue({ date: anchor, sections: [freshSection({ date: '2026-08-12' })] });
  issue.coverage_week_key = '2026-W33';
  issue.coverage_start_date = '2026-08-10';
  issue.coverage_end_date = '2026-08-16';
  issue.coverage_mode = 'iso_week';
  issue.generation_anchor_date = anchor;
  writeIssueFixture(root, '2026-W34', issue);
  const beforeIssue = fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W34', 'issue.json'), 'utf8');

  const rows = runBackfill({ root, dryRun: false, weeklyKey: '2026-W34' });
  assert.equal(rows[0].verdict, 'unchanged');
  assert.equal(fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W34', 'issue.json'), 'utf8'), beforeIssue);
});

test('--weekly-key로 존재하지 않는 이슈를 지정하면 에러를 던진다', () => {
  const root = tempRoot('backfill-missing-');
  assert.throws(() => runBackfill({ root, dryRun: true, weeklyKey: '2099-W01' }), /찾을 수 없습니다/);
});

test('--weekly-key 형식이 올바르지 않으면 에러를 던진다', () => {
  const root = tempRoot('backfill-badkey-');
  assert.throws(() => runBackfill({ root, dryRun: true, weeklyKey: 'not-a-key' }), /YYYY-Www/);
});

test('planIssueBackfill: 기존 index.html의 태그 행이 재렌더 결과와 달라지면 tagsChanged를 표시한다', () => {
  const root = tempRoot('backfill-tags-');
  const anchor = '2026-08-17';
  writeEvidence(root, anchor);
  const issue = baseIssue({ date: anchor, sections: [freshSection({ date: '2026-08-12' })] });
  issue.tags = ['Driver', 'Camera HAL', 'Android'];
  writeIssueFixture(root, '2026-W34', issue);
  // 기존 index.html에는 issue.json과 다른(구식) 태그 행이 이미 박혀 있다 — 알려진 드리프트 재현.
  const dir = path.join(root, 'articles', 'newsletters', '2026-W34');
  fs.writeFileSync(path.join(dir, 'index.html'), '<div class="tag-row issue-tags"><span>Camera HAL</span><span>Android</span></div>', 'utf8');

  const plan = planIssueBackfill({ root, weeklyKey: '2026-W34' });
  assert.equal(plan.tagsChanged, true);
});

test('formatReportTable: weeklyKey | anchor | coverage | mode | 판정 열을 포함한다', () => {
  const rows = [
    { weeklyKey: '2026-W34', anchor: '2026-08-17', coverageLabel: '2026-08-10~2026-08-16', mode: 'iso_week', verdict: 'would_update', reason: '', tagsChanged: false }
  ];
  const table = formatReportTable(rows);
  assert.match(table, /weeklyKey/);
  assert.match(table, /anchor/);
  assert.match(table, /coverage/);
  assert.match(table, /mode/);
  assert.match(table, /판정/);
  assert.match(table, /2026-W34/);
  assert.match(table, /would_update/);
});
