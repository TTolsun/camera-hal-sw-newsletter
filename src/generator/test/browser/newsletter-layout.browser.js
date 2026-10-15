const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');
const { assembleSite } = require('../../publish/assemble-site');

const root = path.resolve(__dirname, '../../../..');
const issuePattern = /^\d{4}-(?:W\d{2}|\d{2}-\d{2})$/;
const deployedUrl = process.env.DEPLOYED_SITE_URL;
const reportDir = path.join(root, '.tmp', 'deployed-layout');

function publishedPages(site) {
  return ['newsletters', 'en/newsletters'].flatMap(prefix =>
    fs.readdirSync(path.join(site, prefix), { withFileTypes: true })
      .filter(entry => entry.isDirectory() && issuePattern.test(entry.name))
      .map(entry => `${prefix}/${entry.name}/index.html`)
      .filter(file => fs.existsSync(path.join(site, file)))
  ).sort();
}

async function checkImages(page) {
  const images = await page.locator('.article-image').evaluateAll(elements => elements.map(img => {
    const rect = img.getBoundingClientRect();
    const parent = img.parentElement;
    const style = getComputedStyle(parent);
    return {
      src: img.getAttribute('src'), width: rect.width, height: rect.height,
      available: parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      loaded: img.complete && img.naturalWidth > 0
    };
  }));
  for (const img of images) {
    assert.ok(img.loaded, `image failed to load: ${img.src}`);
    assert.ok(img.available > 200, `article media unexpectedly narrow: ${JSON.stringify(img)}`);
    assert.ok(Math.abs(img.width - img.available) <= 2, `image must fill article width: ${JSON.stringify(img)}`);
    assert.ok(Math.abs(img.height - img.width * 9 / 16) <= 2, `image must retain 16:9 size: ${JSON.stringify(img)}`);
  }
  return images;
}

async function checkMenu(page) {
  const button = page.locator('.language-button');
  await button.click();
  assert.equal(await button.getAttribute('aria-expanded'), 'true');
  const menu = page.locator('.language-options');
  assert.ok(await menu.isVisible(), 'language menu must open');
  const bounds = await page.locator('.language-options, .language-options a').evaluateAll(elements =>
    elements.map(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height, viewport: document.documentElement.clientWidth,
        viewportHeight: innerHeight, reachable: !!hit && element.contains(hit) };
    })
  );
  assert.equal(bounds.length, 3, 'menu must contain both language choices');
  for (const rect of bounds) {
    assert.ok(rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= rect.viewport
      && rect.top >= 0 && rect.bottom <= rect.viewportHeight && rect.reachable,
    `language menu clipped or covered: ${JSON.stringify(rect)}`);
  }
  await button.click();
  assert.equal(await button.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.isVisible(), false);
}

test('published weekly and historical daily pages preserve full-size images and reachable language menus', { timeout: deployedUrl ? 1200000 : 240000 }, async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'newsletter-layout-'));
  let browser;
  let server;
  t.after(async () => {
    if (browser) await browser.close();
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const site = path.join(temporary, 'site');
  assembleSite({ root, out: site });
  const pages = publishedPages(site);
  assert.ok(pages.some(file => /\/\d{4}-\d{2}-\d{2}\//.test(file)), 'historical daily coverage required');
  for (const prefix of ['newsletters/', 'en/newsletters/']) {
    assert.ok(pages.filter(file => file.startsWith(prefix) && /-W\d{2}\//.test(file)).length > 1,
      `latest and earlier weekly issues required: ${prefix}`);
  }
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(site, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(`${site}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = deployedUrl ? new URL(deployedUrl).origin : `http://127.0.0.1:${server.address().port}`;
  const baseUrl = deployedUrl ? `${deployedUrl.replace(/\/$/, '')}/` : `${origin}/`;
  const results = [];
  if (deployedUrl) {
    fs.mkdirSync(reportDir, { recursive: true });
    t.after(() => fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify({ baseUrl, results }, null, 2)));
  }
  browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {});
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  // External availability is outside this layout contract. Local fallback SVGs are served unchanged.
  if (!deployedUrl) await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    if (route.request().resourceType() === 'image') {
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="gray"/></svg>' });
    }
    return route.abort();
  });
  let fallbackCount = 0;
  let imageCount = 0;
  const widths = deployedUrl ? [320] : [320, 390, 1280];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const file of pages) {
      await t.test(`${width}px ${file}`, async () => {
        const result = { file, width, passed: false };
        results.push(result);
        try {
          const response = await page.goto(new URL(file, baseUrl).href);
          assert.equal(response.status(), 200);
          await page.locator('.language-button').waitFor();
          // Force lazy images to load without changing their sizing or scrolling the header away.
          await page.locator('.article-image').evaluateAll(elements => Promise.all(elements.map(async img => {
            img.loading = 'eager';
            let timer;
            try {
              await Promise.race([
                img.decode(),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`image load timeout: ${img.src}`)), 30000); })
              ]);
            } finally {
              clearTimeout(timer);
            }
          })));
          const images = await checkImages(page);
          const expectedImages = (fs.readFileSync(path.join(site, file), 'utf8').match(/class="article-image"/g) || []).length;
          assert.equal(images.length, expectedImages, 'all published article images must be present');
          imageCount += images.length;
          fallbackCount += images.filter(img => img.src.includes('/images/fallback/')).length;
          await checkMenu(page);
          result.images = images;
          result.passed = true;
        } catch (error) {
          result.error = error.message;
          if (deployedUrl) await page.screenshot({ path: path.join(reportDir, `${file.replaceAll('/', '-')}.png`), fullPage: true });
          throw error;
        }
      });
    }
  }
  assert.ok(imageCount > 0 && fallbackCount > 0, 'must exercise real article and fallback images');
  t.diagnostic(`${pages.length} published pages × ${widths.length} viewports; ${imageCount} image checks (${fallbackCount} fallback)`);
  if (deployedUrl) return;
  // Prove the assertions catch the original bugs on an earlier issue, not just the latest.
  const olderIssue = pages.find(file => file.startsWith('newsletters/') && /-W\d{2}\//.test(file)
    && fs.readFileSync(path.join(site, file), 'utf8').includes('/images/fallback/'));
  assert.ok(olderIssue, 'an earlier weekly issue with a fallback image is required');
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`${origin}/${olderIssue}`);
  await page.locator('.article-image').evaluateAll(elements => Promise.all(elements.map(async img => {
    img.loading = 'eager';
    await img.decode();
  })));
  await t.test('detects the former 160×90 fallback regression', async () => {
    await page.addStyleTag({ content: '.newsletter-issue-page .article-image[src*="assets/images/fallback/"] { width: 160px; max-height: 90px; }' });
    await assert.rejects(() => checkImages(page), /image must fill article width/);
  });
  await t.test('detects the former 320px language menu clipping', async () => {
    await page.addStyleTag({ content: '@media(max-width:600px) { .language-selector { margin-inline-start: 0; } }' });
    await assert.rejects(() => checkMenu(page), /language menu clipped or covered/);
  });
});
