'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  compositionSummary,
  publishGatePasses,
  publishReadyGateReasonCodes,
  selectionErrors
} = require('../../../generator/select/newsroom-selection');
const {
  articlePolicy,
  publishReadyCompositionPolicy
} = require('../../common/newsletter-policy');
const { normalizeCandidate } = require('../../cli/collect-news-candidates');
const { parseSourceSpecificItems } = require('../../collect/source-item-parsers');
const { candidate } = require('../helpers/newsroom-builders');
const { readTextFixture } = require('../helpers/fixture-loader');
const {
  buildShortlistReport,
  policyPrimaryCandidate,
  policySupportingCandidate
} = require('../helpers/selection-builders');

test('one supporting main article can be public-ready without primary coverage', () => {
  const supportingCount = articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired;
  const report = buildShortlistReport('2026-05-10', [
    ...Array.from({ length: articlePolicy.primaryCameraStack.minRequired }, (_, index) => policyPrimaryCandidate(index)),
    ...Array.from({ length: supportingCount }, (_, index) => policySupportingCandidate(index))
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, articlePolicy.primaryCameraStack.minRequired);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
  assert.equal(report.underfilled, false);
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.equal(report.editor_review_required, false);
  assert.deepEqual(report.publish_gate_reason_codes, []);
  assert.deepEqual(report.selection_warnings, []);
  assert.deepEqual(report.selection_errors, []);
});

test('one mixed supporting bucket article is public-ready when hard gates pass', () => {
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
  const report = buildShortlistReport('2026-05-10', [
    ...primaryCandidates,
    ...supportingCandidates
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.equal(report.editor_review_required, false);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, requiredPrimaryCount);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
  assert.deepEqual(report.publish_gate_reason_codes, []);
});

test('publish-ready composition passes with two primary topics and at most one supporting article', () => {
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'AOSP Camera direct publish-ready source',
      url: 'https://example.com/publish-ready-direct',
      relevance_bucket: 'direct_aosp_camera'
    }),
    policyPrimaryCandidate(1, {
      title: 'CameraX adjacent publish-ready source',
      url: 'https://example.com/publish-ready-adjacent',
      relevance_bucket: 'android',
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

  assert.ok(report.selected_article_count >= articlePolicy.mainArticleCount.min);
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.ok(report.composition_summary.primary_camera_stack_topic_count >= publishReadyCompositionPolicy.primaryCameraStackMinRequired);
  assert.equal(report.composition_summary.direct_aosp_camera_count, 1);
  assert.equal(report.composition_summary.supporting_main_article_count, publishReadyCompositionPolicy.supportingMainMaxAllowed);
  assert.deepEqual(report.publish_gate_reason_codes, []);
});

test('direct AOSP Camera or driver shortage no longer blocks one-article policy', () => {
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Android platform adjacent source A',
      url: 'https://example.com/publish-ready-adjacent-a',
      relevance_bucket: 'android',
      aosp_camera_directness: 3
    }),
    policyPrimaryCandidate(1, {
      title: 'Camera2 metadata platform compatibility update',
      url: 'https://example.com/publish-ready-adjacent-b',
      relevance_bucket: 'android',
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
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 2);
  assert.equal(report.composition_summary.direct_aosp_camera_count + report.composition_summary.camera_driver_image_pipeline_count, 0);
  assert.deepEqual(report.publish_gate_reason_codes, []);
});

test('raw direct bucket is normalized for Jetpack Compose CameraX-adjacent candidates', () => {
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Google I/O Jetpack Compose adaptive CameraX preview guidance',
      url: 'https://example.com/compose-camerax-adjacent',
      summary: 'Google I/O highlighted Jetpack Compose and Jetpack Navigation 3 for adaptive Android device experiences, including app screens where CameraX preview layouts need validation on foldables and tablets.',
      api_or_component: 'Jetpack Compose / Jetpack Navigation 3',
      behavior_change: 'Compose adaptive UI guidance changes camera preview screen layout planning across device classes.',
      relevance_bucket: 'direct_aosp_camera',
      aosp_camera_directness: 5,
      counts_as_primary_camera_topic: false
    })
  ], { minArticles: 1, maxArticles: 1 });
  const [item] = report.selected_articles;

  assert.equal(item.relevance_bucket, 'android');
  assert.equal(item.score_breakdown.relevance_bucket, 'android');
  assert.equal(report.composition_summary.direct_aosp_camera_count, 0);
  assert.equal(report.composition_summary.android_count, 1);
  assert.equal(item.counts_as_primary_camera_topic, true);
  assert.equal(report.publish_ready, true);
});

