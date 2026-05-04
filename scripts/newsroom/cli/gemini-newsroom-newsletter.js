const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  kstDate,
  readJson,
  readTextIfExists,
  writeJson
} = require('../common/common');
const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  newsroomDir: artifactNewsroomDir,
  newsroomRelPath
} = require('../common/artifact-paths');
const { readRuntimeConfig } = require('../common/runtime-config');
const {
  buildCostReport,
  buildCostReportMarkdown,
  callGeminiJson,
  getGeminiDiagnostics,
  getGeminiCostCalls,
  getGeminiModelUsage
} = require('../generate/gemini-client');
const { reporterSchema, editorSchema, editorCompletionSchema, factCheckSchema } = require('../render/newsletter-schema');
const { isSafeExternalImageUrl } = require('../render/image-candidates');
const { resolveIssueArticleImages } = require('../render/article-image-resolver');
const {
  buildShortlistReport,
  normalizeUrl,
  reporterInputFromShortlist
} = require('../generate/newsroom-selection');
const {
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext
} = require('../generate/article-capsules');
const {
  annotateCandidatesWithCache,
  buildSummaryCacheReport,
  buildSummaryCacheReportMarkdown,
  writeCacheRecord
} = require('../generate/news-summary-cache');
const {
  isFinalSelected,
  normalizeReporterReport,
  normalizeShortlistReport,
  renderCandidateSelectionDiagnostics,
  selectionDiagnosticsFromReports
} = require('../generate/selection-diagnostics');
const {
  QUALITY_THRESHOLD,
  MIN_MAIN_ARTICLES,
  MAX_MAIN_ARTICLES,
  buildNewsletterQualityReport,
  buildQualityReportMarkdown,
  deductionMatchesSection,
  sectionHasSourceGap,
  sectionPassesArticleGate
} = require('../validate/newsletter-quality');
const {
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief,
  buildReleaseQaReport,
  ensureArray
} = require('../render/newsletter-renderer');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);
const dataPath = path.join(root, 'data', 'newsletters.json');
const sourceRegistryPath = path.join(root, 'data', 'news-sources.json');
const generationRunState = {
  date: '',
  retryHistory: [],
  currentQualityAttempt: 0,
  qualityReport: null,
  factCheck: null,
  shortlistReport: null,
  selectedInputs: []
};

function fail(message) {
  throw new Error(message);
}

function writeNewsletterDate(date) {
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'newsletter-date.txt'), date, 'utf8');
}

function writeGenerationStatus(value) {
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'newsletter-generation-status.json'),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

function writeCostReport(date) {
  const report = buildCostReport({
    date,
    calls: getGeminiCostCalls(),
    warnCostUsd: runtimeConfig.newsroomWarnCostUsd,
    maxCostUsd: runtimeConfig.newsroomMaxCostUsd
  });
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'newsroom-cost-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  const targetNewsroomDir = artifactNewsroomDir(root, date);
  if (fs.existsSync(targetNewsroomDir)) {
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'cost-report.md'),
      buildCostReportMarkdown(report),
      'utf8'
    );
  }

  for (const warning of ensureArray(report.warnings)) {
    console.warn(`[cost] ${warning}`);
  }
  console.log(`[cost] Estimated Gemini API cost: $${Number(report.totals.estimated_cost_usd || 0).toFixed(6)} USD across ${report.totals.request_count || 0} request(s).`);
  return report;
}

function writeSummaryCacheReport(date, diagnostics) {
  const report = buildSummaryCacheReport(date, diagnostics);
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'summary-cache-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  const targetNewsroomDir = artifactNewsroomDir(root, date);
  if (fs.existsSync(targetNewsroomDir)) {
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'summary-cache-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'summary-cache-report.md'),
      buildSummaryCacheReportMarkdown(report),
      'utf8'
    );
  }

  console.log(`[cache] Summary cache hits: ${report.totals.hit_count}/${report.totals.candidate_count}; misses: ${report.totals.miss_count}.`);
  return report;
}

function failureStageFromError(error) {
  if (error?.stage) return error.stage;
  const match = String(error?.message || '').match(/^\[([^\]]+)]/);
  return match ? match[1] : 'generation';
}

function buildGenerationStatus({
  date,
  status,
  failureStage = '',
  failureReason = '',
  retryHistory = [],
  qualityReport = null,
  factCheck = null,
  extra = {}
}) {
  const diagnostics = getGeminiDiagnostics();
  const mustFixCount = ensureArray(factCheck?.must_fix).length;
  return {
    date,
    status,
    failure_stage: failureStage,
    failure_reason: failureReason,
    fact_check_status: factCheck?.status || 'UNKNOWN',
    must_fix_count: mustFixCount,
    quality_status: qualityReport?.status || 'UNKNOWN',
    quality_attempt_count: retryHistory.length,
    quality_score: qualityReport?.score ?? null,
    quality_threshold: qualityReport?.threshold ?? QUALITY_THRESHOLD,
    quality_deduction_count: ensureArray(qualityReport?.deductions).length,
    quota_error_count: diagnostics.quota_error_count,
    invalid_json_count: diagnostics.invalid_json_count,
    model_usage: diagnostics.model_usage,
    ...extra
  };
}

function selectionStatusExtra(shortlistReport = generationRunState.shortlistReport) {
  const report = shortlistReport || {};
  const diagnostics = selectionDiagnosticsFromReports(report, null);
  return {
    input_candidate_count: report.input_candidate_count ?? null,
    eligible_candidate_count: report.eligible_candidate_count ?? null,
    selected_article_count: report.selected_article_count ?? null,
    reporter_candidate_count: diagnostics.reporter_candidate_count,
    reporter_selected_count: diagnostics.reporter_selected_count,
    final_input_candidate_count: diagnostics.final_input_candidate_count,
    final_eligible_candidate_count: diagnostics.final_eligible_candidate_count,
    final_selected_article_count: diagnostics.final_selected_article_count,
    reporter_selected_but_final_excluded_count: diagnostics.reporter_selected_but_final_excluded_count,
    ai_selected_article_count: report.ai_selected_article_count ?? null,
    underfilled: Boolean(report.underfilled),
    publish_ready: report.publish_ready !== undefined ? Boolean(report.publish_ready) : null,
    selection_warnings: ensureArray(report.selection_warnings),
    selection_errors: ensureArray(report.selection_errors),
    exclusion_reason_summary: ensureArray(report.exclusion_reason_summary).slice(0, 10),
    final_exclusion_reason_summary: ensureArray(diagnostics.final_exclusion_reason_summary).slice(0, 10),
    candidate_selection_note: diagnostics.note
  };
}

function numberOrDefault(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function stringOrEmpty(value) {
  return String(value || '').trim();
}

function booleanFromCandidate(collected, candidate, field, fallback = false) {
  if (typeof collected[field] === 'boolean') return collected[field];
  if (typeof candidate[field] === 'boolean') return candidate[field];
  return fallback;
}

function imageCandidatesForReporterCandidate(candidate, collectedByUrl) {
  const collected = collectedByUrl.get(candidate.url) || collectedByUrl.get(candidate.article_url) || {};
  const images = ensureArray(candidate.imageCandidates).length > 0
    ? ensureArray(candidate.imageCandidates)
    : ensureArray(collected.imageCandidates);
  return images.filter(image => image && image.url && isSafeExternalImageUrl(image.url));
}

function collectedCandidateFor(candidate, collectedByUrl) {
  return collectedByUrl.get(candidate.url) ||
    collectedByUrl.get(candidate.article_url) ||
    collectedByUrl.get(candidate.articleUrl) ||
    {};
}

function reporterCandidateRejectionReason(candidate) {
  const halActionability =
    Number(candidate.camera_hal_relevance_score || 0) +
    Number(candidate.android_camera_relevance_score || 0) +
    Number(candidate.practical_actionability_score || 0);
  if (!['main', 'short'].includes(candidate.finalSelectionEligibility)) {
    return `finalSelectionEligibility=${candidate.finalSelectionEligibility || 'unknown'}`;
  }
  if (candidate.isWatchPage === true && candidate.hasDatedEvidence !== true) {
    return 'watch page without dated evidence';
  }
  if (candidate.main_eligible === false) return 'main_eligible=false';
  if (candidate.source_gap_risk === true) return 'source_gap_risk=true';
  if (Number(candidate.evidence_score || 0) < 6) return `evidence_score=${Number(candidate.evidence_score || 0)} < 6`;
  if (halActionability < 8) return `HAL/actionability score ${halActionability} < 8`;
  return '';
}

function reporterCandidateMainArticleBlockReason(candidate) {
  const reason = reporterCandidateRejectionReason(candidate);
  if (reason) return reason;
  if (!isFinalSelected(candidate)) return 'final_selected=false';
  return '';
}

function validateReporter(value, date, collectedCandidates = []) {
  const collectedByUrl = new Map();
  for (const candidate of ensureArray(collectedCandidates)) {
    if (candidate.url) collectedByUrl.set(candidate.url, candidate);
    if (candidate.article_url) collectedByUrl.set(candidate.article_url, candidate);
    if (candidate.articleUrl) collectedByUrl.set(candidate.articleUrl, candidate);
  }

  if (value.date !== date) value.date = date;
  if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
    fail('Reporter output must contain at least one candidate.');
  }
  const rejectedMainIneligible = [];
  for (const candidate of value.candidates) {
    if (!candidate.title || !candidate.url || !candidate.source) {
      fail('Reporter candidate is missing title, source, or url.');
    }
    const collected = collectedCandidateFor(candidate, collectedByUrl);
    candidate.camera_hal_relevance_score = numberOrDefault(candidate.camera_hal_relevance_score);
    candidate.android_camera_relevance_score = numberOrDefault(candidate.android_camera_relevance_score);
    candidate.practical_actionability_score = numberOrDefault(candidate.practical_actionability_score);
    candidate.source_reliability_score = numberOrDefault(candidate.source_reliability_score);
    candidate.freshness_score = numberOrDefault(candidate.freshness_score);
    candidate.ai_required_slot_fit_score = numberOrDefault(candidate.ai_required_slot_fit_score);
    candidate.cpp_fallback_value_score = numberOrDefault(candidate.cpp_fallback_value_score);
    candidate.version_or_release = stringOrEmpty(candidate.version_or_release || collected.version_or_release);
    candidate.api_or_component = stringOrEmpty(candidate.api_or_component || collected.api_or_component);
    candidate.behavior_change = stringOrEmpty(candidate.behavior_change || collected.behavior_change);
    candidate.collectionMode = stringOrEmpty(collected.collectionMode || collected.collection_mode || candidate.collectionMode);
    candidate.isArticleCandidate = booleanFromCandidate(collected, candidate, 'isArticleCandidate',
      Boolean(collected.is_article_candidate));
    candidate.isWatchPage = booleanFromCandidate(collected, candidate, 'isWatchPage',
      Boolean(collected.is_watch_page));
    candidate.hasDatedEvidence = booleanFromCandidate(collected, candidate, 'hasDatedEvidence',
      Boolean(collected.has_dated_evidence));
    candidate.evidenceLevel = stringOrEmpty(collected.evidenceLevel || collected.evidence_level || candidate.evidenceLevel);
    candidate.finalSelectionEligibility = stringOrEmpty(
      collected.finalSelectionEligibility ||
      collected.final_selection_eligibility ||
      candidate.finalSelectionEligibility
    );
    candidate.source_kind = stringOrEmpty(collected.source_kind || candidate.source_kind);
    candidate.source_gap_risk = typeof collected.source_gap_risk === 'boolean'
      ? collected.source_gap_risk
      : Boolean(candidate.source_gap_risk);
    candidate.main_eligible = typeof collected.main_eligible === 'boolean'
      ? collected.main_eligible
      : Boolean(candidate.main_eligible);
    candidate.briefing_only = typeof collected.briefing_only === 'boolean'
      ? collected.briefing_only
      : Boolean(candidate.briefing_only);
    candidate.reference_only = typeof collected.reference_only === 'boolean'
      ? collected.reference_only
      : Boolean(candidate.reference_only);
    candidate.evidence_score = numberOrDefault(collected.evidence_score ?? candidate.evidence_score);
    candidate.evidence_notes = ensureArray(candidate.evidence_notes);
    candidate.cross_check_status = stringOrEmpty(candidate.cross_check_status || 'not-required');
    candidate.imageCandidates = imageCandidatesForReporterCandidate(candidate, collectedByUrl);
    if (typeof candidate.selected !== 'boolean') {
      const total =
        candidate.camera_hal_relevance_score +
        candidate.android_camera_relevance_score +
        candidate.practical_actionability_score +
        candidate.source_reliability_score +
        candidate.freshness_score +
        candidate.ai_required_slot_fit_score +
        candidate.cpp_fallback_value_score;
      candidate.selected = total >= 12;
    }
    const rejectionReason = reporterCandidateRejectionReason(candidate);
    if (candidate.selected && rejectionReason) {
      candidate.selected = false;
      rejectedMainIneligible.push({
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        reason: rejectionReason
      });
    }
  }
  value.rejected_main_ineligible_candidates = rejectedMainIneligible;
  return value;
}

