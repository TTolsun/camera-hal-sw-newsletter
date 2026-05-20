const fs = require('fs');
const path = require('path');

const {
  kstDate,
  readJson
} = require('../common/common');
const {
  evidenceValidationReportPath,
  evidenceValidationReportRelPath,
  extractedSourceFactsPath,
  extractedSourceFactsRelPath,
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  geminiCandidatesPath,
  geminiCandidatesRelPath,
  geminiSourceProposalValidationReportPath,
  geminiSourceProposalValidationReportRelPath,
  geminiSourceProposalsPath,
  geminiSourceProposalsRelPath,
  geminiUsageReportPath,
  geminiUsageReportRelPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  mergedCandidateManifestPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesPath,
  mergedCandidatesRelPath,
  newsroomDir,
  newsroomRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath,
  seedCandidatesPath,
  seedEvidencePackMarkdownPath,
  seedEvidencePackPath,
  seedFetchReportMarkdownPath,
  seedFetchReportPath,
  seedMergeReportMarkdownPath,
  seedMergeReportPath,
  sourceClustersPath,
  sourceClustersRelPath,
  sourceDiscoveryFeedbackReportMarkdownPath,
  sourceDiscoveryFeedbackReportMarkdownRelPath,
  sourceDiscoveryFeedbackReportPath,
  sourceDiscoveryFeedbackReportRelPath,
  sourceQualityReportMarkdownPath,
  sourceQualityReportMarkdownRelPath,
  sourceQualityReportPath,
  sourceQualityReportRelPath
} = require('../common/artifact-paths');
const {
  sourceDiscoveryCandidateStats,
  sourceDiscoveryStatsSummary,
  writeMergedCandidateArtifacts
} = require('../common/candidate-artifacts');
const {
  createGeminiUsageBudget
} = require('../common/gemini-usage-budget');
const {
  writeJson
} = require('../common/common');
const {
  readRuntimeConfig
} = require('../common/runtime-config');
const {
  runGeminiSourceDiscovery
} = require('../collect/gemini-source-discovery');
const {
  approvedCollectionIntentFromManifest
} = require('../collect/collection-intent');
const {
  runSeedEvidenceExpansion
} = require('../collect/seed-evidence');
const {
  extractSourceFacts
} = require('../collect/extract-source-facts');
const {
  checkSourceDuplicates
} = require('../collect/check-source-duplicates');
const {
  renderSourceQualityMarkdown,
  scoreSourceCandidates
} = require('../collect/score-source-candidates');
const {
  validateCandidateEvidence
} = require('../evidence/validate-candidate-evidence');
const {
  candidateTitle,
  candidateUrl,
  text
} = require('../collect/source-intelligence-utils');

const FAILED_LLM_CREDENTIALS = 'FAILED_LLM_CREDENTIALS';
const SEED_ONLY_LLM_CREDENTIALS_MISSING = 'SEED_ONLY_LLM_CREDENTIALS_MISSING';

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--date') {
      args.date = argv[index + 1] || '';
      index += 1;
    } else if (item === '--preflight-only') {
      args.preflightOnly = true;
    }
  }
  return args;
}

function candidateItems(payload = {}) {
  return Array.isArray(payload?.candidates) ? payload.candidates : [];
}

function findManualCandidatePath(root, date) {
  const manualPath = manualCandidatesPath(root, date);
  if (fs.existsSync(manualPath)) return manualPath;
  const legacyPath = collectedCandidatesPath(root, date);
  if (fs.existsSync(legacyPath)) return legacyPath;
  throw new Error(`Missing manual candidate artifact: ${manualCandidatesRelPath(date)} or ${collectedCandidatesRelPath(date)}`);
}

