'use strict';

// #724: 결정론 coverage 재조정 불변식을 고정한다. LLM은 coverage 등급을 제안만 하고,
// 이 순수 함수가 승급 자격 가드·cap clamp·발행 floor backfill을 강제한다.
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  reconcileCoverage,
  isFinalMainRecord,
  CATCH_UP_PROMOTED_AFTER_RECONCILIATION,
  KNOWN_COVERAGE_DECISIONS
} = require('../../select/coverage-reconciliation');
const { editorialPlanPrompt } = require('../../reporter/newsletter-prompts');
const { admitReleaseClassCatchUpAfterReconciliation } = require('../../select/newsroom-selection');
// 스탬프 규칙을 테스트가 다시 적으면, 프로덕션이 스탬프를 멈춰도 이 파일은 통과한다(뮤테이션으로
// 확인함). 그 필드에 쓰는 프로덕션 함수를 그대로 부른다.
const { stampCatchUpPromotions } = require('../../publish/orchestrator-reconciliation-provenance');

function mainEligible(overrides = {}) {
  return {
    url: 'u',
    url_hash: undefined,
    title: 't',
    relevance_bucket: 'direct_aosp_camera',
    deterministic_score: 60,
    main_article_source_allowed: true,
    main_article_score_eligible: true,
    ...overrides
  };
}

// #1001: impact_level 기본값은 편집 계획 프롬프트가 실제로 지시하는 어휘여야 한다. 예전
// fixture는 high/medium/low를 썼는데 프로덕션에는 없는 값이라, 코드와 프롬프트의 어휘 불일치를
// 테스트가 가려 주고 있었다.
function plan(candidate, coverage_decision, impact_level = 'Direct Impact') {
  return { url: candidate.url, coverage_decision, impact_level };
}

