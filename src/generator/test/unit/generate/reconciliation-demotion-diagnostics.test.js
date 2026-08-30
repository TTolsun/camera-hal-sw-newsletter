'use strict';

// #914: 재조정 강등 사유가 사람이 먼저 읽는 selection-diagnostics.md에 나타나야 한다.
//
// #909가 사유를 커밋되는 generation-status.json까지 올렸지만 markdown에는 editor가 선언한
// 강등 한 줄(`Explicitly demoted groups`)만 있었다. 그래서 재조정이 4그룹을 내린 주
// (2026-08-17)에도 문서는 "0"만 보여줬다. 두 강등은 출처가 다르므로 한 줄로 접지 않는다.
//
// coverage_decision은 editorial-plan LLM이 쓴 자유 문자열이라 markdown 제어문자가 그대로
// 들어온다. 렌더가 그것을 그대로 흘리면 목록이 끊기거나 링크·코드로 재해석된다.
const assert = require('node:assert/strict');
const test = require('node:test');

const { reconcileCoverage } = require('../../../select/coverage-reconciliation');
const {
  renderCandidateSelectionDiagnostics,
  selectionDiagnosticsFromReports
} = require('../../../select/selection-diagnostics');
const { selectionStatusExtra } = require('../../../publish/orchestrator-status-builders');

function candidate(url, overrides = {}) {
  return {
    url,
    url_hash: url,
    title: url,
    article_group_key: `group:${url}`,
    relevance_bucket: 'direct_aosp_camera',
    deterministic_score: 60,
    main_article_source_allowed: true,
    main_article_score_eligible: true,
    ...overrides
  };
}

function plan(url, coverageDecision) {
  return { url, coverage_decision: coverageDecision, impact_level: 'medium' };
}

function deterministicReport(urls) {
  const selected = urls.map(url => candidate(url));
  return {
    selected_articles: selected,
    primary_selected_articles: selected,
    reserve_candidates: [],
    selected_article_count: selected.length,
    selected_group_count: selected.length,
    selected_representative_group_keys: selected.map(item => item.article_group_key),
    deterministic_selected_count: selected.length,
    review_gate_passed: true,
    publish_gate_passed: true
  };
}

// 재조정 이후 orchestrator가 shortlistReport에 대입하는 필드를 그대로 재현한다
// (gemini-newsroom-newsletter.js). 렌더는 production writer와 같은 seam
// (selectionStatusExtra)을 통과해야 status allow-list 누락을 놓치지 않는다.
function applyReconciliation(shortlistReport, editorialPlanReport) {
  const result = reconcileCoverage({ shortlistReport, editorialPlanReport });
  Object.assign(shortlistReport, result.selection_summary, {
    selected_articles: result.selected,
    reconciliation_demoted_group_keys: result.diff.demoted_group_keys,
    reconciliation_demoted_groups: result.diff.demoted_groups,
    reconciliation_promoted_group_keys: result.diff.promoted_group_keys,
    deterministic_selected_representative_group_keys: result.diff.deterministic_selected_group_keys
  });
  return result;
}

function lineStartingWith(markdown, prefix) {
  return markdown.split('\n').find(line => line.startsWith(prefix)) || null;
}

test('재조정 강등은 editor 강등과 다른 줄에, 그룹·후보 사유까지 렌더된다', () => {
  const shortlistReport = deterministicReport(['a', 'sony', 'lore']);
  applyReconciliation(shortlistReport, {
    editorial_plans: [
      plan('a', 'main_article'),
      plan('sony', 'reference_only'),
      plan('lore', 'exclude')
    ]
  });

  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  });
  const markdown = renderCandidateSelectionDiagnostics(status);

  // editor가 선언한 강등은 0건 그대로다. 이 값이 재조정 강등을 흡수하면 안 된다.
  assert.match(markdown, /^- Explicitly demoted groups \(editor\): 0$/m);
  assert.match(markdown, /^- Reconciliation-demoted groups: 2$/m);
  assert.match(markdown, /^ {2}- group:sony$/m);
  assert.match(
    markdown,
    /^ {4}- sony: coverage_decision=reference_only, reason_code=editorial_plan_reference_only$/m
  );
  assert.match(markdown, /^ {2}- group:lore$/m);
  assert.match(
    markdown,
    /^ {4}- lore: coverage_decision=exclude, reason_code=editorial_plan_exclude$/m
  );
});

