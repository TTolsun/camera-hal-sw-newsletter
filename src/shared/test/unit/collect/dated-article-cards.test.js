'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  datedArticleCardCollectionFailure,
  datedArticleCardDiagnostics,
  parseDatedArticleCards
} = require('../../../collect/dated-article-card-parsing');
const { readTextFixture } = require('../../helpers/fixture-loader');

test('resolves every Claude Blog list card to a slug and a date', () => {
  const html = readTextFixture('source-html/claude-blog-index-cards.html');
  const diagnostics = datedArticleCardDiagnostics(html, { pathPrefix: '/blog' });
  assert.equal(diagnostics.unresolved_slugs.length, 0);
  assert.equal(diagnostics.resolved_card_count, diagnostics.anchor_slug_count);
});

test('resolves every Anthropic News list card to a slug and a date', () => {
  const html = readTextFixture('source-html/anthropic-news-index-cards.html');
  const diagnostics = datedArticleCardDiagnostics(html, { pathPrefix: '/news' });
  assert.equal(diagnostics.unresolved_slugs.length, 0);
  assert.equal(diagnostics.resolved_card_count, diagnostics.anchor_slug_count);
});

test('drops cards that cannot be read unambiguously', () => {
  const html = readTextFixture('source-html/claude-blog-broken-cards.html');
  const cards = parseDatedArticleCards(html, { pathPrefix: '/blog' });
  const bySlug = Object.fromEntries(cards.map(card => [card.slug, card.publishedAt]));
  assert.deepEqual(Object.keys(bySlug), ['comment-decoy']);
  assert.equal(bySlug['comment-decoy'], '2026-08-12', '주석 안의 옛 카드가 이기면 안 된다');
});

test('drops a slug whose copies disagree about the date', () => {
  const html = '<div role="listitem"><div>Aug 18, 2026</div><a href="/blog/x">X</a></div>'
    + '<div role="listitem"><div>Aug 11, 2026</div><a href="/blog/x">X</a></div>';
  assert.deepEqual(parseDatedArticleCards(html, { pathPrefix: '/blog' }), []);
  assert.deepEqual(datedArticleCardDiagnostics(html, { pathPrefix: '/blog' }).conflicted_slugs, ['x']);
});

test('rejects a day that is not on the calendar', () => {
  const html = '<div role="listitem"><div>Aug 41, 2026</div><a href="/blog/x">X</a></div>';
  assert.deepEqual(parseDatedArticleCards(html, { pathPrefix: '/blog' }), []);
});

test('returns cards newest first, not in document order', () => {
  const html = '<div role="listitem"><div>Apr 2, 2026</div><a href="/blog/old">Old</a></div>'
    + '<div role="listitem"><div>Aug 21, 2026</div><a href="/blog/new">New</a></div>';
  assert.deepEqual(
    parseDatedArticleCards(html, { pathPrefix: '/blog' }).map(card => card.slug),
    ['new', 'old']
  );
});

test('an index whose link markup changed reports collection failure, not an empty week', () => {
  const changed = '<div role="listitem"><div>Aug 18, 2026</div><a href="https://claude.com/blog/x">X</a></div>';
  assert.deepEqual(datedArticleCardDiagnostics(changed, { pathPrefix: '/blog' }).unresolved_slugs, []);
  assert.match(datedArticleCardCollectionFailure(changed, { pathPrefix: '/blog' }), /collection failure/);
  const healthy = readTextFixture('source-html/claude-blog-index-cards.html');
  assert.equal(datedArticleCardCollectionFailure(healthy, { pathPrefix: '/blog' }), '');
});
