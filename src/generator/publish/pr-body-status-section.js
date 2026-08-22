// PR body의 생성 상태(status) section을 담당한다.
// 생성 상태 요약, 권장 편집자 조치, 기사 구성 요약/메모, 최종 후보 선택 상태,
// 선택/구성 요약 라인처럼 generation-status 값을 사람이 읽을 수 있는 Markdown으로
// 정리하는 render 함수만 모은 단일 책임 모듈이다.

const {
  ensureArray
} = require('./publish-status');
const {
  articlePolicy,
  publishGateCriteriaText
} = require('../../shared/common/newsletter-policy');
const {
  valueOrUnknown,
  booleanText
} = require('./pr-body-format');

function countFromStatus(status, key) {
  return status[key] ?? status.composition_summary?.[key];
}

function mustFixSummaryText(status) {
  return [
    `must_fix_count=${valueOrUnknown(status.must_fix_count ?? 0)}`,
    `source_gap_count=${valueOrUnknown(status.source_gap_count ?? 0)}`
  ].join('; ');
}

// 이번 실행이 다룬 대상 주(coverage_week_key)와 그 기간. 셋 중 하나라도 없으면 lineage가
// 안 실린 옛 이슈이거나 배선이 빠진 상태이므로 'unknown'을 그대로 보여준다.
function coverageWeekLine(status) {
  const key = valueOrUnknown(status.coverage_week_key);
  const startDate = valueOrUnknown(status.coverage_start_date);
  const endDate = valueOrUnknown(status.coverage_end_date);
  return `대상 주차: ${key} (${startDate} ~ ${endDate})`;
}

// carry_forward_status가 'loaded'/'not_applicable'이 아니면 이번 실행의 후보 풀이 완전하지
// 않을 수 있다는 뜻이다 — editor_review_required를 강제로 켠 사유를 리뷰어가 여기서 바로
// 읽을 수 있어야 한다.
function carryForwardStatusLine(status) {
  const carryStatus = String(status.carry_forward_status || '');
  const base = `carry 상태: ${valueOrUnknown(carryStatus || null)}`;
  if (!carryStatus || ['loaded', 'not_applicable'].includes(carryStatus)) return base;
  return `${base} — 경고: carry-forward가 이번 주 후보 풀을 완전히 채우지 못했습니다. 편집자 검토가 강제로 켜졌습니다.`;
}

function recommendedEditorAction(status) {
  if (ensureArray(status.consistency_errors).length > 0) {
    return 'status artifact와 현재 산출물 재계산 결과가 다릅니다. PR 생성 전에 status artifact와 review artifact를 함께 확인하세요.';
  }
  if (status.final_publish_ready === true && status.validate_outcome === 'success') {
    return '최종 발행 조건이 모두 통과했습니다. 편집 검토를 마친 뒤 병합할 수 있습니다.';
  }
  if (status.image_audit_gate_passed === false) {
    return '이미지 계보 감사가 통과하지 못했습니다. image-audit-report.json의 발행 차단 항목을 고친 뒤 다시 실행하세요.';
  }
  if (status.stale_claim_hard_failure_count > 0 || status.stale_claim_status === 'NEEDS_FIX') {
    return '발행 전에 stale-claim hard failure를 제거하거나 문장을 다시 작성하고 stale-claim-report를 다시 확인하세요.';
  }
  if (status.must_fix_count > 0 || status.source_gap_count > 0 || status.fact_check_status === 'NEEDS_FIX') {
    return 'fact-check의 must_fix/source-gap 항목을 먼저 해결한 뒤 검증을 다시 실행하세요.';
  }
  if (status.composition_mode === 'THIN_WEEK_REVIEW') {
    return '검토용 PR로만 사용하세요. 더 강한 후보를 추가하거나 기사 풀이 충분해질 때까지 발행을 막아야 합니다.';
  }
  if (status.review_gate_passed === true && status.publish_gate_passed === false) {
    return '검토용 PR로만 사용하세요. 후보 선택 발행 조건을 만족하기 전에는 최종 발행으로 보지 않습니다.';
  }
  if (status.composition_mode === 'FALLBACK_COMPOSITION') {
    return 'SoC/platform/tooling 보조 기사 연결성이 실제 개발 업무에 명확한지 편집자가 확인한 뒤 판단하세요.';
  }
  if (status.validate_outcome === 'failure' || status.quality_status !== 'PASS') {
    return 'quality-report.md와 validation output을 확인하고 약한 section을 수정하거나 demote하세요.';
  }
  return '생성 산출물, label, validation output을 확인한 뒤 발행 여부를 결정하세요.';
}

