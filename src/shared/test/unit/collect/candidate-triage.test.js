const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_TRIAGE_POOL,
  TRIAGE_MODES,
  parseTriageSelection,
  triageCandidatePool
} = require('../../../collect/candidate-triage');

function candidate(index, overrides = {}) {
  return {
    source_id: `source-${index % 3}`,
    source_name: `Source ${index % 3}`,
    source_priority: 'medium',
    title: `Candidate ${index}`,
    url: `https://example.com/${index}`,
    publishedAt: '2026-09-30',
    summary: `Summary ${index}`,
    ...overrides
  };
}

function pool(size) {
  return Array.from({ length: size }, (_, index) => candidate(index));
}

test('a pool that already fits the cap skips the llm', async () => {
  let called = false;
  const items = pool(3);
  const result = await triageCandidatePool(items, {
    maxFinal: 5,
    keywordFallback: items,
    callLlm: async () => { called = true; return { selected: [] }; }
  });

  assert.equal(called, false);
  assert.equal(result.report.mode, TRIAGE_MODES.ALL_FIT);
  assert.deepEqual(result.candidates, items);
});

// LLM이 없으면 풀이 작아도 예전 결과(relevance 하한 적용)를 그대로 쓴다.
test('without an llm even a small pool uses the keyword result', async () => {
  const items = pool(3);
  const keywordFallback = items.slice(0, 1);
  const result = await triageCandidatePool(items, { maxFinal: 5, keywordFallback });

  assert.equal(result.report.mode, TRIAGE_MODES.KEYWORD_FALLBACK);
  assert.equal(result.report.failure_reason, 'llm_unavailable');
  assert.deepEqual(result.candidates, keywordFallback);
});

// 폴백 목록에만 있는 후보(풀 밖의 같은 소스 9번째 글, 같은 시리즈의 다른 패치)로는 채우지 않는다.
test('keyword fill only uses candidates that are in the triage pool', async () => {
  const items = pool(4);
  const outsidePool = candidate(99, { source_id: 'source-0' });
  const result = await triageCandidatePool(items, {
    maxFinal: 3,
    keywordFallback: [outsidePool, { ...items[2] }],
    callLlm: async () => ({ selected: [{ id: 'c1' }] })
  });

  assert.deepEqual(result.candidates.map(item => item.title), ['Candidate 0', 'Candidate 2']);
  assert.equal(result.report.filled_by_keyword_count, 1);
});

// 2026-10-05 실측: 키워드 순서로는 상한 밖이던 Claude Sonnet 5.5를 LLM이 고르면 그대로 넘어간다.
test('the llm choice replaces keyword order and keyword order fills the rest', async () => {
  const items = pool(6);
  const keywordFallback = items.slice(0, 3);
  let prompt = '';
  const result = await triageCandidatePool(items, {
    maxFinal: 3,
    keywordFallback,
    callLlm: async (system, userPrompt) => {
      prompt = userPrompt;
      return { selected: [{ id: 'c6', reason: 'model release' }, { id: 'c2' }] };
    }
  });

  assert.match(prompt, /"id":"c6".*"title":"Candidate 5"/);
  assert.equal(result.report.mode, TRIAGE_MODES.LLM);
  assert.deepEqual(result.candidates.map(item => item.title), ['Candidate 5', 'Candidate 1', 'Candidate 0']);
  assert.equal(result.report.llm_selected_count, 2);
  assert.equal(result.report.filled_by_keyword_count, 1);
  assert.equal(result.report.llm_selected[0].reason, 'model release');
  assert.equal(result.report.not_selected_count, 3);
});

test('the selection keeps only known ids, once each, up to the cap', () => {
  const items = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
  const picks = parseTriageSelection({
    selected: [{ id: 'c9' }, { id: 'c2' }, { id: 'c2' }, { id: ' c1 ' }, { id: 'c3' }]
  }, items, 2);

  assert.deepEqual(picks.map(pick => pick.index), [1, 0]);
});

test('llm failures fall back to the keyword result', async () => {
  const items = pool(6);
  const keywordFallback = items.slice(0, 3);

  for (const [callLlm, reason] of [
    [null, 'llm_unavailable'],
    [async () => { throw new Error('GEMINI_API_KEY is missing'); }, 'llm_call_failed: GEMINI_API_KEY is missing'],
    [async () => ({ selected: [{ id: 'nope' }] }), 'llm_selected_nothing'],
    [async () => ({}), 'llm_selected_nothing']
  ]) {
    const result = await triageCandidatePool(items, { maxFinal: 3, keywordFallback, callLlm });
    assert.equal(result.report.mode, TRIAGE_MODES.KEYWORD_FALLBACK);
    assert.equal(result.report.failure_reason, reason);
    assert.deepEqual(result.candidates, keywordFallback);
  }
});

test('the prompt is bounded to the top of the keyword-ordered pool', async () => {
  const items = pool(MAX_TRIAGE_POOL + 5);
  let prompt = '';
  await triageCandidatePool(items, {
    maxFinal: 2,
    keywordFallback: items.slice(0, 2),
    callLlm: async (system, userPrompt) => { prompt = userPrompt; return { selected: [{ id: 'c1' }] }; }
  });

  assert.equal(prompt.split('\n').filter(line => line.startsWith('{')).length, MAX_TRIAGE_POOL);
});

test('triage preserves list-date and developer evidence beyond the summary preview', async () => {
  const behavior = 'It pairs well with larger models as a subagent on coding work.';
  const items = [candidate(0), candidate(1, {
    publishedAt: '', effective_date: '2026-10-07', date_source: 'release_row_date',
    date_evidence_url: 'https://example.com/news', title: 'Small model release',
    summary: 'Overview. '.repeat(60), api_or_component: 'Small model 5.5',
    behavior_change: behavior,
    source_extraction: { workflow: { sections: [{ items: [{ text: behavior }] }] } }
  })];
  const result = await triageCandidatePool(items, {
    maxFinal: 1, keywordFallback: [],
    callLlm: async (system, prompt) => {
      const input = JSON.parse(prompt.split('\n').find(line => line.startsWith('{"id":"c2"')));
      assert.equal(input.published, '2026-10-07');
      assert.equal(input.date_source, 'release_row_date');
      assert.equal(input.date_evidence_url, items[1].date_evidence_url);
      assert.equal(input.behavior_change, behavior);
      assert.deepEqual(input.workflow_evidence, [behavior]);
      assert.equal(input.summary.length, 280);
      return { selected: [{ id: 'c1' }] };
    }
  });
  assert.equal(result.report.not_selected[0].url, items[1].url);
  assert.equal(result.report.not_selected[0].reason, 'not_selected_by_llm_or_keyword_fill');
  assert.equal(result.report.not_selected[0].triage_input.behavior_change, behavior);
});

test('diagnostics distinguish pool cap exclusion from an actual triage decision', async () => {
  const items = pool(MAX_TRIAGE_POOL + 1);
  const result = await triageCandidatePool(items, {
    maxFinal: 1, keywordFallback: [], callLlm: async () => ({ selected: [{ id: 'c1' }] })
  });
  assert.equal(result.report.not_selected.length, MAX_TRIAGE_POOL);
  assert.equal(result.report.not_selected.at(-1).reason, 'triage_pool_cap');
  assert.equal(result.report.not_selected.at(-1).triage_input, undefined);
});
