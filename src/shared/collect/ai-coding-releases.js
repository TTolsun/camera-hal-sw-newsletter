'use strict';

const { MAX_BYTES_PER_INDEX_PAGE } = require('./bounded-fetch-client');

const SEMVER_TAG = /^(?:rust-)?v?\d+\.\d+\.\d+$/;
// NDK 정식 릴리스 태그는 r30처럼 semver가 아니다. rc/beta 태그는 prerelease 플래그로 걸러진다.
const NDK_TAG = /^r\d+[a-z]?$/;
const SOURCES = {
  'codex-releases': { repo: 'openai/codex', product: 'Codex', tagPattern: SEMVER_TAG },
  'claude-code-changelog': { repo: 'anthropics/claude-code', product: 'Claude Code', tagPattern: SEMVER_TAG },
  'android-ndk-releases': { repo: 'android/ndk', product: 'Android NDK', tagPattern: NDK_TAG }
};
const MAX_PAGES = 8;
const PAGE_SIZE = 3;

// GitHub의 updated_at/created_at은 발행일이 아니다. published_at과 실제 릴리스 본문만
// 근거로 사용하고 draft/prerelease 및 내용 없는 태그는 기사 후보로 만들지 않는다.
function releaseItem(release, source, config) {
  if (!release || release.draft !== false || release.prerelease !== false) return null;
  const version = String(release.tag_name || '');
  if (!config.tagPattern.test(version)) return null;
  const publishedAt = String(release.published_at || '');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(publishedAt) || !Number.isFinite(Date.parse(publishedAt))) return null;
  const url = String(release.html_url || '');
  if (url !== `https://github.com/${config.repo}/releases/tag/${encodeURIComponent(version)}`) return null;
  const changes = String(release.body || '').split(/\r?\n/)
    .filter(line => /^\s*[-*]\s+/.test(line))
    .map(line => line.replace(/^\s*[-*]\s+/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim())
    .filter(line => /\b(?:added?|changed?|fixed?|fixes|improved?|removed?|support|now|no longer)\b/i.test(line)
      && line.split(/\s+/).length >= 8);
  if (!changes.length) return null;
  const summary = changes.join(' ').slice(0, 500);
  return {
    source,
    title: `${config.product} ${version}`,
    url,
    publishedAt,
    summary,
    sourceKind: 'release_note_item',
    collectionMode: 'release-note-item',
    parentUrl: source.url || source.sourceUrl,
    parentTitle: source.name,
    version_or_release: version,
    api_or_component: config.product,
    behavior_change: summary
  };
}

async function resolveAiCodingReleaseItems(text, source, { fetchClient, now, lookbackDays = 35, onDiagnostic } = {}) {
  const config = SOURCES[source.id];
  if (!config || !fetchClient) return [];
  const end = now instanceof Date ? now.getTime() : Date.now();
  const start = end - lookbackDays * 86400000;
  const items = [];
  const seen = new Set();
  let body = text;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `https://api.github.com/repos/${config.repo}/releases?per_page=${PAGE_SIZE}&page=${page}`;
    if (page > 1) {
      const response = await fetchClient.fetchBounded(url, { maxBytes: MAX_BYTES_PER_INDEX_PAGE });
      if (!response.ok) {
        onDiagnostic?.({ kind: 'release_page_fetch_failed', source_id: source.id, url, detail: response.error });
        break;
      }
      body = response.body;
    }
    let releases;
    try { releases = JSON.parse(body); } catch { releases = null; }
    if (!Array.isArray(releases)) throw new Error(`Invalid GitHub release list for ${source.id}`);
    for (const release of releases) {
      const item = releaseItem(release, source, config);
      if (!item || seen.has(item.url)) continue;
      const published = Date.parse(item.publishedAt);
      if (published < start || published > end) continue;
      seen.add(item.url);
      items.push(item);
    }
    if (releases.length < PAGE_SIZE) break;
    // API는 published_at 순서를 보장하지 않는다. 오래된 한 페이지를 보고 중단하지 않고
    // 정해진 요청/바이트 예산까지 읽으며, 상한 도달을 '소식 없음'과 구분해 기록한다.
    if (page === MAX_PAGES) {
      onDiagnostic?.({ kind: 'release_scan_page_cap', source_id: source.id, url,
        detail: `Scanned ${MAX_PAGES * PAGE_SIZE} releases; older releases may remain outside this bounded scan.` });
    }
  }
  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

module.exports = { resolveAiCodingReleaseItems };
