const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildArticleCapsule,
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext
} = require('../scripts/newsroom/generate/article-capsules');

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
  assert.equal(capsule.selection.final_selected, true);
  assert.ok(capsule.evidence.length > 0);
  assert.ok(capsule.estimated_tokens <= 800);
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
