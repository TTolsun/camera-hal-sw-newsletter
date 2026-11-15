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
    id: string, headline: string, body_markdown: string, why_it_matters: string
  };
  // A shared array schema cannot require a field only on selected items. Require the union of
  // source prose keys; null represents absence on an individual item, never omitted translation.
  for (const field of ['lead', 'source_subtitle', 'image_alt']) {
    if (input.sections.some(item => Object.hasOwn(item, field))) section[field] = { ...string, nullable: true };
  }
  const urls = [...new Set(input.sections.flatMap(item => Object.keys(item.source_titles || {})))];
  if (urls.length) section.source_titles = { type: 'OBJECT', properties: Object.fromEntries(urls.map(url => [url, string])) };
  const reference = { id: string, title: string };
  if (input.reference_articles.some(item => Object.hasOwn(item, 'note'))) reference.note = { ...string, nullable: true };
  return object({
    schemaVersion: { type: 'INTEGER' }, weekly_key: string, source_hash: string,
    title: string, summary: string,
    sections: { type: 'ARRAY', items: object(section) },
    watch_points: { type: 'ARRAY', items: string },
    reference_articles: { type: 'ARRAY', items: object(reference) }
  });
}

// 원문 문자열에 백틱이 하나도 없으면 번역문의 백틱은 내용이 아니라 모델이 덧붙인 서식이다. 프롬프트가 금지해도
// 모델이 식별자에 백틱을 붙였으므로(2026-W47), 코드 펜스 줄과 인라인 백틱 문자만 걷어 내고 안의 텍스트는 둔다.
// 원문에 백틱이 있던 문자열은 "기존 코드는 그대로 보존" 계약에 따라 건드리지 않는다.
function stripAddedBackticks(source, target) {
  if (typeof target === 'string') {
    if (typeof source !== 'string' || source.includes('`')) return target;
    const unfenced = target.replace(/^[ \t]*```[^\n`]*$\n?/gm, '');
    return (unfenced === target ? target : unfenced.trim()).replace(/`/g, '');
  }
  if (Array.isArray(target)) {
    return target.map((value, index) => stripAddedBackticks(Array.isArray(source) ? source[index] : undefined, value));
  }
  if (target && typeof target === 'object') {
    return Object.fromEntries(Object.entries(target).map(([key, value]) => [key, stripAddedBackticks(source?.[key], value)]));
  }
  return target;
}

function normalizeTranslationResponse(response, input) {
  const result = structuredClone(response);
  // sections와 reference_articles는 응답 순서가 아니라 id로 원문 항목과 짝을 짓는다.
  for (const group of ['sections', 'reference_articles']) {
    if (!Array.isArray(result?.[group])) continue;
    result[group] = result[group].map(item => stripAddedBackticks(input[group].find(source => source.id === item?.id), item));
  }
  for (const field of ['title', 'summary', 'watch_points']) {
    if (Object.hasOwn(result || {}, field)) result[field] = stripAddedBackticks(input[field], result[field]);
  }
  for (const [group, fields] of [['sections', ['lead', 'source_subtitle', 'image_alt']], ['reference_articles', ['note']]]) {
    if (!Array.isArray(result?.[group])) continue;
    for (const item of result[group]) {
      const original = input[group].find(source => source.id === item?.id);
      if (!original) continue;
      for (const field of fields) {
        if (!Object.hasOwn(original, field) && item[field] === null) delete item[field];
      }
    }
  }
  return result;
}

module.exports = { translationInput, translationSchema, normalizeTranslationResponse };
