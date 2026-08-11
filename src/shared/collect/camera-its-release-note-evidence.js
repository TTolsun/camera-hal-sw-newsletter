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
const { decodeHtml } = require('../common/common');
const { hashText } = require('../common/source-identity');
const { normalizeOutgoingLinks } = require('./outgoing-links');

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
// devsite가 모든 문서 제목 옆에 붙이는 안내 문구. 릴리스 내용이 아니므로 증거에서 뺀다.
const DEVSITE_BOILERPLATE_PATTERN =
  /\bStay organized with collections\b[\s\S]*?\bbased on your preferences\.?/i;
const HEADING_PATTERN = /<(h[1-4])([^>]*)>([\s\S]*?)<\/\1>/gi;
// 본문 컨테이너. devsite 페이지에는 좌측 book nav와 사이드바 heading이 함께 있어서
// 문서 전체를 훑으면 내비게이션 문구가 릴리스 섹션 자리를 차지한다.
const ARTICLE_BODY_PATTERN = /<article\b[^>]*>([\s\S]*?)<\/article>/i;
const DEVSITE_CONTENT_PATTERN = /<devsite-content\b[^>]*>([\s\S]*?)<\/devsite-content>/i;

// 라이브 its-release-notes-17의 본문 섹션은 11개다. 상한이 그보다 낮으면 뒤쪽 섹션이
// 조용히 빠진다 — "빌드 승인용 결과 일괄 제출"처럼 인증 워크플로가 통째로 바뀌는 항목이
// 문서 끝에 온다. 문서 한 장을 덮도록 여유를 둔다.
const SECTION_LIMIT = 12;
// 문장을 자르지 않고 통째로 버리는 규칙이라 상한이 낮으면 알맹이가 통째로 사라진다
// (라이브 실측: 상한 200에서 New tests 210자·Refactored tests 293자·Gen2 rig updates 203자가
// 제목만 남았다). 실제 릴리스 노트 문장이 들어갈 만큼 잡고, 그보다 긴 비정상 문장만 버린다.
const SENTENCE_LIMIT = 320;
const SECTION_HASH_LENGTH = 16;

function text(value = '') {
  return decodeHtml(
    String(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
  )
    // 공백을 먼저 접은 뒤에 안내 문구를 지운다. 순서가 반대면 문구가 태그로 쪼개져 있을 때
    // 정규식이 빗나가 devsite 안내 문구가 증거에 남는다.
    .replace(DEVSITE_BOILERPLATE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isReleaseNotesUrl(pageUrl = '') {
  try {
    const parsed = new URL(String(pageUrl));
    return parsed.hostname.toLowerCase() === RELEASE_NOTES_HOST &&
      RELEASE_NOTES_PATH_PATTERN.test(parsed.pathname.replace(/\/$/, ''));
  } catch {
    return false;
  }
}

function articleBody(html = '') {
  const article = ARTICLE_BODY_PATTERN.exec(String(html));
  if (article) return article[1];
  const content = DEVSITE_CONTENT_PATTERN.exec(String(html));
  return content ? content[1] : String(html);
}

function headingId(attrs = '') {
  const match = /\bid="([^"]+)"/i.exec(String(attrs));
  return match ? match[1] : '';
}

// 상한을 넘는 문장은 자르지 않고 버린다. 중간에서 자르면 조건이나 부정이 잘린 부분 문장이
// 그대로 증거가 되어 기사에 실린다(짓느니 빠뜨린다).
function firstSentence(value = '') {
  const body = text(value);
  if (!body) return '';
  const [sentence] = body.split(/(?<=\.)\s+/);
  const picked = sentence || body;
  return picked.length > SENTENCE_LIMIT ? '' : picked;
}

function pageTitle(html = '') {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html));
  return match ? text(match[1].split('|')[0]) : '';
}

function releaseSections(html, pageUrl) {
  const body = articleBody(html);
  const matches = [...String(body).matchAll(HEADING_PATTERN)];
  const documentTitle = pageTitle(html);
  const sections = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = current.index + current[0].length;
    const end = next ? next.index : String(body).length;
    const heading = text(current[3]);
    // 문서 제목(h1)은 섹션이 아니라 페이지 이름이다. 같은 텍스트를 증거에 또 싣지 않는다.
    if (!heading || heading === documentTitle) continue;
    const sectionHtml = String(body).slice(start, Math.min(end, start + 3500));
    const sectionText = text(sectionHtml);
    if (!RELEASE_SECTION_PATTERN.test(`${heading} ${sectionText}`)) continue;
    const id = headingId(current[2]);
    sections.push({
      heading,
      sentence: firstSentence(sectionHtml),
      hash: hashText(`${heading}\n${sectionText}`, SECTION_HASH_LENGTH),
      url: id && pageUrl ? `${String(pageUrl).replace(/#.*$/, '')}#${id}` : ''
    });
    if (sections.length >= SECTION_LIMIT) break;
  }
  return sections;
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

  const sections = releaseSections(html, pageUrl);
  return sections.length > 0 ? { release, sections } : null;
}

/**
 * 스냅샷에 저장할 섹션 지문(제목 + 내용 해시). 다음 실행에서 무엇이 바뀌었는지 가리는 데 쓴다.
 * 문장·링크는 빼서 스냅샷이 커지지 않게 한다.
 */
function cameraItsReleaseNoteFingerprint(extract) {
  return (extract?.sections || []).map(section => ({
    heading: section.heading,
    hash: section.hash
  }));
}

/**
 * 직전 관측 대비 새로 생겼거나 내용이 바뀐 섹션만 증거로 만든다.
 * 바뀐 섹션이 없거나 비교 대상이 없으면 null.
 *
 * previousSections가 비어 있으면(최초 관측) 비교 대상이 없으므로 null을 돌려준다 —
 * 그 상태에서 문서 전체를 "이번 변화"로 싣는 것이 정확히 과다 주장이다.
 */
function cameraItsReleaseNoteEvidence(extract, previousSections = []) {
  if (!extract?.release || !Array.isArray(extract.sections)) return null;

  const previousByHeading = new Map(
    (Array.isArray(previousSections) ? previousSections : [])
      .filter(section => section && section.heading)
      .map(section => [section.heading, section.hash])
  );
  if (previousByHeading.size === 0) return null;

  const changed = extract.sections
    .filter(section => previousByHeading.get(section.heading) !== section.hash);
  if (changed.length === 0) return null;

  const release = extract.release;
  return {
    version_or_release: `${release} release notes`,
    api_or_component: 'Camera ITS / CTS Verifier',
    // 바뀐 섹션만, 섹션 경계에서만 자른다. 문서 전체를 실으면 이번 주에 바뀌지 않은 섹션까지
    // 그 주의 변화로 발행된다.
    behavior_change: changed
      .map(section => (section.sentence ? `${section.heading}: ${section.sentence}` : section.heading))
      .join(' '),
    changed_section_headings: changed.map(section => section.heading),
    // 링크 레코드는 정본 빌더로 만든다. 손으로 만들면 evidence_role이 빠져 계약이 둘로 갈린다.
    section_links: normalizeOutgoingLinks(
      changed
        .filter(section => section.url)
        .map(section => ({
          url: section.url,
          text: section.heading,
          source_field: 'release_note_section',
          extraction_method: 'heading_anchor'
        }))
    )
  };
}

module.exports = {
  SECTION_LIMIT,
  cameraItsReleaseNoteEvidence,
  cameraItsReleaseNoteExtract,
  cameraItsReleaseNoteFingerprint
};
