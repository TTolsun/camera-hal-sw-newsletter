'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getPublishModePolicy,
  getDefaultNewsletterPolicy,
  validateNewsletterPolicyConfig
} = require('../../../common/newsletter-policy');

test('default policy exposes publishModePolicy with contextMinSignals', () => {
  const policy = getDefaultNewsletterPolicy();
  const mode = getPublishModePolicy(policy);
  assert.equal(typeof mode.contextMinSignals, 'number');
  assert.ok(mode.contextMinSignals >= 1);
});

test('validateNewsletterPolicyConfig rejects non-integer contextMinSignals', () => {
  const base = JSON.parse(JSON.stringify(require('../../../../../config/newsletter-policy.json')));
  base.publishModePolicy = { contextMinSignals: 'two' };
  const { errors } = validateNewsletterPolicyConfig(base);
  assert.ok(errors.some(e => e.includes('contextMinSignals')));
});

test('validateNewsletterPolicyConfig accepts valid publishModePolicy', () => {
  const base = JSON.parse(JSON.stringify(require('../../../../../config/newsletter-policy.json')));
  base.publishModePolicy = { contextMinSignals: 2 };
  const { errors } = validateNewsletterPolicyConfig(base);
  assert.equal(errors.filter(e => e.includes('publishModePolicy') || e.includes('contextMinSignals')).length, 0);
});
