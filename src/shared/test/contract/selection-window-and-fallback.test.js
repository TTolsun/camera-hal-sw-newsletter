'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  freshnessWindowMetadata,
  scoreCandidate,
  selectFinalArticlesWithDiagnostics
} = require('../../../generator/select/newsroom-selection');
const {
  articlePolicy
} = require('../../common/newsletter-policy');
const { candidate } = require('../helpers/newsroom-builders');
const {
  buildShortlistReport,
  policyPrimaryCandidate,
  policySupportingCandidate,
  FALLBACK_WINDOW_TEST_MIN_ARTICLES
} = require('../helpers/selection-builders');

// 이 파일 전체는 직전 완결 coverage 주(coverage-week.js)를 anchor로 쓴다. 실행일(newsletterDate)
// 2026-08-19(수)의 coverage 주는 2026-W33(2026-08-10~2026-08-16, 일요일 종료)이다. 창은
// primary=coverage 주 안(0~6일), fallback=그 전 2주(7~20일), reference=그 전전 2주(21~34일),
// stale=35일 이상, not_yet_eligible=coverage 주가 끝난 뒤(E 이후, 음수 나이)다.

test('month-level dated candidates do not receive exact-day freshness scoring', () => {
  const exact = scoreCandidate(candidate({
    title: 'Camera ITS exact release note',
    url: 'https://example.com/exact',
    published_date: '2026-08-14'
  }), '2026-08-19');
  const month = scoreCandidate(candidate({
    title: 'Camera ITS monthly site update',
    url: 'https://example.com/month',
    published_date: '2026-08-14',
    datePrecision: 'month'
  }), '2026-08-19');

  assert.equal(exact.freshness_score, 3);
  assert.equal(month.freshness_score, 1);
  assert.ok(month.total < exact.total);

  const monthWindow = freshnessWindowMetadata(candidate({
    title: 'Camera ITS monthly site update',
    url: 'https://example.com/month-window',
    published_date: '2026-08-14',
    datePrecision: 'month'
  }), '2026-08-19');
  assert.match(monthWindow.selection_window_reason, /month-level date precision/);
});

// 실측 2026-08-10: AOSP Site Updates의 'July 2026' 행(Camera ITS 문서 갱신 2건)이 07-01로
// 채워져 39일령(coverage 기준)으로 계산됐고, reference 창(35일)을 넘겨 main·reference 어느
// 레인에도 남지 못했다. 수집(collect-news-candidates.js의 withinLookback)은 같은 후보를 달
// 범위 겹침으로 창 안이라 판단하는데 선정만 1일 기준 점으로 잘라내서 생긴 불일치였다.
// 나이는 그대로 보수적으로(달의 1일 기준) 재고, stale 탈락만 겹침으로 구제한다. 겹침 판정의
// 창 상한은 이제 실행일이 아니라 coverage 주의 끝(E)이다.
test('a month-level candidate whose month still overlaps the reference window is rescued from stale', () => {
  const metadata = freshnessWindowMetadata(candidate({
    title: 'AOSP Site Updates - Camera ITS tests',
    url: 'https://source.android.com/docs/compatibility/cts/camera-its-tests',
    published_date: '2026-07-01',
    datePrecision: 'month'
  }), '2026-08-10');

  assert.equal(metadata.days_since_published, 39, '나이는 달의 1일 기준으로, coverage 주 끝(E) 대비로 보수적으로 잰다');
  assert.equal(metadata.freshness_window, 'reference');
  assert.match(metadata.selection_window_reason, /month range still overlaps/);
});

// month 정밀도가 main 선정 창(primary/fallback)을 느슨하게 만들면 안 된다. 그 달의 실제
// 날짜(예: 말일)를 썼다면 더 가까운 창에 들어갈 법한 경우에도, 보수적으로 1일 기준으로 재서
// reference에 머무르는지 확인한다.
test('month-level date precision never upgrades a candidate into the main selection windows', () => {
  const metadata = freshnessWindowMetadata(candidate({
    title: 'AOSP Site Updates - July camera row',
    url: 'https://source.android.com/docs/whatsnew/site-updates#july',
    published_date: '2026-07-01',
    datePrecision: 'month'
  }), '2026-08-08');

  assert.equal(metadata.days_since_published, 32, '달 말일이 아니라 1일 기준으로 잰다');
  assert.equal(metadata.freshness_window, 'reference', 'main 창(primary/fallback)이 아니라 reference에 머문다');
});

