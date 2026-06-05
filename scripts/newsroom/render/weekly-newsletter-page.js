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
} = require('../common/weekly-newsletter');

// "2026-W22" + bounds -> "2026 W22 (05.25 ~ 05.31)".
function weeklyDisplayTitle(bounds) {
  const [year, week] = String(bounds.weeklyKey).split('-W');
  const monthDay = value => String(value).slice(5).replace('-', '.');
  return `${year} W${week} (${monthDay(bounds.weekStartDate)} ~ ${monthDay(bounds.weekEndDate)})`;
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
  const titles = articleTitles(draft.sections);
  const issue = {
    ...draft,
    date: bounds.weekStartDate,
    weekly_key: bounds.weeklyKey,
    week_start_date: bounds.weekStartDate,
    week_end_date: bounds.weekEndDate,
    title: weeklyDisplayTitle(bounds),
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

module.exports = { buildWeeklyNewsletterPage, weeklyDisplayTitle, weeklySummaryText, articleTitles };
