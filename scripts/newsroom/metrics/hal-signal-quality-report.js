const fs = require('fs');
const path = require('path');

const {
  kstDate,
  readJson,
  writeJson
} = require('../../../src/core/common/common');
const {
  mergedCandidateManifestRelPath,
  newsroomDir,
  newsroomRelPath
} = require('../../../src/core/common/artifact-paths');
const {
  HAL_SIGNAL_SCHEMA_VERSION,
  buildHalSignalQualitySummary,
  buildMainArticleSignalChecks,
  buildSelectionShortageHintDetails,
  ensureArray,
  renderHalSignalQualityMarkdown
} = require('../common/hal-signal-quality');

const REQUIRED_INPUTS = Object.freeze({
  shortlisted_candidates: date => newsroomRelPath(date, 'shortlisted-candidates.json'),
  editor_draft: date => newsroomRelPath(date, 'editor-draft.json'),
  quality_report: date => newsroomRelPath(date, 'quality-report.json')
});

const OPTIONAL_INPUTS = Object.freeze({
  source_effectiveness_report: date => newsroomRelPath(date, 'source-effectiveness-report.json'),
  source_quality_report: date => newsroomRelPath(date, 'source-quality-report.json'),
  evidence_pack_summary: date => newsroomRelPath(date, 'evidence-pack-summary.json'),
  merged_candidate_manifest: date => mergedCandidateManifestRelPath(date)
});

