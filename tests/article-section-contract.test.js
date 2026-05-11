const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ARTICLE_SECTION_KEYS,
  articleSectionSummary,
  normalizeArticleSections
} = require('../scripts/newsroom/common/article-section-contract');

test('normalizeArticleSections returns strict normalized output from article_sections', () => {
  const result = normalizeArticleSections({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.'
    }
  });

  assert.deepEqual(ARTICLE_SECTION_KEYS, [
    'verified_facts',
    'background_context',
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ]);
  assert.deepEqual(result.verified_facts, ['CameraX 1.5.0 was released.']);
  assert.equal(result.background_context, 'CameraX sits above Camera2.');
  assert.equal(result.hal_driver_impact, 'Check stream and metadata compatibility.');
  assert.deepEqual(result.action_items, ['Run Camera ITS preview tests.']);
  assert.equal(result.team_share_points, 'Use this release as a validation trigger.');
  assert.equal(result.diagnostics.complete, true);
  assert.deepEqual(result.diagnostics.missing_keys, []);
});

test('normalizeArticleSections falls back to legacy fields and records fallback diagnostics', () => {
  const result = normalizeArticleSections({
    what_changed: 'CameraX changed app-facing compatibility behavior.',
    background: 'CameraX is a Camera2 wrapper layer.',
    camera_hal_perspective: 'Validate stream combinations and request metadata.',
    action_hints: ['Inspect preview latency logs.'],
    why_it_matters: 'This can become a team compatibility watch item.'
  });

  assert.deepEqual(result.verified_facts, ['CameraX changed app-facing compatibility behavior.']);
  assert.equal(result.background_context, 'CameraX is a Camera2 wrapper layer.');
  assert.equal(result.hal_driver_impact, 'Validate stream combinations and request metadata.');
  assert.deepEqual(result.action_items, ['Inspect preview latency logs.']);
  assert.equal(result.team_share_points, 'This can become a team compatibility watch item.');
  assert.ok(result.diagnostics.fallbacks_used.includes('team_share_points_from_why_it_matters'));
  assert.ok(result.diagnostics.warnings.includes('team_share_points uses legacy why_it_matters fallback'));
});

test('article_sections missing keys are reported while output stays strict', () => {
  const result = normalizeArticleSections({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.'
    },
    camera_hal_perspective: 'Validate stream combinations and request metadata.',
    action_items: ['Run Camera ITS.'],
    team_summary: 'Share as validation input.'
  });

  assert.deepEqual(result.diagnostics.missing_article_section_keys, [
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ]);
  assert.equal(result.hal_driver_impact, 'Validate stream combinations and request metadata.');
  assert.deepEqual(result.action_items, ['Run Camera ITS.']);
  assert.equal(result.team_share_points, 'Share as validation input.');
  assert.equal(result.diagnostics.complete, true);
});

test('deterministic conflict detection records article_sections and legacy mismatch', () => {
  const summary = articleSectionSummary({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check CameraX compatibility only.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.'
    },
    confirmed_facts: ['CameraX 1.5.0 was released.'],
    background: 'CameraX sits above Camera2.',
    camera_hal_perspective: 'This is a direct HAL API contract change.',
    action_items: ['Run Camera ITS preview tests.'],
    team_summary: 'Use this release as a validation trigger.'
  });

  assert.equal(summary.complete, true);
  assert.deepEqual(summary.conflicts, [{
    key: 'hal_driver_impact',
    legacy_field: 'camera_hal_perspective'
  }]);
});
