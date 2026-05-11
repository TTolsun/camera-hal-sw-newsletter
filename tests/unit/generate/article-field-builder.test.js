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

test('field hygiene detects Korean direct HAL overclaims for non-direct impact levels', () => {
  for (const camera_hal_perspective of [
    '이 항목은 직접 HAL API 변경입니다.',
    'HAL 메타데이터 contract 변경입니다.',
    'HAL stream buffer contract 변경입니다.',
    'HAL request/result에 직접 영향이 있습니다.'
  ]) {
    const issues = findFieldHygieneIssues({
      what_changed: 'CameraX compatibility behavior changed.',
      background: 'CameraX is above Camera2.',
      camera_hal_perspective,
      impact_claim_level: IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT
    });
    const overclaim = issues.find(item => item.type === 'overclaim_guardrail');
    assert.ok(overclaim, `${camera_hal_perspective} should be detected`);
    assert.equal(overclaim.severity, 'hard');
    assert.equal(overclaim.blocking, true);
  }
});

test('field hygiene allows direct HAL claims only for direct_hal_change impact level', () => {
  const directIssues = findFieldHygieneIssues({
    what_changed: 'Camera HAL changed request behavior.',
    background: 'The source is a direct HAL change.',
    camera_hal_perspective: '이 항목은 직접 HAL API 변경이며 HAL buffer contract 변경입니다.',
    impact_claim_level: IMPACT_CLAIM_LEVELS.DIRECT_HAL_CHANGE
  });
  const adjacentIssues = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    background: 'CameraX is above Camera2.',
    camera_hal_perspective: 'This is direct HAL API behavior.',
    impact_claim_level: IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT
  });

  assert.equal(directIssues.some(item => item.type === 'overclaim_guardrail'), false);
  assert.equal(adjacentIssues.some(item => item.type === 'overclaim_guardrail'), true);
});

test('field hygiene does not treat standalone stream buffer request result or guardrails as overclaim', () => {
  const standalone = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    background: 'CameraX is above Camera2.',
    camera_hal_perspective: 'stream buffer request/result 관찰 포인트입니다.',
    impact_claim_level: IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT
  });
  const guardrail = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    background: 'CameraX is above Camera2.',
    camera_hal_perspective: '직접 HAL API 변경으로 단정하지 않습니다. source evidence가 없으면 HAL contract impact를 claim하지 않습니다.',
    impact_claim_level: IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT
  });

  assert.equal(standalone.some(item => item.type === 'overclaim_guardrail'), false);
  assert.equal(guardrail.some(item => item.type === 'overclaim_guardrail'), false);
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
