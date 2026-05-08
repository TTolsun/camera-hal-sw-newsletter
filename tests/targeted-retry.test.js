const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  STATUS_FAILED_REPAIR_REVIEWABLE,
  assertEditorRetryOutputContract,
  availableCompletionCandidates,
  buildEditorRetryContract,
  buildSectionRepairPlan,
  mergeLockedSections,
  recordLastKnownValidEditor,
  sectionsMatchingRepairPlan,
  sectionsOutsideRepairPlan,
  validateTargetedRepairResult,
  writeReviewableRepairFailureArtifacts
} = require('../scripts/gemini-newsroom-newsletter');
const {
  EditorSemanticValidationError
} = require('../scripts/newsroom/validate/editor-output-contract');
const {
  reserveReporterCandidate: reporterCandidate,
  retrySection: section
} = require('./helpers/newsroom-builders');

const DATE = '2026-05-08';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'targeted-retry-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function policySection(headline, url, bucket = 'direct_aosp_camera', overrides = {}) {
  const primaryBuckets = new Set([
    'direct_aosp_camera',
    'camera_driver_image_pipeline',
    'android_platform_camera_adjacent'
  ]);
  return {
    ...section(headline, url),
    relevance_bucket: bucket,
    counts_as_primary_camera_topic: primaryBuckets.has(bucket),
    source_candidate_hash: overrides.source_candidate_hash || `${headline.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-hash`,
    ...overrides
  };
}

function editorWithSections(sections) {
  return {
    date: DATE,
    title: `Camera HAL SW 뉴스레터 - ${DATE}`,
    summary: 'Summary',
    briefing: ['one', 'two', 'three'],
    sections,
    action_items: [],
    references: []
  };
}

test('targeted retry keeps passed sections unchanged and regenerates failed sections only', () => {
  const passed = section('CameraX compatibility release', 'https://example.com/camerax');
  const failed = section('Weak HAL perspective article', 'https://example.com/weak');
  const replacement = section('Repaired HAL perspective article', 'https://example.com/repaired');
  const editor = { sections: [passed, failed] };
  const qualityReport = {
    deductions: [{
      category: 'hal-depth',
      points: 4,
      reason: 'Article lacks concrete Camera HAL engineering depth.',
      location: failed.headline
    }]
  };

  const repairPlan = buildSectionRepairPlan(editor, qualityReport, {}, []);
  const failedSections = sectionsMatchingRepairPlan(editor.sections, repairPlan);
  const lockedSections = sectionsOutsideRepairPlan(editor.sections, repairPlan);
  const merged = mergeLockedSections(lockedSections, [replacement]);

  assert.deepEqual(failedSections.map(item => item.headline), [failed.headline]);
  assert.equal(repairPlan[0].action, 'replace-section');
  assert.equal(repairPlan[0].failure_type, 'weak-hal-relevance');
  assert.equal(repairPlan[0].allow_rewrite, false);
  assert.deepEqual(lockedSections, [passed]);
  assert.deepEqual(merged.sections, [passed, replacement]);
  assert.equal(merged.sections[0], passed);
});

test('targeted retry repairs missing actionability with the same source', () => {
  const failed = section('Missing actionability article', 'https://example.com/action');
  const editor = { sections: [failed] };
  const qualityReport = {
    deductions: [{
      category: 'actionability',
      points: 4,
      reason: 'Article action item is not concrete enough for a HAL engineering team.',
      location: failed.headline
    }]
  };

  const repairPlan = buildSectionRepairPlan(editor, qualityReport, {}, []);

  assert.equal(repairPlan.length, 1);
  assert.equal(repairPlan[0].action, 'repair-section');
  assert.equal(repairPlan[0].failure_type, 'missing-actionability');
  assert.equal(repairPlan[0].allow_rewrite, true);
});

