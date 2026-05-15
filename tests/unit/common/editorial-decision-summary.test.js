const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PIPELINE_STATUS_LABELS,
  buildDecisionGuardrailKo,
  buildDecisionReasonKo,
  classifyEditorialDecision,
  pipelineStatusLabel
} = require('../../../scripts/newsroom/common/editorial-decision-summary');

function candidate(overrides = {}) {
  return {
    title: 'libcamera v0.7.1',
    url: 'https://example.com/libcamera-v0.7.1',
    source: 'libcamera',
    sourceTier: 'high',
    sourceRole: 'official',
    bucket: 'camera_driver_image_pipeline',
    status: 'final_selected',
    sourceGapRisk: false,
    hasDatedEvidence: true,
    selectionReason: 'camera image pipeline release evidence',
    halImpactAxes: ['driver', 'image pipeline'],
    ...overrides
  };
}

function assertDecision(input, expectedDecision, expectedLabel) {
  const classification = classifyEditorialDecision(input);
  assert.equal(classification.decision, expectedDecision);
  assert.equal(classification.label, expectedLabel);
  assert.ok(buildDecisionReasonKo(input, classification));
  assert.ok(buildDecisionGuardrailKo(input, classification));
  return classification;
}

test('editorial decision classifier maps selected direct camera candidates to Main', () => {
  const classification = assertDecision(
    candidate({ bucket: 'camera_driver_image_pipeline', status: 'final_selected' }),
    'Main',
    '메인(Main)'
  );

  assert.equal(classification.pipelineLabel, PIPELINE_STATUS_LABELS.final_selected);
});

test('editorial decision classifier maps selected and reserve supporting candidates', () => {
  assertDecision(
    candidate({
      bucket: 'cpp_ai_tooling_fallback',
      status: 'final_selected',
      selectionReason: 'native C++ tooling fallback for HAL build workflow'
    }),
    'Supporting',
    '보조(Supporting)'
  );

  assertDecision(
    candidate({
      bucket: 'cpp_ai_tooling_fallback',
      status: 'reserve',
      selectionReason: 'watch as short C++ tooling note'
    }),
    'Short',
    '짧은 소식(Short)'
  );
});

test('editorial decision classifier separates source identity from article source URL', () => {
  assertDecision(
    candidate({
      url: '',
      sourceUrl: '',
      sourceId: '',
      candidate_id: 'cand_001',
      candidateId: 'cand_002'
    }),
    'Exclude',
    '제외(Exclude)'
  );

  assertDecision(
    candidate({
      url: '',
      sourceUrl: '',
      sourceId: 'android-developers-latest-updates'
    }),
    'Exclude',
    '제외(Exclude)'
  );

  assertDecision(
    candidate({
      url: '',
      sourceUrl: '',
      sourceId: 'android-developers-latest-updates',
      sourceGapRisk: true,
      selectionReason: 'official CameraX row parser source extraction gap needs parser repair'
    }),
    'Hold',
    '보류(Hold)'
  );
});

test('editorial decision classifier keeps source gaps and generic candidates out of Main', () => {
  assertDecision(
    candidate({
      sourceGapRisk: true,
      selectionReason: 'official camera source parser source extraction gap'
    }),
    'Hold',
    '보류(Hold)'
  );

  assertDecision(
    candidate({
      source: 'Example Tech',
      sourceTier: 'medium',
      sourceRole: '',
      bucket: 'generic_tech_watchlist',
      sourceGapRisk: true,
      selectionReason: 'generic AI noise'
    }),
    'Exclude',
    '제외(Exclude)'
  );
});

test('editorial decision classifier promotes SoC only with explicit camera pipeline evidence', () => {
  assertDecision(
    candidate({
      bucket: 'soc_platform_signal',
      sourceTier: 'medium',
      selectionReason: 'ISP thermal throttling can affect camera image pipeline performance',
      halImpactAxes: ['camera', 'image pipeline', 'thermal', 'resource']
    }),
    'Main',
    '메인(Main)'
  );

  const generic = classifyEditorialDecision(candidate({
    title: 'Generic SoC performance update',
    source: 'SoC Vendor Notes',
    bucket: 'soc_platform_signal',
    sourceTier: 'medium',
    selectionReason: 'General CPU benchmark update',
    halImpactAxes: ['resource']
  }));
  assert.notEqual(generic.decision, 'Main');
  assert.equal(generic.label, '보조(Supporting)');
});

test('pipelineStatusLabel falls back to report-only for unknown status', () => {
  assert.equal(pipelineStatusLabel('merged'), 'merged');
  assert.equal(pipelineStatusLabel('unknown-new-status'), PIPELINE_STATUS_LABELS.unknown);
});
