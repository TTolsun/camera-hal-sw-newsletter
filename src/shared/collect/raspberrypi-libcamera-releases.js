// Raspberry Pi 다운스트림 libcamera는 GitHub Releases(releases.atom)로 dated 릴리스를 낸다
// (upstream libcamera-devel 메일링에는 릴리스 공지가 없어 libcamera-release-announcements가
// 구조적으로 0건인 것과 대조). atom <entry> 블록에서 릴리스 태그를 뽑아 dated 후보를 만들되,
// 같은 릴리스의 중복 ref인 packaging/branch 태그(pios/*, upstream/*)는 제외한다.
const { decodeHtml } = require('../common/common');

const PACKAGING_PREFIX_PATTERN = /^(?:pios|upstream)\//i;
const RELEASE_VERSION_PATTERN = /v?\d+\.\d+(?:\.\d+)?/;

function entryBlocks(xml) {
  return String(xml).match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
}

function pick(pattern, block) {
  const match = block.match(pattern);
  return match ? decodeHtml(match[1]).replace(/\s+/g, ' ').trim() : '';
}

function releaseCandidate(block, source) {
  const tag = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, block);
  if (!tag || PACKAGING_PREFIX_PATTERN.test(tag) || !RELEASE_VERSION_PATTERN.test(tag)) return null;
  const href = pick(/<link\b[^>]*href\s*=\s*["']([^"']+)["']/i, block);
  const publishedAt = pick(/<updated[^>]*>([\s\S]*?)<\/updated>/i, block).slice(0, 10);
  if (!href || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return null;
  const summary = `Released ${tag} (Raspberry Pi downstream libcamera).`;
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
