'use strict';

const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const {
  EditorSemanticValidationError,
  repairEditorOutputContract,
  validateEditorOutputContract
} = require('../../scripts/newsroom/validate/editor-output-contract');
const {
  section,
  editor,
  normalizeSection,
  tempNewsroomDir,
  readJson
} = require('../helpers/editor-builders');

const DATE = '2026-05-08';

test('semantic repair deterministically restores missing article_sections from section fields', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({
    sections: [
      section(1, { article_sections: undefined }),
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed for deterministic article_sections repair.');
    }
  });

  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].article_sections, {
    verified_facts: ['Fact 1'],
    background_context: 'Background 1 Why 1 Evidence 1',
    hal_driver_impact: 'HAL perspective 1',
    action_items: ['Action 1'],
    team_share_points: 'Summary 1',
    do_not_claim: ['Do not overstate direct HAL impact.']
  });
  assert.equal(require('fs').existsSync(path.join(newsroomDir, 'editor-invalid-attempt-1.json')), true);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-1.json'));
  assert.equal(errorArtifact.field, 'sections.article_sections');
});

test('semantic repair deterministically restores legacy sections and HAL Signal Capsule without LLM repair', async () => {
  const newsroomDir = tempNewsroomDir();
  const firstSection = section(1, {
    article_sections: undefined,
    hal_signal_capsule: undefined,
    action_items: ['Run Camera ITS and stream metadata checks for Headline 1 within 2 weeks.'],
    sources: [{
      title: 'Source 1',
      url: 'https://example.com/source-1',
      date: '2026-05-07'
    }]
  });
  const publicArticle = JSON.parse(JSON.stringify(firstSection.public_article));
  const sources = JSON.parse(JSON.stringify(firstSection.sources));
  const draft = editor({
    sections: [
      firstSection,
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed for deterministic schema repair.');
    }
  });

  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].public_article, publicArticle);
  assert.deepEqual(result.editor.sections[0].sources, sources);
  assert.deepEqual(result.editor.sections[0].hal_signal_capsule, {
    why_now: 'Source date 2026-05-07 provides the dated context for this HAL validation signal.',
    reader_owners: ['camera_hal_owner', 'camera_test_owner'],
    check_within_2_weeks: 'Run Camera ITS and stream metadata checks for Headline 1 within 2 weeks.',
    impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
    do_not_overstate: ['Do not overstate direct HAL impact.']
  });
});

test('semantic repair preserves complete HAL Signal Capsule during deterministic article section repair', async () => {
  const capsule = {
    why_now: 'Custom dated HAL signal is already present.',
    reader_owners: ['camera_driver_owner'],
    check_within_2_weeks: 'Keep the existing driver validation task.',
    impact_axes: ['driver_image_pipeline'],
    do_not_overstate: ['Preserve this existing caution.']
  };
  const draft = editor({
    sections: [
      section(1, {
        article_sections: undefined,
        hal_signal_capsule: capsule
      }),
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed when complete capsule exists.');
    }
  });

  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].hal_signal_capsule, capsule);
});

test('semantic repair falls back to LLM repair with deterministic reason code for missing semantic fields', async () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: undefined,
        camera_hal_perspective: ''
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, undefined);
  assert.deepEqual(validationError.deterministic_repair_failure_reason_codes, ['missing_hal_driver_impact']);
});

