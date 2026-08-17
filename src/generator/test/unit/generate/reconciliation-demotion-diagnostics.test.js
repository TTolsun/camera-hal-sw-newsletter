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
      plan('lore', 'short_mention')
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
    /^ {4}- lore: coverage_decision=short_mention, reason_code=editorial_plan_short_mention$/m
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
  const hostile = 'main | `code`\n[link](https://example.com) <b>x</b> *em*';
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
  for (const char of ['`', '|', '[', ']', '(', ')', '<', '>', '*']) {
    const index = candidateLine.indexOf(char);
    assert.notEqual(index, -1, `원문 문자 ${char}는 보존한다`);
    assert.equal(candidateLine[index - 1], '\\', `${char}는 escape돼야 한다`);
  }
  assert.equal(markdown.split('\n').filter(line => line.includes('example.com')).length, 1);
});
