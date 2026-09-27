const { createHash } = require('node:crypto');
const { sectionIdentity } = require('../reporter/weekly-duplicate-merge');

function translationSourceHash(source) {
  return `sha256:${createHash('sha256').update(typeof source === 'string' ? source : JSON.stringify(source)).digest('hex')}`;
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing translation: ${label}`);
  return value;
}

function allowedKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid translation: ${label}`);
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`Translation cannot override ${label}.${key}`);
  }
}

// Published issues carry no section or reference id, so the key falls back to the article
// identity (section) or the URL (reference). An id that is present must still be valid.
function sectionKey(section) {
  return section.id !== undefined ? section.id : sectionIdentity(section);
}

function referenceKey(article) {
  return article.id !== undefined ? article.id : article.url;
}

function matchById(original, translated, label, key) {
  if (!Array.isArray(translated) || translated.length !== original.length) throw new Error(`Translation count mismatch: ${label}`);
  const ids = new Set(original.map(key));
  if ([...ids].some(id => typeof id !== 'string' || !id.trim()) || ids.size !== original.length) throw new Error(`Invalid source IDs: ${label}`);
  const byId = new Map();
  for (const item of translated) {
    if (!item || !ids.has(item.id) || byId.has(item.id)) throw new Error(`Unknown or duplicate translation ID: ${label}`);
    byId.set(item.id, item);
  }
  return byId;
}

// Only display prose is replaced. All evidence, media, identity and ordering come from the source.
function applyTranslation(issue, translation, { sourceText } = {}) {
  allowedKeys(translation, ['schemaVersion', 'weekly_key', 'source_hash', 'title', 'summary', 'sections', 'watch_points', 'reference_articles'], 'issue');
  if (translation.schemaVersion !== 1 || !/^\d{4}-W\d{2}$/.test(issue.weekly_key || '') || translation.weekly_key !== issue.weekly_key) throw new Error('Translation identity mismatch');
  if (sourceText !== undefined && JSON.stringify(JSON.parse(sourceText)) !== JSON.stringify(issue)) throw new Error('Source text does not match issue');
  if (translation.source_hash !== translationSourceHash(sourceText === undefined ? issue : sourceText)) throw new Error('Stale translation source_hash');
  const result = structuredClone(issue);
  result.title = text(translation.title, 'title');
  result.summary = text(translation.summary, 'summary');
  const sections = matchById(issue.sections || [], translation.sections, 'sections', sectionKey);
  result.sections = (issue.sections || []).map(section => {
    const overlay = sections.get(sectionKey(section));
    allowedKeys(overlay, ['id', 'headline', 'lead', 'body_markdown', 'why_it_matters', 'source_subtitle', 'image_alt', 'source_titles'], 'section');
    const original = section.public_article || {};
    const headline = text(overlay.headline, 'headline');
    const body = text(overlay.body_markdown, 'body_markdown');
    const takeaway = text(overlay.why_it_matters, 'why_it_matters');
    // Source titles are display text; the URL stays the identity, so each key must name a source URL.
    const sourceTitles = overlay.source_titles === undefined ? {} : overlay.source_titles;
    allowedKeys(sourceTitles, (section.sources || []).map(source => source.url), 'section.source_titles');
    const retitle = sources => sources && sources.map(source => Object.hasOwn(sourceTitles, source.url)
      ? { ...structuredClone(source), title: text(sourceTitles[source.url], 'source_titles') }
      : structuredClone(source));
    // The translated article keeps the source's field shape. Adding a key the source lacks changes
    // how it renders: an empty source_subtitle alone turns a legacy article into a story article.
    const article = { ...structuredClone(original), headline, camera_hal_takeaway: takeaway };
    if (original.source_links) article.source_links = retitle(original.source_links);
    if (original.lead || overlay.lead !== undefined) article.lead = text(overlay.lead, 'lead');
    if (original.source_subtitle || overlay.source_subtitle !== undefined) article.source_subtitle = text(overlay.source_subtitle, 'source_subtitle');
    if (Object.hasOwn(original, 'body_markdown')) article.body_markdown = body;
    if (Object.hasOwn(original, 'body_paragraphs') || !Object.hasOwn(original, 'body_markdown')) article.body_paragraphs = body.split(/\n\s*\n/);
    return {
      ...structuredClone(section),
      headline,
      ...(overlay.image_alt !== undefined ? { imageAlt: text(overlay.image_alt, 'image_alt') } : {}),
      ...(section.sources ? { sources: retitle(section.sources) } : {}),
      public_article: article
    };
  });
  result.briefing = result.sections.map(section => section.public_article.headline);
  const watch = issue.watch_points || [];
  if (!Array.isArray(translation.watch_points) || translation.watch_points.length !== watch.length) throw new Error('Translation count mismatch: watch_points');
  result.watch_points = translation.watch_points.map((value, index) => text(value, `watch_points[${index}]`));
  const references = matchById(issue.reference_articles || [], translation.reference_articles, 'reference_articles', referenceKey);
  result.reference_articles = (issue.reference_articles || []).map(article => {
    const overlay = references.get(referenceKey(article));
    allowedKeys(overlay, ['id', 'title', 'note'], 'reference');
    return { ...structuredClone(article), title: text(overlay.title, 'reference.title'), note: article.note || overlay.note !== undefined ? text(overlay.note, 'reference.note') : '' };
  });
  return result;
}

module.exports = { applyTranslation, translationSourceHash };
