'use strict';

const {
  resolveCandidateDateEvidence
} = require('../../shared/common/date-signals');
const { kstDate } = require('../../shared/common/common');

const ANCHOR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

// coverage 계산은 항상 YYYY-MM-DD anchor가 있어야 한다(coverageForAnchorDate가 그 외에는
// throw). 실행 진입점(selectFinalArticlesWithDiagnostics)은 anchor 누락을 오늘로 조용히
// 메우지 않고 throw하지만, freshnessWindowMetadata/freshnessScore 같은 하위 유틸은 기존에도
// newsletterDate 없이 호출 가능했던 계약을 유지한다 — 그 경우만 오늘(KST) 날짜로 채운다.
function freshnessAnchorDate(newsletterDate) {
  const normalizedDate = text(newsletterDate);
  return ANCHOR_DATE_PATTERN.test(normalizedDate) ? normalizedDate : kstDate();
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
  freshnessAnchorDate,
  candidateUrl,
  candidateSource,
  fieldBoolean
};
