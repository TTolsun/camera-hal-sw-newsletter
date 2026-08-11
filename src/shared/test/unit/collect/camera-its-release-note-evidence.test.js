const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SECTION_LIMIT,
  cameraItsReleaseNoteEvidence
} = require('../../../collect/camera-its-release-note-evidence');
const { candidateFromEvent } = require('../../../collect/source-monitor');
const { readTextFixture } = require('../../helpers/fixture-loader');

const PAGE_URL = 'https://source.android.com/docs/compatibility/cts/its-release-notes-17';

function releaseNotesHtml() {
  return readTextFixture('source-html/aosp-camera-its-release-notes-17.html');
}

test('extracts the concrete Camera HAL certification changes', () => {
  const evidence = cameraItsReleaseNoteEvidence(releaseNotesHtml(), PAGE_URL);

  assert.equal(evidence.api_or_component, 'Camera ITS / CTS Verifier');
  assert.match(evidence.version_or_release, /Android 17 Camera Image Test Suite release notes/);
  assert.match(evidence.behavior_change, /New tests: .*test_tonemap_sequence/);
  assert.match(evidence.behavior_change, /Separated test activities: .*two CTS Verifier activities/);
  assert.match(evidence.behavior_change, /PASS\*/, '판정 상태 신설은 인증 담당자에게 가장 큰 변화다');
  assert.match(evidence.behavior_change, /Gen2 rig/);
});

// devsite는 모든 문서 제목 옆에 안내 문구를 붙이고 제목에 non-breaking space를 섞는다.
// 둘 다 릴리스 내용이 아니므로 증거에 남으면 안 된다.
test('drops the page-title heading and the devsite collections boilerplate', () => {
  const evidence = cameraItsReleaseNoteEvidence(releaseNotesHtml(), PAGE_URL);

  assert.doesNotMatch(evidence.behavior_change, /Stay organized with collections/);
  assert.doesNotMatch(
    evidence.behavior_change,
    /^Android 17 Camera Image Test Suite release notes:/,
    '문서 제목(h1)은 섹션이 아니라 페이지 이름이다'
  );
  assert.doesNotMatch(evidence.behavior_change, /&nbsp;/);
});

test('links each release-note section anchor and skips the devsite footer headings', () => {
  const evidence = cameraItsReleaseNoteEvidence(releaseNotesHtml(), PAGE_URL);

  const urls = evidence.section_links.map(link => link.url);
  assert.ok(urls.includes(`${PAGE_URL}#new-tests`));
  assert.ok(urls.includes(`${PAGE_URL}#separated-test-activities`));
  assert.ok(urls.includes(`${PAGE_URL}#status-pass-star`));
  assert.ok(urls.every(url => url.startsWith(`${PAGE_URL}#`)));
  // outgoing-links 계층은 레코드를 받는다. 문자열이면 증거로 보이지만 조용히 버려진다.
  for (const link of evidence.section_links) {
    assert.equal(link.source_field, 'release_note_section');
    assert.ok(link.text);
  }
  assert.doesNotMatch(evidence.behavior_change, /\bBuild: |\bConnect: |\bGet help: /);
});

test('caps the section count and cuts on section boundaries, never mid-sentence', () => {
  const extra = Array.from({ length: 6 }, (unused, index) =>
    `<h2 id="extra-${index}">Extra test scene ${index}</h2><p>Android 17 adds extra scene ${index} for camera coverage.</p>`
  ).join('');
  const html = releaseNotesHtml().replace('<h3>Build</h3>', `${extra}<h3>Build</h3>`);

  const evidence = cameraItsReleaseNoteEvidence(html, PAGE_URL);

  assert.equal(evidence.section_links.length, SECTION_LIMIT);
  assert.doesNotMatch(evidence.behavior_change, /…$/, '섹션 경계에서만 자르므로 문장이 잘리지 않는다');
});

// 자격은 URL로 정한다. 본문에 'Camera ITS'가 있는지로 판정하면 같은 소스의 랜딩 페이지나
// Camera ITS를 언급하는 다른 감시 문서까지 "릴리스 노트"라고 주장하게 된다.
test('does not claim release notes for the Camera ITS landing page', () => {
  const landingUrl = 'https://source.android.com/docs/compatibility/cts/camera-its';

  assert.equal(cameraItsReleaseNoteEvidence(releaseNotesHtml(), landingUrl), null);
});

