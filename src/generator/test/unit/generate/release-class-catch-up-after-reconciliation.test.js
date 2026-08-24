'use strict';

// #879: catch-up 판정 시점 결함.
//
// release-class catch-up은 결정론 선정 직후에 한 번만 판정한다. 그 시점의 라인업이
// mainArticleCount.max면 루프가 첫 반복에서 빠져나가 blocked_reason=lineup_at_max를 찍는데,
// 그 라인업은 최종 라인업이 아니다 — 뒤이어 coverage 재조정이 편집 계획대로 그룹을 강등하기
// 때문이다. 실측 3주 연속(2026-08-10·08-17·08-24) 판정 시점 5건 / 실제 발행 2·1·1건,
// pool_size 1, admitted 0. 자리는 실제로 비어 있었고 자격 있는 릴리스는 pool에 남아 있었다.
//
// 이 파일은 재조정 뒤 한 번 더 도는 2차 pass를 고정한다. 1차(선정 단계) 동작은 건드리지 않는다
// — release-class-catch-up.test.js의 잠금이 그대로 통과해야 한다.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  admitReleaseClassCatchUpAfterReconciliation,
  buildShortlistReport
} = require('../../../select/newsroom-selection');
const {
  reconcileCoverage,
  selectionSummaryFromSelected,
  candidateKey
} = require('../../../select/coverage-reconciliation');

const EMPTY_HEADLINE_STATE = {
  schemaVersion: 1,
  updated_at: '2026-07-27T00:00:00+09:00',
  current_headline: null,
  headline_history: [],
  policy: {}
};

const CATCH_UP_POLICY = {
  enabled: true, maxCatchUpArticles: 2, maxReleaseClassArticles: 1, maxAgeDays: 35,
  targetMainArticles: 3, eligibleBuckets: ['direct_aosp_camera'], activationMode: 'fill_open_slots'
};

const RELEASE_URL = 'https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2';

function strongCandidate(overrides = {}) {
  return {
    relevance_bucket: 'direct_aosp_camera',
    aosp_camera_directness: 4,
    counts_as_primary_camera_topic: true,
    has_dated_evidence: true,
    finalSelectionEligibility: 'main',
    api_or_component: 'CameraX',
    ...overrides
  };
}

// 2026-07-27 기준 primary 창 안의 강한 신규 3건 — catch-up target(3)을 채우는 주.
function freshWeek() {
  return [
    strongCandidate({
      title: 'Fresh camera A', url: 'https://developer.android.com/jetpack/androidx/releases/camera#fresh-a',
      published_date: '2026-07-24', version_or_release: 'a1', behavior_change: 'API change A'
    }),
    strongCandidate({
      title: 'Fresh camera B', url: 'https://source.android.com/docs/core/camera/fresh-b',
      published_date: '2026-07-25', version_or_release: 'b1', behavior_change: 'API change B'
    }),
    strongCandidate({
      title: 'Fresh camera C', url: 'https://developer.android.com/media/camera/camera2/fresh-c',
      published_date: '2026-07-26', version_or_release: 'c1', behavior_change: 'API change C'
    })
  ];
}

// mainArticleCount.max(5)를 채우는 주 — 실측 2026-08-10·08-17·08-24와 같은 시작 상태.
function maxedWeek() {
  return [
    ...freshWeek(),
    strongCandidate({
      title: 'Fresh camera D', url: 'https://git.kernel.org/linux/c/fresh-d',
      published_date: '2026-07-23', version_or_release: 'd1', behavior_change: 'API change D'
    }),
    strongCandidate({
      title: 'Fresh camera E', url: 'https://source.android.com/docs/core/camera/fresh-e',
      published_date: '2026-07-22', version_or_release: 'e1', behavior_change: 'API change E'
    })
  ];
}

// 실측 v0.7.2 모양: coverage 앵커 기준 16일령 → fallback 창, release 채널 소스.
function releaseCandidate(overrides = {}) {
  return strongCandidate({
    title: 'v0.7.2', url: RELEASE_URL,
    published_date: '2026-07-10', version_or_release: 'v0.7.2',
    api_or_component: 'libcamera', behavior_change: 'libcamera 0.7.2 release',
    source_collection_mode: 'release-note-watch',
    ...overrides
  });
}

