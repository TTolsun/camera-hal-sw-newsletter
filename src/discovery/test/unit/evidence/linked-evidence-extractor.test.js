const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FETCH_STATUSES,
  FETCH_STATUS_VALUES,
  LINKED_EVIDENCE_TYPES,
  extractLinkedEvidenceFromCandidate,
  extractLinkedEvidenceFromText
} = require('../../..');
const { readTextFixture } = require('../../../../shared/test/helpers/fixture-loader');

const RESOLVER_ONLY_STATUSES = new Set(
  FETCH_STATUS_VALUES.filter(status => status !== FETCH_STATUSES.NOT_FETCHED)
);

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

test('extractor ignores normalized_url alias while preserving secondary generic URL', () => {
  const normalizedUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const secondaryUrl = 'https://example.com/camera-evidence';
  const evidence = extractLinkedEvidenceFromCandidate({
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    normalized_url: normalizedUrl,
    summary: `Primary normalized row ${normalizedUrl}; extra note ${secondaryUrl}`
  });

  assertExtractorStatuses(evidence);
  assert.deepEqual(evidence.map(item => item.url), [secondaryUrl]);
  assert.equal(evidence[0].type, LINKED_EVIDENCE_TYPES.GENERIC_URL);
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

test('extractor excerpts docs anchor from regex match position instead of earlier repeated text', () => {
  const evidence = extractLinkedEvidenceFromText([
    'decoy-context prefix#camera-video-1.6.1suffix should not anchor the excerpt.',
    'x'.repeat(260),
    'actual-anchor-context href="#camera-video-1.6.1" final marker.'
  ].join(' '));

  const anchor = evidence.find(item => item.type === LINKED_EVIDENCE_TYPES.DOCS_ANCHOR);

  assert.ok(anchor);
  assert.equal(anchor.identifier, '#camera-video-1.6.1');
  assert.equal(anchor.raw_excerpt.includes('actual-anchor-context'), true);
  assert.equal(anchor.raw_excerpt.includes('decoy-context'), false);
});

test('extractor only classifies known patchwork hosts as mailing list evidence', () => {
  const evidence = extractLinkedEvidenceFromText([
    'Allowed patchwork host https://patchwork.kernel.org/project/linux-media/patch/123/.',
    'Unrelated host https://notpatchwork.example.com/camera-evidence.'
  ].join(' '));

  const byUrl = new Map(evidence.map(item => [item.url, item]));

  assert.equal(
    byUrl.get('https://patchwork.kernel.org/project/linux-media/patch/123/')?.type,
    LINKED_EVIDENCE_TYPES.MAILING_LIST
  );
  assert.equal(
    byUrl.get('https://notpatchwork.example.com/camera-evidence')?.type,
    LINKED_EVIDENCE_TYPES.GENERIC_URL
  );
});