function renderStatusSection(status, handoff = null) {
  const editorAction = recommendedEditorAction(status);
  const editorialReviewable = status.failure_kind === 'editorial_reviewable';
  const diagnosticsOnly = handoff?.diagnosticsOnly === true;
  return [
    '## 생성 상태',
    '',
    editorialReviewable
      ? diagnosticsOnly
        ? 'diagnostics-only 경고: public newsletter files가 준비되지 않았으므로 merge해도 Newsletter 홈페이지에 표시되지 않습니다. 이 PR은 publish-ready가 아닙니다.'
        : '편집장 검토 경고: AI 자동 발행 기준은 통과하지 못했지만 public newsletter files는 생성되었습니다. 편집장이 승인하여 merge하면 Newsletter 사이트에 게시됩니다.'
      : '',
    `전체 상태: ${valueOrUnknown(status.status)}`,
    `생성 실행 상태: ${valueOrUnknown(status.generation_status)}`,
    `failure_kind=${valueOrUnknown(status.failure_kind || 'none')}`,
    coverageWeekLine(status),
    carryForwardStatusLine(status),
    `팩트체크 상태: ${valueOrUnknown(status.fact_check_status)}`,
    `팩트체크 must_fix_count: ${valueOrUnknown(status.must_fix_count ?? 0)}`,
    `팩트체크 source_gap_count: ${valueOrUnknown(status.source_gap_count ?? 0)}`,
    `must_fix 요약: ${mustFixSummaryText(status)}`,
    `품질 점수: ${valueOrUnknown(status.quality_score)}`,
    `품질 기준: ${valueOrUnknown(status.quality_threshold)}`,
    '최대 점수: 100',
    `품질 상태: ${valueOrUnknown(status.quality_status)}`,
    `품질 시도 횟수: ${valueOrUnknown(status.quality_attempt_count)}`,
    `잠금 기사 수: ${valueOrUnknown(status.locked_article_count)}`,
    `수정된 section 수: ${valueOrUnknown(status.repaired_section_count ?? 0)}`,
    `건너뛴 repair section 수: ${valueOrUnknown(status.skipped_repair_section_count ?? 0)}`,
    `검증 결과: ${valueOrUnknown(status.validate_outcome)}`,
    `validate_ok=${booleanText(status.validate_ok)}`,
    `이미지 계보 감사 결과: ${valueOrUnknown(status.image_audit_outcome)}`,
    `image_audit_gate_passed=${booleanText(status.image_audit_gate_passed)}`,
    `selection_publish_ready: ${booleanText(status.selection_publish_ready)}`,
    `최종 발행 가능 여부: ${booleanText(status.final_publish_ready)} (final_publish_ready: ${booleanText(status.final_publish_ready)})`,
    `정책상 발행 조건: ${booleanText(status.publish_gate_passed)} (publish_gate_passed: ${booleanText(status.publish_gate_passed)}; ${publishGateCriteriaText()})`,
    `publish_gate_reason_codes: ${ensureArray(status.publish_gate_reason_codes).join('; ') || 'none'}`,
    `검토 게이트: ${booleanText(status.review_gate_passed)} (review_gate_passed: ${booleanText(status.review_gate_passed)})`,
    `편집자 검토 필요: ${booleanText(status.editor_review_required)}`,
    `editor_review_required=${booleanText(status.editor_review_required)}`,
    `부족한 후보 경로: ${booleanText(status.underfilled)}`,
    ...renderStatusCompositionLines(status),
    `Stale claim 상태: ${valueOrUnknown(status.stale_claim_status)}`,
    `Stale claim 요약: removed=${valueOrUnknown(status.stale_claim_removed_count ?? 0)}; hard_failures=${valueOrUnknown(status.stale_claim_hard_failure_count ?? 0)}`,
    `상태 일관성 오류: ${ensureArray(status.consistency_errors).length > 0 ? status.consistency_errors.join('; ') : '없음'} (consistency_errors: ${ensureArray(status.consistency_errors).length > 0 ? status.consistency_errors.join('; ') : 'none'})`,
    `권장 조치: ${editorAction}`,
    ''
  ].filter(line => line !== '').join('\n');
}