test('a month-level candidate whose month no longer overlaps the reference window stays stale', () => {
  const metadata = freshnessWindowMetadata(candidate({
    title: 'AOSP Site Updates - stale month row',
    url: 'https://source.android.com/docs/whatsnew/site-updates#old',
    published_date: '2026-01-01',
    datePrecision: 'month'
  }), '2026-08-10');

  assert.equal(metadata.freshness_window, 'stale');
});

// stale에서 구제된 month 후보는 참고 섹션용 reference 후보로만 남아야 한다. catch-up 레인이
// 그걸 main 기사로 승격하면 '1일로 채워진 날짜'가 기사 날짜로 발행된다. 지금은
// catchUpPolicy.maxAgeDays == referenceContextDays라 승격이 불가능한데, 그 값 일치는
// 정책 파일에서 언제든 깨질 수 있으므로 계약을 테스트로 잠근다.
test('a rescued month-precision candidate never becomes a main article', () => {
  const monthRow = policyPrimaryCandidate(90, {
    title: 'AOSP Site Updates - July camera rows',
    url: 'https://source.android.com/docs/whatsnew/site-updates#july-camera',
    published_date: '2026-07-01',
    datePrecision: 'month',
    date_precision: 'month'
  });

  const report = buildShortlistReport('2026-08-10', { candidates: [monthRow] }, {
    exposureHistory: { articles: [] },
    catchUpPolicy: {
      enabled: true,
      maxCatchUpArticles: 2,
      maxReleaseClassArticles: 1,
      maxAgeDays: 90,
      targetMainArticles: 3,
      eligibleBuckets: [articlePolicy.primaryCameraStack.buckets[0]],
      activationMode: 'fill_open_slots'
    }
  });

  const urls = [
    ...(report.selected_articles || []),
    ...(report.catch_up_articles || [])
  ].map(item => item.url);

  assert.ok(
    !urls.includes('https://source.android.com/docs/whatsnew/site-updates#july-camera'),
    'stale 구제는 참고 레인까지만이다 — main·catch-up 승격은 없다'
  );
});

test('day-precision candidates keep exact-day aging and are not rescued', () => {
  const metadata = freshnessWindowMetadata(candidate({
    title: 'Exact dated release note',
    url: 'https://example.com/exact-aging',
    published_date: '2026-07-01'
  }), '2026-08-10');

  assert.equal(metadata.days_since_published, 39);
  assert.equal(metadata.freshness_window, 'stale');
});

test('freshness window metadata maps candidate age without changing freshness score semantics', () => {
  const cases = [
    ['2026-08-16', 'primary', 0],
    ['2026-08-10', 'primary', 6],
    ['2026-08-09', 'fallback', 7],
    ['2026-07-27', 'fallback', 20],
    ['2026-07-26', 'reference', 21],
    ['2026-07-13', 'reference', 34],
    ['2026-07-12', 'stale', 35],
    ['2026-01-10', 'stale', 218]
  ];

  for (const [published_date, expectedWindow, expectedAge] of cases) {
    const metadata = freshnessWindowMetadata(candidate({
      title: `Camera freshness ${expectedWindow} ${expectedAge}`,
      url: `https://example.com/freshness-${expectedAge}`,
      published_date
    }), '2026-08-19');
    assert.equal(metadata.freshness_window, expectedWindow);
    assert.equal(metadata.days_since_published, expectedAge);
    if (expectedWindow === 'primary') {
      assert.match(metadata.selection_window_reason, /within coverage week 2026-W33/);
    } else if (expectedWindow === 'stale') {
      assert.match(metadata.selection_window_reason, /older than coverage week 2026-W33.*reference window/);
    } else {
      assert.match(metadata.selection_window_reason, new RegExp(`${expectedAge} day\\(s\\) before coverage week 2026-W33`));
    }
  }

  const unknown = freshnessWindowMetadata({
    title: 'Camera freshness missing date',
    url: 'https://example.com/freshness-missing'
  }, '2026-08-19');
  assert.equal(unknown.freshness_window, 'unknown');
  assert.equal(unknown.days_since_published, null);

  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, { published_date: '2026-08-14' }),
    policyPrimaryCandidate(1, { published_date: '2026-08-05' }),
    policyPrimaryCandidate(2, { published_date: '2026-01-10' })
  ], { minArticles: 1 });

  assert.equal(report.selection_policy.selection_window_policy.enforcement, 'main_selection_enforced');
  assert.equal(report.selection_policy.selection_window_policy.primarySelectionDays, 7);
  assert.ok(report.shortlisted_candidates.every(item => item.freshness_window));
  assert.ok(report.selected_articles.every(item => item.days_since_published !== undefined));
});