function report(candidates, options = {}) {
  return buildShortlistReport('2026-07-27', { candidates }, {
    exposureHistory: { articles: [] },
    homepageHeadlineState: EMPTY_HEADLINE_STATE,
    catchUpPolicy: CATCH_UP_POLICY,
    ...options
  });
}

// 편집 계획: keepUrls에 없는 결정론 main 후보를 short_mention으로 내린다(= 재조정 강등).
function planDemotingAllExcept(shortlistReport, keepUrls) {
  const keep = new Set(keepUrls);
  return {
    editorial_plans: shortlistReport.primary_selected_articles.map(candidate => ({
      url: candidate.url,
      coverage_decision: keep.has(candidate.url) ? 'main_article' : 'short_mention',
      impact_level: 'medium'
    }))
  };
}

// 발행 orchestrator가 재조정 직후에 하는 일과 같은 순서로 2차 pass를 돌린다.
function runSecondPass(shortlistReport, editorialPlanReport, options = {}) {
  const reconciliation = reconcileCoverage({
    shortlistReport: {
      selected_articles: shortlistReport.primary_selected_articles,
      reserve_candidates: shortlistReport.reserve_candidates
    },
    editorialPlanReport
  });
  const secondPass = admitReleaseClassCatchUpAfterReconciliation({
    selected: reconciliation.selected,
    poolCandidates: shortlistReport.release_class_catch_up_pool,
    // reporter가 기사 본문을 쓴 후보 = shortlist에 오른 후보.
    reportedCandidates: options.reportedCandidates || shortlistReport.shortlisted_candidates,
    // 재조정과 같은 편집 계획을 본다. 이걸 빼면 2차 pass가 계획 판정을 모르는 채로 승급한다.
    editorialPlanReport,
    catchUpPolicy: CATCH_UP_POLICY
  });
  return {
    reconciled: reconciliation.selected,
    secondPass,
    finalSelected: [...reconciliation.selected, ...secondPass.admitted]
  };
}

test('the selection stage still reports lineup_at_max with the release left in the pool', () => {
  // 이 이슈가 시작되는 상태. 1차 동작은 바뀌지 않아야 하고, 2차 pass 입력이 남아 있어야 한다.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  assert.equal(shortlist.selected_articles.length, 5);
  assert.equal(shortlist.catch_up_used_count, 0);
  assert.deepEqual(shortlist.release_class_catch_up, {
    pool_size: 1, admitted: 0, blocked_reason: 'lineup_at_max'
  });
  assert.deepEqual(shortlist.release_class_catch_up_pool.map(item => item.url), [RELEASE_URL]);
});

test('a release the first pass could not fit is admitted after reconciliation frees seats', () => {
  // 실측 2026-08-17 모양: 결정론 5건 → 재조정이 4건 강등 → 발행 1건.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  const { reconciled, secondPass, finalSelected } = runSecondPass(
    shortlist,
    planDemotingAllExcept(shortlist, [keep])
  );

  assert.equal(reconciled.length, 1, '재조정이 4건을 강등해 자리가 4개 비어야 한다');
  assert.equal(secondPass.admitted.length, 1, '2차 pass가 pool의 릴리스를 승급해야 한다');
  assert.equal(secondPass.admitted[0].url, RELEASE_URL);
  assert.equal(secondPass.admitted[0].catch_up_lane, 'release_class');
  assert.equal(secondPass.admitted[0].coverage_type, 'catch_up');
  assert.equal(secondPass.admitted[0].final_selection_eligibility, 'main');
  assert.deepEqual(secondPass.observation, { pool_size: 1, admitted: 1, blocked_reason: '' });
  assert.equal(finalSelected.length, 2);
});

test('the second pass is a no-op on a week where reconciliation demotes nothing', () => {
  // 강한 주에 신규 신호를 밀어내지 않는다. 자리가 없으면 1차와 같은 사유를 그대로 찍는다.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keepAll = shortlist.primary_selected_articles.map(candidate => candidate.url);
  const { reconciled, secondPass } = runSecondPass(shortlist, planDemotingAllExcept(shortlist, keepAll));

  assert.equal(reconciled.length, 5, '강등 0건이어야 한다');
  assert.equal(secondPass.admitted.length, 0);
  assert.deepEqual(secondPass.observation, { pool_size: 1, admitted: 0, blocked_reason: 'lineup_at_max' });
});