function renderReport({
  date,
  status,
  statusDetail = '',
  disabledPassThrough,
  llmUsed,
  geminiCandidateCount,
  mergeMode,
  discoveryStats = null,
  summary = '',
  sourceCandidateRelPath = '',
  geminiCandidateRelPath = '',
  mergedCandidateRelPath = '',
  manifestRelPath = '',
  proposalRelPath = '',
  proposalValidationReportRelPath = '',
  usageReportRelPath = '',
  sourceQualityReportRelPath = '',
  sourceClustersRelPath = '',
  evidenceValidationReportRelPath = '',
  seedEvidenceRefs = {},
  sourceDiscoveryFeedbackReportRelPath = '',
  sourceDiscoveryFeedbackReportMarkdownRelPath = '',
  sourceDiscoveryFeedbackReport = null,
  rejectedProposals = []
}) {
  const stats = discoveryStats && typeof discoveryStats === 'object' ? discoveryStats : null;
  const countLines = stats
    ? Object.entries(stats).map(([key, value]) => `${key}=${value}`)
    : [`gemini_candidate_count=${geminiCandidateCount}`];
  const reportSummary = summary ||
    (status === FAILED_LLM_CREDENTIALS
      ? 'Gemini source discovery credential preflight failed.'
      : sourceDiscoveryStatsSummary(stats || {}, { llmUsed }));
  const lines = [
    `# Gemini Source Discovery Report - ${date}`,
    '',
    `status=${status}`,
    `status_detail=${statusDetail}`,
    `disabled_pass_through=${disabledPassThrough ? 'true' : 'false'}`,
    `llm_used=${llmUsed ? 'true' : 'false'}`,
    `merge_mode=${mergeMode}`,
    `summary=${reportSummary}`,
    ...countLines,
    ''
  ];

  if (status === FAILED_LLM_CREDENTIALS) {
    lines.push(
      'Enabled Gemini source discovery requires selected LLM provider credentials.',
      'Candidate artifacts were not modified.',
      ''
    );
  } else {
    if (statusDetail === SEED_ONLY_LLM_CREDENTIALS_MISSING) {
      lines.push(
        'Gemini credentials were missing after approved seed evidence expansion.',
        'Seed evidence artifacts and seed-only merged candidates were written; Gemini discovery was skipped.',
        ''
      );
    }
    lines.push(
      `source_candidate_artifact=${sourceCandidateRelPath}`,
      `gemini_source_proposals=${proposalRelPath}`,
      `proposal_validation_report=${proposalValidationReportRelPath}`,
      `gemini_candidate_artifact=${geminiCandidateRelPath}`,
      `merged_candidate_artifact=${mergedCandidateRelPath}`,
      `merged_candidate_manifest=${manifestRelPath}`,
      `gemini_usage_report=${usageReportRelPath}`,
      `source_quality_report=${sourceQualityReportRelPath}`,
      `source_clusters=${sourceClustersRelPath}`,
      `evidence_validation_report=${evidenceValidationReportRelPath}`,
      `seed_candidate_artifact=${seedEvidenceRefs.seed_candidate_artifact || ''}`,
      `seed_evidence_pack=${seedEvidenceRefs.seed_evidence_pack || ''}`,
      `seed_evidence_pack_markdown=${seedEvidenceRefs.seed_evidence_pack_markdown || ''}`,
      `seed_fetch_report=${seedEvidenceRefs.seed_fetch_report || ''}`,
      `seed_fetch_report_markdown=${seedEvidenceRefs.seed_fetch_report_markdown || ''}`,
      `seed_merge_report=${seedEvidenceRefs.seed_merge_report || ''}`,
      `seed_merge_report_markdown=${seedEvidenceRefs.seed_merge_report_markdown || ''}`,
      `source_discovery_feedback_report=${sourceDiscoveryFeedbackReportRelPath}`,
      `source_discovery_feedback_report_markdown=${sourceDiscoveryFeedbackReportMarkdownRelPath}`,
      ''
    );
    lines.push(
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
    );
    if (sourceDiscoveryFeedbackReport) {
      lines.push(...renderSourceDiscoveryFeedbackSummary(
        sourceDiscoveryFeedbackReport,
        sourceDiscoveryFeedbackReportMarkdownRelPath
      ));
    }
    if (rejectedProposals.length > 0) {
      lines.push('## Rejected proposals', '');
      for (const item of rejectedProposals) {
        lines.push(`- ${item.rejected_reason}: ${item.url || 'n/a'}${item.message ? ` (${item.message})` : ''}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

function writeReport(root, date, markdown) {
  const dir = newsroomDir(root, date);
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, 'gemini-source-discovery-report.md');
  fs.writeFileSync(reportPath, markdown, 'utf8');
  return reportPath;
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function removeStaleNormalOutputs(root, date) {
  removeIfExists(mergedCandidatesPath(root, date));
  removeIfExists(mergedCandidateManifestPath(root, date));
  removeIfExists(geminiCandidatesPath(root, date));
  removeIfExists(geminiSourceProposalsPath(root, date));
  removeIfExists(geminiSourceProposalValidationReportPath(root, date));
  removeIfExists(geminiUsageReportPath(root, date));
  removeIfExists(extractedSourceFactsPath(root, date));
  removeIfExists(sourceQualityReportPath(root, date));
  removeIfExists(sourceQualityReportMarkdownPath(root, date));
  removeIfExists(sourceClustersPath(root, date));
  removeIfExists(evidenceValidationReportPath(root, date));
  removeIfExists(seedCandidatesPath(root, date));
  removeIfExists(seedEvidencePackPath(root, date));
  removeIfExists(seedEvidencePackMarkdownPath(root, date));
  removeIfExists(seedFetchReportPath(root, date));
  removeIfExists(seedFetchReportMarkdownPath(root, date));
  removeIfExists(seedMergeReportPath(root, date));
  removeIfExists(seedMergeReportMarkdownPath(root, date));
  removeIfExists(sourceDiscoveryFeedbackReportPath(root, date));
  removeIfExists(sourceDiscoveryFeedbackReportMarkdownPath(root, date));
}

function assertEnabledCredentials(root, date, env, { writeReportOnFailure = true } = {}) {
  try {
    readRuntimeConfig(env, { requireLlmCredentials: true });
  } catch (error) {
    if (writeReportOnFailure) {
      const report = renderReport({
        date,
        status: FAILED_LLM_CREDENTIALS,
        disabledPassThrough: false,
        llmUsed: false,
        geminiCandidateCount: 0,
        mergeMode: 'credential_preflight_failed'
      });
      error.reportPath = writeReport(root, date, report);
    }
    error.status = FAILED_LLM_CREDENTIALS;
    throw error;
  }
}

function enabledCredentialsError(env) {
  try {
    readRuntimeConfig(env, { requireLlmCredentials: true });
    return null;
  } catch (error) {
    return error;
  }
}

function candidatePayload(date, candidates, basePayload = {}) {
  return {
    ...basePayload,
    schema_version: Math.max(Number(basePayload.schema_version || 5), 5),
    date,
    newsletter_date: date,
    generated_at: new Date().toISOString(),
    candidates,
    failures: Array.isArray(basePayload.failures) ? basePayload.failures : []
  };
}

function boolTrue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function firstText(...values) {
  return values.map(text).find(Boolean) || '';
}

function urlParts(value = '') {
  try {
    const parsed = new URL(String(value || '').trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return {
      href: parsed.href,
      hostname,
      pathname: parsed.pathname.toLowerCase(),
      family: `${parsed.protocol.toLowerCase()}//${hostname}${parsed.pathname.replace(/\/$/, '').toLowerCase()}`
    };
  } catch (_error) {
    return {
      href: '',
      hostname: '',
      pathname: '',
      family: ''
    };
  }
}

function normalizedCandidateUrlForFeedback(candidate = {}) {
  const raw = candidateUrl(candidate);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const port = parsed.port ? `:${parsed.port}` : '';
    const pathname = parsed.pathname.replace(/\/$/, '');
    return `${protocol}//${hostname}${port}${pathname}${parsed.hash}`;
  } catch (_error) {
    return String(raw || '').trim();
  }
}

function candidateUrlFamily(candidate = {}) {
  return urlParts(candidateUrl(candidate)).family;
}

function sourceIdentity(candidate = {}) {
  return firstText(
    candidate.source_id,
    candidate.sourceId,
    candidate.source_slug,
    candidate.source,
    candidate.source_name,
    candidate.sourceName
  );
}

function sourceIdentityHaystack(candidate = {}) {
  return [
    candidate.source_id,
    candidate.sourceId,
    candidate.source_slug,
    candidate.source,
    candidate.source_name,
    candidate.sourceName,
    candidate.sourceUrl,
    candidate.source_url
  ].map(text).join(' ').toLowerCase();
}

function sourceIdentitySlug(candidate = {}) {
  return sourceIdentityHaystack(candidate).replace(/[^a-z0-9]+/g, '-');
}

function officialCameraSource(candidate = {}) {
  const parts = urlParts(candidateUrl(candidate));
  const identity = sourceIdentitySlug(candidate);
  if (parts.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parts.pathname)) return true;
  if (parts.hostname === 'source.android.com' && /\bcamera\b/.test(parts.pathname)) return true;
  return /\b(?:android-developers-latest-updates|camerax-release-notes|aosp-site-updates)\b/.test(identity);
}

