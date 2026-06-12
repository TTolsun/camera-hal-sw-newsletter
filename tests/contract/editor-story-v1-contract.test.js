'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  repairEditorOutputContract,
  validateEditorOutputContract
} = require('../../scripts/newsroom/validate/editor-output-contract');
const {
  deriveDecisionMetadata
} = require('../../scripts/newsroom/common/public-article-contract');
const {
  section,
  editor,
  storyPublicArticle,
  storyEditor,
  normalizeSection
} = require('../../src/core/test/helpers/editor-builders');

const DATE = '2026-05-08';

test('story v1 editor output requires complete contract markers and story fields', () => {
  const draft = storyEditor();

  const result = validateEditorOutputContract(draft, DATE, {
    normalizeSection,
    requireStoryContract: true
  });

  assert.equal(result.public_contract_version, 'story-v1');
  assert.equal(result.generation_contract_version, 1);
  assert.equal(result.sections[0].public_article.story_contract_version, 1);
  assert.deepEqual(
    result.sections[0].public_article.decision_metadata,
    deriveDecisionMetadata(result.sections[0], result)
  );
});

test('story v1 contract rejects mixed marker artifacts instead of falling back to legacy', () => {
  const draft = storyEditor({ generation_contract_version: undefined });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, {
      normalizeSection,
      requireStoryContract: true
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue => issue.type === 'story_contract_version_mismatch'));
      return true;
    }
  );
});

test('story contract rejects story fields without contract markers instead of treating them as legacy', () => {
  const draft = editor({
    sections: [
      {
        ...section(1),
        public_article: storyPublicArticle(section(1), {
          story_contract_version: undefined
        })
      },
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, {
      normalizeSection
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue => issue.type === 'story_contract_version_mismatch'));
      return true;
    }
  );
});

test('story contract rejects unsupported future story versions instead of treating them as v1', () => {
  const draft = storyEditor({
    sections: [
      {
        ...section(1),
        public_article: storyPublicArticle(section(1), {
          story_contract_version: 2
        })
      },
      { ...section(2), public_article: storyPublicArticle(section(2)) },
      { ...section(3), public_article: storyPublicArticle(section(3)) }
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, {
      normalizeSection,
      requireStoryContract: true
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unsupported_story_contract_version' &&
        issue.value === 2
      ));
      return true;
    }
  );
});

test('story contract rejects unsupported future public contract versions', () => {
  const draft = storyEditor({
    public_contract_version: 'story-v2'
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, {
      normalizeSection
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unsupported_public_contract_version' &&
        issue.value === 'story-v2'
      ));
      return true;
    }
  );
});

test('story repair does not downgrade unsupported future public contract versions', async () => {
  const draft = storyEditor({
    public_contract_version: 'story-v2'
  });

  await assert.rejects(
    () => repairEditorOutputContract({
      value: draft,
      date: DATE,
      reporter: { candidates: [] },
      normalizeSection,
      requireStoryContract: true
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.equal(error.repairAttempted, false);
      assert.equal(error.repairSucceeded, false);
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unsupported_public_contract_version' &&
        issue.value === 'story-v2'
      ));
      assert.ok(error.deterministic_repair_failure_reason_codes.includes('unsupported_public_contract_version'));
      return true;
    }
  );
});

test('story repair does not downgrade unsupported future section story versions', async () => {
  const draft = storyEditor({
    sections: [
      {
        ...section(1),
        public_article: storyPublicArticle(section(1), {
          story_contract_version: 2
        })
      },
      { ...section(2), public_article: storyPublicArticle(section(2)) },
      { ...section(3), public_article: storyPublicArticle(section(3)) }
    ]
  });

  await assert.rejects(
    () => repairEditorOutputContract({
      value: draft,
      date: DATE,
      reporter: { candidates: [] },
      normalizeSection,
      requireStoryContract: true
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.equal(error.repairAttempted, false);
      assert.equal(error.repairSucceeded, false);
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unsupported_story_contract_version' &&
        issue.value === 2
      ));
      assert.ok(error.deterministic_repair_failure_reason_codes.includes('unsupported_story_contract_version'));
      return true;
    }
  );
});

test('story repair does not downgrade unsupported future generation contract versions', async () => {
  const draft = storyEditor({
    generation_contract_version: 2
  });

  await assert.rejects(
    () => repairEditorOutputContract({
      value: draft,
      date: DATE,
      reporter: { candidates: [] },
      normalizeSection,
      requireStoryContract: true
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.equal(error.repairAttempted, false);
      assert.equal(error.repairSucceeded, false);
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unsupported_generation_contract_version' &&
        issue.value === 2
      ));
      assert.ok(error.deterministic_repair_failure_reason_codes.includes('unsupported_generation_contract_version'));
      return true;
    }
  );
});

