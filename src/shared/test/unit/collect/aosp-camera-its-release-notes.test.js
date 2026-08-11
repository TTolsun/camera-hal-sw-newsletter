const assert = require('node:assert/strict');
const test = require('node:test');

const { parseSourceSpecificItems } = require('../../../collect/source-item-parsers');
const { readTextFixture } = require('../../helpers/fixture-loader');

const PAGE_URL = 'https://source.android.com/docs/compatibility/cts/its-release-notes-17';

function source(overrides = {}) {
  return {
    id: 'aosp-camera-its-release-notes',
    name: 'AOSP Camera ITS Release Notes',
    url: PAGE_URL,
    sourceUrl: PAGE_URL,
    section: 'Android / AOSP / Camera',
    ...overrides
  };
}

function releaseNotesHtml() {
  return readTextFixture('source-html/aosp-camera-its-release-notes-17.html');
}

// 이 페이지는 소스 모니터만 보고 있었고, 모니터는 첫 발견을 page_added(설계상 main 불가)로,
// 이후 갱신을 정규화 본문이 같으면 metadata_only_changed로 처리해 내용이 한 번도 후보가 되지
// 못했다(실측 2026-08-11). 페이지를 dated 후보 1건으로 만드는 계약을 고정한다.
test('emits exactly one dated candidate for the release notes page', () => {
  const items = parseSourceSpecificItems(releaseNotesHtml(), source());

  assert.equal(items.length, 1, '섹션마다 쪼개지 않는다 — 아는 사실은 "이 문서가 그 날 갱신됐다" 하나뿐이다');
  const [item] = items;
  assert.equal(item.publishedAt, '2026-08-06', '푸터의 Last updated 날짜를 쓴다');
  assert.equal(item.datePrecision, 'day');
  assert.equal(item.url, PAGE_URL);
  assert.equal(item.sourceKind, 'release_note_item');
  assert.equal(item.api_or_component, 'Camera ITS / CTS Verifier');
  assert.match(item.version_or_release, /Android 17 Camera Image Test Suite release notes/);
});

test('carries the concrete Camera HAL certification changes as evidence', () => {
  const [item] = parseSourceSpecificItems(releaseNotesHtml(), source());

  assert.match(item.behavior_change, /New tests/);
  assert.match(item.behavior_change, /test_tonemap_sequence/);
  assert.match(item.behavior_change, /Separated test activities/);
  assert.match(item.behavior_change, /two CTS Verifier activities/);
  assert.match(item.behavior_change, /PASS\*/, '판정 상태 신설은 인증 담당자에게 가장 큰 변화다');
  assert.match(item.behavior_change, /Gen2 rig/);
});

// devsite는 모든 문서 제목 옆에 안내 문구를 붙이고 제목에 &nbsp;를 섞는다. 둘 다 릴리스 내용이
// 아니므로 제목에도 증거에도 남으면 안 된다.
test('strips devsite title entities and the collections boilerplate', () => {
  const [item] = parseSourceSpecificItems(releaseNotesHtml(), source());

  assert.equal(item.title, 'Android 17 Camera Image Test Suite release notes');
  assert.doesNotMatch(item.title, /&nbsp;| /);
  assert.doesNotMatch(item.behavior_change, /Stay organized with collections/);
  assert.doesNotMatch(
    item.behavior_change,
    /^Android 17 Camera Image Test Suite release notes:/,
    '문서 제목(h1)은 섹션이 아니라 페이지 이름이다'
  );
});

test('links each release-note section anchor and skips the devsite footer headings', () => {
  const [item] = parseSourceSpecificItems(releaseNotesHtml(), source());

  assert.ok(item.outgoing_links.includes(`${PAGE_URL}#new-tests`));
  assert.ok(item.outgoing_links.includes(`${PAGE_URL}#separated-test-activities`));
  assert.ok(item.outgoing_links.includes(`${PAGE_URL}#status-pass-star`));
  assert.ok(
    item.outgoing_links.every(link => link.startsWith(`${PAGE_URL}#`)),
    '공통 푸터(Build/Connect/Get help)는 릴리스 섹션이 아니다'
  );
  assert.doesNotMatch(item.behavior_change, /\bBuild: |\bConnect: |\bGet help: /);
});

// 날짜가 없으면 추정하지 않는다. dated 증거 없는 후보는 main이 될 수 없고, 날짜를 지어내면
// 선정 창이 사실과 어긋난다.
test('returns nothing when the page has no Last updated footer', () => {
  const undated = releaseNotesHtml().replace('Last updated 2026-08-06 UTC.', 'Coming soon');

  assert.deepEqual(parseSourceSpecificItems(undated, source()), []);
});

test('returns nothing for a page that is not Camera ITS', () => {
  const unrelated = [
    '<html><head><title>Bluetooth HCI requirements</title></head><body>',
    '<h2 id="version">Versions</h2><p>Updated test coverage for the audio stack.</p>',
    '<div>Last updated 2026-08-06 UTC.</div>',
    '</body></html>'
  ].join('');

  assert.deepEqual(parseSourceSpecificItems(unrelated, source()), []);
});
