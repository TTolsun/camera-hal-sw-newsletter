const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkRepairPatchContract,
  applyRepairPatches,
  REPAIR_PATCH_CONTRACT_VIOLATION
} = require('../../../scripts/newsroom/validate/repair-patch-contract');

function section(overrides = {}) {
  return {
    headline: 'CameraX 1.6.0 stable',
    category: 'CameraX',
    source_candidate_hash: 'hash-a',
    relevance_bucket: 'direct_aosp_camera',
    article_group_key: 'group-a',
    coverage_type: 'fresh',
    published_date: '2026-06-01',
    candidate_id: 'cand_001',
    sources: [{ title: 'Android Developers', url: 'https://developer.android.com/jetpack/androidx/releases/camera' }],
    article_sections: {
      verified_facts: [{ text: 'fact one' }, { text: 'fact two' }],
      background_context: 'bg'
    },
    public_article: { headline: 'CameraX 1.6.0', body: 'body text' },
    ...overrides
  };
}

function editor(sections) {
  return {
    date: '2026-06-04',
    summary: 'summary',
    briefing: ['a', 'b', 'c'],
    sections,
    action_items: [],
    references: []
  };
}

test('checkRepairPatchContract accepts a repaired editor identical to the base', () => {
  const base = editor([section({ source_candidate_hash: 'h1' }), section({ source_candidate_hash: 'h2' })]);
  const result = checkRepairPatchContract(base, base);
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('checkRepairPatchContract accepts a repair that only changes verified_facts text', () => {
  const base = editor([section({ source_candidate_hash: 'h1' })]);
  const repaired = editor([
    section({
      source_candidate_hash: 'h1',
      article_sections: { verified_facts: [{ text: 'corrected fact' }, { text: 'fact two' }], background_context: 'bg' }
    })
  ]);
  const result = checkRepairPatchContract(base, repaired);
  assert.equal(result.ok, true);
});

test('checkRepairPatchContract rejects a repair that drops a section (2026-06-03 identity-drift shape)', () => {
  const base = editor([section({ source_candidate_hash: 'h1' }), section({ source_candidate_hash: 'h2' })]);
  const repaired = editor([section({ source_candidate_hash: 'h1' })]);
  const result = checkRepairPatchContract(base, repaired);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(v => v.reason === 'section_count_changed'));
});

test('checkRepairPatchContract rejects a repair that changes a source URL', () => {
  const base = editor([section({ source_candidate_hash: 'h1' })]);
  const repaired = editor([
    section({ source_candidate_hash: 'h1', sources: [{ title: 'Android Developers', url: 'https://evil.example.com' }] })
  ]);
  const result = checkRepairPatchContract(base, repaired);
  assert.equal(result.ok, false);
  const violation = result.violations.find(v => v.reason === 'protected_field_changed');
  assert.ok(violation, 'expected a protected_field_changed violation');
  assert.ok(violation.fields.includes('source_urls'));
});

test('checkRepairPatchContract rejects a repair that changes coverage_type', () => {
  const base = editor([section({ source_candidate_hash: 'h1', coverage_type: 'fresh' })]);
  const repaired = editor([section({ source_candidate_hash: 'h1', coverage_type: 'catch_up' })]);
  const result = checkRepairPatchContract(base, repaired);
  assert.equal(result.ok, false);
  const violation = result.violations.find(v => v.reason === 'protected_field_changed');
  assert.ok(violation && violation.fields.includes('coverage_type'));
});

test('checkRepairPatchContract rejects a repair that changes a section stable identity', () => {
  const base = editor([section({ source_candidate_hash: 'h1' })]);
  const repaired = editor([section({ source_candidate_hash: 'h-rewritten' })]);
  const result = checkRepairPatchContract(base, repaired);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(v => v.reason === 'section_removed' || v.reason === 'section_added'));
});

test('applyRepairPatches applies a verified_facts text patch and preserves section count', () => {
  const base = editor([section({ source_candidate_hash: 'h1' }), section({ source_candidate_hash: 'h2' })]);
  const patches = [{ section_index: 0, op: 'replace', path: '/article_sections/verified_facts/0/text', value: 'patched fact' }];
  const result = applyRepairPatches(base, patches);
  assert.equal(result.ok, true);
  assert.equal(result.output.sections.length, 2);
  assert.equal(result.output.sections[0].article_sections.verified_facts[0].text, 'patched fact');
  // base is never mutated
  assert.equal(base.sections[0].article_sections.verified_facts[0].text, 'fact one');
  // the applied result still satisfies the contract
  assert.equal(checkRepairPatchContract(base, result.output).ok, true);
});

test('applyRepairPatches rejects a patch that targets a source URL and leaves the base unchanged', () => {
  const base = editor([section({ source_candidate_hash: 'h1' })]);
  const patches = [{ section_index: 0, op: 'replace', path: '/sources/0/url', value: 'https://evil.example.com' }];
  const result = applyRepairPatches(base, patches);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(v => v.reason === REPAIR_PATCH_CONTRACT_VIOLATION));
  assert.deepEqual(result.output, base);
});

test('applyRepairPatches rejects a section-level remove op without changing section count', () => {
  const base = editor([section({ source_candidate_hash: 'h1' }), section({ source_candidate_hash: 'h2' })]);
  const patches = [{ section_index: 1, op: 'remove', path: '' }];
  const result = applyRepairPatches(base, patches);
  assert.equal(result.ok, false);
  assert.equal(result.output.sections.length, 2);
});
