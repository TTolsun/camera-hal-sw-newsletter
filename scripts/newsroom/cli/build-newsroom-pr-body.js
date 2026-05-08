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

function renderStatusSection(status) {
  const editorAction = recommendedEditorAction(status);
  const editorialReviewable = status.failure_kind === 'editorial_reviewable';
  return [
    '## 생성 상태',
    '',
    editorialReviewable
      ? '발행 불가 경고: 이 PR은 발행 불가 review PR입니다. public issue 파일과 data/newsletters.json 업데이트를 포함하지 않습니다.'
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
    `- direct_aosp_camera count: ${valueOrUnknown(countFromStatus(status, 'direct_aosp_camera_count'))}`,
    `- camera_driver_image_pipeline count: ${valueOrUnknown(countFromStatus(status, 'camera_driver_image_pipeline_count'))}`,
    `- android_platform_camera_adjacent count: ${valueOrUnknown(countFromStatus(status, 'android_platform_camera_adjacent_count'))}`,
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
      'Fallback composition: 설정된 보조 main article로 SoC/platform 또는 C++/AI tooling article이 포함되었습니다. 인위적인 Camera HAL 표현을 추가하지 말고 실제 SoC/platform/native 개발 연결성을 명확히 유지하세요.',
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

function renderGeneratedArtifacts(date, status = {}) {
  const lines = [
    '## 생성 산출물',
    '',
    `- content/collected-news/${date}/candidates.json`,
    `- content/newsroom/${date}/shortlisted-candidates.json`,
    `- content/newsroom/${date}/article-capsules.json`,
    `- content/newsroom/${date}/reporter-candidates.json`,
    `- content/newsroom/${date}/editor-draft.json`,
    `- content/newsroom/${date}/fact-check-report.json`,
    `- content/newsroom/${date}/quality-report.json`,
    `- content/newsroom/${date}/quality-report.md`,
    `- content/newsroom/${date}/retry-history.json`,
    `- content/newsroom/${date}/retry-history.md`,
    `- content/newsroom/${date}/recovery-prompt.md (only when recovery is needed)`
  ];
  if (status.failure_kind !== 'editorial_reviewable') {
    lines.push(
      `- newsletters/${date}/newsletter.md`,
      `- newsletters/${date}/index.html`,
      '- data/newsletters.json'
    );
  }
  return lines.join('\n');
}

function renderNotGeneratedPublicArtifacts(date, status = {}) {
  if (status.failure_kind !== 'editorial_reviewable') return '';
  return [
    '## 생성하지 않은 public 산출물',
    '',
    `- newsletters/${date}/newsletter.md - not generated`,
    `- newsletters/${date}/index.html - not generated`,
    '- data/newsletters.json - not updated'
  ].join('\n');
}

function buildNewsroomPrBody(options = {}) {
  const resolved = options.publishStatus || resolvePublishStatus(options);
  const root = resolved.root || options.root || process.cwd();
  const date = resolved.date || options.date || '';
  const status = resolved.status;
  const editorBrief = date ? readTextIfExists(path.join(root, 'content', 'newsroom', date, 'editor-in-chief-brief.md')) : '';
  const editorBriefSections = extractEditorBriefSections(editorBrief);
  const lines = [];

  if (editorBriefSections) {
    lines.push(editorBriefSections, '');
  }

  lines.push(
    renderStatusSection(status),
    renderEditorApprovedPublicationPolicy(),
    renderCompositionSummary(status),
    renderCompositionNotes(status),
    renderFinalSelectionStatus(status),
    renderEditorActionGuidance(status, date),
    renderGeneratedArtifacts(date, status),
    renderNotGeneratedPublicArtifacts(date, status)
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
  renderEditorApprovedPublicationPolicy,
  recommendedEditorAction
};
