const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildGenerationStatus,
  failureStageFromError,
  validateCompletionSections
} = require('../scripts/gemini-newsroom-newsletter');

test('failure status includes required Gemini diagnostic fields', () => {
  const status = buildGenerationStatus({
    date: '2026-05-03',
    status: 'FAILED',
    failureStage: 'editor attempt 1/4',
    failureReason: 'Gemini output was not valid JSON.',
    retryHistory: [{ attempt: 1 }],
    qualityReport: {
      status: 'NEEDS_FIX',
      score: 86,
      threshold: 85,
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
  assert.equal(status.quality_score, 86);
  assert.equal(status.quality_threshold, 85);
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
