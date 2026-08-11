const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SECTION_LIMIT,
  cameraItsReleaseNoteEvidence,
  cameraItsReleaseNoteExtract,
  cameraItsReleaseNoteFingerprint
} = require('../../../collect/camera-its-release-note-evidence');
const {
  buildNextSnapshotWrites,
  candidateFromEvent,
  classifyObservation,
  observationFromHtml
} = require('../../../collect/source-monitor');
const { normalizeOutgoingLinks } = require('../../../collect/outgoing-links');
const { readTextFixture } = require('../../helpers/fixture-loader');

const PAGE_URL = 'https://source.android.com/docs/compatibility/cts/its-release-notes-17';
const LANDING_URL = 'https://source.android.com/docs/compatibility/cts/camera-its';

function releaseNotesHtml() {
  return readTextFixture('source-html/aosp-camera-its-release-notes-17.html');
}

function extract(html = releaseNotesHtml(), url = PAGE_URL) {
  return cameraItsReleaseNoteExtract(html, url);
}

function fingerprintOf(html = releaseNotesHtml()) {
  return cameraItsReleaseNoteFingerprint(extract(html));
}

// 한 섹션의 본문만 바꿔 "이번 주에 그 섹션이 바뀐" 상황을 만든다.
function withChangedNewTests(html = releaseNotesHtml()) {
  return html.replace(
    'It also adds test_jca_jpegr_ip and test_display_p3.',
    'It also adds test_jca_jpegr_ip, test_display_p3, and test_preview_stabilization_jca.'
  );
}

test('extracts the release name and the release-note sections', () => {
  const result = extract();

  assert.match(result.release, /Android 17 Camera Image Test Suite/);
  assert.ok(result.sections.length > 0);
  assert.ok(result.sections.every(section => section.heading && section.hash));
});

// devsite는 모든 문서 제목 옆에 안내 문구를 붙이고 제목에 non-breaking space를 섞는다.
test('drops the page-title heading and the devsite collections boilerplate', () => {
  const headings = extract().sections.map(section => section.heading).join(' ');

  assert.doesNotMatch(headings, /Stay organized with collections/);
  assert.doesNotMatch(headings, /^Android 17 Camera Image Test Suite release notes$/);
  assert.doesNotMatch(headings, /&nbsp;/);
});

// devsite 페이지에는 좌측 book nav와 사이드바 heading이 함께 있다. 본문 컨테이너로 좁히지
// 않으면 내비게이션 문구가 상한을 선점해 "이번에 바뀐 내용"으로 실린다.
test('reads headings from the article body, not the surrounding navigation', () => {
  const headings = extract().sections.map(section => section.heading);

  assert.ok(headings.includes('Separated test activities'));
  assert.ok(!headings.some(heading => /navigation entry/i.test(heading)));
});

test('keeps every release-note section of a document longer than the old cap', () => {
  const result = extract();

  // fixture 섹션 수는 8을 넘는다 — 예전 상한(8)으로 되돌리면 이 단언이 깨진다.
  assert.ok(result.sections.length > 8, `sections=${result.sections.length}`);
  assert.ok(result.sections.length <= SECTION_LIMIT);
  assert.ok(result.sections.some(section => section.heading === 'Aggregated result submission for build approvals'));
});

// 상한을 넘는 문장은 자르지 않고 버린다. 중간에서 자르면 조건이나 부정이 잘린 부분 문장이
// 그대로 증거가 되어 기사에 실린다(짓느니 빠뜨린다).
test('drops an over-long sentence instead of truncating it', () => {
  const longSentence = `Android 17 introduces ${'a very detailed certification requirement '.repeat(8)}for camera testing.`;
  const html = releaseNotesHtml().replace(
    'Android 17 introduces the test status PASS* to detect marginally passing tests.',
    longSentence
  );

  const evidence = cameraItsReleaseNoteEvidence(extract(html), fingerprintOf());

  assert.match(evidence.behavior_change, /New test status: PASS\*/);
  assert.doesNotMatch(evidence.behavior_change, /…/, '문장을 잘라 넣지 않는다');
  assert.doesNotMatch(evidence.behavior_change, /a very detailed certification requirement/);
});

test('prefers the document title over stale release titles left in navigation', () => {
  const html = releaseNotesHtml()
    .replace('<article>', '<article><nav><h2 id="nav-old">Android 12 Camera Image Test Suite release notes</h2></nav>');

  assert.match(extract(html).release, /Android 17 Camera Image Test Suite/);
});

test('returns null when the exact release title is absent, even with a bare Android version', () => {
  const html = [
    '<html><head><title>Camera ITS release notes</title></head><body><article>',
    '<p>Android 16 devices must run the Camera ITS suite.</p>',
    '<h2 id="new-tests">New tests</h2><p>Android 16 adds a camera test scene.</p>',
    '</article></body></html>'
  ].join('');

  assert.equal(cameraItsReleaseNoteExtract(html, PAGE_URL), null);
});

// 자격은 host + 경로로 정한다. 본문에 'Camera ITS'가 있는지로 판정하면 같은 소스의 랜딩
// 페이지나 Camera ITS를 언급하는 다른 감시 문서까지 "릴리스 노트"라고 주장하게 된다.
test('does not claim release notes for the Camera ITS landing page', () => {
  assert.equal(cameraItsReleaseNoteExtract(releaseNotesHtml(), LANDING_URL), null);
});

test('does not claim release notes for a look-alike path on another host', () => {
  const lookAlike = 'https://example.com/docs/compatibility/cts/its-release-notes-17';

  assert.equal(cameraItsReleaseNoteExtract(releaseNotesHtml(), lookAlike), null);
});

