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
  // 위 두 단언은 파싱이 통째로 죽어도 0 === 0으로 통과한다(양쪽 다 0이 되므로).
  // 실제로 카드를 읽었다는 양성 대조로 구체적인 0 아닌 개수를 못 박는다(픽스처는 4장).
  assert.equal(diagnostics.resolved_card_count, 4, '픽스처에 실린 카드 수와 맞아야 한다');
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

// pathPrefix는 이제 registry(news-sources.json)의 sourceUrl에서 파생된 값이라 정규식 메타문자가
// 섞일 수 있다. 이스케이프 없이 정규식에 보간하면 '.'이 와일드카드로 돌아 남의 경로 앵커를 이
// 소스의 카드로 조용히 오인식하고, 괄호는 캡처 그룹으로 읽혀 진짜 경로가 안 잡힌다.
test('treats regex metacharacters in pathPrefix as literal path text', () => {
  const decoy = '<div role="listitem"><div>Aug 18, 2026</div><a href="/blogXnew/post-one">Decoy</a></div>';
  assert.deepEqual(parseDatedArticleCards(decoy, { pathPrefix: '/blog.new' }), [],
    "'.'이 와일드카드로 도는 순간 남의 경로 앵커가 이 소스 카드로 둔갑한다");
  assert.equal(datedArticleCardDiagnostics(decoy, { pathPrefix: '/blog.new' }).anchor_count, 0);

  const dotted = '<div role="listitem"><div>Aug 18, 2026</div><a href="/blog.new/post-one">Real</a></div>';
  assert.deepEqual(
    parseDatedArticleCards(dotted, { pathPrefix: '/blog.new' }).map(card => card.slug),
    ['post-one'],
    '이스케이프가 진짜 경로 매칭까지 죽이면 안 된다'
  );

  const grouped = '<div role="listitem"><div>Aug 18, 2026</div><a href="/v1(beta)/news/post-two">Real</a></div>';
  assert.deepEqual(
    parseDatedArticleCards(grouped, { pathPrefix: '/v1(beta)/news' }).map(card => card.slug),
    ['post-two'],
    '괄호가 캡처 그룹으로 읽히면 이 앵커는 한 건도 안 잡힌다'
  );
});

test('an index whose link markup changed reports collection failure, not an empty week', () => {
  const changed = '<div role="listitem"><div>Aug 18, 2026</div><a href="https://claude.com/blog/x">X</a></div>';
  assert.deepEqual(datedArticleCardDiagnostics(changed, { pathPrefix: '/blog' }).unresolved_slugs, []);
  assert.match(datedArticleCardCollectionFailure(changed, { pathPrefix: '/blog' }), /collection failure/);
  const healthy = readTextFixture('source-html/claude-blog-index-cards.html');
  assert.equal(datedArticleCardCollectionFailure(healthy, { pathPrefix: '/blog' }), '');
});
