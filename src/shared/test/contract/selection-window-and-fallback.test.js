'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  freshnessWindowMetadata,
  scoreCandidate
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

test('month-level dated candidates do not receive exact-day freshness scoring', () => {
  const exact = scoreCandidate(candidate({
    title: 'Camera ITS exact release note',
    url: 'https://example.com/exact',
    published_date: '2026-05-01'
  }), '2026-05-03');
  const month = scoreCandidate(candidate({
    title: 'Camera ITS monthly site update',
    url: 'https://example.com/month',
    published_date: '2026-05-01',
    datePrecision: 'month'
  }), '2026-05-03');

  assert.equal(exact.freshness_score, 3);
  assert.equal(month.freshness_score, 1);
  assert.ok(month.total < exact.total);

  const monthWindow = freshnessWindowMetadata(candidate({
    title: 'Camera ITS monthly site update',
    url: 'https://example.com/month-window',
    published_date: '2026-05-01',
    datePrecision: 'month'
  }), '2026-05-03');
  assert.match(monthWindow.selection_window_reason, /month-level date precision/);
});

test('freshness window metadata maps candidate age without changing freshness score semantics', () => {
  const cases = [
    ['2026-05-07', 'primary', 3],
    ['2026-05-03', 'primary', 7],
    ['2026-04-26', 'fallback', 14],
    ['2026-04-19', 'fallback', 21],
    ['2026-04-12', 'reference', 28],
    ['2026-04-05', 'reference', 35],
    ['2026-03-11', 'stale', 60],
    ['2026-01-10', 'stale', 120]
  ];

  for (const [published_date, expectedWindow, expectedAge] of cases) {
    const metadata = freshnessWindowMetadata(candidate({
      title: `Camera freshness ${expectedWindow} ${expectedAge}`,
      url: `https://example.com/freshness-${expectedAge}`,
      published_date
    }), '2026-05-10');
    assert.equal(metadata.freshness_window, expectedWindow);
    assert.equal(metadata.days_since_published, expectedAge);
    assert.match(metadata.selection_window_reason, new RegExp(`${expectedAge} day\\(s\\) since published`));
  }

  const unknown = freshnessWindowMetadata({
    title: 'Camera freshness missing date',
    url: 'https://example.com/freshness-missing'
  }, '2026-05-10');
  assert.equal(unknown.freshness_window, 'unknown');
  assert.equal(unknown.days_since_published, null);

  const futureCandidate = candidate({
    title: 'Camera future dated metadata-only source',
    url: 'https://example.com/freshness-future',
    published_date: '2026-05-15'
  });
  const future = freshnessWindowMetadata(futureCandidate, '2026-05-10');
  assert.equal(future.freshness_window, 'primary');
  assert.equal(future.days_since_published, 0);
  assert.equal(scoreCandidate(futureCandidate, '2026-05-10').freshness_score, 3);

  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, { published_date: '2026-05-07' }),
    policyPrimaryCandidate(1, { published_date: '2026-04-26' }),
    policyPrimaryCandidate(2, { published_date: '2026-03-11' })
  ], { minArticles: 1 });

  assert.equal(report.selection_policy.selection_window_policy.enforcement, 'main_selection_enforced');
  assert.equal(report.selection_policy.selection_window_policy.primarySelectionDays, 7);
  assert.ok(report.shortlisted_candidates.every(item => item.freshness_window));
  assert.ok(report.selected_articles.every(item => item.days_since_published !== undefined));
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
      published_date: '2026-05-09',
      camera_hal_relevance_score: 60 - index
    })
  );
  const fallbackCandidate = policyPrimaryCandidate(99, {
    title: 'Fallback window high score candidate',
    url: 'https://example.com/window-fallback-high',
    source: 'Fallback Window Source',
    published_date: '2026-04-26',
    camera_hal_relevance_score: 100
  });

  const report = buildShortlistReport('2026-05-10', [
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
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Only primary window camera source',
      url: 'https://example.com/window-primary-only',
      source: 'Primary Shortage Source',
      published_date: '2026-05-09'
    }),
    policySupportingCandidate(0, {
      title: 'Fallback window SoC support source',
      url: 'https://example.com/window-fallback-soc',
      source: 'Fallback SoC Source',
      published_date: '2026-04-26',
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
      published_date: '2026-04-26'
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
      published_date: '2026-05-09'
    })
  );
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Primary selected source before cap boundary',
      url: 'https://example.com/window-primary-selected-before-cap',
      source: 'Primary Selected Source',
      published_date: '2026-05-09'
    }),
    ...primaryFillers,
    policySupportingCandidate(0, {
      title: 'Fallback rescue SoC source after cap boundary',
      url: 'https://example.com/window-fallback-rescue-soc',
      source: 'Fallback Rescue SoC Source',
      published_date: '2026-04-26',
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
      published_date: '2026-04-26'
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
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Primary short source before ineligible fallback',
      url: 'https://example.com/window-primary-before-ineligible-fallback',
      source: 'Primary Before Ineligible Fallback Source',
      published_date: '2026-05-09'
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
      published_date: '2026-04-26'
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
      published_date: '2026-04-26'
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
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      ...candidateBase,
      title: 'Primary low deterministic source',
      url: 'https://example.com/metadata-primary-low',
      published_date: '2026-05-09',
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
      published_date: '2026-04-12',
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
  const report = buildShortlistReport('2026-05-10', [
    ...Array.from({ length: articlePolicy.mainArticleCount.min }, (_, index) =>
      policyPrimaryCandidate(index, {
        title: [
          'Reserve CameraX metadata source',
          'Reserve AOSP Camera validation source',
          'Reserve libcamera driver source'
        ][index],
        url: `https://example.com/reserve-primary-${index}`,
        source: `Reserve Primary Source ${index}`,
        published_date: '2026-05-09'
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
        published_date: '2026-04-26'
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

test('custom selection window policy drives fallback classification and promotion', () => {
  const customPolicy = {
    primarySelectionDays: 3,
    fallbackSelectionDays: 10,
    referenceContextDays: 30
  };
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Custom policy primary source',
      url: 'https://example.com/custom-policy-primary',
      source: 'Custom Primary Source',
      published_date: '2026-05-09'
    }),
    policySupportingCandidate(0, {
      title: 'Custom policy seven day fallback source A',
      url: 'https://example.com/custom-policy-fallback-a',
      source: 'Custom Fallback Source A',
      published_date: '2026-05-03'
    }),
    policySupportingCandidate(1, {
      title: 'Custom policy native debugger fallback source',
      url: 'https://example.com/custom-policy-fallback-b',
      source: 'Custom Fallback Source B',
      summary: 'Native debugger workflow improves camera HAL validation triage.',
      api_or_component: 'LLDB camera HAL debugger',
      published_date: '2026-05-03'
    })
  ], { selectionWindowPolicy: customPolicy, minArticles: FALLBACK_WINDOW_TEST_MIN_ARTICLES });

  const fallbackUrls = new Set(report.selected_articles
    .filter(item => item.freshness_window === 'fallback')
    .map(item => item.url));

  assert.equal(report.selection_policy.selection_window_policy.primarySelectionDays, 3);
  assert.equal(report.fallback_window_consulted, true);
  assert.equal(report.fallback_window_used, true);
  assert.equal(fallbackUrls.has('https://example.com/custom-policy-fallback-a'), true);
  assert.equal(fallbackUrls.has('https://example.com/custom-policy-fallback-b'), true);
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
      published_date: '2026-05-09',
      camera_hal_relevance_score: 50 - index
    })
  );
  const fallbackCandidate = policyPrimaryCandidate(99, {
    title: 'Older fallback official Camera source with higher score',
    url: 'https://example.com/124-fallback-high-score',
    source: 'Android Camera Official Source',
    reliability: 'official',
    published_date: '2026-04-26',
    camera_hal_relevance_score: 100
  });

  const report = buildShortlistReport('2026-05-10', [
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
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Only current Camera source',
      url: 'https://example.com/124-current-only',
      source: 'Primary Camera Source',
      published_date: '2026-05-09'
    }),
    policyPrimaryCandidate(1, {
      title: 'Older Camera fallback source A',
      url: 'https://example.com/124-fallback-a',
      source: 'Fallback Camera Source A',
      published_date: '2026-04-26'
    }),
    policyPrimaryCandidate(2, {
      title: 'Older Camera fallback source B',
      url: 'https://example.com/124-fallback-b',
      source: 'Fallback Camera Source B',
      published_date: '2026-04-26'
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
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Current Camera main source',
      url: 'https://example.com/124-reference-primary',
      published_date: '2026-05-09',
      camera_hal_relevance_score: 40
    }),
    policyPrimaryCandidate(1, {
      title: 'Reference window high score source',
      url: 'https://example.com/124-reference-context',
      published_date: '2026-04-12',
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