test('a candidate the second pass admits is evicted from reserve_candidates', () => {
  // 같은 기사가 selected_articles와 reserve_candidates에 동시에 실리면 리뷰 산출물이
  // 자기모순이다. orchestrator는 재조정 승급분과 2차 pass 승급분에 같은 eviction 규칙을 쓴다.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const beforeEviction = shortlist.reserve_candidates.filter(candidate => candidate.url === RELEASE_URL);
  assert.equal(beforeEviction.length, 1, '릴리스는 2차 pass 전에는 reserve 좌석에 있다');

  const keep = shortlist.primary_selected_articles[0].url;
  const { finalSelected } = runSecondPass(shortlist, planDemotingAllExcept(shortlist, [keep]));
  const finalSelectedKeys = new Set(finalSelected.map(candidateKey));
  const remainingReserve = shortlist.reserve_candidates
    .filter(candidate => !finalSelectedKeys.has(candidateKey(candidate)));

  assert.equal(
    remainingReserve.filter(candidate => candidate.url === RELEASE_URL).length,
    0,
    '승급된 릴리스는 reserve_candidates에서 빠져야 한다'
  );
});

test('derived selection summary counts the second-pass admission', () => {
  // 파생 요약을 재조정 결과로만 계산하면 승급분이 카운트에서만 빠져 정본과 어긋난다(#837 재발).
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  const { reconciled, finalSelected } = runSecondPass(shortlist, planDemotingAllExcept(shortlist, [keep]));

  assert.equal(selectionSummaryFromSelected(reconciled).selected_article_count, 1);
  const summary = selectionSummaryFromSelected(finalSelected);
  assert.equal(summary.selected_article_count, 2);
  assert.equal(summary.selected_group_count, 2);
});

test('the second pass never promotes a candidate the reporter did not write about', () => {
  // reporter 출력에 없는 후보를 main으로 올리면 editor가 쓸 capsule이 없어 그 그룹이
  // selected에는 있는데 rendered에는 없는 상태가 되고, 커버리지 등식이 깨져 발행 전체가
  // diagnostics-only로 떨어진다.
  //
  // 관측은 그 사실을 그대로 적어야 한다. pool은 비어 있지 않았고 후보가 자격을 잃은 것도
  // 아니다 — reporter가 그 기사를 쓰지 않아 떨어졌을 뿐이다. 여기에 no_eligible_candidate를
  // 찍으면 "두 pass 사이에 pool이 비었다"는 사실이 아닌 결론을 읽게 된다(#838이 막으려던
  // 바로 그 사유 혼동).
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  const { secondPass } = runSecondPass(shortlist, planDemotingAllExcept(shortlist, [keep]), {
    reportedCandidates: shortlist.shortlisted_candidates.filter(candidate => candidate.url !== RELEASE_URL)
  });

  assert.equal(secondPass.admitted.length, 0);
  assert.deepEqual(secondPass.observation, {
    pool_size: 1, admitted: 0, blocked_reason: 'not_in_reporter_input'
  });
});

test('an empty persisted pool and a fully filtered pool are different observations', () => {
  // 두 사유가 같은 문자열로 접히면 "자격 있는 릴리스가 아예 없었다"와 "있었는데 걸러졌다"를
  // 사후에 구분할 수 없다. 1차 관측이 이미 pool_size를 남기므로, 2차가 다른 기준으로 세면
  // 두 pass를 나란히 놓고 읽을 수 없다.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  const emptyPool = admitReleaseClassCatchUpAfterReconciliation({
    selected: [],
    poolCandidates: [],
    reportedCandidates: shortlist.shortlisted_candidates,
    editorialPlanReport: planDemotingAllExcept(shortlist, [keep]),
    catchUpPolicy: CATCH_UP_POLICY
  });

  assert.deepEqual(emptyPool.observation, {
    pool_size: 0, admitted: 0, blocked_reason: 'no_eligible_candidate'
  });
});

