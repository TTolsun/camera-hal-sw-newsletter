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

// loadRegistry를 거치는 테스트용. 위 축약 소스에 검증기가 요구하는 나머지 필드를 채운다.
function registrySource(source, rootUrl) {
  return {
    ...source,
    root_url: rootUrl,
    url_patterns: [`${rootUrl}**`],
    seed_urls: [rootUrl],
    source_priority: 'high',
    date_extractors: ['visible_last_updated'],
    content_hash_enabled: true,
    main_article_allowed: false,
    fallback_only: false,
    max_pages_per_run: 5,
    fetch_timeout_ms: 8000
  };
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

// 적립원 3개 중 2개는 runSourceMonitor 반환에서 꺼낸다. 그 배선을 손으로 만든 인자 대신
// 실제 반환 모양(report.events + pageExtracts)으로 한 번은 통과시켜야, 모니터 반환 키가
// 바뀌었을 때 적립이 조용히 0이 되는 드리프트를 잡는다.
test('모니터 반환 모양 그대로 monitor_event·document_section이 쌓인다', () => {
  const root = tempRoot('deep-dive-accrual-monitor-shape-');
  // loadRegistry는 레지스트리를 검증한다. 축약한 소스 객체를 쓰면 배선이 아니라 검증에서 죽는다.
  writeJson(path.join(root, 'state', 'source-monitor-registry.json'), {
    schemaVersion: 1,
    sources: [registrySource(ITS_SOURCE, 'https://source.android.com/docs/compatibility/cts/camera-its')]
  });

  const event = {
    source_id: ITS_SOURCE.source_id,
    event_type: 'last_updated_changed',
    canonical_url: 'https://source.android.com/docs/compatibility/cts/its-release-notes-17',
    title: 'Android 17 Camera ITS release notes',
    reason: 'Visible last updated changed.',
    effective_date: '2026-08-06',
    date_source: 'visible_last_updated',
    date_confidence: 85,
    candidate_allowed: true,
    evidence_id: 'ev-its-1'
  };
  const monitorResult = {
    report: { events: [event] },
    pageExtracts: [{
      source_id: ITS_SOURCE.source_id,
      url: event.canonical_url,
      title: event.title,
      release: 'Android 17 Camera Image Test Suite',
      sections: [{
        heading: 'PASS* status',
        sentence: 'PASS* marks near-threshold results.',
        hash: 'h-pass-star',
        url: `${event.canonical_url}#pass-star`
      }],
      event
    }]
  };

  const result = accrueDeepDiveTopicsFromCollect({
    root,
    date: '2026-08-17',
    candidates: [],
    monitorResult
  });

  assert.equal(result.accruedFingerprintCount, 2);
  const queue = loadDeepDiveTopicQueue(root);
  const origins = queue.topics.flatMap(topic => topic.evidence.map(evidence => evidence.origin)).sort();
  assert.deepEqual(origins, ['document_section', 'monitor_event']);
  for (const topic of queue.topics) {
    assert.equal(topic.bucket, 'direct_aosp_camera');
    assert.equal(topic.evidence[0].date_source, 'visible_last_updated');
    assert.equal(topic.evidence[0].date_confidence, 85);
  }
});

// 모니터 후보는 candidates 배열에도 실려 collect로 돌아온다. 그 후보를 여기서 또 받으면
// 한 사건이 두 fingerprint로 쌓여, 선정 2순위 키인 distinct fingerprint 수가 부풀어
// 모니터 유래 주제가 실제보다 앞선다.
test('모니터 유래 후보는 demoted_candidate로 이중 적립되지 않는다', () => {
  const monitorUrl = 'https://source.android.com/docs/compatibility/cts/its-release-notes-17';
  const entries = deepDiveAccrualEntries({
    candidates: [{
      url: monitorUrl,
      title: 'Android 17 Camera ITS release notes',
      origin: 'source_monitor',
      source_kind: 'source_change_event',
      relevance_bucket: 'direct_aosp_camera',
      finalSelectionEligibility: 'watchlist'
    }],
    monitorEvents: [],
    pageExtracts: [],
    primaryLaneSources: sourceMap(ITS_SOURCE)
  });

  assert.deepEqual(entries, []);
});

// 날짜 신뢰도는 date-signals 표가 정본이다. 리터럴 85를 박으면 main 자격 임계값과 같은
// 신뢰도가 근거 없이 커밋된 state에 굳는다.
test('후보 적립은 날짜 신뢰도를 지어내지 않는다', () => {
  const entries = deepDiveAccrualEntries({
    candidates: [{
      url: 'https://example.com/camera-post',
      title: 'camera post',
      relevance_bucket: 'android_platform_camera_adjacent',
      finalSelectionEligibility: 'watchlist',
      publishedAt: '2026-08-14'
    }],
    monitorEvents: [],
    pageExtracts: [],
    primaryLaneSources: sourceMap()
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].evidence[0].effective_date, '2026-08-14');
  assert.equal(entries[0].evidence[0].date_source, 'candidate_published_at');
  assert.equal(entries[0].evidence[0].date_confidence, 0);
});
