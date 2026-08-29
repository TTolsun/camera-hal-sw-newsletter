const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveRaspberryPiLibcameraReleaseItems
} = require('../../../collect/raspberrypi-libcamera-releases');

const RELEASES_URL = 'https://github.com/raspberrypi/libcamera/releases';

function source(overrides = {}) {
  return {
    id: 'raspberrypi-libcamera-releases',
    name: 'Raspberry Pi libcamera Releases',
    url: RELEASES_URL,
    sourceUrl: RELEASES_URL,
    rssUrl: 'https://github.com/raspberrypi/libcamera/releases.atom',
    ...overrides
  };
}

// Representative GitHub releases.atom: real release + packaging/branch tags to drop.
function atom() {
  const entry = (tag, updated) => [
    '<entry>',
    `<id>tag:github.com,2008:Repository/1/${tag}</id>`,
    `<updated>${updated}</updated>`,
    `<link rel="alternate" type="text/html" href="https://github.com/raspberrypi/libcamera/releases/tag/${encodeURIComponent(tag)}"/>`,
    `<title>${tag}</title>`,
    '<content type="html">release notes</content>',
    '</entry>'
  ].join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    entry('v0.7.1+rpt20260609', '2026-06-09T07:36:01Z'),
    entry('pios/0.7.1+rpt20260429-1', '2026-05-22T10:41:17Z'),
    entry('upstream/0.7.1+rpt20260429', '2026-05-01T18:50:10Z'),
    entry('v0.7.1+rpt20260429', '2026-05-01T06:38:26Z'),
    entry('libcamera v0.7.1', '2026-04-28T19:14:11Z'),
    '</feed>'
  ].join('');
}

test('parses release entries into canonical dated candidates', () => {
  const items = resolveRaspberryPiLibcameraReleaseItems(atom(), source());

  const first = items.find(item => /v0\.7\.1\+rpt20260609/.test(item.version_or_release));
  assert.ok(first, 'the latest downstream release is present');
  assert.equal(first.sourceKind, 'release_note_item');
  assert.equal(first.version_or_release, 'v0.7.1+rpt20260609');
  assert.equal(first.publishedAt, '2026-06-09');
  assert.match(first.title, /Raspberry Pi libcamera Releases - v0\.7\.1\+rpt20260609/);
  assert.match(first.url, /releases\/tag\/v0\.7\.1(%2B|\+)rpt20260609/);
  assert.match(first.api_or_component, /libcamera/i);
  assert.equal(first.relevanceBucketHint, 'camera_driver_image_pipeline');
});

