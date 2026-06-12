const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  MAX_EVIDENCE_PER_ARTICLE,
  MAX_EVIDENCE_TEXT_LENGTH,
  MAX_EXCLUDED_CANDIDATES,
  buildEvidencePackSummary,
  writeEvidencePackSummaryArtifacts
} = require('../../scripts/newsroom/metrics/evidence-pack-summary');
const {
  readJson,
  tempRoot,
  writeJson,
  writeText
} = require('../../src/core/test/helpers/fs');

const DATE = '2026-05-14';
const GENERATED_AT = '2026-05-14T00:00:00.000Z';

function newsroomPath(root, filename) {
  return path.join(root, 'content', 'newsroom', DATE, filename);
}

function collectedPath(root) {
  return path.join(root, 'content', 'collected-news', DATE, 'candidates.json');
}

function sourceEventsPath(root) {
  return path.join(root, 'content', 'source-events', DATE, 'source-change-events.json');
}

function selectedCandidate(overrides = {}) {
  return {
    candidate_id: 'selected-1',
    title: 'Camera HAL buffer queue update',
    url: 'https://example.com/camera-hal-buffer',
    source_name: 'Android Developers Blog',
    priority: 'high',
    reliability: 'official',
    source_role: 'official_release_note',
    source_url_quality: 'article_url',
    freshness_window: 'current',
    relevance_bucket: 'direct_aosp_camera',
    finalSelectionEligibility: 'main',
    source_gap_risk: false,
    hasDatedEvidence: true,
    evidence_score: 92,
    hal_impact_axes: ['buffer', 'metadata'],
    evidence: [
      '<p>Camera HAL buffer queue changed with dated release evidence.</p>',
      'A'.repeat(240),
      { text: 'ISP path evidence is bound to the article source.' },
      'Fourth item should be omitted.'
    ],
    body: '<article>debug dump that must not enter the Evidence Pack summary</article>',
    reason: 'Direct camera stack impact',
    claim_validation: {
      status: 'available',
      bound_claims: 2,
      total_claims: 2,
      overclaim_risk: 'low'
    },
    ...overrides
  };
}

function reserveCandidate(overrides = {}) {
  return {
    candidate_id: 'reserve-1',
    title: 'Reserve CameraX article',
    url: 'https://example.com/reserve-camerax',
    source_name: 'AndroidX Release Notes',
    priority: 'medium',
    reliability: 'official',
    source_role: 'official_release_note',
    source_url_quality: 'article_url',
    freshness_window: 'current',
    relevance_bucket: 'android_platform_camera_adjacent',
    finalSelectionEligibility: 'short',
    hasDatedEvidence: true,
    source_gap_risk: false,
    reason: 'Useful reserve item',
    ...overrides
  };
}

function excludedCandidate(index, overrides = {}) {
  return {
    candidate_id: `excluded-${index}`,
    title: `Excluded generic candidate ${index}`,
    url: `https://example.com/excluded-${index}`,
    source_name: 'Generic Tech Feed',
    source_role: 'watchlist',
    source_url_quality: 'unknown',
    freshness_window: 'unknown',
    relevance_bucket: 'generic_tech_watchlist',
    finalSelectionEligibility: 'exclude',
    source_gap_risk: true,
    hasDatedEvidence: false,
    selection_exclusion_reason: `generic topic without HAL impact axis ${index}`,
    body: '<html>debug dump should not be copied</html>',
    ...overrides
  };
}

