'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  compositionSummary,
  compositionMode,
  publishGatePasses,
  reviewCompositionGatePasses
} = require('../../scripts/newsroom/generate/newsroom-selection');
const {
  buildNewsletterQualityReport
} = require('../../scripts/newsroom/validate/newsletter-quality');
const {
  publishReadyCompositionPolicy,
  getCppFallbackMainPromotionPolicy,
  getDefaultNewsletterPolicy,
  isSupportingMainBucket
} = require('../../scripts/newsroom/common/newsletter-policy');
const {
  isFallbackOnly
} = require('../../scripts/newsroom/common/public-article-contract');
const {
  section,
  scopedCandidate,
  reporterCandidate
} = require('../helpers/quality-builders');
const {
  buildShortlistReport,
  policyPrimaryCandidate
} = require('../helpers/selection-builders');

// cpp_fallback 후보 빌더 — camera_dev_workflow_relevance 플래그 포함
function cppFallbackCandidate(index, cameraDevWorkflowRelevance) {
  return {
    title: `LLVM toolchain cpp_fallback candidate ${index}`,
    url: `https://example.com/cpp-fallback-${index}`,
    summary: 'LLVM toolchain update changes C++ native build productivity for camera workflow debugging.',
    api_or_component: 'LLVM toolchain',
    behavior_change: 'Native debugging workflow behavior changed.',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    editorial_priority: 6,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    multimedia_camera_output_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 5,
    counts_as_fallback_topic: true,
    camera_hal_relevance_score: 0,
    camera_dev_workflow_relevance: cameraDevWorkflowRelevance,
    camera_dev_workflow_relevance_reason: cameraDevWorkflowRelevance
      ? 'Camera HAL 디버깅 및 재현 워크플로우 단축에 직접 기여하는 도구임.'
      : '',
    camera_dev_workflow_relevance_source: cameraDevWorkflowRelevance ? 'llm_reporter' : 'default_false',
    published_date: '2026-05-01T00:00:00Z',
    source: 'LLVM Project',
    reliability: 'official',
    finalSelectionEligibility: 'main',
    isWatchPage: false,
    hasDatedEvidence: true,
    source_gap_risk: false,
    main_eligible: true,
    briefing_only: false,
    reference_only: false,
    evidence_score: 6
  };
}

// quality 단계용 section 빌더 — cpp_fallback 버킷
function cppFallbackSection(index, url, cameraDevWorkflowRelevance) {
  return section({
    headline: `LLVM toolchain cpp_fallback article ${index}`,
    url,
    category: 'C++ Tooling',
    what_changed: `LLVM toolchain changed native workflow behavior on 2026-05-01 (candidate ${index}).`,
    evidence_summary: `Version: LLVM 18.0; release date: 2026-05-01; API/component: LLVM toolchain; behavior change: native camera debug workflow.`,
    background: 'LLVM sanitizer diagnostics can shorten Camera HAL and driver test/debug loops.',
    camera_hal_perspective: 'Apply sanitizer diagnostics to native Camera HAL and V4L2 bridge debug builds.'
  });
}

// quality 단계용 reporter 후보 — camera_dev_workflow_relevance 포함
function cppFallbackReporterCandidate(url, cameraDevWorkflowRelevance) {
  return scopedCandidate(url, 'cpp_ai_tooling_fallback', {
    camera_dev_workflow_relevance: cameraDevWorkflowRelevance,
    camera_dev_workflow_relevance_reason: cameraDevWorkflowRelevance
      ? 'Camera HAL 디버깅 및 재현 워크플로우 단축에 직접 기여하는 도구임.'
      : '',
    camera_dev_workflow_relevance_source: cameraDevWorkflowRelevance ? 'llm_reporter' : 'default_false'
  });
}