function text(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (typeof value === 'object') return Object.values(value).map(text).join(' ');
  return String(value).trim();
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function relToPath(root, relPath) {
  return path.join(root, ...String(relPath).split('/'));
}

function readJsonInput(root, relPath) {
  const filePath = relToPath(root, relPath);
  if (!fs.existsSync(filePath)) {
    return { status: 'input_unavailable', relPath, value: null, error: '' };
  }
  try {
    return { status: 'loaded', relPath, value: readJson(filePath), error: '' };
  } catch (error) {
    return { status: 'invalid', relPath, value: null, error: error.message };
  }
}

function loadHalSignalQualityInputs(root, date) {
  const resolvedRoot = path.resolve(root || process.cwd());
  const required = {};
  const optional = {};
  const artifacts = {};

  for (const [name, resolver] of Object.entries(REQUIRED_INPUTS)) {
    const input = readJsonInput(resolvedRoot, resolver(date));
    required[name] = {
      path: input.relPath,
      status: input.status,
      error: input.error
    };
    artifacts[name] = input.value;
  }

  for (const [name, resolver] of Object.entries(OPTIONAL_INPUTS)) {
    const input = readJsonInput(resolvedRoot, resolver(date));
    optional[name] = {
      path: input.relPath,
      status: input.status,
      error: input.error
    };
    artifacts[name] = input.value;
  }

  return {
    date,
    root: resolvedRoot,
    inputs: {
      required,
      optional,
      missing_required: Object.entries(required)
        .filter(([, input]) => input.status !== 'loaded')
        .map(([name]) => name),
      unavailable_optional: Object.entries(optional)
        .filter(([, input]) => input.status !== 'loaded')
        .map(([name]) => name)
    },
    ...artifacts
  };
}

function flattenInputStatuses(inputState = {}) {
  const required = objectValue(inputState.required);
  const optional = objectValue(inputState.optional);
  return Object.fromEntries([
    ...Object.entries(required),
    ...Object.entries(optional)
  ].map(([name, input]) => [name, input?.status || 'input_unavailable']));
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

function candidateUrls(candidate = {}) {
  return [
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.normalized_url,
    candidate.source_candidate_url
  ].map(normalizeUrl).filter(Boolean);
}

function sectionUrls(section = {}) {
  return [
    section.source_candidate_url,
    ...ensureArray(section.sources).map(source => source?.url)
  ].map(normalizeUrl).filter(Boolean);
}

function selectedCandidates(shortlistReport = {}) {
  const primary = ensureArray(shortlistReport.primary_selected_articles);
  if (primary.length > 0) return primary;
  const selected = ensureArray(shortlistReport.selected_articles);
  if (selected.length > 0) return selected;
  return ensureArray(shortlistReport.shortlisted_candidates).filter(candidate =>
    candidate.final_selected === true ||
    candidate.primary_selected === true ||
    candidate.selected_for_editor === true ||
    candidate.selected === true
  );
}

function allShortlistCandidates(shortlistReport = {}) {
  return [
    ...selectedCandidates(shortlistReport),
    ...ensureArray(shortlistReport.shortlisted_candidates),
    ...ensureArray(shortlistReport.reserve_candidates),
    ...ensureArray(shortlistReport.excluded_candidates),
    ...ensureArray(shortlistReport.demoted_candidates)
  ];
}

function candidateIndex(shortlistReport = {}) {
  const byUrl = new Map();
  const byTitle = new Map();
  for (const candidate of allShortlistCandidates(shortlistReport)) {
    for (const url of candidateUrls(candidate)) {
      if (!byUrl.has(url)) byUrl.set(url, candidate);
    }
    const title = text(candidate.title).toLowerCase();
    if (title && !byTitle.has(title)) byTitle.set(title, candidate);
  }
  return { byUrl, byTitle };
}

function matchCandidate(section = {}, index) {
  for (const url of sectionUrls(section)) {
    const candidate = index.byUrl.get(url);
    if (candidate) return candidate;
  }
  const title = text(section.headline || section.title).toLowerCase();
  return title ? index.byTitle.get(title) || null : null;
}

function qualityResultIndex(qualityReport = {}) {
  const byTitle = new Map();
  for (const result of ensureArray(qualityReport.article_results)) {
    const title = text(result.headline || result.title).toLowerCase();
    if (title && !byTitle.has(title)) byTitle.set(title, result);
  }
  return byTitle;
}

function matchQualityResult(section = {}, index) {
  const title = text(section.headline || section.title).toLowerCase();
  return title ? index.get(title) || null : null;
}

function buildArticlesForSignalReport({ editor_draft: editorDraft, shortlisted_candidates: shortlistReport, quality_report: qualityReport }) {
  const candidateByUrl = candidateIndex(shortlistReport);
  const qualityByTitle = qualityResultIndex(qualityReport);
  return ensureArray(editorDraft?.sections).map((section, index) => {
    const candidate = matchCandidate(section, candidateByUrl) || {};
    const qualityResult = matchQualityResult(section, qualityByTitle) || {};
    return {
      ...candidate,
      ...section,
      relevance_bucket: text(section.relevance_bucket) || text(candidate.relevance_bucket) || text(objectValue(qualityResult.scope_count).relevance_bucket),
      scope_count: objectValue(qualityResult.scope_count),
      quality_result_status: qualityResult.status || '',
      quality_hard_fail_reasons: ensureArray(qualityResult.hard_fail_reasons),
      quality_soft_deductions: ensureArray(qualityResult.soft_deductions),
      signal_report_index: index + 1
    };
  });
}

function buildHalSignalQualityReport(options = {}) {
  const date = text(options.date) || kstDate();
  const loaded = options.inputs || loadHalSignalQualityInputs(options.root || process.cwd(), date);
  const inputState = loaded.inputs || {};
  const missingRequired = ensureArray(inputState.missing_required);
  const articles = missingRequired.length > 0 ? [] : buildArticlesForSignalReport(loaded);
  const checks = buildMainArticleSignalChecks(articles);
  const summary = buildHalSignalQualitySummary(articles);
  const unavailableOptional = ensureArray(inputState.unavailable_optional);
  const hardBlockerCount = checks.filter(check =>
    ensureArray(check.hard_blocker_reason_codes).length > 0
  ).length;
  const qualityStatus = text(loaded.quality_report?.status) || 'UNKNOWN';
  const inputCompleteness = missingRequired.length > 0
    ? 'missing_required'
    : unavailableOptional.length > 0
      ? 'partial'
      : 'complete';
  const status = missingRequired.length > 0
    ? 'INPUT_INCOMPLETE'
    : hardBlockerCount > 0 || qualityStatus !== 'PASS'
      ? 'NEEDS_FIX'
      : unavailableOptional.length > 0
        ? 'WARN'
      : 'PASS';
  const shortageDetails = buildSelectionShortageHintDetails(
    loaded.shortlisted_candidates,
    loaded.source_effectiveness_report,
    loaded.evidence_pack_summary
  );
  const warnings = [
    ...missingRequired.map(name => `Required input unavailable: ${name}`),
    ...ensureArray(inputState.unavailable_optional).map(name => `Optional input_unavailable: ${name}`),
    ...checks.flatMap(check => check.hal_signal_capsule_complete === true
      ? []
      : [`HAL Signal Capsule incomplete for article ${check.index}: ${check.title}`])
  ];

  return {
    schema_version: HAL_SIGNAL_SCHEMA_VERSION,
    report_type: 'hal_signal_quality',
    date,
    generated_at: text(options.generatedAt) || new Date().toISOString(),
    status,
    input_completeness: inputCompleteness,
    input_statuses: flattenInputStatuses(inputState),
    inputs: inputState,
    quality_status: qualityStatus,
    hal_signal_quality_summary: summary,
    main_article_signal_checks: checks,
    selection_shortage_hint_details: shortageDetails,
    gate_boundary: {
      quality_validation_records_hal_signal_deductions: true,
      publish_gate_blocks_hal_signal_hard_blockers: true,
      review_artifacts_preserved: true,
      optional_input_unavailable_is_not_pass: true
    },
    close_criteria: {
      report_generated: true,
      main_article_capsule_validation: hardBlockerCount === 0,
      actionability_hard_blocker_reflected: checks.every(check => !ensureArray(check.hard_blockers).includes('actionability_none')),
      generic_fallback_soc_overpromotion_tests_required: true,
      source_expansion_followups: ['#55', '#57'],
      historical_rewrite_followup: '#108'
    },
    warnings
  };
}

function writeHalSignalQualityArtifacts(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const date = text(options.date) || kstDate();
  const inputs = options.inputs || loadHalSignalQualityInputs(root, date);
  const report = buildHalSignalQualityReport({ ...options, root, date, inputs });
  const outDir = newsroomDir(root, date);
  const jsonPath = path.join(outDir, 'hal-signal-quality-report.json');
  const markdownPath = path.join(outDir, 'hal-signal-quality-report.md');
  writeJson(jsonPath, report);
  fs.writeFileSync(markdownPath, renderHalSignalQualityMarkdown(report), 'utf8');
  return { report, jsonPath, markdownPath };
}

module.exports = {
  OPTIONAL_INPUTS,
  REQUIRED_INPUTS,
  buildArticlesForSignalReport,
  buildHalSignalQualityReport,
  loadHalSignalQualityInputs,
  writeHalSignalQualityArtifacts
};
