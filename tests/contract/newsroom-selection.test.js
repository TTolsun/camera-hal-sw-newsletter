const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildShortlistReport,
  compositionSummary,
  exclusionReasons,
  freshnessWindowMetadata,
  hasConcreteApiComponent,
  hasFallbackRelevanceHint,
  hasPlatformSignalTerm,
  LINKED_EVIDENCE_RUNTIME_BONUS,
  LINKED_EVIDENCE_WATCH_PENALTY,
  MAIN_ARTICLE_SCORE_THRESHOLD,
  SHORTLIST_CAP,
  normalizeUrl,
  publishGatePasses,
  publishReadyGateReasonCodes,
  reporterInputFromShortlist,
  scoreCandidate,
  selectFinalArticles,
  selectionErrors,
  summarizeExclusionReasons
} = require('../../scripts/lib/newsroom-selection');
const {
  articlePolicy,
  publishReadyCompositionPolicy
} = require('../../scripts/lib/newsletter-policy');
const { parseSourceSpecificItems } = require('../../scripts/lib/source-item-parsers');
const { normalizeCandidate } = require('../../scripts/newsroom/cli/collect-news-candidates');
const { candidate } = require('../helpers/newsroom-builders');
const { readJsonFixture, readTextFixture } = require('../helpers/fixture-loader');