test('the second pass keeps the release-note dedup guard', () => {
  // freshWeek()[0]은 CameraX 릴리스 노트 페이지다. 그 페이지가 라인업에 남아 있으면 같은
  // 페이지의 다른 버전은 승급되지 않는다(#500 shared release-note URL hard fail 방지).
  const sameReleasePage = releaseCandidate({
    title: 'CameraX 1.5.0',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.5.0',
    version_or_release: '1.5.0', api_or_component: 'CameraX'
  });
  const shortlist = report([...maxedWeek(), sameReleasePage]);
  assert.equal(shortlist.release_class_catch_up_pool.length, 1);

  const keep = freshWeek()[0].url;
  const { reconciled, secondPass } = runSecondPass(shortlist, planDemotingAllExcept(shortlist, [keep]));

  assert.equal(reconciled.length, 1);
  assert.equal(secondPass.admitted.length, 0);
  assert.deepEqual(secondPass.observation, {
    pool_size: 1, admitted: 0, blocked_reason: 'duplicate_release_page'
  });
});

test('an already-covered release never reaches the second pass', () => {
  // 게재 이력 검사는 1차 pool 구성에서 이미 걸린다. 2차 pass는 그 pool을 그대로 쓰므로
  // 같은 기사를 두 번 발행할 경로가 없다.
  const shortlist = report([...maxedWeek(), releaseCandidate()], {
    exposureHistory: { articles: [{
      article_identity_key: `url:${RELEASE_URL}`,
      exposure_type: 'newsletter_article',
      newsletter_date: '2026-07-20'
    }] }
  });
  assert.deepEqual(shortlist.release_class_catch_up_pool, []);

  const keep = shortlist.primary_selected_articles[0].url;
  const { secondPass } = runSecondPass(shortlist, planDemotingAllExcept(shortlist, [keep]));
  assert.equal(secondPass.admitted.length, 0);
  assert.equal(secondPass.observation.blocked_reason, 'no_eligible_candidate');
});

test('the persisted pool is the only candidate source — reporter visibility alone admits nothing', () => {
  // 2차 pass는 pool을 새로 만들지 않는다. 1차가 거른 pool(버킷·나이·게재 이력·근거·
  // main_article_score_eligible)이 유일한 입력이라, 품질 하한이나 중복 가드를 우회할 경로가
  // 없다. reporter가 기사를 쓴 후보라도 pool에 없으면 승급되지 않는다.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  const reconciliation = reconcileCoverage({
    shortlistReport: {
      selected_articles: shortlist.primary_selected_articles,
      reserve_candidates: shortlist.reserve_candidates
    },
    editorialPlanReport: planDemotingAllExcept(shortlist, [keep])
  });
  const secondPass = admitReleaseClassCatchUpAfterReconciliation({
    selected: reconciliation.selected,
    poolCandidates: [],
    reportedCandidates: shortlist.shortlisted_candidates,
    catchUpPolicy: CATCH_UP_POLICY
  });

  assert.equal(reconciliation.selected.length, 1, '자리는 비어 있는 상태');
  assert.equal(secondPass.admitted.length, 0);
  assert.deepEqual(secondPass.observation, { pool_size: 0, admitted: 0, blocked_reason: 'no_eligible_candidate' });
});

test('the lane stays off when the policy disables it', () => {
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  const reconciliation = reconcileCoverage({
    shortlistReport: {
      selected_articles: shortlist.primary_selected_articles,
      reserve_candidates: shortlist.reserve_candidates
    },
    editorialPlanReport: planDemotingAllExcept(shortlist, [keep])
  });
  const { maxReleaseClassArticles, ...laneOff } = CATCH_UP_POLICY;
  const secondPass = admitReleaseClassCatchUpAfterReconciliation({
    selected: reconciliation.selected,
    poolCandidates: shortlist.release_class_catch_up_pool,
    reportedCandidates: shortlist.shortlisted_candidates,
    catchUpPolicy: laneOff
  });

  assert.equal(secondPass.admitted.length, 0);
  assert.deepEqual(secondPass.observation, { pool_size: 0, admitted: 0, blocked_reason: 'lane_disabled' });
});

