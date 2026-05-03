const fs = require('fs');
const path = require('path');

const {
  renderCandidateSelectionDiagnostics
} = require('../generate/selection-diagnostics');

const DEFAULT_STATUS = {
  status: 'UNKNOWN',
  must_fix_count: 0,
  quality_status: 'UNKNOWN',
  quality_score: 'n/a',
  quality_threshold: 'n/a',
  publish_ready: false
};

const OUTPUT_FIELDS = [
  'status',
  'failure_stage',
  'failure_reason',
  'fact_check_status',
  'must_fix_count',
  'quality_status',
  'quality_score',
  'quality_threshold',
  'quality_attempt_count',
  'quality_deduction_count',
  'locked_article_count',
  'publish_ready',
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
  'source_gap_count'
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

function formatReasonSummary(items) {
  return ensureArray(items)
    .slice(0, 5)
    .map(item => `${item.reason || 'unknown'} (${item.count ?? 'n/a'})`)
    .join('; ') || 'none';
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
  for (const field of OUTPUT_FIELDS) {
    outputs[field] = scalar(status[field], field === 'must_fix_count' ? '0' : 'n/a');
  }
  outputs.status = scalar(status.status, 'UNKNOWN');
  outputs.must_fix_count = scalar(status.must_fix_count, '0');
  outputs.quality_status = scalar(status.quality_status, 'UNKNOWN');
  outputs.quality_score = scalar(status.quality_score, 'n/a');
  outputs.quality_threshold = scalar(status.quality_threshold, 'n/a');
  outputs.publish_ready = status.publish_ready === true ? 'true' : 'false';
  outputs.underfilled = status.underfilled === true ? 'true' : 'false';
  outputs.selection_warnings = multilineValue(status.selection_warnings);
  outputs.selection_errors = multilineValue(status.selection_errors);
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
