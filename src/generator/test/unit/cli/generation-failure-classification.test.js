const test = require('node:test');
const assert = require('node:assert/strict');

const {
  failureStageFromError,
  failureClassFromError
} = require('../../../publish/generation-failure-classification');

test('failureStageFromError prefers an explicit error.stage', () => {
  assert.equal(failureStageFromError({ stage: 'fact-checker' }), 'fact-checker');
});

test('failureStageFromError parses a [stage] message prefix', () => {
  assert.equal(failureStageFromError(new Error('[editor attempt 1/2] boom')), 'editor attempt 1/2');
});

test('failureStageFromError falls back to generation', () => {
  assert.equal(failureStageFromError(new Error('no prefix here')), 'generation');
  assert.equal(failureStageFromError(undefined), 'generation');
});

test('failureClassFromError classifies provider, adapter, and domain failures', () => {
  assert.equal(failureClassFromError({ code: 'provider_not_implemented' }), 'provider_failure');
  assert.equal(failureClassFromError(new Error('Gemini API failed.')), 'provider_failure');
  assert.equal(failureClassFromError({ name: 'LlmJsonParseError' }), 'adapter_failure');
  assert.equal(failureClassFromError(new Error('response is not valid JSON')), 'adapter_failure');
  assert.equal(failureClassFromError({ name: 'NewsletterDomainValidationError' }), 'domain_validation_failure');
});

test('failureClassFromError returns empty string for unclassified errors', () => {
  assert.equal(failureClassFromError(new Error('something else')), '');
});
