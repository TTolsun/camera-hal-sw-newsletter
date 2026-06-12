'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildGenerationStatusOutputs,
  readStatus,
  renderGithubOutputs
} = require('../../../../scripts/write-generation-status-output');
const {
  articlePolicy,
  headlinePolicy,
  publishReadyCompositionPolicy,
  qualityGatePolicy,
  selectionWindowPolicy,
  validateNewsletterPolicyConfig
} = require('../../common/newsletter-policy');
const {
  blockingIssues: llmPublicationQualityBlockingIssues,
  normalizeReport: normalizeLlmPublicationQualityReport,
  promptFor: llmPublicationQualityPromptFor
} = require('../../../generator/publish/validate-llm-publication-quality');

test('generation status output falls back when status JSON is missing', () => {
  const status = readStatus('__missing__/newsletter-generation-status.json');
  const outputs = buildGenerationStatusOutputs(status);

  assert.equal(outputs.status, 'UNKNOWN');
  assert.equal(outputs.must_fix_count, '0');
  assert.equal(outputs.quality_status, 'UNKNOWN');
  assert.equal(outputs.quality_score, 'n/a');
  assert.equal(outputs.quality_threshold, 'n/a');
  assert.equal(outputs.publish_ready, 'false');
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.review_gate_passed, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
});

test('newsletter policy validates candidate pool preflight thresholds', () => {
  const invalid = {
    schemaVersion: 1,
    name: 'Newsletter Policy',
    articlePolicy: {
      mainArticleCount: { min: 3, max: 5 },
      primaryCameraStack: {
        minRequired: 1,
        buckets: articlePolicy.primaryCameraStack.buckets
      },
      publishReadyComposition: publishReadyCompositionPolicy,
      supportingMainBuckets: articlePolicy.supportingMainBuckets,
      forbiddenMainBuckets: articlePolicy.forbiddenMainBuckets
    },
    candidatePoolPreflight: {
      reserveMin: 2,
      publishableCandidateMin: 4,
      primaryCameraStackCandidateMin: 1,
      cameraStackCandidateMin: 5
    },
    selectionWindowPolicy,
    headlinePolicy,
    qualityGatePolicy: {
      threshold: qualityGatePolicy.threshold,
      hardFailConditions: qualityGatePolicy.hardFailConditions
    }
  };

  const result = validateNewsletterPolicyConfig(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('candidatePoolPreflight.publishableCandidateMin must be >= articlePolicy.mainArticleCount.min + candidatePoolPreflight.reserveMin.'));
  assert.ok(result.errors.includes('candidatePoolPreflight.cameraStackCandidateMin must be <= candidatePoolPreflight.publishableCandidateMin.'));
});

test('newsletter policy validates selection window contract without enforcing selection behavior', () => {
  const base = {
    schemaVersion: 1,
    name: 'Newsletter Policy',
    articlePolicy: {
      mainArticleCount: { min: 3, max: 5 },
      primaryCameraStack: {
        minRequired: 1,
        buckets: articlePolicy.primaryCameraStack.buckets
      },
      publishReadyComposition: publishReadyCompositionPolicy,
      supportingMainBuckets: articlePolicy.supportingMainBuckets,
      forbiddenMainBuckets: articlePolicy.forbiddenMainBuckets
    },
    candidatePoolPreflight: {
      reserveMin: 2,
      publishableCandidateMin: 5,
      primaryCameraStackCandidateMin: 1,
      cameraStackCandidateMin: 2
    },
    selectionWindowPolicy: {
      primarySelectionDays: 7,
      fallbackSelectionDays: 21,
      referenceContextDays: 90
    },
    headlinePolicy,
    qualityGatePolicy: {
      threshold: qualityGatePolicy.threshold,
      hardFailConditions: qualityGatePolicy.hardFailConditions
    }
  };
  const withWindow = selectionWindow => ({
    ...base,
    selectionWindowPolicy: selectionWindow
  });

  assert.equal(validateNewsletterPolicyConfig(base).ok, true);
  assert.equal(validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 7,
    fallbackSelectionDays: 7,
    referenceContextDays: 90
  })).ok, true);
  assert.equal(validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 7,
    fallbackSelectionDays: 21,
    referenceContextDays: 21
  })).ok, true);
  assert.equal(validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 7,
    fallbackSelectionDays: 7,
    referenceContextDays: 7
  })).ok, true);

  const invalid = validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 22,
    fallbackSelectionDays: 21,
    referenceContextDays: 90
  }));
  const invalidReference = validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 7,
    fallbackSelectionDays: 91,
    referenceContextDays: 90
  }));
  const invalidValues = validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 0,
    fallbackSelectionDays: 1.5,
    referenceContextDays: '90'
  }));

  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes('selectionWindowPolicy.fallbackSelectionDays must be >= selectionWindowPolicy.primarySelectionDays.'));
  assert.equal(invalidReference.ok, false);
  assert.ok(invalidReference.errors.includes('selectionWindowPolicy.referenceContextDays must be >= selectionWindowPolicy.fallbackSelectionDays.'));
  assert.equal(invalidValues.ok, false);
  assert.ok(invalidValues.errors.includes('selectionWindowPolicy.primarySelectionDays must be an integer >= 1.'));
  assert.ok(invalidValues.errors.includes('selectionWindowPolicy.fallbackSelectionDays must be an integer >= 1.'));
  assert.ok(invalidValues.errors.includes('selectionWindowPolicy.referenceContextDays must be an integer >= 1.'));
});

