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

// GitHub은 릴리스 본문을 HTML로 escape해 <content type="html">에 싣는다. 그래서 순서가 정해진다:
// escape를 먼저 풀어야 진짜 마크업이 되고, 그 뒤에 태그를 걷어낼 수 있다. 뒤집으면 걷어낼 태그가
// 아직 escape 상태라 본문에 <p>가 그대로 남는다.
//
// 기존 헬퍼를 그대로 쓰지 않는 이유는 둘 다 이 순서가 아니기 때문이다 — collect의 stripTags와
// common의 stripHtml은 태그를 먼저 지우고 entity를 나중에 푼다. 그래서 여기서는 decode를 정확히
// 한 번만 하고(pick은 이미 decode하므로 raw 캡처를 쓴다) 태그를 **공백**으로 치환한다. 빈 문자열로
// 치환하면 `now<br />embedded` 같은 인접 태그에서 단어가 붙어 근거 텍스트가 망가진다.
function releaseBodyText(block) {
  const match = block.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  if (!match) return '';
  const text = decodeHtml(match[1])
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  // behavior_change는 다르다. 이 필드는 collect-news-candidates의 자격 판정 입력이고 어휘 패턴으로
  // 검사된다. 본문을 여기까지 실으면 판정이 조용히 뒤집힌다 — 예를 들어 v0.7.2+rpt20260817의 본문
  // ("Revert ... cannot be negotiated with the CFE")에는 그 패턴의 어휘가 하나도 없어서, 지금까지
  // 통과하던 릴리스가 release_note_item 근거 미달로 main 자격을 잃는다. 자격 판정을 바꾸는 것은
  // 이 변경의 목적이 아니므로 종전 문장을 그대로 둔다.
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