// coverage 주가 끝난 뒤(E 이후)에 발행된 후보는 '아직 오지 않은 다음 주 신호'다. 오래된 게
// 아니므로 stale이 아니라 별도 등급 not_yet_eligible로 분류되고, 참고 섹션에도 main
// shortlist에도 들어가지 않는다 — 대신 진단 카운트(not_yet_eligible_count)로만 남는다.
test('a candidate published after the coverage week ends is not_yet_eligible and excluded from the shortlist', () => {
  const metadata = freshnessWindowMetadata(candidate({
    title: 'Just-published candidate ahead of coverage week',
    url: 'https://example.com/not-yet-eligible-metadata',
    published_date: '2026-08-17T08:00:00Z'
  }), '2026-08-17');
  assert.equal(metadata.freshness_window, 'not_yet_eligible');
  assert.ok(metadata.days_since_published < 0);

  const report = buildShortlistReport('2026-08-17', [
    policyPrimaryCandidate(0, {
      title: 'Just-published candidate ahead of coverage week',
      url: 'https://example.com/not-yet-eligible-shortlist',
      published_date: '2026-08-17T08:00:00Z'
    })
  ], { minArticles: 1, catchUpPolicy: { enabled: false } });

  assert.equal(
    report.shortlisted_candidates.some(item => item.url === 'https://example.com/not-yet-eligible-shortlist'),
    false
  );
  assert.equal(
    report.selected_articles.some(item => item.url === 'https://example.com/not-yet-eligible-shortlist'),
    false
  );
  assert.equal(report.not_yet_eligible_count, 1);
});

// 창 등급은 실행 요일이 아니라 coverage 주(고정된 월요일~일요일)로만 갈린다. 수요일에
// 실행하든 어느 요일에 실행하든, 같은 coverage 주 안의 기사는 그대로 primary다 — 기존
// rolling 계산이면 실행일 기준 9일 전이라 fallback으로 떨어졌을 케이스다.
test('a candidate inside the coverage week is primary regardless of the weekday the run happens on', () => {
  const metadata = freshnessWindowMetadata(candidate({
    title: 'Camera driver update inside coverage week',
    url: 'https://example.com/coverage-week-primary',
    published_date: '2026-08-10'
  }), '2026-08-19');
  assert.equal(metadata.freshness_window, 'primary');
});

// freshnessScore도 같은 coverage 앵커를 쓴다. 실행일 2026-08-17 기준 rolling 나이였다면
// 7일(경계)이었을 기사가, coverage 앵커(2026-W33 종료일 2026-08-16)로는 6일이라 만점(3점)
// 계단에 그대로 남는다.
test('freshness score is anchored to the coverage week, not the run day', () => {
  const score = scoreCandidate(candidate({
    title: 'Camera driver update anchored to coverage week',
    url: 'https://example.com/coverage-week-freshness-score',
    published_date: '2026-08-10'
  }), '2026-08-17').freshness_score;
  assert.equal(score, 3);
});

// coverage 정합의 전제: 후보를 아직 창(freshness_window)으로 decorate하지 않았는데 anchor도
// 없으면, 예전처럼 조용히 오늘로 폴백해 실행 요일에 따라 다른 창으로 mislabel되게 두지 않고
// throw한다. override(coverageWeekKeyOverride)가 있으면 anchor 없이도 통과한다.
test('selectFinalArticlesWithDiagnostics throws when the coverage anchor is missing for undecorated candidates', () => {
  const undecorated = [candidate({
    title: 'Undecorated candidate missing an anchor',
    url: 'https://example.com/missing-anchor'
  })];

  assert.throws(() => selectFinalArticlesWithDiagnostics(undecorated, {}), /coverage anchor/);
  assert.doesNotThrow(() => selectFinalArticlesWithDiagnostics(undecorated, { date: '2026-08-19' }));
  assert.doesNotThrow(() => selectFinalArticlesWithDiagnostics(undecorated, { coverageWeekKeyOverride: '2026-W33' }));
});

