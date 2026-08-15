// SEO / share-metadata 검증 (#51).
// 정적 public 페이지의 필수 메타 태그(절대 URL 포함)와 sitemap.xml, robots.txt를 점검한다.
// 메타 점검은 속성 순서에 의존하지 않는다. sitemap은 발행 데이터와 독립적인 stable entry와
// weekly issue를 함께 담으며, 여기서는 구조와 필수 stable entry를 검증한다.

const fs = require('fs');
const path = require('path');

const {
  SITE_BASE_URL,
  AI_ENGINEERING_LEARNING_PATH,
  missingSeoTags,
  seoTagUrl
} = require('../render/seo-metadata');
const {
  publicAssetPath
} = require('../../shared/common/artifact-paths');

const root = process.cwd();
const errors = [];

const STATIC_PAGES = ['index.html', 'archive.html', `${AI_ENGINEERING_LEARNING_PATH}index.html`];
const ABSOLUTE_URL_TAGS = ['canonical', 'og:image', 'og:url'];

function checkStaticPageMeta() {
  for (const page of STATIC_PAGES) {
    // index.html은 루트, 그 외 public page는 articles/ 아래에 있다.
    const filePath = publicAssetPath(root, page);
    if (!fs.existsSync(filePath)) {
      errors.push(`${page}: 파일이 없어 SEO 메타를 검증할 수 없습니다.`);
      continue;
    }
    const html = fs.readFileSync(filePath, 'utf8');
    const missing = missingSeoTags(html);
    if (missing.length > 0) {
      errors.push(`${page}: 필수 share/SEO 메타 태그가 없습니다: ${missing.join(', ')}`);
    }
    for (const tag of ABSOLUTE_URL_TAGS) {
      const url = seoTagUrl(html, tag);
      if (url && !/^https:\/\//i.test(url)) {
        errors.push(`${page}: ${tag}는 GitHub Pages에서 접근 가능한 절대 URL(https://)이어야 합니다: ${url}`);
      }
    }
  }
}

// sitemap은 발행 흐름에서 재생성되므로 데이터와의 byte 동기를 강제하지 않는다(다양한 편집
// 경로에서 깨지지 않도록). 대신 구조만 검증한다: 유효한 urlset, 안정적인 진입점 포함,
// 모든 <loc>가 사이트 base 아래의 절대 https URL.
function checkSitemap() {
  const file = path.join(root, 'articles', 'sitemap.xml');
  if (!fs.existsSync(file)) {
    errors.push('sitemap.xml이 없습니다.');
    return;
  }
  const xml = fs.readFileSync(file, 'utf8');
  if (!xml.includes('<urlset') || !xml.includes('http://www.sitemaps.org/schemas/sitemap/0.9')) {
    errors.push('sitemap.xml이 유효한 urlset 문서가 아닙니다.');
    return;
  }
  const requiredEntries = [
    SITE_BASE_URL,
    `${SITE_BASE_URL}archive.html`,
    `${SITE_BASE_URL}${AI_ENGINEERING_LEARNING_PATH}`
  ];
  for (const entry of requiredEntries) {
    if (!xml.includes(`<loc>${entry}</loc>`)) {
      errors.push(`sitemap.xml은 stable public entry를 포함해야 합니다: ${entry}`);
    }
  }
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]);
  for (const loc of locs) {
    if (!loc.startsWith(SITE_BASE_URL)) {
      errors.push(`sitemap.xml의 모든 URL은 ${SITE_BASE_URL} 아래의 절대 URL이어야 합니다: ${loc}`);
    }
  }
}

function checkRobots() {
  const file = path.join(root, 'articles', 'robots.txt');
  if (!fs.existsSync(file)) {
    errors.push('robots.txt가 없습니다.');
    return;
  }
  const robots = fs.readFileSync(file, 'utf8');
  if (!robots.includes(`Sitemap: ${SITE_BASE_URL}sitemap.xml`)) {
    errors.push(`robots.txt는 "Sitemap: ${SITE_BASE_URL}sitemap.xml"을 참조해야 합니다.`);
  }
}

checkStaticPageMeta();
checkSitemap();
checkRobots();

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('SEO metadata validation passed.');