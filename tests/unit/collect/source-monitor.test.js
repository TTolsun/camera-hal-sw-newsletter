const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  classifyObservation,
  commitSourceSnapshotWrites,
  filterSnapshotWritesByIncludedEvidenceIds,
  runSourceMonitor,
  snapshotPath
} = require('../../../scripts/newsroom/collect/source-monitor');
const {
  hashText,
  normalizeSourceUrl,
  sourceIdentityKey
} = require('../../../scripts/newsroom/common/source-identity');

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

const androidxSource = {
  source_id: 'androidx-camerax-release-notes',
  root_url: 'https://developer.android.com/jetpack/androidx/releases/camera',
  url_patterns: ['https://developer.android.com/jetpack/androidx/releases/camera*'],
  source_priority: 'high',
  selection_lane: 'primary_camera_stack',
  expected_categories: ['android', 'camera-api'],
  date_extractors: ['release_row_date', 'visible_date', 'structured_date_modified'],
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
    visible_date: '',
    visible_last_updated: '2026-05-20',
    structured_date_modified: '',
    sitemap_lastmod: '',
    content_hash: 'raw-1',
    normalized_content_hash: 'body-1',
    anchors: [],
    release_row_date: '',
    release_row_version: '',
    release_row_anchor: '',
    release_row_hash: '',
    release_rows: [],
    first_seen_at: '2026-05-20T00:00:00.000Z',
    last_seen_at: '2026-05-20T00:00:00.000Z',
    seen_count: 1,
    ...overrides
  };
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'source-monitor-'));
}

function htmlResponse(html, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      forEach() {}
    },
    async text() {
      return html;
    }
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

