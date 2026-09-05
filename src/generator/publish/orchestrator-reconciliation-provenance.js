'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');

// 재조정 provenance(#837/#909/#1034)는 "이번 attempt에 재조정이 무엇을 했는가"라는 attempt 단위
// 사실이다. shortlistReport는 품질 재시도 attempt 사이에 살아 있으므로, attempt가 재조정 전에
// 죽으면 직전 attempt의 값이 그대로 커밋되는 generation-status에 실려 다른 편성의 사유를 이번
// 실행 것으로 읽게 된다.
//
// 필드마다 초기화 한 줄을 따로 추가해 오던 방식은 세 번 연속으로 새 필드의 초기화를 빠뜨렸다
// (승급 키와 결정론 기준선 키는 끝까지 초기화되지 않았다). 그래서 목록을 한 곳에 두고 초기화와
// 대입을 같은 목록에서 파생시킨다. 새 provenance 필드는 이 표에만 추가하면 되고, 표에 있는 한
// 초기화를 잊을 수 없다.
//
// key = shortlistReport에 남기는 필드 이름, value = coverageReconciliation.diff의 대응 키.
const RECONCILIATION_PROVENANCE_FIELDS = Object.freeze({
  deterministic_selected_representative_group_keys: 'deterministic_selected_group_keys',
  reconciliation_demoted_group_keys: 'demoted_group_keys',
  reconciliation_demoted_groups: 'demoted_groups',
  editorial_plan_scored_candidates: 'editorial_plan_scored_candidates',
  reconciliation_promoted_group_keys: 'promoted_group_keys'
});

// attempt 시작 시 호출한다. 값 자체가 목록이므로 빈 배열이 "이번 attempt에는 아직 재조정이 돌지
// 않았다"를 뜻한다.
function resetReconciliationProvenance(shortlistReport) {
  for (const field of Object.keys(RECONCILIATION_PROVENANCE_FIELDS)) {
    shortlistReport[field] = [];
  }
}

// 재조정이 실제로 돈 뒤에만 호출한다.
function assignReconciliationProvenance(shortlistReport, reconciliationDiff) {
  for (const [field, diffKey] of Object.entries(RECONCILIATION_PROVENANCE_FIELDS)) {
    shortlistReport[field] = reconciliationDiff[diffKey];
  }
}

// #879: 재조정 diff는 catch-up 2차 pass를 모른다. 재조정이 끝난 뒤 main이 된 후보의 사유는 최종
// main 집합을 아는 호출부만 세울 수 있는데, 이 필드들에 대한 쓰기는 이 모듈이 전부 소유해야
// 목록과 실제 값이 갈라지지 않는다. 그래서 그 덧씌우기도 호출부가 아니라 여기 둔다.
//
// assignReconciliationProvenance 뒤에만 호출한다 — 순서가 뒤집히면 대입이 스탬프를 덮는다.
function stampCatchUpPromotions(shortlistReport, promotedCandidateKeys, reasonCode) {
  const promoted = new Set(ensureArray(promotedCandidateKeys));
  shortlistReport.editorial_plan_scored_candidates =
    ensureArray(shortlistReport.editorial_plan_scored_candidates)
      .map(record => (promoted.has(record.candidate_key)
        ? { ...record, reason_code: reasonCode }
        : record));
}

module.exports = {
  RECONCILIATION_PROVENANCE_FIELDS,
  resetReconciliationProvenance,
  assignReconciliationProvenance,
  stampCatchUpPromotions
};