test('targeted retry demotes or replaces source gaps instead of rewriting them', () => {
  const failed = section('Source gap article', 'https://example.com/gap');
  const editor = { sections: [failed] };
  const factCheck = {
    source_gaps: ['Source gap article has a source gap and no dated release evidence.'],
    source_gap_count: 1
  };

  const repairPlan = buildSectionRepairPlan(editor, { deductions: [] }, factCheck, []);

  assert.equal(repairPlan.length, 1);
  assert.equal(repairPlan[0].action, 'replace-or-demote');
  assert.equal(repairPlan[0].failure_type, 'source-gap');
  assert.equal(repairPlan[0].allow_rewrite, false);
});

test('targeted retry demotes or replaces structured scope failures', () => {
  const failed = section('Generic watchlist article with camera wording', 'https://example.com/generic');
  const editor = { sections: [failed] };
  const qualityReport = {
    deductions: [{
      category: 'scope-relevance',
      points: 8,
      reason: 'Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.',
      location: failed.headline
    }],
    article_results: [{
      headline: failed.headline,
      status: 'DEMOTE',
      repair_action: 'demote-or-replace',
      sources: failed.sources
    }]
  };

  const repairPlan = buildSectionRepairPlan(editor, qualityReport, {}, []);

  assert.equal(repairPlan.length, 1);
  assert.equal(repairPlan[0].action, 'replace-or-demote');
  assert.equal(repairPlan[0].failure_type, 'scope-demotion');
  assert.equal(repairPlan[0].allow_rewrite, false);
});

test('targeted retry consumes article result demotion even without deductions', () => {
  const failed = section('Scope demoted article result only', 'https://example.com/result-only');
  const editor = { sections: [failed] };
  const qualityReport = {
    deductions: [],
    article_results: [{
      headline: failed.headline,
      status: 'DEMOTE',
      repair_action: 'demote-or-replace',
      sources: failed.sources
    }]
  };

  const repairPlan = buildSectionRepairPlan(editor, qualityReport, {}, []);

  assert.equal(repairPlan.length, 1);
  assert.equal(repairPlan[0].action, 'replace-or-demote');
  assert.equal(repairPlan[0].failure_type, 'scope-demotion');
  assert.equal(repairPlan[0].allow_rewrite, false);
});

test('targeted retry limits section repair count and prioritizes source gaps', () => {
  const gap = section('Source gap article', 'https://example.com/gap');
  const action = section('Actionability article', 'https://example.com/action');
  const editor = { sections: [action, gap] };
  const qualityReport = {
    deductions: [{
      category: 'actionability',
      points: 4,
      reason: 'Article action item is not concrete enough for a HAL engineering team.',
      location: action.headline
    }]
  };
  const factCheck = {
    source_gaps: ['Source gap article has a source gap and no dated release evidence.'],
    source_gap_count: 1
  };

  const repairPlan = buildSectionRepairPlan(editor, qualityReport, factCheck, [], { maxSectionRepairs: 1 });

  assert.equal(repairPlan.length, 1);
  assert.equal(repairPlan[0].headline, gap.headline);
  assert.equal(repairPlan[0].action, 'replace-or-demote');
});

test('targeted retry rejects regenerated sections that duplicate locked URLs', () => {
  const locked = section('CameraX compatibility release', 'https://example.com/camerax');
  const duplicate = section('Duplicate CameraX release', 'https://example.com/camerax');

  const merged = mergeLockedSections([locked], [duplicate]);

  assert.deepEqual(merged.sections, [locked]);
  assert.equal(merged.rejected.length, 1);
  assert.equal(merged.rejected[0].reason, 'duplicate_locked_url');
});

