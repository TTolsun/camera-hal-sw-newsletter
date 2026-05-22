const fs = require('fs');
const path = require('path');

const {
  ensureArray,
  resolvePublishStatus
} = require('../common/publish-status');
const {
  articlePolicy,
  articleCountRangeText,
  publishGateCriteriaText
} = require('../common/newsletter-policy');
const {
  renderEditorPublicationPolicyMarkdown
} = require('../common/editor-publication-policy');
const {
  EDITORIAL_DECISION_HEADINGS,
  EDITORIAL_DECISION_TABLE_COLUMNS,
  buildDecisionGuardrailKo,
  buildDecisionReasonKo,
  classifyEditorialDecision
} = require('../common/editorial-decision-summary');
const {
  articleSectionContractMarkdown
} = require('../render/newsletter-renderer');
const {
  DIAGNOSIS_KEYS
} = require('../metrics/source-quality-diagnosis');
const {
  DIAGNOSIS_LABELS_KO,
  RECOMMENDED_ACTION_LABELS_KO
} = require('../render/source-quality-diagnosis-labels.ko');
const {
  getChangedRepoVisibleArtifacts,
  requiredPublicFiles,
  resolveReviewableArtifacts
} = require('./resolve-reviewable-artifacts');

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

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
}

function valueOrUnknown(value) {
  if (value === null || value === undefined || value === '') return 'unknown';
  return String(value);
}

function valueOrUnknownKo(value) {
  if (value === null || value === undefined || value === '') return '알 수 없음';
  return String(value);
}

function booleanText(value) {
  return value === true ? 'true' : 'false';
}

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

function formatReasonSummary(items) {
  return ensureArray(items)
    .slice(0, 5)
    .map(item => `${item.reason || 'unknown'} (${item.count ?? 'n/a'})`)
    .join('; ') || 'none';
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

function readJsonObjectIfExists(filePath) {
  const value = readJsonIfExists(filePath);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
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
  const relPath = `content/newsroom/${date}/hal-signal-quality-report.json`;
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
  const relPath = `content/newsroom/${date}/source-effectiveness-report.json`;
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
  const jsonRelPath = `content/newsroom/${date}/source-quality-diagnosis.json`;
  const markdownRelPath = `content/newsroom/${date}/source-quality-diagnosis.md`;
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
  const aggregateRelPath = 'content/newsroom/image-audit-aggregate-report.json';
  const dateJsonRelPath = `content/newsroom/${date}/image-audit-report.json`;
  const dateMarkdownRelPath = `content/newsroom/${date}/image-audit-report.md`;
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
      '- `content/newsroom/image-audit-aggregate-report.md`'
    ] : []),
    `- \`${dateJsonRelPath}\``,
    `- \`${dateMarkdownRelPath}\``,
    ''
  ].join('\n');
}

function renderEvidencePackSummary(root, date) {
  if (!date) return '';
  const relPath = `content/newsroom/${date}/evidence-pack-summary.json`;
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
    renderEvidencePackDiagnosticSummary('Fallback builder failure', diagnostics.fallback_builder_failures),
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
  const relPath = `content/source-events/${date}/source-change-events.json`;
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
  const seedPackRelPath = `content/collected-news/${date}/seed-evidence-pack.json`;
  const mergedRelPath = `content/collected-news/${date}/merged-candidates.json`;
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
    ? readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'generation-status.json')) || {}
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

function renderPublicationDecisionSummary(status, handoff) {
  if (!handoff) return '';
  const autoPublish = status.final_publish_ready === true ? '통과' : '실패';
  const reviewPublication = handoff.reviewPublicationReady ? '가능' : '불가능';
  const publicFiles = handoff.publicNewsletterReady ? '있음' : '없음';
  const homepage = handoff.homepageVisibleAfterMerge ? '표시됨' : '표시되지 않음';
  const publishReadyLabel = status.final_publish_ready === true ? '붙임' : '붙이지 않음';
  return [
    '## 발행 상태 요약',
    '',
    '| 항목 | 판단 |',
    '| --- | --- |',
    `| 자동 발행 기준 | ${autoPublish} |`,
    `| 편집자 승인 발행 가능 여부 | ${reviewPublication} |`,
    `| Public newsletter files | ${publicFiles} |`,
    `| Merge 후 홈페이지 표시 여부 | ${homepage} |`,
    `| publish-ready label | ${publishReadyLabel} |`,
    '',
    `- review_publication_ready: ${booleanText(handoff.reviewPublicationReady)}`,
    `- diagnostics_only: ${booleanText(handoff.diagnosticsOnly)}`,
    `- homepage_visible_after_merge: ${booleanText(handoff.homepageVisibleAfterMerge)}`,
    `- publication_mode: ${valueOrUnknown(handoff.publicationMode)}`,
    `- homepage_visibility: ${valueOrUnknown(handoff.homepageVisibility)}`,
    `- fallback_only: ${booleanText(handoff.fallbackOnly)}`,
    `- camera_anchor_count: ${valueOrUnknown(handoff.cameraAnchorCount)}`,
    `- fallback_public_ready: ${booleanText(handoff.fallbackPublicReady)}`,
    ''
  ].join('\n');
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

function summarizeFallbackReasonRows(items) {
  return ensureArray(items)
    .slice(0, 5)
    .map(item => `${valueOrUnknown(item.reason)} (${valueOrUnknown(item.count ?? 'n/a')})`)
    .join('; ') || 'none';
}

function fallbackDiagnosticsFor(root, date) {
  if (!date) return null;
  const diagnostics = readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue-diagnostics.json'));
  if (diagnostics) return { source: 'fallback-public-issue-diagnostics.json', value: diagnostics };
  const fallback = readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'));
  if (fallback) return { source: 'fallback-public-issue.json', value: fallback };
  const generationStatus = readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'generation-status.json'));
  if (generationStatus) return { source: 'generation-status.json', value: generationStatus };
  return null;
}

