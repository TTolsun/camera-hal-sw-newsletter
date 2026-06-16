'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectValidEvidenceIds,
  isSchemaFieldFactCheckViolation,
  sanitizeClaimEvidenceIds,
  validateFactCheck
} = require('../../../publish/fact-check-postprocess');
const { buildAllowedClaimEvidence } = require('../../../quality/claim-source-binding');

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

// collectValidEvidenceIds 갭: allowlist를 바인딩 index와 일치시켜, capsule이 노출한 합성
// sx:/candidate: id(후보에 명시 저장되지 않음)를 sanitize가 떼지 않게 한다. 지어낸 id는 여전히 제거.
test('collectValidEvidenceIds includes the binder-synthesized ids the capsule exposes', () => {
  const url = 'https://lore.kernel.org/linux-media/atomisp-fix';
  const cand = {
    title: 'atomisp fix',
    url,
    source_candidate_hash: 'fedcba98765432100011223344556677',
    summary: 'atomisp CSI2 bridge memory leak fix.',
    source_extraction: { evidence_blocks: [{ text: 'atomisp_csi2_bridge_parse_firmware leaks the async notifier.', url }] }
  };
  const sxId = buildAllowedClaimEvidence(cand).map(item => item.evidence_id).find(id => id.startsWith('sx:'));
  assert.ok(sxId, 'capsule should expose a synthetic sx: id');
  assert.ok(collectValidEvidenceIds({ candidates: [cand] }).has(sxId));
});

test('sanitizeClaimEvidenceIds keeps a synthetic source-extraction id but still strips a hallucinated one', () => {
  const url = 'https://lore.kernel.org/linux-media/atomisp-fix';
  const cand = {
    title: 'atomisp fix',
    url,
    source_candidate_hash: 'fedcba98765432100011223344556677',
    source_extraction: { evidence_blocks: [{ text: 'atomisp_csi2_bridge_parse_firmware leaks the async notifier.', url }] }
  };
  const sxId = buildAllowedClaimEvidence(cand).map(item => item.evidence_id).find(id => id.startsWith('sx:'));
  const editor = { sections: [{ claims: [{ evidence_ids: [sxId, 'sx:hallucinated-fake'] }] }] };
  const result = sanitizeClaimEvidenceIds(editor, { candidates: [cand] });
  assert.deepEqual(result.sections[0].claims[0].evidence_ids, [sxId]);
});

// 불변식: allowlist는 capsule(buildAllowedClaimEvidence)이 노출한 모든 id를 포함해야 한다.
// sx:뿐 아니라 candidate: 요약 id 등 모든 종류가 sanitize에 의해 떼이지 않게 보장.
test('collectValidEvidenceIds is a superset of every id the capsule exposes (incl. candidate: summary)', () => {
  const url = 'https://example.com/camerax';
  const cand = {
    title: 'CameraX',
    url,
    source_candidate_hash: 'aabbccddeeff00112233445566778899',
    summary: 'CameraX 1.6.1 fixes a device compatibility crash.',
    source_extraction: { evidence_blocks: [{ text: 'Fixed a device-specific crash.', url }] }
  };
  const capsuleIds = buildAllowedClaimEvidence(cand).map(item => item.evidence_id);
  const valid = collectValidEvidenceIds({ candidates: [cand] });
  assert.ok(capsuleIds.length > 0);
  for (const id of capsuleIds) {
    assert.ok(valid.has(id), `allowlist must include capsule id: ${id}`);
  }
  assert.ok(capsuleIds.some(id => id.startsWith('candidate:')), 'a candidate: summary id should be exposed and allowlisted');
});

test('collectValidEvidenceIds tolerates a candidate with no evidence (no throw, empty set)', () => {
  assert.doesNotThrow(() => collectValidEvidenceIds({ candidates: [{}] }));
  assert.equal(collectValidEvidenceIds({ candidates: [{}] }).size, 0);
});
