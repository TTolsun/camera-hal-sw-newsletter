const assert = require('node:assert/strict');
const test = require('node:test');

const {
  GUARDRAIL_IMPACT_CLASSES,
  buildConfirmedFacts,
  buildHalPerspective,
  buildOverclaimGuardrails,
  buildStaticBackgroundContext,
  cleanBehaviorChange,
  findFieldHygieneIssues,
  inferGuardrailImpactClass
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

function multimediaCandidate(overrides = {}) {
  return {
    title: 'Android Ultra HDR video output update',
    source: 'Android Developers',
    published_date: '2026-05-20',
    version_or_release: '',
    api_or_component: 'Ultra HDR video output',
    relevance_bucket: 'android_multimedia_camera_output',
    multimedia_camera_output_relevance: 3,
    behavior_change: 'Android makes Ultra HDR video output available for camera capture and gallery output validation.',
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

test('cleanBehaviorChange prefers source_extraction release bullet over metadata fallback', () => {
  const result = cleanBehaviorChange(cameraXCandidate({
    source_extraction: {
      release: {
        sections: [{
          category: 'bug_fixes',
          heading: 'Bug Fixes',
          items: [{
            text: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.',
            source_text: 'Fixed ListenableFuture compile error in androidx.camera:camera-core.',
            links: [],
            issue_ids: [],
            artifact_names: ['androidx.camera:camera-core']
          }]
        }]
      }
    }
  }));

  assert.equal(result.text, 'Fixed ListenableFuture compile error in androidx.camera:camera-core.');
  assert.equal(result.warnings.includes('behavior_fallback_from_metadata'), false);
  assert.equal(result.warnings.includes('raw_ui_or_table_artifact_removed'), false);
});

test('confirmed facts use Korean source-fact labels and exclude internal classification', () => {
  const facts = buildConfirmedFacts(cameraXCandidate({
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

test('guardrail impact class controls HAL perspective strength', () => {
  const direct = buildHalPerspective({
    relevance_bucket: 'direct_aosp_camera',
    aosp_camera_directness: 5,
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.DIRECT_HAL_CONTRACT
  });
  const adjacent = buildHalPerspective(cameraXCandidate());
  const tooling = buildHalPerspective({
    relevance_bucket: 'cpp_ai_tooling_fallback'
  });

  assert.match(direct, /HAL API|metadata|request\/result|stream|buffer/);
  assert.match(adjacent, /CameraX|Camera2/);
  assert.match(tooling, /build|test|debug|tooling/);
  assert.equal(inferGuardrailImpactClass(cameraXCandidate()), GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT);
});

test('multimedia camera-output fields avoid CameraX Camera2 and direct HAL wording', () => {
  const candidate = multimediaCandidate();
  const background = buildStaticBackgroundContext(candidate);
  const perspective = buildHalPerspective(candidate);
  const guardrails = buildOverclaimGuardrails(candidate).join('\n');

  assert.equal(inferGuardrailImpactClass(candidate), GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT);
  assert.match(background, /Camera output|multimedia|preview\/video\/gallery\/video-call/);
  assert.match(perspective, /preview|video|gallery|video-call|captured image\/video output/);
  assert.doesNotMatch(`${background}\n${perspective}`, /CameraX|Camera2/);
  assert.doesNotMatch(`${background}\n${perspective}`, /direct HAL API contract change|HAL contract change/);
  assert.match(guardrails, /direct HAL API|vendor HAL implementation|HAL contract changes/);
});

test('SoC platform signal stays watch-only unless camera pipeline evidence is present', () => {
  assert.equal(
    inferGuardrailImpactClass({
      title: 'Tensor G6 improves NPU power management',
      summary: 'The platform update changes CPU, GPU, NPU, power, and thermal behavior.',
      relevance_bucket: 'soc_platform_signal'
    }),
    GUARDRAIL_IMPACT_CLASSES.WATCH_ONLY
  );
  assert.equal(
    inferGuardrailImpactClass({
      title: 'Tensor ISP update improves image sensor pipeline',
      summary: 'The platform update names ISP, image sensor, MIPI CSI, and camera pipeline behavior.',
      relevance_bucket: 'soc_platform_signal'
    }),
    GUARDRAIL_IMPACT_CLASSES.CAMERA_STACK_SOURCE
  );
});

test('derived editorial hints do not count as source evidence for impact inference', () => {
  assert.equal(
    inferGuardrailImpactClass({
      title: 'Tensor G6 improves scheduler behavior',
      summary: 'The platform update changes CPU, GPU, NPU, power, and thermal behavior.',
      relevance_bucket: 'soc_platform_signal',
      derived_editorial_hints: {
        hal_boundary: 'framework_adjacent_not_direct_hal_contract',
        do_not_claim: ['Do not claim direct Camera HAL API changes.']
      }
    }),
    GUARDRAIL_IMPACT_CLASSES.WATCH_ONLY
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
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });

  assert.ok(issues.some(item => item.type === 'internal_classification_in_confirmed_facts'));
});

test('field hygiene separates exact duplicate semantic overlap and short overlap warning', () => {
  const exact = findFieldHygieneIssues({
    what_changed: 'CameraX changed.',
    background: 'CameraX changed.'
  }).find(item => item.type === 'field_overlap');
  const semantic = findFieldHygieneIssues({
    what_changed: 'CameraX release updates Android camera compatibility validation behavior today.',
    background: 'CameraX release updates Android camera compatibility validation behavior now.'
  }).find(item => item.type === 'field_overlap');
  const short = findFieldHygieneIssues({
    what_changed: 'CameraX Android compatibility validation.',
    background: 'CameraX Android compatibility checks.'
  }).find(item => item.type === 'field_overlap');
  const distinct = findFieldHygieneIssues({
    what_changed: 'CameraX Android compatibility validation.',
    background: 'libcamera sensor pipeline context.'
  }).find(item => item.type === 'field_overlap');

  assert.equal(exact.overlap_kind, 'exact_duplicate');
  assert.equal(exact.severity, 'hard');
  assert.equal(exact.blocking, true);
  assert.equal(semantic.overlap_kind, 'semantic_overlap');
  assert.equal(semantic.severity, 'hard');
  assert.equal(semantic.blocking, true);
  assert.equal(semantic.background_token_count >= 6, true);
  assert.equal(semantic.changed_token_count >= 6, true);
  assert.equal(short.overlap_kind, 'short_overlap_warning');
  assert.equal(short.severity, 'warning');
  assert.equal(short.blocking, false);
  assert.equal(distinct, undefined);
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
      guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
    });
    const overclaim = issues.find(item => item.type === 'overclaim_guardrail');
    assert.ok(overclaim, `${camera_hal_perspective} should be detected`);
    assert.equal(overclaim.severity, 'hard');
    assert.equal(overclaim.blocking, true);
  }
});

test('field hygiene allows direct HAL claims only for direct HAL guardrail impact class', () => {
  const directIssues = findFieldHygieneIssues({
    what_changed: 'Camera HAL changed request behavior.',
    background: 'The source is a direct HAL change.',
    camera_hal_perspective: '이 항목은 직접 HAL API 변경이며 HAL buffer contract 변경입니다.',
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.DIRECT_HAL_CONTRACT
  });
  const adjacentIssues = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    background: 'CameraX is above Camera2.',
    camera_hal_perspective: 'This is direct HAL API behavior.',
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });

  assert.equal(directIssues.some(item => item.type === 'overclaim_guardrail'), false);
  assert.equal(adjacentIssues.some(item => item.type === 'overclaim_guardrail'), true);
});

test('field hygiene does not treat standalone stream buffer request result or guardrails as overclaim', () => {
  const standalone = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    background: 'CameraX is above Camera2.',
    camera_hal_perspective: 'stream buffer request/result 관찰 포인트입니다.',
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });
  const guardrail = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    background: 'CameraX is above Camera2.',
    camera_hal_perspective: '직접 HAL API 변경으로 단정하지 않습니다. source evidence가 없으면 HAL contract impact를 claim하지 않습니다.',
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });

  assert.equal(standalone.some(item => item.type === 'overclaim_guardrail'), false);
  assert.equal(guardrail.some(item => item.type === 'overclaim_guardrail'), false);
});

