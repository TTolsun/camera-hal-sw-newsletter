const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildHalSignalQualityReport,
  loadHalSignalQualityInputs,
  writeHalSignalQualityArtifacts
} = require('../../diagnostics/hal-signal-quality-report');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hal-signal-quality-'));
}

function section(url, overrides = {}) {
  return {
    category: 'Android Camera',
    fixture_meta: {
      provenance: 'synthetic',
      purpose: 'HAL signal quality report regression fixture',
      must_not_be_used_as_golden_public_artifact: true
    },
    headline: 'CameraX release gives HAL teams a validation target',
    relevance_bucket: 'android_platform_camera_adjacent',
    source_candidate_url: url,
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released on 2026-05-01.'],
      background_context: 'CameraX sits above camera2.',
      hal_driver_impact: 'Validate stream, buffer, metadata, CTS, VTS, and Camera ITS behavior.',
      action_items: [
        'Within 2 weeks, assign a camera owner to run Camera ITS.',
        'Measure preview latency, frame drop, and metadata consistency.'
      ],
      team_share_points: 'Use this as a compatibility validation trigger.'
    },
    hal_signal_capsule: {
      why_now: 'The release gives a dated validation trigger.',
      reader_owners: ['camera_hal_owner', 'camera_test_owner'],
      check_within_2_weeks: 'Run Camera ITS and metadata checks within 2 weeks.',
      impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
      do_not_overstate: ['Do not claim direct HAL API changes.']
    },
    sources: [{ title: 'Source', url }],
    ...overrides
  };
}

function writeRequiredArtifacts(root, date, overrides = {}) {
  const url = 'https://example.com/camerax';
  const editor = {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: 'Summary',
    briefing: ['one', 'two', 'three'],
    sections: [section(url, overrides.section)],
    action_items: ['Run Camera ITS.'],
    references: [{ title: 'Source', url }]
  };
  const shortlist = {
    date,
    selected_articles: [{
      title: editor.sections[0].headline,
      url,
      relevance_bucket: 'android_platform_camera_adjacent',
      finalSelectionEligibility: 'main',
      selected: true,
      hasDatedEvidence: true,
      source_gap_risk: false
    }],
    selection_shortage_hints: ['direct_aosp_camera_count=0; CameraX parser may be missing version/date/anchor evidence.']
  };
  const quality = {
    date,
    status: 'PASS',
    score: 95,
    threshold: 85,
    deductions: [],
    article_results: [{
      index: 1,
      headline: editor.sections[0].headline,
      status: 'PASS',
      scope_count: {
        relevance_bucket: 'android_platform_camera_adjacent',
        publishable_scope: true
      },
      hard_fail_reasons: [],
      soft_deductions: []
    }]
  };
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), editor);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), shortlist);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), quality);
  return { editor, shortlist, quality };
}

function writeOptionalArtifacts(root, date) {
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'source-effectiveness-report.json'), {});
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'source-quality-report.json'), {});
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'evidence-pack-summary.json'), {});
  writeJson(path.join(root, 'articles', 'content', 'collected-news', date, 'merged-candidate-manifest.json'), {});
}

test('HAL signal quality report writes JSON and Markdown with complete inputs', () => {
  const root = tempRoot();
  const date = '2026-05-17';
  writeRequiredArtifacts(root, date);
  writeOptionalArtifacts(root, date);

  const result = writeHalSignalQualityArtifacts({ root, date });
  const report = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
  const markdown = fs.readFileSync(result.markdownPath, 'utf8');

  assert.equal(report.status, 'PASS');
  assert.equal(report.input_completeness, 'complete');
  assert.equal(report.input_statuses.editor_draft, 'loaded');
  assert.equal(report.hal_signal_quality_summary.main_article_count, 1);
  assert.equal(report.hal_signal_quality_summary.article_count_with_hal_signal_capsule, 1);
  assert.equal(report.main_article_signal_checks[0].hal_signal_capsule_complete, true);
  assert.equal(report.gate_boundary.hal_signal_capsule_enforced_by_editor_output_contract, true);
  assert.match(markdown, /HAL Signal Quality Report/);
  assert.match(markdown, /editor output contract \(validateHalSignalCapsules\)/);
  // b4cf2e87에서 hal-signal deduction 생산자가 삭제된 뒤에도 남아 있던 doc-drift 문구 재발 방지
  assert.doesNotMatch(markdown, /publish gate blocks HAL signal hard blockers/);
});

test('HAL signal quality report records missing optional inputs as input_unavailable and not PASS', () => {
  const root = tempRoot();
  const date = '2026-05-17';
  writeRequiredArtifacts(root, date);

  const report = buildHalSignalQualityReport({
    root,
    date,
    inputs: loadHalSignalQualityInputs(root, date)
  });

  assert.equal(report.status, 'WARN');
  assert.equal(report.input_completeness, 'partial');
  assert.equal(report.input_statuses.source_effectiveness_report, 'input_unavailable');
  assert.ok(report.inputs.unavailable_optional.includes('source_effectiveness_report'));
  assert.ok(report.warnings.some(warning => warning.includes('Optional input_unavailable')));
});

test('HAL signal quality report writes INPUT_INCOMPLETE artifacts when required inputs are missing', () => {
  const root = tempRoot();
  const date = '2026-05-17';

  const result = writeHalSignalQualityArtifacts({ root, date });
  const report = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
  const markdown = fs.readFileSync(result.markdownPath, 'utf8');

  assert.equal(report.status, 'INPUT_INCOMPLETE');
  assert.equal(report.input_completeness, 'missing_required');
  assert.equal(report.input_statuses.editor_draft, 'input_unavailable');
  assert.ok(report.inputs.missing_required.includes('editor_draft'));
  assert.match(markdown, /INPUT_INCOMPLETE/);
});

test('HAL signal quality report flags missing capsule as a hard blocker', () => {
  const root = tempRoot();
  const date = '2026-05-17';
  writeRequiredArtifacts(root, date, {
    section: { hal_signal_capsule: undefined }
  });
  writeOptionalArtifacts(root, date);

  const report = buildHalSignalQualityReport({
    root,
    date,
    inputs: loadHalSignalQualityInputs(root, date)
  });

  assert.equal(report.status, 'NEEDS_FIX');
  assert.equal(report.hal_signal_quality_summary.article_count_without_hal_signal_capsule, 1);
  assert.equal(report.main_article_signal_checks[0].hal_signal_capsule_complete, false);
  assert.ok(report.main_article_signal_checks[0].hard_blocker_reason_codes.includes('hal_signal_capsule_missing'));
});
