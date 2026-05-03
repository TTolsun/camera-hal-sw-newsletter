const REPORTER_SELECTION_NOTE =
  'Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.';

const REPORTER_SELECTED_ALIAS_NOTE =
  'selected is reporter-stage only; use final_selected or shortlisted-candidates.json for final publication selection.';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').trim();
}

function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function candidateUrl(candidate = {}) {
  return text(candidate.normalized_url || candidate.url || candidate.article_url || candidate.articleUrl);
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function candidateKey(candidate = {}) {
  return normalizeUrl(candidateUrl(candidate));
}

function finalSelectionEligibility(candidate = {}) {
  return text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility) || null;
}

function finalExclusionReasons(candidate = {}) {
  if (Array.isArray(candidate.final_exclusion_reasons)) return candidate.final_exclusion_reasons;
  return ensureArray(candidate.exclusion_reasons);
}

function isReporterSelected(candidate = {}) {
  if (typeof candidate.reporter_selected === 'boolean') return candidate.reporter_selected;
  return bool(candidate.selected);
}

function isFinalSelected(candidate = {}) {
  if (typeof candidate.final_selected === 'boolean') return candidate.final_selected;
  if (typeof candidate.selected_for_editor === 'boolean') return candidate.selected_for_editor;
  return bool(candidate.selected);
}

function reporterSelectedUrlSet(reporter) {
  return new Set(ensureArray(reporter?.candidates)
    .filter(isReporterSelected)
    .map(candidateKey)
    .filter(Boolean));
}

function finalSelectedUrlSet(shortlistReport) {
  return new Set(ensureArray(shortlistReport?.selected_articles)
    .map(candidateKey)
    .filter(Boolean));
}

function candidatesByUrl(candidates) {
  const map = new Map();
  for (const candidate of ensureArray(candidates)) {
    const key = candidateKey(candidate);
    if (key && !map.has(key)) map.set(key, candidate);
  }
  return map;
}

function finalCandidateMap(shortlistReport) {
  return candidatesByUrl([
    ...ensureArray(shortlistReport?.selected_articles),
    ...ensureArray(shortlistReport?.shortlisted_candidates),
    ...ensureArray(shortlistReport?.excluded_candidates)
  ]);
}

function summarizeFinalExclusionReasons(candidates) {
  const counts = new Map();
  for (const candidate of ensureArray(candidates)) {
    if (isFinalSelected(candidate)) continue;
    for (const reason of finalExclusionReasons(candidate)) {
      const key = text(reason) || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function normalizeShortlistCandidate(candidate, reporterSelectedUrls = null) {
  const finalSelected = isFinalSelected(candidate);
  const key = candidateKey(candidate);
  const reporterSelected = reporterSelectedUrls
    ? reporterSelectedUrls.has(key)
    : bool(candidate.reporter_selected);
  const reasons = finalSelected ? [] : finalExclusionReasons(candidate);
  return {
    ...candidate,
    selection_stage: 'deterministic-final',
    final_selected: finalSelected,
    reporter_selected: reporterSelected,
    selected_for_editor: finalSelected,
    selected: finalSelected,
    final_selection_eligibility: finalSelectionEligibility(candidate),
    final_exclusion_reasons: reasons
  };
}

function normalizeShortlistReport(shortlistReport, reporter = null) {
  const reporterSelectedUrls = reporter ? reporterSelectedUrlSet(reporter) : null;
  const shortlistedCandidates = ensureArray(shortlistReport?.shortlisted_candidates)
    .map(candidate => normalizeShortlistCandidate(candidate, reporterSelectedUrls));
  const selectedArticles = ensureArray(shortlistReport?.selected_articles)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: true }, reporterSelectedUrls));
  const excludedCandidates = ensureArray(shortlistReport?.excluded_candidates)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: false }, reporterSelectedUrls));
  const reporterSelectedCount = reporter
    ? ensureArray(reporter.candidates).filter(isReporterSelected).length
    : shortlistReport?.reporter_selected_count ?? null;
  const reporterCandidateCount = reporter
    ? ensureArray(reporter.candidates).length
    : shortlistReport?.reporter_candidate_count ?? null;
  const reporterSelectedButFinalExcludedCount = reporter
    ? ensureArray(reporter.candidates).filter(candidate => isReporterSelected(candidate) && !isFinalSelected(candidate)).length
    : shortlistReport?.reporter_selected_but_final_excluded_count ?? null;
  const finalExclusionReasonSummary = summarizeFinalExclusionReasons([
    ...shortlistedCandidates,
    ...excludedCandidates
  ]);

  return {
    ...shortlistReport,
    schema_version: Math.max(Number(shortlistReport?.schema_version || 1), 2),
    selection_stage: 'deterministic-final',
    final_input_candidate_count: shortlistReport?.input_candidate_count ?? null,
    final_eligible_candidate_count: shortlistReport?.eligible_candidate_count ?? null,
    final_selected_article_count: shortlistReport?.selected_article_count ?? null,
    reporter_candidate_count: reporterCandidateCount,
    reporter_selected_count: reporterSelectedCount,
    reporter_selected_but_final_excluded_count: reporterSelectedButFinalExcludedCount,
    shortlisted_candidates: shortlistedCandidates,
    selected_articles: selectedArticles,
    excluded_candidates: excludedCandidates,
    final_exclusion_reason_summary: finalExclusionReasonSummary,
    exclusion_reason_summary: ensureArray(shortlistReport?.exclusion_reason_summary).length > 0
      ? shortlistReport.exclusion_reason_summary
      : finalExclusionReasonSummary
  };
}