test('does not touch another monitored page that merely mentions Camera ITS', () => {
  const cameraDocsUrl = 'https://source.android.com/docs/core/camera';
  const html = [
    '<html><head><title>Camera</title></head><body><article>',
    '<h2 id="overview">Camera HAL versions</h2>',
    '<p>Devices must pass the Camera ITS tests for every advertised camera feature.</p>',
    '</article></body></html>'
  ].join('');

  assert.equal(cameraItsReleaseNoteEvidence(html, cameraDocsUrl), null);
});

// devsite 페이지에는 좌측 book nav와 사이드바 heading이 함께 있다. 본문 컨테이너로 좁히지
// 않으면 내비게이션 문구가 상한 8칸을 선점해 "이번에 바뀐 내용"으로 실린다.
test('reads headings from the article body, not the surrounding navigation', () => {
  const nav = Array.from({ length: 9 }, (unused, index) =>
    `<h2 id="nav-${index}">Test navigation entry ${index}</h2><p>Camera scene index ${index}.</p>`
  ).join('');
  const html = releaseNotesHtml()
    .replace('<body>', `<body><nav>${nav}</nav><article>`)
    .replace('</body>', '</article></body>');

  const evidence = cameraItsReleaseNoteEvidence(html, PAGE_URL);

  assert.ok(
    evidence.section_links.every(link => !link.url.includes('#nav-')),
    '내비게이션 heading은 릴리스 섹션이 아니다'
  );
  assert.match(evidence.behavior_change, /Separated test activities/);
});

test('returns null for a page that is not Camera ITS', () => {
  const unrelated = '<html><head><title>Bluetooth HCI requirements</title></head>' +
    '<body><h2 id="version">Versions</h2><p>Updated test coverage for the audio stack.</p></body></html>';

  assert.equal(cameraItsReleaseNoteEvidence(unrelated, PAGE_URL), null);
});

test('returns null when no release-note section is present', () => {
  const sectionless = '<html><head><title>Camera ITS overview</title></head>' +
    '<body><p>Camera ITS is the Image Test Suite.</p><h2 id="contact">Contact</h2><p>Email us.</p></body></html>';

  assert.equal(cameraItsReleaseNoteEvidence(sectionless, PAGE_URL), null);
});

// 이 증거가 실제로 후보까지 실려야 의미가 있다. 자리표시자를 덮어쓰는지 확인한다.
function monitorEvent(overrides = {}) {
  return {
    source_event_id: 'source-event-test',
    evidence_id: 'evidence-test',
    source_id: 'aosp-camera-its-release-notes',
    event_type: 'material_content_changed',
    url: PAGE_URL,
    canonical_url: PAGE_URL,
    title: 'Android 17 Camera Image Test Suite release notes',
    current_values: { source_identity_key: 'key', anchors: [] },
    previous_values: null,
    effective_date: '2026-08-06',
    date_source: 'visible_last_updated',
    date_confidence: 85,
    candidate_allowed: true,
    main_article_allowed: true,
    needs_editor_date_review: false,
    reason: 'Normalized content hash changed.',
    release_row_version: '',
    release_row_anchor: '',
    release_note_evidence: cameraItsReleaseNoteEvidence(releaseNotesHtml(), PAGE_URL),
    ...overrides
  };
}

function monitorSource() {
  return {
    source_id: 'aosp-camera-its-release-notes',
    root_url: PAGE_URL,
    expected_categories: ['compatibility', 'camera-hal'],
    source_priority: 'high',
    main_article_allowed: true
  };
}

test('a content-change candidate carries the parsed evidence instead of placeholders', () => {
  const candidate = candidateFromEvent(monitorEvent(), monitorSource());

  assert.equal(candidate.api_or_component, 'Camera ITS / CTS Verifier');
  assert.match(candidate.behavior_change, /Separated test activities/);
  assert.match(candidate.version_or_release, /Android 17 Camera Image Test Suite release notes/);
  assert.equal(candidate.relevance_bucket, 'direct_aosp_camera');
  assert.ok(candidate.outgoing_links.length > 0);
  assert.ok(candidate.outgoing_links.every(link => typeof link.url === 'string' && link.url));
});

// 증거가 없는 소스는 기존 동작 그대로여야 한다.
test('other monitored sources keep the placeholder evidence fields', () => {
  const candidate = candidateFromEvent(
    monitorEvent({ release_note_evidence: null }),
    monitorSource()
  );

  assert.equal(candidate.api_or_component, 'Camera source snapshot change');
  assert.equal(candidate.behavior_change, 'Normalized content hash changed.');
  assert.equal(candidate.outgoing_links, undefined, '증거가 없으면 필드 자체를 만들지 않는다');
});
