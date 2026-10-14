const test = require('node:test');
const assert = require('node:assert/strict');
const { bindPrimaryReadingNotes } = require('../../../reporter/primary-reading-provenance');
const section = { source_verification_notes: ['Verified against primary commit message.', 'Evidence ID source-body:sample used.'] };
const candidate = { url: 'https://example.com/change', article_source_reading: { status: 'read', documents: [
  { evidence_id: 'source-body:sample', url: 'https://example.com/change', text: 'Patch content', truncated: false }
] } };

test('existing primary evidence reference receives canonical fetched-document labels without rewriting claims', () => {
  const notes = bindPrimaryReadingNotes(section, candidate);
  assert.deepEqual(notes.slice(0, 2), section.source_verification_notes);
  assert.deepEqual(notes.slice(2), ['Source URL: https://example.com/change', 'Evidence ID: source-body:sample']);
  assert.deepEqual(bindPrimaryReadingNotes({ source_verification_notes: notes }, candidate), notes);
  const blanket = { source_verification_notes: [...section.source_verification_notes, 'All linked bugs were verified.'] };
  assert.ok(bindPrimaryReadingNotes(blanket, candidate).includes('All linked bugs were verified.'));
});

test('combined labels are split only when they bind to the same fully fetched source', () => {
  const combined = 'Source URL: https://example.com/change, Evidence ID: source-body:sample';
  const article = { source_verification_notes: [combined, 'All linked bugs were verified.'] };
  assert.deepEqual(bindPrimaryReadingNotes(article, candidate), [
    'Source URL: https://example.com/change', 'Evidence ID: source-body:sample', 'All linked bugs were verified.'
  ]);
  for (const invalid of [combined.replace('/change', '/other'), combined.replace(':sample', ':other'), combined + ', all links verified']) {
    assert.deepEqual(bindPrimaryReadingNotes({ source_verification_notes: [invalid] }, candidate), [invalid]);
  }
  const truncated = { ...candidate, article_source_reading: { status: 'read', documents: [
    { ...candidate.article_source_reading.documents[0], truncated: true }
  ] } };
  assert.deepEqual(bindPrimaryReadingNotes(article, truncated), article.source_verification_notes);
});

test('unfetched, truncated, mismatched and ambiguous evidence never receives provenance labels', () => {
  for (const change of [
    { status: 'unavailable' },
    { documents: [{ ...candidate.article_source_reading.documents[0], truncated: true }] },
    { documents: [{ ...candidate.article_source_reading.documents[0], url: 'https://example.com/other' }] }
  ]) {
    assert.deepEqual(bindPrimaryReadingNotes(section, { ...candidate, article_source_reading: { ...candidate.article_source_reading, ...change } }), section.source_verification_notes);
  }
  for (const extra of ['Evidence ID source-body:other used.', 'Source URL: https://example.com/other']) {
    const conflicting = { source_verification_notes: [...section.source_verification_notes, extra] };
    assert.deepEqual(bindPrimaryReadingNotes(conflicting, candidate), conflicting.source_verification_notes);
  }
});

test('only an exact fetched primary Gerrit reading statement is scoped, never another change or linked claims', () => {
  const url = 'https://android-review.googlesource.com/c/platform/test/+/123';
  const source = { ...candidate, url, article_source_reading: { status: 'read', documents: [
    { ...candidate.article_source_reading.documents[0], url }
  ] } };
  const notes = ['Verified against Gerrit change 123 documents.', 'Evidence ID source-body:sample used.',
    'Verified against Gerrit change 999 documents.', 'All linked Gerrit changes were verified.'];
  const result = bindPrimaryReadingNotes({ source_verification_notes: notes }, source);
  assert.equal(result[0], 'Primary source: Verified against Gerrit change 123 documents.');
  assert.equal(result[2], notes[2]);
  assert.equal(result[3], notes[3]);
});

test('the unchanged linked-evidence gate still blocks blanket confirmation after primary binding', () => {
  const { addLinkedEvidenceQualityDeductions } = require('../../../quality/quality-deduction-rules');
  const source = { ...candidate, linked_evidence_summary: { total_count: 1, has_unresolved_evidence: true },
    impact_classification: { impact_type: 'runtime_behavior_change', camera_pipeline_impact: true, recommended_article_type: 'main' } };
  for (const blanket of [false, true]) {
    const article = { ...section, source_verification_notes: [...section.source_verification_notes,
      ...(blanket ? ['All linked Gerrit changes were verified.'] : [])] };
    article.source_verification_notes = bindPrimaryReadingNotes(article, source);
    const state = { deductions: [] };
    addLinkedEvidenceQualityDeductions(state, article, source, 'Synthetic article');
    assert.equal(state.deductions.some(item => item.category === 'linked-evidence-overclaim'), blanket);
  }
});