function writeFullArtifactSet(root) {
  const selected = selectedCandidate();
  const reserve = reserveCandidate();
  const excluded = Array.from({ length: 12 }, (_, index) => excludedCandidate(index + 1));

  writeJson(collectedPath(root), {
    schema_version: 1,
    date: DATE,
    candidates: [selected, reserve, ...excluded]
  });
  writeJson(newsroomPath(root, 'shortlisted-candidates.json'), {
    schema_version: 3,
    date: DATE,
    input_candidate_count: 14,
    eligible_candidate_count: 2,
    selected_article_count: 1,
    reserve_candidate_count: 1,
    composition_summary: {
      primary_camera_stack_topic_count: 1,
      supporting_main_article_count: 0,
      fallback_topic_count: 0
    },
    selection_shortage_hints: [],
    selected_articles: [selected],
    reserve_candidates: [reserve],
    excluded_candidates: excluded
  });
  writeJson(newsroomPath(root, 'selection-report.json'), {
    schema_version: 1,
    date: DATE,
    status: 'OK',
    counts: {
      input_candidate_count: 14,
      eligible_candidate_count: 2,
      selected_article_count: 1,
      reserve_candidate_count: 1,
      excluded_candidate_count: 12,
      primary_camera_stack_topic_count: 1,
      supporting_main_article_count: 0
    },
    selection_shortage_hints: []
  });
  writeJson(newsroomPath(root, 'generation-status.json'), {
    date: DATE,
    status: 'NEEDS_FIX',
    quality_status: 'NEEDS_FIX',
    quality_score: 82,
    quality_threshold: 85,
    fact_check_status: 'NEEDS_FIX',
    final_publish_ready: false,
    public_newsletter_ready: false,
    review_pr_ready: true,
    run_context: { mode: 'daily_draft' }
  });
  writeJson(newsroomPath(root, 'article-capsules.json'), {
    schema_version: 1,
    date: DATE,
    selected_capsules: [{
      title: selected.title,
      url: selected.url,
      source: selected.source_name,
      relevance_bucket: selected.relevance_bucket,
      evidence: ['Capsule evidence should only supplement selected evidence.']
    }],
    reserve_capsules: []
  });
  writeJson(newsroomPath(root, 'reporter-candidates.json'), {
    schema_version: 1,
    date: DATE,
    candidates: [selected, reserve]
  });
  writeJson(newsroomPath(root, 'quality-report.json'), {
    schema_version: 1,
    date: DATE,
    score: 82,
    threshold: 85,
    status: 'NEEDS_FIX',
    deductions: [{ reason: 'hard blocker: source gap remains', hard_fail: true }]
  });
  writeJson(newsroomPath(root, 'fact-check-report.json'), {
    status: 'NEEDS_FIX',
    must_fix: [{ issue: 'Bind claim to dated source evidence.' }],
    source_gaps: [{ issue: 'Article has a remaining source gap.' }],
    source_gap_count: 1
  });
  writeJson(newsroomPath(root, 'source-effectiveness-report.json'), {
    schema_version: 1,
    date: DATE,
    warnings: ['Fact-check source gap URL did not match a collected candidate.']
  });
  writeJson(sourceEventsPath(root), {
    schema_version: 1,
    date: DATE,
    events: [{
      source_event_id: 'source-event-selected-1',
      evidence_id: 'evidence-selected-1',
      event_type: 'last_updated_changed',
      title: selected.title,
      url: selected.url,
      effective_date: '2026-05-14',
      date_source: 'visible_last_updated',
      date_confidence: 85,
      candidate_allowed: true,
      main_article_allowed: true
    }],
    diagnostics: []
  });
  writeJson(newsroomPath(root, 'repair-failure.json'), {
    message: 'section_count_drift'
  });
  writeJson(newsroomPath(root, 'stale-claim-report.json'), {
    must_fix: ['Remove stale Android version claim.']
  });
}

test('Evidence Pack schema v1 always exposes required top-level defaults', () => {
  const report = buildEvidencePackSummary({ date: DATE, generatedAt: GENERATED_AT });

  for (const key of [
    'schema_version',
    'date',
    'generated_at',
    'inputs',
    'publish_status',
    'selection_summary',
    'claim_validation_summary',
    'hal_impact_summary',
    'selected_main_articles',
    'reserve_candidates',
    'excluded_candidates_top',
    'failure_diagnostics',
    'warnings'
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(report, key), key);
  }

  assert.equal(report.schema_version, 1);
  assert.equal(report.date, DATE);
  assert.equal(report.generated_at, GENERATED_AT);
  assert.deepEqual(report.selected_main_articles, []);
  assert.deepEqual(report.reserve_candidates, []);
  assert.deepEqual(report.excluded_candidates_top, []);
  assert.deepEqual(report.failure_diagnostics.invalid_artifacts, []);
  assert.equal(report.publish_status.status, 'unknown');
  assert.equal(report.publish_status.final_publish_ready, null);
  assert.equal(report.selection_summary.raw_candidate_count, null);
  assert.equal(report.selection_summary.primary_camera_stack_count, null);
  assert.deepEqual(report.claim_validation_summary, {
    status: 'not_available',
    bound_claims: null,
    total_claims: null,
    overclaim_risk: 'unknown',
    available_article_count: 0,
    not_available_article_count: 0
  });
  assert.deepEqual(report.hal_impact_summary, {
    axes: [],
    article_count_with_axes: 0,
    article_count_without_axes: 0
  });
});

