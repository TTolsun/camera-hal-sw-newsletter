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
// 다만 이건 이 모듈이 지키는 경계 계약이지 최종 산출물의 보장이 아니다. 지금은 하류
// normalizeCandidate(collect-news-candidates.js:923)가 summary에 decode()를 다시 걸고, 그 decode가
// `<…>`를 또 지워서 살려낸 꺾쇠가 영속 후보에서는 결국 사라진다(라이브 실측 3건). 여기서 안 지우는
// 이유는 수집기가 원문을 망가뜨린 채 넘기지 않기 위해서다.
//
// 그렇다고 그 두 번째 decode를 그냥 뺄 수는 없다. escape된 HTML을 싣는 RSS 피드에서는 tag()의
// decode 한 번으로 `<p>`가 리터럴 텍스트로 남고(태그 제거가 entity 해제보다 먼저 돌기 때문),
// 그걸 걷어내는 것이 바로 그 두 번째 decode다(실측). 꺾쇠 보존과 태그 제거를 함께 만족시키려면
// 그 두 단계를 분리해야 하고, 그건 모든 수집 경로의 경계 계약을 바꾸는 별도 작업이다.
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
  // 표식이 붙은 지금 이 필드는 자격 판정에 기여하지 않는다. collect-news-candidates의 동작 변경
  // 근거 판정이 표식과 같은 문장(그리고 같은 분할기로 쪼갠 그 문장의 조각)을 근거에서 빼기 때문에,
  // 본문이 없는 릴리스는 release_note_item 근거 미달로 떨어진다. 자격을 살리는 것은 본문이 있는
  // 릴리스의 summary다.
  //
  // 본문을 이 필드에 싣는 것은 아직 하지 않았다. article-capsules가 이 필드를 what_changed에
  // 그대로 싣기 때문에(select/article-capsules.js의 what_changed), 본문 싣기는 그 경로까지 함께
  // 재는 별도 변경이다 — #976의 남은 결정 항목이다.
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
    behavior_change: releaseSentence,
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
