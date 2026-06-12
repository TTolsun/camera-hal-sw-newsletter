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
