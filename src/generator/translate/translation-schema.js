'use strict';

const { sectionKey, referenceKey, translationSourceHash } = require('../render/apply-translation');

// Project only display prose; identity and metadata cannot be authored by the model.
function translationInput(issue, sourceText) {
  return {
    schemaVersion: 1,
    weekly_key: issue.weekly_key,
    source_hash: translationSourceHash(sourceText),
    title: issue.title,
    summary: issue.summary,
    sections: (issue.sections || []).map(section => {
      const article = section.public_article || {};
      return {
        id: sectionKey(section),
        headline: article.headline || section.headline,
        body_markdown: article.body_markdown || (article.body_paragraphs || []).join('\n\n'),
        why_it_matters: article.camera_hal_takeaway,
        ...(article.lead ? { lead: article.lead } : {}),
        ...(article.source_subtitle ? { source_subtitle: article.source_subtitle } : {}),
        ...(section.imageAlt ? { image_alt: section.imageAlt } : {}),
        ...((section.sources || []).some(source => source.title) ? {
          source_titles: Object.fromEntries(section.sources.filter(source => source.title).map(source => [source.url, source.title]))
        } : {})
      };
    }),
    watch_points: issue.watch_points || [],
    reference_articles: (issue.reference_articles || []).map(article => ({
      id: referenceKey(article), title: article.title, ...(article.note ? { note: article.note } : {})
    }))
  };
}

// Small response schema. Per-item keys and immutable values are checked after decoding.
function translationSchema(input) {
  const string = { type: 'STRING' };
  const object = properties => ({ type: 'OBJECT', properties, required: Object.keys(properties) });
  const section = {
    id: string, headline: string, body_markdown: string, why_it_matters: string,
    lead: string, source_subtitle: string, image_alt: string
  };
  const urls = [...new Set(input.sections.flatMap(item => Object.keys(item.source_titles || {})))];
  if (urls.length) section.source_titles = { type: 'OBJECT', properties: Object.fromEntries(urls.map(url => [url, string])) };
  return object({
    schemaVersion: { type: 'INTEGER' }, weekly_key: string, source_hash: string,
    title: string, summary: string,
    sections: { type: 'ARRAY', items: { type: 'OBJECT', properties: section, required: ['id', 'headline', 'body_markdown', 'why_it_matters'] } },
    watch_points: { type: 'ARRAY', items: string },
    reference_articles: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: string, title: string, note: string }, required: ['id', 'title'] } }
  });
}

module.exports = { translationInput, translationSchema };
