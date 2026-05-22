const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  EditorSemanticValidationError,
  repairEditorOutputContract,
  validateEditorOutputContract
} = require('../../scripts/newsroom/validate/editor-output-contract');
const { editorSchema } = require('../../scripts/newsroom/render/newsletter-schema');
const {
  buildGenerationStatus,
  editorSemanticStatusExtra,
  linkedEvidencePromptGuardrails,
  sourceExtractionPromptGuardrails
} = require('../../scripts/gemini-newsroom-newsletter');
const {
  articlePolicy
} = require('../../scripts/newsroom/common/newsletter-policy');

const DATE = '2026-05-08';

function section(index, overrides = {}) {
  const value = {
    category: `Category ${index}`,
    headline: `Headline ${index}`,
    what_changed: `Change ${index}`,
    confirmed_facts: [`Fact ${index}`],
    evidence_summary: `Evidence ${index}`,
    specificity_checks: [`Check ${index}`],
    source_verification_notes: [`Source note ${index}`],
    background: `Background ${index}`,
    why_it_matters: `Why ${index}`,
    camera_hal_perspective: `HAL perspective ${index}`,
    camera_hal_checks: [`HAL check ${index}`],
    action_items: [`Action ${index}`],
    team_summary: `Summary ${index}`,
    is_ai_related: false,
    article_type: 'camera-hal',
    hal_impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
    reader_owners: ['camera_hal_owner', 'camera_test_owner'],
    actionability_level: 'concrete_check',
    signal_quality_status: 'usable_signal',
    do_not_overstate: ['Do not overstate direct HAL impact.'],
    fallback_promotion_allowed: true,
    fallback_promotion_reason: 'Primary Camera Stack section.',
    fallback_guard_notes: ['Keep claims tied to source evidence.'],
    soc_signal_type: '',
    soc_signal_source_allowed: true,
    camera_pipeline_link: 'Camera workload validation through stream and metadata checks.',
    hal_signal_capsule: {
      why_now: `Headline ${index} gives a dated HAL validation signal.`,
      reader_owners: ['camera_hal_owner', 'camera_test_owner'],
      check_within_2_weeks: `Run Camera ITS and stream metadata checks for Headline ${index} within 2 weeks.`,
      impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
      do_not_overstate: ['Do not overstate direct HAL impact.']
    },
    public_article: {
      headline: `Headline ${index}`,
      lead: `Headline ${index} gives Camera HAL readers a source-backed validation signal.`,
      body_paragraphs: [
        `Headline ${index} was selected from dated source evidence for Camera HAL readers.`,
        `The practical interpretation for Headline ${index} stays limited to stream and metadata validation.`
      ],
      camera_hal_takeaway: `HAL perspective ${index}`,
      reader_checkpoints: [
        `Run Camera ITS and stream metadata checks for Headline ${index}.`,
        `Compare preview latency and frame-drop metrics for Headline ${index}.`
      ],
      source_links: [{
        title: `Source ${index}`,
        url: `https://example.com/source-${index}`,
        source_role: 'primary'
      }]
    },
    selectedImage: '',
    imageSource: '',
    imageAttribution: '',
    imageAlt: '',
    imageLicenseStatus: 'none',
    imageUsageDecisionReason: 'No suitable attributed image selected.',
    sources: [{
      title: `Source ${index}`,
      url: `https://example.com/source-${index}`
    }],
    relevance_bucket: 'direct_aosp_camera',
    counts_as_primary_camera_topic: true,
    source_candidate_hash: `hash-${index}`,
    ...overrides
  };
  if (!Object.prototype.hasOwnProperty.call(overrides, 'article_sections')) {
    value.article_sections = {
      verified_facts: value.confirmed_facts,
      background_context: value.background,
      hal_driver_impact: value.camera_hal_perspective,
      action_items: value.action_items,
      team_share_points: value.team_summary
    };
  }
  return value;
}

function editor(overrides = {}) {
  return {
    date: DATE,
    title: `Camera HAL SW Newsletter - ${DATE}`,
    summary: 'Summary',
    briefing: ['one', 'two', 'three'],
    sections: [section(1), section(2), section(3)],
    action_items: ['Action'],
    references: [],
    ...overrides
  };
}

