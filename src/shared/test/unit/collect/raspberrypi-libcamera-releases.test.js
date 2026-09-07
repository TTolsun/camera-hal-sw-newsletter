const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveRaspberryPiLibcameraReleaseItems
} = require('../../../collect/raspberrypi-libcamera-releases');
const { normalizeCandidate } = require('../../../cli/collect-news-candidates');

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

// behavior_change는 collect-news-candidates의 자격 판정 입력이면서 article-capsules의 what_changed
// 이자 evidence 식별 칸이다. 그 두 번째 역할 때문에 본문을 싣는다(#976의 마지막 결정 항목) —
// 릴리스 문장을 싣던 동안 기사 근거의 첫 칸이 태그 이름을 되뇌는 자기참조 문장이었다.
// 자격 판정은 이 변경으로 움직이지 않는다(커밋 후보 9건 전수 재판정에서 전후 동일).
test('carries the release body in behavior_change so the capsule evidence names the change', () => {
  const body = '&lt;p&gt;Revert &quot;ipa: rpi: imx296: Enable embedded data&quot;&lt;/p&gt;';
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody(body), source());

  // 값 자체를 고정한다. 판정 쪽 어휘 패턴을 여기서 복제하면 그 패턴이 바뀔 때 두 곳이 어긋난다 —
  // 자격 판정의 정본은 collect-news-candidates.js의 BEHAVIOR_CHANGE_PATTERN이다.
  assert.equal(item.behavior_change, 'Revert "ipa: rpi: imx296: Enable embedded data"');
  assert.equal(item.behavior_change, item.summary, '본문이 있으면 두 칸이 같은 문장이다');
});

// 본문이 없으면 이 필드는 종전처럼 템플릿이고, 표식이 그것을 근거에서 걸러 낸다.
test('falls back to the release sentence in behavior_change when there is no body', () => {
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody('No content.'), source());

  assert.equal(item.behavior_change, 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).');
  assert.equal(item.behavior_change, item.collector_template_sentence);
});

// 이 모듈이 지키는 경계 계약이다: 리터럴 꺾쇠(이메일·include 경로)를 태그로 오인해 지운 채 넘기지
// 않는다. 최종 산출물 보장은 아니다 — 하류 normalizeCandidate의 decode()가 다시 지운다.
test('keeps literal angle-bracket text when handing the body downstream', () => {
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

// #976: 이 문장은 출처 본문이 아니라 수집기가 만든 문장이라는 표식이다. 판정 쪽이 이 표식을 보고
// 동작 변경 근거에서 제외한다. 본문이 없으면 behavior_change와 summary가 둘 다 이 문장이 되므로,
// 표식은 문장 텍스트 자체로 남겨 두 경로를 함께 가리킨다.
test('marks the tag-name template sentence so the evidence gate can tell it apart', () => {
  const withBody = resolveRaspberryPiLibcameraReleaseItems(
    atomWithReleaseBody('&lt;p&gt;Revert &quot;ipa: rpi: imx296: Enable embedded data&quot;&lt;/p&gt;'),
    source()
  )[0];
  // 표식은 본문 유무와 무관하게 언제나 템플릿 문장이다. 본문이 있으면 다른 두 칸이 본문을
  // 나르므로 표식만 이 문장으로 남는다.
  assert.equal(
    withBody.collector_template_sentence,
    'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).'
  );
  assert.notEqual(withBody.behavior_change, withBody.collector_template_sentence);
  assert.notEqual(withBody.summary, withBody.collector_template_sentence);

  const withoutBody = resolveRaspberryPiLibcameraReleaseItems(
    atomWithReleaseBody('No content.'),
    source()
  )[0];
  // 본문이 없으면 summary까지 같은 템플릿 문장이라, 남는 근거 문장이 없다.
  assert.equal(withoutBody.summary, withoutBody.collector_template_sentence);
});

// 표식이 normalizeCandidate의 field whitelist를 통과하지 못하면 candidates.json에 남지 않는다.
// 그러면 산출물만 보고는 왜 has_behavior_change가 false인지 알 수 없고, 나중에 후보 JSON에서
// 다시 판정하는 경로가 생기면 표식 없이 판정하게 된다(#976).
test('normalizeCandidate preserves the collector template marker through the field whitelist', () => {
  const normalizeSource = source({ category: 'camera-hal', section: 'Kernel / Media', keywords: ['libcamera'] });
  const raw = resolveRaspberryPiLibcameraReleaseItems(atomWithReleaseBody('No content.'), normalizeSource)[0];
  const normalized = normalizeCandidate(raw);
  assert.equal(
    normalized.collector_template_sentence,
    'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).'
  );
  assert.equal(normalized.has_behavior_change, false, '표식이 붙은 문장은 근거로 세지 않는다');

  // 표식을 안 다는 다른 수집기의 후보는 이 필드가 빈 문자열이다.
  const other = normalizeCandidate({
    source: normalizeSource,
    title: 'Some other candidate',
    url: 'https://example.com/a',
    publishedAt: '2026-08-17',
    summary: 'The driver adds a new control.',
    sourceKind: 'rss_item'
  });
  assert.equal(other.collector_template_sentence, '');
});