function renderFailureDiagnostics(root, date, status, handoff) {
  if (!handoff?.diagnosticsOnly) return '';
  const generationStatus = date
    ? readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'generation-status.json')) || {}
    : {};
  const repairFailure = date
    ? readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'))
    : null;
  const fallback = fallbackDiagnosticsFor(root, date);
  const fallbackValue = fallback?.value || {};
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
    '### Fallback Builder Failure',
    '',
    fallback
      ? `- diagnostics_source: ${fallback.source}`
      : '- fallback diagnostics unavailable',
    fallback
      ? `- fallback_public_issue_failed: ${booleanText(fallbackValue.fallback_public_issue_failed === true || fallbackValue.status === 'FAILED')}`
      : '',
    fallback
      ? `- failure_reason: ${valueOrUnknown(fallbackValue.failure_reason || fallbackValue.fallback_public_issue_reason)}`
      : '',
    fallback
      ? `- preserve_article_count: ${valueOrUnknown(fallbackValue.preserve_article_count)}`
      : '',
    fallback
      ? `- final_article_count: ${valueOrUnknown(fallbackValue.final_article_count)}`
      : '',
    fallback
      ? `- minimum_required_count: ${valueOrUnknown(fallbackValue.minimum_required_count ?? articlePolicy.mainArticleCount.min)}`
      : '',
    fallback
      ? `- demoted_articles: ${ensureArray(fallbackValue.demoted_articles).map(item => valueOrUnknown(item.headline || item.title)).join('; ') || 'none'}`
      : '',
    fallback
      ? `- top_rejected_reasons: ${summarizeFallbackReasonRows(fallbackValue.top_rejected_reasons)}`
      : '',
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
    ? readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'generation-status.json')) || {}
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
  const report = readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'source-effectiveness-report.json'));
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

function renderCandidatePoolPreflight(root, date, status = {}) {
  if (!candidateShortageStatus(status, root, date)) return '';
  const selectionReport = date
    ? readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'selection-report.json')) || {}
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

const TRACE_ARTIFACT_DEFS = [
  { key: 'reporter', path: date => `content/newsroom/${date}/reporter-candidates.json` },
  { key: 'shortlist', path: date => `content/newsroom/${date}/shortlisted-candidates.json` },
  { key: 'collected', path: date => `content/collected-news/${date}/candidates.json` },
  { key: 'quality', path: date => `content/newsroom/${date}/quality-report.json` },
  { key: 'factCheck', path: date => `content/newsroom/${date}/fact-check-report.json` },
  { key: 'fallback', path: date => `content/newsroom/${date}/fallback-public-issue.json` }
];

const TRACE_STATUS_RANK = {
  final_selected: 1,
  primary_selected: 2,
  reserve: 3,
  merged: 4,
  demoted: 5,
  rejected: 6,
  excluded: 7,
  not_main_eligible: 8,
  briefing_only: 9,
  reference_only: 10,
  quality_fail: 11,
  factcheck_fail: 12,
  unknown: 99
};

const FALLBACK_OVERRIDE_STATUSES = new Set(['demoted', 'rejected', 'merged']);
const REPORT_ONLY_STATUSES = new Set(['quality_fail', 'factcheck_fail']);

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrlKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    parsed.hash = parsed.hash || '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString().toLowerCase();
  } catch (_) {
    return text.replace(/\/+$/, '').toLowerCase();
  }
}

function normalizeEventBundleTraceUrlKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    const preserveHash = parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera' &&
      /^#(?:camera-[a-z0-9-]+-)?\d+\.\d+\.\d+(?:[-\w.]*)?$/i.test(parsed.hash);
    if (!preserveHash) parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch (_) {
    return text.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function truncateText(value, maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sanitizeMarkdownTableCell(value, { fallback = 'unknown', maxLength = 180 } = {}) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return truncateText(text || fallback, maxLength).replace(/\|/g, '\\|');
}

function sanitizeMarkdownLinkUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '%20')
    .replace(/\|/g, '%7C')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

function markdownTableCell(value) {
  if (value && typeof value === 'object' && value.__markdownTableCell === true) {
    return String(value.value || '').replace(/[\r\n]+/g, ' ').trim() || 'unknown';
  }
  return sanitizeMarkdownTableCell(value);
}

function trustedMarkdownTableCell(value) {
  return { __markdownTableCell: true, value };
}

