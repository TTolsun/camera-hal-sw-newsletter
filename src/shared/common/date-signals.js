const EVENT_TYPES = Object.freeze([
  'page_added',
  'page_removed',
  'last_updated_changed',
  'structured_modified_changed',
  'sitemap_lastmod_changed',
  'release_row_added',
  'release_row_changed',
  'anchor_added',
  'material_content_changed',
  'content_changed_without_date_change',
  'metadata_only_changed',
  'no_meaningful_change'
]);

const DATE_SOURCE_CONFIDENCE = Object.freeze({
  visible_date: 100,
  structured_date_published: 95,
  release_row_date: 95,
  visible_last_updated: 85,
  structured_date_modified: 85,
  rss_pub_date: 85,
  atom_updated: 85,
  sitemap_lastmod: 70,
  url_path_date: 65,
  snapshot_page_added: 60,
  http_last_modified: 45,
  content_hash_changed_without_date: 40,
  snapshot_detected_at: 35,
  missing: 0
});

const DATE_SOURCES = Object.freeze(Object.keys(DATE_SOURCE_CONFIDENCE));
const EVENT_TYPE_SET = new Set(EVENT_TYPES);
const DATE_SOURCE_SET = new Set(DATE_SOURCES);

function text(value) {
  return String(value || '').trim();
}

function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeDate(value) {
  const raw = text(value);
  if (!raw) return '';
  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function isKnownEventType(value) {
  return EVENT_TYPE_SET.has(text(value));
}

function isKnownDateSource(value) {
  return DATE_SOURCE_SET.has(text(value));
}

function dateSourceConfidence(value) {
  const source = text(value) || 'missing';
  return DATE_SOURCE_CONFIDENCE[source] ?? 0;
}

function validateEventType(value, label = 'event_type') {
  return isKnownEventType(value) ? '' : `${label} must be one of: ${EVENT_TYPES.join(', ')}.`;
}

function validateDateSource(value, label = 'date_source') {
  return isKnownDateSource(value) ? '' : `${label} must be one of: ${DATE_SOURCES.join(', ')}.`;
}

function publishReadyDateEvidenceFromConfidence(confidence) {
  return number(confidence) >= 85;
}

function weakDateReviewRequired(confidence, dateSource) {
  const source = text(dateSource);
  return number(confidence) < 85 ||
    source === 'content_hash_changed_without_date' ||
    source === 'snapshot_detected_at' ||
    source === 'missing';
}

function resolveCandidateDateEvidence(candidate = {}) {
  const publishedDate = normalizeDate(candidate.published_date || candidate.publishedAt || candidate.published_at);
  if (publishedDate) {
    const source = text(candidate.date_source) || 'visible_date';
    const confidence = Math.max(dateSourceConfidence(source), 85);
    return {
      date: publishedDate,
      date_field: 'published_date',
      date_source: source,
      date_confidence: confidence,
      publish_ready_date_evidence: true,
      needs_editor_date_review: false,
      reason: 'published_date present'
    };
  }

  const effectiveDate = normalizeDate(candidate.effective_date || candidate.effectiveDate);
  const source = text(candidate.date_source) || (effectiveDate ? 'missing' : 'missing');
  const confidence = number(candidate.date_confidence, dateSourceConfidence(source));
  const blockedSource = ['snapshot_detected_at', 'content_hash_changed_without_date', 'missing'].includes(source);
  const publishReady = Boolean(effectiveDate) &&
    publishReadyDateEvidenceFromConfidence(confidence) &&
    !blockedSource;
  return {
    date: effectiveDate,
    date_field: effectiveDate ? 'effective_date' : '',
    date_source: source,
    date_confidence: confidence,
    publish_ready_date_evidence: publishReady,
    needs_editor_date_review: candidate.needs_editor_date_review === true ||
      weakDateReviewRequired(confidence, source),
    reason: effectiveDate ? 'effective_date present' : 'missing date evidence'
  };
}

function dateQualityForCandidate(candidate = {}) {
  const evidence = resolveCandidateDateEvidence(candidate);
  return {
    effective_date: text(candidate.effective_date || candidate.effectiveDate),
    published_date_present: Boolean(text(candidate.published_date || candidate.publishedAt || candidate.published_at)),
    date_source: evidence.date_source,
    date_confidence: evidence.date_confidence,
    needs_editor_date_review: evidence.needs_editor_date_review,
    main_article_date_eligible: evidence.publish_ready_date_evidence,
    date_field: evidence.date_field
  };
}

module.exports = {
  DATE_SOURCE_CONFIDENCE,
  DATE_SOURCES,
  EVENT_TYPES,
  dateQualityForCandidate,
  dateSourceConfidence,
  isKnownDateSource,
  isKnownEventType,
  normalizeDate,
  publishReadyDateEvidenceFromConfidence,
  resolveCandidateDateEvidence,
  validateDateSource,
  validateEventType,
  weakDateReviewRequired
};