function reporterForClaimTests(url = 'https://example.com/source-1') {
  return {
    candidates: [{
      title: 'Source 1',
      url,
      source_candidate_hash: 'hash-1',
      relevance_bucket: 'direct_aosp_camera',
      aosp_camera_directness: 5,
      counts_as_primary_camera_topic: true,
      impact_claim_level: 'camera_stack_direct',
      primary_evidence_ids: ['evidence-1'],
      compact_evidence: {
        primary_facts: ['Fact 1'],
        evidence_urls: [url],
        do_not_claim: ['Do not claim direct Camera HAL API changes.']
      },
      finalSelectionEligibility: 'main',
      hasDatedEvidence: true,
      source_gap_risk: false,
      main_eligible: true
    }]
  };
}

function reporterForGroupTests(overrides = {}) {
  return {
    candidates: [{
      title: 'Selected group source',
      url: 'https://example.com/source-1',
      source_candidate_hash: 'hash-1',
      article_group_key: 'group-a',
      relevance_bucket: 'cpp_ai_tooling_fallback',
      final_selected: true,
      selected_for_editor: true,
      primary_selected: true,
      finalSelectionEligibility: 'short',
      hasDatedEvidence: true,
      source_gap_risk: false,
      main_eligible: true,
      related_context_candidates: [],
      ...overrides
    }]
  };
}

function normalizeSection(value) {
  return {
    ...value,
    sources: Array.isArray(value.sources)
      ? value.sources.filter(source => source && source.url)
      : []
  };
}

function tempNewsroomDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'editor-output-contract-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadFreshNewsletterCli() {
  const cliPath = require.resolve('../../scripts/newsroom/cli/gemini-newsroom-newsletter');
  delete require.cache[cliPath];
  return require(cliPath);
}

test('LLM prompt guardrails prohibit linked evidence overclaim without exposing payloads', () => {
  const guardrails = linkedEvidencePromptGuardrails();
  assert.match(guardrails, /prompt payload에 포함되어 있지 않습니다/);
  assert.match(guardrails, /article capsule 또는 source field/);
  assert.match(guardrails, /Editor draft text는 linked evidence가 아닙니다/);
  assert.match(guardrails, /검증해야 할 claim/);
  assert.doesNotMatch(guardrails, /editor draft fields/);
  assert.match(guardrails, /blocked, failed, skipped, unsupported/);
  assert.match(guardrails, /build_dependency_fix, test_only_change, documentation_only/);
  assert.match(guardrails, /stream, buffer, metadata, request, result, ImageCapture, VideoCapture, Surface, CameraPipe/);

  const cliPath = require.resolve('../../scripts/newsroom/cli/gemini-newsroom-newsletter');
  const source = fs.readFileSync(cliPath, 'utf8');
  const promptUsageCount = (source.match(/linkedEvidencePromptGuardrails\(\),/g) || []).length;
  assert.ok(promptUsageCount >= 7);
});

test('LLM prompt guardrails treat source quality blockers as hard generation inputs', () => {
  const guardrails = sourceExtractionPromptGuardrails();
  assert.match(guardrails, /canonical source_quality/);
  assert.match(guardrails, /main_article_source_allowed=false/);
  assert.match(guardrails, /hard blocker/);
  assert.match(guardrails, /main_article_source_blockers/);
  assert.match(guardrails, /blocked 또는 failed linked evidence/);
});

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
          { title: 'Blocked roundup', url: blockedUrl, source_role: 'context' }
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
      sources: [{ title: 'Selected group source', url: 'https://example.com/source-1' }],
      public_article: {
        ...baseSection.public_article,
        source_links: [
          { title: 'Selected group source', url: 'https://example.com/source-1', source_role: 'primary' },
          { title: 'Blocked roundup', url: blockedUrl, source_role: 'context' }
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

test('strict editor claim binding requires a fact claim for factual article fields', () => {
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'recommendation',
          evidence_ids: ['evidence-1'],
          source_urls: ['https://example.com/source-1'],
          impact_level: 'direct_hal_contract',
          overclaim_risk: 'low'
        }]
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, {
      normalizeSection,
      reporter: reporterForClaimTests(),
      strictClaims: true
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.claims');
      assert.ok(error.details.issues.some(issue =>
        issue.issues.some(item => item.reason_code === 'missing_fact_claim')
      ));
      return true;
    }
  );
});