function renderMarkdownTable(headers, rows) {
  const safeHeaders = headers.map(header => sanitizeMarkdownTableCell(header));
  const separator = headers.map((_, index) => (index === 0 ? '---:' : '---'));
  const body = rows.map(row => `| ${row.map(cell => markdownTableCell(cell)).join(' | ')} |`);
  return [
    `| ${safeHeaders.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body
  ].join('\n');
}

function firstText(values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function valuesAsArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function extractCandidateTitle(candidate) {
  return firstText([candidate?.title, candidate?.headline, candidate?.article_title, candidate?.name]);
}

function sourceFromValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return firstText([value.name, value.title, value.source_name, value.source]);
}

function extractCandidateSource(candidate) {
  return firstText([
    candidate?.source_name,
    sourceFromValue(candidate?.source),
    candidate?.publisher,
    candidate?.feed_source,
    sourceFromValue(ensureArray(candidate?.sources)[0])
  ]);
}

function extractCandidateDate(candidate) {
  return firstText([candidate?.published_date, candidate?.publishedAt, candidate?.date, candidate?.source_date]);
}

function extractCandidateBucket(candidate) {
  return firstText([
    candidate?.relevance_bucket,
    candidate?.aosp_camera_stack_bucket,
    candidate?.bucket,
    candidate?.category
  ]);
}

function extractCandidateScore(candidate) {
  const value = candidate?.deterministic_score ??
    candidate?.score_breakdown?.total ??
    candidate?.relevance_score ??
    candidate?.score;
  return value === null || value === undefined || value === '' ? 'n/a' : value;
}

function extractCandidateUrls(candidate) {
  const urls = [
    candidate?.article_url,
    candidate?.articleUrl,
    candidate?.url,
    candidate?.source_url,
    candidate?.sourceUrl,
    candidate?.link
  ];
  for (const source of ensureArray(candidate?.sources)) {
    urls.push(source?.url, source?.source_url, source?.sourceUrl);
  }
  for (const url of valuesAsArray(candidate?.source_urls)) {
    urls.push(url);
  }
  return [...new Set(urls.map(url => String(url || '').trim()).filter(Boolean))];
}

function extractCandidateUrl(candidate) {
  return extractCandidateUrls(candidate)[0] || '';
}

function extractReasonList(candidate) {
  const reasons = [];
  const push = value => {
    for (const item of valuesAsArray(value)) {
      const text = typeof item === 'string' ? item : (item?.reason || item?.problem || item?.message || JSON.stringify(item));
      if (text) reasons.push(text);
    }
  };
  push(candidate?.selection_exclusion_reason);
  push(candidate?.final_exclusion_reasons);
  push(candidate?.exclusion_reasons);
  push(candidate?.watchlist_reason);
  push(candidate?.reason);
  push(candidate?.collection_reason);
  if (candidate?.source_gap_risk === true) reasons.push('source_gap_risk=true');
  push(candidate?.evidence_origin);
  push(candidate?.finalSelectionEligibility);
  return reasons.length > 0 ? [...new Set(reasons)] : ['no explicit reason'];
}

function classifyCandidateStatus(candidate, hint = '') {
  if (candidate?.final_selected === true || hint === 'final_selected') return 'final_selected';
  if (candidate?.primary_selected === true || candidate?.selected_for_editor === true || hint === 'primary_selected') {
    return 'primary_selected';
  }
  if (candidate?.reserve_candidate === true || hint === 'reserve') return 'reserve';
  if (hint === 'merged') return 'merged';
  if (hint === 'demoted') return 'demoted';
  if (hint === 'rejected') return 'rejected';
  if (ensureArray(candidate?.final_exclusion_reasons).length > 0 || ensureArray(candidate?.exclusion_reasons).length > 0 || hint === 'excluded') {
    return 'excluded';
  }
  if (candidate?.main_eligible === false) return 'not_main_eligible';
  if (candidate?.briefing_only === true) return 'briefing_only';
  if (candidate?.reference_only === true) return 'reference_only';
  if (hint === 'quality_fail') return 'quality_fail';
  if (hint === 'factcheck_fail') return 'factcheck_fail';
  return 'unknown';
}

function reasonCodeFor(candidate, status, reportStatus = '') {
  const haystack = [
    status,
    reportStatus,
    ...extractReasonList(candidate)
  ].join(' ').toLowerCase();
  if (status === 'merged' || /merged/.test(haystack)) return 'merged_into_selected_article';
  if (/fact.?check.*source.?gap|source_gap/.test(haystack) && /fact/.test(reportStatus)) return 'factcheck_source_gap';
  if (/fact.?check|must_fix/.test(haystack)) return 'factcheck_must_fix';
  if (/quality|hard_fail/.test(haystack)) return 'quality_hard_fail';
  if (/source.?gap/.test(haystack)) return 'source_gap';
  if (/weak.*hal|hal.*weak|scope.?relevance|hal.*connection|camera.*evidence.*weak/.test(haystack)) return 'weak_hal_connection';
  if (/generic.*ai|generic.*tech|buzzword/.test(haystack)) return 'generic_ai_noise';
  if (/duplicate.*source|duplicate.*url|duplicate_base_url/.test(haystack)) return 'duplicate_source';
  if (/same.*source.*cluster|same.*release/.test(haystack)) return 'same_source_cluster';
  if (/missing.*date|missing.*dated|no date|stale/.test(haystack)) return 'missing_dated_evidence';
  if (candidate?.main_eligible === false || /main_eligible=false|not_main_eligible/.test(haystack)) return 'not_main_eligible';
  if (candidate?.briefing_only === true || /briefing_only=true/.test(haystack)) return 'briefing_only';
  if (candidate?.reference_only === true || /reference_only=true/.test(haystack)) return 'reference_only';
  if (/fallback/.test(haystack)) return 'fallback_only';
  return 'unknown_reason';
}

function formatCandidateLink(candidate) {
  const title = sanitizeMarkdownTableCell(candidate.title || 'unknown title', { maxLength: 120 });
  const url = sanitizeMarkdownLinkUrl(candidate.url);
  return url ? trustedMarkdownTableCell(`[${title}](<${url}>)`) : title;
}

function candidateKeys(candidate) {
  const keys = [];
  for (const url of candidate.urls || []) {
    const key = normalizeUrlKey(url);
    if (key) keys.push(`url:${key}`);
  }
  if (candidate.title && candidate.source) {
    keys.push(`title-source:${normalizeMatchText(candidate.title)}|${normalizeMatchText(candidate.source)}`);
  }
  if (candidate.title && candidate.date) {
    keys.push(`title-date:${normalizeMatchText(candidate.title)}|${normalizeMatchText(candidate.date)}`);
  }
  return [...new Set(keys)];
}

function normalizeTraceCandidate(raw, { statusHint = '', sourceHint = '' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const title = extractCandidateTitle(raw);
  const urls = extractCandidateUrls(raw);
  const source = extractCandidateSource(raw);
  const date = extractCandidateDate(raw);
  return {
    raw,
    id: '',
    title: title || 'unknown title',
    url: urls[0] || '',
    urls,
    source: source || 'unknown source',
    date: date || 'unknown date',
    bucket: extractCandidateBucket(raw) || 'unknown bucket',
    score: extractCandidateScore(raw),
    status: classifyCandidateStatus(raw, statusHint),
    reasons: extractReasonList(raw),
    reasonCode: reasonCodeFor(raw, classifyCandidateStatus(raw, statusHint)),
    sourceHints: new Set([sourceHint].filter(Boolean)),
    reportLinks: []
  };
}

function hasSourceHint(candidate, hint) {
  if (!candidate || !candidate.sourceHints) return false;
  if (candidate.sourceHints instanceof Set) return candidate.sourceHints.has(hint);
  if (Array.isArray(candidate.sourceHints)) return candidate.sourceHints.includes(hint);
  return false;
}

function traceStatusRank(status) {
  return TRACE_STATUS_RANK[status] || 99;
}

function shouldReplaceTraceStatus(target, incoming) {
  const incomingStatus = incoming.status || 'unknown';
  const targetStatus = target.status || 'unknown';
  const incomingIsFallback = hasSourceHint(incoming, 'fallback-public-issue');

  if (incomingStatus === 'final_selected') return true;
  if (targetStatus === 'final_selected') return false;

  if (incomingIsFallback && FALLBACK_OVERRIDE_STATUSES.has(incomingStatus)) {
    return true;
  }

  if (REPORT_ONLY_STATUSES.has(incomingStatus) && targetStatus !== 'unknown') {
    return false;
  }

  return traceStatusRank(incomingStatus) < traceStatusRank(targetStatus);
}

function mergeTraceCandidate(target, incoming) {
  const replaceStatus = shouldReplaceTraceStatus(target, incoming);
  target.urls = [...new Set([...target.urls, ...incoming.urls])];
  if (!target.url && incoming.url) target.url = incoming.url;
  for (const field of ['title', 'source', 'date', 'bucket', 'score']) {
    if (!target[field] || /^unknown|n\/a$/.test(String(target[field]))) target[field] = incoming[field];
  }
  target.reasons = [...new Set([...target.reasons, ...incoming.reasons])];
  for (const hint of incoming.sourceHints) target.sourceHints.add(hint);
  if (replaceStatus) {
    target.status = incoming.status;
    target.reasonCode = incoming.reasonCode;
  }
  return target;
}

function addTraceCandidate(index, raw, options = {}) {
  const normalized = normalizeTraceCandidate(raw, options);
  if (!normalized) return null;
  const keys = candidateKeys(normalized);
  const existing = keys.map(key => index.keyToCandidate.get(key)).find(Boolean);
  const candidate = existing ? mergeTraceCandidate(existing, normalized) : normalized;
  if (!existing) index.candidates.push(candidate);
  for (const key of candidateKeys(candidate)) index.keyToCandidate.set(key, candidate);
  return candidate;
}

function readTraceJson(root, relPath, issues) {
  const filePath = path.join(root, ...relPath.split('/'));
  if (!fs.existsSync(filePath)) {
    issues.push(`${relPath}: 파일이 없습니다.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    issues.push(`${relPath}: JSON을 읽을 수 없습니다 (${error.message}).`);
    return null;
  }
}

