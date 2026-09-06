const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  classifyObservation,
  commitSourceSnapshotWrites,
  filterSnapshotWritesByIncludedEvidenceIds,
  observationFromHtml,
  runSourceMonitor,
  snapshotPath,
  explicitDayDate,
  visibleLastUpdated
} = require('../../../collect/source-monitor');
const {
  hashText,
  normalizeSourceUrl,
  sourceIdentityKey
} = require('../../../common/source-identity');

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

// 실제 CameraX 릴리스 노트는 아카이브 행을 앞쪽에 싣는다. 한 행짜리 fixture만 있어서
// 여러 행의 순서를 아무도 잠그지 않았고, 대표 행이 5년 전 행으로 굳는 걸 놓쳤다.
const multiReleaseRowHtml = `
  <html>
    <body>
      <h2 id="camera-1.0.0">Camera 1.0.0</h2>
      <p>May 5, 2021</p>
      <p>The first stable CameraX release.</p>
      <h2 id="camera-1.7.0-alpha02">Camera 1.7.0-alpha02</h2>
      <p>July 1, 2026</p>
      <p>Adds camera extension session behavior.</p>
      <h2 id="camera-1.6.1">Camera 1.6.1</h2>
      <p>May 14, 2026</p>
      <p>Fixes stream behavior for CameraX.</p>
      <h2 id="camera-1.5.0">Camera 1.5.0</h2>
      <p>Documentation refresh without a published release date.</p>
    </body>
  </html>
`;

