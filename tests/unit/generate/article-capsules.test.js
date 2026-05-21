const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildArticleCapsule,
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext
} = require('../../../scripts/newsroom/generate/article-capsules');

function candidate(overrides = {}) {
  return {
    title: 'Camera HAL metadata update improves Android Camera validation',
    url: 'https://example.com/camera-hal-metadata?utm=1',
    source: 'Android Developers',
    published_date: '2026-05-01T00:00:00Z',
    summary: 'Camera HAL metadata behavior changed for Android Camera validation. '.repeat(20),
    version_or_release: 'Camera HAL test pack 2026.05',
    api_or_component: 'Camera HAL metadata',
    behavior_change: 'Metadata validation now catches request/result mismatch for stream combinations.',
    evidence_notes: ['Official dated release note with API/component and behavior evidence.'],
    score_breakdown: {
      total: 91,
      camera_hal_directness: 5,
      evidence_specificity: 5,
      freshness_score: 3,
      practical_actionability: 4,
      source_reliability: 5,
      optional_ai_cpp_bonus: 0
    },
    deterministic_score: 91,
    final_selected: true,
    selected_for_editor: true,
    selection_slot: 'camera-platform',
    finalSelectionEligibility: 'main',
    isWatchPage: false,
    hasDatedEvidence: true,
    source_gap_risk: false,
    source_quality_required: true,
    source_quality: {
      source_role: 'official_release_source',
      source_url_quality: 'official_release_note_anchor',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_allowed_reason: 'Source policy allows this candidate with concrete source evidence.',
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: false,
      conditional_evidence_type: '',
      evidence_granularity: 'versioned_release_row',
      source_quality_notes: []
    },
    main_article_score_eligible: true,
    imageCandidates: [
      {
        url: 'https://example.com/image.png',
        sourceUrl: 'https://example.com/article',
        articleUrl: 'https://example.com/article',
        licenseStatus: 'unknown',
        attribution: 'Android Developers',
        validationStatus: 'ok'
      }
    ],
    ...overrides
  };
}

test('article capsule keeps compact PR4 fields and score breakdown', () => {
  const capsule = buildArticleCapsule(candidate());

  assert.equal(capsule.title, 'Camera HAL metadata update improves Android Camera validation');
  assert.equal(capsule.topic_type, 'camera-hal');
  assert.equal(capsule.component, 'Camera HAL metadata');
  assert.equal(capsule.risk.source_gap, false);
  assert.equal(capsule.risk.no_dated_evidence, false);
  assert.equal(capsule.score.total, 91);
  assert.equal(capsule.score.camera_hal_directness, 5);
  assert.equal(capsule.source_quality.source_url_quality, 'official_release_note_anchor');
  assert.equal(capsule.main_article_readiness.source_ready, true);
  assert.equal(capsule.main_article_readiness.selection_input_ready, true);
  assert.equal(capsule.main_article_readiness.selection_ready, true);
  assert.equal(capsule.main_article_readiness.selection_input_ready, capsule.main_article_readiness.selection_ready);
  assert.deepEqual(capsule.source_quality_field_drift, []);
  assert.equal(capsule.requires_conditional_evidence, false);
  assert.equal(capsule.conditional_evidence_type, '');
  assert.equal(capsule.selection.final_selected, true);
  assert.deepEqual(capsule.related_context_candidates, []);
  assert.ok(capsule.evidence.length > 0);
  assert.ok(capsule.estimated_tokens <= 1100);
});

test('article capsule carries related context labels without making them facts', () => {
  const capsule = buildArticleCapsule(candidate({
    title: 'Android native tooling representative',
    url: 'https://example.com/android-tooling-main',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    article_group_key: 'android_native_tooling_workflow',
    tooling_workflow_type: 'native_tooling_workflow',
    related_context_candidates: [{
      title: 'Android CLI Now Stable 1.0',
      url: 'https://example.com/android-cli',
      relevance_bucket: 'cpp_ai_tooling_fallback',
      finalSelectionEligibility: 'short',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      source_gap_risk: false,
      context_usage_allowed: true,
      article_group_key: 'android_native_tooling_workflow'
    }, {
      title: '17 Things parent roundup',
      url: 'https://example.com/roundup',
      context_role: 'parent_roundup_context_only',
      context_usage_allowed: false,
      article_group_key: 'android_native_tooling_workflow'
    }]
  }));

  assert.equal(capsule.article_group_key, 'android_native_tooling_workflow');
  assert.equal(capsule.tooling_workflow_type, 'native_tooling_workflow');
  assert.equal(capsule.related_context_candidates.length, 2);
  assert.equal(capsule.related_context_candidates[0].context_usage_label, 'allowed_supporting_context');
  assert.equal(capsule.blocked_context_candidates.length, 1);
  assert.equal(capsule.blocked_context_candidates[0].context_usage_label, 'parent_roundup_context_only');
});

