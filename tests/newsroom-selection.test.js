const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildShortlistReport,
  exclusionReasons,
  hasConcreteApiComponent,
  hasFallbackRelevanceHint,
  hasPlatformSignalTerm,
  normalizeUrl,
  scoreCandidate,
  selectFinalArticles,
  summarizeExclusionReasons
} = require('../scripts/lib/newsroom-selection');

function candidate(overrides = {}) {
  const title = overrides.title || 'CameraX 1.5 release improves Android Camera compatibility';
  const urlTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    title,
    source: overrides.source || 'Android Developers',
    url: overrides.url || `https://example.com/${urlTitle}`,
    published_date: overrides.published_date || '2026-05-01T00:00:00Z',
    summary: overrides.summary || 'CameraX release changes Android Camera behavior and compatibility validation.',
    reliability: overrides.reliability || 'official',
    finalSelectionEligibility: overrides.finalSelectionEligibility || 'main',
    isWatchPage: overrides.isWatchPage || false,
    hasDatedEvidence: overrides.hasDatedEvidence !== undefined ? overrides.hasDatedEvidence : true,
    source_gap_risk: overrides.source_gap_risk || false,
    main_eligible: overrides.main_eligible !== undefined ? overrides.main_eligible : true,
    briefing_only: overrides.briefing_only || false,
    reference_only: overrides.reference_only || false,
    evidence_score: overrides.evidence_score !== undefined ? overrides.evidence_score : 6,
    camera_hal_relevance_score: overrides.camera_hal_relevance_score !== undefined ? overrides.camera_hal_relevance_score : 100,
    api_or_component: overrides.api_or_component || 'CameraX',
    behavior_change: overrides.behavior_change || 'Release updates CameraX compatibility behavior.',
    ...overrides
  };
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

  assert.ok(selected.length >= 4 && selected.length <= 5);
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

test('four eligible candidates are publish-ready with no deterministic selection errors', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B updates stream compatibility', url: 'https://example.com/b' }),
    candidate({ title: 'Android Camera API change C fixes metadata behavior', url: 'https://example.com/c' }),
    candidate({ title: 'On-device AI camera path update D', url: 'https://example.com/d', summary: 'AI inference update affects Android camera frame processing.' })
  ]);

  assert.equal(report.selected_article_count, 4);
  assert.equal(report.underfilled, false);
  assert.equal(report.publish_ready, true);
  assert.deepEqual(report.selection_warnings, []);
  assert.deepEqual(report.selection_errors, []);
});

test('three eligible candidates with an AI candidate are reviewable but not publish-ready', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B updates stream compatibility', url: 'https://example.com/b' }),
    candidate({ title: 'On-device AI camera path update C', url: 'https://example.com/c', summary: 'AI inference update affects Android camera frame processing.' })
  ]);

  assert.equal(report.selected_article_count, 3);
  assert.equal(report.underfilled, true);
  assert.equal(report.publish_ready, false);
  assert.equal(report.selection_errors.length, 0);
  assert.match(report.selection_warnings[0], /Thin-week review path/);
  assert.equal(report.composition_mode, 'THIN_WEEK_REVIEW');
  assert.equal(report.editor_review_required, true);
});

test('two eligible candidates remain a hard deterministic selection error', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'On-device AI camera path update B', url: 'https://example.com/b', summary: 'AI inference update affects Android camera frame processing.' })
  ]);

  assert.equal(report.selected_article_count, 2);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_mode, 'NEEDS_FIX');
  assert.ok(report.selection_errors.some(error => error.includes('Only 2 eligible')));
});

test('fallback composition uses SoC and native tooling when direct camera stack topics are scarce', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({
      title: 'CameraX release gives one direct Android Camera validation item',
      url: 'https://example.com/camerax-direct',
      relevance_bucket: 'direct_aosp_camera',
      editorial_priority: 1,
      aosp_camera_directness: 5,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: true
    }),
    candidate({
      title: 'Snapdragon ISP DVFS update affects camera thermal budget',
      url: 'https://example.com/snapdragon-isp',
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
    }),
    candidate({
      title: 'Arm GPU memory bandwidth note for image processing throughput',
      url: 'https://example.com/arm-gpu-memory',
      summary: 'Arm GPU memory bandwidth, cache, interconnect, thermal, and power guidance for SoC performance.',
      api_or_component: 'Arm GPU memory bandwidth',
      behavior_change: 'Memory bandwidth and cache behavior changes image processing throughput analysis.',
      relevance_bucket: 'soc_platform_signal',
      editorial_priority: 4,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 4,
      native_tooling_relevance: 0,
      counts_as_soc_topic: true,
      camera_hal_relevance_score: 0
    }),
    candidate({
      title: 'LLVM sanitizer workflow improves native camera debugging',
      url: 'https://example.com/llvm-sanitizer',
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
    })
  ]);

  assert.equal(report.selected_article_count, 4);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.publish_ready, true);
  assert.equal(report.editor_review_required, true);
  assert.equal(report.composition_summary.direct_aosp_camera_count, 1);
  assert.equal(report.composition_summary.soc_platform_signal_count, 2);
  assert.equal(report.composition_summary.cpp_ai_tooling_fallback_count, 1);
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

test('four non-AI HAL candidates are publish-ready without an AI requirement', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B updates stream compatibility', url: 'https://example.com/b' }),
    candidate({ title: 'Android Camera API change C fixes metadata behavior', url: 'https://example.com/c' }),
    candidate({ title: 'Camera HAL compatibility update D changes buffer handling', url: 'https://example.com/d' })
  ]);

  assert.equal(report.selected_article_count, 4);
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
