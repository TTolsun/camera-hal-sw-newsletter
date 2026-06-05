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

module.exports = { buildWeeklyNewsletterPage, weeklyDisplayTitle, articleTitles };
