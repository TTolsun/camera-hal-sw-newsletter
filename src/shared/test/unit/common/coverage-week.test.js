'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  coverageForAnchorDate, coverageForWeekKey, previousCoverageWeekKey,
  coverageAgeDays, classifyCoverageWindow
} = require('../../../common/coverage-week');

test('월요일 anchor는 직전 완결 주를 돌려준다', () => {
  const coverage = coverageForAnchorDate('2026-08-17');
  assert.deepEqual(coverage, {
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-16',
    coverage_end_exclusive_at: '2026-08-17T00:00:00.000Z'
  });
});

test('주중 anchor도 같은 직전 완결 주를 돌려준다', () => {
  assert.equal(coverageForAnchorDate('2026-08-19').coverage_week_key, '2026-W33');
});

test('연말 경계: 2026-01-01 anchor는 2025-W52(12-22~12-28)', () => {
  const coverage = coverageForAnchorDate('2026-01-01');
  assert.equal(coverage.coverage_week_key, '2025-W52');
  assert.equal(coverage.coverage_start_date, '2025-12-22');
  assert.equal(coverage.coverage_end_date, '2025-12-28');
});

test('override 주차가 우선한다', () => {
  assert.equal(coverageForAnchorDate('2026-08-17', '2026-W30').coverage_start_date, '2026-07-20');
});

test('잘못된 anchor/override는 throw', () => {
  assert.throws(() => coverageForAnchorDate('2026-8-17'));
  assert.throws(() => coverageForAnchorDate('2026-08-17', 'W33'));
});

test('invalid 달력 날짜(2026-02-30)는 throw', () => {
  assert.throws(() => coverageForAnchorDate('2026-02-30'));
});

test('존재하지 않는 주차는 조용히 다른 주로 보정되지 않고 throw한다', () => {
  // 오타 하나가 다른 주를 대상으로 만들면 안 된다. 에러 메시지는 입력과
  // 보정 결과를 모두 담아 어느 주로 밀려날 뻔했는지 진단할 수 있어야 한다.
  assert.throws(() => coverageForWeekKey('2026-W60'), /2026-W60.*2027-W07/);
  assert.throws(() => coverageForWeekKey('2021-W53'), /2021-W53.*2022-W01/);
  assert.throws(() => coverageForWeekKey('2026-W00'), /2026-W00.*2025-W52/);
});

test('53주 해의 W53은 실재하는 주차이므로 그대로 통과한다', () => {
  assert.equal(coverageForWeekKey('2026-W53').coverage_week_key, '2026-W53');
  assert.equal(coverageForWeekKey('2026-W53').coverage_start_date, '2026-12-28');
});

test('previousCoverageWeekKey는 연도 경계를 넘는다', () => {
  assert.equal(previousCoverageWeekKey('2026-W01'), '2025-W52');
});

test('반개구간: E 정각은 not_yet_eligible, E-1ms는 primary', () => {
  const coverage = coverageForWeekKey('2026-W33');
  assert.equal(classifyCoverageWindow('2026-08-17T00:00:00.000Z', coverage), 'not_yet_eligible');
  assert.equal(classifyCoverageWindow('2026-08-16T23:59:59.999Z', coverage), 'primary');
});

test('구간 수식: primary 0~6일, fallback 7~20일, reference 21~34일, stale 35일+', () => {
  const coverage = coverageForWeekKey('2026-W33');
  assert.equal(coverageAgeDays('2026-08-16', coverage), 0);
  assert.equal(coverageAgeDays('2026-08-10', coverage), 6);
  assert.equal(classifyCoverageWindow('2026-08-10', coverage), 'primary');
  assert.equal(classifyCoverageWindow('2026-08-09', coverage), 'fallback');   // age 7
  assert.equal(classifyCoverageWindow('2026-07-27', coverage), 'fallback');   // age 20
  assert.equal(classifyCoverageWindow('2026-07-26', coverage), 'reference');  // age 21
  assert.equal(classifyCoverageWindow('2026-07-13', coverage), 'reference');  // age 34
  assert.equal(classifyCoverageWindow('2026-07-12', coverage), 'stale');      // age 35
  assert.equal(classifyCoverageWindow('', coverage), 'unknown');
});

test('windowDays로 fallback/reference 경계를 좁힐 수 있다(선정 정책 노브가 실제로 반영되도록)', () => {
  const coverage = coverageForWeekKey('2026-W33');
  // 기본값(fallbackDays=21)이면 15일령은 fallback이다.
  assert.equal(classifyCoverageWindow('2026-08-01', coverage), 'fallback');
  // fallbackDays=14로 좁히면 같은 15일령이 fallback 구간(7~13일)을 벗어나 reference로 떨어진다.
  // primary 경계(0~6일)는 coverage 주(ISO 7일) 구조 자체라 windowDays로 못 바꾼다.
  assert.equal(classifyCoverageWindow('2026-08-01', coverage, { fallbackDays: 14 }), 'reference');
  assert.equal(classifyCoverageWindow('2026-08-10', coverage, { fallbackDays: 14 }), 'primary');
});
