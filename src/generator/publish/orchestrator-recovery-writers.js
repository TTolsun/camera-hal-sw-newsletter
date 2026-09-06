// 발행 orchestrator의 recovery/selection-diagnostics writer 모음(#655).
// 둘 다 selectionStatusExtra + renderCandidateSelectionDiagnostics로 selection 진단 markdown을
// 그려내고 recovery-prompt.md / selection-diagnostics.md(+ selection-report)를 쓴다는 점에서
// 한 역할(실패·진단 artifact 작성)로 묶인다. 의존성은 모두 module-level import, generationRunState
// 싱글턴, runtimeConfig(env 동일 시점 재파생), selectionStatusExtra/buildSelectionReport이며
// god-file-local 함수 주입이 없어 god-file을 import하지 않는다(순환 없음). root와 동일하게
// runtimeConfig도 god-file과 같은 process.env로 load 시점에 한 번 파생한다.
const fs = require('fs');
const path = require('path');
const { ensureArray } = require('../../shared/common/value-coercion');
const { kstDate, writeJson } = require('../../shared/common/common');
const { newsroomRelPath } = require('../../shared/common/artifact-paths');
const { readRuntimeConfig } = require('../../shared/common/runtime-config');
const { publishGateCriteriaText } = require('../../shared/common/newsletter-policy');
const { renderCandidateSelectionDiagnostics } = require('../select/selection-diagnostics');
const { buildSelectionReport } = require('./orchestrator-report-builders');
const { selectionStatusExtra } = require('./orchestrator-status-builders');
const { generationRunState } = require('./orchestrator-run-state');

const runtimeConfig = readRuntimeConfig(process.env);

