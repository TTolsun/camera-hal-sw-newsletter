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

// #909/#1034: 재조정 provenance는 attempt 단위 사실이다. attempt가 재조정 전에 죽으면 직전
// attempt의 기록이 그대로 커밋되는 status에 실린다(shortlistReport는 attempt 사이에 살아 있다).
// 모듈 테스트로는 잡히지 않는 호출부 계약이라 소스로 고정한다.
test('the publish host clears the reconciliation provenance at the start of each attempt', () => {
  const source = publishHostSource();

  const loopIndex = source.indexOf('for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {');
  const resetIndex = source.indexOf('resetReconciliationProvenance(shortlistReport);');
  const assignIndex = source.indexOf('assignReconciliationProvenance(shortlistReport, coverageReconciliation.diff);');

  assert.ok(loopIndex > 0, 'attempt 루프를 찾지 못했다');
  assert.ok(resetIndex > loopIndex, '초기화는 attempt 루프 안에서 일어난다');
  assert.ok(assignIndex > 0, '재조정 provenance 대입을 찾지 못했다');
  assert.ok(resetIndex < assignIndex, '초기화는 재조정 대입보다 앞이어야 한다');
});

// #879 후속: 2차 pass 승급분까지 reserve에서 빼게 되면서, 그 eviction 결과가 attempt를 넘어
// 살아남으면 안 된다. 승급은 attempt마다 달라진다(편집 계획이 매 attempt 새로 나온다). attempt 1이
// 승급해 뺀 후보를 attempt 2가 승급하지 않으면, 그 후보는 selected에도 reserve에도 없게 되고
// editor는 결정론 선정이 만든 reserve capsule 하나를 잃는다. 재조정 입력은 pristine 스냅샷을
// 쓰므로 판정은 멀쩡하고 산출물만 어긋난다 — 모듈 테스트로는 잡히지 않는 호출부 계약이라
// 소스로 고정한다.
test('the publish host restores the pristine reserve pool at the start of each attempt', () => {
  const source = publishHostSource();

  const loopIndex = source.indexOf('for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {');
  const restoreIndex = source.indexOf('shortlistReport.reserve_candidates = pristineReserveCandidates;');
  const reconcileIndex = source.indexOf('const coverageReconciliation = reconcileCoverage({');
  const evictIndex = source.indexOf('shortlistReport.reserve_candidates = ensureArray(shortlistReport.reserve_candidates)');

  assert.ok(loopIndex > 0, 'attempt 루프를 찾지 못했다');
  assert.ok(restoreIndex > loopIndex, '결정론 reserve 복원은 attempt 루프 안에서 일어난다');
  // eviction 직전으로 내려가면 안 된다. 그 자리에서는 재조정 전에 죽은 attempt가 직전 attempt의
  // eviction 결과를 그대로 커밋해, 다른 provenance 필드를 여기서 비우는 이유와 같은 사고가 난다.
  assert.ok(restoreIndex < reconcileIndex, '복원은 재조정보다 앞, 즉 attempt 시작 블록에 있어야 한다');
  assert.ok(evictIndex > restoreIndex, '복원은 승급분 eviction보다 앞이어야 한다');
});

// 필드마다 초기화 한 줄을 따로 추가하던 방식은 새 필드의 초기화를 세 번 연속 빠뜨렸다
// (승급 키·결정론 기준선 키는 끝까지 초기화되지 않았다). 초기화와 대입이 같은 목록에서
// 파생되는 한 다음 필드를 잊을 수 없으므로, 그 파생 관계 자체를 잠근다.
test('the reset and the assignment are derived from one provenance field list', () => {
  const source = publishHostSource();

  // 이름을 열거하는 검사는 이미 아는 필드만 막는다. 새 이름으로 추가되는 provenance까지 막으려면
  // 출처를 봐야 한다 — 재조정 diff에서 온 값은 예외 없이 목록을 거쳐야 한다.
  // `=(?!=)`로 대입만 본다(비교식 `===`은 개별 대입이 아니라 이 검사 대상이 아니다).
  assert.doesNotMatch(
    source,
    /shortlistReport\.[A-Za-z0-9_]+\s*=(?!=)\s*coverageReconciliation\.diff/,
    '재조정 diff 값을 호출부에서 개별 대입하지 않는다 — 목록에서 파생시킨다'
  );
  assert.doesNotMatch(
    source,
    /shortlistReport\.(reconciliation_[A-Za-z0-9_]*|editorial_plan_scored_candidates|deterministic_selected_representative_group_keys)\s*=(?!=)/,
    '알려진 provenance 필드도 개별 대입하지 않는다'
  );

  const {
    RECONCILIATION_PROVENANCE_FIELDS,
    resetReconciliationProvenance,
    assignReconciliationProvenance
  } = require('../../publish/orchestrator-reconciliation-provenance');

  const diff = {};
  for (const diffKey of Object.values(RECONCILIATION_PROVENANCE_FIELDS)) {
    diff[diffKey] = [{ from: diffKey }];
  }
  const shortlistReport = {};
  assignReconciliationProvenance(shortlistReport, diff);
  const assignedFields = Object.keys(shortlistReport);
  assert.ok(assignedFields.length > 0, '대입이 아무 필드도 쓰지 않으면 검사가 의미 없다');

  resetReconciliationProvenance(shortlistReport);
  for (const field of assignedFields) {
    assert.deepEqual(shortlistReport[field], [], `${field}는 attempt 시작에 비워져야 한다`);
  }
});

