// 발행 orchestrator의 순수 빌더/정규화 헬퍼 모음 — fs/generationRunState/root 미접근.
//
// generation orchestrator(main)가 만들어 둔 입력만 받아 markdown·report 객체·정규화
// 결과를 돌려주는 부수효과 없는 함수들이다(#655 god-file 분할). 동작은 추출 전과 동일하다.

const { ensureArray } = require('../../shared/common/value-coercion');
const { stringOrEmpty } = require('./orchestrator-shared-helpers');
const { normalizeUrl } = require('../select/newsroom-selection');
const { validatePublicArticle } = require('../reporter/public-article-contract');
const { renderCandidateSelectionDiagnostics } = require('../select/selection-diagnostics');
const { explicitDemotedGroups } = require('../../shared/common/article-groups');

function reviewPackageFactCheck(factCheck) {
  return factCheck || {
    status: 'UNKNOWN',
    must_fix: [],
    source_gaps: []
  };
}

function buildRunContext(env = process.env) {
  return {
    github_run_id: env.GITHUB_RUN_ID || '',
    github_sha: env.GITHUB_SHA || '',
    github_ref: env.GITHUB_REF || ''
  };
}

function backgroundContextStageEnabled(env = process.env) {
  const value = String(env.NEWSROOM_BACKGROUND_CONTEXT_STAGE ?? 'gemini').trim();
  if (!value) return true;
  if (/^(0|false|off|static|static-fallback|disabled?)$/i.test(value)) return false;
  return /^(1|true|on|gemini|enabled?)$/i.test(value);
}

function normalizeBackgroundContextReport(value, date, fallbackReport) {
  const fallbackItems = ensureArray(fallbackReport?.background_contexts);
  const fallbackByHash = new Map(fallbackItems
    .map(item => [stringOrEmpty(item.source_candidate_hash), item])
    .filter(([key]) => key));
  const fallbackByUrl = new Map(fallbackItems
    .map(item => [normalizeUrl(item.url), item])
    .filter(([key]) => key));
  return {
    ...fallbackReport,
    ...value,
    schema_version: Number(value?.schema_version || fallbackReport?.schema_version || 1),
    date,
    generated_at: new Date().toISOString(),
    stage: value?.stage || 'gemini-background-context',
    background_contexts: ensureArray(value?.background_contexts).map(item => {
      const fallback =
        fallbackByHash.get(stringOrEmpty(item?.source_candidate_hash)) ||
        fallbackByUrl.get(normalizeUrl(item?.url)) ||
        {};
      return {
        title: stringOrEmpty(item?.title || fallback.title),
        url: stringOrEmpty(item?.url || fallback.url),
        source_candidate_hash: stringOrEmpty(item?.source_candidate_hash || fallback.source_candidate_hash),
        relevance_bucket: stringOrEmpty(item?.relevance_bucket || fallback.relevance_bucket),
        background_context: stringOrEmpty(item?.background_context || fallback.background_context),
        background_basis: stringOrEmpty(item?.background_basis || 'supplied capsule and model knowledge'),
        background_confidence: stringOrEmpty(item?.background_confidence || 'medium'),
        background_warnings: ensureArray(item?.background_warnings).map(stringOrEmpty).filter(Boolean)
      };
    }).filter(item => item.background_context)
  };
}

function editorRenderedGroupKeys(editor = {}) {
  return [...new Set(ensureArray(editor.sections)
    .map(section => stringOrEmpty(section.article_group_key || section.articleGroupKey))
    .filter(Boolean))];
}

function editorExplicitlyDemotedGroups(editor = {}) {
  return explicitDemotedGroups(editor);
}

