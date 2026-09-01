// 발행 orchestrator의 status/extra builder 모음(#655).
// generation-status artifact 본체(buildGenerationStatus), editor semantic 상태 기록·추출
// (recordEditorSemanticStatus/editorSemanticStatusExtra), selection 진단 extra(selectionStatusExtra)를
// god-file에서 분리했다. 네 함수의 의존성은 모두 module-level import 또는 generationRunState
// 싱글턴이라, god-file-local 함수 주입 없이 같은 출처에서 직접 import한다. buildRunContext는
// orchestrator-report-builders에서 가져오며 그 모듈은 god-file을 import하지 않아 순환이 없다.
const { ensureArray } = require('../../shared/common/value-coercion');
const { getLlmDiagnostics } = require('../../shared/llm/llm-client');
const { COMPOSITION_MODES } = require('../select/newsroom-selection');
const { selectionDiagnosticsFromReports } = require('../select/selection-diagnostics');
const { candidateGroupKey, groupCoverageSummary } = require('../../shared/common/article-groups');
const {
  articlePolicy,
  qualityGatePolicy,
  publishReadyCompositionPolicy
} = require('../../shared/common/newsletter-policy');
const { buildRunContext } = require('./orchestrator-report-builders');
const { generationRunState } = require('./orchestrator-run-state');

function buildGenerationStatus({
  date,
  status,
  failureStage = '',
  failureReason = '',
  failureClass = '',
  retryHistory = [],
  qualityReport = null,
  factCheck = null,
  extra = {}
}) {
  const diagnostics = getLlmDiagnostics();
  const mustFixCount = ensureArray(factCheck?.must_fix).length;
  const { run_context: extraRunContext, ...restExtra } = extra || {};
  return {
    date,
    status,
    failure_stage: failureStage,
    failure_reason: failureReason,
    failure_class: failureClass,
    fact_check_status: factCheck?.status || 'UNKNOWN',
    must_fix_count: mustFixCount,
    quality_status: qualityReport?.status || 'UNKNOWN',
    quality_attempt_count: retryHistory.length,
    quality_score: qualityReport?.score ?? null,
    quality_threshold: qualityReport?.threshold ?? qualityGatePolicy.threshold,
    quality_deduction_count: ensureArray(qualityReport?.deductions).length,
    stage_status_log: generationRunState.stageTracker.toLog(),
    quota_error_count: diagnostics.quota_error_count,
    invalid_json_count: diagnostics.invalid_json_count,
    stage_key_format: diagnostics.stage_key_format,
    model_usage: diagnostics.model_usage,
    model_routing: diagnostics.model_routing || {},
    candidate_input: restExtra.candidate_input || generationRunState.candidateInput || null,
    run_context: {
      ...buildRunContext(),
      ...(extraRunContext || {})
    },
    ...restExtra
  };
}

function recordEditorSemanticStatus(status = {}) {
  if (status.editor_semantic_validation != null) {
    generationRunState.editorSemanticValidation = status.editor_semantic_validation;
  }
  if (status.editor_public_article_judge != null) {
    generationRunState.editorPublicArticleJudge = status.editor_public_article_judge;
  }
  if ('repairAttempted' in status) {
    generationRunState.repairAttempted =
      generationRunState.repairAttempted || Boolean(status.repairAttempted);
  }
  if ('repairSucceeded' in status) {
    generationRunState.repairSucceeded =
      generationRunState.repairSucceeded || Boolean(status.repairSucceeded);
  }
  // #725: 발행된 기사에 남은 desk-review advisory를 run 전체에 걸쳐 누적해 둔다(차단은 아님,
  // 리뷰어가 편집 약점을 보도록 generation-status에 노출하기 위한 관측용).
  if (Array.isArray(status.editor_desk_advisory)) {
    generationRunState.editorDeskAdvisory = [
      ...generationRunState.editorDeskAdvisory,
      ...status.editor_desk_advisory
    ];
  }
}

function editorSemanticStatusExtra(error = null) {
  const editorSemanticValidation =
    error?.editorSemanticValidation ||
    generationRunState.editorSemanticValidation ||
    null;
  const repairAttempted =
    generationRunState.repairAttempted || Boolean(error?.repairAttempted);
  const repairSucceeded =
    generationRunState.repairSucceeded || Boolean(error?.repairSucceeded);
  return {
    editor_semantic_validation: editorSemanticValidation,
    editor_public_article_judge:
      error?.editorPublicArticleJudge ||
      generationRunState.editorPublicArticleJudge ||
      null,
    editor_desk_advisory:
      error?.editorDeskAdvisory ||
      generationRunState.editorDeskAdvisory ||
      [],
    repairAttempted: Boolean(repairAttempted),
    repairSucceeded: Boolean(repairSucceeded)
  };
}

