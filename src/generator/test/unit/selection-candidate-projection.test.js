'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  buildCandidateDiagnostics,
  MAX_CANDIDATE_ROWS
} = require('../../select/selection-candidate-projection');

function candidate(url, overrides = {}) {
  return {
    normalized_url: url,
    freshness_window: 'primary',
    relevance_bucket: 'direct_aosp_camera',
    final_selection_eligibility: 'main',
    score_breakdown: { base_total: 50, total: 50, camera_hal_directness: 3, scope_relevance: 3 },
    ...overrides
  };
}

test('선정·예비·탈락 후보를 stage로 구분해 싣는다', () => {
  const result = buildCandidateDiagnostics({
    selected_articles: [candidate('https://a.test')],
    reserve_candidates: [candidate('https://b.test')],
    excluded_candidates: [candidate('https://c.test', { final_exclusion_reasons: ['missing dated evidence'] })]
  });
  assert.deepStrictEqual(result.rows.map(row => [row.url, row.stage]), [
    ['https://a.test', 'selected'],
    ['https://b.test', 'reserve'],
    ['https://c.test', 'excluded']
  ]);
  assert.strictEqual(result.count, 3);
});

test('같은 후보가 여러 배열에 있으면 우선순위가 높은 stage 하나만 남는다', () => {
  const result = buildCandidateDiagnostics({
    selected_articles: [candidate('https://a.test')],
    shortlisted_candidates: [candidate('https://a.test')]
  });
  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.rows[0].stage, 'selected');
});

test('탈락 사유를 후보별로 남긴다 — 합계로는 후보 단위를 복원할 수 없다', () => {
  const result = buildCandidateDiagnostics({
    excluded_candidates: [
      candidate('https://a.test', { final_exclusion_reasons: ['missing dated evidence', 'source_gap_risk=true'] })
    ]
  });
  assert.deepStrictEqual(result.rows[0].exclusion_reasons, [
    'missing dated evidence',
    'source_gap_risk=true'
  ]);
});

test('final_exclusion_reasons가 비면 exclusion_reasons로 떨어진다', () => {
  const result = buildCandidateDiagnostics({
    excluded_candidates: [
      candidate('https://a.test', { final_exclusion_reasons: [], exclusion_reasons: ['briefing_only=true'] })
    ]
  });
  assert.deepStrictEqual(result.rows[0].exclusion_reasons, ['briefing_only=true']);
});

test('base_total과 total이 같으면 total은 싣지 않는다', () => {
  const same = buildCandidateDiagnostics({ selected_articles: [candidate('https://a.test')] });
  assert.strictEqual(same.rows[0].base_total, 50);
  assert.ok(!('total' in same.rows[0]));

  const adjusted = buildCandidateDiagnostics({
    selected_articles: [candidate('https://b.test', { score_breakdown: { base_total: 40, total: 42 } })]
  });
  assert.strictEqual(adjusted.rows[0].base_total, 40);
  assert.strictEqual(adjusted.rows[0].total, 42);
});

test('빈 값은 행에 남기지 않는다', () => {
  const result = buildCandidateDiagnostics({
    excluded_candidates: [{ normalized_url: 'https://a.test', relevance_bucket: '', score_breakdown: {} }]
  });
  const row = result.rows[0];
  assert.deepStrictEqual(Object.keys(row), ['url', 'stage']);
});

test('URL 없는 후보는 식별할 수 없으므로 싣지 않는다', () => {
  const result = buildCandidateDiagnostics({
    excluded_candidates: [{ title: 'no url', score_breakdown: { base_total: 10 } }]
  });
  assert.strictEqual(result.count, 0);
});

test('통과선을 함께 기록해 나중에 기준 없이 해석하지 않게 한다', () => {
  const result = buildCandidateDiagnostics({
    selected_articles: [candidate('https://a.test')],
    selection_policy: { main_article_score_threshold: 42 }
  });
  assert.strictEqual(result.score_threshold, 42);
});

test('cap을 넘으면 잘린 사실을 표시한다', () => {
  const many = Array.from({ length: MAX_CANDIDATE_ROWS + 5 }, (_, index) => candidate(`https://a${index}.test`));
  const result = buildCandidateDiagnostics({ excluded_candidates: many });
  assert.strictEqual(result.count, MAX_CANDIDATE_ROWS);
  assert.strictEqual(result.truncated, true);
});

test('정상 규모에서는 잘리지 않는다', () => {
  const pool = Array.from({ length: 72 }, (_, index) => candidate(`https://a${index}.test`));
  const result = buildCandidateDiagnostics({ excluded_candidates: pool });
  assert.strictEqual(result.truncated, false);
  assert.strictEqual(result.count, 72);
});

test('입력이 비어도 던지지 않는다', () => {
  const result = buildCandidateDiagnostics();
  assert.deepStrictEqual(result.rows, []);
  assert.strictEqual(result.truncated, false);
  assert.strictEqual(result.score_threshold, null);
});

test('자격 심사 이전에 빠진 후보 수를 남긴다', () => {
  const result = buildCandidateDiagnostics({
    input_candidate_count: 59,
    selected_articles: [candidate('https://a.test')],
    excluded_candidates: [candidate('https://b.test')]
  });
  assert.strictEqual(result.count, 2);
  assert.strictEqual(result.input_count, 59);
  assert.strictEqual(result.not_evaluated, 57);
});

test('입력 수를 모르면 not_evaluated를 추측하지 않는다', () => {
  const result = buildCandidateDiagnostics({ selected_articles: [candidate('https://a.test')] });
  assert.strictEqual(result.input_count, null);
  assert.strictEqual(result.not_evaluated, null);
});