test('selection window enforcement keeps fallback out when primary window is sufficient', () => {
  const primaryTitles = [
    ['CameraX stream metadata compatibility source', 'CameraX stream metadata'],
    ['AOSP Camera ITS validation source', 'Camera ITS validation'],
    ['libcamera image pipeline driver source', 'libcamera image pipeline']
  ];
  const primaryCandidates = Array.from({ length: FALLBACK_WINDOW_TEST_MIN_ARTICLES }, (_, index) =>
    policyPrimaryCandidate(index, {
      title: primaryTitles[index][0],
      url: `https://example.com/window-primary-${index}`,
      source: `Primary Window Source ${index}`,
      api_or_component: primaryTitles[index][1],
      published_date: '2026-08-14',
      camera_hal_relevance_score: 60 - index
    })
  );
  const fallbackCandidate = policyPrimaryCandidate(99, {
    title: 'Fallback window high score candidate',
    url: 'https://example.com/window-fallback-high',
    source: 'Fallback Window Source',
    published_date: '2026-08-05',
    camera_hal_relevance_score: 100
  });

  const report = buildShortlistReport('2026-08-19', [
    fallbackCandidate,
    ...primaryCandidates
  ], { minArticles: FALLBACK_WINDOW_TEST_MIN_ARTICLES });

  assert.equal(report.selection_policy.selection_window_policy.enforcement, 'main_selection_enforced');
  assert.equal(report.primary_window_selected_count, FALLBACK_WINDOW_TEST_MIN_ARTICLES);
  assert.equal(report.fallback_window_candidate_count, 1);
  assert.equal(report.fallback_window_consulted, false);
  assert.equal(report.fallback_window_used, false);
  assert.equal(report.fallback_window_reason, '');
  assert.equal(
    report.selected_articles.some(item => item.url === 'https://example.com/window-fallback-high'),
    false
  );
  assert.deepEqual(
    report.selected_articles.map(item => item.freshness_window),
    Array(FALLBACK_WINDOW_TEST_MIN_ARTICLES).fill('primary')
  );
});

test('selection window enforcement promotes fallback only when primary window is short', () => {
  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, {
      title: 'Only primary window camera source',
      url: 'https://example.com/window-primary-only',
      source: 'Primary Shortage Source',
      published_date: '2026-08-14'
    }),
    policySupportingCandidate(0, {
      title: 'Fallback window SoC support source',
      url: 'https://example.com/window-fallback-soc',
      source: 'Fallback SoC Source',
      published_date: '2026-08-05',
      relevance_bucket: 'soc_platform_signal',
      soc_platform_relevance: 5,
      native_tooling_relevance: 0,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false
    }),
    policySupportingCandidate(1, {
      title: 'Fallback window native workflow source',
      url: 'https://example.com/window-fallback-native',
      source: 'Fallback Native Source',
      published_date: '2026-08-05'
    })
  ], { minArticles: FALLBACK_WINDOW_TEST_MIN_ARTICLES });

  const fallbackSelected = report.selected_articles.filter(item => item.freshness_window === 'fallback');

  assert.equal(report.primary_window_selected_count, 1);
  assert.equal(report.fallback_window_candidate_count, 2);
  assert.equal(report.fallback_window_consulted, true);
  assert.equal(report.fallback_window_used, true);
  assert.match(report.fallback_window_reason, new RegExp(`primary window selected 1 article\\(s\\), below min ${FALLBACK_WINDOW_TEST_MIN_ARTICLES}`));
  assert.equal(fallbackSelected.length, 2);
  assert.ok(fallbackSelected.every(item => item.fallback_window_promoted === true));
  assert.ok(fallbackSelected.every(item => item.selection_window_stage === 'fallback'));
  assert.equal(report.fallback_candidates_promoted.length, 2);
  assert.deepEqual(report.selection_warnings, []);
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.ok(report.publish_gate_reason_codes.includes('publish_ready_supporting_main_over_limit'));
});

