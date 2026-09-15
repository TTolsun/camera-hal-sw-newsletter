'use strict';

const {
  resolveCandidateDateEvidence
} = require('../../shared/common/date-signals');
const { kstDate } = require('../../shared/common/common');

const ANCHOR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return String(value || '').trim();
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rounded(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function publishedDate(candidate) {
  return text(candidate.published_date || candidate.publishedAt || candidate.published_at);
}

function selectionDateEvidence(candidate) {
  return resolveCandidateDateEvidence(candidate);
}

function selectionDate(candidate) {
  return selectionDateEvidence(candidate).date;
}

function hasPublishReadyDateEvidence(candidate) {
  return selectionDateEvidence(candidate).publish_ready_date_evidence;
}

function datePrecision(candidate) {
  return text(candidate.datePrecision || candidate.date_precision);
}

// coverage 계산은 항상 YYYY-MM-DD anchor가 있어야 한다(coverageForAnchorDate가 그 외에는
// throw). 실행 진입점(selectFinalArticlesWithDiagnostics)은 anchor 누락을 오늘로 조용히
// 메우지 않고 throw하지만, freshnessWindowMetadata/freshnessScore 같은 하위 유틸은 기존에도
// newsletterDate 없이 호출 가능했던 계약을 유지한다 — 그 경우만 오늘(KST) 날짜로 채운다.
function freshnessAnchorDate(newsletterDate) {
  const normalizedDate = text(newsletterDate);
  return ANCHOR_DATE_PATTERN.test(normalizedDate) ? normalizedDate : kstDate();
}

function candidateUrl(candidate) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl);
}

function candidateSource(candidate) {
  return text(candidate.source || candidate.source_name);
}

function fieldBoolean(candidate, camel, snake, fallback = false) {
  if (typeof candidate[camel] === 'boolean') return candidate[camel];
  if (typeof candidate[snake] === 'boolean') return candidate[snake];
  return fallback;
}

// 원문을 한 번도 받지 않은 후보(#1108). evidence_validation_status는 discovery 단계
// (validate-candidate-evidence.js)가 만들어 merged-candidates.json에 싣고, 워크플로 03은 그
// 파일을 선정 입력으로 쓴다. 실측 2026-09-07호: 이 값이 not_checked인 patchwork 후보 2건이
// main으로 발행됐고 둘 다 원문의 의미를 틀렸다 — fact-check는 문장이 출처에 묶였는지를 볼 뿐
// 원문과 대조하지 않으므로, 원문 없이 쓴 본문은 그 층을 그대로 지난다.
//
// `=== 'not_checked'`만 보는 이유: 기본 모드(로컬 실행·테스트)의 입력은 candidates.json이라
// 이 필드가 아예 없다. 없는 값을 차단으로 읽으면 로컬과 프로덕션이 다르게 돈다. pass·
// fetch_failed_review_required·editor_review_required는 통과하고, blocked는
// final_selection_blocked로 exclusionReasons()가 이미 하드 제외한다.
//
// not_checked는 fetch 캡(maxTargets)만의 결과가 아니다. fetch 대상 선정
// (gemini-source-discovery-boundary.js)이 source_quality_bucket이 strong/review인 후보와 cluster
// canonical만 고르고 duplicate_of_selected_source 사본은 빼므로, 그 기준 밖 후보는 캡과 무관하게
// not_checked로 남는다(실측 2026-09-14: weak_candidate 버킷의 android dev blog, 같은 릴리스
// 페이지의 다른 anchor가 canonical이던 CameraX 1.6.2). 이 게이트가 들어오면 그 fetch 대상 선정
// 기준이 사실상 main 자격 조건이 된다.
//
// 결정론 main 슬롯 게이트(newsroom-selection.js)와 LLM 승급 가드(coverage-reconciliation.js)가
// 이 한 정의를 함께 쓴다. 둘이 갈라지면 reserve에 남은 not_checked 후보를 편집 계획이 main으로
// 올릴 수 있다.
function isEvidenceUnchecked(candidate) {
  return candidate?.evidence_validation_status === 'not_checked';
}

module.exports = {
  text,
  bool,
  number,
  clamp,
  rounded,
  publishedDate,
  selectionDateEvidence,
  selectionDate,
  hasPublishReadyDateEvidence,
  datePrecision,
  freshnessAnchorDate,
  candidateUrl,
  candidateSource,
  fieldBoolean,
  isEvidenceUnchecked
};
