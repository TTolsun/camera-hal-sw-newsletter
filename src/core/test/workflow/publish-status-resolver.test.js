'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsroomPrBody
} = require('../../../../scripts/build-newsroom-pr-body');
const {
  articlePolicy,
  qualityGatePolicy,
  publishReadyCompositionPolicy
} = require('../../common/newsletter-policy');
const {
  resolvePublishStatus
} = require('../../../generator/reporter/publish-status');
const {
  buildHtml,
  buildMarkdown,
  issueTags
} = require('../../../generator/render/newsletter-renderer');
const {
  publicationDecisionForSections
} = require('../../common/publication-mode');
const {
  buildPublishStatusOutputs
} = require('../../../../scripts/write-publish-status-output');
const {
  tempRoot: fsTempRoot,
  writeText
} = require('../helpers/fs');
const {
  regressionCandidate,
  regressionSection,
  writeFailedRawArtifactValidationArtifacts,
  writeFailedRepairReviewableArtifacts,
  writeMinimalPublishArtifacts
} = require('../helpers/workflow-fixtures');

test('publication mode uses final bound candidate bucket over stale section bucket', () => {
  const decision = publicationDecisionForSections([{
    relevance_bucket: 'android_platform_camera_adjacent',
    bound_candidate: {
      relevance_bucket: 'cpp_ai_tooling_fallback'
    },
    public_article: {
      headline: 'C++ tooling fallback'
    }
  }], {
    publicNewsletterReady: true,
    finalPublishReady: false
  });

  assert.equal(decision.camera_anchor_count, 0);
  assert.equal(decision.fallback_only, true);
  assert.equal(decision.publication_mode, 'fallback_public');
  assert.equal(decision.homepage_visibility, 'visible_with_fallback_badge');
});

test('publication mode treats no-anchor public-quality technical sections as fallback_public', () => {
  const decision = publicationDecisionForSections([{
    relevance_bucket: 'soc_platform_signal',
    public_article: {
      headline: 'Technical platform watch'
    }
  }], {
    publicNewsletterReady: true,
    finalPublishReady: false
  });

  assert.equal(decision.camera_anchor_count, 0);
  assert.equal(decision.fallback_section_count, 0);
  assert.equal(decision.fallback_only, true);
  assert.equal(decision.publication_mode, 'fallback_public');
  assert.equal(decision.homepage_visibility, 'visible_with_fallback_badge');
});

test('fallback issue tags remove Camera HAL when camera_anchor_count is string zero', () => {
  assert.deepEqual(
    issueTags({
      publication_mode: 'fallback_public',
      camera_anchor_count: '0',
      tags: ['Camera HAL', 'Android']
    }),
    ['Tooling Watch Edition', 'Tooling Watch', 'Android']
  );
});

test('review-only public issue keeps review publication notice', () => {
  const date = '2026-05-13';
  const candidate = regressionCandidate({
    title: 'CameraX validation release',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#review-only',
    bucket: 'android_platform_camera_adjacent'
  });
  const issue = {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: '검토 발행본입니다.',
    briefing: ['Camera anchor가 남아 있습니다.', '공개 source 범위 안에서 해석합니다.', 'Camera HAL 직접 변경으로 과장하지 않습니다.'],
    publication_mode: 'review_only',
    review_publication_ready: true,
    fallback_only: false,
    camera_anchor_count: 1,
    tags: ['Camera HAL', 'Android'],
    sections: [regressionSection(candidate)],
    references: [{
      title: 'Android Developers Camera',
      url: candidate.url
    }]
  };

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);

  assert.match(markdown, /검토 발행본/);
  assert.match(html, /class="publication-notice"/);
  assert.match(html, /검토 발행본/);
  const markdownNotice = markdown.match(/(?:^> .*(?:\n|$))+/m)?.[0] || '';
  const htmlNotice = html.match(/<div class="publication-notice"[\s\S]*?<\/div>/)?.[0] || '';
  assert.doesNotMatch(`${markdownNotice}\n${htmlNotice}`, /Review-only|quality gate|guardrail|fallback|자동 정상 발행|편집자 확인 후 merge|merge해야/);
});

