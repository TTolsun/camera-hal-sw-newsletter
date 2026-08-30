'use strict';

// #724: 결정론 coverage 재조정 불변식을 고정한다. LLM은 coverage 등급을 제안만 하고,
// 이 순수 함수가 승급 자격 가드·cap clamp·발행 floor backfill을 강제한다.
const assert = require('node:assert/strict');
const test = require('node:test');

const { reconcileCoverage, KNOWN_COVERAGE_DECISIONS } = require('../../select/coverage-reconciliation');
const { editorialPlanPrompt } = require('../../reporter/newsletter-prompts');

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

function plan(candidate, coverage_decision, impact_level = 'medium') {
  return { url: candidate.url, coverage_decision, impact_level };
}

test('LLM cannot promote a reserve candidate that is not deterministically main-eligible', () => {
  const shortlistReport = {
    selected_articles: [mainEligible({ url: 'a' })],
    reserve_candidates: [mainEligible({ url: 'b', main_article_source_allowed: false })]
  };
  const editorialPlanReport = { editorial_plans: [plan({ url: 'b' }, 'main_article', 'high')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.ok(!out.selected.map(a => a.url).includes('b'), 'ineligible reserve must not become main');
  assert.ok(out.diff.changes.some(c => c.action === 'promotion_blocked_ineligible'));
});

test('forbidden-bucket reserve candidate cannot be promoted even if LLM asks', () => {
  const shortlistReport = {
    selected_articles: [mainEligible({ url: 'a' })],
    reserve_candidates: [mainEligible({ url: 'b', relevance_bucket: 'generic_tech_watchlist' })]
  };
  const editorialPlanReport = { editorial_plans: [plan({ url: 'b' }, 'main_article', 'high')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.ok(!out.selected.map(a => a.url).includes('b'));
});

test('cap clamp drops the lowest impact/score candidates when over mainArticleCount.max', () => {
  const many = Array.from({ length: 7 }, (_, i) => mainEligible({ url: `u${i}`, deterministic_score: 50 + i }));
  const shortlistReport = { selected_articles: many, reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: many.map((c, i) => plan(c, 'main_article', i === 0 ? 'high' : 'low'))
  };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.equal(out.selected.length, 5);
  const kept = out.selected.map(a => a.url);
  assert.ok(kept.includes('u0'), 'high-impact survives');
  assert.ok(!kept.includes('u1') && !kept.includes('u2'), 'lowest-score low-impact dropped');
});

test('cap clamp preserves deterministic (input) emit order, not impact/score order', () => {
  // 결정론 입력 순서: c1(editorial_priority 우선) 먼저, c2가 점수는 높지만 뒤. cap 미초과.
  const c1 = mainEligible({ url: 'c1', deterministic_score: 40 });
  const c2 = mainEligible({ url: 'c2', deterministic_score: 99 });
  const shortlistReport = { selected_articles: [c1, c2], reserve_candidates: [] };
  // LLM이 둘 다 같은 impact로 매김 → 재정렬 유혹이 있는 흔한 경우.
  const editorialPlanReport = { editorial_plans: [plan(c1, 'main_article', 'medium'), plan(c2, 'main_article', 'medium')] };
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
  const editorialPlanReport = { editorial_plans: [plan(a, 'exclude', 'low'), plan(b, 'exclude', 'low')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport });
  assert.ok(out.selected.length >= 1);
  assert.equal(out.selected[0].url, 'a');
  assert.ok(out.diff.changes.some(c => c.action === 'floor_backfill'));
});

test('diff records demotions and promotions vs deterministic', () => {
  const a = mainEligible({ url: 'a', deterministic_score: 70 });
  const r = mainEligible({ url: 'r', deterministic_score: 40 });
  const shortlistReport = { selected_articles: [a], reserve_candidates: [r] };
  const editorialPlanReport = { editorial_plans: [plan(a, 'reference_only', 'low'), plan(r, 'main_article', 'high')] };
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
  // mainArticleCount.max=5. main 제안 6건 중 impact/score 최하위 하나가 밀린다.
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
