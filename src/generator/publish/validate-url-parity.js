// URL parity 안전망(#262 phase 6).
//
// 공개 출력물을 articles/로 이동한 뒤에도 서빙 URL이 보존되는지(404 없음) 검증한다.
// assembleSite()를 임시 디렉터리에 조립한 다음, 이동 전에 존재하던 공개 URL 집합
// (articles/sitemap.xml의 <loc> + 알려진 top-level 페이지)이 각각 조립된 _site/ 안에서
// 실제 backing file로 해석되는지 확인한다. 하나라도 backing file이 없으면 실패한다.
//
// 순수 정적 검사다(네트워크/API 호출 없음).

const fs = require('fs');
const os = require('os');
const path = require('path');

const { assembleSite } = require('./assemble-site');
const { SITE_BASE_URL } = require('../render/seo-metadata');

// 이동 전부터 site root에서 서빙되던 알려진 top-level 진입점.
// (sitemap에 항상 enumerate되지는 않지만 반드시 서빙되어야 하는 URL들)
const KNOWN_TOP_LEVEL_URLS = [
  '/',
  '/index.html',
  '/archive.html',
  '/robots.txt',
  '/sitemap.xml',
  '/data/newsletters.json',
  '/data/newsletters-weekly.json',
  // index.html이 fetch하는 진입점들(이동 후 stranded 회귀 방지).
  // /data/homepage-headline.json은 articles/data/에서, /config/subscription.json은
  // 저장소 config/에서 assemble-site.js의 EXTRA_SERVED_FILES로 _site에 복사된다.
  '/data/homepage-headline.json',
  '/config/subscription.json'
];

function sitemapPath(root) {
  return path.join(root, 'articles', 'sitemap.xml');
}

// articles/sitemap.xml의 <loc>를 읽어 site-root 기준 served path 목록으로 변환한다.
function servedPathsFromSitemap(root) {
  const file = sitemapPath(root);
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, 'utf8');
  const base = String(SITE_BASE_URL || '').replace(/\/+$/, '');
  const paths = [];
  const locPattern = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = locPattern.exec(xml)) !== null) {
    const loc = match[1].trim();
    let rel = loc;
    if (base && loc.startsWith(base)) {
      rel = loc.slice(base.length);
    } else {
      // 절대 URL이지만 base와 다른 경우(예외) 경로 부분만 추출한다.
      try {
        rel = new URL(loc).pathname;
      } catch (_) {
        rel = loc;
      }
    }
    if (!rel.startsWith('/')) rel = `/${rel}`;
    paths.push(rel);
  }
  return paths;
}

// 서빙 URL path -> 조립된 _site/ 안의 디스크 경로. '/'는 index.html로 해석한다.
function siteFilePath(siteDir, servedPath) {
  let rel = String(servedPath || '').split('?')[0].split('#')[0];
  rel = rel.replace(/^\/+/, '');
  if (rel === '' ) rel = 'index.html';
  if (rel.endsWith('/')) rel = `${rel}index.html`;
  return path.join(siteDir, ...rel.split('/'));
}

function validateUrlParity({ root = process.cwd() } = {}) {
  const expectedUrls = [...new Set([
    ...KNOWN_TOP_LEVEL_URLS,
    ...servedPathsFromSitemap(root)
  ])];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'url-parity-'));
  const errors = [];
  try {
    const { outDir } = assembleSite({ root, out: tmpDir });
    for (const url of expectedUrls) {
      const filePath = siteFilePath(outDir, url);
      if (!fs.existsSync(filePath)) {
        errors.push(`Served URL has no backing file in assembled _site: ${url} (expected ${path.relative(outDir, filePath)})`);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return { ok: errors.length === 0, errors, checkedUrls: expectedUrls };
}

function main() {
  const result = validateUrlParity({ root: process.cwd() });
  if (!result.ok) {
    console.error('URL parity check failed: the following pre-move public URLs would 404 after the articles/ move.');
    console.error(result.errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }
  console.log(`Validated URL parity for ${result.checkedUrls.length} public URLs.`);
}

if (require.main === module) {
  main();
}

module.exports = { validateUrlParity, servedPathsFromSitemap, siteFilePath, KNOWN_TOP_LEVEL_URLS };