function loadCandidateTraceArtifacts(root, date) {
  const issues = [];
  const artifacts = {};
  for (const def of TRACE_ARTIFACT_DEFS) {
    const relPath = def.path(date);
    artifacts[def.key] = {
      relPath,
      value: readTraceJson(root, relPath, issues)
    };
  }
  return { artifacts, issues };
}

function pushArtifactCandidates(index, value, field, statusHint, sourceHint, issues, relPath) {
  if (!value || typeof value !== 'object') return;
  const list = value[field];
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    issues.push(`${relPath}: ${field} 필드가 배열이 아닙니다.`);
    return;
  }
  for (const item of list) addTraceCandidate(index, item, { statusHint, sourceHint });
}

function buildFallbackCandidate(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    ...item,
    title: item.title || item.headline,
    url: item.url || valuesAsArray(item.source_urls)[0] || ensureArray(item.sources)[0]?.url,
    source_name: item.source_name || item.source || ensureArray(item.sources)[0]?.title,
    relevance_bucket: item.relevance_bucket || item.category,
    selection_exclusion_reason: item.reason
  };
}

function buildTraceIndex(artifacts, issues) {
  const index = { candidates: [], keyToCandidate: new Map() };
  const shortlist = artifacts.shortlist.value;
  const reporter = artifacts.reporter.value;
  const collected = artifacts.collected.value;
  const fallback = artifacts.fallback.value;

  pushArtifactCandidates(index, shortlist, 'primary_selected_articles', 'primary_selected', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'selected_articles', 'final_selected', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'shortlisted_candidates', '', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'reserve_candidates', 'reserve', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'demoted_candidates', 'demoted', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'excluded_candidates', 'excluded', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, reporter, 'candidates', '', 'reporter', issues, artifacts.reporter.relPath);
  pushArtifactCandidates(index, collected, 'candidates', '', 'collected', issues, artifacts.collected.relPath);

  if (fallback && typeof fallback === 'object') {
    for (const item of ensureArray(fallback.merged_articles)) {
      addTraceCandidate(index, buildFallbackCandidate(item), { statusHint: 'merged', sourceHint: 'fallback-public-issue' });
    }
    for (const item of ensureArray(fallback.demoted_articles)) {
      addTraceCandidate(index, buildFallbackCandidate(item), { statusHint: 'demoted', sourceHint: 'fallback-public-issue' });
    }
    for (const item of ensureArray(fallback.rejected_candidates)) {
      addTraceCandidate(index, buildFallbackCandidate(item), { statusHint: 'rejected', sourceHint: 'fallback-public-issue' });
    }
  }

  for (const artifact of [artifacts.shortlist, artifacts.reporter, artifacts.collected]) {
    if (!artifact.value) continue;
    const knownCandidateField = ['primary_selected_articles', 'selected_articles', 'shortlisted_candidates', 'reserve_candidates', 'demoted_candidates', 'excluded_candidates', 'candidates']
      .some(field => Array.isArray(artifact.value[field]));
    if (!knownCandidateField) {
      issues.push(`${artifact.relPath}: 후보 배열 필드를 찾지 못했습니다.`);
    }
  }

  return index;
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

function assignCandidateIds(candidates) {
  const statusOrder = status => TRACE_STATUS_RANK[status] || 99;
  candidates.sort((a, b) =>
    statusOrder(a.status) - statusOrder(b.status) ||
    normalizeMatchText(a.title).localeCompare(normalizeMatchText(b.title))
  );
  candidates.forEach((candidate, index) => {
    candidate.id = `cand_${String(index + 1).padStart(3, '0')}`;
  });
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

  const evidencePath = path.join(root, 'content', 'newsroom', date, 'evidence-pack-summary.json');
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

  const selectionReport = readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'selection-report.json'));
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

  const reporter = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'));
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

  const shortlist = readJsonObjectIfExists(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'));
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

  const collected = readJsonObjectIfExists(path.join(root, 'content', 'collected-news', date, 'candidates.json'));
  const collectedCandidates = candidatesFromArray(collected?.candidates, 'report_only', 'collected-candidates');
  if (collectedCandidates.length > 0) {
    return {
      source: 'content/collected-news candidates.json',
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
    `- 생략된 후보: ${omittedCandidateCount > 0 ? `${omittedCandidateCount}개, 전체 후보는 \`후보 기사 추적\`과 \`Evidence Pack 요약\`을 확인하세요.` : '없음'}`,
    `- 핵심 우려: ${concerns.length > 0 ? concerns.join('; ') : 'none'}`,
    '',
    renderEditorialLegend()
  ].join('\n');
}

function matchCandidateForReport(index, item) {
  const urls = extractCandidateUrls(item);
  for (const url of urls) {
    const candidate = index.keyToCandidate.get(`url:${normalizeUrlKey(url)}`);
    if (candidate) return candidate;
  }
  const title = extractCandidateTitle(item) || item?.location || item?.headline;
  const source = extractCandidateSource(item);
  const date = extractCandidateDate(item);
  if (title && source) {
    const candidate = index.keyToCandidate.get(`title-source:${normalizeMatchText(title)}|${normalizeMatchText(source)}`);
    if (candidate) return candidate;
  }
  if (title && date) {
    const candidate = index.keyToCandidate.get(`title-date:${normalizeMatchText(title)}|${normalizeMatchText(date)}`);
    if (candidate) return candidate;
  }
  const normalizedTitle = normalizeMatchText(title);
  if (normalizedTitle) {
    return index.candidates.find(candidate => normalizeMatchText(candidate.title) === normalizedTitle) || null;
  }
  return null;
}

function promoteReportOnlyStatus(candidate, statusHint) {
  if (!candidate || candidate.status !== 'unknown') return;
  candidate.status = statusHint;
  candidate.reasonCode = reasonCodeFor(candidate.raw, statusHint, statusHint);
}

function reportItemTitle(item) {
  if (typeof item === 'string') {
    const sectionMatch = item.match(/section="([^"]+)"/);
    if (sectionMatch) return sectionMatch[1];
    return item;
  }
  return extractCandidateTitle(item) || item?.location || item?.headline || item?.category || 'unknown item';
}

function reportItemReason(item) {
  if (typeof item === 'string') return item;
  const reason = firstText([
    item?.reason,
    item?.problem,
    item?.message,
    ensureArray(item?.hard_fail_reasons).join('; '),
    ensureArray(item?.soft_deductions).map(entry => entry.reason || entry.category).join('; ')
  ]) || 'no explicit reason';
  const reasonCode = firstText([item?.reason_code, item?.reasonCode]);
  return reasonCode ? `${reasonCode}: ${reason}` : reason;
}

function addReportLink(links, index, item, report, status, label, statusHint) {
  const candidate = matchCandidateForReport(index, item);
  if (candidate) {
    promoteReportOnlyStatus(candidate, statusHint);
    candidate.reportLinks.push({ report, status, label, reason: reportItemReason(item) });
  }
  links.push({
    candidate,
    candidateId: candidate ? '' : 'unmatched',
    title: candidate?.title || reportItemTitle(item),
    report,
    status,
    label,
    reason: reportItemReason(item)
  });
}

function buildQualityFactcheckLinks(index, qualityReport, factCheckReport) {
  const links = [];
  for (const result of ensureArray(qualityReport?.article_results)) {
    const hardReasons = ensureArray(result?.hard_fail_reasons);
    if (result?.status === 'FAIL' || hardReasons.length > 0) {
      addReportLink(links, index, result, 'quality-report.json', 'hard_fail', `article_results[${result.index ?? '?'}]`, 'quality_fail');
    }
    for (const deduction of ensureArray(result?.soft_deductions)) {
      addReportLink(links, index, { ...deduction, headline: result?.headline, sources: result?.sources }, 'quality-report.json', 'deduction', `article_results[${result.index ?? '?'}].soft_deductions`, 'quality_fail');
    }
  }
  for (const [indexNumber, deduction] of ensureArray(qualityReport?.deductions).entries()) {
    addReportLink(links, index, {
      ...deduction,
      title: deduction?.location,
      headline: deduction?.location
    }, 'quality-report.json', deduction?.blocking === true ? 'hard_fail' : 'deduction', `deductions[${indexNumber}]`, 'quality_fail');
  }
  for (const [indexNumber, item] of ensureArray(factCheckReport?.must_fix).entries()) {
    addReportLink(links, index, {
      ...item,
      url: item?.source_url || item?.url,
      title: item?.location
    }, 'fact-check-report.json', 'must_fix', `must_fix[${indexNumber}]`, 'factcheck_fail');
  }
  for (const [indexNumber, item] of ensureArray(factCheckReport?.source_gaps).entries()) {
    const urlMatch = typeof item === 'string' ? item.match(/https?:\/\/[^\s;")]+/) : null;
    addReportLink(links, index, typeof item === 'string' ? {
      title: reportItemTitle(item),
      url: urlMatch?.[0] || '',
      reason: item
    } : item, 'fact-check-report.json', 'source_gap', `source_gaps[${indexNumber}]`, 'factcheck_fail');
  }
  return links;
}

function candidateReasonCells(candidate, reasonLabel) {
  const reasons = candidate.reasons.join('; ');
  if (reasonLabel === 'code-and-reason') return [candidate.reasonCode, reasons];
  if (reasonLabel === 'code') return [candidate.reasonCode];
  return [reasons];
}

function renderCandidateRows(candidates, limit, reasonLabel) {
  const rows = candidates.slice(0, limit).map((candidate, index) => [
    String(index + 1),
    `\`${candidate.id}\``,
    candidate.status,
    formatCandidateLink(candidate),
    `${candidate.source} / ${candidate.date}`,
    candidate.bucket,
    String(candidate.score),
    ...candidateReasonCells(candidate, reasonLabel)
  ]);
  return rows;
}

