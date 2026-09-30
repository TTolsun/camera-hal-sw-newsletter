// 후보 요약이 수집 단계에서 500자로 잘렸는지 판정하는 단일 지점(#1226).
// 수집기(normalizeCandidate)와 capsule·근거 항목 빌더가 같은 기준을 쓰도록 한 곳에 둔다.

// 후보 본문 계열 필드(summary, behavior_change)에 공통으로 거는 길이 상한이다. 같은 문장이
// 두 칸으로 흘러오므로 상한이 갈리면 표식·게이트가 서로 다른 조각을 보게 된다(#976).
const CANDIDATE_TEXT_MAX_LENGTH = 500;

// 잘림으로 보는 최소 길이. 상한에서 한 글자 모자란 값인 이유: 요약을 500자에서 미리 자르는 생산자
// (ai-coding-releases, raspberrypi-libcamera-releases)는 자른 뒤 끝 공백을
// 다듬거나 뒤이은 마크업 제거가 공백을 정리한다. 500번째 글자가 공백이면 잘렸는데도 499자로 도착하므로,
// 500자 이상만 잘림으로 보면 그 경우만 조용히 빠진다. 온전한 499~500자 요약이 잘림으로 표시되는 오탐은
// 드물고, 잘렸다고 알리는 쪽이 안전한 방향이다.
const SUMMARY_TRUNCATED_MIN_LENGTH = CANDIDATE_TEXT_MAX_LENGTH - 1;

function summaryReachesCutLength(summary) {
  return String(summary || '').trim().length >= SUMMARY_TRUNCATED_MIN_LENGTH;
}

// 후보의 잘림 표시를 읽는다. 수집기가 판정해 실어 둔 boolean이 있으면 그 값이 정본이다.
// 값이 없으면 요약 길이로 유도한다: 이월(not_yet_eligible) 후보는 이전 주 산출물을 정규화 없이 그대로
// 읽어 오고, seed evidence와 Gemini discovery 후보는 normalizeCandidate를 거치지 않으므로 필드가 없다.
// 유도하지 않으면 이 후보들이 다음 실행의 수집 풀 핵심인데도 잘린 요약이 온전한 것으로 읽힌다.
function isSummaryTruncated(candidate = {}) {
  if (typeof candidate.summary_truncated === 'boolean') return candidate.summary_truncated;
  return summaryReachesCutLength(candidate.summary);
}

module.exports = {
  CANDIDATE_TEXT_MAX_LENGTH,
  SUMMARY_TRUNCATED_MIN_LENGTH,
  isSummaryTruncated,
  summaryReachesCutLength
};
