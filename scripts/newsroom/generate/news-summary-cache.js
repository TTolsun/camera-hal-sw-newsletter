const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeUrl, normalizedUrlHash } = require('./newsroom-selection');

const CACHE_SCHEMA_VERSION = 1;
const DEFAULT_CACHE_DIR = path.join(process.cwd(), 'cache', 'news-summary');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').trim();
}

function contentFingerprint(candidate) {
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
  return crypto.createHash('sha256').update(fields.join('\n')).digest('hex');
}

function cachePathForUrl(url, cacheDir = DEFAULT_CACHE_DIR) {
  const hash = normalizedUrlHash(url);
  return path.join(cacheDir, `${hash}.json`);
}

function readCacheRecord(candidate, cacheDir = DEFAULT_CACHE_DIR) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  if (!url) return { hit: false, reason: 'missing-url', record: null };
  const filePath = cachePathForUrl(url, cacheDir);
  if (!fs.existsSync(filePath)) return { hit: false, reason: 'missing-cache-record', record: null };
  let record;
  try {
    record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { hit: false, reason: `invalid-cache-json: ${error.message}`, record: null };
  }
  const expectedUrl = normalizeUrl(url);
  const expectedFingerprint = contentFingerprint(candidate);
  if (record.normalized_url !== expectedUrl) {
    return { hit: false, reason: 'normalized-url-mismatch', record };
  }
  if (record.content_fingerprint !== expectedFingerprint) {
    return { hit: false, reason: 'content-fingerprint-mismatch', record };
  }
  return { hit: true, reason: 'hit', record };
}

function buildCacheRecord(candidate, modelMetadata = {}) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  return {
    schema_version: CACHE_SCHEMA_VERSION,
    normalized_url: normalizeUrl(url),
    url_hash: normalizedUrlHash(url),
    title: text(candidate.title),
    published_date: text(candidate.published_date || candidate.publishedAt),
    source: text(candidate.source || candidate.source_name),
    content_fingerprint: contentFingerprint(candidate),
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
  fs.mkdirSync(cacheDir, { recursive: true });
  const filePath = cachePathForUrl(url, cacheDir);
  fs.writeFileSync(filePath, `${JSON.stringify(buildCacheRecord(candidate, modelMetadata), null, 2)}\n`, 'utf8');
  return filePath;
}

function annotateCandidatesWithCache(candidates, cacheDir = DEFAULT_CACHE_DIR) {
  return ensureArray(candidates).map(candidate => {
    const lookup = readCacheRecord(candidate, cacheDir);
    if (!lookup.hit) {
      return {
        ...candidate,
        summary_cache: {
          hit: false,
          reason: lookup.reason
        }
      };
    }
    return {
      ...candidate,
      summary_cache: {
        hit: true,
        reason: lookup.reason,
        generated_at: lookup.record.generated_at,
        model_metadata: lookup.record.model_metadata || {}
      },
      cached_summary: lookup.record.summary,
      cached_tags: lookup.record.tags,
      cached_evidence: lookup.record.evidence
    };
  });
}

module.exports = {
  CACHE_SCHEMA_VERSION,
  DEFAULT_CACHE_DIR,
  annotateCandidatesWithCache,
  buildCacheRecord,
  cachePathForUrl,
  contentFingerprint,
  readCacheRecord,
  writeCacheRecord
};
