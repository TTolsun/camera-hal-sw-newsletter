// Section identity, signatures, and duplicate detection.
//
// Single responsibility: deciding how two newsletter sections (or a candidate and a
// section) are "the same" — stable keys for locking/retry, repair signatures that must
// not drift, and duplicate detection by URL / title / source+date+title. These are pure
// transforms with no IO, LLM, or shared state; they were extracted from the generation
// orchestrator (gemini-newsroom-newsletter.js) so the orchestrator no longer owns this
// concern.

const { ensureArray } = require('./value-coercion');
const { normalizeUrl } = require('../generate/newsroom-selection');

function stringOrEmpty(value) {
  return String(value || '').trim();
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const left = new Set(normalizeTitle(a).split(' ').filter(token => token.length > 1));
  const right = new Set(normalizeTitle(b).split(' ').filter(token => token.length > 1));
  if (left.size === 0 || right.size === 0) return 0;
  const overlap = [...left].filter(token => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function sectionUrls(section) {
  return ensureArray(section?.sources).map(source => source && source.url).filter(Boolean);
}

function urlKeys(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const keys = new Set([raw]);
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

function sourceUrlSignature(section) {
  return [...new Set(
    ensureArray(section?.sources)
      .map(source => normalizeUrl(source?.url))
      .filter(Boolean)
  )].sort();
}

function sectionRepairSignature(section) {
  return {
    headline: stringOrEmpty(section?.headline),
    category: stringOrEmpty(section?.category),
    source_candidate_hash: stringOrEmpty(section?.source_candidate_hash),
    source_urls: sourceUrlSignature(section)
  };
}

function sectionLabelKey(section) {
  const label = [
    normalizeTitle(section?.headline),
    normalizeTitle(section?.category)
  ].filter(Boolean).join('|');
  return label ? `label:${label}` : '';
}

function stableSectionKey(section) {
  const hash = stringOrEmpty(section?.source_candidate_hash);
  if (hash) return `hash:${hash}`;
  const groupKey = stringOrEmpty(section?.article_group_key || section?.articleGroupKey);
  const urls = sourceUrlSignature(section);
  if (groupKey && urls.length > 0) return `group-url:${groupKey}|${urls.join('|')}`;
  if (urls.length > 0) return `urls:${urls.join('|')}`;
  return sectionLabelKey(section);
}

function stableSectionKeySet(sections = []) {
  return new Set(ensureArray(sections).map(stableSectionKey).filter(Boolean));
}

function sameStringSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function protectedRepairSignature(section = {}) {
  return {
    headline: stringOrEmpty(section.headline),
    category: stringOrEmpty(section.category),
    relevance_bucket: stringOrEmpty(section.relevance_bucket || section.relevanceBucket),
    article_group_key: stringOrEmpty(section.article_group_key || section.articleGroupKey),
    source_candidate_hash: stringOrEmpty(section.source_candidate_hash),
    source_urls: sourceUrlSignature(section)
  };
}

function protectedRepairFieldsMatch(beforeSection = {}, afterSection = {}) {
  return JSON.stringify(protectedRepairSignature(beforeSection)) === JSON.stringify(protectedRepairSignature(afterSection));
}

function sameSectionLabel(left, right) {
  const leftLabel = normalizeTitle(left?.headline || left?.category);
  const rightLabel = normalizeTitle(right?.headline || right?.category);
  return Boolean(leftLabel && rightLabel && leftLabel === rightLabel);
}

function signaturesMatch(left, right) {
  return JSON.stringify(sectionRepairSignature(left)) === JSON.stringify(sectionRepairSignature(right));
}

function sourceDateTitle(section) {
  const firstSource = ensureArray(section.sources)[0] || {};
  return {
    source: normalizeTitle(firstSource.title || section.source),
    publishedDate: String(section.published_date || section.publishedDate || '').trim(),
    title: section.headline || firstSource.title || ''
  };
}

function sectionsAreDuplicate(left, right) {
  const leftUrls = new Set(sectionUrls(left));
  if (sectionUrls(right).some(url => leftUrls.has(url))) return true;
  if (normalizeTitle(left.headline) && normalizeTitle(left.headline) === normalizeTitle(right.headline)) return true;
  if (titleSimilarity(left.headline, right.headline) >= 0.82) return true;
  const leftKey = sourceDateTitle(left);
  const rightKey = sourceDateTitle(right);
  return leftKey.source &&
    leftKey.source === rightKey.source &&
    leftKey.publishedDate &&
    leftKey.publishedDate === rightKey.publishedDate &&
    titleSimilarity(leftKey.title, rightKey.title) >= 0.68;
}

function duplicateReasonForSections(left, right, context = 'locked') {
  const leftUrls = new Set(sectionUrls(left));
  if (sectionUrls(right).some(url => leftUrls.has(url))) {
    return context === 'locked' ? 'duplicate_locked_url' : 'duplicate_demoted_url';
  }
  if (normalizeTitle(left.headline) && normalizeTitle(left.headline) === normalizeTitle(right.headline)) {
    return context === 'locked' ? 'duplicate_locked_title' : 'duplicate_source_date_title';
  }
  if (titleSimilarity(left.headline, right.headline) >= 0.82) {
    return context === 'locked' ? 'duplicate_locked_title' : 'duplicate_source_date_title';
  }
  const leftKey = sourceDateTitle(left);
  const rightKey = sourceDateTitle(right);
  if (
    leftKey.source &&
    leftKey.source === rightKey.source &&
    leftKey.publishedDate &&
    leftKey.publishedDate === rightKey.publishedDate &&
    titleSimilarity(leftKey.title, rightKey.title) >= 0.68
  ) {
    return 'duplicate_source_date_title';
  }
  return '';
}

function sectionSummary(section, index) {
  return {
    index: index + 1,
    headline: section.headline,
    category: section.category,
    relevance_bucket: section.relevance_bucket || '',
    urls: sectionUrls(section),
    source_titles: ensureArray(section.sources).map(source => source.title).filter(Boolean)
  };
}

function candidateDuplicatesSections(candidate, sections) {
  const candidateSection = {
    headline: candidate.title,
    published_date: candidate.published_date,
    sources: [{ title: candidate.source, url: candidate.url }]
  };
  return sections.some(section => sectionsAreDuplicate(candidateSection, section));
}

module.exports = {
  candidateDuplicatesSections,
  duplicateReasonForSections,
  normalizeTitle,
  protectedRepairFieldsMatch,
  protectedRepairSignature,
  sameSectionLabel,
  sameStringSet,
  sectionLabelKey,
  sectionRepairSignature,
  sectionSummary,
  sectionUrls,
  sectionsAreDuplicate,
  signaturesMatch,
  sourceDateTitle,
  sourceUrlSignature,
  stableSectionKey,
  stableSectionKeySet,
  titleSimilarity,
  urlKeys
};