test('newsletter policy validates publish-ready composition contract separately from review gate', () => {
  const base = {
    schemaVersion: 1,
    name: 'Newsletter Policy',
    articlePolicy: {
      mainArticleCount: { min: 3, max: 5 },
      primaryCameraStack: {
        minRequired: 1,
        buckets: articlePolicy.primaryCameraStack.buckets
      },
      publishReadyComposition: {
        primaryCameraStackMinRequired: 2,
        directAospCameraOrDriverMinRequired: 1,
        supportingMainMaxAllowed: 1
      },
      supportingMainBuckets: articlePolicy.supportingMainBuckets,
      forbiddenMainBuckets: articlePolicy.forbiddenMainBuckets
    },
    candidatePoolPreflight: {
      reserveMin: 2,
      publishableCandidateMin: 5,
      primaryCameraStackCandidateMin: 1,
      cameraStackCandidateMin: 2
    },
    selectionWindowPolicy,
    headlinePolicy,
    qualityGatePolicy: {
      threshold: qualityGatePolicy.threshold,
      hardFailConditions: qualityGatePolicy.hardFailConditions
    }
  };
  const withPublishReady = publishReadyComposition => ({
    ...base,
    articlePolicy: {
      ...base.articlePolicy,
      publishReadyComposition
    }
  });

  assert.equal(validateNewsletterPolicyConfig(base).ok, true);

  const invalidValues = validateNewsletterPolicyConfig(withPublishReady({
    primaryCameraStackMinRequired: 1.5,
    directAospCameraOrDriverMinRequired: '1',
    supportingMainMaxAllowed: -1
  }));
  const invalidPrimaryMax = validateNewsletterPolicyConfig(withPublishReady({
    primaryCameraStackMinRequired: 6,
    directAospCameraOrDriverMinRequired: 1,
    supportingMainMaxAllowed: 1
  }));
  const invalidDirect = validateNewsletterPolicyConfig(withPublishReady({
    primaryCameraStackMinRequired: 2,
    directAospCameraOrDriverMinRequired: 3,
    supportingMainMaxAllowed: 1
  }));
  const invalidSupporting = validateNewsletterPolicyConfig(withPublishReady({
    primaryCameraStackMinRequired: 2,
    directAospCameraOrDriverMinRequired: 1,
    supportingMainMaxAllowed: 6
  }));

  assert.equal(invalidValues.ok, false);
  assert.ok(invalidValues.errors.includes('articlePolicy.publishReadyComposition.primaryCameraStackMinRequired must be an integer >= 0.'));
  assert.ok(invalidValues.errors.includes('articlePolicy.publishReadyComposition.directAospCameraOrDriverMinRequired must be an integer >= 0.'));
  assert.ok(invalidValues.errors.includes('articlePolicy.publishReadyComposition.supportingMainMaxAllowed must be an integer >= 0.'));
  assert.equal(invalidPrimaryMax.ok, false);
  assert.ok(invalidPrimaryMax.errors.includes('articlePolicy.publishReadyComposition.primaryCameraStackMinRequired cannot exceed articlePolicy.mainArticleCount.max.'));
  assert.equal(invalidDirect.ok, false);
  assert.ok(invalidDirect.errors.includes('articlePolicy.publishReadyComposition.directAospCameraOrDriverMinRequired cannot exceed articlePolicy.publishReadyComposition.primaryCameraStackMinRequired.'));
  assert.equal(invalidSupporting.ok, false);
  assert.ok(invalidSupporting.errors.includes('articlePolicy.publishReadyComposition.supportingMainMaxAllowed cannot exceed articlePolicy.mainArticleCount.max.'));
});