function eventBundleArtifact(root, date) {
  return readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'event-bundles.json'));
}

function eventBundleRowsForFinalCandidates(root, date, finalCandidates = []) {
  const artifact = eventBundleArtifact(root, date);
  const bundles = ensureArray(artifact?.event_bundles);
  if (bundles.length === 0 || finalCandidates.length === 0) return null;

  const candidateByUrl = new Map();
  for (const candidate of finalCandidates) {
    const candidateUrls = ensureArray(candidate.urls);
    for (const url of candidateUrls.length > 0 ? candidateUrls : [candidate.url]) {
      for (const key of [normalizeUrlKey(url), normalizeEventBundleTraceUrlKey(url)].filter(Boolean)) {
        candidateByUrl.set(key, candidate);
      }
    }
  }

  const rows = [];
  for (const bundle of bundles) {
    const candidate = candidateByUrl.get(normalizeUrlKey(bundle.primary_url)) ||
      candidateByUrl.get(normalizeEventBundleTraceUrlKey(bundle.primary_url));
    if (!candidate) continue;
    const evidenceUrls = ensureArray(bundle.evidence_urls);
    const evidenceSummary = evidenceUrls.length > 0
      ? evidenceUrls.slice(0, 3).join('; ')
      : 'none';
    const omittedEvidence = evidenceUrls.length > 3 ? `; +${evidenceUrls.length - 3} more` : '';
    rows.push([
      String(rows.length + 1),
      formatCandidateLink(candidate),
      `${evidenceSummary}${omittedEvidence}`,
      `${bundle.event_id || 'event_unknown'} / ${bundle.event_type || 'unknown'} / ${bundle.dedupe_reason || 'unknown'} / confidence=${bundle.confidence || 'unknown'}`
    ]);
  }
  return rows;
}

