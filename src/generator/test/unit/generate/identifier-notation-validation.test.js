const assert = require('node:assert/strict');
const test = require('node:test');
const { identifierNotationIssues } = require('../../../editor/identifier-notation-validation');

function article(reference, prose, field = 'body_markdown') {
  return { confirmed_facts: [reference], public_article: { [field]: prose } };
}

test('source-backed model and version punctuation loss is detected without rewriting prose', () => {
  for (const [expected, observed] of [
    ['Mali-C55', 'Mali C55'], ['D-PHY', 'D PHY'], ['RZ/V2H(P)', 'RZ V2HP'],
    ['7.3-rc4', '7.3 rc4'], ['0.7.2-4.1', '0.7.2 4.1'], ['3:26.2.3-1', '3:26.2.3 1']
  ]) {
    const section = article(`지원 대상은 ${expected}입니다.`, `${observed}를 검증합니다.`);
    const before = JSON.stringify(section);
    const issues = identifierNotationIssues(section);
    assert.equal(issues.length, 1, expected);
    assert.equal(issues[0].expected, expected);
    assert.equal(issues[0].observed, observed);
    assert.equal(issues[0].field, 'public_article.body_markdown');
    assert.equal(JSON.stringify(section), before);
  }
});

test('notation evidence stays within the article and accepts source-supported alternate spellings', () => {
  assert.deepEqual(identifierNotationIssues(article('Mali-C55를 지원합니다.', 'Mali-C55를 확인합니다.')), []);
  assert.deepEqual(identifierNotationIssues(article('Mali-C55와 Mali C55 표기가 모두 있습니다.', 'Mali C55를 확인합니다.')), []);
  assert.deepEqual(identifierNotationIssues(article('다른 센서를 지원합니다.', 'Mali C55를 확인합니다.')), []);
  // This detector is conservative when an original spelling survives elsewhere.
  assert.deepEqual(identifierNotationIssues({
    ...article('Mali-C55를 지원합니다.', 'Mali C55를 확인합니다.'),
    public_article: { headline: 'Mali-C55 변경', lead: 'Mali C55를 확인합니다.' }
  }), []);
});

test('dates, fractions, ordinary compound words, URLs and cross-field fragments do not trigger', () => {
  for (const [reference, prose] of [
    ['2026-09-28', '2026 09 28'], ['1/2', '1 2'], ['source-backed', 'source backed'],
    ['CPU/GPU', 'CPU GPU'], ['10-bit', '10 bit'], ['24-hour', '24 hour'],
    ['https://example.com/Mali-C55', 'Mali C55']
  ]) assert.deepEqual(identifierNotationIssues(article(reference, prose)), [], reference);
  assert.deepEqual(identifierNotationIssues({
    confirmed_facts: ['Mali-C55'], public_article: { headline: 'Mali', lead: 'C55를 확인합니다.' }
  }), []);
});

test('identifier matches respect token boundaries and preserve field addresses', () => {
  assert.deepEqual(identifierNotationIssues(article('Mali-C55', 'SuperMali C55 또는 Mali C550')), []);
  assert.deepEqual(identifierNotationIssues(article('7.3-rc4', '7.3 rc4.1')), []);
  assert.equal(identifierNotationIssues(article('Mali-C55', 'Mali-C55-v2와 Mali C55를 비교합니다.')).length, 1);
  assert.deepEqual(identifierNotationIssues(article('Mali-C55', 'Mali C55-v2를 확인합니다.')), []);
  assert.deepEqual(identifierNotationIssues(article('Mali-C55', 'Other/Mali C55를 확인합니다.')), []);
  const section = {
    sources: [{ title: 'MIPI D-PHY 변경' }],
    public_article: { reader_checkpoints: ['D PHY를 확인합니다.'] }
  };
  const issue = identifierNotationIssues(section, 2)[0];
  assert.equal(issue.index, 3);
  assert.equal(issue.field, 'public_article.reader_checkpoints.0');
  assert.equal(issue.expected, 'D-PHY');
});

test('verified facts and fact claims provide anchors while editorial hints do not', () => {
  assert.equal(identifierNotationIssues({
    article_sections: { verified_facts: ['RZ/V2H'] }, public_article: { headline: 'RZ V2H 변경' }
  }).length, 1);
  assert.equal(identifierNotationIssues({
    claims: [{ claim_type: 'fact', text: 'Mali-C55' }], public_article: { lead: 'Mali C55를 확인합니다.' }
  }).length, 1);
  assert.deepEqual(identifierNotationIssues({
    claims: [{ claim_type: 'interpretation', text: 'Mali-C55' }],
    public_article: { lead: 'Mali C55를 확인합니다.' }
  }), []);
  assert.equal(identifierNotationIssues({
    confirmed_facts: ['Mali-C55'],
    claims: [{ claim_type: 'fact', text: 'Mali C55' }],
    public_article: { lead: 'Mali C55를 확인합니다.' }
  }).length, 1);
});

test('displayed source labels are checked without masking authored prose errors', () => {
  for (const field of ['source_subtitle', 'source_links']) {
    const section = article('Mali-C55', 'Mali-C55를 확인합니다.');
    section.public_article[field] = field === 'source_links'
      ? [{ title: 'Mali C55 변경', url: 'https://example.com/Mali-C55' }]
      : 'Mali C55 변경';
    const issues = identifierNotationIssues(section);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].field, field === 'source_links'
      ? 'public_article.source_links.0.title' : 'public_article.source_subtitle');
  }
  const section = article('Mali-C55', 'Mali C55를 확인합니다.');
  section.public_article.source_links = [{ title: 'Mali-C55 원문', url: 'https://example.com/Mali-C55' }];
  assert.equal(identifierNotationIssues(section).length, 1);
});