test('fallback_public renderer uses tooling perspective label', () => {
  const date = '2026-05-14';
  const candidate = regressionCandidate({
    title: 'LLVM native sanitizer workflow',
    url: 'https://isocpp.org/blog/2026/05/llvm-native-sanitizer-workflow',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const issue = {
    date,
    title: `Tooling Watch Edition - ${date}`,
    summary: 'Tooling Watch Edition issue',
    briefing: ['Tooling watch item입니다.', 'Camera anchor는 없습니다.', '편집자 검토가 필요합니다.'],
    publication_mode: 'fallback_public',
    fallback_only: true,
    camera_anchor_count: 0,
    tags: ['Tooling Watch Edition', 'Tooling Watch'],
    sections: [regressionSection(candidate)],
    references: [{
      title: 'ISO C++',
      url: candidate.url
    }]
  };

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);

  assert.match(markdown, /### Camera HAL\/Driver 관점에서의 의미/);
  assert.match(html, /Camera HAL\/Driver 관점에서의 의미/);
  assert.doesNotMatch(markdown, /### Android Native \/ Tooling 관점에서 확인할 점/);
});

test('publish status resolver blocks final publish when fact-check needs fix', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'source gap remains' }]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_status, 'PASS');
  assert.equal(resolved.status.fact_check_status, 'NEEDS_FIX');
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.fact_check_status_pass, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.must_fix_count_zero, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver does not flag a null status.final_publish_ready as a consistency error', () => {
  // An editor-semantic failure (FAILED_EDITOR_REVIEWABLE) can leave
  // final_publish_ready unset (null) in generation-status.json. A null is
  // "undetermined", not a claim, so it must not contradict the reconciler's
  // authoritative artifact_final_publish_ready=false and hard-fail the PR body.
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    status: {
      status: 'FAILED_EDITOR_REVIEWABLE',
      final_publish_ready: null,
      quality_status: 'NEEDS_FIX',
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    quality: { status: 'NEEDS_FIX', score: 10 },
    factCheck: { status: 'NEEDS_FIX', must_fix: [{ issue: 'editor capsule invalid' }], source_gap_count: 1 }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });

  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver blocks PUBLISH_READY when quality hard fail remains above threshold', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  const highScore = qualityGatePolicy.threshold + 5;
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      quality_status: 'NEEDS_FIX',
      quality_score: highScore
    },
    quality: {
      status: 'NEEDS_FIX',
      score: highScore,
      deductions: [
        {
          category: 'source-integrity',
          points: 8,
          reason: 'Main article source maps to ineligible reporter/shortlist candidate: source_gap_risk=true.',
          blocking: true
        }
      ]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_score >= qualityGatePolicy.threshold, true);
  assert.equal(resolved.status.quality_status, 'NEEDS_FIX');
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.quality_status_pass, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.quality_score_meets_threshold, true);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver blocks PUBLISH_READY when source_gap remains above threshold', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      source_gap_count: 1
    },
    factCheck: {
      status: 'PASS',
      must_fix: [],
      source_gaps: [{ issue: 'missing article-level source evidence' }],
      source_gap_count: 1
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_score >= qualityGatePolicy.threshold, true);
  assert.equal(resolved.status.fact_check_status, 'PASS');
  assert.equal(resolved.status.source_gap_count, 1);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.source_gap_count_zero, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver blocks PUBLISH_READY when stale claim hard failure remains above threshold', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      stale_claim_status: 'NEEDS_FIX',
      stale_claim_hard_failure_count: 1
    },
    staleClaim: {
      status: 'NEEDS_FIX',
      hard_failures: [{ reason: 'removed-section-claim-remains' }]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_score >= qualityGatePolicy.threshold, true);
  assert.equal(resolved.status.stale_claim_status, 'NEEDS_FIX');
  assert.equal(resolved.status.stale_claim_hard_failure_count, 1);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.stale_claim_status_not_needs_fix, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.stale_claim_hard_failure_count_zero, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver blocks PUBLISH_READY when article count policy gate is not publish-ready above threshold', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      selection_publish_ready: false,
      publish_ready: false,
      publish_gate_passed: false,
      selected_article_count: articlePolicy.mainArticleCount.min - 1,
      final_selected_article_count: articlePolicy.mainArticleCount.min - 1
    },
    shortlist: {
      publish_ready: false,
      publish_gate_passed: false,
      composition_mode: 'NEEDS_FIX',
      selected_article_count: articlePolicy.mainArticleCount.min - 1
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_score >= qualityGatePolicy.threshold, true);
  assert.equal(resolved.status.selection_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.selection_publish_ready, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver keeps site validation failure out of consistency errors', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });

  assert.equal(resolved.status.artifact_final_publish_ready, true);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.validation_passed, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.validate_outcome_success, undefined);
  assert.equal(resolved.status.final_publish_ready_conditions.validate_outcome_success, false);
});

