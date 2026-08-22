'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  LINKED_EVIDENCE_RUNTIME_BONUS,
  LINKED_EVIDENCE_WATCH_PENALTY,
  MAIN_ARTICLE_SCORE_THRESHOLD,
  reporterInputFromShortlist,
  scoreCandidate,
  selectFinalArticles
} = require('../../../generator/select/newsroom-selection');
const {
  articlePolicy
} = require('../../common/newsletter-policy');
const { candidate } = require('../helpers/newsroom-builders');
const {
  buildShortlistReport
} = require('../helpers/selection-builders');

function assertScoreComponentsUnchanged(actual, expected) {
  for (const key of [
    'camera_hal_directness',
    'scope_relevance',
    'editorial_priority',
    'relevance_bucket',
    'aosp_camera_directness',
    'driver_stack_relevance',
    'multimedia_camera_output_relevance',
    'soc_platform_relevance',
    'native_tooling_relevance',
    'evidence_specificity',
    'freshness_score',
    'practical_actionability',
    'optional_ai_cpp_bonus',
    'generic_ai_penalty',
    'watch_page_penalty',
    'no_date_penalty',
    'no_api_component_penalty',
    'source_gap_penalty',
    'generic_tech_watchlist_penalty',
    'penalty_total',
    'source_reliability',
    'freshness',
    'camera_hal_relevance',
    'android_camera_relevance',
    'ai_required_slot_fit',
    'cpp_fallback_value',
    'evidence_quality'
  ]) {
    assert.deepEqual(actual[key], expected[key], key);
  }
}

function linkedScoreCandidate(overrides = {}) {
  return candidate({
    title: 'Camera HAL stream buffer metadata update',
    url: 'https://example.com/linked-score',
    summary: 'Camera HAL stream buffer metadata update.',
    api_or_component: 'Camera HAL stream',
    behavior_change: 'Updates stream buffer metadata handling.',
    published_date: '2026-05-01',
    hasDatedEvidence: true,
    finalSelectionEligibility: 'main',
    reliability: 'official',
    relevance_bucket: articlePolicy.primaryCameraStack.buckets[0],
    editorial_priority: 1,
    aosp_camera_directness: 5,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: true,
    ...overrides
  });
}

function mainLinkedEvidence() {
  return {
    linked_evidence_summary: { total_count: 1 },
    impact_classification: {
      impact_type: 'runtime_behavior_change',
      hal_runtime_impact: true,
      camera_pipeline_impact: true,
      recommended_article_type: 'main',
      confidence: 0.75,
      reason: 'test fixture',
      warnings: []
    }
  };
}

function watchLinkedEvidence(impactType = 'build_dependency_fix') {
  return {
    linked_evidence_summary: { total_count: 1 },
    impact_classification: {
      impact_type: impactType,
      hal_runtime_impact: false,
      camera_pipeline_impact: false,
      recommended_article_type: 'watch',
      confidence: 0.45,
      reason: 'test fixture',
      warnings: []
    }
  };
}

test('linked evidence main hint adjusts total only', () => {
  const baseCandidate = linkedScoreCandidate();
  const base = scoreCandidate(baseCandidate, '2026-05-10');
  const linked = scoreCandidate({
    ...baseCandidate,
    ...mainLinkedEvidence()
  }, '2026-05-10');

  assert.equal(base.base_total, base.total);
  assert.equal(linked.base_total, base.base_total);
  assert.equal(linked.linked_evidence_runtime_bonus, LINKED_EVIDENCE_RUNTIME_BONUS);
  assert.equal(linked.linked_evidence_watch_penalty, 0);
  assert.equal(linked.linked_evidence_adjustment, LINKED_EVIDENCE_RUNTIME_BONUS);
  assert.equal(linked.total, base.total + LINKED_EVIDENCE_RUNTIME_BONUS);
  assertScoreComponentsUnchanged(linked, base);
});

