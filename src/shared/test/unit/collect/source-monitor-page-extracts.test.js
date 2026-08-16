const test = require('node:test');
const assert = require('node:assert');
const { collectAndClassifySourceEvents } = require('../../../collect/source-monitor');

test('release_note_extract가 있는 관측은 pageExtracts로 반환된다(영속 아님)', async () => {
  const observation = {
    source_identity_key: 'k1',
    url: 'https://developer.android.com/about/versions/16/features',
    canonical_url: 'https://developer.android.com/about/versions/16/features',
    title: 'Features and APIs',
    visible_last_updated: '2026-08-07',
    normalized_content_hash: 'h1',
    content_hash: 'h1',
    release_note_sections: [{ heading: 'Camera', hash: 's1' }],
    release_note_extract: {
      release: 'Android 16 features',
      sections: [{ heading: 'Camera', sentence: 'Hybrid auto-exposure.', hash: 's1', url: 'https://developer.android.com/about/versions/16/features#camera' }]
    },
    status: 'ok'
  };
  const registrySource = {
    source_id: 'android-version-features',
    root_url: 'https://developer.android.com/about/versions',
    main_article_allowed: true,
    selection_lane: 'primary_camera_stack'
  };
  const result = await collectAndClassifySourceEvents({
    root: process.cwd(),
    date: '2026-08-17',
    registry: { schemaVersion: 1, sources: [registrySource] },
    snapshots: { 'android-version-features': { pages: [], processed_source_event_ids: [], processed_evidence_ids: [] } },
    observations: { 'android-version-features': [observation] }
  });
  assert.equal(result.pageExtracts.length, 1);
  const extract = result.pageExtracts[0];
  assert.equal(extract.source_id, 'android-version-features');
  assert.equal(extract.sections[0].hash, 's1');
  assert.equal(extract.event.event_type, 'page_added');
  // 이벤트 artifact에는 여전히 파생 추출이 실리지 않는다(기존 계약 유지).
  assert.equal('release_note_extract' in extract.event.current_values, false);
});
