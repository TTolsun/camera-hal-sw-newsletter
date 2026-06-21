'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateNewsletterPolicyConfig,
  getSelectionScoringPolicy,
  readPolicyConfig
} = require('../../../common/newsletter-policy');
const {
  MAIN_ARTICLE_SCORE_THRESHOLD
} = require('../../../../generator/select/selection-policy-constants');

function baseConfig() {
  return readPolicyConfig();
}

test('default policy exposes a numeric mainArticleScoreThreshold', () => {
  const policy = getSelectionScoringPolicy();
  assert.equal(typeof policy.mainArticleScoreThreshold, 'number');
  assert.ok(Number.isFinite(policy.mainArticleScoreThreshold));
  assert.ok(policy.mainArticleScoreThreshold >= 0);
});

test('selection constant is derived from the policy config, not hardcoded', () => {
  // 코드의 MAIN_ARTICLE_SCORE_THRESHOLD가 newsletter-policy.json의 값과 일치해야 한다.
  // 둘이 어긋나면 config-code 이원성이 되살아난 것이므로 회귀로 잡는다.
  assert.equal(MAIN_ARTICLE_SCORE_THRESHOLD, getSelectionScoringPolicy().mainArticleScoreThreshold);
});

test('validation rejects a non-numeric mainArticleScoreThreshold', () => {
  const config = baseConfig();
  config.selectionScoringPolicy = { mainArticleScoreThreshold: 'high' };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('selectionScoringPolicy.mainArticleScoreThreshold')));
});

test('validation rejects a negative mainArticleScoreThreshold', () => {
  const config = baseConfig();
  config.selectionScoringPolicy = { mainArticleScoreThreshold: -1 };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('selectionScoringPolicy.mainArticleScoreThreshold')));
});

test('validation rejects a non-object selectionScoringPolicy', () => {
  const config = baseConfig();
  config.selectionScoringPolicy = [42];
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('selectionScoringPolicy')));
});

test('absent selectionScoringPolicy normalizes to the default threshold', () => {
  const config = baseConfig();
  delete config.selectionScoringPolicy;
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, true);
});
