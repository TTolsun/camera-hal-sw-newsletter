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

function qualifiedTool(index, overrides = {}) {
  return candidate(index, {
    relevance_bucket: 'cpp_ai_tooling_fallback', main_eligible: true,
    main_article_source_allowed: true, source_gap_risk: false,
    has_dated_evidence: true, reference_only: false, ...overrides
  });
}

test('independent developer coverage survives an LLM omission without raising the collection cap', async () => {
  const items = [candidate(0, { relevance_bucket: 'direct_aosp_camera' }),
    candidate(1, { relevance_bucket: 'camera_driver_image_pipeline' }), qualifiedTool(2)];
  const result = await triageCandidatePool(items, {
    maxFinal: 2, keywordFallback: items.slice(0, 2),
    callLlm: async () => ({ selected: [{ id: 'c1' }, { id: 'c2' }] })
  });
  assert.deepEqual(result.candidates, [items[0], items[2]]);
  assert.equal(result.report.coverage_preserved[0].url, items[2].url);
  assert.equal(result.report.not_selected[0].reason, 'coverage_priority_displaced');
  assert.equal(items[2].main_eligible, true);
});

test('coverage does not rescue missing evidence, source-blocked or reference-only developer items', async () => {
  for (const override of [
    { main_eligible: false }, { main_article_source_allowed: false },
    { source_gap_risk: true }, { has_dated_evidence: false }, { reference_only: true },
    { source_quality: { main_article_source_allowed: false } }
  ]) {
    const items = [candidate(0), qualifiedTool(1, override)];
    const result = await triageCandidatePool(items, {
      maxFinal: 1, keywordFallback: [], callLlm: async () => ({ selected: [{ id: 'c1' }] })
    });
    assert.deepEqual(result.candidates, [items[0]]);
    assert.equal(result.report.coverage_preserved.length, 0);
  }
});

test('coverage honors bounded pools and never displaces equal or higher editorial priority', async () => {
  for (const bucket of ['direct_aosp_camera', 'cpp_ai_tooling_fallback']) {
    const items = [candidate(0, { relevance_bucket: bucket }), qualifiedTool(1)];
    const result = await triageCandidatePool(items, {
      maxFinal: 1, keywordFallback: [], callLlm: async () => ({ selected: [{ id: 'c1' }] })
    });
    assert.deepEqual(result.candidates, [items[0]]);
  }
  const items = [...pool(MAX_TRIAGE_POOL), qualifiedTool(MAX_TRIAGE_POOL)];
  const result = await triageCandidatePool(items, {
    maxFinal: 1, keywordFallback: [], callLlm: async () => ({ selected: [{ id: 'c1' }] })
  });
  assert.deepEqual(result.candidates, [items[0]]);
});

test('coverage prefers recent eligible evidence without hardcoding a model or source', async () => {
  const items = [candidate(0), qualifiedTool(1), qualifiedTool(2, { effective_date: '2026-10-07' })];
  const result = await triageCandidatePool(items, {
    maxFinal: 1, keywordFallback: [], callLlm: async () => ({ selected: [{ id: 'c1' }] })
  });
  assert.deepEqual(result.candidates, [items[2]]);
  const alreadySelected = await triageCandidatePool(items, {
    maxFinal: 1, keywordFallback: [], callLlm: async () => ({ selected: [{ id: 'c2' }] })
  });
  assert.deepEqual(alreadySelected.candidates, [items[1]]);
  assert.equal(alreadySelected.report.coverage_preserved.length, 0);
});

// 판단 풀은 일부 소스에 소스별 상한보다 많은 후보를 줄 수 있다(TRIAGE_POOL_CAP_OVERRIDES). 그래도
// 넘기는 후보는 소스당 maxPerSource를 넘지 않고, LLM이 앞에 둔 후보부터 남는다.
test('the llm chooses which candidates of a wide source pass, but never more than maxPerSource', async () => {
  const wide = Array.from({ length: 6 }, (_, index) => candidate(index, { source_id: 'wide' }));
  const others = Array.from({ length: 4 }, (_, index) => candidate(10 + index, { source_id: `other-${index}` }));
  const items = [...wide, ...others];
  const result = await triageCandidatePool(items, {
    maxFinal: 5,
    maxPerSource: 2,
    // 폴백(키워드 순서)도 wide를 앞세우지만, 채움에서도 상한을 지킨다.
    keywordFallback: [wide[0], wide[1], others[0], others[1], others[2]],
    callLlm: async () => ({ selected: [{ id: 'c6' }, { id: 'c5' }, { id: 'c4' }] }) // id는 1부터: wide[5], wide[4], wide[3]
  });

  assert.equal(result.report.mode, TRIAGE_MODES.LLM);
  assert.deepEqual(result.candidates.map(item => item.url), [
    'https://example.com/5', 'https://example.com/4',
    'https://example.com/10', 'https://example.com/11', 'https://example.com/12'
  ]);
  // LLM이 고른 것은 그대로 보고하고, 상한에 걸린 선택은 따로 남긴다.
  assert.equal(result.report.llm_selected_count, 3);
  assert.deepEqual(result.report.source_cap_rejected.map(entry => entry.url), ['https://example.com/3']);
  assert.equal(result.report.not_selected.find(entry => entry.url === 'https://example.com/3').reason, 'source_cap_after_llm');
});

// 전체가 상한 안에 들어가도 소스별 상한이 누군가를 떨어뜨려야 하면 키워드 순서가 아니라 LLM이 고른다.
test('a pool that fits but overflows a source cap goes to the llm', async () => {
  const items = Array.from({ length: 4 }, (_, index) => candidate(index, { source_id: 'wide' }));
  const result = await triageCandidatePool(items, {
    maxFinal: 5, maxPerSource: 2, keywordFallback: items, callLlm: async () => ({ selected: [{ id: 'c4' }, { id: 'c3' }] })
  });
  assert.equal(result.report.mode, TRIAGE_MODES.LLM);
  assert.deepEqual(result.candidates, [items[3], items[2]]);
});

test('independent coverage does not push a source past maxPerSource', async () => {
  const items = [candidate(0, { source_id: 'tools' }), qualifiedTool(1, { source_id: 'tools' }), candidate(2, { source_id: 'other' })];
  const result = await triageCandidatePool(items, {
    maxFinal: 2, maxPerSource: 1, keywordFallback: [],
    callLlm: async () => ({ selected: [{ id: 'c1' }, { id: 'c3' }] })
  });
  assert.equal(result.candidates.filter(item => item.source_id === 'tools').length, 1);
  assert.deepEqual(result.report.coverage_preserved, []);
});
