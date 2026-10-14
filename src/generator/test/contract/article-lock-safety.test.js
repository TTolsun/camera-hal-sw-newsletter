const assert = require('node:assert/strict');
const test = require('node:test');
const { selectLockedArticles } = require('../../publish/orchestrator-section-locking');

test('semantic rejection cannot lock an article even when numeric article results pass', () => {
  const sections = [{ headline: 'Rejected explanation' }, { headline: 'Complete explanation' }];
  const quality = { article_results: sections.map(section => ({ ...section, status: 'PASS' })), deductions: [] };
  const factCheck = { article_quality: [
    { section_index: 0, headline: 'A different public headline', publishable: false },
    { section_index: 1, publishable: true }
  ] };
  assert.deepEqual(selectLockedArticles({ sections }, quality, factCheck).articles, [sections[1]]);
});

test('a semantic PASS with a deterministic source blocker stays eligible for repair', () => {
  const section = { headline: 'Deferred request retry', category: 'Camera',
    sources: [{ url: 'https://example.com/change' }] };
  const clean = { headline: 'Encoder range', category: 'Media',
    sources: [{ url: 'https://example.com/encoder' }] };
  const report = {
    article_results: [section, clean].map(item => ({ ...item, status: 'PASS' })),
    deductions: [{ category: 'linked-evidence-overclaim', location: section.headline,
      reason: 'Unresolved evidence was described as confirmed.', blocking: true, severity: 'hard' }]
  };
  const result = selectLockedArticles({ sections: [section, clean] }, report, {});
  assert.deepEqual(result.articles, [clean]);
});

test('an advisory source warning alone does not prevent locking a passing article', () => {
  const section = { headline: 'Encoder range', category: 'Media' };
  const report = { article_results: [{ ...section, status: 'PASS' }],
    deductions: [{ category: 'linked-evidence-limitation', location: section.headline,
      reason: 'Diagnostic context is limited.', blocking: false, severity: 'soft' }] };
  assert.deepEqual(selectLockedArticles({ sections: [section] }, report, {}).articles, [section]);
});
