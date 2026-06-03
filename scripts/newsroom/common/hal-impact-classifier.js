// HAL-facing impact classifier (#477).
//
// Single responsibility: turn a normalized candidate (+ its source quality and
// compact evidence) into a conservative `hal_signal` — the impact axes a Camera
// HAL engineer cares about, how strongly the source supports a HAL claim, and
// how much overclaim risk the angle carries.
//
// Pure transform: no IO, no LLM, no shared state. It only reads what the source
// already established; it never invents source facts and never upgrades an
// unsupported claim to high confidence (see #477 non-goals).
//
// Impact axes reuse the existing HAL_IMPACT_AXES taxonomy and the deterministic
// inferHalImpactAxes() inference, so this classifier adds a HAL-reader-facing
// signal layer without forking a second axis vocabulary.

const {
  HAL_IMPACT_AXES,
  inferHalImpactAxes
} = require('../domain/hal-signal-quality');

// Source URL qualities that directly, datably state a change.
const OFFICIAL_DATED_QUALITIES = new Set([
  'official_release_note_anchor',
  'official_dated_release',
  'official_site_update_row',
  'project_release',
  'project_mailing_list_release'
]);

// Source URL qualities that cannot, on their own, support a HAL claim.
const WEAK_QUALITIES = new Set([
  'generic_ai_or_it_trend',
  'undated_reference_page',
  'fallback_context',
  'unknown'
]);

// Axes that assert direct Camera HAL / driver / stream behavior. Pairing one of
// these with weak evidence is the classic overclaim trap.
const DIRECT_HAL_AXES = new Set([
  'framework_hal_contract',
  'driver_image_pipeline',
  'stream_buffer_metadata'
]);

const DIRECT_CAMERA_BUCKETS = new Set([
  'direct_aosp_camera',
  'camera_driver_image_pipeline'
]);

const AXIS_RECOMMENDED_CHECKS = Object.freeze({
  framework_hal_contract: ['configureStreams validation', 'advertised capability vs runtime failure check'],
  driver_image_pipeline: ['V4L2/libcamera log', 'sensor mode check'],
  stream_buffer_metadata: ['stream combination test', 'metadata log'],
  cts_vts_its_cdd: ['CTS', 'Camera ITS'],
  performance_latency_frame_drop: ['frame drop profile', 'latency benchmark'],
  thermal_power_memory_pressure: ['thermal/power trace'],
  soc_resource_contention: ['SoC resource contention trace'],
  camerax_app_compatibility: ['CameraX feature combination query'],
  security_vendor_component: ['vendor component security review'],
  native_tooling_workflow: ['build/CI reproduction']
});

// Ordered camera-path probes: first keyword match wins.
const CAMERA_PATH_PROBES = [
  [/\bpreview\b/i, 'preview'],
  [/\b(record|recording|video)\b/i, 'recording'],
  [/\b(metadata|capture\s*result|capture\s*request)\b/i, 'metadata'],
  [/\b(buffer|dma-?buf|surface)\b/i, 'buffer'],
  [/\b(driver|isp|sensor|v4l2|libcamera|mipi|csi)\b/i, 'driver'],
  [/\b(cts|vts|camera its|\bits\b|cdd)\b/i, 'test'],
  [/\b(ndk|toolchain|llvm|build|ci)\b/i, 'tooling'],
  [/\b(capture|still|jpeg|raw|yuv)\b/i, 'capture']
];