test('publish status resolver ignores status final mismatch caused only by validation failure', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      validate_ok: false
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });

  assert.equal(resolved.status.artifact_final_publish_ready, true);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver records consistency error when status final flag is stale', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'unresolved must_fix' }]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /status\.final_publish_ready=true but artifact_final_publish_ready=false/);
});

test('publish status resolver treats FAILED_REPAIR_REVIEWABLE artifacts as reviewable but not publish-ready', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });
  const outputs = buildPublishStatusOutputs(resolved);

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'NEEDS_FIX');
  assert.equal(resolved.status.review_gate_passed, true);
  assert.equal(resolved.status.publish_gate_passed, false);
  assert.equal(resolved.status.publish_ready, false);
  assert.equal(resolved.status.selection_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.composition_mode, 'NEEDS_FIX');
  assert.equal(resolved.status.consistency_errors.length, 0);
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.composition_mode, 'NEEDS_FIX');
});

test('publish status resolver does not promote FAILED_REPAIR_REVIEWABLE without canonical artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date, {
    writeEditor: false
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'FAILED');
  assert.equal(resolved.status.review_gate_passed, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /Missing reviewable repair artifact: content\/newsroom\/2026-05-08\/editor-draft\.json/);
});

test('publish status resolver does not promote FAILED_REPAIR_REVIEWABLE with invalid canonical artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);
  writeText(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), '{ invalid json');

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'FAILED');
  assert.equal(resolved.status.review_gate_passed, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /Could not read content\/newsroom\/2026-05-08\/editor-draft\.json/);
});

test('publish status resolver does not promote FAILED_RAW_ARTIFACT_VALIDATION to final_publish_ready', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRawArtifactValidationArtifacts(root, date);

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });
  const outputs = buildPublishStatusOutputs(resolved);

  assert.equal(resolved.status.generation_status, 'FAILED_RAW_ARTIFACT_VALIDATION');
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
});

test('publish status resolver preserves reviewable-but-not-publish-ready reason diagnostics', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  const reasonSummary = [
    {
      code: 'publish_ready_primary_camera_stack_shortage',
      actual: articlePolicy.primaryCameraStack.minRequired,
      required: publishReadyCompositionPolicy.primaryCameraStackMinRequired
    }
  ];
  writeMinimalPublishArtifacts(root, date, {
    status: {
      selection_publish_ready: false,
      publish_gate_passed: false,
      publish_gate_reason_codes: reasonSummary.map(item => item.code),
      publish_gate_reason_summary: reasonSummary,
      composition_mode: 'FALLBACK_COMPOSITION',
      selection_composition_mode: 'FALLBACK_COMPOSITION'
    },
    shortlist: {
      publish_ready: false,
      publish_gate_passed: false,
      review_gate_passed: true,
      publish_gate_reason_codes: reasonSummary.map(item => item.code),
      publish_gate_reason_summary: reasonSummary,
      composition_mode: 'FALLBACK_COMPOSITION',
      selection_composition_mode: 'FALLBACK_COMPOSITION'
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });
  const outputs = buildPublishStatusOutputs(resolved);
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.selection_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.review_gate_passed, true);
  assert.equal(resolved.status.publish_gate_passed, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
  assert.deepEqual(resolved.status.publish_gate_reason_codes, ['publish_ready_primary_camera_stack_shortage']);
  assert.deepEqual(resolved.status.publish_gate_reason_summary, reasonSummary);
  assert.equal(outputs.publish_gate_reason_codes, 'publish_ready_primary_camera_stack_shortage');
  assert.equal(
    outputs.publish_gate_reason_summary,
    `publish_ready_primary_camera_stack_shortage actual=${articlePolicy.primaryCameraStack.minRequired} required=${publishReadyCompositionPolicy.primaryCameraStackMinRequired}`
  );
  assert.match(body, /review_gate_passed: true/);
  assert.match(body, /publish_gate_passed: false/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /publish_ready_primary_camera_stack_shortage/);
  assert.match(body, new RegExp(`actual=${articlePolicy.primaryCameraStack.minRequired} required=${publishReadyCompositionPolicy.primaryCameraStackMinRequired}`));
});

