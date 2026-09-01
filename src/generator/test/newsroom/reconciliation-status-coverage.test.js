'use strict';

// #837: generation-status의 coverage 등식이 부분 입력으로 조립되던 문제를 고정한다.
//
// 등식은 selected === rendered + demoted + hardBlocked 인데, 좌변만 재조정 이전
// 스냅샷에서 오고(재조정이 selected_articles만 갈아끼우고 파생 요약은 그대로 뒀다)
// hardBlocked는 아예 주입되지 않아(editor가 기록해도 status로 안 감) 정상 발행에도
// group_coverage_ok=false가 찍혔다. 실측 6건이 전부 이 두 갈래다.
//
// 이 테스트는 두 갈래를 각각 잠그고, "진짜 설명 없는 손실"은 여전히 false로 남는지도
// 함께 잠근다 — 알람을 끄는 수정이 아니어야 한다.
const assert = require('node:assert/strict');
const test = require('node:test');

const { reconcileCoverage } = require('../../select/coverage-reconciliation');
const { selectionStatusExtra } = require('../../publish/orchestrator-status-builders');
const {
  editorExplicitlyDemotedGroups,
  editorHardBlockedGroups
} = require('../../publish/orchestrator-report-builders');

function candidate(url, overrides = {}) {
  return {
    url,
    url_hash: url,
    title: url,
    article_group_key: `group:${url}`,
    relevance_bucket: 'direct_aosp_camera',
    deterministic_score: 60,
    main_article_source_allowed: true,
    main_article_score_eligible: true,
    ...overrides
  };
}

function plan(url, coverage_decision) {
  return { url, coverage_decision, impact_level: 'Direct Impact' };
}

// 재조정 이후 orchestrator가 하는 일을 그대로 재현한다(gemini-newsroom-newsletter.js:516-535).
function applyReconciliation(shortlistReport, editorialPlanReport) {
  const result = reconcileCoverage({ shortlistReport, editorialPlanReport });
  Object.assign(shortlistReport, result.selection_summary, {
    selected_articles: result.selected,
    reconciliation_demoted_group_keys: result.diff.demoted_group_keys,
    reconciliation_demoted_groups: result.diff.demoted_groups,
    editorial_plan_scored_candidates: result.diff.editorial_plan_scored_candidates,
    reconciliation_promoted_group_keys: result.diff.promoted_group_keys,
    deterministic_selected_representative_group_keys: result.diff.deterministic_selected_group_keys
  });
  return result;
}

function deterministicReport(urls) {
  const selected = urls.map(url => candidate(url));
  return {
    selected_articles: selected,
    primary_selected_articles: selected,
    reserve_candidates: [],
    selected_article_count: selected.length,
    selected_group_count: selected.length,
    selected_representative_group_keys: selected.map(item => item.article_group_key),
    deterministic_selected_count: selected.length,
    review_gate_passed: true,
    publish_gate_passed: true
  };
}

test('재조정이 강등한 주에도 coverage가 성립한다 (2026-08-03 W32 재현)', () => {
  // 결정론 5건 중 sony 그룹을 editorial-plan이 main에서 내린다. 나머지 4건이 발행된다.
  const shortlistReport = deterministicReport(['a', 'b', 'c', 'sony']);
  shortlistReport.selected_articles.push(candidate('d'));
  shortlistReport.primary_selected_articles = shortlistReport.selected_articles;
  shortlistReport.selected_article_count = 5;
  shortlistReport.selected_group_count = 5;
  shortlistReport.selected_representative_group_keys = shortlistReport.selected_articles
    .map(item => item.article_group_key);
  shortlistReport.deterministic_selected_count = 5;

  const editorialPlanReport = {
    editorial_plans: [
      plan('a', 'main_article'),
      plan('b', 'main_article'),
      plan('c', 'main_article'),
      plan('d', 'main_article'),
      plan('sony', 'reference_only')
    ]
  };

  const result = applyReconciliation(shortlistReport, editorialPlanReport);
  assert.equal(result.selected.length, 4, '재조정 후 main은 4건');

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a', 'group:b', 'group:c', 'group:d'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  });

  assert.equal(status.group_coverage_ok, true, '정상 발행이 coverage 위반으로 찍히면 안 된다');
  assert.equal(status.selected_article_count, 4, 'composition_summary와 같은 집합을 세야 한다');
  assert.equal(status.selected_group_count, 4);
  assert.equal(status.deterministic_selected_count, 5, '결정론 기준선은 보존한다');
  assert.deepEqual(
    shortlistReport.reconciliation_demoted_group_keys,
    ['group:sony'],
    '강등 사실은 별도 필드로 남아야 한다 — 사라지면 사후 추적이 불가능하다'
  );
  // 커밋되는 generation-status.json까지 실제로 도달해야 한다. 여기까지 오지 않으면
  // 이 수정은 원인을 기록하지 않고 알람만 끄는 것이 된다.
  assert.deepEqual(status.reconciliation_demoted_group_keys, ['group:sony']);
  assert.equal(status.deterministic_selected_representative_group_keys.length, 5);
});

