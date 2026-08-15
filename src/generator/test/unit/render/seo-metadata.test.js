const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  AI_ENGINEERING_LEARNING_PATH,
  absoluteUrl,
  buildStaticSitemap,
  buildSitemap,
  missingSeoTags,
  seoTagUrl
} = require('../../../render/seo-metadata');

function completeHead(overrides = {}) {
  const canonical = overrides.canonical ?? `<link rel="canonical" href="${SITE_BASE_URL}" />`;
  const ogImage = overrides.ogImage ?? `<meta property="og:image" content="${DEFAULT_OG_IMAGE}" />`;
  return `<!doctype html><html><head>
    <title>x</title>
    <meta name="description" content="d" />
    ${canonical}
    <meta property="og:title" content="t" />
    <meta property="og:description" content="d" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE_BASE_URL}" />
    ${ogImage}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="t" />
    <meta name="twitter:description" content="d" />
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
  </head><body></body></html>`;
}

test('site constants are absolute GitHub Pages URLs', () => {
  assert.match(SITE_BASE_URL, /^https:\/\/ttolsun\.github\.io\/camera-hal-sw-newsletter\/$/);
  assert.equal(DEFAULT_OG_IMAGE, SITE_BASE_URL + 'assets/images/brand/HALley.png');
  assert.equal(AI_ENGINEERING_LEARNING_PATH, 'learning/ai-engineering/');
});

test('absoluteUrl joins a relative path onto the base without double slashes', () => {
  assert.equal(absoluteUrl('archive.html'), SITE_BASE_URL + 'archive.html');
  assert.equal(absoluteUrl('/archive.html'), SITE_BASE_URL + 'archive.html');
});

test('buildStaticSitemap lists stable entry points and is data-independent', () => {
  const xml = buildStaticSitemap();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.ok(xml.includes(`<loc>${SITE_BASE_URL}</loc>`));
  assert.ok(xml.includes(`<loc>${SITE_BASE_URL}archive.html</loc>`));
  assert.ok(xml.includes(`<loc>${SITE_BASE_URL}${AI_ENGINEERING_LEARNING_PATH}</loc>`));
  assert.equal((xml.match(/<url>/g) || []).length, 3);
  assert.ok(xml.endsWith('\n'));
});

test('buildSitemap enumerates stable pages and each weekly issue with lastmod', () => {
  const xml = buildSitemap([
    { weeklyKey: '2026-W23', html: 'newsletters/2026-W23/index.html', weekEndDate: '2026-06-07', date: '2026-06-01' },
    { weeklyKey: '2026-W22', html: 'newsletters/2026-W22/index.html', date: '2026-05-25' }
  ]);
  assert.ok(xml.includes(`<loc>${SITE_BASE_URL}</loc>`));
  assert.ok(xml.includes(`<loc>${SITE_BASE_URL}archive.html</loc>`));
  assert.ok(xml.includes(`<loc>${SITE_BASE_URL}${AI_ENGINEERING_LEARNING_PATH}</loc>`));
  assert.ok(xml.includes(`<loc>${SITE_BASE_URL}newsletters/2026-W23/index.html</loc>`));
  assert.ok(xml.includes(`<loc>${SITE_BASE_URL}newsletters/2026-W22/index.html</loc>`));
  assert.ok(xml.includes('<lastmod>2026-06-07</lastmod>')); // weekEndDate preferred
  assert.ok(xml.includes('<lastmod>2026-05-25</lastmod>')); // falls back to date
  assert.equal((xml.match(/<url>/g) || []).length, 5); // 3 stable pages + 2 issues
  assert.ok(xml.endsWith('\n'));
});

test('buildSitemap skips entries with no html and equals static sitemap when empty', () => {
  const xml = buildSitemap([{ weeklyKey: '2026-W23' }]);
  assert.equal((xml.match(/<url>/g) || []).length, 3); // stable pages only
  assert.equal(buildSitemap([]), buildStaticSitemap());
});

test('missingSeoTags returns empty when all required share tags are present', () => {
  assert.deepEqual(missingSeoTags(completeHead()), []);
});

test('missingSeoTags flags each missing required tag', () => {
  const missing = missingSeoTags('<head><title>x</title><meta name="description" content="d"></head>');
  assert.ok(missing.includes('canonical'));
  assert.ok(missing.includes('og:title'));
  assert.ok(missing.includes('og:image'));
  assert.ok(missing.includes('twitter:card'));
});

test('missingSeoTags is attribute-order independent', () => {
  // href before rel, content before property — all valid HTML
  const html = completeHead({
    canonical: `<link href="${SITE_BASE_URL}" rel="canonical">`,
    ogImage: `<meta content="${DEFAULT_OG_IMAGE}" property="og:image">`
  });
  assert.deepEqual(missingSeoTags(html), []);
});

test('missingSeoTags treats a canonical link with no href as missing', () => {
  const html = completeHead({ canonical: '<link rel="canonical">' });
  assert.ok(missingSeoTags(html).includes('canonical'));
});

test('seoTagUrl extracts the url order-independently for canonical and og:image', () => {
  const html = completeHead({
    canonical: `<link href="${SITE_BASE_URL}" rel="canonical">`,
    ogImage: `<meta content="${DEFAULT_OG_IMAGE}" property="og:image">`
  });
  assert.equal(seoTagUrl(html, 'canonical'), SITE_BASE_URL);
  assert.equal(seoTagUrl(html, 'og:image'), DEFAULT_OG_IMAGE);
  assert.equal(seoTagUrl('<head></head>', 'canonical'), '');
});