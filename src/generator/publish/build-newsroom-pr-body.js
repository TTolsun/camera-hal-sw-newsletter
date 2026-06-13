const fs = require('fs');
const path = require('path');

const {
  ensureArray,
  resolvePublishStatus
} = require('./publish-status');
const {
  collectedArtifactPath,
  loadCollectedReport,
  loadNewsroomJson,
  loadNewsroomReport,
  newsroomArtifactPath,
  readJsonIfExists,
  readJsonObjectIfExists,
  readTextIfExists
} = require('./pr-body-artifacts');
const {
  articlePolicy,
  articleCountRangeText,
  publishGateCriteriaText
} = require('../../shared/common/newsletter-policy');
const {
  renderEditorPublicationPolicyMarkdown
} = require('../reporter/editor-publication-policy');
const {
  EDITORIAL_DECISION_HEADINGS,
  EDITORIAL_DECISION_TABLE_COLUMNS,
  buildDecisionGuardrailKo,
  buildDecisionReasonKo,
  classifyEditorialDecision
} = require('../reporter/editorial-decision-summary');
const {
  articleSectionContractMarkdown
} = require('../render/newsletter-renderer');
const {
  DIAGNOSIS_KEYS
} = require('../diagnostics/source-quality-diagnosis');
const {
  DIAGNOSIS_LABELS_KO,
  RECOMMENDED_ACTION_LABELS_KO
} = require('../diagnostics/source-quality-diagnosis-labels.ko');
const {
  getChangedRepoVisibleArtifacts,
  requiredPublicFiles,
  resolveReviewableArtifacts
} = require('./resolve-reviewable-artifacts');
const {
  buildReviewArtifactInventory,
  renderGeneratedArtifactsSummary
} = require('./review-artifact-inventory');
const {
  renderEditorPrSummary
} = require('../../shared/common/editor-pr-summary');
const {
  formatReasonSummary
} = require('../../shared/common/status-format');
const {
  sanitizeMarkdownTableCell,
  sanitizeMarkdownLinkUrl,
  markdownTableCell,
  trustedMarkdownTableCell,
  renderMarkdownTable
} = require('../../shared/common/markdown');
const {
  toLegacyEditorIssue
} = require('../../shared/domain/newsletter-domain-normalize');

const {
  valueOrUnknown,
  valueOrUnknownKo,
  booleanText
} = require('./pr-body-format');
const {
  TRACE_STATUS_RANK,
  normalizeMatchText,
  firstText,
  extractCandidateTitle,
  sourceFromValue,
  extractCandidateSource,
  extractCandidateBucket,
  extractCandidateUrls,
  extractReasonList,
  classifyCandidateStatus,
  reasonCodeFor,
  formatCandidateLink
} = require('./pr-body-candidate-shared');
const {
  renderCandidateTraceability
} = require('./pr-body-candidate-trace');
const {
  renderFinalNewsletterEditorSummary,
  renderPublicationDecisionSummary
} = require('./pr-body-final-summary');

const EDITOR_BRIEF_ALLOWED_SECTIONS = new Set([
  '이번 주 핵심 메시지',
  '메인으로 봐야 할 기사',
  'Camera HAL 업무 연결 포인트',
  '편집장 확인 checklist',
  '권장 판단'
]);

const EDITOR_BRIEF_REMOVED_SECTIONS = new Set([
  '검증 결과 요약',
  '품질 게이트',
  'Stale Claim Gate',
  '후보 선택 진단',
  'Generation Status',
  'Composition Summary',
  'Deterministic Final Selection Status',
  'Editor Action Guidance'
]);