function renderCompositionNotes(status) {
  const lines = [];
  if (status.underfilled === true) {
    const finalSelectedCount = Number(status.final_selected_article_count ?? status.selected_article_count);
    const minFinalArticles = Number(status.selection_policy?.min_final_articles || articlePolicy.mainArticleCount.min);
    lines.push(
      `선택된 발행 가능 article 수는 ${Number.isFinite(finalSelectedCount) ? finalSelectedCount : valueOrUnknown(status.final_selected_article_count ?? status.selected_article_count)}개입니다. 최소 기준은 ${minFinalArticles}개입니다.`,
      ''
    );
  }
  if (status.composition_mode === 'FALLBACK_COMPOSITION' || status.selection_composition_mode === 'FALLBACK_COMPOSITION') {
    lines.push(
      status.publish_gate_passed === true
        ? 'Fallback composition: supporting-main-only 또는 supporting-main-inclusive 구성이며, 모든 hard gate를 통과하면 정책상 public-ready로 허용됩니다.'
        : 'Fallback composition: supporting main article이 포함되었습니다. 발행 가능 상태로 보려면 실제 SoC/platform/tooling 연결성과 hard gate 통과 여부를 확인하세요.',
      status.publish_gate_passed === false
        ? '검토 게이트는 통과했더라도 후보 선택 발행 조건이 막혀 있으면 최종 발행 가능 상태가 아닙니다.'
        : '',
      ''
    );
  }
  if (status.composition_mode === 'THIN_WEEK_REVIEW') {
    lines.push(
      'Thin-week review path: 이 PR은 검토 가능하지만 발행 준비 상태가 아닙니다. 자동 publish/deploy는 계속 차단되어야 합니다.',
      ''
    );
  }
  return lines.filter(line => line !== '').join('\n');
}

function renderStatusCompositionLines(status = {}) {
  const lines = ['선택/구성 요약:'];
  const hasValue = value => value !== null && value !== undefined && value !== '';
  const add = (label, value) => {
    if (hasValue(value)) lines.push(`${label}: ${valueOrUnknown(value)}`);
  };
  const addBoolean = (label, value, suffix = '') => {
    if (value === true || value === false) lines.push(`${label}: ${booleanText(value)}${suffix}`);
  };
  const addCount = (label, key) => {
    const value = countFromStatus(status, key);
    if (hasValue(value)) lines.push(`${label}: ${valueOrUnknown(value)}`);
  };

  add('composition_mode', status.composition_mode);
  add('selection_composition_mode', status.selection_composition_mode ?? status.composition_mode);
  addBoolean('final_publish_ready', status.final_publish_ready);
  addBoolean('editor_review_required', status.editor_review_required);
  addBoolean('review_gate_passed', status.review_gate_passed);
  addBoolean('publish_gate_passed', status.publish_gate_passed, ' (후보 선택 발행 조건)');
  if (ensureArray(status.publish_gate_reason_codes).length > 0) {
    lines.push(`publish_gate_reason_codes: ${ensureArray(status.publish_gate_reason_codes).join('; ')}`);
  }
  if (ensureArray(status.publish_gate_reason_summary).length > 0) {
    lines.push(`publish_gate_reason_summary: ${ensureArray(status.publish_gate_reason_summary)
      .map(item => `${item.code || 'unknown'} actual=${valueOrUnknown(item.actual)} required=${valueOrUnknown(item.required)}`)
      .join('; ')}`);
  }
  add('deterministic_selected_count', status.deterministic_selected_count ?? status.selected_article_count);
  add('rendered_main_article_count', status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count);
  add('reserve_candidate_count', status.reserve_candidate_count);
  add('input_candidate_count', status.input_candidate_count);
  add('eligible_candidate_count', status.eligible_candidate_count);
  add('selected_article_count', status.selected_article_count);
  addCount('direct_aosp_camera count', 'direct_aosp_camera_count');
  addCount('camera_driver_image_pipeline count', 'camera_driver_image_pipeline_count');
  addCount('android_platform_camera_adjacent count', 'android_platform_camera_adjacent_count');
  addCount('soc_platform_signal count', 'soc_platform_signal_count');
  addCount('cpp_ai_tooling_fallback count', 'cpp_ai_tooling_fallback_count');
  addCount('generic_tech_watchlist count', 'generic_tech_watchlist_count');
  addCount('primary_camera_stack_topic_count', 'primary_camera_stack_topic_count');
  addCount('supporting_main_article_count', 'supporting_main_article_count');
  addCount('forbidden_main_article_count', 'forbidden_main_article_count');
  add('composition reason', status.composition_reason);
  const notes = renderCompositionNotes(status)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length === 1 && notes.length === 0) return [];
  return [...lines, ...notes];
}

module.exports = {
  countFromStatus,
  mustFixSummaryText,
  coverageWeekLine,
  carryForwardStatusLine,
  recommendedEditorAction,
  renderStatusSection,
  renderCompositionNotes,
  renderStatusCompositionLines
};