function policyPrimaryCandidate(index = 0, overrides = {}) {
  return candidate({
    title: `CameraX policy primary release ${index}`,
    url: `https://example.com/policy-primary-${index}`,
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

function policySupportingCandidate(index = 0, overrides = {}) {
  const topics = [
    'LLVM sanitizer diagnostics',
    'Clang static analyzer',
    'LLDB native debugger',
    'CMake camera build pipeline',
    'libc++ concurrency update'
  ];
  const topic = topics[index % topics.length];
  return candidate({
    title: `${topic} policy supporting workflow`,
    url: `https://example.com/policy-supporting-${index}`,
    summary: `${topic} improves native C++ build and test productivity for camera workflow debugging.`,
    api_or_component: topic,
    behavior_change: 'Native debugging workflow behavior changed.',
    relevance_bucket: articlePolicy.supportingMainBuckets[1] || articlePolicy.supportingMainBuckets[0],
    editorial_priority: 5,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 5,
    counts_as_fallback_topic: true,
    camera_hal_relevance_score: 0,
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

function linkedScoreCandidate(overrides = {}) {
  return candidate({
    title: 'Camera HAL stream buffer metadata update',
    url: 'https://example.com/linked-score',
    summary: 'Camera HAL stream buffer metadata update.',
    api_or_component: 'Camera HAL stream',
    behavior_change: 'Updates stream buffer metadata handling.',
    published_date: '2026-05-03',
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

function cameraXSourceExtraction(version, bullet, overrides = {}) {
  return {
    adapter_id: 'android-developers-jetpack-release',
    source_type: 'release_note',
    source: {
      name: 'CameraX Release Notes',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera'
    },
    release: {
      version: `CameraX ${version}`,
      date: '2026-05-06',
      component: 'CameraX / androidx.camera',
      sections: [{
        category: 'bug_fixes',
        heading: 'Bug Fixes',
        items: [{
          text: bullet,
          source_text: bullet,
          links: [],
          issue_ids: [],
          artifact_names: ['androidx.camera:camera-core']
        }]
      }]
    },
    minor_line_context: null,
    extraction_quality: {
      has_concrete_behavior_change: true,
      used_fallback: false,
      raw_table_used_as_body: false,
      main_article_allowed: true,
      warnings: [],
      ...overrides.extraction_quality
    }
  };
}

function cameraXReleaseCandidate(version, overrides = {}) {
  const bullet = overrides.behavior_change || `Fixed CameraX ${version} compatibility behavior.`;
  const extraction = overrides.source_extraction || cameraXSourceExtraction(version, bullet);
  return candidate({
    title: `CameraX Release Notes - CameraX ${version}`,
    url: `https://developer.android.com/jetpack/androidx/releases/camera#${version}`,
    published_date: '2026-05-06',
    version_or_release: `CameraX ${version}`,
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: bullet,
    summary: bullet,
    relevance_bucket: 'android_platform_camera_adjacent',
    editorial_priority: 3,
    aosp_camera_directness: 2,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: true,
    source_extraction: extraction,
    extraction_quality: extraction.extraction_quality,
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      impact_claim_level_hint: 'android_framework_adjacent',
      hal_boundary: 'framework_adjacent_not_direct_hal_contract',
      validation_targets: ['Camera2 interop regression validation'],
      device_specific_notes: [],
      do_not_claim: ['Do not claim direct Camera HAL API changes.'],
      main_article_allowed_hint: true,
      warnings: []
    },
    ...overrides
  });
}

test('derived editorial do_not_claim text does not increase Camera HAL directness score', () => {
  const baseCandidate = candidate({
    title: 'CameraX Release Notes - CameraX 1.6.1',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    summary: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.',
    published_date: '2026-05-06',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.',
    relevance_bucket: 'android_platform_camera_adjacent',
    editorial_priority: 3,
    aosp_camera_directness: 2,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    camera_hal_relevance_score: 0,
    counts_as_primary_camera_topic: true,
    hasDatedEvidence: true,
    finalSelectionEligibility: 'main'
  });

  const base = scoreCandidate(baseCandidate, '2026-05-12');
  const withHints = scoreCandidate({
    ...baseCandidate,
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      hal_boundary: 'framework_adjacent_not_direct_hal_contract',
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  }, '2026-05-12');

  assert.equal(withHints.camera_hal_directness, base.camera_hal_directness);
  assert.equal(withHints.scope_relevance, base.scope_relevance);
  assert.equal(withHints.relevance_bucket, base.relevance_bucket);
});

test('derived editorial relevance bucket hint does not classify a generic candidate', () => {
  const baseCandidate = candidate({
    title: 'Generic platform release notes',
    url: 'https://example.com/platform-release-notes',
    summary: 'The release updates documentation, dashboards, and sorting behavior.',
    published_date: '2026-05-06',
    api_or_component: '',
    behavior_change: 'Documentation and dashboard sorting were updated.',
    camera_hal_relevance_score: 0,
    hasDatedEvidence: true,
    finalSelectionEligibility: 'main'
  });

  const base = scoreCandidate(baseCandidate, '2026-05-12');
  const withHints = scoreCandidate({
    ...baseCandidate,
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  }, '2026-05-12');

  assert.equal(base.relevance_bucket, 'generic_tech_watchlist');
  assert.equal(withHints.relevance_bucket, base.relevance_bucket);
  assert.equal(withHints.scope_relevance, base.scope_relevance);
});

test('CameraX release-note body candidate supersedes latest-updates discovery row for same version URL', () => {
  const versionUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const discoveryRow = candidate({
    title: 'CameraX 1.6.1 - Camera Maven Group versions',
    url: versionUrl,
    source: 'Android Developers Latest Updates',
    published_date: '2026-05-06',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'Fixed Camera2 interop behavior for CameraX apps.',
    summary: 'Fixed Camera2 interop behavior for CameraX apps.',
    relevance_bucket: 'android_platform_camera_adjacent',
    editorial_priority: 3,
    aosp_camera_directness: 2,
    counts_as_primary_camera_topic: true
  });
  const releaseBody = cameraXReleaseCandidate('1.6.1', {
    title: 'CameraX Release Notes - CameraX 1.6.1',
    behavior_change: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.'
  });

  const report = buildShortlistReport('2026-05-12', [discoveryRow, releaseBody], {
    minArticles: 1,
    maxArticles: 1
  });

  assert.equal(report.selected_articles.length, 1);
  assert.equal(report.selected_articles[0].title, 'CameraX Release Notes - CameraX 1.6.1');
  assert.ok(report.excluded_candidates.some(item =>
    item.title === discoveryRow.title &&
    item.exclusion_reasons.includes('duplicate CameraX release-note body candidate supersedes discovery row')
  ));
});

test('generic CameraX metadata fallback cannot become a main candidate without source_extraction bullet', () => {
  const generic = candidate({
    title: 'CameraX 1.6.1 - Camera Maven Group versions',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    source: 'Android Developers Latest Updates',
    published_date: '2026-05-06',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'CameraX / androidx.camera update.',
    summary: 'CameraX / androidx.camera update.',
    relevance_bucket: 'android_platform_camera_adjacent',
    editorial_priority: 3,
    aosp_camera_directness: 2,
    counts_as_primary_camera_topic: true
  });

  assert.ok(exclusionReasons(generic).includes('CameraX release-note candidate has no concrete source_extraction bullet'));
  const report = buildShortlistReport('2026-05-12', [generic], {
    minArticles: 1,
    maxArticles: 1
  });
  assert.equal(report.selected_articles.length, 0);
});

test('AndroidX Camera release page keeps one main article and prefers latest stable patch', () => {
  const patch = cameraXReleaseCandidate('1.6.1', {
    behavior_change: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.'
  });
  const minor = cameraXReleaseCandidate('1.6.0', {
    published_date: '2026-03-25',
    behavior_change: 'Added CameraPipe SessionConfig support for dynamic range handling.'
  });
  const beta = cameraXReleaseCandidate('1.7.0-alpha01', {
    behavior_change: 'Updated CameraX alpha API behavior for testing.'
  });

  const report = buildShortlistReport('2026-05-12', [minor, beta, patch], {
    minArticles: 1,
    maxArticles: 3
  });
  const selectedCameraReleases = report.selected_articles.filter(item =>
    item.url.startsWith('https://developer.android.com/jetpack/androidx/releases/camera')
  );

  assert.equal(selectedCameraReleases.length, 1);
  assert.equal(selectedCameraReleases[0].version_or_release, 'CameraX 1.6.1');
});

function assertScoreComponentsUnchanged(actual, expected) {
  for (const key of [
    'camera_hal_directness',
    'scope_relevance',
    'editorial_priority',
    'relevance_bucket',
    'aosp_camera_directness',
    'driver_stack_relevance',
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

test('prefilter excludes source gaps, undated watch pages, missing evidence, and duplicate URLs', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'Android Camera HAL release note', url: 'https://example.com/a' }),
    candidate({ title: 'Duplicate URL', url: 'https://example.com/a?utm=1' }),
    candidate({ title: 'Source gap', url: 'https://example.com/b', source_gap_risk: true }),
    candidate({ title: 'Watch page', url: 'https://example.com/c', isWatchPage: true, hasDatedEvidence: false, finalSelectionEligibility: 'watchlist' }),
    candidate({ title: 'Missing date', url: 'https://example.com/d', published_date: '', hasDatedEvidence: false })
  ], { minArticles: 1 });

  assert.equal(report.shortlisted_candidates.length, 1);
  assert.equal(report.shortlisted_candidates[0].title, 'Android Camera HAL release note');
  assert.deepEqual(
    report.excluded_candidates.map(item => item.exclusion_reasons[0]),
    ['duplicate URL or near-duplicate title', 'source_gap_risk=true', 'missing dated evidence', 'missing dated evidence']
  );
});

test('deterministic score ordering is stable and shortlist is capped', () => {
  const items = Array.from({ length: 15 }, (_, index) => candidate({
    title: `CameraX release ${index} component ${String.fromCharCode(65 + index)}`,
    url: `https://example.com/release-${index}`,
    reliability: index % 2 === 0 ? 'official' : 'community',
    camera_hal_relevance_score: 100 - index
  }));
  const report = buildShortlistReport('2026-05-03', items);

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

test('linked evidence main hint adjusts total only', () => {
  const baseCandidate = linkedScoreCandidate();
  const base = scoreCandidate(baseCandidate, '2026-05-03');
  const linked = scoreCandidate({
    ...baseCandidate,
    ...mainLinkedEvidence()
  }, '2026-05-03');

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
  const base = scoreCandidate(baseCandidate, '2026-05-03');
  const linked = scoreCandidate({
    ...baseCandidate,
    ...watchLinkedEvidence()
  }, '2026-05-03');
  const report = buildShortlistReport('2026-05-03', [
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
  const base = scoreCandidate(baseCandidate, '2026-05-03');
  const zeroCount = scoreCandidate({
    ...baseCandidate,
    linked_evidence_summary: { total_count: 0 },
    impact_classification: mainLinkedEvidence().impact_classification
  }, '2026-05-03');
  const missingImpact = scoreCandidate({
    ...baseCandidate,
    linked_evidence_summary: { total_count: 1 }
  }, '2026-05-03');
  const malformedImpact = scoreCandidate({
    ...baseCandidate,
    linked_evidence_summary: { total_count: 1 },
    impact_classification: 'main'
  }, '2026-05-03');

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
      aosp_camera_directness: directness,
      camera_hal_relevance_score: 0,
      evidence_score: 2
    });
    const score = scoreCandidate({ ...item, ...mainLinkedEvidence() }, '2026-05-03');
    if (score.base_total < MAIN_ARTICLE_SCORE_THRESHOLD && score.total >= MAIN_ARTICLE_SCORE_THRESHOLD) {
      thresholdCandidate = item;
    }
  }
  assert.ok(thresholdCandidate, 'expected a synthetic candidate crossing threshold by linked evidence bonus');

  const report = buildShortlistReport('2026-05-03', [
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
  const report = buildShortlistReport('2026-05-03', items, { minArticles: 1 });
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
  const report = buildShortlistReport('2026-05-03', rawCandidates);
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

test('near-duplicate titles are prevented', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX 1.5 release improves compatibility', url: 'https://example.com/a' }),
    candidate({ title: 'CameraX 1.5 release improves Android compatibility', url: 'https://example.com/b' })
  ], { minArticles: 1 });

  assert.equal(report.shortlisted_candidates.length, 1);
  assert.equal(report.excluded_candidates[0].exclusion_reasons[0], 'duplicate URL or near-duplicate title');
});

test('URL normalization removes tracking query and hash', () => {
  assert.equal(
    normalizeUrl('https://Example.com/path/?utm_source=x#section'),
    'https://example.com/path'
  );
});

test('exclusion reason reports reference-only candidates', () => {
  assert.ok(exclusionReasons(candidate({ reference_only: true })).includes('reference_only=true'));
});

test('configured minimum composition with reviewable primary and supporting articles is not publish-ready', () => {
  const supportingCount = articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired;
  const report = buildShortlistReport('2026-05-03', [
    ...Array.from({ length: articlePolicy.primaryCameraStack.minRequired }, (_, index) => policyPrimaryCandidate(index)),
    ...Array.from({ length: supportingCount }, (_, index) => policySupportingCandidate(index))
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, articlePolicy.primaryCameraStack.minRequired);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
  assert.equal(report.underfilled, false);
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.ok(report.publish_gate_reason_codes.includes('publish_ready_primary_camera_stack_shortage'));
  assert.ok(report.publish_gate_reason_codes.includes('publish_ready_supporting_main_over_limit'));
  assert.deepEqual(report.selection_warnings, []);
  assert.deepEqual(report.selection_errors, []);
});

test('configured minimum composition with mixed supporting buckets is reviewable but not publish-ready', () => {
  const requiredPrimaryCount = articlePolicy.primaryCameraStack.minRequired;
  const supportingCount = articlePolicy.mainArticleCount.min - requiredPrimaryCount;
  const primaryCandidates = Array.from({ length: requiredPrimaryCount }, (_, index) => policyPrimaryCandidate(index));
  const supportingCandidates = Array.from({ length: supportingCount }, (_, index) => {
    if (index === 0) {
      return policySupportingCandidate(index, {
        title: 'Snapdragon ISP policy supporting signal',
        url: 'https://example.com/policy-supporting-soc',
        summary: 'Snapdragon SoC ISP thermal and power behavior changes image pipeline performance.',
        api_or_component: 'Snapdragon ISP',
        behavior_change: 'Image pipeline thermal behavior changed.',
        relevance_bucket: 'soc_platform_signal',
        editorial_priority: 4,
        soc_platform_relevance: 5,
        native_tooling_relevance: 0,
        counts_as_soc_topic: true,
        counts_as_fallback_topic: false
      });
    }
    return policySupportingCandidate(index);
  });
  const report = buildShortlistReport('2026-05-03', [
    ...primaryCandidates,
    ...supportingCandidates
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, requiredPrimaryCount);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
  assert.ok(report.publish_gate_reason_codes.includes('publish_ready_supporting_main_over_limit'));
});

test('publish-ready composition passes with two primary topics and at most one supporting article', () => {
  const report = buildShortlistReport('2026-05-03', [
    policyPrimaryCandidate(0, {
      title: 'AOSP Camera direct publish-ready source',
      url: 'https://example.com/publish-ready-direct',
      relevance_bucket: 'direct_aosp_camera'
    }),
    policyPrimaryCandidate(1, {
      title: 'CameraX adjacent publish-ready source',
      url: 'https://example.com/publish-ready-adjacent',
      relevance_bucket: 'android_platform_camera_adjacent',
      aosp_camera_directness: 3
    }),
    policySupportingCandidate(0, {
      title: 'Publish-ready SoC supporting source',
      url: 'https://example.com/publish-ready-supporting',
      relevance_bucket: 'soc_platform_signal',
      soc_platform_relevance: 5,
      native_tooling_relevance: 0,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false
    })
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, publishReadyCompositionPolicy.primaryCameraStackMinRequired);
  assert.equal(report.composition_summary.direct_aosp_camera_count, 1);
  assert.equal(report.composition_summary.supporting_main_article_count, publishReadyCompositionPolicy.supportingMainMaxAllowed);
  assert.deepEqual(report.publish_gate_reason_codes, []);
});

test('publish-ready composition requires a direct AOSP Camera or driver image pipeline article', () => {
  const report = buildShortlistReport('2026-05-03', [
    policyPrimaryCandidate(0, {
      title: 'Android platform adjacent source A',
      url: 'https://example.com/publish-ready-adjacent-a',
      relevance_bucket: 'android_platform_camera_adjacent',
      aosp_camera_directness: 3
    }),
    policyPrimaryCandidate(1, {
      title: 'Camera2 metadata platform compatibility update',
      url: 'https://example.com/publish-ready-adjacent-b',
      relevance_bucket: 'android_platform_camera_adjacent',
      aosp_camera_directness: 3
    }),
    policySupportingCandidate(0, {
      title: 'Direct shortage supporting source',
      url: 'https://example.com/publish-ready-direct-shortage-supporting',
      relevance_bucket: 'soc_platform_signal',
      soc_platform_relevance: 5,
      native_tooling_relevance: 0,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false
    })
  ]);

  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 2);
  assert.equal(report.composition_summary.direct_aosp_camera_count + report.composition_summary.camera_driver_image_pipeline_count, 0);
  assert.deepEqual(report.publish_gate_reason_codes, ['publish_ready_direct_camera_or_driver_shortage']);
});

test('publish-ready supporting max applies across all supporting buckets', () => {
  const report = buildShortlistReport('2026-05-03', [
    policyPrimaryCandidate(0, {
      title: 'AOSP Camera direct with too much support',
      url: 'https://example.com/supporting-limit-direct',
      relevance_bucket: 'direct_aosp_camera'
    }),
    policyPrimaryCandidate(1, {
      title: 'Camera driver image pipeline with too much support',
      url: 'https://example.com/supporting-limit-driver',
      relevance_bucket: 'camera_driver_image_pipeline',
      driver_stack_relevance: 5,
      aosp_camera_directness: 0
    }),
    policySupportingCandidate(0, {
      title: 'Supporting limit SoC source',
      url: 'https://example.com/supporting-limit-soc',
      relevance_bucket: 'soc_platform_signal',
      soc_platform_relevance: 5,
      native_tooling_relevance: 0,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false
    }),
    policySupportingCandidate(1, {
      title: 'Supporting limit native workflow source',
      url: 'https://example.com/supporting-limit-native',
      relevance_bucket: 'cpp_ai_tooling_fallback'
    })
  ]);

  assert.equal(report.review_gate_passed, true);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_summary.supporting_main_article_count, 2);
  assert.deepEqual(report.publish_gate_reason_codes, ['publish_ready_supporting_main_over_limit']);
});

test('below configured minimum remains a hard deterministic selection error', () => {
  const belowMinimumCount = Math.max(0, articlePolicy.mainArticleCount.min - 1);
  const report = buildShortlistReport('2026-05-03',
    Array.from({ length: belowMinimumCount }, (_, index) => policyPrimaryCandidate(index))
  );

  assert.ok(report.selected_article_count <= belowMinimumCount);
  assert.ok(report.selected_article_count < articlePolicy.mainArticleCount.min);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_mode, 'NEEDS_FIX');
  assert.ok(report.selection_errors.some(error => error.includes('Newsletter Policy requires')));
  assert.equal(report.editor_review_required, true);
});

test('supporting-only composition is not publish-ready', () => {
  const report = buildShortlistReport('2026-05-03', [
    ...Array.from({ length: articlePolicy.mainArticleCount.min }, (_, index) => policySupportingCandidate(index))
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 0);
  assert.equal(report.composition_summary.supporting_main_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_mode, 'NEEDS_FIX');
  assert.ok(report.selection_errors.some(error => error.includes('Primary Camera Stack')));
});

test('forbidden bucket in main candidates is not publish-ready', () => {
  const requiredPrimaryCount = articlePolicy.primaryCameraStack.minRequired;
  const supportingCount = Math.max(0, articlePolicy.mainArticleCount.min - requiredPrimaryCount - 1);
  const selected = [
    ...Array.from({ length: requiredPrimaryCount }, (_, index) => policyPrimaryCandidate(index)),
    ...Array.from({ length: supportingCount }, (_, index) => policySupportingCandidate(index)),
    candidate({
      title: 'Generic technology watchlist item',
      url: 'https://example.com/generic-watchlist-main',
      summary: 'Generic IT watchlist item without article-level camera stack evidence.',
      api_or_component: 'Generic IT',
      behavior_change: 'General technology market behavior changed.',
      relevance_bucket: articlePolicy.forbiddenMainBuckets[0],
      editorial_priority: 6,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      camera_hal_relevance_score: 0
    })
  ];
  const summary = compositionSummary(selected);
  const errors = selectionErrors(selected);

  assert.equal(summary.selected_article_count, requiredPrimaryCount + supportingCount + 1);
  assert.equal(summary.forbidden_main_article_count, 1);
  assert.equal(publishGatePasses(summary), false);
  assert.ok(publishReadyGateReasonCodes(summary).includes('publish_ready_forbidden_main_bucket'));
  assert.ok(errors.some(error => error.includes('forbidden bucket')));
});

test('supporting fallback-only candidates do not satisfy required primary coverage', () => {
  const fallbackTopics = [
    'LLVM sanitizer diagnostics',
    'Clang analyzer warning model',
    'LLDB camera HAL debugging workflow',
    'CMake native build cache',
    'libc++ thread safety annotation'
  ];
  const fallbackItems = Array.from({ length: articlePolicy.mainArticleCount.min }, (_, index) => [
    fallbackTopics[index % fallbackTopics.length],
    `https://example.com/supporting-only-${index}`,
    fallbackTopics[index % fallbackTopics.length]
  ]);
  const report = buildShortlistReport('2026-05-03', fallbackItems.map(([title, url, component]) => candidate({
    title,
    url,
    summary: `${title} changes native build and sanitizer workflow behavior.`,
    api_or_component: component,
    behavior_change: 'C++ compiler release changes native build and sanitizer workflow behavior.',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    editorial_priority: 5,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 5,
    counts_as_primary_camera_topic: false,
    counts_as_driver_topic: false,
    counts_as_soc_topic: false,
    counts_as_fallback_topic: true,
    camera_hal_relevance_score: 0
  })));

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.cpp_ai_tooling_fallback_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 0);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_mode, 'NEEDS_FIX');
  assert.ok(report.selection_errors.some(error => error.includes('Primary Camera Stack')));
  assert.ok(report.selection_shortage_hints.some(hint => hint.includes('Primary Camera Stack')));
});

test('AOSP site update camera rows can satisfy configured composition', () => {
  const source = {
    id: 'aosp-site-updates',
    name: 'AOSP Site Updates',
    url: 'https://source.android.com/docs/whatsnew/site-updates',
    sourceUrl: 'https://source.android.com/docs/whatsnew/site-updates',
    category: 'aosp',
    section: 'Android / AOSP / Camera',
    priority: 'high',
    reliability: 'official',
    candidateOnly: false,
    requiresCrossCheck: false,
    usageHint: 'AOSP Camera site update rows',
    keywords: ['AOSP', 'Camera', 'Camera ITS', 'CDD']
  };
  const rows = parseSourceSpecificItems(readTextFixture('source-html/aosp-site-updates-camera.html'), source);
  const report = buildShortlistReport('2026-04-08', rows.map(item => normalizeCandidate(item)));

  assert.equal(rows.length, articlePolicy.mainArticleCount.min);
  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.cpp_ai_tooling_fallback_count, 0);
  assert.deepEqual(report.selection_errors, []);
  assert.equal(report.publish_ready, true);
  assert.equal(report.composition_mode, 'NORMAL');
});

test('official camera candidates below configured minimum are not publish-ready', () => {
  const aospSource = {
    id: 'aosp-site-updates',
    name: 'AOSP Site Updates',
    url: 'https://source.android.com/docs/whatsnew/site-updates',
    sourceUrl: 'https://source.android.com/docs/whatsnew/site-updates',
    category: 'aosp',
    section: 'Android / AOSP / Camera',
    priority: 'high',
    reliability: 'official',
    candidateOnly: false,
    requiresCrossCheck: false,
    usageHint: 'AOSP Camera site update rows',
    keywords: ['AOSP', 'Camera', 'Camera ITS', 'CDD']
  };
  const cameraXSource = {
    id: 'camerax-release-notes',
    name: 'CameraX Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
    category: 'camera-api',
    section: 'Android / AOSP / Camera',
    priority: 'high',
    reliability: 'official',
    candidateOnly: false,
    requiresCrossCheck: false,
    usageHint: 'CameraX official release notes',
    keywords: ['CameraX', 'androidx.camera']
  };
  const aospItem = parseSourceSpecificItems(readTextFixture('source-html/aosp-site-updates-paragraph-camera.html'), aospSource)
    .find(item => item.title === 'Camera ITS');
  const cameraXItem = parseSourceSpecificItems(readTextFixture('source-html/camerax-release-notes-1.6.html'), cameraXSource)[0];

  const report = buildShortlistReport('2026-05-06', [
    normalizeCandidate(aospItem),
    normalizeCandidate(cameraXItem)
  ]);

  assert.ok(report.selected_article_count < articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.non_fallback_reviewable_article_count, report.selected_article_count);
  assert.equal(report.review_gate_passed, false);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.ok(report.selection_errors.some(error => error.includes('Newsletter Policy requires')));
});

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
    ['2026-03-11', 'reference', 60],
    ['2026-02-09', 'reference', 90],
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
  const primaryCandidates = Array.from({ length: articlePolicy.mainArticleCount.min }, (_, index) =>
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
  ]);

  assert.equal(report.selection_policy.selection_window_policy.enforcement, 'main_selection_enforced');
  assert.equal(report.primary_window_selected_count, articlePolicy.mainArticleCount.min);
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
    Array(articlePolicy.mainArticleCount.min).fill('primary')
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
  ]);

  const fallbackSelected = report.selected_articles.filter(item => item.freshness_window === 'fallback');

  assert.equal(report.primary_window_selected_count, 1);
  assert.equal(report.fallback_window_candidate_count, 2);
  assert.equal(report.fallback_window_consulted, true);
  assert.equal(report.fallback_window_used, true);
  assert.match(report.fallback_window_reason, /primary window selected 1 article\(s\), below min 3/);
  assert.equal(fallbackSelected.length, 2);
  assert.ok(fallbackSelected.every(item => item.fallback_window_promoted === true));
  assert.ok(fallbackSelected.every(item => item.selection_window_stage === 'fallback'));
  assert.equal(report.fallback_candidates_promoted.length, 2);
  assert.deepEqual(report.selection_warnings, []);
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.ok(report.publish_gate_reason_codes.includes('publish_ready_primary_camera_stack_shortage'));
});

test('fallback rescue uses uncapped selection pool when primary fills shortlist cap', () => {
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
  ]);
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
  ]);

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
      published_date: '2026-03-11',
      camera_hal_relevance_score: 80
    }),
    policyPrimaryCandidate(3, {
      ...candidateBase,
      title: 'Unknown date high deterministic source',
      url: 'https://example.com/metadata-unknown-high',
      published_date: 'not-a-date',
      camera_hal_relevance_score: 90
    })
  ], { minArticles: 1 });
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
  ], { selectionWindowPolicy: customPolicy });

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
  ]);

  assert.equal(report.primary_window_selected_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.fallback_window_candidate_count, 1);
  assert.equal(report.fallback_window_consulted, false);
  assert.equal(report.fallback_window_used, false);
  assert.equal(report.selected_articles.some(item => item.url === fallbackCandidate.url), false);
  assert.deepEqual(
    report.selected_articles.map(item => item.freshness_window),
    Array(articlePolicy.mainArticleCount.min).fill('primary')
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
  ]);

  assert.equal(report.primary_window_selected_count, 1);
  assert.equal(report.fallback_window_consulted, true);
  assert.equal(report.fallback_window_used, true);
  assert.match(report.fallback_window_reason, /primary window selected 1 article\(s\), below min 3/);
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
      published_date: '2026-03-11',
      camera_hal_relevance_score: 100
    })
  ], { minArticles: 1 });

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