function normalizeHeading(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractEditorBriefSections(markdown) {
  if (!markdown) return '';
  const sections = [];
  let current = null;

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (current) sections.push(current);
      current = {
        heading: normalizeHeading(match[1]),
        lines: []
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);

  return sections
    .filter(section =>
      EDITOR_BRIEF_ALLOWED_SECTIONS.has(section.heading) &&
      !EDITOR_BRIEF_REMOVED_SECTIONS.has(section.heading)
    )
    .map(section => {
      const body = section.lines.join('\n').trim();
      return body ? `## ${section.heading}\n\n${body}` : `## ${section.heading}`;
    })
    .join('\n\n');
}

function countFromStatus(status, key) {
  return status[key] ?? status.composition_summary?.[key];
}

function mustFixSummaryText(status) {
  return [
    `must_fix_count=${valueOrUnknown(status.must_fix_count ?? 0)}`,
    `source_gap_count=${valueOrUnknown(status.source_gap_count ?? 0)}`
  ].join('; ');
}

function resolveReviewHandoff(options = {}) {
  if (!options.date) return null;
  try {
    const resolverOptions = {
      root: options.root,
      date: options.date
    };
    if (Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')) {
      resolverOptions.changedArtifacts = options.changedArtifacts;
    }
    return resolveReviewableArtifacts(resolverOptions);
  } catch (_) {
    return null;
  }
}

function recommendedEditorAction(status) {
  if (ensureArray(status.consistency_errors).length > 0) {
    return 'status artifact와 현재 산출물 재계산 결과가 다릅니다. PR 생성 전에 status artifact와 review artifact를 함께 확인하세요.';
  }
  if (status.final_publish_ready === true && status.validate_outcome === 'success') {
    return '최종 발행 조건이 모두 통과했습니다. 편집 검토를 마친 뒤 병합할 수 있습니다.';
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

function renderEditorApprovedPublicationPolicy() {
  return renderEditorPublicationPolicyMarkdown();
}

function renderCompositionSummary(status) {
  return [
    '## 기사 구성 요약',
    '',
    `- composition_mode: ${valueOrUnknown(status.composition_mode)}`,
    `- selection_composition_mode: ${valueOrUnknown(status.selection_composition_mode ?? status.composition_mode)}`,
    `- final_publish_ready: ${booleanText(status.final_publish_ready)}`,
    `- editor_review_required: ${booleanText(status.editor_review_required)}`,
    `- review_gate_passed: ${booleanText(status.review_gate_passed)}`,
    `- publish_gate_passed: ${booleanText(status.publish_gate_passed)} (후보 선택 발행 조건)`,
    `- publish_gate_reason_codes: ${ensureArray(status.publish_gate_reason_codes).join('; ') || 'none'}`,
    `- publish_gate_reason_summary: ${ensureArray(status.publish_gate_reason_summary)
      .map(item => `${item.code || 'unknown'} actual=${valueOrUnknown(item.actual)} required=${valueOrUnknown(item.required)}`)
      .join('; ') || 'none'}`,
    `- direct_aosp_camera count: ${valueOrUnknown(countFromStatus(status, 'direct_aosp_camera_count'))}`,
    `- camera_driver_image_pipeline count: ${valueOrUnknown(countFromStatus(status, 'camera_driver_image_pipeline_count'))}`,
    `- android_platform_camera_adjacent count: ${valueOrUnknown(countFromStatus(status, 'android_platform_camera_adjacent_count'))}`,
    `- android_multimedia_camera_output count: ${valueOrUnknown(countFromStatus(status, 'android_multimedia_camera_output_count'))}`,
    `- soc_platform_signal count: ${valueOrUnknown(countFromStatus(status, 'soc_platform_signal_count'))}`,
    `- cpp_ai_tooling_fallback count: ${valueOrUnknown(countFromStatus(status, 'cpp_ai_tooling_fallback_count'))}`,
    `- generic_tech_watchlist count: ${valueOrUnknown(countFromStatus(status, 'generic_tech_watchlist_count'))}`,
    `- primary_camera_stack_topic_count: ${valueOrUnknown(countFromStatus(status, 'primary_camera_stack_topic_count'))}`,
    `- supporting_main_article_count: ${valueOrUnknown(countFromStatus(status, 'supporting_main_article_count'))}`,
    `- forbidden_main_article_count: ${valueOrUnknown(countFromStatus(status, 'forbidden_main_article_count'))}`,
    `- non_fallback_reviewable_article_count: ${valueOrUnknown(countFromStatus(status, 'non_fallback_reviewable_article_count'))}`,
    `- gate thresholds: ${publishGateCriteriaText()}; configured article range ${articleCountRangeText()}`,
    `- source/parser hints: ${ensureArray(status.selection_shortage_hints).join('; ') || 'none'}`,
    `- composition reason: ${valueOrUnknown(status.composition_reason)}`,
    ''
  ].join('\n');
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

function renderFinalSelectionStatus(status) {
  return [
    '## 최종 후보 선택 상태',
    '',
    `- deterministic_selected_count: ${valueOrUnknown(status.deterministic_selected_count ?? status.selected_article_count)}`,
    `- rendered_main_article_count: ${valueOrUnknown(status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count)}`,
    `- selected_group_count: ${valueOrUnknown(status.selected_group_count)}`,
    `- rendered_group_count: ${valueOrUnknown(status.rendered_group_count)}`,
    `- explicitly_demoted_group_count: ${valueOrUnknown(status.explicitly_demoted_group_count)}`,
    `- hard_blocked_group_count: ${valueOrUnknown(status.hard_blocked_group_count)}`,
    `- group_coverage_ok: ${valueOrUnknown(status.group_coverage_ok)}`,
    `- reserve_candidate_count: ${valueOrUnknown(status.reserve_candidate_count)}`,
    `- input_candidate_count: ${valueOrUnknown(status.input_candidate_count)}`,
    `- eligible_candidate_count: ${valueOrUnknown(status.eligible_candidate_count)}`,
    `- selected_article_count: ${valueOrUnknown(status.selected_article_count)}`,
    `- reporter_candidate_count: ${valueOrUnknown(status.reporter_candidate_count)}`,
    `- reporter_selected_count: ${valueOrUnknown(status.reporter_selected_count)}`,
    `- final_input_candidate_count: ${valueOrUnknown(status.final_input_candidate_count ?? status.input_candidate_count)}`,
    `- final_eligible_candidate_count: ${valueOrUnknown(status.final_eligible_candidate_count ?? status.eligible_candidate_count)}`,
    `- final_selected_article_count: ${valueOrUnknown(status.final_selected_article_count ?? status.selected_article_count)}`,
    `- reporter_selected_but_final_excluded_count: ${valueOrUnknown(status.reporter_selected_but_final_excluded_count)}`,
    `- selection_warnings: ${ensureArray(status.selection_warnings).join('; ') || 'none'}`,
    `- selection_errors: ${ensureArray(status.selection_errors).join('; ') || 'none'}`,
    `- top exclusion reasons: ${formatReasonSummary(status.exclusion_reason_summary)}`,
    `- top final exclusion reasons: ${formatReasonSummary(ensureArray(status.final_exclusion_reason_summary).length > 0 ? status.final_exclusion_reason_summary : status.exclusion_reason_summary)}`,
    '',
    'Source/parser recovery hint:',
    ensureArray(status.selection_shortage_hints).map(item => `- ${item}`).join('\n') || '- none',
    '',
    status.candidate_selection_note || 'Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.',
    ''
  ].join('\n');
}

function evidencePackValue(value, fallback = 'unknown') {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value)) return value.length > 0 ? value.map(item => evidencePackValue(item)).join('; ') : fallback;
  if (typeof value === 'object') {
    return firstText([value.message, value.reason, value.problem, value.error, value.code, value.path, value.title, value.name]) ||
      truncateText(JSON.stringify(value), 180);
  }
  return String(value);
}

function evidencePackBoolean(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return 'unknown';
}

function evidencePackObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function evidencePackNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function evidencePackNumberSum(values) {
  const parsed = ensureArray(values).map(evidencePackNumber).filter(value => value !== null);
  if (parsed.length === 0) return null;
  return parsed.reduce((sum, value) => sum + value, 0);
}

function evidencePackList(values, fallback = 'none') {
  const out = ensureArray(values)
    .map(value => evidencePackValue(value))
    .filter(value => value && value !== 'unknown');
  return out.length > 0 ? out.join('; ') : fallback;
}

function evidencePackClaimSummary(report = {}, selected = []) {
  const summary = evidencePackObject(report.claim_validation_summary);
  if (Object.keys(summary).length > 0) return summary;

  const validations = ensureArray(selected).map(article => evidencePackObject(article.claim_validation));
  const availableCount = validations.filter(validation => {
    const status = String(validation.status || '').trim().toLowerCase();
    return status && status !== 'not_available' && status !== 'unknown';
  }).length;
  const notAvailableCount = validations.length - availableCount;
  const riskRank = new Map([
    ['low', 1],
    ['medium', 2],
    ['high', 3]
  ]);
  const overclaimRisk = validations
    .map(validation => String(validation.overclaim_risk || validation.overclaimRisk || '').trim().toLowerCase())
    .filter(value => riskRank.has(value))
    .sort((left, right) => riskRank.get(right) - riskRank.get(left))[0] || 'unknown';

  return {
    status: validations.length === 0
      ? 'not_available'
      : availableCount === 0
        ? 'not_available'
        : notAvailableCount > 0
          ? 'partial'
          : 'available',
    bound_claims: evidencePackNumberSum(validations.map(validation => validation.bound_claims ?? validation.boundClaims)),
    total_claims: evidencePackNumberSum(validations.map(validation => validation.total_claims ?? validation.totalClaims)),
    overclaim_risk: overclaimRisk,
    available_article_count: availableCount,
    not_available_article_count: notAvailableCount
  };
}

function evidencePackHalImpactSummary(report = {}, selected = []) {
  const summary = evidencePackObject(report.hal_impact_summary);
  if (Object.keys(summary).length > 0) return summary;

  const articles = ensureArray(selected);
  const axes = [...new Set(articles.flatMap(article => ensureArray(article.hal_impact_axes))
    .map(value => evidencePackValue(value))
    .filter(value => value && value !== 'unknown'))];
  return {
    axes,
    article_count_with_axes: articles.filter(article => ensureArray(article.hal_impact_axes).length > 0).length,
    article_count_without_axes: articles.filter(article => ensureArray(article.hal_impact_axes).length === 0).length
  };
}

function formatEvidencePackClaimValidation(validation = {}) {
  const value = evidencePackObject(validation);
  return [
    `status=${evidencePackValue(value.status, 'not_available')}`,
    `bound=${evidencePackValue(value.bound_claims ?? value.boundClaims)}`,
    `total=${evidencePackValue(value.total_claims ?? value.totalClaims)}`
  ].join('; ');
}

function renderEvidencePackClaimHalSummary(report = {}, selected = []) {
  const claimSummary = evidencePackClaimSummary(report, selected);
  const halSummary = evidencePackHalImpactSummary(report, selected);
  const articleRows = ensureArray(selected);
  const articleTable = articleRows.length > 0
    ? renderMarkdownTable(
      ['Article', 'HAL axes', 'Claim validation', 'Overclaim risk'],
      articleRows.map(article => {
        const validation = evidencePackObject(article.claim_validation);
        return [
          formatEvidencePackLink(article),
          evidencePackList(article.hal_impact_axes),
          formatEvidencePackClaimValidation(validation),
          evidencePackValue(validation.overclaim_risk ?? validation.overclaimRisk)
        ];
      })
    )
    : '- none';

  return [
    '## Claim / HAL Impact 요약',
    '',
    `- Claim validation status: ${evidencePackValue(claimSummary.status, 'not_available')}`,
    `- Claim coverage: bound_claims=${evidencePackValue(claimSummary.bound_claims)}; total_claims=${evidencePackValue(claimSummary.total_claims)}`,
    `- Claim validation availability: available_articles=${evidencePackValue(claimSummary.available_article_count)}; not_available_articles=${evidencePackValue(claimSummary.not_available_article_count)}`,
    `- Overclaim risk: ${evidencePackValue(claimSummary.overclaim_risk)}`,
    `- HAL impact axes: ${evidencePackList(halSummary.axes)}`,
    `- Articles without HAL impact axes: ${evidencePackValue(halSummary.article_count_without_axes)}`,
    '',
    articleTable,
    ''
  ].join('\n');
}

function evidencePackCandidateTitle(candidate = {}) {
  return firstText([candidate.title, candidate.headline, candidate.article_title, candidate.name]) || 'unknown title';
}

function evidencePackCandidateUrl(candidate = {}) {
  return extractCandidateUrl(candidate);
}

function evidencePackCandidateSource(candidate = {}) {
  return extractCandidateSource(candidate) || 'unknown';
}

function evidencePackCandidateBucket(candidate = {}) {
  return firstText([candidate.relevance_bucket, candidate.bucket, candidate.category]) || 'unknown';
}

function evidencePackCandidateReason(candidate = {}) {
  return firstText([
    candidate.selection_reason,
    candidate.exclusion_reason,
    candidate.reason,
    ensureArray(candidate.final_exclusion_reasons).join('; '),
    ensureArray(candidate.exclusion_reasons).join('; ')
  ]) || 'unknown';
}

function formatEvidencePackLink(candidate = {}) {
  return formatCandidateLink({
    title: evidencePackCandidateTitle(candidate),
    url: evidencePackCandidateUrl(candidate)
  });
}

function formatEvidencePackUrlCell(candidate = {}) {
  const url = sanitizeMarkdownLinkUrl(evidencePackCandidateUrl(candidate));
  return url ? trustedMarkdownTableCell(`[source](<${url}>)`) : 'missing';
}

function renderEvidencePackDiagnosticSummary(label, items, maxItems = 5) {
  const values = ensureArray(items).map(item => evidencePackValue(item)).filter(Boolean);
  if (values.length === 0) return `- ${label}: none`;
  const visible = values.slice(0, maxItems).map(item => truncateText(item, 180));
  const suffix = values.length > maxItems ? `; ... +${values.length - maxItems} more` : '';
  return `- ${label}: ${visible.join('; ')}${suffix}`;
}

function renderHalSignalQualitySummary(root, date, status = {}) {
  if (!date) return '';
  const relPath = `articles/content/newsroom/${date}/hal-signal-quality-report.json`;
  const report = readJsonObjectIfExists(path.join(root, relPath));
  if (!report) {
    return [
      '## HAL Signal Quality Summary',
      '',
      '- HAL signal quality report: unavailable',
      `- Reason: ${relPath} not found`,
      ''
    ].join('\n');
  }
  const summary = report.hal_signal_quality_summary || {};
  const checks = ensureArray(report.main_article_signal_checks);
  const hardBlockerChecks = checks.filter(item =>
    ensureArray(item.hard_blocker_reason_codes || item.hard_blockers).length > 0
  );
  const hardBlockerReasonCodes = [...new Set(hardBlockerChecks.flatMap(item =>
    ensureArray(item.hard_blocker_reason_codes || item.hard_blockers)
  ))];
  const affectedMainArticles = hardBlockerChecks.map(item => item.title).filter(Boolean);
  const visibleAffectedMainArticles = affectedMainArticles.slice(0, 5).map(title => truncateText(title, 160));
  const affectedMainArticleSuffix = affectedMainArticles.length > visibleAffectedMainArticles.length
    ? `; ... +${affectedMainArticles.length - visibleAffectedMainArticles.length} more`
    : '';
  const rows = checks.slice(0, 8).map(item => [
    item.index || '',
    item.title || '',
    item.signal_quality_status || 'unknown',
    item.actionability_level || 'unknown',
    item.effective_actionability_level || item.actionability_level || 'unknown',
    ensureArray(item.hal_impact_axes).join(', ') || 'none',
    item.hal_signal_capsule_complete === true ? 'complete' : `missing ${ensureArray(item.hal_signal_capsule_missing_keys).join(', ') || 'capsule'}`,
    ensureArray(item.hard_blocker_reason_codes || item.hard_blockers).join(', ') || 'none'
  ]);
  return [
    '## HAL Signal Quality Summary',
    '',
    `- status: ${valueOrUnknown(report.status)}`,
    `- input_completeness: ${valueOrUnknown(report.input_completeness)}`,
    `- quality_status: ${valueOrUnknown(report.quality_status)}`,
    `- final_publish_ready: ${valueOrUnknown(status.final_publish_ready)}`,
    `- publish_gate_reason_codes: ${ensureArray(status.publish_gate_reason_codes).join(', ') || 'none'}`,
    `- main_article_count: ${valueOrUnknown(summary.main_article_count)}`,
    `- strong_signal_count: ${valueOrUnknown(summary.strong_signal_count)}`,
    `- usable_signal_count: ${valueOrUnknown(summary.usable_signal_count)}`,
    `- weak_signal_count: ${valueOrUnknown(summary.weak_signal_count)}`,
    `- watchlist_only_count: ${valueOrUnknown(summary.watchlist_only_count)}`,
    `- blocked_source_gap_count: ${valueOrUnknown(summary.blocked_source_gap_count)}`,
    `- article_count_with_hal_signal_capsule: ${valueOrUnknown(summary.article_count_with_hal_signal_capsule)}`,
    `- article_count_without_hal_signal_capsule: ${valueOrUnknown(summary.article_count_without_hal_signal_capsule)}`,
    `- generic_signal_hard_blocker_count: ${valueOrUnknown(summary.generic_signal_hard_blocker_count)}`,
    `- HAL signal hard blocker count: ${valueOrUnknown(summary.hal_signal_hard_blocker_count ?? hardBlockerChecks.length)}`,
    `- HAL signal hard blocker reason codes: ${hardBlockerReasonCodes.join(', ') || 'none'}`,
    `- Affected main articles: ${visibleAffectedMainArticles.join('; ') || 'none'}${affectedMainArticleSuffix}`,
    `- optional input_unavailable: ${ensureArray(report.inputs?.unavailable_optional).join(', ') || 'none'}`,
    `- Artifact: \`${relPath}\``,
    '',
    rows.length > 0
      ? renderMarkdownTable(
        ['#', 'Article', 'signal_quality_status', 'actionability_level', 'effective_actionability_level', 'hal_impact_axes', 'capsule', 'hard_blocker_reason_codes'],
        rows
      )
      : '- none',
    ''
  ].join('\n');
}

function formatCountSummary(counts) {
  return Object.entries(counts || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || String(a[0]).localeCompare(String(b[0])))
    .slice(0, 6)
    .map(([key, count]) => `${key}: ${count}`)
    .join(', ') || 'none';
}

function renderSourceQualityGateSummary(root, date) {
  if (!date) return '';
  const relPath = `articles/content/newsroom/${date}/source-effectiveness-report.json`;
  const report = readJsonObjectIfExists(path.join(root, relPath));
  if (!report) {
    return [
      '## Source Quality Gate Summary',
      '',
      '- source quality report: unavailable',
      `- Reason: ${relPath} not found`,
      ''
    ].join('\n');
  }
  const summary = report.summary || {};
  const coverage = summary.selected_main_source_quality_coverage || {};
  const mainEligibleCoverage = summary.main_eligible_source_quality_coverage || {};
  return [
    '## Source Quality Gate Summary',
    '',
    `- selected main source_quality coverage: ${valueOrUnknown(coverage.with_source_quality_count || 0)}/${valueOrUnknown(coverage.selected_main_count || 0)}`,
    `- main-eligible source_quality coverage: ${valueOrUnknown(mainEligibleCoverage.with_source_quality_count || 0)}/${valueOrUnknown(mainEligibleCoverage.main_eligible_candidate_count || 0)}`,
    `- unknown_source_quality_count: ${valueOrUnknown(summary.unknown_source_quality_count || 0)}`,
    `- source_quality_field_drift_count: ${valueOrUnknown(summary.source_quality_field_drift_count || 0)}`,
    `- legacy_source_quality_warning_count: ${valueOrUnknown(summary.legacy_source_quality_warning_count || 0)}`,
    `- conditional promoted/blocked: ${valueOrUnknown(summary.conditional_source_promoted_count || 0)}/${valueOrUnknown(summary.conditional_source_blocked_count || 0)}`,
    `- source_quality_status: ${formatCountSummary(summary.source_quality_status_summary)}`,
    `- top blockers: ${formatCountSummary(summary.source_quality_blocker_summary)}`,
    `- Artifact: \`${relPath}\``,
    ''
  ].join('\n');
}

function renderSourceQualityDiagnosisSummary(root, date) {
  if (!date) return '';
  const jsonRelPath = `articles/content/newsroom/${date}/source-quality-diagnosis.json`;
  const markdownRelPath = `articles/content/newsroom/${date}/source-quality-diagnosis.md`;
  const jsonPath = path.join(root, jsonRelPath);
  const report = readJsonObjectIfExists(jsonPath);
  if (!report) {
    return [
      '## 소스 품질 진단 / Source Quality Diagnosis',
      '',
      '- Status: generation failed or unavailable',
      `- Reason: ${jsonRelPath} ${fs.existsSync(jsonPath) ? 'is not valid JSON' : 'not found'}`,
      '- Impact: advisory report only, publish/readiness gates are unaffected.',
      ''
    ].join('\n');
  }
  const activeLabels = DIAGNOSIS_KEYS
    .filter(key => report.diagnosis?.[key] === true)
    .map(key => DIAGNOSIS_LABELS_KO[key] || key);
  const topIssues = ensureArray(report.recommended_issues).slice(0, 3);
  const issueLines = topIssues.length > 0
    ? topIssues.map((issue, index) => {
      const action = RECOMMENDED_ACTION_LABELS_KO[issue.action] || issue.action || 'unknown';
      const target = issue.source_name || issue.source_id || '전체';
      return `  ${index + 1}. ${target}: ${action} - ${valueOrUnknown(issue.reason)}`;
    })
    : ['  - 없음'];
  return [
    '## 소스 품질 진단 / Source Quality Diagnosis',
    '',
    '- Artifact:',
    `  - \`${jsonRelPath}\``,
    `  - \`${markdownRelPath}\``,
    '- 요약:',
    `  - 원본 후보 수: ${valueOrUnknownKo(report.raw_candidate_count)}`,
    `  - 최종 사용 가능 후보 수: ${valueOrUnknownKo(report.eligible_candidate_count)}`,
    `  - 주요 진단: ${activeLabels.join(', ') || '없음'}`,
    `  - 경고: ${ensureArray(report.warnings).length}`,
    '- 권장 조치 Top 3:',
    ...issueLines,
    ''
  ].join('\n');
}

function renderNewsletterImageAuditSummary(root, date) {
  if (!date) return '';
  const aggregateRelPath = 'articles/content/newsroom/image-audit-aggregate-report.json';
  const dateJsonRelPath = `articles/content/newsroom/${date}/image-audit-report.json`;
  const dateMarkdownRelPath = `articles/content/newsroom/${date}/image-audit-report.md`;
  const aggregate = readJsonObjectIfExists(path.join(root, aggregateRelPath));
  const report = readJsonObjectIfExists(path.join(root, dateJsonRelPath));
  if (!report) {
    return [
      '## 이미지 감사 / Image Audit',
      '',
      '- 상태: 생성 실패 또는 사용 불가',
      `- 사유: \`${dateJsonRelPath}\` ${fs.existsSync(path.join(root, dateJsonRelPath)) ? 'JSON 형식 오류' : '파일 없음'}`,
      '- 영향: 이미지 감사는 advisory/reporting artifact이며 기존 publish/readiness 판정을 약화하지 않습니다.',
      ''
    ].join('\n');
  }
  const summary = report.summary || {};
  const aggregateSummary = aggregate?.summary || {};
  const repairableDates = ensureArray(aggregate?.repairableDates);
  const generatedFrom = aggregate ? aggregateRelPath : dateJsonRelPath;
  return [
    '## 이미지 감사 / Image Audit',
    '',
    `- 감사한 issue 수: ${valueOrUnknownKo(aggregateSummary.auditedIssueCount ?? 1)}`,
    `- 감사한 article 수: ${valueOrUnknownKo(aggregateSummary.auditedArticleCount ?? summary.article_count)}`,
    `- 복원 가능 article 수: ${valueOrUnknownKo(aggregateSummary.repairableArticleCount ?? summary.repairable_article_count)}`,
    `- 이번 repair 실행 복원 수: ${valueOrUnknownKo(aggregateSummary.repairedInThisRunCount ?? summary.repaired_in_this_run_count ?? 0)}`,
    `- imageSelection 선택 상태 수: ${valueOrUnknownKo(aggregateSummary.selectedByImageSelectionCount ?? summary.selected_by_image_selection_count ?? 0)}`,
    `- 후보 없음 article 수: ${valueOrUnknownKo(aggregateSummary.unrepairableNoCandidateCount ?? summary.unrepairable_no_candidate_count)}`,
    `- validator 제외 수: ${valueOrUnknownKo(aggregateSummary.excludedValidatorFailedCount ?? summary.excluded_validator_failed_count)}`,
    `- attribution 부족 제외 수: ${valueOrUnknownKo(aggregateSummary.excludedAttributionMissingCount ?? summary.excluded_attribution_missing_count)}`,
    `- 출처 근거 부족 대표 이미지 수: ${valueOrUnknownKo(aggregateSummary.selectedImageWithoutValidCandidateCount ?? summary.selected_image_without_valid_candidate_count ?? 0)}`,
    `- 후보 목록 불일치 대표 이미지 수: ${valueOrUnknownKo(aggregateSummary.selectedImageNotInCandidatesCount ?? summary.selected_image_not_in_candidates_count ?? 0)}`,
    `- 렌더 결과 불일치 수: ${valueOrUnknownKo(aggregateSummary.selectedImageRenderMismatchCount ?? summary.selected_image_render_mismatch_count)}`,
    `- publish 차단 이슈 수: ${valueOrUnknownKo(aggregateSummary.publishBlockingIssueCount ?? summary.publish_blocking_issue_count)}`,
    '',
    '### 복원 가능 날짜',
    '',
    '- 생성 기준:',
    `  - \`${generatedFrom}\``,
    '',
    '```text',
    repairableDates.join('\n') || '없음',
    '```',
    '',
    '### 산출물',
    '',
    ...(aggregate ? [
      `- \`${aggregateRelPath}\``,
      '- `articles/content/newsroom/image-audit-aggregate-report.md`'
    ] : []),
    `- \`${dateJsonRelPath}\``,
    `- \`${dateMarkdownRelPath}\``,
    ''
  ].join('\n');
}

function renderEvidencePackSummary(root, date) {
  if (!date) return '';
  const relPath = `articles/content/newsroom/${date}/evidence-pack-summary.json`;
  const report = readJsonObjectIfExists(path.join(root, relPath));
  if (!report) {
    return [
      '## Evidence Pack 요약',
      '',
      '- Evidence Pack summary: unavailable',
      `- Reason: ${relPath} not found`,
      ''
    ].join('\n');
  }

  const selection = report.selection_summary && typeof report.selection_summary === 'object'
    ? report.selection_summary
    : {};
  const selected = ensureArray(report.selected_main_articles);
  const excluded = ensureArray(report.excluded_candidates_top).slice(0, 10);
  const diagnostics = report.failure_diagnostics && typeof report.failure_diagnostics === 'object'
    ? report.failure_diagnostics
    : {};

  const selectedTable = selected.length > 0
    ? renderMarkdownTable(
      ['#', 'Title', 'Source', 'URL', 'Source tier', 'Source role', 'URL quality', 'Bucket', 'Freshness', 'Reason'],
      selected.map((article, index) => [
        index + 1,
        formatEvidencePackLink(article),
        evidencePackCandidateSource(article),
        formatEvidencePackUrlCell(article),
        evidencePackValue(article.source_tier),
        evidencePackValue(article.source_role),
        evidencePackValue(article.source_url_quality),
        evidencePackCandidateBucket(article),
        evidencePackValue(article.freshness_window),
        evidencePackCandidateReason(article)
      ])
    )
    : '- none';

  const excludedTable = excluded.length > 0
    ? renderMarkdownTable(
      ['Title', 'Source', 'Bucket', 'Reason'],
      excluded.map(candidate => [
        formatEvidencePackLink(candidate),
        evidencePackCandidateSource(candidate),
        evidencePackCandidateBucket(candidate),
        evidencePackCandidateReason(candidate)
      ])
    )
    : '- none';

  const excludedTruncationNote = report.excluded_candidates_truncated === true
    ? `\n\n- More excluded candidates are available in \`${relPath}\`.`
    : '';

  return [
    '## Evidence Pack 요약',
    '',
    `- Raw candidates: ${evidencePackValue(selection.raw_candidate_count)}`,
    `- Eligible candidates: ${evidencePackValue(selection.eligible_candidate_count)}`,
    `- Selected main articles: ${evidencePackValue(selection.selected_main_article_count ?? selected.length)}`,
    `- Reserve candidates: ${evidencePackValue(selection.reserve_candidate_count)}`,
    `- Excluded candidates: ${evidencePackValue(selection.excluded_candidate_count)}`,
    `- Primary camera stack count: ${evidencePackValue(selection.primary_camera_stack_count)}`,
    `- Android multimedia camera output count: ${evidencePackValue(selection.android_multimedia_camera_output_count)}`,
    `- Supporting bucket count: ${evidencePackValue(selection.supporting_bucket_count)}`,
    `- Fallback window used: ${evidencePackValue(selection.fallback_window_used)}`,
    `- Fallback window consulted: ${evidencePackBoolean(selection.fallback_window_consulted)}`,
    `- Fallback window reason: ${evidencePackValue(selection.fallback_window_reason, 'none')}`,
    `- Fallback promoted candidates: ${evidencePackValue(selection.fallback_candidates_promoted_count)}`,
    `- Fallback bucket used: ${evidencePackBoolean(selection.fallback_bucket_used)}`,
    `- Artifact: \`${relPath}\``,
    '',
    renderEvidencePackClaimHalSummary(report, selected),
    '',
    '## 선택된 Main Article 근거',
    '',
    selectedTable,
    '',
    '## 제외 후보 근거',
    '',
    `${excludedTable}${excludedTruncationNote}`,
    '',
    '## Needs-fix / Review-only 진단',
    '',
    renderEvidencePackDiagnosticSummary('Quality hard failures', diagnostics.quality_hard_failures),
    renderEvidencePackDiagnosticSummary('Fact-check must-fix', diagnostics.fact_check_must_fix),
    renderEvidencePackDiagnosticSummary('Repair failure', diagnostics.repair_failures),
    renderEvidencePackDiagnosticSummary('Candidate shortage hints', diagnostics.candidate_shortage_hints),
    renderEvidencePackDiagnosticSummary('Source gap warnings', diagnostics.source_gap_warnings),
    renderEvidencePackDiagnosticSummary('Missing artifacts', diagnostics.missing_artifacts),
    renderEvidencePackDiagnosticSummary('Invalid artifacts', diagnostics.invalid_artifacts),
    '',
    '## 사람 검토 체크리스트',
    '',
    '- [ ] selected main article에 source URL이 있다.',
    '- [ ] selected main article에 dated evidence 또는 limitation reason이 있다.',
    '- [ ] HAL impact가 source보다 과장되지 않았다.',
    '- [ ] fallback/supporting article이 main을 과하게 채우지 않는다.',
    '- [ ] source gap risk article이 main으로 승격되지 않았다.',
    ''
  ].join('\n');
}

function renderSourceChangeEventsSummary(root, date) {
  const relPath = `articles/content/source-events/${date}/source-change-events.json`;
  const report = readJsonObjectIfExists(path.join(root, relPath));
  if (!report) {
    return [
      '## Source Snapshot Changes',
      '',
      '- source change event report: unavailable',
      `- expected path: \`${relPath}\``
    ].join('\n');
  }
  const summary = report.summary || {};
  return [
    '## Source Snapshot Changes',
    '',
    `- report: \`${relPath}\``,
    `- monitored_source_count: ${valueOrUnknown(summary.monitored_source_count)}`,
    `- snapshot_page_count: ${valueOrUnknown(summary.snapshot_page_count)}`,
    `- new_page_count: ${valueOrUnknown(summary.new_page_count)}`,
    `- updated_page_count: ${valueOrUnknown(summary.updated_page_count)}`,
    `- monitor_diagnostic_count: ${valueOrUnknown(summary.monitor_diagnostic_count)}`,
    '',
    '## Source Change Events',
    '',
    `- event_type_counts: ${JSON.stringify(summary.event_type_counts || {})}`,
    `- generated_candidate_count: ${valueOrUnknown(summary.generated_candidate_count)}`,
    '',
    '## Evidence Identity / Duplicate Guard',
    '',
    `- duplicate_event_evidence_count: ${valueOrUnknown(summary.duplicate_event_evidence_count)}`,
    '- processed source event/evidence history is snapshot state and must not be exposed in public newsletter output.',
    '',
    '## Date Quality',
    '',
    '- Check `date_source`, `date_confidence`, `effective_date`, `needs_editor_date_review`, and `main_article_allowed` before publication.'
  ].join('\n');
}

function renderSeedEvidenceUsageSummary(root, date) {
  if (!date) return '';
  const seedPackRelPath = `articles/content/collected-news/${date}/seed-evidence-pack.json`;
  const mergedRelPath = `articles/content/collected-news/${date}/merged-candidates.json`;
  const seedPack = readJsonObjectIfExists(path.join(root, seedPackRelPath));
  const merged = readJsonObjectIfExists(path.join(root, mergedRelPath));
  const candidates = ensureArray(merged?.candidates)
    .filter(candidate =>
      ensureArray(candidate.evidence_pack_ids).length > 0 ||
      ensureArray(candidate.primary_evidence_ids).length > 0 ||
      candidate.compact_evidence ||
      candidate.origin === 'seed_url_evidence'
    )
    .slice(0, 10);
  if (!seedPack && candidates.length === 0) return '';

  const rows = candidates.length > 0
    ? renderMarkdownTable(
      ['#', 'Candidate', 'Evidence pack IDs', 'Primary evidence IDs', 'Source extraction ref', 'Compact facts'],
      candidates.map((candidate, index) => [
        index + 1,
        formatCandidateLink({
          title: extractCandidateTitle(candidate) || 'unknown title',
          url: extractCandidateUrls(candidate)[0] || ''
        }),
        ensureArray(candidate.evidence_pack_ids).join(', ') || 'none',
        ensureArray(candidate.primary_evidence_ids).join(', ') || 'none',
        candidate.source_extraction_ref || 'none',
        ensureArray(candidate.compact_evidence?.primary_facts).slice(0, 2).join('; ') || 'none'
      ])
    )
    : '- none';

  return [
    '## Seed Evidence Usage Summary',
    '',
    `- seed-evidence-pack: ${seedPack ? `\`${seedPackRelPath}\`` : 'unavailable'}`,
    `- pack_count: ${valueOrUnknown(ensureArray(seedPack?.packs).length)}`,
    `- candidate_count_with_seed_evidence: ${candidates.length}`,
    '- Stage 3 seed re-crawl: prohibited; final generation uses candidate-level `compact_evidence` only.',
    '',
    rows,
    ''
  ].join('\n');
}

function renderReviewOnlyStatus(status, handoff, root, date) {
  if (!handoff?.diagnosticsOnly) return '';
  const generationStatus = date
    ? loadNewsroomReport(root, date, 'generation-status.json') || {}
    : {};
  const failureStage = valueOrUnknown(generationStatus.failure_stage ?? status.failure_stage);
  const failureReason = valueOrUnknown(generationStatus.failure_reason ?? status.failure_reason);
  return [
    '## Diagnostics-only Status',
    '',
    '이 PR은 diagnostics-only입니다. public newsletter files가 준비되지 않았으므로 merge해도 Newsletter 홈페이지에 표시되지 않습니다. This PR is not publish-ready.',
    '',
    `- diagnostics_only: ${booleanText(handoff.diagnosticsOnly)}`,
    `- public_newsletter_ready: ${booleanText(handoff.publicNewsletterReady)}`,
    `- homepage_visible_after_merge: ${booleanText(handoff.homepageVisibleAfterMerge)}`,
    '- final_publish_ready: false',
    '- publish_gate_passed: false (public validation skipped)',
    `- quality_status: ${valueOrUnknown(status.quality_status ?? generationStatus.quality_status)}`,
    `- quality_score: ${valueOrUnknown(status.quality_score ?? generationStatus.quality_score)}`,
    `- quality_threshold: ${valueOrUnknown(status.quality_threshold ?? generationStatus.quality_threshold)}`,
    `- failure_stage: ${failureStage}`,
    `- failure_reason: ${failureReason}`,
    ''
  ].join('\n');
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

function renderPublicNewsletterReadiness(root, date, handoff) {
  if (!handoff || (!handoff.diagnosticsOnly && !handoff.publicNewsletterReady)) return '';
  const required = date ? requiredPublicFiles(date) : [];
  return [
    '## Public Newsletter Readiness',
    '',
    `- public_newsletter_ready: ${booleanText(handoff.publicNewsletterReady)}`,
    `- review_publication_ready: ${booleanText(handoff.reviewPublicationReady)}`,
    `- diagnostics_only: ${booleanText(handoff.diagnosticsOnly)}`,
    `- homepage_visible_after_merge: ${booleanText(handoff.homepageVisibleAfterMerge)}`,
    `- publication_mode: ${valueOrUnknown(handoff.publicationMode)}`,
    `- homepage_visibility: ${valueOrUnknown(handoff.homepageVisibility)}`,
    `- normal_public_ready: ${booleanText(handoff.normalPublicReady)}`,
    `- automatic_publish_ready: ${booleanText(handoff.automaticPublishReady)}`,
    `- public_artifact_ready: ${booleanText(handoff.publicArtifactReady)}`,
    `- fallback_public_ready: ${booleanText(handoff.fallbackPublicReady)}`,
    `- fallback_only: ${booleanText(handoff.fallbackOnly)}`,
    `- camera_anchor_count: ${valueOrUnknown(handoff.cameraAnchorCount)}`,
    `- homepage_badge: ${valueOrUnknown(handoff.homepageBadge || 'none')}`,
    `- public_newsletter_reason: ${valueOrUnknown(handoff.publicNewsletterReason)}`,
    `- review_pr_ready: ${booleanText(handoff.reviewPrReady)}`,
    `- publish_candidate_ready: ${booleanText(handoff.publishCandidateReady)}`,
    '- required public files:',
    ...(required.length > 0 ? required.map(filePath => `  - ${filePath}`) : ['  - unknown']),
    ''
  ].join('\n');
}

function renderFailureDiagnostics(root, date, status, handoff) {
  if (!handoff?.diagnosticsOnly) return '';
  const generationStatus = date
    ? loadNewsroomReport(root, date, 'generation-status.json') || {}
    : {};
  const repairFailure = date
    ? loadNewsroomReport(root, date, 'repair-failure.json')
    : null;
  const selectionHints = ensureArray(status.selection_shortage_hints);
  return [
    '## Failure Diagnostics',
    '',
    '### Repair Failure',
    '',
    repairFailure
      ? `- repair_failure: ${valueOrUnknown(repairFailure.message || repairFailure.reason || repairFailure.code || repairFailure.name)}`
      : '- repair_failure: unavailable',
    `- failure_stage: ${valueOrUnknown(generationStatus.failure_stage ?? status.failure_stage)}`,
    `- failure_reason: ${valueOrUnknown(generationStatus.failure_reason ?? status.failure_reason ?? repairFailure?.message ?? repairFailure?.reason)}`,
    '',
    '### Candidate Shortage',
    '',
    selectionHints.length > 0 ? selectionHints.map(item => `- ${item}`).join('\n') : '- none',
    '',
    '### Article Quality Summary',
    '',
    `- quality_status: ${valueOrUnknown(status.quality_status)}`,
    `- quality_score: ${valueOrUnknown(status.quality_score)}`,
    `- quality_threshold: ${valueOrUnknown(status.quality_threshold)}`,
    `- must_fix_count: ${valueOrUnknown(status.must_fix_count ?? 0)}`,
    `- source_gap_count: ${valueOrUnknown(status.source_gap_count ?? 0)}`,
    ''
  ].filter(line => line !== '').join('\n');
}

function candidateShortageStatus(status = {}, root, date) {
  const generationStatus = date
    ? loadNewsroomReport(root, date, 'generation-status.json') || {}
    : {};
  return status.failure_kind === 'candidate_shortage_reviewable' ||
    generationStatus.failure_kind === 'candidate_shortage_reviewable';
}

function formatHintRows(hints) {
  return ensureArray(hints)
    .slice(0, 8)
    .map(hint => {
      if (typeof hint === 'string') return `- ${hint}`;
      return `- ${valueOrUnknown(hint.code)} / ${valueOrUnknown(hint.source_id)}: ${valueOrUnknown(hint.reason)}`;
    });
}

function sourceEffectivenessHints(root, date) {
  if (!date) return [];
  const report = loadNewsroomReport(root, date, 'source-effectiveness-report.json');
  if (!report) return [];
  return ensureArray(report.sources)
    .filter(source => ['OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR', 'KEEP_AND_FIX_PARSER', 'REVIEW_SOURCE_OR_PARSER'].includes(source.recommendation))
    .slice(0, 8)
    .map(source => ({
      code: source.recommendation,
      source_id: source.source_id,
      reason: ensureArray(source.reasons).join('; ') || `eligible_count=${valueOrUnknown(source.eligible_count)}`
    }));
}

function renderCatchUpSummary(root, date) {
  if (!date) return '';
  const shortlist = loadNewsroomReport(root, date, 'shortlisted-candidates.json');
  const used = Number(shortlist?.catch_up_used_count || 0);
  if (!Number.isFinite(used) || used <= 0) return '';
  const titles = ensureArray(shortlist?.catch_up_articles)
    .map(item => {
      const weeks = Number.isFinite(Number(item.catch_up_age_days))
        ? `${Math.max(1, Math.round(Number(item.catch_up_age_days) / 7))}주 전`
        : '';
      return `${item.title}${weeks ? ` (${weeks})` : ''}`;
    });
  return [
    '## 지난 소식 (Catch-up)',
    '',
    `이번 호는 fresh 기사가 부족해 ${used}건의 "지난 소식" 기사가 catch-up 레인으로 채워졌습니다.`,
    ...titles.map(title => `- ${title}`),
    '',
    '이 기사는 수 주 전 릴리스를 회고로 다룬 것으로, 한 번만 다루도록 exposure history에 기록됩니다.'
  ].join('\n');
}

function renderCandidatePoolPreflight(root, date, status = {}) {
  if (!candidateShortageStatus(status, root, date)) return '';
  const selectionReport = date
    ? loadNewsroomReport(root, date, 'selection-report.json') || {}
    : {};
  const summary = selectionReport.candidate_shortage_summary || status.candidate_shortage_summary || {};
  const richHints = sourceEffectivenessHints(root, date);
  const fallbackHints = selectionReport.source_parser_hints || status.source_parser_hints || status.selection_shortage_hints;
  const hintRows = richHints.length > 0 ? formatHintRows(richHints) : formatHintRows(fallbackHints);
  const hintHeading = richHints.length > 0 ? 'Source/parser hints:' : 'Source/parser hints (preliminary):';
  const selectionHasPreflight = Object.prototype.hasOwnProperty.call(selectionReport, 'candidate_pool_preflight_passed');
  const statusHasPreflight = Object.prototype.hasOwnProperty.call(status, 'candidate_pool_preflight_passed');
  const preflightPassed = selectionHasPreflight
    ? selectionReport.candidate_pool_preflight_passed === true
    : status.candidate_pool_preflight_passed === true;
  const preflightSource = selectionHasPreflight ? 'selection-report.json' : statusHasPreflight ? 'generation-status.json' : 'unknown';
  const preflightMismatch = selectionHasPreflight &&
    statusHasPreflight &&
    Boolean(selectionReport.candidate_pool_preflight_passed) !== Boolean(status.candidate_pool_preflight_passed);
  return [
    '## Candidate Pool Preflight',
    '',
    'LLM editor generation was skipped because candidate pool was insufficient.',
    '',
    '- candidate_shortage: true',
    `- candidate_pool_preflight_passed: ${booleanText(preflightPassed)}`,
    `- preflight_source: ${preflightSource}`,
    `- preflight_consistency: ${preflightMismatch ? 'mismatch' : 'ok'}`,
    `- shortage_reason_codes: ${ensureArray(selectionReport.shortage_reason_codes || status.shortage_reason_codes).join('; ') || 'none'}`,
    `- publishable_candidate_count: ${valueOrUnknown(summary.publishable_candidate_count)}`,
    `- required_publishable_candidate_count: ${valueOrUnknown(summary.required_publishable_candidate_count)}`,
    `- reserve_candidate_count: ${valueOrUnknown(summary.reserve_candidate_count)}`,
    `- required_reserve_candidate_count: ${valueOrUnknown(summary.required_reserve_candidate_count)}`,
    `- primary_camera_stack_candidate_count: ${valueOrUnknown(summary.primary_camera_stack_candidate_count)}`,
    `- direct_camera_or_driver_candidate_count: ${valueOrUnknown(summary.direct_camera_or_driver_candidate_count)}`,
    `- camera_adjacent_candidate_count: ${valueOrUnknown(summary.camera_adjacent_candidate_count)}`,
    `- supporting_candidate_count: ${valueOrUnknown(summary.supporting_candidate_count)}`,
    '',
    hintHeading,
    ...(hintRows.length > 0 ? hintRows : ['- none']),
    ''
  ].join('\n');
}

function extractCandidateUrl(candidate) {
  return extractCandidateUrls(candidate)[0] || '';
}

function normalizeEditorialDecisionCandidate(raw, { statusHint = '', sourceHint = '' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const title = extractCandidateTitle(raw);
  const urls = extractCandidateUrls(raw);
  const status = statusHint || classifyCandidateStatus(raw);
  const reason = firstText([
    raw.selection_reason,
    raw.selection_exclusion_reason,
    raw.exclusion_reason,
    raw.reason,
    raw.problem,
    ...extractReasonList(raw)
  ]);
  return {
    raw,
    title: title || 'unknown title',
    url: urls[0] || '',
    urls,
    source: extractCandidateSource(raw) || sourceFromValue(raw.source) || 'unknown source',
    sourceId: raw.source_id || raw.sourceId || raw.source?.id || '',
    sourceTier: raw.source_tier || raw.sourceTier || '',
    sourceRole: raw.source_role || raw.sourceRole || '',
    sourceReliability: raw.source_reliability || raw.reliability || '',
    bucket: extractCandidateBucket(raw) || 'unknown bucket',
    status,
    sourceHint,
    sourceGapRisk: raw.source_gap_risk === true || raw.sourceGapRisk === true,
    hasDatedEvidence: raw.has_dated_evidence ?? raw.hasDatedEvidence,
    referenceOnly: raw.reference_only === true || raw.referenceOnly === true,
    finalSelectionEligibility: raw.finalSelectionEligibility || raw.final_selection_eligibility || '',
    halImpactAxes: ensureArray(raw.hal_impact_axes || raw.halImpactAxes || raw.impact_axes),
    keyEvidence: ensureArray(raw.key_evidence || raw.keyEvidence || raw.source_extraction),
    reason,
    reasons: extractReasonList(raw),
    reasonCode: reasonCodeFor(raw, status),
    selectionReason: raw.selection_reason || '',
    exclusionReason: raw.exclusion_reason || raw.selection_exclusion_reason || ''
  };
}

function editorialRowsFromCandidates(candidates, limit = 8) {
  const rows = candidates
    .filter(Boolean)
    .map(candidate => {
      const classification = classifyEditorialDecision(candidate);
      return {
        candidate,
        classification,
        reasonKo: buildDecisionReasonKo(candidate, classification),
        guardrailKo: buildDecisionGuardrailKo(candidate, classification)
      };
    });

  const statusRank = row => TRACE_STATUS_RANK[row.candidate.status] || 99;
  const decisionRank = row => ({
    Main: 1,
    Supporting: 2,
    Short: 3,
    Hold: 4,
    Watch: 5,
    Exclude: 6
  })[row.classification.decision] || 99;

  rows.sort((a, b) =>
    statusRank(a) - statusRank(b) ||
    decisionRank(a) - decisionRank(b) ||
    normalizeMatchText(a.candidate.title).localeCompare(normalizeMatchText(b.candidate.title))
  );

  return rows.slice(0, limit);
}

function candidatesFromArray(items, statusHint, sourceHint) {
  return ensureArray(items)
    .map(item => normalizeEditorialDecisionCandidate(item, { statusHint, sourceHint }))
    .filter(Boolean);
}

function selectionReportCandidates(report) {
  if (!report || typeof report !== 'object') return [];
  return [
    ...candidatesFromArray(report.selected_main_articles || report.selected_articles || report.final_selected_articles, 'final_selected', 'selection-report'),
    ...candidatesFromArray(report.primary_selected_articles, 'primary_selected', 'selection-report'),
    ...candidatesFromArray(report.reserve_candidates, 'reserve', 'selection-report'),
    ...candidatesFromArray(report.excluded_candidates || report.excluded_candidates_top, 'excluded', 'selection-report')
  ];
}

function loadEditorialDecisionSource(root, date, status = {}) {
  if (!date) {
    return {
      source: 'status',
      level: 'status',
      candidates: [],
      counts: {
        deterministic: status.deterministic_selected_count ?? status.selected_article_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count
      },
      unavailableReason: 'newsletter date가 없어 후보 artifact를 찾을 수 없습니다.'
    };
  }

  const evidencePath = path.join(root, 'articles', 'content', 'newsroom', date, 'evidence-pack-summary.json');
  const evidence = readJsonObjectIfExists(evidencePath);
  if (evidence) {
    const selected = candidatesFromArray(evidence.selected_main_articles, 'final_selected', 'evidence-pack-summary');
    const reserve = candidatesFromArray(evidence.reserve_candidates, 'reserve', 'evidence-pack-summary');
    const excluded = candidatesFromArray(evidence.excluded_candidates_top, 'excluded', 'evidence-pack-summary');
    const candidates = [...selected, ...reserve, ...excluded];
    if (candidates.length > 0) {
      return {
        source: 'evidence-pack-summary.json',
        level: 'full',
        candidates,
        counts: {
          deterministic: status.deterministic_selected_count ?? status.selected_article_count,
          rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count,
          evidenceSelected: evidence.selection_summary?.selected_main_article_count,
          candidateFinal: selected.length
        }
      };
    }
  }

  const selectionReport = loadNewsroomReport(root, date, 'selection-report.json');
  const selectionCandidates = selectionReportCandidates(selectionReport);
  if (selectionCandidates.length > 0) {
    return {
      source: 'selection-report.json',
      level: 'partial',
      candidates: selectionCandidates,
      counts: {
        deterministic: status.deterministic_selected_count ?? selectionReport?.counts?.deterministic_selected_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? selectionReport?.counts?.selected_article_count,
        selectionReport: selectionReport?.counts?.selected_article_count ?? selectionReport?.gate_summary?.selected_article_count,
        candidateFinal: selectionCandidates.filter(candidate => ['final_selected', 'primary_selected'].includes(candidate.status)).length
      }
    };
  }

  const reporter = loadNewsroomJson(root, date, 'reporter-candidates.json');
  const reporterItems = Array.isArray(reporter)
    ? reporter
    : reporter?.candidates || reporter?.selected_candidates || reporter?.selectedCandidates;
  const reporterCandidates = candidatesFromArray(reporterItems, 'report_only', 'reporter-candidates');
  if (reporterCandidates.length > 0) {
    return {
      source: 'reporter-candidates.json',
      level: 'partial',
      candidates: reporterCandidates,
      counts: {
        deterministic: status.deterministic_selected_count ?? status.selected_article_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count
      }
    };
  }

  const shortlist = loadNewsroomReport(root, date, 'shortlisted-candidates.json');
  const shortlistCandidates = [
    ...candidatesFromArray(shortlist?.primary_selected_articles, 'primary_selected', 'shortlisted-candidates'),
    ...candidatesFromArray(shortlist?.selected_articles, 'final_selected', 'shortlisted-candidates'),
    ...candidatesFromArray(shortlist?.reserve_candidates, 'reserve', 'shortlisted-candidates'),
    ...candidatesFromArray(shortlist?.excluded_candidates, 'excluded', 'shortlisted-candidates')
  ];
  if (shortlistCandidates.length > 0) {
    return {
      source: 'shortlisted-candidates.json',
      level: 'partial',
      candidates: shortlistCandidates,
      counts: {
        deterministic: status.deterministic_selected_count ?? shortlist?.deterministic_selected_count ?? shortlist?.selected_article_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? shortlist?.selected_article_count,
        candidateFinal: shortlistCandidates.filter(candidate => ['final_selected', 'primary_selected'].includes(candidate.status)).length
      }
    };
  }

  const collected = loadCollectedReport(root, date, 'candidates.json');
  const collectedCandidates = candidatesFromArray(collected?.candidates, 'report_only', 'collected-candidates');
  if (collectedCandidates.length > 0) {
    return {
      source: 'articles/content/collected-news candidates.json',
      level: 'collected',
      candidates: collectedCandidates,
      counts: {
        deterministic: status.deterministic_selected_count ?? status.selected_article_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count
      },
      unavailableReason: '수집 후보만 있어 editorial decision을 제한적으로 표시합니다.'
    };
  }

  return {
    source: 'status',
    level: 'status',
    candidates: [],
    counts: {
      deterministic: status.deterministic_selected_count ?? status.selected_article_count,
      rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count
    },
    unavailableReason: '후보 artifact가 없어 status 값만 확인할 수 있습니다.'
  };
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function editorialCountWarnings(source) {
  const pairs = Object.entries(source.counts || {})
    .map(([label, value]) => [label, numberOrNull(value)])
    .filter(([, value]) => value !== null);
  const unique = [...new Set(pairs.map(([, value]) => value))];
  if (unique.length <= 1) return [];
  return [
    `주의: 선택 count가 section 간 다릅니다 (${pairs.map(([label, value]) => `${label}=${value}`).join('; ')}). 이 PR에서는 warning만 표시하고 hard fail로 처리하지 않습니다.`
  ];
}

function editorialPublishRecommendation(status = {}, handoff = null) {
  if (handoff?.diagnosticsOnly) return '공개 발행 불가 / Diagnostics-only';
  if (status.final_publish_ready === true) return '자동 발행 가능 / Publish-ready';
  return '자동 발행 금지 / Review-only';
}

function renderEditorialLegend() {
  return [
    `## ${EDITORIAL_DECISION_HEADINGS.legend}`,
    '',
    '- 메인(Main): Camera HAL / driver / image pipeline 직접성이 충분한 기사',
    '- 보조(Supporting): HAL 개발 workflow에는 유용하지만 Camera 직접성은 약한 기사',
    '- 짧은 소식(Short): 짧게 언급할 수 있으나 main으로는 약한 기사',
    '- 관찰(Watch): 참고만 하고 본문 승격은 보류할 기사',
    '- 보류(Hold): source/parser/evidence 보완 후 재검토할 기사',
    '- 제외(Exclude): 뉴스레터 본문에 넣지 않을 기사',
    ''
  ].join('\n');
}

function renderEditorialDecisionSummary(root, date, status = {}, handoff = null) {
  const source = loadEditorialDecisionSource(root, date, status);
  const diagnosticsOnly = handoff?.diagnosticsOnly === true;
  const insufficientEvidence = source.candidates.length === 0 || (diagnosticsOnly && ['status', 'collected'].includes(source.level));
  const rows = insufficientEvidence ? [] : editorialRowsFromCandidates(source.candidates, 8);
  const displayedCandidateCount = rows.length;
  const totalCandidateCount = source.candidates.length;
  const omittedCandidateCount = Math.max(0, totalCandidateCount - displayedCandidateCount);
  const table = renderMarkdownTable(
    EDITORIAL_DECISION_TABLE_COLUMNS,
    rows.map((row, index) => [
      ['final_selected', 'primary_selected'].includes(row.candidate.status) ? String(index + 1) : '-',
      formatCandidateLink(row.candidate),
      row.classification.label,
      row.classification.pipelineLabel,
      row.candidate.bucket || 'unknown bucket',
      row.reasonKo,
      row.guardrailKo
    ])
  );
  const mainRows = rows.filter(row => row.classification.decision === 'Main');
  const supportingRows = rows.filter(row => row.classification.decision === 'Supporting' || row.classification.decision === 'Short');
  const holdRows = rows.filter(row => row.classification.decision === 'Hold');
  const concerns = [];
  if (insufficientEvidence) concerns.push(source.unavailableReason || '후보 evidence가 부족합니다.');
  if (mainRows.length <= 1 && supportingRows.length >= 2) {
    concerns.push('fallback/supporting 기사가 이번 호를 과도하게 채울 수 있습니다.');
  }
  if (holdRows.length > 0) concerns.push('parser/source extraction 보완 후 재검토할 후보가 있습니다.');
  concerns.push(...editorialCountWarnings(source));

  return [
    `## ${EDITORIAL_DECISION_HEADINGS.summary}`,
    '',
    insufficientEvidence
      ? '편집자 기사 판단 요약을 생성할 충분한 evidence가 없습니다.'
      : `이 section은 기계의 selected 상태가 아니라 편집자가 후보를 어떻게 다뤄야 하는지 먼저 보여줍니다. source: ${source.source}`,
    '',
    table,
    '',
    `## ${EDITORIAL_DECISION_HEADINGS.verdict}`,
    '',
    `- 발행 권고: ${editorialPublishRecommendation(status, handoff)}`,
    `- 가장 좋은 메인 기사: ${mainRows[0]?.candidate.title || '없음'}`,
    `- 메인(Main) 판단 기사 수: ${mainRows.length}`,
    `- 보조/짧은 소식 판단 기사 수: ${supportingRows.length}`,
    `- 보류(Hold) 후보 수: ${holdRows.length}`,
    `- 표시된 후보: ${displayedCandidateCount}개 / 전체 후보: ${totalCandidateCount}개`,
    `- 생략된 후보: ${omittedCandidateCount > 0 ? `${omittedCandidateCount}개, 전체 후보는 \`후보 기사 추적\` 또는 관련 JSON artifact에서 확인하세요.` : '없음'}`,
    `- 핵심 우려: ${concerns.length > 0 ? concerns.join('; ') : 'none'}`,
    '',
    renderEditorialLegend()
  ].join('\n');
}

function renderEditorActionGuidance(status, date) {
  const lines = [
    '## 편집자 조치 가이드',
    '',
    `- 권장 조치: ${recommendedEditorAction(status)}`,
    '- 이 PR은 editor review용으로 생성되며 자동 merge되지 않습니다.',
    '- fact-check must_fix 항목과 editorial quality deduction을 분리해서 처리하세요.',
    '- 사실 확인이 안 되면 source-gap article을 승격하지 말고 briefing/watchlist로 내리거나 제외하세요.',
    '- 유효한 locked article은 유지하고 URL, title, source-date-title 조합 중복을 피하세요.'
  ];

  if (status.status !== 'PASS' || status.validate_outcome === 'failure' || status.final_publish_ready !== true) {
    lines.push(
      `- 발행 전에 content/newsroom/${date}/fact-check-report.md, content/newsroom/${date}/quality-report.md, validation output을 확인하세요.`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function publicOutputExpectedFromStatus(status = {}) {
  if (status.public_output_expected === true || status.public_output_expected === 'true') return true;
  if (status.public_output_expected === false || status.public_output_expected === 'false') return false;
  return status.public_artifact_ready === true ||
    status.public_newsletter_ready === true ||
    status.review_publication_ready === true ||
    status.final_publish_ready === true ||
    status.automatic_publish_ready === true ||
    status.normal_public_ready === true ||
    status.public_state === 'REVIEW_ONLY_PUBLIC_CREATED' ||
    status.public_state === 'PUBLIC_READY';
}

function renderHeavyRetentionNote(date) {
  const runId = process.env.GITHUB_RUN_ID || '';
  const artifactName = runId ? `newsroom-final-debug-${runId}` : 'newsroom-final-debug-<run_id>';
  return [
    '## Heavy Evidence Retention',
    '',
    `debug_heavy/transient_attempt artifact는 PR diff에 의도적으로 포함되지 않습니다.`,
    `- Actions artifact: \`${artifactName}\` 다운로드`,
    `- 또는 \`articles/content/newsroom/${date}/artifact-manifest.json\` → \`retained_heavy_artifacts\` 참조`,
    ''
  ].join('\n');
}

