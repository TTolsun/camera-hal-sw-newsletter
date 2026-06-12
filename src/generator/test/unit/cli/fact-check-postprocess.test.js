'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectValidEvidenceIds,
  isSchemaFieldFactCheckViolation,
  sanitizeClaimEvidenceIds,
  validateFactCheck
} = require('../../../publish/fact-check-postprocess');

test('isSchemaFieldFactCheckViolation flags internal/schema-owned locations', () => {
  assert.equal(isSchemaFieldFactCheckViolation({ location: 'sections[0].public_article.decision_metadata.impact' }), true);
  assert.equal(isSchemaFieldFactCheckViolation({ location: 'sections[0].relevance_bucket' }), true);
  assert.equal(isSchemaFieldFactCheckViolation({ location: 'sections[0].public_article.body_paragraphs' }), false);
});

test('validateFactCheck drops schema-field false positives and recomputes status to PASS', () => {
  const result = validateFactCheck({
    status: 'NEEDS_FIX',
    must_fix: [{ location: 'sections[0].public_article.decision_metadata.impact', problem: 'x' }],
    recommended_fixes: [],
    source_gaps: []
  });
  assert.equal(result.must_fix.length, 0);
  assert.equal(result.status, 'PASS');
  assert.equal(result.source_gap_count, 0);
});

test('validateFactCheck keeps a genuine factual must_fix and stays NEEDS_FIX', () => {
  const result = validateFactCheck({
    status: 'NEEDS_FIX',
    must_fix: [{ location: 'sections[0].public_article.body_paragraphs', problem: 'fabricated number' }],
    recommended_fixes: [],
    source_gaps: []
  });
  assert.equal(result.must_fix.length, 1);
  assert.equal(result.status, 'NEEDS_FIX');
});

test('collectValidEvidenceIds gathers evidence_blocks ids and primary_evidence_ids', () => {
  const ids = collectValidEvidenceIds({ candidates: [
    { source_extraction: { evidence_blocks: [{ evidence_id: 'sx:1' }, { id: 'sx:2' }] }, primary_evidence_ids: ['p1'] }
  ] });
  assert.ok(ids.has('sx:1') && ids.has('sx:2') && ids.has('p1'));
});

test('sanitizeClaimEvidenceIds removes hallucinated ids, keeps valid ones', () => {
  const editor = { sections: [{ claims: [{ evidence_ids: ['real', 'fake'] }] }] };
  const reporter = { candidates: [{ primary_evidence_ids: ['real'] }] };
  const result = sanitizeClaimEvidenceIds(editor, reporter);
  assert.deepEqual(result.sections[0].claims[0].evidence_ids, ['real']);
});
