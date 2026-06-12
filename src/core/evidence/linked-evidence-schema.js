const {
  FETCH_STATUSES,
  FETCH_STATUS_VALUES,
  LINKED_EVIDENCE_TYPES,
  LINKED_EVIDENCE_TYPE_VALUES,
  MAX_LINKED_EVIDENCE_PER_CANDIDATE,
  RAW_EXCERPT_MAX_LENGTH
} = require('./linked-evidence-types');

function text(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncateRawExcerpt(value, maxLength = RAW_EXCERPT_MAX_LENGTH) {
  const normalized = text(value);
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength);
}

function normalizeLinkedEvidence(item = {}) {
  const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
  const warnings = Array.isArray(source.warnings)
    ? source.warnings.map(text).filter(Boolean)
    : [];

  let type = text(source.type);
  if (!LINKED_EVIDENCE_TYPE_VALUES.includes(type)) {
    warnings.push(`Invalid linked evidence type: ${type || 'missing'}`);
    type = LINKED_EVIDENCE_TYPES.UNKNOWN;
  }

  let fetchStatus = text(source.fetch_status || source.fetchStatus);
  if (!FETCH_STATUS_VALUES.includes(fetchStatus)) {
    warnings.push(`Invalid linked evidence fetch_status: ${fetchStatus || 'missing'}`);
    fetchStatus = FETCH_STATUSES.NOT_FETCHED;
  }

  const normalized = {
    type,
    url: text(source.url),
    identifier: text(source.identifier),
    source_text: text(source.source_text || source.sourceText),
    raw_excerpt: truncateRawExcerpt(source.raw_excerpt || source.rawExcerpt),
    fetch_status: fetchStatus,
    warnings
  };
  for (const [outputKey, inputKey] of [
    ['evidence_role', 'evidenceRole'],
    ['classification_reason', 'classificationReason'],
    ['skipped_reason', 'skippedReason']
  ]) {
    const normalizedValue = text(source[outputKey] || source[inputKey]);
    if (normalizedValue) normalized[outputKey] = normalizedValue;
  }
  return normalized;
}

function normalizeLinkedEvidenceList(items = []) {
  const list = Array.isArray(items) ? items : [];
  return list
    .slice(0, MAX_LINKED_EVIDENCE_PER_CANDIDATE)
    .map(item => normalizeLinkedEvidence(item));
}

module.exports = {
  normalizeLinkedEvidence,
  normalizeLinkedEvidenceList,
  truncateRawExcerpt
};
