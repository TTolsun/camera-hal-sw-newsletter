const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeCandidate,
  parseHtmlPage,
  parseRss
} = require('../../../scripts/newsroom/cli/collect-news-candidates');
const { parseSourceSpecificItems } = require('../../../scripts/lib/source-item-parsers');
const {
  DEFAULT_EVIDENCE_ROLE,
  extractOutgoingLinksFromHtml
} = require('../../../scripts/newsroom/collect/outgoing-links');
const { readTextFixture } = require('../../helpers/fixture-loader');

function source(overrides = {}) {
  return {
    id: 'android-developers-blog',
    name: 'Android Developers Blog',
    url: 'https://android-developers.googleblog.com/',
    sourceUrl: 'https://android-developers.googleblog.com/',
    category: 'camera-api',
    section: 'Android / AOSP / Camera',
    priority: 'high',
    reliability: 'official',
    keywords: ['CameraX', 'camera'],
    requiresCrossCheck: false,
    candidateOnly: false,
    ...overrides
  };
}

function byUrl(links) {
  return new Map((links || []).map(link => [link.url, link]));
}

function assertUnclassifiedAnchor(link, sourceField) {
  assert.ok(link);
  assert.equal(link.source_field, sourceField);
  assert.equal(link.extraction_method, 'html_anchor');
  assert.equal(link.evidence_role, DEFAULT_EVIDENCE_ROLE);
}

test('outgoing link helper preserves anchor href and text with unclassified role', () => {
  const links = extractOutgoingLinksFromHtml(
    '<p><a href="/jetpack/androidx/releases/camera#1.6.1">CameraX release notes</a></p>',
    {
      baseUrl: 'https://developer.android.com/latest-updates',
      sourceField: 'html.body'
    }
  );

  assert.deepEqual(links, [{
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    text: 'CameraX release notes',
    source_field: 'html.body',
    extraction_method: 'html_anchor',
    evidence_role: 'unclassified'
  }]);
});

test('RSS parser preserves summary/content anchors while keeping summary plain text', () => {
  const rss = readTextFixture('linked-evidence/rss-summary-with-anchor.xml');
  const [item] = parseRss(rss, source({
    url: 'https://android-developers.googleblog.com/2026/05/camerax-update.html',
    sourceUrl: 'https://android-developers.googleblog.com/2026/05/camerax-update.html'
  }));
  const links = byUrl(item.outgoing_links);

  assert.doesNotMatch(item.summary, /<a\b|href=/i);
  assertUnclassifiedAnchor(
    links.get('https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'),
    'rss.description'
  );
  assert.equal(
    links.get('https://developer.android.com/jetpack/androidx/releases/camera#1.6.1').text,
    'CameraX release notes'
  );
  assertUnclassifiedAnchor(
    links.get('https://android-review.googlesource.com/c/platform/frameworks/support/+/3456789'),
    'rss.description'
  );
});

test('HTML page fallback preserves body anchors without storing raw HTML in the summary', () => {
  const html = readTextFixture('linked-evidence/android-blog-article-links.html');
  const [item] = parseHtmlPage(html, source({
    url: 'https://android-developers.googleblog.com/2026/05/camerax-update.html',
    sourceUrl: 'https://android-developers.googleblog.com/2026/05/camerax-update.html'
  }));
  const links = byUrl(item.outgoing_links);

  assert.doesNotMatch(item.summary, /<a\b|href=/i);
  assertUnclassifiedAnchor(
    links.get('https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'),
    'html.body'
  );
  assertUnclassifiedAnchor(
    links.get('https://github.com/androidx/androidx/pull/1234'),
    'html.body'
  );
  assertUnclassifiedAnchor(
    links.get('https://android-developers.googleblog.com/feeds/posts/default?alt=rss'),
    'html.body'
  );
});

test('source-specific release rows preserve anchor links before role classification', () => {
  const html = readTextFixture('source-html/android-latest-updates-camerax-table.html');
  const items = parseSourceSpecificItems(html, source({
    id: 'android-developers-latest-updates',
    name: 'Android Developers Latest Updates',
    url: 'https://developer.android.com/latest-updates',
    sourceUrl: 'https://developer.android.com/latest-updates'
  }));
  const maven = items.find(item => item.title === 'CameraX 1.5.0-beta01 - Camera Maven Group versions');
  const core = items.find(item => item.title === 'CameraX 1.5.0-beta01 - androidx.camera:camera-core');

  assertUnclassifiedAnchor(
    maven.outgoing_links[0],
    'release_note_row'
  );
  assert.equal(maven.outgoing_links[0].text, 'Camera Maven Group versions');
  assert.equal(
    maven.outgoing_links[0].url,
    'https://developer.android.google.cn/jetpack/androidx/releases/camera?hl=ko#1.5.0-beta01'
  );
  assertUnclassifiedAnchor(core.outgoing_links[0], 'release_note_row');
  assert.equal(
    core.outgoing_links[0].url,
    'https://developer.android.com/jetpack/androidx/releases/camera#camera-core-1.5.0-beta01'
  );
});

test('candidate normalization preserves outgoing links without accepting classified roles', () => {
  const item = normalizeCandidate({
    source: source(),
    title: 'CameraX 1.6.1 release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    publishedAt: 'May 6, 2026',
    summary: 'Updated CameraX compatibility behavior for Android camera apps.',
    sourceKind: 'rss_item',
    collectionMode: 'rss-item',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'Updated CameraX compatibility behavior for Android camera apps.',
    outgoing_links: [{
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      text: 'CameraX release notes',
      source_field: 'rss.summary',
      extraction_method: 'html_anchor',
      evidence_role: 'primary_evidence'
    }]
  });

  assert.deepEqual(item.outgoing_links, [{
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    text: 'CameraX release notes',
    source_field: 'rss.summary',
    extraction_method: 'html_anchor',
    evidence_role: 'unclassified'
  }]);
});