test('#124 acceptance: publish-ready requires two primary camera stack articles', () => {
  const report = buildShortlistReport('2026-05-03', [
    policyPrimaryCandidate(0, {
      title: 'Single primary camera stack source',
      url: 'https://example.com/124-single-primary'
    }),
    policySupportingCandidate(0),
    policySupportingCandidate(1)
  ]);

  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.ok(report.publish_gate_reason_codes.includes('publish_ready_primary_camera_stack_shortage'));
});

test('#124 acceptance: publish-ready rejects more than one supporting main article', () => {
  const report = buildShortlistReport('2026-05-03', [
    policyPrimaryCandidate(0, {
      title: 'AOSP Camera HAL API publish-ready source',
      url: 'https://example.com/124-direct-primary',
      api_or_component: 'Camera HAL API',
      behavior_change: 'Camera HAL API behavior changed.',
      relevance_bucket: 'direct_aosp_camera'
    }),
    policyPrimaryCandidate(1, {
      title: 'libcamera image pipeline driver publish-ready source',
      url: 'https://example.com/124-driver-primary',
      api_or_component: 'libcamera image pipeline',
      behavior_change: 'Image pipeline driver behavior changed.',
      relevance_bucket: 'camera_driver_image_pipeline',
      driver_stack_relevance: 5,
      aosp_camera_directness: 0
    }),
    policySupportingCandidate(0, {
      title: 'Supporting SoC source',
      url: 'https://example.com/124-supporting-soc',
      relevance_bucket: 'soc_platform_signal',
      soc_platform_relevance: 5,
      native_tooling_relevance: 0,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false
    }),
    policySupportingCandidate(1, {
      title: 'Supporting native workflow source',
      url: 'https://example.com/124-supporting-native'
    })
  ]);

  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_summary.supporting_main_article_count, 2);
  assert.deepEqual(report.publish_gate_reason_codes, ['publish_ready_supporting_main_over_limit']);
});

