'use strict';

const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const {
  EditorSemanticValidationError,
  repairEditorOutputContract,
  validateEditorOutputContract
} = require('../../../generator/editor/editor-output-contract');
const { editorSchema } = require('../../../generator/render/newsletter-schema');
const {
  buildGenerationStatus,
  editorSemanticStatusExtra
} = require('../../../generator/publish/gemini-newsroom-newsletter');
const {
  articlePolicy
} = require('../../common/newsletter-policy');
const {
  section,
  editor,
  reporterForClaimTests,
  reporterForGroupTests,
  normalizeSection,
  tempNewsroomDir,
  readJson,
  loadFreshNewsletterCli
} = require('../helpers/editor-builders');

const DATE = '2026-05-08';

test('valid editor output with exactly 3 briefing items passes unchanged', () => {
  const draft = editor();
  const sourceSignature = JSON.stringify(draft.sections.map(item => ({
    headline: item.headline,
    category: item.category,
    sources: item.sources
  })));

  const result = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(result, draft);
  assert.deepEqual(result.briefing, ['one', 'two', 'three']);
  assert.equal(
    JSON.stringify(result.sections.map(item => ({
      headline: item.headline,
      category: item.category,
      sources: item.sources
    }))),
    sourceSignature
  );
});

test('selected representative group must render or be explicitly demoted', () => {
  const baseSection = section(1);
  const missingGroup = editor({
    sections: [section(1, {
      article_group_key: 'other-group',
      sources: [{ title: 'Other source', url: 'https://example.com/other' }],
      public_article: {
        ...baseSection.public_article,
        source_links: [{ title: 'Other source', url: 'https://example.com/other', source_role: 'primary' }]
      }
    })]
  });

  assert.throws(
    () => validateEditorOutputContract(missingGroup, DATE, {
      normalizeSection,
      reporter: reporterForGroupTests()
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.group_coverage');
      assert.deepEqual(error.details.missing_group_keys, ['group-a']);
      return true;
    }
  );

  const demoted = editor({
    sections: [section(1, {
      source_candidate_hash: '',
      sources: [{ title: 'Other source', url: 'https://example.com/other' }],
      public_article: {
        ...baseSection.public_article,
        source_links: [{ title: 'Other source', url: 'https://example.com/other', source_role: 'primary' }]
      }
    })],
    explicitly_demoted_groups: [{
      article_group_key: 'group-a',
      demotion_reason: 'Insufficient source binding after editor validation.'
    }]
  });
  const result = validateEditorOutputContract(demoted, DATE, {
    normalizeSection,
    reporter: reporterForGroupTests()
  });
  assert.equal(result.selected_group_count, 1);
  assert.equal(result.explicitly_demoted_group_count, 1);
});

test('blocked related context cannot be used as article source or headline', () => {
  const blockedUrl = 'https://android-developers.googleblog.com/2026/05/roundup.html';
  const reporter = reporterForGroupTests({
    related_context_candidates: [{
      title: '17 Things to know for Android developers at Google I/O',
      url: blockedUrl,
      context_role: 'parent_roundup_context_only',
      context_usage_allowed: false,
      can_create_independent_article: false,
      blocked_from_independent_main_reason: 'parent_roundup_context_only',
      article_group_key: 'group-a'
    }]
  });
  const baseSection = section(1);
  const draft = editor({
    sections: [section(1, {
      article_group_key: 'group-a',
      sources: [
        { title: 'Selected group source', url: 'https://example.com/source-1' },
        { title: 'Blocked roundup', url: blockedUrl }
      ],
      public_article: {
        ...baseSection.public_article,
        source_links: [
          { title: 'Selected group source', url: 'https://example.com/source-1', source_role: 'primary' },
          { title: 'Blocked roundup', url: blockedUrl, source_role: 'primary' }
        ]
      }
    })]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection, reporter }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.blocked_context');
      assert.equal(error.details.issues[0].type, 'blocked_context_url_used_as_article_source');
      return true;
    }
  );
});

test('a selected article own source URL leaked into its blocked context is not flagged', () => {
  // selected candidate 자신의 source URL이 다른 title로 자기 related/blocked context에 새어
  // 들어가도, 자기 source는 "improperly used blocked context"가 아니므로 오탐하면 안 된다.
  const selfUrl = 'https://example.com/source-1';
  const reporter = reporterForGroupTests({
    related_context_candidates: [{
      title: 'Selected group source (re-catalogued under a different title)',
      url: selfUrl,
      context_role: 'parent_roundup_context_only',
      context_usage_allowed: false,
      can_create_independent_article: false,
      blocked_from_independent_main_reason: 'parent_roundup_context_only',
      article_group_key: 'group-a'
    }]
  });
  const baseSection = section(1);
  const draft = editor({
    sections: [section(1, {
      article_group_key: 'group-a',
      sources: [{ title: 'Selected group source', url: selfUrl }],
      public_article: {
        ...baseSection.public_article,
        source_links: [{ title: 'Selected group source', url: selfUrl, source_role: 'primary' }]
      }
    })]
  });

  assert.doesNotThrow(() => validateEditorOutputContract(draft, DATE, { normalizeSection, reporter }));
});