function buildRetryHistoryMarkdown(date, attempts, selectionDiagnostics = null) {
  const rows = attempts.map(item => [
    item.attempt,
    item.model || 'default',
    `${item.score}/${item.threshold}`,
    item.status,
    item.rendered_main_article_count ?? ensureArray(item.selected_article_headlines).length,
    ensureArray(item.locked_sections).length,
    item.demoted_article_count ?? ensureArray(item.demoted_sections).length,
    ensureArray(item.reserve_candidates_used).length,
    ensureArray(item.rejected_duplicate_headlines).length,
    item.source_gap_count,
    item.must_fix_count
  ]);
  return `# 뉴스레터 재시도 기록 - ${date}

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}

${selectionDiagnostics ? renderCandidateSelectionDiagnostics(selectionDiagnostics) : ''}

${attempts.map(item => `## 시도 ${item.attempt}

- 선택 기사: ${item.selected_article_headlines.join('; ') || '없음'}
- Lock된 기사: ${item.locked_article_headlines.join('; ') || '없음'}
- Source gap section: ${ensureArray(item.source_gap_sections).join('; ') || '없음'}
- Demoted section: ${ensureArray(item.demoted_sections).join('; ') || '없음'}
- Replaced section: ${ensureArray(item.replaced_sections).join('; ') || '없음'}
- Reserve candidate used: ${ensureArray(item.reserve_candidates_used).map(entry => `${entry.title || 'untitled'} (${entry.url || entry.source || 'unknown'})`).join('; ') || '없음'}
- Candidate rejection: ${ensureArray(item.candidate_rejections).map(entry => `${entry.title || 'untitled'} (${entry.reason || 'rejected'})`).join('; ') || '없음'}
- Underfilled reason: ${item.underfilled_reason || '없음'}
- 실패 section: ${ensureArray(item.failed_sections).map(section => section.headline || section.category || 'untitled').join('; ') || '없음'}
- 재생성 section: ${ensureArray(item.regenerated_sections).map(section => section.headline || section.category || 'untitled').join('; ') || '없음'}
- 거절된 retry output: ${ensureArray(item.rejected_retry_outputs).map(entry => `${entry.title || 'untitled'} (${entry.reason || 'rejected'})`).join('; ') || '없음'}
- Repair action: ${ensureArray(item.repair_actions).join('; ') || '없음'}
- Final slot distribution: ${JSON.stringify(item.final_article_slot_distribution || {})}
- Reporter eligibility blocked section: ${ensureArray(item.reporter_eligibility_blocked_sections).map(item => `${item.headline || 'untitled'} (${item.reason || 'blocked'})`).join('; ') || '없음'}
- Rejected main-ineligible candidate: ${ensureArray(item.rejected_main_ineligible_candidates).map(candidate => `${candidate.title || candidate} (${candidate.reason || 'rejected'})`).join('; ') || '없음'}
- Lock blocker: ${ensureArray(item.lock_blockers).join('; ') || '없음'}
- 거절된 중복 기사: ${ensureArray(item.rejected_duplicate_headlines).map(entry => typeof entry === 'string' ? entry : `${entry.title || 'untitled'} (${entry.reason || 'rejected'})`).join('; ') || '없음'}
- 감점: ${item.deductions.length === 0 ? '없음' : item.deductions.map(deduction => `${deduction.points}pt ${deduction.category}${deduction.location ? ` (${deduction.location})` : ''}: ${deduction.reason}`).join('; ')}
`).join('\n')}`;
}

