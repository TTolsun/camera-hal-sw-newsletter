const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  HARD_BLOCK_REASON_CODES,
  attachRelatedContextToSelected,
  candidateGroupKey,
  compactContextCandidate,
  explicitHardBlockedGroups,
  groupCoverageSummary,
  inferReasonCode,
  normalizeCanonicalUrlStripAnchor,
  normalizeSourceUrlPreserveAnchor
} = require('../../../common/article-groups');

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

  const duplicateRendered = groupCoverageSummary({
    selectedGroupKeys: ['group-a'],
    renderedGroupKeys: ['group-a', 'group-a'],
    demotedGroups: []
  });
  assert.equal(duplicateRendered.ok, false);
  assert.deepEqual(duplicateRendered.duplicate_rendered_group_keys, ['group-a']);

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

test('inferReasonCode coerces blocked-context family codes to a valid hard-block reason', () => {
  // editor/repair가 blocked_context 오류 type을 reason_code로 그대로 흘려 보낼 때,
  // 결정론 보정이 유효 hard-block enum으로 정규화해야 group-state 검증이 통과한다.
  for (const raw of [
    'blocked_context_url_used_as_article_source',
    'blocked_context_title_used_as_independent_headline',
    'parent_roundup_context_only'
  ]) {
    const coerced = inferReasonCode(raw);
    assert.equal(
      coerced,
      'blocked_source_quality',
      `expected ${raw} to coerce to blocked_source_quality, got ${coerced}`
    );
    assert.ok(HARD_BLOCK_REASON_CODES.includes(coerced));
  }
});

test('explicitHardBlockedGroups normalizes a blocked-context reason code into a valid enum', () => {
  // PR #614 재현: repair가 android_native_tooling_workflow를 blocked_context 코드로 hard-block.
  const groups = explicitHardBlockedGroups({
    hard_blocked_groups: [
      { article_group_key: 'android_native_tooling_workflow', reason_code: 'blocked_context_url_used_as_article_source' }
    ]
  });
  assert.equal(groups.length, 1);
  assert.ok(
    HARD_BLOCK_REASON_CODES.includes(groups[0].reason_code),
    `expected a valid hard-block reason code, got ${groups[0].reason_code}`
  );
});

test('attachRelatedContextToSelected drops the selected article own exact URL but keeps anchor siblings and other URLs', () => {
  const selfUrl = 'https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html';
  const selected = [{
    title: 'Build native Android apps in Google AI Studio',
    url: selfUrl,
    article_group_key: 'group-ai-studio'
  }];
  const pool = [
    // 같은 article URL이 다른 title로 재카탈로그된 self 항목 -> 제외되어야 함.
    { title: 'Android Developers Blog: Build native Android apps', url: selfUrl, article_group_key: 'group-ai-studio' },
    // anchor만 다른 sibling -> 유지되어야 함.
    { title: 'Roundup child section', url: `${selfUrl}#roundup-child-3-start-building-today`, article_group_key: 'group-ai-studio' },
    // 완전히 다른 URL -> 유지(차단 context)되어야 함.
    { title: 'Different roundup', url: 'https://android-developers.googleblog.com/2026/05/roundup.html', article_group_key: 'group-ai-studio' }
  ];

  const [result] = attachRelatedContextToSelected(selected, [pool]);
  const normalizedUrls = result.related_context_candidates.map(item => normalizeSourceUrlPreserveAnchor(item.url));

  // self의 exact normalized URL은 related/blocked context에 없어야 한다.
  assert.equal(normalizedUrls.includes(normalizeSourceUrlPreserveAnchor(selfUrl)), false);
  // anchor가 다른 sibling과 다른 roundup URL은 유지된다.
  assert.ok(normalizedUrls.includes(normalizeSourceUrlPreserveAnchor(`${selfUrl}#roundup-child-3-start-building-today`)));
  assert.ok(normalizedUrls.includes(normalizeSourceUrlPreserveAnchor('https://android-developers.googleblog.com/2026/05/roundup.html')));
});