function renderEventBundleTrace(root, date, finalCandidates = []) {
  const artifact = eventBundleArtifact(root, date);
  if (!artifact) return '';
  const rows = eventBundleRowsForFinalCandidates(root, date, finalCandidates) || [];
  return [
    '### Event Bundle 추적',
    '',
    rows.length > 0
      ? renderMarkdownTable(
        ['#', 'Primary article', 'Followed evidence', 'Event Bundle'],
        rows
      )
      : '- none',
    '',
    '상세 artifact:',
    `- \`content/newsroom/${date}/event-bundles.json\``,
    `- \`content/newsroom/${date}/event-bundle-diagnostics.md\``,
    ''
  ].join('\n');
}

function renderCandidateTraceability(root, date) {
  const { artifacts, issues } = loadCandidateTraceArtifacts(root, date);
  const traceIndex = buildTraceIndex(artifacts, issues);
  const links = buildQualityFactcheckLinks(traceIndex, artifacts.quality.value, artifacts.factCheck.value);
  assignCandidateIds(traceIndex.candidates);

  const finalCandidates = traceIndex.candidates.filter(candidate => ['final_selected', 'primary_selected'].includes(candidate.status));
  const reserveCandidates = traceIndex.candidates.filter(candidate => candidate.status === 'reserve');
  const notableCandidates = traceIndex.candidates.filter(candidate =>
    !['final_selected', 'primary_selected', 'reserve', 'unknown'].includes(candidate.status)
  );
  const mergedCount = traceIndex.candidates.filter(candidate => candidate.status === 'merged').length;
  const demotedCount = traceIndex.candidates.filter(candidate => candidate.status === 'demoted').length;
  const rejectedCount = traceIndex.candidates.filter(candidate => candidate.status === 'rejected').length;
  const excludedCount = traceIndex.candidates.filter(candidate =>
    ['excluded', 'not_main_eligible', 'briefing_only', 'reference_only', 'quality_fail', 'factcheck_fail'].includes(candidate.status)
  ).length;
  const unmatchedCount = links.filter(link => !link.candidate).length;
  const collectedCount = Array.isArray(artifacts.collected.value?.candidates)
    ? artifacts.collected.value.candidates.length
    : traceIndex.candidates.length;
  const reporterCount = Array.isArray(artifacts.reporter.value?.candidates)
    ? artifacts.reporter.value.candidates.length
    : 0;
  const noCandidateArtifacts = traceIndex.candidates.length === 0;
  const detailPaths = TRACE_ARTIFACT_DEFS.map(def => def.path(date));
  const eventBundleTrace = renderEventBundleTrace(root, date, finalCandidates);

  const lines = [
    '## 후보 기사 추적',
    '',
    noCandidateArtifacts
      ? '후보 기사 artifact를 찾을 수 없어 추적 섹션을 생성하지 못했습니다.'
      : `총 후보 ${traceIndex.candidates.length}개 중 최종 선택 ${finalCandidates.length}개, reserve ${reserveCandidates.length}개, 제외/강등/거절/병합 주요 후보 ${Math.min(notableCandidates.length, 10)}개를 표시합니다.`,
    '',
    '### 한눈에 보는 후보 판단',
    '',
    `- 전체 수집 후보: ${collectedCount}`,
    `- reporter 후보: ${reporterCount}`,
    `- 최종 선택 기사: ${finalCandidates.length}`,
    `- reserve 후보: ${reserveCandidates.length}`,
    `- 제외 후보: ${excludedCount}`,
    `- 강등 후보: ${demotedCount}`,
    `- 거절 후보: ${rejectedCount}`,
    `- 병합 후보: ${mergedCount}`,
    `- 품질/팩트체크 연결 항목: ${links.length}`,
    `- unmatched 품질/팩트체크 연결 항목: ${unmatchedCount}`
  ];

  if (reserveCandidates.length > 5) lines.push(`- 생략된 reserve 후보: ${reserveCandidates.length - 5}`);
  if (notableCandidates.length > 10) lines.push(`- 생략된 제외/강등/거절 후보: ${notableCandidates.length - 10}`);
  if (links.length > 10) lines.push(`- 생략된 품질/팩트체크 연결 항목: ${links.length - 10}`);

  lines.push(
    '',
    '읽기/형식 요약:',
    ...(issues.length > 0 ? issues.map(issue => `- ${issue}`) : ['- none']),
    '',
    '### 최종 선택 기사',
    '',
    finalCandidates.length > 0
      ? renderMarkdownTable(
        ['#', 'Candidate ID', '상태', '원문 기사', '출처/날짜', 'Bucket', '점수', '판단 사유'],
        renderCandidateRows(finalCandidates, finalCandidates.length, 'reason')
      )
      : '- none',
    '',
    '### Reserve 후보',
    '',
    reserveCandidates.length > 0
      ? renderMarkdownTable(
        ['#', 'Candidate ID', '상태', '원문 기사', '출처/날짜', 'Bucket', '점수', 'Reserve 사유'],
        renderCandidateRows(reserveCandidates, 5, 'reason')
      )
      : '- none',
    '',
    '### 제외/강등/거절된 주요 후보',
    '',
    notableCandidates.length > 0
      ? renderMarkdownTable(
        ['#', 'Candidate ID', '상태', '원문 기사', '출처/날짜', 'Bucket', '점수', '사유 코드', '설명'],
        renderCandidateRows(notableCandidates, 10, 'code-and-reason')
      )
      : '- none',
    '',
    '### 품질/팩트체크 연결',
    '',
    links.length > 0
      ? renderMarkdownTable(
        ['#', 'Candidate ID', '기사', 'Report', '상태', '연결 항목', '사유'],
        links.slice(0, 10).map((link, index) => [
          String(index + 1),
          link.candidate ? `\`${link.candidate.id}\`` : 'unmatched',
          link.title,
          link.report,
          link.status,
          link.label,
          link.reason
        ])
      )
      : '- none',
    '',
    eventBundleTrace,
    '### 상세 artifact',
    '',
    ...detailPaths.map(relPath => `- \`${relPath}\``),
    ''
  );

  return lines.join('\n');
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

function renderGeneratedArtifacts(date, status = {}, root = process.cwd(), changedArtifacts = null) {
  const changed = [...new Set((Array.isArray(changedArtifacts)
    ? changedArtifacts
    : getChangedRepoVisibleArtifacts({ root, date }))
    .filter(filePath =>
      filePath.startsWith(`content/collected-news/${date}/`) ||
      filePath.startsWith(`content/newsroom/${date}/`) ||
      filePath.startsWith(`newsletters/${date}/`) ||
      filePath === 'data/newsletters.json' ||
      filePath === 'data/homepage-headline.json' ||
      filePath === 'data/article-exposure-history.json'
    ))].sort();
  const lines = [
    '## 생성 산출물',
    '',
    ...(changed.length > 0 ? changed.map(filePath => `- ${filePath}`) : ['- none'])
  ];
  return lines.join('\n');
}

function readSelectionReport(root, date) {
  if (!date) return null;
  return readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'selection-report.json'));
}

