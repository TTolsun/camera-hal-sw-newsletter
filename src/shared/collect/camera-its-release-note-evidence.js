// Camera ITS 릴리스 노트 페이지에서 "무엇이 적혀 있나"를 뽑아 증거 필드로 만든다.
//
// 왜 별도 모듈인가: 소스 모니터는 "언제 바뀌었나"를 정확히 알지만(정규화 본문 해시 비교),
// 후보를 만들 때 api_or_component/behavior_change에 'Camera source snapshot change' 같은
// 자리표시자만 넣는다. 그래서 이 페이지가 진짜로 바뀐 주에도 기사는 내용이 없다.
// 반대로 수집 파서는 내용을 읽을 수 있지만 변화 여부를 모른다 — 날짜만 바뀐 날에도 후보를
// 만들어 "아무것도 안 바뀐 날"을 그 주의 사건으로 발행하게 된다(2026-08-06이 정확히 그런 날:
// visible_last_updated는 07-31에서 08-06으로 움직였지만 정규화 본문 해시는 동일했다).
//
// 그래서 판정은 모니터에 두고, 이 모듈은 내용 추출만 한다. 모니터가 content-change 이벤트를
// 낼 때 이 증거를 실어 보낸다. 순환 의존을 만들지 않도록 모니터·파서 어느 쪽에도 의존하지 않는다.
const { decodeHtml } = require('../common/common');

// 자격은 URL로 정한다. 본문에 'Camera ITS'가 있는지로 판정하면 같은 소스의 랜딩 페이지나
// Camera ITS를 언급하는 다른 감시 문서까지 "릴리스 노트"라고 주장하게 된다.
const RELEASE_NOTES_URL_PATTERN = /\/compatibility\/cts\/its-release-notes-\d+(?:[/?#]|$)/i;
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

const SECTION_LIMIT = 8;
const SENTENCE_LIMIT = 200;

function text(value = '') {
  return decodeHtml(
    String(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
  )
    .replace(DEVSITE_BOILERPLATE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    if (!RELEASE_SECTION_PATTERN.test(`${heading} ${text(sectionHtml)}`)) continue;
    const id = headingId(current[2]);
    sections.push({
      heading,
      sentence: firstSentence(sectionHtml),
      url: id && pageUrl ? `${String(pageUrl).replace(/#.*$/, '')}#${id}` : ''
    });
    if (sections.length >= SECTION_LIMIT) break;
  }
  return sections;
}

/**
 * Camera ITS 릴리스 노트 페이지면 증거 필드를 돌려주고, 아니면 null.
 * 날짜는 넣지 않는다 — 사건의 날짜는 모니터가 정한다.
 */
function cameraItsReleaseNoteEvidence(html = '', pageUrl = '') {
  if (!RELEASE_NOTES_URL_PATTERN.test(String(pageUrl))) return null;

  const release = (text(html).match(RELEASE_TITLE_PATTERN) || [])[0];
  if (!release) return null;

  const sections = releaseSections(html, pageUrl);
  if (sections.length === 0) return null;

  return {
    version_or_release: `${release} release notes`,
    api_or_component: 'Camera ITS / CTS Verifier',
    // 섹션 경계에서만 자른다. 문자 수로 자르면 부분 문장이 증거로 남는다.
    behavior_change: sections
      .map(section => (section.sentence ? `${section.heading}: ${section.sentence}` : section.heading))
      .join(' '),
    // outgoing-links 계층은 링크 레코드를 받는다. 문자열을 넣으면 증거로 보이지만 조용히 버려진다.
    section_links: sections
      .filter(section => section.url)
      .map(section => ({
        url: section.url,
        text: section.heading,
        source_field: 'release_note_section',
        extraction_method: 'heading_anchor'
      }))
  };
}

module.exports = {
  RELEASE_NOTES_URL_PATTERN,
  SECTION_LIMIT,
  cameraItsReleaseNoteEvidence
};
