'use strict';

const {
  resolveCandidateDateEvidence
} = require('../../core/common/date-signals');

function text(value) {
  return String(value || '').trim();
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rounded(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function publishedDate(candidate) {
  return text(candidate.published_date || candidate.publishedAt || candidate.published_at);
}

function selectionDateEvidence(candidate) {
  return resolveCandidateDateEvidence(candidate);
}

function selectionDate(candidate) {
  return selectionDateEvidence(candidate).date;
}

function hasPublishReadyDateEvidence(candidate) {
  return selectionDateEvidence(candidate).publish_ready_date_evidence;
}

function datePrecision(candidate) {
  return text(candidate.datePrecision || candidate.date_precision);
}

function candidateUrl(candidate) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl);
}

function candidateSource(candidate) {
  return text(candidate.source || candidate.source_name);
}

function fieldBoolean(candidate, camel, snake, fallback = false) {
  if (typeof candidate[camel] === 'boolean') return candidate[camel];
  if (typeof candidate[snake] === 'boolean') return candidate[snake];
  return fallback;
}

module.exports = {
  text,
  bool,
  number,
  clamp,
  rounded,
  publishedDate,
  selectionDateEvidence,
  selectionDate,
  hasPublishReadyDateEvidence,
  datePrecision,
  candidateUrl,
  candidateSource,
  fieldBoolean
};
