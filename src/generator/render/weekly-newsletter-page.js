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
function coverageDisplayBounds(draft = {}) {
  const key = String(draft.coverage_week_key || '');
  const weekStartDate = String(draft.coverage_start_date || '');
  const weekEndDate = String(draft.coverage_end_date || '');
  const valid = /^\d{4}-W\d{2}$/.test(key)
    && /^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)
    && /^\d{4}-\d{2}-\d{2}$/.test(weekEndDate);
  if (!valid) return null;
  return { weeklyKey: key, weekStartDate, weekEndDate };
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
    title: weeklyDisplayTitle(coverageBounds || bounds),
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