test('fallback rescue uses uncapped selection pool when primary fills shortlist cap', () => {
  const { SHORTLIST_CAP } = require('../../../generator/select/newsroom-selection');
  const fillerTitles = [
    'Primary filler build queue note',
    'Primary filler lab device note',
    'Primary filler issue triage note',
    'Primary filler dashboard status',
    'Primary filler checklist update',
    'Primary filler release calendar',
    'Primary filler owner rotation',
    'Primary filler sample log',
    'Primary filler meeting digest',
    'Primary filler config reminder',
    'Primary filler dependency memo',
    'Primary filler tracking bulletin'
  ];
  const primaryFillers = Array.from({ length: SHORTLIST_CAP }, (_, index) =>
    policyPrimaryCandidate(index + 10, {
      title: fillerTitles[index],
      url: `https://example.com/window-primary-filler-${index}`,
      source: `Primary Filler Source ${index}`,
      summary: 'Low signal camera logistics note without concrete component evidence.',
      api_or_component: '',
      behavior_change: '',
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: false,
      camera_hal_relevance_score: 0,
      evidence_score: 0,
      practical_actionability_score: 0,
      reliability: '',
      published_date: '2026-08-14'
    })
  );
  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, {
      title: 'Primary selected source before cap boundary',
      url: 'https://example.com/window-primary-selected-before-cap',
      source: 'Primary Selected Source',
      published_date: '2026-08-14'
    }),
    ...primaryFillers,
    policySupportingCandidate(0, {
      title: 'Fallback rescue SoC source after cap boundary',
      url: 'https://example.com/window-fallback-rescue-soc',
      source: 'Fallback Rescue SoC Source',
      published_date: '2026-08-05',
      relevance_bucket: 'soc_platform_signal',
      soc_platform_relevance: 5,
      native_tooling_relevance: 0,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false
    }),
    policySupportingCandidate(1, {
      title: 'LLVM debugger workflow candidate beyond shortlist',
      url: 'https://example.com/window-fallback-rescue-native',
      source: 'Fallback Rescue Native Source',
      summary: 'LLDB native debugger workflow improves camera HAL triage and validation.',
      api_or_component: 'LLDB camera HAL debugger',
      published_date: '2026-08-05'
    })
  ], { minArticles: FALLBACK_WINDOW_TEST_MIN_ARTICLES });
  const selectedUrls = new Set(report.selected_articles.map(item => item.url));
  const shortlistedUrls = new Set(report.shortlisted_candidates.map(item => item.url));

  assert.ok(report.primary_window_candidate_count > SHORTLIST_CAP);
  assert.equal(report.fallback_window_candidate_count, 2);
  assert.equal(report.fallback_window_consulted, true);
  assert.equal(report.fallback_window_used, true);
  assert.equal(report.fallback_candidates_promoted.length, 2);
  assert.equal(selectedUrls.has('https://example.com/window-fallback-rescue-soc'), true);
  assert.equal(selectedUrls.has('https://example.com/window-fallback-rescue-native'), true);
  assert.equal(shortlistedUrls.has('https://example.com/window-fallback-rescue-soc'), true);
  assert.equal(shortlistedUrls.has('https://example.com/window-fallback-rescue-native'), true);
});

test('fallback consulted remains distinct from fallback promotion', () => {
  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, {
      title: 'Primary short source before ineligible fallback',
      url: 'https://example.com/window-primary-before-ineligible-fallback',
      source: 'Primary Before Ineligible Fallback Source',
      published_date: '2026-08-14'
    }),
    candidate({
      title: 'Fallback ineligible generic source A',
      url: 'https://example.com/window-fallback-ineligible-a',
      source: 'Fallback Ineligible Source A',
      summary: 'Generic low signal workflow note.',
      api_or_component: '',
      behavior_change: '',
      relevance_bucket: 'cpp_ai_tooling_fallback',
      editorial_priority: 6,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_fallback_topic: false,
      camera_hal_relevance_score: 0,
      evidence_score: 0,
      practical_actionability_score: 0,
      reliability: '',
      published_date: '2026-08-05'
    }),
    candidate({
      title: 'Fallback ineligible generic source B',
      url: 'https://example.com/window-fallback-ineligible-b',
      source: 'Fallback Ineligible Source B',
      summary: 'Another generic low signal workflow note.',
      api_or_component: '',
      behavior_change: '',
      relevance_bucket: 'cpp_ai_tooling_fallback',
      editorial_priority: 6,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_fallback_topic: false,
      camera_hal_relevance_score: 0,
      evidence_score: 0,
      practical_actionability_score: 0,
      reliability: '',
      published_date: '2026-08-05'
    })
  ], { minArticles: FALLBACK_WINDOW_TEST_MIN_ARTICLES });

  assert.equal(report.primary_window_selected_count, 1);
  assert.equal(report.fallback_window_candidate_count, 2);
  assert.equal(report.fallback_window_consulted, true);
  assert.equal(report.fallback_window_used, false);
  assert.deepEqual(report.fallback_candidates_promoted, []);
  assert.equal(report.selected_articles.some(item => item.freshness_window === 'fallback'), false);
});