test('selection compositionSummary: toggle=false(기본값)이면 cpp_fallback은 모두 supporting으로 분류', () => {
  // requiresCameraDevWorkflowRelevance=false(기본값)이면 relevance 값에 상관없이 supporting으로 분류
  const relevantUrl = 'https://example.com/cpp-fallback-relevant';
  const nonRelevantUrl = 'https://example.com/cpp-fallback-non-relevant';

  const relevantCandidate = cppFallbackCandidate(0, true);
  relevantCandidate.url = relevantUrl;
  const nonRelevantCandidate = cppFallbackCandidate(1, false);
  nonRelevantCandidate.url = nonRelevantUrl;

  const summary = compositionSummary([relevantCandidate, nonRelevantCandidate]);

  assert.equal(summary.cpp_ai_tooling_fallback_count, 2, 'cpp_fallback 버킷 총 2건이어야 함');
  // toggle=false이면 cpp_fallback_camera_dev_relevant_count는 항상 0
  assert.equal(summary.cpp_fallback_camera_dev_relevant_count, 0,
    'toggle=false이면 메인 자격 카운트는 0이어야 함');
  // toggle=false이면 relevance=true여도 supporting에 포함
  assert.equal(summary.supporting_main_article_count, 2,
    'toggle=false이면 cpp_fallback 전체가 supporting에 포함되어야 함');
});

test('selection compositionSummary: relevance=false cpp_fallback만 있으면 supporting에 포함', () => {
  const nonRelevantCandidate = cppFallbackCandidate(0, false);
  const summary = compositionSummary([nonRelevantCandidate]);

  assert.equal(summary.cpp_fallback_camera_dev_relevant_count, 0);
  assert.equal(summary.supporting_main_article_count, 1);
});

test('selection reviewCompositionGatePasses 및 compositionMode: toggle=false이면 cpp_fallback은 supporting으로 정상 통과', () => {
  // toggle=false(기본값)이면 cpp_fallback은 supporting으로 분류되어 기존 게이트 통과 조건과 일치
  const primaryCount = Math.max(1, publishReadyCompositionPolicy.primaryCameraStackMinRequired);
  const primaryCandidates = Array.from({ length: primaryCount }, (_, index) =>
    policyPrimaryCandidate(index)
  );
  // cpp_fallback 1건 추가 — toggle=false이면 supporting으로 포함
  const cppCandidate = cppFallbackCandidate(0, true);
  cppCandidate.url = 'https://example.com/cpp-gate-test';

  const allCandidates = [...primaryCandidates, cppCandidate];
  const summary = compositionSummary(allCandidates);

  // toggle=false이면 cpp_fallback_camera_dev_relevant_count=0, supporting에 포함됨
  assert.equal(summary.cpp_fallback_camera_dev_relevant_count, 0,
    'toggle=false이면 메인 자격 카운트는 0이어야 함');
  // reviewCompositionGatePasses: primary + supporting + cppRel === selected 조건 검증 (H1 회귀 방지)
  assert.equal(reviewCompositionGatePasses(summary), true,
    'toggle=false에서 reviewCompositionGatePasses가 통과해야 함');
  // compositionMode가 NEEDS_FIX가 되지 않아야 함 (H1 회귀 방지)
  assert.notEqual(compositionMode(allCandidates, []), 'NEEDS_FIX',
    'toggle=false에서 compositionMode가 NEEDS_FIX가 되면 안 됨');
});

test('quality gate: toggle=false(기본값)이면 cpp_fallback 전체가 supporting에 포함', () => {
  // requiresCameraDevWorkflowRelevance=false이면 relevance 값에 상관없이 supporting으로 분류
  const relevantUrl = 'https://example.com/cpp-relevant-quality';
  const nonRelevantUrl = 'https://example.com/cpp-non-relevant-quality';
  const primaryUrl = 'https://example.com/primary-quality';

  const sections = [
    section({ headline: 'CameraX release', url: primaryUrl }),
    cppFallbackSection(0, relevantUrl, true),
    cppFallbackSection(1, nonRelevantUrl, false)
  ];

  const reporterCandidates = [
    scopedCandidate(primaryUrl, 'direct_aosp_camera'),
    cppFallbackReporterCandidate(relevantUrl, true),
    cppFallbackReporterCandidate(nonRelevantUrl, false)
  ];

  const report = buildNewsletterQualityReport(
    '2026-05-03',
    { briefing: ['one', 'two', 'three'], sections },
    { candidates: reporterCandidates },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 }
  );

  assert.equal(report.metrics.cpp_ai_tooling_fallback_count, 2, 'cpp_fallback 버킷 총 2건');
  // toggle=false이면 cpp_fallback 전체(2건)가 supporting으로 분류됨
  assert.equal(report.metrics.supporting_main_article_count, 2,
    'toggle=false이면 cpp_fallback 전체가 supporting에 포함되어야 함');
});

