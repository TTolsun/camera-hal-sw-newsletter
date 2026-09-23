'use strict';

// T9 producer flip(#852, Refs #1090) 불변식.
//
// flip은 상수 하나를 1에서 2로 올리는 일로 보이지만, 그 상수는 두 질문에 답하고 있었다.
//
//   (A) 생산자가 새 출력에 무엇을 찍는가            → STORY_CONTRACT_VERSION (이제 2)
//   (B) 마커 없는 입력을 무엇으로 읽는가            → DEFAULT_STORY_CONTRACT_VERSION (계속 1)
//
// 둘을 한 상수로 두면 flip 한 번이 W20~ 영속 아티팩트의 본문 키 해석까지 뒤집어,
// body_paragraphs를 들고 있는 과거 기사가 v2로 읽히며 본문이 무음 drop된다. 아래 테스트는
// 그 분리가 유지되는지를 잠근다 — 상수를 다시 합치면 전부 실패한다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  GENERATION_CONTRACT_VERSION,
  STORY_CONTRACT_VERSION,
  publicArticleForSection
} = require('../../reporter/public-article-contract');
const {
  DEFAULT_STORY_CONTRACT_VERSION
} = require('../../../shared/common/story-contract-version');
const {
  completeStoryPublicArticle
} = require('../../editor/editor-section-builders');
const {
  editorRequestsStoryContract
} = require('../../publish/orchestrator-editor-retry-contract');
const { buildMarkdown } = require('../../render/newsletter-renderer');

function v1Section() {
  return {
    category: 'Android Camera',
    headline: 'CameraX 1.6.0',
    what_changed: 'CameraX 1.6.0 변경 사항입니다.',
    evidence_summary: 'Android Developers 릴리스 노트를 출처로 사용합니다.',
    confirmed_facts: ['릴리스 노트가 존재합니다.'],
    action_items: ['ITS smoke'],
    sources: [{ title: 'Android', url: 'https://example.com/a' }],
    article_sections: {
      verified_facts: ['릴리스 노트가 존재합니다.'],
      background_context: 'CameraX는 앱 계층입니다.',
      hal_driver_impact: 'Camera HAL 팀 확인',
      action_items: ['ITS smoke'],
      team_share_points: 'Camera 팀 검토'
    },
    public_article: {
      headline: 'CameraX 1.6.0',
      source_subtitle: 'Android Developers',
      lead: 'CameraX 1.6.0이 공개되었습니다.',
      body_paragraphs: ['첫 문단입니다.', '둘째 문단입니다.'],
      camera_hal_takeaway: '검증 트리거로 다룹니다.',
      reader_checkpoints: ['ITS smoke', '호환성 확인'],
      source_links: [{ title: 'Android', url: 'https://example.com/a', source_role: 'primary' }],
      editorial_story: {
        reader_scenario: '리뷰 범위를 판단하는 상황입니다.',
        what_happened: '릴리스 노트가 공개되었습니다.',
        why_it_matters: '검증 범위가 달라집니다.',
        field_scenario: 'CI에서 확인합니다.',
        not_to_overclaim: 'HAL 직접 변경으로 확대하지 않습니다.',
        editor_take: 'source 범위 안에서만 확인합니다.'
      },
      story_contract_version: 1
    }
  };
}

test('the producer stamps v2 while the fallback for unmarked input stays v1', () => {
  assert.equal(STORY_CONTRACT_VERSION, 2);
  assert.equal(GENERATION_CONTRACT_VERSION, 2);
  assert.equal(DEFAULT_STORY_CONTRACT_VERSION, 1);
  assert.notEqual(
    STORY_CONTRACT_VERSION,
    DEFAULT_STORY_CONTRACT_VERSION,
    '생산자 stamp와 폴백 버전이 같은 값이면 flip이 과거 아티팩트 해석까지 뒤집는다'
  );
});

test('an unmarked v1 article keeps its body when the producer is on v2', () => {
  // 마커를 잃은 과거 아티팩트(재렌더·품질 재계산 경로)가 v2로 읽히면 body_paragraphs가
  // 정규화에서 사라지고 본문 0문단 기사가 된다.
  const section = v1Section();
  delete section.public_article.story_contract_version;

  const normalized = publicArticleForSection(section, { issue: {} });

  assert.deepEqual(normalized.body_paragraphs, ['첫 문단입니다.', '둘째 문단입니다.']);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'body_markdown'), false);
});

test('a v1 article still renders through the v1 story path', () => {
  const issue = {
    date: '2026-06-04',
    public_contract_version: 'story-v1',
    generation_contract_version: 1,
    title: '주간호',
    summary: '요약',
    briefing: ['하나', '둘', '셋'],
    sections: [v1Section()],
    action_items: ['a'],
    references: []
  };

  const markdown = buildMarkdown(issue, { date: '2026-06-04' });

  assert.match(markdown, /첫 문단입니다\./);
  assert.match(markdown, /둘째 문단입니다\./);
});

test('completeStoryPublicArticle defaults to what the producer makes', () => {
  // 인자를 비우면 생산자 기본값(v2)이다. v1 합성 경로는 호출자가 버전을 명시할 때만 열린다.
  const completed = completeStoryPublicArticle(v1Section());

  assert.equal(completed.story_contract_version, 2);
});

test('the retry contract recognizes both contract versions as opting in', () => {
  // 생산자 버전과 비교하면 flip 이후 v1 draft가 story 계약을 요청하지 않은 것으로 읽힌다.
  for (const version of [1, 2]) {
    assert.equal(
      editorRequestsStoryContract({
        sections: [{ public_article: { story_contract_version: version } }]
      }),
      true,
      `story_contract_version=${version} draft가 story 계약 요청으로 읽히지 않았다`
    );
  }
  assert.equal(editorRequestsStoryContract({ sections: [{ public_article: {} }] }), false);
});
