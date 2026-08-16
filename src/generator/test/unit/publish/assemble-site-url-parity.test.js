const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { assembleSite, withLearningFooterLink } = require('../../../publish/assemble-site');
const { validateUrlParity, siteFilePath } = require('../../../validate/validate-url-parity');
const { tempRoot, writeText, writeJson } = require('../../../../shared/test/helpers/fs');

const SITE_BASE_URL = 'https://ttolsun.github.io/camera-hal-sw-newsletter/';

function fullFooter(learningHref = '') {
  const learningLink = learningHref
    ? `\n      <a class="footer-link" href="${learningHref}">AI Engineering Lab</a>`
    : '';
  return `<footer class="site-footer">
  <div class="content-wrap footer-inner">
    <div class="footer-col">
      <span class="footer-col-title">리소스</span>${learningLink}
      <a class="footer-link" href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a>
    </div>
  </div>
</footer>`;
}

function legacyFooter() {
  return '<footer class="site-footer"><div class="content-wrap footer-legal"><small>© 2026 Camera SW Newsletter</small></div></footer>';
}

// 이동 후 레이아웃: root index.html + articles/ 아래 공개 출력물 전체.
function writePublicLayout(root, { weeklyKey = '2026-W23' } = {}) {
  writeText(path.join(root, 'index.html'), `<!doctype html><html><body>home${fullFooter()}</body></html>`);
  writeText(path.join(root, 'articles', 'archive.html'), `<!doctype html><html><body>archive${fullFooter()}</body></html>`);
  writeText(
    path.join(root, 'articles', 'learning', 'ai-engineering', 'index.html'),
    `<!doctype html><html><body>learning${fullFooter('index.html')}</body></html>`
  );
  writeText(path.join(root, 'articles', 'robots.txt'), `Sitemap: ${SITE_BASE_URL}sitemap.xml\n`);
  writeText(path.join(root, 'articles', 'css', 'styles.css'), 'body{}');
  writeText(path.join(root, 'articles', 'assets', 'js', 'site-header.js'), '// header');
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), []);
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), []);
  // index.html이 fetch하는 진입점들. homepage-headline.json은 articles/data/에서 평탄화되고,
  // subscription.json은 저장소 config/에서 assemble-site.js의 EXTRA_SERVED_FILES로 복사된다.
  writeJson(path.join(root, 'articles', 'data', 'homepage-headline.json'), {});
  writeJson(path.join(root, 'config', 'subscription.json'), {});
  writeText(
    path.join(root, 'articles', 'newsletters', weeklyKey, 'index.html'),
    `<!doctype html><html><body>issue${legacyFooter()}</body></html>`
  );
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

const LEARNING_HREF = '../../learning/ai-engineering/index.html';
const EXPECTED_LEARNING_LINK = `<a class="footer-link" href="${LEARNING_HREF}">AI Engineering Lab</a>`;

function learningLinkCount(html) {
  return (html.match(/>AI Engineering Lab<\/a>/g) || []).length;
}

test('withLearningFooterLink fails closed when a deployed page has no site-footer', () => {
  assert.throws(
    () => withLearningFooterLink('<html><body>no footer shell</body></html>', LEARNING_HREF, 'orphan.html'),
    /orphan\.html has no site-footer/
  );
});

test('withLearningFooterLink recognises an existing link written with href before class', () => {
  const footer = `<footer class="site-footer">
  <div class="footer-col">
    <span class="footer-col-title">리소스</span>
    <a href="learning/ai-engineering/index.html" class="footer-link">AI Engineering Lab</a>
  </div>
</footer>`;
  const html = withLearningFooterLink(`<html><body>${footer}</body></html>`, LEARNING_HREF, 'href-first.html');
  assert.equal(learningLinkCount(html), 1);
  assert.ok(html.includes(EXPECTED_LEARNING_LINK));
});

test('withLearningFooterLink puts the link under the 리소스 column at the column indent', () => {
  const html = withLearningFooterLink(`<html><body>${fullFooter()}</body></html>`, LEARNING_HREF, 'indented.html');
  assert.equal(learningLinkCount(html), 1);
  // fullFooter의 리소스 컬럼은 6칸 들여쓰기다. 링크는 그 바로 아래 같은 깊이로 들어간다.
  assert.ok(html.includes(`      <span class="footer-col-title">리소스</span>\n      ${EXPECTED_LEARNING_LINK}`));
});

test('withLearningFooterLink uses the 리소스 column even when the footer is on one line', () => {
  const footer = '<footer class="site-footer"><div class="footer-col"><span class="footer-col-title">리소스</span><a class="footer-link" href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a></div></footer>';
  const html = withLearningFooterLink(`<html><body>${footer}</body></html>`, LEARNING_HREF, 'minified.html');
  assert.equal(learningLinkCount(html), 1);
  assert.ok(html.includes(EXPECTED_LEARNING_LINK));
  assert.doesNotMatch(html, /legacy-footer-resources/);
});

test('assembleSite names the offending page when a deployed HTML file has no site-footer', () => {
  const root = tempRoot('assemble-site-footerless-');
  writePublicLayout(root);
  writeText(path.join(root, 'articles', 'embed', 'card.html'), '<!doctype html><html><body>fragment</body></html>');

  assert.throws(
    () => assembleSite({ root, out: path.join(root, '_site_out') }),
    /embed\/card\.html has no site-footer/
  );
});

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
  assert.equal(result.footerLinksUpdated, 3);
  // articles/ 디렉터리 자체는 _site 안에 평탄화되어 남지 않는다.
  assert.equal(fs.existsSync(path.join(result.outDir, 'articles')), false);

  const expectedFooterLinks = [
    ['index.html', 'learning/ai-engineering/index.html'],
    ['archive.html', 'learning/ai-engineering/index.html'],
    [path.join('learning', 'ai-engineering', 'index.html'), 'index.html'],
    [path.join('newsletters', '2026-W23', 'index.html'), '../../learning/ai-engineering/index.html']
  ];
  for (const [relPath, href] of expectedFooterLinks) {
    const html = fs.readFileSync(path.join(result.outDir, relPath), 'utf8');
    const expectedLink = `<a class="footer-link" href="${href}">AI Engineering Lab</a>`;
    assert.equal((html.match(/>AI Engineering Lab<\/a>/g) || []).length, 1, relPath);
    assert.ok(html.includes(expectedLink), relPath);
  }
  assert.match(
    fs.readFileSync(path.join(result.outDir, 'newsletters', '2026-W23', 'index.html'), 'utf8'),
    /class="content-wrap legacy-footer-resources"/
  );
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