// 목록에 없는 필드가 커밋되는 status로 새어 나가면 초기화 밖에 남는다. status allow-list가
// 싣는 재조정 provenance 필드는 전부 목록 안에 있어야 한다. 이 검사는 이미 아는 이름
// (reconciliation_* 등)만 훑는다 — 새 이름으로 추가되는 provenance는 위 테스트의 재조정 diff
// 출처 검사가 막는다.
test('every reconciliation provenance field the committed status carries is in the reset list', () => {
  const { RECONCILIATION_PROVENANCE_FIELDS } = require('../../publish/orchestrator-reconciliation-provenance');
  const statusSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'orchestrator-status-builders.js'),
    'utf8'
  );

  const committed = (statusSource.match(/ensureArray\(report\.([A-Za-z0-9_]+)\)/g) || [])
    .map(match => match.replace(/ensureArray\(report\.|\)/g, ''))
    .filter(field => /^(reconciliation_|deterministic_selected_representative|editorial_plan_scored)/.test(field));

  assert.ok(committed.length > 0, 'status allow-list에서 provenance 필드를 찾지 못했다');
  for (const field of committed) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(RECONCILIATION_PROVENANCE_FIELDS, field),
      `${field}가 attempt 초기화 목록에 없다 — 직전 attempt 값이 커밋된다`
    );
  }
});

// #879: 재조정은 자기 출력이 최종 main이라고 보고 채점 레코드를 만드는데, 2차 pass가 그 뒤에
// main 집합을 더 늘린다. 호스트가 승급분에 사유를 찍지 않으면, 방금 발행 집합에 넣은 기사가
// 레코드에서는 "승급되지 않은 shortlist_only"로 남아 한 artifact가 최종 main을 두 가지로 말한다.
// 대입이 2차 pass보다 뒤에 오는지, 그리고 승급 키로 사유를 덧씌우는지를 소스에서 잠근다.
test('the publish host stamps second-pass promotions into the scored-candidate projection', () => {
  const source = publishHostSource();

  const secondPassIndex = source.indexOf('admitReleaseClassCatchUpAfterReconciliation({');
  const assignIndex = source.indexOf('assignReconciliationProvenance(shortlistReport, coverageReconciliation.diff);');
  const stampIndex = source.indexOf('stampCatchUpPromotions(');

  assert.ok(secondPassIndex > 0, '2차 pass 호출을 찾지 못했다');
  assert.ok(assignIndex > secondPassIndex, '재조정 provenance 대입은 2차 pass 뒤에 온다');
  // 순서가 뒤집히면 목록 대입이 스탬프를 덮어써, 발행된 기사가 사유 없는 레코드로 남는다.
  assert.ok(stampIndex > assignIndex, '스탬프는 provenance 대입보다 뒤여야 한다');

  const stampBlock = source.slice(stampIndex, stampIndex + 300);
  assert.ok(
    stampBlock.includes('catchUpAfterReconciliation.admitted.map(candidateKey)') &&
      stampBlock.includes('CATCH_UP_PROMOTED_AFTER_RECONCILIATION'),
    '2차 pass 승급 키와 재조정 모듈이 정한 사유 상수를 함께 넘겨야 한다'
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