test('does not touch another monitored page that merely mentions Camera ITS', () => {
  const html = [
    '<html><head><title>Camera</title></head><body><article>',
    '<h2 id="overview">Camera HAL versions</h2>',
    '<p>Devices must pass the Camera ITS tests for every advertised camera feature.</p>',
    '</article></body></html>'
  ].join('');

  assert.equal(cameraItsReleaseNoteExtract(html, 'https://source.android.com/docs/core/camera'), null);
});

// 증거는 "무엇이 바뀌었나"다. 문서 전체를 실으면 이번 주에 바뀌지 않은 섹션까지 변화로 발행된다.
test('reports only the sections that changed since the previous observation', () => {
  const evidence = cameraItsReleaseNoteEvidence(extract(withChangedNewTests()), fingerprintOf());

  assert.deepEqual(evidence.changed_section_headings, ['New tests']);
  assert.match(evidence.behavior_change, /^New tests: /);
  assert.doesNotMatch(evidence.behavior_change, /Separated test activities/);
  assert.equal(evidence.api_or_component, 'Camera ITS / CTS Verifier');
});

test('returns null when no section changed', () => {
  assert.equal(cameraItsReleaseNoteEvidence(extract(), fingerprintOf()), null);
});

// 최초 관측에는 비교 대상이 없다. 그때 문서 전체를 "이번 변화"로 싣는 것이 과다 주장이다.
test('returns null on the first observation, when there is nothing to compare against', () => {
  assert.equal(cameraItsReleaseNoteEvidence(extract(), []), null);
});

test('emits outgoing-link records built by the canonical builder', () => {
  const evidence = cameraItsReleaseNoteEvidence(extract(withChangedNewTests()), fingerprintOf());

  assert.deepEqual(evidence.section_links, normalizeOutgoingLinks(evidence.section_links));
  for (const link of evidence.section_links) {
    assert.equal(link.url, `${PAGE_URL}#new-tests`);
    assert.equal(link.source_field, 'release_note_section');
    assert.ok(link.evidence_role, 'evidence_role은 정본 빌더가 채운다');
  }
});

// 여기서부터는 모니터 배선. 이 경로가 없으면 위 증거는 후보까지 도달하지 않는다.
const SOURCE = {
  source_id: 'aosp-camera-its-release-notes',
  root_url: PAGE_URL,
  expected_categories: ['compatibility', 'camera-hal'],
  source_priority: 'high',
  main_article_allowed: true,
  date_extractors: ['visible_last_updated']
};

function observe(html = releaseNotesHtml(), url = PAGE_URL) {
  return observationFromHtml({ source: SOURCE, url, html });
}

function classify(previous, current) {
  return classifyObservation({
    source: SOURCE,
    previous,
    current,
    snapshot: { pages: [], processed_source_event_ids: [], processed_evidence_ids: [] },
    detectedAt: '2026-08-17T00:00:00.000Z'
  });
}

test('the observation carries the section fingerprint for the next run', () => {
  const observation = observe();

  assert.ok(observation.release_note_sections.length > 0);
  assert.ok(observation.release_note_sections.every(section => section.heading && section.hash));
});

test('a content change turns the observation into an event that carries the changed sections', () => {
  const event = classify(observe(), observe(withChangedNewTests()));

  assert.equal(event.content_changed, true);
  assert.deepEqual(event.release_note_evidence.changed_section_headings, ['New tests']);
});

// anchor_added·page_added는 candidate_allowed이지만 본문 변경이 아니다.
test('an event without a body change carries no release-note evidence', () => {
  const unchanged = classify(observe(), observe());

  assert.equal(unchanged.content_changed, false);
  assert.equal(unchanged.release_note_evidence, null);
});

test('a first observation produces no release-note evidence', () => {
  const firstRun = classify(null, observe());

  assert.equal(firstRun.event_type, 'page_added');
  assert.equal(firstRun.release_note_evidence, null);
});

test('the changed sections reach the candidate instead of the placeholder text', () => {
  const event = classify(observe(), observe(withChangedNewTests()));
  const candidate = candidateFromEvent(event, SOURCE);

  assert.equal(candidate.api_or_component, 'Camera ITS / CTS Verifier');
  assert.match(candidate.behavior_change, /^New tests: /);
  assert.equal(candidate.relevance_bucket, 'direct_aosp_camera');
  assert.ok(candidate.outgoing_links.length > 0);
});

test('other monitored sources keep the placeholder evidence fields', () => {
  const event = classify(observe(), observe(withChangedNewTests()));
  const candidate = candidateFromEvent({ ...event, release_note_evidence: null }, SOURCE);

  assert.equal(candidate.api_or_component, 'Camera source snapshot change');
  assert.equal(candidate.behavior_change, event.reason);
  assert.equal('outgoing_links' in candidate, false, '증거가 없으면 필드 자체를 만들지 않는다');
});

// 파생 추출 결과가 영속 아티팩트로 새면 스냅샷과 커밋되는 이벤트 파일이 매주 부푼다.
test('the derived extract never reaches the snapshot or the committed event values', () => {
  const current = observe(withChangedNewTests());
  const event = classify(observe(), current);
  const snapshotWrite = buildNextSnapshotWrites(
    SOURCE,
    { pages: [], processed_source_event_ids: [], processed_evidence_ids: [] },
    [current],
    [event],
    '2026-08-17T00:00:00.000Z'
  );

  assert.equal('release_note_extract' in event.current_values, false);
  assert.equal('release_note_extract' in snapshotWrite.snapshot.pages[0], false);
  // 다음 실행의 비교에 필요한 지문은 남아야 한다.
  assert.ok(snapshotWrite.snapshot.pages[0].release_note_sections.length > 0);
});
