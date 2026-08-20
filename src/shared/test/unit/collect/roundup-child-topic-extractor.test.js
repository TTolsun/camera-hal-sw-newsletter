const assert = require('node:assert/strict');
const test = require('node:test');

const {
  extractRoundupChildTopics
} = require('../../../collect/roundup-child-topic-extractor');

function source(overrides = {}) {
  return {
    id: 'android-developers-blog',
    name: 'Android Developers Blog',
    url: 'https://android-developers.googleblog.com/',
    sourceUrl: 'https://android-developers.googleblog.com/',
    category: 'android',
    priority: 'high',
    reliability: 'official',
    ...overrides
  };
}

function extract(html, overrides = {}) {
  return extractRoundupChildTopics({
    source: source(),
    parentTitle: 'Google I/O recap for Android developers',
    parentUrl: 'https://android-developers.googleblog.com/2026/05/io-recap.html',
    publishedAt: 'Wed, 20 May 2026 10:00:00 GMT',
    html,
    rawText: html,
    ...overrides
  });
}

test('roundup extractor accepts heading topic plus body introduce wording', () => {
  const children = extract(`
    <h2>Advanced Professional Video</h2>
    <p>Android introduces a new media framework format for professional capture.</p>
    <p>Developers can review the format in Android creator workflows and camera output tests.</p>
  `);

  assert.equal(children.length, 1);
  assert.equal(children[0].source_extraction.child_heading, 'Advanced Professional Video');
  assert.equal(children[0].behavior_change, 'Android introduces a new media framework format for professional capture.');
  assert.equal(children[0].relevanceBucketHint, 'android_multimedia_camera_output');
  assert.equal(children[0].sourceType, 'roundup_child');
  assert.equal(children[0].parentTitle, 'Google I/O recap for Android developers');
  assert.equal(children[0].parentUrl, 'https://android-developers.googleblog.com/2026/05/io-recap.html');
  assert.equal(children[0].parentCanonicalUrl, 'https://android-developers.googleblog.com/2026/05/io-recap.html');
  assert.equal(children[0].roundupItemIndex, 1);
  assert.equal(children[0].anchorText, 'Advanced Professional Video');
  assert.ok(children[0].url.includes('#'));
  assert.notEqual(children[0].url, children[0].parentUrl);
  assert.equal(Object.prototype.hasOwnProperty.call(children[0], 'source_gap_risk'), false);
});

test('roundup child title marks a parent-document section instead of inventing a page title', () => {
  const children = extract(`
    <h2>Advanced Professional Video</h2>
    <p>Android introduces a new media framework format for professional capture.</p>
    <p>Developers can review the format in Android creator workflows and camera output tests.</p>
  `);

  // heading과 부모 문서 제목은 각각 실존 문자열이지만, 둘을 이어 붙인 "heading - parentTitle"은
  // 어느 페이지에도 없는 제목이었다(#857). 제목은 두 문자열이 어디서 왔는지 드러내야 한다.
  assert.equal(
    children[0].title,
    'Advanced Professional Video (『Google I/O recap for Android developers』 섹션)'
  );
  assert.notEqual(
    children[0].title,
    'Advanced Professional Video - Google I/O recap for Android developers'
  );
  // title은 선정 스코어러의 키워드 입력이기도 하다. 두 실존 문자열이 모두 남아야 점수가 유지된다.
  assert.ok(children[0].title.includes('Advanced Professional Video'));
  assert.ok(children[0].title.includes('Google I/O recap for Android developers'));
});

test('a long parent title is shortened inside the section marker, not cut into a bare concatenation', () => {
  const longParentTitle =
    `Google I/O recap for Android developers ${'covering camera media and platform announcements '.repeat(4)}`.trim();
  const children = extract(`
    <h2>Advanced Professional Video</h2>
    <p>Android introduces a new media framework format for professional capture.</p>
    <p>Developers can review the format in Android creator workflows and camera output tests.</p>
  `, { parentTitle: longParentTitle });

  const { title } = children[0];
  assert.ok(title.length <= 180, title);
  // 합쳐 놓고 통째로 자르면 닫는 표기가 사라져 다시 페이지 제목처럼 읽힌다. 부모 제목만 줄인다.
  assert.ok(title.startsWith('Advanced Professional Video (『'), title);
  assert.ok(title.endsWith('』 섹션)'), title);
  assert.ok(title.includes('…'), title);
});

test('roundup extractor rejects audio-only child topics', () => {
  const children = extract(`
    <h2>Android audio routing</h2>
    <p>Android introduces new audio routing controls for calls and app communication.</p>
    <p>The announcement is useful for communication apps but does not describe camera output.</p>
  `);

  assert.equal(children.length, 0);
});

test('roundup extractor requires front camera for screen recording topics', () => {
  const withoutFrontCamera = extract(`
    <h2>Screen recording controls</h2>
    <p>Android enables screen recording controls for shared developer devices.</p>
    <p>The update focuses on demos and training flows without camera output evidence.</p>
  `);
  const withFrontCamera = extract(`
    <h2>Screen recording controls</h2>
    <p>Android enables screen recording with front camera for creator tutorials and camera-aware demos.</p>
    <p>Developers can use the capture flow when checking media output behavior.</p>
  `);

  assert.equal(withoutFrontCamera.length, 0);
  assert.equal(withFrontCamera.length, 1);
  assert.equal(withFrontCamera[0].source_extraction.child_heading, 'Screen recording controls');
});

test('roundup extractor returns no child candidates for thin content', () => {
  const children = extract('<h2>Advanced Professional Video</h2><p>Android introduces it.</p>');

  assert.deepEqual(children, []);
});
