'use strict';

// The archive boundary reads only published files. It does not infer evidence, contract versions,
// editorial quality, or missing prose from newsroom runs. Unsupported markup fails closed.
const { createHash } = require('node:crypto');
const { decodeHtml, htmlAttr } = require('../../shared/common/common');

const hash = text => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const plain = html => decodeHtml(String(html).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const publicText = text => plain(text).replace(/^#{2,3}\s+/, '').replace(/^\*\*(.*?)\*\*$/, '$1').replace(/^-\s+/, '');
const matches = (text, pattern) => [...String(text).matchAll(pattern)];
const hasClass = (tag, name) => htmlAttr(tag, 'class').split(/\s+/).includes(name);
const tagText = (html, tag, className) => {
  const found = matches(html, new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'g'))
    .find(match => !className || hasClass(match[1], className));
  return found ? plain(found[2]) : '';
};

function sections(html, className) {
  return matches(html, /<section\b([^>]*)>([\s\S]*?)<\/section>/g)
    .filter(match => hasClass(match[1], className))
    .map(match => ({ attrs: match[1], html: match[2], anchor: htmlAttr(match[1], 'id') }));
}

function links(html) {
  return matches(html, /<a\b([^>]*)>([\s\S]*?)<\/a>/g)
    .map(match => ({ url: htmlAttr(match[1], 'href'), title: plain(match[2]) }))
    .filter(link => /^https?:\/\//.test(link.url));
}

// Preserve published inline text and link groupings without retaining old layout markup or
// manufacturing thread URLs/dates. This intentionally accepts only links and reference spans.
function publishedInline(html) {
  const meta = html.match(/<span class="reference-meta">([\s\S]*?)<\/span>/);
  if (meta) return [...publishedInline(html.slice(0, meta.index)),
    ...publishedInline(meta[1]).map(token => ({ ...token, meta: true })),
    ...publishedInline(html.slice(meta.index + meta[0].length))];
  const value = html.replace(/<\/?span\b[^>]*>/g, '');
  const decode = text => text.trim() ? `${text.match(/^\s*/)[0]}${decodeHtml(text)}${text.match(/\s*$/)[0]}` : text;
  const tokens = [];
  let end = 0;
  for (const match of value.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const text = value.slice(end, match.index);
    if (/<[^>]+>/.test(text) || /<[^>]+>/.test(match[2])) throw new Error('Unsupported published inline markup');
    if (text) tokens.push({ type: 'text', text: decode(text) });
    const url = htmlAttr(match[1], 'href');
    if (!/^https?:\/\//.test(url)) throw new Error('Unsupported published link protocol');
    tokens.push({ type: 'link', text: decode(match[2]), url });
    end = match.index + match[0].length;
  }
  const tail = value.slice(end);
  if (/<[^>]+>/.test(tail)) throw new Error('Unsupported published inline markup');
  if (tail) tokens.push({ type: 'text', text: decode(tail) });
  return tokens;
}

function publishedList(html) {
  return matches(html, /<li\b[^>]*>([\s\S]*?)<\/li>/g).map(match => publishedInline(match[1]));
}

function publishedSourceLists(html) {
  return {
    articles: sections(html, 'issue-story').map(story => publishedList(story.html.match(/<div class="source-list">([\s\S]*?)<\/div>/)?.[1] || '')),
    references: sections(html, 'issue-references').flatMap(section => publishedList(section.html))
  };
}

function articleSnapshot(article) {
  return {
    anchor: article.anchor,
    headline: tagText(article.html, 'h2', 'article-title'),
    prose: matches(article.html.replace(/<nav\b[\s\S]*?<\/nav>/g, ''), /<(p|h2|h3|li|pre|blockquote|td|th)\b[^>]*>([\s\S]*?)<\/\1>/g).map(match => publicText(match[2])),
    sources: links(article.html),
    images: matches(article.html, /<img\b([^>]*)>/g).map(match => ({ src: htmlAttr(match[1], 'src'), alt: htmlAttr(match[1], 'alt') })),
    captions: matches(article.html, /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g).map(match => plain(match[1]))
  };
}

function snapshot(html) {
  return {
    ids: matches(html, /\bid="([^"]+)"/g).map(match => decodeHtml(match[1])),
    articles: sections(html, 'issue-story').map(articleSnapshot),
    references: sections(html, 'issue-references').flatMap(section => links(section.html)),
    reading: sections(html, 'issue-reference-articles').map(section => plain(section.html)),
    canonical: matches(html, /<link\b[^>]*rel="canonical"[^>]*>/g).map(match => htmlAttr(match[0], 'href')),
    notices: matches(html, /<div class="publication-notice"[^>]*>([\s\S]*?)<\/div>/g).map(match => plain(match[1])),
    watch: sections(html, 'issue-watch-points').map(section => plain(section.html))
  };
}

function difference(before, after) {
  const a = new Set(before.map(value => JSON.stringify(value)));
  const b = new Set(after.map(value => JSON.stringify(value)));
  return { removed: [...a].filter(value => !b.has(value)).map(value => JSON.parse(value)),
    added: [...b].filter(value => !a.has(value)).map(value => JSON.parse(value)) };
}

function preservation(beforeHtml, afterHtml) {
  const before = snapshot(beforeHtml);
  const after = snapshot(afterHtml);
  const errors = [];
  const delta = {};
  for (const field of ['ids', 'references', 'reading', 'canonical', 'notices', 'watch']) {
    delta[field] = difference(before[field], after[field]);
    if (delta[field].removed.length) errors.push(`${field}: removed ${delta[field].removed.length}`);
  }
  if (before.articles.length !== after.articles.length) errors.push('article count changed');
  delta.articles = before.articles.map((article, index) => {
    const result = {};
    const next = after.articles[index] || {};
    if (article.headline !== next.headline) errors.push(`article ${index + 1}: headline/order changed`);
    for (const field of ['prose', 'sources', 'images', 'captions']) {
      result[field] = difference(article[field], next[field] || []);
      if (result[field].removed.length) errors.push(`article ${index + 1}: ${field} removed ${result[field].removed.length}`);
    }
    return result;
  });
  const ids = new Set(after.ids);
  if (ids.size !== after.ids.length) errors.push('duplicate anchor IDs');
  for (const match of matches(afterHtml, /href="#([^"]+)"/g)) {
    if (!ids.has(decodeHtml(match[1]))) errors.push(`unresolved anchor: ${match[1]}`);
  }
  return { ok: errors.length === 0, errors, delta };
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function preserveAnchors(beforeHtml, afterHtml) {
  const before = snapshot(beforeHtml);
  const after = snapshot(afterHtml);
  const ids = new Set(after.ids);
  const aliases = new Map();
  const previousAliases = new Map(matches(beforeHtml, /<span\b[^>]*data-legacy-target="[^"]*"[^>]*><\/span>/g)
    .map(match => [htmlAttr(match[0], 'id'), htmlAttr(match[0], 'data-legacy-target')]));
  for (const id of before.ids) {
    if (ids.has(id)) continue;
    const article = before.articles.findIndex(item => id === item.anchor || id === `${item.anchor}-title`);
    const target = previousAliases.get(id) || (article >= 0 ? after.articles[article]?.anchor :
      (ids.has('issue-briefing') ? 'issue-briefing' : after.articles[0]?.anchor));
    if (!target || !ids.has(target)) throw new Error(`Cannot preserve anchor ${id}`);
    if (!aliases.has(target)) aliases.set(target, []);
    aliases.get(target).push(id);
  }
  for (const [target, values] of aliases) {
    const marker = `id="${escapeAttr(target)}"`;
    const start = afterHtml.lastIndexOf('<', afterHtml.indexOf(marker));
    const spans = values.sort().map(id => `<span id="${escapeAttr(id)}" data-legacy-target="${escapeAttr(target)}" tabindex="-1"></span>`).join('');
    afterHtml = afterHtml.slice(0, start) + spans + afterHtml.slice(start);
  }
  return afterHtml;
}

function recoverMarkdownSupplements(archive, stories, markdown) {
  const headings = matches(markdown, /^## (\d+)\. (.+)\r?$/gm).filter(match => Number(match[1]) > 1);
  if (headings.length !== stories.length) throw new Error('Published Markdown article count mismatch');
  const catchUp = markdown.indexOf('## 지난 소식 (Catch-up)');
  headings.forEach((heading, index) => {
    const section = archive.issue.sections[index];
    const recovered = archive.articles[index];
    const title = heading[2].replace(/ \(\d+주 전 릴리스\)$/, '');
    if (title !== section.public_article.headline) throw new Error(`Published Markdown article identity mismatch: ${index + 1}`);
    recovered.markdownHeading = heading[0].trim();
    if (catchUp >= 0 && heading.index > catchUp) section.coverage_type = 'catch_up';
    const body = markdown.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? markdown.length).split('**출처**')[0];
    const perspective = body.match(/^(?:### (.+관점.*)|\*\*(.+관점.*)\*\*)\r?$/m);
    if (perspective) recovered.perspectiveHeading = perspective[1] || perspective[2];
    const present = new Set(articleSnapshot(stories[index]).prose);
    for (const chunk of body.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean)) {
      if (/^!\[[\s\S]*\]\([^\n]+\)$/.test(chunk) || /^_.*_$/.test(chunk) || /^<a id="[^"\n]+"><\/a>$/.test(chunk) ||
        /^\[(?:이번 주 핵심으로|이 호의 핵심으로|목차로 돌아가기|Back to[^\]]*)\]\(#[^)]+\)$/.test(chunk) || chunk === '---') continue;
      const text = publicText(chunk);
      if (present.has(text) || text === recovered.perspectiveHeading) continue;
      if (/```|~~~|^\||^>|<\/?\w|!\[|\]\(/m.test(chunk)) throw new Error(`Unsupported Markdown-only block: ${stories[index].anchor}`);
      let additions;
      if (/^(?:### |\*\*[^*]+\*\*$)/.test(chunk)) additions = [{ type: 'subheading', text }];
      else if (/^- /.test(chunk)) {
        const lines = chunk.split('\n');
        if (lines.some(line => !/^- .+/.test(line))) throw new Error('Unsupported Markdown-only list');
        additions = lines.map(line => ({ type: 'bullet', text: line.slice(2) }));
      } else additions = [{ type: 'paragraph', text: chunk.replace(/\s+/g, ' ') }];
      recovered.blocks.push(...additions.map(block => ({ ...block, origin: 'published-markdown' })));
    }
  });
}

function validatePublishedProjection(archive, date) {
  const inline = tokens => Array.isArray(tokens) && tokens.every(token => token && typeof token.text === 'string' &&
    (token.type === 'text' || (token.type === 'link' && /^https?:\/\//.test(token.url))));
  const list = items => Array.isArray(items) && items.every(inline);
  if (archive?.schemaVersion !== 1 || archive.format !== 'published-html-projection' || archive.daily !== true || archive.issue?.date !== date ||
    archive.issue.weekly_key || !Array.isArray(archive.articles) || !Array.isArray(archive.issue.sections) || archive.articles.length !== archive.issue.sections.length ||
    archive.articles.some((article, index) => !/^article-[a-zA-Z0-9_-]+$/.test(article.anchor) || !Array.isArray(article.blocks) ||
      article.blocks.some(block => !['paragraph', 'subheading', 'bullet'].includes(block.type) || typeof block.text !== 'string' ||
        (block.origin !== undefined && block.origin !== 'published-markdown')) ||
      (article.markdownHeading !== undefined && article.markdownHeading.replace(/^## \d+\. /, '').replace(/ \(\d+주 전 릴리스\)$/, '') !== archive.issue.sections[index].public_article?.headline)) ||
    (archive.noticeLines !== undefined && (!Array.isArray(archive.noticeLines) || archive.noticeLines.some(line => typeof line !== 'string'))) ||
    (archive.reading !== undefined && (!Array.isArray(archive.reading) || archive.reading.length > 1 || archive.reading.some(section =>
      typeof section.heading !== 'string' || typeof section.markdownHeading !== 'string' || typeof section.markdown !== 'string' || !list(section.items)))) ||
    (archive.sourceLists !== undefined && (!Array.isArray(archive.sourceLists.articles) || archive.sourceLists.articles.length !== archive.articles.length ||
      !archive.sourceLists.articles.every(list) || !list(archive.sourceLists.references)))) {
    throw new Error('Invalid published projection identity/version/content');
  }
  return archive;
}

function recoverDaily(html, markdown, { htmlPath, markdownPath, date }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid daily identity');
  const stories = sections(html, 'issue-story');
  if (!stories.length) throw new Error('No published articles');
  const archive = { schemaVersion: 1, format: 'published-html-projection', daily: true,
    provenance: [{ path: htmlPath, hash: hash(html) }, { path: markdownPath, hash: hash(markdown) }], articles: [] };
  const issue = { date, title: markdown.match(/^# (.+)$/m)?.[1], summary: tagText(html, 'p', 'subtitle'),
    tags: matches(html.match(/<div class="tag-row issue-tags">([\s\S]*?)<\/div>/)?.[1] || '', /<span[^>]*>(.*?)<\/span>/g).map(match => plain(match[1])),
    briefing: sections(html, 'issue-briefing').flatMap(section => matches(section.html, /<li[^>]*>([\s\S]*?)<\/li>/g).map(match => plain(match[1]))),
    sections: [], references: sections(html, 'issue-references').flatMap(section => links(section.html)), reference_articles: [] };
  if (!issue.title || !issue.summary) throw new Error('Missing published title/summary');
  if (html.includes('class="publication-notice"')) {
    const notice = html.match(/<div class="publication-notice"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
    const lines = matches(notice, /<p\b[^>]*>([\s\S]*?)<\/p>/g);
    if (!lines.length || lines.some(match => /<[^>]+>/.test(match[1]))) throw new Error('Unsupported publication notice');
    archive.noticeLines = lines.map(match => plain(match[1]));
    if (archive.noticeLines.includes('검토 발행본입니다.')) issue.review_publication_ready = true;
  }
  if (sections(html, 'issue-context-lens-label').length) issue.publish_mode = 'CONTEXT';
  for (const story of stories) {
    let body = story.html;
    if (/<(?:pre|code|table|blockquote|ul|ol)\b/.test(body.replace(/<div class="source-list">[\s\S]*?<\/div>/g, ''))) {
      throw new Error(`Unsupported rich article markup: ${story.anchor}; manual recovery required`);
    }
    const takeaway = body.match(/<div class="article-block camera-hal-takeaway">([\s\S]*?)<\/div>/)?.[1] || '';
    const source = body.match(/<div class="source-list">([\s\S]*?)<\/div>/)?.[1] || '';
    const media = matches(body, /<figure\b[^>]*>([\s\S]*?)<\/figure>/g);
    if (media.length > 1) throw new Error(`Multiple images require manual recovery: ${story.anchor}`);
    const imageTag = media[0]?.[1].match(/<img\b[^>]*>/)?.[0] || '';
    const caption = media[0]?.[1].match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] || '';
    const headline = tagText(body, 'h2', 'article-title');
    const lead = tagText(body, 'p', 'article-lead');
    const subtitle = tagText(body, 'p', 'article-source-subtitle');
    body = body.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g, '')
      .replace(/<div class="article-block camera-hal-takeaway">[\s\S]*?<\/div>/g, '')
      .replace(/<div class="source-list">[\s\S]*?<\/div>/g, '')
      .replace(/<nav\b[\s\S]*?<\/nav>/g, '');
    const blocks = matches(body, /<(p|h3)\b([^>]*)>([\s\S]*?)<\/\1>/g)
      .filter(match => !hasClass(match[2], 'article-lead') && !hasClass(match[2], 'article-source-subtitle'))
      .map(match => {
        if (/<[^>]+>/.test(match[3])) throw new Error(`Inline markup requires manual recovery: ${story.anchor}`);
        return { type: match[1] === 'h3' ? 'subheading' : 'paragraph', text: plain(match[3]) };
      });
    const sources = links(source);
    if (!headline || !lead || !sources.length || !blocks.length) throw new Error(`Incomplete published article: ${story.anchor}`);
    archive.articles.push({ anchor: story.anchor, subtitle, blocks });
    const image = htmlAttr(imageTag, 'src');
    const imageSource = links(caption)[0];
    const category = tagText(story.html, 'span', 'issue-story-category');
    const buckets = { 'AOSP Camera': 'direct_aosp_camera', 'Camera Driver · ISP': 'camera_driver_image_pipeline', 'Android Platform': 'android', 'C++ · AI Tooling': 'cpp_ai_tooling_fallback', 'Tooling Watch': 'generic_tech_watchlist', 'C++': 'cpp_ai_tooling_fallback', 'AI Tooling': 'cpp_ai_tooling_fallback' };
    issue.sections.push({ id: story.anchor, headline, sources, ...(buckets[category] ? { relevance_bucket: buckets[category] } : {}),
      ...(category === 'C++' ? { is_ai_related: false } : category === 'AI Tooling' ? { is_ai_related: true } : {}),
      ...(image ? { selectedImage: image, imageAlt: htmlAttr(imageTag, 'alt') } : {}),
      ...(imageSource ? { imageSource: imageSource.url, imageAttribution: imageSource.title } : {}),
      public_article: { headline, lead, camera_hal_takeaway: tagText(takeaway, 'p'),
        body_paragraphs: blocks.filter(block => block.type === 'paragraph').map(block => block.text), source_links: sources } });
  }
  const readingMarkdown = [...markdown.matchAll(/^## (.*더 읽을거리.*)\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)];
  archive.reading = sections(html, 'issue-reference-articles').map((section, index) => {
    const md = readingMarkdown[index];
    if (!md) throw new Error('Missing published reference Markdown');
    return { heading: tagText(section.html, 'h2'), items: publishedList(section.html), markdownHeading: md[1], markdown: md[2].trim() };
  });
  archive.sourceLists = publishedSourceLists(html);
  recoverMarkdownSupplements({ ...archive, issue }, stories, markdown);
  return validatePublishedProjection({ ...archive, issue }, date);
}

function legacyWeeklyView(issue) {
  if (!issue.sections?.some(section => section.public_article?.body_paragraphs?.some(text => /^(?:### |\*\*|[-] )/m.test(text)))) return null;
  return { articles: issue.sections.map(section => ({
    blocks: (section.public_article?.body_paragraphs || []).flatMap(text => {
      if (/```|^\||^>|<\/?\w/m.test(text)) throw new Error('Unsupported legacy body markup; manual recovery required');
      return text.split(/\n\s*\n/).flatMap(part => part.split(/\n(?=- |### )/)).map(part => {
        if (/^### /.test(part)) return { type: 'subheading', text: part.slice(4) };
        if (/^\*\*[^*]+\*\*$/.test(part)) return { type: 'subheading', text: part.slice(2, -2) };
        if (/^- /.test(part)) return { type: 'bullet', text: part.slice(2) };
        if (/[*`\[\]]/.test(part)) throw new Error('Unsupported legacy inline markup; manual recovery required');
        return { type: 'paragraph', text: part };
      });
    })
  })) };
}

module.exports = { hash, plain, sections, snapshot, difference, preservation, preserveAnchors, recoverDaily, legacyWeeklyView, publishedSourceLists, validatePublishedProjection };
