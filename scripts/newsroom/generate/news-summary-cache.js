const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeUrl, normalizedUrlHash } = require('./newsroom-selection');

const CACHE_SCHEMA_VERSION = 2;
const DEFAULT_CACHE_DIR = path.join(process.cwd(), 'cache', 'news-summary');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').trim();
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function contentHash(candidate) {
  const fields = [
    candidate.title,
    candidate.summary,
    candidate.version_or_release,
    candidate.api_or_component,
    candidate.behavior_change
  ].map(text);
  return hashText(fields.join('\n'));
}

function legacyContentFingerprint(candidate) {
  const fields = [
    normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl),
    candidate.title,
    candidate.published_date || candidate.publishedAt,
    candidate.source || candidate.source_name,
    candidate.summary,
    candidate.version_or_release,
    candidate.api_or_component,
    candidate.behavior_change
  ].map(text);
  return hashText(fields.join('\n'));
}

function contentFingerprint(candidate) {
  return contentHash(candidate);
}

function cachePathForUrl(url, cacheDir = DEFAULT_CACHE_DIR) {
  const hash = normalizedUrlHash(url);
  return path.join(cacheDir, 'by-url', `${hash}.json`);
}

function legacyCachePathForUrl(url, cacheDir = DEFAULT_CACHE_DIR) {
  const hash = normalizedUrlHash(url);
  return path.join(cacheDir, `${hash}.json`);
}

function cachePathForContentHash(hash, cacheDir = DEFAULT_CACHE_DIR) {
  return path.join(cacheDir, 'by-content', `${hash}.json`);
}

function readJsonFile(filePath) {
  try {
    return {
      ok: true,
      record: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    };
  } catch (error) {
    return {
      ok: false,
      reason: `invalid-cache-json: ${error.message}`,
      record: null
    };
  }
}

function relativePath(filePath) {
  return filePath ? path.relative(process.cwd(), filePath).replace(/\\/g, '/') : '';
}

function recordSummary(record, sourcePath = '') {
  if (!record || typeof record !== 'object') return null;
  return sourcePath ? { ...record, cache_record_path: relativePath(sourcePath) } : record;
}

function validateUrlRecord(candidate, record, sourcePath) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  const expectedUrl = normalizeUrl(url);
  const expectedContentHash = contentHash(candidate);
  const recordContentHash = record.content_hash || record.content_fingerprint || '';
  if (record.normalized_url !== expectedUrl) {
    return { hit: false, reason: 'normalized-url-mismatch', record: recordSummary(record, sourcePath) };
  }
  if (recordContentHash !== expectedContentHash) {
    return { hit: false, reason: 'content-hash-mismatch', record: recordSummary(record, sourcePath) };
  }
  const metadataChanged = text(record.published_date) !== text(candidate.published_date || candidate.publishedAt) ||
    text(record.source) !== text(candidate.source || candidate.source_name);
  return {
    hit: true,
    reason: metadataChanged ? 'url-hit-content-match-metadata-changed' : 'url-hit',
    record: recordSummary(record, sourcePath)
  };
}

function validateLegacyUrlRecord(candidate, record, sourcePath) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  const expectedUrl = normalizeUrl(url);
  const expectedFingerprint = legacyContentFingerprint(candidate);
  if (record.normalized_url !== expectedUrl) {
    return { hit: false, reason: 'normalized-url-mismatch', record: recordSummary(record, sourcePath) };
  }
  if (record.content_fingerprint !== expectedFingerprint) {
    return { hit: false, reason: 'legacy-content-fingerprint-mismatch', record: recordSummary(record, sourcePath) };
  }
  return { hit: true, reason: 'legacy-url-hit', record: recordSummary(record, sourcePath) };
}

function validateContentRecord(candidate, record, sourcePath) {
  const expectedContentHash = contentHash(candidate);
  const recordContentHash = record.content_hash || record.content_fingerprint || '';
  if (recordContentHash !== expectedContentHash) {
    return { hit: false, reason: 'content-hash-mismatch', record: recordSummary(record, sourcePath) };
  }
  return {
    hit: true,
    reason: 'content-hash-hit',
    record: recordSummary(record, sourcePath)
  };
}

