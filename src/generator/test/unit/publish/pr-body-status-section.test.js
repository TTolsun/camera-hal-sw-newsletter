'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  coverageWeekLine,
  carryForwardStatusLine,
  weeklyOutputStatusLine,
  weeklyPageStructureStatusLine,
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

// 주간호 페이지 구조 검사(#905)는 관측 값이라 발행을 막지 않는다. 그래서 리뷰어가 이 값을
// PR 본문에서 볼 수 없으면 사실상 아무도 안 보게 된다.

test('weeklyPageStructureStatusLine is blank when the field is absent (older artifacts)', () => {
  assert.equal(weeklyPageStructureStatusLine({}), '');
});

test('weeklyPageStructureStatusLine carries the week key for ok/not_written', () => {
  assert.equal(
    weeklyPageStructureStatusLine({
      weekly_page_structure_status: 'ok',
      weekly_page_structure_key: '2026-W37'
    }),
    'weekly_page_structure_status: ok (주차 키: 2026-W37)'
  );
  assert.equal(
    weeklyPageStructureStatusLine({
      weekly_page_structure_status: 'not_written',
      weekly_page_structure_key: '2026-W37'
    }),
    'weekly_page_structure_status: not_written (주차 키: 2026-W37)'
  );
});

// 생산자(resolve-reviewable-artifacts.js의 weeklyStructureObservation)는 실행 날짜를 ISO 주로
// 못 읽은 경우와 그 주 페이지가 아직 없는 경우를 같은 not_written으로 합친다. 둘을 가르는
// 유일한 필드가 weekly_page_structure_key이므로, 키가 줄에서 빠지면 리뷰어는 검사가 아예 안
// 돈 실행과 정상 실행을 똑같이 보게 된다.
test('weeklyPageStructureStatusLine tells an empty week key apart from a real one', () => {
  const withoutKey = weeklyPageStructureStatusLine({
    weekly_page_structure_status: 'not_written',
    weekly_page_structure_key: ''
  });
  assert.equal(
    withoutKey,
    'weekly_page_structure_status: not_written (주차 키 없음)'
  );
  assert.notEqual(
    withoutKey,
    weeklyPageStructureStatusLine({
      weekly_page_structure_status: 'not_written',
      weekly_page_structure_key: '2026-W37'
    })
  );
  // 키가 아예 없는 옛 artifact도 같은 자리에서 읽혀야 한다.
  assert.equal(
    weeklyPageStructureStatusLine({ weekly_page_structure_status: 'not_written' }),
    withoutKey
  );
});

test('weeklyPageStructureStatusLine appends the observed errors for errors/check_failed', () => {
  assert.equal(
    weeklyPageStructureStatusLine({
      weekly_page_structure_status: 'errors',
      weekly_page_structure_key: '2026-W37',
      weekly_page_structure_errors: ['Anchor tag mismatch', 'Missing issue heading']
    }),
    'weekly_page_structure_status: errors (주차 키: 2026-W37) — 검사 오류: Anchor tag mismatch; Missing issue heading'
  );
  assert.equal(
    weeklyPageStructureStatusLine({
      weekly_page_structure_status: 'check_failed',
      weekly_page_structure_key: '2026-W37',
      weekly_page_structure_errors: ['Unexpected end of JSON input']
    }),
    'weekly_page_structure_status: check_failed (주차 키: 2026-W37) — 검사 오류: Unexpected end of JSON input'
  );
});

test('renderStatusSection surfaces a failed weekly page structure check in the PR body', () => {
  const body = renderStatusSection({
    status: 'PASS',
    weekly_page_structure_status: 'errors',
    weekly_page_structure_key: '2026-W37',
    weekly_page_structure_errors: ['Anchor tag mismatch']
  });
  assert.match(
    body,
    /weekly_page_structure_status: errors \(주차 키: 2026-W37\) — 검사 오류: Anchor tag mismatch/
  );
});

test('renderStatusSection omits the weekly page structure line for older artifacts', () => {
  const body = renderStatusSection({ status: 'PASS' });
  assert.ok(!body.includes('weekly_page_structure_status'));
});