test('drops pios/ and upstream/ packaging tags, keeps upstream and downstream releases', () => {
  const titles = resolveRaspberryPiLibcameraReleaseItems(atom(), source())
    .map(item => item.version_or_release);

  assert.ok(titles.includes('v0.7.1+rpt20260609'));
  assert.ok(titles.includes('v0.7.1+rpt20260429'));
  assert.ok(titles.includes('libcamera v0.7.1'));
  assert.equal(titles.some(tag => /^pios\//.test(tag)), false);
  assert.equal(titles.some(tag => /^upstream\//.test(tag)), false);
});

// GitHub은 릴리스 본문을 HTML로 escape해 <content type="html">에 싣는다. 그 안에 릴리스가
// 실제로 무엇을 바꿨는지가 들어 있고, 태그 이름만으로는 알 수 없다.
function atomWithReleaseBody(body) {
  return [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry>',
    '<updated>2026-08-17T10:00:00Z</updated>',
    '<link rel="alternate" type="text/html" href="https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2%2Brpt20260817"/>',
    '<title>v0.7.2+rpt20260817</title>',
    `<content type="html">${body}</content>`,
    '</entry>',
    '</feed>'
  ].join('');
}

test('uses the release body as evidence instead of a tag-name template', () => {
  const body = '&lt;p&gt;Revert &quot;ipa: rpi: imx296: Enable embedded data&quot;&lt;/p&gt; '
    + '&lt;p&gt;Right now &lt;br /&gt;embedded data with the imx296 cannot be negotiated with the CFE.&lt;/p&gt;';
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody(body), source());

  assert.match(item.summary, /Revert "ipa: rpi: imx296: Enable embedded data"/);
  assert.match(item.summary, /embedded data with the imx296 cannot be negotiated with the CFE/);
  // 태그 이름만 되뇌는 템플릿 문장이 남아 있으면 근거가 아니라 자기 참조다.
  assert.doesNotMatch(item.summary, /Raspberry Pi downstream libcamera/);
  assert.equal(item.summary.includes('<'), false, 'HTML 태그가 남으면 안 된다');
});

// behavior_change는 collect-news-candidates의 자격 판정 입력이라 어휘 패턴으로 검사된다.
// 본문을 여기까지 실으면 이 릴리스처럼 그 어휘가 없는 본문에서 자격이 조용히 사라진다.
test('keeps behavior_change on the release sentence so eligibility does not shift', () => {
  const body = '&lt;p&gt;Revert &quot;ipa: rpi: imx296: Enable embedded data&quot;&lt;/p&gt;';
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody(body), source());

  // 값 자체를 고정한다. 판정 쪽 어휘 패턴을 여기서 복제하면 그 패턴이 바뀔 때 두 곳이 어긋난다 —
  // 자격 판정의 정본은 collect-news-candidates.js의 BEHAVIOR_CHANGE_PATTERN이다.
  assert.equal(item.behavior_change, 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).');
  assert.notEqual(item.behavior_change, item.summary);
});

// 본문의 리터럴 꺾쇠(이메일·include 경로)가 태그로 오인돼 사라지면 근거가 조용히 준다.
test('keeps literal angle-bracket text in the body', () => {
  const body = '&lt;p&gt;Signed-off-by: Naushir Patuck &amp;lt;naush@raspberrypi.com&amp;gt;&lt;/p&gt;';
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody(body), source());
  assert.match(item.summary, /Signed-off-by: Naushir Patuck <naush@raspberrypi\.com>/);
});

// 태그를 빈 문자열로 지우면 인접 단어가 붙어 근거 텍스트가 망가진다.
test('replaces tags with a space so adjacent words do not merge', () => {
  const body = '&lt;p&gt;Right now&lt;br /&gt;embedded data&lt;/p&gt;';
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody(body), source());
  assert.match(item.summary, /Right now embedded data/);
});

test('falls back to the tag-name template when the release body is empty or absent', () => {
  const [blank] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody('   '), source());
  assert.equal(blank.summary, 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).');
  assert.equal(blank.behavior_change, blank.summary);

  const noContent = atomWithReleaseBody('').replace('<content type="html"></content>', '');
  // replace가 헬퍼 포맷 변경으로 조용히 no-op이 되면 이 테스트는 빈 본문 경로를 다시 도는 셈이라
  // <content> 부재 분기를 더 이상 검증하지 못한다. 그래서 입력을 먼저 확인한다.
  assert.equal(noContent.includes('<content'), false, '<content> 요소가 실제로 빠져야 한다');
  const [missing] = resolveRaspberryPiLibcameraReleaseItems(noContent, source());
  assert.equal(missing.summary, 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).');
});

// 라이브 실측: 본문 없이 태그만 올린 릴리스에 GitHub은 "No content." 리터럴을 싣는다.
// 빈 문자열이 아니라서 그대로 두면 근거 유무 검사를 통과하면서 아무것도 말하지 않는다.
test('treats the GitHub "No content." placeholder as an empty body', () => {
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody('No content.'), source());
  assert.equal(item.summary, 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).');
  assert.equal(item.behavior_change, item.summary);
});

test('caps a long release body at the collector summary limit', () => {
  const body = `&lt;p&gt;${'x'.repeat(900)}&lt;/p&gt;`;
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody(body), source());
  assert.equal(item.summary.length, 500);
});

test('returns empty for empty or feed-with-no-entries input', () => {
  assert.deepEqual(resolveRaspberryPiLibcameraReleaseItems('', source()), []);
  assert.deepEqual(
    resolveRaspberryPiLibcameraReleaseItems('<feed xmlns="http://www.w3.org/2005/Atom"></feed>', source()),
    []
  );
});

test('skips entries missing a link or date', () => {
  const broken = [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry><title>v9.9.9+rpt20260101</title></entry>',
    '</feed>'
  ].join('');
  assert.deepEqual(resolveRaspberryPiLibcameraReleaseItems(broken, source()), []);
});
