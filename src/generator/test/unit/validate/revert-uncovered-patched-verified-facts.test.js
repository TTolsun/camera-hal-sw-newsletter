'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  revertUncoveredPatchedVerifiedFacts
} = require('../../../editor/editor-output-contract');
const {
  buildEvidenceIndex,
  factCoveredByClaim
} = require('../../../quality/claim-source-binding');

// repair patch 계약은 /article_sections/verified_facts/{i}는 수정 허용하지만 claims는 수정 금지다.
// 그런데 claim 바인딩 게이트는 모든 verified_facts가 claim_type=fact claim과 fuzzy 유사도(>=0.5)로
// 이어질 것을 요구한다. patch 모델이 사실을 같은 의미의 다른 문장으로 바꾸면(허용된 편집) 그 사실을
// cover하던 claim은 옛 문구로 남아 missing_matching_fact_claim이 되고 repair 전체가 거부된다
// (2026-08-03 FAILED_REPAIR_REVIEWABLE 회귀). 커버되지 않는 fact 편집만 base 문구로 되돌려
// (claims는 절대 불변) run은 살리고 게이트 강도는 수정 전과 동일하게 유지한다.
//
// claim 텍스트를 fact로 덮어쓰는 동기화 설계는 적대적 리뷰에서 기각됐다: fact==claim 항진 커버로
// 게이트가 무력화되고, 유사도 하한은 의미 반전 날조([0.2,0.5) 구간)와 짧은 문장의 어미-bigram
// 우연 일치(무관 문장도 0.2~0.33)를 막지 못함이 재현으로 확인됐다. 아래 테스트가 그 재현 쌍을
// revert 회귀 케이스로 고정한다.

const EMPTY_INDEX = buildEvidenceIndex({}, {});

// 2026-08-03 run의 실제 문자열.
const OLD_WIP_FACT = '이전 리뷰 피드백이 일부 누락되어 WIP 태그가 추가되었습니다.';
const NEW_WIP_FACT = '해당 패치 시리즈에는 이전 리뷰 피드백이 완전히 반영되지 않아 WIP(Work In Progress) 태그가 추가되었습니다.';
const OLD_SUBMIT_FACT = '퀄컴 CAMSS 드라이버에 C-PHY 구성을 지원하는 v9 패치 시리즈가 제출되었습니다.';
const NEW_SUBMIT_FACT = '퀄컴 플랫폼의 CAMSS 드라이버에 C-PHY 구성을 지원하기 위한 v9 패치 시리즈가 제안되었습니다.';

function camssEditorPair() {
  const baseSection = {
    headline: '퀄컴 CAMSS 드라이버, 고대역폭 전송을 위한 C-PHY 구성 지원 v9 패치 제안',
    claims: [
      {
        claim_id: 'claim:7dc57c68dd701d6d:1',
        claim_type: 'fact',
        text: OLD_SUBMIT_FACT,
        evidence_ids: ['candidate:7dc57c68dd701d6d:source-summary'],
        source_urls: ['https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/']
      },
      {
        claim_id: 'claim:7dc57c68dd701d6d:2',
        claim_type: 'fact',
        text: OLD_WIP_FACT,
        evidence_ids: ['candidate:7dc57c68dd701d6d:source-summary'],
        source_urls: ['https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/']
      }
    ],
    article_sections: {
      verified_facts: [OLD_SUBMIT_FACT, OLD_WIP_FACT],
      background_context: '배경',
      hal_driver_impact: '영향',
      action_items: ['액션'],
      team_share_points: '공유'
    }
  };
  const base = { sections: [baseSection] };
  const patched = JSON.parse(JSON.stringify(base));
  patched.sections[0].article_sections.verified_facts = [NEW_SUBMIT_FACT, NEW_WIP_FACT];
  return { base, patched };
}

function allFactsCovered(section) {
  return section.article_sections.verified_facts.every(fact =>
    section.claims.some(claim => factCoveredByClaim(fact, claim, EMPTY_INDEX).covered));
}

test('2026-08-03 regression: uncovered rewording is reverted, covered rewording is kept, claims are untouched', () => {
  const { base, patched } = camssEditorPair();
  const result = revertUncoveredPatchedVerifiedFacts(base, patched);
  const section = result.sections[0];
  // fact[0]의 rewording은 기존 claim이 유사도>=0.5로 cover하므로 유지된다.
  assert.equal(section.article_sections.verified_facts[0], NEW_SUBMIT_FACT);
  // fact[1]의 rewording(유사도 ~0.35)은 커버되지 않으므로 base 문구로 되돌린다.
  assert.equal(section.article_sections.verified_facts[1], OLD_WIP_FACT);
  // claims는 완전히 불변이다.
  assert.deepEqual(section.claims, base.sections[0].claims);
  // 되돌린 결과는 게이트와 같은 오라클로 전부 covered다(run이 더 이상 죽지 않는다).
  assert.ok(allFactsCovered(section));
});

