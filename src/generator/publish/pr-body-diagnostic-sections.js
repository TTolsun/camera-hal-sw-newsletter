// PR body의 진단(diagnostics) section을 담당한다.
// failure diagnostics, catch-up, candidate pool preflight처럼 부가 진단
// artifact를 읽어 Markdown으로 정리하는 render 함수만 모은 단일 책임 모듈이다.

const {
  ensureArray
} = require('./publish-status');
const {
  loadNewsroomReport
} = require('./pr-body-artifacts');
const {
  valueOrUnknown,
  booleanText
} = require('./pr-body-format');

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

module.exports = {
  renderFailureDiagnostics,
  candidateShortageStatus,
  formatHintRows,
  sourceEffectivenessHints,
  renderCatchUpSummary,
  renderCandidatePoolPreflight
};
