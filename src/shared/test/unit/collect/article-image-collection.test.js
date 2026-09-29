const test = require('node:test');
const assert = require('node:assert/strict');
const { collectArticleImages, fetchArticlePage, MAX_PAGE_BYTES } = require('../../../render/article-image-collection');
const article = 'https://example.com/article';
const html = '<meta property="og:image" content="https://cdn.example.com/hero.png">';
const valid = async () => ({ ok: true, contentType: 'image/png', contentLength: 5000 });

test('transient original-page failure retries and retains verified current-article provenance', async () => {
  let calls = 0;
  const r = await collectArticleImages(article, { name: 'Source' }, [], {
    fetchPage: async () => ++calls === 1 ? { ok: false, reason: 'timeout', retryable: true } : { ok: true, html },
    sleep: async () => {}, imageValidation: { validateImageUrl: valid }
  });
  assert.equal(calls, 2);
  assert.equal(r.images[0].articleUrl, article);
  assert.equal(r.diagnostics.outcome, 'available');
  assert.equal(r.diagnostics.page_attempts[0].reason, 'timeout');
});

test('permanent HTTP errors do not retry and differ from empty extraction and validation failure', async () => {
  let calls = 0;
  const failed = await collectArticleImages(article, {}, [], { fetchPage: async () => { calls++; return { ok: false, status: 404, reason: 'http_error', retryable: false }; } });
  assert.equal(calls, 1);
  assert.equal(failed.diagnostics.outcome, 'page_fetch_failed');
  const empty = await collectArticleImages(article, {}, [], { fetchPage: async () => ({ ok: true, html: '<html></html>' }) });
  assert.equal(empty.diagnostics.outcome, 'no_image_extracted');
  const rejected = await collectArticleImages(article, {}, [], {
    fetchPage: async () => ({ ok: true, html }),
    imageValidation: { validateImageUrl: async () => ({ ok: false, status: 0, reason: 'timeout' }) }
  });
  assert.equal(rejected.diagnostics.outcome, 'image_validation_failed');
  assert.equal(rejected.diagnostics.validation_failures[0].reason, 'timeout');
});

test('page size and non-HTML responses are bounded permanent failures', async () => {
  const r = await fetchArticlePage(article, { fetchImpl: async () => new Response('x'.repeat(MAX_PAGE_BYTES + 1), { headers: { 'content-type': 'text/html' } }) });
  assert.equal(r.reason, 'page_size_limit');
  assert.equal(r.retryable, false);
  const json = await fetchArticlePage(article, { fetchImpl: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) });
  assert.equal(json.reason, 'non_html');
});