test('supports shortlisted_candidates flag-based selected, reserve, and excluded shape', () => {
  const selected = selectedCandidate({
    final_selected: true,
    selected_for_editor: true,
    selected: true,
    reserve_candidate: false,
    final_exclusion_reasons: []
  });
  const reserve = reserveCandidate({
    final_selected: false,
    selected_for_editor: false,
    selected: false,
    reserve_candidate: true,
    final_exclusion_reasons: []
  });
  const excluded = excludedCandidate(1, {
    final_selected: false,
    selected_for_editor: false,
    selected: false,
    reserve_candidate: false,
    final_exclusion_reasons: ['generic topic without HAL impact axis']
  });

  const report = buildEvidencePackSummary({
    date: DATE,
    shortlistReport: {
      input_candidate_count: 3,
      eligible_candidate_count: 2,
      selected_article_count: 1,
      reserve_candidate_count: 1,
      shortlisted_candidates: [selected, reserve, excluded]
    },
    collectedCandidates: {
      candidates: [selected, reserve, excluded]
    }
  });

  assert.equal(report.selected_main_articles.length, 1);
  assert.equal(report.reserve_candidates.length, 1);
  assert.equal(report.excluded_candidates_top.length, 1);
  assert.equal(report.selected_main_articles[0].candidate_id, 'selected-1');
  assert.equal(report.reserve_candidates[0].candidate_id, 'reserve-1');
  assert.equal(report.excluded_candidates_top[0].candidate_id, 'excluded-1');
  assert.equal(report.selection_summary.selected_main_article_count, 1);
  assert.equal(report.selection_summary.reserve_candidate_count, 1);
  assert.equal(report.selection_summary.excluded_candidate_count, 1);
  assert.equal(report.claim_validation_summary.status, 'available');
  assert.equal(report.claim_validation_summary.bound_claims, 2);
  assert.equal(report.claim_validation_summary.total_claims, 2);
  assert.equal(report.claim_validation_summary.overclaim_risk, 'low');
  assert.deepEqual(report.hal_impact_summary.axes, ['buffer', 'metadata']);
});

test('quality report claim validation overrides candidate fallback claim summary', () => {
  const selected = selectedCandidate({
    final_selected: true,
    selected_for_editor: true,
    selected: true,
    reserve_candidate: false,
    claim_validation: {
      status: 'not_available',
      bound_claims: null,
      total_claims: null,
      overclaim_risk: 'unknown'
    }
  });
  const report = buildEvidencePackSummary({
    date: DATE,
    shortlistReport: {
      shortlisted_candidates: [selected],
      selected_article_count: 1
    },
    collectedCandidates: {
      candidates: [selected]
    },
    qualityReport: {
      claim_validation_summary: {
        status: 'needs_fix',
        bound_claims: 1,
        total_claims: 2,
        derived_evidence_mapping_count: 1,
        overclaim_risk: 'high',
        available_article_count: 1,
        not_available_article_count: 0
      },
      claim_results: [{
        article_index: 1,
        claim_id: 'claim-1',
        bound: true,
        overclaim_risk: 'high',
        issues: [],
        derived_evidence_mapping: true
      }]
    }
  });

  assert.equal(report.claim_validation_summary.status, 'needs_fix');
  assert.equal(report.claim_validation_summary.bound_claims, 1);
  assert.equal(report.claim_validation_summary.total_claims, 2);
  assert.equal(report.claim_validation_summary.derived_evidence_mapping_count, 1);
  assert.equal(report.selected_main_articles[0].claim_validation.status, 'available');
  assert.equal(report.selected_main_articles[0].claim_validation.bound_claims, 1);
});

