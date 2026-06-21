// 생성 결과 등급(generation status) 분류 — 순수 로직, fs 접근 없음.
//
// orchestrator main()이 reporter/editor/quality/fact-check를 모두 돌린 뒤,
// 그 결과 신호(underfill·fact-check·quality)만으로 이 run의 등급을 결정한다.
// 등급은 발행 가능 여부와 편집자 검토 필요 여부를 가르는 1차 분기점이다.

// 생성 등급. PASS만 발행 후보이고, 나머지 세 NEEDS_FIX 계열은 사람이 검토한다.
const GENERATION_STATUSES = Object.freeze({
  PASS: 'PASS',
  UNDERFILLED_NEEDS_FIX: 'UNDERFILLED_NEEDS_FIX',
  NEEDS_FIX: 'NEEDS_FIX',
  QUALITY_NEEDS_FIX: 'QUALITY_NEEDS_FIX'
});

// underfill > fact-check must-fix > quality 순으로, 우선순위가 높은 결함을 등급으로 매긴다.
// 어느 결함도 없으면 PASS. 입력은 이미 산출된 신호이며 이 함수는 부수효과가 없다.
function classifyGenerationStatus({ underfilled, factCheckStatus, mustFixCount, qualityStatus }) {
  if (underfilled) {
    return GENERATION_STATUSES.UNDERFILLED_NEEDS_FIX;
  }
  if (factCheckStatus === 'NEEDS_FIX' && mustFixCount > 0) {
    return GENERATION_STATUSES.NEEDS_FIX;
  }
  if (qualityStatus !== 'PASS') {
    return GENERATION_STATUSES.QUALITY_NEEDS_FIX;
  }
  return GENERATION_STATUSES.PASS;
}

// fact-check/quality 결함(NEEDS_FIX/QUALITY_NEEDS_FIX)은 편집자가 손봐야 발행 가능한
// "편집 검토 대상"이다. underfill(thin-week)은 콘텐츠 부족이라 별도 review-only 경로로
// 처리되므로 여기 포함하지 않는다(public artifact는 그대로 쓴다).
function isEditorialReviewableStatus(status) {
  return status === GENERATION_STATUSES.NEEDS_FIX || status === GENERATION_STATUSES.QUALITY_NEEDS_FIX;
}

module.exports = {
  GENERATION_STATUSES,
  classifyGenerationStatus,
  isEditorialReviewableStatus
};
