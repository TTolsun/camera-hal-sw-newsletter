'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getWeeklyArticlePolicy,
  applyWeeklyArticleLimits
} = require('../../../scripts/newsroom/common/weekly-article-limits');

function article(id, score) {
  return { id, score };
}

test('getWeeklyArticlePolicy exposes the configured weekly limits', () => {
  const policy = getWeeklyArticlePolicy();
  assert.equal(policy.dailyNewArticleLimit, 3);
  assert.equal(policy.weeklyArticleLimit, 10);
  assert.equal(policy.weeklyOverflowPolicy, 'rank_then_drop');
});

test('applyWeeklyArticleLimits caps incoming articles to the daily intake limit by importance', () => {
  const incoming = [article('a', 1), article('b', 9), article('c', 5), article('d', 7), article('e', 2)];
  const result = applyWeeklyArticleLimits({
    existing: [], incoming,
    policy: { dailyNewArticleLimit: 3, weeklyArticleLimit: 10, weeklyOverflowPolicy: 'rank_then_drop' }
  });
  assert.deepEqual(result.articles.map(a => a.id), ['b', 'd', 'c']);
  assert.deepEqual(result.droppedFromDailyIntake.map(a => a.id), ['e', 'a']);
  assert.equal(result.droppedFromOverflow.length, 0);
});

test('applyWeeklyArticleLimits enforces the weekly total with rank_then_drop and preserves order among kept', () => {
  const existing = [article('x1', 8), article('x2', 3), article('x3', 6)];
  const incoming = [article('n1', 7), article('n2', 1)];
  const result = applyWeeklyArticleLimits({
    existing, incoming,
    policy: { dailyNewArticleLimit: 3, weeklyArticleLimit: 4, weeklyOverflowPolicy: 'rank_then_drop' }
  });
  // combined scores: x1=8,x2=3,x3=6,n1=7,n2=1 -> keep top 4: x1,n1,x3,x2 ; drop n2
  assert.deepEqual(result.articles.map(a => a.id), ['x1', 'x2', 'x3', 'n1']);
  assert.deepEqual(result.droppedFromOverflow.map(a => a.id), ['n2']);
});

test('applyWeeklyArticleLimits returns everything when under both limits', () => {
  const result = applyWeeklyArticleLimits({
    existing: [article('x', 5)], incoming: [article('n', 4)],
    policy: { dailyNewArticleLimit: 3, weeklyArticleLimit: 10, weeklyOverflowPolicy: 'rank_then_drop' }
  });
  assert.deepEqual(result.articles.map(a => a.id), ['x', 'n']);
  assert.equal(result.droppedFromDailyIntake.length, 0);
  assert.equal(result.droppedFromOverflow.length, 0);
});