test('completion pool uses reserve candidates and records duplicate/source-gap rejections', () => {
  const locked = section('CameraX locked article', 'https://example.com/locked');
  const demoted = section('Android 17 Beta 4 unsupported claim', 'https://example.com/demoted');
  const rejections = [];
  const reporter = {
    candidates: [
      reporterCandidate({
        title: 'CameraX locked article duplicate',
        url: 'https://example.com/locked',
        final_selected: true,
        selected_for_editor: true
      }),
      reporterCandidate({
        title: 'Android 17 Beta 4 unsupported claim',
        url: 'https://example.com/demoted',
        final_selected: true,
        selected_for_editor: true
      }),
      reporterCandidate({
        title: 'Rolling source gap candidate',
        url: 'https://example.com/gap',
        source_gap_risk: true
      }),
      reporterCandidate({
        title: 'Snapdragon ISP thermal performance update',
        url: 'https://example.com/soc',
        relevance_bucket: 'soc_platform_signal',
        editorial_priority: 4,
        deterministic_score: 70
      })
    ]
  };

  const available = availableCompletionCandidates(reporter, [locked], [demoted], rejections, {
    allowReserve: true
  });

  assert.deepEqual(available.map(candidate => candidate.url), ['https://example.com/soc']);
  assert.ok(rejections.some(item => item.reason === 'duplicate_locked_url'));
  assert.ok(rejections.some(item => item.reason === 'duplicate_demoted_url'));
  assert.ok(rejections.some(item => item.reason === 'source_gap_candidate'));
});

test('completion pool keeps reserve candidates closed until replacement is allowed', () => {
  const rejections = [];
  const reporter = {
    candidates: [
      reporterCandidate({
        title: 'Primary CameraX update',
        url: 'https://example.com/primary',
        final_selected: true,
        selected_for_editor: true,
        reserve_candidate: false,
        deterministic_score: 80
      }),
      reporterCandidate({
        title: 'Reserve SoC thermal update',
        url: 'https://example.com/reserve-soc',
        relevance_bucket: 'soc_platform_signal',
        editorial_priority: 4,
        deterministic_score: 70
      })
    ]
  };

  const available = availableCompletionCandidates(reporter, [], [], rejections);

  assert.deepEqual(available.map(candidate => candidate.url), ['https://example.com/primary']);
  assert.equal(rejections.length, 0);
});

test('targeted repair rejects output that shrinks 3 sections to 2', () => {
  const before = [
    policySection('CameraX release', 'https://example.com/camerax'),
    policySection('Driver pipeline update', 'https://example.com/driver', 'camera_driver_image_pipeline'),
    policySection('Android platform camera update', 'https://example.com/platform', 'android_platform_camera_adjacent')
  ];
  const after = before.slice(0, 2);

  assert.throws(
    () => validateTargetedRepairResult({
      beforeSections: before,
      repairSections: [],
      afterSections: after,
      lockedSections: after,
      mode: 'targeted-repair',
      allowCountChange: false,
      date: DATE
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.reason, 'section_count_drift');
      assert.equal(error.details.expectedCount, 3);
      assert.equal(error.details.actualCount, 2);
      return true;
    }
  );
});

test('targeted repair rejects locked section source URL drift', () => {
  const locked = policySection('CameraX release', 'https://example.com/camerax', 'direct_aosp_camera', {
    source_candidate_hash: 'locked-hash'
  });
  const drifted = policySection('CameraX release', 'https://example.com/changed', 'direct_aosp_camera', {
    source_candidate_hash: 'changed-hash'
  });
  const other = policySection('Driver pipeline update', 'https://example.com/driver', 'camera_driver_image_pipeline');
  const before = [locked, other, policySection('Android platform update', 'https://example.com/platform', 'android_platform_camera_adjacent')];

  assert.throws(
    () => validateTargetedRepairResult({
      beforeSections: before,
      repairSections: [drifted],
      afterSections: [locked, other, drifted],
      lockedSections: [locked, other],
      mode: 'targeted-repair',
      allowCountChange: false,
      date: DATE
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.reason, 'locked_section_source_drift');
      assert.equal(error.details.expected.source_candidate_hash, 'locked-hash');
      assert.equal(error.details.actual.source_candidate_hash, 'changed-hash');
      return true;
    }
  );
});