test('release rows are ordered newest date first and undated rows sort last', () => {
  const observation = observationFromHtml({
    source: androidxSource,
    url: androidxSource.root_url,
    html: multiReleaseRowHtml
  });

  // 문서 순서(1.0.0 먼저)도 anchor 알파벳 순(camera-1.0.0 먼저)도 대표 행 기준이 아니다.
  assert.deepEqual(observation.release_rows.map(row => row.version), [
    '1.7.0-alpha02',
    '1.6.1',
    '1.0.0',
    '1.5.0'
  ]);
  assert.equal(observation.release_row_version, '1.7.0-alpha02');
  assert.equal(observation.release_row_date, '2026-07-01');
  assert.match(observation.release_row_anchor, /#camera-1\.7\.0-alpha02$/);
});

test('pages whose release rows all lack dates keep their deterministic anchor order', () => {
  const observation = observationFromHtml({
    source: androidxSource,
    url: androidxSource.root_url,
    html: `
      <html>
        <body>
          <h2 id="camera-2.0.0">Camera 2.0.0</h2>
          <p>Documentation refresh without a published release date.</p>
          <h2 id="camera-1.0.0">Camera 1.0.0</h2>
          <p>Another entry without a published release date.</p>
        </body>
      </html>
    `
  });

  assert.deepEqual(observation.release_rows.map(row => row.version), ['1.0.0', '2.0.0']);
  assert.equal(observation.release_row_version, '1.0.0');
  assert.equal(observation.release_row_date, '');
});

test('release row event date comes from the newest row, not the alphabetically first anchor', async () => {
  const url = androidxSource.root_url;
  const canonicalUrl = normalizeSourceUrl(url);
  const identity = sourceIdentityKey({ sourceId: androidxSource.source_id, url: canonicalUrl });
  const result = await runSourceMonitor({
    date: '2026-08-10',
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
    fetchImpl: async () => htmlResponse(multiReleaseRowHtml),
    writeArtifacts: false
  });

  const event = result.report.events[0];
  assert.equal(event.event_type, 'release_row_added');
  assert.equal(event.date_source, 'release_row_date');
  assert.equal(event.date_confidence, 95);
  assert.equal(event.release_row_version, '1.7.0-alpha02');
  assert.equal(event.effective_date, '2026-07-01');
});

// 실제 CameraX 릴리스 노트는 같은 id를 단 h3 섹션을 두 번 싣는다(camera-view-1.0.0-alpha12).
// 두 구간의 본문이 달라 해시도 다른데, 앵커만으로 정체성을 잡으면 둘이 한 열쇠로 겹쳐
// 앞 구간 해시와 뒤 구간 해시를 맞대 보게 되고 매 실행마다 2020년 이벤트가 나온다.
const duplicateAnchorReleaseRowHtml = `
  <html>
    <body>
      <h3 id="camera-view-1.0.0-alpha12">Camera-View Version 1.0.0-alpha12</h3>
      <p>June 10, 2020</p>
      <p>Bug Fixes: adds PreviewView#getBitmap() to the camera-view artifact.</p>
      <h3 id="camera-extensions-1.0.0-alpha11">Camera-Extensions Version 1.0.0-alpha11</h3>
      <p>May 27, 2020</p>
      <p>androidx.camera:camera-extensions:1.0.0-alpha11 is released.</p>
      <h3 id="camera-view-1.0.0-alpha12">Camera-View Version 1.0.0-alpha12</h3>
      <p>June 10, 2020</p>
      <p>New Features, API Changes, Bug Fixes: adds PreviewView#getBitmap() to the camera-view artifact.</p>
    </body>
  </html>
`;

function androidxObservation(html) {
  return observationFromHtml({
    source: androidxSource,
    url: androidxSource.root_url,
    html
  });
}

test('a repeated release row anchor keeps both rows and stops reporting a phantom change', () => {
  const observation = androidxObservation(duplicateAnchorReleaseRowHtml);
  const repeated = observation.release_rows.filter(row => row.anchor.endsWith('#camera-view-1.0.0-alpha12'));

  assert.equal(repeated.length, 2);
  assert.notEqual(repeated[0].hash, repeated[1].hash);

  const event = classifyObservation({
    source: androidxSource,
    previous: observation,
    current: androidxObservation(duplicateAnchorReleaseRowHtml),
    snapshot: snapshot({ pages: [observation] }),
    detectedAt: '2026-08-14T00:00:00.000Z'
  });

  assert.equal(event.event_type, 'no_meaningful_change');
});

test('a real body change in the repeated release row is still reported', () => {
  const previous = androidxObservation(duplicateAnchorReleaseRowHtml);
  const current = androidxObservation(
    duplicateAnchorReleaseRowHtml.replace('adds PreviewView#getBitmap() to the camera-view artifact.</p>\n      <h3 id="camera-extensions', 'adds PreviewView#getBitmap() and PreviewView#getScaleType() to the camera-view artifact.</p>\n      <h3 id="camera-extensions')
  );

  assert.notEqual(previous.release_rows[0].hash, current.release_rows[0].hash);

  const event = classifyObservation({
    source: androidxSource,
    previous,
    current,
    snapshot: snapshot({ pages: [previous] }),
    detectedAt: '2026-08-14T00:00:00.000Z'
  });

  assert.equal(event.event_type, 'release_row_changed');
});

// 발행 상태로 커밋된 스냅샷 자체를 다시 흘려 보는 회귀 검사. 이 파일의 200개 행 중
// camera-view-1.0.0-alpha12 앵커가 두 번 들어 있어서, 정체성이 겹치면 소스가 하나도 안
// 바뀐 실행에서도 5년 전 날짜를 단 release_row_changed가 계속 나왔다.
test('the committed CameraX snapshot replays through the diff without a spurious change', () => {
  const snapshotFile = path.join(__dirname, '..', '..', '..', '..', '..', 'state', 'source-snapshots', 'androidx-camerax-release-notes.json');
  const committed = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  const committedPage = committed.pages[0];

  const event = classifyObservation({
    source: androidxSource,
    previous: committedPage,
    current: { ...committedPage },
    snapshot: snapshot({ source_id: androidxSource.source_id, pages: [committedPage] }),
    detectedAt: '2026-08-14T00:00:00.000Z'
  });

  assert.equal(event.event_type, 'no_meaningful_change');
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
  assert.ok(fs.existsSync(path.join(root, 'articles', 'content', 'source-events', '2026-05-22', 'source-change-events.json')));

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

// devsite(source.android.com/developer.android.com) footer의 "Last updated <ISO날짜> UTC." 형식에서
// lazy 캡처가 연도("2026")까지만 잡아 firstDateMatch의 new Date 폴백이 2026-01-01로 둔갑시키던
// 버그 회귀 가드. 같은 해 안의 문서 갱신이 전부 무변화로 보여 dated 이벤트가 안 나오던 원인.
test('visibleLastUpdated extracts the full ISO date from a devsite footer', () => {
  const html = '<html><body><p>Camera ITS release notes body.</p>' +
    '<devsite-content-footer><p>Last updated 2026-07-21 UTC.</p></devsite-content-footer></body></html>';
  assert.equal(visibleLastUpdated(html), '2026-07-21');
});

test('explicitDayDate accepts only day-level dates', () => {
  assert.equal(explicitDayDate('Last updated 2026-07-13 UTC.'), '2026-07-13');
  assert.equal(explicitDayDate('Last updated July 13, 2026.'), '2026-07-13');
  // 월이나 연도까지만 적힌 값은 거절한다.
  assert.equal(explicitDayDate('Last updated July 2026.'), '');
  assert.equal(explicitDayDate('2026'), '');
});

test('the lenient default still fills a day in, which is why the strict reader exists', () => {
  // visibleLastUpdated 의 기본 해석기는 new Date('July 2026') 폴백으로 날짜를 만들어 낸다.
  // 실행 시간대에 따라 2026-07-01 이 되기도 하고 2026-06-30 이 되기도 한다. 어느 쪽이든
  // 원문에 없는 "일"이며, 정밀도를 올리는 자리에서 이 값을 믿으면 안 된다는 근거다.
  const lenient = visibleLastUpdated('<p>Last updated July 2026.</p>');
  assert.match(lenient, /^2026-0[67]-\d{2}$/);
  assert.equal(visibleLastUpdated('<p>Last updated July 2026.</p>', explicitDayDate), '');
});

test('visibleLastUpdated handles month-name dates and missing footers', () => {
  assert.equal(visibleLastUpdated('<p>Last updated January 5, 2026</p>'), '2026-01-05');
  assert.equal(visibleLastUpdated('<p>No footer here</p>'), '');
});