function parserBackedCameraSource(candidate = {}) {
  const parts = urlParts(candidateUrl(candidate));
  const identity = sourceIdentitySlug(candidate);
  if (parts.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parts.pathname)) return true;
  if (parts.hostname === 'source.android.com' && /\bcamera\b/.test(parts.pathname)) return true;
  return /\b(?:android-developers-latest-updates|camerax-release-notes|aosp-site-updates)\b/.test(identity);
}

function parserGapEligible(candidate = {}) {
  const finalEligibility = firstText(candidate.finalSelectionEligibility, candidate.final_selection_eligibility).toLowerCase();
  const sourceQualityBucket = firstText(candidate.source_quality_bucket).toLowerCase();
  return ['main', 'short'].includes(finalEligibility) ||
    boolTrue(candidate.main_eligible) ||
    ['strong_candidate', 'review_candidate', 'strong', 'review'].includes(sourceQualityBucket);
}

function officialKnownParserBackedUrl(candidate = {}) {
  const parts = urlParts(candidateUrl(candidate));
  if (parts.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parts.pathname)) return true;
  if (parts.hostname === 'source.android.com' && /\bcamera\b/.test(parts.pathname)) return true;
  return false;
}

function sourceValidationStatusAllowsParserGap(candidate = {}) {
  if (!boolTrue(candidate.source_gap_risk)) return true;
  const status = firstText(candidate.evidence_validation_status, candidate.source_validation_status).toLowerCase();
  return ['pass', 'review', 'editor_review_required', 'fetch_failed_review_required'].includes(status);
}

function sourceValidationAllowsParserGap(candidate = {}) {
  return sourceValidationStatusAllowsParserGap(candidate) || officialKnownParserBackedUrl(candidate);
}

function parserGapConfidence(candidate = {}) {
  if (!sourceValidationStatusAllowsParserGap(candidate) && officialKnownParserBackedUrl(candidate)) {
    return 'medium';
  }
  return 'high';
}

function sourceExtractionItemText(item = {}) {
  if (typeof item === 'string') return text(item);
  if (!item || typeof item !== 'object') return '';
  return firstText(item.text, item.body, item.title, item.summary, item.description);
}

function sourceExtractionSections(candidate = {}) {
  const extraction = candidate.source_extraction;
  if (!extraction || typeof extraction !== 'object') return [];
  return [
    ...(Array.isArray(extraction?.release?.sections) ? extraction.release.sections : []),
    ...(Array.isArray(extraction?.minor_line_context?.sections) ? extraction.minor_line_context.sections : [])
  ];
}

function hasConcreteSourceExtractionBullet(candidate = {}) {
  return sourceExtractionSections(candidate)
    .flatMap(section => Array.isArray(section?.items) ? section.items : [])
    .some(item => Boolean(sourceExtractionItemText(item)));
}

function parserGapReason(candidate = {}) {
  if (!candidate.source_extraction || typeof candidate.source_extraction !== 'object') {
    return 'missing_source_extraction';
  }
  if (!hasConcreteSourceExtractionBullet(candidate)) {
    return 'empty_source_extraction_release_sections';
  }
  return '';
}

function parserGapCandidate(candidate = {}) {
  return officialCameraSource(candidate) &&
    parserBackedCameraSource(candidate) &&
    parserGapEligible(candidate) &&
    sourceValidationAllowsParserGap(candidate) &&
    Boolean(parserGapReason(candidate));
}

function adapterHint(candidate = {}) {
  const parts = urlParts(candidateUrl(candidate));
  const identity = sourceIdentitySlug(candidate);
  if (parts.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parts.pathname)) {
    return {
      adapter_hint: 'android-developers-jetpack-release',
      repair_hint: 'Check AndroidX Camera release-note block parser and source_extraction.release.sections extraction.'
    };
  }
  if (/\bandroid-developers-latest-updates\b/.test(identity)) {
    return {
      adapter_hint: 'android-developers-latest-updates',
      repair_hint: 'Check latest updates table/card row extraction and Camera Maven Group row handling.'
    };
  }
  if (parts.hostname === 'source.android.com' && /\bcamera\b/.test(parts.pathname)) {
    return {
      adapter_hint: firstText(candidate.source_id, candidate.sourceId) || 'aosp-site-updates',
      repair_hint: 'Check AOSP camera update row extraction.'
    };
  }
  return {
    adapter_hint: null,
    repair_hint: ''
  };
}

function selectorExclusionReason(candidate = {}) {
  const haystack = [
    candidate.title,
    candidate.version_or_release,
    candidate.versionOrRelease,
    candidate.url,
    candidate.summary,
    candidate.behavior_change
  ].map(text).join(' ');
  if (/camerax|androidx\.camera|\/jetpack\/androidx\/releases\/camera/i.test(haystack)) {
    return 'CameraX release-note candidate has no concrete source_extraction bullet';
  }
  return parserGapReason(candidate) === 'missing_source_extraction'
    ? 'missing source_extraction for official parser-backed candidate'
    : 'source_extraction.release.sections has no concrete bullet';
}

function duplicateDiscoveryMatches(manualCandidates = [], geminiCandidates = []) {
  const exactUrls = new Set();
  const familyUrls = new Set();
  for (const gemini of geminiCandidates) {
    const url = normalizedCandidateUrlForFeedback(gemini);
    const family = candidateUrlFamily(gemini);
    if (url) exactUrls.add(url);
    if (family) familyUrls.add(family);
  }
  const duplicateMatches = new Map();
  for (const manual of manualCandidates) {
    const url = normalizedCandidateUrlForFeedback(manual);
    const family = candidateUrlFamily(manual);
    const key = candidateKey(manual);
    if (url && exactUrls.has(url)) {
      duplicateMatches.set(key, 'exact_normalized_url');
    } else if (family && familyUrls.has(family)) {
      duplicateMatches.set(key, 'same_release_page_family');
    }
  }
  return duplicateMatches;
}

function isGeminiDiscoveryCandidate(candidate = {}) {
  return candidate.origin === 'gemini_discovery' ||
    candidate.collectionStage === 'gemini' ||
    candidate.collection_stage === 'gemini';
}

