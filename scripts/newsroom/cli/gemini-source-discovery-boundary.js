const fs = require('fs');
const path = require('path');

const {
  kstDate,
  readJson
} = require('../common/common');
const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  geminiCandidatesPath,
  geminiCandidatesRelPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  mergedCandidateManifestPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesPath,
  mergedCandidatesRelPath,
  newsroomDir,
  newsroomRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath
} = require('../common/artifact-paths');
const {
  writeMergedCandidateArtifacts
} = require('../common/candidate-artifacts');
const {
  readRuntimeConfig
} = require('../common/runtime-config');

const FAILED_NOT_IMPLEMENTED = 'FAILED_GEMINI_SOURCE_DISCOVERY_NOT_IMPLEMENTED';

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--date') {
      args.date = argv[index + 1] || '';
      index += 1;
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
  manifestRelPath = ''
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

  if (status === FAILED_NOT_IMPLEMENTED) {
    lines.push(
      'Gemini discovery engine is not implemented in #88.',
      'Manual candidates were not modified.',
      'Stage 3 must use Stage 1 artifact instead of failed Stage 2 output.',
      ''
    );
  } else {
    lines.push(
      `source_candidate_artifact=${sourceCandidateRelPath}`,
      `gemini_candidate_artifact=${geminiCandidateRelPath}`,
      `merged_candidate_artifact=${mergedCandidateRelPath}`,
      `merged_candidate_manifest=${manifestRelPath}`,
      ''
    );
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
}

function run({
  root = process.cwd(),
  env = process.env,
  date: inputDate = ''
} = {}) {
  const runtimeConfig = readRuntimeConfig(env);
  const date = inputDate || runtimeConfig.newsletterDate || kstDate();

  if (runtimeConfig.newsroomEnableGeminiSourceDiscovery) {
    removeStaleNormalOutputs(root, date);
    const report = renderReport({
      date,
      status: FAILED_NOT_IMPLEMENTED,
      disabledPassThrough: false,
      llmUsed: false,
      geminiCandidateCount: 0,
      mergeMode: 'not_implemented'
    });
    const reportPath = writeReport(root, date, report);
    const error = new Error(`${FAILED_NOT_IMPLEMENTED}: Gemini source discovery engine is not implemented in #88.`);
    error.status = FAILED_NOT_IMPLEMENTED;
    error.reportPath = reportPath;
    throw error;
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
  try {
    const args = parseArgs();
    const result = run({ date: args.date });
    console.log(`Gemini source discovery disabled pass-through wrote ${result.merged_candidate_artifact}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  FAILED_NOT_IMPLEMENTED,
  findManualCandidatePath,
  parseArgs,
  renderReport,
  run
};
