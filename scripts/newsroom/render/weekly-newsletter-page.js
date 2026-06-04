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

function buildWeeklyNewsletterPage(draft = {}, { date, weeklyKey } = {}) {
  const bounds = date ? weekBoundsForDate(date) : weekBoundsForKey(weeklyKey);
  const issue = {
    ...draft,
    date: bounds.weekStartDate,
    weekly_key: bounds.weeklyKey,
    week_start_date: bounds.weekStartDate,
    week_end_date: bounds.weekEndDate,
    title: `Camera HAL Weekly ${bounds.weeklyKey}`
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

module.exports = { buildWeeklyNewsletterPage };
