'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  coverageWeekLine,
  carryForwardStatusLine,
  weeklyOutputStatusLine,
  renderStatusSection
} = require('../../../publish/pr-body-status-section');

// coverage lineage(대상 주·carry-forward 판정)가 PR 본문에 사람이 읽을 수 있는 값으로
// 남아야 한다 — generation-status.json만 봐서는 그 주의 후보 풀이 완전했는지 리뷰어가
// 바로 알 수 없다.

test('coverageWeekLine renders the target week and its date range', () => {
  const line = coverageWeekLine({
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-16'
  });
  assert.equal(line, '대상 주차: 2026-W33 (2026-08-10 ~ 2026-08-16)');
});

test('coverageWeekLine falls back to unknown when coverage lineage is missing', () => {
  const line = coverageWeekLine({});
  assert.equal(line, '대상 주차: unknown (unknown ~ unknown)');
});

test('carryForwardStatusLine stays plain for loaded/not_applicable', () => {
  assert.equal(carryForwardStatusLine({ carry_forward_status: 'loaded' }), 'carry 상태: loaded');
  assert.equal(carryForwardStatusLine({ carry_forward_status: 'not_applicable' }), 'carry 상태: not_applicable');
});

test('carryForwardStatusLine warns for missing_expected/invalid/overflow', () => {
  for (const status of ['missing_expected', 'invalid', 'overflow']) {
    const line = carryForwardStatusLine({ carry_forward_status: status });
    assert.match(line, new RegExp(`^carry 상태: ${status} — 경고:`));
    assert.match(line, /편집자 검토가 강제로 켜졌습니다/);
  }
});

test('renderStatusSection includes both coverage lineage lines', () => {
  const body = renderStatusSection({
    status: 'PASS',
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-16',
    carry_forward_status: 'overflow'
  });
  assert.match(body, /대상 주차: 2026-W33 \(2026-08-10 ~ 2026-08-16\)/);
  assert.match(body, /carry 상태: overflow — 경고:/);
});

test('weeklyOutputStatusLine is blank when the field is absent (older artifacts)', () => {
  assert.equal(weeklyOutputStatusLine({}), '');
});

test('weeklyOutputStatusLine stays plain for non-failed statuses', () => {
  assert.equal(weeklyOutputStatusLine({ weekly_output_status: 'written' }), 'weekly_output_status: written');
  assert.equal(weeklyOutputStatusLine({ weekly_output_status: 'skipped' }), 'weekly_output_status: skipped');
});

test('weeklyOutputStatusLine appends the failure reason when the upsert failed', () => {
  const line = weeklyOutputStatusLine({
    weekly_output_status: 'failed',
    weekly_output_failure_reason: 'coverage_week_key mismatch with existing weekly index entry'
  });
  assert.equal(
    line,
    'weekly_output_status: failed — 실패 사유: coverage_week_key mismatch with existing weekly index entry'
  );
});

test('renderStatusSection surfaces a failed weekly upsert in the PR body', () => {
  const body = renderStatusSection({
    status: 'PASS',
    weekly_output_status: 'failed',
    weekly_output_failure_reason: 'weekly index write rejected: schema mismatch'
  });
  assert.match(body, /weekly_output_status: failed — 실패 사유: weekly index write rejected: schema mismatch/);
});
