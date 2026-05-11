const assert = require('node:assert/strict');
const test = require('node:test');

const {
  IMPACT_CLAIM_LEVELS,
  buildHalPerspective,
  buildOverclaimGuardrails,
  buildStaticBackgroundContext,
  cleanBehaviorChange,
  findFieldHygieneIssues,
  inferImpactClaimLevel
} = require('../../../scripts/newsroom/generate/article-field-builder');

function cameraXCandidate(overrides = {}) {
  return {
    title: 'CameraX May 06, 2026 release',
    source: 'Android Developers',
    published_date: '2026-05-06',
    version_or_release: '1.6.1',
    api_or_component: 'androidx.camera',
    relevance_bucket: 'android_platform_camera_adjacent',
    aosp_camera_directness: 2,
    behavior_change: 'camera-view 1.6.1 - - 1.7.0-alpha01 camera-viewfinder - - 1.3.0-beta02 1.4.0-alpha07 camera-video 1.6.1 - - 1.7.0-alpha01 This library was last updated on: May 06, 2026 View the Camera Library Close Wear Maven Group vers',
    ...overrides
  };
}

test('cleanBehaviorChange removes raw CameraX table and UI artifacts', () => {
  const result = cleanBehaviorChange(cameraXCandidate());

  assert.doesNotMatch(result.text, /View the Camera Library Close/);
  assert.doesNotMatch(result.text, /Maven Group/);
  assert.ok(result.removed_fragments.length > 0);
  assert.ok(result.warnings.includes('raw_ui_or_table_artifact_removed'));
  assert.ok(result.warnings.includes('behavior_fallback_from_metadata'));
});

test('static background stays separate from cleaned behavior', () => {
  const candidate = cameraXCandidate();
  const cleaned = cleanBehaviorChange(candidate);
  const background = buildStaticBackgroundContext(candidate);

  assert.notEqual(background, cleaned.text);
  assert.match(background, /CameraX|Camera2/);
  assert.doesNotMatch(background, /camera-viewfinder/);
});

test('impact_claim_level controls HAL perspective strength', () => {
  const direct = buildHalPerspective({
    relevance_bucket: 'direct_aosp_camera',
    aosp_camera_directness: 5,
    impact_claim_level: IMPACT_CLAIM_LEVELS.DIRECT_HAL_CHANGE
  });
  const adjacent = buildHalPerspective(cameraXCandidate());
  const tooling = buildHalPerspective({
    relevance_bucket: 'cpp_ai_tooling_fallback'
  });

  assert.match(direct, /HAL API|metadata|request\/result|stream|buffer/);
  assert.match(adjacent, /CameraX|Camera2/);
  assert.match(tooling, /build|test|debug|tooling/);
  assert.equal(inferImpactClaimLevel(cameraXCandidate()), IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT);
});

test('overclaim guardrails and field hygiene catch direct HAL overclaim', () => {
  const guardrails = buildOverclaimGuardrails(cameraXCandidate());
  const issues = findFieldHygieneIssues({
    what_changed: 'CameraX 1.6.1 updated app-facing compatibility behavior.',
    background: 'CameraX is an Android framework layer above Camera2.',
    camera_hal_perspective: 'This is a direct HAL API contract change for stream buffers.',
    impact_claim_level: IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT
  });

  assert.ok(guardrails.some(item => item.includes('direct HAL API')));
  assert.ok(issues.some(item => item.type === 'overclaim_guardrail'));
});