const AXIS_TO_CAMERA_PATH = Object.freeze({
  driver_image_pipeline: 'driver',
  cts_vts_its_cdd: 'test',
  native_tooling_workflow: 'tooling',
  stream_buffer_metadata: 'metadata',
  framework_hal_contract: 'capture',
  camerax_app_compatibility: 'capture'
});

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeEnum(value) {
  return String(value === undefined || value === null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function candidateText(candidate) {
  return [
    candidate.title,
    candidate.headline,
    candidate.summary,
    candidate.api_or_component,
    candidate.apiOrComponent,
    candidate.behavior_change,
    candidate.behaviorChange,
    candidate.category
  ].map(value => String(value || '')).join(' ');
}

function resolveSourceQuality(candidate, sourceQuality) {
  const provided = sourceQuality && typeof sourceQuality === 'object' ? sourceQuality : {};
  const nested = (candidate.source_quality || candidate.sourceQuality || {});
  return {
    source_url_quality: normalizeEnum(
      provided.source_url_quality || provided.sourceUrlQuality ||
      nested.source_url_quality || nested.sourceUrlQuality ||
      candidate.source_url_quality || candidate.sourceUrlQuality
    ),
    requires_cross_check: Boolean(
      provided.requires_cross_check ?? nested.requires_cross_check ?? candidate.requires_cross_check
    )
  };
}

function evidenceSupport(candidate, quality, evidence) {
  const dated = candidate.has_dated_evidence === true || candidate.hasDatedEvidence === true ||
    ensureArray(evidence).some(item => item && (item.has_date === true || /fetched|confirmed/i.test(String(item.fetch_status || item.status || ''))));
  if (OFFICIAL_DATED_QUALITIES.has(quality.source_url_quality)) {
    return dated ? 'direct' : 'inferred';
  }
  if (WEAK_QUALITIES.has(quality.source_url_quality) || !quality.source_url_quality) {
    return dated && !quality.requires_cross_check ? 'inferred' : 'weak';
  }
  // Conditional / lead / blog sources: never direct on their own.
  return 'inferred';
}

function halConfidence(evidenceLevel, bucket, axes) {
  const meaningfulAxes = axes.filter(axis => axis !== 'reference_only' && axis !== 'unknown');
  if (meaningfulAxes.length === 0) return 'low';
  if (evidenceLevel === 'direct' && DIRECT_CAMERA_BUCKETS.has(bucket)) return 'high';
  if (evidenceLevel === 'weak') return 'low';
  return 'medium';
}

function overclaimRisk(evidenceLevel, axes) {
  if (evidenceLevel === 'direct') return 'low';
  const claimsDirectHal = axes.some(axis => DIRECT_HAL_AXES.has(axis));
  if (evidenceLevel === 'weak' && claimsDirectHal) return 'high';
  return 'medium';
}

function cameraPath(candidate, axes) {
  const text = candidateText(candidate);
  for (const [pattern, label] of CAMERA_PATH_PROBES) {
    if (pattern.test(text)) return label;
  }
  for (const axis of axes) {
    if (AXIS_TO_CAMERA_PATH[axis]) return AXIS_TO_CAMERA_PATH[axis];
  }
  return 'unknown';
}

function recommendedChecks(axes) {
  const checks = [];
  const seen = new Set();
  for (const axis of axes) {
    for (const check of (AXIS_RECOMMENDED_CHECKS[axis] || [])) {
      if (seen.has(check)) continue;
      seen.add(check);
      checks.push(check);
    }
  }
  return checks;
}

// Classify a normalized candidate into a conservative HAL-facing impact signal.
function classifyHalImpact(candidate = {}, { sourceQuality = {}, evidence = [] } = {}) {
  const quality = resolveSourceQuality(candidate, sourceQuality);
  const axes = inferHalImpactAxes(candidate).filter(axis => HAL_IMPACT_AXES.includes(axis));
  const bucket = normalizeEnum(candidate.relevance_bucket || candidate.relevanceBucket);
  const evidence_support = evidenceSupport(candidate, quality, evidence);

  return {
    impact_axes: axes,
    hal_confidence: halConfidence(evidence_support, bucket, axes),
    evidence_support,
    camera_path: cameraPath(candidate, axes),
    recommended_checks: recommendedChecks(axes),
    overclaim_risk: overclaimRisk(evidence_support, axes)
  };
}

module.exports = {
  classifyHalImpact
};