test('fallback composition uses supporting buckets when direct camera stack topics are scarce', () => {
  const supportingCount = articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired;
  const supportingCandidates = Array.from({ length: supportingCount }, (_, index) => {
    if (index % 2 === 0) {
      return candidate({
        title: `Snapdragon ISP supporting signal ${index}`,
        url: `https://example.com/snapdragon-isp-${index}`,
        summary: 'Snapdragon SoC ISP DVFS thermal and power behavior changes performance per watt for image pipelines.',
        api_or_component: 'Snapdragon ISP DVFS',
        behavior_change: 'Thermal and power behavior affects image pipeline performance budget.',
        relevance_bucket: 'soc_platform_signal',
        editorial_priority: 4,
        aosp_camera_directness: 0,
        driver_stack_relevance: 0,
        soc_platform_relevance: 5,
        native_tooling_relevance: 0,
        counts_as_soc_topic: true,
        camera_hal_relevance_score: 0
      });
    }
    return candidate({
      title: `LLVM sanitizer workflow improves native camera debugging ${index}`,
      url: `https://example.com/llvm-sanitizer-${index}`,
      summary: 'LLVM Clang sanitizer native debugging workflow improves C++ build and test productivity.',
      api_or_component: 'LLVM sanitizer',
      behavior_change: 'Sanitizer workflow improves native debugging and test productivity.',
      relevance_bucket: 'cpp_ai_tooling_fallback',
      editorial_priority: 5,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 4,
      counts_as_fallback_topic: true,
      camera_hal_relevance_score: 0
    });
  });
  const report = buildShortlistReport('2026-05-03', [
    ...Array.from({ length: articlePolicy.primaryCameraStack.minRequired }, (_, index) => policyPrimaryCandidate(index)),
    ...supportingCandidates
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.equal(report.editor_review_required, true);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, articlePolicy.primaryCameraStack.minRequired);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
  assert.ok(report.publish_gate_reason_codes.includes('publish_ready_primary_camera_stack_shortage'));
  assert.ok(report.publish_gate_reason_codes.includes('publish_ready_supporting_main_over_limit'));
});

test('generic watchlist-only pool remains needs-fix instead of fallback composition', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({
      title: 'Generic technology market roundup',
      url: 'https://example.com/generic-1',
      summary: 'General IT market news without camera driver SoC or native tooling evidence.',
      api_or_component: '',
      behavior_change: '',
      relevance_bucket: 'generic_tech_watchlist',
      editorial_priority: 6,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      camera_hal_relevance_score: 0
    }),
    candidate({
      title: 'General consumer gadget rumor',
      url: 'https://example.com/generic-2',
      summary: 'Consumer gadget watchlist item with weak engineering relevance.',
      api_or_component: '',
      behavior_change: '',
      relevance_bucket: 'generic_tech_watchlist',
      editorial_priority: 6,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      camera_hal_relevance_score: 0
    }),
    candidate({
      title: 'Generic AI product launch',
      url: 'https://example.com/generic-3',
      summary: 'Generic AI product launch without on-device or native development evidence.',
      api_or_component: '',
      behavior_change: '',
      relevance_bucket: 'generic_tech_watchlist',
      editorial_priority: 6,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      camera_hal_relevance_score: 0
    })
  ]);

  assert.equal(report.composition_mode, 'NEEDS_FIX');
  assert.equal(report.publish_ready, false);
  assert.equal(report.editor_review_required, true);
  assert.ok(report.selection_errors.length > 0);
});

