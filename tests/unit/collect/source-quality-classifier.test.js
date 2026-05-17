const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SOURCE_POLICY_MAPPING,
  classifySourceQuality,
  sourceQualityFieldDrift,
  sourceQualityFlatFields,
  sourceQualitySummaryForCandidates
} = require('../../../scripts/newsroom/collect/source-quality-classifier');

function candidate(overrides = {}) {
  return {
    title: 'Camera HAL metadata update',
    url: 'https://example.com/camera-hal-metadata',
    publishedAt: '2026-05-01',
    hasDatedEvidence: true,
    api_or_component: 'Camera HAL metadata',
    behavior_change: 'Request/result metadata validation changed for stream combinations.',
    source_gap_risk: false,
    reference_only: false,
    ...overrides
  };
}

function metadata(overrides = {}) {
  return {
    has_published_date: true,
    has_api_or_component: true,
    has_behavior_change: true,
    source_gap_risk: false,
    reference_only: false,
    source_kind: 'release_note_item',
    ...overrides
  };
}

test('source policy mapping is deterministic', () => {
  assert.deepEqual(SOURCE_POLICY_MAPPING.allowed, {
    source_quality_status: 'allowed',
    main_article_source_allowed: true
  });
  assert.equal(SOURCE_POLICY_MAPPING.conditional.source_quality_status, 'conditional');
  assert.equal(SOURCE_POLICY_MAPPING.watchlist_only.main_article_source_allowed, false);
  assert.equal(SOURCE_POLICY_MAPPING.reference_only.source_quality_status, 'blocked');
  assert.equal(SOURCE_POLICY_MAPPING.blocked.main_article_source_allowed, false);
});

