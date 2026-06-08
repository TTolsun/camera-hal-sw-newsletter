// SEO / share-metadata 검증 (#51).
// 정적 public 페이지의 필수 메타 태그(절대 URL 포함)와 정적 sitemap.xml, robots.txt를 점검한다.
// 메타 점검은 속성 순서에 의존하지 않는다. sitemap은 발행 데이터에 결합하지 않는 정적 진입점
// 목록이므로 buildStaticSitemap()과 byte 단위로 동기 여부만 본다(데이터 변경에 깨지지 않음).
// 기사 페이지(renderer) 메타와 issue별 sitemap enumeration은 후속 슬라이스 범위.

const fs = require('fs');
const path = require('path');

const {
  SITE_BASE_URL,
  missingSeoTags,
  seoTagUrl,
  buildStaticSitemap
} = require('../render/seo-metadata');

const root = process.cwd();
const errors = [];

const STATIC_PAGES = ['index.html', 'archive.html'];
const ABSOLUTE_URL_TAGS = ['canonical', 'og:image', 'og:url'];

function checkStaticPageMeta() {
  for (const page of STATIC_PAGES) {
    const filePath = path.join(root, page);
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

function checkSitemap() {
  const file = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(file)) {
    errors.push('sitemap.xml이 없습니다.');
    return;
  }
  const committed = fs.readFileSync(file, 'utf8');
  if (committed !== buildStaticSitemap()) {
    errors.push('sitemap.xml이 정적 sitemap 정책과 다릅니다. seo-metadata.js의 buildStaticSitemap() 출력으로 맞추세요.');
  }
}

function checkRobots() {
  const file = path.join(root, 'robots.txt');
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