test('broad platform terms remain fallback hints, not concrete component evidence', () => {
  const broad = candidate({
    title: 'Linux scheduler improves power efficiency',
    url: 'https://example.com/linux-scheduler-power',
    summary: 'thermal and cache behavior improved',
    api_or_component: '',
    behavior_change: 'Scheduler power efficiency changed.',
    relevance_bucket: 'soc_platform_signal',
    editorial_priority: 4,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    soc_platform_relevance: 3,
    native_tooling_relevance: 0,
    counts_as_soc_topic: true,
    camera_hal_relevance_score: 0
  });

  const score = scoreCandidate(broad, '2026-05-03');
  const report = buildShortlistReport('2026-05-03', [broad]);

  assert.equal(hasPlatformSignalTerm(broad), true);
  assert.equal(hasFallbackRelevanceHint(broad), true);
  assert.equal(hasConcreteApiComponent(broad), false);
  assert.ok(score.no_api_component_penalty > 0);
  assert.equal(report.selected_articles.some(item => item.url === broad.url), false);
  assert.equal(report.publish_ready, false);
});

test('generic native performance items cannot become main articles without concrete evidence', () => {
  const nativeTips = candidate({
    title: 'Native performance tips for large codebases',
    url: 'https://example.com/native-performance-tips',
    summary: 'Build and test workflow guidance for native performance in large codebases.',
    api_or_component: '',
    behavior_change: 'Native build workflow guidance changed.',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    editorial_priority: 5,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 3,
    counts_as_fallback_topic: true,
    camera_hal_relevance_score: 0
  });

  const score = scoreCandidate(nativeTips, '2026-05-03');
  const report = buildShortlistReport('2026-05-03', [nativeTips]);

  assert.equal(hasPlatformSignalTerm(nativeTips), true);
  assert.equal(hasFallbackRelevanceHint(nativeTips), true);
  assert.equal(hasConcreteApiComponent(nativeTips), false);
  assert.ok(score.no_api_component_penalty > 0);
  assert.equal(report.selected_articles.some(item => item.url === nativeTips.url), false);
  assert.equal(report.publish_ready, false);
});

