const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  collectionIntentPath,
  evidenceValidationReportPath,
  extractedSourceFactsPath,
  geminiCandidatesPath,
  geminiCandidatesRelPath,
  geminiSourceProposalValidationReportPath,
  geminiSourceProposalsPath,
  geminiUsageReportPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  mergedCandidateManifestPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesPath,
  mergedCandidatesRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath,
  seedCandidatesPath,
  seedEvidencePackPath,
  seedFetchReportPath,
  seedMergeReportPath,
  sourceDiscoveryFeedbackReportMarkdownPath,
  sourceDiscoveryFeedbackReportMarkdownRelPath,
  sourceDiscoveryFeedbackReportPath,
  sourceDiscoveryFeedbackReportRelPath
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
  FAILED_LLM_CREDENTIALS,
  buildSourceDiscoveryFeedbackReport,
  run: runSourceDiscoveryBoundary
} = require('../../../scripts/newsroom/cli/gemini-source-discovery-boundary');
const {
  readTextFixture
} = require('../../helpers/fixture-loader');

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
        source_id: 'camerax-release-notes',
        source: 'CameraX Release Notes',
        relevance_bucket: 'android_platform_camera_adjacent',
        finalSelectionEligibility: 'short',
        final_selection_eligibility: 'short',
        main_eligible: true
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
  assert.equal(sourceDiscoveryFeedbackReportRelPath(date), 'content/newsroom/2026-05-16/source-discovery-feedback-report.json');
  assert.equal(sourceDiscoveryFeedbackReportMarkdownRelPath(date), 'content/newsroom/2026-05-16/source-discovery-feedback-report.md');
  assert.equal(path.basename(manualCandidatesPath(root, date)), 'manual-candidates.json');
  assert.equal(path.basename(mergedCandidatesPath(root, date)), 'merged-candidates.json');
  assert.equal(path.basename(geminiCandidatesPath(root, date)), 'gemini-candidates.json');
  assert.equal(path.basename(sourceDiscoveryFeedbackReportPath(root, date)), 'source-discovery-feedback-report.json');
  assert.equal(path.basename(sourceDiscoveryFeedbackReportMarkdownPath(root, date)), 'source-discovery-feedback-report.md');
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

test('manual candidate writer builds an approved collection intent from manual_source_urls', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();

  const result = writeManualCandidateArtifacts({
    root,
    date,
    payload,
    sourceCount: 2,
    manualSourceUrls: 'https://a.example/x ; https://b.example/y ; https://a.example/x',
    generatedAt: payload.generated_at
  });

  const intent = readJson(collectionIntentPath(root, date));
  assert.equal(intent.newsletter_date, date);
  assert.deepEqual(intent.seed_urls.map(seed => seed.url), [
    'https://a.example/x',
    'https://b.example/y'
  ]);

  assert.equal(result.manifest.collection_intent, 'content/collected-news/2026-05-16/collection-intent.json');
  assert.equal(result.manifest.collection_intent_status, 'approved');
  assert.match(result.manifest.collection_intent_hash, /^[0-9a-f]{64}$/);
  assert.equal(result.manifest.seed_url_count, 2);
  assert.equal(result.manifest.keyword_hint_count, 0);
});

test('manual candidate writer rejects combining manual_source_urls with collection_intent_path', () => {
  const root = tempRoot();
  const date = '2026-05-16';

  assert.throws(
    () => writeManualCandidateArtifacts({
      root,
      date,
      payload: candidatePayload(),
      sourceCount: 1,
      manualSourceUrls: 'https://a.example/x',
      collectionIntentPath: 'content/collected-news/2026-05-16/collection-intent.json'
    }),
    /mutually exclusive/
  );
});

