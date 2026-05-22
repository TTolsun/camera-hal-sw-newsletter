const REPORTER_SELECTION_NOTE =
  'Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.';

const REPORTER_SELECTED_ALIAS_NOTE =
  'selected is reporter-stage only; use final_selected or shortlisted-candidates.json for final publication selection.';
const {
  candidateGroupKey,
  groupCoverageSummary
} = require('../common/article-groups');

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
    const hash = parsed.hash;
    const preserveHash = parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera' &&
      /^#(?:camera-[a-z0-9-]+-)?\d+\.\d+\.\d+(?:[-\w.]*)?$/i.test(hash);
    if (!preserveHash) parsed.hash = '';
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
    ...ensureArray(shortlistReport?.primary_selected_articles),
    ...ensureArray(shortlistReport?.selected_articles),
    ...ensureArray(shortlistReport?.reserve_candidates),
    ...ensureArray(shortlistReport?.shortlisted_candidates),
    ...ensureArray(shortlistReport?.demoted_candidates),
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
  const reserveCandidate = bool(candidate.reserve_candidate);
  const primarySelected = finalSelected && bool(candidate.primary_selected, true);
  const key = candidateKey(candidate);
  const reporterSelected = reporterSelectedUrls
    ? reporterSelectedUrls.has(key)
    : bool(candidate.reporter_selected);
  const reasons = finalSelected ? [] : finalExclusionReasons(candidate);
  const selectionStage = finalSelected
    ? 'deterministic-primary'
    : reserveCandidate
      ? 'deterministic-reserve'
      : candidate.selection_stage || 'deterministic-final';
  return {
    ...candidate,
    article_group_key: candidateGroupKey(candidate),
    related_context_candidates: ensureArray(candidate.related_context_candidates),
    selection_stage: selectionStage,
    final_selected: finalSelected,
    primary_selected: primarySelected,
    reserve_candidate: reserveCandidate,
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
  const selectedSource = ensureArray(shortlistReport?.primary_selected_articles).length > 0
    ? shortlistReport.primary_selected_articles
    : shortlistReport?.selected_articles;
  const selectedArticles = ensureArray(selectedSource)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: true }, reporterSelectedUrls));
  const reserveCandidates = ensureArray(shortlistReport?.reserve_candidates)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: false, reserve_candidate: true }, reporterSelectedUrls));
  const demotedCandidates = ensureArray(shortlistReport?.demoted_candidates)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: false }, reporterSelectedUrls));
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
    ...reserveCandidates,
    ...demotedCandidates,
    ...excludedCandidates
  ]);
  const deterministicSelectedCount =
    shortlistReport?.deterministic_selected_count ??
    shortlistReport?.primary_selected_article_count ??
    shortlistReport?.selected_article_count ??
    selectedArticles.length;
  const reserveCandidateCount = shortlistReport?.reserve_candidate_count ?? reserveCandidates.length;
  const demotedCandidateCount = shortlistReport?.demoted_candidate_count ?? demotedCandidates.length;
  const groupCoverage = groupCoverageSummary({
    selectedGroupKeys: selectedArticles.map(candidateGroupKey),
    renderedGroupKeys: ensureArray(shortlistReport?.rendered_group_keys),
    demotedGroups: ensureArray(shortlistReport?.explicitly_demoted_group_keys).map(key => ({ article_group_key: key, demotion_reason: 'shortlist_report' }))
  });

  return {
    ...shortlistReport,
    schema_version: Math.max(Number(shortlistReport?.schema_version || 1), 3),
    selection_stage: 'deterministic-final',
    final_input_candidate_count: shortlistReport?.input_candidate_count ?? null,
    final_eligible_candidate_count: shortlistReport?.eligible_candidate_count ?? null,
    final_selected_article_count: deterministicSelectedCount,
    deterministic_selected_count: deterministicSelectedCount,
    selected_group_count: shortlistReport?.selected_group_count ?? groupCoverage.selected_group_count,
    rendered_group_count: shortlistReport?.rendered_group_count ?? null,
    explicitly_demoted_group_count: shortlistReport?.explicitly_demoted_group_count ?? 0,
    selected_representative_group_keys: ensureArray(shortlistReport?.selected_representative_group_keys).length > 0
      ? shortlistReport.selected_representative_group_keys
      : groupCoverage.selected_representative_group_keys,
    rendered_group_keys: ensureArray(shortlistReport?.rendered_group_keys),
    explicitly_demoted_group_keys: ensureArray(shortlistReport?.explicitly_demoted_group_keys),
    primary_selected_article_count: shortlistReport?.primary_selected_article_count ?? selectedArticles.length,
    reserve_candidate_count: reserveCandidateCount,
    demoted_candidate_count: demotedCandidateCount,
    composition_mode: shortlistReport?.composition_mode || null,
    selection_composition_mode: shortlistReport?.selection_composition_mode || shortlistReport?.composition_mode || null,
    composition_reason: shortlistReport?.composition_reason || '',
    composition_summary: shortlistReport?.composition_summary || {},
    headline_decision: shortlistReport?.headline_decision || null,
    headline_latest_inclusion: shortlistReport?.headline_latest_inclusion || null,
    headline_public_render_reconciliation: shortlistReport?.headline_public_render_reconciliation || null,
    removed_due_to_headline_inclusion: ensureArray(shortlistReport?.removed_due_to_headline_inclusion),
    article_exposure_coverage: shortlistReport?.article_exposure_coverage || null,
    editor_review_required: shortlistReport?.editor_review_required === true,
    reporter_candidate_count: reporterCandidateCount,
    reporter_selected_count: reporterSelectedCount,
    reporter_selected_but_final_excluded_count: reporterSelectedButFinalExcludedCount,
    shortlisted_candidates: shortlistedCandidates,
    primary_selected_articles: selectedArticles,
    selected_articles: selectedArticles,
    reserve_candidates: reserveCandidates,
    demoted_candidates: demotedCandidates,
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
    const reserveCandidate = bool(finalCandidate.reserve_candidate, bool(candidate.reserve_candidate));
    const primarySelected = finalSelected && bool(finalCandidate.primary_selected, true);
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
      primary_selected: primarySelected,
      reserve_candidate: reserveCandidate,
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
    deterministic_selected_count: shortlistReport?.deterministic_selected_count ?? shortlistReport?.selected_article_count ?? null,
    selected_group_count: shortlistReport?.selected_group_count ?? null,
    rendered_group_count: shortlistReport?.rendered_group_count ?? null,
    explicitly_demoted_group_count: shortlistReport?.explicitly_demoted_group_count ?? null,
    selected_representative_group_keys: ensureArray(shortlistReport?.selected_representative_group_keys),
    rendered_group_keys: ensureArray(shortlistReport?.rendered_group_keys),
    explicitly_demoted_group_keys: ensureArray(shortlistReport?.explicitly_demoted_group_keys),
    primary_selected_article_count: shortlistReport?.primary_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    reserve_candidate_count: shortlistReport?.reserve_candidate_count ?? null,
    demoted_candidate_count: shortlistReport?.demoted_candidate_count ?? null,
    composition_mode: shortlistReport?.composition_mode || null,
    selection_composition_mode: shortlistReport?.selection_composition_mode || shortlistReport?.composition_mode || null,
    composition_reason: shortlistReport?.composition_reason || '',
    composition_summary: shortlistReport?.composition_summary || {},
    editor_review_required: shortlistReport?.editor_review_required === true,
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
    deterministic_selected_count: shortlistReport?.deterministic_selected_count ?? shortlistReport?.selected_article_count ?? null,
    selected_group_count: shortlistReport?.selected_group_count ?? reporterReport?.selected_group_count ?? null,
    rendered_group_count: shortlistReport?.rendered_group_count ?? reporterReport?.rendered_group_count ?? null,
    explicitly_demoted_group_count: shortlistReport?.explicitly_demoted_group_count ?? reporterReport?.explicitly_demoted_group_count ?? null,
    selected_representative_group_keys: ensureArray(shortlistReport?.selected_representative_group_keys ?? reporterReport?.selected_representative_group_keys),
    rendered_group_keys: ensureArray(shortlistReport?.rendered_group_keys ?? reporterReport?.rendered_group_keys),
    explicitly_demoted_group_keys: ensureArray(shortlistReport?.explicitly_demoted_group_keys ?? reporterReport?.explicitly_demoted_group_keys),
    primary_selected_article_count: shortlistReport?.primary_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    reserve_candidate_count: shortlistReport?.reserve_candidate_count ?? null,
    demoted_candidate_count: shortlistReport?.demoted_candidate_count ?? null,
    composition_mode: shortlistReport?.composition_mode || null,
    selection_composition_mode: shortlistReport?.selection_composition_mode || shortlistReport?.composition_mode || null,
    composition_reason: shortlistReport?.composition_reason || '',
    composition_summary: shortlistReport?.composition_summary || {},
    editor_review_required: shortlistReport?.editor_review_required === true,
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
  const composition = diagnostics.composition_summary || {};
  const headline = diagnostics.headline_decision || {};
  const headlineInclusion = diagnostics.headline_latest_inclusion || {};
  const headlinePublicRender = diagnostics.headline_public_render_reconciliation || {};
  const headlineRemoved = ensureArray(diagnostics.removed_due_to_headline_inclusion);
  const hints = ensureArray(diagnostics.selection_shortage_hints)
    .map(item => `- ${item}`)
    .join('\n') || '- none';
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
    `- Deterministic primary articles: ${formatCount(diagnostics.primary_selected_article_count ?? diagnostics.deterministic_selected_count)}`,
    `- Selected representative groups: ${formatCount(diagnostics.selected_group_count)}`,
    `- Rendered groups: ${formatCount(diagnostics.rendered_group_count)}`,
    `- Explicitly demoted groups: ${formatCount(diagnostics.explicitly_demoted_group_count)}`,
    `- Reserve candidates: ${formatCount(diagnostics.reserve_candidate_count)}`,
    `- Demoted candidates: ${formatCount(diagnostics.demoted_candidate_count)}`,
    `- Composition mode: ${formatCount(diagnostics.composition_mode)}`,
    `- Editor review required: ${diagnostics.editor_review_required === true ? 'true' : 'false'}`,
    `- Reporter-selected but final-excluded: ${formatCount(diagnostics.reporter_selected_but_final_excluded_count)}`,
    `- direct_aosp_camera: ${formatCount(diagnostics.direct_aosp_camera_count ?? composition.direct_aosp_camera_count)}`,
    `- android_platform_camera_adjacent: ${formatCount(diagnostics.android_platform_camera_adjacent_count ?? composition.android_platform_camera_adjacent_count)}`,
    `- camera_driver_image_pipeline: ${formatCount(diagnostics.camera_driver_image_pipeline_count ?? composition.camera_driver_image_pipeline_count)}`,
    `- android_multimedia_camera_output: ${formatCount(diagnostics.android_multimedia_camera_output_count ?? composition.android_multimedia_camera_output_count)}`,
    `- soc_platform_signal: ${formatCount(diagnostics.soc_platform_signal_count ?? composition.soc_platform_signal_count)}`,
    `- cpp_ai_tooling_fallback: ${formatCount(diagnostics.cpp_ai_tooling_fallback_count ?? composition.cpp_ai_tooling_fallback_count)}`,
    `- Primary Camera Stack: ${formatCount(diagnostics.primary_camera_stack_topic_count ?? composition.primary_camera_stack_topic_count)}`,
    `- Supporting main articles: ${formatCount(diagnostics.supporting_main_article_count ?? composition.supporting_main_article_count)}`,
    `- Forbidden main articles: ${formatCount(diagnostics.forbidden_main_article_count ?? composition.forbidden_main_article_count)}`,
    `- Non-fallback reviewable: ${formatCount(diagnostics.non_fallback_reviewable_article_count ?? composition.non_fallback_reviewable_article_count)}`,
    '',
    'Source/parser recovery hint:',
    hints,
    '',
    '주요 final exclusion reason:',
    reasons,
    '',
    'Homepage Headline:',
    `- decision: ${formatCount(headline.reason || headline.decision)}`,
    `- current_headline_key: ${formatCount(headline.current_headline_key)}`,
    `- replacement_headline_key: ${formatCount(headline.replacement_headline_key)}`,
    `- public_render_reconciled: ${headline.public_render_reconciled === true || headlinePublicRender.applied === true ? 'true' : 'false'}`,
    `- public_rendered_headline_key: ${formatCount(headline.public_rendered_headline_key || headlinePublicRender.rendered_headline_key)}`,
    `- public_render_reconciliation_reason: ${formatCount(headline.public_render_reconciliation_reason || headlinePublicRender.reason)}`,
    `- runtime_decayed_score: ${formatCount(headline.runtime_decayed_score)}`,
    `- previous_stored_current_score: ${formatCount(headline.previous_stored_current_score)}`,
    `- last_scored_at: ${formatCount(headline.last_scored_at)}`,
    `- scored_at: ${formatCount(headline.scored_at)}`,
    `- included_as_latest: ${headlineInclusion.included === true ? 'true' : 'false'}`,
    `- latest_inclusion_mode: ${formatCount(headlineInclusion.mode)}`,
    `- injected_from_snapshot: ${headlineInclusion.injected_from_snapshot === true ? 'true' : 'false'}`,
    `- removed_due_to_headline_inclusion_count: ${headlineRemoved.length}`,
    ...(headlineRemoved.length > 0
      ? headlineRemoved.slice(0, 5).map(item =>
        `  - ${formatCount(item.title)} (${formatCount(item.article_identity_key)}): ${formatCount(item.reason)}`
      )
      : []),
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
