const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

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

function candidatePayload(title = 'CameraX release', overrides = {}) {
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
    failures: [],
    ...overrides
  };
}

test('candidate artifact paths expose manual, merged, and manifest contracts', () => {
  const root = 'repo';
  const date = '2026-05-16';

  assert.equal(manualCandidatesRelPath(date), 'content/collected-news/2026-05-16/manual-candidates.json');
  assert.equal(collectedCandidatesRelPath(date), 'content/collected-news/2026-05-16/candidates.json');
  assert.equal(mergedCandidatesRelPath(date), 'content/collected-news/2026-05-16/merged-candidates.json');
  assert.equal(geminiCandidatesRelPath(date), 'content/collected-news/2026-05-16/gemini-candidates.json');
  assert.equal(rawCandidateManifestRelPath(date), 'content/collected-news/2026-05-16/raw-candidate-manifest.json');
  assert.equal(mergedCandidateManifestRelPath(date), 'content/collected-news/2026-05-16/merged-candidate-manifest.json');
  assert.equal(path.basename(manualCandidatesPath(root, date)), 'manual-candidates.json');
  assert.equal(path.basename(mergedCandidatesPath(root, date)), 'merged-candidates.json');
  assert.equal(path.basename(geminiCandidatesPath(root, date)), 'gemini-candidates.json');
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

  fs.unlinkSync(rawCandidateManifestPath(root, date));
  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: manualCandidatesPath(root, date),
      manifestPath: rawCandidateManifestPath(root, date),
      requireManifest: true
    }),
    /Missing candidate manifest/
  );
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

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

test('explicit artifact input accepts only approved canonical artifacts with manifests', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  writeMergedCandidateArtifacts({ root, date, payload, geminiPayload: [] });
  writeJson(path.join(root, 'content', 'collected-news', date, 'other-candidates.json'), payload);

  const manual = resolveCandidateInputArtifact({
    root,
    date,
    env: {
      NEWSROOM_CANDIDATE_INPUT_MODE: 'artifact',
      NEWSROOM_CANDIDATE_INPUT_PATH: manualCandidatesRelPath(date)
    }
  });
  assert.equal(manual.relPath, manualCandidatesRelPath(date));
  assert.equal(manual.status_extra.manifest_status, 'validated');

  const merged = resolveCandidateInputArtifact({
    root,
    date,
    env: {
      NEWSROOM_CANDIDATE_INPUT_MODE: 'artifact',
      NEWSROOM_CANDIDATE_INPUT_PATH: mergedCandidatesRelPath(date)
    }
  });
  assert.equal(merged.relPath, mergedCandidatesRelPath(date));
  assert.equal(merged.status_extra.manifest_status, 'validated');

  for (const rejectedPath of [
    collectedCandidatesRelPath(date),
    geminiCandidatesRelPath(date),
    `content/collected-news/${date}/other-candidates.json`,
    `content/collected-news/2026-05-15/manual-candidates.json`
  ]) {
    assert.throws(
      () => resolveCandidateInputArtifact({
        root,
        date,
        env: {
          NEWSROOM_CANDIDATE_INPUT_MODE: 'artifact',
          NEWSROOM_CANDIDATE_INPUT_PATH: rejectedPath
        }
      }),
      /approved candidate artifact/
    );
  }
});

test('strict candidate artifacts reject schema, manifest type, and count mismatches', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  writeJson(manualCandidatesPath(root, date), candidatePayload('old schema', { schema_version: 4 }));
  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: manualCandidatesPath(root, date),
      manifestPath: rawCandidateManifestPath(root, date),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'raw_candidate'
    }),
    /schema_version must be >= 5/
  );

  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  writeJson(manualCandidatesPath(root, date), candidatePayload('bad candidate item', { candidates: ['bad'] }));
  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: manualCandidatesPath(root, date),
      manifestPath: rawCandidateManifestPath(root, date),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'raw_candidate'
    }),
    /candidates\[0\] must be an object/
  );

  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  const manifest = readJson(rawCandidateManifestPath(root, date));
  manifest.manifest_type = 'merged_candidate';
  writeJson(rawCandidateManifestPath(root, date), manifest);
  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: manualCandidatesPath(root, date),
      manifestPath: rawCandidateManifestPath(root, date),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'raw_candidate'
    }),
    /manifest_type must be raw_candidate/
  );

  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  const countManifest = readJson(rawCandidateManifestPath(root, date));
  countManifest.candidate_count = 2;
  writeJson(rawCandidateManifestPath(root, date), countManifest);
  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: manualCandidatesPath(root, date),
      manifestPath: rawCandidateManifestPath(root, date),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'raw_candidate'
    }),
    /candidate_count mismatch/
  );
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
  assert.deepEqual(readJson(geminiCandidatesPath(root, date)), []);
  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.merge_mode, 'disabled_pass_through');
  assert.equal(manifest.gemini_candidate_artifact, geminiCandidatesRelPath(date));
  assert.equal(manifest.gemini_candidate_count, 0);
  const report = fs.readFileSync(result.reportPath, 'utf8');
  assert.match(report, /disabled_pass_through=true/);
  assert.match(report, /llm_used=false/);
  assert.match(report, /gemini_candidate_count=0/);
  assert.match(report, /gemini_candidate_artifact=content\/collected-news\/2026-05-16\/gemini-candidates\.json/);
  assert.match(report, /merge_mode=disabled_pass_through/);
});

test('Stage 2 enabled before #149 engine removes stale normal outputs before failing', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  writeMergedCandidateArtifacts({ root, date, payload, geminiPayload: [] });

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
  assert.equal(fs.existsSync(mergedCandidateManifestPath(root, date)), false);
  assert.equal(fs.existsSync(geminiCandidatesPath(root, date)), false);
  assert.equal(fs.existsSync(manualCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(collectedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(rawCandidateManifestPath(root, date)), true);
  const report = fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'gemini-source-discovery-report.md'), 'utf8');
  assert.match(report, /Gemini discovery engine is not implemented in #88/);
  assert.match(report, /Manual candidates were not modified/);
  assert.match(report, /Stage 3 must use Stage 1 artifact/);
});