test('source-gap selected group is hard blocked even if editor also demotes it', () => {
  const reporter = reporterForGroupTests({
    source_gap_risk: true,
    source_quality: {
      source_role: 'official_release_source',
      source_url_quality: 'official_dated_release',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: false,
      conditional_evidence_type: '',
      evidence_granularity: 'candidate_item',
      source_quality_notes: []
    }
  });
  const baseSection = section(1);
  const draft = editor({
    sections: [section(1, {
      source_candidate_hash: '',
      sources: [{ title: 'Other source', url: 'https://example.com/other' }],
      public_article: {
        ...baseSection.public_article,
        source_links: [{ title: 'Other source', url: 'https://example.com/other', source_role: 'primary' }]
      }
    })],
    explicitly_demoted_groups: [{
      article_group_key: 'group-a',
      demotion_reason: 'Editor demotion should lose to source gap hard block.',
      reason_code: 'explicit_editor_hold'
    }]
  });
  const result = validateEditorOutputContract(draft, DATE, { normalizeSection, reporter });

  assert.equal(result.hard_blocked_group_count, 1);
  assert.equal(result.explicitly_demoted_group_count, 0);
  assert.deepEqual(result.hard_blocked_group_keys, ['group-a']);
});

test('source-ready native tooling group cannot be demoted for non-primary camera stack reason', () => {
  const reporter = reporterForGroupTests({
    article_group_key: 'android_native_tooling_workflow',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    tooling_workflow_type: 'native_tooling_workflow',
    source_quality: {
      source_role: 'official_release_source',
      source_url_quality: 'official_dated_release',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: false,
      conditional_evidence_type: '',
      evidence_granularity: 'candidate_item',
      source_quality_notes: []
    }
  });
  const baseSection = section(1);
  const draft = editor({
    sections: [section(1, {
      article_group_key: 'other-group',
      source_candidate_hash: '',
      sources: [{ title: 'Other source', url: 'https://example.com/other' }],
      public_article: {
        ...baseSection.public_article,
        source_links: [{ title: 'Other source', url: 'https://example.com/other', source_role: 'primary' }]
      }
    })],
    explicitly_demoted_groups: [{
      article_group_key: 'android_native_tooling_workflow',
      demotion_reason: 'Not a primary camera stack article.',
      reason_code: 'not_primary_camera_stack'
    }]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection, reporter }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.group_coverage');
      assert.equal(error.details.invalid_demotions[0].reason_code, 'not_primary_camera_stack');
      return true;
    }
  );
});

test('source-ready native tooling group cannot normalize fallback_bucket into an allowed demotion', () => {
  const reporter = reporterForGroupTests({
    article_group_key: 'android_native_tooling_workflow',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    tooling_workflow_type: 'native_tooling_workflow',
    source_quality: {
      source_role: 'official_release_source',
      source_url_quality: 'official_dated_release',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: false,
      conditional_evidence_type: '',
      evidence_granularity: 'candidate_item',
      source_quality_notes: []
    }
  });
  const baseSection = section(1);
  const draft = editor({
    sections: [section(1, {
      article_group_key: 'other-group',
      source_candidate_hash: '',
      sources: [{ title: 'Other source', url: 'https://example.com/other' }],
      public_article: {
        ...baseSection.public_article,
        source_links: [{ title: 'Other source', url: 'https://example.com/other', source_role: 'primary' }]
      }
    })],
    explicitly_demoted_groups: [{
      article_group_key: 'android_native_tooling_workflow',
      demotion_reason: 'fallback_bucket'
    }]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection, reporter }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.group_coverage');
      assert.equal(error.details.invalid_demotions[0].reason_code, 'fallback_bucket');
      return true;
    }
  );
});

test('group coverage rejects duplicate rendered cards for one selected group', () => {
  const reporter = reporterForGroupTests({
    article_group_key: 'group-a',
    relevance_bucket: 'direct_aosp_camera'
  });
  const draft = editor({
    sections: [
      section(1, { article_group_key: 'group-a' }),
      section(2, { article_group_key: 'group-a' })
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection, reporter }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.group_coverage');
      assert.deepEqual(error.details.duplicate_rendered_group_keys, ['group-a']);
      return true;
    }
  );
});

