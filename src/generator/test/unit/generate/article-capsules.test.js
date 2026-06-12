const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildArticleCapsule,
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext
} = require('../../../select/article-capsules');
const {
  stableSourceExtractionItemId
} = require('../../../quality/claim-source-binding');

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
  assert.equal(capsule.source_fact_bundle.source_url, 'https://example.com/camera-hal-metadata?utm=1');
  assert.deepEqual(capsule.source_fact_bundle.facts, []);
  assert.ok(capsule.evidence.length > 0);
  assert.ok(capsule.estimated_tokens <= 1200);
  assert.equal(Object.hasOwn(capsule, 'impact_claim_level'), false);
});

test('article capsule preserves image provenance (sourceKind, contentType) for the gate', () => {
  const capsule = buildArticleCapsule(candidate({
    imageCandidates: [
      {
        url: 'https://cdn.example.com/og-image.png',
        sourceUrl: 'https://example.com/article',
        articleUrl: 'https://example.com/article',
        sourceKind: 'og',
        contentType: 'image/png',
        licenseStatus: 'unknown',
        attribution: 'Android Developers',
        validationStatus: 'ok'
      }
    ]
  }));

  const [image] = capsule.imageCandidates;
  assert.equal(image.sourceKind, 'og');
  assert.equal(image.contentType, 'image/png');
});

