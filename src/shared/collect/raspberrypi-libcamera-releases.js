// Raspberry Pi 다운스트림 libcamera는 GitHub Releases(releases.atom)로 dated 릴리스를 낸다
// (upstream libcamera-devel 메일링에는 릴리스 공지가 없어 libcamera-release-announcements가
// 구조적으로 0건인 것과 대조). atom <entry> 블록에서 릴리스 태그를 뽑아 dated 후보를 만들되,
// 같은 릴리스의 중복 ref인 packaging/branch 태그(pios/*, upstream/*)는 제외한다.
const { decodeHtml } = require('../common/common');
const { stripHtml } = require('../common/text');

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

// GitHub은 릴리스 본문을 HTML로 escape해 <content type="html">에 싣는다. 그래서 두 번 푼다:
// decodeHtml이 escape를 풀어 진짜 마크업으로 만들고, stripHtml이 그 태그를 걷어낸다. 순서를
// 뒤집으면(태그 제거 후 decode) 걷어낼 태그가 아직 escape 상태라 본문에 <p>가 그대로 남는다.
//
// 본문 없이 태그만 올린 릴리스에는 GitHub이 "No content." 리터럴을 싣는다(라이브 실측). 빈
// 문자열이 아니라서 그대로 쓰면 근거 유무 검사를 통과하면서 아무 사실도 전하지 않으므로,
// 없는 본문으로 취급해 호출부가 폴백하게 한다.
const EMPTY_BODY_PLACEHOLDER_PATTERN = /^no content\.?$/i;

function releaseBodyText(block) {
  const raw = pick(/<content[^>]*>([\s\S]*?)<\/content>/i, block);
  if (!raw) return '';
  const text = stripHtml(decodeHtml(raw));
  if (EMPTY_BODY_PLACEHOLDER_PATTERN.test(text)) return '';
  return text.slice(0, SUMMARY_MAX_LENGTH);
}

function releaseCandidate(block, source) {
  const tag = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, block);
  if (!tag || PACKAGING_PREFIX_PATTERN.test(tag) || !RELEASE_VERSION_PATTERN.test(tag)) return null;
  const href = pick(/<link\b[^>]*href\s*=\s*["']([^"']+)["']/i, block);
  const publishedAt = pick(/<updated[^>]*>([\s\S]*?)<\/updated>/i, block).slice(0, 10);
  if (!href || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return null;
  // 태그 이름만 되뇌는 문장은 근거가 아니라 자기 참조다. 본문이 있으면 본문을 쓰고, 본문이
  // 없을 때만 그 문장으로 되돌아간다.
  const summary = releaseBodyText(block) || `Released ${tag} (Raspberry Pi downstream libcamera).`;
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