test('재조정 강등이 없는 실행과 관측이 없는 실행을 구분해 렌더한다', () => {
  // 0건("확인해 보니 없었다")과 unknown("이 실행은 관측하지 않았다")은 다른 사실이다.
  const shortlistReport = deterministicReport(['a']);
  const status = selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  });
  const markdown = renderCandidateSelectionDiagnostics(status);

  assert.match(markdown, /^- Reconciliation-demoted groups: 0$/m);
  assert.equal(lineStartingWith(markdown, '  - group:'), null, '강등이 없으면 하위 항목도 없다');

  const legacy = renderCandidateSelectionDiagnostics(selectionDiagnosticsFromReports({}, null));
  assert.match(legacy, /^- Reconciliation-demoted groups: unknown$/m);
});

test('그룹 키만 남은 실행에서도 개수를 세고 사유 없음을 명시한다', () => {
  // #909 이전 run은 reconciliation_demoted_group_keys만 남겼다(2026-08-17 커밋 산출물).
  // 사유가 없다고 그룹을 통째로 숨기면 markdown이 다시 "0건"으로 읽힌다.
  const shortlistReport = deterministicReport(['a']);
  shortlistReport.reconciliation_demoted_group_keys = ['group:b', 'group:c'];

  const markdown = renderCandidateSelectionDiagnostics(selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  }));

  assert.match(markdown, /^- Reconciliation-demoted groups: 2$/m);
  assert.match(markdown, /^ {2}- group:b$/m);
  assert.match(markdown, /^ {4}- no per-candidate reason recorded$/m);
});

test('LLM이 쓴 coverage_decision이 markdown 구조를 깨거나 재해석되지 않는다', () => {
  // coverage_decision은 스키마상 자유 문자열이다(enum 없음). 개행 하나면 목록이 끊기고,
  // 백틱·링크 문법은 그대로 재해석된다.
  const hostile = 'main | `code`\n[link](https://example.com) <b>x</b> *em* ~~strike~~ a&amp;b trail\\';
  const shortlistReport = deterministicReport(['a', 'sony']);
  applyReconciliation(shortlistReport, {
    editorial_plans: [plan('a', 'main_article'), plan('sony', hostile)]
  });

  const markdown = renderCandidateSelectionDiagnostics(selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: ['group:a'],
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  }));

  const candidateLine = lineStartingWith(markdown, '    - sony:');
  assert.ok(candidateLine, '후보 줄이 있어야 한다');
  // 개행이 접혀 한 줄로 남고, 사유 코드까지 같은 줄에 붙어 있다.
  assert.match(candidateLine, /reason_code=editorial_plan_unrecognized$/);
  assert.match(candidateLine, /\\\[link\\\]/, '링크 문법은 escape된 문자로 남는다');
  for (const char of ['`', '|', '[', ']', '(', ')', '<', '>', '*', '~', '&']) {
    const index = candidateLine.indexOf(char);
    assert.notEqual(index, -1, `원문 문자 ${char}는 보존한다`);
    assert.equal(candidateLine[index - 1], '\\', `${char}는 escape돼야 한다`);
  }
  // `~~`는 취소선, `&amp;`는 HTML entity로 디코딩된다. 둘 다 LLM이 쓰지 않은 것을 보여준다.
  assert.match(candidateLine, /\\~\\~strike\\~\\~/, '취소선으로 재해석되지 않는다');
  assert.match(candidateLine, /a\\&amp;b/, 'entity가 `a&b`로 디코딩되지 않는다');
  // 값 끝의 backslash를 escape하지 않으면 뒤따르는 구분자가 escape 대상이 돼 사라진다.
  assert.match(
    candidateLine,
    /trail\\\\, reason_code=/,
    'backslash 자신이 escape돼야 뒤의 구분자를 삼키지 않는다'
  );
  assert.equal(markdown.split('\n').filter(line => line.includes('example.com')).length, 1);
});

