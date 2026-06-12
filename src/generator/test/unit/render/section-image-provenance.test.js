const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeSectionImageFields
} = require('../../../publish/gemini-newsroom-newsletter');
const {
  analyzeImageCandidateFromMetadata
} = require('../../../render/newsletter-image-audit');

const IMAGE_URL = 'https://blogger.googleusercontent.com/img/og-image.png';
const ARTICLE_URL = 'https://goo.gle/AdaptiveApps_IO26';

function section() {
  return {
    headline: 'Adaptive camera preview with CameraX',
    selectedImage: '',
    sources: [{ url: ARTICLE_URL, title: 'Android Developers Blog' }],
    // The editor LLM round-trips imageCandidates but cannot see the real sourceKind
    // (the capsule strips it), so it fabricates the item-level kind and drops contentType.
    imageCandidates: [
      {
        url: IMAGE_URL,
        sourceUrl: 'https://android-developers.googleblog.com/',
        articleUrl: ARTICLE_URL,
        sourceKind: 'blog_post_item',
        contentType: '',
        licenseStatus: 'unknown',
        attribution: 'Android Developers Blog',
        validationStatus: 'ok'
      }
    ]
  };
}

// The reporter retains the authoritative, collection-verified provenance.
function reporter() {
  return {
    candidates: [
      {
        url: ARTICLE_URL,
        imageCandidates: [
          {
            url: IMAGE_URL,
            sourceUrl: 'https://android-developers.googleblog.com/',
            articleUrl: ARTICLE_URL,
            sourceKind: 'og',
            contentType: 'image/png',
            licenseStatus: 'unknown',
            attribution: 'Android Developers Blog',
            validationStatus: 'ok'
          }
        ]
      }
    ]
  };
}

test('section image candidates are rehydrated with authoritative og provenance', () => {
  const result = normalizeSectionImageFields(section(), reporter());
  const [image] = result.imageCandidates;
  assert.equal(image.sourceKind, 'og');
  assert.equal(image.contentType, 'image/png');
});

test('rehydrated candidate passes the image-provenance gate instead of missing_extraction_source', () => {
  const before = analyzeImageCandidateFromMetadata(section().imageCandidates[0], section());
  assert.equal(before.valid, false);
  assert.equal(before.exclusion.reasonCode, 'missing_extraction_source');

  // The orchestrator spreads normalizeSectionImageFields output back into the section.
  const rehydrated = { ...section(), ...normalizeSectionImageFields(section(), reporter()) };
  const after = analyzeImageCandidateFromMetadata(rehydrated.imageCandidates[0], rehydrated);
  assert.equal(after.valid, true);
});

test('candidates without authoritative provenance are left untouched (fail safe)', () => {
  const result = normalizeSectionImageFields(section(), { candidates: [] });
  const [image] = result.imageCandidates;
  assert.equal(image.sourceKind, 'blog_post_item');
});
