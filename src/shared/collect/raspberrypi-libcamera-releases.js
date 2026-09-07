// Raspberry Pi 다운스트림 libcamera는 GitHub Releases(releases.atom)로 dated 릴리스를 낸다
// (upstream libcamera-devel 메일링에는 릴리스 공지가 없어 libcamera-release-announcements가
// 구조적으로 0건인 것과 대조). atom <entry> 블록에서 릴리스 태그를 뽑아 dated 후보를 만들되,
// 같은 릴리스의 중복 ref인 packaging/branch 태그(pios/*, upstream/*)는 제외한다.
const { decodeHtml } = require('../common/common');

const PACKAGING_PREFIX_PATTERN = /^(?:pios|upstream)\//i;
const RELEASE_VERSION_PATTERN = /v?\d+\.\d+(?:\.\d+)?/;
// 다른 수집 파서가 본문에서 summary를 뽑을 때 쓰는 것과 같은 상한이다
// (source-item-parsers.js의 `clean(body).slice(0, 500)`).
const SUMMARY_MAX_LENGTH = 500;

function entryBlocks(xml) {
  return String(xml).match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
}

function pick(pattern, block) {
  const match = block.match(pattern);
  return match ? decodeHtml(match[1]).replace(/\s+/g, ' ').trim() : '';
}

// 본문 없이 태그만 올린 릴리스에는 GitHub이 "No content." 리터럴을 싣는다(라이브 실측). 빈
// 문자열이 아니라서 그대로 쓰면 근거 유무 검사를 통과하면서 아무 사실도 전하지 않으므로,
// 없는 본문으로 취급해 호출부가 폴백하게 한다.
const EMPTY_BODY_PLACEHOLDER_PATTERN = /^no content\.?$/i;

// <content type="html">에는 릴리스 본문 HTML이 XML escape를 한 겹 쓰고 들어 있다. 그래서 세
// 단계다: XML escape를 **한 겹만** 벗겨 HTML을 되찾고 → 태그를 걷어내고 → 남은 HTML entity를 푼다.
//
// 한 겹만 벗기는 것이 핵심이다. decodeHtml은 치환을 순차 적용하므로(&amp; 먼저) 두 겹을 한 번에
// 내려버리고, 그러면 본문의 리터럴 꺾쇠(`Signed-off-by: … &lt;naush@…&gt;`)가 진짜 태그로 승격된 뒤
// 태그 제거에 삼켜진다. 태그를 **공백**으로 치환하는 것도 같은 이유다 — 빈 문자열로 지우면
// `now<br />embedded`에서 단어가 붙는다.
//
// 하류 normalizeCandidate는 이제 summary에 entity 해제를 다시 걸지 않고 마크업 제거만 한다(#975).
// 그래서 여기서 살려낸 꺾쇠는 영속 후보까지 그대로 간다.
const XML_ESCAPE_ONCE = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&' };

function unescapeXmlOnce(value) {
  return String(value).replace(/&(?:lt|gt|quot|apos|amp);/g, entity => XML_ESCAPE_ONCE[entity]);
}

function releaseBodyText(block) {
  const match = block.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  if (!match) return '';
  const text = decodeHtml(
    unescapeXmlOnce(match[1]).replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
  if (!text || EMPTY_BODY_PLACEHOLDER_PATTERN.test(text)) return '';
  return text.slice(0, SUMMARY_MAX_LENGTH);
}

function releaseCandidate(block, source) {
  const tag = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, block);
  if (!tag || PACKAGING_PREFIX_PATTERN.test(tag) || !RELEASE_VERSION_PATTERN.test(tag)) return null;
  const href = pick(/<link\b[^>]*href\s*=\s*["']([^"']+)["']/i, block);
  const publishedAt = pick(/<updated[^>]*>([\s\S]*?)<\/updated>/i, block).slice(0, 10);
  if (!href || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return null;
  // summary는 기사를 쓰는 쪽이 읽는 근거다(article-capsules가 프롬프트에 싣고 claim binding이
  // 색인한다). 태그 이름만 되뇌는 문장은 근거가 아니라 자기 참조이므로, 본문이 있으면 본문을 쓰고
  // 없을 때만 그 문장으로 되돌아간다.
  //
  // behavior_change에는 본문 대신 그 문장을 싣고, collector_template_sentence로 "이 텍스트는
  // 출처가 아니라 수집기가 만든 것"이라는 표식을 함께 남긴다(#976). 표식이 필드 이름이 아니라
  // 문장 텍스트인 이유는, 본문이 없는 릴리스에서는 summary도 같은 문장이라 필드 이름 하나로는 두
  // 경로를 함께 가리킬 수 없기 때문이다.
  //
  // 표식이 붙은 지금 이 필드는 자격 판정에 기여하지 않는다. collect-news-candidates의
  // isCollectorTemplateSentence가 이 문장(과 하류 마크업 제거·절단을 거친 그 앞 조각)을 근거에서
  // 빼기 때문에, 본문이 없는 릴리스는 release_note_item 근거 미달로 떨어진다. 다만 그 판정은
  // "이 칸이 만들 수 있는 모든 값"이 아니라 하류가 실제로 거치는 변환(stripMarkup 1회, 앞에서부터의
  // 절단)을 되짚는 것이므로, 하류 정규화가 바뀌면 여기 표식도 함께 다시 재야 한다.
  // 자격을 살리는 것은 본문이 있는 릴리스의 summary다.
  //
  // behavior_change 에도 본문을 싣는다(#976 의 마지막 결정 항목). article-capsules 가 이 필드를
  // what_changed 후보로 읽고, 그 값이 capsule evidence 로 간다. 템플릿을 싣던 동안 릴리스 기사의
  // 근거 첫 칸은 태그 이름을 되뇌는 자기참조 문장이었다 — 2026-08-24 호가 실제 변경(imx296
  // embedded data revert)을 한 번도 말하지 못한 채 나간 경로가 이것이다.
  //
  // 게이트는 이 변경으로 움직이지 않는다. 커밋된 후보 9건 전수 재판정에서 main_eligible 이
  // 전후 동일했다(본문 있는 1건 true, 본문 없는 8건 false). 본문이 없으면 이 필드는 여전히
  // 템플릿 문장이고, collector_template_sentence 표식이 그것을 동작변경 근거에서 걸러 낸다.
  // 그래서 "표식 먼저, 본문 싣기는 그다음"이라는 #976 의 순서 제약이 지켜진다.
  const releaseSentence = `Released ${tag} (Raspberry Pi downstream libcamera).`;
  const summary = releaseBodyText(block) || releaseSentence;
  return {
    source,
    title: `${source.name} - ${tag}`,
    url: href,
    publishedAt,
    summary,
    sourceKind: 'release_note_item',
    collectionMode: 'release-note-item',
    parentUrl: source.url || source.sourceUrl,
    parentTitle: source.name,
    version_or_release: tag,
    api_or_component: 'libcamera / V4L2 camera pipeline',
    behavior_change: summary,
    collector_template_sentence: releaseSentence,
    relevanceBucketHint: 'camera_driver_image_pipeline'
  };
}

/**
 * Raspberry Pi libcamera GitHub releases.atom 텍스트를 받아 릴리스 태그 후보를 반환한다.
 * packaging/branch 태그(pios/*, upstream/*)와 링크/날짜가 없는 엔트리는 제외한다(graceful).
 */
function resolveRaspberryPiLibcameraReleaseItems(text = '', source = {}) {
  return entryBlocks(text)
    .map(block => releaseCandidate(block, source))
    .filter(Boolean);
}

module.exports = {
  resolveRaspberryPiLibcameraReleaseItems
};
