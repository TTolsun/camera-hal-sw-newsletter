const fs = require('fs');
const path = require('path');

const {
  renderCandidateSelectionDiagnostics
} = require('../generate/selection-diagnostics');
const {
  formatReasonSummary
} = require('../common/status-format');

const DEFAULT_STATUS = {
  status: 'UNKNOWN',
  fact_check_status: 'UNKNOWN',
  must_fix_count: 0,
  failure_kind: '',
  failure_class: '',
  quality_status: 'UNKNOWN',
  quality_score: 'n/a',
  quality_threshold: 'n/a',
  publish_ready: false,
  selection_publish_ready: false,
  final_publish_ready: false,
  editor_review_required: false
};

const OUTPUT_FIELDS = [
  'status',
  'failure_stage',
  'failure_reason',
  'failure_class',
  'failure_kind',
  'fact_check_status',
  'must_fix_count',
  'quality_status',
  'quality_score',
  'quality_threshold',
  'quality_attempt_count',
  'quality_deduction_count',
  'locked_article_count',
  'deterministic_selected_count',
  'rendered_main_article_count',
  'rendered_group_count',
  'selected_group_count',
  'explicitly_demoted_group_count',
  'hard_blocked_group_count',
  'reserve_candidate_count',
  'publish_ready',
  'selection_publish_ready',
  'final_publish_ready',
  'publication_mode',
  'homepage_visibility',
  'normal_public_ready',
  'automatic_publish_ready',
  'public_artifact_ready',
  'fallback_public_ready',
  'fallback_only',
  'camera_anchor_count',
  'homepage_badge',
  'validate_ok',
  'review_gate_passed',
  'publish_gate_passed',
  'publish_gate_reason_codes',
  'min_final_articles',
  'absolute_min_reviewable_articles',
  'min_non_fallback_publish_ready_articles',
  'composition_mode',
  'selection_composition_mode',
  'editor_review_required',
  'direct_aosp_camera_count',
  'camera_driver_image_pipeline_count',
  'android_platform_camera_adjacent_count',
  'android_multimedia_camera_output_count',
  'soc_platform_signal_count',
  'cpp_ai_tooling_fallback_count',
  'generic_tech_watchlist_count',
  'primary_camera_stack_topic_count',
  'supporting_main_article_count',
  'forbidden_main_article_count',
  'non_fallback_reviewable_article_count',
  'eligible_non_fallback_reviewable_article_count',
  'underfilled',
  'input_candidate_count',
  'eligible_candidate_count',
  'selected_article_count',
  'reporter_candidate_count',
  'reporter_selected_count',
  'final_input_candidate_count',
  'final_eligible_candidate_count',
  'final_selected_article_count',
  'reporter_selected_but_final_excluded_count',
  'source_gap_count',
  'stale_claim_status',
  'stale_claim_removed_count',
  'stale_claim_hard_failure_count'
];

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function readStatus(statusPath = path.join(process.cwd(), '.tmp', 'newsletter-generation-status.json')) {
  try {
    if (!fs.existsSync(statusPath)) return { ...DEFAULT_STATUS };
    const parsed = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    return { ...DEFAULT_STATUS, ...parsed };
  } catch (error) {
    return {
      ...DEFAULT_STATUS,
      failure_stage: 'status-output',
      failure_reason: `Could not read newsletter-generation-status.json: ${error.message}`
    };
  }
}