function readCacheRecord(candidate, cacheDir = DEFAULT_CACHE_DIR) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  const hash = contentHash(candidate);
  const missReasons = [];

  if (url) {
    const filePath = cachePathForUrl(url, cacheDir);
    if (fs.existsSync(filePath)) {
      const parsed = readJsonFile(filePath);
      if (!parsed.ok) return { hit: false, reason: parsed.reason, record: null, lookup: { source: 'by-url', path: filePath } };
      const result = validateUrlRecord(candidate, parsed.record, filePath);
      if (result.hit) return { ...result, lookup: { source: 'by-url', path: filePath } };
      missReasons.push(`by-url:${result.reason}`);
    } else {
      missReasons.push('by-url:missing-cache-record');
    }

    const legacyPath = legacyCachePathForUrl(url, cacheDir);
    if (fs.existsSync(legacyPath)) {
      const parsed = readJsonFile(legacyPath);
      if (!parsed.ok) return { hit: false, reason: parsed.reason, record: null, lookup: { source: 'legacy-by-url', path: legacyPath } };
      const result = validateLegacyUrlRecord(candidate, parsed.record, legacyPath);
      if (result.hit) return { ...result, lookup: { source: 'legacy-by-url', path: legacyPath } };
      missReasons.push(`legacy-by-url:${result.reason}`);
    }
  } else {
    missReasons.push('by-url:missing-url');
  }

  const contentPath = cachePathForContentHash(hash, cacheDir);
  if (fs.existsSync(contentPath)) {
    const parsed = readJsonFile(contentPath);
    if (!parsed.ok) return { hit: false, reason: parsed.reason, record: null, lookup: { source: 'by-content', path: contentPath } };
    const result = validateContentRecord(candidate, parsed.record, contentPath);
    if (result.hit) return { ...result, lookup: { source: 'by-content', path: contentPath } };
    missReasons.push(`by-content:${result.reason}`);
  } else {
    missReasons.push('by-content:missing-cache-record');
  }

  return {
    hit: false,
    reason: missReasons.join('; '),
    record: null,
    lookup: {
      source: 'none',
      content_hash: hash
    }
  };
}

function cacheKey(candidate) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  return {
    normalized_url: normalizeUrl(url),
    url_hash: url ? normalizedUrlHash(url) : '',
    published_date: text(candidate.published_date || candidate.publishedAt),
    content_hash: contentHash(candidate)
  };
}

function cacheDiagnostics(candidate, lookup) {
  const key = cacheKey(candidate);
  return {
    title: text(candidate.title),
    url: text(candidate.url || candidate.article_url || candidate.articleUrl),
    source: text(candidate.source || candidate.source_name),
    published_date: key.published_date,
    cache_key: key,
    hit: lookup.hit === true,
    reason: lookup.reason,
    lookup_source: lookup.lookup?.source || '',
    cache_record_path: relativePath(lookup.lookup?.path)
  };
}