test('writes default summary when no input artifacts exist', () => {
  const root = tempRoot('evidence-pack-empty-');
  const { report, jsonPath } = writeEvidencePackSummaryArtifacts({ root, date: DATE });

  assert.equal(fs.existsSync(jsonPath), true);
  assert.equal(report.publish_status.status, 'unknown');
  assert.ok(report.warnings.some(warning => warning.includes('No minimum Evidence Pack input artifact')));
  assert.ok(report.inputs.missing.includes(`content/newsroom/${DATE}/generation-status.json`));
  assert.ok(report.inputs.missing.includes(`content/newsroom/${DATE}/selection-report.json`));
  assert.ok(report.inputs.missing.includes(`content/newsroom/${DATE}/shortlisted-candidates.json`));
  assert.ok(report.inputs.missing.includes(`content/collected-news/${DATE}/candidates.json`));
});

test('uses shortlist publish_ready as best-effort publish readiness', () => {
  const report = buildEvidencePackSummary({
    date: DATE,
    shortlistReport: { publish_ready: true }
  });

  assert.equal(report.publish_status.final_publish_ready, true);
  assert.equal(report.publish_status.status, 'publish-ready');
});

test('selection summary preserves fallback window diagnostics from promoted array', () => {
  const reason = 'primary window selected 1 article(s), below min 3';
  const report = buildEvidencePackSummary({
    date: DATE,
    shortlistReport: {
      fallback_window_consulted: true,
      fallback_window_used: true,
      fallback_window_reason: reason,
      fallback_candidates_promoted: [
        { title: 'Fallback promoted one' },
        { title: 'Fallback promoted two' }
      ]
    }
  });

  assert.equal(report.selection_summary.fallback_window_consulted, true);
  assert.equal(report.selection_summary.fallback_window_used, true);
  assert.equal(report.selection_summary.fallback_window_reason, reason);
  assert.equal(report.selection_summary.fallback_candidates_promoted_count, 2);
});

test('selection summary accepts numeric fallback promoted count', () => {
  const report = buildEvidencePackSummary({
    date: DATE,
    selectionReport: {
      fallback_candidates_promoted_count: 3
    }
  });

  assert.equal(report.selection_summary.fallback_candidates_promoted_count, 3);
});

test('selection summary preserves false and zero fallback diagnostics by source priority', () => {
  const report = buildEvidencePackSummary({
    date: DATE,
    generationStatus: {
      fallback_window_consulted: false,
      fallback_window_used: false,
      fallback_window_reason: '',
      fallback_candidates_promoted_count: 0
    },
    shortlistReport: {
      fallback_window_consulted: true,
      fallback_window_used: true,
      fallback_window_reason: 'should not override generation status',
      fallback_candidates_promoted: [
        { title: 'Fallback promoted one' },
        { title: 'Fallback promoted two' }
      ]
    }
  });

  assert.equal(report.selection_summary.fallback_window_consulted, false);
  assert.equal(report.selection_summary.fallback_window_used, false);
  assert.equal(report.selection_summary.fallback_window_reason, '');
  assert.equal(report.selection_summary.fallback_candidates_promoted_count, 0);
});

