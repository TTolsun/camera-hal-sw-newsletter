const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  EditorSemanticValidationError,
  repairEditorOutputContract,
  validateEditorOutputContract
} = require('../scripts/newsroom/validate/editor-output-contract');
const { editorSchema } = require('../scripts/newsroom/render/newsletter-schema');
const {
  buildGenerationStatus,
  editorSemanticStatusExtra
} = require('../scripts/gemini-newsroom-newsletter');
const {
  articlePolicy
} = require('../scripts/newsroom/common/newsletter-policy');

const DATE = '2026-05-08';

function section(index, overrides = {}) {
  return {
    category: `Category ${index}`,
    headline: `Headline ${index}`,
    what_changed: `Change ${index}`,
    confirmed_facts: [`Fact ${index}`],
    evidence_summary: `Evidence ${index}`,
    specificity_checks: [`Check ${index}`],
    source_verification_notes: [`Source note ${index}`],
    background: `Background ${index}`,
    why_it_matters: `Why ${index}`,
    camera_hal_perspective: `HAL perspective ${index}`,
    camera_hal_checks: [`HAL check ${index}`],
    action_items: [`Action ${index}`],
    team_summary: `Summary ${index}`,
    is_ai_related: false,
    article_type: 'camera-hal',
    selectedImage: '',
    imageSource: '',
    imageAttribution: '',
    imageAlt: '',
    imageLicenseStatus: 'none',
    imageUsageDecisionReason: 'No suitable attributed image selected.',
    sources: [{
      title: `Source ${index}`,
      url: `https://example.com/source-${index}`
    }],
    relevance_bucket: 'direct_aosp_camera',
    counts_as_primary_camera_topic: true,
    source_candidate_hash: `hash-${index}`,
    ...overrides
  };
}

function editor(overrides = {}) {
  return {
    date: DATE,
    title: `Camera HAL SW Newsletter - ${DATE}`,
    summary: 'Summary',
    briefing: ['one', 'two', 'three'],
    sections: [section(1), section(2), section(3)],
    action_items: ['Action'],
    references: [],
    ...overrides
  };
}

function normalizeSection(value) {
  return {
    ...value,
    sources: Array.isArray(value.sources)
      ? value.sources.filter(source => source && source.url)
      : []
  };
}

function tempNewsroomDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'editor-output-contract-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadFreshNewsletterCli() {
  const cliPath = require.resolve('../scripts/newsroom/cli/gemini-newsroom-newsletter');
  delete require.cache[cliPath];
  return require(cliPath);
}

test('valid editor output with exactly 3 briefing items passes unchanged', () => {
  const draft = editor();
  const sourceSignature = JSON.stringify(draft.sections.map(item => ({
    headline: item.headline,
    category: item.category,
    sources: item.sources
  })));

  const result = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(result, draft);
  assert.deepEqual(result.briefing, ['one', 'two', 'three']);
  assert.equal(
    JSON.stringify(result.sections.map(item => ({
      headline: item.headline,
      category: item.category,
      sources: item.sources
    }))),
    sourceSignature
  );
});

test('editor section count follows Newsletter Policy min/max', () => {
  const tooFew = editor({ sections: [section(1), section(2)] });
  const minimum = editor({
    sections: Array.from({ length: articlePolicy.mainArticleCount.min }, (_, index) => section(index + 1))
  });
  const tooMany = editor({
    sections: Array.from({ length: articlePolicy.mainArticleCount.max + 1 }, (_, index) => section(index + 1))
  });

  assert.throws(
    () => validateEditorOutputContract(tooFew, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections');
      assert.equal(error.details.expectedMinCount, articlePolicy.mainArticleCount.min);
      assert.equal(error.details.expectedMaxCount, articlePolicy.mainArticleCount.max);
      assert.equal(error.details.actualCount, articlePolicy.mainArticleCount.min - 1);
      assert.equal(error.details.actualType, 'array');
      assert.equal(error.details.sectionCount, articlePolicy.mainArticleCount.min - 1);
      return true;
    }
  );

  assert.equal(validateEditorOutputContract(minimum, DATE, { normalizeSection }), minimum);

  assert.throws(
    () => validateEditorOutputContract(tooMany, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections');
      assert.equal(error.details.expectedMinCount, articlePolicy.mainArticleCount.min);
      assert.equal(error.details.expectedMaxCount, articlePolicy.mainArticleCount.max);
      assert.equal(error.details.actualCount, articlePolicy.mainArticleCount.max + 1);
      assert.equal(error.details.actualType, 'array');
      assert.equal(error.details.sectionCount, articlePolicy.mainArticleCount.max + 1);
      return true;
    }
  );
});

