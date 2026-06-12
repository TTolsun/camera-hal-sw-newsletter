const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ARTICLE_SECTION_ALLOWED_KEYS,
  ARTICLE_SECTION_KEYS,
  ARTICLE_SECTION_LABELS,
  ARTICLE_SECTION_OPTIONAL_KEYS,
  ARTICLE_SECTION_REQUIRED_KEYS,
  LIMITATION_VISIBILITY,
  articleSectionSummary,
  normalizeArticleSections,
  unexpectedArticleSectionKeys
} = require('../../reporter/article-section-contract');

const REQUIRED_KEYS = [
  'verified_facts',
  'background_context',
  'hal_driver_impact',
  'action_items',
  'team_share_points'
];

const OPTIONAL_KEYS = [
  'known_limitations',
  'watch_items',
  'do_not_claim'
];

test('ARTICLE_SECTION_LABELS stays aligned with the public #56 wording', () => {
  assert.deepEqual(ARTICLE_SECTION_LABELS, {
    verified_facts: '확인한 사실 / 릴리스 요약',
    background_context: '배경지식 / 왜 AOSP Camera 팀이 볼 만한가',
    hal_driver_impact: 'Camera HAL/Driver 관점 / 적용 가능 지점',
    action_items: '실행 항목 / PoC 제안 및 검증 기준',
    team_share_points: '팀 공유 포인트 / 결론',
    known_limitations: '제한 / 주의',
    watch_items: '추적 항목'
  });
});

test('article section key sets separate required optional and allowed keys', () => {
  assert.deepEqual(ARTICLE_SECTION_REQUIRED_KEYS, REQUIRED_KEYS);
  assert.equal(ARTICLE_SECTION_KEYS, ARTICLE_SECTION_REQUIRED_KEYS);
  assert.deepEqual(ARTICLE_SECTION_OPTIONAL_KEYS, OPTIONAL_KEYS);
  assert.deepEqual(ARTICLE_SECTION_ALLOWED_KEYS, [
    ...REQUIRED_KEYS,
    ...OPTIONAL_KEYS
  ]);
});

test('normalizeArticleSections returns normalized output from article_sections', () => {
  const result = normalizeArticleSections({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.',
      known_limitations: ['No direct HAL contract change is stated.'],
      watch_items: ['Track CameraX SessionConfig regressions.'],
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  });

  assert.deepEqual(result.verified_facts, ['CameraX 1.5.0 was released.']);
  assert.equal(result.background_context, 'CameraX sits above Camera2.');
  assert.equal(result.hal_driver_impact, 'Check stream and metadata compatibility.');
  assert.deepEqual(result.action_items, ['Run Camera ITS preview tests.']);
  assert.equal(result.team_share_points, 'Use this release as a validation trigger.');
  assert.deepEqual(result.known_limitations, ['No direct HAL contract change is stated.']);
  assert.deepEqual(result.watch_items, ['Track CameraX SessionConfig regressions.']);
  assert.deepEqual(result.do_not_claim, ['Do not claim direct Camera HAL API changes.']);
  assert.equal(result.diagnostics.article_sections_present, true);
  assert.equal(result.diagnostics.complete, true);
  assert.deepEqual(result.diagnostics.missing_keys, []);
  assert.deepEqual(result.diagnostics.missing_required_keys, []);
  assert.deepEqual(result.diagnostics.present_optional_keys, OPTIONAL_KEYS);
  assert.deepEqual(result.diagnostics.unexpected_keys, []);
});

test('normalizeArticleSections accepts string input for optional keys', () => {
  const result = normalizeArticleSections({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.',
      known_limitations: 'No direct HAL contract change is stated.',
      watch_items: 'Track CameraX SessionConfig regressions.',
      do_not_claim: 'Do not claim direct Camera HAL API changes.'
    }
  });

  assert.deepEqual(result.known_limitations, ['No direct HAL contract change is stated.']);
  assert.deepEqual(result.watch_items, ['Track CameraX SessionConfig regressions.']);
  assert.deepEqual(result.do_not_claim, ['Do not claim direct Camera HAL API changes.']);
  assert.deepEqual(result.diagnostics.present_optional_keys, OPTIONAL_KEYS);
});

