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
  sourceClustersPath,
  sourceClustersRelPath,
  sourceQualityReportMarkdownPath,
  sourceQualityReportMarkdownRelPath,
  sourceQualityReportPath,
  sourceQualityReportRelPath
} = require('../common/artifact-paths');
const {
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

const FAILED_LLM_CREDENTIALS = 'FAILED_LLM_CREDENTIALS';

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
  disabledPassThrough,
  llmUsed,
  geminiCandidateCount,
  mergeMode,
  sourceCandidateRelPath = '',
  geminiCandidateRelPath = '',
  mergedCandidateRelPath = '',
  manifestRelPath = '',
  proposalRelPath = '',
  usageReportRelPath = '',
  sourceQualityReportRelPath = '',
  sourceClustersRelPath = '',
  evidenceValidationReportRelPath = '',
  rejectedProposals = []
}) {
  const lines = [
    `# Gemini Source Discovery Report - ${date}`,
    '',
    `status=${status}`,
    `disabled_pass_through=${disabledPassThrough ? 'true' : 'false'}`,
    `llm_used=${llmUsed ? 'true' : 'false'}`,
    `gemini_candidate_count=${geminiCandidateCount}`,
    `merge_mode=${mergeMode}`,
    ''
  ];

  if (status === FAILED_LLM_CREDENTIALS) {
    lines.push(
      'Enabled Gemini source discovery requires selected LLM provider credentials.',
      'Candidate artifacts were not modified.',
      ''
    );
  } else {
    lines.push(
      `source_candidate_artifact=${sourceCandidateRelPath}`,
      `gemini_source_proposals=${proposalRelPath}`,
      `gemini_candidate_artifact=${geminiCandidateRelPath}`,
      `merged_candidate_artifact=${mergedCandidateRelPath}`,
      `merged_candidate_manifest=${manifestRelPath}`,
      `gemini_usage_report=${usageReportRelPath}`,
      `source_quality_report=${sourceQualityReportRelPath}`,
      `source_clusters=${sourceClustersRelPath}`,
      `evidence_validation_report=${evidenceValidationReportRelPath}`,
      ''
    );
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
  removeIfExists(geminiUsageReportPath(root, date));
  removeIfExists(extractedSourceFactsPath(root, date));
  removeIfExists(sourceQualityReportPath(root, date));
  removeIfExists(sourceQualityReportMarkdownPath(root, date));
  removeIfExists(sourceClustersPath(root, date));
  removeIfExists(evidenceValidationReportPath(root, date));
}

function assertEnabledCredentials(root, date, env) {
  try {
    readRuntimeConfig(env, { requireLlmCredentials: true });
  } catch (error) {
    const report = renderReport({
      date,
      status: FAILED_LLM_CREDENTIALS,
      disabledPassThrough: false,
      llmUsed: false,
      geminiCandidateCount: 0,
      mergeMode: 'credential_preflight_failed'
    });
    const reportPath = writeReport(root, date, report);
    error.status = FAILED_LLM_CREDENTIALS;
    error.reportPath = reportPath;
    throw error;
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

async function runEnabled({
  root,
  env,
  date,
  preflightOnly = false,
  proposalPayload = null,
  callLlmJsonBudgetedImpl = null,
  fetchImpl = globalThis.fetch
}) {
  assertEnabledCredentials(root, date, env);
  if (preflightOnly) {
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
  removeStaleNormalOutputs(root, date);

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
  const geminiCandidates = discovery.promotedCandidates;
  const mergedInput = [...manualCandidates, ...geminiCandidates];

  const sourceFacts = await extractSourceFacts(mergedInput, { fetch: false });
  writeJson(extractedSourceFactsPath(root, date), sourceFacts);

  const scored = scoreSourceCandidates(mergedInput, { newsletterDate: date });
  writeJson(sourceQualityReportPath(root, date), scored.report);
  fs.writeFileSync(sourceQualityReportMarkdownPath(root, date), renderSourceQualityMarkdown(scored.report), 'utf8');

  const clustered = checkSourceDuplicates(scored.annotatedCandidates, { newsletterDate: date });
  writeJson(sourceClustersPath(root, date), clustered.report);

  const evidence = validateCandidateEvidence(clustered.annotatedCandidates, sourceFacts, { newsletterDate: date });
  writeJson(evidenceValidationReportPath(root, date), evidence.report);

  budget.mergeDiagnostics(discovery.diagnostics);
  const usageReport = budget.writeReport(geminiUsageReportPath(root, date), {
    date,
    calls: discovery.calls
  });

  const mergedPayload = candidatePayload(date, evidence.annotatedCandidates, manualPayload);
  const geminiPayload = candidatePayload(date, evidence.annotatedCandidates.filter(item => item.origin === 'gemini_discovery'), {
    failures: discovery.rejectedProposals
  });
  const generatedAt = new Date().toISOString();
  const result = writeMergedCandidateArtifacts({
    root,
    date,
    payload: mergedPayload,
    sourceCandidatePath,
    sourceManifestPath,
    geminiPayload,
    generatedAt,
    mergeMode: 'gemini_source_discovery',
    geminiCandidateCount: geminiPayload.candidates.length,
    llmUsed: true,
    status: 'PASS',
    manifestSchemaVersion: 2,
    reportRefs: {
      usage_report: geminiUsageReportRelPath(date),
      source_quality_report: sourceQualityReportRelPath(date),
      source_quality_report_markdown: sourceQualityReportMarkdownRelPath(date),
      source_clusters: sourceClustersRelPath(date),
      evidence_validation_report: evidenceValidationReportRelPath(date)
    }
  });
  const report = renderReport({
    date,
    status: 'PASS',
    disabledPassThrough: false,
    llmUsed: true,
    geminiCandidateCount: geminiPayload.candidates.length,
    mergeMode: 'gemini_source_discovery',
    sourceCandidateRelPath,
    proposalRelPath: geminiSourceProposalsRelPath(date),
    geminiCandidateRelPath: geminiCandidatesRelPath(date),
    mergedCandidateRelPath: mergedCandidatesRelPath(date),
    manifestRelPath: mergedCandidateManifestRelPath(date),
    usageReportRelPath: geminiUsageReportRelPath(date),
    sourceQualityReportRelPath: sourceQualityReportRelPath(date),
    sourceClustersRelPath: sourceClustersRelPath(date),
    evidenceValidationReportRelPath: evidenceValidationReportRelPath(date),
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
    gemini_candidate_artifact: geminiCandidatesRelPath(date),
    merged_candidate_artifact: mergedCandidatesRelPath(date),
    merged_candidate_manifest: mergedCandidateManifestRelPath(date),
    report: newsroomRelPath(date, 'gemini-source-discovery-report.md'),
    reportPath,
    usageReport,
    manifest: result.manifest
  };
}

function run({
  root = process.cwd(),
  env = process.env,
  date: inputDate = '',
  preflightOnly = false,
  proposalPayload = null,
  callLlmJsonBudgetedImpl = null,
  fetchImpl = globalThis.fetch
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
      fetchImpl
    });
  }

  const sourceCandidatePath = findManualCandidatePath(root, date);
  const payload = readJson(sourceCandidatePath);
  const sourceManifestPath = rawCandidateManifestPath(root, date);
  const generatedAt = new Date().toISOString();
  const result = writeMergedCandidateArtifacts({
    root,
    date,
    payload,
    sourceCandidatePath,
    sourceManifestPath,
    geminiPayload: [],
    generatedAt,
    mergeMode: 'disabled_pass_through',
    geminiCandidateCount: 0,
    llmUsed: false,
    status: 'PASS'
  });
  const sourceCandidateRelPath = sourceCandidatePath.endsWith('manual-candidates.json')
    ? manualCandidatesRelPath(date)
    : collectedCandidatesRelPath(date);
  const report = renderReport({
    date,
    status: 'PASS',
    disabledPassThrough: true,
    llmUsed: false,
    geminiCandidateCount: 0,
    mergeMode: 'disabled_pass_through',
    sourceCandidateRelPath,
    geminiCandidateRelPath: geminiCandidatesRelPath(date),
    mergedCandidateRelPath: mergedCandidatesRelPath(date),
    manifestRelPath: mergedCandidateManifestRelPath(date)
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
  findManualCandidatePath,
  parseArgs,
  renderReport,
  run
};
