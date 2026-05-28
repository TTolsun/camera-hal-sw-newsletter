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
  articleClaimContractPrompt,
  buildGenerationStatus,
  editorSemanticStatusExtra,
  linkedEvidencePromptGuardrails,
  sourceExtractionPromptGuardrails
} = require('../../scripts/gemini-newsroom-newsletter');
const {
  articlePolicy
} = require('../../scripts/newsroom/common/newsletter-policy');
const {
  isConcreteCheckpoint,
  deriveDecisionMetadata,
  mergePublicArticleFromLlm,
  mergePublicArticlesFromLlmSections,
  validatePublicArticle
} = require('../../scripts/newsroom/common/public-article-contract');

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
    title: `Camera HAL / SW Newsletter - ${DATE}`,
    summary: 'Summary',
    briefing: ['one', 'two', 'three'],
    sections: [section(1), section(2), section(3)],
    action_items: ['Action'],
    references: [],
    ...overrides
  };
}

function storyPublicArticle(baseSection = section(1), overrides = {}) {
  const publicArticle = {
    ...baseSection.public_article,
    story_contract_version: 1,
    source_subtitle: `${baseSection.sources[0].title} · 2026-05-08`,
    editorial_story: {
      reader_scenario: 'HAL 리뷰 중 이 변경이 stream metadata 검증 범위에 들어가는지 확인해야 하는 상황을 가정합니다.',
      what_happened: `${baseSection.headline} source가 확인한 변경점을 공개했습니다.`,
      why_it_matters: 'Camera HAL 독자는 이 항목을 source 범위 안에서 regression 검증 후보로 볼 수 있습니다.',
      field_scenario: 'Camera ITS와 preview latency log를 비교하는 리뷰 흐름에 연결합니다.',
      not_to_overclaim: 'source가 직접 말하지 않는 HAL runtime 변경으로 확대하지 않습니다.',
      editor_take: '검증 대상은 source가 확인한 범위 안에서만 잡습니다.'
    },
    decision_metadata: {
      impact: 'High',
      scope: ['HAL'],
      action: ['Test', 'Adopt'],
      overclaim_risk: 'Low'
    },
    ...overrides
  };
  return publicArticle;
}

function storyEditor(overrides = {}) {
  const sections = [section(1), section(2), section(3)].map(item => ({
    ...item,
    public_article: storyPublicArticle(item)
  }));
  return editor({
    public_contract_version: 'story-v1',
    generation_contract_version: 1,
    sections,
    ...overrides
  });
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

test('strict editor claim binding accepts allowed claim evidence ids', () => {
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: ['evidence-1'],
          source_urls: ['https://example.com/source-1'],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      })
    ]
  });

  assert.doesNotThrow(() => validateEditorOutputContract(draft, DATE, {
    normalizeSection,
    reporter: reporterForClaimTests(),
    strictClaims: true
  }));
});

test('strict editor claim binding uses seed evidence pack input when validating editor output', () => {
  const url = 'https://example.com/source-1';
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: ['seed-primary-1'],
          source_urls: [url],
          impact_level: 'app_api_or_framework_adjacent',
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
      relevance_bucket: 'direct_aosp_camera',
      counts_as_primary_camera_topic: true,
      evidence_pack_ids: ['seed-pack-1'],
      finalSelectionEligibility: 'main',
      hasDatedEvidence: true,
      source_gap_risk: false,
      main_eligible: true
    }]
  };
  const seedEvidencePack = {
    packs: [{
      evidence_pack_id: 'seed-pack-1',
      seed_url: url,
      final_url: url,
      title: 'Source 1',
      primary_evidence: [{
        evidence_id: 'seed-primary-1',
        url,
        title: 'Source 1',
        source_backed_items: ['Fact 1']
      }],
      linked_evidence: []
    }]
  };

  assert.doesNotThrow(() => validateEditorOutputContract(draft, DATE, {
    normalizeSection,
    reporter,
    strictClaims: true,
    seedEvidencePack
  }));
});

test('strict editor claim binding rejects field paths as evidence ids', () => {
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: ['article_sections.verified_facts[0]'],
          source_urls: ['https://example.com/source-1'],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      })
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
      assert.ok(reasonCodes.includes('unknown_evidence_id'));
      return true;
    }
  );
});

