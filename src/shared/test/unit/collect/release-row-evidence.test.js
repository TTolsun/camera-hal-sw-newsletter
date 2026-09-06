const assert = require('node:assert/strict');
const test = require('node:test');

const {
  candidateFromEvent,
  classifyObservation,
  observationFromHtml
} = require('../../../collect/source-monitor');

// CameraX 릴리스 노트처럼 섹션 추출기가 잡지 못하는 문서를 흉내 낸다.
// 실측 스냅샷에서 이 페이지는 release_note_sections 0개, release_rows 202개였다.
const PAGE_URL = 'https://developer.android.com/jetpack/androidx/releases/camera';

const SOURCE = Object.freeze({
  source_id: 'androidx-camerax-release-notes',
  root_url: PAGE_URL,
  selection_lane: 'primary_camera_stack',
  date_extractors: ['release_row_date', 'visible_last_updated']
});

function html(rows) {
  const body = rows
    .map(row => `<h3 id="${row.id}">${row.title}</h3><p>${row.body}</p>`)
    .join('\n');
  return `<html><body><main><p>Last updated 2026-07-01 UTC.</p>${body}</main></body></html>`;
}

const BEFORE = [
  { id: '1.7.0-alpha01', title: 'Version 1.7.0-alpha01', body: 'Released March 11, 2026. Exposed the CameraController.setSessionConfig() API.' }
];

const AFTER = [
  { id: '1.7.0-alpha02', title: 'Version 1.7.0-alpha02', body: 'Released July 01, 2026. CameraXViewfinder now supports built-in gestures for pinch-to-zoom and tap-to-focus.' },
  ...BEFORE
];

function observe(rows) {
  return observationFromHtml({ source: SOURCE, url: PAGE_URL, html: html(rows), status: 200, headers: {} });
}

function classify(previous, current) {
  return classifyObservation({
    source: SOURCE,
    previous,
    current,
    snapshot: { processed_source_event_ids: [], processed_evidence_ids: [] },
    detectedAt: '2026-07-06T00:00:00.000Z'
  });
}

test('릴리스 행이 본문 한 문장을 나른다', () => {
  const rows = observe(AFTER).release_row_extract;
  const alpha02 = rows.find(row => row.version === '1.7.0-alpha02');
  assert.match(alpha02.summary, /pinch-to-zoom/);
});

test('요약은 스냅샷에 저장하지 않는다', () => {
  // 행 202개에 문장을 얹으면 스냅샷이 커진다. 지문만 남기고 증거는 이벤트까지만 간다 —
  // release_note_sections / release_note_extract 와 같은 갈래다.
  const observation = observe(AFTER);
  assert.ok(observation.release_rows.every(row => !('summary' in row)));
  assert.ok(observation.release_row_extract.some(row => row.summary));
});

test('새 릴리스 행이 자리표시자 대신 실제 변경을 싣는다', () => {
  // 이 저장소가 고치려는 증상이다. 지금까지 후보 본문이 "Release row/version added." 였다.
  const event = classify(observe(BEFORE), observe(AFTER));
  const candidate = candidateFromEvent(event, SOURCE);

  assert.match(candidate.behavior_change, /pinch-to-zoom/);
  assert.doesNotMatch(candidate.behavior_change, /Release row\/version added/);
  assert.equal(candidate.version_or_release, '1.7.0-alpha02');
  assert.ok(candidate.outgoing_links.length > 0);
});

test('바뀌지 않은 행은 증거에 넣지 않는다', () => {
  // 문서 전체를 실으면 이번 주에 바뀌지 않은 릴리스까지 그 주의 변화로 발행된다.
  const event = classify(observe(BEFORE), observe(AFTER));
  assert.doesNotMatch(event.release_note_evidence.behavior_change, /setSessionConfig/);
});

test('처음 본 페이지에는 행 증거를 싣지 않는다', () => {
  // 처음 본 페이지는 무엇이 바뀌었는지 알 수 없고 무엇이 적혀 있는지만 안다.
  // behavior_change 는 전자를 주장하는 필드다.
  const first = classify(null, observe(AFTER));
  assert.equal(first.event_type, 'page_added');
  assert.equal(first.release_note_evidence, null);
});

test('문장을 못 건지면 제목만으로 증거를 만들지 않는다', () => {
  // 제목만 실으면 자리표시자와 다를 게 없다.
  const before = [{ id: '2.0.0', title: 'Version 2.0.0', body: 'x' }];
  const after = [{ id: '2.0.1', title: 'Version 2.0.1', body: '' }, ...before];
  const event = classify(observe(before), observe(after));
  assert.equal(event.release_note_evidence, null);
});