test('date signal respects source date_extractors allowlist', () => {
  const previous = page();
  const current = page({
    visible_date: '2026-05-14',
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
  assert.equal(event.effective_date, '2026-05-22');
});

test('date extractor outputs not listed by registry are ignored as source date signal', () => {
  const previous = page();
  const current = page({
    visible_date: '2026-05-14',
    visible_last_updated: '2026-05-22',
    normalized_content_hash: 'body-2'
  });
  const event = classifyObservation({
    source: { ...source, date_extractors: ['structured_date_modified'] },
    previous,
    current,
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });

  assert.equal(event.event_type, 'content_changed_without_date_change');
  assert.equal(event.date_source, 'content_hash_changed_without_date');
  assert.equal(event.main_article_allowed, false);
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

test('new page is classified as page_added but first-run seed cannot create a main article', () => {
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
  assert.equal(event.main_article_allowed, false);
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

test('AndroidX Camera release rows use release_row_date and release row evidence', async () => {
  const url = androidxSource.root_url;
  const canonicalUrl = normalizeSourceUrl(url);
  const identity = sourceIdentityKey({ sourceId: androidxSource.source_id, url: canonicalUrl });
  const result = await runSourceMonitor({
    date: '2026-05-22',
    registry: { schemaVersion: 1, sources: [androidxSource] },
    snapshots: {
      [androidxSource.source_id]: {
        ...snapshot({ source_id: androidxSource.source_id }),
        pages: [page({
          source_identity_key: identity,
          url,
          canonical_url: canonicalUrl,
          title: 'Camera release notes',
          visible_last_updated: '',
          normalized_content_hash: 'old-body'
        })]
      }
    },
    fetchImpl: async () => htmlResponse(`
      <html>
        <head><title>Camera release notes</title></head>
        <body>
          <h1>Camera release notes</h1>
          <h2 id="camera-1.6.1">Camera 1.6.1</h2>
          <p>May 14, 2026</p>
          <p>Fixes stream behavior for CameraX.</p>
        </body>
      </html>
    `),
    writeArtifacts: false
  });

  assert.equal(result.report.events[0].event_type, 'release_row_added');
  assert.equal(result.report.events[0].date_source, 'release_row_date');
  assert.equal(result.report.events[0].date_confidence, 95);
  assert.equal(result.report.events[0].release_row_version, '1.6.1');
  assert.match(result.report.events[0].release_row_anchor, /#camera-1\.6\.1$/);
});

test('AndroidX Camera release row extractor matches version heading page shape', async () => {
  const url = androidxSource.root_url;
  const canonicalUrl = normalizeSourceUrl(url);
  const identity = sourceIdentityKey({ sourceId: androidxSource.source_id, url: canonicalUrl });
  const result = await runSourceMonitor({
    date: '2026-05-22',
    registry: { schemaVersion: 1, sources: [androidxSource] },
    snapshots: {
      [androidxSource.source_id]: {
        ...snapshot({ source_id: androidxSource.source_id }),
        pages: [page({
          source_identity_key: identity,
          url,
          canonical_url: canonicalUrl,
          title: 'Camera release notes',
          visible_last_updated: '',
          normalized_content_hash: 'old-body'
        })]
      }
    },
    fetchImpl: async () => htmlResponse(`
      <html>
        <body>
          <h3 id="version_170_alpha01">Version 1.7.0-alpha01</h3>
          <p>March 11, 2026</p>
          <p><code>androidx.camera:camera-*:1.7.0-alpha01</code> is released.</p>
        </body>
      </html>
    `),
    writeArtifacts: false
  });

  const event = result.report.events[0];
  assert.equal(event.event_type, 'release_row_added');
  assert.equal(event.release_row_version, '1.7.0-alpha01');
  assert.equal(event.date_source, 'release_row_date');
  assert.equal(event.effective_date, '2026-03-11');
});

test('existing release row body change creates release_row_changed', () => {
  const row = {
    version: '1.6.1',
    anchor: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-1.6.1',
    date: '2026-05-14',
    hash: hashText('old row', 32)
  };
  const previous = page({
    release_row_date: row.date,
    release_row_version: row.version,
    release_row_anchor: row.anchor,
    release_row_hash: row.hash,
    release_rows: [row]
  });
  const current = page({
    release_row_date: row.date,
    release_row_version: row.version,
    release_row_anchor: row.anchor,
    release_row_hash: hashText('new row', 32),
    release_rows: [{ ...row, hash: hashText('new row', 32) }]
  });
  const event = classifyObservation({
    source: androidxSource,
    previous,
    current,
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });

  assert.equal(event.event_type, 'release_row_changed');
  assert.equal(event.date_source, 'release_row_date');
  assert.equal(event.release_row_version, '1.6.1');
});

test('different release rows create distinct evidence ids for the same page URL', () => {
  const previous = page({ release_rows: [] });
  const first = classifyObservation({
    source: androidxSource,
    previous,
    current: page({
      release_rows: [{
        version: '1.6.1',
        anchor: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-1.6.1',
        date: '2026-05-14',
        hash: hashText('row 1.6.1', 32)
      }]
    }),
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });
  const second = classifyObservation({
    source: androidxSource,
    previous,
    current: page({
      release_rows: [{
        version: '1.7.0',
        anchor: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-1.7.0',
        date: '2026-05-21',
        hash: hashText('row 1.7.0', 32)
      }]
    }),
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });

  assert.notEqual(first.evidence_id, second.evidence_id);
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

test('healthy source observation detects scoped page disappearance as page_removed', async () => {
  const removed = page({
    source_identity_key: 'aosp-camera-docs:removed',
    url: 'https://source.android.com/docs/core/camera/removed',
    canonical_url: 'https://source.android.com/docs/core/camera/removed'
  });
  const kept = page({
    source_identity_key: 'aosp-camera-docs:kept',
    url: 'https://source.android.com/docs/core/camera/kept',
    canonical_url: 'https://source.android.com/docs/core/camera/kept'
  });
  const result = await runSourceMonitor({
    date: '2026-05-22',
    registry: { schemaVersion: 1, sources: [source] },
    snapshots: { [source.source_id]: snapshot({ pages: [removed, kept] }) },
    observations: { [source.source_id]: [kept] },
    writeArtifacts: false
  });

  const removedEvent = result.report.events.find(event => event.event_type === 'page_removed');
  assert.equal(removedEvent.previous_values.source_identity_key, removed.source_identity_key);
  assert.equal(removedEvent.candidate_allowed, false);
});

test('content_hash_enabled=false blocks content-hash-only candidate events', () => {
  const previous = page();
  const current = page({ normalized_content_hash: 'body-2' });
  const event = classifyObservation({
    source: { ...source, content_hash_enabled: false },
    previous,
    current,
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-05-22T00:00:00.000Z'
  });

  assert.equal(event.event_type, 'no_meaningful_change');
  assert.equal(event.candidate_allowed, false);
});

test('source monitor can write reports without committing processed snapshot ids', async () => {
  const root = tempRoot();
  const previous = page();
  const current = page({
    visible_last_updated: '2026-05-22',
    normalized_content_hash: 'body-2'
  });
  const result = await runSourceMonitor({
    root,
    date: '2026-05-22',
    registry: { schemaVersion: 1, sources: [source] },
    snapshots: { [source.source_id]: snapshot({ pages: [previous] }) },
    observations: { [source.source_id]: [current] },
    writeArtifacts: true,
    commitSnapshots: false
  });

  assert.equal(fs.existsSync(snapshotPath(root, source.source_id)), false);
  assert.ok(fs.existsSync(path.join(root, 'content', 'source-events', '2026-05-22', 'source-change-events.json')));

  commitSourceSnapshotWrites({ root, snapshotWrites: result.snapshotWrites });
  const committed = JSON.parse(fs.readFileSync(snapshotPath(root, source.source_id), 'utf8'));
  assert.equal(committed.processed_source_event_ids.length, 1);
  assert.equal(committed.processed_evidence_ids.length, 1);
});

test('snapshot processed candidate ids are limited to final survivor evidence ids', async () => {
  const previous = page();
  const current = page({
    visible_last_updated: '2026-05-22',
    normalized_content_hash: 'body-2'
  });
  const result = await runSourceMonitor({
    date: '2026-05-22',
    registry: { schemaVersion: 1, sources: [source] },
    snapshots: { [source.source_id]: snapshot({ pages: [previous] }) },
    observations: { [source.source_id]: [current] },
    writeArtifacts: false,
    commitSnapshots: false
  });
  const event = result.report.events[0];
  const dropped = filterSnapshotWritesByIncludedEvidenceIds(result.snapshotWrites, new Set());
  const included = filterSnapshotWritesByIncludedEvidenceIds(result.snapshotWrites, new Set([event.evidence_id]));

  assert.equal(dropped[0].snapshot.processed_source_event_ids.length, 0);
  assert.equal(dropped[0].snapshot.processed_evidence_ids.length, 0);
  assert.deepEqual(included[0].snapshot.processed_source_event_ids, [event.source_event_id]);
  assert.deepEqual(included[0].snapshot.processed_evidence_ids, [event.evidence_id]);
});

test('diagnostic source events can be marked processed without evidence ids', async () => {
  const previous = page();
  const current = page({ visible_last_updated: '2026-05-22' });
  const result = await runSourceMonitor({
    date: '2026-05-22',
    registry: { schemaVersion: 1, sources: [source] },
    snapshots: { [source.source_id]: snapshot({ pages: [previous] }) },
    observations: { [source.source_id]: [current] },
    writeArtifacts: false,
    commitSnapshots: false
  });
  const filtered = filterSnapshotWritesByIncludedEvidenceIds(result.snapshotWrites, new Set());

  assert.equal(result.report.events[0].event_type, 'metadata_only_changed');
  assert.deepEqual(filtered[0].snapshot.processed_source_event_ids, [result.report.events[0].source_event_id]);
  assert.deepEqual(filtered[0].snapshot.processed_evidence_ids, []);
});

test('atomic snapshot write failure preserves the previous snapshot file', () => {
  const root = tempRoot();
  const previous = snapshot({ pages: [page()], processed_source_event_ids: ['existing-event'] });
  const target = snapshotPath(root, source.source_id);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(previous, null, 2)}\n`, 'utf8');

  assert.throws(() => commitSourceSnapshotWrites({
    root,
    snapshotWrites: [{
      source,
      snapshot: snapshot({ processed_source_event_ids: ['new-event'] })
    }],
    writeOptions: {
      writeFileSync() {
        throw new Error('disk full');
      }
    }
  }), /disk full/);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepEqual(after.processed_source_event_ids, ['existing-event']);
});
