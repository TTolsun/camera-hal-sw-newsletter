// Story Contract v2 계약 코어(T2) — 계약 버전이 하위 경로로 그대로 실려 가는지 본다.
//
// 도메인 정규화가 story_contract_version을 1로 박아 두면, v2 draft가 quality recompute
// 단계에서 v1 stamp를 받아 혼합 아티팩트가 된다(PR #643과 같은 형태의 버그다).
// weekly 병합 검증은 반대 방향의 같은 문제다 — 이슈 마커를 안 넘기면 story 계약 기사가
// 항상 marker mismatch로 떨어져 병합 결과가 절대 채택되지 않는다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  toLegacyEditorIssue
} = require('../../../shared/domain/newsletter-domain-normalize');
const {
  validateMergedWeeklyArticle
} = require('../../publish/orchestrator-report-builders');
const {
  section,
  storyPublicArticle
} = require('../../../shared/test/helpers/editor-builders');

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

function mergedStoryArticle() {
  const base = section(1);
  return { ...base, public_article: storyPublicArticle(base) };
}

test('domain normalization carries the v2 story contract version into the legacy section', () => {
  const legacy = toLegacyEditorIssue(domainDraft('story-v2', 2));

  assert.equal(legacy.sections[0].public_article.story_contract_version, 2);
});

test('domain normalization keeps stamping v1 for a v1 draft', () => {
  const legacy = toLegacyEditorIssue(domainDraft('story-v1', 1));

  assert.equal(legacy.sections[0].public_article.story_contract_version, 1);
});

test('weekly merge validation accepts a story article when the issue markers travel with it', () => {
  const result = validateMergedWeeklyArticle(mergedStoryArticle(), {
    public_contract_version: 'story-v1',
    generation_contract_version: 1
  });

  assert.equal(result.ok, true, result.reason);
});

test('weekly merge validation still fails closed and says why', () => {
  const merged = mergedStoryArticle();
  merged.public_article.camera_hal_takeaway = '';

  const result = validateMergedWeeklyArticle(merged, {
    public_contract_version: 'story-v1',
    generation_contract_version: 1
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /empty_public_article_field/);
});