function buildSelectionReport(date, shortlistReport, selectionDiagnostics) {
  const report = shortlistReport || {};
  const selectionErrors = ensureArray(report.selection_errors);
  const selectionWarnings = ensureArray(report.selection_warnings);
  const selectionShortageHints = ensureArray(report.selection_shortage_hints);
  const candidateShortage = report.candidate_shortage_reviewable === true;
  const failureStage = candidateShortage
    ? 'candidate_pool_preflight'
    : selectionErrors.length > 0 ? 'deterministic selection' : '';
  const failureReason = candidateShortage
    ? ensureArray(report.shortage_reason_codes).join('; ') || 'Not enough publishable candidates before LLM generation.'
    : selectionErrors.join('; ');
  return {
    schema_version: 1,
    date,
    generated_at: new Date().toISOString(),
    status: candidateShortage
      ? 'UNDERFILLED_NEEDS_FIX'
      : selectionErrors.length > 0
      ? 'FAILED'
      : selectionWarnings.length > 0 ? 'UNDERFILLED_NEEDS_FIX' : 'OK',
    failure_stage: failureStage,
    failure_reason: failureReason,
    selection_errors: selectionErrors,
    selection_warnings: selectionWarnings,
    selection_shortage_hints: selectionShortageHints,
    review_gate_passed: Boolean(selectionDiagnostics.review_gate_passed),
    publish_gate_passed: Boolean(selectionDiagnostics.publish_gate_passed),
    gate_summary: {
      review_gate_passed: Boolean(selectionDiagnostics.review_gate_passed),
      publish_gate_passed: Boolean(selectionDiagnostics.publish_gate_passed),
      non_fallback_reviewable_article_count: selectionDiagnostics.non_fallback_reviewable_article_count,
      primary_camera_stack_topic_count: selectionDiagnostics.primary_camera_stack_topic_count,
      supporting_main_article_count: selectionDiagnostics.supporting_main_article_count,
      forbidden_main_article_count: selectionDiagnostics.forbidden_main_article_count,
      eligible_non_fallback_reviewable_article_count: selectionDiagnostics.eligible_non_fallback_reviewable_article_count,
      min_final_articles: selectionDiagnostics.min_final_articles,
      max_final_articles: selectionDiagnostics.max_final_articles,
      absolute_min_reviewable_articles: selectionDiagnostics.absolute_min_reviewable_articles,
      min_non_fallback_publish_ready_articles: selectionDiagnostics.min_non_fallback_publish_ready_articles,
      selected_article_count: selectionDiagnostics.selected_article_count
    },
    composition_mode: selectionDiagnostics.composition_mode,
    composition_reason: selectionDiagnostics.composition_reason,
    composition_summary: selectionDiagnostics.composition_summary || {},
    eligible_composition_summary: selectionDiagnostics.eligible_composition_summary || {},
    headline_decision: selectionDiagnostics.headline_decision || report.headline_decision || null,
    headline_latest_inclusion: selectionDiagnostics.headline_latest_inclusion || report.headline_latest_inclusion || null,
    removed_due_to_headline_inclusion: ensureArray(selectionDiagnostics.removed_due_to_headline_inclusion || report.removed_due_to_headline_inclusion),
    article_exposure_coverage: selectionDiagnostics.article_exposure_coverage || report.article_exposure_coverage || null,
    candidate_pool_preflight_passed: report.candidate_pool_preflight_passed !== false,
    candidate_shortage_reviewable: report.candidate_shortage_reviewable === true,
    candidate_shortage_summary: report.candidate_shortage_summary || {},
    shortage_reason_codes: ensureArray(report.shortage_reason_codes),
    source_parser_hints: ensureArray(report.source_parser_hints),
    counts: {
      input_candidate_count: selectionDiagnostics.input_candidate_count,
      eligible_candidate_count: selectionDiagnostics.eligible_candidate_count,
      selected_article_count: selectionDiagnostics.selected_article_count,
      deterministic_selected_count: selectionDiagnostics.deterministic_selected_count,
      reserve_candidate_count: selectionDiagnostics.reserve_candidate_count,
      direct_aosp_camera_count: selectionDiagnostics.direct_aosp_camera_count,
      camera_driver_image_pipeline_count: selectionDiagnostics.camera_driver_image_pipeline_count,
      android_platform_camera_adjacent_count: selectionDiagnostics.android_platform_camera_adjacent_count,
      android_multimedia_camera_output_count: selectionDiagnostics.android_multimedia_camera_output_count,
      soc_platform_signal_count: selectionDiagnostics.soc_platform_signal_count,
      cpp_ai_tooling_fallback_count: selectionDiagnostics.cpp_ai_tooling_fallback_count,
      generic_tech_watchlist_count: selectionDiagnostics.generic_tech_watchlist_count,
      primary_camera_stack_topic_count: selectionDiagnostics.primary_camera_stack_topic_count,
      supporting_main_article_count: selectionDiagnostics.supporting_main_article_count,
      forbidden_main_article_count: selectionDiagnostics.forbidden_main_article_count,
      non_fallback_reviewable_article_count: selectionDiagnostics.non_fallback_reviewable_article_count
    },
    exclusion_reason_summary: selectionDiagnostics.exclusion_reason_summary || [],
    final_exclusion_reason_summary: selectionDiagnostics.final_exclusion_reason_summary || [],
    candidate_selection_note: selectionDiagnostics.candidate_selection_note || ''
  };
}

function validateMergedWeeklyArticle(mergedArticle) {
  try {
    const issues = validatePublicArticle(mergedArticle, 0, {});
    return { ok: ensureArray(issues).length === 0, reason: ensureArray(issues).join('; ') };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

module.exports = {
  reviewPackageFactCheck,
  buildRunContext,
  backgroundContextStageEnabled,
  normalizeBackgroundContextReport,
  editorRenderedGroupKeys,
  editorExplicitlyDemotedGroups,
  buildRetryHistoryMarkdown,
  buildSelectionReport,
  validateMergedWeeklyArticle
};