function enforceDeterministicReporterSelection(reporter, shortlistReport) {
  const finalByUrl = new Map([
    ...ensureArray(shortlistReport?.shortlisted_candidates),
    ...ensureArray(shortlistReport?.excluded_candidates)
  ].map(candidate => [normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl), candidate]));

  reporter.candidates = ensureArray(reporter.candidates).map(candidate => {
    const url = normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl);
    const deterministic = finalByUrl.get(url) || {};
    return {
      ...deterministic,
      ...candidate,
      deterministic_score: deterministic.deterministic_score ?? candidate.deterministic_score,
      score_breakdown: deterministic.score_breakdown || candidate.score_breakdown,
      selection_slot: isFinalSelected(deterministic) ? deterministic.selection_slot || candidate.selection_slot || 'deterministic-final' : ''
    };
  });
  return normalizeReporterReport(reporter, shortlistReport);
}

function selectedReporterCapsules(date, reporter, capsuleReport) {
  return capsuleInputForCandidates(date, ensureArray(reporter.candidates).filter(isFinalSelected), capsuleReport);
}

function reporterCandidateCapsules(date, candidates, capsuleReport) {
  return capsuleInputForCandidates(date, candidates, capsuleReport);
}

function reporterImageCandidatesForSection(section, reporter) {
  const sourceUrls = new Set(ensureArray(section.sources).map(source => source && source.url).filter(Boolean));
  const matching = ensureArray(reporter.candidates)
    .filter(candidate => sourceUrls.has(candidate.url))
    .flatMap(candidate => ensureArray(candidate.imageCandidates));
  const fallback = ensureArray(reporter.candidates).flatMap(candidate => ensureArray(candidate.imageCandidates));
  const seen = new Set();
  const images = (matching.length > 0 ? matching : fallback)
    .filter(image => image && image.url && isSafeExternalImageUrl(image.url))
    .filter(image => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
  return images.slice(0, 6);
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function firstHttpsUrl(...values) {
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (isHttpsUrl(trimmed)) return trimmed;
  }
  return '';
}

const fallbackCategories = ['AOSP Camera Watch', 'Android Camera / AI Watch', 'C++ / AI Practical Tip'];

function normalizeSectionImageFields(section, reporter) {
  const sectionImages = ensureArray(section.imageCandidates).filter(image => image && image.url && isSafeExternalImageUrl(image.url));
  const imageCandidates = sectionImages.length > 0 ? sectionImages : reporterImageCandidatesForSection(section, reporter);
  const allowed = new Set(imageCandidates.map(image => image.url));
  const requestedImage = allowed.has(section.selectedImage) ? section.selectedImage : '';
  const selected = imageCandidates.find(image => image.url === requestedImage);

  if (requestedImage) {
    const imageSource = firstHttpsUrl(
      section.imageSource,
      selected?.articleUrl,
      selected?.sourceUrl,
      ensureArray(section.sources)[0]?.url
    );
    const imageAttribution = String(section.imageAttribution || selected?.attribution || ensureArray(section.sources)[0]?.title || '').trim();
    const imageAlt = String(section.imageAlt || selected?.alt || section.headline || 'Article image').trim();
    const imageLicenseStatus = String(section.imageLicenseStatus || selected?.licenseStatus || 'unknown').trim();

    if (imageSource && imageAttribution && imageAlt && imageLicenseStatus) {
      return {
        imageCandidates,
        selectedImage: requestedImage,
        imageSource,
        imageAttribution,
        imageAlt,
        imageLicenseStatus,
        imageUsageDecisionReason: section.imageUsageDecisionReason || 'Editor-selected image with HTTPS source attribution.'
      };
    }
  }

  return {
    imageCandidates,
    selectedImage: '',
    imageSource: '',
    imageAttribution: '',
    imageAlt: '',
    imageLicenseStatus: 'none',
    imageUsageDecisionReason: section.imageUsageDecisionReason ||
      'No suitable image with complete HTTPS attribution metadata selected; local fallback visual will be used.'
  };
}

function normalizeEditorSection(section, index, reporter) {
  const actionItems = ensureArray(section.action_items);
  const actionHints = ensureArray(section.action_hints);
  const normalized = {
    ...section,
    category: section.category || fallbackCategories[index] || `Main Article ${index + 1}`,
    confirmed_facts: ensureArray(section.confirmed_facts).length > 0
      ? ensureArray(section.confirmed_facts)
      : [section.what_changed].filter(Boolean),
    evidence_summary: stringOrEmpty(section.evidence_summary),
    specificity_checks: ensureArray(section.specificity_checks),
    source_verification_notes: ensureArray(section.source_verification_notes),
    camera_hal_perspective: section.camera_hal_perspective || section.why_it_matters || '',
    action_items: actionItems.length > 0 ? actionItems : actionHints,
    action_hints: actionHints.length > 0 ? actionHints : actionItems,
    team_summary: section.team_summary || section.why_it_matters || '',
    is_ai_related: Boolean(section.is_ai_related),
    article_type: section.article_type || (section.is_ai_related ? 'ai' : 'camera-hal'),
    sources: ensureArray(section.sources).filter(source => source && source.url)
  };
  return {
    ...normalized,
    ...normalizeSectionImageFields(normalized, reporter)
  };
}

function validateEditor(value, date, reporter = { candidates: [] }) {
  if (value.date !== date) value.date = date;
  value.title = value.title || `Camera HAL SW 뉴스레터 - ${date}`;
  if (!value.title.includes(date)) value.title = `Camera HAL SW 뉴스레터 - ${date}`;
  if (!value.summary) fail('Editor output is missing summary.');
  if (!Array.isArray(value.briefing) || value.briefing.length !== 3) {
    fail('Editor output must contain exactly 3 briefing items.');
  }
  if (!Array.isArray(value.sections) || value.sections.length < 3) {
    fail('Editor output must contain at least 3 sections.');
  }

  value.sections = value.sections.map((section, index) => normalizeEditorSection(section, index, reporter));

  const emptySourceSections = value.sections
    .filter(section => section.sources.length === 0)
    .map(section => section.category);
  if (emptySourceSections.length > 0) {
    fail(`Editor output has sections without sources: ${emptySourceSections.join(', ')}`);
  }

  const refs = new Map();
  for (const section of value.sections) {
    for (const source of section.sources) {
      refs.set(source.url, { title: source.title || source.url, url: source.url });
    }
  }
  for (const source of ensureArray(value.references)) {
    if (source && source.url) refs.set(source.url, { title: source.title || source.url, url: source.url });
  }
  value.references = [...refs.values()];
  if (value.references.length === 0) fail('Editor output must contain references.');
  return value;
}

function validateFactCheck(value) {
  if (!['PASS', 'NEEDS_FIX'].includes(value.status)) {
    value.status = ensureArray(value.must_fix).length > 0 ? 'NEEDS_FIX' : 'PASS';
  }
  value.must_fix = ensureArray(value.must_fix);
  value.recommended_fixes = ensureArray(value.recommended_fixes);
  value.source_gaps = ensureArray(value.source_gaps);
  value.source_gap_count = numberOrDefault(value.source_gap_count, value.source_gaps.length);
  value.final_comment = value.final_comment || '';
  return value;
}

function containsTodo(files) {
  return files.some(file => fs.existsSync(file) && /\bTODO\b/.test(fs.readFileSync(file, 'utf8')));
}

function updateNewsletterData(date, issue) {
  const entry = {
    date,
    title: issue.title,
    summary: issue.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL', 'Android', 'C++', 'AI']
  };

  const newsletters = fs.existsSync(dataPath) ? readJson(dataPath) : [];
  const updated = newsletters
    .filter(item => item.date !== date)
    .concat(entry)
    .sort((a, b) => b.date.localeCompare(a.date));
  writeJson(dataPath, updated);
}

function runValidate() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const siteOutput = execFileSync(npmCommand, ['run', 'validate:site'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const imageOutput = execFileSync(npmCommand, ['run', 'validate:images'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const output = [siteOutput, imageOutput].join('\n').trim();
    return { ok: true, text: output || 'npm run validate:site and validate:images passed.' };
  } catch (error) {
    return {
      ok: false,
      text: [error.stdout, error.stderr].filter(Boolean).join('\n').trim() || error.message
    };
  }
}

function warnResolvedImageFallbacks(issue) {
  for (const section of ensureArray(issue.sections)) {
    const resolved = section.resolvedImage || {};
    if (!resolved.usedFallback) continue;
    console.warn([
      'Warning: article image fallback applied',
      `  section: ${section.category || 'unknown section'}`,
      `  article: ${section.headline || 'unknown article'}`,
      `  original: ${resolved.originalUrl || resolved.originalSrc || section.originalImage || 'n/a'}`,
      `  fallback: ${resolved.url || resolved.src}`,
      `  reason: ${resolved.reason || 'unknown'}`
    ].join('\n'));
  }
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const left = new Set(normalizeTitle(a).split(' ').filter(token => token.length > 1));
  const right = new Set(normalizeTitle(b).split(' ').filter(token => token.length > 1));
  if (left.size === 0 || right.size === 0) return 0;
  const overlap = [...left].filter(token => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function sourceDateTitle(section) {
  const firstSource = ensureArray(section.sources)[0] || {};
  return {
    source: normalizeTitle(firstSource.title || section.source),
    publishedDate: String(section.published_date || section.publishedDate || '').trim(),
    title: section.headline || firstSource.title || ''
  };
}

function sectionUrls(section) {
  return ensureArray(section.sources).map(source => source && source.url).filter(Boolean);
}

function urlKeys(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const keys = new Set([raw]);
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    const normalized = parsed.toString().replace(/\/$/, '');
    keys.add(normalized);
    keys.add(normalized.toLowerCase());
  } catch {
    keys.add(raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase());
  }
  return [...keys].filter(Boolean);
}

function reporterCandidateUrlMap(reporter) {
  const map = new Map();
  function add(key, candidate) {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, candidate);
      return;
    }
    if (map.get(key) !== candidate) {
      map.set(key, null);
    }
  }

  for (const candidate of ensureArray(reporter.candidates)) {
    for (const value of [candidate.url, candidate.article_url, candidate.articleUrl]) {
      for (const key of urlKeys(value)) add(key, candidate);
    }
  }
  return map;
}

function candidateForSourceUrl(sourceUrl, candidateMap) {
  for (const key of urlKeys(sourceUrl)) {
    const candidate = candidateMap.get(key);
    if (candidate) return candidate;
  }
  return null;
}

function sectionsAreDuplicate(left, right) {
  const leftUrls = new Set(sectionUrls(left));
  if (sectionUrls(right).some(url => leftUrls.has(url))) return true;
  if (normalizeTitle(left.headline) && normalizeTitle(left.headline) === normalizeTitle(right.headline)) return true;
  if (titleSimilarity(left.headline, right.headline) >= 0.82) return true;
  const leftKey = sourceDateTitle(left);
  const rightKey = sourceDateTitle(right);
  return leftKey.source &&
    leftKey.source === rightKey.source &&
    leftKey.publishedDate &&
    leftKey.publishedDate === rightKey.publishedDate &&
    titleSimilarity(leftKey.title, rightKey.title) >= 0.68;
}

function candidateDuplicatesSections(candidate, sections) {
  const candidateSection = {
    headline: candidate.title,
    published_date: candidate.published_date,
    sources: [{ title: candidate.source, url: candidate.url }]
  };
  return sections.some(section => sectionsAreDuplicate(candidateSection, section));
}

function removeDisallowedSelections(reporter, lockedSections, excludedSections = []) {
  const rejected = [];
  for (const candidate of ensureArray(reporter.candidates)) {
    if (!isFinalSelected(candidate)) continue;
    if (candidateDuplicatesSections(candidate, lockedSections)) {
      candidate.final_selected = false;
      candidate.selected_for_editor = false;
      rejected.push({ title: candidate.title, reason: 'duplicate locked article' });
      continue;
    }
    if (candidateDuplicatesSections(candidate, excludedSections)) {
      candidate.final_selected = false;
      candidate.selected_for_editor = false;
      rejected.push({ title: candidate.title, reason: 'excluded source-gap or demoted article' });
    }
  }
  return rejected;
}

function mergeLockedSections(lockedSections, generatedSections, excludedSections = []) {
  const merged = [];
  const rejected = [];
  for (const section of lockedSections) {
    if (merged.length >= MAX_MAIN_ARTICLES) break;
    merged.push(section);
  }
  for (const section of generatedSections) {
    if (merged.length >= MAX_MAIN_ARTICLES) break;
    if (merged.some(existing => sectionsAreDuplicate(existing, section))) {
      rejected.push({ title: section.headline || section.category || 'untitled article', reason: 'duplicate locked article' });
      continue;
    }
    if (excludedSections.some(existing => sectionsAreDuplicate(existing, section))) {
      rejected.push({ title: section.headline || section.category || 'untitled article', reason: 'excluded source-gap or demoted article' });
      continue;
    }
    merged.push(section);
  }
  return { sections: merged, rejected };
}

function sectionSummary(section, index) {
  return {
    index: index + 1,
    headline: section.headline,
    category: section.category,
    urls: sectionUrls(section),
    source_titles: ensureArray(section.sources).map(source => source.title).filter(Boolean)
  };
}

function sectionLockRecord(section, index, status = 'PASS', reason = '') {
  return {
    ...sectionSummary(section, index),
    status,
    reason,
    locked: status === 'PASS'
  };
}

function buildLockedArticleContext(lockedSections, excludedSections = []) {
  if (lockedSections.length === 0 && excludedSections.length === 0) return '';
  const lockedSummary = lockedSections.map((section, index) => ({
    ...sectionSummary(section, index)
  }));
  const excludedSummary = excludedSections.map((section, index) => sectionSummary(section, index));
  return [
    lockedSections.length > 0 ? 'Passed articles locked from previous quality attempts:' : '',
    lockedSections.length > 0 ? JSON.stringify(lockedSummary, null, 2) : '',
    lockedSections.length > 0 ? 'Keep these passed articles unchanged. Do not rewrite them except for formatting consistency.' : '',
    excludedSections.length > 0 ? 'Excluded source-gap/demoted articles from previous attempts:' : '',
    excludedSections.length > 0 ? JSON.stringify(excludedSummary, null, 2) : '',
    excludedSections.length > 0 ? 'Do not select candidates or generate articles that duplicate these excluded URLs, titles, source names, or same source + published_date + similar title.' : '',
    'Generate only missing replacement articles. Avoid duplicate URLs, duplicate or near-identical headlines, and same source + same published_date + similar title.'
  ].filter(Boolean).join('\n');
}

function lockedArticleHeadlines(lockedSections) {
  return lockedSections.map(section => section.headline || section.category || 'untitled article');
}

function issueLevelLockBlockers(qualityReport) {
  return ensureArray(qualityReport?.deductions).filter(deduction => {
    if (stringOrEmpty(deduction.location)) return false;
    if (deduction.category === 'composition') {
      return /main articles|No AI article/i.test(deduction.reason);
    }
    if (deduction.category === 'hal-relevance') {
      return /No AI|Expected at least|weak HAL|Camera HAL \/ Android Camera/i.test(deduction.reason);
    }
    return false;
  });
}

function selectLockedArticles(editor, qualityReport, factCheck) {
  const blockers = issueLevelLockBlockers(qualityReport);
  if (blockers.length > 0) {
    return { articles: [], blockers };
  }
  return {
    articles: ensureArray(editor.sections)
      .filter(section => sectionPassesArticleGate(section, qualityReport, factCheck))
      .slice(0, MAX_MAIN_ARTICLES),
    blockers
  };
}

function appendUniqueLockedArticles(currentLocked, candidates) {
  const locked = [...currentLocked];
  for (const section of candidates) {
    if (locked.length >= MAX_MAIN_ARTICLES) break;
    if (!locked.some(existing => sectionsAreDuplicate(existing, section))) {
      locked.push(section);
    }
  }
  return locked;
}

function appendUniqueSections(currentSections, candidates) {
  const sections = [...currentSections];
  for (const section of candidates) {
    if (!sections.some(existing => sectionsAreDuplicate(existing, section))) {
      sections.push(section);
    }
  }
  return sections;
}

function sectionLabel(section) {
  return section.headline || section.category || 'untitled article';
}

function sourceGapSections(editor, factCheck) {
  return ensureArray(editor.sections).filter(section => sectionHasSourceGap(section, factCheck));
}

function reporterEligibilityFindings(editor, reporter, lockedSections = []) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const findings = [];
  for (const section of ensureArray(editor.sections)) {
    if (lockedSections.some(locked => sectionsAreDuplicate(section, locked))) continue;
    for (const source of ensureArray(section.sources)) {
      const candidate = candidateForSourceUrl(source?.url, candidateMap);
      if (!candidate) continue;
      const reason = reporterCandidateMainArticleBlockReason(candidate);
      if (!reason) continue;
      findings.push({
        section,
        headline: sectionLabel(section),
        source_title: source.title || candidate.source || candidate.title || 'unknown source',
        source_url: source.url,
        candidate_title: candidate.title,
        candidate_url: candidate.url,
        reason
      });
    }
  }
  return findings;
}

function eligibilitySourceGapMessage(finding) {
  return [
    'Reporter eligibility violation',
    `section="${finding.headline}"`,
    `source="${finding.source_title}"`,
    `url=${finding.source_url || finding.candidate_url || 'unknown'}`,
    `candidate="${finding.candidate_title || 'unknown'}"`,
    `reason=${finding.reason}`,
    'action=replace-or-demote'
  ].join('; ');
}

function applyReporterEligibilityFindingsToFactCheck(factCheck, findings) {
  if (findings.length === 0) return factCheck;
  const sourceGaps = [...ensureArray(factCheck.source_gaps)];
  const seen = new Set(sourceGaps);
  for (const finding of findings) {
    const message = eligibilitySourceGapMessage(finding);
    if (!seen.has(message)) {
      seen.add(message);
      sourceGaps.push(message);
    }
  }
  return {
    ...factCheck,
    status: 'NEEDS_FIX',
    source_gaps: sourceGaps,
    source_gap_count: sourceGaps.length,
    final_comment: [
      factCheck.final_comment,
      'Reporter eligibility violations were added as source gaps and require replacement or demotion.'
    ].filter(Boolean).join(' ')
  };
}

function finalArticleSlotDistribution(sections) {
  const distribution = {
    android_camera_platform_api: 0,
    camerax_aosp_camera_compatibility: 0,
    linux_camera_libcamera_v4l2: 0,
    ai_camera_path_hal_workflow: 0,
    cpp_toolchain_fallback: 0,
    other: 0
  };
  for (const section of ensureArray(sections)) {
    const body = [
      section.category,
      section.headline,
      section.evidence_summary,
      section.camera_hal_perspective,
      section.article_type,
      ensureArray(section.sources).map(source => `${source.title} ${source.url}`).join(' ')
    ].join(' ');
    if (/AI|agent|LLM|NPU|GPU|on-device|inference|model/i.test(body) &&
      /camera|HAL|stream|buffer|ImageAnalysis|workflow|latency|thermal|power/i.test(body)) {
      distribution.ai_camera_path_hal_workflow += 1;
    } else if (/libcamera|V4L2|Linux camera|media controller/i.test(body)) {
      distribution.linux_camera_libcamera_v4l2 += 1;
    } else if (/CameraX|AOSP Camera|CDD|CTS|VTS|Camera ITS|compatibility/i.test(body)) {
      distribution.camerax_aosp_camera_compatibility += 1;
    } else if (/Android Camera|Camera2|platform API|Camera HAL|request|result|metadata|stream|buffer/i.test(body)) {
      distribution.android_camera_platform_api += 1;
    } else if (/C\+\+|LLVM|Clang|NDK|toolchain/i.test(body)) {
      distribution.cpp_toolchain_fallback += 1;
    } else {
      distribution.other += 1;
    }
  }
  return distribution;
}

function deductionRepairPolicy(deduction = {}) {
  const category = stringOrEmpty(deduction.category);
  const reason = stringOrEmpty(deduction.reason);
  const haystack = `${category} ${reason}`;
  if (/source gap|source_gap|watchlist|watch page|ineligible|main_eligible=false|missing dated evidence|no dated release/i.test(haystack)) {
    return {
      failure_type: 'source-gap',
      action: 'replace-or-demote',
      allow_rewrite: false,
      reason: 'source gap or ineligible source must be demoted or replaced'
    };
  }
  if (/duplicate|source URL is used across main sections/i.test(haystack)) {
    return {
      failure_type: 'duplicate',
      action: 'replace-section',
      allow_rewrite: false,
      reason: 'duplicate source or article must be replaced'
    };
  }
  if (/hal-depth|hal-relevance|weak HAL|Camera HAL perspective|engineering depth/i.test(haystack)) {
    return {
      failure_type: 'weak-hal-relevance',
      action: 'replace-section',
      allow_rewrite: false,
      reason: 'weak HAL relevance should use a stronger candidate'
    };
  }
  if (/actionability|action item/i.test(haystack)) {
    return {
      failure_type: 'missing-actionability',
      action: 'repair-section',
      allow_rewrite: true,
      reason: 'same-source actionability repair is allowed once'
    };
  }
  if (/required-fields|evidence-specificity/i.test(haystack)) {
    return {
      failure_type: category || 'evidence',
      action: 'repair-section',
      allow_rewrite: true,
      reason: 'same-source evidence or required-field repair is allowed once'
    };
  }
  return {
    failure_type: category || 'unknown',
    action: 'repair-section',
    allow_rewrite: true,
    reason: 'section-scoped repair is allowed'
  };
}

function mergeRepairPolicies(policies) {
  const priority = ['replace-or-demote', 'replace-section', 'repair-section'];
  const items = ensureArray(policies);
  return items.sort((a, b) => priority.indexOf(a.action) - priority.indexOf(b.action))[0] || null;
}

function recommendedFixMentionsSection(item, section) {
  const haystack = normalizeTitle(item);
  const labels = [
    section.headline,
    section.category,
    ...ensureArray(section.sources).flatMap(source => [source.title, source.url])
  ].map(normalizeTitle).filter(Boolean);
  return labels.some(label => haystack.includes(label) || label.includes(haystack));
}

function buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings = [], options = {}) {
  const maxSectionRepairs = Number.isInteger(options.maxSectionRepairs) ? options.maxSectionRepairs : Infinity;
  const sectionPlans = ensureArray(editor.sections).map(section => {
    const deductions = ensureArray(qualityReport?.deductions)
      .filter(deduction => deductionMatchesSection(deduction, section));
    const recommendedFixes = ensureArray(factCheck?.recommended_fixes)
      .filter(item => recommendedFixMentionsSection(item, section));
    const sectionEligibilityFindings = eligibilityFindings.filter(finding => finding.section === section);
    const hasSourceGap = sectionHasSourceGap(section, factCheck);
    const hasReporterEligibilityBlock = sectionEligibilityFindings.length > 0;
    const policies = [
      ...deductions.map(deductionRepairPolicy),
      ...recommendedFixes.map(item => deductionRepairPolicy({ category: 'recommended-fix', reason: item }))
    ];
    if (hasSourceGap || hasReporterEligibilityBlock) {
      policies.push({
        failure_type: 'source-gap',
        action: 'replace-or-demote',
        allow_rewrite: false,
        reason: 'source gap or reporter eligibility violation must be demoted or replaced'
      });
    }
    const policy = mergeRepairPolicies(policies);
    const action = policy ? policy.action : 'preserve';
    return {
      headline: sectionLabel(section),
      sources: sectionUrls(section),
      action,
      failure_type: policy?.failure_type || '',
      allow_rewrite: policy?.allow_rewrite !== false,
      policy_reason: policy?.reason || '',
      source_gap: hasSourceGap,
      reporter_eligibility_violations: sectionEligibilityFindings.map(finding => ({
        source_title: finding.source_title,
        source_url: finding.source_url,
        candidate_title: finding.candidate_title,
        reason: finding.reason
      })),
      deductions: deductions.map(deduction => ({
        category: deduction.category,
        points: deduction.points,
        reason: deduction.reason,
        location: deduction.location || ''
      })),
      recommended_fixes: recommendedFixes
    };
  }).filter(item => item.action !== 'preserve');
  const priority = { 'replace-or-demote': 0, 'replace-section': 1, 'repair-section': 2 };
  return sectionPlans
    .sort((a, b) => (priority[a.action] ?? 9) - (priority[b.action] ?? 9))
    .slice(0, maxSectionRepairs);
}

function buildFullSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings = []) {
  return buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings, {
    maxSectionRepairs: Infinity
  });
}

function sectionMatchesRepairItem(section, item) {
  if (!section || !item) return false;
  if (sectionLabel(section) === item.headline) return true;
  const urls = new Set(sectionUrls(section));
  return ensureArray(item.sources).some(url => urls.has(url));
}

function sectionsMatchingRepairPlan(sections, repairPlan) {
  return ensureArray(sections).filter(section =>
    ensureArray(repairPlan).some(item => sectionMatchesRepairItem(section, item))
  );
}

function sectionsOutsideRepairPlan(sections, repairPlan) {
  return ensureArray(sections).filter(section =>
    !ensureArray(repairPlan).some(item => sectionMatchesRepairItem(section, item))
  );
}

function hasTooFewMainArticlesDeduction(qualityReport) {
  return ensureArray(qualityReport?.deductions).some(deduction =>
    deduction?.category === 'composition' &&
    /main articles/i.test(String(deduction.reason || '')) &&
    Number(qualityReport?.metrics?.article_count || 0) < MIN_MAIN_ARTICLES
  );
}

function availableCompletionCandidates(reporter, currentSections, excludedSections = []) {
  return ensureArray(reporter?.candidates).filter(candidate => {
    if (!isFinalSelected(candidate)) return false;
    if (reporterCandidateRejectionReason(candidate)) return false;
    if (candidateDuplicatesSections(candidate, currentSections)) return false;
    if (candidateDuplicatesSections(candidate, excludedSections)) return false;
    return true;
  });
}

