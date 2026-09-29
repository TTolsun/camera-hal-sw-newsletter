const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveIssueArticleImages } = require('../../../render/article-image-resolver');
const url = 'https://example.com/article';
const image = { url: 'https://cdn.example.com/photo.png', articleUrl: url, sourceUrl: url, sourceKind: 'og', attribution: 'Source', contentType: 'image/png', contentLength: 5000, validationStatus: 'ok', licenseStatus: 'unknown' };

test('selected article retries its own page once and preserves existing fallback when recovery yields no image', async () => {
  let calls = 0;
  const issue = { sections: [{ headline: 'Test article', sources: [{ url, title: 'Source' }], selectedImage: '', imageCandidates: [] }] };
  const opts = { recoverMissingImages: true, collectArticleImages: async requestUrl => { assert.equal(requestUrl, url); calls++; return { images: [], diagnostics: { outcome: 'no_image_extracted' } }; } };
  await resolveIssueArticleImages(issue, opts);
  await resolveIssueArticleImages(issue, opts);
  assert.equal(calls, 1);
  assert.equal(issue.sections[0].resolvedImage.usedFallback, true);
  assert.equal(issue.sections[0].image_recovery.outcome, 'no_image_extracted');
});

test('successful original-page recovery uses audited CDN image and keeps attribution', async () => {
  const issue = { sections: [{ headline: 'Test article', sources: [{ url, title: 'Source' }], selectedImage: '', imageCandidates: [] }] };
  await resolveIssueArticleImages(issue, {
    recoverMissingImages: true,
    collectArticleImages: async () => ({ images: [image], diagnostics: { outcome: 'available' } }),
    validateImageUrl: async () => ({ ok: true, contentType: 'image/png', contentLength: 5000 })
  });
  assert.equal(issue.sections[0].selectedImage, image.url);
  assert.equal(issue.sections[0].imageSource, url);
  assert.equal(issue.sections[0].resolvedImage.usedFallback, false);
});