function renderGeneratedArtifacts(date, status = {}, root = process.cwd(), changedArtifacts = null) {
  const changed = Array.isArray(changedArtifacts)
    ? changedArtifacts
    : getChangedRepoVisibleArtifacts({ root, date });
  const inventory = buildReviewArtifactInventory({
    root,
    date,
    changedArtifacts: changed,
    runContext: {
      status: status.status || 'unknown',
      seedUsed: status.seed_used ?? status.candidate_input?.seed_used,
      publicOutputExpected: publicOutputExpectedFromStatus(status)
    }
  });
  return renderGeneratedArtifactsSummary(inventory) + '\n\n' + renderHeavyRetentionNote(date);
}

function readSelectionReport(root, date) {
  if (!date) return null;
  return loadNewsroomJson(root, date, 'selection-report.json');
}

function renderHomepageHeadlineDecision(root, date, status = {}) {
  const selectionReport = readSelectionReport(root, date) || {};
  const decision = status.headline_decision || selectionReport.headline_decision || {};
  const inclusion = status.headline_latest_inclusion || selectionReport.headline_latest_inclusion || {};
  const publicRenderReconciliation = status.headline_public_render_reconciliation ||
    selectionReport.headline_public_render_reconciliation ||
    {};
  const removedDueToHeadlineInclusion = Array.isArray(status.removed_due_to_headline_inclusion)
    ? status.removed_due_to_headline_inclusion
    : Array.isArray(selectionReport.removed_due_to_headline_inclusion)
      ? selectionReport.removed_due_to_headline_inclusion
      : [];
  const coverage = status.article_exposure_coverage || selectionReport.article_exposure_coverage || {};
  return [
    '## Homepage Headline Decision',
    '',
    `- decision: ${valueOrUnknown(decision.reason || decision.decision)}`,
    `- current_headline_key: ${valueOrUnknown(decision.current_headline_key)}`,
    `- replacement_headline_key: ${valueOrUnknown(decision.replacement_headline_key)}`,
    `- public_render_reconciled: ${booleanText(decision.public_render_reconciled === true || publicRenderReconciliation.applied === true)}`,
    `- public_rendered_headline_key: ${valueOrUnknown(decision.public_rendered_headline_key || publicRenderReconciliation.rendered_headline_key)}`,
    `- public_render_reconciliation_reason: ${valueOrUnknown(decision.public_render_reconciliation_reason || publicRenderReconciliation.reason)}`,
    `- previous_stored_current_score: ${valueOrUnknown(decision.previous_stored_current_score)}`,
    `- runtime_decayed_score: ${valueOrUnknown(decision.runtime_decayed_score)}`,
    `- last_scored_at: ${valueOrUnknown(decision.last_scored_at)}`,
    `- scored_at: ${valueOrUnknown(decision.scored_at)}`,
    `- latest_inclusion_mode: ${valueOrUnknown(inclusion.mode)}`,
    `- injected_from_snapshot: ${booleanText(inclusion.injected_from_snapshot === true)}`,
    `- snapshot_revalidated: ${booleanText(inclusion.snapshot_revalidated === true || decision.snapshot_revalidated === true)}`,
    `- removed_due_to_headline_inclusion_count: ${removedDueToHeadlineInclusion.length}`,
    `- exposure_history_coverage: mode=${valueOrUnknown(coverage.mode)}; coverage_starts_at=${valueOrUnknown(coverage.coverage_starts_at)}; backfill_included=${booleanText(coverage.backfill_included === true)}`,
    '- Artifacts:',
    `  - \`articles/data/homepage-headline.json\``,
    `  - \`state/article-exposure-history.json\``,
    ''
  ].join('\n');
}