test('concrete SoC and driver components still satisfy component evidence', () => {
  const snapdragonIsp = candidate({
    title: 'New Snapdragon ISP improves image pipeline power efficiency',
    url: 'https://example.com/snapdragon-isp-power',
    summary: 'Snapdragon ISP update improves image pipeline power efficiency.',
    api_or_component: '',
    behavior_change: 'Image pipeline power behavior changed.',
    relevance_bucket: 'soc_platform_signal',
    editorial_priority: 4,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    soc_platform_relevance: 5,
    native_tooling_relevance: 0,
    counts_as_soc_topic: true,
    camera_hal_relevance_score: 0
  });
  const libcameraSensor = candidate({
    title: 'libcamera adds support for new image sensor pipeline',
    url: 'https://example.com/libcamera-image-sensor',
    summary: 'libcamera release updates image sensor pipeline support.',
    api_or_component: '',
    behavior_change: 'Image sensor pipeline behavior changed.',
    relevance_bucket: 'camera_driver_image_pipeline',
    editorial_priority: 2,
    aosp_camera_directness: 0,
    driver_stack_relevance: 5,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    counts_as_driver_topic: true,
    camera_hal_relevance_score: 0
  });

  assert.equal(hasConcreteApiComponent(snapdragonIsp), true);
  assert.equal(hasConcreteApiComponent(libcameraSensor), true);
  assert.equal(scoreCandidate(snapdragonIsp, '2026-05-03').no_api_component_penalty, 0);
  assert.equal(scoreCandidate(libcameraSensor, '2026-05-03').no_api_component_penalty, 0);
});

