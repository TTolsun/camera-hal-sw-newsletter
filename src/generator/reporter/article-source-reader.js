const { createBoundedFetchClient } = require('../../shared/collect/bounded-fetch-client');
const { articleBody } = require('../../shared/collect/document-section-parsing');
const { decodeHtml } = require('../../shared/common/common');
const { createHash } = require('crypto');
const { GERRIT_REVISION, gerritTarget, readGerritSource } = require('./gerrit-source-reader');

const MAX_SOURCE_READS = 24;
const MAX_DOCUMENT_CHARS = 16000;

// Read source content, not the first bytes of HTML (usually navigation/metadata).
// Keep table cells and diff lines separate so conditions and removed lines survive.
function sourceBody(html) {
  const cleaned = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  let body = articleBody(cleaned);
  // A news article may contain testimonial cards that are themselves articles.
  // The shared devsite helper stops at the first closing tag; balance the outer
  // article here so pricing, limitations and footnotes after those cards survive.
  let depth = 0;
  let start = -1;
  for (const tag of cleaned.matchAll(/<\/?article\b[^>]*>/gi)) {
    if (!tag[0].startsWith('</')) {
      if (depth === 0) start = tag.index + tag[0].length;
      depth++;
    } else if (depth > 0 && --depth === 0) {
      body = cleaned.slice(start, tag.index);
      break;
    }
  }
  const patchStart = body.search(/<h2\b[^>]*>\s*(?:Commit Message|Message)\s*<\/h2>/i);
  if (patchStart >= 0) body = body.slice(patchStart);
  return decodeHtml(body
    .replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(?:p|div|h[1-6]|tr|li|pre)>|<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:td|th)>/gi, ' | ')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function publicSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password ||
        !url.hostname.includes('.') || /^(?:\d+\.){3}\d+$/.test(url.hostname) ||
        /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname) || url.hostname.includes(':')) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

function relatedPatchUrls(html, url) {
  if (!/^https:\/\/patchwork\.libcamera\.org\/patch\/\d+\/$/.test(url)) return [];
  // Only the page's Related table, never arbitrary links or guessed patch IDs.
  const related = /<th\b[^>]*>\s*Related\s*<\/th>([\s\S]*?)<\/tr>/i.exec(html)?.[1] || '';
  return [...new Set([...related.matchAll(/href=["']([^"']+)["']/g)]
    .map(match => { try { return new URL(match[1], url).href; } catch { return ''; } })
    .filter(link => /^https:\/\/patchwork\.libcamera\.org\/(?:cover|patch)\/\d+\/$/.test(link) && link !== url))].slice(0, 5);
}

// Seed evidence has a separate reviewed provenance contract; do not refetch it.
// 예외는 seed가 기록한 리비전으로 고정된 Gerrit 변경이다. Gerrit 경로는 seed와 같은 공식 REST에서
// 그 리비전의 patch만 읽으므로 provenance가 바뀌지 않는다. 막으면 seed로 들어왔거나 seed와 병합된
// 변경만 diff 없이 기사가 쓰이고, 1차 변경의 병합 상태도 원문 근거로 인정받지 못한다
// (2026-10-26 실측: 4381410·4375770).
function keepsSeedProvenance(candidate, url) {
  const seeded = candidate.compact_evidence || candidate.source_extraction_ref || candidate.manual_seed || candidate.manualSeed;
  if (!seeded) return false;
  return !(url && gerritTarget(url) && GERRIT_REVISION.test(candidate.gerrit_commit_sha || ''));
}

