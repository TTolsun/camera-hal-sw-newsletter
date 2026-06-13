// Orchestrator reporter-output matching helpers.
//
// Single responsibility: deterministic matching of LLM reporter output
// candidates back to the input candidate set (id / url / title-url indexes)
// and merge-warning construction. Pure transforms on their arguments only —
// no generationRunState, no fs, no module globals — extracted verbatim from
// the generation orchestrator (gemini-newsroom-newsletter.js).

const { normalizeTitle } = require('../../shared/common/section-identity');
const {
  normalizeUrl,
  normalizedUrlHash
} = require('../select/newsroom-selection');
const { ensureArray } = require('../render/newsletter-renderer');
const { stringOrEmpty } = require('./orchestrator-shared-helpers');

function reporterCandidateId(candidate = {}) {
  const url = candidate.url || candidate.article_url || candidate.articleUrl;
  return stringOrEmpty(
    candidate.candidate_id ||
    candidate.source_candidate_hash ||
    candidate.url_hash ||
    (url ? normalizedUrlHash(url) : '')
  );
}

function reporterTitleUrlKey(candidate = {}) {
  const url = normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl);
  const title = normalizeTitle(candidate.title);
  return url && title ? `${url}\n${title}` : '';
}

function addReporterIndexEntry(index, key, candidate) {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(candidate);
}

function buildReporterCandidateIndexes(candidates = []) {
  const byId = new Map();
  const byUrl = new Map();
  const byTitleUrl = new Map();
  for (const candidate of ensureArray(candidates)) {
    addReporterIndexEntry(byId, reporterCandidateId(candidate), candidate);
    addReporterIndexEntry(byUrl, normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl), candidate);
    addReporterIndexEntry(byTitleUrl, reporterTitleUrlKey(candidate), candidate);
  }
  return { byId, byUrl, byTitleUrl };
}

function reporterMergeWarning(candidate, reason, extra = {}) {
  return {
    reason,
    candidate_id: stringOrEmpty(candidate?.candidate_id),
    title: stringOrEmpty(candidate?.title),
    url: stringOrEmpty(candidate?.url || candidate?.article_url || candidate?.articleUrl),
    ...extra
  };
}

function uniqueStrings(values = []) {
  return [...new Set(ensureArray(values).map(stringOrEmpty).filter(Boolean))];
}

function mergeReporterEvidenceFields(base, llmCandidate = null) {
  if (!llmCandidate) return { ...base };
  const merged = { ...base };
  for (const key of ['version_or_release', 'api_or_component', 'behavior_change', 'cross_check_status', 'relevance_reason']) {
    const value = stringOrEmpty(llmCandidate[key]);
    if (value) merged[key] = value;
  }
  for (const key of ['evidence_notes', 'impact_areas', 'do_not_overstate']) {
    const values = uniqueStrings([
      ...ensureArray(base[key]),
      ...ensureArray(llmCandidate[key])
    ]);
    if (values.length > 0) merged[key] = values;
  }
  return merged;
}

function reporterMatchFromIndex(index, key, warningCandidate, warnings, duplicateReason) {
  if (!key) return null;
  const matches = index.get(key) || [];
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    warnings.push(reporterMergeWarning(warningCandidate, duplicateReason, { match_count: matches.length }));
  }
  return null;
}

function matchReporterOutputCandidate(candidate, indexes, warnings) {
  const candidateId = stringOrEmpty(candidate.candidate_id);
  if (candidateId) {
    const idMatches = indexes.byId.get(candidateId) || [];
    if (idMatches.length === 1) return idMatches[0];
    if (idMatches.length > 1) {
      warnings.push(reporterMergeWarning(candidate, 'duplicate_input_candidate_id', { match_count: idMatches.length }));
      return null;
    }
  }

  const url = normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl);
  const urlMatches = url ? indexes.byUrl.get(url) || [] : [];
  if (urlMatches.length === 1) return urlMatches[0];
  if (urlMatches.length > 1) {
    const titleUrl = reporterMatchFromIndex(
      indexes.byTitleUrl,
      reporterTitleUrlKey(candidate),
      candidate,
      warnings,
      'duplicate_input_title_url'
    );
    if (titleUrl) return titleUrl;
    warnings.push(reporterMergeWarning(candidate, 'duplicate_input_url', { match_count: urlMatches.length }));
    return null;
  }

  warnings.push(reporterMergeWarning(candidate, 'unmatched_reporter_candidate'));
  return null;
}

module.exports = {
  reporterCandidateId,
  reporterTitleUrlKey,
  addReporterIndexEntry,
  buildReporterCandidateIndexes,
  reporterMergeWarning,
  uniqueStrings,
  mergeReporterEvidenceFields,
  reporterMatchFromIndex,
  matchReporterOutputCandidate
};
