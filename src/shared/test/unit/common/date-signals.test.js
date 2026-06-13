const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DATE_SOURCE_CONFIDENCE,
  EVENT_TYPES,
  dateQualityForCandidate,
  resolveCandidateDateEvidence,
  validateDateSource,
  validateEventType
} = require('../../../common/date-signals');

test('issue 227 event_type allowlist is exact', () => {
  assert.deepEqual(EVENT_TYPES, [
    'page_added',
    'page_removed',
    'last_updated_changed',
    'structured_modified_changed',
    'sitemap_lastmod_changed',
    'release_row_added',
    'release_row_changed',
    'anchor_added',
    'material_content_changed',
    'content_changed_without_date_change',
    'metadata_only_changed',
    'no_meaningful_change'
  ]);
  assert.equal(validateEventType('content_changed_without_date'), 'event_type must be one of: page_added, page_removed, last_updated_changed, structured_modified_changed, sitemap_lastmod_changed, release_row_added, release_row_changed, anchor_added, material_content_changed, content_changed_without_date_change, metadata_only_changed, no_meaningful_change.');
});

test('date_source confidence baseline is fixed', () => {
  assert.deepEqual(DATE_SOURCE_CONFIDENCE, {
    visible_date: 100,
    structured_date_published: 95,
    release_row_date: 95,
    visible_last_updated: 85,
    structured_date_modified: 85,
    rss_pub_date: 85,
    atom_updated: 85,
    sitemap_lastmod: 70,
    url_path_date: 65,
    snapshot_page_added: 60,
    http_last_modified: 45,
    content_hash_changed_without_date: 40,
    snapshot_detected_at: 35,
    missing: 0
  });
  assert.match(validateDateSource('last_seen_at'), /date_source must be one of/);
});

test('effective_date publish-ready evidence requires strong source date', () => {
  const strong = resolveCandidateDateEvidence({
    effective_date: '2026-05-22',
    date_source: 'visible_last_updated',
    date_confidence: 85
  });
  assert.equal(strong.publish_ready_date_evidence, true);

  const weak = dateQualityForCandidate({
    effective_date: '2026-05-22',
    date_source: 'content_hash_changed_without_date',
    date_confidence: 40
  });
  assert.equal(weak.main_article_date_eligible, false);
  assert.equal(weak.needs_editor_date_review, true);

  const detectedOnly = resolveCandidateDateEvidence({
    effective_date: '2026-05-22',
    date_source: 'snapshot_detected_at',
    date_confidence: 35
  });
  assert.equal(detectedOnly.publish_ready_date_evidence, false);
});