test('group state reason codes are validated by state namespace', () => {
  const reporter = reporterForGroupTests({
    article_group_key: 'group-a',
    relevance_bucket: 'direct_aosp_camera'
  });
  const baseSection = section(1);
  const invalidDemotion = editor({
    sections: [section(1, {
      article_group_key: 'other-group',
      source_candidate_hash: '',
      sources: [{ title: 'Other source', url: 'https://example.com/other' }],
      public_article: {
        ...baseSection.public_article,
        source_links: [{ title: 'Other source', url: 'https://example.com/other', source_role: 'primary' }]
      }
    })],
    explicitly_demoted_groups: [{
      article_group_key: 'group-a',
      demotion_reason: 'Bad demotion reason.',
      reason_code: 'quality_hard_blocker'
    }]
  });

  assert.throws(
    () => validateEditorOutputContract(invalidDemotion, DATE, { normalizeSection, reporter }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.group_coverage');
      assert.deepEqual(error.details.invalid_demotions, [{
        article_group_key: 'group-a',
        reason_code: 'quality_hard_blocker'
      }]);
      return true;
    }
  );

  const invalidHardBlock = editor({
    sections: [section(1, {
      article_group_key: 'other-group',
      source_candidate_hash: '',
      sources: [{ title: 'Other source', url: 'https://example.com/other' }],
      public_article: {
        ...baseSection.public_article,
        source_links: [{ title: 'Other source', url: 'https://example.com/other', source_role: 'primary' }]
      }
    })],
    hard_blocked_groups: [{
      article_group_key: 'group-a',
      hard_block_reason: 'Bad hard block reason.',
      reason_code: 'explicit_editor_hold'
    }]
  });

  assert.throws(
    () => validateEditorOutputContract(invalidHardBlock, DATE, { normalizeSection, reporter }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.group_coverage');
      assert.deepEqual(error.details.invalid_hard_blocks, [{
        article_group_key: 'group-a',
        reason_code: 'explicit_editor_hold'
      }]);
      return true;
    }
  );
});

test('blocked_context_candidates are validated when related context is empty', () => {
  const blockedUrl = 'https://android-developers.googleblog.com/2026/05/roundup.html';
  const reporter = reporterForGroupTests({
    related_context_candidates: [],
    blocked_context_candidates: [{
      title: '17 Things to know for Android developers at Google I/O',
      url: `${blockedUrl}?utm_source=x`,
      context_role: 'parent_roundup_context_only',
      context_usage_allowed: false,
      can_create_independent_article: false,
      blocked_from_independent_main_reason: 'parent_roundup_context_only',
      article_group_key: 'group-a'
    }]
  });
  const baseSection = section(1);
  const draft = editor({
    sections: [section(1, {
      article_group_key: 'group-a',
      sources: [
        { title: 'Selected group source', url: 'https://example.com/source-1' },
        { title: 'Blocked roundup', url: blockedUrl }
      ],
      public_article: {
        ...baseSection.public_article,
        source_links: [
          { title: 'Selected group source', url: 'https://example.com/source-1', source_role: 'primary' },
          { title: 'Blocked roundup', url: blockedUrl, source_role: 'primary' }
        ]
      }
    })]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection, reporter }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.blocked_context');
      assert.equal(error.details.issues[0].type, 'blocked_context_url_used_as_article_source');
      return true;
    }
  );
});

test('blocked parent roundup title cannot become an independent headline', () => {
  const parentTitle = '17 Things to know for Android developers at Google I/O';
  const reporter = reporterForGroupTests({
    related_context_candidates: [],
    blocked_context_candidates: [{
      title: parentTitle,
      url: 'https://android-developers.googleblog.com/2026/05/roundup.html',
      context_role: 'parent_roundup_context_only',
      context_usage_allowed: false,
      can_create_independent_article: false,
      blocked_from_independent_main_reason: 'parent_roundup_context_only',
      article_group_key: 'group-a'
    }]
  });
  const draft = editor({
    sections: [section(1, {
      article_group_key: 'group-a',
      headline: parentTitle
    })]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection, reporter }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.blocked_context');
      assert.equal(error.details.issues[0].type, 'blocked_context_title_used_as_independent_headline');
      return true;
    }
  );
});