test('full artifact set creates selected, reserve, excluded, and failure summaries without raw dumps', () => {
  const root = tempRoot('evidence-pack-full-');
  writeFullArtifactSet(root);

  const result = writeEvidencePackSummaryArtifacts({ root, date: DATE });
  const report = readJson(result.jsonPath);
  const serialized = JSON.stringify(report);

  assert.equal(fs.existsSync(result.jsonPath), true);
  assert.equal(report.publish_status.status, 'needs-fix');
  assert.equal(report.publish_status.run_mode, 'daily_draft');
  assert.equal(report.publish_status.quality_score, 82);
  assert.equal(report.publish_status.quality_threshold, 85);
  assert.equal(report.publish_status.fact_check_status, 'NEEDS_FIX');
  assert.equal(report.selection_summary.raw_candidate_count, 14);
  assert.equal(report.selection_summary.eligible_candidate_count, 2);
  assert.equal(report.selection_summary.selected_main_article_count, 1);
  assert.equal(report.selection_summary.reserve_candidate_count, 1);
  assert.equal(report.selection_summary.excluded_candidate_count, 12);
  assert.equal(report.selection_summary.primary_camera_stack_count, 1);
  assert.equal(report.claim_validation_summary.status, 'available');
  assert.equal(report.claim_validation_summary.bound_claims, 2);
  assert.equal(report.claim_validation_summary.total_claims, 2);
  assert.equal(report.claim_validation_summary.overclaim_risk, 'low');
  assert.equal(report.claim_validation_summary.available_article_count, 1);
  assert.equal(report.claim_validation_summary.not_available_article_count, 0);
  assert.deepEqual(report.hal_impact_summary.axes, ['buffer', 'metadata']);
  assert.equal(report.hal_impact_summary.article_count_with_axes, 1);
  assert.equal(report.hal_impact_summary.article_count_without_axes, 0);
  assert.equal(report.selected_main_articles.length, 1);
  assert.equal(report.reserve_candidates.length, 1);
  assert.equal(report.excluded_candidates_top.length, MAX_EXCLUDED_CANDIDATES);
  assert.equal(report.excluded_candidates_truncated, true);
  assert.ok(report.failure_diagnostics.quality_hard_failures.some(item => item.includes('source gap')));
  assert.ok(report.failure_diagnostics.fact_check_must_fix.some(item => item.includes('dated source evidence')));
  assert.ok(report.failure_diagnostics.repair_failures.some(item => item.includes('section_count_drift')));
  assert.ok(report.failure_diagnostics.source_gap_warnings.some(item => item.includes('source gap')));
  assert.equal(report.failure_diagnostics.invalid_artifacts.length, 0);
  assert.equal(report.inputs.used.length, 12);
  assert.equal(report.inputs.missing.length, 0);

  const article = report.selected_main_articles[0];
  assert.equal(article.source_tier, 'high');
  assert.equal(article.source_role, 'official_release_note');
  assert.equal(article.source_url_quality, 'article_url');
  assert.equal(article.source_reliability, 'official');
  assert.equal(article.freshness_window, 'current');
  assert.deepEqual(article.hal_impact_axes, ['buffer', 'metadata']);
  assert.equal(article.claim_validation.status, 'available');
  assert.equal(article.key_evidence.length, MAX_EVIDENCE_PER_ARTICLE);
  assert.ok(article.key_evidence.every(item => item.length <= MAX_EVIDENCE_TEXT_LENGTH));
  assert.equal(serialized.includes('<p>'), false);
  assert.equal(serialized.includes('<article>'), false);
  assert.equal(serialized.includes('debug dump'), false);
});

test('candidate shortage review-only run builds a partial summary from minimum artifacts', () => {
  const root = tempRoot('evidence-pack-shortage-');
  writeJson(newsroomPath(root, 'generation-status.json'), {
    date: DATE,
    status: 'FAILED',
    failure_kind: 'candidate_shortage_reviewable',
    review_pr_ready: true,
    public_newsletter_ready: false,
    final_publish_ready: false,
    fact_check_status: 'UNKNOWN',
    selection_shortage_hints: ['Repair official CameraX parser before publishing.']
  });
  writeJson(newsroomPath(root, 'selection-report.json'), {
    schema_version: 1,
    date: DATE,
    status: 'REVIEW_ONLY',
    selection_shortage_hints: ['Add one primary camera stack source.'],
    counts: {
      input_candidate_count: 2,
      eligible_candidate_count: 1,
      selected_article_count: 1
    }
  });

  const { report } = writeEvidencePackSummaryArtifacts({ root, date: DATE });

  assert.equal(report.publish_status.status, 'review-only');
  assert.equal(report.publish_status.review_pr_ready, true);
  assert.equal(report.selection_summary.raw_candidate_count, 2);
  assert.deepEqual(report.failure_diagnostics.candidate_shortage_hints, [
    'Repair official CameraX parser before publishing.',
    'Add one primary camera stack source.'
  ]);
  assert.ok(report.inputs.missing.includes(`content/collected-news/${DATE}/candidates.json`));
  assert.ok(report.failure_diagnostics.missing_artifacts.includes(`content/newsroom/${DATE}/shortlisted-candidates.json`));
});

