const test = require('node:test');
const assert = require('node:assert');
const { devsiteFeaturePageExtract } = require('../../../collect/devsite-feature-page-evidence');
const {
  documentSectionEvidence,
  documentSectionExtract
} = require('../../../collect/document-section-extractors');
const {
  candidateFromEvent,
  classifyObservation,
  observationFromHtml
} = require('../../../collect/source-monitor');

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

// 여기서부터는 "이 변화가 무엇에 대한 것인가"를 잠근다. 증거 빌더가 ITS 이름표를 박아 두면
// feature 페이지가 바뀐 주에 main 후보가 'Camera ITS / CTS Verifier' 변화라고 주장하게 된다 —
// 출처가 뒷받침하지 않는 주장이므로 main 파이프라인에 들어가면 안 된다.
const FEATURE_SOURCE = {
  source_id: 'android-version-features',
  root_url: 'https://developer.android.com/about/versions/17/features',
  expected_categories: ['compatibility', 'camera-hal'],
  source_priority: 'high',
  main_article_allowed: true,
  date_extractors: ['visible_last_updated']
};

const CHANGED_HTML = HTML.replace(
  'Hybrid auto-exposure lets apps lock ISO while AE runs.',
  'Hybrid auto-exposure lets apps lock ISO while AE runs and reports the applied gain.'
);

function observeFeaturePage(html = HTML) {
  return observationFromHtml({ source: FEATURE_SOURCE, url: FEATURES_URL, html });
}

function classifyFeaturePage(previous, current) {
  return classifyObservation({
    source: FEATURE_SOURCE,
    previous,
    current,
    snapshot: { pages: [], processed_source_event_ids: [], processed_evidence_ids: [] },
    detectedAt: '2026-08-17T00:00:00.000Z'
  });
}

test('증거 이름표는 adapter가 준다 — feature 페이지는 ITS 이름을 달지 않는다', () => {
  const evidence = documentSectionEvidence(
    devsiteFeaturePageExtract(CHANGED_HTML, FEATURES_URL),
    devsiteFeaturePageExtract(HTML, FEATURES_URL).sections
  );

  assert.deepEqual(evidence.changed_section_headings, ['Camera']);
  assert.equal(evidence.api_or_component, 'Android platform camera features');
  assert.equal(evidence.version_or_release, 'Android 16 features');
});

test('feature 페이지 변화 후보는 Camera ITS / CTS Verifier라고 주장하지 않는다', () => {
  const event = classifyFeaturePage(observeFeaturePage(), observeFeaturePage(CHANGED_HTML));

  assert.equal(event.content_changed, true);
  assert.equal(event.release_note_evidence.api_or_component, 'Android platform camera features');

  const candidate = candidateFromEvent(event, FEATURE_SOURCE);

  assert.equal(candidate.api_or_component, 'Android platform camera features');
  assert.equal(candidate.version_or_release, 'Android 16 features');
  assert.match(candidate.behavior_change, /^Camera: /);
});
