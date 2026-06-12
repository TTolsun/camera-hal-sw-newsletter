const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FETCH_STATUSES,
  FETCH_STATUS_VALUES,
  LINKED_EVIDENCE_TYPES,
  MAX_LINKED_EVIDENCE_PER_CANDIDATE,
  RAW_EXCERPT_MAX_LENGTH,
  normalizeLinkedEvidence,
  normalizeLinkedEvidenceList,
  truncateRawExcerpt
} = require('../../..');

test('normalizer preserves every valid fetch_status enum value', () => {
  for (const fetchStatus of FETCH_STATUS_VALUES) {
    const evidence = normalizeLinkedEvidence({
      type: LINKED_EVIDENCE_TYPES.GITHUB_ISSUE,
      fetch_status: fetchStatus
    });

    assert.equal(evidence.fetch_status, fetchStatus);
    assert.deepEqual(evidence.warnings, []);
  }
});

test('normalizer maps invalid fetch_status to not_fetched with warning', () => {
  const evidence = normalizeLinkedEvidence({
    type: LINKED_EVIDENCE_TYPES.GITHUB_ISSUE,
    fetch_status: 'published'
  });

  assert.equal(evidence.fetch_status, FETCH_STATUSES.NOT_FETCHED);
  assert.ok(evidence.warnings.some(item => item.includes('fetch_status')));
});

test('normalizer maps invalid type to unknown with warning', () => {
  const evidence = normalizeLinkedEvidence({
    type: 'camera_runtime_magic',
    fetch_status: FETCH_STATUSES.NOT_FETCHED
  });

  assert.equal(evidence.type, LINKED_EVIDENCE_TYPES.UNKNOWN);
  assert.ok(evidence.warnings.some(item => item.includes('type')));
});

test('normalizer handles malformed input without throwing', () => {
  assert.doesNotThrow(() => normalizeLinkedEvidence(null));
  assert.doesNotThrow(() => normalizeLinkedEvidence('not an object'));

  const evidence = normalizeLinkedEvidence(null);
  assert.equal(evidence.type, LINKED_EVIDENCE_TYPES.UNKNOWN);
  assert.equal(evidence.fetch_status, FETCH_STATUSES.NOT_FETCHED);
  assert.equal(evidence.url, '');
  assert.equal(evidence.identifier, '');
  assert.equal(evidence.source_text, '');
  assert.equal(evidence.raw_excerpt, '');
  assert.ok(Array.isArray(evidence.warnings));
});

test('normalizer keeps old candidate compatibility when optional fields are missing', () => {
  const evidence = normalizeLinkedEvidence({});

  assert.deepEqual(Object.keys(evidence), [
    'type',
    'url',
    'identifier',
    'source_text',
    'raw_excerpt',
    'fetch_status',
    'warnings'
  ]);
  assert.equal(evidence.fetch_status, FETCH_STATUSES.NOT_FETCHED);
});

test('raw excerpts are whitespace-normalized and length-limited', () => {
  const long = `alpha\n${'x'.repeat(RAW_EXCERPT_MAX_LENGTH + 100)}`;
  const excerpt = truncateRawExcerpt(long);

  assert.equal(excerpt.includes('\n'), false);
  assert.equal(excerpt.length, RAW_EXCERPT_MAX_LENGTH);

  const evidence = normalizeLinkedEvidence({
    type: LINKED_EVIDENCE_TYPES.CVE,
    fetch_status: FETCH_STATUSES.NOT_FETCHED,
    raw_excerpt: long
  });
  assert.equal(evidence.raw_excerpt.length, RAW_EXCERPT_MAX_LENGTH);
});

test('normalizer preserves optional role classification diagnostics when present', () => {
  const evidence = normalizeLinkedEvidence({
    type: LINKED_EVIDENCE_TYPES.GENERIC_URL,
    fetch_status: FETCH_STATUSES.SKIPPED,
    evidence_role: 'noise',
    classification_reason: 'ignored_utility_link',
    skipped_reason: 'ignored_by_policy'
  });

  assert.equal(evidence.evidence_role, 'noise');
  assert.equal(evidence.classification_reason, 'ignored_utility_link');
  assert.equal(evidence.skipped_reason, 'ignored_by_policy');
});

test('linked evidence list normalization caps candidate evidence count', () => {
  const items = Array.from({ length: MAX_LINKED_EVIDENCE_PER_CANDIDATE + 5 }, (_, index) => ({
    type: LINKED_EVIDENCE_TYPES.CVE,
    identifier: `CVE-2026-${String(10000 + index)}`,
    fetch_status: FETCH_STATUSES.NOT_FETCHED
  }));

  const normalized = normalizeLinkedEvidenceList(items);

  assert.equal(normalized.length, MAX_LINKED_EVIDENCE_PER_CANDIDATE);
});
