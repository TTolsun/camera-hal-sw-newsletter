const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ARTICLE_SECTION_LABELS,
  ARTICLE_SECTION_KEYS,
  articleSectionSummary,
  normalizeArticleSections
} = require('../../scripts/newsroom/common/article-section-contract');

test('ARTICLE_SECTION_LABELS stays aligned with the public #56 wording', () => {
  assert.deepEqual(ARTICLE_SECTION_LABELS, {
    verified_facts: '확인한 사실 / 릴리스 요약',
    background_context: '배경지식 / 왜 AOSP Camera 팀이 볼 만한가',
    hal_driver_impact: 'Camera HAL/Driver 관점 / 적용 가능 지점',
    action_items: '실행 항목 / PoC 제안 및 검증 기준',
    team_share_points: '팀 공유 포인트 / 결론'
  });
});

test('normalizeArticleSections returns strict normalized output from article_sections', () => {
  const result = normalizeArticleSections({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.'
    }
  });

  assert.deepEqual(ARTICLE_SECTION_KEYS, [
    'verified_facts',
    'background_context',
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ]);
  assert.deepEqual(result.verified_facts, ['CameraX 1.5.0 was released.']);
  assert.equal(result.background_context, 'CameraX sits above Camera2.');
  assert.equal(result.hal_driver_impact, 'Check stream and metadata compatibility.');
  assert.deepEqual(result.action_items, ['Run Camera ITS preview tests.']);
  assert.equal(result.team_share_points, 'Use this release as a validation trigger.');
  assert.equal(result.diagnostics.article_sections_present, true);
  assert.equal(result.diagnostics.complete, true);
  assert.deepEqual(result.diagnostics.missing_keys, []);
});

test('normalizeArticleSections ignores legacy fields when article_sections is missing', () => {
  const result = normalizeArticleSections({
    confirmed_facts: ['Legacy fact.'],
    what_changed: 'Legacy change.',
    background: 'Legacy background.',
    why_it_matters: 'Legacy importance.',
    camera_hal_perspective: 'Legacy HAL perspective.',
    action_hints: ['Legacy hint.'],
    action_items: ['Legacy action.'],
    team_summary: 'Legacy team summary.'
  });

  assert.deepEqual(result.verified_facts, []);
  assert.equal(result.background_context, '');
  assert.equal(result.hal_driver_impact, '');
  assert.deepEqual(result.action_items, []);
  assert.equal(result.team_share_points, '');
  assert.equal(result.diagnostics.article_sections_present, false);
  assert.deepEqual(result.diagnostics.missing_keys, ARTICLE_SECTION_KEYS);
  assert.equal(result.diagnostics.complete, false);
});

test('non-plain article_sections is treated as missing article_sections', () => {
  for (const articleSections of [null, 'invalid', ['invalid']]) {
    const result = normalizeArticleSections({
      article_sections: articleSections
    });

    assert.deepEqual(result.verified_facts, []);
    assert.equal(result.background_context, '');
    assert.equal(result.hal_driver_impact, '');
    assert.deepEqual(result.action_items, []);
    assert.equal(result.team_share_points, '');
    assert.equal(result.diagnostics.article_sections_present, false);
    assert.deepEqual(result.diagnostics.missing_keys, ARTICLE_SECTION_KEYS);
    assert.equal(result.diagnostics.complete, false);
  }
});

test('incomplete article_sections reports missing keys without legacy fallback', () => {
  const result = normalizeArticleSections({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.'
    },
    camera_hal_perspective: 'Legacy HAL perspective.',
    action_items: ['Legacy action.'],
    team_summary: 'Legacy team summary.'
  });

  assert.deepEqual(result.verified_facts, ['CameraX 1.5.0 was released.']);
  assert.equal(result.background_context, 'CameraX sits above Camera2.');
  assert.equal(result.hal_driver_impact, '');
  assert.deepEqual(result.action_items, []);
  assert.equal(result.team_share_points, '');
  assert.equal(result.diagnostics.article_sections_present, true);
  assert.deepEqual(result.diagnostics.missing_keys, [
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ]);
  assert.equal(result.diagnostics.complete, false);
});

test('articleSectionSummary exposes only complete and missing_keys', () => {
  const summary = articleSectionSummary({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.'
    },
    camera_hal_perspective: 'Legacy HAL perspective mismatch.'
  });

  assert.deepEqual(summary, {
    complete: true,
    missing_keys: []
  });
});