test('manual candidate writer fails fast on invalid manual_source_urls without writing artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-16';

  assert.throws(
    () => writeManualCandidateArtifacts({
      root,
      date,
      payload: candidatePayload(),
      sourceCount: 1,
      manualSourceUrls: 'ftp://a.example/x'
    }),
    /must use http or https/
  );

  assert.equal(fs.existsSync(manualCandidatesPath(root, date)), false);
  assert.equal(fs.existsSync(collectedCandidatesPath(root, date)), false);
  assert.equal(fs.existsSync(rawCandidateManifestPath(root, date)), false);
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

test('Stage 2 disabled pass-through writes merged artifact, manifest, and report', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = await runSourceDiscoveryBoundary({
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
  assert.equal(manifest.manual_candidate_count, 1);
  assert.equal(manifest.manual_unique_url_count, 1);
  assert.equal(manifest.gemini_candidate_count, 0);
  assert.equal(manifest.gemini_unique_url_count, 0);
  assert.equal(manifest.gemini_new_unique_url_count, 0);
  assert.equal(manifest.gemini_manual_duplicate_url_count, 0);
  assert.equal(manifest.gemini_duplicate_record_count, 0);
  assert.equal(manifest.merged_candidate_count, 1);
  assert.equal(manifest.merged_unique_url_count, 1);
  assert.equal(manifest.gemini_publishable_candidate_count, 0);
  const report = fs.readFileSync(result.reportPath, 'utf8');
  assert.match(report, /next_step: strengthen_candidates/);
  assert.match(report, /03 진행 가능하나 후보 보강 권장/);
  assert.match(report, /\| merge_mode \| disabled_pass_through \|/);
  assert.match(report, /\| Gemini 후보 \| 0 \| 비활성\/pass-through \|/);
  assert.match(report, /\| Gemini 신규 unique 후보 \| 0 \| 없음 \|/);
  assert.match(report, /\| parser gap \| 1 \| 보강 필요 \|/);
  assert.match(report, /gemini_candidate_artifact: content\/collected-news\/2026-05-16\/gemini-candidates\.json/);
  assert.match(report, /source_discovery_feedback_report: content\/newsroom\/2026-05-16\/source-discovery-feedback-report\.md/);
  assert.doesNotMatch(report, /## Parser\/source feedback/);
  const feedback = readJson(sourceDiscoveryFeedbackReportPath(root, date));
  assert.equal(feedback.status, 'WARNING');
  assert.equal(feedback.parser_gap_count, 1);
  assert.equal(feedback.duplicate_discovery_gap_count, 0);
  assert.equal(feedback.items[0].action, 'PARSER_REPAIR_REQUIRED');
  assert.equal(feedback.items[0].reason, 'missing_source_extraction');
  assert.equal(feedback.items[0].adapter_hint, 'android-developers-jetpack-release');
  assert.equal(feedback.items[0].duplicate_discovered_by_gemini, false);
  assert.equal(feedback.items[0].duplicate_match_type, null);
  assert.equal(feedback.items[0].source_gap_risk, false);
  assert.equal(feedback.items[0].evidence_validation_status, null);
  assert.equal(feedback.items[0].final_selection_eligibility, 'short');
  assert.equal(feedback.items[0].confidence, 'high');
  assert.match(fs.readFileSync(sourceDiscoveryFeedbackReportMarkdownPath(root, date), 'utf8'), /PARSER_REPAIR_REQUIRED/);
});

test('Stage 2 feedback distinguishes normalized exact duplicate URLs from same page family matches', () => {
  const date = '2026-05-16';
  const manualCandidate = candidatePayload().candidates[0];
  const exactReport = buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates: [manualCandidate],
    mergedCandidates: [manualCandidate],
    geminiCandidates: [{
      origin: 'gemini_discovery',
      title: 'CameraX release notes',
      url: 'https://WWW.Developer.Android.com/jetpack/androidx/releases/camera/?hl=ko#1.6.1'
    }]
  });

  assert.equal(exactReport.duplicate_discovery_gap_count, 1);
  assert.equal(exactReport.items[0].duplicate_discovered_by_gemini, true);
  assert.equal(exactReport.items[0].duplicate_match_type, 'exact_normalized_url');

  const familyReport = buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates: [manualCandidate],
    mergedCandidates: [manualCandidate],
    geminiCandidates: [{
      origin: 'gemini_discovery',
      title: 'CameraX release notes',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07'
    }]
  });

  assert.equal(familyReport.duplicate_discovery_gap_count, 1);
  assert.equal(familyReport.items[0].duplicate_discovered_by_gemini, true);
  assert.equal(familyReport.items[0].duplicate_match_type, 'same_release_page_family');
});