function scalar(value, fallback = 'n/a') {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function multilineValue(value) {
  if (Array.isArray(value)) return value.join('; ') || 'none';
  return scalar(value, 'none');
}

function githubOutputLine(name, value) {
  const output = String(value ?? '');
  if (!output.includes('\n')) return `${name}=${output}`;
  let delimiter = 'EOF';
  let index = 1;
  while (output.includes(delimiter)) {
    delimiter = `EOF_${index}`;
    index += 1;
  }
  return `${name}<<${delimiter}\n${output}\n${delimiter}`;
}

function buildGenerationStatusOutputs(status) {
  const outputs = {};
  const failedRepairReviewable = status.status === 'FAILED_REPAIR_REVIEWABLE';
  for (const field of OUTPUT_FIELDS) {
    outputs[field] = scalar(status[field], field === 'must_fix_count' ? '0' : 'n/a');
  }
  outputs.status = scalar(status.status, 'UNKNOWN');
  outputs.must_fix_count = scalar(status.must_fix_count, '0');
  outputs.quality_status = scalar(status.quality_status, 'UNKNOWN');
  outputs.quality_score = scalar(status.quality_score, 'n/a');
  outputs.quality_threshold = scalar(status.quality_threshold, 'n/a');
  outputs.publish_ready = !failedRepairReviewable && status.publish_ready === true ? 'true' : 'false';
  outputs.selection_publish_ready = !failedRepairReviewable && status.selection_publish_ready === true ? 'true' : 'false';
  outputs.final_publish_ready = !failedRepairReviewable && status.final_publish_ready === true ? 'true' : 'false';
  outputs.review_gate_passed = status.review_gate_passed === true ? 'true' : 'false';
  outputs.publish_gate_passed = !failedRepairReviewable && status.publish_gate_passed === true ? 'true' : 'false';
  outputs.editor_review_required = failedRepairReviewable || status.editor_review_required === true ? 'true' : 'false';
  if (failedRepairReviewable) {
    outputs.composition_mode = 'NEEDS_FIX';
  }
  outputs.underfilled = status.underfilled === true ? 'true' : 'false';
  outputs.deterministic_selected_count = scalar(
    status.deterministic_selected_count ?? status.selected_article_count,
    '0'
  );
  outputs.rendered_main_article_count = scalar(
    status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count,
    '0'
  );
  outputs.reserve_candidate_count = scalar(status.reserve_candidate_count, '0');
  outputs.stale_claim_status = scalar(status.stale_claim_status, 'UNKNOWN');
  outputs.stale_claim_removed_count = scalar(status.stale_claim_removed_count, '0');
  outputs.stale_claim_hard_failure_count = scalar(status.stale_claim_hard_failure_count, '0');
  outputs.selection_warnings = multilineValue(status.selection_warnings);
  outputs.selection_errors = multilineValue(status.selection_errors);
  outputs.publish_gate_reason_codes = multilineValue(status.publish_gate_reason_codes);
  outputs.publish_gate_reason_summary = multilineValue(
    ensureArray(status.publish_gate_reason_summary).map(item =>
      `${item.code || 'unknown'} actual=${scalar(item.actual, 'n/a')} required=${scalar(item.required, 'n/a')}`
    )
  );
  outputs.selection_shortage_hints = multilineValue(status.selection_shortage_hints);
  outputs.exclusion_reason_summary = formatReasonSummary(status.exclusion_reason_summary);
  outputs.final_exclusion_reason_summary = formatReasonSummary(
    ensureArray(status.final_exclusion_reason_summary).length > 0
      ? status.final_exclusion_reason_summary
      : status.exclusion_reason_summary
  );
  const finalSelectedForGate = Number(status.final_selected_article_count ?? status.selected_article_count);
  outputs.final_selected_article_count_for_gate = Number.isFinite(finalSelectedForGate)
    ? String(finalSelectedForGate)
    : '0';
  outputs.candidate_selection_diagnostics = renderCandidateSelectionDiagnostics(status);
  return outputs;
}

function renderGithubOutputs(outputs) {
  return Object.entries(outputs)
    .map(([name, value]) => githubOutputLine(name, value))
    .join('\n');
}

function main() {
  const status = readStatus();
  process.stdout.write(`${renderGithubOutputs(buildGenerationStatusOutputs(status))}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_STATUS,
  buildGenerationStatusOutputs,
  formatReasonSummary,
  readStatus,
  renderGithubOutputs
};
