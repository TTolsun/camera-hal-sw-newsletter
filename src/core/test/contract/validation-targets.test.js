const assert = require('node:assert/strict');
const test = require('node:test');

const {
  changedArtifactDate
} = require('../../common/artifact-paths');
const {
  strictTargetDatesFromInputs
} = require('../../../generator/reporter/validation-targets');

test('changed artifact date detection covers newsletter and newsroom artifacts', () => {
  assert.equal(changedArtifactDate('newsletters/2026-05-07/newsletter.md'), '2026-05-07');
  assert.equal(changedArtifactDate('content/newsroom/2026-05-07/quality-report.json'), '2026-05-07');
  assert.equal(changedArtifactDate('content/collected-news/2026-05-07/candidates.json'), '2026-05-07');
  assert.equal(changedArtifactDate('content/source-events/2026-05-07/source-change-events.json'), '2026-05-07');
  assert.equal(changedArtifactDate('docs/newsroom-workflow.md'), '');
});

test('strict target dates combine changed artifacts and generated date file input', () => {
  const dates = strictTargetDatesFromInputs({
    changedFiles: [
      'newsletters/2026-05-07/index.html',
      'content/newsroom/2026-05-08/editor-draft.json',
      'content/collected-news/2026-05-09/candidates.json',
      'content/source-events/2026-05-11/source-change-events.md',
      'README.md'
    ],
    newsletterDate: '2026-05-10'
  });

  assert.deepEqual([...dates].sort(), [
    '2026-05-07',
    '2026-05-08',
    '2026-05-09',
    '2026-05-10',
    '2026-05-11'
  ]);
});

test('strict target dates ignore advisory image audit reports', () => {
  const dates = strictTargetDatesFromInputs({
    changedFiles: [
      'content/newsroom/2026-05-07/image-audit-report.json',
      'content/newsroom/2026-05-08/image-audit-report.md',
      'content/newsroom/2026-05-09/editor-draft.json',
      'newsletters/2026-05-10/index.html'
    ]
  });

  assert.deepEqual([...dates].sort(), [
    '2026-05-09',
    '2026-05-10'
  ]);
});