test('Stage 2 feedback still surfaces known official parser-backed URLs with source_gap_risk context', () => {
  const date = '2026-05-16';
  const candidate = {
    ...candidatePayload().candidates[0],
    source_gap_risk: true,
    evidence_validation_status: 'fail',
    source_quality_bucket: 'strong_candidate'
  };

  const report = buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates: [candidate],
    mergedCandidates: [candidate],
    geminiCandidates: []
  });

  assert.equal(report.status, 'WARNING');
  assert.equal(report.parser_gap_count, 1);
  assert.equal(report.items[0].source_gap_risk, true);
  assert.equal(report.items[0].evidence_validation_status, 'fail');
  assert.equal(report.items[0].source_quality_bucket, 'strong_candidate');
  assert.equal(report.items[0].confidence, 'medium');
});

test('Stage 2 feedback reports Gemini parser extraction failures separately', () => {
  const report = buildSourceDiscoveryFeedbackReport({
    date: '2026-05-16',
    manualCandidates: [],
    mergedCandidates: [],
    geminiCandidates: [],
    proposalValidations: [{
      proposal_id: 'p1',
      candidate_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      normalized_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      accepted: false,
      rejected_reason: 'parser_repair_required',
      source_policy_match: 'camerax-release-notes',
      discovery_status: 'discovered',
      extraction_status: 'parser_repair_required',
      adapter_hint: 'android-developers-jetpack-release',
      suggested_fixture_case: 'Add or update a CameraX release-note fixture with version/date/component/behavior evidence.'
    }]
  });

  assert.equal(report.status, 'WARNING');
  assert.equal(report.parser_gap_count, 0);
  assert.equal(report.gemini_parser_failure_count, 1);
  assert.equal(report.gemini_parser_failures[0].action, 'GEMINI_PARSER_EXTRACTION_REQUIRED');
  assert.equal(report.gemini_parser_failures[0].rejected_reason, 'parser_repair_required');
  assert.equal(report.gemini_parser_failures[0].adapter_hint, 'android-developers-jetpack-release');
});

test('Stage 2 feedback does not flag valid concrete source_extraction bullets', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload('CameraX 1.6.1', {
    candidates: [{
      title: 'CameraX 1.6.1',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      reliability: 'official',
      source_id: 'camerax-release-notes',
      finalSelectionEligibility: 'short',
      final_selection_eligibility: 'short',
      main_eligible: true,
      source_extraction: {
        extraction_quality: {
          main_article_allowed: true,
          used_fallback: false
        },
        release: {
          version: 'CameraX 1.6.1',
          sections: [{
            title: 'Bug Fixes',
            items: [{
              text: 'Fixed a compilation error when using CameraX 1.6.0.'
            }]
          }]
        }
      }
    }]
  });
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'false'
    }
  });

  const feedback = readJson(sourceDiscoveryFeedbackReportPath(root, date));
  assert.equal(feedback.status, 'PASS');
  assert.equal(feedback.parser_gap_count, 0);
  assert.deepEqual(feedback.items, []);
  const report = fs.readFileSync(result.reportPath, 'utf8');
  assert.doesNotMatch(report, /## Parser\/source feedback/);
  assert.match(report, /\| parser gap \| 0 \| 없음 \|/);
});

