'use strict';

// Pure weekly newsletter page builder (#486, additive). Renders exactly ONE publish-ready editor
// draft as a weekly issue via the existing renderer. There is no cross-run aggregation, dedup, or
// merge here — that is #488/#489: 중복 판정 권한은 resolveWeeklyArticles 한 곳에 있고, 이
// 빌더는 받은 sections를 그대로 렌더한다. 렌더 단계에서 near-duplicate를 다시 떨구면 LLM의
// append("둘 다 유지") 결정이 issue.json에 영속되지 않아 tags·article_count·반환 기사 목록이
// 발행 페이지와 어긋나고, 다음 실행이 같은 기사를 LLM에 재질의한다.

const { ensureArray } = require('../../shared/common/value-coercion');
const { buildHtml, buildMarkdown } = require('./newsletter-renderer');
const {
  weekBoundsForDate,
  weekBoundsForKey,
  weeklyNewsletterIndexRoute,
  weeklyNewsletterMarkdownRoute
} = require('../reporter/weekly-newsletter');

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
  const sections = ensureArray(draft.sections);
  const titles = articleTitles(sections);
  const issue = {
    ...draft,
    sections,
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

module.exports = {
  buildWeeklyNewsletterPage,
  weeklyDisplayTitle,
  weeklySummaryText,
  articleTitles
};