function renderHomepageHeadlineDecision(root, date, status = {}) {
  const selectionReport = readSelectionReport(root, date) || {};
  const decision = status.headline_decision || selectionReport.headline_decision || {};
  const inclusion = status.headline_latest_inclusion || selectionReport.headline_latest_inclusion || {};
  const coverage = status.article_exposure_coverage || selectionReport.article_exposure_coverage || {};
  return [
    '## Homepage Headline Decision',
    '',
    `- decision: ${valueOrUnknown(decision.reason || decision.decision)}`,
    `- current_headline_key: ${valueOrUnknown(decision.current_headline_key)}`,
    `- replacement_headline_key: ${valueOrUnknown(decision.replacement_headline_key)}`,
    `- previous_stored_current_score: ${valueOrUnknown(decision.previous_stored_current_score)}`,
    `- runtime_decayed_score: ${valueOrUnknown(decision.runtime_decayed_score)}`,
    `- last_scored_at: ${valueOrUnknown(decision.last_scored_at)}`,
    `- scored_at: ${valueOrUnknown(decision.scored_at)}`,
    `- latest_inclusion_mode: ${valueOrUnknown(inclusion.mode)}`,
    `- injected_from_snapshot: ${booleanText(inclusion.injected_from_snapshot === true)}`,
    `- snapshot_revalidated: ${booleanText(inclusion.snapshot_revalidated === true || decision.snapshot_revalidated === true)}`,
    `- exposure_history_coverage: mode=${valueOrUnknown(coverage.mode)}; coverage_starts_at=${valueOrUnknown(coverage.coverage_starts_at)}; backfill_included=${booleanText(coverage.backfill_included === true)}`,
    '- Artifacts:',
    `  - \`data/homepage-headline.json\``,
    `  - \`data/article-exposure-history.json\``,
    ''
  ].join('\n');
}