test('강등과 승급이 동시에 일어나도 coverage가 성립한다', () => {
  // 강등 기록만 보강하는 설계로는 절대 맞출 수 없는 케이스다(5 !== 5+1).
  const shortlistReport = deterministicReport(['a', 'b', 'c', 'd', 'e']);
  shortlistReport.reserve_candidates = [candidate('f')];

  const editorialPlanReport = {
    editorial_plans: [
      plan('a', 'main_article'),
      plan('b', 'main_article'),
      plan('c', 'main_article'),
      plan('d', 'main_article'),
      plan('e', 'reference_only'),
      plan('f', 'main_article')
    ]
  };

  applyReconciliation(shortlistReport, editorialPlanReport);

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a', 'group:b', 'group:c', 'group:d', 'group:f'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  });

  assert.equal(status.group_coverage_ok, true);
  assert.equal(status.selected_article_count, 5);
  assert.deepEqual(shortlistReport.reconciliation_demoted_group_keys, ['group:e']);
  assert.deepEqual(shortlistReport.reconciliation_promoted_group_keys, ['group:f']);
});

test('editor가 기록한 hard block이 status coverage에 반영된다', () => {
  // salvage(newsletter-quality.js)와 구조적 demote(orchestrator-repair-completion.js)가
  // editor.hard_blocked_groups에 사유와 함께 남기는데, 그 값이 status로 가지 않아
  // "설명 없는 손실"로 보이던 갈래.
  const shortlistReport = deterministicReport(['a', 'b', 'c', 'd']);
  const editor = {
    sections: [],
    hard_blocked_groups: [
      { article_group_key: 'group:d', hard_block_reason: 'thin-week salvage dropped unpublishable article', reason_code: 'quality_hard_blocker' }
    ]
  };

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a', 'group:b', 'group:c'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: editorHardBlockedGroups(editor)
  });

  assert.equal(status.hard_blocked_group_count, 1);
  assert.deepEqual(status.hard_blocked_group_keys, ['group:d']);
  assert.equal(status.group_coverage_ok, true);
});

test('같은 그룹이 강등과 hard block 양쪽에 기록돼도 이중으로 세지 않는다', () => {
  // editor 스키마는 두 배열에 같은 group key를 쓰는 것을 금지하지 않는다. 권위 검증기는
  // hard block을 우선해 강등 목록에서 빼고 세므로(effectiveDemotedGroups), status가 같은
  // 전처리를 안 하면 검증기가 통과시킨 발행에만 거짓 알람이 찍힌다.
  const shortlistReport = deterministicReport(['a', 'b', 'c', 'd']);
  const editor = {
    sections: [],
    explicitly_demoted_groups: [
      { article_group_key: 'group:d', demotion_reason: '중복', reason_code: 'duplicate_or_near_duplicate' }
    ],
    hard_blocked_groups: [
      { article_group_key: 'group:d', hard_block_reason: '출처 공백', reason_code: 'source_gap_risk' }
    ]
  };

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a', 'group:b', 'group:c'],
    explicitlyDemotedGroups: editorExplicitlyDemotedGroups(editor),
    hardBlockedGroups: editorHardBlockedGroups(editor)
  });

  assert.equal(status.group_coverage_ok, true);
  assert.equal(status.hard_blocked_group_count, 1);
  assert.equal(status.explicitly_demoted_group_count, 0, 'hard block이 이긴다');
});

test('설명 없는 손실은 여전히 coverage 위반으로 남는다 (fail-closed 유지)', () => {
  // 이 수정은 알람을 끄는 것이 아니다. 아무도 기록하지 않은 손실은 그대로 false여야 한다.
  const shortlistReport = deterministicReport(['a', 'b', 'c', 'd']);

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a', 'group:b', 'group:c'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  });

  assert.equal(status.group_coverage_ok, false);
  assert.equal(status.selected_group_count, 4);
  assert.equal(status.rendered_group_count, 3);
});

// finalize 재정규화의 되감기 회귀는 프로덕션 함수를 실제로 부르는
// orchestrator-finalize.test.js 에서 잠근다(여기서 대입을 재현하면 동어반복이 된다).

test('같은 그룹의 다른 후보가 살아남으면 그룹 강등으로 세지 않는다', () => {
  // diff.changes의 key는 candidateKey(url_hash/url/title)라 그룹키와 네임스페이스가 다르다.
  // 그대로 쓰면 살아남은 그룹까지 강등으로 세어 coverage를 새로 깬다.
  const shortlistReport = deterministicReport(['a']);
  const twin = candidate('a-twin', { article_group_key: 'group:a' });
  shortlistReport.selected_articles.push(twin);
  shortlistReport.primary_selected_articles = shortlistReport.selected_articles;

  const editorialPlanReport = {
    editorial_plans: [plan('a', 'main_article'), plan('a-twin', 'reference_only')]

  };

  const result = applyReconciliation(shortlistReport, editorialPlanReport);

  assert.equal(result.selected.length, 1, '후보 하나는 실제로 빠진다');
  assert.deepEqual(
    shortlistReport.reconciliation_demoted_group_keys,
    [],
    '그룹은 여전히 살아 있으므로 그룹 강등이 아니다'
  );
});

