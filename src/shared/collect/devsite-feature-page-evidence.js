// developer.android.com 버전별 feature 페이지에서 카메라 관련 섹션만 뽑는다.
// 자격은 URL로 정한다(본문 내용으로 판정하면 다른 감시 문서까지 feature 페이지라고 주장하게 된다).
const { extractHeadingSections } = require('./document-section-parsing');

const FEATURE_PAGE_HOST = 'developer.android.com';
const FEATURE_PAGE_PATH_PATTERN = /^\/about\/versions\/(\d+)\/features$/;
// 카메라 실무 어휘만 명시적으로 나열한다. 넓은 토큰(sensor 단독 등)은 누수 위험으로 넣지 않는다.
const CAMERA_SECTION_PATTERN =
  /\b(camera|camerax|ultra\s?hdr|jpeg[_\s]?r|auto[-\s]?exposure|white\s?balance|color\s(temperature|correction)|raw1[024]|night\smode|motion\sphoto)\b/i;
const SECTION_LIMIT = 24;
// 이 문서가 무엇에 대한 변화인지를 가리키는 이름표. feature 페이지는 Camera ITS도
// CTS Verifier도 아니므로 그 이름을 쓰면 후보가 출처에 없는 주장을 달게 된다.
const API_OR_COMPONENT = 'Android platform camera features';

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
  // heading만 검사한다. 본문까지 보면 무관한 절이 'camera' 한 단어를 스치기만 해도
  // (예: "unrelated to camera pipeline") 엉뚱한 섹션이 섞여 들어온다 — feature 페이지는
  // 섹션 제목 자체가 주제를 정확히 담고 있어 heading만으로 충분하다.
  const sections = extractHeadingSections(html, pageUrl, {
    sectionPattern: CAMERA_SECTION_PATTERN,
    sectionLimit: SECTION_LIMIT,
    sectionPatternScope: 'heading'
  });
  if (sections.length === 0) return null;
  const release = `Android ${version} features`;
  return {
    release,
    // 증거 이름표를 extract가 들고 다닌다(문서 유형별 adapter가 유일한 출처).
    version_or_release: release,
    api_or_component: API_OR_COMPONENT,
    section_link_source_field: 'platform_feature_section',
    sections
  };
}

module.exports = { API_OR_COMPONENT, devsiteFeaturePageExtract };
