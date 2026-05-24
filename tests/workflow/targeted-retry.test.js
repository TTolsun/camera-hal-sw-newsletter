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
} = require('../../scripts/gemini-newsroom-newsletter');
const {
  EditorSemanticValidationError
} = require('../../scripts/newsroom/validate/editor-output-contract');
const {
  reserveReporterCandidate: reporterCandidate,
  retrySection: section
} = require('../helpers/newsroom-builders');

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
    title: `Camera HAL / SW Newsletter - ${DATE}`,
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

test('targeted retry demotes or replaces claim evidence integrity failures', () => {
  const failed = section('Claim evidence integrity article', 'https://example.com/claim-integrity');
  const editor = { sections: [failed] };
  const qualityReport = {
    deductions: [{
      category: 'claim-evidence',
      points: 8,
      reason: 'Fact claim is missing item-level evidence_ids.',
      reason_code: 'missing_fact_evidence_ids',
      location: failed.headline
    }]
  };

  const repairPlan = buildSectionRepairPlan(editor, qualityReport, {}, []);

  assert.equal(repairPlan.length, 1);
  assert.equal(repairPlan[0].action, 'replace-or-demote');
  assert.equal(repairPlan[0].failure_type, 'missing_fact_evidence_ids');
  assert.equal(repairPlan[0].allow_rewrite, false);
});

test('targeted retry allows claim wording and impact classification repair only', () => {
  const cases = [
    'direct_hal_claim_without_direct_evidence',
    'do_not_overstate_violation',
    'invalid_impact_level',
    'do_not_claim_violation'
  ];

  for (const reasonCode of cases) {
    const failed = section(`Claim wording ${reasonCode}`, `https://example.com/${reasonCode}`);
    const editor = { sections: [failed] };
    const qualityReport = {
      deductions: [{
        category: 'claim-overclaim',
        points: 8,
        reason: `Claim issue: ${reasonCode}.`,
        reason_code: reasonCode,
        location: failed.headline
      }]
    };

    const repairPlan = buildSectionRepairPlan(editor, qualityReport, {}, []);

    assert.equal(repairPlan.length, 1, reasonCode);
    assert.equal(repairPlan[0].action, 'repair-section', reasonCode);
    assert.equal(repairPlan[0].failure_type, reasonCode);
    assert.equal(repairPlan[0].allow_rewrite, true, reasonCode);
    if (reasonCode === 'do_not_claim_violation') {
      assert.match(repairPlan[0].policy_reason, /without changing evidence ids or source URLs/);
    }
  }
});

