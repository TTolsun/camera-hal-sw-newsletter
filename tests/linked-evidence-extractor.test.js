const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FETCH_STATUSES,
  LINKED_EVIDENCE_TYPES,
  extractLinkedEvidenceFromCandidate,
  extractLinkedEvidenceFromText
} = require('../scripts/newsroom/evidence');
const { readTextFixture } = require('./helpers/fixture-loader');

const RESOLVER_ONLY_STATUSES = new Set([
  FETCH_STATUSES.RESOLVED,
  FETCH_STATUSES.BLOCKED,
  FETCH_STATUSES.FAILED,
  FETCH_STATUSES.UNSUPPORTED,
  FETCH_STATUSES.SKIPPED
]);

function types(items) {
  return new Set(items.map(item => item.type));
}

function assertExtractorStatuses(items) {
  assert.ok(items.length > 0);
  for (const item of items) {
    assert.equal(item.fetch_status, FETCH_STATUSES.NOT_FETCHED);
    assert.equal(RESOLVER_ONLY_STATUSES.has(item.fetch_status), false);
  }
}

test('extractor detects CameraX release row linked evidence without fetching', () => {
  const html = readTextFixture('linked-evidence/camerax-release-row.html');
  const evidence = extractLinkedEvidenceFromCandidate({
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    html
  });
  const extractedTypes = types(evidence);

  assertExtractorStatuses(evidence);
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.ANDROID_GERRIT));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.GOOGLE_ISSUE_TRACKER));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.DOCS_ANCHOR));
  assert.ok(evidence.some(item => item.identifier === '345678901'));
  assert.equal(
    evidence.some(item => item.url === 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'),
    false
  );
});

test('extractor detects supported linked evidence types in synthetic text', () => {
  const text = readTextFixture('linked-evidence/mixed-links.txt');
  const evidence = extractLinkedEvidenceFromText(text);
  const extractedTypes = types(evidence);

  assertExtractorStatuses(evidence);
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.ANDROID_GERRIT));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.GITHUB_PULL_REQUEST));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.GITHUB_ISSUE));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.GITHUB_COMMIT));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.GITHUB_RELEASE));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.MAILING_LIST));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.CVE));
  assert.ok(extractedTypes.has(LINKED_EVIDENCE_TYPES.GENERIC_URL));
});

test('extractor ignores primary candidate url when it is the only URL', () => {
  const evidence = extractLinkedEvidenceFromCandidate({
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    summary: 'Primary row: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
  });

  assert.deepEqual(evidence, []);
});

test('extractor collapses duplicate linked evidence', () => {
  const text = [
    'See https://github.com/androidx/androidx/pull/1234.',
    'Again https://github.com/androidx/androidx/pull/1234.',
    'Again https://github.com/androidx/androidx/pull/1234.'
  ].join(' ');

  const evidence = extractLinkedEvidenceFromText(text);

  assert.equal(evidence.filter(item => item.type === LINKED_EVIDENCE_TYPES.GITHUB_PULL_REQUEST).length, 1);
});

test('extractor detects issue tracker shorthand and docs anchor', () => {
  const evidence = extractLinkedEvidenceFromText('Release details b/123456789 are near href="#camera-video-1.6.1".');

  assertExtractorStatuses(evidence);
  assert.ok(evidence.some(item => item.type === LINKED_EVIDENCE_TYPES.GOOGLE_ISSUE_TRACKER && item.identifier === '123456789'));
  assert.ok(evidence.some(item => item.type === LINKED_EVIDENCE_TYPES.DOCS_ANCHOR && item.identifier === '#camera-video-1.6.1'));
});