test('semantic-inversion fabrication in the [0.2, 0.5) zone is reverted, never promoted into a claim', () => {
  // 적대적 리뷰 재현 쌍: 의미 반전+상태 승격 날조(옛 문구와 유사도 0.333). claim 동기화 설계에서는
  // 이 문구가 claim으로 승격되어 게이트를 통과했었다. revert 설계에서는 base 문구로 되돌아간다.
  const inversion = '이전 리뷰 피드백이 모두 반영되어 WIP 태그가 제거될 예정이며 다음 주기에 머지됩니다';
  const { base, patched } = camssEditorPair();
  patched.sections[0].article_sections.verified_facts[1] = inversion;
  const result = revertUncoveredPatchedVerifiedFacts(base, patched);
  const section = result.sections[0];
  assert.equal(section.article_sections.verified_facts[1], OLD_WIP_FACT);
  assert.deepEqual(section.claims, base.sections[0].claims);
});

test('short-fact fabrication that rides grammatical-ending bigrams is reverted', () => {
  // 적대적 리뷰 재현 쌍: 짧은 문장은 종결어미 bigram만으로 유사도 0.333이 나와 floor 기반
  // 가드를 뚫었다. revert 설계에서는 커버 여부만 보므로 그대로 되돌아간다.
  const oldFact = '패치가 제출되었습니다.';
  const fabricated = '기능이 제거되었습니다.';
  const base = {
    sections: [{
      claims: [{ claim_type: 'fact', text: oldFact, evidence_ids: ['e1'] }],
      article_sections: { verified_facts: [oldFact] }
    }]
  };
  const patched = JSON.parse(JSON.stringify(base));
  patched.sections[0].article_sections.verified_facts[0] = fabricated;
  const result = revertUncoveredPatchedVerifiedFacts(base, patched);
  assert.equal(result.sections[0].article_sections.verified_facts[0], oldFact);
  assert.deepEqual(result.sections[0].claims, base.sections[0].claims);
});

test('multi-fact rewrite has no order dependence: each fact is independently kept or reverted', () => {
  // 적대적 리뷰 재현: claim 동기화 설계는 fact[0]이 fact[1]의 유일한 cover claim을 선점해
  // 순서 의존적으로 fact[1]을 고아로 만들었다. revert는 claim을 변경하지 않으므로 각 항목이
  // 독립적으로 판정된다.
  const factA = '드라이버 A가 v9 패치로 제안되었습니다.';
  const factB = '센서 B의 디바이스 트리 바인딩이 추가되었습니다.';
  const base = {
    sections: [{
      claims: [
        { claim_type: 'fact', text: factA, evidence_ids: ['e1'] },
        { claim_type: 'fact', text: factB, evidence_ids: ['e1'] }
      ],
      article_sections: { verified_facts: [factA, factB] }
    }]
  };
  const rewriteA = '완전히 재작성되어 원문 어절과 겹치지 않는 첫번째 신규 문장 표현입니다';
  const rewriteB = '마찬가지로 전면 재구성된 두번째 신규 문장 표현이 여기에 들어갑니다';
  const forward = JSON.parse(JSON.stringify(base));
  forward.sections[0].article_sections.verified_facts = [rewriteA, rewriteB];
  const forwardResult = revertUncoveredPatchedVerifiedFacts(base, forward);
  assert.deepEqual(forwardResult.sections[0].article_sections.verified_facts, [factA, factB]);
  assert.deepEqual(forwardResult.sections[0].claims, base.sections[0].claims);
});

test('fail-closed: section without base article_sections or verified_facts array is left untouched', () => {
  const base = { sections: [{ claims: [], article_sections: null }] };
  const patched = JSON.parse(JSON.stringify(base));
  const result = revertUncoveredPatchedVerifiedFacts(base, patched);
  assert.deepEqual(result, patched);
});

test('alias-field claims (claim/evidenceIds) do not crash and still count as cover', () => {
  const { base, patched } = camssEditorPair();
  // 스키마는 snake_case를 강제하지만, 방어적으로 별칭 필드 claim에서도 TypeError 없이 동작해야 한다.
  // fact[0]의 rewording을 cover하는 claim을 별칭 필드로 표현해도 cover로 인정되어 유지된다.
  base.sections[0].claims[0] = patched.sections[0].claims[0] = {
    claim_id: 'claim:7dc57c68dd701d6d:1',
    claim_type: 'fact',
    claim: OLD_SUBMIT_FACT,
    evidenceIds: ['candidate:7dc57c68dd701d6d:source-summary']
  };
  const result = revertUncoveredPatchedVerifiedFacts(base, patched);
  assert.equal(result.sections[0].article_sections.verified_facts[0], NEW_SUBMIT_FACT);
  assert.equal(result.sections[0].article_sections.verified_facts[1], OLD_WIP_FACT);
});

test('is a no-op (same reference) when no verified_fact changed', () => {
  const { base } = camssEditorPair();
  const patched = JSON.parse(JSON.stringify(base));
  const result = revertUncoveredPatchedVerifiedFacts(base, patched);
  assert.equal(result, patched);
});
