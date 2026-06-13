'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  normalizeUrl,
  normalizedUrlHash
} = require('../../shared/common/selection-normalizers');

function text(value) {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return String(value || '').trim();
}

function normalizeForMatch(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFC')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function urlKeys(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const keys = new Set([raw, raw.toLowerCase()]);
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    const normalized = parsed.toString().replace(/\/$/, '');
    keys.add(normalized);
    keys.add(normalized.toLowerCase());
  } catch {
    keys.add(raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase());
  }
  return [...keys].filter(Boolean);
}

function normalizedUrlKey(value) {
  return normalizeUrl(value) || text(value).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
}

function candidateUrls(candidate) {
  candidate = candidate || {};
  return [...new Set([
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.normalized_url
  ].map(text).filter(Boolean))];
}

function candidateCanonicalUrl(candidate) {
  candidate = candidate || {};
  return text(candidate.url || candidate.article_url || candidate.articleUrl || candidate.normalized_url);
}

function candidateHash(candidate) {
  candidate = candidate || {};
  const candidateUrl = candidateCanonicalUrl(candidate);
  return text(candidate.source_candidate_hash || candidate.url_hash || candidate.normalized_url_hash) ||
    (candidateUrl ? normalizedUrlHash(candidateUrl) : '');
}

function candidateIdentity(candidate) {
  candidate = candidate || {};
  return [
    normalizedUrlKey(candidateCanonicalUrl(candidate)),
    normalizeForMatch(candidate.source_id),
    normalizeForMatch(candidate.title),
    normalizeForMatch(candidate.published_date || candidate.publishedAt),
    normalizeForMatch(candidate.version_or_release || candidate.versionOrRelease),
    normalizeForMatch(candidate.api_or_component || candidate.apiOrComponent)
  ].join('|');
}

function pushCandidateEntries(entries, candidates, priority, source) {
  const seen = new Set(entries.map(entry => `${entry.priority}|${candidateIdentity(entry.candidate)}`));
  for (const candidate of ensureArray(candidates)) {
    const id = `${priority}|${candidateIdentity(candidate)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ candidate, priority, source });
  }
}

function candidateBindingIndex(reporter, shortlistReport) {
  reporter = reporter || {};
  shortlistReport = shortlistReport || null;
  const entries = [];
  const primarySelected = ensureArray(shortlistReport && shortlistReport.primary_selected_articles);
  const flaggedSelected = ensureArray(shortlistReport && shortlistReport.shortlisted_candidates).filter(candidate =>
    candidate && (candidate.final_selected === true || candidate.primary_selected === true || candidate.selected_for_editor === true)
  );
  pushCandidateEntries(
    entries,
    [
      ...primarySelected,
      ...ensureArray(shortlistReport && shortlistReport.selected_articles),
      ...flaggedSelected
    ],
    1,
    'shortlist_selected'
  );
  pushCandidateEntries(
    entries,
    [
      ...ensureArray(shortlistReport && shortlistReport.reserve_candidates),
      ...ensureArray(shortlistReport && shortlistReport.demoted_candidates),
      ...ensureArray(shortlistReport && shortlistReport.excluded_candidates),
      ...ensureArray(shortlistReport && shortlistReport.shortlisted_candidates).filter(candidate =>
        candidate && candidate.final_selected !== true && candidate.primary_selected !== true && candidate.selected_for_editor !== true
      )
    ],
    2,
    'shortlist_other'
  );
  pushCandidateEntries(entries, ensureArray(reporter && reporter.candidates), 3, 'reporter_candidate');

  const byUrl = new Map();
  for (const entry of entries) {
    const entryUrlKeys = new Set();
    for (const url of candidateUrls(entry.candidate)) {
      const key = normalizedUrlKey(url);
      if (!key || entryUrlKeys.has(key)) continue;
      entryUrlKeys.add(key);
      if (!byUrl.has(key)) byUrl.set(key, []);
      byUrl.get(key).push(entry);
    }
  }
  return { byUrl, entries };
}

function sourceEvidence(section) {
  section = section || {};
  return [
    section.headline,
    section.category,
    section.what_changed,
    section.confirmed_facts,
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes,
    section.sources
  ].map(text).join(' ');
}

module.exports = {
  normalizeForMatch,
  urlKeys,
  normalizedUrlKey,
  candidateUrls,
  candidateCanonicalUrl,
  candidateHash,
  candidateIdentity,
  pushCandidateEntries,
  candidateBindingIndex,
  sourceEvidence
};
