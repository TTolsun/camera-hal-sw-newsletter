const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyHalImpact } = require('../../../reporter/hal-impact-classifier');
const { HAL_IMPACT_AXES } = require('../../../reporter/hal-signal-quality');

const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_EVIDENCE = new Set(['direct', 'inferred', 'weak']);
const VALID_OVERCLAIM = new Set(['low', 'medium', 'high']);
const AXIS_SET = new Set(HAL_IMPACT_AXES);

test('every classification produces schema-valid enum fields and known axes', () => {
  const signal = classifyHalImpact(
    {
      title: 'CameraX 1.6.0 adds feature combination query',
      summary: 'configureStreams capability advertise vs runtime check',
      relevance_bucket: 'direct_aosp_camera',
      has_dated_evidence: true
    },
    { sourceQuality: { source_url_quality: 'official_dated_release' } }
  );
  assert.ok(Array.isArray(signal.impact_axes));
  assert.ok(signal.impact_axes.every(axis => AXIS_SET.has(axis)));
  assert.ok(VALID_CONFIDENCE.has(signal.hal_confidence));
  assert.ok(VALID_EVIDENCE.has(signal.evidence_support));
  assert.ok(VALID_OVERCLAIM.has(signal.overclaim_risk));
  assert.ok(Array.isArray(signal.recommended_checks));
  assert.equal(typeof signal.camera_path, 'string');
});

test('official dated direct-camera source yields direct evidence, high confidence, low overclaim', () => {
  const signal = classifyHalImpact(
    {
      title: 'CameraX 1.6.0 stable: stream combination and metadata contract',
      summary: 'configureStreams and buffer/metadata behavior',
      relevance_bucket: 'direct_aosp_camera',
      has_dated_evidence: true
    },
    { sourceQuality: { source_url_quality: 'official_release_note_anchor' } }
  );
  assert.equal(signal.evidence_support, 'direct');
  assert.equal(signal.hal_confidence, 'high');
  assert.equal(signal.overclaim_risk, 'low');
  assert.ok(signal.impact_axes.includes('framework_hal_contract'));
});

test('weak undated source claiming a driver change is flagged as high overclaim risk and low confidence', () => {
  const signal = classifyHalImpact(
    {
      title: 'Rumor: new ISP driver changes the image pipeline',
      summary: 'sensor and v4l2 driver behavior may change',
      relevance_bucket: 'camera_driver_image_pipeline',
      has_dated_evidence: false
    },
    { sourceQuality: { source_url_quality: 'generic_ai_or_it_trend' } }
  );
  assert.equal(signal.evidence_support, 'weak');
  assert.equal(signal.hal_confidence, 'low');
  assert.equal(signal.overclaim_risk, 'high');
});

test('classifier is conservative on an empty/unknown candidate', () => {
  const signal = classifyHalImpact({}, {});
  assert.notEqual(signal.hal_confidence, 'high');
  assert.equal(signal.evidence_support, 'weak');
  assert.equal(signal.camera_path, 'unknown');
});

test('stream/buffer candidate recommends a stream or metadata check', () => {
  const signal = classifyHalImpact(
    {
      title: 'New stream buffer metadata behavior in camera pipeline',
      summary: 'request/result metadata and surface buffers',
      relevance_bucket: 'android_multimedia_camera_output',
      has_dated_evidence: true
    },
    { sourceQuality: { source_url_quality: 'official_site_update_row' } }
  );
  assert.ok(signal.impact_axes.includes('stream_buffer_metadata'));
  assert.ok(
    signal.recommended_checks.some(check => /stream|metadata|buffer/i.test(check)),
    `expected a stream/metadata/buffer check, got ${JSON.stringify(signal.recommended_checks)}`
  );
});

test('classifier honors the camelCase hasDatedEvidence alias used by reporter candidates', () => {
  const signal = classifyHalImpact(
    {
      title: 'CameraX 1.6.0 stable release',
      relevance_bucket: 'direct_aosp_camera',
      hasDatedEvidence: true
    },
    { sourceQuality: { source_url_quality: 'official_dated_release' } }
  );
  assert.equal(signal.evidence_support, 'direct');
});

test('classifier reads source quality nested on the candidate when no explicit sourceQuality is given', () => {
  const signal = classifyHalImpact({
    title: 'Camera ITS test guidance',
    summary: 'CTS and Camera ITS coverage',
    relevance_bucket: 'direct_aosp_camera',
    has_dated_evidence: true,
    source_quality: { source_url_quality: 'official_documentation_reference' }
  });
  assert.ok(signal.impact_axes.includes('cts_vts_its_cdd'));
  assert.ok(signal.recommended_checks.some(check => /CTS|ITS/i.test(check)));
});