test('selection window enforcement excludes reference stale and unknown candidates without dropping existing reasons', () => {
  const candidateBase = {
    summary: 'Policy source changes validation behavior for device bring-up.',
    api_or_component: 'Device validation component',
    behavior_change: 'Release changes validation behavior.',
    evidence_score: 5,
    practical_actionability_score: 5,
    reliability: 'official'
  };
  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, {
      ...candidateBase,
      title: 'Primary low deterministic source',
      url: 'https://example.com/metadata-primary-low',
      published_date: '2026-08-14',
      camera_hal_relevance_score: 40
    }),
    policyPrimaryCandidate(1, {
      ...candidateBase,
      title: 'Stale high deterministic source',
      url: 'https://example.com/metadata-stale-high',
      published_date: '2026-01-10',
      camera_hal_relevance_score: 100,
      source_gap_risk: true
    }),
    policyPrimaryCandidate(2, {
      ...candidateBase,
      title: 'Reference medium deterministic source',
      url: 'https://example.com/metadata-reference-medium',
      published_date: '2026-07-20',
      camera_hal_relevance_score: 80
    }),
    policyPrimaryCandidate(3, {
      ...candidateBase,
      title: 'Unknown date high deterministic source',
      url: 'https://example.com/metadata-unknown-high',
      published_date: 'not-a-date',
      camera_hal_relevance_score: 90
    })
  ], { minArticles: 1, catchUpPolicy: { enabled: false } });
  const selectedUrls = new Set(report.selected_articles.map(item => item.url));
  const reserveUrls = new Set(report.reserve_candidates.map(item => item.url));
  const excludedByUrl = new Map(report.excluded_candidates.map(item => [item.url, item]));

  assert.equal(selectedUrls.has('https://example.com/metadata-primary-low'), true);
  assert.equal(selectedUrls.has('https://example.com/metadata-reference-medium'), false);
  assert.equal(selectedUrls.has('https://example.com/metadata-stale-high'), false);
  assert.equal(selectedUrls.has('https://example.com/metadata-unknown-high'), false);
  assert.equal(reserveUrls.has('https://example.com/metadata-reference-medium'), false);
  assert.equal(reserveUrls.has('https://example.com/metadata-stale-high'), false);
  assert.equal(reserveUrls.has('https://example.com/metadata-unknown-high'), false);
  assert.deepEqual(
    report.reference_context_candidates.map(item => item.url),
    ['https://example.com/metadata-reference-medium']
  );
  assert.ok(excludedByUrl.get('https://example.com/metadata-reference-medium').exclusion_reasons.includes('selection_window=reference_not_main'));
  assert.ok(excludedByUrl.get('https://example.com/metadata-stale-high').exclusion_reasons.includes('source_gap_risk=true'));
  assert.ok(excludedByUrl.get('https://example.com/metadata-stale-high').exclusion_reasons.includes('selection_window=stale_not_main'));
  assert.ok(excludedByUrl.get('https://example.com/metadata-unknown-high').exclusion_reasons.includes('selection_window=unknown_not_main'));
  assert.deepEqual(report.selection_window_exclusion_summary, [
    { reason: 'reference_not_main', count: 1 },
    { reason: 'stale_not_main', count: 1 },
    { reason: 'unknown_not_main', count: 1 }
  ]);
});

test('fallback reserve is marked when primary reserve is short', () => {
  const report = buildShortlistReport('2026-08-19', [
    ...Array.from({ length: articlePolicy.mainArticleCount.min }, (_, index) =>
      policyPrimaryCandidate(index, {
        title: [
          'Reserve CameraX metadata source',
          'Reserve AOSP Camera validation source',
          'Reserve libcamera driver source'
        ][index],
        url: `https://example.com/reserve-primary-${index}`,
        source: `Reserve Primary Source ${index}`,
        published_date: '2026-08-14'
      })
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      policySupportingCandidate(index, {
        title: [
          'Reserve fallback SoC thermal source',
          'Reserve fallback native debugger source',
          'Reserve fallback toolchain sanitizer source',
          'Reserve fallback build workflow source'
        ][index],
        url: `https://example.com/reserve-fallback-${index}`,
        source: `Reserve Fallback Source ${index}`,
        published_date: '2026-08-05'
      })
    )
  ], { maxArticles: articlePolicy.mainArticleCount.min });

  const fallbackReserve = report.reserve_candidates.filter(item => item.fallback_window_reserve === true);

  assert.equal(report.fallback_window_used, false);
  assert.equal(report.fallback_window_consulted, false);
  assert.ok(fallbackReserve.length > 0);
  assert.ok(fallbackReserve.every(item => item.selection_window_stage === 'fallback_reserve'));
  assert.ok(fallbackReserve.every(item => item.freshness_window === 'fallback'));
});

