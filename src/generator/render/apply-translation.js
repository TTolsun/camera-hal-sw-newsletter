const { createHash } = require('node:crypto');

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

function matchById(original, translated, label) {
  if (!Array.isArray(translated) || translated.length !== original.length) throw new Error(`Translation count mismatch: ${label}`);
  const ids = new Set(original.map(item => item.id));
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
  const sections = matchById(issue.sections || [], translation.sections, 'sections');
  result.sections = (issue.sections || []).map(section => {
    const overlay = sections.get(section.id);
    allowedKeys(overlay, ['id', 'headline', 'lead', 'body_markdown', 'why_it_matters', 'source_subtitle'], 'section');
    const original = section.public_article || {};
    const headline = text(overlay.headline, 'headline');
    const body = text(overlay.body_markdown, 'body_markdown');
    const takeaway = text(overlay.why_it_matters, 'why_it_matters');
    return {
      ...structuredClone(section),
      headline,
      public_article: {
        ...structuredClone(original),
        headline,
        lead: original.lead || overlay.lead !== undefined ? text(overlay.lead, 'lead') : '',
        source_subtitle: original.source_subtitle || overlay.source_subtitle !== undefined ? text(overlay.source_subtitle, 'source_subtitle') : '',
        body_markdown: body,
        body_paragraphs: body.split(/\n\s*\n/),
        camera_hal_takeaway: takeaway
      }
    };
  });
  result.briefing = result.sections.map(section => section.public_article.headline);
  const watch = issue.watch_points || [];
  if (!Array.isArray(translation.watch_points) || translation.watch_points.length !== watch.length) throw new Error('Translation count mismatch: watch_points');
  result.watch_points = translation.watch_points.map((value, index) => text(value, `watch_points[${index}]`));
  const references = matchById(issue.reference_articles || [], translation.reference_articles, 'reference_articles');
  result.reference_articles = (issue.reference_articles || []).map(article => {
    const overlay = references.get(article.id);
    allowedKeys(overlay, ['id', 'title', 'note'], 'reference');
    return { ...structuredClone(article), title: text(overlay.title, 'reference.title'), note: article.note || overlay.note !== undefined ? text(overlay.note, 'reference.note') : '' };
  });
  return result;
}

module.exports = { applyTranslation, translationSourceHash };