test('claim prompt restricts editor and repair evidence ids to allowed evidence', () => {
  const prompt = articleClaimContractPrompt();

  assert.match(prompt, /allowed_claim_evidence\[\]\.evidence_id/);
  assert.match(prompt, /allowed_claim_evidence\[\]\.source_urls/);
  assert.match(prompt, /confirmed_facts\[0\]/);
  assert.match(prompt, /article_sections\.verified_facts\[0\]/);
  assert.doesNotMatch(prompt, /Repair/);
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

test('semantic repair deterministically restores missing article_sections from section fields', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({
    sections: [
      section(1, { article_sections: undefined }),
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed for deterministic article_sections repair.');
    }
  });

  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].article_sections, {
    verified_facts: ['Fact 1'],
    background_context: 'Background 1 Why 1 Evidence 1',
    hal_driver_impact: 'HAL perspective 1',
    action_items: ['Action 1'],
    team_share_points: 'Summary 1',
    do_not_claim: ['Do not overstate direct HAL impact.']
  });
  assert.equal(fs.existsSync(path.join(newsroomDir, 'editor-invalid-attempt-1.json')), true);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-1.json'));
  assert.equal(errorArtifact.field, 'sections.article_sections');
});

test('semantic repair deterministically restores legacy sections and HAL Signal Capsule without LLM repair', async () => {
  const newsroomDir = tempNewsroomDir();
  const firstSection = section(1, {
    article_sections: undefined,
    hal_signal_capsule: undefined,
    action_items: ['Run Camera ITS and stream metadata checks for Headline 1 within 2 weeks.'],
    sources: [{
      title: 'Source 1',
      url: 'https://example.com/source-1',
      date: '2026-05-07'
    }]
  });
  const publicArticle = JSON.parse(JSON.stringify(firstSection.public_article));
  const sources = JSON.parse(JSON.stringify(firstSection.sources));
  const draft = editor({
    sections: [
      firstSection,
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed for deterministic schema repair.');
    }
  });

  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].public_article, publicArticle);
  assert.deepEqual(result.editor.sections[0].sources, sources);
  assert.deepEqual(result.editor.sections[0].hal_signal_capsule, {
    why_now: 'Source date 2026-05-07 provides the dated context for this HAL validation signal.',
    reader_owners: ['camera_hal_owner', 'camera_test_owner'],
    check_within_2_weeks: 'Run Camera ITS and stream metadata checks for Headline 1 within 2 weeks.',
    impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
    do_not_overstate: ['Do not overstate direct HAL impact.']
  });
});

test('semantic repair preserves complete HAL Signal Capsule during deterministic article section repair', async () => {
  const capsule = {
    why_now: 'Custom dated HAL signal is already present.',
    reader_owners: ['camera_driver_owner'],
    check_within_2_weeks: 'Keep the existing driver validation task.',
    impact_axes: ['driver_image_pipeline'],
    do_not_overstate: ['Preserve this existing caution.']
  };
  const draft = editor({
    sections: [
      section(1, {
        article_sections: undefined,
        hal_signal_capsule: capsule
      }),
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed when complete capsule exists.');
    }
  });

  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].hal_signal_capsule, capsule);
});

test('semantic repair falls back to LLM repair with deterministic reason code for missing semantic fields', async () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: undefined,
        camera_hal_perspective: ''
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, undefined);
  assert.deepEqual(validationError.deterministic_repair_failure_reason_codes, ['missing_hal_driver_impact']);
});