test('strict editor claim binding rejects duplicate claim ids and invalid enums', () => {
  const draft = editor({
    sections: [
      section(1, {
        claims: [
          {
            claim_id: 'claim-1',
            text: 'Fact 1',
            claim_type: 'fact',
            evidence_ids: ['evidence-1'],
            source_urls: ['https://example.com/source-1'],
            impact_level: 'not_an_impact',
            overclaim_risk: 'low'
          },
          {
            claim_id: 'claim-1',
            text: 'Fact 1',
            claim_type: 'not_a_claim_type',
            evidence_ids: ['evidence-1'],
            source_urls: ['https://example.com/source-1'],
            impact_level: 'direct_hal_contract',
            overclaim_risk: 'impossible'
          }
        ]
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, {
      normalizeSection,
      reporter: reporterForClaimTests(),
      strictClaims: true
    }),
    error => {
      const reasonCodes = error.details.issues.flatMap(issue =>
        issue.issues.map(item => item.reason_code)
      );
      assert.ok(reasonCodes.includes('duplicate_claim_id'));
      assert.ok(reasonCodes.includes('invalid_claim_type'));
      assert.ok(reasonCodes.includes('invalid_impact_level'));
      assert.ok(reasonCodes.includes('invalid_overclaim_risk'));
      return true;
    }
  );
});

test('strict editor claim binding maps source and HAL signal impact aliases with source URL evidence', () => {
  const url = 'https://example.com/source-1';
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: [],
          source_urls: [url],
          impact_level: 'camerax_app_compatibility',
          overclaim_risk: 'low'
        }]
      })
    ]
  });
  const reporter = {
    candidates: [{
      title: 'Source 1',
      url,
      source_candidate_hash: 'hash-1',
      source_extraction: {
        evidence_blocks: [{
          text: 'Fact 1',
          links: [{ url }]
        }]
      },
      impact_claim_level: 'direct_hal_change',
      finalSelectionEligibility: 'main',
      hasDatedEvidence: true,
      source_gap_risk: false,
      main_eligible: true
    }]
  };

  assert.doesNotThrow(() => validateEditorOutputContract(draft, DATE, {
    normalizeSection,
    reporter,
    strictClaims: true
  }));
});

test('editor output contract requires article_sections on new draft sections', () => {
  const draft = editor({
    sections: [
      section(1, { article_sections: undefined }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.article_sections');
      assert.ok(error.details.issues.some(issue => issue.type === 'missing_article_sections'));
      return true;
    }
  );
});

test('editor output contract requires HAL Signal Capsule on new draft sections', () => {
  const draft = editor({
    sections: [
      section(1, { hal_signal_capsule: undefined }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.hal_signal_capsule');
      assert.ok(error.details.issues.some(issue => issue.type === 'missing_hal_signal_capsule'));
      return true;
    }
  );
});

test('editor output contract requires public_article on new draft sections', () => {
  const draft = editor({
    sections: [
      section(1, { public_article: undefined }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue => issue.type === 'missing_public_article'));
      return true;
    }
  );
});

test('editor output contract rejects invalid public_article source_links', () => {
  const draft = editor({
    sections: [
      section(1, {
        public_article: {
          ...section(1).public_article,
          source_links: [{
            title: '',
            url: '.tmp/newsletter.md',
            source_role: 'editorial'
          }]
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      const reasons = error.details.issues.map(issue => issue.reason).filter(Boolean);
      assert.ok(reasons.includes('missing_title'));
      assert.ok(reasons.includes('invalid_url'));
      assert.ok(reasons.includes('unsupported_role'));
      return true;
    }
  );
});

test('editor output contract maps source-quality roles on public_article source_links', () => {
  const draft = editor({
    sections: [
      section(1, {
        public_article: {
          ...section(1).public_article,
          source_links: [{
            title: 'Official release note',
            url: 'https://example.com/source-1',
            source_role: 'official_release_source'
          }]
        }
      }),
      section(2),
      section(3)
    ]
  });

  const result = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(result.sections[0].public_article.source_links[0].source_role, 'primary');
});

test('editor output contract rejects article_sections keys outside normalized contract', () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1',
          legacy_summary: 'This key is outside the normalized contract.'
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.article_sections');
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unexpected_article_section_keys' &&
        issue.keys.includes('legacy_summary')
      ));
      return true;
    }
  );
});

test('editor output contract allows and preserves optional article_sections keys', () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1',
          known_limitations: ['No direct HAL contract change is stated.'],
          watch_items: ['Track CameraX SessionConfig regressions.'],
          do_not_claim: ['Do not claim direct Camera HAL API changes.']
        }
      }),
      section(2),
      section(3)
    ]
  });

  const validated = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.deepEqual(validated.sections[0].article_sections.known_limitations, [
    'No direct HAL contract change is stated.'
  ]);
  assert.deepEqual(validated.sections[0].article_sections.watch_items, [
    'Track CameraX SessionConfig regressions.'
  ]);
  assert.deepEqual(validated.sections[0].article_sections.do_not_claim, [
    'Do not claim direct Camera HAL API changes.'
  ]);
});

