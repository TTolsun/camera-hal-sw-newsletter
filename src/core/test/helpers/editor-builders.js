'use strict';

const { readJson, tempRoot } = require('./fs');

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
    camera_hal_checks: [`HAL check ${index}`],
    action_items: [`Action ${index}`],
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
      background_context: `Background ${index}`,
      hal_driver_impact: `HAL perspective ${index}`,
      action_items: value.action_items,
      team_share_points: `Summary ${index}`
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

function groupCoverageReporterCandidate(overrides = {}) {
  return {
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
  };
}

// 선택된 그룹은 둘(group-a, group-b)이지만 에디터는 group-a 섹션 하나만 렌더링한다.
// 렌더링된 섹션 자체는 모든 다른 게이트를 통과하므로 DEEP 모드에서 유일한 실패는
// "selected group coverage"가 된다. 모드별 게이트 테스트를 위해 매번 새 deep clone을 반환한다.
function buildGroupCoverageFixture() {
  const baseSection = section(1, { article_group_key: 'group-a' });
  const editorValue = editor({
    sections: [baseSection]
  });
  const reporter = {
    candidates: [
      groupCoverageReporterCandidate({
        article_group_key: 'group-a',
        source_candidate_hash: 'hash-1',
        url: 'https://example.com/source-1',
        title: 'Selected group A source'
      }),
      groupCoverageReporterCandidate({
        article_group_key: 'group-b',
        source_candidate_hash: 'hash-2',
        url: 'https://example.com/source-2',
        title: 'Selected group B source'
      })
    ]
  };
  return {
    editor: JSON.parse(JSON.stringify(editorValue)),
    reporter: JSON.parse(JSON.stringify(reporter))
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
  return tempRoot('editor-output-contract-');
}

function loadFreshNewsletterCli() {
  const cliPath = require.resolve('../../../../scripts/newsroom/cli/gemini-newsroom-newsletter');
  delete require.cache[cliPath];
  return require(cliPath);
}

module.exports = {
  DATE,
  section,
  editor,
  storyPublicArticle,
  storyEditor,
  reporterForClaimTests,
  reporterForGroupTests,
  buildGroupCoverageFixture,
  normalizeSection,
  tempNewsroomDir,
  readJson,
  loadFreshNewsletterCli
};