function buildSummaryCacheReport(date, diagnostics = []) {
  const entries = ensureArray(diagnostics);
  const byReason = new Map();
  for (const item of entries) {
    const key = item.reason || 'unknown';
    byReason.set(key, (byReason.get(key) || 0) + 1);
  }
  return {
    schema_version: 1,
    date,
    generated_at: new Date().toISOString(),
    cache_root: path.relative(process.cwd(), DEFAULT_CACHE_DIR).replace(/\\/g, '/'),
    totals: {
      candidate_count: entries.length,
      hit_count: entries.filter(item => item.hit).length,
      miss_count: entries.filter(item => !item.hit).length,
      by_url_hit_count: entries.filter(item => item.lookup_source === 'by-url').length,
      by_content_hit_count: entries.filter(item => item.lookup_source === 'by-content').length,
      legacy_hit_count: entries.filter(item => item.lookup_source === 'legacy-by-url').length
    },
    reasons: [...byReason.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    entries
  };
}

function buildSummaryCacheReportMarkdown(report) {
  const totals = report.totals || {};
  const reasons = ensureArray(report.reasons).map(item => `- ${item.reason}: ${item.count}`).join('\n') || '- none';
  const rows = ensureArray(report.entries).map(item => [
    `| ${item.hit ? 'hit' : 'miss'} `,
    ` ${item.lookup_source || 'none'} `,
    ` ${item.reason || 'unknown'} `,
    ` ${item.source || ''} `,
    ` ${item.published_date || ''} `,
    ` ${item.title || ''} |`
  ].join('|')).join('\n') || '| none | none | none | none | none | none |';
  return `# Summary cache report - ${report.date || 'unknown'}

## Summary

- Candidate count: ${totals.candidate_count || 0}
- Hit count: ${totals.hit_count || 0}
- Miss count: ${totals.miss_count || 0}
- URL hit count: ${totals.by_url_hit_count || 0}
- Content hash hit count: ${totals.by_content_hit_count || 0}
- Legacy hit count: ${totals.legacy_hit_count || 0}

## Reasons

${reasons}

## Entries

| Status | Lookup | Reason | Source | Published date | Title |
| --- | --- | --- | --- | --- | --- |
${rows}
`;
}

function buildCacheRecord(candidate, modelMetadata = {}) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  const key = cacheKey(candidate);
  return {
    schema_version: CACHE_SCHEMA_VERSION,
    cache_key: key,
    normalized_url: key.normalized_url,
    url_hash: key.url_hash,
    title: text(candidate.title),
    published_date: key.published_date,
    source: text(candidate.source || candidate.source_name),
    content_hash: key.content_hash,
    content_fingerprint: key.content_hash,
    summary: text(candidate.summary),
    tags: ensureArray(candidate.impact_areas),
    evidence: {
      version_or_release: text(candidate.version_or_release),
      api_or_component: text(candidate.api_or_component),
      behavior_change: text(candidate.behavior_change),
      evidence_notes: ensureArray(candidate.evidence_notes),
      relevance_reason: text(candidate.relevance_reason)
    },
    generated_at: new Date().toISOString(),
    model_metadata: modelMetadata
  };
}

function writeCacheRecord(candidate, cacheDir = DEFAULT_CACHE_DIR, modelMetadata = {}) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  if (!url) return '';
  const record = buildCacheRecord(candidate, modelMetadata);
  const urlPath = cachePathForUrl(url, cacheDir);
  const contentPath = cachePathForContentHash(record.content_hash, cacheDir);
  fs.mkdirSync(path.dirname(urlPath), { recursive: true });
  fs.mkdirSync(path.dirname(contentPath), { recursive: true });
  const textRecord = `${JSON.stringify(record, null, 2)}\n`;
  fs.writeFileSync(urlPath, textRecord, 'utf8');
  fs.writeFileSync(contentPath, textRecord, 'utf8');
  return urlPath;
}

function annotateCandidatesWithCache(candidates, cacheDir = DEFAULT_CACHE_DIR) {
  const diagnostics = [];
  const annotated = ensureArray(candidates).map(candidate => {
    const lookup = readCacheRecord(candidate, cacheDir);
    diagnostics.push(cacheDiagnostics(candidate, lookup));
    if (!lookup.hit) {
      return {
        ...candidate,
        summary_cache: {
          hit: false,
          reason: lookup.reason,
          cache_key: cacheKey(candidate)
        }
      };
    }
    return {
      ...candidate,
      summary_cache: {
        hit: true,
        reason: lookup.reason,
        lookup_source: lookup.lookup?.source || '',
        cache_key: cacheKey(candidate),
        summary: lookup.record.summary,
        generated_at: lookup.record.generated_at,
        model_metadata: lookup.record.model_metadata || {}
      },
      cached_summary: lookup.record.summary,
      cached_tags: lookup.record.tags,
      cached_evidence: lookup.record.evidence
    };
  });
  annotated.cache_diagnostics = diagnostics;
  return annotated;
}

module.exports = {
  CACHE_SCHEMA_VERSION,
  DEFAULT_CACHE_DIR,
  annotateCandidatesWithCache,
  buildCacheRecord,
  buildSummaryCacheReport,
  buildSummaryCacheReportMarkdown,
  cacheKey,
  cachePathForContentHash,
  cachePathForUrl,
  contentHash,
  contentFingerprint,
  readCacheRecord,
  writeCacheRecord
};