test('editor output contract drops empty optional article_sections keys after normalization', () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1',
          known_limitations: [],
          watch_items: '',
          do_not_claim: []
        }
      }),
      section(2),
      section(3)
    ]
  });

  const validated = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(Object.prototype.hasOwnProperty.call(validated.sections[0].article_sections, 'known_limitations'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(validated.sections[0].article_sections, 'watch_items'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(validated.sections[0].article_sections, 'do_not_claim'), false);
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
        background: 'camera-view 1.6.1 - - 1.7.0-alpha01 camera-video 1.6.1 - - 1.7.0-alpha01 View the Camera Library Close Maven Group versions'
      }),
      section(2),
      section(3)
    ]
  });
  const overlap = editor({
    sections: [
      section(1, {
        what_changed: 'CameraX 1.6.1 changed Android camera compatibility behavior for validation.',
        background: 'CameraX 1.6.1 changed Android camera compatibility behavior for validation.'
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
        background: 'CameraX Android compatibility checks.'
      }),
      section(2),
      section(3)
    ]
  });
  const semanticOverlap = editor({
    sections: [
      section(1, {
        what_changed: 'CameraX release updates Android camera compatibility validation behavior today.',
        background: 'CameraX release updates Android camera compatibility validation behavior now.'
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

test('editor field hygiene rejects direct HAL contract overclaim for adjacent impact level', () => {
  const draft = editor({
    sections: [
      section(1, {
        relevance_bucket: 'android_platform_camera_adjacent',
        impact_claim_level: 'android_framework_adjacent',
        camera_hal_perspective: 'This is a direct HAL API contract change for stream buffers.'
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
      assert.ok(error.details.issues.some(item => item.type === 'overclaim_guardrail'));
      return true;
    }
  );
});

test('editor field hygiene does not let standalone not or no hide HAL overclaims', () => {
  for (const camera_hal_perspective of [
    'No, this is direct HAL API behavior.',
    'This is not only a CameraX update; it is direct HAL API behavior.'
  ]) {
    const draft = editor({
      sections: [
        section(1, {
          relevance_bucket: 'android_platform_camera_adjacent',
          impact_claim_level: 'android_framework_adjacent',
          camera_hal_perspective
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
        assert.ok(error.details.issues.some(item => item.type === 'overclaim_guardrail' && item.blocking === true));
        return true;
      }
    );
  }
});

test('editor field hygiene rejects Korean HAL overclaim for non-direct impact level', () => {
  const draft = editor({
    sections: [
      section(1, {
        relevance_bucket: 'android_platform_camera_adjacent',
        impact_claim_level: 'android_framework_adjacent',
        camera_hal_perspective: '이 항목은 HAL request/result에 직접 영향이 있습니다.'
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
      assert.ok(error.details.issues.some(item => item.type === 'overclaim_guardrail' && item.blocking === true));
      return true;
    }
  );
});

test('editor field hygiene allows direct HAL claims for direct_hal_change and guardrail wording', () => {
  const directDraft = editor({
    sections: [
      section(1, {
        impact_claim_level: 'direct_hal_change',
        camera_hal_perspective: '이 항목은 직접 HAL API 변경이며 HAL buffer contract 변경입니다.'
      }),
      section(2),
      section(3)
    ]
  });
  const guardrailDraft = editor({
    sections: [
      section(1, {
        relevance_bucket: 'android_platform_camera_adjacent',
        impact_claim_level: 'android_framework_adjacent',
        camera_hal_perspective: '직접 HAL API 변경으로 단정하지 않습니다. source evidence가 없으면 HAL contract impact를 claim하지 않습니다.'
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

test('editor title fallback keeps existing Korean title contract', () => {
  const missingTitle = editor({ title: '' });
  const mismatchedTitle = editor({ title: 'Camera HAL SW Newsletter - 2026-05-07' });

  validateEditorOutputContract(missingTitle, DATE, { normalizeSection });
  validateEditorOutputContract(mismatchedTitle, DATE, { normalizeSection });

  assert.equal(missingTitle.title, `Camera HAL SW 뉴스레터 - ${DATE}`);
  assert.equal(mismatchedTitle.title, `Camera HAL SW 뉴스레터 - ${DATE}`);
});

test('excessive briefing items are repaired and initial diagnostics are written', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });
  let repairCalled = false;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async ({ invalidEditor, validationError }) => {
      repairCalled = true;
      assert.equal(validationError.details.field, 'briefing');
      return { ...invalidEditor, briefing: ['one', 'two', 'three'] };
    }
  });

  assert.equal(repairCalled, true);
  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.deepEqual(result.editor.briefing, ['one', 'two', 'three']);
  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-attempt-1.json')).briefing.length, 4);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-1.json'));
  assert.equal(errorArtifact.details.actualCount, 4);
  assert.match(errorArtifact.message, /got 4/);
});

test('missing briefing items are repaired with clear diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two'] });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 2,
    stage: 'editor attempt 2/2',
    newsroomDir,
    normalizeSection,
    repairFn: async ({ invalidEditor }) => ({
      ...invalidEditor,
      briefing: ['one', 'two', 'three']
    })
  });

  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-2.json'));
  assert.equal(errorArtifact.details.expectedCount, 3);
  assert.equal(errorArtifact.details.actualCount, 2);
});

test('non-array briefing reports the actual type clearly', () => {
  const draft = editor({ briefing: 'one' });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'briefing');
      assert.equal(error.details.actualType, 'string');
      assert.match(error.message, /got non-array string/);
      return true;
    }
  );
});

test('repair preserves sections and sources', async () => {
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/1',
    normalizeSection,
    repairFn: async ({ invalidEditor }) => ({
      ...invalidEditor,
      briefing: ['one', 'two', 'three']
    })
  });

  assert.deepEqual(
    result.editor.sections.map(item => item.sources),
    draft.sections.map(item => item.sources)
  );
});

test('repair that changes sections or sources fatally fails and writes repair diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 3,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async ({ invalidEditor }) => ({
        ...invalidEditor,
        briefing: ['one', 'two', 'three'],
        sections: [
          {
            ...invalidEditor.sections[0],
            sources: [{ title: 'Changed source', url: 'https://example.com/changed' }]
          },
          ...invalidEditor.sections.slice(1)
        ]
      })
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.sources');
      assert.equal(error.repairAttempted, true);
      assert.equal(error.repairSucceeded, false);
      return true;
    }
  );

  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-repair-attempt-3.json')).sections[0].sources[0].url, 'https://example.com/changed');
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-repair-attempt-3.json'));
  assert.equal(errorArtifact.details.field, 'sections.sources');
  assert.equal(errorArtifact.repairAttempted, true);
  assert.equal(errorArtifact.repairSucceeded, false);
});