test('semantic repair does not create why_now from generation date alone', async () => {
  const draft = editor({
    sections: [
      section(1, {
        hal_signal_capsule: undefined,
        sources: [{
          title: 'Source 1',
          url: 'https://example.com/source-1'
        }]
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('missing_why_now_context'));
});

test('semantic repair records unknown axis and owner mapping failures before LLM fallback', async () => {
  const draft = editor({
    sections: [
      section(1, {
        hal_signal_capsule: undefined,
        hal_impact_axes: ['future_camera_lane'],
        reader_owners: [],
        relevance_bucket: '',
        sources: [{
          title: 'Source 1',
          url: 'https://example.com/source-1',
          date: '2026-05-07'
        }]
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('unknown_impact_axis'));
  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('missing_reader_owner_mapping'));
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

test('LLM public_article merge preserves deterministic article fields', () => {
  const base = section(1, {
    finalSelectionEligibility: 'main',
    source_gap_risk: true,
    main_article_readiness: { status: 'blocked' },
    do_not_claim: ['Do not claim HAL driver changes.']
  });
  const llm = {
    ...base,
    finalSelectionEligibility: 'main',
    source_gap_risk: false,
    main_article_readiness: { status: 'ready' },
    do_not_claim: [],
    public_article: {
      ...base.public_article,
      headline: 'Rewritten public headline'
    }
  };

  const merged = mergePublicArticleFromLlm(base, llm, {
    finalSelectionEligibility: base.finalSelectionEligibility,
    source_gap_risk: base.source_gap_risk,
    main_article_readiness: base.main_article_readiness,
    do_not_claim: base.do_not_claim
  });

  assert.equal(merged.public_article.headline, 'Rewritten public headline');
  assert.equal(merged.source_gap_risk, true);
  assert.deepEqual(merged.main_article_readiness, { status: 'blocked' });
  assert.deepEqual(merged.do_not_claim, ['Do not claim HAL driver changes.']);
});

test('LLM public_article merge fails closed on invalid source link provenance', () => {
  const base = section(1, {
    related_context_sources: [{
      title: 'Context-only reference',
      url: 'https://example.com/context-doc',
      source_role: 'related_context'
    }]
  });
  const llm = {
    ...base,
    public_article: {
      ...base.public_article,
      source_links: [{
        title: 'Context-only reference',
        url: 'https://example.com/context-doc',
        source_role: 'primary'
      }]
    }
  };

  assert.throws(
    () => mergePublicArticleFromLlm(base, llm),
    error => {
      assert.equal(error.code, 'invalid_public_source_links');
      assert.ok(error.details.issues.some(issue => issue.reason === 'source_role_not_allowed_for_url'));
      return true;
    }
  );
});

test('LLM section merge uses source_candidate_hash before title or URL', () => {
  const baseSections = [section(1), section(2)];
  const llmSections = [{
    ...section(2, { headline: 'LLM changed title' }),
    source_candidate_hash: 'hash-2',
    sources: [{ title: 'Unexpected URL', url: 'https://example.com/unmatched' }],
    public_article: {
      ...section(2).public_article,
      headline: 'Hash matched public headline'
    }
  }];

  const merged = mergePublicArticlesFromLlmSections(baseSections, llmSections);

  assert.equal(merged[0].public_article.headline, 'Headline 1');
  assert.equal(merged[1].public_article.headline, 'Hash matched public headline');
  assert.equal(merged[1].source_candidate_hash, 'hash-2');
  assert.deepEqual(merged[1].sources, section(2).sources);
});

test('LLM section merge falls back to normalized source URL when hash is absent', () => {
  const baseSections = [
    section(1, {
      source_candidate_hash: '',
      sources: [{ title: 'Source 1', url: 'https://example.com/source-1?a=1&b=2' }]
    }),
    section(2)
  ];
  const llmSections = [{
    headline: 'Different LLM title',
    sources: [{ title: 'Source 1', url: 'https://example.com/source-1?utm_source=ai&b=2&a=1' }],
    public_article: {
      ...section(1).public_article,
      headline: 'URL matched public headline',
      source_links: [{
        title: 'Source 1',
        url: 'https://example.com/source-1?a=1&b=2',
        source_role: 'primary'
      }]
    }
  }];

  const merged = mergePublicArticlesFromLlmSections(baseSections, llmSections);

  assert.equal(merged[0].public_article.headline, 'URL matched public headline');
  assert.equal(merged[1].public_article.headline, 'Headline 2');
});

test('LLM section merge uses unique section title when hash and URL are absent', () => {
  const baseSections = [
    section(1, {
      source_candidate_hash: '',
      sources: [],
      public_article: { ...section(1).public_article, source_links: [] }
    }),
    section(2)
  ];
  const llmSections = [{
    headline: 'Headline 1',
    public_article: {
      ...section(1).public_article,
      headline: 'Rewritten public title',
      source_links: []
    }
  }];

  const merged = mergePublicArticlesFromLlmSections(baseSections, llmSections);

  assert.equal(merged[0].public_article.headline, 'Rewritten public title');
  assert.equal(merged[1].public_article.headline, 'Headline 2');
});

test('LLM section merge fails closed when title fallback is ambiguous', () => {
  const baseSections = [
    section(1, {
      source_candidate_hash: '',
      headline: 'Same title',
      public_article: { ...section(1).public_article, headline: 'Same title', source_links: [] },
      sources: []
    }),
    section(2, {
      source_candidate_hash: '',
      headline: 'Same title',
      public_article: { ...section(2).public_article, headline: 'Same title', source_links: [] },
      sources: []
    })
  ];
  const llmSections = [{
    headline: 'Same title',
    public_article: {
      ...section(1).public_article,
      headline: 'Same title',
      source_links: []
    }
  }];

  assert.throws(
    () => mergePublicArticlesFromLlmSections(baseSections, llmSections),
    error => {
      assert.equal(error.code, 'ambiguous_section_match');
      assert.equal(error.details.strategy, 'unique_title');
      assert.equal(error.details.match_count, 2);
      return true;
    }
  );
});

test('LLM section merge rejects an unmatched LLM section', () => {
  const llmSections = [{
    source_candidate_hash: 'unknown-hash',
    headline: 'Unknown source section',
    sources: [{ title: 'Unknown', url: 'https://example.com/unknown' }],
    public_article: {
      ...section(1).public_article,
      headline: 'Unknown source section',
      source_links: []
    }
  }];

  assert.throws(
    () => mergePublicArticlesFromLlmSections([section(1), section(2)], llmSections),
    error => {
      assert.equal(error.code, 'ambiguous_section_match');
      assert.equal(error.details.strategy, 'unique_title');
      assert.equal(error.details.match_count, 0);
      return true;
    }
  );
});

test('LLM section merge fails closed when LLM omits an invalid base public_article', () => {
  const missingPublicArticle = section(2, {
    public_article: {
      headline: '',
      lead: '',
      body_paragraphs: [],
      camera_hal_takeaway: '',
      reader_checkpoints: [],
      source_links: []
    }
  });
  const llmSections = [{
    ...section(1),
    public_article: {
      ...section(1).public_article,
      headline: 'Merged first article'
    }
  }];

  assert.throws(
    () => mergePublicArticlesFromLlmSections([section(1), missingPublicArticle], llmSections),
    error => {
      assert.equal(error.code, 'missing_llm_section_public_article_invalid');
      assert.equal(error.details.base_index, 1);
      return true;
    }
  );
});

test('editor output contract rejects source link label leakage and related context role', () => {
  const draft = editor({
    sections: [
      section(1, {
        public_article: {
          ...section(1).public_article,
          source_links: [{
            title: 'source_gap_risk evidence',
            url: 'https://example.com/source-1',
            source_role: 'related_context'
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
      assert.ok(error.details.issues.some(issue => issue.type === 'public_article_leakage'));
      assert.ok(error.details.issues.some(issue => issue.reason === 'related_context_not_allowed'));
      return true;
    }
  );
});

test('public_article source_links cannot promote related context URL provenance to primary', () => {
  const contextOnly = section(1, {
    sources: [],
    allowed_public_source_links: [{
      title: 'Context only reference',
      url: 'https://example.com/context-doc',
      source_role: 'related_context'
    }],
    public_article: {
      ...section(1).public_article,
      source_links: [{
        title: 'Context only reference',
        url: 'https://example.com/context-doc',
        source_role: 'primary'
      }]
    }
  });
  const seedAndContext = section(1, {
    sources: [],
    seed_evidence_urls: ['https://example.com/context-doc'],
    allowed_public_source_links: [{
      title: 'Context only reference',
      url: 'https://example.com/context-doc',
      source_role: 'related_context'
    }],
    public_article: {
      ...section(1).public_article,
      source_links: [{
        title: 'Seed evidence reference',
        url: 'https://example.com/context-doc',
        source_role: 'seed_evidence'
      }]
    }
  });

  const contextOnlyIssues = validatePublicArticle(contextOnly, 0);
  const seedAndContextIssues = validatePublicArticle(seedAndContext, 0);

  assert.ok(contextOnlyIssues.some(issue => issue.reason === 'source_role_not_allowed_for_url'));
  assert.equal(seedAndContextIssues.some(issue => issue.reason === 'source_role_not_allowed_for_url'), false);
});

test('editor output contract rejects hallucinated public source links', () => {
  const draft = editor({
    sections: [
      section(1, {
        public_article: {
          ...section(1).public_article,
          source_links: [{
            title: 'Different source',
            url: 'https://example.com/not-in-section',
            source_role: 'primary'
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
      assert.ok(error.details.issues.some(issue => issue.reason === 'url_not_in_allowed_source_set'));
      return true;
    }
  );
});

test('reader checkpoint concrete contract requires actionable source or validation target combinations', () => {
  assert.equal(isConcreteCheckpoint('CameraX 관련 내용을 확인합니다.', section(1)), false);
  assert.equal(isConcreteCheckpoint('CameraX preview의 aspect ratio와 rotation 동작이 기존 앱과 달라지지 않는지 확인합니다.', section(1)), true);
  assert.equal(isConcreteCheckpoint('CameraX / Android camera APIs 관련 API/component/date를 확인합니다.', section(1)), false);
  assert.equal(
    isConcreteCheckpoint('HAL/driver 변경 근거는 없음으로 제한하고 Camera2 compatibility 범위만 확인합니다.', section(1)),
    true
  );
});

test('public_article deterministic validation does not hard-fail semantic checkpoint vocabulary', () => {
  const draftSection = section(1, {
    public_article: {
      ...section(1).public_article,
      reader_checkpoints: [
        '폴더블 기기 및 태블릿 환경에서 화면 전환 시 CameraX 미리보기 스트림이 끊김 없이 재구성되는지 검증합니다.',
        '다양한 해상도 조합(YUV/JPEG/PRIVATE)에서 스트림 재구성 시 발생하는 지연 시간과 버퍼 라이프사이클을 모니터링합니다.'
      ]
    }
  });

  assert.deepEqual(validatePublicArticle(draftSection, 0), []);
});

test('public_article prose quality rejects validator-token checkpoint placeholders', () => {
  const draftSection = section(1, {
    public_article: {
      ...section(1).public_article,
      camera_hal_takeaway: 'CameraX preview의 앱 호환성만 확인하고 HAL/driver 변경으로 해석하지 않습니다.',
      reader_checkpoints: [
        'Google AI Studio 관련 API/component/date가 현재 device matrix와 맞는지 확인합니다.',
        'Google AI Studio compatibility test scenario 또는 stream/metadata 확인 항목만 추적합니다.'
      ]
    }
  });

  const issues = validatePublicArticle(draftSection, 0);

  assert.ok(issues.some(issue => /validator-token prose/.test(issue.message || '')));
});

test('public_article prose quality accepts reader-facing camera checkpoints', () => {
  const draftSection = section(1, {
    public_article: {
      ...section(1).public_article,
      camera_hal_takeaway: '이 소식은 HAL API 변경이 아니라 app/framework 계층의 참고 신호입니다.',
      reader_checkpoints: [
        '테스트용 클라이언트 앱에서 manifest permission 선언과 Camera API 호출 위치를 확인합니다.',
        '출처가 직접 말하지 않는 HAL/driver runtime 변경이나 vendor pipeline 영향은 별도 근거가 있을 때만 다룹니다.'
      ]
    }
  });

  assert.deepEqual(validatePublicArticle(draftSection, 0), []);
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

test('editor field hygiene leaves semantic direct HAL claim validity to LLM and editor judgment', () => {
  for (const camera_hal_perspective of [
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
          camera_hal_perspective
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

test('editor title fallback keeps canonical newsletter title contract', () => {
  const missingTitle = editor({ title: '' });
  const mismatchedTitle = editor({ title: 'Camera HAL / SW Newsletter - 2026-05-07' });

  validateEditorOutputContract(missingTitle, DATE, { normalizeSection });
  validateEditorOutputContract(mismatchedTitle, DATE, { normalizeSection });

  assert.equal(missingTitle.title, `Camera HAL / SW Newsletter - ${DATE}`);
  assert.equal(mismatchedTitle.title, `Camera HAL / SW Newsletter - ${DATE}`);
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
            sources: [{ title: 'Changed source', url: 'https://example.com/changed' }],
            public_article: {
              ...invalidEditor.sections[0].public_article,
              source_links: [{ title: 'Changed source', url: 'https://example.com/changed', source_role: 'primary' }]
            }
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