test('CameraX release anchor is source-ready and preserves anchor quality', () => {
  const sourceQuality = classifySourceQuality({
    candidate: candidate({ url: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-1.5.0' }),
    source: {
      sourceRole: 'official_release_source',
      sourceUrlQualityHint: 'official_release_note_anchor',
      mainArticlePolicy: 'allowed',
      requiresCrossCheckDefault: false,
      evidenceGranularityHint: 'versioned_release_row',
      sourceQualityNotes: ['preserve version/date fragment anchors']
    },
    metadata: metadata()
  });

  assert.equal(sourceQuality.source_url_quality, 'official_release_note_anchor');
  assert.equal(sourceQuality.source_quality_status, 'allowed');
  assert.equal(sourceQuality.main_article_source_allowed, true);
  assert.deepEqual(sourceQuality.main_article_source_blockers, []);
});

test('undated documentation reference is blocked for main source use', () => {
  const sourceQuality = classifySourceQuality({
    candidate: candidate({
      hasDatedEvidence: false,
      publishedAt: '',
      source_gap_risk: true,
      reference_only: true
    }),
    source: {
      sourceRole: 'official_documentation_reference',
      sourceUrlQualityHint: 'official_documentation_reference',
      mainArticlePolicy: 'reference_only',
      requiresCrossCheckDefault: false
    },
    metadata: metadata({
      has_published_date: false,
      has_api_or_component: false,
      has_behavior_change: false,
      source_gap_risk: true,
      reference_only: true,
      source_kind: 'documentation_page'
    })
  });

  assert.equal(sourceQuality.main_article_source_allowed, false);
  assert.equal(sourceQuality.source_quality_status, 'blocked');
  assert.ok(sourceQuality.main_article_source_blockers.includes('reference_only'));
  assert.ok(sourceQuality.main_article_source_blockers.includes('source_gap_risk'));
});

test('missing URL and unresolved unknown quality are main-ineligible', () => {
  const sourceQuality = classifySourceQuality({
    candidate: candidate({ url: '' }),
    source: {
      sourceRole: 'unknown_source',
      sourceUrlQualityHint: 'unknown',
      mainArticlePolicy: 'conditional',
      requiresCrossCheckDefault: false
    },
    metadata: metadata()
  });

  assert.equal(sourceQuality.source_url_quality, 'unknown');
  assert.equal(sourceQuality.source_quality_status, 'unknown');
  assert.equal(sourceQuality.main_article_source_allowed, false);
  assert.ok(sourceQuality.main_article_source_blockers.includes('missing_url'));
  assert.ok(sourceQuality.main_article_source_blockers.includes('unknown_source_quality'));
});

test('generic AI trend records conditional evidence without judging HAL workflow in source classifier', () => {
  const withoutHal = classifySourceQuality({
    candidate: candidate({
      title: 'Generic AI agent launch',
      summary: 'A generic coding agent launch without Android Camera workflow evidence.'
    }),
    source: {
      sourceRole: 'generic_trend_source',
      sourceUrlQualityHint: 'generic_ai_or_it_trend',
      mainArticlePolicy: 'conditional',
      requiresCrossCheckDefault: false
    },
    metadata: metadata({
      api_or_component: 'AI agent workflow',
      behavior_change: 'Generic software workflow update.',
      has_api_or_component: true,
      has_behavior_change: true
    })
  });
  assert.equal(withoutHal.cross_check_status, 'not_required');
  assert.equal(withoutHal.requires_cross_check, false);
  assert.equal(withoutHal.requires_conditional_evidence, true);
  assert.equal(withoutHal.conditional_evidence_type, 'native_hal_workflow');
  assert.equal(withoutHal.main_article_source_allowed, true);
  assert.equal(withoutHal.main_article_source_blockers.includes('generic_trend_without_hal_workflow_link'), false);

  const withHal = classifySourceQuality({
    candidate: candidate({
      title: 'AI tooling improves Camera ITS triage',
      summary: 'The workflow maps AI review to Camera ITS validation, stream metadata checks, and native camera stack debugging.'
    }),
    source: {
      sourceRole: 'generic_trend_source',
      sourceUrlQualityHint: 'generic_ai_or_it_trend',
      mainArticlePolicy: 'conditional',
      requiresCrossCheckDefault: false
    },
    metadata: metadata(),
    scopeMetadata: { native_tooling_relevance: 3 }
  });
  assert.equal(withHal.cross_check_status, 'not_required');
  assert.equal(withHal.source_quality_status, 'allowed');
  assert.equal(withHal.main_article_source_allowed, true);
});

test('HAL axes or native workflow text alone do not satisfy primary cross-check', () => {
  const sourceQuality = classifySourceQuality({
    candidate: candidate({
      title: 'Tech lead reports Camera ITS metadata validation',
      summary: 'The report mentions Camera HAL validation and native camera stack stream metadata checks.',
      hal_impact_axes: ['native_tooling_workflow']
    }),
    source: {
      sourceRole: 'tech_media_lead_source',
      sourceUrlQualityHint: 'tech_media_lead_requires_cross_check',
      mainArticlePolicy: 'conditional',
      requiresCrossCheckDefault: true
    },
    metadata: metadata(),
    scopeMetadata: { native_tooling_relevance: 3 }
  });

  assert.equal(sourceQuality.cross_check_status, 'required_missing');
  assert.equal(sourceQuality.requires_cross_check, true);
  assert.equal(sourceQuality.requires_conditional_evidence, true);
  assert.equal(sourceQuality.conditional_evidence_type, 'primary_confirmation');
  assert.equal(sourceQuality.main_article_source_allowed, false);
  assert.ok(sourceQuality.main_article_source_blockers.includes('cross_check_required_but_missing'));
});

test('tech media lead needs primary confirmation', () => {
  const missing = classifySourceQuality({
    candidate: candidate(),
    source: {
      sourceRole: 'tech_media_lead_source',
      sourceUrlQualityHint: 'tech_media_lead_requires_cross_check',
      mainArticlePolicy: 'conditional',
      requiresCrossCheckDefault: true
    },
    metadata: metadata()
  });
  assert.equal(missing.cross_check_status, 'required_missing');
  assert.ok(missing.main_article_source_blockers.includes('cross_check_required_but_missing'));

  const confirmed = classifySourceQuality({
    candidate: candidate({ primary_confirmation: true }),
    source: {
      sourceRole: 'tech_media_lead_source',
      sourceUrlQualityHint: 'tech_media_lead_requires_cross_check',
      mainArticlePolicy: 'conditional',
      requiresCrossCheckDefault: true
    },
    metadata: metadata()
  });
  assert.equal(confirmed.cross_check_status, 'required_satisfied');
  assert.equal(confirmed.main_article_source_allowed, true);
});

test('project release conditional source records project evidence type without cross-check', () => {
  const sourceQuality = classifySourceQuality({
    candidate: candidate({
      title: 'Project release improves native camera stack profiling',
      summary: 'The release adds native camera stack profiling for stream and metadata validation.'
    }),
    source: {
      sourceRole: 'project_release_source',
      sourceUrlQualityHint: 'project_release',
      mainArticlePolicy: 'conditional',
      requiresCrossCheckDefault: false
    },
    metadata: metadata({
      api_or_component: 'native camera stack profiling',
      behavior_change: 'Adds stream and metadata validation support.',
      has_api_or_component: true,
      has_behavior_change: true
    }),
    scopeMetadata: { native_tooling_relevance: 3 }
  });

  assert.equal(sourceQuality.cross_check_status, 'not_required');
  assert.equal(sourceQuality.requires_cross_check, false);
  assert.equal(sourceQuality.requires_conditional_evidence, true);
  assert.equal(sourceQuality.conditional_evidence_type, 'project_release_evidence');
  assert.equal(sourceQuality.main_article_source_allowed, true);
});

test('flat source quality mirrors detect drift', () => {
  const sourceQuality = classifySourceQuality({
    candidate: candidate(),
    source: {
      sourceRole: 'official_release_source',
      sourceUrlQualityHint: 'official_dated_release',
      mainArticlePolicy: 'allowed',
      requiresCrossCheckDefault: false
    },
    metadata: metadata()
  });
  const mirrored = {
    source_quality: sourceQuality,
    ...sourceQualityFlatFields(sourceQuality)
  };
  assert.deepEqual(sourceQualityFieldDrift(mirrored), []);
  assert.equal(sourceQualityFieldDrift({ ...mirrored, source_url_quality: 'unknown' })[0].code, 'SOURCE_QUALITY_FIELD_DRIFT');
});

test('source quality summary separates selected main from main-eligible candidates', () => {
  const selectedQuality = classifySourceQuality({
    candidate: candidate(),
    source: {
      sourceRole: 'official_release_source',
      sourceUrlQualityHint: 'official_dated_release',
      mainArticlePolicy: 'allowed',
      requiresCrossCheckDefault: false
    },
    metadata: metadata()
  });
  const eligibleQuality = classifySourceQuality({
    candidate: candidate({ url: 'https://example.com/eligible-only' }),
    source: {
      sourceRole: 'official_release_source',
      sourceUrlQualityHint: 'official_dated_release',
      mainArticlePolicy: 'allowed',
      requiresCrossCheckDefault: false
    },
    metadata: metadata()
  });
  const summary = sourceQualitySummaryForCandidates([
    {
      final_selected: true,
      finalSelectionEligibility: 'main',
      source_quality: selectedQuality,
      ...sourceQualityFlatFields(selectedQuality)
    },
    {
      finalSelectionEligibility: 'main',
      source_quality: eligibleQuality,
      ...sourceQualityFlatFields(eligibleQuality)
    }
  ]);

  assert.deepEqual(summary.selected_main_source_quality_coverage, {
    selected_main_count: 1,
    with_source_quality_count: 1
  });
  assert.deepEqual(summary.main_eligible_source_quality_coverage, {
    main_eligible_candidate_count: 2,
    with_source_quality_count: 2
  });
});