function selectionStatusExtra(shortlistReport = generationRunState.shortlistReport, options = {}) {
  const report = shortlistReport || {};
  const diagnostics = selectionDiagnosticsFromReports(report, null);
  const qualityArticleCount = generationRunState.qualityReport?.metrics?.article_count ?? null;
  const renderedMainArticleCount = options.renderedMainArticleCount ?? qualityArticleCount;
  const finalPublishReady = options.finalPublishReady ?? null;
  const selectionCompositionMode = report.selection_composition_mode || report.composition_mode || diagnostics.selection_composition_mode || diagnostics.composition_mode || null;
  const compositionMode = options.compositionMode || selectionCompositionMode;
  const editorReviewRequired = options.editorReviewRequired ?? report.editor_review_required ?? diagnostics.editor_review_required ?? compositionMode !== COMPOSITION_MODES.NORMAL;
  const compositionSummary = report.composition_summary || diagnostics.composition_summary || {};
  const eligibleCompositionSummary = report.eligible_composition_summary || {};
  const selectedArticleCount = report.selected_article_count ?? diagnostics.final_selected_article_count ?? null;
  const nonFallbackReviewableCount = compositionSummary.non_fallback_reviewable_article_count ?? null;
  const primaryCameraStackTopicCount = compositionSummary.primary_camera_stack_topic_count ?? null;
  const supportingMainArticleCount = compositionSummary.supporting_main_article_count ?? null;
  const forbiddenMainArticleCount = compositionSummary.forbidden_main_article_count ?? null;
  const directAospCameraOrDriverCount = Number(compositionSummary.direct_aosp_camera_count ?? 0) +
    Number(compositionSummary.camera_driver_image_pipeline_count ?? 0);
  const selectionPolicy = report.selection_policy || {};
  const minFinalArticles = report.min_final_articles ?? selectionPolicy.min_final_articles ?? articlePolicy.mainArticleCount.min;
  const maxFinalArticles = selectionPolicy.max_final_articles ?? articlePolicy.mainArticleCount.max;
  const absoluteMinReviewable = report.absolute_min_reviewable_articles ??
    selectionPolicy.absolute_min_reviewable_articles ??
    articlePolicy.primaryCameraStack.minRequired;
  const minNonFallbackPublishReady = report.min_non_fallback_publish_ready_articles ??
    selectionPolicy.min_non_fallback_publish_ready_articles ??
    articlePolicy.primaryCameraStack.minRequired;
  const reviewGatePassed = report.review_gate_passed ?? (
    Number(selectedArticleCount) >= minFinalArticles &&
    Number(selectedArticleCount) <= maxFinalArticles &&
    Number(primaryCameraStackTopicCount) >= articlePolicy.primaryCameraStack.minRequired &&
    Number(forbiddenMainArticleCount) === 0
  );
  const selectionPublishGatePassed = report.publish_gate_passed ?? (
    Number(selectedArticleCount) >= minFinalArticles &&
    Number(selectedArticleCount) <= maxFinalArticles &&
    Number(primaryCameraStackTopicCount) >= publishReadyCompositionPolicy.primaryCameraStackMinRequired &&
    Number(directAospCameraOrDriverCount) >= publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired &&
    Number(supportingMainArticleCount) <= publishReadyCompositionPolicy.supportingMainMaxAllowed &&
    Number(forbiddenMainArticleCount) === 0 &&
    Number(primaryCameraStackTopicCount) + Number(supportingMainArticleCount) === Number(selectedArticleCount)
  );
  const publishGatePassed = options.publishGatePassed ?? selectionPublishGatePassed;
  const selectedGroupKeys = ensureArray(options.selectedGroupKeys).length > 0
    ? ensureArray(options.selectedGroupKeys)
    : ensureArray(report.selected_representative_group_keys).length > 0
      ? ensureArray(report.selected_representative_group_keys)
      : ensureArray(report.selected_articles).map(candidateGroupKey).filter(Boolean);
  const renderedGroupKeys = ensureArray(options.renderedGroupKeys).length > 0
    ? ensureArray(options.renderedGroupKeys)
    : ensureArray(report.rendered_group_keys);
  const hasRenderedGroupObservation = options.renderedGroupKeys !== undefined ||
    ensureArray(report.rendered_group_keys).length > 0;
  const explicitlyDemotedGroups = ensureArray(options.explicitlyDemotedGroups).length > 0
    ? ensureArray(options.explicitlyDemotedGroups)
    : ensureArray(report.explicitly_demoted_group_keys).map(key => ({ article_group_key: key, demotion_reason: 'status' }));
  const hardBlockedGroups = ensureArray(options.hardBlockedGroups).length > 0
    ? ensureArray(options.hardBlockedGroups)
    : ensureArray(report.hard_blocked_group_keys).map(key => ({ article_group_key: key, hard_block_reason: 'status' }));
  // 같은 그룹이 강등과 hard block 양쪽에 기록될 수 있다(editor 스키마가 금지하지 않는다).
  // 권위 검증기는 hard block을 우선해 강등 목록에서 그 그룹을 빼고 등식을 센다
  // (editor-output-contract.js의 effectiveDemotedGroups). status가 같은 전처리를 하지
  // 않으면 검증기가 통과시킨 발행에만 group_coverage_ok=false가 찍힌다. 같은 규칙을 쓴다.
  const hardBlockedKeys = new Set(
    ensureArray(hardBlockedGroups).map(item => String(item?.article_group_key || '')).filter(Boolean)
  );
  const effectiveDemotedGroups = ensureArray(explicitlyDemotedGroups)
    .filter(item => !hardBlockedKeys.has(String(item?.article_group_key || '')));
  const groupCoverage = groupCoverageSummary({
    selectedGroupKeys,
    renderedGroupKeys,
    demotedGroups: effectiveDemotedGroups,
    hardBlockedGroups
  });
  return {
    input_candidate_count: report.input_candidate_count ?? null,
    eligible_candidate_count: report.eligible_candidate_count ?? null,
    selected_article_count: selectedArticleCount,
    deterministic_selected_count: diagnostics.deterministic_selected_count ?? report.deterministic_selected_count ?? report.selected_article_count ?? null,
    rendered_main_article_count: renderedMainArticleCount,
    selected_group_count: groupCoverage.selected_group_count,
    rendered_group_count: hasRenderedGroupObservation ? groupCoverage.rendered_group_count : report.rendered_group_count ?? null,
    explicitly_demoted_group_count: groupCoverage.explicitly_demoted_group_count,
    hard_blocked_group_count: groupCoverage.hard_blocked_group_count,
    // 선택 밖 기록은 개수도 함께 싣는다. 목록만 있으면 카운트를 읽는 쪽(리포트·PR 본문)이
    // 회계 0건을 "아무 일도 없었다"로 읽는다. 단 렌더 쪽은 group_coverage_ok와 같은 게이트를
    // 쓴다 — 관측이 없는 실행에서 0을 찍으면 "확인해 보니 없었다"로 읽힌다.
    rendered_outside_selection_count: hasRenderedGroupObservation
      ? groupCoverage.rendered_outside_selection_count
      : null,
    explicitly_demoted_outside_selection_count: groupCoverage.explicitly_demoted_outside_selection_count,
    hard_blocked_outside_selection_count: groupCoverage.hard_blocked_outside_selection_count,
    selected_representative_group_keys: groupCoverage.selected_representative_group_keys,
    rendered_group_keys: groupCoverage.rendered_group_keys,
    explicitly_demoted_group_keys: groupCoverage.explicitly_demoted_group_keys,
    hard_blocked_group_keys: groupCoverage.hard_blocked_group_keys,
    // 선택 집합 밖 기록은 회계에 넣지 않되 버리지도 않는다. editor가 지어낸 키로 강등을 선언한
    // 주에 그 사실이 어디에도 남지 않으면, 통과한 발행과 "editor가 무엇을 선언했는지"를 잇는
    // 실마리가 사라진다. 렌더 쪽은 치명이라 검증기가 먼저 막지만 기록은 같은 자리에 둔다.
    rendered_outside_selection_group_keys: hasRenderedGroupObservation
      ? groupCoverage.rendered_outside_selection_group_keys
      : null,
    explicitly_demoted_outside_selection_group_keys: groupCoverage.explicitly_demoted_outside_selection_group_keys,
    hard_blocked_outside_selection_group_keys: groupCoverage.hard_blocked_outside_selection_group_keys,
    group_coverage_ok: hasRenderedGroupObservation ? groupCoverage.ok : null,
    // #837: 재조정 provenance. coverage 등식에는 참여하지 않는 순수 기록이다.
    // 이게 없으면 "결정론 N건이 왜 M건이 됐는지"를 발행 후에 알 방법이 없다
    // (그 사실을 담은 coverage-reconciliation.json은 커밋되지 않는다).
    deterministic_selected_representative_group_keys:
      ensureArray(report.deterministic_selected_representative_group_keys),
    reconciliation_demoted_group_keys: ensureArray(report.reconciliation_demoted_group_keys),
    // #909: 키만으로는 "왜 빠졌나"에 답하지 못한다. 사유가 담긴 coverage-reconciliation.json은
    // 커밋되지 않으므로(보존 등급 debug_heavy), 그룹 단위 사유는 여기서 커밋되는 status로 올린다.
    reconciliation_demoted_groups: ensureArray(report.reconciliation_demoted_groups),
    // #1034: 강등분만으로는 계획이 채점한 후보의 나머지가 남지 않는다. reserve·catch-up pool
    // 후보는 강등 대상이 아니라 위 목록에 절대 나타나지 않아, 판단이 담긴 editorial-plan.json
    // (역시 커밋 안 됨)이 만료되면 "그 후보를 계획이 어떻게 봤나"를 영영 알 수 없다.
    // 채점된 후보 전부의 판단을 여기서 커밋되는 status로 올린다. 관측이지 판정이 아니다.
    editorial_plan_scored_candidates: ensureArray(report.editorial_plan_scored_candidates),
    reconciliation_promoted_group_keys: ensureArray(report.reconciliation_promoted_group_keys),
    reserve_candidate_count: diagnostics.reserve_candidate_count ?? report.reserve_candidate_count ?? null,
    demoted_article_count: options.demotedArticleCount ?? diagnostics.demoted_candidate_count ?? report.demoted_candidate_count ?? null,
    locked_article_count: options.lockedArticleCount ?? null,
    fallback_topic_count: compositionSummary.fallback_topic_count ?? ensureArray(report.selected_articles).filter(candidate =>
      ['soc_platform_signal', 'cpp_ai_tooling_fallback'].includes(candidate.relevance_bucket)
    ).length,
    reporter_candidate_count: diagnostics.reporter_candidate_count,
    reporter_selected_count: diagnostics.reporter_selected_count,
    final_input_candidate_count: diagnostics.final_input_candidate_count,
    final_eligible_candidate_count: diagnostics.final_eligible_candidate_count,
    final_selected_article_count: diagnostics.final_selected_article_count,
    reporter_selected_but_final_excluded_count: diagnostics.reporter_selected_but_final_excluded_count,
    ai_selected_article_count: report.ai_selected_article_count ?? null,
    underfilled: Boolean(report.underfilled),
    publish_ready: report.publish_ready !== undefined ? Boolean(report.publish_ready) : null,
    selection_publish_ready: report.publish_ready !== undefined ? Boolean(report.publish_ready) : null,
    final_publish_ready: finalPublishReady,
    review_gate_passed: Boolean(reviewGatePassed),
    publish_gate_passed: Boolean(publishGatePassed),
    min_final_articles: minFinalArticles,
    max_final_articles: maxFinalArticles,
    absolute_min_reviewable_articles: absoluteMinReviewable,
    min_non_fallback_publish_ready_articles: minNonFallbackPublishReady,
    composition_mode: compositionMode,
    publish_mode: report.publish_mode ?? diagnostics.publish_mode ?? null,
    publish_mode_detail: report.publish_mode_detail ?? diagnostics.publish_mode_detail ?? null,
    selection_composition_mode: selectionCompositionMode,
    composition_reason: options.compositionReason || report.composition_reason || diagnostics.composition_reason || '',
    composition_summary: compositionSummary,
    eligible_composition_summary: eligibleCompositionSummary,
    candidate_pool_preflight_passed: report.candidate_pool_preflight_passed !== false,
    candidate_shortage_reviewable: report.candidate_shortage_reviewable === true,
    candidate_shortage_summary: report.candidate_shortage_summary || null,
    shortage_reason_codes: ensureArray(report.shortage_reason_codes),
    publish_gate_reason_codes: ensureArray(report.publish_gate_reason_codes),
    publish_gate_reason_summary: ensureArray(report.publish_gate_reason_summary),
    publish_ready_composition_policy: report.publish_ready_composition_policy || report.selection_policy?.publish_ready_composition || null,
    source_parser_hints: ensureArray(report.source_parser_hints),
    editor_review_required: Boolean(editorReviewRequired),
    non_fallback_reviewable_article_count: compositionSummary.non_fallback_reviewable_article_count ?? null,
    eligible_non_fallback_reviewable_article_count: eligibleCompositionSummary.non_fallback_reviewable_article_count ?? null,
    primary_camera_stack_topic_count: primaryCameraStackTopicCount,
    supporting_main_article_count: supportingMainArticleCount,
    forbidden_main_article_count: forbiddenMainArticleCount,
    direct_aosp_camera_count: compositionSummary.direct_aosp_camera_count ?? null,
    camera_driver_image_pipeline_count: compositionSummary.camera_driver_image_pipeline_count ?? null,
    android_platform_camera_adjacent_count: compositionSummary.android_platform_camera_adjacent_count ?? null,
    android_multimedia_camera_output_count: compositionSummary.android_multimedia_camera_output_count ?? null,
    soc_platform_signal_count: compositionSummary.soc_platform_signal_count ?? ensureArray(report.selected_articles).filter(candidate =>
      candidate.relevance_bucket === 'soc_platform_signal'
    ).length,
    cpp_ai_tooling_fallback_count: compositionSummary.cpp_ai_tooling_fallback_count ?? null,
    generic_tech_watchlist_count: compositionSummary.generic_tech_watchlist_count ?? null,
    selection_warnings: ensureArray(report.selection_warnings),
    selection_errors: ensureArray(report.selection_errors),
    selection_shortage_hints: ensureArray(report.selection_shortage_hints),
    headline_decision: report.headline_decision || diagnostics.headline_decision || null,
    headline_latest_inclusion: report.headline_latest_inclusion || diagnostics.headline_latest_inclusion || null,
    removed_due_to_headline_inclusion: ensureArray(report.removed_due_to_headline_inclusion || diagnostics.removed_due_to_headline_inclusion),
    article_exposure_coverage: report.article_exposure_coverage || diagnostics.article_exposure_coverage || null,
    // #838: selection-diagnostics.md와 generation-status.json은 이 allow-list를 거쳐 렌더된다.
    // 여기서 빠지면 레인 진단이 매 run 'unknown'으로 찍혀 관측이 없는 것과 같아진다.
    release_class_catch_up: report.release_class_catch_up || diagnostics.release_class_catch_up || null,
    // #963: 재게재 차단도 같은 이유로 allow-list에 둔다. exclusion_reason_summary는 상위 10개만
    // 남기므로 건수가 적은 이 사유는 거기서 잘린다.
    republication_cooldown_blocked: report.republication_cooldown_blocked || null,
    exclusion_reason_summary: ensureArray(report.exclusion_reason_summary).slice(0, 10),
    final_exclusion_reason_summary: ensureArray(diagnostics.final_exclusion_reason_summary).slice(0, 10),
    candidate_selection_note: diagnostics.note,
    // coverage lineage(대상 주·carry-forward 판정)는 buildShortlistReport가 수집 payload에서
    // 옮겨 담은 값이다. generation-status.json·PR 본문·artifact manifest가 모두 이 자리를
    // 거쳐 같은 값을 읽으므로, 여기서 빠지면 세 곳이 각자 'unknown'을 찍는다.
    coverage_week_key: report.coverage_week_key || '',
    coverage_start_date: report.coverage_start_date || '',
    coverage_end_date: report.coverage_end_date || '',
    generation_anchor_date: report.generation_anchor_date || '',
    carry_forward_status: report.carry_forward_status || '',
    carry_source: report.carry_source || null,
    not_yet_eligible_count: report.not_yet_eligible_count ?? null,
    not_yet_eligible_overflow: report.not_yet_eligible_overflow === true
  };
}

module.exports = {
  buildGenerationStatus,
  recordEditorSemanticStatus,
  editorSemanticStatusExtra,
  selectionStatusExtra
};