function renderHomepageHeadlineDesignReview(status = {}, date = '') {
  const review = status.homepage_headline_design_review && typeof status.homepage_headline_design_review === 'object'
    ? status.homepage_headline_design_review
    : {};
  const figmaUrl = review.figma_url || review.url || process.env.HOMEPAGE_HEADLINE_FIGMA_URL;
  const artifactPath = review.artifact_path || review.screenshot_artifact_path;
  const desktopCoverage = review.desktop_coverage || process.env.HOMEPAGE_HEADLINE_DESKTOP_COVERAGE;
  const mobileCoverage = review.mobile_coverage || process.env.HOMEPAGE_HEADLINE_MOBILE_COVERAGE;
  const implementationDeviation = review.implementation_deviation || process.env.HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION;
  if (!figmaUrl && !artifactPath && !desktopCoverage && !mobileCoverage && !implementationDeviation) {
    return '';
  }
  return [
    '## Homepage Headline Design Review',
    '',
    `- Figma URL: ${valueOrUnknown(figmaUrl)}`,
    `- Artifact path: ${valueOrUnknown(artifactPath)}`,
    `- Desktop coverage: ${valueOrUnknown(desktopCoverage)}`,
    `- Mobile coverage: ${valueOrUnknown(mobileCoverage)}`,
    `- Implementation deviation: ${valueOrUnknown(implementationDeviation)}`,
    ''
  ].join('\n');
}

