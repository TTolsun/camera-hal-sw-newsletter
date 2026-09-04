const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

// #908: 2026-08-17 실행이 diagnostics-only로 끝난 배선 결함을 계약으로 고정한다.
// 재조정이 결정론 5그룹을 1그룹으로 줄였는데, editor에게 넘어가는 background context만 재조정 전
// selected 뷰로 남아 editor가 이미 main에서 빠진 4그룹을 explicitly_demoted_groups에 선언했고,
// 그 선언이 선택 집합 밖이라 커버리지 등식이 1 !== 1 + 4로 깨졌다.
//
// 모듈 단위 테스트(background-context-selection.test.js)는 filterBackgroundContextToSelected 안쪽만
// 보므로, 호출부가 이 재동기화를 빼도 전 테스트가 초록이다. 그래서 배선 자체를 소스 텍스트로
// 고정한다. 같은 방식의 선례는 reference-articles-wiring.test.js·prompt-contract.test.js에 있다.
function publishHostSource() {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
}

test('the editor stage receives the background context narrowed to the reconciled main set', () => {
  const source = publishHostSource();

  // #879로 최종 main 집합의 이름이 finalSelected가 됐다(재조정 결과 + release-class catch-up
  // 2차 pass 승급분). 좁히기 기준은 그대로 "editor가 실제로 쓸 최종 집합"이다.
  assert.match(
    source,
    /backgroundContextReport: filterBackgroundContextToSelected\(backgroundContextReport, finalSelected\)/,
    'editor 인자에서 background context를 최종 편성으로 좁힌다'
  );
});