async function readArticleSources(report, { fetchImpl = globalThis.fetch } = {}) {
  // Devsite redirects to a locale URL. Permit bounded same-origin redirects only.
  const client = createBoundedFetchClient({
    fetchImpl: async (url, init) => {
      let target = url;
      for (let hop = 0; hop < 4; hop++) {
        const response = await fetchImpl(target, { ...init, redirect: 'manual' });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers?.get?.('location');
        await response.body?.cancel?.();
        const next = location && publicSourceUrl(new URL(location, target).href);
        if (!next || new URL(next).origin !== new URL(url).origin) throw Error('unsupported_source_redirect');
        target = next;
      }
      throw Error('source_redirect_limit');
    },
    timeoutMs: 8000,
    maxBytesPerSourceRun: 6 * 1024 * 1024
  });
  const documents = new Map();
  async function read(url, candidate = {}) {
    const key = `${url}\n${candidate.gerrit_commit_sha || ''}`;
    if (documents.has(key)) return documents.get(key);
    if (!url || documents.size >= MAX_SOURCE_READS) return { status: 'skipped', blocks: [] };
    const gerrit = gerritTarget(url);
    if (gerrit) {
      const source = await readGerritSource(gerrit, candidate, client);
      const result = { status: source.status, error: source.error, blocks: [], related: [] };
      if (source.body) {
        for (let offset = 0; offset < source.body.length; offset += MAX_DOCUMENT_CHARS) {
          const content = source.body.slice(offset, offset + MAX_DOCUMENT_CHARS);
          result.blocks.push({
            evidence_id: `source-body:${createHash('sha256').update(url + '\n' + source.revision + '\n' + offset + '\n' + content).digest('hex').slice(0, 20)}`,
            url, text: content, truncated: false, revision: source.revision,
            fetched_from: source.fetched_from,
            part: result.blocks.length + 1, parts: Math.ceil(source.body.length / MAX_DOCUMENT_CHARS)
          });
        }
      }
      documents.set(key, result);
      return result;
    }
    const response = await client.fetchBounded(url);
    const extracted = response.ok ? sourceBody(response.body) : '';
    const shell = /To use PolyGerrit, please enable JavaScript/i.test(extracted);
    const body = shell ? '' : extracted;
    const result = { status: body ? 'read' : 'unavailable', error: response.error || (shell ? 'polygerrit_shell' : !body ? 'empty_source_body' : ''), truncated: body.length > MAX_DOCUMENT_CHARS, blocks: [], related: response.ok ? relatedPatchUrls(response.body, url) : [] };
    if (body) {
      // The full excerpt travels separately from the compact summary. Its ID is
      // also indexed by the existing deterministic claim/source binding checks.
      const content = body.slice(0, MAX_DOCUMENT_CHARS);
      result.blocks.push({
        evidence_id: `source-body:${createHash('sha256').update(url + '\n' + content).digest('hex').slice(0, 20)}`,
        url, text: content, truncated: result.truncated
      });
    }
    documents.set(key, result);
    return result;
  }
  const enriched = new Map();
  const candidates = [...(report.selected_articles || []), ...(report.shortlisted_candidates || [])];
  for (const candidate of candidates) {
    const url = publicSourceUrl(candidate.url || candidate.article_url || candidate.articleUrl);
    if (keepsSeedProvenance(candidate, url)) continue;
    const key = `${url}\n${candidate.gerrit_commit_sha || ''}`;
    if (!url || enriched.has(key)) continue;
    const primary = await read(url, candidate);
    const blocks = [...primary.blocks];
    for (const related of primary.related || []) blocks.push(...(await read(related)).blocks);
    enriched.set(key, { blocks, status: primary.status, error: primary.error || '' });
  }
  const attached = new WeakSet();
  for (const value of Object.values(report)) {
    if (!Array.isArray(value)) continue;
    for (const candidate of value) {
      if (!candidate || typeof candidate !== 'object' || attached.has(candidate)) continue;
      const url = publicSourceUrl(candidate.url || candidate.article_url || candidate.articleUrl);
      if (keepsSeedProvenance(candidate, url)) continue;
      const read = enriched.get(`${url}\n${candidate.gerrit_commit_sha || ''}`);
      if (!read) continue;
      attached.add(candidate);
      const previousIds = new Set((candidate.article_source_reading?.documents || []).map(d => d.evidence_id));
      candidate.article_source_reading = { status: read.status, error: read.error, documents: read.blocks };
      candidate.source_extraction = {
        ...candidate.source_extraction,
        evidence_blocks: [...(candidate.source_extraction?.evidence_blocks || [])
          .filter(block => !previousIds.has(block.evidence_id)), ...read.blocks]
      };
    }
  }
  return report;
}

module.exports = { sourceBody, publicSourceUrl, relatedPatchUrls, readArticleSources };
