const test = require('node:test');
const assert = require('node:assert');
const { devsiteFeaturePageExtract } = require('../../../collect/devsite-feature-page-evidence');
const { documentSectionExtract } = require('../../../collect/document-section-extractors');

const FEATURES_URL = 'https://developer.android.com/about/versions/16/features';
const HTML = `
<html><head><title>Features and APIs | Android Developers</title></head><body>
<nav><a href="/about/versions/15/features">Android 15</a><h2>이전 버전 목록</h2></nav>
<devsite-content><article>
<h1>Features and APIs</h1>
<h2 id="camera">Camera</h2><p>Hybrid auto-exposure lets apps lock ISO while AE runs.</p>
<h3 id="color-temp">Color temperature and tint adjustments</h3><p>COLOR_CORRECTION_COLOR_TEMPERATURE adds direct CCT control.</p>
<h2 id="privacy">Privacy</h2><p>Photo picker improvements unrelated to camera pipeline.</p>
<h2 id="ultrahdr">UltraHDR improvements</h2><p>UltraHDR images can be encoded as HEIC.</p>
</article></devsite-content></body></html>`;

test('feature 페이지에서 카메라 관련 섹션만 뽑는다', () => {
  const extract = devsiteFeaturePageExtract(HTML, FEATURES_URL);
  assert.equal(extract.release, 'Android 16 features');
  const headings = extract.sections.map(section => section.heading);
  assert.ok(headings.includes('Camera'));
  assert.ok(headings.includes('Color temperature and tint adjustments'));
  assert.ok(headings.includes('UltraHDR improvements'));
  assert.ok(!headings.includes('Privacy'));
  assert.ok(!headings.includes('이전 버전 목록'));
  const cameraSection = extract.sections.find(section => section.heading === 'Camera');
  assert.equal(cameraSection.url, `${FEATURES_URL}#camera`);
  assert.ok(cameraSection.sentence.includes('Hybrid auto-exposure'));
  assert.ok(cameraSection.hash);
});

test('feature 페이지가 아닌 URL은 null이다', () => {
  assert.equal(devsiteFeaturePageExtract(HTML, 'https://developer.android.com/about/versions/16'), null);
  assert.equal(devsiteFeaturePageExtract(HTML, 'https://example.com/about/versions/16/features'), null);
});

test('dispatcher는 URL로 adapter를 라우팅한다', () => {
  assert.ok(documentSectionExtract(HTML, FEATURES_URL));
  assert.equal(documentSectionExtract(HTML, 'https://developer.android.com/jetpack'), null);
});
