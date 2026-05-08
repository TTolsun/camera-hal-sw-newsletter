const {
  resolvePublishStatus
} = require('../common/publish-status');
const {
  renderGithubOutputs
} = require('./write-generation-status-output');

const OUTPUT_FIELDS = [
  'final_publish_ready',
  'has_ai_publish_ready',
  'artifact_final_publish_ready',
  'selection_publish_ready',
  'publish_gate_passed',
  'review_gate_passed',
  'validate_outcome',
  'quality_status',
  'fact_check_status',
  'must_fix_count',
  'source_gap_count',
  'stale_claim_status',
  'stale_claim_hard_failure_count',
  'consistency_error_count',
  'consistency_errors',
  'composition_mode',
  'selection_composition_mode'
];

function scalar(value, fallback = 'n/a') {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function buildPublishStatusOutputs(resolved) {
  const status = resolved.status || {};
  const outputs = {};
  for (const field of OUTPUT_FIELDS) {
    if (field === 'consistency_error_count') {
      outputs[field] = String((status.consistency_errors || []).length);
    } else if (field === 'consistency_errors') {
      outputs[field] = (status.consistency_errors || []).join('\n') || 'none';
    } else if (field === 'has_ai_publish_ready') {
      outputs[field] = scalar(status.final_publish_ready === true);
    } else {
      outputs[field] = scalar(status[field], field.endsWith('_count') ? '0' : 'n/a');
    }
  }
  return outputs;
}

function main() {
  const resolved = resolvePublishStatus();
  process.stdout.write(`${renderGithubOutputs(buildPublishStatusOutputs(resolved))}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  OUTPUT_FIELDS,
  buildPublishStatusOutputs
};
