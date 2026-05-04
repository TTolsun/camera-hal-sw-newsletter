const assert = require('node:assert/strict');
const test = require('node:test');

const {
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
  assert.equal(merged.rejected[0].reason, 'duplicate locked article');
});
