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

// Camera ITS 릴리스 노트 섹션에서 카메라 인증 실무와 닿는 것만 남긴다.
// devsite 공통 푸터(Build / Connect / Get help)는 이 어휘에 걸리지 않는다.
const RELEASE_SECTION_PATTERN =
  /\b(?:test|tests|scene|scenes|rig|chart|tablet|activit(?:y|ies)|status|camera|package|version|deprecat|result)\b/i;
// devsite가 모든 문서 제목 옆에 붙이는 안내 문구. 릴리스 내용이 아니므로 증거에서 뺀다.
const DEVSITE_BOILERPLATE_PATTERN =
  /\bStay organized with collections\b[\s\S]*?\bbased on your preferences\.?/i;
const HEADING_PATTERN = /<(h[1-4])([^>]*)>([\s\S]*?)<\/\1>/gi;

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

function headingId(attrs = '') {
  const match = /\bid="([^"]+)"/i.exec(String(attrs));
  return match ? match[1] : '';
}

function firstSentence(value = '') {
  const body = text(value);
  if (!body) return '';
  const [sentence] = body.split(/(?<=\.)\s+/);
  const picked = sentence || body;
  return picked.length > SENTENCE_LIMIT ? `${picked.slice(0, SENTENCE_LIMIT).trim()}…` : picked;
}

function pageTitle(html = '') {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html));
  return match ? text(match[1].split('|')[0]) : '';
}

function releaseSections(html, pageUrl) {
  const matches = [...String(html).matchAll(HEADING_PATTERN)];
  const documentTitle = pageTitle(html);
  const sections = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = current.index + current[0].length;
    const end = next ? next.index : String(html).length;
    const heading = text(current[3]);
    // 문서 제목(h1)은 섹션이 아니라 페이지 이름이다. 같은 텍스트를 증거에 또 싣지 않는다.
    if (!heading || heading === documentTitle) continue;
    const body = String(html).slice(start, Math.min(end, start + 3500));
    if (!RELEASE_SECTION_PATTERN.test(`${heading} ${text(body)}`)) continue;
    const id = headingId(current[2]);
    sections.push({
      heading,
      sentence: firstSentence(body),
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
  const body = text(html);
  if (!/Camera ITS/i.test(body)) return null;

  const sections = releaseSections(html, pageUrl);
  if (sections.length === 0) return null;

  const release = (body.match(/\bAndroid\s+\d+\s+Camera\s+Image\s+Test\s+Suite\b/i) || [])[0] ||
    (body.match(/\bAndroid\s+\d+\b/i) || [])[0] ||
    'Android Camera ITS';

  return {
    version_or_release: `${release} release notes`,
    api_or_component: 'Camera ITS / CTS Verifier',
    // 섹션 경계에서만 자른다. 문자 수로 자르면 부분 문장이 증거로 남는다.
    behavior_change: sections
      .map(section => (section.sentence ? `${section.heading}: ${section.sentence}` : section.heading))
      .join(' '),
    section_links: sections.map(section => section.url).filter(Boolean)
  };
}

module.exports = {
  SECTION_LIMIT,
  cameraItsReleaseNoteEvidence
};