test('the narrowing is scoped to the editor stage and does not overwrite the shared report', () => {
  const source = publishHostSource();

  // 공유 변수를 덮어쓰면 completion 단계(orchestrator-repair-completion.js)까지 좁혀져,
  // reserve 후보를 추가 기사로 승격할 때 그 후보의 배경이 사라진다. #908이 고치려는 실패는
  // editor 단계에서만 일어나므로 좁히기도 그 호출 인자에만 건다.
  assert.doesNotMatch(
    source,
    /backgroundContextReport = filterBackgroundContextToSelected\(/,
    '공유 backgroundContextReport 변수를 덮어쓰지 않는다'
  );

  // artifact는 LLM이 만든 원본을 그대로 남긴다 — 강등된 기사의 배경까지 남아야 사후 추적이 된다.
  const writes = source.match(/writeJson\(path\.join\(newsroomDir, 'background-context\.json'\), backgroundContextReport\);/g) || [];
  assert.equal(writes.length, 2, 'background-context.json 기록은 정적 fallback·LLM 결과 두 곳뿐이다');
});

test('the narrowing happens after reconciliation resolves the main set', () => {
  const source = publishHostSource();

  const reconcileIndex = source.indexOf('reconcileCoverage({');
  const narrowIndex = source.indexOf('backgroundContextReport: filterBackgroundContextToSelected(');
  const editorStageIndex = source.indexOf('runEditorStage({');

  assert.ok(reconcileIndex > 0, 'reconcileCoverage 호출을 찾지 못했다');
  assert.ok(editorStageIndex > 0, 'runEditorStage 호출을 찾지 못했다');
  assert.ok(
    narrowIndex > reconcileIndex,
    '좁히기는 reconcileCoverage 뒤여야 한다 — 앞이면 재조정 전 편성으로 거른다'
  );
  assert.ok(
    narrowIndex > editorStageIndex,
    '좁히기는 runEditorStage 인자 안에 있다'
  );
});

// #909: 재조정 provenance는 attempt 단위 사실이다. attempt가 재조정 전에 죽으면 직전 attempt의
// 강등 기록이 그대로 커밋되는 status에 실린다(shortlistReport는 attempt 사이에 살아 있다).
// 모듈 테스트로는 잡히지 않는 호출부 계약이라 소스로 고정한다.
test('the publish host clears the reconciliation provenance at the start of each attempt', () => {
  const source = publishHostSource();

  const loopIndex = source.indexOf('for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {');
  const resetIndex = source.indexOf('shortlistReport.reconciliation_demoted_groups = [];');
  const assignIndex = source.indexOf('shortlistReport.reconciliation_demoted_groups = coverageReconciliation.diff.demoted_groups;');

  assert.ok(loopIndex > 0, 'attempt 루프를 찾지 못했다');
  assert.ok(resetIndex > loopIndex, '초기화는 attempt 루프 안에서 일어난다');
  assert.ok(resetIndex < assignIndex, '초기화는 재조정 대입보다 앞이어야 한다');
});

// #1034: 채점 투영도 attempt 단위 사실이다. 재조정 전에 죽은 attempt가 직전 attempt의 채점
// 기록을 그대로 status에 남기면 다른 편성의 판단을 이번 실행 것으로 읽게 된다. #909 강등
// 투영과 같은 수명이라 같은 자리에서 초기화한다.
test('the publish host clears the scored-candidate projection at the start of each attempt', () => {
  const source = publishHostSource();

  const loopIndex = source.indexOf('for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {');
  const resetIndex = source.indexOf('shortlistReport.editorial_plan_scored_candidates = [];');
  const assignIndex = source.indexOf('shortlistReport.editorial_plan_scored_candidates = coverageReconciliation.diff');

  assert.ok(loopIndex > 0, 'attempt 루프를 찾지 못했다');
  assert.ok(resetIndex > loopIndex, '초기화는 attempt 루프 안에서 일어난다');
  assert.ok(resetIndex < assignIndex, '초기화는 재조정 대입보다 앞이어야 한다');
});

// #879: 재조정은 자기 출력이 최종 main이라고 보고 채점 레코드를 만드는데, 2차 pass가 그 뒤에
// main 집합을 더 늘린다. 호스트가 승급분에 사유를 찍지 않으면, 방금 발행 집합에 넣은 기사가
// 레코드에서는 "승급되지 않은 shortlist_only"로 남아 한 artifact가 최종 main을 두 가지로 말한다.
// 대입이 2차 pass보다 뒤에 오는지, 그리고 승급 키로 사유를 덧씌우는지를 소스에서 잠근다.
test('the publish host stamps second-pass promotions into the scored-candidate projection', () => {
  const source = publishHostSource();

  const secondPassIndex = source.indexOf('admitReleaseClassCatchUpAfterReconciliation({');
  const stampIndex = source.indexOf('const catchUpPromotedKeys = new Set(catchUpAfterReconciliation.admitted.map(candidateKey));');
  const assignIndex = source.indexOf('shortlistReport.editorial_plan_scored_candidates = coverageReconciliation.diff');

  assert.ok(secondPassIndex > 0, '2차 pass 호출을 찾지 못했다');
  assert.ok(stampIndex > secondPassIndex, '사유 스탬프는 2차 pass 결과를 받은 뒤에 만들어져야 한다');
  assert.ok(assignIndex > stampIndex, '채점 투영 대입은 스탬프보다 뒤여야 한다');

  const assignBlock = source.slice(assignIndex, assignIndex + 400);
  assert.ok(
    assignBlock.includes('catchUpPromotedKeys.has(record.candidate_key)') &&
      assignBlock.includes('CATCH_UP_PROMOTED_AFTER_RECONCILIATION'),
    '2차 pass 승급분에 재조정 모듈이 정한 사유 상수를 찍어야 한다'
  );
});

// #1034 후속: 재조정은 selected+reserve만 받는데 편집 계획은 shortlisted capsule 전체를
// 채점한다. 호스트가 그 우주를 함께 넘기지 않으면 채점 투영이 계획보다 좁아지고,
// "목록에 없다 = 계획이 채점하지 않았다"는 읽기 규칙이 거짓이 된다.
test('the publish host feeds the plan-scored shortlist into the reconciliation', () => {
  const source = publishHostSource();

  const reconcileIndex = source.indexOf('reconcileCoverage({');
  assert.ok(reconcileIndex > 0, 'reconcileCoverage 호출을 찾지 못했다');
  const callBlock = source.slice(reconcileIndex, source.indexOf('});', reconcileIndex));

  assert.ok(
    callBlock.includes('shortlisted_candidates: reporter.candidates'),
    '재조정 입력이 계획 채점 우주(shortlisted capsule의 출처)를 함께 받아야 한다'
  );
});