test('targeted retry keeps claim integrity failures ahead of repairable claim wording issues', () => {
  const failed = section('Mixed claim issue article', 'https://example.com/mixed-claim');
  const editor = { sections: [failed] };
  const qualityReport = {
    deductions: [
      {
        category: 'claim-overclaim',
        points: 8,
        reason: 'Claim overstates a HAL impact.',
        reason_code: 'do_not_overstate_violation',
        location: failed.headline
      },
      {
        category: 'claim-source-binding',
        points: 8,
        reason: 'Claim references unresolved evidence_id.',
        reason_code: 'unknown_evidence_id',
        location: failed.headline
      }
    ]
  };

  const repairPlan = buildSectionRepairPlan(editor, qualityReport, {}, []);

  assert.equal(repairPlan.length, 1);
  assert.equal(repairPlan[0].action, 'replace-or-demote');
  assert.equal(repairPlan[0].failure_type, 'unknown_evidence_id');
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

test('targeted repair allows metadata repair when article identity stays fixed', () => {
  const a = policySection('CameraX release', 'https://example.com/a');
  const b = policySection('Driver pipeline update', 'https://example.com/b', 'camera_driver_image_pipeline');
  const c = policySection('Android platform update', 'https://example.com/c', 'android_platform_camera_adjacent');
  const repairedB = policySection('Driver pipeline update', 'https://example.com/b', 'camera_driver_image_pipeline', {
    source_candidate_hash: b.source_candidate_hash,
    effective_actionability_level: 'concrete_check',
    hal_signal_capsule: {
      ...b.hal_signal_capsule,
      do_not_overstate: ['Do not overstate direct HAL behavior.']
    }
  });

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

test('targeted repair rejects same-count article identity drift', () => {
  const a = policySection('CameraX release', 'https://example.com/a');
  const b = policySection('Driver pipeline update', 'https://example.com/b', 'camera_driver_image_pipeline');
  const c = policySection('Android platform update', 'https://example.com/c', 'android_platform_camera_adjacent');
  const driftedB = policySection('Driver pipeline update', 'https://example.com/b-new', 'camera_driver_image_pipeline', {
    source_candidate_hash: 'new-driver-hash'
  });

  assert.throws(
    () => validateTargetedRepairResult({
      beforeSections: [a, b, c],
      repairSections: [driftedB],
      afterSections: [a, driftedB, c],
      lockedSections: [a, c],
      mode: 'targeted-repair',
      allowCountChange: false,
      date: DATE
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.reason, 'section_identity_drift');
      return true;
    }
  );
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
  ].map((item, index) => ({
    ...item,
    evidence_summary: item.confirmed_facts[0],
    claims: [{
      claim_id: `claim-${index + 1}`,
      text: item.confirmed_facts[0],
      claim_type: 'fact',
      evidence_ids: [`primary-${index + 1}`],
      source_urls: [item.sources[0].url],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }]
  }));
  const validEditor = editorWithSections(sections);
  const reporter = {
    candidates: sections.map((item, index) => reporterCandidate({
      title: item.headline,
      url: item.sources[0].url,
      source_candidate_hash: item.source_candidate_hash,
      final_selected: true,
      selected_for_editor: true,
      reserve_candidate: false,
      relevance_bucket: item.relevance_bucket,
      primary_evidence_ids: [`primary-${index + 1}`],
      compact_evidence: {
        primary_facts: [item.confirmed_facts[0]],
        evidence_urls: [item.sources[0].url]
      }
    }))
  };
  const factCheck = { status: 'PASS', must_fix: [], recommended_fixes: [], source_gaps: [], source_gap_count: 0 };
  const qualityReport = { status: 'NEEDS_FIX', score: 79, threshold: 85, deductions: [] };
  recordLastKnownValidEditor(validEditor, { date: DATE, reporter, factCheck, qualityReport, attempt: 1 });
  const invalidTwoSectionEditor = editorWithSections(sections.slice(0, 2));
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.writeFileSync(
    path.join(newsroomDir, 'editor-invalid-attempt-2.json'),
    `${JSON.stringify(invalidTwoSectionEditor, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(newsroomDir, 'editor-validation-error-attempt-2.json'),
    `${JSON.stringify({
      name: 'EditorSemanticValidationError',
      message: 'Editor output must contain 3-5 sections; got 2.',
      details: {
        field: 'sections',
        sectionCount: 2
      }
    }, null, 2)}\n`,
    'utf8'
  );

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
  const invalidDiagnostic = readJson(path.join(newsroomDir, 'editor-invalid-attempt-2.json'));
  const repairFailure = readJson(path.join(newsroomDir, 'repair-failure.json'));
  const status = readJson(path.join(root, '.tmp', 'newsletter-generation-status.json'));
  const canonicalStatus = readJson(path.join(newsroomDir, 'generation-status.json'));
  for (const fileName of [
    'editor-draft.json',
    'quality-report.json',
    'fact-check-report.json',
    'repair-failure.json',
    'generation-status.json'
  ]) {
    assert.equal(fs.existsSync(path.join(newsroomDir, fileName)), true, `${fileName} should exist`);
  }
  assert.equal(invalidDiagnostic.sections.length, 2);
  assert.deepEqual(fallbackEditor.sections.map(item => item.sources[0].url), sections.map(item => item.sources[0].url));
  assert.equal(fallbackEditor.sections.length, 3);
  assert.equal(repairFailure.details.sectionCount, 2);
  assert.equal(status.status, STATUS_FAILED_REPAIR_REVIEWABLE);
  assert.equal(canonicalStatus.status, status.status);
  assert.equal(canonicalStatus.publish_ready, status.publish_ready);
  assert.equal(canonicalStatus.selection_publish_ready, status.selection_publish_ready);
  assert.equal(canonicalStatus.final_publish_ready, status.final_publish_ready);
  assert.equal(canonicalStatus.publish_gate_passed, status.publish_gate_passed);
  assert.equal(canonicalStatus.composition_mode, status.composition_mode);
  assert.ok(canonicalStatus.run_context);
  assert.equal(typeof canonicalStatus.run_context.github_run_id, 'string');
  assert.equal(typeof canonicalStatus.run_context.github_sha, 'string');
  assert.equal(typeof canonicalStatus.run_context.github_ref, 'string');
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

test('supporting-only final draft passes targeted validation under one-article policy', () => {
  const sections = [
    policySection('SoC thermal update', 'https://example.com/soc-1', 'soc_platform_signal')
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
