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

  assert.match(
    source,
    /backgroundContextReport: filterBackgroundContextToSelected\(backgroundContextReport, reconciledSelected\)/,
    'editor 인자에서 background context를 재조정 편성으로 좁힌다'
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

// 필드마다 초기화 한 줄을 따로 추가하던 방식은 새 필드의 초기화를 세 번 연속 빠뜨렸다
// (승급 키·결정론 기준선 키는 끝까지 초기화되지 않았다). 초기화와 대입이 같은 목록에서
// 파생되는 한 다음 필드를 잊을 수 없으므로, 그 파생 관계 자체를 잠근다.
test('the reset and the assignment are derived from one provenance field list', () => {
  const source = publishHostSource();

  assert.doesNotMatch(
    source,
    /shortlistReport\.reconciliation_(demoted|promoted)[A-Za-z_]* =/,
    '재조정 provenance 필드를 호출부에서 개별 대입하지 않는다 — 목록에서 파생시킨다'
  );
  assert.doesNotMatch(
    source,
    /shortlistReport\.editorial_plan_scored_candidates =/,
    '채점 투영도 개별 대입하지 않는다'
  );
  assert.doesNotMatch(
    source,
    /shortlistReport\.deterministic_selected_representative_group_keys =/,
    '결정론 기준선 키도 개별 대입하지 않는다'
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
// 싣는 재조정 provenance 필드는 전부 목록 안에 있어야 한다.
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
