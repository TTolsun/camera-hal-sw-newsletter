// devsite 문서(source.android.com, developer.android.com 등)의 heading 단위 섹션 파싱(공용).
// 어떤 섹션을 남길지는 호출자가 sectionPattern으로 정한다 — 자격(이 페이지가 이 문서 유형이
// 맞는가) 판정은 각 adapter가 URL로 한다. 이 모듈은 본문에서 무엇을 뽑을지만 안다.
const { decodeHtml } = require('../common/common');
const { hashText } = require('../common/source-identity');

// devsite가 모든 문서 제목 옆에 붙이는 안내 문구. 문서 내용이 아니므로 증거에서 뺀다.
const DEVSITE_BOILERPLATE_PATTERN =
  /\bStay organized with collections\b[\s\S]*?\bbased on your preferences\.?/i;
const HEADING_PATTERN = /<(h[1-4])([^>]*)>([\s\S]*?)<\/\1>/gi;
// 본문 컨테이너. devsite 페이지에는 좌측 book nav와 사이드바 heading이 함께 있어서
// 문서 전체를 훑으면 내비게이션 문구가 섹션 자리를 차지한다.
const ARTICLE_BODY_PATTERN = /<article\b[^>]*>([\s\S]*?)<\/article>/i;
const DEVSITE_CONTENT_PATTERN = /<devsite-content\b[^>]*>([\s\S]*?)<\/devsite-content>/i;

// 문장을 자르지 않고 통째로 버리는 규칙이라 상한이 낮으면 알맹이가 통째로 사라진다
// (라이브 실측: 상한 200에서 New tests 210자·Refactored tests 293자·Gen2 rig updates 203자가
// 제목만 남았다). 실제 문서 문장이 들어갈 만큼 잡고, 그보다 긴 비정상 문장만 버린다.
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

/**
 * devsite 문서의 본문 컨테이너(article/devsite-content)를 heading 단위로 순회해 섹션을 뽑는다.
 * 문서 제목(h1)은 섹션이 아니라 페이지 이름이므로 건너뛰고, sectionPattern에 걸리는
 * 섹션만 sectionLimit개까지 남긴다.
 */
function extractHeadingSections(html, pageUrl, { sectionPattern, sectionLimit }) {
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
    // heading만으로 자격을 본다. 본문까지 훑으면 무관한 문단이 어휘 하나를 우연히 포함할 때
    // (예: "unrelated to camera pipeline") 엉뚱한 섹션이 섞여 들어온다.
    if (!sectionPattern.test(heading)) continue;
    const id = headingId(current[2]);
    sections.push({
      heading,
      sentence: firstSentence(sectionHtml),
      hash: hashText(`${heading}\n${sectionText}`, SECTION_HASH_LENGTH),
      url: id && pageUrl ? `${String(pageUrl).replace(/#.*$/, '')}#${id}` : ''
    });
    if (sections.length >= sectionLimit) break;
  }
  return sections;
}

module.exports = {
  extractHeadingSections,
  pageTitle,
  articleBody,
  text
};
