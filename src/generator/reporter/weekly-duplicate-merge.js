'use strict';

// Weekly-scoped duplicate detection (#489) and merge orchestration (#489/#490). Detection is
// deterministic and scoped to the articles already in the SAME weekly issue. An exact duplicate is
// skipped. A near-duplicate is, when an LLM merge resolver is supplied, sent to the LLM which returns
// append | merge | reject; a merged article is replaced only when the injected validator passes,
// otherwise the existing article is preserved and a warning is recorded. Without an LLM resolver the
// deterministic default keeps near-duplicates (append) and only skips exact duplicates, matching the
// #488 upsert behavior. The LLM and validator are injected so this module stays pure and testable.

const { ensureArray } = require('../../core/common/value-coercion');
const { articleIdentityKey } = require('../../core/common/article-identity');
const { normalizeTitle, titleSimilarity } = require('../select/selection-normalizers');

const NEAR_DUPLICATE_TITLE_SIMILARITY = 0.82;

function sectionSourceUrl(section = {}) {
  return section.source_candidate_url ||
    section.url ||
    (ensureArray(section.sources)[0] && ensureArray(section.sources)[0].url) ||
    '';
}

function sectionTitle(section = {}) {
  return section.headline || section.title || '';
}

function sectionIdentity(section = {}) {
  return articleIdentityKey({
    url: sectionSourceUrl(section),
    title: sectionTitle(section),
    ...section
  });
}

function pageBase(url) {
  return String(url || '').split('#')[0].split('?')[0].replace(/\/$/, '').toLowerCase();
}

function findWeeklyDuplicate(article, existingArticles) {
  const identity = sectionIdentity(article);
  const exact = ensureArray(existingArticles).find(candidate => sectionIdentity(candidate) === identity);
  if (exact) return { candidate: exact, exact: true, reason: 'identity' };

  const base = pageBase(sectionSourceUrl(article));
  const title = sectionTitle(article);
  for (const candidate of ensureArray(existingArticles)) {
    if (base && pageBase(sectionSourceUrl(candidate)) === base) {
      return { candidate, exact: false, reason: 'same_source_page' };
    }
    if (normalizeTitle(title) && titleSimilarity(title, sectionTitle(candidate)) >= NEAR_DUPLICATE_TITLE_SIMILARITY) {
      return { candidate, exact: false, reason: 'title_similarity' };
    }
  }
  return null;
}

function replaceInPlace(existing, appended, target, replacement) {
  const existingIndex = existing.indexOf(target);
  if (existingIndex >= 0) {
    existing[existingIndex] = replacement;
    return;
  }
  const appendedIndex = appended.indexOf(target);
  if (appendedIndex >= 0) appended[appendedIndex] = replacement;
}

async function resolveWeeklyArticles({ existingArticles = [], incomingArticles = [], mergeDuplicate, validateMerged } = {}) {
  const existing = [...ensureArray(existingArticles)];
  const appended = [];
  const warnings = [];
  const decisions = [];

  for (const incoming of ensureArray(incomingArticles)) {
    const duplicate = findWeeklyDuplicate(incoming, [...existing, ...appended]);

    if (duplicate && duplicate.exact) {
      decisions.push({ decision: 'reject', reason: 'exact_duplicate' });
      continue;
    }
    if (!duplicate || !mergeDuplicate) {
      appended.push(incoming);
      decisions.push({ decision: 'append', reason: duplicate ? `near:${duplicate.reason}` : 'no_duplicate' });
      continue;
    }

    let outcome;
    try {
      outcome = await mergeDuplicate({ existing: duplicate.candidate, incoming, reason: duplicate.reason });
    } catch (error) {
      warnings.push({ stage: 'merge', reason: error.message, title: sectionTitle(duplicate.candidate) });
      decisions.push({ decision: 'reject', reason: 'merge_error' });
      continue;
    }

    const decision = outcome && outcome.decision;
    if (decision === 'append') {
      appended.push(incoming);
      decisions.push({ decision: 'append', reason: outcome.reason || 'llm_append' });
      continue;
    }
    if (decision === 'merge' && outcome.mergedArticle) {
      const validation = validateMerged ? await validateMerged(outcome.mergedArticle) : { ok: true };
      if (validation && validation.ok) {
        replaceInPlace(existing, appended, duplicate.candidate, outcome.mergedArticle);
        decisions.push({ decision: 'merge', reason: outcome.reason || 'llm_merge' });
      } else {
        warnings.push({
          stage: 'validate',
          reason: (validation && validation.reason) || 'merged_article_validation_failed',
          title: sectionTitle(duplicate.candidate)
        });
        decisions.push({ decision: 'merge_rejected_validation', reason: (validation && validation.reason) || 'validation_failed' });
      }
      continue;
    }
    decisions.push({ decision: 'reject', reason: (outcome && outcome.reason) || 'llm_reject' });
  }

  return { existingArticles: existing, appendedArticles: appended, warnings, decisions };
}

module.exports = {
  findWeeklyDuplicate,
  resolveWeeklyArticles,
  sectionIdentity,
  sectionSourceUrl
};