function renderPublicNewsletterNotice(status = {}, handoff = null) {
  if (status.final_publish_ready === true) return '';
  if (handoff?.diagnosticsOnly) {
    return [
      '## Public Newsletter 안내',
      '',
      'AI 자동 발행 기준은 통과하지 못했고 public newsletter files가 준비되지 않았습니다. 이 PR은 diagnostics-only이며 merge해도 Newsletter 홈페이지에 표시되지 않습니다. publish-ready label은 붙이지 않습니다.'
    ].join('\n');
  }
  if (handoff?.reviewPublicationReady) {
    if (handoff.publicationMode === 'fallback_public') {
      return [
        '## Public Newsletter 안내',
        '',
        '이 PR은 Issue #247을 hard block policy에서 downgrade policy로 의도적으로 바꿉니다.',
        'fallback-only composition은 metadata, PR body, quality report, public UI 전체에서 Tooling Watch Edition으로 명확히 표시된 경우에만 homepage-visible public issue를 만들 수 있습니다.',
        '',
        '수정된 acceptance criteria:',
        '- tooling fallback만으로는 normal homepage-visible Camera HAL newsletter를 만들 수 없습니다.',
        '- fallback-only composition은 fallback disclosure metadata와 UI notice가 모두 있을 때만 homepage-visible Tooling Watch Edition을 만들 수 있습니다.'
      ].join('\n');
    }
    return [
      '## Public Newsletter 안내',
      '',
      'AI 자동 발행 기준은 통과하지 못했지만, public newsletter files는 생성되었습니다. 편집장이 이 PR을 승인하여 merge하면 Newsletter 사이트에 게시됩니다. publish-ready label은 붙이지 않습니다.'
    ].join('\n');
  }
  return [
    '## Public Newsletter 안내',
    '',
    'AI 자동 발행 기준은 통과하지 못했지만, public newsletter files는 생성되었습니다. 편집장이 이 PR을 승인하여 merge하면 Newsletter 사이트에 게시됩니다.'
  ].join('\n');
}