test('editor가 지어낸 강등 키는 status에 개수와 목록 둘 다로 남는다', () => {
  // 2026-08-17 실측: 재조정이 4그룹을 내린 주에 editor가 그 기사들을
  // `patch:uvcvideo_memory_safety` 같은 지어낸 키로 강등 선언했다. 회계에서는 빠지지만
  // 기록은 남아야 한다 — 목록만 있고 개수가 없으면 리포트를 읽는 쪽이 "0건"으로 읽는다.
  const shortlistReport = deterministicReport(['a']);

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a'],
    explicitlyDemotedGroups: [
      { article_group_key: 'patch:uvcvideo_memory_safety', demotion_reason: '', reason_code: '' },
      { article_group_key: 'patch:v4l2_isp_zero_size', demotion_reason: '', reason_code: '' }
    ],
    hardBlockedGroups: [
      { article_group_key: 'patch:libcamera_software_isp_egl', hard_block_reason: '', reason_code: '' }
    ]
  });

  assert.equal(status.group_coverage_ok, true, '선택 그룹을 전부 처리했으면 통과한다');
  assert.equal(status.explicitly_demoted_group_count, 0, '회계는 선택 집합 안만 센다');
  assert.equal(status.hard_blocked_group_count, 0);
  assert.equal(status.explicitly_demoted_outside_selection_count, 2);
  assert.equal(status.hard_blocked_outside_selection_count, 1);
  assert.equal(status.rendered_outside_selection_count, 0);
  assert.deepEqual(status.explicitly_demoted_outside_selection_group_keys, [
    'patch:uvcvideo_memory_safety',
    'patch:v4l2_isp_zero_size'
  ]);
  assert.deepEqual(status.hard_blocked_outside_selection_group_keys, ['patch:libcamera_software_isp_egl']);
});

test('렌더 관측이 없는 실행에서는 선택 밖 렌더 카운트도 판정하지 않는다', () => {
  // group_coverage_ok가 null인 실행(editor가 섹션을 만들지 못한 경우)에서 0을 찍으면
  // "확인해 보니 없었다"로 읽힌다. 판정하지 않았다는 사실은 null로 남겨야 한다.
  const shortlistReport = deterministicReport(['a']);

  const status = selectionStatusExtra(shortlistReport, {
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  });

  assert.equal(status.group_coverage_ok, null, '관측이 없으면 판정도 없다');
  assert.equal(status.rendered_outside_selection_count, null);
  assert.equal(status.rendered_outside_selection_group_keys, null);
});

test('#909: 그룹 강등 사유가 status까지 남고 candidate 단위와 섞이지 않는다', () => {
  // 결정론 3그룹 중 sony는 편집 계획이 reference_only로 내리고, twin은 같은 그룹의 sibling만
  // 빠진다. status에는 실제로 사라진 그룹만, 그 사유와 함께 남아야 한다.
  const shortlistReport = deterministicReport(['a', 'sony']);
  const twin = candidate('a-twin', { article_group_key: 'group:a' });
  shortlistReport.selected_articles.push(twin);
  shortlistReport.primary_selected_articles = shortlistReport.selected_articles;

  const editorialPlanReport = {
    editorial_plans: [
      plan('a', 'main_article'),
      plan('a-twin', 'reference_only'),
      plan('sony', 'reference_only')
    ]
  };

  applyReconciliation(shortlistReport, editorialPlanReport);

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  });

  assert.deepEqual(status.reconciliation_demoted_group_keys, ['group:sony']);
  assert.deepEqual(status.reconciliation_demoted_groups, [{
    article_group_key: 'group:sony',
    demoted_candidates: [{ candidate_key: 'sony', coverage_decision: 'reference_only', reason_code: 'editorial_plan_reference_only' }]
  }], '사라진 그룹만, 사유와 함께 남는다');
});

test('#1034: 강등되지 않은 채점 후보의 판단도 status까지 남는다', () => {
  // reserve로 남은 후보는 강등 대상이 아니라 reconciliation_demoted_groups에 영원히
  // 나타나지 않는다. 판단 원본(editorial-plan.json)은 커밋되지 않으므로, 여기서 남기지
  // 않으면 "그 주 reserve 후보를 계획이 어떻게 채점했는가"에 사후로 답할 수 없다.
  const shortlistReport = deterministicReport(['a']);
  shortlistReport.reserve_candidates = [candidate('r')];

  const editorialPlanReport = {
    editorial_plans: [plan('a', 'main_article'), plan('r', 'reference_only')]
  };

  applyReconciliation(shortlistReport, editorialPlanReport);

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  });

  assert.deepEqual(status.reconciliation_demoted_groups, [], '강등은 없다');
  assert.deepEqual(status.editorial_plan_scored_candidates, [
    { candidate_key: 'a', coverage_decision: 'main_article', reason_code: null },
    { candidate_key: 'r', coverage_decision: 'reference_only', reason_code: null }
  ], '채점된 후보 전부가 커밋되는 status로 간다');
});
