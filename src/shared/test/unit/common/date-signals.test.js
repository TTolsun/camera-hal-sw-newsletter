const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DATE_SOURCE_CONFIDENCE,
  EVENT_TYPES,
  dateQualityForCandidate,
  displayDate,
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

// displayDate는 소스 원문 표기를 표시용 YYYY-MM-DD 하나로 맞추되 소스가 말한 날짜를 바꾸지
// 않는다. normalizeDate로 대체하면 안 되는 이유가 두 줄에 걸쳐 잠겨 있다: 월 이름 형식은
// 로컬 Date 파싱에서 하루 밀리고(Asia/Seoul 실측 '2026-06-30'), 'YYYY-MM'은 없는 일자가 생긴다.
test('displayDate normalizes observed source shapes without shifting the day', () => {
  assert.equal(displayDate('2026-03-25'), '2026-03-25');
  assert.equal(displayDate('2026-07-10T11:12:38+01:00'), '2026-07-10');
  assert.equal(displayDate('2026-08-07T12:56:16Z'), '2026-08-07');
  assert.equal(displayDate('July 01, 2026'), '2026-07-01');
  assert.equal(displayDate('May 06, 2026'), '2026-05-06');
  assert.equal(displayDate('Thu, 30 Apr 2026 22:36:23 +0000'), '2026-04-30');
  assert.equal(displayDate('Tue, 09 Jun 2026 13:00:00 +0000'), '2026-06-09');
});

test('displayDate returns empty for shapes it cannot read instead of inventing a day', () => {
  assert.equal(displayDate('2026-07'), '', '월까지만 아는 값에 일자를 만들어내지 않는다');
  assert.equal(displayDate('Junk 05, 2026'), '', '월 이름 앞 3글자만 맞는 문자열은 인정하지 않는다');
  assert.equal(displayDate('last Tuesday'), '');
  assert.equal(displayDate(''), '');
  assert.equal(displayDate(null), '');
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