function renderArticleStructureContract(root, date) {
  if (!date) return '';
  const editor = toLegacyEditorIssue(loadNewsroomJson(root, date, 'editor-draft.json'), { date });
  if (!editor || !Array.isArray(editor.sections)) return '';
  const qualityReport = loadNewsroomJson(root, date, 'quality-report.json');
  return [
    '## Article Structure Contract',
    '',
    articleSectionContractMarkdown(editor, qualityReport)
  ].join('\n');
}

function renderRawInputProvenance(status = {}, date = '') {
  const input = status.candidate_input;
  if (!input || typeof input !== 'object') return '';

  return [
    '## RAW Input Provenance',
    '',
    `- input_mode: ${valueOrUnknown(input.mode)}`,
    `- RAW branch: ${date ? `newsroom-raw/${date}` : 'unknown'}`,
    `- candidate_artifact: ${valueOrUnknown(input.candidate_artifact)}`,
    `- candidate_artifact_hash: ${valueOrUnknown(input.candidate_artifact_hash)}`,
    `- manifest: ${valueOrUnknown(input.manifest)}`,
    `- manifest_status: ${valueOrUnknown(input.manifest_status)}`,
    `- manifest_type: ${valueOrUnknown(input.manifest_type)}`,
    `- llm_used: ${booleanText(input.llm_used)}`,
    `- merge_mode: ${valueOrUnknown(input.merge_mode || 'none')}`,
    `- candidate_count: ${valueOrUnknown(input.candidate_count)}`,
    ''
  ].join('\n');
}

