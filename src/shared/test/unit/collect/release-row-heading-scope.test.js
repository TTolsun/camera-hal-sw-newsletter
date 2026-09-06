const assert = require('node:assert/strict');
const test = require('node:test');

const { observationFromHtml, candidateFromEvent } = require('../../../collect/source-monitor');

const SOURCE = Object.freeze({
  source_id: 'aosp-camera-its-release-notes',
  root_url: 'https://source.android.com/docs/compatibility/cts/camera-its',
  selection_lane: 'primary_camera_stack',
  expected_categories: ['compatibility', 'camera-hal']
});

function observe(html, url = SOURCE.root_url) {
  return observationFromHtml({ source: SOURCE, url, html, status: 200, headers: {} });
}

function page(body) {
  return `<html><body><main>${body}</main></body></html>`;
}

test('규격 절 번호를 인용한 문단은 릴리스 행이 아니다', () => {
  // 실측: camera-its-tests 페이지에서 테스트 설명 5개가 CDD 절 번호를 버전으로 달고
  // 릴리스 행이 됐다. 그 값은 release_row_version 으로 올라가고, date_extractors 의
  // release_row_date 자리(신뢰도 95)까지 이어진다.
  const observation = observe(page(`
    <h3 id="test_flip_mirror">test_flip_mirror</h3>
    <p>Tests if the image is properly oriented as per 7.5.2 Front-Facing Camera in the CDD.</p>
    <h3 id="test_sensor_fusion">test_sensor_fusion</h3>
    <p>Tests the timestamp difference as specified in section 2.2.7.2 Camera in the CDD.</p>
  `));

  assert.equal(observation.release_rows.length, 0);
  assert.equal(observation.release_row_version, '');
});

test('제목이 버전을 말하는 절은 릴리스 행으로 남는다', () => {
  const observation = observe(page(`
    <h3 id="1.7.0-alpha02">Version 1.7.0-alpha02</h3>
    <p>Released July 01, 2026. CameraXViewfinder now supports pinch-to-zoom.</p>
  `), 'https://developer.android.com/jetpack/androidx/releases/camera');

  assert.equal(observation.release_rows.length, 1);
  assert.equal(observation.release_row_version, '1.7.0-alpha02');
  assert.match(observation.release_row_extract[0].summary, /pinch-to-zoom/);
});

test('증거 없는 후보의 behavior_change 는 수집기 템플릿 문장으로 표식된다', () => {
  // "New page under monitored source." 는 출처가 말한 사실이 아니다. 표식이 없으면
  // collect-news-candidates 가 이 문장을 동작 변경 근거로 세어, 내용이 빈 후보가 자격을
  // 통과한다.
  const candidate = candidateFromEvent({
    candidate_allowed: true,
    main_article_allowed: false,
    url: 'https://source.android.com/docs/compatibility/cts/camera-its',
    title: 'Camera ITS overview',
    event_type: 'page_added',
    reason: 'New page under monitored source.',
    release_note_evidence: null,
    effective_date: '2026-07-23',
    date_source: 'visible_last_updated',
    date_confidence: 90,
    detected_at: '2026-08-17T00:00:00.000Z'
  }, SOURCE);

  assert.equal(candidate.behavior_change, 'New page under monitored source.');
  assert.equal(candidate.collector_template_sentence, 'New page under monitored source.');
});

test('실제 증거가 있으면 템플릿 표식을 달지 않는다', () => {
  const candidate = candidateFromEvent({
    candidate_allowed: true,
    main_article_allowed: true,
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    title: 'CameraX release notes',
    event_type: 'release_row_added',
    reason: 'Release row/version added.',
    release_note_evidence: {
      version_or_release: '1.7.0-alpha02',
      api_or_component: '',
      behavior_change: 'Version 1.7.0-alpha02: CameraXViewfinder now supports pinch-to-zoom.',
      changed_section_headings: ['Version 1.7.0-alpha02'],
      section_links: []
    },
    effective_date: '2026-07-01',
    date_source: 'release_row_date',
    date_confidence: 95,
    detected_at: '2026-07-06T00:00:00.000Z'
  }, SOURCE);

  assert.match(candidate.behavior_change, /pinch-to-zoom/);
  assert.equal(candidate.collector_template_sentence, undefined);
});
