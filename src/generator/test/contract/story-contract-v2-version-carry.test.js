// Story Contract v2 계약 코어(T2) — 계약 버전이 하위 경로로 그대로 실려 가는지 본다.
//
// 도메인 정규화가 story_contract_version을 1로 박아 두면, v2 draft가 quality recompute
// 단계에서 v1 stamp를 받아 혼합 아티팩트가 된다(PR #643과 같은 형태의 버그다).

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  toLegacyEditorIssue
} = require('../../../shared/domain/newsletter-domain-normalize');

function domainDraft(publicContractVersion, generationContractVersion) {
  return {
    schemaVersion: 1,
    newsletterDate: '2026-05-03',
    title: 'Camera HAL / SW Newsletter - 2026-05-03',
    summary: 'Weekly summary for Camera HAL readers.',
    briefing: ['Brief one', 'Brief two', 'Brief three'],
    public_contract_version: publicContractVersion,
    generation_contract_version: generationContractVersion,
    articles: [{
      id: 'article-camerax',
      headline: 'CameraX release gives HAL teams a target',
      category: 'Android Camera',
      evidenceSummary: 'CameraX 1.5.0 release note gives a dated compatibility validation target.',
      sourceRefs: [{
        title: 'CameraX release note',
        url: 'https://example.com/camerax',
        sourceName: 'Android Developers',
        evidenceRole: 'primary'
      }],
      halPerspective: 'Validate stream, buffer, metadata behavior on representative devices.',
      actionItems: [{ description: 'Run Camera ITS preview latency checks within 2 weeks.' }]
    }],
    references: []
  };
}

test('domain normalization carries the v2 story contract version into the legacy section', () => {
  const legacy = toLegacyEditorIssue(domainDraft('story-v2', 2));

  assert.equal(legacy.sections[0].public_article.story_contract_version, 2);
});

test('domain normalization keeps stamping v1 for a v1 draft', () => {
  const legacy = toLegacyEditorIssue(domainDraft('story-v1', 1));

  assert.equal(legacy.sections[0].public_article.story_contract_version, 1);
  assert.deepEqual(legacy.sections[0].public_article.body_paragraphs, []);
});

// stamp만 v2로 올리고 본문 키를 v1으로 남기면 v2 계약에서 unexpected_public_article_keys가
// 되는 반쪽 아티팩트가 된다. 합성된 public_article은 stamp와 본문 키가 같은 버전이어야 한다.
test('domain normalization synthesizes the v2 body key alongside the v2 stamp', () => {
  const article = toLegacyEditorIssue(domainDraft('story-v2', 2)).sections[0].public_article;

  assert.equal(article.story_contract_version, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(article, 'body_paragraphs'), false);
  assert.equal(article.body_markdown, '');
});
