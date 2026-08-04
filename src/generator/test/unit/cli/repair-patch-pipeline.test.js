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
const { validateArticleClaims } = require('../../../quality/claim-source-binding');
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

test('applyRepairPatchesAndValidate reverts a verified_fact patch no fact claim covers (2026-08-03 regression)', () => {
  // patch는 verified_facts를 바꿀 수 있지만 claims는 patch 금지 경로다. 되돌리지 않으면 옛 claim
  // 문구가 남아 이후 strict claim binding에서 missing_matching_fact_claim으로 repair 전체가 거부된다.
  // 2026-08-03 run의 실제 rewording 쌍(유사도 ~0.35 < 게이트 문턱 0.5)을 쓴다. claims는 불변이고
  // 해당 fact 항목만 base 문구로 돌아가 run이 계속 진행된다.
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
  const patches = [
    {
      section_index: 0,
      section_key: stableSectionKey(draft.sections[0]),
      op: 'replace',
      path: '/article_sections/verified_facts/0',
      value: rewrittenFact
    },
    {
      section_index: 0,
      section_key: stableSectionKey(draft.sections[0]),
      op: 'replace',
      path: '/public_article/lead',
      value: '수정된 리드 문장입니다. Camera HAL 독자를 위한 검증 신호를 요약합니다.'
    }
  ];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, true);
  // 커버되지 않는 fact 편집만 되돌아가고, 나머지 patch(prose)는 살아남는다.
  assert.equal(result.editor.sections[0].article_sections.verified_facts[0], oldFact);
  assert.equal(
    result.editor.sections[0].public_article.lead,
    '수정된 리드 문장입니다. Camera HAL 독자를 위한 검증 신호를 요약합니다.'
  );
  // claims는 완전히 불변이다.
  assert.equal(result.editor.sections[0].claims[0].text, oldFact);
  assert.deepEqual(result.editor.sections[0].claims[0].evidence_ids, ['candidate:hash-1:source-summary']);
});

test('applyRepairPatchesAndValidate keeps a verified_fact patch an existing fact claim still covers', () => {
  // 유사도>=0.5로 기존 claim이 cover하는 가벼운 rewording은 그대로 유지된다.
  const oldFact = '퀄컴 CAMSS 드라이버에 C-PHY 구성을 지원하는 v9 패치 시리즈가 제출되었습니다.';
  const rewrittenFact = '퀄컴 플랫폼의 CAMSS 드라이버에 C-PHY 구성을 지원하기 위한 v9 패치 시리즈가 제안되었습니다.';
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
  assert.equal(result.editor.sections[0].claims[0].text, oldFact);
});

test('kept verified_fact patches agree with the strict claim gate when both use the same seedEvidencePack', () => {
  // 오라클 입력 합의 회귀: revertUncoveredPatchedVerifiedFacts는 seedEvidencePack을 포함해
  // keep/revert를 판정한다. 직후 strict 게이트(orchestrator-repair-completion.js의 validateEditor)가
  // pack 없이 재검증하면, seed-pack 근거로만 protected token이 해소되는 유지된 fact가 다시
  // missing_matching_fact_claim으로 죽는다. 이 테스트는 (a) pack 기반으로 fact가 유지되고,
  // (b) 같은 pack을 받은 strict 게이트는 통과하며, (c) pack 없는 게이트는 발산함을 고정한다 —
  // 호출처가 후속 게이트에 같은 seedEvidencePack을 넘겨야 하는 이유다.
  const oldFact = '패치가 제출되었으며 리뷰가 진행 중입니다.';
  const datedRewrite = '2026-08-01 패치가 제출되었으며 리뷰가 진행 중입니다.';
  const seedEvidencePack = {
    packs: [{
      evidence_pack_id: 'pack-1',
      seed_id: 'seed-1',
      title: 'Headline 1',
      seed_url: 'https://example.com/source-1',
      primary_evidence: [{
        evidence_id: 'seed-ev-1',
        fetch_status: 'allowed',
        source_text: '2026-08-01 패치가 제출되었으며 리뷰가 진행 중입니다.',
        url: 'https://example.com/source-1'
      }]
    }]
  };
  const reporter = {
    candidates: [{
      url: 'https://example.com/source-1',
      source_candidate_hash: 'hash-1',
      url_hash: 'hash-1',
      title: 'Headline 1',
      primary_evidence_ids: ['seed-ev-1']
    }]
  };
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim:hash-1:1',
          claim_type: 'fact',
          text: oldFact,
          evidence_ids: ['seed-ev-1'],
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
    value: datedRewrite
  }];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE, reporter, seedEvidencePack });

  assert.equal(result.ok, true);
  // (a) 날짜 토큰이 seed-pack evidence 텍스트로 해소되므로 rewording은 covered → 유지된다.
  assert.equal(result.editor.sections[0].article_sections.verified_facts[0], datedRewrite);

  const gateWithPack = validateArticleClaims({
    section: result.editor.sections[0],
    candidate: reporter.candidates[0],
    articleIndex: 0,
    strict: true,
    seedEvidencePack
  });
  const blockingWithPack = [
    ...gateWithPack.issues,
    ...gateWithPack.claim_results.flatMap(claim => claim.issues)
  ].filter(item => item.blocking !== false).map(item => item.reason_code);
  // (b) 같은 pack을 받은 strict 게이트는 유지된 fact를 covered로 본다.
  assert.deepEqual(blockingWithPack.filter(code => code === 'missing_matching_fact_claim'), []);

  const gateWithoutPack = validateArticleClaims({
    section: result.editor.sections[0],
    candidate: reporter.candidates[0],
    articleIndex: 0,
    strict: true
  });
  // (c) pack 없는 게이트는 같은 fact를 uncovered로 본다 — 오라클 입력이 반드시 일치해야 한다.
  assert.ok(gateWithoutPack.uncovered_facts.some(item => item.reason_code === 'missing_matching_fact_claim'));
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