function writeRecoveryPrompt(newsroomDir, context = {}) {
  fs.mkdirSync(newsroomDir, { recursive: true });
  const date = context.date || generationRunState.date || runtimeConfig.newsletterDate || kstDate();
  const shortlist = context.shortlistReport || generationRunState.shortlistReport || null;
  const selectionDiagnostics = selectionStatusExtra(shortlist);
  const selectionDiagnosticsMarkdown = renderCandidateSelectionDiagnostics(selectionDiagnostics);
  const lines = [
    `# 복구 프롬프트 - ${date}`,
    '',
    'newsroom automation이 publication readiness 전에 멈췄습니다. 아래 artifact를 사용해 diagnostics를 잃지 않고 수정하거나 다시 실행합니다.',
    '',
    '## 실패',
    '',
    `- 단계: ${context.stage || 'generation'}`,
    `- 사유: ${context.reason || 'Unknown failure.'}`,
    '',
    selectionDiagnosticsMarkdown,
    '',
    '## Deterministic Final Selection 상태',
    '',
    `- Final input candidate: ${selectionDiagnostics.final_input_candidate_count ?? selectionDiagnostics.input_candidate_count ?? 'unknown'}`,
    `- Final eligible candidate: ${selectionDiagnostics.final_eligible_candidate_count ?? selectionDiagnostics.eligible_candidate_count ?? 'unknown'}`,
    `- Final selected article: ${selectionDiagnostics.final_selected_article_count ?? selectionDiagnostics.selected_article_count ?? 'unknown'}`,
    `- Deterministic primary article: ${selectionDiagnostics.deterministic_selected_count ?? 'unknown'}`,
    `- Reserve candidate: ${selectionDiagnostics.reserve_candidate_count ?? 'unknown'}`,
    `- Demoted candidate: ${selectionDiagnostics.demoted_article_count ?? selectionDiagnostics.demoted_candidate_count ?? 'unknown'}`,
    `- AI selected input: ${selectionDiagnostics.ai_selected_article_count ?? 'unknown'}`,
    `- Publish ready: ${selectionDiagnostics.publish_ready ?? 'unknown'}`,
    `- Underfilled: ${selectionDiagnostics.underfilled}`,
    `- Selection warning: ${selectionDiagnostics.selection_warnings.join('; ') || '없음'}`,
    `- Selection error: ${selectionDiagnostics.selection_errors.join('; ') || '없음'}`,
    `- direct_aosp_camera: ${selectionDiagnostics.direct_aosp_camera_count ?? 'unknown'}`,
    `- android: ${selectionDiagnostics.android_count ?? 'unknown'}`,
    `- camera_driver_image_pipeline: ${selectionDiagnostics.camera_driver_image_pipeline_count ?? 'unknown'}`,
    `- android_multimedia_camera_output: ${selectionDiagnostics.android_multimedia_camera_output_count ?? 'unknown'}`,
    `- soc_platform_signal: ${selectionDiagnostics.soc_platform_signal_count ?? 'unknown'}`,
    `- cpp_ai_tooling_fallback: ${selectionDiagnostics.cpp_ai_tooling_fallback_count ?? 'unknown'}`,
    `- Non-fallback reviewable: ${selectionDiagnostics.non_fallback_reviewable_article_count ?? 'unknown'}`,
    `- Source/parser hint: ${selectionDiagnostics.selection_shortage_hints.join('; ') || 'none'}`,
    `- 주요 final exclusion reason: ${selectionDiagnostics.final_exclusion_reason_summary.map(item => `${item.reason} (${item.count})`).join('; ') || '없음'}`,
    '',
    '## 다시 실행',
    '',
    '```powershell',
    `$env:NEWSLETTER_DATE="${date}"`,
    'npm.cmd run generate',
    'npm.cmd run validate',
    '```',
    '',
    '## Shortlist',
    '',
    '```json',
    JSON.stringify(shortlist, null, 2),
    '```',
    '',
    '## Selected Input',
    '',
    '```json',
    JSON.stringify(context.selectedInputs || generationRunState.selectedInputs || [], null, 2),
    '```',
    '',
    '## 실패 Section',
    '',
    '```json',
    JSON.stringify(context.failedSections || [], null, 2),
    '```',
    '',
    '## 품질 감점',
    '',
    '```json',
    JSON.stringify(ensureArray((context.qualityReport || generationRunState.qualityReport)?.deductions), null, 2),
    '```',
    '',
    '## Fact-check 결과',
    '',
    '```json',
    JSON.stringify(context.factCheck || generationRunState.factCheck || null, null, 2),
    '```',
    '',
    '## Artifact 체크리스트',
    '',
    `- ${newsroomRelPath(date, 'shortlisted-candidates.json')}`,
    `- ${newsroomRelPath(date, 'article-capsules.json')}`,
    `- ${newsroomRelPath(date, 'background-context.json')}`,
    `- ${newsroomRelPath(date, 'reporter-candidates.json')}`,
    `- ${newsroomRelPath(date, 'editor-draft.json')}`,
    `- ${newsroomRelPath(date, 'fact-check-report.json')}`,
    `- ${newsroomRelPath(date, 'quality-report.json')}`,
    `- ${newsroomRelPath(date, 'retry-history.json')}`,
    '- .tmp/newsletter-generation-status.json',
    '- .tmp/gemini-raw/**'
  ];
  const filePath = path.join(newsroomDir, 'recovery-prompt.md');
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

function writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport = generationRunState.shortlistReport) {
  fs.mkdirSync(newsroomDir, { recursive: true });
  const date = shortlistReport?.date || generationRunState.date || runtimeConfig.newsletterDate || kstDate();
  const selectionDiagnostics = selectionStatusExtra(shortlistReport);
  const selectionReport = buildSelectionReport(date, shortlistReport, selectionDiagnostics);
  const lines = [
    `# Candidate Selection Diagnostics - ${date}`,
    '',
    renderCandidateSelectionDiagnostics(selectionDiagnostics),
    '',
    '## Gate Summary',
    '',
    `- Review Gate: ${selectionDiagnostics.review_gate_passed ? 'PASS' : 'FAIL'} (Newsletter Policy selection checks)`,
    `- Publish Gate: ${selectionDiagnostics.publish_gate_passed ? 'PASS' : 'FAIL'} (${publishGateCriteriaText()})`,
    `- selection_publish_ready: ${selectionDiagnostics.selection_publish_ready}`,
    `- final_publish_ready: ${selectionDiagnostics.final_publish_ready}`,
    `- selection_errors: ${selectionDiagnostics.selection_errors.length}`,
    `- selection_shortage_hints: ${selectionDiagnostics.selection_shortage_hints.length}`,
    ''
  ];
  const filePath = path.join(newsroomDir, 'selection-diagnostics.md');
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  writeJson(path.join(newsroomDir, 'selection-report.json'), selectionReport);
  const reportLines = [
    `# Selection Report - ${date}`,
    '',
    `- status: ${selectionReport.status}`,
    `- failure_stage: ${selectionReport.failure_stage || 'n/a'}`,
    `- failure_reason: ${selectionReport.failure_reason || 'n/a'}`,
    `- review_gate_passed: ${selectionReport.review_gate_passed}`,
    `- publish_gate_passed: ${selectionReport.publish_gate_passed}`,
    '',
    '## Selection Errors',
    '',
    ...(
      selectionReport.selection_errors.length > 0
        ? selectionReport.selection_errors.map(error => `- ${error}`)
        : ['- none']
    ),
    '',
    '## Shortage Hints',
    '',
    ...(
      selectionReport.selection_shortage_hints.length > 0
        ? selectionReport.selection_shortage_hints.map(hint => `- ${hint}`)
        : ['- none']
    ),
    '',
    '## Candidate Pool Preflight',
    '',
    `- candidate_shortage_reviewable: ${selectionReport.candidate_shortage_reviewable}`,
    `- candidate_pool_preflight_passed: ${selectionReport.candidate_pool_preflight_passed}`,
    `- shortage_reason_codes: ${selectionReport.shortage_reason_codes.join('; ') || 'none'}`,
    `- publishable_candidate_count: ${selectionReport.candidate_shortage_summary.publishable_candidate_count ?? 'unknown'}`,
    `- required_publishable_candidate_count: ${selectionReport.candidate_shortage_summary.required_publishable_candidate_count ?? 'unknown'}`,
    `- reserve_candidate_count: ${selectionReport.candidate_shortage_summary.reserve_candidate_count ?? 'unknown'}`,
    `- required_reserve_candidate_count: ${selectionReport.candidate_shortage_summary.required_reserve_candidate_count ?? 'unknown'}`,
    `- Reserve requirement: ${Number(selectionReport.candidate_shortage_summary.required_reserve_candidate_count) === 0 ? 'diagnostics only' : 'blocking preflight requirement'}`,
    '',
    '## Homepage Headline',
    '',
    `- decision: ${selectionReport.headline_decision?.reason || selectionReport.headline_decision?.decision || 'unknown'}`,
    `- current_headline_key: ${selectionReport.headline_decision?.current_headline_key || 'unknown'}`,
    `- replacement_headline_key: ${selectionReport.headline_decision?.replacement_headline_key || 'unknown'}`,
    `- public_render_reconciled: ${selectionReport.headline_decision?.public_render_reconciled === true || selectionReport.headline_public_render_reconciliation?.applied === true}`,
    `- public_rendered_headline_key: ${selectionReport.headline_decision?.public_rendered_headline_key || selectionReport.headline_public_render_reconciliation?.rendered_headline_key || 'unknown'}`,
    `- public_render_reconciliation_reason: ${selectionReport.headline_decision?.public_render_reconciliation_reason || selectionReport.headline_public_render_reconciliation?.reason || 'unknown'}`,
    `- previous_stored_current_score: ${selectionReport.headline_decision?.previous_stored_current_score ?? 'unknown'}`,
    `- runtime_decayed_score: ${selectionReport.headline_decision?.runtime_decayed_score ?? 'unknown'}`,
    `- last_scored_at: ${selectionReport.headline_decision?.last_scored_at || 'unknown'}`,
    `- scored_at: ${selectionReport.headline_decision?.scored_at || 'unknown'}`,
    `- latest_inclusion_mode: ${selectionReport.headline_latest_inclusion?.mode || 'none'}`,
    `- injected_from_snapshot: ${selectionReport.headline_latest_inclusion?.injected_from_snapshot === true}`,
    `- removed_due_to_headline_inclusion_count: ${selectionReport.removed_due_to_headline_inclusion.length}`,
    ...(
      selectionReport.removed_due_to_headline_inclusion.length > 0
        ? selectionReport.removed_due_to_headline_inclusion.slice(0, 5).map(item =>
          `  - ${item.title || 'unknown'} (${item.article_identity_key || 'unknown'}): ${item.reason || 'unknown'}`
        )
        : []
    ),
    `- exposure_history_coverage: ${selectionReport.article_exposure_coverage?.mode || 'unknown'} since ${selectionReport.article_exposure_coverage?.coverage_starts_at || 'unknown'}`,
    '',
    '## Source Parser Hints',
    '',
    ...(
      selectionReport.source_parser_hints.length > 0
        ? selectionReport.source_parser_hints.map(hint => `- ${hint.code || 'UNKNOWN'}: ${hint.reason || 'unknown'}`)
        : ['- none']
    ),
    '',
    '## Gate Summary',
    '',
    `- non_fallback_reviewable_article_count: ${selectionReport.gate_summary.non_fallback_reviewable_article_count ?? 'unknown'}`,
    `- primary_camera_stack_topic_count: ${selectionReport.gate_summary.primary_camera_stack_topic_count ?? 'unknown'}`,
    `- supporting_main_article_count: ${selectionReport.gate_summary.supporting_main_article_count ?? 'unknown'}`,
    `- forbidden_main_article_count: ${selectionReport.gate_summary.forbidden_main_article_count ?? 'unknown'}`,
    `- Minimum publishable article count: ${selectionReport.gate_summary.min_final_articles ?? 'unknown'}`,
    `- Primary camera stack requirement: ${Number(selectionReport.gate_summary.absolute_min_reviewable_articles) === 0 ? 'disabled by one-article policy' : selectionReport.gate_summary.absolute_min_reviewable_articles ?? 'unknown'}`,
    `- min_final_articles: ${selectionReport.gate_summary.min_final_articles ?? 'unknown'}`,
    `- max_final_articles: ${selectionReport.gate_summary.max_final_articles ?? 'unknown'}`
  ];
  fs.writeFileSync(path.join(newsroomDir, 'selection-report.md'), `${reportLines.join('\n')}\n`, 'utf8');
  return filePath;
}

module.exports = {
  writeRecoveryPrompt,
  writeSelectionDiagnosticsArtifact
};