// selectionWindowPolicy.fallbackSelectionDays/referenceContextDays는 fallback/reference 경계로
// classifyCoverageWindow에 그대로 전달된다(리뷰 fix 1) — primarySelectionDays만 예외다. coverage
// 주 자체가 ISO 주(7일) 고정이라 primary 경계(0~6일)는 어떤 정책값으로도 못 바꾼다.
test('custom selection window policy narrows fallback classification via coverage age boundaries', () => {
  const customPolicy = {
    primarySelectionDays: 3,
    fallbackSelectionDays: 10,
    referenceContextDays: 30
  };
  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, {
      title: 'Custom policy primary source',
      url: 'https://example.com/custom-policy-primary',
      source: 'Custom Primary Source',
      published_date: '2026-08-14'
    }),
    policySupportingCandidate(0, {
      title: 'Custom policy coverage fallback source A',
      url: 'https://example.com/custom-policy-fallback-within',
      source: 'Custom Fallback Within Source',
      published_date: '2026-08-08'
    }),
    policySupportingCandidate(1, {
      title: 'Custom policy native debugger fallback source',
      url: 'https://example.com/custom-policy-fallback-beyond',
      source: 'Custom Fallback Beyond Source',
      summary: 'Native debugger workflow improves camera HAL validation triage.',
      api_or_component: 'LLDB camera HAL debugger',
      published_date: '2026-08-05'
    })
  ], { selectionWindowPolicy: customPolicy, minArticles: FALLBACK_WINDOW_TEST_MIN_ARTICLES });

  const fallbackUrls = new Set(report.selected_articles
    .filter(item => item.freshness_window === 'fallback')
    .map(item => item.url));

  assert.equal(report.selection_policy.selection_window_policy.primarySelectionDays, 3);
  assert.equal(report.fallback_window_consulted, true);
  // 8일령은 customFallbackDays(10)의 fallback 구간(7~9일) 안이라 그대로 fallback 승격된다.
  assert.equal(fallbackUrls.has('https://example.com/custom-policy-fallback-within'), true);
  // 11일령은 기본 정책(21일)이면 fallback이었을 나이지만, customFallbackDays(10)로 좁히면
  // fallback 구간(7~9일)을 벗어나 reference로 떨어져 main 선정 밖으로 나간다 — 노브가 실제로
  // 분류를 좁힌다는 것을 보여준다.
  assert.equal(fallbackUrls.has('https://example.com/custom-policy-fallback-beyond'), false);
  assert.equal(
    report.reference_context_candidates.some(item => item.url === 'https://example.com/custom-policy-fallback-beyond'),
    true
  );
});

test('#124 acceptance: primary window official Camera candidate outranks fallback candidate', () => {
  const primaryFixtures = [
    ['AOSP Camera HAL API contract update', 'Camera HAL API'],
    ['CameraX stream metadata compatibility update', 'CameraX stream metadata'],
    ['libcamera image pipeline driver release', 'libcamera image pipeline']
  ];
  const primaryCandidates = primaryFixtures.map(([title, component], index) =>
    policyPrimaryCandidate(index, {
      title,
      url: `https://example.com/124-primary-official-${index}`,
      source: 'Android Camera Official Source',
      api_or_component: component,
      behavior_change: `${component} behavior changed.`,
      reliability: 'official',
      published_date: '2026-08-14',
      camera_hal_relevance_score: 50 - index
    })
  );
  const fallbackCandidate = policyPrimaryCandidate(99, {
    title: 'Older fallback official Camera source with higher score',
    url: 'https://example.com/124-fallback-high-score',
    source: 'Android Camera Official Source',
    reliability: 'official',
    published_date: '2026-08-05',
    camera_hal_relevance_score: 100
  });

  const report = buildShortlistReport('2026-08-19', [
    fallbackCandidate,
    ...primaryCandidates
  ], { minArticles: FALLBACK_WINDOW_TEST_MIN_ARTICLES });

  assert.equal(report.primary_window_selected_count, FALLBACK_WINDOW_TEST_MIN_ARTICLES);
  assert.equal(report.fallback_window_candidate_count, 1);
  assert.equal(report.fallback_window_consulted, false);
  assert.equal(report.fallback_window_used, false);
  assert.equal(report.selected_articles.some(item => item.url === fallbackCandidate.url), false);
  assert.deepEqual(
    report.selected_articles.map(item => item.freshness_window),
    Array(FALLBACK_WINDOW_TEST_MIN_ARTICLES).fill('primary')
  );
});

