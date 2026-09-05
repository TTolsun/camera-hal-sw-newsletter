'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');

// 후보별 선정 진단을 selection-report.json에 실을 수 있는 최소 형태로 투영한다.
//
// 왜 필요한가: 전체 shortlistReport가 담기는 shortlisted-candidates.json은 커밋되지 않는다(#838).
// 그래서 커밋된 기록에는 사유별 합계(exclusion_reason_summary)만 남고, "어떤 후보가 몇 점으로
// 떨어졌나"는 run이 끝나면 사라진다. 합계만으로는 후보 단위를 셀 수 없다 — 한 후보가 사유를
// 여러 개 갖기 때문에 사유별 건수를 더해도 후보 수가 되지 않는다.
//
// 이 투영이 있으면 커밋된 아티팩트만으로 다음을 답할 수 있다.
//   - 통과선(base_total) 바로 아래에서 떨어진 후보가 몇 건인가
//   - 자격은 통과했는데 슬롯에서 밀린 후보가 무엇인가
//   - 특정 후보가 왜 떨어졌나 (사유 목록)
//
// 판정에 관여하지 않는다. 읽기만 하고 기록만 남긴다.

// 관측된 주간 후보 수는 44~72건이다. cap은 폭주 방지용이라 정상 범위에서는 걸리지 않는다.
// 잘렸는지는 truncated 플래그로 남겨, 세는 쪽이 부분 집계를 전체로 오인하지 않게 한다.
const MAX_CANDIDATE_ROWS = 300;

// stage는 우선순위가 높은 것부터 확인한다. 한 후보가 selected이면서 shortlisted일 수 있으므로
// 먼저 잡히는 쪽이 그 후보의 대표 stage가 된다.
const STAGE_ORDER = Object.freeze([
  ['selected_articles', 'selected'],
  ['reserve_candidates', 'reserve'],
  ['demoted_candidates', 'demoted'],
  ['shortlisted_candidates', 'shortlisted'],
  ['excluded_candidates', 'excluded'],
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function candidateUrl(candidate = {}) {
  return text(candidate.normalized_url)
    || text(candidate.url)
    || text(candidate.article_url)
    || text(candidate.articleUrl);
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function exclusionReasonsOf(candidate = {}) {
  const reasons = ensureArray(candidate.final_exclusion_reasons).length > 0
    ? candidate.final_exclusion_reasons
    : candidate.exclusion_reasons;
  return [...new Set(ensureArray(reasons).map(text).filter(Boolean))];
}

// 빈 값은 싣지 않는다. 후보 60건 × 필드마다 빈 문자열을 남기면 커밋 diff만 늘고 읽을 것은
// 늘지 않는다.
function compactRow(row) {
  const compacted = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    compacted[key] = value;
  }
  return compacted;
}

function projectCandidate(candidate, stage) {
  const breakdown = candidate.score_breakdown || {};
  const baseTotal = numberOrNull(breakdown.base_total);
  const total = numberOrNull(breakdown.total);
  return compactRow({
    url: candidateUrl(candidate),
    stage,
    // base_total은 linked-evidence 보정 전 점수라 통과선(main_article_score_threshold)과
    // 직접 비교되는 값이다. total은 보정 후 값이고, 둘이 같으면 total은 싣지 않는다.
    base_total: baseTotal,
    total: total === baseTotal ? null : total,
    camera_hal_directness: numberOrNull(breakdown.camera_hal_directness),
    scope_relevance: numberOrNull(breakdown.scope_relevance),
    freshness_window: text(candidate.freshness_window),
    relevance_bucket: text(candidate.relevance_bucket) || text(breakdown.relevance_bucket),
    final_selection_eligibility: text(candidate.final_selection_eligibility),
    exclusion_reasons: exclusionReasonsOf(candidate),
  });
}

/**
 * @param {object} selectionDiagnostics normalizeShortlistReport() 결과
 * @returns {{rows: object[], count: number, truncated: boolean, score_threshold: number|null}}
 */
function buildCandidateDiagnostics(selectionDiagnostics = {}) {
  const seen = new Set();
  const rows = [];
  let truncated = false;

  for (const [field, stage] of STAGE_ORDER) {
    for (const candidate of ensureArray(selectionDiagnostics[field])) {
      const url = candidateUrl(candidate);
      // URL이 없는 후보는 식별할 수 없어 세는 쪽이 중복을 걸러낼 수 없다. 그런 후보는
      // exclusion_reason_summary의 'missing URL evidence'로 이미 집계된다.
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (rows.length >= MAX_CANDIDATE_ROWS) {
        truncated = true;
        break;
      }
      rows.push(projectCandidate(candidate, stage));
    }
    if (truncated) break;
  }

  // 입력 후보 전부가 이 행에 실리지는 않는다. 시리즈 대표 병합(collapseSeriesRepresentatives),
  // 부모 roundup 제거, 재게재 쿨다운은 shortlist 자격 심사 '이전'에 후보를 걷어내므로
  // 어느 배열에도 남지 않는다. 실측 2026-07-27 기준 59건 중 17건이 그렇게 빠진다.
  // 세는 쪽이 rows.length를 후보 총수로 오인하지 않도록 격차를 수치로 남긴다.
  const inputCount = numberOrNull(selectionDiagnostics.input_candidate_count);
  return {
    rows,
    count: rows.length,
    input_count: inputCount,
    not_evaluated: inputCount === null ? null : Math.max(inputCount - rows.length, 0),
    truncated,
    score_threshold: numberOrNull(selectionDiagnostics.selection_policy?.main_article_score_threshold),
  };
}

module.exports = { buildCandidateDiagnostics, MAX_CANDIDATE_ROWS };
