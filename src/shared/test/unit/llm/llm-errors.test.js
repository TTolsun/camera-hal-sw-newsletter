const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isRetryableError,
  isSchemaComplexityError,
  lastStatus
} = require('../../../llm/llm-errors');

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// Gemini rejects an over-complex constrained-decoding response schema with a 400
// "too many states" error. This is a permanent schema-drift problem (the schema
// outgrew the model's state limit), not a transient capacity issue, so it must be
// detected distinctly from generic API failures (#652).
function geminiTooManyStatesError() {
  const error = new Error(
    'got status: 400 Bad Request. {"error":{"code":400,"status":"INVALID_ARGUMENT",' +
    '"message":"The response schema has too many states for a constrained decoding request."}}'
  );
  error.status = 400;
  return error;
}

test('isSchemaComplexityError detects the Gemini too-many-states schema error', () => {
  assert.equal(isSchemaComplexityError(geminiTooManyStatesError()), true);
});

test('isSchemaComplexityError matches the "schema is too complex" phrasing', () => {
  assert.equal(isSchemaComplexityError(new Error('the response schema is too complex')), true);
});

test('isSchemaComplexityError ignores transient and unrelated errors', () => {
  assert.equal(isSchemaComplexityError(new Error('503 Service Unavailable')), false);
  assert.equal(isSchemaComplexityError(new Error('RESOURCE_EXHAUSTED: quota exceeded')), false);
  assert.equal(isSchemaComplexityError(new Error('model returned invalid JSON')), false);
  assert.equal(isSchemaComplexityError(null), false);
});

test('a schema-complexity error is not retryable (retrying the same schema fails again)', () => {
  assert.equal(isRetryableError(geminiTooManyStatesError(), RETRYABLE), false);
});

test('lastStatus reports schema_incompatible for a schema-complexity error', () => {
  assert.equal(lastStatus(geminiTooManyStatesError(), RETRYABLE), 'schema_incompatible');
});

test('lastStatus still reports numeric/timeout status for non-schema errors', () => {
  const quota = new Error('429 RESOURCE_EXHAUSTED');
  quota.status = 429;
  assert.equal(lastStatus(quota, RETRYABLE), 429);
});