test('#124 acceptance: fallback window is promoted only when primary is short', () => {
  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, {
      title: 'Only current Camera source',
      url: 'https://example.com/124-current-only',
      source: 'Primary Camera Source',
      published_date: '2026-08-14'
    }),
    policyPrimaryCandidate(1, {
      title: 'Older Camera fallback source A',
      url: 'https://example.com/124-fallback-a',
      source: 'Fallback Camera Source A',
      published_date: '2026-08-05'
    }),
    policyPrimaryCandidate(2, {
      title: 'Older Camera fallback source B',
      url: 'https://example.com/124-fallback-b',
      source: 'Fallback Camera Source B',
      published_date: '2026-08-05'
    })
  ], { minArticles: FALLBACK_WINDOW_TEST_MIN_ARTICLES });

  assert.equal(report.primary_window_selected_count, 1);
  assert.equal(report.fallback_window_consulted, true);
  assert.equal(report.fallback_window_used, true);
  assert.match(report.fallback_window_reason, new RegExp(`primary window selected 1 article\\(s\\), below min ${FALLBACK_WINDOW_TEST_MIN_ARTICLES}`));
  assert.equal(report.fallback_candidates_promoted.length, 2);
  assert.equal(
    report.selected_articles.filter(item => item.freshness_window === 'fallback').length,
    2
  );
});

test('#124 acceptance: reference window remains context-only', () => {
  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, {
      title: 'Current Camera main source',
      url: 'https://example.com/124-reference-primary',
      published_date: '2026-08-14',
      camera_hal_relevance_score: 40
    }),
    policyPrimaryCandidate(1, {
      title: 'Reference window high score source',
      url: 'https://example.com/124-reference-context',
      published_date: '2026-07-20',
      camera_hal_relevance_score: 100
    })
  ], { minArticles: 1, catchUpPolicy: { enabled: false } });

  assert.equal(report.selected_articles.some(item => item.url === 'https://example.com/124-reference-context'), false);
  assert.equal(report.reserve_candidates.some(item => item.url === 'https://example.com/124-reference-context'), false);
  assert.deepEqual(
    report.reference_context_candidates.map(item => item.url),
    ['https://example.com/124-reference-context']
  );
  assert.ok(
    report.excluded_candidates
      .find(item => item.url === 'https://example.com/124-reference-context')
      .exclusion_reasons.includes('selection_window=reference_not_main')
  );
});

// 수집(01)/병합 단계가 후보 payload의 top-level에 실어 온 coverage lineage(대상 주·생성
// anchor·carry-forward 판정)는 buildShortlistReport를 거쳐 shortlistReport로 그대로
// 옮겨져야 한다 — generation-status·selection-report.json·PR 본문이 전부 이 값을 인용한다.
test('shortlist report carries the coverage lineage from the collected-candidates payload', () => {
  const report = buildShortlistReport('2026-08-19', {
    candidates: [],
    coverage: {
      coverage_week_key: '2026-W33',
      coverage_start_date: '2026-08-10',
      coverage_end_date: '2026-08-16'
    },
    generation_anchor_date: '2026-08-19',
    carry_forward_status: 'overflow',
    carry_source: { path: 'articles/content/newsroom/2026-08-12/merged-candidates.json', sha256: 'abc', run_mode: 'scheduled' },
    not_yet_eligible_overflow: true
  }, { minArticles: 1 });

  assert.equal(report.coverage_week_key, '2026-W33');
  assert.equal(report.coverage_start_date, '2026-08-10');
  assert.equal(report.coverage_end_date, '2026-08-16');
  assert.equal(report.generation_anchor_date, '2026-08-19');
  assert.equal(report.carry_forward_status, 'overflow');
  assert.deepEqual(report.carry_source, { path: 'articles/content/newsroom/2026-08-12/merged-candidates.json', sha256: 'abc', run_mode: 'scheduled' });
  assert.equal(report.not_yet_eligible_overflow, true);
});

// collectedCandidates가 후보 배열 그대로인 레거시/테스트 호출부(top-level 메타데이터가
// 애초에 없는 경우)에서는 coverage lineage가 조용히 빈 값으로 떨어져야 한다 — 존재하지
// 않는 payload 필드를 읽다가 throw하면 이 파일의 다른 테스트가 전부 깨진다.
test('shortlist report defaults coverage lineage to empty values when the payload carries none', () => {
  const report = buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0)
  ], { minArticles: 1, catchUpPolicy: { enabled: false } });

  assert.equal(report.coverage_week_key, '');
  assert.equal(report.coverage_start_date, '');
  assert.equal(report.coverage_end_date, '');
  assert.equal(report.generation_anchor_date, '');
  assert.equal(report.carry_forward_status, '');
  assert.equal(report.carry_source, null);
  assert.equal(report.not_yet_eligible_overflow, false);
});
