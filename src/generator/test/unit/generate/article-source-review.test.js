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

test('internal QA cannot supply a missing public test condition or source limitation', () => {
  const section = structuredClone(editor.sections[0]);
  section.public_article = {
    headline: 'Image test changes', lead: 'A new image test is available.',
    body_markdown: 'The test name is test_display_sample.', camera_hal_takeaway: 'Check the image test.',
    reader_checkpoints: ['ICC profile and 1 percent gamut threshold'],
    editorial_story: { not_to_overclaim: 'Deployment was not checked', editor_take: 'Internal judgment' },
    decision_metadata: { action: ['Watch'] },
    source_links: [{ title: 'Sample image test', url: 'https://example.com/a' }]
  };
  const before = structuredClone(section);
  const input = sourceReviewInput({ sections: [section] }, capsules);
  assert.deepEqual(Object.keys(input[0].public_article).sort(),
    ['headline', 'lead', 'body_markdown', 'camera_hal_takeaway', 'source_links'].sort());
  assert.doesNotMatch(JSON.stringify(input), /ICC profile|Deployment was not checked|Internal judgment|decision_metadata/);
  assert.deepEqual(section, before);
});

test('legacy public paragraphs remain reviewable without leaking their QA', () => {
  const input = sourceReviewInput({ sections: [{ ...editor.sections[0], public_article: {
    headline: 'Legacy story', body_paragraphs: ['First public fact.', 'Second public condition.'],
    reader_checkpoints: ['Internal checklist']
  } }] }, capsules);
  assert.deepEqual(input[0].public_article.body_paragraphs, ['First public fact.', 'Second public condition.']);
  assert.doesNotMatch(JSON.stringify(input), /Internal checklist/);
});

test('unsupported public state or effect verdicts block even when omission arrays are empty', async () => {
  for (const reason of ['Review mail does not establish current merge status',
    'Vendor benchmark does not establish the proposed C++ workflow effect']) {
    const rejected = { ...verdict(false), reason };
    const result = await reviewArticleSources(editor, capsules, { article_quality: [verdict()] },
      async (system, prompt) => {
        assert.match(system, /최소 대조 예시 1/);
        assert.match(system, /최소 대조 예시 2/);
        assert.match(system, /source에 없는 항목을 material_omissions로 만들지/);
        assert.doesNotMatch(prompt, /internal claims/);
        return { article_quality: [rejected] };
      });
    assert.equal(result.article_quality[0].publishable, false);
    assert.match(result.article_quality[0].reason, new RegExp(reason.replace(/\+/g, '\\+')));
  }
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
