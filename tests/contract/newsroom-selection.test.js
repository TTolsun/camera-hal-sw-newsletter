const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildShortlistReport,
  compositionSummary,
  exclusionReasons,
  hasConcreteApiComponent,
  hasFallbackRelevanceHint,
  hasPlatformSignalTerm,
  LINKED_EVIDENCE_RUNTIME_BONUS,
  LINKED_EVIDENCE_WATCH_PENALTY,
  MAIN_ARTICLE_SCORE_THRESHOLD,
  normalizeUrl,
  publishGatePasses,
  reporterInputFromShortlist,
  scoreCandidate,
  selectFinalArticles,
  selectionErrors,
  summarizeExclusionReasons
} = require('../../scripts/lib/newsroom-selection');
const {
  articlePolicy
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
  for (let directness = 2; directness <= 5 && !thresholdCandidate; directness += 0.01) {
    const item = linkedScoreCandidate({
      title: `Threshold linked evidence candidate ${directness}`,
      url: `https://example.com/threshold-${directness.toFixed(2)}`,
      summary: 'Scoped release note for a workflow.',
      api_or_component: 'Lens stack',
      behavior_change: 'Behavior changed.',
      published_date: '2020-01-01',
      reliability: 'official',
      aosp_camera_directness: directness,
      camera_hal_relevance_score: 0,
      evidence_score: 0
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

test('configured minimum composition with required primary and supporting articles is publish-ready', () => {
  const supportingCount = articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired;
  const report = buildShortlistReport('2026-05-03', [
    ...Array.from({ length: articlePolicy.primaryCameraStack.minRequired }, (_, index) => policyPrimaryCandidate(index)),
    ...Array.from({ length: supportingCount }, (_, index) => policySupportingCandidate(index))
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, articlePolicy.primaryCameraStack.minRequired);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
  assert.equal(report.underfilled, false);
  assert.equal(report.publish_ready, true);
  assert.deepEqual(report.selection_warnings, []);
  assert.deepEqual(report.selection_errors, []);
});

test('configured minimum composition with mixed supporting buckets is publish-ready', () => {
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
  assert.equal(report.publish_ready, true);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, requiredPrimaryCount);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
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
  const report = buildShortlistReport('2026-05-03', rows.map(item => normalizeCandidate(item)));

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
  assert.equal(report.publish_ready, true);
  assert.equal(report.editor_review_required, true);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, articlePolicy.primaryCameraStack.minRequired);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
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