test('linked evidence watch hint adjusts ordering total only without hard exclusion', () => {
  const baseCandidate = linkedScoreCandidate({
    title: 'Camera HAL stream buffer metadata watch',
    url: 'https://example.com/linked-score-watch'
  });
  const base = scoreCandidate(baseCandidate, '2026-05-10');
  const linked = scoreCandidate({
    ...baseCandidate,
    ...watchLinkedEvidence()
  }, '2026-05-10');
  const report = buildShortlistReport('2026-05-10', [
    linkedScoreCandidate({ title: 'AOSP Camera provider session configuration', url: 'https://example.com/linked-score-peer' }),
    { ...baseCandidate, ...watchLinkedEvidence() },
    linkedScoreCandidate({ title: 'Android Camera API capture request update', url: 'https://example.com/linked-score-c' }),
    linkedScoreCandidate({ title: 'Camera HAL result metadata validation', url: 'https://example.com/linked-score-d' })
  ]);
  const watchCandidate = report.shortlisted_candidates.find(item => item.url === baseCandidate.url);
  const peerCandidate = report.shortlisted_candidates.find(item => item.url === 'https://example.com/linked-score-peer');

  assert.equal(linked.base_total, base.base_total);
  assert.equal(linked.linked_evidence_runtime_bonus, 0);
  assert.equal(linked.linked_evidence_watch_penalty, LINKED_EVIDENCE_WATCH_PENALTY);
  assert.equal(linked.linked_evidence_adjustment, -LINKED_EVIDENCE_WATCH_PENALTY);
  assert.equal(linked.total, base.total - LINKED_EVIDENCE_WATCH_PENALTY);
  assertScoreComponentsUnchanged(linked, base);
  assert.equal(watchCandidate.main_article_score_eligible, true);
  assert.deepEqual(watchCandidate.exclusion_reasons, []);
  assert.equal(watchCandidate.score_filter_reasons.includes('linked_evidence_watch'), false);
  assert.ok(watchCandidate.deterministic_score < peerCandidate.deterministic_score);
});

test('linked evidence adjustment requires count and valid impact classification', () => {
  const baseCandidate = linkedScoreCandidate();
  const base = scoreCandidate(baseCandidate, '2026-05-10');
  const zeroCount = scoreCandidate({
    ...baseCandidate,
    linked_evidence_summary: { total_count: 0 },
    impact_classification: mainLinkedEvidence().impact_classification
  }, '2026-05-10');
  const missingImpact = scoreCandidate({
    ...baseCandidate,
    linked_evidence_summary: { total_count: 1 }
  }, '2026-05-10');
  const malformedImpact = scoreCandidate({
    ...baseCandidate,
    linked_evidence_summary: { total_count: 1 },
    impact_classification: 'main'
  }, '2026-05-10');

  for (const score of [zeroCount, missingImpact, malformedImpact]) {
    assert.equal(score.base_total, base.base_total);
    assert.equal(score.linked_evidence_runtime_bonus, 0);
    assert.equal(score.linked_evidence_watch_penalty, 0);
    assert.equal(score.linked_evidence_adjustment, 0);
    assert.equal(score.total, base.total);
  }
});

