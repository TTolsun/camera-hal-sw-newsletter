'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { articleCategoryLabel, weeklyTopicTags } = require('../../../render/article-display');
const { patchArticleTags, publishedTagInput } = require('../../../render/archive-article-tags');
const { preservation } = require('../../../render/archive-publication');

function story(label = '', headline = 'C++26 compiler proposal') {
  return `<section class="section issue-story" id="article-original"><span class="issue-story-number" aria-label="Article 1">1</span>${label ? `<span class="issue-story-category">${label}</span>` : ''}<article class="card article-card tooling-watch"><h2 class="article-title">${headline}</h2><p>The proposal is not merged.</p><p>Only board A was tested.</p><div class="source-list"><strong>Sources</strong><ul><li><a href="https://example.com/source">Original source</a></li></ul></div></article></section>`;
}

test('article topic labels separate C++ and AI without changing source buckets or archive filter tags', () => {
  const sections = [{ headline: 'C++26 assert', relevance_bucket: 'cpp_ai_tooling_fallback' },
    { headline: 'Coding assistant', relevance_bucket: 'cpp_ai_tooling_fallback', is_ai_related: true },
    { headline: 'GCC 16 review', relevance_bucket: 'generic_tech_watchlist' }];
  const before = structuredClone(sections);
  const filters = weeklyTopicTags(sections);
  for (const locale of ['ko', 'en']) {
    assert.deepEqual(sections.map(section => articleCategoryLabel(section, { locale })), ['C++', 'AI Tooling', 'C++']);
  }
  assert.deepEqual(sections, before);
  assert.deepEqual(weeklyTopicTags(sections), filters);
});

test('tag cleanup patches only the category and adds a shared eyebrow when missing', () => {
  for (const before of [story('Tooling Watch'), story()]) {
    const result = patchArticleTags(before, null, 'ko');
    assert.match(result.html, /class="issue-story-category">C\+\+</);
    assert.equal(preservation(before, result.html).ok, true);
    assert.equal(result.changes.length, 1);
    assert.equal(patchArticleTags(result.html, null, 'ko').html, result.html);
  }
});

test('unknown historical classes do not invent an AOSP category, while explicit public subjects can be labeled', () => {
  const unknown = { attrs: '', html: '<article class="article-card camera-hal main"><h2 class="article-title">Unclassified report</h2></article>' };
  assert.equal(publishedTagInput(unknown).relevance_bucket, '');
  const camera = { attrs: '', html: '<h2 class="article-title">CameraX 1.6 compatibility update</h2>' };
  assert.equal(publishedTagInput(camera).relevance_bucket, 'direct_aosp_camera');
  const driver = { attrs: '', html: '<h2 class="article-title">libcamera v0.7 release</h2>' };
  assert.equal(publishedTagInput(driver).relevance_bucket, 'camera_driver_image_pipeline');
});

test('same-issue source identity and article count are required before structured tag projection', () => {
  const before = story();
  assert.throws(() => patchArticleTags(before, [], 'ko'), /count mismatch/);
  assert.throws(() => patchArticleTags(before, [{ headline: 'Different article' }], 'ko'), /identity mismatch/);
});

test('source-backed tag cleanup preserves all article bytes outside the existing category span', () => {
  const before = story('Tooling Watch');
  const result = patchArticleTags(before, [{ headline: 'C++26 compiler proposal', relevance_bucket: 'cpp_ai_tooling_fallback', is_ai_related: false }], 'en');
  assert.equal(result.html.replace('>C++</span>', '>Tooling Watch</span>'), before);
  assert.deepEqual(result.changes[0].basis, 'same-issue-json');
});