test('the second pass does not resurrect a first-pass promotion that reconciliation demoted', () => {
  // 1차가 승급한 릴리스를 재조정이 강등했다면 그건 편집 계획이 판정한 결과다. 2차 pass가
  // 다시 올리면 재조정을 무력화한다. 1차 승급분은 pool에서 빠져 있어야 한다.
  const shortlist = report([...freshWeek(), releaseCandidate()]);
  assert.equal(shortlist.catch_up_used_count, 1, '1차가 릴리스를 승급하는 상태를 만든다');
  assert.deepEqual(shortlist.release_class_catch_up_pool, [], '1차 승급분은 2차 pool에 남지 않는다');

  const keep = shortlist.primary_selected_articles[0].url;
  const { reconciled, secondPass } = runSecondPass(shortlist, planDemotingAllExcept(shortlist, [keep]));

  assert.ok(!reconciled.some(candidate => candidate.url === RELEASE_URL), '재조정이 릴리스를 강등한 상태');
  assert.equal(secondPass.admitted.length, 0, '강등된 기사를 2차 pass가 되살리면 안 된다');
});

// --- 편집 계획 권한(#724) --------------------------------------------------
//
// pool 후보도 reporter 입력에 있으면 편집 계획의 채점 대상이다. 계획이 main이 아닌 등급을
// 매긴 후보를 2차 pass가 다시 main으로 올리면, 재조정이 방금 집행한 판정을 catch-up 레인이
// 되돌리는 게이트 우회가 된다. coverage 권한은 항상 ON이고 끄는 플래그가 없다.

// planDemotingAllExcept에 pool 후보(릴리스) 채점을 얹는다. 결정론 main 후보만 채점하는
// 기본 계획과 달리, 실제 계획은 shortlist에 오른 reserve 후보까지 채점한다.
function planWithReleaseDecision(shortlistReport, keepUrls, coverageDecision) {
  const plan = planDemotingAllExcept(shortlistReport, keepUrls);
  plan.editorial_plans.push({
    url: RELEASE_URL, coverage_decision: coverageDecision, impact_level: 'medium'
  });
  return plan;
}

test('the second pass skips a pool candidate the editorial plan scored as non-main', () => {
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  const { reconciled, secondPass } = runSecondPass(
    shortlist,
    planWithReleaseDecision(shortlist, [keep], 'exclude')
  );

  assert.equal(reconciled.length, 1, '자리는 비어 있다 — 막는 것은 슬롯이 아니라 계획 판정이다');
  assert.equal(secondPass.admitted.length, 0, '계획이 exclude로 채점한 후보를 되살리면 안 된다');
  // pool은 비어 있지 않았다. 사유를 no_eligible_candidate로 접으면 게이트가 집행됐다는
  // 사실이 관측에서 사라진다.
  assert.deepEqual(secondPass.observation, {
    pool_size: 1, admitted: 0, blocked_reason: 'editorial_plan_not_main'
  });
});

test('every non-main grade is a refusal, including one the schema does not know', () => {
  // coverage_decision에는 enum이 없다(#909). 재조정은 main_article이 아닌 값을 전부
  // "main 아님"으로 접으므로, 2차 pass도 같은 기준을 써야 두 단계가 갈라지지 않는다.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  for (const decision of ['short_mention', 'reference_only', 'defer_to_next_issue']) {
    const { secondPass } = runSecondPass(shortlist, planWithReleaseDecision(shortlist, [keep], decision));
    assert.equal(secondPass.admitted.length, 0, `${decision}은 main 등급이 아니다`);
  }
});

test('a candidate the plan never scored keeps the deterministic lane decision', () => {
  // 계획에 없는 것과 계획이 거절한 것은 다르다. reference 창 후보는 shortlisted_candidates에
  // 오르지 않아 계획이 채점할 기회 자체가 없다 — 그 주에는 결정론 레인 판단을 그대로 쓴다.
  const shortlist = report([...maxedWeek(), releaseCandidate()]);
  const keep = shortlist.primary_selected_articles[0].url;
  const plan = planDemotingAllExcept(shortlist, [keep]);
  assert.ok(
    !plan.editorial_plans.some(entry => entry.url === RELEASE_URL),
    '이 계획은 릴리스를 채점하지 않는다'
  );

  const { secondPass } = runSecondPass(shortlist, plan);
  assert.equal(secondPass.admitted.length, 1, '미채점 후보는 오늘 동작(승급)을 유지한다');
});

