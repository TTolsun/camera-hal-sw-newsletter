const assert = require('node:assert/strict');
const test = require('node:test');

const {
  LINKED_EVIDENCE_TYPES,
  extractLinkedEvidenceFromCandidate,
  extractLinkedEvidenceFromText
} = require('../../../scripts/newsroom/evidence');
const { readTextFixture } = require('../../helpers/fixture-loader');

function evidenceByUrl(items) {
  return new Map(items.map(item => [item.url, item]));
}

test('source-aware baseline fixture keeps RSS summary anchor URLs visible to the existing extractor', () => {
  const rss = readTextFixture('linked-evidence/rss-summary-with-anchor.xml');
  const evidence = extractLinkedEvidenceFromText(rss);
  const byUrl = evidenceByUrl(evidence);

  assert.equal(
    byUrl.get('https://developer.android.com/jetpack/androidx/releases/camera#1.6.1')?.type,
    LINKED_EVIDENCE_TYPES.GENERIC_URL
  );
  assert.equal(
    byUrl.get('https://android-review.googlesource.com/c/platform/frameworks/support/+/3456789')?.type,
    LINKED_EVIDENCE_TYPES.ANDROID_GERRIT
  );
});

test('source-aware baseline fixture keeps article body links visible before role classification', () => {
  const html = readTextFixture('linked-evidence/android-blog-article-links.html');
  const evidence = extractLinkedEvidenceFromText(html);
  const byUrl = evidenceByUrl(evidence);

  assert.equal(
    byUrl.get('https://developer.android.com/jetpack/androidx/releases/camera#1.6.1')?.type,
    LINKED_EVIDENCE_TYPES.GENERIC_URL
  );
  assert.equal(
    byUrl.get('https://github.com/androidx/androidx/pull/1234')?.type,
    LINKED_EVIDENCE_TYPES.GITHUB_PULL_REQUEST
  );
  assert.equal(
    byUrl.get('https://android-developers.googleblog.com/feeds/posts/default?alt=rss')?.type,
    LINKED_EVIDENCE_TYPES.GENERIC_URL
  );
});

test('source-aware baseline keeps release row links visible without treating the primary URL as evidence', () => {
  const html = readTextFixture('linked-evidence/camerax-release-row.html');
  const evidence = extractLinkedEvidenceFromCandidate({
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    html
  });
  const byUrl = evidenceByUrl(evidence);

  assert.equal(
    byUrl.get('https://android-review.googlesource.com/c/platform/frameworks/support/+/3456789')?.type,
    LINKED_EVIDENCE_TYPES.ANDROID_GERRIT
  );
  assert.equal(
    byUrl.get('https://issuetracker.google.com/issues/345678901')?.type,
    LINKED_EVIDENCE_TYPES.GOOGLE_ISSUE_TRACKER
  );
  assert.equal(
    byUrl.has('https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'),
    false
  );
  assert.equal(
    evidence.some(item => item.type === LINKED_EVIDENCE_TYPES.DOCS_ANCHOR && item.identifier === '#1.6.1'),
    true
  );
});