test('complete=true ignores missing optional keys', () => {
  const result = normalizeArticleSections({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.'
    }
  });

  assert.equal(result.diagnostics.complete, true);
  assert.deepEqual(result.diagnostics.missing_keys, []);
  assert.deepEqual(result.diagnostics.missing_required_keys, []);
  assert.deepEqual(result.diagnostics.present_optional_keys, []);
});

test('normalizeArticleSections returns empty result when article_sections is missing', () => {
  const result = normalizeArticleSections({
    confirmed_facts: ['Section-level fact.'],
    what_changed: 'Section-level change.',
    action_hints: ['Section-level hint.'],
    action_items: ['Section-level action.']
  });

  assert.deepEqual(result.verified_facts, []);
  assert.equal(result.background_context, '');
  assert.equal(result.hal_driver_impact, '');
  assert.deepEqual(result.action_items, []);
  assert.equal(result.team_share_points, '');
  assert.deepEqual(result.known_limitations, []);
  assert.deepEqual(result.watch_items, []);
  assert.deepEqual(result.do_not_claim, []);
  assert.equal(result.diagnostics.article_sections_present, false);
  assert.deepEqual(result.diagnostics.missing_keys, ARTICLE_SECTION_KEYS);
  assert.deepEqual(result.diagnostics.missing_required_keys, ARTICLE_SECTION_KEYS);
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
    assert.deepEqual(result.known_limitations, []);
    assert.deepEqual(result.watch_items, []);
    assert.deepEqual(result.do_not_claim, []);
    assert.equal(result.diagnostics.article_sections_present, false);
    assert.deepEqual(result.diagnostics.missing_keys, ARTICLE_SECTION_KEYS);
    assert.deepEqual(result.diagnostics.missing_required_keys, ARTICLE_SECTION_KEYS);
    assert.deepEqual(result.diagnostics.unexpected_keys, []);
    assert.equal(result.diagnostics.complete, false);
  }
});

test('incomplete article_sections reports missing required keys without legacy fallback', () => {
  const result = normalizeArticleSections({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.'
    },
    action_items: ['Section-level action.']
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
  assert.deepEqual(result.diagnostics.missing_required_keys, result.diagnostics.missing_keys);
  assert.equal(result.diagnostics.complete, false);
});

test('unexpected article_sections keys are diagnostic failures separate from completeness', () => {
  const section = {
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.',
      legacy_summary: 'Unexpected field.'
    }
  };
  const result = normalizeArticleSections(section);

  assert.equal(result.diagnostics.complete, true);
  assert.deepEqual(result.diagnostics.missing_keys, []);
  assert.deepEqual(result.diagnostics.unexpected_keys, ['legacy_summary']);
  assert.deepEqual(unexpectedArticleSectionKeys(section), ['legacy_summary']);
});

test('articleSectionSummary includes optional diagnostics and limitation visibility', () => {
  const summary = articleSectionSummary({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.',
      known_limitations: ['No direct HAL contract change is stated.'],
      watch_items: ['Track CameraX SessionConfig regressions.'],
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  });

  assert.deepEqual(summary, {
    complete: true,
    missing_keys: [],
    missing_required_keys: [],
    present_optional_keys: OPTIONAL_KEYS,
    unexpected_keys: [],
    has_limitations: true,
    has_watch_items: true,
    has_do_not_claim: true,
    limitation_visibility: LIMITATION_VISIBILITY.PUBLIC_LIMITATION
  });
});

test('articleSectionSummary reports guardrail-only limitations when only do_not_claim exists', () => {
  const summary = articleSectionSummary({
    article_sections: {
      verified_facts: ['CameraX 1.5.0 was released.'],
      background_context: 'CameraX sits above Camera2.',
      hal_driver_impact: 'Check stream and metadata compatibility.',
      action_items: ['Run Camera ITS preview tests.'],
      team_share_points: 'Use this release as a validation trigger.',
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    }
  });

  assert.equal(summary.has_limitations, false);
  assert.equal(summary.has_do_not_claim, true);
  assert.equal(summary.limitation_visibility, LIMITATION_VISIBILITY.GUARDRAIL_ONLY);
});