test('targeted repair preserves locked sections around a middle replacement', () => {
  const a = policySection('CameraX release', 'https://example.com/a');
  const b = policySection('Driver pipeline update', 'https://example.com/b', 'camera_driver_image_pipeline');
  const c = policySection('Android platform update', 'https://example.com/c', 'android_platform_camera_adjacent');
  const repairedB = policySection('Repaired driver pipeline update', 'https://example.com/b-repaired', 'camera_driver_image_pipeline');

  assert.equal(validateTargetedRepairResult({
    beforeSections: [a, b, c],
    repairSections: [repairedB],
    afterSections: [a, repairedB, c],
    lockedSections: [a, c],
    mode: 'targeted-repair',
    allowCountChange: false,
    date: DATE
  }), true);
});

test('editor retry contract uses previous valid draft as the target section count', () => {
  const locked = [
    policySection('CameraX release', 'https://example.com/a'),
    policySection('Driver pipeline update', 'https://example.com/b', 'camera_driver_image_pipeline')
  ];
  const previousValidEditor = editorWithSections([
    ...locked,
    policySection('Android platform update', 'https://example.com/c', 'android_platform_camera_adjacent')
  ]);

  const contract = buildEditorRetryContract({
    lastKnownValidEditor: previousValidEditor,
    currentEditor: editorWithSections(locked),
    lockedSections: locked
  });

  assert.equal(contract.target_section_count, 3);
  assert.equal(contract.locked_section_count, 2);
  assert.equal(contract.replacement_required_count, 1);
});

test('editor retry contract rejects locked-only output and section count drift', () => {
  const locked = [
    policySection('CameraX release', 'https://example.com/a'),
    policySection('Driver pipeline update', 'https://example.com/b', 'camera_driver_image_pipeline')
  ];
  const replacement = policySection('Android platform update', 'https://example.com/c', 'android_platform_camera_adjacent');
  const contract = buildEditorRetryContract({
    lastKnownValidEditor: editorWithSections([...locked, replacement]),
    lockedSections: locked
  });

  assert.throws(
    () => assertEditorRetryOutputContract(editorWithSections(locked), contract),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.reason, 'locked_only_retry_output');
      assert.equal(error.details.target_section_count, 3);
      assert.equal(error.details.locked_section_count, 2);
      assert.equal(error.details.replacement_required_count, 1);
      return true;
    }
  );

  assert.throws(
    () => assertEditorRetryOutputContract(editorWithSections([locked[0], replacement]), contract),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.reason, 'editor_retry_section_count_drift');
      assert.equal(error.details.expectedCount, 3);
      assert.equal(error.details.actualCount, 2);
      return true;
    }
  );
});

test('targeted repair rejects reordered locked sections around a middle replacement', () => {
  const a = policySection('CameraX release', 'https://example.com/a');
  const b = policySection('Driver pipeline update', 'https://example.com/b', 'camera_driver_image_pipeline');
  const c = policySection('Android platform update', 'https://example.com/c', 'android_platform_camera_adjacent');
  const repairedB = policySection('Repaired driver pipeline update', 'https://example.com/b-repaired', 'camera_driver_image_pipeline');

  for (const afterSections of [
    [c, repairedB, a],
    [a, c, repairedB]
  ]) {
    assert.throws(
      () => validateTargetedRepairResult({
        beforeSections: [a, b, c],
        repairSections: [repairedB],
        afterSections,
        lockedSections: [a, c],
        mode: 'targeted-repair',
        allowCountChange: false,
        date: DATE
      }),
      error => {
        assert.ok(error instanceof EditorSemanticValidationError);
        assert.equal(error.details.reason, 'locked_section_order_or_source_drift');
        return true;
      }
    );
  }
});

