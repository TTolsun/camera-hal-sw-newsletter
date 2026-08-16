// devsite 문서(source.android.com, developer.android.com 등)의 heading 단위 섹션 파싱(공용).
// 어떤 섹션을 남길지는 호출자가 sectionPattern으로 정한다 — 자격(이 페이지가 이 문서 유형이
// 맞는가) 판정은 각 adapter가 URL로 한다. 이 모듈은 본문에서 무엇을 뽑을지만 안다.
const { decodeHtml } = require('../common/common');
const { hashText } = require('../common/source-identity');
const { normalizeOutgoingLinks } = require('./outgoing-links');

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

// 자격 판정에 어디까지 넣을지는 문서 유형마다 다르다.
// - 'heading_and_text'(기본): heading과 섹션 본문을 합쳐서 검사한다. ITS 릴리스 노트는 섹션
//   제목이 일반적이어도("Miscellaneous changes" 등) 본문이 테스트/시나리오 어휘를 담으면
//   릴리스 내용이 맞다 — 원래 ITS 루프가 하던 대로 본문까지 봐야 그런 섹션을 놓치지 않는다.
// - 'heading': heading만 검사한다. devsite feature 페이지처럼 무관한 절이 'camera' 같은
//   단어를 스치기만 해도(예: "unrelated to camera pipeline") 누수되는 문서에서 쓴다 —
//   feature 페이지는 섹션 제목 자체가 주제를 정확히 담고 있어 heading만으로 충분하다.
const SECTION_PATTERN_SCOPES = {
  heading_and_text: (heading, sectionText) => `${heading} ${sectionText}`,
  heading: (heading) => heading
};

/**
 * devsite 문서의 본문 컨테이너(article/devsite-content)를 heading 단위로 순회해 섹션을 뽑는다.
 * 문서 제목(h1)은 섹션이 아니라 페이지 이름이므로 건너뛰고, sectionPattern에 걸리는
 * 섹션만 sectionLimit개까지 남긴다.
 */
function extractHeadingSections(html, pageUrl, { sectionPattern, sectionLimit, sectionPatternScope = 'heading_and_text' }) {
  const matchText = SECTION_PATTERN_SCOPES[sectionPatternScope];
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
    if (!sectionPattern.test(matchText(heading, sectionText))) continue;
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

/**
 * 스냅샷에 저장할 섹션 지문(제목 + 내용 해시). 다음 실행에서 무엇이 바뀌었는지 가리는 데 쓴다.
 * 문장·링크는 빼서 스냅샷이 커지지 않게 한다. 지문 형태는 문서 유형과 무관하게 동일하다.
 */
function headingSectionFingerprint(extract) {
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
 *
 * 증거의 이름표(version_or_release·api_or_component)는 extract가 들고 온다. 여기서 특정
 * 문서 유형의 이름을 박으면 다른 유형의 문서 변화가 그 이름으로 잘못 보고된다
 * (feature 페이지 변화가 'Camera ITS / CTS Verifier'로 나가던 결함).
 */
function changedSectionEvidence(extract, previousSections = []) {
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

  return {
    version_or_release: extract.version_or_release || extract.release,
    api_or_component: extract.api_or_component || '',
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
  changedSectionEvidence,
  extractHeadingSections,
  headingSectionFingerprint,
  pageTitle,
  articleBody,
  text
};
