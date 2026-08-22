'use strict';

// 주간호 coverage(대상 주) 계산의 단일 정본.
// 모든 판정은 UTC ISO 주 + 반개구간 [coverage_start 00:00Z, coverage_end_exclusive_at).
// primary=[E-7d,E) — coverage 주 자체가 ISO 주 1개(7일)로 고정이라 이 경계는 설정으로 바꿀 수
// 없다. fallback=[E-fallbackDays,E-7d) reference=[E-referenceDays,E-fallbackDays), E 이후는
// not_yet_eligible. fallbackDays/referenceDays 기본값은 21/35(주 단위로 fallback 2주·
// reference 2주씩)이며 classifyCoverageWindow의 세 번째 인자로 넘겨 바꿀 수 있다 — 정책값을
// 안 넘기면 이 기본값 그대로 동작한다(하위 호환).
// generator의 weeklyKeyForDate(발행 identity)와 역할이 다르다 — 여기는 "독자에게 보이는 대상 주"만 담당한다.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_KEY_PATTERN = /^(\d{4})-W(\d{2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcDayStart(dateText) {
  if (!DATE_PATTERN.test(String(dateText || ''))) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText || ''));
  if (!match) return null;
  const [, year, month, day] = match;
  // Date.UTC로 날짜를 만든 후 getUTC* 메서드로 입력과 재비교하여
  // 자동 보정(2026-02-30 → 2026-03-02)되는 invalid 날짜를 거부한다.
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return date;
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function isoWeekdayIndex(date) {
  return (date.getUTCDay() + 6) % 7;
}

function thursdayOfWeek(date) {
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() - isoWeekdayIndex(date) + 3);
  return thursday;
}

function isoWeekKeyOfDate(date) {
  const thursday = thursdayOfWeek(date);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = thursdayOfWeek(new Date(Date.UTC(isoYear, 0, 4)));
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${String(isoYear).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
}

function coverageForWeekKey(weekKey) {
  const match = WEEKLY_KEY_PATTERN.exec(String(weekKey || ''));
  if (!match) throw new Error(`coverage week key must be YYYY-Www: ${weekKey}`);
  const firstThursday = thursdayOfWeek(new Date(Date.UTC(Number(match[1]), 0, 4)));
  const monday = new Date(firstThursday);
  monday.setUTCDate(firstThursday.getUTCDate() - 3 + (Number(match[2]) - 1) * 7);
  const endExclusive = new Date(monday.getTime() + 7 * DAY_MS);
  return {
    coverage_week_key: isoWeekKeyOfDate(monday),
    coverage_start_date: formatUtcDate(monday),
    coverage_end_date: formatUtcDate(new Date(endExclusive.getTime() - DAY_MS)),
    coverage_end_exclusive_at: endExclusive.toISOString()
  };
}

function coverageForAnchorDate(anchorDateText, overrideWeekKey) {
  if (overrideWeekKey) return coverageForWeekKey(overrideWeekKey);
  const anchor = parseUtcDayStart(anchorDateText);
  if (!anchor) throw new Error(`generation anchor date must be YYYY-MM-DD: ${anchorDateText}`);
  const currentMonday = new Date(anchor);
  currentMonday.setUTCDate(anchor.getUTCDate() - isoWeekdayIndex(anchor));
  const previousMonday = new Date(currentMonday.getTime() - 7 * DAY_MS);
  return coverageForWeekKey(isoWeekKeyOfDate(previousMonday));
}

function previousCoverageWeekKey(weekKey) {
  const bounds = coverageForWeekKey(weekKey);
  const previousMonday = new Date(parseUtcDayStart(bounds.coverage_start_date).getTime() - 7 * DAY_MS);
  return isoWeekKeyOfDate(previousMonday);
}

// 일 단위 나이: coverage_end_date 당일 0, coverage_start_date 당일 6, E 이후는 음수.
function coverageAgeDays(publishedAtText, coverage) {
  const publishedMs = Date.parse(publishedAtText);
  if (!Number.isFinite(publishedMs)) return null;
  const publishedDayStart = Math.floor(publishedMs / DAY_MS) * DAY_MS;
  const endDayStart = parseUtcDayStart(coverage.coverage_end_date).getTime();
  return Math.floor((endDayStart - publishedDayStart) / DAY_MS);
}

// windowDays.fallbackDays/referenceDays는 선정 정책(selectionWindowPolicy)의
// fallbackSelectionDays/referenceContextDays를 그대로 받는 자리다. primary 경계(6일, 즉 coverage
// 주 7일)는 ISO 주 구조 자체라 이 인자로 못 바꾼다 — selectionWindowPolicy.primarySelectionDays는
// 여기 분류에 쓰이지 않는다(호출측 정책 문서에 명시할 것).
function classifyCoverageWindow(publishedAtText, coverage, windowDays = {}) {
  const fallbackDays = Number.isInteger(windowDays.fallbackDays) ? windowDays.fallbackDays : 21;
  const referenceDays = Number.isInteger(windowDays.referenceDays) ? windowDays.referenceDays : 35;
  const ageDays = coverageAgeDays(publishedAtText, coverage);
  if (ageDays === null) return 'unknown';
  if (ageDays < 0) return 'not_yet_eligible';
  if (ageDays <= 6) return 'primary';
  if (ageDays <= fallbackDays - 1) return 'fallback';
  if (ageDays <= referenceDays - 1) return 'reference';
  return 'stale';
}

module.exports = {
  coverageForAnchorDate,
  coverageForWeekKey,
  previousCoverageWeekKey,
  coverageAgeDays,
  classifyCoverageWindow
};