function renderHomepageHeadlineDesignReview(status = {}, date = '') {
  const review = status.homepage_headline_design_review && typeof status.homepage_headline_design_review === 'object'
    ? status.homepage_headline_design_review
    : {};
  const artifactPath = review.artifact_path || review.screenshot_artifact_path || (date
    ? `content/newsroom/${date}/homepage-headline-design-review.png`
    : 'content/newsroom/YYYY-MM-DD/homepage-headline-design-review.png');
  return [
    '## Homepage Headline Design Review',
    '',
    `- Figma URL: ${valueOrUnknown(review.figma_url || review.url || process.env.HOMEPAGE_HEADLINE_FIGMA_URL)}`,
    `- Artifact path: ${artifactPath}`,
    `- Desktop coverage: ${valueOrUnknown(review.desktop_coverage || 'covered')}`,
    `- Mobile coverage: ${valueOrUnknown(review.mobile_coverage || 'covered')}`,
    `- Implementation deviation: ${valueOrUnknown(review.implementation_deviation || 'none')}`,
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
        '- C++/tooling fallback만으로는 normal homepage-visible Camera HAL newsletter를 만들 수 없습니다.',
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

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function renderFallbackPublicIssueNotes(root, date) {
  const report = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'));
  if (!report) return '';
  const demoted = ensureArray(report.demoted_articles);
  const fallback = ensureArray(report.fallback_articles);
  if (demoted.length === 0 && fallback.length === 0) return '';
  const lines = [
    '## 교체/강등된 기사',
    ''
  ];
  if (demoted.length === 0) {
    lines.push('- none');
  } else {
    for (const item of demoted) {
      lines.push(`- ${valueOrUnknown(item.headline)}: ${valueOrUnknown(item.reason)}`);
    }
  }
  if (fallback.length > 0) {
    lines.push('', '## Fallback 기사', '');
    for (const item of fallback) {
      lines.push(`- ${valueOrUnknown(item.headline)}: ${valueOrUnknown(item.reason)} (${valueOrUnknown(item.relevance_bucket)})`);
    }
  }
  return lines.join('\n');
}

function renderArticleStructureContract(root, date) {
  if (!date) return '';
  const editor = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'));
  if (!editor || !Array.isArray(editor.sections)) return '';
  const qualityReport = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'quality-report.json'));
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
  const editorBrief = date ? readTextIfExists(path.join(root, 'content', 'newsroom', date, 'editor-in-chief-brief.md')) : '';
  const editorBriefSections = extractEditorBriefSections(editorBrief);
  const lines = [];
  const pushSection = section => {
    if (section) lines.push(section, '');
  };

  const reviewOnlyStatus = renderReviewOnlyStatus(status, handoff, root, date);
  const publicationDecisionSummary = renderPublicationDecisionSummary(status, handoff);
  const editorialDecisionSummary = renderEditorialDecisionSummary(root, date, status, handoff);

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
  pushSection(renderRawInputProvenance(status, date));
  pushSection(renderPriorityOverridePolicy());
  pushSection(renderStatusSection(status, handoff));
  pushSection(editorBriefSections);

  lines.push(
    renderEditorApprovedPublicationPolicy(),
    renderCompositionSummary(status),
    renderCompositionNotes(status),
    renderArticleStructureContract(root, date),
    renderPublicNewsletterReadiness(root, date, handoff),
    renderCandidatePoolPreflight(root, date, status),
    renderFailureDiagnostics(root, date, status, handoff),
    renderPublicNewsletterNotice(status, handoff),
    renderFallbackPublicIssueNotes(root, date),
    renderFinalSelectionStatus(status),
    renderHalSignalQualitySummary(root, date, status),
    renderSourceQualityGateSummary(root, date),
    renderSourceQualityDiagnosisSummary(root, date),
    renderNewsletterImageAuditSummary(root, date),
    renderSeedEvidenceUsageSummary(root, date),
    renderSourceChangeEventsSummary(root, date),
    renderEvidencePackSummary(root, date),
    renderCandidateTraceability(root, date),
    renderHomepageHeadlineDecision(root, date, status),
    renderHomepageHeadlineDesignReview(status, date),
    renderEditorActionGuidance(status, date),
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