test('invalid repair output writes reviewable fallback without replacing last valid editor draft', () => {
  const root = tempRoot();
  const newsroomDir = path.join(root, 'content', 'newsroom', DATE);
  const sections = [
    policySection('CameraX release', 'https://example.com/camerax'),
    policySection('Driver pipeline update', 'https://example.com/driver', 'camera_driver_image_pipeline'),
    policySection('Android platform update', 'https://example.com/platform', 'android_platform_camera_adjacent')
  ];
  const validEditor = editorWithSections(sections);
  const reporter = { candidates: [] };
  const factCheck = { status: 'PASS', must_fix: [], recommended_fixes: [], source_gaps: [], source_gap_count: 0 };
  const qualityReport = { status: 'NEEDS_FIX', score: 79, threshold: 85, deductions: [] };
  recordLastKnownValidEditor(validEditor, { date: DATE, reporter, factCheck, qualityReport, attempt: 1 });

  writeReviewableRepairFailureArtifacts({
    date: DATE,
    newsroomDir,
    rootDir: root,
    error: new EditorSemanticValidationError('Targeted repair changed main article count outside completion/replacement mode.', {
      field: 'sections',
      reason: 'section_count_drift',
      expectedCount: 3,
      actualCount: 2,
      sectionCount: 2
    }),
    reporter,
    factCheck,
    qualityReport,
    retryHistory: [],
    shortlistReport: {
      selected_article_count: 3,
      composition_summary: {
        selected_article_count: 3,
        primary_camera_stack_topic_count: 1,
        supporting_main_article_count: 2,
        forbidden_main_article_count: 0
      }
    },
    attempt: 1,
    stage: 'editor repair attempt 1/2'
  });

  const fallbackEditor = readJson(path.join(newsroomDir, 'editor-draft.json'));
  const repairFailure = readJson(path.join(newsroomDir, 'repair-failure.json'));
  const status = readJson(path.join(root, '.tmp', 'newsletter-generation-status.json'));
  assert.deepEqual(fallbackEditor.sections.map(item => item.sources[0].url), sections.map(item => item.sources[0].url));
  assert.equal(fallbackEditor.sections.length, 3);
  assert.equal(repairFailure.details.sectionCount, 2);
  assert.equal(status.status, STATUS_FAILED_REPAIR_REVIEWABLE);
  assert.equal(status.publish_ready, false);
  assert.equal(status.selection_publish_ready, false);
  assert.equal(status.final_publish_ready, false);
  assert.equal(status.publish_gate_passed, false);
  assert.equal(status.editor_review_required, true);
  assert.equal(status.composition_mode, 'NEEDS_FIX');
});

test('3-section final draft with a Primary Camera Stack article passes targeted validation', () => {
  const sections = [
    policySection('CameraX release', 'https://example.com/camerax'),
    policySection('SoC thermal update', 'https://example.com/soc', 'soc_platform_signal'),
    policySection('C++ tooling update', 'https://example.com/cpp', 'cpp_ai_tooling_fallback')
  ];

  assert.equal(validateTargetedRepairResult({
    beforeSections: sections,
    repairSections: [],
    afterSections: sections,
    lockedSections: sections,
    mode: 'targeted-repair',
    allowCountChange: false,
    date: DATE
  }), true);
});

test('3-section final draft with no Primary Camera Stack article fails targeted validation', () => {
  const sections = [
    policySection('SoC thermal update', 'https://example.com/soc-1', 'soc_platform_signal'),
    policySection('C++ tooling update', 'https://example.com/cpp', 'cpp_ai_tooling_fallback'),
    policySection('SoC power update', 'https://example.com/soc-2', 'soc_platform_signal')
  ];

  assert.throws(
    () => validateTargetedRepairResult({
      beforeSections: sections,
      repairSections: [],
      afterSections: sections,
      lockedSections: sections,
      mode: 'targeted-repair',
      allowCountChange: false,
      date: DATE
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.relevance_bucket');
      assert.equal(error.details.actualCount, 0);
      return true;
    }
  );
});
