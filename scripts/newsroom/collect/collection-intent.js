const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  collectionIntentPath,
  collectionIntentRelPath,
  toPosix
} = require('../common/artifact-paths');
const {
  readJson,
  repoPath,
  writeJson
} = require('../common/common');

const SCHEMA_VERSION = 1;

class CollectionIntentError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CollectionIntentError';
    this.details = details;
  }
}

function text(value) {
  return String(value || '').trim();
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function stableSeedId(url, index) {
  const hash = crypto.createHash('sha256').update(text(url).toLowerCase()).digest('hex').slice(0, 10);
  return `seed-${String(index + 1).padStart(2, '0')}-${hash}`;
}

function normalizeStringList(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(text).filter(Boolean))]
    : [];
}

function normalizeSeed(seed = {}, index = 0) {
  const url = text(seed.url);
  return {
    seed_id: text(seed.seed_id || seed.seedId) || stableSeedId(url, index),
    url,
    source_id: text(seed.source_id || seed.sourceId),
    expected_topic: text(seed.expected_topic || seed.expectedTopic),
    priority: text(seed.priority || 'medium'),
    editor_note: text(seed.editor_note || seed.editorNote)
  };
}

function normalizeCollectionIntentPayload(payload = {}, date = '') {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return {
    schema_version: SCHEMA_VERSION,
    newsletter_date: text(source.newsletter_date || source.date || date),
    generated_at: text(source.generated_at || source.generatedAt || new Date().toISOString()),
    seed_urls: Array.isArray(source.seed_urls || source.seedUrls)
      ? (source.seed_urls || source.seedUrls).map(normalizeSeed).filter(seed => seed.url)
      : [],
    keyword_hints: normalizeStringList(source.keyword_hints || source.keywordHints),
    policy: {
      keyword_hints_are_facts: false,
      source_backed_facts_must_come_from_evidence_pack: true
    }
  };
}

function validateCollectionIntentPayload(payload = {}, date = '') {
  const errors = [];
  if (Number(payload.schema_version) !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }
  if (date && payload.newsletter_date !== date) {
    errors.push(`newsletter_date must match ${date}`);
  }
  const seenSeedIds = new Set();
  for (const [index, seed] of (payload.seed_urls || []).entries()) {
    if (!seed.seed_id) errors.push(`seed_urls[${index}].seed_id is required`);
    if (!seed.url) errors.push(`seed_urls[${index}].url is required`);
    if (seenSeedIds.has(seed.seed_id)) errors.push(`duplicate seed_id: ${seed.seed_id}`);
    seenSeedIds.add(seed.seed_id);
    for (const [field, value] of Object.entries(seed)) {
      if (String(value || '').includes('\n') || String(value || '').includes('\r')) {
        errors.push(`seed_urls[${index}].${field} must be single-line`);
      }
    }
  }
  for (const [index, keyword] of (payload.keyword_hints || []).entries()) {
    if (String(keyword || '').includes('\n') || String(keyword || '').includes('\r')) {
      errors.push(`keyword_hints[${index}] must be single-line`);
    }
  }
  if (errors.length > 0) {
    throw new CollectionIntentError('Invalid collection-intent.json', { errors });
  }
  return payload;
}

function loadCollectionIntent(filePath, date) {
  try {
    const normalized = normalizeCollectionIntentPayload(readJson(filePath), date);
    return validateCollectionIntentPayload(normalized, date);
  } catch (error) {
    if (error instanceof CollectionIntentError) throw error;
    throw new CollectionIntentError(`Invalid collection intent artifact: ${filePath}`, {
      parse_error: error.message
    });
  }
}

function approveCollectionIntent({
  root = process.cwd(),
  date,
  inputPath = ''
} = {}) {
  const canonicalPath = collectionIntentPath(root, date);
  const sourcePath = text(inputPath)
    ? repoPath(root, inputPath)
    : fs.existsSync(canonicalPath) ? canonicalPath : '';
  if (!sourcePath) return null;
  if (!fs.existsSync(sourcePath)) {
    throw new CollectionIntentError(`Missing collection intent artifact: ${inputPath}`, {
      inputPath
    });
  }
  const payload = loadCollectionIntent(sourcePath, date);
  writeJson(canonicalPath, payload);
  return {
    path: canonicalPath,
    relPath: collectionIntentRelPath(date),
    hash: hashFile(canonicalPath),
    payload,
    seedUrlCount: payload.seed_urls.length,
    keywordHintCount: payload.keyword_hints.length,
    status: 'approved'
  };
}

function approvedCollectionIntentFromManifest({
  root = process.cwd(),
  date,
  manifest = {}
} = {}) {
  const relPath = text(manifest.collection_intent);
  const status = text(manifest.collection_intent_status);
  const hash = text(manifest.collection_intent_hash);
  const canonicalRelPath = collectionIntentRelPath(date);
  const canonicalPath = collectionIntentPath(root, date);

  if (!relPath && !fs.existsSync(canonicalPath)) return null;
  if (!relPath || status !== 'approved' || !hash) {
    throw new CollectionIntentError('collection-intent.json exists but is not approved by raw-candidate-manifest.json', {
      collection_intent: relPath,
      collection_intent_status: status,
      collection_intent_hash: hash
    });
  }
  if (toPosix(relPath) !== canonicalRelPath) {
    throw new CollectionIntentError(`collection_intent must be ${canonicalRelPath}`, {
      collection_intent: relPath
    });
  }
  const resolved = repoPath(root, relPath);
  if (!resolved || !fs.existsSync(resolved)) {
    throw new CollectionIntentError(`Approved collection intent artifact is missing: ${relPath}`, {
      collection_intent: relPath
    });
  }
  const actualHash = hashFile(resolved);
  if (actualHash !== hash) {
    throw new CollectionIntentError('collection_intent_hash mismatch', {
      collection_intent: relPath,
      expected_hash: hash,
      actual_hash: actualHash
    });
  }
  const payload = loadCollectionIntent(resolved, date);
  return {
    path: resolved,
    relPath,
    hash: actualHash,
    payload,
    seedUrlCount: payload.seed_urls.length,
    keywordHintCount: payload.keyword_hints.length,
    status
  };
}

module.exports = {
  CollectionIntentError,
  approveCollectionIntent,
  approvedCollectionIntentFromManifest,
  hashFile,
  normalizeCollectionIntentPayload,
  validateCollectionIntentPayload
};