test('LLM cannot promote a reserve candidate that is not deterministically main-eligible', () => {
  const shortlistReport = {
    selected_articles: [mainEligible({ url: 'a' })],
    reserve_candidates: [mainEligible({ url: 'b', main_article_source_allowed: false })]
  };
  const editorialPlanReport = { editorial_plans: [plan({ url: 'b' }, 'main_article', 'Direct Impact')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.ok(!out.selected.map(a => a.url).includes('b'), 'ineligible reserve must not become main');
  assert.ok(out.diff.changes.some(c => c.action === 'promotion_blocked_ineligible'));
});

test('forbidden-bucket reserve candidate cannot be promoted even if LLM asks', () => {
  const shortlistReport = {
    selected_articles: [mainEligible({ url: 'a' })],
    reserve_candidates: [mainEligible({ url: 'b', relevance_bucket: 'generic_tech_watchlist' })]
  };
  const editorialPlanReport = { editorial_plans: [plan({ url: 'b' }, 'main_article', 'Direct Impact')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.ok(!out.selected.map(a => a.url).includes('b'));
});

test('cap clamp drops the lowest deterministic_score candidates when over mainArticleCount.max', () => {
  // #1001: 예전 이름은 "lowest impact/score"였고 최고 impact를 받은 최저 점수 후보가 살아남는다고
  // 단언했다. 그건 fixture가 IMPACT_RANK 어휘(high/low)를 쓸 때만 성립했고 프로덕션 어휘로는
  // 한 번도 성립한 적이 없다. 순서를 정하는 값은 deterministic_score 하나다.
  const many = Array.from({ length: 7 }, (_, i) => mainEligible({ url: `u${i}`, deterministic_score: 50 + i }));
  const shortlistReport = { selected_articles: many, reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: many.map((c, i) => plan(c, 'main_article', i === 0 ? 'Direct Impact' : 'Trend Watch'))
  };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.equal(out.selected.length, 5);
  const kept = out.selected.map(a => a.url);
  assert.ok(!kept.includes('u0'), 'impact_level이 가장 높아도 점수 최하위는 밀린다');
  assert.deepEqual(kept, ['u2', 'u3', 'u4', 'u5', 'u6'], '점수 상위 5건이 입력 순서대로 남는다');
});

// #1001: cap clamp는 impact_level을 정렬 키로 쓰지 않는다. 편집 계획 프롬프트가 지시하는
// 어휘(Direct Impact / Design Reference / Trend Watch / Exclude)는 예전 IMPACT_RANK 표
// (high / medium / low)와 겹치는 값이 하나도 없어서, 표가 살아 있던 동안에도 프로덕션에서는
// 순위가 언제나 0이었다 — 즉 실제 clamp는 처음부터 deterministic_score 단독 정렬이었다.
// 그래서 어느 한 어휘만 넣어 보는 테스트는 아무것도 잠그지 못한다. 표가 되살아나면 어휘가
// 겹치는 순간(예: 'high') 순서가 뒤집히므로, 잠글 것은 "어휘가 무엇이든 clamp 순서는
// deterministic_score를 따른다"이다.
const IMPACT_LEVEL_VOCABULARIES = {
  prompt: { strongest: 'Direct Impact', weakest: 'Trend Watch' },
  legacy_impact_rank: { strongest: 'high', weakest: 'low' }
};

test('cap clamp는 impact_level 어휘가 무엇이든 deterministic_score 순서를 따른다', () => {
  // main 제안 6건 > mainArticleCount.max=5. 가장 강한 impact를 받는 후보에게 최하 점수를 준다.
  const urls = ['a', 'b', 'c', 'd', 'e', 'f'];
  const candidates = urls.map((url, index) => mainEligible({
    url,
    article_group_key: `group:${url}`,
    deterministic_score: url === 'f' ? 10 : 90 - index
  }));
  const scoreOrder = ['a', 'b', 'c', 'd', 'e'];

  const selectedByVocabulary = {};
  for (const [name, { strongest, weakest }] of Object.entries(IMPACT_LEVEL_VOCABULARIES)) {
    const out = reconcileCoverage({
      shortlistReport: { selected_articles: candidates, reserve_candidates: [] },
      editorialPlanReport: {
        editorial_plans: candidates.map(candidate =>
          plan(candidate, 'main_article', candidate.url === 'f' ? strongest : weakest))
      }
    });
    selectedByVocabulary[name] = out.selected.map(item => item.url);
  }

  // 두 단언은 서로 다른 것을 잠근다. 하나는 프로덕션 어휘에서의 정렬 기준을, 다른 하나는 그
  // 결과가 어휘에 의존하지 않는다는 사실을 못박는다. 루프 안에서 두 어휘를 모두 scoreOrder와
  // 맞춰 버리면 아래 교차 대조는 정의상 참이 되어 아무것도 잠그지 못한다.
  assert.deepEqual(
    selectedByVocabulary.prompt,
    scoreOrder,
    '프롬프트 어휘에서 clamp가 deterministic_score 순서를 벗어났다'
  );
  assert.deepEqual(
    selectedByVocabulary.legacy_impact_rank,
    selectedByVocabulary.prompt,
    'impact_level 어휘를 바꿨더니 살아남는 기사 집합이 달라졌다'
  );
});

test('cap clamp preserves deterministic (input) emit order, not deterministic_score order', () => {
  // 결정론 입력 순서: c1(editorial_priority 우선) 먼저, c2가 점수는 높지만 뒤. cap 미초과.
  const c1 = mainEligible({ url: 'c1', deterministic_score: 40 });
  const c2 = mainEligible({ url: 'c2', deterministic_score: 99 });
  const shortlistReport = { selected_articles: [c1, c2], reserve_candidates: [] };
  // clamp 정렬(점수 desc)을 그대로 emit 순서로 써 버리고 싶은 유혹이 있는 흔한 경우.
  const editorialPlanReport = { editorial_plans: [plan(c1, 'main_article', 'Design Reference'), plan(c2, 'main_article', 'Design Reference')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.deepEqual(out.selected.map(a => a.url), ['c1', 'c2'], 'lead order must not flip to score-desc');
});

test('supporting-main bucket count is clamped to supportingMainMaxAllowed', () => {
  const primary = mainEligible({ url: 'p', relevance_bucket: 'direct_aosp_camera' });
  const s1 = mainEligible({ url: 's1', relevance_bucket: 'soc_platform_signal' });
  const s2 = mainEligible({ url: 's2', relevance_bucket: 'soc_platform_signal' });
  const shortlistReport = { selected_articles: [primary, s1, s2], reserve_candidates: [] };
  const editorialPlanReport = { editorial_plans: [primary, s1, s2].map(c => plan(c, 'main_article')) };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  const supporting = out.selected.filter(a =>
    ['android_multimedia_camera_output', 'soc_platform_signal', 'cpp_ai_tooling_fallback'].includes(a.relevance_bucket)
  );
  assert.ok(supporting.length <= 1);
});

test('floor backfill restores min main count when LLM excludes everything', () => {
  const a = mainEligible({ url: 'a', deterministic_score: 70 });
  const b = mainEligible({ url: 'b', deterministic_score: 65 });
  const shortlistReport = { selected_articles: [a, b], reserve_candidates: [] };
  const editorialPlanReport = { editorial_plans: [plan(a, 'exclude', 'Trend Watch'), plan(b, 'exclude', 'Trend Watch')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.ok(out.selected.length >= 1);
  assert.equal(out.selected[0].url, 'a');
  assert.ok(out.diff.changes.some(c => c.action === 'floor_backfill'));
});

test('diff records demotions and promotions vs deterministic', () => {
  const a = mainEligible({ url: 'a', deterministic_score: 70 });
  const r = mainEligible({ url: 'r', deterministic_score: 40 });
  const shortlistReport = { selected_articles: [a], reserve_candidates: [r] };
  const editorialPlanReport = { editorial_plans: [plan(a, 'reference_only', 'Trend Watch'), plan(r, 'main_article', 'Direct Impact')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.ok(out.selected.map(x => x.url).includes('r'));
  assert.ok(out.diff.changes.some(c => c.action === 'promoted'));
  assert.ok(out.diff.changes.some(c => c.action === 'demoted'));
});

test('ungraded candidate keeps its deterministic tier', () => {
  const a = mainEligible({ url: 'a' });
  const shortlistReport = { selected_articles: [a], reserve_candidates: [] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport: { editorial_plans: [] } });
  assert.deepEqual(out.selected.map(x => x.url), ['a']);
});

// #909: 강등 사유를 기록한다. 원본 판단(coverage_decision)과 실제 전환 원인(reason_code)은
// 다르다 — main_article 제안이 cap clamp에 밀려도 강등되므로, 제안을 그대로 사유로 복사하면
// "왜 빠졌나"에 답하지 못한다. 단위도 갈라 둔다: changes[]는 candidate 단위이고,
// 그룹 강등(demoted_groups)은 그룹의 후보가 전부 빠졌을 때만 성립한다.

test('reference_only 제안으로 빠진 그룹은 그 제안을 사유로 남긴다', () => {
  const a = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const b = mainEligible({ url: 'b', article_group_key: 'group:b' });
  const shortlistReport = { selected_articles: [a, b], reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: [plan(a, 'main_article'), plan(b, 'reference_only')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  const demotion = out.diff.changes.find(change => change.action === 'demoted');
  assert.equal(demotion.key, 'b');
  assert.equal(demotion.article_group_key, 'group:b');
  assert.equal(demotion.coverage_decision, 'reference_only');
  assert.equal(demotion.reason_code, 'editorial_plan_reference_only');

  assert.deepEqual(out.diff.demoted_groups, [{
    article_group_key: 'group:b',
    demoted_candidates: [{ candidate_key: 'b', coverage_decision: 'reference_only', reason_code: 'editorial_plan_reference_only' }]
  }]);
});

test('main_article 제안이 cap clamp로 빠지면 사유는 제안이 아니라 cap_clamp다', () => {
  // mainArticleCount.max=5. main 제안 6건 중 deterministic_score 최하위 하나가 밀린다.
  const candidates = ['a', 'b', 'c', 'd', 'e', 'f'].map((url, index) => mainEligible({
    url,
    article_group_key: `group:${url}`,
    deterministic_score: 90 - index
  }));
  const shortlistReport = { selected_articles: candidates, reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: candidates.map(candidate => plan(candidate, 'main_article'))
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  const demotion = out.diff.changes.find(change => change.action === 'demoted');
  assert.equal(demotion.key, 'f', '점수 최하위가 밀린다');
  assert.equal(demotion.coverage_decision, 'main_article', '원본 판단은 그대로 남는다');
  assert.equal(demotion.reason_code, 'cap_clamp', '실제 전환 원인은 cap이다');
  assert.deepEqual(out.diff.demoted_groups, [{
    article_group_key: 'group:f',
    demoted_candidates: [{ candidate_key: 'f', coverage_decision: 'main_article', reason_code: 'cap_clamp' }]
  }]);
});

test('같은 그룹의 sibling 하나만 빠지면 그룹 강등 사유에 나타나지 않는다', () => {
  const a = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const twin = mainEligible({ url: 'a-twin', article_group_key: 'group:a' });
  const shortlistReport = { selected_articles: [a, twin], reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: [plan(a, 'main_article'), plan(twin, 'reference_only')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.ok(
    out.diff.changes.some(change => change.action === 'demoted' && change.key === 'a-twin'),
    'candidate 단위로는 빠진 사실이 남는다'
  );
  assert.deepEqual(out.diff.demoted_group_keys, [], '그룹은 살아 있다');
  assert.deepEqual(out.diff.demoted_groups, [], '그룹 강등 사유에도 나타나지 않는다');
});

test('한 그룹에서 사유가 갈려도 후보와 사유의 짝이 보존된다', () => {
  // 적대적 리뷰가 실증한 케이스다. 사유·판단·후보를 각각 배열로 쪼개 dedup하면
  // 빈 coverage_decision 하나에 인덱스가 밀리고, 길이가 우연히 맞으면 뒤집힌 짝이 조용히 남는다.
  // 등급 없는 후보(cap clamp로 탈락)와 exclude 후보가 같은 그룹에서 함께 빠지는 구성.
  const ungraded = mainEligible({ url: 'p', article_group_key: 'group:m', deterministic_score: 10 });
  const excluded = mainEligible({ url: 'q', article_group_key: 'group:m', deterministic_score: 20 });
  const others = ['a', 'b', 'c', 'd', 'e'].map(url => mainEligible({
    url,
    article_group_key: `group:${url}`,
    deterministic_score: 90
  }));
  const shortlistReport = {
    selected_articles: [...others, ungraded, excluded],
    reserve_candidates: []
  };
  const editorialPlanReport = {
    editorial_plans: [
      ...others.map(candidate => plan(candidate, 'main_article')),
      plan(excluded, 'exclude')
    ]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  const group = out.diff.demoted_groups.find(item => item.article_group_key === 'group:m');
  assert.deepEqual(group.demoted_candidates, [
    { candidate_key: 'p', coverage_decision: '', reason_code: 'cap_clamp' },
    { candidate_key: 'q', coverage_decision: 'exclude', reason_code: 'editorial_plan_exclude' }
  ]);
});

test('편집 계획이 모르는 등급을 보내도 reason_code에 원문을 이어붙이지 않는다', () => {
  const a = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const weird = mainEligible({ url: 'b', article_group_key: 'group:b' });
  const shortlistReport = { selected_articles: [a, weird], reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: [plan(a, 'main_article'), plan(weird, 'maybe later?')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  const demotion = out.diff.changes.find(change => change.action === 'demoted');
  assert.equal(demotion.reason_code, 'editorial_plan_unrecognized', '모르는 값은 접는다');
  assert.equal(demotion.coverage_decision, 'maybe later?', '원문은 판단 필드에 그대로 남긴다');
});

test('등급 앞뒤 공백 때문에 main 제안이 강등되지 않는다', () => {
  const a = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const padded = mainEligible({ url: 'b', article_group_key: 'group:b' });
  const shortlistReport = { selected_articles: [a, padded], reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: [plan(a, 'main_article'), plan(padded, '  main_article  ')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.selected.map(item => item.url), ['a', 'b']);
  assert.deepEqual(out.diff.demoted_groups, []);
});
// #969: 편집 계획이 고를 수 있는 등급 목록은 프롬프트 문장 하나가 전부이고(coverage_decision은
// 스키마상 자유 문자열이다), KNOWN_COVERAGE_DECISIONS는 그 목록을 그대로 비추는 사본이다.
// 두 집합은 양방향으로 같아야 한다. 한쪽만 잠그면 #909가 만든 구분(아는 등급 = 계획이 제시된
// 것을 골랐다 / 모르는 등급 = 모델 드리프트)이 조용히 무너진다:
//   - 집합에만 값을 더하면, 프롬프트가 제시하지 않는 값을 모델이 뱉어도 정상 판단으로 기록된다.
//   - 프롬프트에만 값을 더하면, 계획이 지시대로 고른 값이 드리프트로 접힌다.
//
// 등급 이름을 쉼표로 쪼개지 않는다. 문장이 "main_article, reference_only, 또는 exclude"로만
// 바뀌어도 `또는 exclude`가 등급 이름으로 잡혀 멀쩡한 프롬프트에서 실패가 난다. 대신 문장에서
// ASCII 식별자 토큰만 뽑는다(등급 이름은 전부 ASCII고 한국어 조사·구분자는 토큰이 되지 않는다).
// 문장 자신을 가리키는 필드 이름만 빼면 남는 토큰이 곧 제시된 등급이다.
const COVERAGE_SENTENCE_FIELD_NAMES = new Set(['coverage_decision']);

function gradesOfferedByPrompt() {
  const line = editorialPlanPrompt().split('\n').find(item => item.includes('coverage_decision'));
  assert.ok(line, '프롬프트가 등급 목록을 제시하는 문장이 사라졌다');
  const sentence = line.split('.')[0];
  const tokens = sentence.match(/[a-z][a-z0-9_]*/g) || [];
  return new Set(tokens.filter(token => !COVERAGE_SENTENCE_FIELD_NAMES.has(token)));
}

test('프롬프트가 제시하는 등급과 아는 등급이 양방향으로 같다', () => {
  const offered = gradesOfferedByPrompt();
  assert.ok(offered.size > 0, '문장에서 등급을 하나도 못 뽑았다면 추출이 깨진 것이다');
  assert.deepEqual(
    [...offered].sort(),
    [...KNOWN_COVERAGE_DECISIONS].sort(),
    '프롬프트 목록과 KNOWN_COVERAGE_DECISIONS가 어긋났다'
  );
});

test('프롬프트가 제시하는 등급은 전부 아는 등급으로 기록된다', () => {
  // 집합 비교가 이름만 맞춘다면 이 테스트는 그 이름이 실제로 재조정기를 통과하는지 본다.
  for (const grade of gradesOfferedByPrompt()) {
    if (grade === 'main_article') continue;
    const kept = mainEligible({ url: 'kept', article_group_key: 'group:kept' });
    const graded = mainEligible({ url: 'graded', article_group_key: 'group:graded' });
    const out = reconcileCoverage({
      shortlistReport: { selected_articles: [kept, graded], reserve_candidates: [] },
      editorialPlanReport: { editorial_plans: [plan(kept, 'main_article'), plan(graded, grade)] }
    });

    const demotion = out.diff.changes.find(change => change.action === 'demoted');
    assert.equal(demotion.reason_code, `editorial_plan_${grade}`, `${grade}는 아는 등급이어야 한다`);
  }
});

test('프롬프트에서 뺀 short_mention은 모델 드리프트로 기록된다', () => {
  // 양방향 집합 비교는 두 곳을 함께 되돌리는 변경을 잡지 못한다. 이 등급이 다시 살아나려면
  // 렌더 경로가 먼저 있어야 하므로, 이름 자체를 여기서 못박는다.
  assert.ok(!gradesOfferedByPrompt().has('short_mention'), '프롬프트가 아직 short_mention을 제시한다');
  assert.ok(!KNOWN_COVERAGE_DECISIONS.has('short_mention'), '아는 등급에 short_mention이 남아 있다');

  // 등급을 제거해도 모델은 예전 값을 뱉을 수 있다. 그때 남아야 하는 사실은 두 개다:
  // 프롬프트가 더는 제시하지 않는 값이라는 것(reason_code)과 모델이 실제로 쓴 원문(coverage_decision).
  const kept = mainEligible({ url: 'kept', article_group_key: 'group:kept' });
  const drifted = mainEligible({ url: 'drifted', article_group_key: 'group:drifted' });
  const out = reconcileCoverage({
    shortlistReport: { selected_articles: [kept, drifted], reserve_candidates: [] },
    editorialPlanReport: { editorial_plans: [plan(kept, 'main_article'), plan(drifted, 'short_mention')] }
  });

  const demotion = out.diff.changes.find(change => change.action === 'demoted');
  assert.equal(demotion.reason_code, 'editorial_plan_unrecognized');
  assert.equal(demotion.coverage_decision, 'short_mention', '모델이 쓴 원문은 그대로 남는다');
});

// #1034: 강등 기록만으로는 "계획이 무엇을 어떻게 채점했는가"에 답하지 못한다. 강등 대상이
// 아닌 후보(reserve로 남은 후보, catch-up pool 후보)는 강등 목록에 영원히 나타나지 않고,
// 판단 원본을 담은 editorial-plan.json은 보존 등급이 debug_heavy라 커밋되지 않는다.
// 그래서 채점된 후보 전부를 강등 여부와 무관하게 따로 싣는다.

test('강등되지 않고 reserve로 남은 채점 후보도 diff에 실린다', () => {
  const selected = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const reserve = mainEligible({ url: 'r', article_group_key: 'group:r' });
  const shortlistReport = { selected_articles: [selected], reserve_candidates: [reserve] };
  const editorialPlanReport = {
    editorial_plans: [plan(selected, 'main_article'), plan(reserve, 'reference_only')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.diff.demoted_groups, [], '강등이 없어도 채점 사실은 남아야 한다');
  assert.deepEqual(out.diff.editorial_plan_scored_candidates, [
    { candidate_key: 'a', lineup_role: 'selected', article_group_key: 'group:a', coverage_decision: 'main_article', reason_code: null },
    { candidate_key: 'r', lineup_role: 'reserve', article_group_key: 'group:r', coverage_decision: 'reference_only', reason_code: null }
  ]);
  // 이슈 #1034 검증 질문 1은 "그 주 reserve 후보의 판단"을 묻는다. 한 필드 조회로 답해져야
  // 한다 — 그룹키 차집합은 reserve와 shortlisted를 못 가르고, 그룹키 자체도 후보별로 유일하지
  // 않다(공유 explicit 키·lore 시리즈·native tooling 상수가 여러 후보를 한 키로 접는다).
  assert.deepEqual(
    out.diff.editorial_plan_scored_candidates
      .filter(item => item.lineup_role === 'reserve')
      .map(item => item.candidate_key),
    ['r']
  );
});

test('채점 목록은 강등 사유를 함께 싣고 미채점 후보는 담지 않는다', () => {
  const kept = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const dropped = mainEligible({ url: 'b', article_group_key: 'group:b' });
  const ungraded = mainEligible({ url: 'c', article_group_key: 'group:c' });
  const shortlistReport = { selected_articles: [kept, dropped, ungraded], reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: [plan(kept, 'main_article'), plan(dropped, 'exclude')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.diff.editorial_plan_scored_candidates, [
    { candidate_key: 'a', lineup_role: 'selected', article_group_key: 'group:a', coverage_decision: 'main_article', reason_code: null },
    { candidate_key: 'b', lineup_role: 'selected', article_group_key: 'group:b', coverage_decision: 'exclude', reason_code: 'editorial_plan_exclude' }
  ], '채점된 후보만, 강등된 후보는 사유와 함께');
});

// #1034 후속: 투영 우주는 계획이 실제로 채점하는 우주와 같아야 한다. 계획 입력은
// capsuleInputFromReport(articleCapsuleReport, 'shortlisted')이고 그 capsule은 shortlisted
// 후보에서 1:1로 만들어진다(selected+reserve보다 넓다 — 실측 2026-08-31 8 vs 6).
// 좁게 두면 "부재 = 미채점"이라는 읽기 규칙 자체가 거짓이 된다.

test('선정·reserve 밖 shortlisted 후보의 채점도 diff에 실린다', () => {
  const selected = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const reserve = mainEligible({ url: 'r', article_group_key: 'group:r' });
  const shortlistedOnly = mainEligible({ url: 's', article_group_key: 'group:s' });
  const shortlistReport = {
    selected_articles: [selected],
    reserve_candidates: [reserve],
    shortlisted_candidates: [selected, reserve, shortlistedOnly]
  };
  const editorialPlanReport = {
    editorial_plans: [
      plan(selected, 'main_article'),
      plan(reserve, 'reference_only'),
      plan(shortlistedOnly, 'exclude')
    ]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.diff.editorial_plan_scored_candidates, [
    { candidate_key: 'a', lineup_role: 'selected', article_group_key: 'group:a', coverage_decision: 'main_article', reason_code: null },
    { candidate_key: 'r', lineup_role: 'reserve', article_group_key: 'group:r', coverage_decision: 'reference_only', reason_code: null },
    { candidate_key: 's', lineup_role: 'shortlist_only', article_group_key: 'group:s', coverage_decision: 'exclude', reason_code: null }
  ], '같은 후보를 두 번 싣지 않고 shortlisted 전용 후보까지 담는다. 역할 세 값이 모두 나온다');
});

test('shortlisted 후보는 채점 투영에만 쓰이고 승급 우주를 넓히지 않는다', () => {
  // 투영이 관측을 넘어 판정에 손대면 안 된다. 승급 자격은 여전히 selected+reserve로 닫혀 있다.
  const selected = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const shortlistedOnly = mainEligible({ url: 's', article_group_key: 'group:s' });
  const shortlistReport = {
    selected_articles: [selected],
    reserve_candidates: [],
    shortlisted_candidates: [selected, shortlistedOnly]
  };
  const editorialPlanReport = {
    editorial_plans: [plan(selected, 'main_article'), plan(shortlistedOnly, 'main_article')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.selected.map(item => item.url), ['a'], 'main 집합은 넓어지지 않는다');
  assert.ok(
    out.diff.editorial_plan_scored_candidates.some(item => item.candidate_key === 's'),
    '판정에는 안 쓰이되 관측에는 남는다'
  );
});

test('승급이 막힌 채점 후보는 그 사실을 사유로 남긴다', () => {
  // main_article로 채점됐는데 결정론 자격 가드에 막힌 reserve 후보다. reason_code가 없으면
  // "승급 차단"과 "그냥 reserve로 남음"이 같은 모양(null)으로 남는다.
  const selected = mainEligible({ url: 'a', article_group_key: 'group:a' });
  const blocked = mainEligible({
    url: 'b',
    article_group_key: 'group:b',
    main_article_source_allowed: false
  });
  const shortlistReport = { selected_articles: [selected], reserve_candidates: [blocked] };
  const editorialPlanReport = {
    editorial_plans: [plan(selected, 'main_article'), plan(blocked, 'main_article')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.diff.editorial_plan_scored_candidates, [
    { candidate_key: 'a', lineup_role: 'selected', article_group_key: 'group:a', coverage_decision: 'main_article', reason_code: null },
    { candidate_key: 'b', lineup_role: 'reserve', article_group_key: 'group:b', coverage_decision: 'main_article', reason_code: 'promotion_blocked_ineligible' }
  ]);
});

test('발행가능 floor backfill로 main에 되돌아온 후보는 그 사실을 사유로 남긴다', () => {
  // 결정론 선정 전부가 exclude로 채점되면 제안 main이 비고, floor backfill이 점수 최고
  // 후보를 main으로 되돌린다. 그 후보의 사유가 null이면 "그냥 reserve로 남았다"로 읽히는데
  // 실제로는 발행된 main 기사다 — 사후 검증이 정확히 여기서 어긋난다.
  const low = mainEligible({ url: 'a', article_group_key: 'group:a', deterministic_score: 40 });
  const high = mainEligible({ url: 'b', article_group_key: 'group:b', deterministic_score: 80 });
  const shortlistReport = { selected_articles: [low, high], reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: [plan(low, 'exclude'), plan(high, 'exclude')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.selected.map(item => item.url), ['b'], 'floor backfill이 점수 최고를 되돌린다');
  assert.deepEqual(out.diff.editorial_plan_scored_candidates, [
    { candidate_key: 'a', lineup_role: 'selected', article_group_key: 'group:a', coverage_decision: 'exclude', reason_code: 'editorial_plan_exclude' },
    { candidate_key: 'b', lineup_role: 'selected', article_group_key: 'group:b', coverage_decision: 'exclude', reason_code: 'floor_backfill' }
  ], '되돌아온 후보는 null이 아니라 복귀 사실을 남긴다');
});

test('reserve에서 main으로 승급한 후보는 그 사실을 사유로 남긴다', () => {
  // 승급된 후보는 실제로 발행되는데 사유가 null이면 "아무 일도 없었다"로 읽힌다.
  // 강등·승급 차단·floor backfill과 같은 규칙이 승급에도 적용돼야 한다.
  const dropped = mainEligible({ url: 'a', article_group_key: 'group:a', deterministic_score: 40 });
  const promoted = mainEligible({ url: 'r', article_group_key: 'group:r', deterministic_score: 80 });
  const shortlistReport = { selected_articles: [dropped], reserve_candidates: [promoted] };
  const editorialPlanReport = {
    editorial_plans: [plan(dropped, 'reference_only'), plan(promoted, 'main_article')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.selected.map(item => item.url), ['r'], 'reserve가 main으로 올라간다');
  assert.deepEqual(out.diff.editorial_plan_scored_candidates, [
    { candidate_key: 'a', lineup_role: 'selected', article_group_key: 'group:a', coverage_decision: 'reference_only', reason_code: 'editorial_plan_reference_only' },
    { candidate_key: 'r', lineup_role: 'reserve', article_group_key: 'group:r', coverage_decision: 'main_article', reason_code: 'promoted' }
  ]);
});

test('그룹키가 여러 후보를 접어도 역할 판독은 깨지지 않는다', () => {
  // candidateGroupKey는 후보별 식별자가 아니다. 공유 explicit 키를 쓰면 한 키로 접히고
  // (lore 패치 시리즈·native tooling 상수도 같은 성질), 그러면 그룹키 차집합 판독은 편성 밖
  // 후보를 통째로 잃는다. lineup_role은 후보 단위 사실이라 그 접힘에 영향받지 않는다.
  const selected = mainEligible({ url: 'a', article_group_key: 'group:shared' });
  const reserve = mainEligible({ url: 'r', article_group_key: 'group:shared' });
  const shortlistReport = { selected_articles: [selected], reserve_candidates: [reserve] };
  const editorialPlanReport = {
    editorial_plans: [plan(selected, 'main_article'), plan(reserve, 'reference_only')]
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.diff.deterministic_selected_group_keys, ['group:shared']);
  assert.deepEqual(
    out.diff.editorial_plan_scored_candidates
      .filter(item => !out.diff.deterministic_selected_group_keys.includes(item.article_group_key)),
    [],
    '차집합 판독은 여기서 편성 밖 후보를 통째로 잃는다'
  );
  assert.deepEqual(
    out.diff.editorial_plan_scored_candidates.map(item => [item.candidate_key, item.lineup_role]),
    [['a', 'selected'], ['r', 'reserve']],
    '역할은 후보마다 그대로 남는다'
  );
});

test('제안 main이었으나 cap에 밀린 reserve 후보도 cap_clamp를 사유로 남긴다', () => {
  // 결정론 selected 쪽 같은 상황은 강등 루프가 cap_clamp로 남긴다. reserve 쪽만 어느 push에도
  // 안 걸려 사유가 비어 있으면 "그냥 reserve로 남았다"와 "main까지 갔다가 cap에 밀렸다"가
  // 구분되지 않는다. 비대칭을 없앤다.
  const selected = ['a', 'b', 'c', 'd', 'e'].map((url, index) => mainEligible({
    url,
    article_group_key: 'group:' + url,
    deterministic_score: 90 - index
  }));
  const clampedOut = mainEligible({ url: 'r', article_group_key: 'group:r', deterministic_score: 10 });
  const shortlistReport = { selected_articles: selected, reserve_candidates: [clampedOut] };
  const editorialPlanReport = {
    editorial_plans: [...selected, clampedOut].map(candidate => plan(candidate, 'main_article'))
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.ok(!out.selected.map(item => item.url).includes('r'), 'cap이 reserve 승급을 막는다');
  assert.deepEqual(
    out.diff.editorial_plan_scored_candidates.find(item => item.candidate_key === 'r'),
    {
      candidate_key: 'r',
      lineup_role: 'reserve',
      article_group_key: 'group:r',
      coverage_decision: 'main_article',
      reason_code: 'cap_clamp'
    }
  );
});

// #1034: 이 목록으로 최종 main 편성을 재구성하는 규칙을 집행한다. 주석이 세 라운드 연속으로
// 코드보다 강한 주장을 했으므로, 규칙을 산문이 아니라 실행되는 식으로 못박는다.
//
// #879: 규칙 사본을 여기 두지 않는다. 예전에는 이 파일이 식을 다시 적었는데, 최종 main 집합이
// reconcileCoverage 출력이 아니게 된 뒤에도(2차 pass가 뒤에서 더 올린다) 사본과 주석만 낡고
// 테스트는 통과했다. 정의는 프로덕션의 isFinalMainRecord 하나이고, 이 파일은 그 술어를 '실제
// 편성'과 대조해 집행한다 — 술어가 틀리면 대조가 깨지므로 집행력은 그대로다.
function assertRecordsRebuildFinalMain(out, label) {
  const records = out.diff.editorial_plan_scored_candidates;
  const recordKeys = new Set(records.map(item => item.candidate_key));
  // 미채점 후보는 레코드가 없으므로 규칙의 대상이 아니다. 채점된 후보에 한해 정확해야 한다.
  const scoredFinalMain = out.selected
    .map(candidate => String(candidate.url_hash || candidate.url || candidate.title))
    .filter(key => recordKeys.has(key))
    .sort();
  const rebuilt = records
    .filter(isFinalMainRecord)
    .map(item => item.candidate_key)
    .sort();
  assert.deepEqual(rebuilt, scoredFinalMain, label);
}

test('레코드 두 필드로 계산한 최종 main이 실제 편성과 일치한다', () => {
  const scenario = {
    'selected만 그대로 발행': () => {
      const selected = ['a', 'b'].map(url => mainEligible({ url, article_group_key: 'group:' + url }));
      return reconcileCoverage({
        shortlistReport: { selected_articles: selected, reserve_candidates: [] },
        editorialPlanReport: { editorial_plans: selected.map(item => plan(item, 'main_article')) }
      });
    },
    'reserve 승급': () => {
      const dropped = mainEligible({ url: 'a', article_group_key: 'group:a', deterministic_score: 40 });
      const promoted = mainEligible({ url: 'r', article_group_key: 'group:r', deterministic_score: 80 });
      return reconcileCoverage({
        shortlistReport: { selected_articles: [dropped], reserve_candidates: [promoted] },
        editorialPlanReport: { editorial_plans: [plan(dropped, 'reference_only'), plan(promoted, 'main_article')] }
      });
    },
    'floor backfill 복귀': () => {
      const low = mainEligible({ url: 'a', article_group_key: 'group:a', deterministic_score: 40 });
      const high = mainEligible({ url: 'b', article_group_key: 'group:b', deterministic_score: 80 });
      return reconcileCoverage({
        shortlistReport: { selected_articles: [low, high], reserve_candidates: [] },
        editorialPlanReport: { editorial_plans: [plan(low, 'exclude'), plan(high, 'exclude')] }
      });
    },
    'cap clamp로 reserve 탈락': () => {
      const selected = ['a', 'b', 'c', 'd', 'e'].map((url, index) => mainEligible({
        url,
        article_group_key: 'group:' + url,
        deterministic_score: 90 - index
      }));
      const clampedOut = mainEligible({ url: 'r', article_group_key: 'group:r', deterministic_score: 10 });
      return reconcileCoverage({
        shortlistReport: { selected_articles: selected, reserve_candidates: [clampedOut] },
        editorialPlanReport: {
          editorial_plans: [...selected, clampedOut].map(item => plan(item, 'main_article'))
        }
      });
    },
    'shortlist 전용 후보 존재': () => {
      const selected = mainEligible({ url: 'a', article_group_key: 'group:a' });
      const reserve = mainEligible({ url: 'r', article_group_key: 'group:r' });
      const only = mainEligible({ url: 's', article_group_key: 'group:s' });
      return reconcileCoverage({
        shortlistReport: {
          selected_articles: [selected],
          reserve_candidates: [reserve],
          shortlisted_candidates: [selected, reserve, only]
        },
        editorialPlanReport: {
          editorial_plans: [plan(selected, 'main_article'), plan(reserve, 'reference_only'), plan(only, 'main_article')]
        }
      });
    },
    '승급 차단과 강등이 섞인 주': () => {
      const kept = mainEligible({ url: 'a', article_group_key: 'group:a' });
      const demoted = mainEligible({ url: 'b', article_group_key: 'group:b' });
      const blocked = mainEligible({
        url: 'r',
        article_group_key: 'group:r',
        main_article_source_allowed: false
      });
      return reconcileCoverage({
        shortlistReport: { selected_articles: [kept, demoted], reserve_candidates: [blocked] },
        editorialPlanReport: {
          editorial_plans: [plan(kept, 'main_article'), plan(demoted, 'exclude'), plan(blocked, 'main_article')]
        }
      });
    }
  };

  for (const [label, build] of Object.entries(scenario)) {
    const out = build();
    assert.ok(out.diff.editorial_plan_scored_candidates.length > 0, label + ': 레코드가 있어야 검사가 의미 있다');
    assertRecordsRebuildFinalMain(out, label);
  }
});

// #879: 앞 테스트는 reconcileCoverage의 출력만 먹인다. 그런데 발행되는 main 집합은 그 출력이
// 아니라 release-class catch-up 2차 pass까지 지난 결과다. 그 간극이 정확히 이 규칙을 조용히
// 거짓으로 만든 자리이므로, 여기서는 발행 호스트와 같은 순서로 돌려 '최종' 편성에 대조한다.
test('2차 pass 승급까지 반영한 최종 main도 레코드로 재구성된다', () => {
  const selected = mainEligible({
    url: 'https://example.com/a',
    title: 'HAL3 buffer manager rework',
    article_group_key: 'group:a',
    deterministic_score: 90
  });
  const demoted = mainEligible({
    url: 'https://example.com/b',
    title: 'V4L2 async subdev notifier cleanup',
    article_group_key: 'group:b',
    deterministic_score: 80
  });
  // 2차 pass가 볼 후보: 결정론 편성에도 reserve에도 없고, 계획은 main_article로 채점했으며,
  // reporter가 이미 본문을 쓴 release 채널 후보. 세 조건이 다 맞아야 이 레인이 승급한다.
  const release = mainEligible({
    url: 'https://example.com/libcamera-v0-7-2',
    title: 'libcamera v0.7.2 released',
    article_group_key: 'group:r',
    deterministic_score: 70,
    source_collection_mode: 'release-note-watch',
    freshness_window: 'fallback',
    days_since_published: 20
  });
  const shortlisted = [selected, demoted, release];
  const editorialPlanReport = {
    editorial_plans: [
      plan(selected, 'main_article'),
      plan(demoted, 'exclude'),
      plan(release, 'main_article')
    ]
  };

  const out = reconcileCoverage({
    shortlistReport: {
      selected_articles: [selected, demoted],
      reserve_candidates: [],
      shortlisted_candidates: shortlisted
    },
    editorialPlanReport
  });
  // 재조정만으로는 release가 main이 아니다 — 승급 대상 집합(selected+reserve) 밖이다.
  assert.deepEqual(out.selected.map(item => item.url), ['https://example.com/a']);

  const secondPass = admitReleaseClassCatchUpAfterReconciliation({
    selected: out.selected,
    poolCandidates: [release],
    reportedCandidates: shortlisted,
    editorialPlanReport
  });
  assert.deepEqual(
    secondPass.admitted.map(item => item.url),
    ['https://example.com/libcamera-v0-7-2'],
    '2차 pass가 승급해야 검사가 의미 있다'
  );

  // 발행 호스트가 하는 일 그대로: 최종 main 집합을 만들고, 그 승급분에 사유를 찍는다.
  const finalSelected = [...out.selected, ...secondPass.admitted];
  const stampedReport = { editorial_plan_scored_candidates: out.diff.editorial_plan_scored_candidates };
  stampCatchUpPromotions(
    stampedReport,
    secondPass.admitted.map(item => String(item.url_hash || item.url || item.title)),
    CATCH_UP_PROMOTED_AFTER_RECONCILIATION
  );
  const stamped = stampedReport.editorial_plan_scored_candidates;

  // 스탬프 전에는 규칙이 발행된 기사를 놓친다. 그 사실을 함께 잠가 두어야, 스탬프를 지우는
  // 변경이 "원래 그런 값"으로 통과하지 않는다.
  assert.deepEqual(
    out.diff.editorial_plan_scored_candidates.filter(isFinalMainRecord).map(item => item.candidate_key),
    ['https://example.com/a'],
    '사유를 찍기 전 레코드는 2차 pass 승급분을 담지 못한다'
  );
  assertRecordsRebuildFinalMain(
    { selected: finalSelected, diff: { editorial_plan_scored_candidates: stamped } },
    '2차 pass 승급 포함'
  );
});

// #1034: "promotion_clamped의 action을 demoted와 갈라 둔다"는 이 모듈의 판단이었는데 그 판단만
// 집행되지 않고 있었다. action을 demoted로 되돌리는 변이가 전체 테스트를 통과했다.
//
// 실측해 보면 지금 당장 커밋 산출물이 오염되지는 않는다 — promotion_clamped push가
// article_group_key를 싣지 않아 demotedChangesByGroup이 그 항목을 건너뛰기 때문이다. 하지만 그
// 방벽은 우연이다. 그 push에 그룹키를 더하는(자연스러워 보이는) 변경 하나면 결정론 편성에 없던
// 후보가 demoted_groups에 실린다. 그래서 우연한 방벽이 아니라 규칙 자체를 잠근다:
// action이 demoted인 항목의 key는 전부 결정론 선정 안에 있어야 한다. 이렇게 두면 앞으로 어떤
// push가 늘어도 같은 누출을 잡는다.
function assertDemotedChangesStayInsideDeterministicSelection(out, label) {
  const deterministic = new Set(out.diff.deterministic_selected);
  const strays = out.diff.changes
    .filter(change => change.action === 'demoted')
    .map(change => change.key)
    .filter(key => !deterministic.has(key));
  assert.deepEqual(strays, [], `${label}: 결정론 선정 밖 후보가 강등으로 기록됐다`);
}

test('강등 기록은 결정론 선정 안에서만 나온다', () => {
  // 누출이 실제로 일어날 수 있는 배치: 결정론 selected 하나와 reserve 하나가 같은 그룹키를
  // 공유하고 둘 다 cap에 밀린다. 그룹은 사라지므로 demoted_groups가 만들어지는데, 거기에
  // reserve 후보가 섞이면 안 된다.
  const shared = mainEligible({ url: 'a', article_group_key: 'group:shared', deterministic_score: 10 });
  const survivors = ['b', 'c', 'd', 'e', 'f'].map((url, index) => mainEligible({
    url,
    article_group_key: `group:${url}`,
    deterministic_score: 90 - index
  }));
  const clampedReserve = mainEligible({ url: 'r', article_group_key: 'group:shared', deterministic_score: 20 });
  const shortlistReport = {
    selected_articles: [shared, ...survivors],
    reserve_candidates: [clampedReserve]
  };
  const editorialPlanReport = {
    editorial_plans: [shared, ...survivors, clampedReserve].map(candidate => plan(candidate, 'main_article'))
  };

  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });

  assert.deepEqual(out.selected.map(item => item.url), ['b', 'c', 'd', 'e', 'f'], '둘 다 cap에 밀린다');
  assert.deepEqual(out.diff.demoted_groups, [{
    article_group_key: 'group:shared',
    demoted_candidates: [{ candidate_key: 'a', coverage_decision: 'main_article', reason_code: 'cap_clamp' }]
  }], '사라진 그룹의 강등 기록은 결정론 선정 후보만 담는다');
  assertDemotedChangesStayInsideDeterministicSelection(out, '그룹키를 공유하며 둘 다 cap에 밀린 주');

  // reserve 쪽은 별도 action으로, 그러나 같은 사유로 남는다.
  assert.deepEqual(
    out.diff.changes.filter(change => change.key === 'r'),
    [{ key: 'r', action: 'promotion_clamped', reason_code: 'cap_clamp' }]
  );
});

test('어떤 편성에서도 강등 기록이 결정론 선정 밖으로 넘어가지 않는다', () => {
  // 위 테스트는 한 배치만 본다. 규칙은 배치와 무관하게 성립해야 하므로 승급·강등·cap clamp·
  // floor backfill·승급 차단이 섞이는 구성을 훑는다.
  for (let selectedCount = 1; selectedCount <= 6; selectedCount += 1) {
    for (let reserveCount = 0; reserveCount <= 3; reserveCount += 1) {
      for (const sharedGroup of [false, true]) {
        const groupOf = (url) => (sharedGroup ? 'group:shared' : `group:${url}`);
        const selected = Array.from({ length: selectedCount }, (_, index) => mainEligible({
          url: `s${index}`,
          article_group_key: groupOf(`s${index}`),
          deterministic_score: 90 - index
        }));
        // reserve는 점수를 낮게 준다. 그래야 main으로 제안되고도 cap에 밀려 promotion_clamped가
        // 실제로 발생한다 — 이 배치가 없으면 아래 단언이 빈 배열만 비교하는 장식이 된다.
        const reserve = Array.from({ length: reserveCount }, (_, index) => mainEligible({
          url: `r${index}`,
          article_group_key: groupOf(`r${index}`),
          deterministic_score: 20 - index,
          main_article_source_allowed: index % 3 !== 2
        }));
        const label = `selected ${selectedCount} / reserve ${reserveCount} / sharedGroup ${sharedGroup}`;
        const out = reconcileCoverage({
          shortlistReport: { selected_articles: selected, reserve_candidates: reserve },
          editorialPlanReport: {
            editorial_plans: [...selected, ...reserve].map((candidate, index) =>
              plan(candidate, index % 4 === 3 ? 'exclude' : 'main_article'))
          }
        });
        assertDemotedChangesStayInsideDeterministicSelection(out, label);
      }
    }
  }
});