function buildCompletionExclusionContext(lockedSections, duplicateSections, sourceGapOrIneligibleSections) {
  const context = {
    locked_sections: lockedSections.map((section, index) => sectionSummary(section, index)),
    duplicate_or_rejected_sections: duplicateSections.map((section, index) => sectionSummary(section, index)),
    source_gap_or_ineligible_sections: sourceGapOrIneligibleSections.map((section, index) => sectionSummary(section, index))
  };
  return JSON.stringify(context, null, 2);
}

function validateCompletionSections(value, date, reporter) {
  const sections = ensureArray(value?.sections);
  if (sections.length === 0) fail('Editor completion output must contain at least one section.');
  const normalizedSections = sections.map((section, index) => normalizeEditorSection(section, index, reporter));
  const emptySourceSections = normalizedSections
    .filter(section => section.sources.length === 0)
    .map(section => section.category);
  if (emptySourceSections.length > 0) {
    fail(`Editor completion output has sections without sources: ${emptySourceSections.join(', ')}`);
  }
  return normalizedSections;
}

function buildRetryHistoryMarkdown(date, attempts, selectionDiagnostics = null) {
  const rows = attempts.map(item => [
    item.attempt,
    item.model || 'default',
    `${item.score}/${item.threshold}`,
    item.status,
    ensureArray(item.locked_sections).length,
    ensureArray(item.rejected_duplicate_headlines).length,
    item.source_gap_count,
    item.must_fix_count
  ]);
  return `# 뉴스레터 재시도 기록 - ${date}

| 시도 | 모델 | 점수 | 상태 | Locked | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}

${selectionDiagnostics ? renderCandidateSelectionDiagnostics(selectionDiagnostics) : ''}

${attempts.map(item => `## 시도 ${item.attempt}

- 선택 기사: ${item.selected_article_headlines.join('; ') || '없음'}
- Lock된 기사: ${item.locked_article_headlines.join('; ') || '없음'}
- Source gap section: ${ensureArray(item.source_gap_sections).join('; ') || '없음'}
- Demoted section: ${ensureArray(item.demoted_sections).join('; ') || '없음'}
- Replaced section: ${ensureArray(item.replaced_sections).join('; ') || '없음'}
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
    `- AI selected input: ${selectionDiagnostics.ai_selected_article_count ?? 'unknown'}`,
    `- Publish ready: ${selectionDiagnostics.publish_ready ?? 'unknown'}`,
    `- Underfilled: ${selectionDiagnostics.underfilled}`,
    `- Selection warning: ${selectionDiagnostics.selection_warnings.join('; ') || '없음'}`,
    `- Selection error: ${selectionDiagnostics.selection_errors.join('; ') || '없음'}`,
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

async function main() {
  const date = runtimeConfig.newsletterDate || kstDate();
  generationRunState.date = date;
  writeNewsletterDate(date);
  writeGenerationStatus({ date, status: 'STARTED', must_fix_count: 0 });

  const candidatePath = collectedCandidatesPath(root, date);
  const sourcesPath = path.join(root, 'docs', 'news-sources.md');
  const editorialPolicyPath = path.join(root, 'docs', 'editorial-policy.md');
  const newsletterTemplatePath = path.join(root, 'docs', 'newsletter-template.md');
  const goldenExamplePath = path.join(root, 'docs', 'golden-examples', 'manual-quality-newsletter.md');
  const newsroomDir = artifactNewsroomDir(root, date);
  const newsletterDir = path.join(root, 'newsletters', date);

  if (!fs.existsSync(candidatePath)) {
    fail(`Missing ${path.relative(root, candidatePath)}. Run scripts/collect-news-candidates.js first.`);
  }
  if (!fs.existsSync(sourceRegistryPath) && !fs.existsSync(sourcesPath)) {
    fail('Missing data/news-sources.json and docs/news-sources.md.');
  }

  const candidates = readJson(candidatePath);
  const sourcesMarkdown = readTextIfExists(sourcesPath);
  const editorialPolicy = readTextIfExists(editorialPolicyPath);
  const newsletterTemplate = readTextIfExists(newsletterTemplatePath);
  const goldenExample = readTextIfExists(goldenExamplePath);
  const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : null;
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.mkdirSync(newsletterDir, { recursive: true });

  const cacheDir = path.join(root, 'cache', 'news-summary');
  let shortlistReport = buildShortlistReport(date, candidates);
  generationRunState.shortlistReport = shortlistReport;
  generationRunState.selectedInputs = shortlistReport.selected_articles;
  writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
  if (shortlistReport.selection_warnings.length > 0) {
    writeGenerationStatus(buildGenerationStatus({
      date,
      status: 'UNDERFILLED_NEEDS_FIX',
      extra: {
        failure_stage: 'deterministic selection',
        failure_reason: shortlistReport.selection_warnings.join('; '),
        ...selectionStatusExtra(shortlistReport)
      }
    }));
    writeRecoveryPrompt(newsroomDir, {
      date,
      stage: 'deterministic selection',
      reason: shortlistReport.selection_warnings.join('; '),
      shortlistReport,
      selectedInputs: shortlistReport.selected_articles
    });
    console.warn(`Deterministic selection is underfilled: ${shortlistReport.selection_warnings.join('; ')}`);
  }
  if (shortlistReport.selection_errors.length > 0) {
    writeRecoveryPrompt(newsroomDir, {
      date,
      stage: 'deterministic selection',
      reason: shortlistReport.selection_errors.join('; '),
      shortlistReport,
      selectedInputs: shortlistReport.selected_articles
    });
    fail(`[deterministic selection] ${shortlistReport.selection_errors.join('; ')}`);
  }

  const reporterInput = reporterInputFromShortlist(shortlistReport);
  reporterInput.candidates = annotateCandidatesWithCache(reporterInput.candidates, cacheDir);
  const summaryCacheDiagnostics = reporterInput.candidates.cache_diagnostics || [];
  writeSummaryCacheReport(date, summaryCacheDiagnostics);
  let articleCapsuleReport = buildArticleCapsuleReport(date, shortlistReport, reporterInput);
  writeJson(path.join(newsroomDir, 'article-capsules.json'), articleCapsuleReport);

  const commonContext = [
    `Newsletter date: ${date}`,
    'Audience: Camera HAL / Android Camera / C++ engineer',
    'Use only the collected candidate JSON, data/news-sources.json, docs/news-sources.md, and the editorial documents below. Do not browse the web.',
    'Keep source names and source URLs unchanged. Distinguish confirmed facts from interpretation.',
    'Final newsletter text must be Korean.',
    '',
    'docs/editorial-policy.md:',
    editorialPolicy,
    '',
    'docs/newsletter-template.md:',
    newsletterTemplate,
    '',
    'docs/golden-examples/manual-quality-newsletter.md:',
    goldenExample,
    '',
    'Use the golden example only as a style and structure reference. Do not copy facts, dates, versions, API/component names, behavior changes, sources, or action items unless they are present in the current candidate JSON.'
  ].join('\n');

  const maxQualityRetries = runtimeConfig.newsroomMaxQualityRetries;
  const totalAttempts = 1 + maxQualityRetries;
  const retryHistory = [];
  generationRunState.retryHistory = retryHistory;
  let lockedSections = [];
  let reporter = null;
  let editor = null;
  let factCheck = null;
  let qualityReport = null;
  let excludedSections = [];

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    generationRunState.currentQualityAttempt = attempt;
    const lockedContext = buildLockedArticleContext(lockedSections, excludedSections);
    const reporterStage = `reporter attempt ${attempt}/${totalAttempts}`;
    const editorStage = `editor attempt ${attempt}/${totalAttempts}`;
    const factCheckStage = `fact-checker attempt ${attempt}/${totalAttempts}`;
    console.log(`Starting Gemini newsroom quality attempt ${attempt}/${totalAttempts}. Locked articles: ${lockedSections.length}.`);

    reporter = validateReporter(await callGeminiJson(
      reporterStage,
      [
        'You are the AI reporter for Camera HAL SW Newsletter.',
        'The local deterministic selector has already filtered, ranked, and chosen final article inputs. Do not make final selection decisions.',
        'Use selected only for reporter-stage judgment. Deterministic final article inputs are marked separately as final_selected=true and selected_for_editor=true after validation.',
        'Summarize, tag, and refine evidence fields only for the supplied shortlisted article capsules.',
        'Use article capsule fields, risk, score, selection, imageCandidates, and evidence only as context. Do not assume omitted source text exists.',
        'For every final_selected candidate, extract concrete evidence when available: version_or_release, api_or_component, behavior_change, evidence_notes, and cross_check_status.',
        'Preserve eligibility and risk values from the article capsule. If a required schema field is not present, infer only from the capsule evidence and risk object.',
        'If the source is a rolling page, release-note watch page, documentation watch page, homepage, or other watch page, say that explicitly in evidence_notes and do not present it as a dated release unless the candidate provides date/version/API/component/behavior evidence.',
        'Rolling release-note pages require evidence_notes that name the exact date, version/release, API/component, and behavior change before they can be selected.',
        'cross_check_status must be one of: not-required, official-source, cross-checked, needs-cross-check.',
        'Candidate-only or requiresCrossCheck leads must not be selected unless cross_check_status is official-source or cross-checked.',
        'Fallback C++, native, toolchain, Linux, and AI items can remain reporter-selected only when they satisfy the reporter-stage evidence and relevance rules.',
        'Preserve imageCandidates exactly from the collected candidate JSON. Do not invent image URLs, rewrite image URLs, or add image candidates.',
        lockedSections.length > 0 ? 'Do not select candidates that duplicate the locked article URLs, titles, sources, or source-date-title combinations listed in the retry context.' : '',
        'For every candidate, provide these numeric scores:',
        '- camera_hal_relevance_score: 0-5',
        '- android_camera_relevance_score: 0-5',
        '- practical_actionability_score: 0-5',
        '- source_reliability_score: 0-5',
        '- freshness_score: 0-3',
        '- ai_required_slot_fit_score: 0-3',
        '- cpp_fallback_value_score: 0-3',
        'Return only JSON matching the schema.'
      ].filter(Boolean).join('\n'),
      `${commonContext}\n\n${lockedContext}\n\nArticle capsule shortlist JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, 'shortlisted'), null, 2)}\n\nCompact selection context JSON:\n${JSON.stringify(compactSelectionContext(shortlistReport), null, 2)}`,
      reporterSchema
    ), date, reporterInput.candidates);
    reporter = enforceDeterministicReporterSelection(reporter, shortlistReport);
    shortlistReport = normalizeShortlistReport(shortlistReport, reporter);
    generationRunState.shortlistReport = shortlistReport;
    generationRunState.selectedInputs = shortlistReport.selected_articles;
    writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
    articleCapsuleReport = buildArticleCapsuleReport(date, shortlistReport, { date, candidates: reporter.candidates });
    writeJson(path.join(newsroomDir, 'article-capsules.json'), articleCapsuleReport);
    for (const candidate of ensureArray(reporter.candidates)) {
      writeCacheRecord(candidate, cacheDir, { stage: reporterStage, model: getGeminiModelUsage(reporterStage) || 'unknown' });
    }
    const rejectedReporterDuplicates = removeDisallowedSelections(reporter, lockedSections, excludedSections);
    writeJson(path.join(newsroomDir, `reporter-candidates-attempt-${attempt}.json`), reporter);

    editor = validateEditor(await callGeminiJson(
      editorStage,
      [
        'You are the AI editor for Camera HAL SW Newsletter.',
        'Write a Korean technical newsletter draft that a Camera HAL engineer can read in 10 minutes.',
        'Follow docs/editorial-policy.md and docs/newsletter-template.md exactly.',
        'Create exactly 5 main articles when enough non-duplicate source material exists; 4 main articles are acceptable only when strong candidates are insufficient.',
        `Final main article count must stay between ${MIN_MAIN_ARTICLES} and ${MAX_MAIN_ARTICLES}; do not force 5 articles when only 4 strong eligible candidates exist.`,
        'Use final-selected article capsules as main article inputs. Do not turn final_selected=false, finalSelectionEligibility=watchlist/exclude, isWatchPage=true without hasDatedEvidence, main_eligible=false, source_gap_risk=true, briefing_only, or reference_only candidates into main articles.',
        'Target article slot mix: Android Camera / platform API 1-2; CameraX / AOSP Camera / compatibility 1-2; Linux camera / libcamera / V4L2 0-1; AI plus camera input path or HAL workflow 0-1; C++ / toolchain fallback 0-1.',
        'AI/C++ articles are optional bonus items only when final-selected inputs contain a concrete Camera HAL / Android Camera connection. Do not invent or force a generic AI article.',
        'If there are not enough strong Camera HAL / Android Camera candidates, use C++ fallback only when it is a real dated article and has concrete HAL native-code value.',
        lockedSections.length > 0 ? 'Locked articles from previous attempts are already quality-passing. Keep these passed articles unchanged and generate only missing replacement articles.' : '',
        lockedSections.length > 0 ? 'Do not duplicate locked article URLs, titles/headlines, source names, or same source + published date + similar title.' : '',
        'Avoid marketing tone. Include confirmed_facts, background, camera_hal_perspective, action_items, team_summary, and sources in every article.',
        'Every article must include evidence_summary, specificity_checks, and source_verification_notes.',
        'Every main article must explicitly name the release date, version/release, API/component or library/artifact, concrete behavior change, and Camera HAL / Android camera / C++ / AI workflow relevance when those fields exist in the candidate metadata.',
        'specificity_checks must name concrete evidence such as version, release date, API/component, source page, behavior change, or the exact source gap if the source is a rolling/watch page.',
        'If release date, version/release, API/component, behavior change, or Camera HAL relevance cannot be verified from the supplied candidate/source data, demote the item to briefing/watchlist or exclude it instead of writing it as a main article.',
        'Do not write generic advice like "monitor AOSP updates" or "review CameraX changes" unless the sentence names the exact source, version/release, API/component, date, or behavior to watch.',
        'For AI, C++, Linux, or tooling articles, explicitly connect the item to Camera HAL through stream/buffer/metadata/request/result, CTS/VTS/Camera ITS, latency, frame drop, thermal, memory, NPU/GPU/ISP contention, or HAL workflow.',
        'Each action_items entry must be executable within 2 weeks and include at least one concrete test, log, metric, device class, API/component, stream combination, or code-owner style handoff.',
        'For each article, choose at most one selectedImage from that article imageCandidates. If relevance, rights risk, logo-only content, screenshot text density, or source fit is unclear, set selectedImage to an empty string.',
        'Do not invent image URLs. selectedImage must exactly match one imageCandidates.url value, or be an empty string.',
        'Prefer directly relevant 16:9 or 4:3 clean images from the source article over generic, logo-only, or promotional images.',
        'When selectedImage is set, ALWAYS provide imageSource, imageAttribution, imageAlt, imageLicenseStatus, and a short imageUsageDecisionReason. imageAlt must describe the image in article context.',
        'imageSource MUST be an HTTPS URL that links to the image source or article.',
        'imageAttribution MUST be non-empty source or article title text.',
        'If you cannot provide imageSource, imageAttribution, imageAlt, and imageLicenseStatus, do not select an image; leave selectedImage empty.',
        'Incomplete selected image metadata will be removed during validation and may cause publication validation failure.',
        'When no image is selected, keep selectedImage, imageSource, imageAttribution, and imageAlt empty, set imageLicenseStatus to none, and explain the rejection briefly in imageUsageDecisionReason.',
        'Separate facts and interpretation. Preserve source links. Return only JSON matching the schema.',
        'briefing must have exactly 3 items.'
      ].filter(Boolean).join('\n'),
      `${commonContext}\n\n${lockedContext}\n\nFinal-selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}`,
      editorSchema
    ), date, reporter);

    const merged = mergeLockedSections(lockedSections, editor.sections, excludedSections);
    let rejectedGeneratedSections = [...merged.rejected];
    editor.sections = merged.sections;
    await resolveIssueArticleImages(editor, { root });
    warnResolvedImageFallbacks(editor);
    writeJson(path.join(newsroomDir, `editor-draft-attempt-${attempt}.json`), editor);
    fs.writeFileSync(path.join(newsroomDir, `editor-draft-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

    factCheck = validateFactCheck(await callGeminiJson(
      factCheckStage,
      [
        'You are the AI fact checker for Camera HAL SW Newsletter.',
        'Check factuality, missing sources, exaggerated language, and missing dates.',
        'Treat missing version, release date, API/component name, or behavior change as must_fix when an article presents a rolling page or generic watch item as a concrete update.',
        'Treat any finalSelectionEligibility=watchlist/exclude candidate or watch page without dated evidence used as a main article as must_fix.',
        'Any claim without a source must be classified as must_fix.',
        'Flag general AI/C++ news that lacks Camera HAL or Android Camera interpretation.',
        'Flag any main article without concrete Action Item content.',
        'Flag any main article with weak Camera HAL perspective or missing engineering relevance.',
        'Flag candidate-only or requiresCrossCheck source usage unless the editor explains official-source or cross-checked verification.',
        'Do not treat resolvedImage.usedFallback=true as must_fix when selectedImage is a repo-local fallback path and originalImage or resolvedImage.originalUrl preserves the external original. Treat it as must_fix only when selectedImage still contains the broken external image URL or the fallback path is missing.',
        'Do not rewrite for style. Focus only on factual errors, source problems, and editorial-policy violations.',
        'Return only JSON matching the schema.'
      ].join('\n'),
      `${commonContext}\n\nFinal-selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nEditor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
      factCheckSchema
    ));
    let eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections);
    factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
    generationRunState.factCheck = factCheck;
    writeJson(path.join(newsroomDir, `fact-check-report-attempt-${attempt}.json`), factCheck);
    fs.writeFileSync(path.join(newsroomDir, `fact-check-report-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

    qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
      threshold: QUALITY_THRESHOLD
    });
    generationRunState.qualityReport = qualityReport;
    writeJson(path.join(newsroomDir, `quality-report-attempt-${attempt}.json`), qualityReport);
    fs.writeFileSync(path.join(newsroomDir, `quality-report-attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');

    let repairActions = [];
    let demotedSections = appendUniqueSections(
      sourceGapSections(editor, factCheck),
      eligibilityFindings.map(finding => finding.section)
    );
    let replacedSections = [];
    let failedSections = [];
    let regeneratedSections = [];
    let rejectedRetryOutputs = [];
    const fullRepairPlan = buildFullSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings);
    const repairPlan = buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings, {
      maxSectionRepairs: runtimeConfig.newsroomMaxSectionRepairs
    });
    const skippedRepairPlan = fullRepairPlan.slice(repairPlan.length);
    if (qualityReport.status !== 'PASS' && repairPlan.length > 0) {
      repairActions = repairPlan.map(item => `${item.action}: ${item.headline}`);
      failedSections = sectionsMatchingRepairPlan(editor.sections, repairPlan);
      const preservedSections = sectionsOutsideRepairPlan(editor.sections, repairPlan);
      const repairStage = `editor repair attempt ${attempt}/${totalAttempts}`;
      const repairFactCheckStage = `fact-checker repair attempt ${attempt}/${totalAttempts}`;
      console.warn(`Quality attempt ${attempt}/${totalAttempts} is below threshold; running editor repair pass for ${repairPlan.length} section(s).`);
      const repairSections = validateCompletionSections(await callGeminiJson(
        repairStage,
        [
          'You are the AI repair editor for Camera HAL SW Newsletter.',
          'Return only regenerated section JSON for the failed sections listed in the repair plan. Never return a full newsletter draft.',
          'For repair-section actions, repair only the affected section using the same source.',
          'For replace-section actions, replace the section with a stronger supplied candidate instead of rewriting weak evidence.',
          'For replace-or-demote actions, demote the article to briefing/watchlist or replace it. Never rewrite source gaps into publishable facts.',
          'For reporter_eligibility_violations, replace or demote the section. Do not repair text around an ineligible source.',
          'Replacement main articles must use only the selected deterministic article capsules or selected unused capsule candidates supplied in this prompt.',
          'Preserve locked/passing sections unchanged and do not duplicate locked or excluded articles.',
          'Locked/passing sections already satisfied the gate; preserve their source URLs, title/headline, and source-date-title combinations exactly unless they are explicitly listed in the repair plan.',
          'For each regenerated section, explicitly provide release date, version/release, API/component or library/artifact, concrete behavior change, and Camera HAL / Android camera / C++ / AI workflow relevance.',
          'If those facts cannot be verified from the supplied candidate/source data, demote to briefing/watchlist or exclude; do not invent or infer missing release evidence.',
          `Keep ${MIN_MAIN_ARTICLES}-${MAX_MAIN_ARTICLES} main articles; 5 is the target only when enough strong eligible candidates exist.`,
          'Maintain the slot policy: Android Camera/platform API 1-2; CameraX/AOSP/compatibility 1-2; Linux camera/libcamera/V4L2 0-1; AI camera path/HAL workflow 0-1 when present in final-selected inputs; C++/toolchain fallback 0-1 from real dated articles only.',
          'Use the golden example only for article structure and evidence/actionability style. Do not copy facts absent from current reporter candidates.',
          'Return only JSON matching the schema.'
        ].join('\n'),
        `${commonContext}\n\n${lockedContext}\n\nRepair plan JSON:\n${JSON.stringify(repairPlan, null, 2)}\n\nLocked/passing sections JSON:\n${JSON.stringify(preservedSections.map((section, index) => sectionSummary(section, index)), null, 2)}\n\nFailed sections JSON:\n${JSON.stringify(failedSections.map((section, index) => sectionSummary(section, index)), null, 2)}\n\nFinal-selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nUnused final-selected article capsule pool JSON:\n${JSON.stringify(reporterCandidateCapsules(date, availableCompletionCandidates(reporter, preservedSections, excludedSections.concat(demotedSections)), articleCapsuleReport), null, 2)}\n\nCurrent fact-check JSON:\n${JSON.stringify(factCheck, null, 2)}\n\nCurrent quality deductions JSON:\n${JSON.stringify(ensureArray(qualityReport?.deductions), null, 2)}`,
        editorCompletionSchema
      ), date, reporter);
      const repairMerged = mergeLockedSections(preservedSections, repairSections, excludedSections.concat(demotedSections));
      rejectedGeneratedSections = rejectedGeneratedSections.concat(repairMerged.rejected);
      rejectedRetryOutputs = repairMerged.rejected;
      replacedSections = repairMerged.rejected
        .filter(item => item.reason === 'excluded source-gap or demoted article')
        .map(item => item.title);
      regeneratedSections = repairSections;
      editor = validateEditor({
        ...editor,
        sections: repairMerged.sections
      }, date, reporter);
      await resolveIssueArticleImages(editor, { root });
      warnResolvedImageFallbacks(editor);
      writeJson(path.join(newsroomDir, `editor-repair-attempt-${attempt}.json`), editor);
      writeJson(path.join(newsroomDir, `editor-repair-sections-attempt-${attempt}.json`), {
        locked_sections: preservedSections.map((section, index) => sectionSummary(section, index)),
        failed_sections: failedSections.map((section, index) => sectionSummary(section, index)),
        regenerated_sections: regeneratedSections.map((section, index) => sectionSummary(section, index)),
        rejected_retry_outputs: rejectedRetryOutputs,
        max_section_repairs: runtimeConfig.newsroomMaxSectionRepairs,
        repair_plan: repairPlan,
        skipped_repair_plan: skippedRepairPlan
      });
      fs.writeFileSync(path.join(newsroomDir, `editor-repair-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

      factCheck = validateFactCheck(await callGeminiJson(
        repairFactCheckStage,
        [
          'You are the AI fact checker for the repaired Camera HAL SW Newsletter draft.',
          'Check factuality, missing sources, exaggerated language, missing dates, source gaps, and editorial-policy violations.',
          'Treat missing release date, version/release, API/component or library/artifact, concrete behavior change, or Camera HAL relevance as must_fix for any main article.',
          'Treat any remaining source gap or watchlist/reference page used as a main article as must_fix.',
          'Do not treat resolvedImage.usedFallback=true as must_fix when selectedImage is a repo-local fallback path and originalImage or resolvedImage.originalUrl preserves the external original. Treat it as must_fix only when selectedImage still contains the broken external image URL or the fallback path is missing.',
          'Return only JSON matching the schema.'
        ].join('\n'),
        `${commonContext}\n\nFinal-selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nRepaired editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
        factCheckSchema
      ));
      eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections);
      factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
      generationRunState.factCheck = factCheck;
      writeJson(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.json`), factCheck);
      fs.writeFileSync(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

      qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
        threshold: QUALITY_THRESHOLD
      });
      generationRunState.qualityReport = qualityReport;
      writeJson(path.join(newsroomDir, `quality-report-repair-attempt-${attempt}.json`), qualityReport);
      fs.writeFileSync(path.join(newsroomDir, `quality-report-repair-attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');
      demotedSections = appendUniqueSections(
        demotedSections,
        sourceGapSections(editor, factCheck).concat(eligibilityFindings.map(finding => finding.section))
      );
    }

    if (hasTooFewMainArticlesDeduction(qualityReport)) {
      const missingArticleCount = MIN_MAIN_ARTICLES - ensureArray(editor.sections).length;
      const completionExcludedSections = appendUniqueSections(
        excludedSections,
        demotedSections.concat(eligibilityFindings.map(finding => finding.section))
      );
      const completionCandidates = availableCompletionCandidates(reporter, editor.sections, completionExcludedSections);
      if (missingArticleCount > 0 && completionCandidates.length > 0) {
        const completionStage = `editor completion attempt ${attempt}/${totalAttempts}`;
        const completionFactCheckStage = `fact-checker completion attempt ${attempt}/${totalAttempts}`;
        console.warn(`Quality attempt ${attempt}/${totalAttempts} has only ${editor.sections.length} main article(s); requesting ${missingArticleCount} completion article(s).`);
        const completionSections = validateCompletionSections(await callGeminiJson(
          completionStage,
          [
            'You are the AI completion editor for Camera HAL SW Newsletter.',
            `Return only ${missingArticleCount} additional main article section(s), never a full newsletter rewrite.`,
            'Preserve existing valid sections by excluding their URLs, titles, source names, and source-date-title combinations.',
            'Use only the eligible reporter candidates supplied in this prompt. Do not use candidates omitted from the eligible list.',
            'Do not duplicate locked, duplicate/rejected, source-gap, or ineligible sections from the exclusion context.',
            'Each new section must satisfy the same editorial contract: confirmed_facts, background, camera_hal_perspective, action_items, team_summary, evidence_summary, specificity_checks, source_verification_notes, camera_hal_checks, and sources.',
            'Each new section must name release date, version/release, API/component or library/artifact, concrete behavior change, and Camera HAL / Android camera / C++ / AI workflow relevance using only supplied candidate metadata/source text.',
            'Reject duplicate URLs, duplicate titles, and duplicate source-date-title combinations from the exclusion context.',
            'If the facts cannot be verified, do not create a main article from that candidate; leave the newsletter underfilled for editor review instead.',
            'For each article, choose at most one selectedImage from that article imageCandidates; use an empty selectedImage when attribution or relevance is uncertain.',
            'Final newsletter text must be Korean. Return only JSON matching the schema.'
          ].join('\n'),
          `${commonContext}\n\nCompletion exclusion context JSON:\n${buildCompletionExclusionContext(lockedSections, editor.sections, completionExcludedSections)}\n\nCurrent editor section summaries JSON:\n${JSON.stringify(editor.sections.map((section, index) => sectionSummary(section, index)), null, 2)}\n\nEligible final-selected article capsules for additional articles JSON:\n${JSON.stringify(reporterCandidateCapsules(date, completionCandidates, articleCapsuleReport), null, 2)}\n\nCurrent quality deductions JSON:\n${JSON.stringify(ensureArray(qualityReport?.deductions), null, 2)}`,
          editorCompletionSchema
        ), date, reporter);
        const completionMerged = mergeLockedSections(editor.sections, completionSections, completionExcludedSections);
        rejectedGeneratedSections = rejectedGeneratedSections.concat(completionMerged.rejected);
        editor = validateEditor({
          ...editor,
          sections: completionMerged.sections
        }, date, reporter);
        await resolveIssueArticleImages(editor, { root });
        warnResolvedImageFallbacks(editor);
        writeJson(path.join(newsroomDir, `editor-completion-attempt-${attempt}.json`), editor);
        fs.writeFileSync(path.join(newsroomDir, `editor-completion-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

        factCheck = validateFactCheck(await callGeminiJson(
          completionFactCheckStage,
          [
            'You are the AI fact checker for the completed Camera HAL SW Newsletter draft.',
            'Check factuality, missing sources, exaggerated language, missing dates, source gaps, and editorial-policy violations.',
            'Focus on whether the added sections use only eligible reporter candidates and whether the full draft now satisfies the 4-5 main article contract.',
            'Do not treat resolvedImage.usedFallback=true as must_fix when selectedImage is a repo-local fallback path and originalImage or resolvedImage.originalUrl preserves the external original. Treat it as must_fix only when selectedImage still contains the broken external image URL or the fallback path is missing.',
            'Return only JSON matching the schema.'
          ].join('\n'),
          `${commonContext}\n\nFinal-selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport), null, 2)}\n\nCompleted editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
          factCheckSchema
        ));
        eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections);
        factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
        generationRunState.factCheck = factCheck;
        writeJson(path.join(newsroomDir, `fact-check-completion-attempt-${attempt}.json`), factCheck);
        fs.writeFileSync(path.join(newsroomDir, `fact-check-completion-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

        qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
          threshold: QUALITY_THRESHOLD
        });
        generationRunState.qualityReport = qualityReport;
        writeJson(path.join(newsroomDir, `quality-report-completion-attempt-${attempt}.json`), qualityReport);
        fs.writeFileSync(path.join(newsroomDir, `quality-report-completion-attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');
        repairActions.push(`complete-missing-articles: requested ${missingArticleCount}, added ${Math.max(0, editor.sections.length - (MIN_MAIN_ARTICLES - missingArticleCount))}`);
        demotedSections = appendUniqueSections(
          demotedSections,
          sourceGapSections(editor, factCheck).concat(eligibilityFindings.map(finding => finding.section))
        );
      } else {
        console.warn(`Quality attempt ${attempt}/${totalAttempts} has too few main articles, but no eligible non-duplicate completion candidates remain.`);
      }
    }

    excludedSections = appendUniqueSections(excludedSections, demotedSections);
    const lockSelection = selectLockedArticles(editor, qualityReport, factCheck);
    lockedSections = appendUniqueLockedArticles(lockedSections, lockSelection.articles);
    const rejectedDuplicateHeadlines = [...rejectedReporterDuplicates, ...rejectedGeneratedSections];
    const lockBlockers = lockSelection.blockers.map(deduction => `${deduction.category}: ${deduction.reason}`);
    retryHistory.push({
      attempt,
      model: [
        `reporter=${getGeminiModelUsage(reporterStage) || 'unknown'}`,
        `editor=${getGeminiModelUsage(editorStage) || 'unknown'}`,
        `fact-checker=${getGeminiModelUsage(factCheckStage) || 'unknown'}`
      ].join(', '),
      score: qualityReport.score,
      threshold: qualityReport.threshold,
      status: qualityReport.status,
      deductions: ensureArray(qualityReport.deductions),
      selected_article_headlines: lockedArticleHeadlines(editor.sections),
      locked_article_headlines: lockedArticleHeadlines(lockedSections),
      source_gap_sections: sourceGapSections(editor, factCheck).map(sectionLabel),
      demoted_sections: demotedSections.map(sectionLabel),
      replaced_sections: replacedSections,
      locked_sections: lockedSections.map((section, index) => sectionSummary(section, index)),
      failed_sections: failedSections.map((section, index) => sectionSummary(section, index)),
      regenerated_sections: regeneratedSections.map((section, index) => sectionSummary(section, index)),
      rejected_retry_outputs: rejectedRetryOutputs,
      repair_actions: repairActions,
      max_section_repairs: runtimeConfig.newsroomMaxSectionRepairs,
      repair_plan: repairPlan,
      skipped_repair_sections: skippedRepairPlan,
      article_locks: lockedSections.map((section, index) => sectionLockRecord(section, index)),
      final_article_slot_distribution: finalArticleSlotDistribution(editor.sections),
      reporter_eligibility_blocked_sections: eligibilityFindings.map(finding => ({
        headline: finding.headline,
        source_url: finding.source_url,
        reason: finding.reason
      })),
      rejected_main_ineligible_candidates: ensureArray(reporter.rejected_main_ineligible_candidates),
      lock_blockers: lockBlockers,
      rejected_duplicate_headlines: rejectedDuplicateHeadlines,
      source_gap_count: qualityReport.metrics.source_gap_count,
      must_fix_count: qualityReport.metrics.must_fix_count
    });
    console.log(`Quality attempt ${attempt}/${totalAttempts}: score ${qualityReport.score}/${qualityReport.threshold}, status ${qualityReport.status}, deductions ${ensureArray(qualityReport.deductions).length}, locked articles ${lockedSections.length}, rejected duplicates ${rejectedDuplicateHeadlines.length}.`);
    if (lockBlockers.length > 0) {
      console.warn(`Quality attempt ${attempt}/${totalAttempts} has issue-level lock blocker(s): ${lockBlockers.join('; ')}.`);
    }

    if (qualityReport.status === 'PASS' && qualityReport.score >= qualityReport.threshold) break;
    if (attempt < totalAttempts) {
      console.warn(`Quality attempt ${attempt}/${totalAttempts} did not pass; retrying with ${lockedSections.length} locked article(s).`);
    }
  }

  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
  fs.writeFileSync(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(editor), 'utf8');
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
  fs.writeFileSync(path.join(newsroomDir, 'fact-check-report.md'), buildFactCheckMarkdown(date, factCheck), 'utf8');
  writeJson(path.join(newsroomDir, 'quality-report.json'), qualityReport);
  fs.writeFileSync(path.join(newsroomDir, 'quality-report.md'), buildQualityReportMarkdown(qualityReport), 'utf8');
  writeJson(path.join(newsroomDir, 'retry-history.json'), retryHistory);
  fs.writeFileSync(
    path.join(newsroomDir, 'retry-history.md'),
    buildRetryHistoryMarkdown(date, retryHistory, selectionStatusExtra(shortlistReport)),
    'utf8'
  );
  writeCostReport(date);

  const newsletterMd = path.join(newsletterDir, 'newsletter.md');
  const newsletterHtml = path.join(newsletterDir, 'index.html');
  fs.writeFileSync(newsletterMd, buildMarkdown(editor), 'utf8');
  fs.writeFileSync(newsletterHtml, buildHtml(editor), 'utf8');
  updateNewsletterData(date, editor);

  const files = [
    collectedCandidatesRelPath(date),
    newsroomRelPath(date, 'shortlisted-candidates.json'),
    newsroomRelPath(date, 'article-capsules.json'),
    newsroomRelPath(date, 'reporter-candidates.json'),
    newsroomRelPath(date, 'editor-draft.json'),
    newsroomRelPath(date, 'editor-draft.md'),
    newsroomRelPath(date, 'fact-check-report.json'),
    newsroomRelPath(date, 'fact-check-report.md'),
    newsroomRelPath(date, 'quality-report.json'),
    newsroomRelPath(date, 'quality-report.md'),
    newsroomRelPath(date, 'retry-history.json'),
    newsroomRelPath(date, 'retry-history.md'),
    newsroomRelPath(date, 'cost-report.md'),
    newsroomRelPath(date, 'recovery-prompt.md'),
    newsroomRelPath(date, 'editor-in-chief-brief.md'),
    newsroomRelPath(date, 'release-qa-report.md'),
    `newsletters/${date}/newsletter.md`,
    `newsletters/${date}/index.html`,
    'data/newsletters.json'
  ];

  fs.writeFileSync(
    path.join(newsroomDir, 'editor-in-chief-brief.md'),
    buildEditorChiefBrief(date, editor, factCheck, qualityReport, selectionStatusExtra(shortlistReport)),
    'utf8'
  );

  const emptySourceSections = editor.sections
    .filter(section => ensureArray(section.sources).filter(source => source && source.url).length === 0)
    .map(section => section.category);
  const todoFound = containsTodo([newsletterMd, newsletterHtml]);
  const validateResult = runValidate();
  fs.writeFileSync(
    path.join(newsroomDir, 'release-qa-report.md'),
    buildReleaseQaReport(date, files, validateResult.text, factCheck, todoFound, emptySourceSections, qualityReport),
    'utf8'
  );

  const mustFixCount = ensureArray(factCheck.must_fix).length;
  let generationStatus = 'PASS';
  if (shortlistReport.underfilled) {
    generationStatus = 'UNDERFILLED_NEEDS_FIX';
  } else if (factCheck.status === 'NEEDS_FIX' && mustFixCount > 0) {
    generationStatus = 'NEEDS_FIX';
  } else if (qualityReport.status !== 'PASS') {
    generationStatus = 'QUALITY_NEEDS_FIX';
  }
  writeGenerationStatus(buildGenerationStatus({
    date,
    status: generationStatus,
    retryHistory,
    qualityReport,
    factCheck,
    extra: {
      failure_stage: '',
      failure_reason: '',
      quality_status: qualityReport.status,
      quality_score: qualityReport.score,
      quality_threshold: qualityReport.threshold,
      quality_deduction_count: ensureArray(qualityReport.deductions).length,
      locked_article_count: retryHistory.at(-1)?.locked_article_headlines.length || 0,
      repaired_section_count: retryHistory.reduce((sum, item) => sum + ensureArray(item.regenerated_sections).length, 0),
      failed_section_count: retryHistory.at(-1)?.failed_sections.length || 0,
      skipped_repair_section_count: retryHistory.reduce((sum, item) => sum + ensureArray(item.skipped_repair_sections).length, 0),
      rejected_duplicate_article_count: retryHistory.reduce((sum, item) => sum + item.rejected_duplicate_headlines.length, 0),
      validate_ok: validateResult.ok,
      todo_found: todoFound,
      empty_source_sections: emptySourceSections,
      source_gap_count: factCheck.source_gap_count,
      ...selectionStatusExtra(shortlistReport)
    }
  }));

  if (todoFound) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: 'Generated newsletter contains TODO.', shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    fail('Generated newsletter contains TODO.');
  }
  if (emptySourceSections.length > 0) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: `Generated sections without sources: ${emptySourceSections.join(', ')}`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    fail(`Generated sections without sources: ${emptySourceSections.join(', ')}`);
  }
  if (!validateResult.ok && !shortlistReport.underfilled) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'validation', reason: `npm run validate failed:\n${validateResult.text}`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    fail(`npm run validate failed:\n${validateResult.text}`);
  }
  if (!validateResult.ok && shortlistReport.underfilled) {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'thin-week validation', reason: `Underfilled review-only draft did not pass publication validation:\n${validateResult.text}`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    console.warn('Underfilled review-only draft did not pass publication validation. Artifacts were written and publish_ready remains false.');
  } else if (generationStatus === 'NEEDS_FIX') {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'fact-check', reason: 'Gemini fact checker returned NEEDS_FIX with must_fix items.', shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    console.warn('Gemini fact checker returned NEEDS_FIX with must_fix items. Artifacts were written for editor review.');
  } else if (generationStatus === 'QUALITY_NEEDS_FIX') {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'quality', reason: `Newsletter quality score ${qualityReport.score}, threshold ${qualityReport.threshold}, result ${qualityReport.status}.`, shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    console.warn(`Newsletter quality score ${qualityReport.score}, threshold ${qualityReport.threshold}, result ${qualityReport.status}. Artifacts were written for editor review.`);
  } else if (generationStatus === 'UNDERFILLED_NEEDS_FIX') {
    writeRecoveryPrompt(newsroomDir, { date, stage: 'thin-week selection', reason: shortlistReport.selection_warnings.join('; '), shortlistReport, selectedInputs: shortlistReport.selected_articles, qualityReport, factCheck });
    console.warn('Underfilled thin-week draft is review-only. Artifacts were written for editor review.');
  }

  console.log(`Gemini newsroom newsletter generated for ${date}`);
}