function normalizeReporterReport(reporter, shortlistReport = null) {
  const finalSelectedUrls = finalSelectedUrlSet(shortlistReport);
  const finalByUrl = finalCandidateMap(shortlistReport);
  const candidates = ensureArray(reporter?.candidates).map(candidate => {
    const key = candidateKey(candidate);
    const finalCandidate = finalByUrl.get(key) || {};
    const reporterSelected = isReporterSelected(candidate);
    const finalSelected = finalSelectedUrls.has(key);
    const reasons = finalSelected
      ? []
      : finalExclusionReasons(finalCandidate).length > 0
        ? finalExclusionReasons(finalCandidate)
        : finalExclusionReasons(candidate);
    return {
      ...candidate,
      selection_stage: 'reporter',
      reporter_selected: reporterSelected,
      final_selected: finalSelected,
      selected_for_editor: finalSelected,
      selected: reporterSelected,
      final_selection_eligibility: finalSelectionEligibility(finalCandidate) || finalSelectionEligibility(candidate),
      final_exclusion_reasons: reasons
    };
  });
  const reporterSelectedCount = candidates.filter(isReporterSelected).length;
  return {
    ...reporter,
    schema_version: Math.max(Number(reporter?.schema_version || 1), 2),
    date: reporter?.date || shortlistReport?.date || '',
    selection_stage: 'reporter',
    reporter_candidate_count: candidates.length,
    reporter_selected_count: reporterSelectedCount,
    final_input_candidate_count: shortlistReport?.final_input_candidate_count ?? shortlistReport?.input_candidate_count ?? null,
    final_eligible_candidate_count: shortlistReport?.final_eligible_candidate_count ?? shortlistReport?.eligible_candidate_count ?? null,
    final_selected_article_count: shortlistReport?.final_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    reporter_selected_but_final_excluded_count: candidates
      .filter(candidate => isReporterSelected(candidate) && !isFinalSelected(candidate)).length,
    final_exclusion_reason_summary: summarizeFinalExclusionReasons(candidates),
    note: REPORTER_SELECTED_ALIAS_NOTE,
    candidates
  };
}

function selectionDiagnosticsFromReports(shortlistReport = null, reporterReport = null) {
  return {
    reporter_candidate_count: reporterReport?.reporter_candidate_count ?? shortlistReport?.reporter_candidate_count ?? null,
    reporter_selected_count: reporterReport?.reporter_selected_count ?? shortlistReport?.reporter_selected_count ?? null,
    final_input_candidate_count: shortlistReport?.final_input_candidate_count ?? shortlistReport?.input_candidate_count ?? null,
    final_eligible_candidate_count: shortlistReport?.final_eligible_candidate_count ?? shortlistReport?.eligible_candidate_count ?? null,
    final_selected_article_count: shortlistReport?.final_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    reporter_selected_but_final_excluded_count:
      reporterReport?.reporter_selected_but_final_excluded_count ??
      shortlistReport?.reporter_selected_but_final_excluded_count ??
      null,
    final_exclusion_reason_summary: ensureArray(
      shortlistReport?.final_exclusion_reason_summary?.length > 0
        ? shortlistReport.final_exclusion_reason_summary
        : reporterReport?.final_exclusion_reason_summary?.length > 0
          ? reporterReport.final_exclusion_reason_summary
          : shortlistReport?.exclusion_reason_summary
    ),
    note: REPORTER_SELECTION_NOTE
  };
}

function formatCount(value) {
  return value === null || value === undefined ? 'unknown' : String(value);
}

function renderCandidateSelectionDiagnostics(diagnostics = {}) {
  const reasons = ensureArray(diagnostics.final_exclusion_reason_summary)
    .slice(0, 5)
    .map(item => `- ${item.reason} (${item.count})`)
    .join('\n') || '- none';
  return [
    '## 후보 선택 진단',
    '',
    `- Reporter candidates: ${formatCount(diagnostics.reporter_candidate_count)}`,
    `- Reporter-selected candidates: ${formatCount(diagnostics.reporter_selected_count)}`,
    `- Final input candidates: ${formatCount(diagnostics.final_input_candidate_count ?? diagnostics.input_candidate_count)}`,
    `- Final eligible candidates: ${formatCount(diagnostics.final_eligible_candidate_count ?? diagnostics.eligible_candidate_count)}`,
    `- Final selected articles: ${formatCount(diagnostics.final_selected_article_count ?? diagnostics.selected_article_count)}`,
    `- Reporter-selected but final-excluded: ${formatCount(diagnostics.reporter_selected_but_final_excluded_count)}`,
    '',
    '주요 final exclusion reason:',
    reasons,
    '',
    diagnostics.note || REPORTER_SELECTION_NOTE
  ].join('\n');
}

module.exports = {
  REPORTER_SELECTED_ALIAS_NOTE,
  REPORTER_SELECTION_NOTE,
  ensureArray,
  isFinalSelected,
  isReporterSelected,
  normalizeReporterReport,
  normalizeShortlistCandidate,
  normalizeShortlistReport,
  renderCandidateSelectionDiagnostics,
  selectionDiagnosticsFromReports,
  summarizeFinalExclusionReasons
};