test('generic Tensor tooling names do not satisfy concrete SoC evidence', () => {
  const tensorFlow = candidate({
    title: 'TensorFlow TensorBoard workflow improves AI debugging',
    url: 'https://example.com/tensorflow-tensorboard',
    summary: 'TensorFlow, TensorRT, TensorBoard, and TensorStore updates improve generic AI tooling.',
    api_or_component: '',
    behavior_change: 'Generic AI tooling workflow changed.',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    editorial_priority: 5,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 3,
    counts_as_fallback_topic: true,
    camera_hal_relevance_score: 0
  });

  const score = scoreCandidate(tensorFlow, '2026-05-03');
  const report = buildShortlistReport('2026-05-03', [tensorFlow]);

  assert.equal(hasConcreteApiComponent(tensorFlow), false);
  assert.ok(score.no_api_component_penalty > 0);
  assert.equal(report.selected_articles.some(item => item.url === tensorFlow.url), false);
  assert.equal(report.publish_ready, false);
});

test('Google Tensor SoC context still satisfies concrete platform evidence', () => {
  const googleTensor = candidate({
    title: 'Google Tensor G5 SoC changes image pipeline thermal behavior',
    url: 'https://example.com/google-tensor-g5-soc',
    summary: 'Google Tensor G5 SoC updates affect ISP and image pipeline thermal behavior.',
    api_or_component: '',
    behavior_change: 'Image pipeline thermal behavior changed.',
    relevance_bucket: 'soc_platform_signal',
    editorial_priority: 4,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    soc_platform_relevance: 5,
    native_tooling_relevance: 0,
    counts_as_soc_topic: true,
    camera_hal_relevance_score: 0
  });

  assert.equal(hasConcreteApiComponent(googleTensor), true);
  assert.equal(scoreCandidate(googleTensor, '2026-05-03').no_api_component_penalty, 0);
});

test('versioned C++ toolchain evidence is concrete but not counted as direct camera', () => {
  const gcc = candidate({
    title: 'GCC 16.1 improves C++ native performance',
    url: 'https://example.com/gcc-16-1-cpp-native-performance',
    summary: 'GCC 16.1 release changes C++ native compiler performance diagnostics.',
    api_or_component: '',
    behavior_change: 'C++ compiler diagnostics and performance behavior changed.',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    editorial_priority: 5,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 5,
    counts_as_fallback_topic: true,
    camera_hal_relevance_score: 0
  });
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/direct-a' }),
    candidate({ title: 'AOSP Camera provider B updates stream behavior', url: 'https://example.com/direct-b' }),
    candidate({ title: 'Android Camera API C fixes metadata behavior', url: 'https://example.com/direct-c' }),
    gcc
  ]);

  assert.equal(hasConcreteApiComponent(gcc), true);
  assert.equal(scoreCandidate(gcc, '2026-05-03').no_api_component_penalty, 0);
  assert.equal(report.composition_summary.direct_aosp_camera_count, 3);
  assert.equal(report.composition_summary.cpp_ai_tooling_fallback_count, 1);
});