test('editor section count follows Newsletter Policy min/max', () => {
  const tooFew = editor({
    sections: Array.from({ length: Math.max(0, articlePolicy.mainArticleCount.min - 1) }, (_, index) => section(index + 1))
  });
  const minimum = editor({
    sections: Array.from({ length: articlePolicy.mainArticleCount.min }, (_, index) => section(index + 1))
  });
  const tooMany = editor({
    sections: Array.from({ length: articlePolicy.mainArticleCount.max + 1 }, (_, index) => section(index + 1))
  });

  assert.throws(
    () => validateEditorOutputContract(tooFew, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections');
      assert.equal(error.details.expectedMinCount, articlePolicy.mainArticleCount.min);
      assert.equal(error.details.expectedMaxCount, articlePolicy.mainArticleCount.max);
      assert.equal(error.details.actualCount, articlePolicy.mainArticleCount.min - 1);
      assert.equal(error.details.actualType, 'array');
      assert.equal(error.details.sectionCount, articlePolicy.mainArticleCount.min - 1);
      return true;
    }
  );

  assert.equal(validateEditorOutputContract(minimum, DATE, { normalizeSection }), minimum);

  assert.throws(
    () => validateEditorOutputContract(tooMany, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections');
      assert.equal(error.details.expectedMinCount, articlePolicy.mainArticleCount.min);
      assert.equal(error.details.expectedMaxCount, articlePolicy.mainArticleCount.max);
      assert.equal(error.details.actualCount, articlePolicy.mainArticleCount.max + 1);
      assert.equal(error.details.actualType, 'array');
      assert.equal(error.details.sectionCount, articlePolicy.mainArticleCount.max + 1);
      return true;
    }
  );
});

test('editor article policy allows one supporting main section when primary requirement is disabled', () => {
  const draft = editor({
    sections: [
      section(1, { relevance_bucket: 'soc_platform_signal', counts_as_primary_camera_topic: false })
    ]
  });

  assert.equal(validateEditorOutputContract(draft, DATE, { normalizeSection }), draft);
});

