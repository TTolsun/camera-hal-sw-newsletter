const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const {
  buildGenerationStatus,
  selectionStatusExtra,
  writeGenerationStatus,
  writeNewsletterDate,
  writeSelectionDiagnosticsArtifact
} = require('../../scripts/newsroom/cli/gemini-newsroom-newsletter');
const { articlePolicy } = require('../../scripts/newsroom/common/newsletter-policy');
const {
  readJson,
  tempRoot
} = require('../helpers/fs');

function deterministicFailureShortlist(date) {
  const composition = {
    selected_article_count: 1,
    direct_aosp_camera_count: 1,
    camera_driver_image_pipeline_count: 0,
    android_platform_camera_adjacent_count: 0,
    soc_platform_signal_count: 0,
    cpp_ai_tooling_fallback_count: 0,
    generic_tech_watchlist_count: 0,
    primary_camera_stack_topic_count: 1,
    supporting_main_article_count: 0,
    forbidden_main_article_count: 0,
    non_fallback_reviewable_article_count: 1
  };
  return {
    schema_version: 3,
    date,
    input_candidate_count: 1,
    eligible_candidate_count: 1,
    deterministic_selected_count: 1,
    selected_article_count: 1,
    composition_mode: 'NEEDS_FIX',
    selection_composition_mode: 'NEEDS_FIX',
    composition_reason: 'Only one official camera candidate is available.',
    composition_summary: composition,
    eligible_composition_summary: composition,
    review_gate_passed: false,
    publish_gate_passed: false,
    publish_ready: false,
    underfilled: false,
    selected_articles: [{
      title: 'Camera ITS',
      url: 'https://source.android.com/docs/compatibility/cts/camera-its',
      relevance_bucket: 'direct_aosp_camera'
    }],
    shortlisted_candidates: [],
    reserve_candidates: [],
    excluded_candidates: [],
    selection_warnings: [],
    selection_errors: [`Only 1 eligible non-duplicate final article input(s) remain after deterministic filtering; Newsletter Policy requires at least ${articlePolicy.mainArticleCount.min}.`],
    selection_shortage_hints: ['Collect enough eligible candidates to satisfy the Newsletter Policy article count range.'],
    exclusion_reason_summary: []
  };
}

test('deterministic pre-LLM failure artifacts include date, status, and selection reports', () => {
  const date = '2026-05-06';
  const root = tempRoot('selection-report-artifact-');
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const shortlistReport = deterministicFailureShortlist(date);

  writeNewsletterDate(date, root);
  writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);
  writeGenerationStatus(buildGenerationStatus({
    date,
    status: 'FAILED',
    failureStage: 'deterministic selection',
    failureReason: shortlistReport.selection_errors.join('; '),
    extra: selectionStatusExtra(shortlistReport)
  }), root);

  assert.equal(fs.readFileSync(path.join(root, '.tmp', 'newsletter-date.txt'), 'utf8'), date);
  const status = readJson(path.join(root, '.tmp', 'newsletter-generation-status.json'));
  assert.equal(status.status, 'FAILED');
  assert.equal(status.failure_stage, 'deterministic selection');
  assert.deepEqual(status.selection_errors, shortlistReport.selection_errors);
  assert.deepEqual(status.selection_shortage_hints, shortlistReport.selection_shortage_hints);
  assert.equal(status.review_gate_passed, false);
  assert.equal(status.publish_gate_passed, false);

  const report = readJson(path.join(newsroomDir, 'selection-report.json'));
  assert.equal(report.failure_stage, 'deterministic selection');
  assert.equal(report.failure_reason, shortlistReport.selection_errors[0]);
  assert.deepEqual(report.selection_errors, shortlistReport.selection_errors);
  assert.deepEqual(report.selection_shortage_hints, shortlistReport.selection_shortage_hints);
  assert.equal(report.gate_summary.non_fallback_reviewable_article_count, 1);
  assert.equal(report.gate_summary.primary_camera_stack_topic_count, 1);
  assert.equal(report.gate_summary.supporting_main_article_count, 0);
  assert.equal(report.gate_summary.forbidden_main_article_count, 0);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'selection-report.md')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'selection-diagnostics.md')), true);
});