function buildSourceDiscoveryFeedbackReport({
  date,
  manualCandidates = [],
  mergedCandidates = [],
  geminiCandidates = [],
  proposalValidations = []
} = {}) {
  const duplicateMatches = duplicateDiscoveryMatches(manualCandidates, geminiCandidates);
  const candidatesByKey = new Map();
  for (const candidate of mergedCandidates) {
    if (isGeminiDiscoveryCandidate(candidate)) continue;
    const key = candidateKey(candidate);
    if (key && !candidatesByKey.has(key)) {
      candidatesByKey.set(key, candidate);
    }
  }
  for (const candidate of manualCandidates) {
    const key = candidateKey(candidate);
    if (key && !candidatesByKey.has(key)) {
      candidatesByKey.set(key, candidate);
    }
  }

  const items = [];
  for (const candidate of candidatesByKey.values()) {
    if (!parserGapCandidate(candidate)) continue;
    const hints = adapterHint(candidate);
    const key = candidateKey(candidate);
    const reason = parserGapReason(candidate);
    const title = firstText(candidate.version_or_release, candidate.versionOrRelease, candidateTitle(candidate), candidate.title);
    const duplicateMatchType = duplicateMatches.get(key) || null;
    const item = {
      severity: 'warning',
      action: 'PARSER_REPAIR_REQUIRED',
      reason,
      candidate_title: title,
      url: candidateUrl(candidate),
      source_id: sourceIdentity(candidate),
      adapter_hint: hints.adapter_hint,
      duplicate_discovered_by_gemini: Boolean(duplicateMatchType),
      duplicate_match_type: duplicateMatchType,
      source_gap_risk: boolTrue(candidate.source_gap_risk),
      evidence_validation_status: firstText(candidate.evidence_validation_status, candidate.source_validation_status) || null,
      source_quality_bucket: firstText(candidate.source_quality_bucket) || null,
      final_selection_eligibility: firstText(candidate.final_selection_eligibility, candidate.finalSelectionEligibility) || null,
      confidence: parserGapConfidence(candidate),
      selector_exclusion_reason: selectorExclusionReason(candidate),
      recommendation: hints.repair_hint ||
        'Repair the source parser so the matching official source block preserves concrete source_extraction bullets.'
    };
    items.push(item);
  }

  const gemini_parser_failures = (Array.isArray(proposalValidations) ? proposalValidations : [])
    .filter(item => ['parser_repair_required', 'discovered_not_extractable'].includes(item.rejected_reason))
    .map(item => ({
      severity: 'warning',
      action: 'GEMINI_PARSER_EXTRACTION_REQUIRED',
      candidate_url: item.normalized_url || item.candidate_url || '',
      source_policy_match: item.source_policy_match || '',
      discovery_status: item.discovery_status || 'discovered',
      extraction_status: item.extraction_status || item.rejected_reason,
      adapter_hint: item.adapter_hint || null,
      rejected_reason: item.rejected_reason || '',
      suggested_fixture_case: item.suggested_fixture_case || '',
      message: item.message || ''
    }));
  const duplicateDiscoveryGapCount = items.filter(item => item.duplicate_discovered_by_gemini).length;
  return {
    schema_version: 1,
    report_type: 'source_discovery_feedback',
    date,
    status: items.length > 0 || gemini_parser_failures.length > 0 ? 'WARNING' : 'PASS',
    parser_gap_count: items.length,
    duplicate_discovery_gap_count: duplicateDiscoveryGapCount,
    gemini_parser_failure_count: gemini_parser_failures.length,
    gemini_parser_failures,
    items
  };
}

