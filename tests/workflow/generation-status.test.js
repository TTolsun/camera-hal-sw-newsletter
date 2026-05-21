const assert = require('node:assert/strict');
const test = require('node:test');

const {
  backgroundContextStageEnabled,
  buildGenerationStatus,
  failureStageFromError,
  selectionStatusExtra,
  validateCompletionSections
} = require('../../scripts/gemini-newsroom-newsletter');
const { qualityGatePolicy } = require('../../scripts/lib/newsletter-policy');
const { backgroundContextSchema } = require('../../scripts/newsroom/render/newsletter-schema');

test('failure status includes required Gemini diagnostic fields', () => {
  const status = buildGenerationStatus({
    date: '2026-05-03',
    status: 'FAILED',
    failureStage: 'editor attempt 1/4',
    failureReason: 'Gemini output was not valid JSON.',
    retryHistory: [{ attempt: 1 }],
    qualityReport: {
      status: 'NEEDS_FIX',
      score: qualityGatePolicy.threshold + 1,
      threshold: qualityGatePolicy.threshold,
      deductions: [{ category: 'composition', points: 4 }]
    },
    factCheck: {
      status: 'PASS',
      must_fix: []
    }
  });

  assert.equal(status.status, 'FAILED');
  assert.equal(status.failure_stage, 'editor attempt 1/4');
  assert.equal(status.failure_reason, 'Gemini output was not valid JSON.');
  assert.equal(status.quality_attempt_count, 1);
  assert.equal(status.quality_score, qualityGatePolicy.threshold + 1);
  assert.equal(status.quality_threshold, qualityGatePolicy.threshold);
  assert.equal(typeof status.quota_error_count, 'number');
  assert.equal(typeof status.invalid_json_count, 'number');
  assert.equal(typeof status.model_usage, 'object');
});

test('failure stage is extracted from bracketed Gemini errors', () => {
  assert.equal(
    failureStageFromError(new Error('[fact-checker attempt 1/4] Gemini API failed.')),
    'fact-checker attempt 1/4'
  );
});

test('background context stage defaults to Gemini unless explicitly disabled', () => {
  assert.equal(backgroundContextStageEnabled({}), true);
  assert.equal(backgroundContextStageEnabled({ NEWSROOM_BACKGROUND_CONTEXT_STAGE: '' }), true);
  assert.equal(backgroundContextStageEnabled({ NEWSROOM_BACKGROUND_CONTEXT_STAGE: 'gemini' }), true);
  assert.equal(backgroundContextStageEnabled({ NEWSROOM_BACKGROUND_CONTEXT_STAGE: 'true' }), true);
  assert.equal(backgroundContextStageEnabled({ NEWSROOM_BACKGROUND_CONTEXT_STAGE: 'static' }), false);
  assert.equal(backgroundContextStageEnabled({ NEWSROOM_BACKGROUND_CONTEXT_STAGE: 'false' }), false);
});

test('background context schema requires identity fields for stable matching', () => {
  const required = new Set(backgroundContextSchema.properties.background_contexts.items.required);
  for (const field of [
    'title',
    'url',
    'source_candidate_hash',
    'impact_claim_level',
    'background_context',
    'background_basis',
    'background_confidence',
    'background_warnings'
  ]) {
    assert.equal(required.has(field), true, `${field} should be required`);
  }
});

test('editorial reviewable status records non-publish handoff fields', () => {
  const status = buildGenerationStatus({
    date: '2026-05-09',
    status: 'NEEDS_FIX',
    retryHistory: [{ attempt: 1 }],
    qualityReport: {
      status: 'NEEDS_FIX',
      score: qualityGatePolicy.threshold - 3,
      threshold: qualityGatePolicy.threshold,
      deductions: [{ category: 'source-integrity', points: 15 }]
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'editorial repair needed' }]
    },
    extra: {
      failure_kind: 'editorial_reviewable',
      final_publish_ready: false,
      validate_ok: false,
      editor_review_required: true
    }
  });

  assert.equal(status.status, 'NEEDS_FIX');
  assert.equal(status.failure_kind, 'editorial_reviewable');
  assert.equal(status.final_publish_ready, false);
  assert.equal(status.validate_ok, false);
  assert.equal(status.editor_review_required, true);
  assert.equal(status.must_fix_count, 1);
});

test('selection status fallback enforces supporting main publish-ready maximum', () => {
  const status = selectionStatusExtra({
    selected_article_count: 2,
    selected_articles: [
      { relevance_bucket: 'soc_platform_signal' },
      { relevance_bucket: 'android_multimedia_camera_output' }
    ],
    composition_summary: {
      primary_camera_stack_topic_count: 0,
      supporting_main_article_count: 2,
      forbidden_main_article_count: 0,
      direct_aosp_camera_count: 0,
      camera_driver_image_pipeline_count: 0
    },
    candidate_pool_preflight_passed: true,
    candidate_shortage_reviewable: false,
    candidate_shortage_summary: {
      publishable_candidate_count: 2,
      required_publishable_candidate_count: 1,
      reserve_candidate_count: 0,
      required_reserve_candidate_count: 0
    }
  });

  assert.equal(status.publish_gate_passed, false);
});

test('completion validation accepts a single missing article section', () => {
  const sections = validateCompletionSections({
    sections: [{
      category: 'Android Camera',
      headline: 'CameraX 1.5 release gives HAL teams a compatibility check target',
      what_changed: 'CameraX 1.5 was published with camera behavior changes relevant to device validation.',
      confirmed_facts: ['CameraX 1.5 release is the source event.'],
      evidence_summary: 'CameraX 1.5 release note, API/component: CameraX, behavior: compatibility validation target.',
      specificity_checks: ['Version: CameraX 1.5', 'Component: CameraX'],
      source_verification_notes: ['Official release note source.'],
      background: 'CameraX sits above camera2 and exposes compatibility regressions that can map back to HAL behavior.',
      why_it_matters: 'HAL teams can use this as a two-week regression check input.',
      camera_hal_perspective: 'Check request/result metadata, stream combinations, and Camera ITS deltas on representative devices.',
      camera_hal_checks: ['Run Camera ITS focused scenes on CameraX-backed capture paths.'],
      action_items: ['Within 2 weeks, assign a camera owner to compare Camera ITS logs before and after CameraX 1.5.'],
      team_summary: 'Use CameraX 1.5 as a concrete compatibility validation trigger.',
      is_ai_related: false,
      article_type: 'camera-hal',
      imageCandidates: [],
      selectedImage: '',
      imageSource: '',
      imageAttribution: '',
      imageAlt: '',
      imageLicenseStatus: 'none',
      imageUsageDecisionReason: 'No suitable attributed image selected.',
      sources: [{
        title: 'CameraX 1.5 release notes',
        url: 'https://developer.android.com/jetpack/androidx/releases/camera'
      }]
    }]
  }, '2026-05-03', { candidates: [] });

  assert.equal(sections.length, 1);
  assert.equal(sections[0].sources.length, 1);
  assert.equal(sections[0].selectedImage, '');
});