test('the per-issue release-class cap counts first-pass promotions that survived', () => {
  // 1차가 상한(1건)을 이미 쓴 주에는 2차 pass가 두 번째 릴리스를 올리지 않는다.
  const secondRelease = releaseCandidate({
    title: 'v0.7.2+rpt20260715',
    url: 'https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2-rpt1',
    published_date: '2026-07-15', version_or_release: 'v0.7.2+rpt20260715'
  });
  const shortlist = report([...freshWeek(), releaseCandidate(), secondRelease]);
  const promoted = shortlist.selected_articles.filter(item => item.catch_up_lane === 'release_class');
  assert.equal(promoted.length, 1, '1차가 상한만큼 승급한 상태를 만든다');
  assert.equal(shortlist.release_class_catch_up_pool.length, 1, '두 번째 릴리스는 pool에 남는다');

  const keepAll = shortlist.primary_selected_articles.map(candidate => candidate.url);
  const { secondPass } = runSecondPass(shortlist, planDemotingAllExcept(shortlist, keepAll));
  assert.equal(secondPass.admitted.length, 0, '호당 release-class 상한을 1차와 합산해 지켜야 한다');
});

// --- 배선 계약 -------------------------------------------------------------
//
// 2차 pass 자체가 순수 함수라, 발행 orchestrator가 호출을 빼거나 잘못된 순서에 두어도 위
// 단위 테스트는 전부 초록이다. 그래서 호출 지점을 소스 텍스트로 고정한다. 같은 방식의 선례는
// background-context-resync-wiring.test.js·reference-articles-wiring.test.js에 있다.

function publishHostSource() {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'publish', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
}

test('the publish host runs the second pass after reconciliation resolves the main set', () => {
  const source = publishHostSource();
  const reconcileIndex = source.indexOf('reconcileCoverage({');
  const secondPassIndex = source.indexOf('admitReleaseClassCatchUpAfterReconciliation({');

  assert.ok(reconcileIndex > 0, 'reconcileCoverage 호출을 찾지 못했다');
  assert.ok(secondPassIndex > 0, '2차 pass 호출이 없다 — 이 이슈의 수정 지점이다');
  assert.ok(
    secondPassIndex > reconcileIndex,
    '2차 pass는 재조정 뒤여야 한다 — 앞이면 1차와 같은 라인업을 보고 같은 결론을 낸다'
  );
});

test('the publish host hands the second pass the same editorial plan reconciliation used', () => {
  // 계획을 넘기지 않으면 2차 pass는 채점 결과를 모르는 채로 승급한다. 순수 함수 단위
  // 테스트는 인자를 직접 넘기므로 전부 초록이고, 배선 누락은 여기서만 잡힌다.
  const source = publishHostSource();
  const callIndex = source.indexOf('admitReleaseClassCatchUpAfterReconciliation({');
  assert.ok(callIndex > 0, '2차 pass 호출이 없다');
  const callArguments = source.slice(callIndex, source.indexOf('});', callIndex));

  assert.match(
    callArguments,
    /editorialPlanReport/,
    '2차 pass가 편집 계획을 받아야 계획이 거절한 후보를 되살리지 않는다'
  );
});

test('the derived summaries are recomputed from the post-catch-up main set', () => {
  const source = publishHostSource();
  const secondPassIndex = source.indexOf('admitReleaseClassCatchUpAfterReconciliation({');
  const compositionIndex = source.indexOf('compositionSummary(finalSelected)');
  const summaryIndex = source.indexOf('Object.assign(shortlistReport, selectionSummaryFromSelected(finalSelected))');

  assert.ok(compositionIndex > secondPassIndex, 'composition_summary는 2차 pass 뒤에 계산해야 한다');
  assert.ok(summaryIndex > secondPassIndex, '파생 요약은 2차 pass 뒤에 계산해야 한다');
  assert.doesNotMatch(
    source,
    /Object\.assign\(shortlistReport, coverageReconciliation\.selection_summary\)/,
    '재조정 요약을 그대로 쓰면 승급분이 파생 카운트에서만 빠진다'
  );
});

