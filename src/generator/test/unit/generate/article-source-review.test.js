const test = require('node:test');
const assert = require('node:assert/strict');
const { sourceReviewInput, reviewArticleSources } = require('../../../quality/article-source-review');

const editor = { sections: [{ sources: [{ url: 'https://example.com/a' }],
  public_article: { headline: 'Change', body_markdown: 'Generic advice' }, claims: ['internal claims'] }] };
const capsules = { selected_capsules: [{ url: 'https://example.com/a', what_changed: 'Repeated summary',
  article_source_reading: { documents: [{ evidence_id: 'body:1', url: 'https://example.com/a', text: 'Actual conditions' }] } }] };
const verdict = (publishable = true, omissions = []) => ({ section_index: 0, publishable, reason: 'Reviewed',
  source_review: { core_change: 'Actual conditions', article_explanation: 'Generic advice',
    material_omissions: omissions, unaddressed_source_conflicts: [] } });

test('source review isolates public prose from candidate summaries and internal claims', () => {
  const input = sourceReviewInput(editor, capsules);
  assert.equal(input.length, 1);
  assert.doesNotMatch(JSON.stringify(input), /Repeated summary|internal claims/);
  assert.match(JSON.stringify(input), /Actual conditions/);
});

test('source review findings can block but never override an earlier rejection', async () => {
  const fact = { article_quality: [verdict()] };
  const blocked = await reviewArticleSources(editor, capsules, fact, async () => ({ article_quality: [verdict(true, ['Condition missing'])] }));
  assert.equal(blocked.article_quality[0].publishable, false);
  const retained = await reviewArticleSources(editor, capsules, { article_quality: [verdict(false)] }, async () => ({ article_quality: [verdict()] }));
  assert.equal(retained.article_quality[0].publishable, false);
});

test('missing or duplicate source-review verdicts fail closed', async () => {
  for (const rows of [[], [verdict(), verdict()], [{ ...verdict(), source_review: {} }]]) {
    await assert.rejects(reviewArticleSources(editor, capsules, {}, async () => ({ article_quality: rows })), /Incomplete/);
  }
});

test('absent source documents preserve existing checks without claiming independent review', async () => {
  const fact = { article_quality: [verdict(false)] };
  assert.equal(await reviewArticleSources(editor, {}, fact, async () => { throw Error('not expected'); }), fact);
});
