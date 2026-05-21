const assert = require('node:assert/strict');
const test = require('node:test');

const {
  classifyObservation,
  runSourceMonitor
} = require('../../../scripts/newsroom/collect/source-monitor');

const source = {
  source_id: 'aosp-camera-docs',
  root_url: 'https://source.android.com/docs/core/camera',
  url_patterns: ['https://source.android.com/docs/core/camera/**'],
  source_priority: 'high',
  selection_lane: 'primary_camera_stack',
  expected_categories: ['aosp', 'camera-hal'],
  date_extractors: ['visible_last_updated'],
  content_hash_enabled: true,
  main_article_allowed: true,
  fallback_only: false,
  max_pages_per_run: 5,
  fetch_timeout_ms: 8000
};

function snapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    source_id: source.source_id,
    updated_at: '2026-05-20T00:00:00.000Z',
    pages: [],
    processed_source_event_ids: [],
    processed_evidence_ids: [],
    ...overrides
  };
}

function page(overrides = {}) {
  return {
    source_identity_key: 'aosp-camera-docs:page-1',
    url: 'https://source.android.com/docs/core/camera',
    canonical_url: 'https://source.android.com/docs/core/camera',
    title: 'AOSP Camera docs',
    visible_last_updated: '2026-05-20',
    structured_date_modified: '',
    sitemap_lastmod: '',
    content_hash: 'raw-1',
    normalized_content_hash: 'body-1',
    anchors: [],
    first_seen_at: '2026-05-20T00:00:00.000Z',
    last_seen_at: '2026-05-20T00:00:00.000Z',
    seen_count: 1,
    ...overrides
  };
}

test('last updated plus material content change creates publishable source event', () => {
  const previous = page();
  const current = page({
    visible_last_updated: '2026-05-22',
    normalized_content_hash: 'body-2'
  });
  const event = classifyObservation({
    source,
    previous,
    current,
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  assert.equal(event.event_type, 'last_updated_changed');
  assert.equal(event.date_source, 'visible_last_updated');
  assert.equal(event.date_confidence, 85);
  assert.equal(event.candidate_allowed, true);
  assert.equal(event.main_article_allowed, true);
});

test('content change without date is weak editor-review source event', () => {
  const previous = page();
  const current = page({ normalized_content_hash: 'body-2' });
  const event = classifyObservation({
    source,
    previous,
    current,
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  assert.equal(event.event_type, 'content_changed_without_date_change');
  assert.equal(event.date_source, 'content_hash_changed_without_date');
  assert.equal(event.needs_editor_date_review, true);
  assert.equal(event.main_article_allowed, false);
});

test('new page is classified as page_added and can create a candidate', () => {
  const current = page({
    source_identity_key: 'aosp-camera-docs:page-new',
    visible_last_updated: '2026-05-22'
  });
  const event = classifyObservation({
    source,
    previous: null,
    current,
    snapshot: snapshot(),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  assert.equal(event.event_type, 'page_added');
  assert.equal(event.date_source, 'visible_last_updated');
  assert.equal(event.candidate_allowed, true);
});

test('release row and anchor additions are classified before generic metadata changes', () => {
  const previous = page();
  const releaseEvent = classifyObservation({
    source,
    previous,
    current: page({ anchors: ['camera-1.6.1'] }),
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  const anchorEvent = classifyObservation({
    source,
    previous,
    current: page({ anchors: ['camera-provider-session'] }),
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });

  assert.equal(releaseEvent.event_type, 'release_row_added');
  assert.equal(releaseEvent.candidate_allowed, true);
  assert.equal(anchorEvent.event_type, 'anchor_added');
  assert.equal(anchorEvent.candidate_allowed, true);
});

test('metadata-only and no meaningful changes never create candidates', () => {
  const previous = page();
  const metadataOnly = classifyObservation({
    source,
    previous,
    current: page({ visible_last_updated: '2026-05-22' }),
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  const unchanged = classifyObservation({
    source,
    previous,
    current: page(),
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });

  assert.equal(metadataOnly.event_type, 'metadata_only_changed');
  assert.equal(metadataOnly.candidate_allowed, false);
  assert.equal(unchanged.event_type, 'no_meaningful_change');
  assert.equal(unchanged.candidate_allowed, false);
});

test('duplicate processed event id does not create a candidate', () => {
  const previous = page();
  const current = page({
    visible_last_updated: '2026-05-22',
    normalized_content_hash: 'body-2'
  });
  const first = classifyObservation({
    source,
    previous,
    current,
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  const duplicate = classifyObservation({
    source,
    previous,
    current,
    snapshot: snapshot({
      pages: [previous],
      processed_source_event_ids: [first.source_event_id]
    }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  assert.equal(duplicate.duplicate_processed, true);
  assert.equal(duplicate.candidate_allowed, false);
});

test('fetch failure is diagnostic and is not classified as page_removed', async () => {
  const result = await runSourceMonitor({
    date: '2026-05-22',
    registry: { schemaVersion: 1, sources: [source] },
    snapshots: { [source.source_id]: snapshot({ pages: [page()] }) },
    fetchImpl: async () => {
      throw new Error('timeout');
    },
    writeArtifacts: false
  });
  assert.equal(result.report.events.length, 0);
  assert.equal(result.report.diagnostics.some(item => item.type === 'monitor_error'), true);
  assert.equal(result.report.diagnostics.some(item => item.type === 'incomplete_observation'), true);
  assert.equal(result.candidates.length, 0);
});

test('confirmed 404 creates page_removed but never candidate', () => {
  const previous = page();
  const current = page({ removed_status: 404 });
  const event = classifyObservation({
    source,
    previous,
    current,
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  assert.equal(event.event_type, 'page_removed');
  assert.equal(event.candidate_allowed, false);
  assert.equal(event.main_article_allowed, false);
});
