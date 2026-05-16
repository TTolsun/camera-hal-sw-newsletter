const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  mergedCandidateManifestPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesPath,
  mergedCandidatesRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath
} = require('../../../scripts/newsroom/common/artifact-paths');
const {
  CandidateArtifactValidationError,
  buildRawCandidateManifest,
  resolveCandidateInputArtifact,
  validateCandidateArtifact,
  writeManualCandidateArtifacts,
  writeMergedCandidateArtifacts
} = require('../../../scripts/newsroom/common/candidate-artifacts');
const {
  FAILED_NOT_IMPLEMENTED,
  run: runSourceDiscoveryBoundary
} = require('../../../scripts/newsroom/cli/gemini-source-discovery-boundary');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-artifacts-'));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'news-sources.json'), '{"sources":[]}\n', 'utf8');
  return root;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function candidatePayload(title = 'CameraX release') {
  return {
    schema_version: 5,
    date: '2026-05-16',
    newsletter_date: '2026-05-16',
    generated_at: '2026-05-16T00:00:00.000Z',
    candidates: [
      {
        title,
        url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
        reliability: 'official',
        relevance_bucket: 'android_platform_camera_adjacent'
      }
    ],
    failures: []
  };
}

test('candidate artifact paths expose manual, merged, and manifest contracts', () => {
  const root = 'repo';
  const date = '2026-05-16';

  assert.equal(manualCandidatesRelPath(date), 'content/collected-news/2026-05-16/manual-candidates.json');
  assert.equal(collectedCandidatesRelPath(date), 'content/collected-news/2026-05-16/candidates.json');
  assert.equal(mergedCandidatesRelPath(date), 'content/collected-news/2026-05-16/merged-candidates.json');
  assert.equal(rawCandidateManifestRelPath(date), 'content/collected-news/2026-05-16/raw-candidate-manifest.json');
  assert.equal(mergedCandidateManifestRelPath(date), 'content/collected-news/2026-05-16/merged-candidate-manifest.json');
  assert.equal(path.basename(manualCandidatesPath(root, date)), 'manual-candidates.json');
  assert.equal(path.basename(mergedCandidatesPath(root, date)), 'merged-candidates.json');
});

test('manual candidate writer creates canonical and compatibility payloads with raw manifest', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();

  const result = writeManualCandidateArtifacts({
    root,
    date,
    payload,
    sourceCount: 3,
    generatedAt: payload.generated_at
  });

  assert.deepEqual(readJson(manualCandidatesPath(root, date)), payload);
  assert.deepEqual(readJson(collectedCandidatesPath(root, date)), payload);
  assert.equal(result.manifest.manifest_type, 'raw_candidate');
  assert.equal(result.manifest.candidate_count, 1);
  assert.equal(result.manifest.source_count, 3);
  assert.equal(result.manifest.llm_used, false);
  assert.equal(readJson(rawCandidateManifestPath(root, date)).artifact_hash, result.manifest.artifact_hash);
});

test('candidate artifact validation distinguishes valid, missing, mismatch, and llm_used failures', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const valid = validateCandidateArtifact({
    root,
    date,
    candidatePath: manualCandidatesPath(root, date),
    manifestPath: rawCandidateManifestPath(root, date),
    requireManifest: true
  });
  assert.equal(valid.validation_status, 'validated');

  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: path.join(root, 'missing.json')
    }),
    CandidateArtifactValidationError
  );

  writeJson(manualCandidatesPath(root, date), candidatePayload('Changed after manifest'));
  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: manualCandidatesPath(root, date),
      manifestPath: rawCandidateManifestPath(root, date),
      requireManifest: true
    }),
    /hash mismatch/
  );

  writeJson(manualCandidatesPath(root, date), payload);
  const manifest = buildRawCandidateManifest({ root, date, candidatePath: manualCandidatesPath(root, date) });
  manifest.llm_used = true;
  writeJson(rawCandidateManifestPath(root, date), manifest);
  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: manualCandidatesPath(root, date),
      manifestPath: rawCandidateManifestPath(root, date),
      requireManifest: true
    }),
    /llm_used must be false/
  );
});

test('artifact input mode prefers valid merged, then manual, then transition fallback', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeJson(collectedCandidatesPath(root, date), payload);

  const fallback = resolveCandidateInputArtifact({
    root,
    date,
    env: { NEWSROOM_CANDIDATE_INPUT_MODE: 'artifact' }
  });
  assert.equal(fallback.relPath, collectedCandidatesRelPath(date));
  assert.equal(fallback.status_extra.manifest_status, 'transition_fallback_no_manifest');

  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  const manual = resolveCandidateInputArtifact({
    root,
    date,
    env: { NEWSROOM_CANDIDATE_INPUT_MODE: 'artifact' }
  });
  assert.equal(manual.relPath, manualCandidatesRelPath(date));
  assert.equal(manual.status_extra.manifest_status, 'validated');

  writeMergedCandidateArtifacts({ root, date, payload });
  const merged = resolveCandidateInputArtifact({
    root,
    date,
    env: { NEWSROOM_CANDIDATE_INPUT_MODE: 'artifact' }
  });
  assert.equal(merged.relPath, mergedCandidatesRelPath(date));
  assert.equal(merged.status_extra.manifest, mergedCandidateManifestRelPath(date));
});

test('Stage 2 disabled pass-through writes merged artifact, manifest, and report', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'false'
    }
  });

  assert.equal(result.status, 'PASS');
  assert.deepEqual(readJson(mergedCandidatesPath(root, date)), payload);
  assert.equal(readJson(mergedCandidateManifestPath(root, date)).merge_mode, 'disabled_pass_through');
  const report = fs.readFileSync(result.reportPath, 'utf8');
  assert.match(report, /disabled_pass_through=true/);
  assert.match(report, /llm_used=false/);
  assert.match(report, /gemini_candidate_count=0/);
  assert.match(report, /merge_mode=disabled_pass_through/);
});

test('Stage 2 enabled before #149 engine fails without normal merged output', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  assert.throws(
    () => runSourceDiscoveryBoundary({
      root,
      date,
      env: {
        NEWSLETTER_DATE: date,
        NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true'
      }
    }),
    error => error.status === FAILED_NOT_IMPLEMENTED
  );

  assert.equal(fs.existsSync(mergedCandidatesPath(root, date)), false);
  const report = fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'gemini-source-discovery-report.md'), 'utf8');
  assert.match(report, /Gemini discovery engine is not implemented in #88/);
  assert.match(report, /Manual candidates were not modified/);
  assert.match(report, /Stage 3 must use Stage 1 artifact/);
});
