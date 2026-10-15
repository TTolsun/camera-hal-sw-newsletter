'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { articleCategoryLabel } = require('./article-display');
const { applyTranslation } = require('./apply-translation');
const { hash, plain, sections, preservation } = require('./archive-publication');
const { htmlAttr } = require('../../shared/common/common');
const { STRONG_CAMERA_DRIVER_PATTERNS } = require('../../shared/domain/aosp-camera-scope');
const ko = require('./locale/ko');
const en = require('./locale/en');

const LEGACY_CLASSES = Object.freeze({
  'tooling-watch': 'generic_tech_watchlist',
  tooling: 'cpp_ai_tooling_fallback',
  tooling_workflow: 'cpp_ai_tooling_fallback',
  'ai-camera-path-hal-workflow': 'cpp_ai_tooling_fallback',
  'Android Camera / Platform API': 'android',
  driver: 'camera_driver_image_pipeline'
});

// Daily pages without JSON are read only through their own published heading/category/class.
// Ambiguous old labels such as "main" or "camera-hal" do not become precise AOSP classifications.
function publishedTagInput(story) {
  const headline = plain(story.html.match(/<h2\b[^>]*class="[^"]*\barticle-title\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/)?.[1] || '');
  const category = plain(story.html.match(/<span class="issue-story-category">([\s\S]*?)<\/span>/)?.[1] || '');
  let bucket = '';
  for (const labels of [ko.categories, en.categories]) {
    const entry = Object.entries(labels).find(([, value]) => value === category);
    if (entry) { bucket = entry[0]; break; }
  }
  if (category === 'C++' || category === 'AI Tooling') bucket = 'cpp_ai_tooling_fallback';
  const classes = `${htmlAttr(story.attrs, 'class')} ${htmlAttr(story.html.match(/<article\b[^>]*>/)?.[0] || '', 'class')}`;
  if (!bucket) {
    const declared = Object.keys(ko.categories).find(value => classes.split(/\s+/).includes(value));
    bucket = declared || Object.entries(LEGACY_CLASSES).find(([value]) => classes.includes(value))?.[1] || '';
  }
  // A missing old tag can use an explicitly named public subject. These transient display hints
  // never enter issue.json, selection, composition, or source-binding decisions.
  if (!bucket && STRONG_CAMERA_DRIVER_PATTERNS.some(pattern => pattern.test(headline))) bucket = 'camera_driver_image_pipeline';
  if (!bucket && /\b(?:CameraX|Camera2|CameraPipe|CameraService|cameraserver)\b|\bCamera ITS\b/.test(headline)) bucket = 'direct_aosp_camera';
  return { headline, relevance_bucket: bucket,
    ...(category === 'C++' ? { is_ai_related: false } : category === 'AI Tooling' ? { is_ai_related: true } : {}) };
}

function tagMarkup(label) {
  return `<span class="issue-story-category">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
}

function patchArticleTags(html, sourceSections, locale) {
  const stories = sections(html, 'issue-story');
  if (!stories.length) throw new Error('No public articles for tag cleanup');
  if (sourceSections && sourceSections.length !== stories.length) throw new Error('Tag source article count mismatch');
  const changes = [];
  let output = html;
  stories.forEach((story, index) => {
    const published = publishedTagInput(story);
    const source = sourceSections?.[index];
    if (source && plain(source.public_article?.headline || source.headline) !== published.headline) {
      throw new Error(`Tag source article identity mismatch: ${story.anchor}`);
    }
    const label = articleCategoryLabel(source ? { ...source, headline: source.public_article?.headline || source.headline } : published, { locale });
    const oldTag = story.html.match(/<span class="issue-story-category">([\s\S]*?)<\/span>/);
    const before = oldTag ? plain(oldTag[1]) : '';
    let updated = story.html;
    if (oldTag) updated = updated.replace(oldTag[0], tagMarkup(label));
    else {
      const number = updated.match(/<span class="issue-story-number"[^>]*>[\s\S]*?<\/span>/);
      if (!number) throw new Error(`Missing article number: ${story.anchor}`);
      updated = updated.replace(number[0], `<div class="issue-story-eyebrow">${number[0]}${tagMarkup(label)}</div>`);
    }
    if (before !== label) changes.push({ anchor: story.anchor, headline: published.headline, before, after: label,
      basis: source ? 'same-issue-json' : 'own-published-heading-category-class', preciseCategoryKnown: label !== 'Camera' });
    output = output.replace(story.html, updated);
  });
  return { html: output, changes };
}

function planArticleTags(root, page) {
  const oldHtml = fs.readFileSync(path.join(root, page.file), 'utf8');
  const inputs = [{ path: page.file, hash: hash(oldHtml) }];
  const sourcePath = `articles/newsletters/${page.key}/issue.json`;
  let source;
  if (fs.existsSync(path.join(root, sourcePath))) {
    const sourceText = fs.readFileSync(path.join(root, sourcePath), 'utf8');
    inputs.push({ path: sourcePath, hash: hash(sourceText) });
    source = JSON.parse(sourceText);
    if (page.locale === 'en') {
      const overlayPath = `articles/newsletters/${page.key}/translation.en.json`;
      const overlayText = fs.readFileSync(path.join(root, overlayPath), 'utf8');
      inputs.push({ path: overlayPath, hash: hash(overlayText) });
      source = applyTranslation(source, JSON.parse(overlayText), { sourceText });
    }
  } else {
    const projectionPath = `articles/newsletters/${page.key}/publication-source.json`;
    if (fs.existsSync(path.join(root, projectionPath))) {
      const text = fs.readFileSync(path.join(root, projectionPath), 'utf8');
      inputs.push({ path: projectionPath, hash: hash(text) });
      source = JSON.parse(text).issue;
    }
  }
  const result = patchArticleTags(oldHtml, source?.sections, page.locale);
  const check = preservation(oldHtml, result.html);
  return { key: page.key, locale: page.locale, classification: 'article-tags-only', status: check.ok ? 'ready' : 'blocked',
    errors: check.errors, inputs, preservation: check.delta, contentEdits: [], tagChanges: result.changes,
    outputs: [{ path: page.file, before: oldHtml, after: result.html }] };
}

module.exports = { publishedTagInput, patchArticleTags, planArticleTags };
