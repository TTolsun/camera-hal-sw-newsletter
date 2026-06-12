const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ARTICLE_STRUCTURE_CONTRACT_ROW_FIELDS,
  articleSectionContractRow,
  articleSectionContractRows,
  articleSectionContractRowValues
} = require('../../scripts/newsroom/common/article-structure-summary');

function completeSection(overrides = {}) {
  return {
    headline: 'CameraX release gives HAL teams a target',
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.'
    },
    hal_impact_axes: ['framework_hal_contract'],
    hal_signal_capsule: {
      impact_axes: ['stream_buffer_metadata']
    },
    actionability_level: 'generic_review',
    effective_actionability_level: 'owner_metric_log',
    ...overrides
  };
}

test('articleSectionContractRow reports complete five-section rows', () => {
  const row = articleSectionContractRow(completeSection(), { index: 0 });

  assert.equal(row.index, 1);
  assert.equal(row.article, 'CameraX release gives HAL teams a target');
  assert.equal(row.five_section, 'pass');
  assert.equal(row.fact_boundary, 'present');
  assert.equal(row.hal_impact_axis, 'framework_hal_contract');
  assert.equal(row.actionability, 'owner_metric_log');
  assert.equal(row.limitations, 'none');
});

test('articleSectionContractRow uses structure-only fact boundary states', () => {
  const missingFacts = completeSection({
    article_sections: {
      ...completeSection().article_sections,
      verified_facts: []
    }
  });
  const guarded = completeSection({
    article_sections: {
      ...completeSection().article_sections,
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  });
  const watchOnly = completeSection({
    article_sections: {
      ...completeSection().article_sections,
      watch_items: ['Track CameraX SessionConfig regressions.']
    }
  });

  assert.equal(articleSectionContractRow(missingFacts, { index: 0 }).fact_boundary, 'missing');
  assert.equal(articleSectionContractRow(guarded, { index: 0 }).fact_boundary, 'present+guarded');
  assert.equal(articleSectionContractRow(guarded, { index: 0 }).limitations, 'guardrail-only');
  assert.equal(articleSectionContractRow(watchOnly, { index: 0 }).fact_boundary, 'present');
  assert.equal(articleSectionContractRow(watchOnly, { index: 0 }).limitations, 'present');
});

test('articleSectionContractRow reports public limitation visibility', () => {
  const row = articleSectionContractRow(completeSection({
    article_sections: {
      ...completeSection().article_sections,
      known_limitations: ['No direct HAL contract change is stated.']
    }
  }), { index: 0 });

  assert.equal(row.limitations, 'public-limitation');
});

test('articleSectionContractRow resolves HAL axis and actionability precedence', () => {
  const primaryAxis = articleSectionContractRow(completeSection({
    hal_impact_axes: ['primary_axis'],
    hal_signal_capsule: { impact_axes: ['capsule_axis'] }
  }), { index: 0 });
  const capsuleAxis = articleSectionContractRow(completeSection({
    hal_impact_axes: [],
    hal_signal_capsule: { impact_axes: ['capsule_axis'] }
  }), { index: 0 });
  const actionability = articleSectionContractRow(completeSection({
    actionability_level: 'generic_review',
    effective_actionability_level: 'owner_metric_log'
  }), { index: 0 });

  assert.equal(primaryAxis.hal_impact_axis, 'primary_axis');
  assert.equal(capsuleAxis.hal_impact_axis, 'capsule_axis');
  assert.equal(actionability.actionability, 'owner_metric_log');
});

test('articleSectionContractRows matches article results by index without fuzzy matching', () => {
  const rows = articleSectionContractRows([completeSection({ headline: 'Section headline' })], {
    articleResults: [{
      index: 10,
      headline: 'Article result headline',
      section_contract: {
        complete: true,
        missing_keys: [],
        missing_required_keys: [],
        present_optional_keys: [],
        unexpected_keys: [],
        has_limitations: false,
        has_watch_items: false,
        has_do_not_claim: false,
        limitation_visibility: 'none'
      }
    }]
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].index, 1);
  assert.equal(rows[0].article, 'Section headline');
});

test('articleSectionContractRows can render report-only rows without sections', () => {
  const rows = articleSectionContractRows([], {
    articleResults: [{
      index: 3,
      headline: 'Report headline',
      hal_impact_axes: ['report_axis'],
      effective_actionability_level: 'measurable_test',
      section_contract: {
        complete: true,
        missing_keys: [],
        missing_required_keys: [],
        present_optional_keys: [],
        unexpected_keys: [],
        has_limitations: false,
        has_watch_items: false,
        has_do_not_claim: false,
        limitation_visibility: 'none'
      }
    }]
  });

  assert.equal(rows[0].index, 3);
  assert.equal(rows[0].article, 'Report headline');
  assert.equal(rows[0].hal_impact_axis, 'report_axis');
  assert.equal(rows[0].actionability, 'measurable_test');
});

test('articleSectionContractRowValues follows ARTICLE_STRUCTURE_CONTRACT_ROW_FIELDS order', () => {
  const row = articleSectionContractRow(completeSection(), { index: 0 });

  assert.deepEqual(ARTICLE_STRUCTURE_CONTRACT_ROW_FIELDS, [
    'index',
    'article',
    'five_section',
    'fact_boundary',
    'hal_impact_axis',
    'actionability',
    'limitations'
  ]);
  assert.deepEqual(articleSectionContractRowValues(row), [
    1,
    'CameraX release gives HAL teams a target',
    'pass',
    'present',
    'framework_hal_contract',
    'owner_metric_log',
    'none'
  ]);
});
