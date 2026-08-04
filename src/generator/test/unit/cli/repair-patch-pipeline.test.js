'use strict';

// #482: the targeted-repair patch path. These exercise the deterministic
// patch-apply + identity guard (applyRepairPatchesAndValidate) and the
// section_key -> editor-index remap, with no LLM in the loop.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyRepairPatchesAndValidate,
  remapRepairPatchSections
} = require('../../../publish/gemini-newsroom-newsletter');
const { editor, section, storyEditor } = require('../../../../shared/test/helpers/editor-builders');
const { stableSectionKey } = require('../../../../shared/common/section-identity');

const DATE = '2026-05-08';

test('applyRepairPatchesAndValidate applies a repair-section wording patch and preserves identity', () => {
  const draft = editor({ sections: [section(1), section(2)] });
  const patches = [{
    section_index: 0,
    section_key: stableSectionKey(draft.sections[0]),
    op: 'replace',
    path: '/article_sections/verified_facts/0',
    value: '패치된 사실'
  }];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, true);
  assert.equal(result.editor.sections.length, 2);
  assert.equal(result.editor.sections[0].article_sections.verified_facts[0], '패치된 사실');
  // the input editor is never mutated
  assert.equal(draft.sections[0].article_sections.verified_facts[0], 'Fact 1');
});

test('applyRepairPatchesAndValidate rejects a patch that targets a source URL without mutating', () => {
  const draft = editor({ sections: [section(1), section(2)] });
  const patches = [{ section_index: 0, op: 'replace', path: '/sources/0/url', value: 'https://evil.example.com' }];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, false);
  assert.ok(result.violations.length > 0);
  assert.deepEqual(result.editor, draft);
});

test('applyRepairPatchesAndValidate keeps 2 selected sections at 2 after repair (2026-06-03 regression)', () => {
  const draft = editor({ sections: [section(1), section(2)] });
  const patches = [
    { section_index: 0, op: 'replace', path: '/public_article/body_paragraphs/0', value: '문단 1 수정' },
    { section_index: 1, op: 'replace', path: '/article_sections/verified_facts/0', value: '사실 2 수정' }
  ];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, true);
  assert.equal(result.editor.sections.length, 2);
});

test('applyRepairPatchesAndValidate keeps story markers so story-v1 patches validate (2026-07-20 regression)', () => {
  // 최후 가드의 합성 wrapper가 base editor의 issue 레벨 story marker를 물려받지 않으면,
  // story-v1 draft에 대한 유효한 patch도 story_contract_version_mismatch로 항상 거부된다.
  const draft = storyEditor();
  const patches = [{
    section_index: 0,
    section_key: stableSectionKey(draft.sections[0]),
    op: 'replace',
    path: '/public_article/editorial_story/editor_take',
    value: '검증 입력으로 반영하고 다음 검증 창에서 재확인합니다.'
  }];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, true);
  assert.equal(
    result.editor.sections[0].public_article.editorial_story.editor_take,
    '검증 입력으로 반영하고 다음 검증 창에서 재확인합니다.'
  );
});

test('applyRepairPatchesAndValidate syncs the covering fact claim when a patch rewrites its verified_fact (2026-08-03 regression)', () => {
  // patch는 verified_facts를 바꿀 수 있지만 claims는 patch 금지 경로다. 동기화가 없으면 옛 claim
  // 문구가 남아 이후 strict claim binding에서 missing_matching_fact_claim으로 repair 전체가 거부된다.
  // 2026-08-03 run의 실제 rewording 쌍(유사도 ~0.35: floor 0.2와 게이트 문턱 0.5 사이)을 쓴다.
  const oldFact = '이전 리뷰 피드백이 일부 누락되어 WIP 태그가 추가되었습니다.';
  const rewrittenFact = '해당 패치 시리즈에는 이전 리뷰 피드백이 완전히 반영되지 않아 WIP(Work In Progress) 태그가 추가되었습니다.';
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim:hash-1:1',
          claim_type: 'fact',
          text: oldFact,
          evidence_ids: ['candidate:hash-1:source-summary'],
          source_urls: ['https://example.com/source-1']
        }],
        article_sections: {
          verified_facts: [oldFact],
          background_context: '배경',
          hal_driver_impact: 'HAL 영향',
          action_items: ['액션'],
          team_share_points: '공유'
        }
      }),
      section(2)
    ]
  });
  const patches = [{
    section_index: 0,
    section_key: stableSectionKey(draft.sections[0]),
    op: 'replace',
    path: '/article_sections/verified_facts/0',
    value: rewrittenFact
  }];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, true);
  assert.equal(result.editor.sections[0].article_sections.verified_facts[0], rewrittenFact);
  assert.equal(result.editor.sections[0].claims[0].text, rewrittenFact);
  // evidence 바인딩과 claim identity는 그대로다.
  assert.deepEqual(result.editor.sections[0].claims[0].evidence_ids, ['candidate:hash-1:source-summary']);
  assert.equal(result.editor.sections[0].claims[0].claim_id, 'claim:hash-1:1');
});

test('applyRepairPatchesAndValidate does not sync a fabricated (unrelated) verified_fact into the claim', () => {
  // 재작성 가드: patch가 옛 사실의 rewording이 아니라 전혀 새로운 주장을 쓰면 claim은 옛 문구로
  // 남아 이후 strict claim binding이 기존처럼 fail-closed로 막는다(coverage 게이트 항진명제 방지).
  const oldFact = '이전 리뷰 피드백이 일부 누락되어 WIP 태그가 추가되었습니다.';
  const fabricated = '전혀 무관한 신규 기능이 기본 활성화되도록 결정되었습니다.';
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim:hash-1:1',
          claim_type: 'fact',
          text: oldFact,
          evidence_ids: ['candidate:hash-1:source-summary'],
          source_urls: ['https://example.com/source-1']
        }],
        article_sections: {
          verified_facts: [oldFact],
          background_context: '배경',
          hal_driver_impact: 'HAL 영향',
          action_items: ['액션'],
          team_share_points: '공유'
        }
      }),
      section(2)
    ]
  });
  const patches = [{
    section_index: 0,
    section_key: stableSectionKey(draft.sections[0]),
    op: 'replace',
    path: '/article_sections/verified_facts/0',
    value: fabricated
  }];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, true);
  assert.equal(result.editor.sections[0].article_sections.verified_facts[0], fabricated);
  assert.equal(result.editor.sections[0].claims[0].text, oldFact);
});

test('remapRepairPatchSections resolves section_key to the real editor index', () => {
  const draft = editor({ sections: [section(1), section(2)] });
  const { normalized, violations } = remapRepairPatchSections(draft.sections, [
    { section_key: stableSectionKey(draft.sections[1]), op: 'replace', path: '/article_sections/verified_facts/0', value: 'x' }
  ]);

  assert.equal(violations.length, 0);
  assert.equal(normalized[0].section_index, 1);
});

test('remapRepairPatchSections rejects a patch whose section_key is missing', () => {
  const draft = editor({ sections: [section(1)] });
  const { violations } = remapRepairPatchSections(draft.sections, [
    { section_key: 'hash:does-not-exist', op: 'replace', path: '/article_sections/verified_facts/0', value: 'x' }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].detail, 'section_key_not_found');
});
