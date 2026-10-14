const test = require('node:test');
const assert = require('node:assert/strict');
const { sourceReviewInput, reviewArticleSources, BRIEFING_CHECKS } = require('../../../quality/article-source-review');

const editor = { sections: [{ sources: [{ url: 'https://example.com/a' }],
  public_article: { headline: 'Change', body_markdown: 'Generic advice' }, claims: ['internal claims'] }] };
const capsules = { selected_capsules: [{ url: 'https://example.com/a', what_changed: 'Repeated summary',
  article_source_reading: { documents: [{ evidence_id: 'body:1', url: 'https://example.com/a', text: 'Actual conditions' }] } }] };
const verdict = (publishable = true, omissions = []) => ({ section_index: 0, publishable, reason: 'Reviewed',
  briefing_checks: Object.fromEntries(BRIEFING_CHECKS.map(key => [key,
    { applicable: true, satisfied: true, evidence: 'Generic advice', reason: 'Synthetic review decision' }])),
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

test('public briefing omissions block a previously approved article and retain actionable feedback', async () => {
  const omissions = ['Public body omits the early-close condition and the next-session observation',
    'Public body omits the release and product inclusion uncertainty'];
  const result = await reviewArticleSources(editor, capsules, { article_quality: [verdict()] }, async (system) => {
    assert.match(system, /적용 범위는 조건의 교집합/);
    assert.match(system, /점검 방법이 내부 필드에만/);
    assert.match(system, /설계 제안·연구·개발 도구 소개에는 버그 재현 절차를 강요하지/);
    return { article_quality: [verdict(true, omissions)] };
  });
  assert.equal(result.article_quality[0].publishable, false);
  for (const omission of omissions) assert.ok(result.article_quality[0].reason.includes(omission));
  assert.deepEqual(result.article_quality[0].source_review.material_omissions, omissions);
});

test('missing or duplicate source-review verdicts fail closed', async () => {
  for (const rows of [[], [verdict(), verdict()], [{ ...verdict(), source_review: {} }]]) {
    await assert.rejects(reviewArticleSources(editor, capsules, {}, async () => ({ article_quality: rows })), /Incomplete/);
  }
});

test('dimension failures and invented public evidence cannot be hidden by an overall PASS', async () => {
  for (const check of [
    { applicable: true, satisfied: false, evidence: '', reason: 'Missing public verification conditions' },
    { applicable: true, satisfied: true, evidence: 'Internal-only test plan', reason: 'Evidence is not in public prose' },
    { applicable: false, satisfied: false, evidence: '', reason: '' }
  ]) {
    const review = verdict();
    review.briefing_checks.public_verification = check;
    const result = await reviewArticleSources(editor, capsules, { article_quality: [verdict()] }, async () => ({ article_quality: [review] }));
    assert.equal(result.article_quality[0].publishable, false);
    assert.match(result.article_quality[0].reason, /public_verification/);
    assert.deepEqual(result.article_quality[0].source_review.briefing_checks.public_verification, check);
  }
});

test('missing dimension review blocks the article for retry while justified nonapplicability remains valid', async () => {
  const missing = verdict();
  delete missing.briefing_checks;
  const blocked = await reviewArticleSources(editor, capsules, { article_quality: [verdict()] }, async () => ({ article_quality: [missing] }));
  assert.equal(blocked.article_quality[0].publishable, false);
  assert.match(blocked.article_quality[0].reason, /Incomplete article briefing review/);
  const design = verdict();
  design.briefing_checks.public_verification = { applicable: false, satisfied: false, evidence: '', reason: 'Design discussion, not a bug fix' };
  const result = await reviewArticleSources(editor, capsules, { article_quality: [verdict()] }, async () => ({ article_quality: [design] }));
  assert.equal(result.article_quality[0].publishable, true);
  const supported = verdict();
  supported.briefing_checks.public_verification.reason = '';
  const supportedResult = await reviewArticleSources(editor, capsules, { article_quality: [verdict()] }, async () => ({ article_quality: [supported] }));
  assert.equal(supportedResult.article_quality[0].publishable, true);
});

test('absent source documents preserve existing checks without claiming independent review', async () => {
  const fact = { article_quality: [verdict(false)] };
  assert.equal(await reviewArticleSources(editor, {}, fact, async () => { throw Error('not expected'); }), fact);
});

test('review references bind separate public passages without copying or joining prose', async () => {
  const issue = structuredClone(editor);
  issue.sections[0].public_article.body_markdown = 'The old query advertised unsupported profiles.\n\n### Changed query\n\nThe query now returns only SDR; capture success is not established.';
  const input = sourceReviewInput(issue, capsules)[0];
  const ids = input.public_passages.filter(p => p.id.includes('body_markdown') && !p.text.startsWith('###')).map(p => p.id);
  const review = verdict();
  review.briefing_checks.scope_and_behavior = { applicable: true, satisfied: true, evidence_passage_ids: ids, reason: 'Compared before and after.' };
  for (const key of BRIEFING_CHECKS.filter(key => key !== 'scope_and_behavior')) {
    review.briefing_checks[key] = { applicable: false, satisfied: false, evidence_passage_ids: [], reason: 'Synthetic isolated criterion test.' };
  }
  const result = await reviewArticleSources(issue, capsules, { article_quality: [verdict()] }, async () => ({ article_quality: [review] }));
  assert.equal(result.article_quality[0].publishable, true);
  assert.deepEqual(result.article_quality[0].source_review.briefing_checks.scope_and_behavior.verified_passages,
    input.public_passages.filter(p => ids.includes(p.id)));
});

test('unknown, foreign, empty or unsatisfied passage references never pass', async () => {
  for (const [ids, satisfied] of [[['0:body_markdown:99'], true], [['1:body_markdown:0'], true], [[], true], [['0:body_markdown:0'], false]]) {
    const review = verdict();
    review.briefing_checks.effect_boundaries = { applicable: true, satisfied, evidence_passage_ids: ids, reason: 'Query fallback does not guarantee capture success.' };
    const result = await reviewArticleSources(editor, capsules, { article_quality: [verdict()] }, async () => ({ article_quality: [review] }));
    assert.equal(result.article_quality[0].publishable, false);
  }
});

test('each review request contains only its own article and rejects swapped verdict indices', async () => {
  const issue = { sections: [editor.sections[0], { ...editor.sections[0], sources: [{ url: 'https://example.com/b' }] }] };
  const pack = { selected_capsules: [...capsules.selected_capsules,
    { url: 'https://example.com/b', article_source_reading: { documents: [{ evidence_id: 'body:2', text: 'Other source' }] } }] };
  let count = 0;
  const result = await reviewArticleSources(issue, pack, { article_quality: [verdict(), { ...verdict(), section_index: 1 }] }, async (system, prompt) => {
    const rows = JSON.parse(prompt.split('\n각 기사에')[0]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].section_index, count);
    assert.equal(rows[0].source_documents.length, 1);
    return { article_quality: [{ ...verdict(), section_index: count++ }] };
  });
  assert.equal(count, 2);
  assert.ok(result.article_quality.every(v => v.publishable));
  await assert.rejects(reviewArticleSources(issue, pack, {}, async () => ({ article_quality: [{ ...verdict(), section_index: 1 }] })), /Incomplete/);
});

test('malformed passage references and missing behavioral comparisons fail closed', async () => {
  for (const check of [
    { applicable: true, satisfied: true, evidence_passage_ids: '0:body_markdown:0', evidence: 'Generic advice', reason: 'Invalid reference type' },
    { applicable: true, satisfied: true, evidence_passage_ids: ['0:body_markdown:0'], reason: 'No behavior comparison' }
  ]) {
    const review = verdict();
    review.briefing_checks.effect_boundaries = check;
    const result = await reviewArticleSources(editor, capsules, { article_quality: [verdict()] }, async () => ({ article_quality: [review] }));
    assert.equal(result.article_quality[0].publishable, false);
    assert.match(result.article_quality[0].reason, /Incomplete article briefing review/);
  }
});
