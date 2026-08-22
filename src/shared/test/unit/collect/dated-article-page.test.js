'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalPageUrl, resolveDatedArticlePage } = require('../../../collect/dated-article-page-parsing');
const { dateSourceConfidence, isKnownDateSource } = require('../../../common/date-signals');
const { readTextFixture } = require('../../helpers/fixture-loader');

test('reads canonical url and structured date from a Claude Blog post', () => {
  const page = resolveDatedArticlePage(readTextFixture('source-html/claude-blog-ai-ci-cd-on-call.html'));
  assert.equal(page.canonical_url, 'https://claude.com/blog/ai-ci-cd-on-call');
  assert.equal(page.published_date, '2026-08-18');
  assert.equal(page.date_source, 'structured_date_published');
  assert.equal(dateSourceConfidence(page.date_source), 95);
});

test('reads canonical url and visible date from an Anthropic News post that has no JSON-LD', () => {
  const page = resolveDatedArticlePage(readTextFixture('source-html/anthropic-news-claude-opus-5.html'));
  assert.equal(page.canonical_url, 'https://www.anthropic.com/news/claude-opus-5');
  assert.equal(page.json_ld_date_published, '');
  assert.equal(page.published_date, '2026-07-24');
  assert.equal(page.date_source, 'visible_date');
  assert.equal(dateSourceConfidence(page.date_source), 100);
});

test('only emits date_source values the repository knows', () => {
  for (const fixture of ['source-html/claude-blog-ai-ci-cd-on-call.html', 'source-html/anthropic-news-claude-opus-5.html']) {
    const page = resolveDatedArticlePage(readTextFixture(fixture));
    assert.ok(isKnownDateSource(page.date_source), `unknown date_source: ${page.date_source}`);
  }
});

test('empties the date when the header and the structured data disagree', () => {
  const html = '<link rel="canonical" href="https://claude.com/blog/x"/>'
    + '<script type="application/ld+json">{"@type":"BlogPosting","datePublished":"Aug 18, 2026"}</script>'
    + '<h1>X</h1><div>August 11, 2026</div><h2>Body</h2>';
  const page = resolveDatedArticlePage(html);
  assert.equal(page.date_conflict, true);
  assert.equal(page.published_date, '');
  assert.equal(page.date_source, 'missing');
});

test('ignores a decoy data-href when reading the canonical url', () => {
  assert.equal(
    canonicalPageUrl('<link data-href="https://tracker.example/x" rel="canonical" href="https://claude.com/blog/real"/>'),
    'https://claude.com/blog/real'
  );
});

test('empties the structured date when two article nodes disagree', () => {
  const html = '<script type="application/ld+json">{"@type":"BlogPosting","datePublished":"Aug 13, 2026"}</script>'
    + '<script type="application/ld+json">{"@type":"BlogPosting","datePublished":"Aug 18, 2026"}</script>';
  assert.equal(resolveDatedArticlePage(html).json_ld_date_published, '');
});
