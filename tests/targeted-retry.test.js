const assert = require('node:assert/strict');
const test = require('node:test');

const {
  availableCompletionCandidates,
  buildSectionRepairPlan,
  mergeLockedSections,
  sectionsMatchingRepairPlan,
  sectionsOutsideRepairPlan
} = require('../scripts/gemini-newsroom-newsletter');

function section(headline, url) {
  return {
    category: headline,
    headline,
    sources: [{ title: headline, url }]
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

function reporterCandidate(overrides = {}) {
  return {
    title: overrides.title || 'Camera HAL reserve candidate',
    url: overrides.url || 'https://example.com/reserve',
    source: overrides.source || 'Example Source',
    published_date: overrides.published_date || '2026-05-05',
    finalSelectionEligibility: 'main',
    isWatchPage: false,
    hasDatedEvidence: true,
    main_eligible: true,
    source_gap_risk: false,
    evidence_score: 6,
    camera_hal_relevance_score: 4,
    android_camera_relevance_score: 3,
    practical_actionability_score: 3,
    relevance_bucket: 'direct_aosp_camera',
    editorial_priority: 1,
    deterministic_score: 90,
    final_selected: false,
    selected_for_editor: false,
    reserve_candidate: true,
    ...overrides
  };
}

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
