// developer.android.com 버전별 feature 페이지에서 카메라 관련 섹션만 뽑는다.
// 자격은 URL로 정한다(본문 내용으로 판정하면 다른 감시 문서까지 feature 페이지라고 주장하게 된다).
const { extractHeadingSections } = require('./document-section-parsing');

const FEATURE_PAGE_HOST = 'developer.android.com';
const FEATURE_PAGE_PATH_PATTERN = /^\/about\/versions\/(\d+)\/features$/;
// 카메라 실무 어휘만 명시적으로 나열한다. 넓은 토큰(sensor 단독 등)은 누수 위험으로 넣지 않는다.
const CAMERA_SECTION_PATTERN =
  /\b(camera|camerax|ultra\s?hdr|jpeg[_\s]?r|auto[-\s]?exposure|white\s?balance|color\s(temperature|correction)|raw1[024]|night\smode|motion\sphoto)\b/i;
const SECTION_LIMIT = 24;

function featurePageVersion(pageUrl) {
  try {
    const url = new URL(pageUrl);
    if (url.hostname !== FEATURE_PAGE_HOST) return null;
    const match = url.pathname.match(FEATURE_PAGE_PATH_PATTERN);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function devsiteFeaturePageExtract(html = '', pageUrl = '') {
  const version = featurePageVersion(pageUrl);
  if (!version) return null;
  const sections = extractHeadingSections(html, pageUrl, {
    sectionPattern: CAMERA_SECTION_PATTERN,
    sectionLimit: SECTION_LIMIT
  });
  return sections.length > 0 ? { release: `Android ${version} features`, sections } : null;
}

module.exports = { devsiteFeaturePageExtract };