function renderPriorityOverridePolicy() {
  return [
    '## Priority Override / Legacy Compatibility',
    '',
    'This PR is part of #185 seed evidence workflow migration.',
    'The seed evidence workflow is prioritized over legacy-pattern cleanup, but source/evidence/security/publish safety remains non-negotiable.',
    '',
    '### Required checks for this PR',
    '- [ ] Targeted #185 unit tests pass',
    '- [ ] Targeted workflow tests pass',
    '- [ ] `npm.cmd run validate` passes',
    '- [ ] Source/evidence/security gates are not weakened',
    '',
    '### Legacy-pattern failures',
    '| Test | Failure reason | Classification | Follow-up |',
    '| --- | --- | --- | --- |',
    '| none | none | none | none |',
    '',
    '### Non-negotiable gates',
    '- [ ] No private/internal URL fetch',
    '- [ ] No source_gap_risk bypass',
    '- [ ] No quality threshold lowering',
    '- [ ] No 03 re-crawl',
    '- [ ] No Gemini proposal promoted without deterministic validation',
    ''
  ].join('\n');
}

function buildNewsroomPrBody(options = {}) {
  const resolved = options.publishStatus || resolvePublishStatus(options);
  const root = resolved.root || options.root || process.cwd();
  const date = resolved.date || options.date || '';
  const status = resolved.status;
  const handoffOptions = { root, date, status };
  if (Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')) {
    handoffOptions.changedArtifacts = options.changedArtifacts;
  }
  const handoff = resolveReviewHandoff(handoffOptions);
  const lines = [];
  const pushSection = section => {
    if (section) lines.push(section, '');
  };

  const reviewOnlyStatus = renderReviewOnlyStatus(status, handoff, root, date);
  const publicationDecisionSummary = renderPublicationDecisionSummary(status, handoff);
  const editorialDecisionSummary = renderEditorialDecisionSummary(root, date, status, handoff);

  pushSection(renderFinalNewsletterEditorSummary(status, handoff, date));

  if (handoff?.diagnosticsOnly) {
    pushSection(reviewOnlyStatus);
    pushSection(editorialDecisionSummary);
  } else if (status.final_publish_ready === true) {
    pushSection(editorialDecisionSummary);
    pushSection(publicationDecisionSummary);
  } else {
    pushSection(publicationDecisionSummary);
    pushSection(editorialDecisionSummary);
  }
  pushSection(renderStatusSection(status, handoff));

  lines.push(
    renderPublicNewsletterReadiness(root, date, handoff),
    renderCatchUpSummary(root, date),
    renderCandidatePoolPreflight(root, date, status),
    renderFailureDiagnostics(root, date, status, handoff),
    renderPublicNewsletterNotice(status, handoff),
    renderHomepageHeadlineDesignReview(status, date),
    renderCandidateTraceability(root, date),
    renderGeneratedArtifacts(date, status, root, options.changedArtifacts)
  );

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function main() {
  process.stdout.write(buildNewsroomPrBody());
}

if (require.main === module) {
  main();
}

module.exports = {
  buildNewsroomPrBody,
  extractEditorBriefSections,
  renderCandidateTraceability,
  renderGeneratedArtifacts,
  renderRawInputProvenance,
  renderEditorApprovedPublicationPolicy,
  recommendedEditorAction
};
