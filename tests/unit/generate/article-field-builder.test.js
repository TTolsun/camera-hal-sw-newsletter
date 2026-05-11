const assert = require('node:assert/strict');
const test = require('node:test');

const {
  IMPACT_CLAIM_LEVELS,
  buildConfirmedFacts,
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

test('confirmed facts use Korean source-fact labels and exclude internal classification', () => {
  const facts = buildConfirmedFacts(cameraXCandidate({
    impact_claim_level: 'android_framework_adjacent',
    source_gap_risk: true
  }));
  const joined = facts.join('\n');

  assert.match(joined, /Android Developers가 2026-05-06에 게시 또는 업데이트한 항목입니다\./);
  assert.match(joined, /버전\/릴리스: 1\.6\.1\./);
  assert.match(joined, /관련 컴포넌트: androidx\.camera\./);
  assert.match(joined, /확인된 변경점:/);
  assert.doesNotMatch(joined, /Relevance bucket|relevance_bucket|impact_claim_level|source_gap_risk/);
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

test('SoC platform signal stays watch-only unless camera pipeline evidence is present', () => {
  assert.equal(
    inferImpactClaimLevel({
      title: 'Tensor G6 improves NPU power management',
      summary: 'The platform update changes CPU, GPU, NPU, power, and thermal behavior.',
      relevance_bucket: 'soc_platform_signal'
    }),
    IMPACT_CLAIM_LEVELS.WATCH_ONLY
  );
  assert.equal(
    inferImpactClaimLevel({
      title: 'Tensor ISP update improves image sensor pipeline',
      summary: 'The platform update names ISP, image sensor, MIPI CSI, and camera pipeline behavior.',
      relevance_bucket: 'soc_platform_signal'
    }),
    IMPACT_CLAIM_LEVELS.CAMERA_STACK_DIRECT
  );
});

test('field hygiene rejects internal classification in confirmed facts', () => {
  const issues = findFieldHygieneIssues({
    what_changed: 'CameraX 1.6.1 updated app-facing compatibility behavior.',
    background: 'CameraX is an Android framework layer above Camera2.',
    camera_hal_perspective: 'Use this as a CameraX compatibility signal.',
    confirmed_facts: [
      'Android Developers가 2026-05-06에 게시 또는 업데이트한 항목입니다.',
      'Relevance bucket: android_platform_camera_adjacent.',
      'impact_claim_level=android_framework_adjacent.',
      'source_gap_risk=false.'
    ],
    impact_claim_level: IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT
  });

  assert.ok(issues.some(item => item.type === 'internal_classification_in_confirmed_facts'));
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
