const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  resolveArticleImage,
  fallbackAssetForSection,
  issueRelativePath
} = require('../../../render/article-image-resolver');

function tempRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFallbacks(root) {
  const kinds = ['ai', 'android', 'cpp', 'newsletter-default'];
  for (const kind of kinds) {
    const filePath = path.join(root, 'assets', 'images', 'fallback', `${kind}.svg`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `<svg xmlns="http://www.w3.org/2000/svg"><text>${kind}</text></svg>`, 'utf8');
  }
}

function validCandidate(url = 'https://publisher.example.com/images/camera-card.png') {
  return {
    url,
    sourceUrl: 'https://publisher.example.com',
    articleUrl: 'https://publisher.example.com/camera-update',
    sourceKind: 'og',
    width: 1200,
    height: 630,
    contentType: 'image/png',
    licenseStatus: 'unknown',
    attribution: 'Example Publisher',
    validationStatus: 'ok'
  };
}

function baseSection(overrides = {}) {
  return {
    category: 'Camera HAL resolver fixture',
    headline: 'Camera HAL resolver fixture',
    article_type: 'camera-hal',
    sources: [{ title: 'Camera HAL resolver fixture', url: 'https://publisher.example.com/camera-update' }],
    imageCandidates: [],
    selectedImage: '',
    ...overrides
  };
}

const noopValidate = async () => ({ ok: true, status: 200, contentType: 'image/png', contentLength: 50000 });
const failValidate = async () => ({ ok: false, status: 404, reason: 'not found' });

test('resolveArticleImage: empty selectedImage uses fallback', async () => {
  const root = tempRoot('resolver-empty-');
  writeFallbacks(root);
  const section = baseSection({ selectedImage: '' });
  const result = await resolveArticleImage(section, { root, validateImageUrl: noopValidate });
  assert.equal(result.usedFallback, true);
  assert.match(result.url, /assets\/images\/fallback\//);
});

test('resolveArticleImage: reachable URL with valid provenance candidate uses the URL', async () => {
  const root = tempRoot('resolver-valid-candidate-');
  writeFallbacks(root);
  const url = 'https://publisher.example.com/images/camera-card.png';
  const section = baseSection({
    selectedImage: url,
    imageCandidates: [validCandidate(url)]
  });
  const result = await resolveArticleImage(section, { root, validateImageUrl: noopValidate });
  assert.equal(result.usedFallback, false);
  assert.equal(result.url, url);
  assert.equal(result.originalUrl, '');
});

test('resolveArticleImage: reachable URL without any valid provenance candidate falls back to local SVG', async () => {
  const root = tempRoot('resolver-no-provenance-');
  writeFallbacks(root);
  const url = 'https://blogger.googleusercontent.com/img/b/abc/GoogleForDevelopers.png';
  const section = baseSection({
    selectedImage: url,
    imageCandidates: [{
      ...validCandidate(url),
      sourceUrl: 'https://unrelated.example.com/article',
      articleUrl: 'https://unrelated.example.com/article',
      sourceKind: 'release_note_item'
    }]
  });
  const result = await resolveArticleImage(section, { root, validateImageUrl: noopValidate });
  assert.equal(result.usedFallback, true, 'should use fallback when provenance is invalid');
  assert.match(result.url, /assets\/images\/fallback\//);
  assert.equal(result.originalUrl, url, 'originalUrl should preserve the external URL');
});

test('resolveArticleImage: reachable URL with no imageCandidates at all falls back to local SVG', async () => {
  const root = tempRoot('resolver-no-candidates-');
  writeFallbacks(root);
  const url = 'https://blogger.googleusercontent.com/img/b/abc/photo.jpg';
  const section = baseSection({
    selectedImage: url,
    imageCandidates: []
  });
  const result = await resolveArticleImage(section, { root, validateImageUrl: noopValidate });
  assert.equal(result.usedFallback, true);
  assert.match(result.url, /assets\/images\/fallback\//);
  assert.equal(result.originalUrl, url);
});

test('resolveArticleImage: candidate with missing attribution but sources[0].title provides attribution — NOT a fallback', async () => {
  // audit uses: candidate.attribution || section.imageAttribution || firstSource(section).title
  // baseSection has sources:[{ title: 'Camera HAL resolver fixture' }], so attribution is satisfied
  const root = tempRoot('resolver-missing-attribution-has-source-title-');
  writeFallbacks(root);
  const url = 'https://publisher.example.com/images/camera-card.png';
  const section = baseSection({
    selectedImage: url,
    imageCandidates: [{ ...validCandidate(url), attribution: '' }]
  });
  const result = await resolveArticleImage(section, { root, validateImageUrl: noopValidate });
  assert.equal(result.usedFallback, false, 'source title satisfies attribution; should NOT fall back');
  assert.equal(result.url, url);
});

test('resolveArticleImage: candidate with truly missing attribution (no attribution, no imageAttribution, no sources title) falls back', async () => {
  // Fixture passes extraction (sameOrigin via sources[0].url), contentType, size, sourceUrl, licenseStatus gates,
  // and fails specifically on the attribution gate because candidate.attribution='', section.imageAttribution='',
  // and sources[0] has no title — so candidateAttribution() resolves to ''.
  const root = tempRoot('resolver-truly-missing-attribution-');
  writeFallbacks(root);
  const url = 'https://publisher.example.com/images/camera-card.png';
  const section = {
    ...baseSection({
      selectedImage: url,
      imageCandidates: [{ ...validCandidate(url), attribution: '' }]
    }),
    sources: [{ url: 'https://publisher.example.com/camera-update' }],
    imageAttribution: ''
  };
  const result = await resolveArticleImage(section, { root, validateImageUrl: noopValidate });
  assert.equal(result.usedFallback, true, 'no attribution source at all; should fall back');
  assert.equal(result.originalUrl, url);
});

test('resolveArticleImage: candidate with validationStatus !== ok is treated as provenance-invalid', async () => {
  const root = tempRoot('resolver-validation-status-');
  writeFallbacks(root);
  const url = 'https://publisher.example.com/images/camera-card.png';
  const section = baseSection({
    selectedImage: url,
    imageCandidates: [{ ...validCandidate(url), validationStatus: 'failed' }]
  });
  const result = await resolveArticleImage(section, { root, validateImageUrl: noopValidate });
  assert.equal(result.usedFallback, true);
  assert.equal(result.originalUrl, url);
});

test('resolveArticleImage: unreachable URL still falls back (existing behavior preserved)', async () => {
  const root = tempRoot('resolver-unreachable-');
  writeFallbacks(root);
  const url = 'https://publisher.example.com/images/broken.png';
  const section = baseSection({
    selectedImage: url,
    imageCandidates: [validCandidate(url)]
  });
  const result = await resolveArticleImage(section, { root, validateImageUrl: failValidate });
  assert.equal(result.usedFallback, true);
  assert.equal(result.originalUrl, url);
});

test('resolveArticleImage: android section gets android fallback SVG', async () => {
  const root = tempRoot('resolver-android-fallback-');
  writeFallbacks(root);
  const url = 'https://blogger.googleusercontent.com/img/b/abc/GoogleForDevelopers.png';
  const section = baseSection({
    selectedImage: url,
    article_type: 'camera-hal',
    headline: 'CameraX 1.5 Android update',
    imageCandidates: []
  });
  const result = await resolveArticleImage(section, { root, validateImageUrl: noopValidate });
  assert.equal(result.usedFallback, true);
  assert.match(result.url, /android\.svg/);
});
