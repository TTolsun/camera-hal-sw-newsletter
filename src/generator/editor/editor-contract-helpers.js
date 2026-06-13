const { ensureArray } = require('../../shared/common/value-coercion');
const {
  normalizeUrl
} = require('../../shared/common/selection-normalizers');
const {
  isForbiddenMainBucket,
  isPrimaryCameraStackBucket
} = require('../../shared/common/newsletter-policy');

class EditorSemanticValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'EditorSemanticValidationError';
    this.details = details;
    this.field = details.field || '';
  }
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function actualType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function text(value) {
  return String(value || '').trim();
}

function countDetails(value, field, expected = {}) {
  const actualValue = value?.[field];
  const isArray = Array.isArray(actualValue);
  return {
    field,
    ...expected,
    actualCount: isArray ? actualValue.length : null,
    actualType: actualType(actualValue),
    sectionCount: Array.isArray(value?.sections) ? value.sections.length : null
  };
}

function candidateHash(candidate = {}) {
  candidate = candidate || {};
  return text(candidate.source_candidate_hash || candidate.url_hash || candidate.normalized_url_hash);
}

function candidateUrls(candidate = {}) {
  candidate = candidate || {};
  return [
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.normalized_url
  ].map(text).filter(Boolean);
}

function buildCandidateIndex(reporter = {}) {
  const byHash = new Map();
  const byUrl = new Map();
  for (const candidate of ensureArray(reporter?.candidates)) {
    const hash = candidateHash(candidate);
    if (hash && !byHash.has(hash)) byHash.set(hash, candidate);
    for (const url of candidateUrls(candidate)) {
      const key = normalizeUrl(url);
      if (key && !byUrl.has(key)) byUrl.set(key, candidate);
    }
  }
  return { byHash, byUrl };
}

function candidateForSection(section = {}, candidateIndex) {
  const hash = text(section.source_candidate_hash || section.url_hash || section.normalized_url_hash);
  if (hash && candidateIndex.byHash.has(hash)) return candidateIndex.byHash.get(hash);
  for (const source of ensureArray(section.sources)) {
    const key = normalizeUrl(source?.url);
    if (key && candidateIndex.byUrl.has(key)) return candidateIndex.byUrl.get(key);
  }
  return null;
}

function sectionPolicyMetadata(section = {}, candidate = null) {
  const sectionBucket = text(section.relevance_bucket);
  const candidateBucket = text(candidate?.relevance_bucket);
  const bucket = sectionBucket || candidateBucket;
  const sectionPrimaryFlag = section.counts_as_primary_camera_topic === true;
  const candidatePrimaryFlag = candidate?.counts_as_primary_camera_topic === true;
  return {
    bucket,
    primary: sectionPrimaryFlag ||
      candidatePrimaryFlag ||
      isPrimaryCameraStackBucket(sectionBucket) ||
      isPrimaryCameraStackBucket(candidateBucket),
    forbidden: isForbiddenMainBucket(sectionBucket) || isForbiddenMainBucket(candidateBucket),
    source_candidate_hash: text(section.source_candidate_hash || candidateHash(candidate)),
    source_candidate_url: text(section.source_candidate_url || candidate?.url || candidate?.article_url || candidate?.articleUrl)
  };
}

function semanticError(message, details = {}) {
  return new EditorSemanticValidationError(message, details);
}

function uniqueText(values) {
  const output = [];
  const seen = new Set();
  const items = Array.isArray(values) ? values.flat() : [values];
  for (const value of items) {
    const parsed = text(value);
    if (!parsed) continue;
    const key = parsed.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(parsed);
  }
  return output;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

module.exports = {
  EditorSemanticValidationError,
  cloneJson,
  actualType,
  text,
  countDetails,
  candidateHash,
  candidateUrls,
  buildCandidateIndex,
  candidateForSection,
  sectionPolicyMetadata,
  semanticError,
  uniqueText,
  asObject
};
