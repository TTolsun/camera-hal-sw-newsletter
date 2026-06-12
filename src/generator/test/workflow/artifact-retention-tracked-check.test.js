const assert = require('node:assert/strict');
const test = require('node:test');

const {
  checkArtifactRetentionTracked,
  mustNotBeTracked
} = require('../../../core/tooling/validate/artifact-retention-tracked-check');
const {
  DEBUG_HEAVY,
  TRANSIENT_ATTEMPT,
  REVIEW_REQUIRED_COMPACT,
  classifyArtifactPath
} = require('../../reporter/review-artifact-inventory');

// Pass a fake tracked-paths list via _trackedPaths to avoid real git invocation in tests.
function makeCheck(trackedPaths) {
  return checkArtifactRetentionTracked({ _trackedPaths: trackedPaths });
}

test('mustNotBeTracked returns true for DEBUG_HEAVY debug_evidence file', () => {
  const classification = classifyArtifactPath('content/newsroom/2026-05-05/shortlisted-candidates.json');
  assert.ok(classification, 'shortlisted-candidates.json must be classified');
  assert.equal(classification.retention_grade, DEBUG_HEAVY);
  assert.equal(mustNotBeTracked(classification), true);
});

test('mustNotBeTracked returns true for TRANSIENT_ATTEMPT attempt file', () => {
  const classification = classifyArtifactPath('content/newsroom/2026-05-05/editor-draft-attempt-1.json');
  assert.ok(classification, 'attempt file must be classified');
  assert.equal(classification.retention_grade, TRANSIENT_ATTEMPT);
  assert.equal(mustNotBeTracked(classification), true);
});

test('mustNotBeTracked returns false for REVIEW_REQUIRED_COMPACT compact file', () => {
  const classification = classifyArtifactPath('content/newsroom/2026-05-05/selection-report.md');
  assert.ok(classification, 'selection-report.md must be classified');
  assert.equal(classification.retention_grade, REVIEW_REQUIRED_COMPACT);
  assert.equal(mustNotBeTracked(classification), false);
});

test('mustNotBeTracked returns false for unknown_artifacts group', () => {
  assert.equal(mustNotBeTracked({ retention_grade: DEBUG_HEAVY, group: 'unknown_artifacts' }), false);
  assert.equal(mustNotBeTracked({ retention_grade: TRANSIENT_ATTEMPT, group: 'unknown_artifacts' }), false);
});

test('recovery-prompt.md is classified DEBUG_HEAVY debug_evidence', () => {
  const classification = classifyArtifactPath('content/newsroom/2026-05-05/recovery-prompt.md');
  assert.ok(classification, 'recovery-prompt.md must be classified');
  assert.equal(classification.retention_grade, DEBUG_HEAVY);
  assert.equal(classification.group, 'debug_evidence');
  assert.equal(mustNotBeTracked(classification), true);
});

test('check FLAGS a tracked DEBUG_HEAVY file (shortlisted-candidates.json)', () => {
  const result = makeCheck(['content/newsroom/2026-05-05/shortlisted-candidates.json']);
  assert.equal(result.ok, false, 'should fail when DEBUG_HEAVY file is tracked');
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].path, 'content/newsroom/2026-05-05/shortlisted-candidates.json');
  assert.equal(result.violations[0].grade, DEBUG_HEAVY);
});

test('check FLAGS a tracked TRANSIENT_ATTEMPT attempt file', () => {
  const result = makeCheck(['content/newsroom/2026-05-05/reporter-candidates-attempt-1.json']);
  assert.equal(result.ok, false, 'should fail when TRANSIENT_ATTEMPT file is tracked');
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].grade, TRANSIENT_ATTEMPT);
});

test('check FLAGS a tracked recovery-prompt.md (now DEBUG_HEAVY)', () => {
  const result = makeCheck(['content/newsroom/2026-05-05/recovery-prompt.md']);
  assert.equal(result.ok, false, 'recovery-prompt.md must be flagged as violation');
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].grade, DEBUG_HEAVY);
});

test('check PASSES when only REVIEW_REQUIRED_COMPACT files are present', () => {
  const result = makeCheck([
    'content/newsroom/2026-05-05/selection-report.md',
    'content/newsroom/2026-05-05/quality-report.md',
    'content/newsroom/2026-05-05/fact-check-report.md'
  ]);
  assert.equal(result.ok, true, 'should pass for REVIEW_REQUIRED_COMPACT-only files');
  assert.equal(result.violations.length, 0);
});

test('check PASSES when only PUBLIC_SOURCE_OF_TRUTH files are present', () => {
  const result = makeCheck([
    'content/newsroom/2026-05-05/artifact-manifest.json'
  ]);
  // artifact-manifest.json is REVIEW_REQUIRED_COMPACT (explicit override in debugExactCatalog)
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
});

test('check only WARNS (not fails) for unrecognized filename', () => {
  const result = makeCheck(['content/newsroom/2026-05-05/some-unknown-file-xyz.json']);
  // unknown_artifacts never cause hard failure
  assert.equal(result.ok, true, 'unrecognized file must not cause failure');
  assert.ok(result.warnings.length > 0, 'unrecognized file should produce a warning');
});
