'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  syncFactClaimTextsWithPatchedVerifiedFacts
} = require('../../../editor/editor-output-contract');
const {
  buildEvidenceIndex,
  factCoveredByClaim
} = require('../../../quality/claim-source-binding');

// repair patch 계약은 /article_sections/verified_facts/{i}는 수정 허용하지만 claims는 수정 금지다.
// 그런데 claim 바인딩 게이트는 모든 verified_facts가 claim_type=fact claim과 fuzzy 유사도(>=0.5)로
// 이어질 것을 요구한다. patch 모델이 사실을 같은 의미의 다른 문장으로 바꾸면(허용된 편집) 그 사실을
// cover하던 claim은 옛 문구로 남아 missing_matching_fact_claim이 되고 repair 전체가 거부된다
// (2026-08-03 FAILED_REPAIR_REVIEWABLE 회귀). patch가 바꾼 사실을 cover하던 fact claim의 텍스트를
// 결정론적으로 따라 바꿔 두 필드를 동기화한다. evidence_ids/source_urls는 그대로 두고 이후 strict
// 검증이 다시 돌므로 게이트 약화가 아니다.

const EMPTY_INDEX = buildEvidenceIndex({}, {});

// 2026-08-03 run의 실제 문자열: patch 후 fact와 옛 claim의 유사도가 0.5 문턱을 넘지 못했다.
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

test('2026-08-03 regression: patched WIP fact is below the coverage threshold against its old claim', () => {
  // 전제 확인: 이 회귀가 실제로 fuzzy 매칭 실패였음을 오라클로 고정한다.
  const claim = { claim_type: 'fact', text: OLD_WIP_FACT, evidence_ids: [] };
  assert.equal(factCoveredByClaim(NEW_WIP_FACT, claim, EMPTY_INDEX).covered, false);
});

test('syncs the covering fact claim text when a patch rewrites its verified_fact (2026-08-03 regression)', () => {
  const { base, patched } = camssEditorPair();
  const result = syncFactClaimTextsWithPatchedVerifiedFacts(base, patched);
  const claims = result.sections[0].claims;
  assert.equal(claims[1].text, NEW_WIP_FACT);
  // 동기화 후에는 게이트와 같은 오라클로 모든 fact가 cover된다.
  for (const fact of result.sections[0].article_sections.verified_facts) {
    assert.ok(
      claims.some(claim => factCoveredByClaim(fact, claim, EMPTY_INDEX).covered),
      `fact must be covered after sync: ${fact}`
    );
  }
  // evidence 바인딩은 그대로다(새 근거를 만들지 않음).
  assert.deepEqual(claims[1].evidence_ids, ['candidate:7dc57c68dd701d6d:source-summary']);
  assert.equal(claims[1].claim_id, 'claim:7dc57c68dd701d6d:2');
});

test('leaves a claim alone when the patched fact is still covered (small rewording)', () => {
  const { base, patched } = camssEditorPair();
  const result = syncFactClaimTextsWithPatchedVerifiedFacts(base, patched);
  // verified_facts[0]은 문구 차이가 작아 기존 claim이 그대로 cover한다 → 텍스트를 바꾸지 않는다.
  assert.equal(result.sections[0].claims[0].text, OLD_SUBMIT_FACT);
});

test('fail-closed: no fact claim covered the old text, nothing is invented', () => {
  const { base, patched } = camssEditorPair();
  base.sections[0].claims = patched.sections[0].claims = [
    { claim_type: 'fact', text: '전혀 무관한 다른 사실입니다.', evidence_ids: ['e1'] }
  ];
  const result = syncFactClaimTextsWithPatchedVerifiedFacts(base, patched);
  assert.equal(result.sections[0].claims.length, 1);
  assert.equal(result.sections[0].claims[0].text, '전혀 무관한 다른 사실입니다.');
});

test('does not hijack a claim that still covers another unchanged verified_fact', () => {
  const sharedClaimText = 'Mali-C55 ISP에 CCM 지원 패치가 제안되었고 WIP 태그가 붙었습니다.';
  const unchangedFact = 'Mali-C55 ISP에 CCM 지원 패치가 제안되었습니다.';
  const base = {
    sections: [{
      claims: [{ claim_type: 'fact', text: sharedClaimText, evidence_ids: ['e1'] }],
      article_sections: { verified_facts: [unchangedFact, sharedClaimText] }
    }]
  };
  const patched = JSON.parse(JSON.stringify(base));
  patched.sections[0].article_sections.verified_facts = [
    unchangedFact,
    '완전히 다른 문구로 재작성된 두번째 사실이며 원문과 겹치는 단어가 거의 없습니다.'
  ];
  const result = syncFactClaimTextsWithPatchedVerifiedFacts(base, patched);
  // 이 claim은 변경되지 않은 unchangedFact도 cover 중이므로 텍스트를 바꾸면 그 fact가 uncovered가 된다.
  assert.equal(result.sections[0].claims[0].text, sharedClaimText);
});

test('non-fact claims are never rewritten', () => {
  const { base, patched } = camssEditorPair();
  base.sections[0].claims[1].claim_type = 'inference';
  patched.sections[0].claims[1].claim_type = 'inference';
  const result = syncFactClaimTextsWithPatchedVerifiedFacts(base, patched);
  assert.equal(result.sections[0].claims[1].text, OLD_WIP_FACT);
});

test('is a no-op (same reference) when no verified_fact changed', () => {
  const { base } = camssEditorPair();
  const patched = JSON.parse(JSON.stringify(base));
  const result = syncFactClaimTextsWithPatchedVerifiedFacts(base, patched);
  assert.equal(result, patched);
});