test('the reconciled main set handed downstream includes the second-pass admission', () => {
  const source = publishHostSource();

  assert.match(
    source,
    /shortlistReport\.selected_articles = finalSelected;/,
    '정본 selected_articles는 2차 pass까지 반영한 집합이어야 한다'
  );
  assert.match(
    source,
    /syncReporterSelectionToMain\(reporter, finalSelected\)/,
    'reporter 선택 플래그 재동기화도 같은 집합을 써야 한다 — 아니면 승급 기사가 렌더되지 않는다'
  );
  assert.match(
    source,
    /filterBackgroundContextToSelected\(backgroundContextReport, finalSelected\)/,
    'editor에 넘기는 background context도 같은 집합으로 좁혀야 한다'
  );
  assert.match(
    source,
    /\.filter\(candidate => !finalSelectedKeys\.has\(candidateKey\(candidate\)\)\)/,
    'reserve eviction은 재조정 승급분과 2차 pass 승급분을 함께 걸러야 한다'
  );
});

test('both catch-up observations are persisted, not collapsed into one', () => {
  const source = publishHostSource();

  assert.match(
    source,
    /shortlistReport\.release_class_catch_up_after_reconciliation = catchUpAfterReconciliation\.observation;/,
    '2차 관측을 별도 필드로 남겨야 1차 관측 계열(pool_size/admitted/blocked_reason)이 끊기지 않는다'
  );
});

// #909 계약: attempt 단위 사실은 attempt 시작마다 결정론 시점 값으로 되돌려야 한다.
// shortlistReport는 attempt 사이에 살아 있으므로, attempt 1이 2차 pass까지 돌고 attempt 2가
// 그 앞에서 죽으면 직전 attempt의 승급 결과가 이번 실행 산출물로 커밋된다.
test('the publish host resets the attempt-scoped catch-up state at the start of each attempt', () => {
  const source = publishHostSource();
  const loopIndex = source.indexOf('for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {');
  const secondPassIndex = source.indexOf('shortlistReport.release_class_catch_up_after_reconciliation = catchUpAfterReconciliation.observation;');

  assert.ok(loopIndex > 0, 'attempt 루프를 찾지 못했다');
  assert.ok(secondPassIndex > loopIndex, '2차 pass 대입은 루프 안에 있다');

  // 이 PR이 attempt-scoped로 만든 세 필드. 하나라도 빠지면 직전 attempt 값이 새어 나온다.
  for (const reset of [
    'shortlistReport.release_class_catch_up_after_reconciliation = null;',
    'shortlistReport.catch_up_used_count = deterministicCatchUpUsedCount;',
    'shortlistReport.catch_up_articles = deterministicCatchUpArticles;'
  ]) {
    const resetIndex = source.indexOf(reset);
    assert.ok(resetIndex > loopIndex, `초기화가 attempt 루프 안에 없다: ${reset}`);
    assert.ok(resetIndex < secondPassIndex, `초기화가 2차 pass 대입보다 뒤에 있다: ${reset}`);
  }
});

test('the deterministic catch-up snapshot is captured before the attempt loop', () => {
  // 루프 안에서 잡으면 직전 attempt가 덮어쓴 값을 "결정론 시점 값"으로 착각해 되돌리는
  // 시늉만 하게 된다. pristineReserveCandidates가 루프 밖인 이유와 같다.
  const source = publishHostSource();
  const loopIndex = source.indexOf('for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {');

  for (const snapshot of [
    'const deterministicCatchUpUsedCount =',
    'const deterministicCatchUpArticles ='
  ]) {
    const snapshotIndex = source.indexOf(snapshot);
    assert.ok(snapshotIndex > 0, `스냅샷을 찾지 못했다: ${snapshot}`);
    assert.ok(snapshotIndex < loopIndex, `스냅샷은 attempt 루프 밖이어야 한다: ${snapshot}`);
  }
});
