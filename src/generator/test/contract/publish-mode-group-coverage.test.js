'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateEditorOutputContract
} = require('../../editor/editor-output-contract');

const { buildGroupCoverageFixture } = require('../../../core/test/helpers/editor-builders');

test('DEEP mode rejects missing selected group (current behavior)', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  assert.throws(
    () => validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'DEEP' }),
    /selected group coverage/
  );
});

test('CONTEXT mode does not require every selected group to render', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  assert.doesNotThrow(
    () => validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'CONTEXT' })
  );
});

test('QUIET mode does not require every selected group to render', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  assert.doesNotThrow(
    () => validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'QUIET' })
  );
});
