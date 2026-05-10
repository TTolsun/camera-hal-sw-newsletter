const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FETCH_STATUSES,
  IMPACT_TYPES,
  IMPACT_TYPE_VALUES,
  RECOMMENDED_ARTICLE_TYPES,
  classifyLinkedEvidenceImpact,
  defaultImpactClassification
} = require('../scripts/newsroom/evidence');

function evidence(overrides = {}) {
  return {
    type: 'generic_url',
    url: 'https://example.com/evidence',
    identifier: 'evidence',
    fetch_status: FETCH_STATUSES.SKIPPED,
    warnings: ['Linked evidence network fetch skipped: enableNetwork is false.'],
    ...overrides
  };
}

test('impact classifier exposes only concrete enum values plus unknown', () => {
  assert.deepEqual(new Set(IMPACT_TYPE_VALUES), new Set(Object.values(IMPACT_TYPES)));
  assert.equal(IMPACT_TYPE_VALUES.length, 11);
  assert.ok(IMPACT_TYPE_VALUES.includes(IMPACT_TYPES.UNKNOWN));
  assert.deepEqual(defaultImpactClassification(), {
    impact_type: IMPACT_TYPES.UNKNOWN,
    hal_runtime_impact: false,
    camera_pipeline_impact: false,
    recommended_article_type: RECOMMENDED_ARTICLE_TYPES.UNKNOWN,
    confidence: 0,
    reason: 'No linked evidence impact signal was classified.',
    warnings: []
  });
});

test('impact classifier covers each impact type conservatively', () => {
  const cases = [
    [IMPACT_TYPES.BUILD_DEPENDENCY_FIX, { title: 'Gradle dependency update', summary: 'Fixes Maven build dependency resolution.' }],
    [IMPACT_TYPES.RUNTIME_BEHAVIOR_CHANGE, { title: 'Camera HAL metadata runtime fix', summary: 'Fixes capture request metadata behavior for stream buffers.' }],
    [IMPACT_TYPES.CAMERA_API_CHANGE, { title: 'CameraX API update', summary: 'Updates CameraX API compatibility behavior.' }],
    [IMPACT_TYPES.IMAGE_CAPTURE_FIX, { title: 'ImageCapture RAW fix', summary: 'Fixes ImageCapture RAW and JPEG capture behavior.' }],
    [IMPACT_TYPES.VIDEO_CAPTURE_FIX, { title: 'VideoCapture recording fix', summary: 'Fixes VideoCapture recording behavior for camera streams.' }],
    [IMPACT_TYPES.DEVICE_QUIRK_FIX, { title: 'CameraX device quirk fix', summary: 'Fixes device-specific camera quirk behavior.' }],
    [IMPACT_TYPES.TEST_ONLY_CHANGE, { title: 'Camera ITS test update', summary: 'Updates CTS and VTS tests only.' }],
    [IMPACT_TYPES.DOCUMENTATION_ONLY, { title: 'Camera docs page update', summary: 'Documentation reference page update.', source_kind: 'documentation_page' }],
    [IMPACT_TYPES.SECURITY_COMPONENT_CAMERA_RELATED, { title: 'Camera security bulletin', summary: 'CVE-2026-12345 fixes Android Camera security behavior.' }],
    [IMPACT_TYPES.GENERIC_TOOLING_CHANGE, { title: 'LLVM toolchain update', summary: 'Updates Clang native developer tooling.' }],
    [IMPACT_TYPES.UNKNOWN, { title: 'General ecosystem note', summary: 'No specific component signal.' }]
  ];

  for (const [expected, candidate] of cases) {
    const result = classifyLinkedEvidenceImpact(candidate, []);
    assert.equal(result.impact_type, expected, expected);
  }
});

test('skipped linked evidence alone cannot recommend main', () => {
  const result = classifyLinkedEvidenceImpact({
    title: 'Generic release mention',
    summary: 'See linked evidence for more detail.'
  }, [evidence()]);

  assert.equal(result.recommended_article_type, RECOMMENDED_ARTICLE_TYPES.UNKNOWN);
  assert.equal(result.hal_runtime_impact, false);
  assert.ok(result.warnings.includes('linked_evidence_skipped'));
});

test('main recommendation requires explicit candidate-level runtime or pipeline evidence', () => {
  const main = classifyLinkedEvidenceImpact({
    title: 'Camera HAL metadata update',
    summary: 'Fixes capture result metadata behavior for camera stream buffers.'
  }, [evidence()]);
  const watch = classifyLinkedEvidenceImpact({
    title: 'AndroidX dependency update',
    summary: 'Fixes Gradle metadata for a release note.'
  }, [evidence()]);

  assert.equal(main.recommended_article_type, RECOMMENDED_ARTICLE_TYPES.MAIN);
  assert.equal(main.hal_runtime_impact, true);
  assert.equal(watch.recommended_article_type, RECOMMENDED_ARTICLE_TYPES.WATCH);
  assert.equal(watch.hal_runtime_impact, false);
});

test('CameraX dependency test and docs updates remain watch without runtime pipeline terms', () => {
  const cases = [
    [
      IMPACT_TYPES.BUILD_DEPENDENCY_FIX,
      { title: 'CameraX ListenableFuture dependency fix', summary: 'Updates Gradle dependency metadata for the release.' }
    ],
    [
      IMPACT_TYPES.TEST_ONLY_CHANGE,
      { title: 'CameraX test update', summary: 'Updates JUnit and CTS test coverage only.' }
    ],
    [
      IMPACT_TYPES.DOCUMENTATION_ONLY,
      { title: 'CameraX docs update', summary: 'Documentation guide and reference page update.' }
    ]
  ];

  for (const [expectedImpact, candidate] of cases) {
    const result = classifyLinkedEvidenceImpact(candidate, [evidence()]);
    assert.equal(result.impact_type, expectedImpact);
    assert.equal(result.recommended_article_type, RECOMMENDED_ARTICLE_TYPES.WATCH);
    assert.equal(result.hal_runtime_impact, false);
    assert.equal(result.camera_pipeline_impact, false);
  }
});

test('CameraX explicit runtime pipeline terms can still receive main diagnostic hint', () => {
  const result = classifyLinkedEvidenceImpact({
    title: 'CameraX ImageCapture metadata fix',
    summary: 'Fixes ImageCapture request metadata result handling for camera stream buffers.'
  }, [evidence()]);

  assert.equal(result.impact_type, IMPACT_TYPES.IMAGE_CAPTURE_FIX);
  assert.equal(result.recommended_article_type, RECOMMENDED_ARTICLE_TYPES.MAIN);
  assert.equal(result.hal_runtime_impact, true);
  assert.equal(result.camera_pipeline_impact, true);
});

test('blocked failed and unsupported evidence never infer linked page content', () => {
  const result = classifyLinkedEvidenceImpact({
    title: 'Generic issue',
    summary: 'No camera runtime text here.'
  }, [
    evidence({ fetch_status: FETCH_STATUSES.BLOCKED }),
    evidence({ fetch_status: FETCH_STATUSES.FAILED }),
    evidence({ fetch_status: FETCH_STATUSES.UNSUPPORTED })
  ]);

  assert.equal(result.impact_type, IMPACT_TYPES.UNKNOWN);
  assert.equal(result.recommended_article_type, RECOMMENDED_ARTICLE_TYPES.UNKNOWN);
  assert.ok(result.warnings.includes('linked_evidence_blocked'));
  assert.ok(result.warnings.includes('linked_evidence_failed'));
  assert.ok(result.warnings.includes('linked_evidence_unsupported'));
});
