// SEO / share-metadata helpers (#51).
//
// 정적 public 페이지(index.html, archive.html)와 sitemap.xml이 공유하는 사이트 절대 URL과
// preview image, 그리고 정적 sitemap 생성 / 필수 메타 태그 점검 로직을 한곳에 모은다.
//
// 메타 점검은 속성 순서에 의존하지 않도록 head의 <meta>/<link> 태그를 파싱해서 본다.
// sitemap은 발행 데이터(newsletters.json/weekly)에 결합하지 않는 안정적인 진입점(index, archive)
// 목록으로 유지한다 — 발행/정리 흐름 어디서 데이터가 바뀌어도 sitemap은 stale되지 않는다.
// issue별 enumeration은 weekly 데이터·publish 커밋 경로와 함께 다루는 별도 슬라이스로 둔다.

const SITE_BASE_URL = 'https://ttolsun.github.io/camera-hal-sw-newsletter/';
const DEFAULT_OG_IMAGE = `${SITE_BASE_URL}assets/images/brand/HALley.png`;

// 모든 public HTML page가 가져야 하는 share/SEO 메타. title/description은 기존에 존재하므로
// 점검 대상은 canonical + Open Graph + Twitter card 세트다.
const REQUIRED_SEO_TAGS = Object.freeze([
  'canonical',
  'og:title',
  'og:description',
  'og:type',
  'og:url',
  'og:image',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image'
]);

function absoluteUrl(relativePath = '') {
  const trimmed = String(relativePath || '').trim().replace(/^\/+/, '');
  return `${SITE_BASE_URL}${trimmed}`;
}

function xmlEscape(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function urlElement({ loc, lastmod }) {
  const lines = ['  <url>', `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${xmlEscape(lastmod)}</lastmod>`);
  lines.push('  </url>');
  return lines.join('\n');
}

function renderSitemapXml(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(urlElement),
    '</urlset>',
    ''
  ].join('\n');
}

// 안정적인 두 진입점만 담는 정적 sitemap. 발행 데이터가 없을 때의 기준이다.
function buildStaticSitemap() {
  return renderSitemapXml([
    { loc: SITE_BASE_URL },
    { loc: `${SITE_BASE_URL}archive.html` }
  ]);
}

// index + archive + 각 weekly 발행물을 enumerate한다. 발행물 목록은 라이브 사이트가 쓰는
// data/newsletters-weekly.json 항목(weeklyKey/html/weekEndDate)을 그대로 받는다.
function buildSitemap(weeklyIssues = []) {
  const issues = Array.isArray(weeklyIssues) ? weeklyIssues : [];
  const entries = [
    { loc: SITE_BASE_URL },
    { loc: `${SITE_BASE_URL}archive.html` }
  ];
  for (const issue of issues) {
    const html = String(issue?.html || '').trim();
    if (!html) continue;
    entries.push({
      loc: absoluteUrl(html),
      lastmod: String(issue.weekEndDate || issue.date || '').trim()
    });
  }
  return renderSitemapXml(entries);
}

// head의 <meta>/<link> 태그를 {element, attrs} 목록으로 파싱한다(속성 순서 무관).
function parseHeadTags(html = '') {
  const tags = [];
  const tagPattern = /<(meta|link)\b([^>]*?)\/?>/gi;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const attrs = {};
    const attrPattern = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
    let attr;
    while ((attr = attrPattern.exec(match[2])) !== null) {
      attrs[attr[1].toLowerCase()] = attr[2];
    }
    tags.push({ element: match[1].toLowerCase(), attrs });
  }
  return tags;
}

// 각 share 태그를 어떻게 찾고 어디서 값을 읽는지 기술한다.
function tagDescriptor(tag) {
  if (tag === 'canonical') {
    return { element: 'link', keyAttr: 'rel', keyValue: 'canonical', valueAttr: 'href' };
  }
  if (tag.startsWith('og:')) {
    return { element: 'meta', keyAttr: 'property', keyValue: tag, valueAttr: 'content' };
  }
  // twitter:* 는 name= 으로 표기한다.
  return { element: 'meta', keyAttr: 'name', keyValue: tag, valueAttr: 'content' };
}

function tagValue(html, tag) {
  const descriptor = tagDescriptor(tag);
  for (const parsed of parseHeadTags(html)) {
    if (parsed.element !== descriptor.element) continue;
    if (parsed.attrs[descriptor.keyAttr] !== descriptor.keyValue) continue;
    return String(parsed.attrs[descriptor.valueAttr] || '').trim();
  }
  return '';
}

// 태그가 존재하고 값(href/content)이 비어 있지 않으면 present로 본다.
function hasTag(html, tag) {
  return tagValue(html, tag).length > 0;
}

function missingSeoTags(html = '') {
  return REQUIRED_SEO_TAGS.filter(tag => !hasTag(html, tag));
}

// canonical은 href, og:image 등은 content URL을 순서 무관하게 돌려준다.
function seoTagUrl(html, tag) {
  return tagValue(html, tag);
}

module.exports = {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE,
  REQUIRED_SEO_TAGS,
  absoluteUrl,
  buildStaticSitemap,
  buildSitemap,
  parseHeadTags,
  missingSeoTags,
  seoTagUrl
};