function renderSourceDiscoveryFeedbackMarkdown(report = {}) {
  const lines = [
    `# Source Discovery Feedback Report - ${report.date || 'unknown'}`,
    '',
    `status=${report.status || 'PASS'}`,
    `parser_gap_count=${Number(report.parser_gap_count || 0)}`,
    `duplicate_discovery_gap_count=${Number(report.duplicate_discovery_gap_count || 0)}`,
    `gemini_parser_failure_count=${Number(report.gemini_parser_failure_count || 0)}`,
    '',
    '| Action | Reason | Candidate | Adapter | Duplicate Discovery | Duplicate Match | Confidence | URL |',
    '|---|---|---|---|---|---|---|---|'
  ];
  for (const item of report.items || []) {
    lines.push([
      item.action || '',
      item.reason || '',
      String(item.candidate_title || '').replace(/\|/g, '\\|'),
      item.adapter_hint || '',
      item.duplicate_discovered_by_gemini ? 'true' : 'false',
      item.duplicate_match_type || '',
      item.confidence || '',
      item.url || ''
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  if (!Array.isArray(report.items) || report.items.length === 0) {
    lines.push('| none | none | none | none | false |  |  |  |');
  }
  lines.push('');

  lines.push('## Gemini parser extraction failures', '');
  lines.push('| Action | Reason | Discovery Status | Extraction Status | Adapter | Source | URL |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const item of report.gemini_parser_failures || []) {
    lines.push([
      item.action || '',
      item.rejected_reason || '',
      item.discovery_status || '',
      item.extraction_status || '',
      item.adapter_hint || '',
      String(item.source_policy_match || '').replace(/\|/g, '\\|'),
      item.candidate_url || ''
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  if (!Array.isArray(report.gemini_parser_failures) || report.gemini_parser_failures.length === 0) {
    lines.push('| none | none | none | none | none | none |  |');
  }
  lines.push('');

  for (const item of report.gemini_parser_failures || []) {
    lines.push(
      `- ${item.action}: ${item.candidate_url || 'unknown'}`,
      `  - rejected_reason: ${item.rejected_reason || ''}`,
      `  - discovery_status: ${item.discovery_status || ''}`,
      `  - extraction_status: ${item.extraction_status || ''}`,
      `  - adapter_hint: ${item.adapter_hint || ''}`,
      `  - suggested_fixture_case: ${item.suggested_fixture_case || ''}`,
      ''
    );
  }

  for (const item of report.items || []) {
    lines.push(
      `- ${item.action}: ${item.candidate_title || 'unknown'}`,
      `  - url: ${item.url || ''}`,
      `  - adapter_hint: ${item.adapter_hint || ''}`,
      `  - reason: ${item.reason || ''}`,
      `  - duplicate_discovered_by_gemini: ${item.duplicate_discovered_by_gemini ? 'true' : 'false'}`,
      `  - duplicate_match_type: ${item.duplicate_match_type || ''}`,
      `  - confidence: ${item.confidence || ''}`,
      `  - source_gap_risk: ${item.source_gap_risk ? 'true' : 'false'}`,
      `  - evidence_validation_status: ${item.evidence_validation_status || ''}`,
      `  - recommendation: ${item.recommendation || ''}`,
      ''
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderSourceDiscoveryFeedbackSummary(report = {}, markdownRelPath = '') {
  const status = report.status || 'PASS';
  const parserGapCount = Number(report.parser_gap_count || 0);
  const duplicateGapCount = Number(report.duplicate_discovery_gap_count || 0);
  const geminiParserFailureCount = Number(report.gemini_parser_failure_count || 0);
  const lines = [
    '## Parser/source feedback',
    '',
    `status=${status}`,
    `parser_gap_count=${parserGapCount}`,
    `duplicate_discovery_gap_count=${duplicateGapCount}`,
    `gemini_parser_failure_count=${geminiParserFailureCount}`
  ];
  if (markdownRelPath) {
    lines.push(`source_discovery_feedback_report_markdown=${markdownRelPath}`);
  }
  lines.push('');
  for (const item of (report.items || []).slice(0, 3)) {
    lines.push(
      `- ${item.action}: ${item.candidate_title || 'unknown'}`,
      `  - url: ${item.url || ''}`,
      `  - adapter_hint: ${item.adapter_hint || ''}`,
      `  - reason: ${item.reason || ''}`,
      `  - duplicate_match_type: ${item.duplicate_match_type || ''}`,
      `  - confidence: ${item.confidence || ''}`,
      item.duplicate_discovered_by_gemini
        ? `  - Gemini rediscovered this URL (${item.duplicate_match_type || 'unknown_match'}), but the manual candidate lacks concrete source_extraction bullets.`
        : '  - Manual candidate lacks concrete source_extraction bullets.'
    );
  }
  if (parserGapCount > 3) {
    lines.push(`- ${parserGapCount - 3} more item(s) in ${markdownRelPath}`);
  }
  for (const item of (report.gemini_parser_failures || []).slice(0, 3)) {
    lines.push(
      `- ${item.action}: ${item.candidate_url || 'unknown'}`,
      `  - rejected_reason: ${item.rejected_reason || ''}`,
      `  - discovery_status: ${item.discovery_status || ''}`,
      `  - extraction_status: ${item.extraction_status || ''}`,
      `  - adapter_hint: ${item.adapter_hint || ''}`,
      `  - suggested_fixture_case: ${item.suggested_fixture_case || ''}`
    );
  }
  if (geminiParserFailureCount > 3) {
    lines.push(`- ${geminiParserFailureCount - 3} more Gemini parser failure item(s) in ${markdownRelPath}`);
  }
  lines.push('');
  return lines;
}

function writeSourceDiscoveryFeedbackReport(root, date, report) {
  const dir = newsroomDir(root, date);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(sourceDiscoveryFeedbackReportPath(root, date), report);
  fs.writeFileSync(sourceDiscoveryFeedbackReportMarkdownPath(root, date), renderSourceDiscoveryFeedbackMarkdown(report), 'utf8');
  return {
    report,
    jsonPath: sourceDiscoveryFeedbackReportPath(root, date),
    markdownPath: sourceDiscoveryFeedbackReportMarkdownPath(root, date),
    jsonRelPath: sourceDiscoveryFeedbackReportRelPath(date),
    markdownRelPath: sourceDiscoveryFeedbackReportMarkdownRelPath(date)
  };
}

function candidateKey(candidate = {}) {
  return candidate.id || candidate.source_candidate_id || candidateUrl(candidate) || candidateTitle(candidate);
}

function candidatePublishedDate(candidate = {}) {
  return String(candidate.published_date || candidate.publishedAt || candidate.publishedDate || '').trim();
}

function evidenceReliabilityRank(candidate = {}) {
  const reliability = String(candidate.reliability || candidate.source_reliability || '').trim().toLowerCase();
  return ['official', 'upstream', 'project-official'].includes(reliability) ? 0 : 1;
}

function evidencePriority(candidate = {}, isCanonical = false) {
  const score = Number(candidate.source_quality_score || 0);
  return {
    canonical_rank: isCanonical ? 0 : 1,
    bucket_rank: candidate.source_quality_bucket === 'strong_candidate' ? 0 : 1,
    score: Number.isFinite(score) ? score : 0,
    reliability_rank: evidenceReliabilityRank(candidate),
    published_date: candidatePublishedDate(candidate),
    stable_key: String(candidateKey(candidate) || '')
  };
}

function compareEvidenceTargets(left, right) {
  const a = left.priority;
  const b = right.priority;
  return a.canonical_rank - b.canonical_rank ||
    a.bucket_rank - b.bucket_rank ||
    b.score - a.score ||
    a.reliability_rank - b.reliability_rank ||
    b.published_date.localeCompare(a.published_date) ||
    a.stable_key.localeCompare(b.stable_key);
}

function selectEvidenceFetchTargets(candidates = [], clusterReport = {}, options = {}) {
  const maxTargets = options.maxTargets || 12;
  const canonicalRefs = new Set();
  for (const cluster of clusterReport.clusters || []) {
    if (Number(cluster.duplicate_count || 0) <= 0) continue;
    if (cluster.canonical_url) canonicalRefs.add(`url:${cluster.canonical_url}`);
    if (cluster.canonical_title) canonicalRefs.add(`title:${cluster.canonical_title}`);
  }

  const targetMap = new Map();
  function isCanonical(candidate) {
    return canonicalRefs.has(`url:${candidateUrl(candidate)}`) ||
      canonicalRefs.has(`title:${candidateTitle(candidate)}`);
  }
  function add(candidate, canonical = false) {
    const key = candidateKey(candidate);
    if (!key) return;
    const existing = targetMap.get(key);
    targetMap.set(key, {
      candidate,
      isCanonical: canonical || existing?.isCanonical === true
    });
  }

  for (const candidate of candidates) {
    const finalEligible = ['main', 'short'].includes(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
    const qualityEligible = ['strong_candidate', 'review_candidate'].includes(candidate.source_quality_bucket);
    if (finalEligible && qualityEligible && candidate.duplicate_of_selected_source !== true) {
      add(candidate, isCanonical(candidate));
    }
  }

  for (const candidate of candidates) {
    const canonical = isCanonical(candidate);
    if (canonical && candidate.duplicate_of_selected_source !== true) {
      add(candidate, true);
    }
  }

  return [...targetMap.values()]
    .map(item => ({
      candidate: item.candidate,
      priority: evidencePriority(item.candidate, item.isCanonical)
    }))
    .sort(compareEvidenceTargets)
    .slice(0, maxTargets)
    .map(item => item.candidate);
}

function writeSeedOnlySourceDiscoveryResult({
  root,
  date,
  manualPayload,
  sourceCandidatePath,
  sourceManifestPath,
  seedExpansion,
  statusDetail = ''
}) {
  const manualCandidates = candidateItems(manualPayload);
  const seedUsed = seedExpansion?.stats?.seed_used === true;
  const mergeMode = seedUsed ? 'seed_evidence_expansion' : 'disabled_pass_through';
  const mergedCandidates = seedExpansion ? seedExpansion.mergedCandidates : manualCandidates;
  const mergedPayload = seedUsed ? candidatePayload(date, mergedCandidates, manualPayload) : manualPayload;
  const discoveryStats = sourceDiscoveryCandidateStats({
    manualCandidates,
    seedCandidates: seedExpansion?.seedCandidates || [],
    geminiCandidates: [],
    mergedCandidates
  });
  if (seedExpansion?.stats) {
    Object.assign(discoveryStats, seedExpansion.stats);
  }
  const feedback = writeSourceDiscoveryFeedbackReport(root, date, buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates,
    geminiCandidates: [],
    mergedCandidates
  }));
  const generatedAt = new Date().toISOString();
  const result = writeMergedCandidateArtifacts({
    root,
    date,
    payload: mergedPayload,
    sourceCandidatePath,
    sourceManifestPath,
    seedPayload: seedExpansion?.seedPayload || null,
    geminiPayload: [],
    generatedAt,
    mergeMode,
    geminiCandidateCount: 0,
    llmUsed: false,
    seedUsed,
    status: 'PASS',
    statusDetail,
    manifestSchemaVersion: seedUsed ? 2 : 1,
    discoveryStats,
    reportRefs: {
      ...(seedExpansion?.reportRefs || {}),
      source_discovery_feedback_report: feedback.jsonRelPath,
      source_discovery_feedback_report_markdown: feedback.markdownRelPath
    }
  });
  const sourceCandidateRelPath = sourceCandidatePath.endsWith('manual-candidates.json')
    ? manualCandidatesRelPath(date)
    : collectedCandidatesRelPath(date);
  const report = renderReport({
    date,
    status: 'PASS',
    statusDetail,
    disabledPassThrough: !seedUsed,
    llmUsed: false,
    geminiCandidateCount: 0,
    mergeMode,
    discoveryStats,
    summary: statusDetail === SEED_ONLY_LLM_CREDENTIALS_MISSING
      ? 'Seed evidence expansion ran; Gemini discovery was skipped because LLM credentials were missing.'
      : seedUsed
        ? 'Seed evidence expansion ran without Gemini; manual candidates were merged with approved seed evidence.'
        : sourceDiscoveryStatsSummary(discoveryStats, { llmUsed: false }),
    sourceCandidateRelPath,
    geminiCandidateRelPath: geminiCandidatesRelPath(date),
    mergedCandidateRelPath: mergedCandidatesRelPath(date),
    manifestRelPath: mergedCandidateManifestRelPath(date),
    seedEvidenceRefs: seedExpansion?.reportRefs || {},
    sourceDiscoveryFeedbackReportRelPath: feedback.jsonRelPath,
    sourceDiscoveryFeedbackReportMarkdownRelPath: feedback.markdownRelPath,
    sourceDiscoveryFeedbackReport: feedback.report
  });
  const reportPath = writeReport(root, date, report);

  return {
    date,
    status: 'PASS',
    status_detail: statusDetail,
    candidate_count: mergedPayload.candidates?.length ?? candidateItems(manualPayload).length,
    source_candidate_artifact: sourceCandidateRelPath,
    source_manifest: fs.existsSync(sourceManifestPath) ? rawCandidateManifestRelPath(date) : '',
    gemini_candidate_artifact: geminiCandidatesRelPath(date),
    merged_candidate_artifact: mergedCandidatesRelPath(date),
    merged_candidate_manifest: mergedCandidateManifestRelPath(date),
    seed_candidate_artifact: seedExpansion?.reportRefs?.seed_candidate_artifact || '',
    seed_evidence_pack: seedExpansion?.reportRefs?.seed_evidence_pack || '',
    source_discovery_feedback_report: feedback.jsonRelPath,
    source_discovery_feedback_report_markdown: feedback.markdownRelPath,
    report: newsroomRelPath(date, 'gemini-source-discovery-report.md'),
    reportPath,
    manifest: result.manifest
  };
}

async function runEnabled({
  root,
  env,
  date,
  preflightOnly = false,
  proposalPayload = null,
  callLlmJsonBudgetedImpl = null,
  fetchImpl = globalThis.fetch,
  lookupImpl
}) {
  if (preflightOnly) {
    assertEnabledCredentials(root, date, env);
    return {
      date,
      status: 'PASS',
      preflight_only: true
    };
  }

  const sourceCandidatePath = findManualCandidatePath(root, date);
  const manualPayload = readJson(sourceCandidatePath);
  const sourceCandidateRelPath = sourceCandidatePath.endsWith('manual-candidates.json')
    ? manualCandidatesRelPath(date)
    : collectedCandidatesRelPath(date);
  const sourceManifestPath = rawCandidateManifestPath(root, date);
  const sourceManifest = fs.existsSync(sourceManifestPath) ? readJson(sourceManifestPath) : {};
  const collectionIntent = approvedCollectionIntentFromManifest({
    root,
    date,
    manifest: sourceManifest
  });
  const hasSeedUrls = Number(collectionIntent?.seedUrlCount || 0) > 0;
  if (!hasSeedUrls) {
    assertEnabledCredentials(root, date, env, { writeReportOnFailure: false });
  }
  removeStaleNormalOutputs(root, date);

  const seedExpansion = hasSeedUrls
    ? await runSeedEvidenceExpansion({
        root,
        date,
        manualPayload,
        collectionIntent,
        fetchImpl,
        lookupImpl
      })
    : null;
  const credentialError = hasSeedUrls ? enabledCredentialsError(env) : null;
  if (credentialError) {
    return writeSeedOnlySourceDiscoveryResult({
      root,
      date,
      manualPayload,
      sourceCandidatePath,
      sourceManifestPath,
      seedExpansion,
      statusDetail: SEED_ONLY_LLM_CREDENTIALS_MISSING
    });
  }
  const budget = createGeminiUsageBudget({ root });
  const discovery = await runGeminiSourceDiscovery({
    root,
    date,
    manualPayload,
    budget,
    proposalPayload,
    callLlmJsonBudgetedImpl,
    fetchImpl
  });
  const manualCandidates = candidateItems(manualPayload);
  const seedCandidates = seedExpansion?.seedCandidates || [];
  const geminiCandidates = discovery.promotedCandidates;
  const mergedInput = [
    ...(seedExpansion ? seedExpansion.mergedCandidates : manualCandidates),
    ...geminiCandidates
  ];
  const seedUsed = seedExpansion?.stats?.seed_used === true;
  const mergeMode = seedUsed ? 'seed_evidence_plus_gemini_discovery' : 'gemini_source_discovery';

  const scored = scoreSourceCandidates(mergedInput, { newsletterDate: date });
  writeJson(sourceQualityReportPath(root, date), scored.report);
  fs.writeFileSync(sourceQualityReportMarkdownPath(root, date), renderSourceQualityMarkdown(scored.report), 'utf8');

  const clustered = checkSourceDuplicates(scored.annotatedCandidates, { newsletterDate: date });
  writeJson(sourceClustersPath(root, date), clustered.report);

  const evidenceFetchTargets = selectEvidenceFetchTargets(clustered.annotatedCandidates, clustered.report, { maxTargets: 12 });
  const sourceFacts = await extractSourceFacts(evidenceFetchTargets, {
    fetch: true,
    fetchImpl,
    timeoutMs: 5000,
    maxBytes: 200000,
    metadataFallback: false
  });
  writeJson(extractedSourceFactsPath(root, date), sourceFacts);

  const evidence = validateCandidateEvidence(clustered.annotatedCandidates, sourceFacts, { newsletterDate: date });
  writeJson(evidenceValidationReportPath(root, date), evidence.report);

  const usageReport = budget.writeReport(geminiUsageReportPath(root, date), {
    date,
    calls: discovery.calls
  });

  const geminiAnnotatedCandidates = evidence.annotatedCandidates.filter(item => item.origin === 'gemini_discovery');
  const discoveryStats = sourceDiscoveryCandidateStats({
    manualCandidates,
    seedCandidates,
    geminiCandidates: geminiAnnotatedCandidates,
    mergedCandidates: evidence.annotatedCandidates
  });
  if (seedExpansion?.stats) {
    Object.assign(discoveryStats, seedExpansion.stats);
  }
  const feedback = writeSourceDiscoveryFeedbackReport(root, date, buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates,
    geminiCandidates: geminiAnnotatedCandidates,
    mergedCandidates: evidence.annotatedCandidates,
    proposalValidations: discovery.proposalValidationReport.validations
  }));
  const mergedPayload = candidatePayload(date, evidence.annotatedCandidates, manualPayload);
  const geminiPayload = candidatePayload(date, geminiAnnotatedCandidates, {
    failures: discovery.rejectedProposals
  });
  const generatedAt = new Date().toISOString();
  const result = writeMergedCandidateArtifacts({
    root,
    date,
    payload: mergedPayload,
    sourceCandidatePath,
    sourceManifestPath,
    seedPayload: seedExpansion?.seedPayload || null,
    geminiPayload,
    generatedAt,
    mergeMode,
    geminiCandidateCount: geminiPayload.candidates.length,
    llmUsed: true,
    seedUsed,
    status: 'PASS',
    manifestSchemaVersion: 2,
    discoveryStats,
    reportRefs: {
      usage_report: geminiUsageReportRelPath(date),
      proposal_validation_report: geminiSourceProposalValidationReportRelPath(date),
      source_quality_report: sourceQualityReportRelPath(date),
      source_quality_report_markdown: sourceQualityReportMarkdownRelPath(date),
      source_clusters: sourceClustersRelPath(date),
      evidence_validation_report: evidenceValidationReportRelPath(date),
      ...(seedExpansion?.reportRefs || {}),
      source_discovery_feedback_report: feedback.jsonRelPath,
      source_discovery_feedback_report_markdown: feedback.markdownRelPath
    }
  });
  const report = renderReport({
    date,
    status: 'PASS',
    disabledPassThrough: false,
    llmUsed: true,
    geminiCandidateCount: geminiPayload.candidates.length,
    mergeMode,
    discoveryStats,
    summary: sourceDiscoveryStatsSummary(discoveryStats, { llmUsed: true }),
    sourceCandidateRelPath,
    proposalRelPath: geminiSourceProposalsRelPath(date),
    proposalValidationReportRelPath: geminiSourceProposalValidationReportRelPath(date),
    geminiCandidateRelPath: geminiCandidatesRelPath(date),
    mergedCandidateRelPath: mergedCandidatesRelPath(date),
    manifestRelPath: mergedCandidateManifestRelPath(date),
    usageReportRelPath: geminiUsageReportRelPath(date),
    sourceQualityReportRelPath: sourceQualityReportRelPath(date),
    sourceClustersRelPath: sourceClustersRelPath(date),
    evidenceValidationReportRelPath: evidenceValidationReportRelPath(date),
    seedEvidenceRefs: seedExpansion?.reportRefs || {},
    sourceDiscoveryFeedbackReportRelPath: feedback.jsonRelPath,
    sourceDiscoveryFeedbackReportMarkdownRelPath: feedback.markdownRelPath,
    sourceDiscoveryFeedbackReport: feedback.report,
    rejectedProposals: discovery.rejectedProposals
  });
  const reportPath = writeReport(root, date, report);

  return {
    date,
    status: 'PASS',
    candidate_count: mergedPayload.candidates.length,
    source_candidate_artifact: sourceCandidateRelPath,
    source_manifest: fs.existsSync(sourceManifestPath) ? rawCandidateManifestRelPath(date) : '',
    gemini_source_proposals: geminiSourceProposalsRelPath(date),
    proposal_validation_report: geminiSourceProposalValidationReportRelPath(date),
    gemini_candidate_artifact: geminiCandidatesRelPath(date),
    merged_candidate_artifact: mergedCandidatesRelPath(date),
    merged_candidate_manifest: mergedCandidateManifestRelPath(date),
    seed_candidate_artifact: seedExpansion?.reportRefs?.seed_candidate_artifact || '',
    seed_evidence_pack: seedExpansion?.reportRefs?.seed_evidence_pack || '',
    source_discovery_feedback_report: feedback.jsonRelPath,
    source_discovery_feedback_report_markdown: feedback.markdownRelPath,
    report: newsroomRelPath(date, 'gemini-source-discovery-report.md'),
    reportPath,
    usageReport,
    manifest: result.manifest
  };
}

async function run({
  root = process.cwd(),
  env = process.env,
  date: inputDate = '',
  preflightOnly = false,
  proposalPayload = null,
  callLlmJsonBudgetedImpl = null,
  fetchImpl = globalThis.fetch,
  lookupImpl
} = {}) {
  const runtimeConfig = readRuntimeConfig(env);
  const date = inputDate || runtimeConfig.newsletterDate || kstDate();

  if (runtimeConfig.newsroomEnableGeminiSourceDiscovery) {
    return runEnabled({
      root,
      env,
      date,
      preflightOnly,
      proposalPayload,
      callLlmJsonBudgetedImpl,
      fetchImpl,
      lookupImpl
    });
  }

  const sourceCandidatePath = findManualCandidatePath(root, date);
  const payload = readJson(sourceCandidatePath);
  const manualCandidates = candidateItems(payload);
  const sourceManifestPath = rawCandidateManifestPath(root, date);
  const sourceManifest = fs.existsSync(sourceManifestPath) ? readJson(sourceManifestPath) : {};
  removeStaleNormalOutputs(root, date);
  const collectionIntent = approvedCollectionIntentFromManifest({
    root,
    date,
    manifest: sourceManifest
  });
  const hasSeedUrls = Number(collectionIntent?.seedUrlCount || 0) > 0;
  const seedExpansion = hasSeedUrls
    ? await runSeedEvidenceExpansion({
        root,
        date,
        manualPayload: payload,
        collectionIntent,
        fetchImpl,
        lookupImpl
      })
    : null;
  const seedUsed = seedExpansion?.stats?.seed_used === true;
  const mergeMode = seedUsed ? 'seed_evidence_expansion' : 'disabled_pass_through';
  const mergedCandidates = seedExpansion ? seedExpansion.mergedCandidates : manualCandidates;
  const mergedPayload = seedUsed ? candidatePayload(date, mergedCandidates, payload) : payload;
  const generatedAt = new Date().toISOString();
  const discoveryStats = sourceDiscoveryCandidateStats({
    manualCandidates,
    seedCandidates: seedExpansion?.seedCandidates || [],
    geminiCandidates: [],
    mergedCandidates
  });
  if (seedExpansion?.stats) {
    Object.assign(discoveryStats, seedExpansion.stats);
  }
  const result = writeMergedCandidateArtifacts({
    root,
    date,
    payload: mergedPayload,
    sourceCandidatePath,
    sourceManifestPath,
    seedPayload: seedExpansion?.seedPayload || null,
    geminiPayload: [],
    generatedAt,
    mergeMode,
    geminiCandidateCount: 0,
    llmUsed: false,
    seedUsed,
    status: 'PASS',
    manifestSchemaVersion: seedUsed ? 2 : 1,
    discoveryStats,
    reportRefs: seedExpansion?.reportRefs || {}
  });
  const feedback = writeSourceDiscoveryFeedbackReport(root, date, buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates,
    geminiCandidates: [],
    mergedCandidates
  }));
  const sourceCandidateRelPath = sourceCandidatePath.endsWith('manual-candidates.json')
    ? manualCandidatesRelPath(date)
    : collectedCandidatesRelPath(date);
  const report = renderReport({
    date,
    status: 'PASS',
    disabledPassThrough: !seedUsed,
    llmUsed: false,
    geminiCandidateCount: 0,
    mergeMode,
    discoveryStats,
    summary: seedUsed
      ? 'Seed evidence expansion ran without Gemini; manual candidates were merged with approved seed evidence.'
      : sourceDiscoveryStatsSummary(discoveryStats, { llmUsed: false }),
    sourceCandidateRelPath,
    geminiCandidateRelPath: geminiCandidatesRelPath(date),
    mergedCandidateRelPath: mergedCandidatesRelPath(date),
    manifestRelPath: mergedCandidateManifestRelPath(date),
    seedEvidenceRefs: seedExpansion?.reportRefs || {},
    sourceDiscoveryFeedbackReportRelPath: feedback.jsonRelPath,
    sourceDiscoveryFeedbackReportMarkdownRelPath: feedback.markdownRelPath,
    sourceDiscoveryFeedbackReport: feedback.report
  });
  const reportPath = writeReport(root, date, report);

  return {
    date,
    status: 'PASS',
    candidate_count: candidateItems(payload).length,
    source_candidate_artifact: sourceCandidateRelPath,
    source_manifest: fs.existsSync(sourceManifestPath) ? rawCandidateManifestRelPath(date) : '',
    gemini_candidate_artifact: geminiCandidatesRelPath(date),
    merged_candidate_artifact: mergedCandidatesRelPath(date),
    merged_candidate_manifest: mergedCandidateManifestRelPath(date),
    seed_candidate_artifact: seedExpansion?.reportRefs?.seed_candidate_artifact || '',
    seed_evidence_pack: seedExpansion?.reportRefs?.seed_evidence_pack || '',
    source_discovery_feedback_report: feedback.jsonRelPath,
    source_discovery_feedback_report_markdown: feedback.markdownRelPath,
    report: newsroomRelPath(date, 'gemini-source-discovery-report.md'),
    reportPath,
    manifest: result.manifest
  };
}

if (require.main === module) {
  Promise.resolve()
    .then(() => {
      const args = parseArgs();
      return run({ date: args.date, preflightOnly: args.preflightOnly });
    })
    .then((result) => {
      if (result.preflight_only) {
        console.log('Gemini source discovery credential preflight passed.');
        return;
      }
      console.log(`Gemini source discovery wrote ${result.merged_candidate_artifact}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  FAILED_LLM_CREDENTIALS,
  SEED_ONLY_LLM_CREDENTIALS_MISSING,
  buildSourceDiscoveryFeedbackReport,
  findManualCandidatePath,
  parseArgs,
  renderReport,
  renderSourceDiscoveryFeedbackMarkdown,
  run,
  selectEvidenceFetchTargets
};
