const test = require('node:test');
const assert = require('node:assert/strict');
const { editorialRetryFeedback } = require('../../../publish/orchestrator-editor-stage');
const { reviewReporterCapsules, selectedReporterCapsules } = require('../../../publish/orchestrator-reporter-normalize');

test('whole-draft review retains source evidence for a locked article outside the retry writing selection', () => {
  const source = { url: 'https://example.com/locked', title: 'Locked source', final_selected: false,
    article_source_reading: { status: 'read', documents: [{ url: 'https://example.com/locked',
      evidence_id: 'source-body:locked', text: 'Original source evidence', truncated: false }] } };
  const retry = { url: 'https://example.com/retry', title: 'Retry source', final_selected: true };
  const unused = { url: 'https://example.com/unused', title: 'Unused', final_selected: false };
  const reporter = { candidates: [source, retry, unused] };
  const editor = { sections: [{ sources: [{ url: source.url }] }, { sources: [{ url: retry.url }] },
    { sources: [{ url: 'https://example.com/invented' }] }] };
  const writing = selectedReporterCapsules('2026-05-08', reporter);
  const reviewing = reviewReporterCapsules('2026-05-08', reporter, null, editor);
  assert.equal(writing.candidates.length, 1);
  assert.equal(reviewing.candidates.length, 2);
  assert.match(JSON.stringify(reviewing), /source-body:locked/);
  assert.doesNotMatch(JSON.stringify(reviewing), /example.com\/(?:unused|invented)/);
  assert.equal(source.final_selected, false);
});

test('a full editor retry receives rejected public prose and source-bound omissions', () => {
  const editor = { sections: [
    { headline: 'Accepted', source_candidate_url: 'https://example.com/a' },
    { headline: 'Callback fix', source_candidate_url: 'https://example.com/b', public_article: { body_markdown: 'Missing checks.' } }
  ] };
  const review = { material_omissions: ['Describe early close and the next-session observation'] };
  const feedback = editorialRetryFeedback(editor, { article_quality: [
    { section_index: 0, publishable: true },
    { section_index: 1, publishable: false, reason: 'Checks missing', source_review: review },
    { section_index: 9, publishable: false }
  ] });
  assert.equal(feedback.length, 1);
  assert.equal(feedback[0].source_candidate_url, 'https://example.com/b');
  assert.equal(feedback[0].previous_public_article.body_markdown, 'Missing checks.');
  assert.deepEqual(feedback[0].source_review, review);
  assert.equal(Object.hasOwn(feedback[0], 'section_index'), false);
  assert.deepEqual(editorialRetryFeedback(null, null), []);
});
