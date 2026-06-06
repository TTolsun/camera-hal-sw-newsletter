const { ensureArray } = require('../common/value-coercion');
const {
  resolvePublishStatus
} = require('../common/publish-status');
const {
  renderGithubOutputs
} = require('./write-generation-status-output');

const OUTPUT_FIELDS = [
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
  'has_ai_publish_ready',
  'artifact_final_publish_ready',
  'selection_publish_ready',
  'publish_gate_passed',
  'publish_gate_reason_codes',
  'publish_gate_reason_summary',
  'review_gate_passed',
  'validate_outcome',
  'validate_ok',
  'failure_class',
  'failure_kind',
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

function reasonSummaryText(items) {
  return ensureArray(items)
    .map(item => `${item.code || 'unknown'} actual=${scalar(item.actual, 'n/a')} required=${scalar(item.required, 'n/a')}`)
    .join('; ') || 'none';
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
    } else if (field === 'publish_gate_reason_codes') {
      outputs[field] = ensureArray(status.publish_gate_reason_codes).join('; ') || 'none';
    } else if (field === 'publish_gate_reason_summary') {
      outputs[field] = reasonSummaryText(status.publish_gate_reason_summary);
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
