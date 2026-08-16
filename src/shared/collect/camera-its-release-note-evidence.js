// Camera ITS 릴리스 노트 페이지에서 "무엇이 적혀 있나"를 뽑고, 직전 관측과 비교해
// "이번에 무엇이 바뀌었나"만 증거로 만든다.
//
// 왜 별도 모듈인가: 소스 모니터는 "언제 바뀌었나"를 정확히 알지만(정규화 본문 해시 비교),
// 후보를 만들 때 api_or_component/behavior_change에 'Camera source snapshot change' 같은
// 자리표시자만 넣는다. 그래서 이 페이지가 진짜로 바뀐 주에도 기사는 내용이 없다.
// 반대로 수집 파서는 내용을 읽을 수 있지만 변화 여부를 모른다 — 날짜만 바뀐 날에도 후보를
// 만들어 "아무것도 안 바뀐 날"을 그 주의 사건으로 발행하게 된다(2026-08-06이 정확히 그런 날:
// visible_last_updated는 07-31에서 08-06으로 움직였지만 정규화 본문 해시는 동일했다).
//
// 그래서 판정은 모니터에 두고, 이 모듈은 내용 추출과 섹션 단위 비교만 한다.
// 순환 의존을 만들지 않도록 모니터·파서 어느 쪽에도 의존하지 않는다.
const {
  changedSectionEvidence,
  extractHeadingSections,
  headingSectionFingerprint,
  pageTitle,
  articleBody,
  text
} = require('./document-section-parsing');

// 자격은 host와 경로로 정한다. 본문에 'Camera ITS'가 있는지로 판정하면 같은 소스의 랜딩
// 페이지나 Camera ITS를 언급하는 다른 감시 문서까지 "릴리스 노트"라고 주장하게 된다.
const RELEASE_NOTES_HOST = 'source.android.com';
const RELEASE_NOTES_PATH_PATTERN = /^\/docs\/compatibility\/cts\/its-release-notes-\d+$/i;
// 릴리스 노트 제목은 문서 안에서 정확한 형태로 나온다. 페이지 전체에서 'Android \d+'를
// 아무거나 집으면 nav/footer에 남은 옛 버전이 릴리스 이름으로 둔갑한다.
const RELEASE_TITLE_PATTERN = /\bAndroid\s+\d+\s+Camera\s+Image\s+Test\s+Suite\b/i;
// Camera ITS 릴리스 노트 섹션에서 카메라 인증 실무와 닿는 것만 남긴다.
// devsite 공통 푸터(Build / Connect / Get help)는 이 어휘에 걸리지 않는다.
const RELEASE_SECTION_PATTERN =
  /\b(?:test|tests|scene|scenes|rig|chart|tablet|activit(?:y|ies)|status|camera|package|version|deprecat|result)\b/i;
// 이 문서 유형이 무엇에 대한 변화인지를 가리키는 이름표. 증거 빌더는 이 값을 그대로 쓴다 —
// 이름표를 빌더에 박아 두면 다른 문서 유형의 변화까지 Camera ITS 변화라고 주장하게 된다.
const API_OR_COMPONENT = 'Camera ITS / CTS Verifier';

// 라이브 its-release-notes-17의 본문 섹션은 11개다. 상한이 그보다 낮으면 뒤쪽 섹션이
// 조용히 빠진다 — "빌드 승인용 결과 일괄 제출"처럼 인증 워크플로가 통째로 바뀌는 항목이
// 문서 끝에 온다. 문서 한 장을 덮도록 여유를 둔다.
const SECTION_LIMIT = 12;

function isReleaseNotesUrl(pageUrl = '') {
  try {
    const parsed = new URL(String(pageUrl));
    return parsed.hostname.toLowerCase() === RELEASE_NOTES_HOST &&
      RELEASE_NOTES_PATH_PATTERN.test(parsed.pathname.replace(/\/$/, ''));
  } catch {
    return false;
  }
}

/**
 * 릴리스 노트 페이지면 릴리스 이름과 섹션 목록을 뽑고, 아니면 null.
 * 관측 시점에 한 번만 계산해 지문(영속)과 증거(휘발) 양쪽에 쓴다.
 */
function cameraItsReleaseNoteExtract(html = '', pageUrl = '') {
  if (!isReleaseNotesUrl(pageUrl)) return null;

  // 문서 제목을 먼저 본다. 본문 전체를 훑으면 nav에 남은 옛 버전 제목이 먼저 잡힐 수 있다.
  const release = (pageTitle(html).match(RELEASE_TITLE_PATTERN) || [])[0] ||
    (text(articleBody(html)).match(RELEASE_TITLE_PATTERN) || [])[0];
  if (!release) return null;

  // 섹션 제목이 일반적이어도("Miscellaneous changes" 등) 본문이 테스트/시나리오 어휘를
  // 담으면 릴리스 내용이 맞다. heading만 보면 그런 섹션을 놓친다 — 원래 루프대로 본문까지 본다.
  const sections = extractHeadingSections(html, pageUrl, {
    sectionPattern: RELEASE_SECTION_PATTERN,
    sectionLimit: SECTION_LIMIT,
    sectionPatternScope: 'heading_and_text'
  });
  return sections.length > 0
    ? {
        release,
        // 증거 이름표를 extract가 들고 다닌다(문서 유형별 adapter가 유일한 출처).
        version_or_release: `${release} release notes`,
        api_or_component: API_OR_COMPONENT,
        section_link_source_field: 'release_note_section',
        sections
      }
    : null;
}

/**
 * 스냅샷에 저장할 섹션 지문. 형태는 문서 유형과 무관하므로 공용 구현을 그대로 쓴다.
 */
function cameraItsReleaseNoteFingerprint(extract) {
  return headingSectionFingerprint(extract);
}

/**
 * 직전 관측 대비 바뀐 섹션만 증거로 만든다. 판정·형식은 공용 구현이 하고, 이름표는 위 extract가 준다.
 */
function cameraItsReleaseNoteEvidence(extract, previousSections = []) {
  return changedSectionEvidence(extract, previousSections);
}

module.exports = {
  API_OR_COMPONENT,
  SECTION_LIMIT,
  cameraItsReleaseNoteEvidence,
  cameraItsReleaseNoteExtract,
  cameraItsReleaseNoteFingerprint
};
