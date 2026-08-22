'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  hasConcreteApiComponent,
  hasFallbackRelevanceHint,
  hasPlatformSignalTerm,
  publishReadyGateReasonCodes,
  scoreCandidate
} = require('../../select/newsroom-selection');
const { candidate } = require('../../../shared/test/helpers/newsroom-builders');
const {
  buildShortlistReport,
  policyPrimaryCandidate,
  policyDriverCandidate,
  policySupportingCandidate
} = require('../../../shared/test/helpers/selection-builders');

function policyMultimediaCandidate(index = 0, overrides = {}) {
  return candidate({
    title: `Android APV camera output article ${index}`,
    url: `https://example.com/policy-multimedia-${index}`,
    summary: 'Android introduces Advanced Professional Video for camera capture output and creator video workflows.',
    api_or_component: 'Advanced Professional Video / Android media camera output',
    behavior_change: 'Android introduces APV camera output behavior for professional video capture.',
    relevance_bucket: 'android_multimedia_camera_output',
    editorial_priority: 4,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    multimedia_camera_output_relevance: 5,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: false,
    counts_as_driver_topic: false,
    counts_as_soc_topic: false,
    counts_as_fallback_topic: false,
    camera_hal_relevance_score: 0,
    ...overrides
  });
}

function policySocCandidate(index = 0, overrides = {}) {
  return candidate({
    title: `Snapdragon camera thermal article ${index}`,
    url: `https://example.com/policy-soc-${index}`,
    summary: 'Snapdragon platform update changes camera thermal and ISP latency behavior for video capture workloads.',
    api_or_component: 'Snapdragon ISP camera thermal path',
    behavior_change: 'The SoC platform update changes camera thermal and ISP latency behavior.',
    relevance_bucket: 'soc_platform_signal',
    editorial_priority: 5,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    multimedia_camera_output_relevance: 0,
    soc_platform_relevance: 5,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: false,
    counts_as_driver_topic: false,
    counts_as_soc_topic: true,
    counts_as_fallback_topic: false,
    camera_hal_relevance_score: 0,
    ...overrides
  });
}

test('multimedia camera-output candidate is eligible through dedicated scope evidence', () => {
  const report = buildShortlistReport('2026-05-10', [
    policyMultimediaCandidate(0)
  ], { minArticles: 1, maxArticles: 1 });
  const [item] = report.shortlisted_candidates;

  assert.equal(item.relevance_bucket, 'android_multimedia_camera_output');
  assert.equal(item.score_breakdown.multimedia_camera_output_relevance >= 2, true);
  assert.equal(item.score_breakdown.scope_relevance >= 2, true);
  assert.equal(item.main_article_score_eligible, true);
  assert.equal(item.score_filter_reasons.includes('scope_relevance<2'), false);
  assert.equal(item.score_filter_reasons.includes('missing concrete API/component evidence'), false);
  assert.equal(item.counts_as_primary_camera_topic, false);
});

test('multimedia camera-output hard blockers still exclude main selection', () => {
  const items = [
    policyMultimediaCandidate(1, { url: 'https://example.com/multimedia-gap', source_gap_risk: true }),
    policyMultimediaCandidate(2, { url: 'https://example.com/multimedia-date', published_date: '', hasDatedEvidence: false }),
    policyMultimediaCandidate(3, { url: 'https://example.com/multimedia-watch', finalSelectionEligibility: 'watchlist' })
  ];
  const report = buildShortlistReport('2026-05-10', items, { minArticles: 1, maxArticles: 3 });
  const reasonsByUrl = new Map(report.excluded_candidates.map(item => [item.url, item.exclusion_reasons]));

  assert.equal(report.shortlisted_candidates.length, 0);
  assert.ok(reasonsByUrl.get('https://example.com/multimedia-gap').includes('source_gap_risk=true'));
  assert.ok(reasonsByUrl.get('https://example.com/multimedia-date').includes('missing dated evidence'));
  assert.ok(reasonsByUrl.get('https://example.com/multimedia-watch').includes('finalSelectionEligibility=watchlist'));
});

test('multimedia supporting bucket counts separately and can pass publish-ready with enough primary coverage', () => {
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(1),
    policyDriverCandidate(2),
    policyMultimediaCandidate(1)
  ]);

  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 2);
  assert.equal(report.composition_summary.android_multimedia_camera_output_count, 1);
  assert.equal(report.composition_summary.supporting_main_article_count, 1);
  assert.equal(report.composition_summary.non_fallback_reviewable_article_count, 3);
  assert.equal(report.composition_summary.direct_aosp_camera_count, 1);
  assert.equal(report.composition_summary.camera_driver_image_pipeline_count, 1);
  assert.equal(report.publish_ready, true);
});

test('multimedia plus SoC still fails publish-ready when supporting limit is exceeded', () => {
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(1),
    policyMultimediaCandidate(1),
    policySocCandidate(1)
  ]);

  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 1);
  assert.equal(report.composition_summary.android_multimedia_camera_output_count, 1);
  assert.equal(report.composition_summary.soc_platform_signal_count, 1);
  assert.equal(report.composition_summary.supporting_main_article_count, 2);
  assert.equal(report.publish_ready, false);
  assert.ok(publishReadyGateReasonCodes(report.composition_summary).includes('publish_ready_supporting_main_over_limit'));
});

test('selection order ranks multimedia supporting ahead of SoC and C++ fallback', () => {
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(1),
    policyDriverCandidate(2),
    policySupportingCandidate(1),
    policySocCandidate(1),
    policyMultimediaCandidate(1)
  ]);
  const orderedBuckets = report.selected_articles.map(item => item.relevance_bucket);

  assert.ok(
    orderedBuckets.indexOf('android_multimedia_camera_output') <
      orderedBuckets.indexOf('soc_platform_signal')
  );
  assert.ok(
    orderedBuckets.indexOf('soc_platform_signal') <
      orderedBuckets.indexOf('cpp_ai_tooling_fallback')
  );
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
  const report = buildShortlistReport('2026-05-10', [broad]);

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
  const report = buildShortlistReport('2026-05-10', [nativeTips]);

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
  const report = buildShortlistReport('2026-05-10', [tensorFlow]);

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
  const report = buildShortlistReport('2026-05-10', [
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

test('cpp_fallback stays supporting-only and is not promoted to non-fallback', () => {
  const { compositionSummary } = require('../../select/newsroom-selection');
  const genericFallback = candidate({
    title: 'LLVM 20 general compiler release',
    url: 'https://example.com/llvm-20-general',
    summary: 'LLVM 20 releases with general compiler improvements.',
    api_or_component: 'LLVM compiler',
    behavior_change: 'General compiler optimization improved.',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    editorial_priority: 6,
    native_tooling_relevance: 3,
    counts_as_fallback_topic: true
  });

  const summary = compositionSummary([genericFallback]);

  assert.equal(summary.supporting_main_article_count, 1);
  assert.equal(summary.non_fallback_reviewable_article_count, 0);
  assert.equal(summary.fallback_topic_count, 1);
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
