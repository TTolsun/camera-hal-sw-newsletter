const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  candidateGroupKey,
  compactContextCandidate,
  groupCoverageSummary,
  normalizeCanonicalUrlStripAnchor,
  normalizeSourceUrlPreserveAnchor
} = require('../../../scripts/newsroom/common/article-groups');

test('article group key uses explicit key, native tooling key, then source URL fallback', () => {
  assert.equal(
    candidateGroupKey({
      article_group_key: 'explicit-group',
      url: 'https://example.com/article'
    }),
    'explicit-group'
  );
  assert.equal(
    candidateGroupKey({
      relevance_bucket: 'cpp_ai_tooling_fallback',
      tooling_workflow_type: 'native_tooling_workflow',
      url: 'https://example.com/tooling'
    }),
    ANDROID_NATIVE_TOOLING_GROUP_KEY
  );
  assert.equal(
    candidateGroupKey({
      url: 'https://Example.com/path/?utm_source=x#child-8'
    }),
    'article:https://example.com/path#child-8'
  );
});

test('article group URL normalization separates source identity from canonical equivalence', () => {
  const sourceUrl = 'https://Example.com/io26.html?utm_source=x#roundup-child-8';

  assert.equal(
    normalizeSourceUrlPreserveAnchor(sourceUrl),
    'https://example.com/io26.html#roundup-child-8'
  );
  assert.equal(
    normalizeCanonicalUrlStripAnchor(sourceUrl),
    'https://example.com/io26.html'
  );
  assert.notEqual(
    normalizeSourceUrlPreserveAnchor('https://example.com/io26.html#roundup-child-8'),
    normalizeSourceUrlPreserveAnchor('https://example.com/io26.html#roundup-child-9')
  );
});

test('compact context candidate preserves allowed context when source quality was already implied', () => {
  const compacted = compactContextCandidate({
    title: 'Allowed Android tooling context',
    url: 'https://android-developers.googleblog.com/2026/05/tooling.html?utm_source=x#child',
    context_usage_allowed: true,
    finalSelectionEligibility: 'short'
  });

  assert.equal(compacted.context_usage_allowed, true);
  assert.equal(compacted.source_quality_status, 'allowed');
  assert.equal(compacted.context_role, 'allowed_supporting_context');
  assert.equal(compacted.normalized_url, 'https://android-developers.googleblog.com/2026/05/tooling.html#child');
  assert.equal(compacted.canonical_url, 'https://android-developers.googleblog.com/2026/05/tooling.html');
});

test('group coverage summary reports missing, overlap, and demotion reason issues', () => {
  const missing = groupCoverageSummary({
    selectedGroupKeys: ['group-a'],
    renderedGroupKeys: [],
    demotedGroups: []
  });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.missing_group_keys, ['group-a']);

  const overlap = groupCoverageSummary({
    selectedGroupKeys: ['group-a'],
    renderedGroupKeys: ['group-a'],
    demotedGroups: [{ article_group_key: 'group-a', demotion_reason: 'duplicate' }]
  });
  assert.equal(overlap.ok, false);
  assert.deepEqual(overlap.overlapping_group_keys, ['group-a']);

  const demotionWithoutReason = groupCoverageSummary({
    selectedGroupKeys: ['group-a'],
    renderedGroupKeys: [],
    demotedGroups: [{ article_group_key: 'group-a', demotion_reason: '' }]
  });
  assert.equal(demotionWithoutReason.ok, false);
  assert.deepEqual(demotionWithoutReason.demotion_missing_reason_group_keys, ['group-a']);

  const hardBlocked = groupCoverageSummary({
    selectedGroupKeys: ['group-a'],
    renderedGroupKeys: [],
    hardBlockedGroups: [{ article_group_key: 'group-a', hard_block_reason: 'source gap', reason_code: 'source_gap_risk' }]
  });
  assert.equal(hardBlocked.ok, true);
  assert.equal(hardBlocked.hard_blocked_group_count, 1);

  const hardBlockedAndDemoted = groupCoverageSummary({
    selectedGroupKeys: ['group-a'],
    renderedGroupKeys: [],
    demotedGroups: [{ article_group_key: 'group-a', demotion_reason: 'editor hold', reason_code: 'explicit_editor_hold' }],
    hardBlockedGroups: [{ article_group_key: 'group-a', hard_block_reason: 'source gap', reason_code: 'source_gap_risk' }]
  });
  assert.equal(hardBlockedAndDemoted.ok, false);
  assert.deepEqual(hardBlockedAndDemoted.hard_blocked_demoted_overlap_group_keys, ['group-a']);
});