test('field hygiene keeps not and no from masking positive direct HAL overclaims', () => {
  for (const camera_hal_perspective of [
    'No, this is direct HAL API behavior.',
    'This is not only a CameraX update; it is direct HAL API behavior.'
  ]) {
    const issues = findFieldHygieneIssues({
      what_changed: 'CameraX compatibility behavior changed.',
      background: 'CameraX is above Camera2.',
      camera_hal_perspective,
      guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
    });
    assert.ok(
      issues.some(item => item.type === 'overclaim_guardrail' && item.blocking === true),
      `${camera_hal_perspective} should remain blocking`
    );
  }

  for (const camera_hal_perspective of [
    'This is not a direct HAL API change.',
    'No source evidence supports direct HAL API change.'
  ]) {
    const issues = findFieldHygieneIssues({
      what_changed: 'CameraX compatibility behavior changed.',
      background: 'CameraX is above Camera2.',
      camera_hal_perspective,
      guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
    });
    assert.equal(issues.some(item => item.type === 'overclaim_guardrail'), false);
  }
});

test('overclaim guardrails and field hygiene catch direct HAL overclaim', () => {
  const guardrails = buildOverclaimGuardrails(cameraXCandidate());
  const issues = findFieldHygieneIssues({
    what_changed: 'CameraX 1.6.1 updated app-facing compatibility behavior.',
    background: 'CameraX is an Android framework layer above Camera2.',
    camera_hal_perspective: 'This is a direct HAL API contract change for stream buffers.',
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });

  assert.ok(guardrails.some(item => item.includes('direct HAL API')));
  assert.ok(issues.some(item => item.type === 'overclaim_guardrail'));
});
