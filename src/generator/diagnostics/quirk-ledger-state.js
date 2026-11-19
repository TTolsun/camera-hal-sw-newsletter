// state/quirk-ledger.json: 최근 12주의 기기 우회 장부 항목을 누적한다.
//
// 병합 규칙: 이번 실행의 조회 창은 그 창 안 항목의 정본이다. 창 안에 있던 기존 항목을 모두 지우고 이번
// 결과로 바꾼다(같은 창을 다시 돌려도 결과가 같고, 규칙 변경으로 빠진 항목이 남지 않는다). 창 밖 항목은
// 그대로 두되, 보존 기간(12주)을 넘긴 것은 버린다. 목록을 못 읽은 실행은 이 함수를 부르지 않는다 -
// 읽기 실패가 누적 상태를 지우면 안 된다.

const fs = require('fs');
const path = require('path');

const { RETENTION_WEEKS, SUPPORTED_SCHEMA_VERSION } = require('../../shared/validate/quirk-ledger-state-validator');

const QUIRK_LEDGER_STATE_REL_PATH = path.join('state', 'quirk-ledger.json');
const DAY_MS = 24 * 60 * 60 * 1000;

function statePath(root = process.cwd()) {
  return path.join(root, QUIRK_LEDGER_STATE_REL_PATH);
}

function readQuirkLedgerState(root) {
  const filePath = statePath(root);
  if (!fs.existsSync(filePath)) return { entries: [] };
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
}

function retentionCutoffDate(windowEndDate) {
  const endMs = Date.parse(`${windowEndDate}T00:00:00Z`);
  return new Date(endMs - RETENTION_WEEKS * 7 * DAY_MS).toISOString().slice(0, 10);
}

function mergeQuirkLedgerState(previousEntries, report) {
  const { start_date: startDate, end_date: endDate } = report.window;
  const cutoff = retentionCutoffDate(endDate);
  const kept = previousEntries.filter(entry =>
    !(entry.submitted_date >= startDate && entry.submitted_date <= endDate) && entry.submitted_date > cutoff);
  const entries = [...kept, ...report.entries].sort((left, right) =>
    left.submitted_date.localeCompare(right.submitted_date) || left.change_number - right.change_number);
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    retention_weeks: RETENTION_WEEKS,
    last_window_end_date: endDate,
    entries
  };
}

function writeQuirkLedgerState(root, state) {
  const filePath = statePath(root);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return filePath;
}

module.exports = {
  QUIRK_LEDGER_STATE_REL_PATH,
  mergeQuirkLedgerState,
  readQuirkLedgerState,
  retentionCutoffDate,
  writeQuirkLedgerState
};