test('story repair fails closed on unsupported markers before repairing earlier briefing errors', async () => {
  const draft = storyEditor({
    public_contract_version: 'story-v2',
    generation_contract_version: 2,
    briefing: ['only one']
  });
  let repairCalled = false;

  await assert.rejects(
    () => repairEditorOutputContract({
      value: draft,
      date: DATE,
      reporter: { candidates: [] },
      normalizeSection,
      requireStoryContract: true,
      repairFn: async () => {
        repairCalled = true;
        throw new Error('LLM repair must not run for unsupported story markers.');
      }
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.equal(error.repairAttempted, false);
      assert.equal(error.repairSucceeded, false);
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unsupported_public_contract_version' &&
        issue.value === 'story-v2'
      ));
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unsupported_generation_contract_version' &&
        issue.value === 2
      ));
      assert.ok(error.deterministic_repair_failure_reason_codes.includes('unsupported_public_contract_version'));
      assert.ok(error.deterministic_repair_failure_reason_codes.includes('unsupported_generation_contract_version'));
      return true;
    }
  );
  assert.equal(repairCalled, false);
});

test('story v1 repair fills legacy public article markers and story fields deterministically', async () => {
  const draft = editor();

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    reporter: { candidates: [] },
    normalizeSection,
    requireStoryContract: true
  });

  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, true);
  assert.equal(result.editor.public_contract_version, 'story-v1');
  assert.equal(result.editor.generation_contract_version, 1);
  for (const repairedSection of result.editor.sections) {
    assert.equal(repairedSection.public_article.story_contract_version, 1);
    assert.ok(repairedSection.public_article.source_subtitle);
    assert.ok(repairedSection.public_article.editorial_story.reader_scenario);
    assert.deepEqual(
      repairedSection.public_article.decision_metadata,
      deriveDecisionMetadata(repairedSection, result.editor)
    );
  }
});

test('story v1 deterministic metadata overrides aggressive LLM metadata', () => {
  const base = section(1, {
    relevance_bucket: 'cpp_ai_tooling_fallback',
    source_gap_risk: true,
    public_article: storyPublicArticle(section(1), {
      decision_metadata: {
        impact: 'High',
        scope: ['HAL'],
        action: ['Adopt'],
        overclaim_risk: 'Low'
      }
    })
  });
  const draft = storyEditor({
    sections: [
      base,
      { ...section(2), public_article: storyPublicArticle(section(2)) },
      { ...section(3), public_article: storyPublicArticle(section(3)) }
    ]
  });

  const result = validateEditorOutputContract(draft, DATE, {
    normalizeSection,
    requireStoryContract: true
  });
  const metadata = result.sections[0].public_article.decision_metadata;

  assert.equal(metadata.overclaim_risk, 'High');
  assert.equal(metadata.action.includes('Adopt'), false);
  assert.deepEqual(metadata, deriveDecisionMetadata(result.sections[0], result));
});

test('story v1 decision metadata ignores stale direct impact_claim_level', () => {
  const base = section(1, {
    category: 'Android Platform / CameraX',
    headline: 'CameraX app compatibility update',
    relevance_bucket: 'android_platform_camera_adjacent',
    impact_claim_level: 'direct_hal_change',
    hal_impact_axes: [],
    hal_signal_capsule: {
      ...section(1).hal_signal_capsule,
      impact_axes: []
    }
  });

  const metadata = deriveDecisionMetadata(base, {
    public_contract_version: 'story-v1',
    generation_contract_version: 1
  });

  assert.equal(metadata.scope.includes('HAL'), false);
  assert.equal(metadata.scope.includes('Framework'), true);
});

test('story v1 decision metadata promotes direct HAL source signals without legacy enum text', () => {
  const base = section(1, {
    category: 'AOSP Camera HAL',
    headline: 'Camera provider request result contract update',
    relevance_bucket: 'direct_aosp_camera',
    actionability_level: 'concrete_check',
    effective_actionability_level: 'concrete_check',
    guardrail_impact_class: 'direct_hal_contract',
    do_not_overstate: [],
    hal_signal_capsule: {
      ...section(1).hal_signal_capsule,
      do_not_overstate: []
    },
    public_article: storyPublicArticle(section(1), {
      headline: 'Camera provider request result contract update',
      lead: 'AOSP Camera source confirmed a provider contract change.',
      body_paragraphs: [
        'The source describes the camera provider contract update for HAL owners.',
        'The article keeps the scope on request/result behavior and source-backed integration review.'
      ],
      camera_hal_takeaway: 'HAL owners should treat the source-backed provider contract change as a direct verification target.',
      reader_checkpoints: [
        'Review the camera provider request/result contract against the affected branch.',
        'Compare integration logs for the source-backed provider contract update.'
      ],
      editorial_story: {
        ...storyPublicArticle(section(1)).editorial_story,
        not_to_overclaim: ''
      }
    })
  });

  const metadata = deriveDecisionMetadata(base, {
    public_contract_version: 'story-v1',
    generation_contract_version: 1
  });

  assert.equal(metadata.impact, 'High');
  assert.equal(metadata.overclaim_risk, 'Low');
  assert.equal(metadata.scope.includes('HAL'), true);
  assert.equal(metadata.action.includes('Test'), true);
  assert.equal(metadata.action.includes('Adopt'), true);
});

