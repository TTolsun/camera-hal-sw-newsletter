'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  dropVerifiedFactsClassifiedAsNonFact
} = require('../../../editor/editor-output-contract');

// editor LLM이 같은 문장을 verified_facts(canonical source-backed 사실 목록)에 넣으면서 그 문장의
// claim은 비-fact(inference 등)로 분류하는 자가당착을 낸다. claim 바인딩은 fact claim으로만
// verified_facts를 cover하므로 그 사실은 어떤 fact claim으로도 cover되지 못해
// missing_matching_fact_claim이 발생하고 섹션 전체가 replace-or-demote된다(멀쩡한 카메라 기사가
// 통째로 탈락). editor 자신의 비-fact 분류를 신뢰해 그 문장만 사실 목록에서 제거한다.

test('drops a verified_fact the editor classified only as a non-fact (inference) claim', () => {
  const section = {
    claims: [
      { claim_type: 'fact', text: 'Fact A', evidence_ids: ['e1'] },
      { claim_type: 'inference', text: 'This change affects camera HAL integration.', evidence_ids: ['e1'] }
    ],
    article_sections: {
      verified_facts: ['Fact A', 'This change affects camera HAL integration.']
    }
  };
  const result = dropVerifiedFactsClassifiedAsNonFact(section);
  assert.deepEqual(result.article_sections.verified_facts, ['Fact A']);
  // 비-fact claim 자체는 보존된다(사실 목록에서만 제거).
  assert.equal(result.claims.length, 2);
});

test('keeps a verified_fact when a fact claim also covers it (dual classification)', () => {
  const section = {
    claims: [
      { claim_type: 'fact', text: 'Dual fact', evidence_ids: ['e1'] },
      { claim_type: 'inference', text: 'Dual fact', evidence_ids: ['e1'] }
    ],
    article_sections: { verified_facts: ['Dual fact'] }
  };
  const result = dropVerifiedFactsClassifiedAsNonFact(section);
  assert.deepEqual(result.article_sections.verified_facts, ['Dual fact']);
});

test('is a no-op (same reference) when there are no non-fact claims', () => {
  const section = {
    claims: [{ claim_type: 'fact', text: 'Fact A', evidence_ids: ['e1'] }],
    article_sections: { verified_facts: ['Fact A'] }
  };
  const result = dropVerifiedFactsClassifiedAsNonFact(section);
  assert.equal(result, section);
});

test('Mali regression: Korean inference sentence duplicated into verified_facts is removed', () => {
  const inferenceSentence = '이 변경은 카메라 HAL 통합 및 이미지 처리 파이프라인에 영향을 미칩니다.';
  const factSentence = '2026년 6월 16일, Arm Mali-C55 ISP에 CCM 지원 패치가 제안되었습니다.';
  const section = {
    claims: [
      { claim_type: 'fact', text: factSentence, evidence_ids: ['candidate:abc:source-summary'] },
      { claim_type: 'inference', text: inferenceSentence, evidence_ids: ['candidate:abc:source-summary'] }
    ],
    article_sections: { verified_facts: [factSentence, inferenceSentence] }
  };
  const result = dropVerifiedFactsClassifiedAsNonFact(section);
  assert.deepEqual(result.article_sections.verified_facts, [factSentence]);
});

// 회귀: 전부 제거되면 missing_matching_fact_claim을 empty_article_sections(required-key 누락) blocker로
// 바꿀 뿐이므로, verified_facts가 통째로 비게 되는 경우에는 원본을 유지한다(floor).
test('no-op when dropping would empty verified_facts entirely (floor)', () => {
  const section = {
    claims: [{ claim_type: 'inference', text: 'Only an inference sentence here.', evidence_ids: [] }],
    article_sections: { verified_facts: ['Only an inference sentence here.'] }
  };
  const result = dropVerifiedFactsClassifiedAsNonFact(section);
  assert.deepEqual(result.article_sections.verified_facts, ['Only an inference sentence here.']);
});

// 회귀: exact 텍스트 일치만 보면 paraphrase된 fact claim이 cover하는 사실을 잘못 strip한다.
// gate(claim binding)와 동일한 fuzzy 매칭으로 fact claim이 cover하면 유지해야 한다.
test('keeps a verified_fact a fact claim covers only fuzzily (paraphrase), not just exact text', () => {
  const fuzzyFact = 'Mali-C55 ISP gains CCM support in this patch.';
  const plainFact = 'The patch was proposed on the Linux media mailing list.';
  const section = {
    claims: [
      { claim_type: 'fact', text: 'Mali-C55 ISP gains CCM support in the patch.', evidence_ids: ['e1'] },
      { claim_type: 'fact', text: plainFact, evidence_ids: ['e1'] },
      { claim_type: 'inference', text: fuzzyFact, evidence_ids: ['e1'] }
    ],
    article_sections: { verified_facts: [fuzzyFact, plainFact] }
  };
  const result = dropVerifiedFactsClassifiedAsNonFact(section);
  assert.deepEqual(result.article_sections.verified_facts, [fuzzyFact, plainFact]);
});