test('값 첫머리의 블록 마커가 목록 항목을 heading·중첩목록·번호목록으로 바꾸지 않는다', () => {
  // 값은 `    - ` 바로 뒤에 놓여 목록 항목 본문으로 파싱되므로 첫 문자가 줄머리 마커가 된다.
  // candidate_key는 url_hash || url || title이라 둘이 모두 없으면 기사 제목이 이 자리에 온다.
  const markdown = renderCandidateSelectionDiagnostics({
    reconciliation_demoted_group_keys: ['# heading group', '- nested group', '1. ordered group'],
    reconciliation_demoted_groups: [
      { article_group_key: '# heading group', demoted_candidates: [{ candidate_key: '# 1/3 media: fix uvc', coverage_decision: '- dash lead', reason_code: 'cap_clamp' }] },
      { article_group_key: '- nested group', demoted_candidates: [{ candidate_key: '+ plus lead', coverage_decision: '1) paren lead', reason_code: 'cap_clamp' }] },
      { article_group_key: '1. ordered group', demoted_candidates: [{ candidate_key: '1. intro', coverage_decision: '> quote lead', reason_code: 'unknown' }] }
    ]
  });

  assert.match(markdown, /^ {2}- \\# heading group$/m);
  assert.match(markdown, /^ {2}- \\- nested group$/m);
  assert.match(markdown, /^ {2}- 1\\\. ordered group$/m);
  assert.match(markdown, /^ {4}- \\# 1\/3 media: fix uvc: coverage_decision=\\- dash lead, /m);
  // `1)`은 줄머리 규칙이 아니라 전역 pass가 막는다(`)`가 escape 대상이라 `1\)`가 된다).
  assert.match(markdown, /^ {4}- \\\+ plus lead: coverage_decision=1\\\) paren lead, /m);
  assert.match(markdown, /^ {4}- 1\\\. intro: coverage_decision=\\> quote lead, /m);
});

test('밑줄은 강조로 재해석될 때만 escape하고 snake_case는 그대로 읽힌다', () => {
  // coverage_decision은 enum 없는 자유 문자열이라 LLM이 산문을 쓸 수 있다. `_because_`가
  // 기울임으로 바뀌면 사람이 읽는 artifact에서 밑줄 자체가 사라진다.
  const markdown = renderCandidateSelectionDiagnostics({
    reconciliation_demoted_group_keys: ['group:a'],
    reconciliation_demoted_groups: [{
      article_group_key: 'group:a',
      demoted_candidates: [{
        candidate_key: 'a',
        coverage_decision: 'demoted _because_ of cap',
        reason_code: 'editorial_plan_unrecognized'
      }]
    }]
  });

  const candidateLine = lineStartingWith(markdown, '    - a:');
  assert.match(candidateLine, /coverage_decision=demoted \\_because\\_ of cap,/);
  assert.match(candidateLine, /reason_code=editorial_plan_unrecognized$/, 'snake_case는 escape하지 않는다');
});

test('사유가 빈 문자열이면 none, 필드가 없으면 unknown으로 갈라 적는다', () => {
  // 편집 계획이 언급하지 않은 후보가 cap clamp로 빠지면 coverage_decision은 빈 문자열이다
  // (coverage-reconciliation.js의 `entryFor(candidate)?.coverage_decision || ''`).
  // 이 어휘가 LLM이 실제로 "none"이라고 답한 것과 구분되지 않으면 사후 판독이 불가능하다.
  const planned = ['a1', 'a2', 'a3', 'a4', 'a5'];
  const shortlistReport = deterministicReport([...planned, 'unplanned']);
  applyReconciliation(shortlistReport, {
    // impact가 없는 후보(계획 미등재)가 clamp 순서에서 마지막이라 cap max=5에 밀린다.
    editorial_plans: planned.map(url => ({ url, coverage_decision: 'main_article', impact_level: 'high' }))
  });

  const markdown = renderCandidateSelectionDiagnostics(selectionStatusExtra(shortlistReport, {
    renderedGroupKeys: planned.map(url => `group:${url}`),
    explicitlyDemotedGroups: [],
    hardBlockedGroups: []
  }));

  assert.match(markdown, /^- Reconciliation-demoted groups: 1$/m);
  assert.match(
    markdown,
    /^ {4}- unplanned: coverage_decision=none, reason_code=cap_clamp$/m,
    '빈 사유는 none이고, main 제안까지 갔다가 빠진 원인은 cap이다'
  );

  // 필드 자체가 없는 레코드는 none이 아니라 unknown이다.
  const missing = renderCandidateSelectionDiagnostics({
    reconciliation_demoted_group_keys: ['group:a'],
    reconciliation_demoted_groups: [{ article_group_key: 'group:a', demoted_candidates: [{ candidate_key: 'a' }] }]
  });
  assert.match(missing, /^ {4}- a: coverage_decision=unknown, reason_code=unknown$/m);
});

test('그룹 키가 falsy여도 기록된 후보 사유를 잃지 않는다', () => {
  // 적재(`|| ''`)와 조회(`String(null)` -> `'null'`)의 정규화가 어긋나면 사유가 있는데도
  // "no per-candidate reason recorded"가 찍힌다. 오늘의 생산자는 falsy 키를 걸러내지만
  // (coverage-reconciliation.js), 렌더가 기록을 버리는 방향으로 틀리면 안 된다.
  const markdown = renderCandidateSelectionDiagnostics({
    reconciliation_demoted_groups: [{
      article_group_key: null,
      demoted_candidates: [{ candidate_key: 'k1', coverage_decision: 'main_article', reason_code: 'cap_clamp' }]
    }]
  });

  assert.match(markdown, /^- Reconciliation-demoted groups: 1$/m);
  assert.match(markdown, /^ {2}- unknown$/m, '키는 unknown으로 적되');
  assert.match(
    markdown,
    /^ {4}- k1: coverage_decision=main_article, reason_code=cap_clamp$/m,
    '사유는 그대로 남아야 한다'
  );
  assert.doesNotMatch(markdown, /no per-candidate reason recorded/);
});

test('서로 다른 falsy 그룹 키가 한 칸을 공유해 남의 사유를 뒤집어쓰지 않는다', () => {
  // `String(value || '')`로 접으면 null과 ''가 같은 Map 키가 되어 뒤 그룹이 앞 그룹을 덮는다.
  // 그러면 앞 그룹의 사유가 사라지는 데서 끝나지 않고, 두 그룹 모두에 뒤 그룹의 사유가 찍힌다 —
  // 기록을 잃는 것보다 나쁘다.
  const markdown = renderCandidateSelectionDiagnostics({
    reconciliation_demoted_groups: [
      {
        article_group_key: null,
        demoted_candidates: [{ candidate_key: 'first', coverage_decision: 'cd1', reason_code: 'rc1' }]
      },
      {
        article_group_key: '',
        demoted_candidates: [{ candidate_key: 'second', coverage_decision: 'cd2', reason_code: 'rc2' }]
      }
    ]
  });

  assert.match(markdown, /^- Reconciliation-demoted groups: 2$/m);
  assert.match(
    markdown,
    /^ {4}- first: coverage_decision=cd1, reason_code=rc1$/m,
    '앞 그룹의 사유가 남아야 한다'
  );
  assert.match(
    markdown,
    /^ {4}- second: coverage_decision=cd2, reason_code=rc2$/m,
    '뒤 그룹의 사유도 남아야 한다'
  );
  assert.equal(markdown.match(/- second: coverage_decision=cd2/g).length, 1, '남의 그룹에 복제되지 않아야 한다');
});
