// 발행 orchestrator의 순수 빌더/정규화 헬퍼 모음 — fs/generationRunState/root 미접근.
//
// generation orchestrator(main)가 만들어 둔 입력만 받아 markdown·report 객체·정규화
// 결과를 돌려주는 부수효과 없는 함수들이다(#655 god-file 분할). 동작은 추출 전과 동일하다.

const { ensureArray } = require('../../shared/common/value-coercion');
const { stringOrEmpty } = require('./orchestrator-shared-helpers');
const { normalizeUrl } = require('../select/newsroom-selection');
const {
  allowedPublicSourceUrlKeys,
  validatePublicArticle
} = require('../reporter/public-article-contract');
const { renderCandidateSelectionDiagnostics } = require('../select/selection-diagnostics');
const { explicitDemotedGroups, explicitHardBlockedGroups } = require('../../shared/common/article-groups');

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

// #837: editor가 기록한 hard block. thin-week salvage(newsletter-quality.js)와 구조적
// demote(orchestrator-repair-completion.js)가 떨군 section을 사유와 함께 여기에 남기는데,
// 이 값이 status로 전달되지 않아 coverage 등식에서 "설명 없는 손실"로 보였다.
function editorHardBlockedGroups(editor = {}) {
  return explicitHardBlockedGroups(editor);
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
    // #838: 전체 shortlistReport가 담기는 shortlisted-candidates.json은 커밋되지 않는다.
    // release-class 레인 진단은 이 투영을 통과해야만 다음 run에서 판정할 수 있다.
    release_class_catch_up: selectionDiagnostics.release_class_catch_up || report.release_class_catch_up || null,
    exclusion_reason_summary: selectionDiagnostics.exclusion_reason_summary || [],
    final_exclusion_reason_summary: selectionDiagnostics.final_exclusion_reason_summary || [],
    candidate_selection_note: selectionDiagnostics.candidate_selection_note || ''
  };
}

// 독자가 기사 아래에서 실제로 보는 인용 목록은 public_article.source_links다. section.sources는
// 그 인용이 고를 수 있는 URL의 allow-list일 뿐이라, 둘은 같지 않아도 된다(source_links는
// sources의 진부분집합일 수 있다). 계약 모듈이 allow-list 키를 만들 때 쓰는 URL 정규화를
// 그대로 쓰려고 sources 자리에 인용 목록을 넣어 키 집합을 얻는다.
function publishedSourceLinkUrlKeys(article = {}) {
  return allowedPublicSourceUrlKeys({ sources: ensureArray(article.public_article?.source_links) });
}

// #870: 병합 결과 하나만 검증기에 넘기면 sources와 public_article.source_links를 같은 LLM이
// 함께 만든 탓에 서로 맞는 게 당연해진다(자기증명). 지어낸 출처와 보존된 출처는 병합 전
// 원본과 대조해야만 구분된다. 두 방향을 본다.
//  - 인용 가능 URL(allow-list)이 원본 두 기사가 가진 범위 밖으로 늘어나면 지어낸 출처다.
//  - 원본이 발행하던 인용이 병합 결과의 인용 목록에서 빠지면 근거가 유실된 것이다.
// origins가 비어 있으면 대조할 원본이 없어 아무것도 증명할 수 없으므로 거부한다(fail closed).
function sourcePreservationIssues(mergedArticle, origins = {}) {
  const originArticles = [origins.existing, origins.incoming].filter(Boolean);
  const mergedAllowedKeys = allowedPublicSourceUrlKeys(mergedArticle);
  // allow-list가 비면 계약 검증의 source_link URL 검사가 통째로 건너뛰어진다. 그 상태에서는
  // 인용이 어디서 왔는지 아무도 보지 않으므로 여기서 막는다.
  if (mergedAllowedKeys.size === 0) return [{ type: 'merged_article_has_no_source' }];

  const issues = [];
  const originAllowedKeys = new Set(originArticles.flatMap(article => [...allowedPublicSourceUrlKeys(article)]));
  for (const key of mergedAllowedKeys) {
    if (!originAllowedKeys.has(key)) {
      issues.push({ type: 'merged_article_source_not_in_origin', url: key });
    }
  }
  // 유실은 발행되는 인용 목록에서 본다. sources만 보면 두 원본의 sources를 다 들고 있으면서
  // 인용 목록에서는 한쪽 출처를 빼 버린 병합이 그대로 통과한다.
  const mergedPublishedKeys = publishedSourceLinkUrlKeys(mergedArticle);
  const originPublishedKeys = new Set(originArticles.flatMap(article => [...publishedSourceLinkUrlKeys(article)]));
  for (const key of originPublishedKeys) {
    if (!mergedPublishedKeys.has(key)) {
      issues.push({ type: 'merged_article_dropped_origin_source', url: key });
    }
  }
  return issues;
}

// #490: LLM이 병합한 weekly 기사를 기존 public-article 계약 검증기로 확인한 뒤에만 교체를 허용한다.
// 검증 이슈나 오류가 있으면 기존 기사를 보존한다(fail closed).
// #870: 출처 보존을 먼저 본다. 보존이 증명돼야 병합 결과의 allow-list가 원본에서 온 것이 되고,
// 그때부터 계약 검증의 source_link 검사가 자기증명이 아니게 된다. issueMarkers는 이 병합
// 결과가 실려 나갈 이슈의 계약 마커다 — 넘기지 않으면 story 계약 기사는 마커가 모자라
// 항상 mismatch로 떨어져 병합 채택 경로가 통째로 닫힌다.
function validateMergedWeeklyArticle(mergedArticle, origins = {}, issueMarkers = {}) {
  try {
    const issues = sourcePreservationIssues(mergedArticle, origins);
    if (issues.length === 0) {
      issues.push(...validatePublicArticle(mergedArticle, 0, { issue: issueMarkers }));
    }
    return {
      ok: issues.length === 0,
      reason: issues.map(issue => issue.type).join('; '),
      issues
    };
  } catch (error) {
    return { ok: false, reason: error.message, issues: [] };
  }
}

module.exports = {
  reviewPackageFactCheck,
  buildRunContext,
  backgroundContextStageEnabled,
  normalizeBackgroundContextReport,
  editorRenderedGroupKeys,
  editorExplicitlyDemotedGroups,
  editorHardBlockedGroups,
  buildRetryHistoryMarkdown,
  buildSelectionReport,
  validateMergedWeeklyArticle
};
