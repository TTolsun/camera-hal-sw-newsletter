'use strict';

// Pure weekly newsletter page builder (#486, additive). Renders exactly ONE publish-ready editor
// draft as a weekly issue via the existing renderer. There is no cross-run aggregation, dedup, or
// merge here — that is #488/#489. Nothing in the daily pipeline calls this yet (PR2 wires it in).

const { buildHtml, buildMarkdown } = require('./newsletter-renderer');
const {
  weekBoundsForDate,
  weekBoundsForKey,
  weeklyNewsletterIndexRoute,
  weeklyNewsletterMarkdownRoute
} = require('../reporter/weekly-newsletter');
const { findWeeklyDuplicate } = require('../reporter/weekly-duplicate-merge');

// Keep one article per topic within a weekly issue: drop any section that duplicates an
// already-kept one (same identity or near-identical headline, per the weekly duplicate rule).
function dedupeWeeklySections(sections = []) {
  const kept = [];
  for (const section of Array.isArray(sections) ? sections : []) {
    if (kept.length && findWeeklyDuplicate(section, kept)) continue;
    kept.push(section);
  }
  return kept;
}

// "2026-W22" + bounds -> "2026 W22 (05.25 ~ 05.31)".
function weeklyDisplayTitle(bounds) {
  const [year, week] = String(bounds.weeklyKey).split('-W');
  const monthDay = value => String(value).slice(5).replace('-', '.');
  return `${year} W${week} (${monthDay(bounds.weekStartDate)} ~ ${monthDay(bounds.weekEndDate)})`;
}

// coverage 필드는 optional이다(Task 3·11이 채움) — 없으면(과거호·전환 전) 기존 발행 주 표시를
// 그대로 유지한다. 있으면 발행 identity(weekly_key)는 그대로 두고 표시(title)만 대상 주로 바꾼다.
// 3필드(week_key/start_date/end_date) 중 하나라도 무효면 "2026 W33 (ined ~ ined)"처럼 깨진
// 문자열이 나올 수 있으므로, 셋 다 유효할 때만 쓰고 하나라도 빠지면 통째로 폴백한다.
//
// coverage_mode는 discriminated union이다(리뷰 fix 3). legacy_rolling은 실제 ISO 주가 아니라
// rolling 조회 범위(anchor-7d ~ anchor)일 뿐이라 ISO 주 라벨을 붙일 근거가 없다 — weeklyKey를
// null로 돌려주고, 날짜 2개만 rolling 범위로 채운다. 호출부가 이 null을 "라벨 없음, 날짜만
// 있음"으로 해석해 라벨은 발행 주로 폴백시키고 range만 이 값으로 바꾼다.
function coverageDisplayBounds(draft = {}) {
  const key = String(draft.coverage_week_key || '');
  const weekStartDate = String(draft.coverage_start_date || '');
  const weekEndDate = String(draft.coverage_end_date || '');
  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(weekStartDate) && /^\d{4}-\d{2}-\d{2}$/.test(weekEndDate);
  if (draft.coverage_mode === 'legacy_rolling') {
    return datesValid ? { weeklyKey: null, weekStartDate, weekEndDate } : null;
  }
  const keyValid = /^\d{4}-W\d{2}$/.test(key);
  return (keyValid && datesValid) ? { weeklyKey: key, weekStartDate, weekEndDate } : null;
}

// 제목 렌더링용 최종 bounds: iso_week(주 라벨 있음)은 coverage 전체로 교체하고, legacy_rolling
// (주 라벨 없음)은 라벨만 발행 주(bounds)를 유지한 채 날짜 range만 rolling으로 바꾼다. coverage가
// 없으면(null) 발행 주 bounds를 그대로 쓴다 — 라벨과 range가 서로 다른 근거의 날짜를 섞지 않는다.
function titleDisplayBounds(coverageBounds, bounds) {
  if (!coverageBounds) return bounds;
  if (coverageBounds.weeklyKey) return coverageBounds;
  return { weeklyKey: bounds.weeklyKey, weekStartDate: coverageBounds.weekStartDate, weekEndDate: coverageBounds.weekEndDate };
}

function articleTitles(sections = []) {
  return sections
    .map(section => (section && (section.public_article?.headline || section.headline)) || '')
    .filter(Boolean);
}

// Natural-language overview of what this week's issue covers, derived from the actual article
// headlines so it always matches the content (the previous per-run editor summary did not).
function weeklySummaryText(titles = []) {
  const clean = titles.map(title => String(title || '').trim()).filter(Boolean);
  if (!clean.length) return '';
  const quote = title => `‘${title}’`;
  if (clean.length === 1) return `이번 주에는 ${quote(clean[0])} 소식을 다룹니다.`;
  if (clean.length === 2) return `이번 주에는 ${quote(clean[0])}, ${quote(clean[1])} 두 건의 소식을 다룹니다.`;
  return `이번 주에는 ${quote(clean[0])}, ${quote(clean[1])} 등 ${clean.length}건의 소식을 다룹니다.`;
}

function buildWeeklyNewsletterPage(draft = {}, { date, weeklyKey } = {}) {
  const bounds = date ? weekBoundsForDate(date) : weekBoundsForKey(weeklyKey);
  const sections = dedupeWeeklySections(draft.sections);
  const titles = articleTitles(sections);
  const coverageBounds = coverageDisplayBounds(draft);
  const issue = {
    ...draft,
    sections,
    date: bounds.weekStartDate,
    weekly_key: bounds.weeklyKey,
    week_start_date: bounds.weekStartDate,
    week_end_date: bounds.weekEndDate,
    title: weeklyDisplayTitle(titleDisplayBounds(coverageBounds, bounds)),
    // The hero subtitle describes this week's coverage from the real article headlines so it
    // matches the content; fall back to the per-run draft summary when there are no titles.
    summary: weeklySummaryText(titles) || draft.summary,
    // Under the title we list this week's article titles instead of a 3-line briefing.
    briefing: titles.length ? titles : draft.briefing
  };
  return {
    weeklyKey: bounds.weeklyKey,
    weekStartDate: bounds.weekStartDate,
    weekEndDate: bounds.weekEndDate,
    indexRoute: weeklyNewsletterIndexRoute(bounds.weeklyKey),
    markdownRoute: weeklyNewsletterMarkdownRoute(bounds.weeklyKey),
    issue,
    html: buildHtml(issue),
    markdown: buildMarkdown(issue)
  };
}

module.exports = {
  buildWeeklyNewsletterPage,
  weeklyDisplayTitle,
  weeklySummaryText,
  articleTitles,
  dedupeWeeklySections
};