test('editor article policy rejects forbidden main buckets', () => {
  const draft = editor({
    sections: [
      section(1),
      section(2, { relevance_bucket: 'generic_tech_watchlist', counts_as_primary_camera_topic: false }),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.relevance_bucket');
      assert.deepEqual(error.details.forbiddenMainBuckets, articlePolicy.forbiddenMainBuckets);
      assert.equal(error.details.actualCount, 1);
      return true;
    }
  );
});

test('editor article policy uses newsroom URL normalization for reporter metadata matching', () => {
  const draft = editor({
    sections: [
      section(1, {
        relevance_bucket: '',
        counts_as_primary_camera_topic: false,
        source_candidate_hash: '',
        sources: [{
          title: 'Canonical source',
          url: 'https://example.com/source-1'
        }]
      }),
      section(2, {
        relevance_bucket: 'soc_platform_signal',
        counts_as_primary_camera_topic: false
      }),
      section(3, {
        relevance_bucket: 'cpp_ai_tooling_fallback',
        counts_as_primary_camera_topic: false
      })
    ]
  });
  const reporter = {
    candidates: [{
      title: 'Reporter CameraX source',
      url: 'https://example.com/source-1?utm_source=newsletter#section',
      relevance_bucket: 'direct_aosp_camera',
      counts_as_primary_camera_topic: true
    }]
  };

  assert.equal(validateEditorOutputContract(draft, DATE, { normalizeSection, reporter }), draft);
});

test('editor field hygiene rejects raw table text and background overlap', () => {
  const rawTable = editor({
    sections: [
      section(1, {
        what_changed: 'CameraX 1.6.1 changed Android camera compatibility behavior.',
        article_sections: {
          ...section(1).article_sections,
          background_context: 'camera-view 1.6.1 - - 1.7.0-alpha01 camera-video 1.6.1 - - 1.7.0-alpha01 View the Camera Library Close Maven Group versions'
        }
      }),
      section(2),
      section(3)
    ]
  });
  const overlap = editor({
    sections: [
      section(1, {
        what_changed: 'CameraX 1.6.1 changed Android camera compatibility behavior for validation.',
        article_sections: {
          ...section(1).article_sections,
          background_context: 'CameraX 1.6.1 changed Android camera compatibility behavior for validation.'
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(rawTable, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.field_hygiene');
      assert.ok(error.details.issues.some(item => item.type === 'raw_artifact'));
      return true;
    }
  );
  assert.throws(
    () => validateEditorOutputContract(overlap, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.field_hygiene');
      assert.ok(error.details.issues.some(item =>
        item.type === 'field_overlap' &&
        item.overlap_kind === 'exact_duplicate' &&
        item.blocking === true
      ));
      return true;
    }
  );
});

test('editor field hygiene passes short overlap warnings and rejects semantic overlap', () => {
  const shortOverlap = editor({
    sections: [
      section(1, {
        what_changed: 'CameraX Android compatibility validation.',
        article_sections: {
          ...section(1).article_sections,
          background_context: 'CameraX Android compatibility checks.'
        }
      }),
      section(2),
      section(3)
    ]
  });
  const semanticOverlap = editor({
    sections: [
      section(1, {
        what_changed: 'CameraX release updates Android camera compatibility validation behavior today.',
        article_sections: {
          ...section(1).article_sections,
          background_context: 'CameraX release updates Android camera compatibility validation behavior now.'
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.equal(validateEditorOutputContract(shortOverlap, DATE, { normalizeSection }), shortOverlap);
  assert.throws(
    () => validateEditorOutputContract(semanticOverlap, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.field_hygiene');
      assert.ok(error.details.issues.some(item =>
        item.type === 'field_overlap' &&
        item.overlap_kind === 'semantic_overlap' &&
        item.blocking === true
      ));
      return true;
    }
  );
});

test('editor field hygiene leaves semantic direct HAL claim validity to LLM and editor judgment', () => {
  for (const halDriverImpact of [
    'This is a direct HAL API contract change for stream buffers.',
    'No, this is direct HAL API behavior.',
    'This is not only a CameraX update; it is direct HAL API behavior.',
    '이 항목은 HAL request/result에 직접 영향이 있습니다.',
    '이 항목은 직접 HAL API 변경이며 HAL buffer contract 변경입니다.'
  ]) {
    const draft = editor({
      sections: [
        section(1, {
          relevance_bucket: 'android_platform_camera_adjacent',
          impact_claim_level: 'direct_hal_change',
          article_sections: {
            ...section(1).article_sections,
            hal_driver_impact: halDriverImpact
          }
        }),
        section(2),
        section(3)
      ]
    });

    assert.equal(validateEditorOutputContract(draft, DATE, { normalizeSection }), draft);
  }
});

test('editor field hygiene allows direct HAL claims for direct source scope and guardrail wording', () => {
  const directDraft = editor({
    sections: [
      section(1, {
        aosp_camera_directness: 5,
        article_sections: {
          ...section(1).article_sections,
          hal_driver_impact: '이 항목은 직접 HAL API 변경이며 HAL buffer contract 변경입니다.'
        }
      }),
      section(2),
      section(3)
    ]
  });
  const guardrailDraft = editor({
    sections: [
      section(1, {
        relevance_bucket: 'android_platform_camera_adjacent',
        article_sections: {
          ...section(1).article_sections,
          hal_driver_impact: '직접 HAL API 변경으로 단정하지 않습니다. source evidence가 없으면 HAL contract impact를 claim하지 않습니다.'
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.equal(validateEditorOutputContract(directDraft, DATE, { normalizeSection }), directDraft);
  assert.equal(validateEditorOutputContract(guardrailDraft, DATE, { normalizeSection }), guardrailDraft);
});

test('editor field hygiene rejects internal classification in confirmed facts', () => {
  const draft = editor({
    sections: [
      section(1, {
        confirmed_facts: [
          'Android Developers가 2026-05-06에 게시 또는 업데이트한 항목입니다.',
          'Relevance bucket: android_platform_camera_adjacent.',
          'impact_claim_level=android_framework_adjacent.',
          'source_gap_risk=false.'
        ],
        specificity_checks: [
          'bucket=android_platform_camera_adjacent',
          'impact_claim_level=android_framework_adjacent'
        ]
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.field_hygiene');
      assert.ok(error.details.issues.some(item => item.type === 'internal_classification_in_confirmed_facts'));
      return true;
    }
  );
});

test('editor title fallback keeps canonical newsletter title contract', () => {
  const missingTitle = editor({ title: '' });
  const mismatchedTitle = editor({ title: 'Camera HAL / SW Newsletter - 2026-05-07' });

  validateEditorOutputContract(missingTitle, DATE, { normalizeSection });
  validateEditorOutputContract(mismatchedTitle, DATE, { normalizeSection });

  assert.equal(missingTitle.title, `Camera HAL / SW Newsletter - ${DATE}`);
  assert.equal(mismatchedTitle.title, `Camera HAL / SW Newsletter - ${DATE}`);
});

test('repairable claim binding failures are repaired without replacing articles', async () => {
  const newsroomDir = tempNewsroomDir();
  const url = 'https://example.com/source-1';
  const draft = editor({
    sections: [
      section(1, {
        evidence_summary: 'Fact 1',
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1'
        },
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'recommendation',
          evidence_ids: [],
          source_urls: [],
          impact_level: 'camerax_app_compatibility',
          overclaim_risk: 'low'
        }]
      })
    ]
  });
  let repairCalled = false;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    reporter: reporterForClaimTests(url),
    attempt: 6,
    stage: 'editor attempt 1/1',
    newsroomDir,
    normalizeSection,
    strictClaims: true,
    repairFn: async ({ invalidEditor, validationError }) => {
      repairCalled = true;
      assert.equal(validationError.details.field, 'sections.claims');
      return {
        ...invalidEditor,
        sections: [{
          ...invalidEditor.sections[0],
          claims: [{
            claim_id: 'claim-1',
            text: 'Fact 1',
            claim_type: 'fact',
            evidence_ids: ['evidence-1'],
            source_urls: [url],
            impact_level: 'app_api_or_framework_adjacent',
            overclaim_risk: 'low'
          }]
        }]
      };
    }
  });

  assert.equal(repairCalled, true);
  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.equal(result.editor.sections.length, 1);
  assert.equal(result.editor.sections[0].headline, draft.sections[0].headline);
  assert.deepEqual(result.editor.sections[0].sources, draft.sections[0].sources);
  assert.equal(result.editor.sections[0].claims[0].claim_type, 'fact');
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-6.json'));
  assert.equal(errorArtifact.details.field, 'sections.claims');
});

test('missing claims[] is deterministically backfilled from verified_facts without calling the LLM', async () => {
  const newsroomDir = tempNewsroomDir();
  const url = 'https://example.com/source-1';
  const draft = editor({
    sections: [
      section(1, {
        evidence_summary: 'Fact 1',
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1'
        },
        claims: []
      })
    ]
  });
  let repairCalled = false;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    reporter: reporterForClaimTests(url),
    attempt: 7,
    stage: 'editor attempt 1/1',
    newsroomDir,
    normalizeSection,
    strictClaims: true,
    repairFn: async () => {
      repairCalled = true;
      throw new Error('LLM repair should not be invoked when deterministic backfill succeeds.');
    }
  });

  assert.equal(repairCalled, false);
  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.equal(result.editor.sections.length, 1);
  const claims = result.editor.sections[0].claims;
  assert.equal(claims.length, 1);
  assert.equal(claims[0].claim_type, 'fact');
  assert.equal(claims[0].text, 'Fact 1');
  assert.deepEqual(claims[0].evidence_ids, ['evidence-1']);
  assert.deepEqual(claims[0].source_urls, [url]);
  assert.equal(claims[0].impact_level, 'no_hal_runtime_impact');
  assert.equal(result.editor.sections[0].headline, draft.sections[0].headline);
  assert.deepEqual(result.editor.sections[0].sources, draft.sections[0].sources);
});

test('missing claims[] fails closed when no candidate evidence can bind the verified_facts', async () => {
  const newsroomDir = tempNewsroomDir();
  const url = 'https://example.com/source-1';
  const reporter = {
    candidates: [{
      title: 'Source 1',
      url,
      source_candidate_hash: 'hash-1',
      relevance_bucket: 'direct_aosp_camera',
      counts_as_primary_camera_topic: true,
      hasDatedEvidence: true,
      source_gap_risk: false,
      main_eligible: true,
      finalSelectionEligibility: 'main'
    }]
  };
  const draft = editor({
    sections: [
      section(1, {
        evidence_summary: 'Fact 1',
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1'
        },
        claims: []
      })
    ]
  });

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      reporter,
      attempt: 8,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      strictClaims: true
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.claims');
      return true;
    }
  );
});

test('blocked context surfaces as the next blocker after claims are satisfied', async () => {
  const newsroomDir = tempNewsroomDir();
  const url = 'https://example.com/source-1';
  const blockedUrl = 'https://android-developers.googleblog.com/2026/05/roundup.html';
  const reporter = {
    candidates: [{
      title: 'Source 1',
      url,
      source_candidate_hash: 'hash-1',
      relevance_bucket: 'direct_aosp_camera',
      counts_as_primary_camera_topic: true,
      primary_evidence_ids: ['evidence-1'],
      compact_evidence: {
        primary_facts: ['Fact 1'],
        evidence_urls: [url],
        do_not_claim: ['Do not claim direct Camera HAL API changes.']
      },
      final_selected: true,
      selected_for_editor: true,
      primary_selected: true,
      hasDatedEvidence: true,
      source_gap_risk: false,
      main_eligible: true,
      finalSelectionEligibility: 'main',
      article_group_key: 'group-a',
      related_context_candidates: [{
        title: 'Blocked roundup',
        url: blockedUrl,
        context_role: 'parent_roundup_context_only',
        context_usage_allowed: false,
        can_create_independent_article: false,
        blocked_from_independent_main_reason: 'parent_roundup_context_only',
        article_group_key: 'group-a'
      }]
    }]
  };
  const baseSection = section(1);
  const draft = editor({
    sections: [
      section(1, {
        article_group_key: 'group-a',
        evidence_summary: 'Fact 1',
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1'
        },
        claims: [],
        sources: [
          { title: 'Source 1', url },
          { title: 'Blocked roundup', url: blockedUrl }
        ],
        public_article: {
          ...baseSection.public_article,
          source_links: [
            { title: 'Source 1', url, source_role: 'primary' },
            { title: 'Blocked roundup', url: blockedUrl, source_role: 'primary' }
          ]
        }
      })
    ]
  });
  let repairCalled = false;

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      reporter,
      attempt: 9,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      strictClaims: true,
      repairFn: async ({ invalidEditor }) => {
        repairCalled = true;
        return {
          ...invalidEditor,
          sections: [{
            ...invalidEditor.sections[0],
            claims: [{
              claim_id: 'claim-1',
              text: 'Fact 1',
              claim_type: 'fact',
              evidence_ids: ['evidence-1'],
              source_urls: [url],
              impact_level: 'app_api_or_framework_adjacent',
              overclaim_risk: 'low'
            }]
          }]
        };
      }
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.blocked_context');
      return true;
    }
  );
  assert.equal(repairCalled, false);
});

test('failure status can include editor semantic validation and repair fields', () => {
  const error = new EditorSemanticValidationError('Editor output must contain exactly 3 briefing items; got 4.', {
    field: 'briefing',
    expectedCount: 3,
    actualCount: 4,
    actualType: 'array',
    sectionCount: 3
  });
  error.editorSemanticValidation = { message: error.message, details: error.details };
  error.repairAttempted = true;
  error.repairSucceeded = false;

  const status = buildGenerationStatus({
    date: DATE,
    status: 'FAILED',
    extra: editorSemanticStatusExtra(error)
  });

  assert.equal(status.editor_semantic_validation.details.field, 'briefing');
  assert.equal(status.repairAttempted, true);
  assert.equal(status.repairSucceeded, false);
});

test('run-level editor semantic status preserves details and OR accumulates repair flags', () => {
  const {
    editorSemanticStatusExtra: freshEditorSemanticStatusExtra,
    recordEditorSemanticStatus
  } = loadFreshNewsletterCli();
  const initialDetails = {
    message: 'Editor output must contain exactly 3 briefing items; got 4.',
    details: {
      field: 'briefing',
      expectedCount: 3,
      actualCount: 4,
      actualType: 'array',
      sectionCount: 3
    }
  };
  const replacementDetails = {
    message: 'Editor output must contain exactly 3 briefing items; got 2.',
    details: {
      field: 'briefing',
      expectedCount: 3,
      actualCount: 2,
      actualType: 'array',
      sectionCount: 3
    }
  };

  recordEditorSemanticStatus({
    editor_semantic_validation: initialDetails,
    repairAttempted: true,
    repairSucceeded: true
  });
  recordEditorSemanticStatus({
    editor_semantic_validation: null,
    repairAttempted: false,
    repairSucceeded: false
  });
  recordEditorSemanticStatus({
    editor_semantic_validation: undefined
  });

  let status = freshEditorSemanticStatusExtra();
  assert.deepEqual(status.editor_semantic_validation, initialDetails);
  assert.equal(status.repairAttempted, true);
  assert.equal(status.repairSucceeded, true);

  const laterError = new EditorSemanticValidationError('Later non-repair failure.', {
    field: 'summary'
  });
  laterError.repairAttempted = false;
  laterError.repairSucceeded = false;
  status = freshEditorSemanticStatusExtra(laterError);
  assert.deepEqual(status.editor_semantic_validation, initialDetails);
  assert.equal(status.repairAttempted, true);
  assert.equal(status.repairSucceeded, true);

  recordEditorSemanticStatus({
    editor_semantic_validation: replacementDetails,
    repairAttempted: false,
    repairSucceeded: false
  });
  status = freshEditorSemanticStatusExtra();
  assert.deepEqual(status.editor_semantic_validation, replacementDetails);
  assert.equal(status.repairAttempted, true);
  assert.equal(status.repairSucceeded, true);
});

test('editor schema does not ask the model for values the code always overwrites or nobody reads', () => {
  // Gemini constrained decoding은 스키마의 상태 수가 많을수록 거부 위험이 커진다.
  // 그래서 "모델이 채워도 코드가 버리는 값"과 "채운 뒤 아무도 읽지 않는 값"은 스키마에서 뺀다.
  const sectionProperties = editorSchema.properties.sections.items.properties;
  const publicArticleProperties = sectionProperties.public_article.properties;

  // decision_metadata는 normalizeDecisionMetadata가 모델 값을 통째로 버리고 코드 파생값으로
  // 대체한다(public-article-contract.js). 모델에게 물어볼 이유가 없다.
  assert.equal('decision_metadata' in publicArticleProperties, false);
  assert.equal(sectionProperties.public_article.required.includes('decision_metadata'), false);

  // 아래 다섯은 editor 출력에서 읽는 소비자가 없다.
  for (const key of [
    'actionability_upgrade_evidence',
    'article_tier',
    'topic_area',
    'camera_output_relevance',
    'newsletter_relevance'
  ]) {
    assert.equal(key in sectionProperties, false, `${key} must not be in the editor schema`);
    assert.equal(editorSchema.properties.sections.items.required.includes(key), false);
  }

  // 반대로 소비자가 있는 형제 필드는 그대로 남아 있어야 한다(과잉 삭제 방지).
  for (const key of ['actionability_level', 'effective_actionability_level', 'actionability_upgrade_reason']) {
    assert.equal(key in sectionProperties, true, `${key} must stay in the editor schema`);
  }
});

test('editor schema constrains briefing to exactly 3 numeric items', () => {
  assert.equal(editorSchema.properties.briefing.minItems, 3);
  assert.equal(editorSchema.properties.briefing.maxItems, 3);
});

test('editor schema requires article_sections with five required normalized keys', () => {
  const articleSections = editorSchema.properties.sections.items.properties.article_sections;

  assert.ok(articleSections);
  assert.deepEqual(articleSections.required, [
    'verified_facts',
    'background_context',
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ]);
  assert.equal(
    editorSchema.properties.sections.items.required.includes('article_sections'),
    true
  );
  assert.equal(articleSections.additionalProperties, false);
  assert.deepEqual(Object.keys(articleSections.properties).sort(), [
    'action_items',
    'background_context',
    'do_not_claim',
    'hal_driver_impact',
    'known_limitations',
    'team_share_points',
    'verified_facts',
    'watch_items'
  ]);
  for (const key of ['known_limitations', 'watch_items', 'do_not_claim']) {
    assert.equal(articleSections.properties[key].type, 'ARRAY');
  }
});

test('editor schema requires public_article with reader-facing fields', () => {
  const publicArticle = editorSchema.properties.sections.items.properties.public_article;

  assert.ok(publicArticle);
  assert.deepEqual(publicArticle.required, [
    'headline',
    'source_subtitle',
    'lead',
    'body_paragraphs',
    'camera_hal_takeaway',
    'reader_checkpoints',
    'story_contract_version',
    'editorial_story',
    'source_links'
  ]);
  assert.ok(publicArticle.properties.editorial_story);
  assert.deepEqual(publicArticle.properties.editorial_story.required, [
    'reader_scenario',
    'what_happened',
    'why_it_matters',
    'field_scenario',
    'not_to_overclaim',
    'editor_take'
  ]);
  assert.deepEqual(editorSchema.required.slice(0, 3), [
    'date',
    'public_contract_version',
    'generation_contract_version'
  ]);
  assert.equal(
    editorSchema.properties.sections.items.required.includes('public_article'),
    true
  );
  assert.deepEqual(publicArticle.properties.source_links.items.required, ['title', 'url']);
});

test('editor schema requires hal_signal_capsule on every section with required capsule keys', () => {
  const capsule = editorSchema.properties.sections.items.properties.hal_signal_capsule;

  assert.ok(capsule);
  assert.deepEqual(capsule.required, [
    'why_now',
    'reader_owners',
    'check_within_2_weeks',
    'impact_axes',
    'do_not_overstate'
  ]);
  // validateHalSignalCapsules가 모든 section에 capsule을 hard-require하는데 response schema가
  // 생략을 허용하면 constrained decoding이 capsule 없는 draft를 만들 수 있고, 그 생략은
  // deterministic repair(섹션에 남는 날짜/축 필드 없음)로도 복구되지 않는다(2026-07-20 발행 차단).
  assert.equal(
    editorSchema.properties.sections.items.required.includes('hal_signal_capsule'),
    true
  );
});

test('coverage_type is NOT in the Gemini response schema (deterministically stamped instead)', () => {
  // coverage_type / catch_up_age_days are set deterministically by stampCoverageType
  // after generation, so they must NOT appear in the LLM response schema (keeps the
  // already-large section object under Gemini structured-output complexity limits).
  const sectionSchema = editorSchema.properties.sections.items;
  assert.equal(sectionSchema.properties.coverage_type, undefined);
  assert.equal(sectionSchema.properties.catch_up_age_days, undefined);
});
