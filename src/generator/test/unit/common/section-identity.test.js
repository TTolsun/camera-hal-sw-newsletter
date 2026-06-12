'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  candidateDuplicatesSections,
  duplicateReasonForSections,
  normalizeTitle,
  protectedRepairFieldsMatch,
  sameSectionLabel,
  sameStringSet,
  sectionSummary,
  sectionsAreDuplicate,
  signaturesMatch,
  stableSectionKey,
  stableSectionKeySet,
  titleSimilarity,
  urlKeys
} = require('../../../src/core/common/section-identity');

test('sectionSummary builds a 1-based diagnostic summary with urls and source titles', () => {
  const summary = sectionSummary({
    headline: 'CameraX 1.6.0',
    category: 'CameraX',
    relevance_bucket: 'direct_aosp_camera',
    sources: [
      { title: 'Android Developers', url: 'https://developer.android.com/a' },
      { title: '', url: 'https://developer.android.com/b' }
    ]
  }, 0);
  assert.equal(summary.index, 1);
  assert.equal(summary.headline, 'CameraX 1.6.0');
  assert.equal(summary.category, 'CameraX');
  assert.equal(summary.relevance_bucket, 'direct_aosp_camera');
  assert.deepEqual(summary.urls, ['https://developer.android.com/a', 'https://developer.android.com/b']);
  assert.deepEqual(summary.source_titles, ['Android Developers']);
});

test('sectionSummary defaults relevance_bucket and tolerates missing sources', () => {
  const summary = sectionSummary({ headline: 'h', category: 'c' }, 2);
  assert.equal(summary.index, 3);
  assert.equal(summary.relevance_bucket, '');
  assert.deepEqual(summary.urls, []);
  assert.deepEqual(summary.source_titles, []);
});

test('normalizeTitle lowercases, strips diacritics and punctuation, collapses spaces', () => {
  assert.equal(normalizeTitle('CameraX 1.6.0: Release!'), 'camerax 1 6 0 release');
  assert.equal(normalizeTitle('한글 제목  테스트'), '한글 제목 테스트');
});

test('titleSimilarity returns token overlap ratio', () => {
  assert.equal(titleSimilarity('CameraX release notes', 'CameraX release notes'), 1);
  assert.equal(titleSimilarity('CameraX release', 'totally different topic'), 0);
  assert.ok(titleSimilarity('CameraX 1.6.0 release', 'CameraX 1.6.0 release notes') > 0.6);
});

test('stableSectionKey prefers candidate hash, then group+urls, then urls, then label', () => {
  assert.equal(stableSectionKey({ source_candidate_hash: 'abc' }), 'hash:abc');
  assert.match(stableSectionKey({ article_group_key: 'g', sources: [{ url: 'https://e.com/a' }] }), /^group-url:g\|/);
  assert.match(stableSectionKey({ sources: [{ url: 'https://e.com/a?x=1#h' }] }), /^urls:/);
  assert.equal(stableSectionKey({ headline: 'Title', category: 'Cat' }), 'label:title|cat');
});

test('stableSectionKeySet de-duplicates and drops empty keys', () => {
  const set = stableSectionKeySet([
    { source_candidate_hash: 'abc' },
    { source_candidate_hash: 'abc' },
    {}
  ]);
  assert.equal(set.size, 1);
  assert.ok(set.has('hash:abc'));
});

test('sameStringSet compares set membership', () => {
  assert.equal(sameStringSet(new Set(['a', 'b']), new Set(['b', 'a'])), true);
  assert.equal(sameStringSet(new Set(['a']), new Set(['a', 'b'])), false);
});

test('signaturesMatch is true for same source binding, false when source drifts', () => {
  const a = { headline: 'H', category: 'C', sources: [{ url: 'https://e.com/a' }] };
  const b = { headline: 'H', category: 'C', sources: [{ url: 'https://e.com/a' }] };
  const c = { headline: 'H', category: 'C', sources: [{ url: 'https://e.com/b' }] };
  assert.equal(signaturesMatch(a, b), true);
  assert.equal(signaturesMatch(a, c), false);
});

test('protectedRepairFieldsMatch detects bucket/group drift', () => {
  const a = { headline: 'H', relevance_bucket: 'direct_aosp_camera', sources: [{ url: 'https://e.com/a' }] };
  const b = { headline: 'H', relevance_bucket: 'direct_aosp_camera', sources: [{ url: 'https://e.com/a' }] };
  const c = { headline: 'H', relevance_bucket: 'cpp_ai_tooling_fallback', sources: [{ url: 'https://e.com/a' }] };
  assert.equal(protectedRepairFieldsMatch(a, b), true);
  assert.equal(protectedRepairFieldsMatch(a, c), false);
});

test('sameSectionLabel matches on normalized headline/category', () => {
  assert.equal(sameSectionLabel({ headline: 'CameraX Release' }, { headline: 'camerax release' }), true);
  assert.equal(sameSectionLabel({ headline: 'A' }, { headline: 'B' }), false);
});

test('sectionsAreDuplicate detects shared URL, identical title, and source+date+title', () => {
  assert.equal(
    sectionsAreDuplicate({ sources: [{ url: 'https://e.com/a' }] }, { sources: [{ url: 'https://e.com/a' }] }),
    true
  );
  assert.equal(
    sectionsAreDuplicate({ headline: 'CameraX 1.6.0 Release' }, { headline: 'camerax 1.6.0 release' }),
    true
  );
  assert.ok(
    !sectionsAreDuplicate({ headline: 'A', sources: [{ url: 'https://e.com/a' }] }, { headline: 'B', sources: [{ url: 'https://e.com/b' }] })
  );
});

test('duplicateReasonForSections returns context-specific reason codes', () => {
  assert.equal(
    duplicateReasonForSections({ sources: [{ url: 'https://e.com/a' }] }, { sources: [{ url: 'https://e.com/a' }] }, 'locked'),
    'duplicate_locked_url'
  );
  assert.equal(
    duplicateReasonForSections({ sources: [{ url: 'https://e.com/a' }] }, { sources: [{ url: 'https://e.com/a' }] }, 'demoted'),
    'duplicate_demoted_url'
  );
  assert.equal(
    duplicateReasonForSections({ headline: 'A', sources: [{ url: 'https://e.com/a' }] }, { headline: 'B', sources: [{ url: 'https://e.com/b' }] }),
    ''
  );
});

test('candidateDuplicatesSections maps a candidate to a section shape', () => {
  const sections = [{ headline: 'CameraX 1.6.0', sources: [{ url: 'https://e.com/a' }] }];
  assert.equal(candidateDuplicatesSections({ title: 'X', url: 'https://e.com/a' }, sections), true);
  assert.equal(candidateDuplicatesSections({ title: 'Other', url: 'https://e.com/z' }, sections), false);
});

test('urlKeys normalizes query/hash/trailing-slash variants', () => {
  const keys = urlKeys('https://Example.com/a/?q=1#x');
  assert.ok(keys.includes('https://Example.com/a/?q=1#x'));
  assert.ok(keys.some(k => k === 'https://example.com/a' || k === 'https://Example.com/a'));
});