test('repair output with invalid briefing writes repair diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 4,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async ({ invalidEditor }) => ({
        ...invalidEditor,
        briefing: ['one', 'two']
      })
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'briefing');
      assert.equal(error.repairAttempted, true);
      assert.equal(error.repairSucceeded, false);
      return true;
    }
  );

  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-repair-attempt-4.json')).briefing.length, 2);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-repair-attempt-4.json'));
  assert.equal(errorArtifact.details.actualCount, 2);
});

test('unrepairable section-count semantic failures are not repaired', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ sections: [] });
  let repairCalled = false;

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 5,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async () => {
        repairCalled = true;
        return editor();
      }
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections');
      assert.equal(error.repairAttempted, false);
      return true;
    }
  );

  assert.equal(repairCalled, false);
  assert.equal(readJson(path.join(newsroomDir, 'editor-validation-error-attempt-5.json')).details.field, 'sections');
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

test('editor schema constrains briefing to exactly 3 numeric items', () => {
  assert.equal(editorSchema.properties.briefing.minItems, 3);
  assert.equal(editorSchema.properties.briefing.maxItems, 3);
});

test('editor schema keeps article_sections optional with five required normalized keys when present', () => {
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
    false
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
    'lead',
    'body_paragraphs',
    'camera_hal_takeaway',
    'reader_checkpoints',
    'source_links'
  ]);
  assert.equal(
    editorSchema.properties.sections.items.required.includes('public_article'),
    true
  );
  assert.deepEqual(publicArticle.properties.source_links.items.required, ['title', 'url']);
});

test('editor schema keeps hal_signal_capsule optional with required capsule keys when present', () => {
  const capsule = editorSchema.properties.sections.items.properties.hal_signal_capsule;

  assert.ok(capsule);
  assert.deepEqual(capsule.required, [
    'why_now',
    'reader_owners',
    'check_within_2_weeks',
    'impact_axes',
    'do_not_overstate'
  ]);
  assert.equal(
    editorSchema.properties.sections.items.required.includes('hal_signal_capsule'),
    false
  );
});