test('linked evidence adjustment does not change threshold eligibility', () => {
  let thresholdCandidate = null;
  for (let directness = 0; directness <= 2 && !thresholdCandidate; directness += 0.01) {
    const item = linkedScoreCandidate({
      title: `Threshold linked evidence candidate ${directness}`,
      url: `https://example.com/threshold-${directness.toFixed(2)}`,
      summary: 'Scoped release note for a workflow.',
      api_or_component: 'Lens stack',
      behavior_change: 'Behavior changed.',
      published_date: '2026-05-01',
      reliability: '',
      // 비-primaryCameraStack 버킷이라야 cameraHalDirectnessScore가 directness를 미세하게 반영한다
      // (강한 카메라 스택 버킷은 directness를 5로 보장하므로 base가 threshold 경계로 합성되지 않는다).
      relevance_bucket: 'soc_platform_signal',
      aosp_camera_directness: directness,
      camera_hal_relevance_score: 0,
      evidence_score: 2
    });
    const score = scoreCandidate({ ...item, ...mainLinkedEvidence() }, '2026-05-10');
    if (score.base_total < MAIN_ARTICLE_SCORE_THRESHOLD && score.total >= MAIN_ARTICLE_SCORE_THRESHOLD) {
      thresholdCandidate = item;
    }
  }
  assert.ok(thresholdCandidate, 'expected a synthetic candidate crossing threshold by linked evidence bonus');

  const report = buildShortlistReport('2026-05-10', [
    { ...thresholdCandidate, ...mainLinkedEvidence() }
  ], { minArticles: 1 });
  const [item] = report.shortlisted_candidates;

  assert.ok(item.score_breakdown.base_total < MAIN_ARTICLE_SCORE_THRESHOLD);
  assert.ok(item.deterministic_score >= MAIN_ARTICLE_SCORE_THRESHOLD);
  assert.equal(item.score_breakdown.total, item.deterministic_score);
  assert.equal(item.main_article_score_eligible, false);
  assert.ok(item.score_filter_reasons.includes(`base_total<${MAIN_ARTICLE_SCORE_THRESHOLD}`));
  assert.equal(item.score_filter_reasons.includes(`deterministic_score<${MAIN_ARTICLE_SCORE_THRESHOLD}`), false);
});

test('linked evidence bonus does not bypass exclusion contracts', () => {
  const items = [
    linkedScoreCandidate({ title: 'Missing dated linked evidence', url: 'https://example.com/excluded-date', published_date: '', hasDatedEvidence: false }),
    linkedScoreCandidate({ title: 'Source gap linked evidence', url: 'https://example.com/excluded-gap', source_gap_risk: true }),
    linkedScoreCandidate({ title: 'Watchlist linked evidence', url: 'https://example.com/excluded-watch', finalSelectionEligibility: 'watchlist' }),
    linkedScoreCandidate({ title: 'Main ineligible linked evidence', url: 'https://example.com/excluded-main', main_eligible: false })
  ].map(item => ({ ...item, ...mainLinkedEvidence() }));
  const report = buildShortlistReport('2026-05-10', items, { minArticles: 1 });
  const reasonsByUrl = new Map(report.excluded_candidates.map(item => [item.url, item.exclusion_reasons]));

  assert.ok(reasonsByUrl.get('https://example.com/excluded-date').includes('missing dated evidence'));
  assert.ok(reasonsByUrl.get('https://example.com/excluded-gap').includes('source_gap_risk=true'));
  assert.ok(reasonsByUrl.get('https://example.com/excluded-watch').includes('finalSelectionEligibility=watchlist'));
  assert.ok(reasonsByUrl.get('https://example.com/excluded-main').includes('main_eligible=false'));
  assert.equal(report.shortlisted_candidates.length, 0);
});