test('article capsule carries compact seed evidence by id instead of full evidence pack', () => {
  const capsule = buildArticleCapsule(candidate({
    seed_ids: ['seed-camerax'],
    evidence_pack_ids: ['seed-camerax-pack'],
    primary_evidence_ids: ['seed-camerax-primary-01'],
    linked_evidence_ids: ['seed-camerax-linked-01'],
    source_extraction_ref: 'seed-evidence-pack.json#/packs/0',
    compact_evidence: {
      primary_facts: ['CameraX 1.6.1 fixes a compile error when using CameraX 1.6.0.'],
      linked_context: ['Linked Android Developers page confirms the same release context.'],
      do_not_claim: ['Keyword hints are discovery hints only.'],
      evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
    }
  }));

  assert.deepEqual(capsule.seed_evidence.evidence_pack_ids, ['seed-camerax-pack']);
  assert.deepEqual(capsule.seed_evidence.primary_evidence_ids, ['seed-camerax-primary-01']);
  assert.deepEqual(capsule.seed_evidence.linked_evidence_ids, ['seed-camerax-linked-01']);
  assert.equal(capsule.seed_evidence.source_extraction_ref, 'seed-evidence-pack.json#/packs/0');
  assert.deepEqual(capsule.seed_evidence.compact_evidence.primary_facts, [
    'CameraX 1.6.1 fixes a compile error when using CameraX 1.6.0.'
  ]);
  assert.equal(capsule.seed_evidence.packs, undefined);
  assert.equal(capsule.seed_evidence.primary_evidence, undefined);
  assert.equal(capsule.do_not_claim.includes('Keyword hints are discovery hints only.'), true);
});

test('article capsule report separates shortlist and selected capsule inputs', () => {
  const selected = candidate({ title: 'Camera HAL selected', url: 'https://example.com/selected' });
  const nonSelected = candidate({
    title: 'Android Camera non-selected',
    url: 'https://example.com/non-selected',
    final_selected: false,
    selected_for_editor: false,
    reserve_candidate: true,
    selection_slot: 'reserve'
  });
  const report = buildArticleCapsuleReport('2026-05-03', {
    date: '2026-05-03',
    shortlisted_candidates: [selected, nonSelected],
    selected_articles: [selected],
    reserve_candidates: [nonSelected]
  });

  assert.equal(report.shortlisted_capsule_count, 2);
  assert.equal(report.selected_capsule_count, 1);
  assert.equal(report.reserve_capsule_count, 1);
  assert.equal(capsuleInputFromReport(report, 'shortlisted').candidates.length, 2);
  assert.equal(capsuleInputFromReport(report, 'selected').candidates.length, 1);
  assert.equal(capsuleInputFromReport(report, 'reserve').candidates.length, 1);
  assert.equal(capsuleInputForCandidates('2026-05-03', [selected], report).candidates[0].url, selected.url);
});

test('compact selection context omits full candidate arrays', () => {
  const context = compactSelectionContext({
    date: '2026-05-03',
    input_candidate_count: 20,
    eligible_candidate_count: 12,
    selected_article_count: 4,
    deterministic_selected_count: 4,
    reserve_candidate_count: 1,
    shortlist_cap: 12,
    publish_ready: true,
    selection_policy: { shortlist_target_range: '8-12 candidates before Gemini reporter/editor prompts.' },
    selected_articles: [candidate()],
    primary_selected_articles: [candidate()],
    reserve_candidates: [candidate({ title: 'Reserve SoC platform signal', url: 'https://example.com/reserve' })],
    shortlisted_candidates: [candidate({ summary: 'large source text'.repeat(100) })],
    excluded_candidates: [candidate({ title: 'Excluded', source_gap_risk: true })]
  });

  assert.equal(context.input_candidate_count, 20);
  assert.equal(context.selected_articles.length, 1);
  assert.equal(context.reserve_candidates.length, 1);
  assert.equal(context.shortlisted_candidates, undefined);
  assert.equal(context.excluded_candidates, undefined);
});

test('article capsule prompt input omits linked evidence diagnostics fields', () => {
  const report = buildArticleCapsuleReport('2026-05-03', {
    date: '2026-05-03',
    shortlisted_candidates: [candidate({
      linked_evidence_summary: { total_count: 1 },
      impact_classification: { impact_type: 'runtime_behavior_change' },
      linked_evidence: [{ raw_excerpt: 'full evidence payload' }],
      raw_excerpt: 'raw payload',
      resolved: { title: 'resolved payload' }
    })],
    selected_articles: [],
    reserve_candidates: []
  });
  const promptInput = capsuleInputFromReport(report, 'shortlisted');
  const serialized = JSON.stringify(promptInput);

  assert.equal(serialized.includes('linked_evidence_summary'), false);
  assert.equal(serialized.includes('impact_classification'), false);
  assert.equal(serialized.includes('linked_evidence'), false);
  assert.equal(serialized.includes('raw_excerpt'), false);
  assert.equal(serialized.includes('resolved'), false);
});
