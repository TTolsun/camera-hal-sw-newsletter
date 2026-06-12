'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EDITORIAL_STORY_KEYS,
  validatePublicArticle
} = require('../../../reporter/public-article-contract');
const {
  STORY_CONTRACT_VERSION,
  STORY_PUBLIC_CONTRACT_VERSION
} = require('../../../reporter/public-article-contract');

function storyArticle(overrides = {}) {
  return {
    story_contract_version: STORY_CONTRACT_VERSION,
    headline: 'CameraX 1.6.1: SessionConfig 조합 검증 강화',
    lead: 'CameraX 1.6.1이 SessionConfig 조합 검증을 강화했습니다.',
    body_paragraphs: ['기술 세부 사항입니다.'],
    camera_hal_takeaway: 'SessionConfig 조합 실패가 더 명확히 노출됩니다.',
    reader_checkpoints: ['조합 실패 시 HAL 레이어에서 로그를 확인하세요.'],
    source_subtitle: 'CameraX Release Notes 2026-06-01',
    editorial_story: {
      reader_scenario: 'HAL 엔지니어가 SessionConfig 조합 버그를 디버깅하는 상황',
      what_happened: 'CameraX 1.6.1이 SessionConfig 조합 검증을 강화했다',
      why_it_matters: 'HAL 레이어에서 조합 실패가 더 명확히 노출된다',
      field_scenario: 'capture session 설정 중 feature combination 오류 발생 시 확인',
      not_to_overclaim: 'HAL 내부 구현 변경은 source가 명시하지 않음',
      editor_take: 'SessionConfig 조합 버그를 추적하는 팀에게 유용'
    },
    decision_metadata: {
      impact: 'Medium',
      scope: 'HAL',
      action: 'Test',
      overclaim_risk: 'Low'
    },
    source_links: [{ title: 'CameraX Release Notes', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1', publisher: 'Google' }],
    ...overrides
  };
}

function storySection(articleOverrides = {}) {
  return {
    headline: 'CameraX 1.6.1 release',
    public_article: storyArticle(articleOverrides)
  };
}

function issueWithStoryMarker() {
  return { public_contract_version: STORY_PUBLIC_CONTRACT_VERSION, generation_contract_version: 1 };
}

test('validatePublicArticle returns no issues when editorial_story is fully populated', () => {
  const issues = validatePublicArticle(storySection(), 0, {
    issue: issueWithStoryMarker(),
    requireStoryContract: true
  });
  const storyIssues = issues.filter(i => i.type === 'empty_editorial_story_field');
  assert.strictEqual(storyIssues.length, 0, `Expected no story issues but got: ${storyIssues.map(i => i.key).join(', ')}`);
});

test('validatePublicArticle returns empty_editorial_story_field for each empty key', () => {
  const emptyStory = {};
  for (const key of EDITORIAL_STORY_KEYS) {
    emptyStory[key] = '';
  }
  const issues = validatePublicArticle(storySection({ editorial_story: emptyStory }), 0, {
    issue: issueWithStoryMarker(),
    requireStoryContract: true
  });
  const storyIssues = issues.filter(i => i.type === 'empty_editorial_story_field');
  assert.strictEqual(storyIssues.length, EDITORIAL_STORY_KEYS.length,
    `Expected ${EDITORIAL_STORY_KEYS.length} story issues but got: ${storyIssues.map(i => i.key).join(', ')}`);
});

test('validatePublicArticle returns only missing keys, not populated ones', () => {
  const partialStory = {
    reader_scenario: 'HAL 엔지니어가 캡처 세션 오류를 디버깅합니다',
    what_happened: 'CameraX 1.6.1 released',
    why_it_matters: '',
    field_scenario: '',
    not_to_overclaim: '',
    editor_take: ''
  };
  const issues = validatePublicArticle(storySection({ editorial_story: partialStory }), 0, {
    issue: issueWithStoryMarker(),
    requireStoryContract: true
  });
  const storyIssues = issues.filter(i => i.type === 'empty_editorial_story_field');
  const emptyKeys = storyIssues.map(i => i.key).sort();
  assert.deepStrictEqual(emptyKeys, ['editor_take', 'field_scenario', 'not_to_overclaim', 'why_it_matters']);
});

test('validatePublicArticle does not check editorial_story when section has no story fields', () => {
  // Section without editorial_story field and no story markers: story validation is skipped
  const issues = validatePublicArticle(
    { headline: 'Basic article', public_article: { headline: 'Test' } },
    0,
    { requireStoryContract: false }
  );
  const storyIssues = issues.filter(i => i.type === 'empty_editorial_story_field');
  assert.strictEqual(storyIssues.length, 0);
});
