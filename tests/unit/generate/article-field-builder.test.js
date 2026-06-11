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
    article_sections: {
      background_context: 'CameraX is an Android framework layer above Camera2.',
      hal_driver_impact: 'Use this as a CameraX compatibility signal.'
    },
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
    article_sections: { background_context: 'CameraX changed.' }
  }).find(item => item.type === 'field_overlap');
  const semantic = findFieldHygieneIssues({
    what_changed: 'CameraX release updates Android camera compatibility validation behavior today.',
    article_sections: { background_context: 'CameraX release updates Android camera compatibility validation behavior now.' }
  }).find(item => item.type === 'field_overlap');
  const short = findFieldHygieneIssues({
    what_changed: 'CameraX Android compatibility validation.',
    article_sections: { background_context: 'CameraX Android compatibility checks.' }
  }).find(item => item.type === 'field_overlap');
  const distinct = findFieldHygieneIssues({
    what_changed: 'CameraX Android compatibility validation.',
    article_sections: { background_context: 'libcamera sensor pipeline context.' }
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

test('field hygiene does not flag Korean text whose only shared tokens are identical Latin names', () => {
  // Both fields carry the same Latin residue ("Google AI Studio ... Android"); only the Korean
  // prose differs. Under the old NFKD + 가-힣 filter the Korean was stripped, collapsing both to
  // the identical Latin remnant and falsely flagging an exact_duplicate. NFC keeps the Korean
  // distinct, so this must NOT be a blocking field_overlap. (Fails on the old NFKD normalization.)
  const overlap = findFieldHygieneIssues({
    what_changed: 'Google AI Studio는 프롬프트만으로 Android 앱을 빠르게 빌드하도록 지원합니다.',
    article_sections: { background_context: 'Google AI Studio는 브라우저에서 동작하며 Android 네이티브 개발 워크플로우를 단순화합니다.' }
  }).find(item => item.type === 'field_overlap' && item.blocking === true);
  assert.equal(overlap, undefined);
});

test('field hygiene still blocks genuinely identical Korean-only background and what_changed', () => {
  // Pure Korean (no Latin). Under old NFKD both normalized to an empty string, so the
  // exact_duplicate branch (which guards on a truthy normalized value) never fired — Korean
  // duplicates went undetected. NFC keeps the Korean, restoring detection.
  const exact = findFieldHygieneIssues({
    what_changed: '카메라 버퍼 관리 동작이 변경되었습니다.',
    article_sections: { background_context: '카메라 버퍼 관리 동작이 변경되었습니다.' }
  }).find(item => item.type === 'field_overlap');
  assert.equal(exact.overlap_kind, 'exact_duplicate');
  assert.equal(exact.blocking, true);
});

test('field hygiene does not make semantic direct-HAL validity decisions', () => {
  for (const halDriverImpact of [
    '이 항목은 직접 HAL API 변경입니다.',
    'HAL 메타데이터 contract 변경입니다.',
    'HAL stream buffer contract 변경입니다.',
    'HAL request/result에 직접 영향이 있습니다.'
  ]) {
    const issues = findFieldHygieneIssues({
      what_changed: 'CameraX compatibility behavior changed.',
      article_sections: {
        background_context: 'CameraX is above Camera2.',
        hal_driver_impact: halDriverImpact
      },
      guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
    });
    assert.equal(
      issues.some(item => item.type === 'overclaim_guardrail'),
      false,
      `${halDriverImpact} should be left to LLM/editor judgment`
    );
  }
});

test('field hygiene leaves direct HAL claim validity to LLM and editor judgment', () => {
  const directIssues = findFieldHygieneIssues({
    what_changed: 'Camera HAL changed request behavior.',
    article_sections: {
      background_context: 'The source is a direct HAL change.',
      hal_driver_impact: '이 항목은 직접 HAL API 변경이며 HAL buffer contract 변경입니다.'
    },
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.DIRECT_HAL_CONTRACT
  });
  const adjacentIssues = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    article_sections: {
      background_context: 'CameraX is above Camera2.',
      hal_driver_impact: 'This is direct HAL API behavior.'
    },
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });

  assert.equal(directIssues.some(item => item.type === 'overclaim_guardrail'), false);
  assert.equal(adjacentIssues.some(item => item.type === 'overclaim_guardrail'), false);
});

test('field hygiene does not treat standalone stream buffer request result or guardrails as overclaim', () => {
  const standalone = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    article_sections: {
      background_context: 'CameraX is above Camera2.',
      hal_driver_impact: 'stream buffer request/result 관찰 포인트입니다.'
    },
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });
  const guardrail = findFieldHygieneIssues({
    what_changed: 'CameraX compatibility behavior changed.',
    article_sections: {
      background_context: 'CameraX is above Camera2.',
      hal_driver_impact: '직접 HAL API 변경으로 단정하지 않습니다. source evidence가 없으면 HAL contract impact를 claim하지 않습니다.'
    },
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });

  assert.equal(standalone.some(item => item.type === 'overclaim_guardrail'), false);
  assert.equal(guardrail.some(item => item.type === 'overclaim_guardrail'), false);
});

test('field hygiene ignores direct HAL claim phrasing regardless of negation wording', () => {
  for (const halDriverImpact of [
    'No, this is direct HAL API behavior.',
    'This is not only a CameraX update; it is direct HAL API behavior.'
  ]) {
    const issues = findFieldHygieneIssues({
      what_changed: 'CameraX compatibility behavior changed.',
      article_sections: {
        background_context: 'CameraX is above Camera2.',
        hal_driver_impact: halDriverImpact
      },
      guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
    });
    assert.equal(
      issues.some(item => item.type === 'overclaim_guardrail'),
      false,
      `${halDriverImpact} should not be hard-failed by code`
    );
  }

  for (const halDriverImpact of [
    'This is not a direct HAL API change.',
    'No source evidence supports direct HAL API change.'
  ]) {
    const issues = findFieldHygieneIssues({
      what_changed: 'CameraX compatibility behavior changed.',
      article_sections: {
        background_context: 'CameraX is above Camera2.',
        hal_driver_impact: halDriverImpact
      },
      guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
    });
    assert.equal(issues.some(item => item.type === 'overclaim_guardrail'), false);
  }
});

test('overclaim guardrails remain LLM guidance and field hygiene does not hard-fail them', () => {
  const guardrails = buildOverclaimGuardrails(cameraXCandidate());
  const issues = findFieldHygieneIssues({
    what_changed: 'CameraX 1.6.1 updated app-facing compatibility behavior.',
    article_sections: {
      background_context: 'CameraX is an Android framework layer above Camera2.',
      hal_driver_impact: 'This is a direct HAL API contract change for stream buffers.'
    },
    guardrail_impact_class: GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT
  });

  assert.ok(guardrails.some(item => item.includes('direct HAL API')));
  assert.equal(issues.some(item => item.type === 'overclaim_guardrail'), false);
});