test('generation status output includes multiline selection diagnostics', () => {
  const configuredMinimum = articlePolicy.mainArticleCount.min;
  const requiredPrimary = articlePolicy.primaryCameraStack.minRequired;
  const outputs = buildGenerationStatusOutputs({
    status: 'QUALITY_NEEDS_FIX',
    must_fix_count: 0,
    quality_status: 'NEEDS_FIX',
    quality_score: 90,
    quality_threshold: qualityGatePolicy.threshold,
    publish_ready: false,
    final_publish_ready: false,
    review_gate_passed: true,
    publish_gate_passed: false,
    min_final_articles: configuredMinimum,
    absolute_min_reviewable_articles: requiredPrimary,
    min_non_fallback_publish_ready_articles: configuredMinimum,
    composition_mode: 'NEEDS_FIX',
    editor_review_required: true,
    underfilled: true,
    deterministic_selected_count: 5,
    rendered_main_article_count: configuredMinimum,
    reserve_candidate_count: 4,
    stale_claim_status: 'PASS',
    stale_claim_removed_count: 2,
    stale_claim_hard_failure_count: 0,
    selected_article_count: configuredMinimum,
    final_selected_article_count: configuredMinimum,
    primary_camera_stack_topic_count: 0,
    supporting_main_article_count: configuredMinimum,
    forbidden_main_article_count: 0,
    non_fallback_reviewable_article_count: 1,
    eligible_non_fallback_reviewable_article_count: 1,
    selection_warnings: ['Newsletter Policy review path'],
    selection_shortage_hints: ['Add at least one Primary Camera Stack candidate before publishing.'],
    final_exclusion_reason_summary: [
      { reason: 'missing dated evidence', count: 4 },
      { reason: 'source_gap_risk=true', count: 2 }
    ]
  });
  const rendered = renderGithubOutputs(outputs);

  assert.equal(outputs.final_selected_article_count_for_gate, String(configuredMinimum));
  assert.equal(outputs.composition_mode, 'NEEDS_FIX');
  assert.equal(outputs.editor_review_required, 'true');
  assert.equal(outputs.deterministic_selected_count, '5');
  assert.equal(outputs.rendered_main_article_count, String(configuredMinimum));
  assert.equal(outputs.reserve_candidate_count, '4');
  assert.equal(outputs.stale_claim_status, 'PASS');
  assert.equal(outputs.stale_claim_removed_count, '2');
  assert.equal(outputs.stale_claim_hard_failure_count, '0');
  assert.equal(outputs.non_fallback_reviewable_article_count, '1');
  assert.equal(outputs.eligible_non_fallback_reviewable_article_count, '1');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.publish_gate_passed, 'false');
  assert.equal(outputs.min_final_articles, String(configuredMinimum));
  assert.equal(outputs.absolute_min_reviewable_articles, String(requiredPrimary));
  assert.equal(outputs.min_non_fallback_publish_ready_articles, String(configuredMinimum));
  assert.equal(outputs.primary_camera_stack_topic_count, '0');
  assert.equal(outputs.supporting_main_article_count, String(configuredMinimum));
  assert.equal(outputs.forbidden_main_article_count, '0');
  assert.match(rendered, /candidate_selection_diagnostics<<EOF/);
  assert.match(rendered, /missing dated evidence \(4\)/);
  assert.match(rendered, /selection_warnings=Newsletter Policy review path/);
  assert.match(rendered, /selection_shortage_hints=Add at least one Primary Camera Stack candidate before publishing\./);
});

test('LLM publication quality prompt judges final public artifacts only', () => {
  const prompt = llmPublicationQualityPromptFor('2026-05-27', {
    entry: { date: '2026-05-27', title: 'Camera HAL / SW Newsletter - 2026-05-27' },
    statusSummary: {
      publication_mode: 'fallback_public',
      run_mode: 'review_only_public'
    },
    markdown: '# Rendered public issue\n\nPublic article body.',
    html: '<html><body><article>Rendered public HTML.</article></body></html>'
  });

  assert.match(prompt, /final rendered public newsletter artifacts/);
  assert.match(prompt, /not intermediate editor drafts/);
  assert.match(prompt, /fallback_public \/ review_only_public/);
  assert.match(prompt, /Rendered public issue/);
  assert.match(prompt, /Rendered public HTML/);
});

test('LLM publication quality report fail-closes unknown issue severity', () => {
  const report = normalizeLlmPublicationQualityReport({
    date: '2026-05-27',
    overall_pass: true,
    summary: 'Reviewable with blocking issue severities.',
    issues: [
      {
        field: 'summary',
        severity: 'p3',
        reason: 'Minor wording polish.'
      },
      {
        field: 'sources',
        severity: 'p2',
        reason: 'A public source link is missing.'
      },
      {
        field: 'public_artifacts',
        severity: 'BLOCKER',
        reason: 'Unknown severity must not be treated as non-blocking.'
      }
    ]
  }, '2026-05-27');

  assert.equal(report.issues[0].severity, 'P3');
  assert.equal(report.issues[1].severity, 'P2');
  assert.equal(report.issues[2].severity, 'BLOCKER');
  assert.deepEqual(
    llmPublicationQualityBlockingIssues(report).map(issue => issue.field),
    ['sources', 'public_artifacts']
  );
});