test('editor article policy requires at least one Primary Camera Stack section', () => {
  const draft = editor({
    sections: [
      section(1, { relevance_bucket: 'soc_platform_signal', counts_as_primary_camera_topic: false }),
      section(2, { relevance_bucket: 'cpp_ai_tooling_fallback', counts_as_primary_camera_topic: false }),
      section(3, { relevance_bucket: 'soc_platform_signal', counts_as_primary_camera_topic: false })
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.relevance_bucket');
      assert.equal(error.details.expectedMinCount, articlePolicy.primaryCameraStack.minRequired);
      assert.equal(error.details.actualCount, 0);
      return true;
    }
  );
});

test('editor article policy rejects forbidden main buckets', () => {
  const draft = editor({
    sections: [
      section(1),
      section(2, { relevance_bucket: 'generic_tech_watchlist', counts_as_primary_camera_topic: false }),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.relevance_bucket');
      assert.deepEqual(error.details.forbiddenMainBuckets, articlePolicy.forbiddenMainBuckets);
      assert.equal(error.details.actualCount, 1);
      return true;
    }
  );
});

test('editor title fallback keeps existing Korean title contract', () => {
  const missingTitle = editor({ title: '' });
  const mismatchedTitle = editor({ title: 'Camera HAL SW Newsletter - 2026-05-07' });

  validateEditorOutputContract(missingTitle, DATE, { normalizeSection });
  validateEditorOutputContract(mismatchedTitle, DATE, { normalizeSection });

  assert.equal(missingTitle.title, `Camera HAL SW 뉴스레터 - ${DATE}`);
  assert.equal(mismatchedTitle.title, `Camera HAL SW 뉴스레터 - ${DATE}`);
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
            sources: [{ title: 'Changed source', url: 'https://example.com/changed' }]
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

test('semantic validation failures outside briefing are not repaired', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ sections: [section(1), section(2)] });
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

test('failure status can include editor semantic validation and repair fields', () => {
  const error = new EditorSemanticValidationError('Editor output must contain exactly 3 briefing items; got 4.', {
    field: 'briefing',
    expectedCount: 3,
    actualCount: 4,
    actualType: 'array',
    sectionCount: 3
  });
  error.editorSemanticValidation = { message: error.message, details: error.details };
  error.repairAttempted = true;
  error.repairSucceeded = false;

  const status = buildGenerationStatus({
    date: DATE,
    status: 'FAILED',
    extra: editorSemanticStatusExtra(error)
  });

  assert.equal(status.editor_semantic_validation.details.field, 'briefing');
  assert.equal(status.repairAttempted, true);
  assert.equal(status.repairSucceeded, false);
});

test('run-level editor semantic status preserves details and OR accumulates repair flags', () => {
  const {
    editorSemanticStatusExtra: freshEditorSemanticStatusExtra,
    recordEditorSemanticStatus
  } = loadFreshNewsletterCli();
  const initialDetails = {
    message: 'Editor output must contain exactly 3 briefing items; got 4.',
    details: {
      field: 'briefing',
      expectedCount: 3,
      actualCount: 4,
      actualType: 'array',
      sectionCount: 3
    }
  };
  const replacementDetails = {
    message: 'Editor output must contain exactly 3 briefing items; got 2.',
    details: {
      field: 'briefing',
      expectedCount: 3,
      actualCount: 2,
      actualType: 'array',
      sectionCount: 3
    }
  };

  recordEditorSemanticStatus({
    editor_semantic_validation: initialDetails,
    repairAttempted: true,
    repairSucceeded: true
  });
  recordEditorSemanticStatus({
    editor_semantic_validation: null,
    repairAttempted: false,
    repairSucceeded: false
  });
  recordEditorSemanticStatus({
    editor_semantic_validation: undefined
  });

  let status = freshEditorSemanticStatusExtra();
  assert.deepEqual(status.editor_semantic_validation, initialDetails);
  assert.equal(status.repairAttempted, true);
  assert.equal(status.repairSucceeded, true);

  const laterError = new EditorSemanticValidationError('Later non-repair failure.', {
    field: 'summary'
  });
  laterError.repairAttempted = false;
  laterError.repairSucceeded = false;
  status = freshEditorSemanticStatusExtra(laterError);
  assert.deepEqual(status.editor_semantic_validation, initialDetails);
  assert.equal(status.repairAttempted, true);
  assert.equal(status.repairSucceeded, true);

  recordEditorSemanticStatus({
    editor_semantic_validation: replacementDetails,
    repairAttempted: false,
    repairSucceeded: false
  });
  status = freshEditorSemanticStatusExtra();
  assert.deepEqual(status.editor_semantic_validation, replacementDetails);
  assert.equal(status.repairAttempted, true);
  assert.equal(status.repairSucceeded, true);
});

test('editor schema constrains briefing to exactly 3 numeric items', () => {
  assert.equal(editorSchema.properties.briefing.minItems, 3);
  assert.equal(editorSchema.properties.briefing.maxItems, 3);
});
