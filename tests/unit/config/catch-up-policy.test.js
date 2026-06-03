'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateNewsletterPolicyConfig,
  getCatchUpPolicy,
  readPolicyConfig
} = require('../../../scripts/newsroom/common/newsletter-policy');

function baseConfig() {
  return readPolicyConfig();
}

test('default policy exposes a normalized catchUpPolicy', () => {
  const policy = getCatchUpPolicy();
  assert.equal(policy.enabled, true);
  assert.equal(policy.maxCatchUpArticles, 2);
  assert.equal(policy.maxAgeDays, 90);
  assert.equal(policy.targetMainArticles, 3);
  assert.equal(policy.activationMode, 'fill_open_slots');
  assert.ok(Array.isArray(policy.eligibleBuckets) && policy.eligibleBuckets.length > 0);
});

test('validation rejects targetMainArticles above mainArticleCount.max', () => {
  const config = baseConfig();
  config.catchUpPolicy = {
    enabled: true, maxCatchUpArticles: 2, maxAgeDays: 90, targetMainArticles: 99,
    eligibleBuckets: ['direct_aosp_camera'], activationMode: 'fill_open_slots'
  };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.targetMainArticles')));
});

test('validation rejects maxAgeDays below fallbackSelectionDays', () => {
  const config = baseConfig();
  config.catchUpPolicy = {
    enabled: true, maxCatchUpArticles: 2, maxAgeDays: 5,
    eligibleBuckets: ['direct_aosp_camera'], activationMode: 'fill_open_slots'
  };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.maxAgeDays')));
});

test('validation rejects maxCatchUpArticles above mainArticleCount.max', () => {
  const config = baseConfig();
  config.catchUpPolicy = {
    enabled: true, maxCatchUpArticles: 99, maxAgeDays: 90,
    eligibleBuckets: ['direct_aosp_camera'], activationMode: 'fill_open_slots'
  };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.maxCatchUpArticles')));
});

test('validation rejects unknown activationMode and empty buckets', () => {
  const config = baseConfig();
  config.catchUpPolicy = {
    enabled: true, maxCatchUpArticles: 2, maxAgeDays: 90,
    eligibleBuckets: [], activationMode: 'always'
  };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.eligibleBuckets')));
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.activationMode')));
});
