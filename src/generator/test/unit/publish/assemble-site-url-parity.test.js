const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { assembleSite } = require('../../../publish/assemble-site');
const { validateUrlParity, siteFilePath } = require('../../../publish/validate-url-parity');
const { tempRoot, writeText, writeJson } = require('../../../../shared/test/helpers/fs');

const SITE_BASE_URL = 'https://ttolsun.github.io/camera-hal-sw-newsletter/';

// 이동 후 레이아웃: root index.html + articles/ 아래 공개 출력물 전체.
function writePublicLayout(root, { weeklyKey = '2026-W23' } = {}) {
  writeText(path.join(root, 'index.html'), '<!doctype html><html><body>home</body></html>');
  writeText(path.join(root, 'articles', 'archive.html'), '<!doctype html><html><body>archive</body></html>');
  writeText(path.join(root, 'articles', 'robots.txt'), `Sitemap: ${SITE_BASE_URL}sitemap.xml\n`);
  writeText(path.join(root, 'articles', 'css', 'styles.css'), 'body{}');
  writeText(path.join(root, 'articles', 'assets', 'js', 'site-header.js'), '// header');
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), []);
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), []);
  // index.html이 fetch하는 진입점들. homepage-headline.json은 articles/data/에서 평탄화되고,
  // subscription.json은 저장소 config/에서 assemble-site.js의 EXTRA_SERVED_FILES로 복사된다.
  writeJson(path.join(root, 'articles', 'data', 'homepage-headline.json'), {});
  writeJson(path.join(root, 'config', 'subscription.json'), {});
  writeText(path.join(root, 'articles', 'newsletters', weeklyKey, 'index.html'), '<!doctype html><html></html>');
  writeText(
    path.join(root, 'articles', 'sitemap.xml'),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      `  <url><loc>${SITE_BASE_URL}</loc></url>`,
      `  <url><loc>${SITE_BASE_URL}archive.html</loc></url>`,
      `  <url><loc>${SITE_BASE_URL}newsletters/${weeklyKey}/index.html</loc></url>`,
      '</urlset>',
      ''
    ].join('\n')
  );
}

test('assembleSite copies root index.html and articles/ contents to _site root and writes .nojekyll', () => {
  const root = tempRoot('assemble-site-');
  writePublicLayout(root);
  const out = path.join(root, '_site_out');

  const result = assembleSite({ root, out });

  // 서빙 URL이 보존되도록 index.html은 루트에, 나머지는 articles/에서 평탄화되어 위치한다.
  assert.equal(fs.existsSync(path.join(result.outDir, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(result.outDir, 'archive.html')), true);
  assert.equal(fs.existsSync(path.join(result.outDir, 'robots.txt')), true);
  assert.equal(fs.existsSync(path.join(result.outDir, 'sitemap.xml')), true);
  assert.equal(fs.existsSync(path.join(result.outDir, 'css', 'styles.css')), true);
  assert.equal(fs.existsSync(path.join(result.outDir, 'assets', 'js', 'site-header.js')), true);
  assert.equal(fs.existsSync(path.join(result.outDir, 'data', 'newsletters.json')), true);
  assert.equal(fs.existsSync(path.join(result.outDir, 'newsletters', '2026-W23', 'index.html')), true);
  assert.equal(fs.existsSync(path.join(result.outDir, '.nojekyll')), true);
  // articles/ 디렉터리 자체는 _site 안에 평탄화되어 남지 않는다.
  assert.equal(fs.existsSync(path.join(result.outDir, 'articles')), false);
});

test('assembleSite throws when root index.html is missing', () => {
  const root = tempRoot('assemble-site-missing-');
  writeText(path.join(root, 'articles', 'archive.html'), '<html></html>');
  assert.throws(() => assembleSite({ root, out: path.join(root, '_site_out') }), /index\.html is required/);
});

test('validateUrlParity passes when every sitemap and top-level URL has a backing file', () => {
  const root = tempRoot('url-parity-ok-');
  writePublicLayout(root);

  const result = validateUrlParity({ root });

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.checkedUrls.includes('/'));
  assert.ok(result.checkedUrls.includes('/archive.html'));
  assert.ok(result.checkedUrls.includes('/data/newsletters.json'));
  assert.ok(result.checkedUrls.includes('/data/homepage-headline.json'));
  assert.ok(result.checkedUrls.includes('/config/subscription.json'));
  assert.ok(result.checkedUrls.some(url => url === '/newsletters/2026-W23/index.html'));
});

test('validateUrlParity fails when a sitemap URL has no backing file after assembly', () => {
  const root = tempRoot('url-parity-missing-');
  writePublicLayout(root);
  // 서빙되어야 하는 주간 호 파일을 제거하면 sitemap <loc>가 404가 된다.
  fs.rmSync(path.join(root, 'articles', 'newsletters', '2026-W23', 'index.html'));

  const result = validateUrlParity({ root });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /newsletters\/2026-W23\/index\.html/);
});

test('validateUrlParity fails when a known top-level page is missing', () => {
  const root = tempRoot('url-parity-toplevel-');
  writePublicLayout(root);
  fs.rmSync(path.join(root, 'articles', 'archive.html'));

  const result = validateUrlParity({ root });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /archive\.html/);
});

test('siteFilePath maps "/" to index.html and trailing-slash URLs to index.html', () => {
  const siteDir = path.join('tmp', '_site');
  assert.equal(siteFilePath(siteDir, '/'), path.join(siteDir, 'index.html'));
  assert.equal(siteFilePath(siteDir, '/newsletters/2026-W23/'), path.join(siteDir, 'newsletters', '2026-W23', 'index.html'));
  assert.equal(siteFilePath(siteDir, '/data/newsletters.json'), path.join(siteDir, 'data', 'newsletters.json'));
});
