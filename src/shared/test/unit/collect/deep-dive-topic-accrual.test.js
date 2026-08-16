const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  accrueDeepDiveTopicsFromCollect,
  deepDiveAccrualEntries
} = require('../../../collect/deep-dive-topic-accrual');
const {
  DEEP_DIVE_QUEUE_REL_PATH,
  loadDeepDiveTopicQueue
} = require('../../../collect/deep-dive-topic-queue');
const { tempRoot, writeJson } = require('../../helpers/fs');

// 레지스트리의 실제 소스 모양(선정 lane + 버킷 판정 입력)을 그대로 쓴다.
const ITS_SOURCE = {
  source_id: 'aosp-camera-its-release-notes',
  selection_lane: 'primary_camera_stack',
  expected_categories: ['compatibility', 'camera-hal']
};
const CAMERAX_SOURCE = {
  source_id: 'androidx-camerax-release-notes',
  selection_lane: 'primary_camera_stack',
  expected_categories: ['android', 'camera-api']
};

function sourceMap(...sources) {
  return new Map(sources.map(source => [source.source_id, source]));
}

test('강등된 카메라 버킷 후보만 demoted_candidate로 적립된다', () => {
  const candidates = [
    { url: 'https://a', title: 'kept main', relevance_bucket: 'direct_aosp_camera', finalSelectionEligibility: 'main' },
    { url: 'https://b', title: 'watchlisted CDD row', summary: 'Camera ITS row', relevance_bucket: 'direct_aosp_camera', finalSelectionEligibility: 'watchlist', publishedAt: '2026-08-10' },
    { url: 'https://c', title: 'generic blog', relevance_bucket: 'generic_tech_watchlist', finalSelectionEligibility: 'watchlist' }
  ];
  const entries = deepDiveAccrualEntries({ candidates, monitorEvents: [], pageExtracts: [], primaryLaneSources: new Map() });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].topic_key, 'https://b');
  assert.equal(entries[0].evidence[0].origin, 'demoted_candidate');
  assert.equal(entries[0].evidence[0].date_source, 'candidate_published_at');
  assert.equal(entries[0].evidence[0].effective_date, '2026-08-10');
});

test('primary lane 모니터 이벤트는 monitor_event로, 섹션은 document_section으로 적립된다', () => {
  const event = {
    source_id: ITS_SOURCE.source_id,
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
    source_id: ITS_SOURCE.source_id,
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
    primaryLaneSources: sourceMap(ITS_SOURCE)
  });
  const origins = entries.flatMap(item => item.evidence.map(evidence => evidence.origin));
  assert.ok(origins.includes('monitor_event'));
  assert.ok(origins.includes('document_section'));
  const sectionEntry = entries.find(item => item.topic_key === `${event.canonical_url}#pass-star`);
  assert.equal(sectionEntry.bucket, 'direct_aosp_camera');
  assert.equal(sectionEntry.evidence[0].fingerprint, 'h-1');
  assert.equal(sectionEntry.evidence[0].excerpt, 'PASS* marks near-threshold results.');
});

// 버킷은 선정 1순위(direct 우선)다. CameraX를 direct로 적립하면 CameraX 주제가 매주
// 진짜 AOSP 카메라 주제를 밀어내고 먼저 뽑힌다.
test('CameraX 소스는 adjacent 버킷으로 적립된다(direct로 승격되지 않는다)', () => {
  const event = {
    source_id: CAMERAX_SOURCE.source_id,
    event_type: 'release_row_added',
    canonical_url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    title: 'CameraX 1.5.0',
    effective_date: '2026-08-12',
    date_source: 'release_row_date',
    date_confidence: 85,
    candidate_allowed: true,
    evidence_id: 'ev-camerax',
    reason: 'Release row/version added.'
  };
  const pageExtract = {
    source_id: CAMERAX_SOURCE.source_id,
    url: event.canonical_url,
    title: event.title,
    release: 'CameraX 1.5.0',
    sections: [{ heading: 'Camera', sentence: 'CameraX adds a new extension.', hash: 'h-camerax', url: `${event.canonical_url}#camera` }],
    event
  };
  const entries = deepDiveAccrualEntries({
    candidates: [],
    monitorEvents: [event],
    pageExtracts: [pageExtract],
    primaryLaneSources: sourceMap(ITS_SOURCE, CAMERAX_SOURCE)
  });

  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.equal(entry.bucket, 'android_platform_camera_adjacent');
  }
});

// 심층 적립은 선택 기능이다. 모니터가 실패한 날(레지스트리 검증 실패 포함)에 레지스트리를
// 다시 읽어 throw하면, 피드 후보만으로 마무리되던 수집이 통째로 죽는다.
test('모니터 결과가 없으면 레지스트리를 읽지 않고 후보만 적립한다', () => {
  const root = tempRoot('deep-dive-accrual-no-monitor-');
  writeJson(path.join(root, 'state', 'source-monitor-registry.json'), { schemaVersion: 1, sources: 'broken' });

  const result = accrueDeepDiveTopicsFromCollect({
    root,
    date: '2026-08-17',
    candidates: [{
      url: 'https://source.android.com/docs/core/camera/whatever',
      title: 'demoted camera doc',
      relevance_bucket: 'direct_aosp_camera',
      finalSelectionEligibility: 'watchlist',
      publishedAt: '2026-08-14'
    }],
    monitorResult: null
  });

  assert.equal(result.accruedFingerprintCount, 1);
  assert.equal(result.queueSize, 1);
  const queue = loadDeepDiveTopicQueue(root);
  assert.equal(queue.topics[0].evidence[0].origin, 'demoted_candidate');
  assert.ok(fs.existsSync(path.join(root, ...DEEP_DIVE_QUEUE_REL_PATH.split('/'))));
});