test('missing and invalid artifacts are reported separately without failing summary generation', () => {
  const root = tempRoot('evidence-pack-invalid-');
  writeText(newsroomPath(root, 'generation-status.json'), '{ invalid json');
  writeJson(newsroomPath(root, 'selection-report.json'), {
    schema_version: 1,
    date: DATE,
    status: 'OK'
  });

  const { report } = writeEvidencePackSummaryArtifacts({ root, date: DATE });

  assert.equal(report.publish_status.status, 'unknown');
  assert.ok(report.inputs.missing.includes(`content/newsroom/${DATE}/shortlisted-candidates.json`));
  assert.ok(report.failure_diagnostics.missing_artifacts.includes(`content/collected-news/${DATE}/candidates.json`));
  assert.equal(report.failure_diagnostics.invalid_artifacts.length, 1);
  assert.equal(report.failure_diagnostics.invalid_artifacts[0].path, `content/newsroom/${DATE}/generation-status.json`);
  assert.ok(report.warnings.some(warning => warning.includes('Invalid preferred artifact skipped')));
});

test('selected article compatibility fields fall back to unknown or not_available with warnings', () => {
  const report = buildEvidencePackSummary({
    date: DATE,
    shortlistReport: {
      selected_articles: [{
        title: 'Sparse CameraX release note',
        url: 'https://example.com/sparse-camerax',
        source_name: 'Sparse Source',
        relevance_bucket: 'android_platform_camera_adjacent'
      }]
    }
  });
  const article = report.selected_main_articles[0];

  assert.equal(article.source_tier, 'unknown');
  assert.equal(article.source_role, 'unknown');
  assert.equal(article.source_url_quality, 'unknown');
  assert.equal(article.source_reliability, 'unknown');
  assert.equal(article.freshness_window, 'unknown');
  assert.equal(article.source_gap_risk, null);
  assert.equal(article.has_dated_evidence, null);
  assert.deepEqual(article.hal_impact_axes, []);
  assert.deepEqual(article.claim_validation, {
    status: 'not_available',
    bound_claims: null,
    total_claims: null,
    overclaim_risk: 'unknown'
  });
  assert.deepEqual(report.claim_validation_summary, {
    status: 'not_available',
    bound_claims: null,
    total_claims: null,
    overclaim_risk: 'unknown',
    available_article_count: 0,
    not_available_article_count: 1
  });
  assert.deepEqual(report.hal_impact_summary, {
    axes: [],
    article_count_with_axes: 0,
    article_count_without_axes: 1
  });
  assert.ok(report.warnings.some(warning => warning.includes('source_tier=unknown')));
  assert.ok(report.warnings.some(warning => warning.includes('claim_validation.status=not_available')));
  assert.ok(report.warnings.some(warning => warning.includes('hal_impact_axes=[]')));
});

test('freshness window metadata values are preserved in evidence pack article summaries', () => {
  const freshnessWindows = ['primary', 'fallback', 'reference', 'stale', 'unknown'];
  const report = buildEvidencePackSummary({
    date: DATE,
    shortlistReport: {
      selected_articles: freshnessWindows.map((freshness_window, index) => selectedCandidate({
        candidate_id: `selected-window-${index}`,
        title: `Camera freshness window ${freshness_window}`,
        url: `https://example.com/freshness-window-${freshness_window}`,
        freshness_window
      }))
    }
  });

  assert.deepEqual(
    report.selected_main_articles.map(article => article.freshness_window),
    freshnessWindows
  );
});