test('Stage 2 disabled mode expands approved seed evidence without Gemini credentials', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  writeJson(path.join(root, 'data', 'news-sources.json'), {
    schemaVersion: 2,
    sources: [{
      id: 'android',
      name: 'Android Developers',
      sourceUrl: 'https://developer.android.com/',
      category: 'android',
      reliability: 'official',
      linkedEvidencePolicy: {
        enabled: true,
        allowedDomains: ['developer.android.com']
      }
    }, {
      id: 'camerax-release-notes',
      name: 'CameraX Release Notes',
      sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
      rssUrl: null,
      collectionModeHint: 'release-note-watch',
      evidenceGranularityHint: 'versioned_release_row',
      category: 'camera-api',
      priority: 'high',
      reliability: 'official',
      enabled: true,
      candidateOnly: false,
      requiresCrossCheck: false,
      linkedEvidencePolicy: {
        enabled: true,
        allowedDomains: ['developer.android.com']
      }
    }]
  });
  const payload = candidatePayload('Manual CameraX release', {
    candidates: [{
      ...candidatePayload().candidates[0],
      title: 'Manual CameraX release',
      editor_note: 'Keep editorial framing',
      priority: 'urgent',
      source_id: 'manual-source'
    }]
  });
  const intent = {
    schema_version: 1,
    newsletter_date: date,
    seed_urls: [{
      seed_id: 'seed-camerax',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      expected_topic: 'CameraX 1.6.1',
      priority: 'low'
    }],
    keyword_hints: ['CameraX release notes']
  };
  writeJson(collectionIntentPath(root, date), intent);
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'false'
    },
    fetchImpl: async (url) => ({
      ok: true,
      url,
      text: async () => '<html><head><title>CameraX 1.6.1 release notes</title><meta name="datePublished" content="2026-05-15"></head><body>CameraX 1.6.1 fixes camera stream handling for Android camera apps.</body></html>'
    })
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.manifest.merge_mode, 'seed_evidence_expansion');
  assert.equal(result.manifest.llm_used, false);
  assert.equal(result.manifest.seed_used, true);
  assert.equal(result.manifest.seed_candidate_count, 1);
  assert.equal(result.manifest.seed_enriched_duplicate_count, 1);
  assert.equal(result.manifest.seed_new_unique_url_count, 0);
  assert.equal(fs.existsSync(seedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(seedEvidencePackPath(root, date)), true);
  assert.equal(fs.existsSync(seedFetchReportPath(root, date)), true);
  assert.equal(fs.existsSync(seedMergeReportPath(root, date)), true);

  const merged = readJson(mergedCandidatesPath(root, date));
  assert.equal(merged.candidates.length, 1);
  assert.equal(merged.candidates[0].title, 'Manual CameraX release');
  assert.equal(merged.candidates[0].editor_note, 'Keep editorial framing');
  assert.equal(merged.candidates[0].priority, 'urgent');
  assert.equal(merged.candidates[0].source_id, 'manual-source');
  assert.deepEqual(merged.candidates[0].seed_ids, ['seed-camerax']);
  assert.deepEqual(merged.candidates[0].evidence_pack_ids, ['seed-camerax-pack']);
  assert.deepEqual(merged.candidates[0].primary_evidence_ids, ['seed-camerax-primary-01']);

  const seedMerge = readJson(seedMergeReportPath(root, date));
  assert.equal(seedMerge.enriched_duplicate_count, 1);
  assert.equal(seedMerge.conflicts.some(item => item.field === 'title'), true);
  assert.equal(seedMerge.conflicts.some(item => item.field === 'priority'), true);

  const report = fs.readFileSync(result.reportPath, 'utf8');
  assert.match(report, /\| merge_mode \| seed_evidence_expansion \|/);
  assert.match(report, /seed_candidate_artifact: content\/collected-news\/2026-05-16\/seed-candidates\.json/);
  assert.match(report, /seed_evidence_pack: content\/collected-news\/2026-05-16\/seed-evidence-pack\.json/);
  assert.doesNotMatch(report, /Priority Override \/ Legacy Compatibility/);
});

test('Stage 2 approved keyword-only intent keeps pass-through without empty seed artifacts', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeJson(collectionIntentPath(root, date), {
    schema_version: 1,
    newsletter_date: date,
    seed_urls: [],
    keyword_hints: ['CameraX']
  });
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'false'
    }
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.manifest.merge_mode, 'disabled_pass_through');
  assert.equal(result.manifest.seed_used, false);
  assert.equal(fs.existsSync(seedCandidatesPath(root, date)), false);
  assert.equal(fs.existsSync(seedEvidencePackPath(root, date)), false);
});

test('Stage 2 rejects unapproved collection intent in disabled mode', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  const manifest = readJson(rawCandidateManifestPath(root, date));
  manifest.collection_intent = 'content/collected-news/2026-05-16/collection-intent.json';
  manifest.collection_intent_status = 'approved';
  manifest.collection_intent_hash = 'sha256-mismatch';
  writeJson(rawCandidateManifestPath(root, date), manifest);
  writeJson(collectionIntentPath(root, date), {
    schema_version: 1,
    newsletter_date: date,
    seed_urls: [{ seed_id: 'seed-a', url: 'https://developer.android.com/jetpack/androidx/releases/camera' }],
    keyword_hints: []
  });

  await assert.rejects(
    () => runSourceDiscoveryBoundary({
      root,
      date,
      env: {
        NEWSLETTER_DATE: date,
        NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'false'
      }
    }),
    /collection_intent_hash mismatch/
  );
});

