'use strict';

// #482: the targeted-repair patch path. These exercise the deterministic
// patch-apply + identity guard (applyRepairPatchesAndValidate) and the
// section_key -> editor-index remap, with no LLM in the loop.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyRepairPatchesAndValidate,
  remapRepairPatchSections
} = require('../../../scripts/newsroom/cli/gemini-newsroom-newsletter');
const { editor, section } = require('../../../src/core/test/helpers/editor-builders');
const { stableSectionKey } = require('../../../src/core/common/section-identity');

const DATE = '2026-05-08';

test('applyRepairPatchesAndValidate applies a repair-section wording patch and preserves identity', () => {
  const draft = editor({ sections: [section(1), section(2)] });
  const patches = [{
    section_index: 0,
    section_key: stableSectionKey(draft.sections[0]),
    op: 'replace',
    path: '/article_sections/verified_facts/0',
    value: '패치된 사실'
  }];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, true);
  assert.equal(result.editor.sections.length, 2);
  assert.equal(result.editor.sections[0].article_sections.verified_facts[0], '패치된 사실');
  // the input editor is never mutated
  assert.equal(draft.sections[0].article_sections.verified_facts[0], 'Fact 1');
});

test('applyRepairPatchesAndValidate rejects a patch that targets a source URL without mutating', () => {
  const draft = editor({ sections: [section(1), section(2)] });
  const patches = [{ section_index: 0, op: 'replace', path: '/sources/0/url', value: 'https://evil.example.com' }];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, false);
  assert.ok(result.violations.length > 0);
  assert.deepEqual(result.editor, draft);
});

test('applyRepairPatchesAndValidate keeps 2 selected sections at 2 after repair (2026-06-03 regression)', () => {
  const draft = editor({ sections: [section(1), section(2)] });
  const patches = [
    { section_index: 0, op: 'replace', path: '/public_article/body_paragraphs/0', value: '문단 1 수정' },
    { section_index: 1, op: 'replace', path: '/article_sections/verified_facts/0', value: '사실 2 수정' }
  ];

  const result = applyRepairPatchesAndValidate({ editor: draft, patches, date: DATE });

  assert.equal(result.ok, true);
  assert.equal(result.editor.sections.length, 2);
});

test('remapRepairPatchSections resolves section_key to the real editor index', () => {
  const draft = editor({ sections: [section(1), section(2)] });
  const { normalized, violations } = remapRepairPatchSections(draft.sections, [
    { section_key: stableSectionKey(draft.sections[1]), op: 'replace', path: '/article_sections/verified_facts/0', value: 'x' }
  ]);

  assert.equal(violations.length, 0);
  assert.equal(normalized[0].section_index, 1);
});

test('remapRepairPatchSections rejects a patch whose section_key is missing', () => {
  const draft = editor({ sections: [section(1)] });
  const { violations } = remapRepairPatchSections(draft.sections, [
    { section_key: 'hash:does-not-exist', op: 'replace', path: '/article_sections/verified_facts/0', value: 'x' }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].detail, 'section_key_not_found');
});
