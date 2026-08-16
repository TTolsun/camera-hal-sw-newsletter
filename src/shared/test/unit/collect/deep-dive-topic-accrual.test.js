const test = require('node:test');
const assert = require('node:assert');
const { deepDiveAccrualEntries } = require('../../../collect/deep-dive-topic-accrual');

test('강등된 카메라 버킷 후보만 demoted_candidate로 적립된다', () => {
  const candidates = [
    { url: 'https://a', title: 'kept main', relevance_bucket: 'direct_aosp_camera', finalSelectionEligibility: 'main' },
    { url: 'https://b', title: 'watchlisted CDD row', summary: 'Camera ITS row', relevance_bucket: 'direct_aosp_camera', finalSelectionEligibility: 'watchlist', publishedAt: '2026-08-10' },
    { url: 'https://c', title: 'generic blog', relevance_bucket: 'generic_tech_watchlist', finalSelectionEligibility: 'watchlist' }
  ];
  const entries = deepDiveAccrualEntries({ candidates, monitorEvents: [], pageExtracts: [], primaryLaneSourceIds: new Set() });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].topic_key, 'https://b');
  assert.equal(entries[0].evidence[0].origin, 'demoted_candidate');
  assert.equal(entries[0].evidence[0].date_source, 'candidate_published_at');
  assert.equal(entries[0].evidence[0].effective_date, '2026-08-10');
});

test('primary lane 모니터 이벤트는 monitor_event로, 섹션은 document_section으로 적립된다', () => {
  const event = {
    source_id: 'aosp-camera-its-release-notes',
    event_type: 'page_added',
    canonical_url: 'https://source.android.com/docs/compatibility/cts/its-release-notes-17',
    title: 'Android 17 Camera ITS release notes',
    effective_date: '2026-08-06',
    date_source: 'visible_last_updated',
    date_confidence: 85,
    candidate_allowed: true,
    evidence_id: 'ev-1',
    reason: 'Page added.'
  };
  const pageExtract = {
    source_id: 'aosp-camera-its-release-notes',
    url: event.canonical_url,
    title: event.title,
    release: 'Android 17 Camera Image Test Suite',
    sections: [{ heading: 'PASS* status', sentence: 'PASS* marks near-threshold results.', hash: 'h-1', url: `${event.canonical_url}#pass-star` }],
    event
  };
  const entries = deepDiveAccrualEntries({
    candidates: [],
    monitorEvents: [event],
    pageExtracts: [pageExtract],
    primaryLaneSourceIds: new Set(['aosp-camera-its-release-notes'])
  });
  const origins = entries.flatMap(item => item.evidence.map(evidence => evidence.origin));
  assert.ok(origins.includes('monitor_event'));
  assert.ok(origins.includes('document_section'));
  const sectionEntry = entries.find(item => item.topic_key === `${event.canonical_url}#pass-star`);
  assert.equal(sectionEntry.bucket, 'direct_aosp_camera');
  assert.equal(sectionEntry.evidence[0].fingerprint, 'h-1');
  assert.equal(sectionEntry.evidence[0].excerpt, 'PASS* marks near-threshold results.');
});