test('quality gate supportingMainArticleCount와 selection compositionSummary.supporting_main_article_count 일관성 (toggle=false)', () => {
  // toggle=false(기본값)이면 selection과 quality 모두 cpp_fallback을 supporting으로 포함
  const relevantUrl = 'https://example.com/cpp-relevant-cross';

  const selectionCandidates = [
    policyPrimaryCandidate(0),
    (() => {
      const candidate = cppFallbackCandidate(0, true);
      candidate.url = relevantUrl;
      return candidate;
    })()
  ];
  const selectionSummary = compositionSummary(selectionCandidates);

  const sections = [
    section({ headline: 'CameraX release', url: selectionCandidates[0].url }),
    cppFallbackSection(0, relevantUrl, true)
  ];
  const reporterCandidates = [
    scopedCandidate(selectionCandidates[0].url, 'direct_aosp_camera'),
    cppFallbackReporterCandidate(relevantUrl, true)
  ];
  const qualityReport = buildNewsletterQualityReport(
    '2026-05-03',
    { briefing: ['one', 'two', 'three'], sections },
    { candidates: reporterCandidates },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 }
  );

  // toggle=false이면 selection과 quality 모두 cpp_fallback이 supporting에 포함되어 카운트가 일치해야 함
  assert.equal(
    selectionSummary.supporting_main_article_count,
    qualityReport.metrics.supporting_main_article_count,
    'toggle=false에서 selection과 quality의 supporting 카운트가 동일해야 함'
  );

  // H3 toggle=false 케이스: cpp_fallback_camera_dev_relevant_count가 0이어야 함
  assert.equal(selectionSummary.cpp_fallback_camera_dev_relevant_count, 0,
    'toggle=false이면 cpp_fallback_camera_dev_relevant_count는 0이어야 함');
});

test('public-article isFallbackOnly: toggle=false(기본값)이면 relevance 값과 무관하게 cpp_fallback은 fallback-only', () => {
  // toggle=false이면 requiresCameraDevWorkflowRelevance 조건 미충족 → 조기 return 없이 fallback-only=true
  const relevantSection = {
    relevance_bucket: 'cpp_ai_tooling_fallback',
    camera_dev_workflow_relevance: true
  };
  const nonRelevantSection = {
    relevance_bucket: 'cpp_ai_tooling_fallback',
    camera_dev_workflow_relevance: false
  };
  const primarySection = {
    relevance_bucket: 'direct_aosp_camera',
    camera_dev_workflow_relevance: false
  };

  assert.equal(isFallbackOnly(primarySection), false, '주요 버킷은 fallback-only가 아님');
  assert.equal(isFallbackOnly(nonRelevantSection), true, 'relevance=false cpp_fallback은 fallback-only');
  // toggle=false이면 relevance=true여도 fallback-only (선택/품질과 일관성)
  assert.equal(isFallbackOnly(relevantSection), true, 'toggle=false이면 relevance=true cpp_fallback도 fallback-only');
});

// toggle=true 경로 회귀 가드 — requiresCameraDevWorkflowRelevance=true 정책 객체를 직접 주입하여 검증

test('toggle=true: isSupportingMainBucket — relevance=true cpp_fallback은 supporting이 아님(메인 자격)', () => {
  const togglePromotedPolicy = {
    ...getDefaultNewsletterPolicy(),
    cppFallbackMainPromotion: {
      ...getCppFallbackMainPromotionPolicy(),
      requiresCameraDevWorkflowRelevance: true
    }
  };

  assert.equal(
    isSupportingMainBucket('cpp_ai_tooling_fallback', togglePromotedPolicy, { cameraDevWorkflowRelevance: true }),
    false,
    'toggle=true + relevance=true이면 supporting이 아닌 메인 자격'
  );
  // relevance=false이면 toggle=true여도 supporting으로 분류
  assert.equal(
    isSupportingMainBucket('cpp_ai_tooling_fallback', togglePromotedPolicy, { cameraDevWorkflowRelevance: false }),
    true,
    'toggle=true + relevance=false이면 supporting으로 분류'
  );
});