test('article capsule strips legacy impact fields before LLM writer input', () => {
  const capsule = buildArticleCapsule(candidate({
    impact_claim_level: 'direct_hal_change',
    impactClaimLevel: 'camera_stack_direct',
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      hal_boundary: 'direct HAL change'
    }
  }));

  assert.equal(Object.hasOwn(capsule, 'impact_claim_level'), false);
  assert.equal(capsule.derived_editorial_hints.relevance_bucket_hint, 'direct_aosp_camera');
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

test('article capsule preserves camelCase canonical sourceQuality without drifting to unknown', () => {
  const input = candidate({
    source_quality: undefined,
    source_role: undefined,
    source_url_quality: undefined,
    source_quality_status: undefined,
    main_article_source_allowed: undefined,
    sourceQuality: {
      source_role: 'official_release_source',
      source_url_quality: 'official_dated_release',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_allowed_reason: 'Official dated source.',
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: false,
      conditional_evidence_type: '',
      evidence_granularity: 'candidate_item',
      source_quality_notes: []
    }
  });
  const capsule = buildArticleCapsule(input);

  assert.equal(capsule.source_quality.source_url_quality, 'official_dated_release');
  assert.equal(capsule.source_url_quality, 'official_dated_release');
  assert.equal(capsule.source_quality_status, 'allowed');
  assert.equal(capsule.source_quality_reason, 'Official dated source.');
  assert.deepEqual(capsule.source_quality_field_drift, []);
});

test('article capsule keeps blocked source quality blockers in compact writer input', () => {
  const capsule = buildArticleCapsule(candidate({
    source_quality: {
      source_role: 'tech_media_lead_source',
      source_url_quality: 'tech_media_lead_requires_cross_check',
      source_quality_status: 'blocked',
      main_article_source_allowed: false,
      main_article_source_allowed_reason: 'Source requires primary confirmation before main promotion.',
      main_article_source_blockers: ['cross_check_required_but_missing'],
      cross_check_status: 'required_missing',
      requires_cross_check: true,
      requires_conditional_evidence: true,
      conditional_evidence_type: 'primary_confirmation',
      evidence_granularity: 'article_with_primary_confirmation',
      source_quality_notes: ['Must be confirmed by a primary source.']
    }
  }));

  assert.equal(capsule.source_quality.source_role, 'tech_media_lead_source');
  assert.equal(capsule.source_quality.source_url_quality, 'tech_media_lead_requires_cross_check');
  assert.equal(capsule.source_quality.source_quality_status, 'blocked');
  assert.equal(capsule.source_quality.main_article_source_allowed, false);
  assert.deepEqual(capsule.source_quality.main_article_source_blockers, ['cross_check_required_but_missing']);
  assert.equal(capsule.source_quality.requires_cross_check, true);
  assert.equal(capsule.source_quality.requires_conditional_evidence, true);
  assert.equal(capsule.source_quality.conditional_evidence_type, 'primary_confirmation');
  assert.equal(capsule.cross_check_status, 'required_missing');
  assert.equal(capsule.evidence_granularity, 'article_with_primary_confirmation');
  assert.equal(capsule.main_article_readiness.source_ready, false);
  assert.equal(capsule.main_article_readiness.ready, false);
  assert.ok(capsule.main_article_readiness.blockers.includes('main_article_source_allowed_false'));
  assert.ok(capsule.main_article_readiness.blockers.includes('cross_check_required_but_missing'));
  assert.ok(capsule.do_not_claim.some(item => /primary confirmation/.test(item)));
});

test('article capsule preserves conditional evidence requirements for allowed conditional sources', () => {
  const capsule = buildArticleCapsule(candidate({
    source_quality: {
      source_role: 'project_release_source',
      source_url_quality: 'project_release',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_allowed_reason: 'Project release evidence is allowed with native HAL workflow evidence.',
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: true,
      conditional_evidence_type: 'project_release_evidence',
      evidence_granularity: 'project_release_note',
      source_quality_notes: ['Allowed only with project release evidence.']
    }
  }));

  assert.equal(capsule.source_quality.source_url_quality, 'project_release');
  assert.equal(capsule.source_quality.source_quality_status, 'allowed');
  assert.equal(capsule.source_quality.main_article_source_allowed, true);
  assert.equal(capsule.source_quality.requires_conditional_evidence, true);
  assert.equal(capsule.source_quality.conditional_evidence_type, 'project_release_evidence');
  assert.equal(capsule.requires_conditional_evidence, true);
  assert.equal(capsule.conditional_evidence_type, 'project_release_evidence');
  assert.equal(capsule.main_article_readiness.source_ready, true);
  assert.equal(capsule.main_article_readiness.blockers.includes('main_article_source_allowed_false'), false);
  assert.equal(capsule.main_article_readiness.blockers.includes('unknown_source_quality'), false);
});

test('article capsule keeps cross-check-required sources distinct from official sources', () => {
  const capsule = buildArticleCapsule(candidate({
    source_quality: {
      source_role: 'tech_media_lead_source',
      source_url_quality: 'tech_media_lead_requires_cross_check',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_allowed_reason: 'Primary confirmation satisfied.',
      main_article_source_blockers: [],
      cross_check_status: 'required_satisfied',
      requires_cross_check: true,
      requires_conditional_evidence: true,
      conditional_evidence_type: 'primary_confirmation',
      evidence_granularity: 'article_with_primary_confirmation',
      source_quality_notes: []
    },
    primary_confirmation: true
  }));

  assert.equal(capsule.source_quality.source_role, 'tech_media_lead_source');
  assert.equal(capsule.source_quality.source_url_quality, 'tech_media_lead_requires_cross_check');
  assert.equal(capsule.source_quality.requires_cross_check, true);
  assert.equal(capsule.source_quality.requires_conditional_evidence, true);
  assert.equal(capsule.cross_check_status, 'required_satisfied');
  assert.equal(capsule.evidence_granularity, 'article_with_primary_confirmation');
  assert.notEqual(capsule.source_quality.source_role, 'official_release_source');
  assert.notEqual(capsule.source_quality.source_url_quality, 'official_release_note_anchor');
  assert.equal(capsule.source_fact_bundle.source_url, 'https://example.com/camera-hal-metadata?utm=1');
  assert.equal(capsule.main_article_readiness.source_ready, true);
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

test('article capsule exposes allowed claim evidence from validator helper', () => {
  const blockText = 'Jetpack Compose includes CameraX for correct camera previews across any window size.';
  const capsule = buildArticleCapsule(candidate({
    source_candidate_hash: 'adaptive-hash',
    primary_evidence_ids: [],
    linked_evidence_ids: [],
    evidence_ids: [],
    evidence_pack_ids: ['provenance-pack'],
    source_extraction: {
      evidence_blocks: [{
        heading: 'Adaptive apps with CameraX',
        text: blockText,
        links: [{ url: 'https://developer.android.com/media/camera/camerax' }]
      }]
    }
  }));

  const ids = capsule.allowed_claim_evidence.map(item => item.evidence_id);
  assert.ok(ids.includes(stableSourceExtractionItemId(
    { source_candidate_hash: 'adaptive-hash' },
    'evidence_blocks',
    blockText
  )));
  assert.ok(ids.includes('candidate:adaptive-hash:source-summary'));
  assert.equal(ids.includes('provenance-pack'), false);
  assert.ok(capsule.allowed_claim_evidence.every(item =>
    item.evidence_id &&
    item.kind &&
    Array.isArray(item.source_urls) &&
    typeof item.text === 'string'
  ));
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

test('article capsule report enriches selected article with same-source child facts', () => {
  const selected = candidate({
    title: 'Build native Android apps in Google AI Studio',
    url: 'https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    article_group_key: 'android_native_tooling_workflow',
    behavior_change: 'Google AI Studio can build entire Android apps from a prompt.'
  });
  const child = candidate({
    title: 'Start building today - Build native Android apps in Google AI Studio',
    url: 'https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today',
    parent_url: selected.url,
    parent_title: selected.title,
    relevance_bucket: 'cpp_ai_tooling_fallback',
    article_group_key: 'android_native_tooling_workflow',
    source_extraction: {
      evidence_blocks: [{
        source_text: 'Hardware-enabled experiences can use the Camera, GPS/Location, Accelerometer and Bluetooth using native Android APIs.'
      }]
    }
  });
  const report = buildArticleCapsuleReport('2026-05-03', {
    date: '2026-05-03',
    shortlisted_candidates: [selected, child],
    selected_articles: [selected],
    reserve_candidates: []
  });

  const selectedCapsule = capsuleInputFromReport(report, 'selected').candidates[0];
  assert.ok(selectedCapsule.source_fact_bundle.facts.some(fact => /Accelerometer and Bluetooth/.test(fact.text)));
  assert.ok(selectedCapsule.source_fact_bundle.supporting_source_urls.includes(child.url));
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