test('publish status and PR body render direct driver and supporting publish gate reasons', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  const reasonSummary = [
    {
      code: 'publish_ready_direct_camera_or_driver_shortage',
      actual: 0,
      required: publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired
    },
    {
      code: 'publish_ready_supporting_main_over_limit',
      actual: publishReadyCompositionPolicy.supportingMainMaxAllowed + 1,
      required: publishReadyCompositionPolicy.supportingMainMaxAllowed
    }
  ];
  writeMinimalPublishArtifacts(root, date, {
    status: {
      selection_publish_ready: false,
      publish_gate_passed: false,
      publish_gate_reason_codes: reasonSummary.map(item => item.code),
      publish_gate_reason_summary: reasonSummary
    },
    shortlist: {
      publish_ready: false,
      publish_gate_passed: false,
      review_gate_passed: true,
      publish_gate_reason_codes: reasonSummary.map(item => item.code),
      publish_gate_reason_summary: reasonSummary
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });
  const outputs = buildPublishStatusOutputs(resolved);
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });

  assert.equal(
    outputs.publish_gate_reason_codes,
    'publish_ready_direct_camera_or_driver_shortage; publish_ready_supporting_main_over_limit'
  );
  assert.match(
    outputs.publish_gate_reason_summary,
    new RegExp(`publish_ready_direct_camera_or_driver_shortage actual=0 required=${publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired}`)
  );
  assert.match(
    outputs.publish_gate_reason_summary,
    new RegExp(`publish_ready_supporting_main_over_limit actual=${publishReadyCompositionPolicy.supportingMainMaxAllowed + 1} required=${publishReadyCompositionPolicy.supportingMainMaxAllowed}`)
  );
  assert.match(body, /publish_ready_direct_camera_or_driver_shortage/);
  assert.match(body, /publish_ready_supporting_main_over_limit/);
  assert.match(body, /publish_gate_reason_codes: publish_ready_direct_camera_or_driver_shortage; publish_ready_supporting_main_over_limit/);
  assert.match(body, new RegExp(`publish_ready_direct_camera_or_driver_shortage actual=0 required=${publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired}`));
  assert.match(body, new RegExp(`publish_ready_supporting_main_over_limit actual=${publishReadyCompositionPolicy.supportingMainMaxAllowed + 1} required=${publishReadyCompositionPolicy.supportingMainMaxAllowed}`));
});

test('publish status output renders final and artifact readiness fields', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });
  const outputs = buildPublishStatusOutputs(resolved);

  assert.equal(outputs.artifact_final_publish_ready, 'true');
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.has_ai_publish_ready, 'false');
  assert.equal(outputs.selection_publish_ready, 'true');
  assert.equal(outputs.publish_gate_passed, 'true');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.validate_outcome, 'failure');
  assert.equal(outputs.quality_status, 'PASS');
  assert.equal(outputs.fact_check_status, 'PASS');
  assert.equal(outputs.must_fix_count, '0');
  assert.equal(outputs.source_gap_count, '0');
  assert.equal(outputs.stale_claim_status, 'PASS');
  assert.equal(outputs.stale_claim_hard_failure_count, '0');
  assert.equal(outputs.consistency_error_count, '0');
  assert.equal(outputs.consistency_errors, 'none');
  assert.equal(outputs.composition_mode, 'NORMAL');
  assert.equal(outputs.selection_composition_mode, 'NORMAL');
});
