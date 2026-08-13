'use strict';

// Weekly-scoped duplicate detection (#489) and merge orchestration (#489/#490). Detection is
// deterministic and scoped to the articles already in the SAME weekly issue. An exact duplicate is
// skipped. A near-duplicate is, when an LLM merge resolver is supplied, sent to the LLM which returns
// append | merge | reject; the section adopted for a merge is built deterministically from the
// existing article and only its prose (public_article) is taken from the LLM (#870), and it is
// replaced only when the injected validator passes, otherwise the existing article is preserved and
// a warning is recorded. The validator receives the pre-merge originals alongside the section that
// will be published (#870) because the LLM output alone cannot show whether a source was preserved
// or invented. Without an LLM resolver the
// deterministic default keeps near-duplicates (append) and only skips exact duplicates, matching the
// #488 upsert behavior. The LLM and validator are injected so this module stays pure and testable.

const { ensureArray } = require('../../shared/common/value-coercion');
const { articleIdentityKey } = require('../../shared/common/article-identity');
const { normalizeTitle, titleSimilarity } = require('../../shared/common/selection-normalizers');
const { normalizedSourceUrlKey } = require('./public-article-contract');

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

// 두 원본의 sources를 URL 기준으로 합친다. 정규화 키는 계약 모듈이 인용 allow-list를 만들 때
// 쓰는 것과 같은 것을 쓴다 — 여기서 다른 키로 중복을 지우면 합집합과 allow-list가 어긋난다.
function unionSources(existingSection, incomingSection) {
  const byUrlKey = new Map();
  for (const section of [existingSection, incomingSection]) {
    for (const source of ensureArray(section && section.sources)) {
      const key = normalizedSourceUrlKey(source && source.url ? source.url : source);
      if (!key || byUrlKey.has(key)) continue;
      byUrlKey.set(key, source);
    }
  }
  return [...byUrlKey.values()];
}

// #870: 병합으로 채택할 section을 LLM 출력으로 통째로 갈아끼우지 않는다. LLM이 쓰는 것은
// 산문(public_article)뿐이고, 이미지·relevance bucket 같은 결정론 필드는 기존 기사 것을 그대로
// 이어받는다. LLM이 section을 통째로 쓰면 검증받지 않은 이미지 URL을 넣거나, 반대로 이미지
// 필드를 그냥 빠뜨려 기존 기사의 해석된 이미지를 잃는다. sources는 두 원본의 합집합으로
// 결정론적으로 만든다 — 이 목록이 public_article.source_links의 allow-list다.
function adoptedMergeSection(existingSection, incomingSection, mergedArticle) {
  return {
    ...existingSection,
    public_article: mergedArticle.public_article,
    sources: unionSources(existingSection, incomingSection)
  };
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
      // 채택할 section을 먼저 결정론적으로 만들고, 검증기에는 실제로 발행될 그 section과
      // 병합 전 원본 두 기사를 함께 넘긴다. LLM 출력만 보면 지어낸 출처와 보존된 출처를
      // 구분할 수 없다(#870).
      const adopted = adoptedMergeSection(duplicate.candidate, incoming, outcome.mergedArticle);
      const validation = validateMerged
        ? await validateMerged(adopted, { existing: duplicate.candidate, incoming })
        : { ok: true };
      if (validation && validation.ok) {
        replaceInPlace(existing, appended, duplicate.candidate, adopted);
        decisions.push({ decision: 'merge', reason: outcome.reason || 'llm_merge' });
      } else {
        warnings.push({
          stage: 'validate',
          reason: (validation && validation.reason) || 'merged_article_validation_failed',
          issues: ensureArray(validation && validation.issues),
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