test('semantic repair does not create why_now from generation date alone', async () => {
  const draft = editor({
    sections: [
      section(1, {
        hal_signal_capsule: undefined,
        sources: [{
          title: 'Source 1',
          url: 'https://example.com/source-1'
        }]
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('missing_why_now_context'));
});

test('semantic repair records unknown axis and owner mapping failures before LLM fallback', async () => {
  const draft = editor({
    sections: [
      section(1, {
        hal_signal_capsule: undefined,
        hal_impact_axes: ['future_camera_lane'],
        reader_owners: [],
        relevance_bucket: '',
        sources: [{
          title: 'Source 1',
          url: 'https://example.com/source-1',
          date: '2026-05-07'
        }]
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('unknown_impact_axis'));
  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('missing_reader_owner_mapping'));
});

test('excessive briefing items are repaired and initial diagnostics are written', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });
  let repairCalled = false;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async ({ invalidEditor, validationError }) => {
      repairCalled = true;
      assert.equal(validationError.details.field, 'briefing');
      return { ...invalidEditor, briefing: ['one', 'two', 'three'] };
    }
  });

  assert.equal(repairCalled, true);
  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.deepEqual(result.editor.briefing, ['one', 'two', 'three']);
  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-attempt-1.json')).briefing.length, 4);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-1.json'));
  assert.equal(errorArtifact.details.actualCount, 4);
  assert.match(errorArtifact.message, /got 4/);
});

test('missing briefing items are repaired with clear diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two'] });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 2,
    stage: 'editor attempt 2/2',
    newsroomDir,
    normalizeSection,
    repairFn: async ({ invalidEditor }) => ({
      ...invalidEditor,
      briefing: ['one', 'two', 'three']
    })
  });

  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-2.json'));
  assert.equal(errorArtifact.details.expectedCount, 3);
  assert.equal(errorArtifact.details.actualCount, 2);
});

test('non-array briefing reports the actual type clearly', () => {
  const draft = editor({ briefing: 'one' });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'briefing');
      assert.equal(error.details.actualType, 'string');
      assert.match(error.message, /got non-array string/);
      return true;
    }
  );
});

test('repair preserves sections and sources', async () => {
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/1',
    normalizeSection,
    repairFn: async ({ invalidEditor }) => ({
      ...invalidEditor,
      briefing: ['one', 'two', 'three']
    })
  });

  assert.deepEqual(
    result.editor.sections.map(item => item.sources),
    draft.sections.map(item => item.sources)
  );
});

test('repair that changes sections or sources fatally fails and writes repair diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 3,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async ({ invalidEditor }) => ({
        ...invalidEditor,
        briefing: ['one', 'two', 'three'],
        sections: [
          {
            ...invalidEditor.sections[0],
            sources: [{ title: 'Changed source', url: 'https://example.com/changed' }],
            public_article: {
              ...invalidEditor.sections[0].public_article,
              source_links: [{ title: 'Changed source', url: 'https://example.com/changed', source_role: 'primary' }]
            }
          },
          ...invalidEditor.sections.slice(1)
        ]
      })
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.sources');
      assert.equal(error.repairAttempted, true);
      assert.equal(error.repairSucceeded, false);
      return true;
    }
  );

  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-repair-attempt-3.json')).sections[0].sources[0].url, 'https://example.com/changed');
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-repair-attempt-3.json'));
  assert.equal(errorArtifact.details.field, 'sections.sources');
  assert.equal(errorArtifact.repairAttempted, true);
  assert.equal(errorArtifact.repairSucceeded, false);
});

test('repair output with invalid briefing writes repair diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 4,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async ({ invalidEditor }) => ({
        ...invalidEditor,
        briefing: ['one', 'two']
      })
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'briefing');
      assert.equal(error.repairAttempted, true);
      assert.equal(error.repairSucceeded, false);
      return true;
    }
  );

  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-repair-attempt-4.json')).briefing.length, 2);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-repair-attempt-4.json'));
  assert.equal(errorArtifact.details.actualCount, 2);
});

test('unrepairable section-count semantic failures are not repaired', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ sections: [] });
  let repairCalled = false;

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 5,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async () => {
        repairCalled = true;
        return editor();
      }
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections');
      assert.equal(error.repairAttempted, false);
      return true;
    }
  );

  assert.equal(repairCalled, false);
  assert.equal(readJson(path.join(newsroomDir, 'editor-validation-error-attempt-5.json')).details.field, 'sections');
});