test('reporter input omits linked evidence diagnostics without changing order or selected flags', () => {
  const rawCandidates = [
    candidate({
      title: 'Camera HAL metadata update A',
      url: 'https://example.com/reporter-a',
      summary: 'Camera HAL metadata stream buffer update.',
      linked_evidence_summary: { total_count: 1 },
      impact_classification: { impact_type: 'runtime_behavior_change' },
      linked_evidence: [{ raw_excerpt: 'full linked evidence payload' }],
      raw_excerpt: 'raw linked evidence excerpt',
      resolved: { title: 'resolved linked evidence payload' }
    }),
    candidate({ title: 'AOSP Camera provider stream update B', url: 'https://example.com/reporter-b' }),
    candidate({ title: 'Android Camera API metadata update C', url: 'https://example.com/reporter-c' }),
    candidate({ title: 'Camera HAL buffer compatibility update D', url: 'https://example.com/reporter-d' })
  ];
  const report = buildShortlistReport('2026-05-10', rawCandidates);
  const selectedUrls = new Set(report.selected_articles.map(item => item.normalized_url));
  const input = reporterInputFromShortlist(report);

  assert.deepEqual(
    input.candidates.map(item => item.url),
    report.shortlisted_candidates.map(item => item.url)
  );
  assert.deepEqual(
    input.candidates.map(item => item.final_selected),
    report.shortlisted_candidates.map(item => selectedUrls.has(item.normalized_url))
  );
  assert.deepEqual(
    input.candidates.map(item => item.selected_for_editor),
    input.candidates.map(item => item.final_selected)
  );
  assert.deepEqual(
    input.candidates.map(item => item.candidate_id),
    report.shortlisted_candidates.map(item => item.source_candidate_hash || item.url_hash)
  );

  for (const item of input.candidates) {
    assert.equal(Object.hasOwn(item, 'linked_evidence_summary'), false);
    assert.equal(Object.hasOwn(item, 'impact_classification'), false);
    assert.equal(Object.hasOwn(item, 'linked_evidence'), false);
    assert.equal(Object.hasOwn(item, 'raw_excerpt'), false);
    assert.equal(Object.hasOwn(item, 'resolved'), false);
    assert.equal(Object.hasOwn(item.score_breakdown, 'base_total'), false);
    assert.equal(Object.hasOwn(item.score_breakdown, 'linked_evidence_runtime_bonus'), false);
    assert.equal(Object.hasOwn(item.score_breakdown, 'linked_evidence_watch_penalty'), false);
    assert.equal(Object.hasOwn(item.score_breakdown, 'linked_evidence_adjustment'), false);
  }
});

test('deterministic score ordering is stable and shortlist is capped', () => {
  const { SHORTLIST_CAP } = require('../../../generator/select/newsroom-selection');
  const items = Array.from({ length: 15 }, (_, index) => candidate({
    title: `CameraX release ${index} component ${String.fromCharCode(65 + index)}`,
    url: `https://example.com/release-${index}`,
    reliability: index % 2 === 0 ? 'official' : 'community',
    camera_hal_relevance_score: 100 - index
  }));
  const report = buildShortlistReport('2026-05-10', items);

  assert.equal(report.shortlisted_candidates.length, 12);
  assert.equal(report.shortlisted_candidates[0].title, 'CameraX release 0 component A');
  assert.ok(report.shortlisted_candidates[0].deterministic_score >= report.shortlisted_candidates[1].deterministic_score);
  assert.equal(report.deterministic_selected_count, report.selected_article_count);
  assert.equal(report.primary_selected_articles.length, report.selected_article_count);
  assert.ok(report.reserve_candidates.length >= 4);
  assert.ok(report.reserve_candidates.length <= 7);
  assert.ok(report.reserve_candidates.every(item => item.reserve_candidate === true));
  assert.ok(report.primary_selected_articles.every(item => item.primary_selected === true));
  assert.ok(report.shortlisted_candidates.every(item => item.score_breakdown.base_total === item.score_breakdown.total));
  assert.ok(report.shortlisted_candidates.every(item => item.score_breakdown.linked_evidence_adjustment === 0));
});

test('final selection prioritizes HAL candidates and treats AI/C++ as optional', () => {
  const shortlist = [
    candidate({ title: 'CameraX release A', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B', url: 'https://example.com/b' }),
    candidate({ title: 'Android Camera API change C', url: 'https://example.com/c' }),
    candidate({ title: 'Hybrid inference for Android camera apps', url: 'https://example.com/ai', summary: 'AI inference over image frames for Android camera workflows.' }),
    candidate({ title: 'C++ toolchain tip for HAL tests', url: 'https://example.com/cpp', summary: 'C++ compiler workflow for native Camera HAL test builds.', camera_hal_relevance_score: 45 })
  ];

  const selected = selectFinalArticles(shortlist);

  assert.ok(selected.length >= articlePolicy.mainArticleCount.min);
  assert.ok(selected.length <= articlePolicy.mainArticleCount.max);
  assert.ok(selected.every(item => item.camera_platform_candidate));
  assert.ok(selected.some(item => item.optional_ai_cpp_candidate));
});
