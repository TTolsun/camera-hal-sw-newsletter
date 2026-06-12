const assert = require('node:assert/strict');
const test = require('node:test');

const {
  articleIdentityKey,
  normalizeArticleUrl
} = require('../../../src/core/common/article-identity');

test('article identity prefers canonical URL and strips tracking params', () => {
  const key = articleIdentityKey({
    canonical_url: 'https://Example.com/Camera/Update/?utm_source=newsletter&gclid=abc&b=2',
    url: 'https://other.example/fallback'
  });

  assert.equal(key, 'url:https://example.com/Camera/Update/?b=2');
});

test('release-note anchors are preserved only for allowlisted release pages', () => {
  assert.equal(
    normalizeArticleUrl('https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'),
    'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
  );
  assert.equal(
    normalizeArticleUrl('https://example.com/article#details'),
    'https://example.com/article'
  );
});

test('source event identity is used before content hash fallback', () => {
  assert.equal(
    articleIdentityKey({
      source_event_identity: 'CameraX:1.6.1',
      title: 'Copy edited title'
    }),
    'event:camerax:1.6.1'
  );
});

test('content hash fallback is used only when URL and event identity are missing', () => {
  const key = articleIdentityKey({
    title: 'Camera HAL buffer update',
    summary: 'Frame metadata handling changed.'
  });

  assert.match(key, /^content:[a-f0-9]{24}$/);
});