test('story v1 decision metadata does not promote guardrail enum without source scope', () => {
  const base = section(1, {
    category: 'Android Platform / CameraX',
    headline: 'CameraX app compatibility update',
    relevance_bucket: 'android_platform_camera_adjacent',
    actionability_level: 'concrete_check',
    effective_actionability_level: 'concrete_check',
    guardrail_impact_class: 'direct_hal_contract',
    hal_impact_axes: [],
    hal_signal_capsule: {
      ...section(1).hal_signal_capsule,
      impact_axes: []
    },
    public_article: storyPublicArticle(section(1), {
      headline: 'CameraX app compatibility update',
      lead: 'CameraX source confirmed an app compatibility update.',
      body_paragraphs: [
        'The source describes app-facing CameraX compatibility behavior.',
        'The article keeps the scope above the HAL boundary.'
      ],
      camera_hal_takeaway: 'This is an app/framework compatibility signal, not a direct HAL contract change.',
      reader_checkpoints: [
        'Review CameraX app compatibility behavior in a sample app.',
        'Keep the source scope above the HAL boundary.'
      ]
    })
  });

  const metadata = deriveDecisionMetadata(base, {
    public_contract_version: 'story-v1',
    generation_contract_version: 1
  });

  assert.equal(metadata.scope.includes('HAL'), false);
  assert.equal(metadata.action.includes('Adopt'), false);
});

test('story v1 deterministic metadata separates tooling scope from fallback-only policy', () => {
  const tooling = section(1, {
    category: 'Android Native Tooling',
    headline: 'NDK camera test utility update',
    relevance_bucket: 'android_native_tooling_workflow',
    actionability_level: 'measurable_test',
    effective_actionability_level: 'measurable_test',
    source_gap_risk: false,
    do_not_overstate: [],
    hal_signal_capsule: {
      ...section(1).hal_signal_capsule,
      do_not_overstate: []
    }
  });
  const fallback = section(2, {
    category: 'Tooling Watch / Fallback',
    headline: 'AI tooling fallback note',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    actionability_level: 'measurable_test',
    effective_actionability_level: 'measurable_test',
    source_gap_risk: false,
    do_not_overstate: [],
    hal_signal_capsule: {
      ...section(2).hal_signal_capsule,
      do_not_overstate: []
    }
  });

  const toolingMetadata = deriveDecisionMetadata(tooling, {
    public_contract_version: 'story-v1',
    generation_contract_version: 1
  });
  const fallbackMetadata = deriveDecisionMetadata(fallback, {
    public_contract_version: 'story-v1',
    generation_contract_version: 1
  });

  assert.equal(toolingMetadata.scope.includes('Tooling'), true);
  assert.equal(toolingMetadata.action.includes('Adopt'), true);
  assert.equal(fallbackMetadata.scope.includes('Tooling'), true);
  assert.equal(fallbackMetadata.action.includes('Adopt'), false);
});

test('story v1 deterministic metadata scope ignores generic story prose boilerplate', () => {
  const base = section(1, {
    category: 'SoC Platform Signal',
    headline: 'Snapdragon ISP camera thermal note',
    relevance_bucket: 'soc_platform_signal',
    hal_impact_axes: ['performance_latency_thermal', 'stream_buffer_metadata'],
    soc_signal_type: 'isp_thermal_camera_workload'
  });
  base.public_article = storyPublicArticle(base, {
    editorial_story: {
      ...storyPublicArticle(base).editorial_story,
      reader_scenario: '이 항목을 Camera HAL / Driver / Native tooling 리뷰 범위에 넣을지 판단하는 상황을 가정합니다.'
    }
  });

  const metadata = deriveDecisionMetadata(base, {
    public_contract_version: 'story-v1',
    generation_contract_version: 1
  });

  assert.equal(metadata.scope.includes('SoC'), true);
  assert.equal(metadata.scope.includes('Driver'), false);
  assert.equal(metadata.scope.includes('Tooling'), false);
  assert.equal(metadata.scope.includes('AI'), false);
});

test('story v1 reader_scenario must stay hypothetical', () => {
  const draft = storyEditor({
    sections: [
      {
        ...section(1),
        public_article: storyPublicArticle(section(1), {
          editorial_story: {
            ...storyPublicArticle(section(1)).editorial_story,
            reader_scenario: '이번 CameraX 업데이트로 HAL 버퍼 누수가 발생했다.'
          }
        })
      },
      { ...section(2), public_article: storyPublicArticle(section(2)) },
      { ...section(3), public_article: storyPublicArticle(section(3)) }
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, {
      normalizeSection,
      requireStoryContract: true
    }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue => issue.type === 'reader_scenario_factual_boundary'));
      return true;
    }
  );
});
