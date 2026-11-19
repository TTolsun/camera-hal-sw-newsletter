'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  mergeQuirkLedgerState,
  retentionCutoffDate
} = require('../../diagnostics/quirk-ledger-state');
const { validateQuirkLedgerStateText } = require('../../../shared/validate/quirk-ledger-state-validator');

function entry(changeNumber, submittedDate, overrides = {}) {
  return {
    change_number: changeNumber,
    url: `https://android-review.googlesource.com/c/platform/frameworks/support/+/${changeNumber}`,
    submitted_date: submittedDate,
    subject: `change ${changeNumber}`,
    quirk_classes: [{ name: 'ZslDisablerQuirk', change: 'modified' }],
    devices: [],
    exynos: false,
    exynos_evidence: [],
    ...overrides
  };
}

function reportOf(startDate, endDate, entries) {
  return { window: { start_date: startDate, end_date: endDate }, entries };
}

test('이번 조회 창 안의 기존 항목은 이번 결과로 통째로 바뀌고 창 밖 항목은 남는다', () => {
  const previous = [entry(1, '2026-11-03'), entry(2, '2026-11-12'), entry(3, '2026-11-14')];
  const state = mergeQuirkLedgerState(previous, reportOf('2026-11-10', '2026-11-16', [entry(3, '2026-11-14', { subject: 'rerun' }), entry(4, '2026-11-15')]));
  assert.deepEqual(state.entries.map(item => item.change_number), [1, 3, 4]);
  assert.equal(state.entries.find(item => item.change_number === 3).subject, 'rerun');
  assert.equal(state.last_window_end_date, '2026-11-16');
});

test('같은 창을 다시 돌려도 상태가 같다', () => {
  const report = reportOf('2026-11-10', '2026-11-16', [entry(5, '2026-11-11'), entry(4, '2026-11-11')]);
  const once = mergeQuirkLedgerState([], report);
  const twice = mergeQuirkLedgerState(once.entries, report);
  assert.deepEqual(twice, once);
  assert.deepEqual(once.entries.map(item => item.change_number), [4, 5]);
});

test('12주(84일)를 넘긴 항목은 버리고 경계 안쪽은 남긴다', () => {
  assert.equal(retentionCutoffDate('2026-11-16'), '2026-08-24');
  const previous = [entry(1, '2026-08-24'), entry(2, '2026-08-25')];
  const state = mergeQuirkLedgerState(previous, reportOf('2026-11-10', '2026-11-16', []));
  assert.deepEqual(state.entries.map(item => item.change_number), [2]);
});

test('병합 결과는 상태 검증기를 통과한다', () => {
  const state = mergeQuirkLedgerState([], reportOf('2026-11-10', '2026-11-16', [entry(1, '2026-11-12')]));
  assert.deepEqual(validateQuirkLedgerStateText(JSON.stringify(state)), { ok: true, errors: [] });
});

test('상태 검증기는 모양이 어긋난 항목과 근거 없는 Exynos 표시를 잡는다', () => {
  const valid = mergeQuirkLedgerState([], reportOf('2026-11-10', '2026-11-16', [entry(1, '2026-11-12')]));
  const cases = {
    'schemaVersion must be': { ...valid, schemaVersion: 2 },
    'retention_weeks must be': { ...valid, retention_weeks: 8 },
    'last_window_end_date': { ...valid, last_window_end_date: '2026/11/16' },
    'entries must be an array': { ...valid, entries: {} },
    'change_number must be a positive integer': { ...valid, entries: [entry('1', '2026-11-12')] },
    'submitted_date must be': { ...valid, entries: [entry(1, 'yesterday')] },
    'quirk_classes must be a non-empty array': { ...valid, entries: [entry(1, '2026-11-12', { quirk_classes: [] })] },
    'devices items need': { ...valid, entries: [entry(1, '2026-11-12', { devices: [{ identifier: 'x', source: 'guess' }] })] },
    'exynos is true but exynos_evidence is empty': { ...valid, entries: [entry(1, '2026-11-12', { exynos: true })] },
    'is duplicated': { ...valid, entries: [entry(1, '2026-11-12'), entry(1, '2026-11-13')] }
  };
  for (const [expected, state] of Object.entries(cases)) {
    const result = validateQuirkLedgerStateText(JSON.stringify(state));
    assert.equal(result.ok, false, expected);
    assert.ok(result.errors.some(message => message.includes(expected)), `${expected}: ${result.errors.join(' | ')}`);
  }
  assert.equal(validateQuirkLedgerStateText('{not json').ok, false);
});
