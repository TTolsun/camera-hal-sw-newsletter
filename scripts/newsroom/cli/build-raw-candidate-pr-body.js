const fs = require('fs');
const path = require('path');

const {
  kstDate,
  readJson
} = require('../common/common');
const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath
} = require('../common/artifact-paths');
const {
  BUCKETS
} = require('../common/aosp-camera-scope');
const {
  readRuntimeConfig
} = require('../common/runtime-config');

const DIRECT_CAMERA_BUCKETS = new Set([
  BUCKETS.DIRECT_AOSP_CAMERA,
  BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
  BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT
]);

function candidateItems(payload = {}) {
  return Array.isArray(payload?.candidates) ? payload.candidates : [];
}

function firstText(values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function candidateBucket(candidate = {}) {
  return firstText([
    candidate.relevance_bucket,
    candidate.relevanceBucket,
    candidate.bucket
  ]);
}

function hasCameraXSignal(candidate = {}) {
  const text = [
    candidate.title,
    candidate.summary,
    candidate.url,
    candidate.articleUrl,
    candidate.article_url,
    candidate.api_or_component,
    candidate.version_or_release
  ].join(' ').toLowerCase();
  return text.includes('camerax') || text.includes('androidx.camera');
}

function summarizeRawCandidates(payload = {}, manifest = null) {
  const candidates = candidateItems(payload);
  const officialCount = candidates.filter(candidate => {
    const reliability = firstText([candidate.source_reliability, candidate.reliability]).toLowerCase();
    return ['official', 'project-official', 'official-community'].includes(reliability);
  }).length;
  const genericNoiseCount = candidates.filter(candidate => {
    const bucket = candidateBucket(candidate);
    return bucket === BUCKETS.GENERIC_TECH_WATCHLIST || candidate.finalSelectionEligibility === 'watchlist';
  }).length;
  const directCameraBucketCount = candidates.filter(candidate =>
    DIRECT_CAMERA_BUCKETS.has(candidateBucket(candidate))
  ).length;
  const cameraXCount = candidates.filter(hasCameraXSignal).length;
  const socPlatformCount = candidates.filter(candidate =>
    candidateBucket(candidate) === BUCKETS.SOC_PLATFORM_SIGNAL
  ).length;
  const officialRatio = candidates.length > 0 ? officialCount / candidates.length : 0;

  return {
    candidateCount: candidates.length,
    sourceCount: manifest?.source_count ?? null,
    officialCount,
    officialRatio,
    genericNoiseCount,
    directCameraBucketCount,
    cameraXCount,
    socPlatformCount
  };
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function loadRawCandidatePayload(root, date) {
  const manualPath = manualCandidatesPath(root, date);
  if (fs.existsSync(manualPath)) {
    return {
      path: manualPath,
      relPath: manualCandidatesRelPath(date),
      payload: readJson(manualPath)
    };
  }
  const legacyPath = collectedCandidatesPath(root, date);
  return {
    path: legacyPath,
    relPath: collectedCandidatesRelPath(date),
    payload: readJson(legacyPath)
  };
}

function loadSourceChangeEvents(root, date) {
  const relPath = `content/source-events/${date}/source-change-events.json`;
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) return { relPath, report: null };
  return { relPath, report: readJson(filePath) };
}

function renderSourceChangeEventSummary(root, date) {
  const { relPath, report } = loadSourceChangeEvents(root, date);
  if (!report) {
    return [
      '## Source Snapshot Changes',
      '',
      '- source change event report: unavailable',
      `- expected path: ${relPath}`,
      ''
    ];
  }
  const summary = report.summary || {};
  return [
    '## Source Snapshot Changes',
    '',
    `- source change event report: ${relPath}`,
    `- monitored_source_count: ${summary.monitored_source_count ?? 'unknown'}`,
    `- snapshot_page_count: ${summary.snapshot_page_count ?? 'unknown'}`,
    `- generated_candidate_count: ${summary.generated_candidate_count ?? 'unknown'}`,
    `- duplicate_event_evidence_count: ${summary.duplicate_event_evidence_count ?? 'unknown'}`,
    `- monitor_diagnostic_count: ${summary.monitor_diagnostic_count ?? 'unknown'}`,
    '',
    '## Source Change Events',
    '',
    `- event_type_counts: ${JSON.stringify(summary.event_type_counts || {})}`,
    '',
    '## Evidence Identity / Duplicate Guard',
    '',
    '- `processed_source_event_ids` and `processed_evidence_ids` are snapshot state, not public content.',
    '',
    '## Date Quality',
    '',
    '- Review `date_source`, `date_confidence`, `effective_date`, `needs_editor_date_review`, and `main_article_allowed` in the source event report.',
    ''
  ];
}

function buildRawCandidatePrBody({
  root = process.cwd(),
  date
} = {}) {
  const input = loadRawCandidatePayload(root, date);
  const manifestPath = rawCandidateManifestPath(root, date);
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const summary = summarizeRawCandidates(input.payload, manifest);
  const branchName = `newsroom-raw/${date}`;

  return [
    `# RAW Candidate Collection - ${date}`,
    '',
    '## RAW Candidate Summary',
    '',
    `- candidate_count: ${summary.candidateCount}`,
    `- source_count: ${summary.sourceCount ?? 'unknown'}`,
    `- official_ratio: ${percent(summary.officialRatio)} (${summary.officialCount}/${summary.candidateCount})`,
    `- generic_noise_count: ${summary.genericNoiseCount}`,
    `- direct_camera_bucket_count: ${summary.directCameraBucketCount}`,
    `- CameraX_count: ${summary.cameraXCount}`,
    `- SoC_platform_count: ${summary.socPlatformCount}`,
    `- collection_intent_status: ${manifest?.collection_intent_status || 'none'}`,
    `- seed_url_count: ${manifest?.seed_url_count ?? 0}`,
    `- keyword_hint_count: ${manifest?.keyword_hint_count ?? 0}`,
    '',
    '## Artifact Contract',
    '',
    `- RAW candidate artifact: ${input.relPath}`,
    `- compatibility artifact: ${collectedCandidatesRelPath(date)}`,
    `- RAW manifest: ${rawCandidateManifestRelPath(date)}`,
    `- collection intent: ${manifest?.collection_intent || 'none'}`,
    `- branch: ${branchName}`,
    '',
    ...renderSourceChangeEventSummary(root, date),
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
    '',
    '## Editor Checklist',
    '',
    '- RAW artifact는 merge 후 Final Generation의 immutable input입니다.',
    '- v1에서는 candidate artifact를 수동 수정하지 않습니다.',
    '- Stage 3은 이 RAW artifact 또는 valid merged artifact만 읽고 collect를 재실행하지 않습니다.',
    '- source_gap_risk 후보는 final generation 전에 source/parser gap을 확인합니다.',
    ''
  ].join('\n');
}

function main() {
  const runtimeConfig = readRuntimeConfig(process.env);
  const args = process.argv.slice(2);
  const dateArgIndex = args.indexOf('--date');
  const date = dateArgIndex >= 0 ? args[dateArgIndex + 1] : runtimeConfig.newsletterDate || kstDate();
  process.stdout.write(`${buildRawCandidatePrBody({ date })}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildRawCandidatePrBody,
  hasCameraXSignal,
  summarizeRawCandidates
};