function writeTerminalFailureStatus(error) {
  const date = generationRunState.date || runtimeConfig.newsletterDate || kstDate();
  const newsroomDir = artifactNewsroomDir(root, date);
  try {
    writeRecoveryPrompt(newsroomDir, {
      date,
      stage: failureStageFromError(error),
      reason: String(error?.message || error || 'Unknown generation failure.'),
      shortlistReport: generationRunState.shortlistReport,
      selectedInputs: generationRunState.selectedInputs,
      qualityReport: generationRunState.qualityReport,
      factCheck: generationRunState.factCheck
    });
  } catch (_) {
    // The status file below is the minimum required failure artifact.
  }
  writeGenerationStatus(buildGenerationStatus({
    date,
    status: 'FAILED',
    failureStage: failureStageFromError(error),
    failureReason: String(error?.message || error || 'Unknown generation failure.'),
    retryHistory: generationRunState.retryHistory,
    qualityReport: generationRunState.qualityReport,
    factCheck: generationRunState.factCheck,
    extra: {
      quality_attempt_count: Math.max(
        generationRunState.retryHistory.length,
        generationRunState.currentQualityAttempt
      ),
      ...selectionStatusExtra(generationRunState.shortlistReport)
    }
  }));
  writeCostReport(date);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    try {
      writeTerminalFailureStatus(error);
    } catch (statusError) {
      console.error(`Failed to write terminal generation status: ${statusError.message}`);
    }
    process.exit(1);
  });
}

module.exports = {
  buildGenerationStatus,
  buildSectionRepairPlan,
  failureStageFromError,
  hasTooFewMainArticlesDeduction,
  main,
  mergeLockedSections,
  sectionsMatchingRepairPlan,
  sectionsOutsideRepairPlan,
  validateCompletionSections,
  writeGenerationStatus,
  writeTerminalFailureStatus
};