test('publish-ready supporting max applies across all supporting buckets', () => {
  const report = buildShortlistReport('2026-05-10', [
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
  const report = buildShortlistReport('2026-05-10',
    Array.from({ length: belowMinimumCount }, (_, index) => policyPrimaryCandidate(index))
  );

  assert.ok(report.selected_article_count <= belowMinimumCount);
  assert.ok(report.selected_article_count < articlePolicy.mainArticleCount.min);
  assert.equal(report.publish_ready, false);
  assert.equal(report.composition_mode, 'NEEDS_FIX');
  assert.ok(report.selection_errors.some(error => error.includes('Newsletter Policy requires')));
  assert.equal(report.editor_review_required, true);
});

test('supporting-only composition is public-ready with one publishable article', () => {
  const report = buildShortlistReport('2026-05-10', [
    ...Array.from({ length: articlePolicy.mainArticleCount.min }, (_, index) => policySupportingCandidate(index))
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 0);
  assert.equal(report.composition_summary.supporting_main_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.editor_review_required, false);
  assert.equal(report.candidate_pool_preflight_passed, true);
  assert.equal(report.candidate_shortage_reviewable, false);
  assert.equal(report.candidate_shortage_summary.reserve_candidate_count, 0);
  assert.equal(report.candidate_shortage_summary.required_reserve_candidate_count, 0);
  assert.equal(report.source_parser_hints.some(hint => hint.code === 'RESERVE_POOL_SHORTAGE'), false);
  assert.deepEqual(report.selection_errors, []);
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

test('supporting fallback-only candidate can satisfy one-article policy', () => {
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
  const report = buildShortlistReport('2026-05-10', fallbackItems.map(([title, url, component]) => candidate({
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
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.editor_review_required, false);
  assert.deepEqual(report.selection_errors, []);
});

test('official Android native tooling is selected as one supporting group with related context', () => {
  const source = {
    id: 'android-developers-blog',
    name: 'Android Developers Blog',
    url: 'https://android-developers.googleblog.com/',
    sourceUrl: 'https://android-developers.googleblog.com/',
    category: 'android',
    section: 'Android / Developer Tools',
    priority: 'high',
    reliability: 'official',
    candidateOnly: false,
    requiresCrossCheck: false,
    usageHint: 'Official Android Developers Blog tooling articles',
    keywords: ['Android', 'Studio', 'CLI', 'Gemini', 'build', 'test', 'debug']
  };
  const rawTooling = [
    {
      source,
      title: 'Start building today - Build native Android apps in Google AI Studio',
      url: 'https://android-developers.googleblog.com/2026/05/io26.html#roundup-child-3-start-building-today',
      publishedAt: '2026-05-20',
      sourceKind: 'blog_post_item',
      collectionMode: 'article-item',
      summary: 'Google AI Studio can generate, modify, build, and test native Android apps with Gemini assisted workflows.',
      relevanceBucketHint: 'android'
    },
    {
      source,
      title: 'Android CLI Now Stable 1.0: Accelerate developing for Android using any agent',
      url: 'https://android-developers.googleblog.com/2026/05/android-cli-stable.html',
      publishedAt: '2026-05-20',
      sourceKind: 'blog_post_item',
      collectionMode: 'article-item',
      summary: 'Android CLI 1.0 helps agents build, test, debug, and run native Android apps on devices.'
    },
    {
      source,
      title: 'Android Studio I/O Edition: What’s new in Android Developer tools',
      url: 'https://android-developers.googleblog.com/2026/05/android-studio-io-edition.html',
      publishedAt: '2026-05-20',
      sourceKind: 'blog_post_item',
      collectionMode: 'article-item',
      summary: 'Android Studio updates device execution, Gradle sync, profiling, and debugging workflow for Android apps.'
    }
  ].map(item => normalizeCandidate(item));
  const report = buildShortlistReport('2026-05-29', [
    policyPrimaryCandidate(1, {
      title: 'CameraX primary release for grouping regression',
      url: 'https://example.com/camerax-grouping-primary',
      published_date: '2026-05-21'
    }),
    ...rawTooling,
    normalizeCandidate({
      source,
      title: 'Android Play growth policy update for developers',
      url: 'https://android-developers.googleblog.com/2026/05/play-growth-policy.html',
      publishedAt: '2026-05-20',
      sourceKind: 'blog_post_item',
      collectionMode: 'article-item',
      summary: 'Play Store growth policy guidance for app listings without build, test, debug, or native Android workflow evidence.'
    })
  ]);
  const selectedTooling = report.selected_articles.find(item => item.article_group_key === 'android_native_tooling_workflow');

  assert.ok(selectedTooling);
  assert.equal(selectedTooling.relevance_bucket, 'cpp_ai_tooling_fallback');
  assert.equal(selectedTooling.finalSelectionEligibility, 'short');
  assert.equal(selectedTooling.tooling_workflow_type, 'native_tooling_workflow');
  assert.equal(selectedTooling.counts_as_primary_camera_topic, false);
  assert.equal(report.composition_summary.supporting_main_article_count, 1);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 1);
  assert.equal(report.selected_group_count, report.selected_articles.length);
  assert.ok(selectedTooling.related_context_candidates.length >= 2);
  assert.ok(selectedTooling.related_context_candidates.every(item => item.can_create_independent_article === false));
  assert.equal(
    selectedTooling.related_context_candidates.some(item => item.url === 'https://android-developers.googleblog.com/2026/05/play-growth-policy.html'),
    false
  );
  assert.equal(rawTooling[0].relevance_bucket, 'cpp_ai_tooling_fallback');
  assert.equal(rawTooling[0].counts_as_primary_camera_topic, false);
});

test('native tooling support does not displace a full primary camera selection', () => {
  const source = {
    id: 'android-developers-blog',
    name: 'Android Developers Blog',
    url: 'https://android-developers.googleblog.com/',
    sourceUrl: 'https://android-developers.googleblog.com/',
    category: 'android',
    section: 'Android / Developer Tools',
    reliability: 'official',
    candidateOnly: false,
    usageHint: 'Official Android Developers Blog tooling articles',
    keywords: ['Android', 'CLI', 'build', 'test', 'debug']
  };
  const tooling = normalizeCandidate({
    source,
    title: 'Android CLI Now Stable 1.0: Accelerate developing for Android using any agent',
    url: 'https://android-developers.googleblog.com/2026/05/android-cli-stable.html',
    publishedAt: '2026-05-20',
    sourceKind: 'blog_post_item',
    collectionMode: 'article-item',
    summary: 'Android CLI 1.0 helps agents build, test, debug, and run native Android apps on devices.'
  });
  const report = buildShortlistReport('2026-05-29', [
    ...[
      'CameraX release updates preview stream validation',
      'AOSP Camera provider changes buffer metadata handling',
      'Android Camera API fixes capture result behavior',
      'Camera HAL metadata contract update for CTS checks',
      'Camera ITS test plan update for preview stability'
    ].map((title, index) => policyPrimaryCandidate(index, {
      title,
      url: `https://example.com/camera-full-slate-${index}`,
      summary: `${title} changes Camera HAL validation behavior for stream, buffer, and metadata checks.`,
      api_or_component: 'Camera HAL / CameraX',
      behavior_change: `${title} changes Camera HAL validation behavior.`,
      published_date: '2026-05-21'
    })),
    tooling
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.max);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, articlePolicy.mainArticleCount.max);
  assert.equal(report.composition_summary.cpp_ai_tooling_fallback_count, 0);
  assert.equal(report.selected_articles.some(item => item.article_group_key === 'android_native_tooling_workflow'), false);
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

  assert.ok(rows.length >= articlePolicy.mainArticleCount.min);
  assert.equal(report.selected_article_count, rows.length);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, rows.length);
  assert.equal(report.composition_summary.cpp_ai_tooling_fallback_count, 0);
  assert.deepEqual(report.selection_errors, []);
  assert.equal(report.publish_ready, true);
  assert.equal(report.composition_mode, 'NORMAL');
});

test('zero publishable candidates remain below configured minimum and are not publish-ready', () => {
  const report = buildShortlistReport('2026-05-06', []);

  assert.ok(report.selected_article_count < articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_summary.non_fallback_reviewable_article_count, report.selected_article_count);
  assert.equal(report.review_gate_passed, false);
  assert.equal(report.publish_gate_passed, false);
  assert.equal(report.publish_ready, false);
  assert.equal(report.candidate_pool_preflight_passed, false);
  assert.equal(report.candidate_shortage_reviewable, true);
  assert.ok(report.shortage_reason_codes.includes('publishable_candidate_shortage'));
  assert.ok(report.selection_errors.some(error => error.includes('Newsletter Policy requires')));
});

test('fallback composition with one supporting article is accepted by one-article policy', () => {
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
  const report = buildShortlistReport('2026-05-10', [
    ...Array.from({ length: articlePolicy.primaryCameraStack.minRequired }, (_, index) => policyPrimaryCandidate(index)),
    ...supportingCandidates
  ]);

  assert.equal(report.selected_article_count, articlePolicy.mainArticleCount.min);
  assert.equal(report.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.equal(report.editor_review_required, false);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, articlePolicy.primaryCameraStack.minRequired);
  assert.equal(report.composition_summary.supporting_main_article_count, supportingCount);
  assert.deepEqual(report.publish_gate_reason_codes, []);
});

test('generic watchlist-only pool remains needs-fix instead of fallback composition', () => {
  const report = buildShortlistReport('2026-05-10', [
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

test('non-AI HAL candidates are publish-ready without an AI requirement', () => {
  const report = buildShortlistReport('2026-05-10', [
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
  const report = buildShortlistReport('2026-05-10', [
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

test('#124 acceptance: one primary plus one supporting article is publish-ready', () => {
  const report = buildShortlistReport('2026-05-10', [
    policyPrimaryCandidate(0, {
      title: 'Single primary camera stack source',
      url: 'https://example.com/124-single-primary'
    }),
    policySupportingCandidate(0)
  ]);

  assert.equal(report.review_gate_passed, true);
  assert.equal(report.publish_gate_passed, true);
  assert.equal(report.publish_ready, true);
  assert.deepEqual(report.publish_gate_reason_codes, []);
});

test('#124 acceptance: publish-ready rejects more than one supporting main article', () => {
  const report = buildShortlistReport('2026-05-10', [
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
