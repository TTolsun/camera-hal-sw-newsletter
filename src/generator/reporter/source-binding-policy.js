const CLAIM_TYPES = Object.freeze([
  'fact',
  'inference',
  'recommendation',
  'risk_note',
  'limitation'
]);

const CLAIM_TYPE_VALUES = new Set(CLAIM_TYPES);

const CLAIM_IMPACT_LEVELS = Object.freeze([
  'direct_hal_contract',
  'camera_framework_behavior',
  'app_api_or_framework_adjacent',
  'driver_image_pipeline',
  'stream_buffer_metadata',
  'cts_vts_its_cdd',
  'performance_latency_thermal',
  'soc_resource_contention',
  'native_tooling_workflow',
  'no_hal_runtime_impact',
  'unknown'
]);

const CLAIM_IMPACT_LEVEL_VALUES = new Set(CLAIM_IMPACT_LEVELS);

const CLAIM_IMPACT_LEVEL_ALIASES = Object.freeze({
  camerax_app_compatibility: 'app_api_or_framework_adjacent',
  framework_hal_contract: 'camera_framework_behavior'
});

const OVERCLAIM_RISKS = Object.freeze([
  'low',
  'medium',
  'high',
  'unknown'
]);

const OVERCLAIM_RISK_VALUES = new Set(OVERCLAIM_RISKS);

const DIRECT_HAL_WORDING = /\b(?:direct\s+Camera\s+HAL|direct\s+HAL|HAL\s+API|HAL\s+contract|vendor\s+HAL|camera\s+provider\s+contract|HAL\s+runtime|runtime\s+behavior|driver\s+runtime)\b/i;
const DIRECT_HAL_GUARDRAIL = /\bdo\s+not\s+(?:claim|overstate|present|treat)[^.\n]{0,120}\b(?:direct\s+Camera\s+HAL|direct\s+HAL|HAL\s+API|HAL\s+contract|runtime|driver)\b|\b(?:direct\s+Camera\s+HAL|direct\s+HAL|HAL\s+API|HAL\s+contract|runtime|driver)\b[^.\n]{0,120}\b(?:do\s+not|not\s+claim|not\s+overstate|without\s+source|without\s+(?:direct\s+)?evidence|not\s+(?:confirmed|stated|identified))\b|\b(?:no|without|lacks?|missing|not\s+(?:confirmed|stated|identified))\b[^.\n]{0,120}\b(?:direct\s+Camera\s+HAL|direct\s+HAL|HAL\s+API|HAL\s+contract|runtime|driver)\b/i;
const CONCRETE_FACT_TERMS = /\b(?:version|release\s+date|published|API|component|behavior\s+change|CameraX|Camera2|Camera\s+HAL|AndroidX|libcamera|V4L2|CTS|VTS|Camera\s+ITS|stream|buffer|metadata|request|result)\b|\b20\d{2}-\d{2}-\d{2}\b|\bv?\d+\.\d+(?:\.\d+)?(?:[-\w.]*)?\b/i;
const NON_ALLOWED_EVIDENCE_STATUSES = Object.freeze(['blocked', 'failed', 'skipped', 'unsupported']);
const NON_ALLOWED_EVIDENCE_STATUS_VALUES = new Set(NON_ALLOWED_EVIDENCE_STATUSES);
const LINKED_EVIDENCE_STATUS_FIELDS = Object.freeze([
  ['blocked_linked_evidence_ids', 'blocked'],
  ['failed_linked_evidence_ids', 'failed'],
  ['skipped_linked_evidence_ids', 'skipped'],
  ['unsupported_linked_evidence_ids', 'unsupported']
]);
const POSITIVE_SUPPORT_CLAIM_TYPES = new Set(['fact', 'inference', 'recommendation']);
const LIMITATION_CLAIM_TYPES = new Set(['risk_note', 'limitation']);
const LIMITATION_WORDING = /\b(?:not\s+confirmed|not\s+resolved|not\s+fetched|fetch(?:ed)?\s+failed|failed\s+to\s+fetch|blocked|skipped|unsupported|unresolved|diagnostic(?:\s+only)?|limited|cannot\s+confirm|without\s+(?:confirmed|resolved|direct)\s+evidence|no\s+direct\s+HAL\s+impact\s+is\s+confirmed)\b/i;
const POSITIVE_SUPPORT_WORDING = /\b(?:confirms?|confirmed|proves?|verified|shows?|demonstrates?|establishes?|supports?|evidence\s+(?:shows|confirms)|direct\s+HAL\s+impact|direct\s+HAL\s+behavior|runtime\s+behavior\s+(?:changes?|changed)|changes?\s+runtime\s+behavior)\b/i;
const STREAM_BUFFER_TERMS = Object.freeze(['stream', 'buffer', 'metadata', 'request', 'result']);
const RUNTIME_TERMS = Object.freeze(['runtime', 'behavior', 'implementation', 'pipeline']);

module.exports = {
  CLAIM_TYPES,
  CLAIM_TYPE_VALUES,
  CLAIM_IMPACT_LEVELS,
  CLAIM_IMPACT_LEVEL_VALUES,
  CLAIM_IMPACT_LEVEL_ALIASES,
  OVERCLAIM_RISKS,
  OVERCLAIM_RISK_VALUES,
  DIRECT_HAL_WORDING,
  DIRECT_HAL_GUARDRAIL,
  CONCRETE_FACT_TERMS,
  NON_ALLOWED_EVIDENCE_STATUSES,
  NON_ALLOWED_EVIDENCE_STATUS_VALUES,
  LINKED_EVIDENCE_STATUS_FIELDS,
  POSITIVE_SUPPORT_CLAIM_TYPES,
  LIMITATION_CLAIM_TYPES,
  LIMITATION_WORDING,
  POSITIVE_SUPPORT_WORDING,
  STREAM_BUFFER_TERMS,
  RUNTIME_TERMS
};