test('Stage 2 enabled without credentials and no seed does not mutate artifacts', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  writeMergedCandidateArtifacts({ root, date, payload, geminiPayload: [] });
  const beforeMerged = fs.readFileSync(mergedCandidatesPath(root, date), 'utf8');
  const beforeManifest = fs.readFileSync(mergedCandidateManifestPath(root, date), 'utf8');

  await assert.rejects(
    () => runSourceDiscoveryBoundary({
      root,
      date,
      env: {
        NEWSLETTER_DATE: date,
        NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true'
      }
    }),
    error => error.status === FAILED_LLM_CREDENTIALS
  );

  assert.equal(fs.readFileSync(mergedCandidatesPath(root, date), 'utf8'), beforeMerged);
  assert.equal(fs.readFileSync(mergedCandidateManifestPath(root, date), 'utf8'), beforeManifest);
  assert.equal(fs.existsSync(mergedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(mergedCandidateManifestPath(root, date)), true);
  assert.equal(fs.existsSync(geminiCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(manualCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(collectedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(rawCandidateManifestPath(root, date)), true);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'gemini-source-discovery-report.md')), false);
});

test('Stage 2 enabled promotes only validated proposal URLs and writes manifest v2 reports', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeJson(path.join(root, 'data', 'news-sources.json'), {
    schemaVersion: 2,
    sources: [{
      id: 'android',
      name: 'Android Developers',
      sourceUrl: 'https://developer.android.com/',
      rssUrl: null,
      category: 'android',
      priority: 'high',
      reliability: 'official',
      enabled: true,
      candidateOnly: false,
      requiresCrossCheck: false,
      usageHint: 'Android Camera',
      keywords: ['CameraX'],
      linkedEvidencePolicy: {
        enabled: true,
        allowedDomains: ['developer.android.com']
      }
    }]
  });
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true',
      GEMINI_API_KEY: 'test-key',
      GEMINI_RETRY_DELAYS_MS: '0'
    },
    callLlmJsonBudgetedImpl: async (_stage, _system, _prompt, _schema, options = {}) => {
      options.budget.mergeDiagnostics({
        model_usage: {
          sourceDiscovery: {
            fake: {
              requests: 1,
              successes: 1
            }
          }
        },
        cost_report: {
          calls: [{ stage: 'sourceDiscovery', model: 'fake' }]
        }
      });
      return {
        schema_version: 1,
        proposal_type: 'gemini_source_discovery',
        newsletter_date: date,
        proposals: [{
          proposal_id: 'p1',
          topic_gap: 'CameraX release notes',
          source_family: 'official_android',
          allowed_domains: ['example.com'],
          search_keywords: ['CameraX release notes'],
          candidate_urls: [
            'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
            'https://example.com/fake'
          ],
          expected_evidence: ['published date'],
          risk_notes: []
        }]
      };
    },
    fetchImpl: async (url) => {
      if (url.includes('developer.android.com')) {
        return {
          ok: true,
          text: async () => readTextFixture('source-html/camerax-release-notes-live-structure.html')
        };
      }
      return { ok: false, status: 404, text: async () => '' };
    }
  });

  assert.equal(result.status, 'PASS');
  assert.equal(readJson(geminiSourceProposalsPath(root, date)).proposals.length, 1);
  assert.equal(readJson(geminiSourceProposalValidationReportPath(root, date)).validations.length, 2);
  const geminiCandidates = readJson(geminiCandidatesPath(root, date)).candidates;
  assert.equal(geminiCandidates.length, 1);
  assert.equal(geminiCandidates[0].source_id, 'camerax-release-notes');
  assert.equal(geminiCandidates[0].source_extraction.mode, 'versioned_release_row');
  assert.equal(geminiCandidates[0].source_extraction.extraction_quality.used_versioned_release_row_extractor, true);
  assert.deepEqual(
    geminiCandidates[0].source_extraction.bullets,
    geminiCandidates[0].source_extraction.release.sections.flatMap(section => section.items.map(item => item.text))
  );
  assert.equal(readJson(mergedCandidatesPath(root, date)).candidates.length, 2);
  assert.equal(fs.existsSync(extractedSourceFactsPath(root, date)), true);
  assert.equal(fs.existsSync(evidenceValidationReportPath(root, date)), true);
  assert.equal(fs.existsSync(geminiUsageReportPath(root, date)), true);

  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.schema_version, 2);
  assert.equal(manifest.llm_used, true);
  assert.equal(manifest.manual_candidate_count, 1);
  assert.equal(manifest.manual_unique_url_count, 1);
  assert.equal(manifest.gemini_candidate_count, 1);
  assert.equal(manifest.gemini_unique_url_count, 1);
  assert.equal(manifest.gemini_new_unique_url_count, 1);
  assert.equal(manifest.gemini_manual_duplicate_url_count, 0);
  assert.equal(manifest.gemini_duplicate_record_count, 0);
  assert.equal(manifest.merged_candidate_count, 2);
  assert.equal(manifest.merged_unique_url_count, 2);
  assert.equal(manifest.gemini_publishable_candidate_count, 1);
  assert.equal(manifest.usage_report, 'content/newsroom/2026-05-16/gemini-usage-report.json');
  assert.equal(manifest.proposal_validation_report, 'content/newsroom/2026-05-16/gemini-source-proposal-validation-report.json');
  assert.equal(manifest.source_discovery_feedback_report, 'content/newsroom/2026-05-16/source-discovery-feedback-report.json');
  assert.equal(manifest.source_discovery_feedback_report_markdown, 'content/newsroom/2026-05-16/source-discovery-feedback-report.md');
  const usage = readJson(geminiUsageReportPath(root, date));
  assert.equal(usage.requested_attempt_count, 1);
  assert.equal(usage.successful_response_count, 1);
  assert.equal(usage.stage_counts.sourceDiscovery.requested_attempts, 1);

  const validated = validateCandidateArtifact({
    root,
    date,
    candidatePath: mergedCandidatesPath(root, date),
    manifestPath: mergedCandidateManifestPath(root, date),
    requireManifest: true,
    validationMode: 'strict',
    expectedManifestType: 'merged_candidate',
    expectedLlmUsed: 'any'
  });
  assert.equal(validated.validation_status, 'validated');
  const report = fs.readFileSync(result.reportPath, 'utf8');
  assert.doesNotMatch(report, /domain_not_allowed/);
  assert.match(report, /next_step: run_03/);
  assert.match(report, /\| manual 후보 \| 1 \| 입력 \|/);
  assert.match(report, /\| Gemini 후보 \| 1 \| 실행됨 \|/);
  assert.match(report, /\| Gemini 신규 unique 후보 \| 1 \| 있음 \|/);
  assert.match(report, /\| Gemini publishable 후보 \| 1 \| 있음 \|/);
  assert.match(report, /\| 중복 후보 \| 0 \| 낮음 \|/);
  assert.match(report, /\| parser gap \| 1 \| 보강 필요 \|/);
  assert.match(report, /proposal_validation_report: content\/newsroom\/2026-05-16\/gemini-source-proposal-validation-report\.json/);
  assert.doesNotMatch(report, /## Parser\/source feedback/);
  const feedback = readJson(sourceDiscoveryFeedbackReportPath(root, date));
  assert.equal(feedback.status, 'WARNING');
  assert.equal(feedback.parser_gap_count, 1);
  assert.equal(feedback.duplicate_discovery_gap_count, 1);
  assert.equal(feedback.gemini_parser_failure_count, 0);
  assert.equal(feedback.items[0].duplicate_discovered_by_gemini, true);
  assert.equal(feedback.items[0].duplicate_match_type, 'same_release_page_family');
  assert.equal(feedback.items[0].selector_exclusion_reason, 'CameraX release-note candidate has no concrete source_extraction bullet');

  fs.unlinkSync(geminiSourceProposalValidationReportPath(root, date));
  assert.throws(
    () => validateCandidateArtifact({
      root,
      date,
      candidatePath: mergedCandidatesPath(root, date),
      manifestPath: mergedCandidateManifestPath(root, date),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'merged_candidate',
      expectedLlmUsed: 'any'
    }),
    /proposal_validation_report target is missing/
  );
});