test('non-AI HAL candidates are publish-ready without an AI requirement', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B updates stream compatibility', url: 'https://example.com/b' }),
    candidate({ title: 'Android Camera API change C fixes metadata behavior', url: 'https://example.com/c' }),
    candidate({ title: 'Camera HAL compatibility update D changes buffer handling', url: 'https://example.com/d' })
  ]);

  assert.ok(report.selected_article_count >= articlePolicy.mainArticleCount.min);
  assert.equal(report.publish_ready, true);
  assert.deepEqual(report.selection_errors, []);
  assert.equal(report.ai_selected_article_count, 0);
});

test('generic AI does not displace sufficient Camera HAL candidates', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'Camera HAL update A changes metadata handling', url: 'https://example.com/a', api_or_component: 'Camera HAL metadata' }),
    candidate({ title: 'CameraX release B improves Android Camera validation', url: 'https://example.com/b', api_or_component: 'CameraX' }),
    candidate({ title: 'AOSP Camera provider C updates stream behavior', url: 'https://example.com/c', api_or_component: 'camera provider stream' }),
    candidate({ title: 'Android Camera API D fixes buffer compatibility', url: 'https://example.com/d', api_or_component: 'Camera2 buffer' }),
    candidate({
      title: 'Generic AI model launch for productivity',
      url: 'https://example.com/ai-generic',
      summary: 'LLM agent workflow for office productivity.',
      camera_hal_relevance_score: 0,
      api_or_component: '',
      behavior_change: ''
    })
  ]);

  assert.equal(report.selected_articles.some(item => item.url === 'https://example.com/ai-generic'), false);
  assert.ok(report.shortlisted_candidates.find(item => item.url === 'https://example.com/ai-generic').score_filter_reasons.includes('missing concrete API/component evidence'));
});

test('score breakdown exposes HAL-first deterministic fields and penalties', () => {
  const halScore = scoreCandidate(candidate({
    title: 'Camera HAL stream update',
    summary: 'Camera HAL stream buffer validation update.',
    api_or_component: 'Camera HAL stream',
    behavior_change: 'Updates stream buffer validation.'
  }), '2026-05-03');
  const genericAiScore = scoreCandidate(candidate({
    title: 'Generic AI model update',
    summary: 'LLM model launch for office productivity.',
    camera_hal_relevance_score: 0,
    api_or_component: '',
    behavior_change: ''
  }), '2026-05-03');

  assert.ok(halScore.camera_hal_directness >= 2);
  assert.ok(halScore.evidence_specificity >= 4);
  assert.equal(halScore.generic_ai_penalty, 0);
  assert.ok(genericAiScore.generic_ai_penalty > 0);
  assert.ok(genericAiScore.no_api_component_penalty > 0);
  assert.ok(halScore.total > genericAiScore.total);
});

test('exclusion reason summary sorts by count descending then reason name', () => {
  const summary = summarizeExclusionReasons([
    { exclusion_reasons: ['z reason', 'a reason'] },
    { exclusion_reasons: ['a reason'] },
    { exclusion_reasons: ['m reason'] }
  ]);

  assert.deepEqual(summary, [
    { reason: 'a reason', count: 2 },
    { reason: 'm reason', count: 1 },
    { reason: 'z reason', count: 1 }
  ]);
});

test('undated watch and reference candidates remain excluded from final selection', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B updates stream compatibility', url: 'https://example.com/b' }),
    candidate({ title: 'On-device AI camera path update C', url: 'https://example.com/c', summary: 'AI inference update affects Android camera frame processing.' }),
    candidate({ title: 'Android Camera API change D fixes metadata behavior', url: 'https://example.com/d' }),
    candidate({
      title: 'Undated rolling Camera documentation',
      url: 'https://example.com/watch',
      published_date: '',
      isWatchPage: true,
      hasDatedEvidence: false,
      finalSelectionEligibility: 'watchlist'
    }),
    candidate({
      title: 'Reference-only Camera background',
      url: 'https://example.com/reference',
      reference_only: true
    })
  ]);

  const selectedUrls = new Set(report.selected_articles.map(item => item.url));
  assert.equal(selectedUrls.has('https://example.com/watch'), false);
  assert.equal(selectedUrls.has('https://example.com/reference'), false);
  assert.ok(report.excluded_candidates.some(item => item.title === 'Undated rolling Camera documentation'));
  assert.ok(report.excluded_candidates.some(item => item.title === 'Reference-only Camera background'));
});

test('bad selection fixtures remain excluded from main article selection', () => {
  const watchlist = readJsonFixture('selection/bad/watchlist-reference-main-article.json');
  const sourceGap = readJsonFixture('selection/bad/source-gap-main-article.json');
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B updates stream compatibility', url: 'https://example.com/b' }),
    candidate({ title: 'Android Camera API change C fixes metadata behavior', url: 'https://example.com/c' }),
    candidate({ title: 'Camera HAL stream update D changes buffer handling', url: 'https://example.com/d' }),
    candidate(watchlist.candidate),
    candidate(sourceGap.candidate)
  ]);
  const selectedUrls = new Set(report.selected_articles.map(item => item.url));

  assert.equal(selectedUrls.has(watchlist.candidate.url), false);
  assert.equal(selectedUrls.has(sourceGap.candidate.url), false);
  assert.ok(report.excluded_candidates.some(item => item.url === watchlist.candidate.url));
  assert.ok(report.excluded_candidates.some(item => item.url === sourceGap.candidate.url));
});
