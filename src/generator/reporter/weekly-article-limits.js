'use strict';

// Weekly article-count limits (#492). Pure, deterministic helpers used by the weekly upsert (#488):
// a per-run daily intake cap and a weekly total cap with a rank_then_drop overflow policy.

const { getWeeklyArticlePolicy } = require('../../core/common/newsletter-policy');

function articleRankScore(article) {
  const value = Number(
    article && (article.weekly_rank_score ?? article.deterministic_score ?? article.score ?? article.headline_score)
  );
  return Number.isFinite(value) ? value : 0;
}

// Stable importance sort: higher score first, ties keep original order.
function rankByImportance(articles) {
  return articles
    .map((article, index) => ({ article, index }))
    .sort((a, b) => articleRankScore(b.article) - articleRankScore(a.article) || a.index - b.index);
}

function applyWeeklyArticleLimits({ existing = [], incoming = [], policy = getWeeklyArticlePolicy() } = {}) {
  const dailyLimit = Number.isInteger(policy.dailyNewArticleLimit) ? policy.dailyNewArticleLimit : Infinity;
  const weeklyLimit = Number.isInteger(policy.weeklyArticleLimit) ? policy.weeklyArticleLimit : Infinity;

  // 1. Daily intake cap: keep only the most important `dailyLimit` of this run's incoming articles.
  const incomingRanked = rankByImportance(incoming);
  const acceptedIncoming = incomingRanked.slice(0, dailyLimit).map(entry => entry.article);
  const droppedFromDailyIntake = incomingRanked.slice(dailyLimit).map(entry => entry.article);

  // 2. Weekly total cap (rank_then_drop): keep the top `weeklyLimit` overall, preserving order among kept.
  const combined = [...existing, ...acceptedIncoming];
  if (combined.length <= weeklyLimit) {
    return { articles: combined, droppedFromDailyIntake, droppedFromOverflow: [] };
  }
  const ranked = rankByImportance(combined);
  const keptIndexes = new Set(ranked.slice(0, weeklyLimit).map(entry => entry.index));
  const articles = combined.filter((_, index) => keptIndexes.has(index));
  const droppedFromOverflow = ranked.slice(weeklyLimit).map(entry => entry.article);
  return { articles, droppedFromDailyIntake, droppedFromOverflow };
}

module.exports = {
  applyWeeklyArticleLimits,
  articleRankScore,
  getWeeklyArticlePolicy
};
