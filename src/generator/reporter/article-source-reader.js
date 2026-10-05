const { createBoundedFetchClient } = require('../../shared/collect/bounded-fetch-client');
const { articleBody } = require('../../shared/collect/document-section-parsing');
const { decodeHtml } = require('../../shared/common/common');
const { createHash } = require('crypto');

const MAX_DOCUMENTS = 24;
const MAX_DOCUMENT_CHARS = 16000;

// Read source content, not the first bytes of HTML (usually navigation/metadata).
// Keep table cells and diff lines separate so conditions and removed lines survive.
function sourceBody(html) {
  let body = articleBody(html);
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
  async function read(url) {
    if (documents.has(url)) return documents.get(url);
    if (!url || documents.size >= MAX_DOCUMENTS) return { status: 'skipped', blocks: [] };
    const response = await client.fetchBounded(url);
    const body = response.ok ? sourceBody(response.body) : '';
    const result = { status: body ? 'read' : 'unavailable', error: response.error || (!body ? 'empty_source_body' : ''), truncated: body.length > MAX_DOCUMENT_CHARS, blocks: [], related: response.ok ? relatedPatchUrls(response.body, url) : [] };
    if (body) {
      // The full excerpt travels separately from the compact summary. Its ID is
      // also indexed by the existing deterministic claim/source binding checks.
      const content = body.slice(0, MAX_DOCUMENT_CHARS);
      result.blocks.push({
        evidence_id: `source-body:${createHash('sha256').update(url + '\n' + content).digest('hex').slice(0, 20)}`,
        url, text: content, truncated: result.truncated
      });
    }
    documents.set(url, result);
    return result;
  }
  const enriched = new Map();
  const candidates = [...(report.selected_articles || []), ...(report.shortlisted_candidates || [])];
  for (const candidate of candidates) {
    // Seed evidence has a separate reviewed provenance contract; do not refetch it.
    if (candidate.compact_evidence || candidate.source_extraction_ref || candidate.manual_seed || candidate.manualSeed) continue;
    const url = publicSourceUrl(candidate.url || candidate.article_url || candidate.articleUrl);
    if (!url || enriched.has(url)) continue;
    const primary = await read(url);
    const blocks = [...primary.blocks];
    for (const related of primary.related || []) blocks.push(...(await read(related)).blocks);
    enriched.set(url, { blocks, status: primary.status, error: primary.error || '' });
  }
  const attached = new WeakSet();
  for (const value of Object.values(report)) {
    if (!Array.isArray(value)) continue;
    for (const candidate of value) {
      if (!candidate || typeof candidate !== 'object' || attached.has(candidate) ||
          candidate.compact_evidence || candidate.source_extraction_ref || candidate.manual_seed || candidate.manualSeed) continue;
      const read = enriched.get(publicSourceUrl(candidate.url || candidate.article_url || candidate.articleUrl));
      if (!read) continue;
      attached.add(candidate);
      candidate.article_source_reading = { status: read.status, error: read.error, documents: read.blocks };
      candidate.source_extraction = {
        ...candidate.source_extraction,
        evidence_blocks: [...(candidate.source_extraction?.evidence_blocks || []), ...read.blocks]
      };
    }
  }
  return report;
}

module.exports = { sourceBody, publicSourceUrl, relatedPatchUrls, readArticleSources };
