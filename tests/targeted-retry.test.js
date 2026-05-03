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
  assert.deepEqual(lockedSections, [passed]);
  assert.deepEqual(merged.sections, [passed, replacement]);
  assert.equal(merged.sections[0], passed);
});

test('targeted retry rejects regenerated sections that duplicate locked URLs', () => {
  const locked = section('CameraX compatibility release', 'https://example.com/camerax');
  const duplicate = section('Duplicate CameraX release', 'https://example.com/camerax');

  const merged = mergeLockedSections([locked], [duplicate]);

  assert.deepEqual(merged.sections, [locked]);
  assert.equal(merged.rejected.length, 1);
  assert.equal(merged.rejected[0].reason, 'duplicate locked article');
});