test('toggle=true: compositionSummary 정책 주입 — cpp_fallback_camera_dev_relevant_count 차감 및 H1/H2 회귀 방지', () => {
  const togglePromotedPolicy = {
    ...getDefaultNewsletterPolicy(),
    cppFallbackMainPromotion: {
      ...getCppFallbackMainPromotionPolicy(),
      requiresCameraDevWorkflowRelevance: true
    }
  };

  const primaryCount = Math.max(1, publishReadyCompositionPolicy.primaryCameraStackMinRequired);
  const primaryCandidates = Array.from({ length: primaryCount }, (_, index) =>
    policyPrimaryCandidate(index)
  );
  const cppCandidate = cppFallbackCandidate(0, true);
  cppCandidate.url = 'https://example.com/cpp-toggle-true-injected';
  const allCandidates = [...primaryCandidates, cppCandidate];

  // H1: 정책 주입 후 compositionSummary가 cpp_fallback을 메인 자격으로 계상
  const summary = compositionSummary(allCandidates, togglePromotedPolicy);
  assert.equal(summary.cpp_fallback_camera_dev_relevant_count, 1,
    'toggle=true + relevance=true이면 메인 자격 카운트가 1이어야 함');
  assert.equal(summary.supporting_main_article_count, 0,
    'toggle=true이면 relevance=true cpp_fallback은 supporting에서 제외');
  // supporting + 메인자격카운트 = cpp_fallback 총수 (차감 일관성)
  assert.equal(
    summary.supporting_main_article_count + summary.cpp_fallback_camera_dev_relevant_count,
    summary.cpp_ai_tooling_fallback_count,
    'supporting + 메인자격카운트 = cpp_fallback 총수'
  );

  // H2: reviewCompositionGatePasses 통과 (NEEDS_FIX가 되면 안 됨)
  assert.equal(reviewCompositionGatePasses(summary), true,
    'toggle=true 정책 주입 후 reviewCompositionGatePasses가 통과해야 함');

  // H2: compositionMode가 NEEDS_FIX가 되지 않아야 함
  assert.notEqual(compositionMode(allCandidates, [], togglePromotedPolicy), 'NEEDS_FIX',
    'toggle=true 정책 주입 후 compositionMode가 NEEDS_FIX가 되면 안 됨');
});

test('toggle=true 정책 주입: quality supportingMainArticleCount에서 relevance=true cpp_fallback 차감 — H1/H2 통합 경로 검증', () => {
  const togglePromotedPolicy = {
    ...getDefaultNewsletterPolicy(),
    cppFallbackMainPromotion: {
      ...getCppFallbackMainPromotionPolicy(),
      requiresCameraDevWorkflowRelevance: true
    }
  };

  const primaryUrl = 'https://example.com/primary-quality-toggle';
  const relevantUrl = 'https://example.com/cpp-quality-toggle-relevant';

  const sections = [
    section({ headline: 'CameraX release', url: primaryUrl }),
    cppFallbackSection(0, relevantUrl, true)
  ];
  const reporterCandidates = [
    scopedCandidate(primaryUrl, 'direct_aosp_camera'),
    cppFallbackReporterCandidate(relevantUrl, true)
  ];

  // H1: toggle=true 정책 주입 시 quality 단계에서 cpp_fallback이 supporting에서 차감되어야 함
  const report = buildNewsletterQualityReport(
    '2026-05-03',
    { briefing: ['one', 'two', 'three'], sections },
    { candidates: reporterCandidates },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 },
    { cppFallbackMainPromotionPolicy: togglePromotedPolicy.cppFallbackMainPromotion }
  );

  assert.equal(report.metrics.supporting_main_article_count, 0,
    'toggle=true이면 relevance=true cpp_fallback은 supporting에서 제외되어야 함');

  // H2: compositionMode가 NEEDS_FIX가 되지 않아야 함
  assert.notEqual(report.metrics.composition_mode, 'NEEDS_FIX',
    'toggle=true 정책 주입 후 composition_mode가 NEEDS_FIX가 되면 안 됨');
});
