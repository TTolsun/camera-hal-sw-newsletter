const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
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
  assert.match(report, /disabled_pass_through=true/);
  assert.match(report, /llm_used=false/);
  assert.match(report, /summary=Gemini source discovery was disabled; manual candidates were passed through\./);
  assert.match(report, /gemini_candidate_count=0/);
  assert.match(report, /gemini_new_unique_url_count=0/);
  assert.match(report, /merged_unique_url_count=1/);
  assert.match(report, /gemini_candidate_artifact=content\/collected-news\/2026-05-16\/gemini-candidates\.json/);
  assert.match(report, /merge_mode=disabled_pass_through/);
  assert.match(report, /## Parser\/source feedback/);
  assert.match(report, /parser_gap_count=1/);
  assert.match(report, /duplicate_discovery_gap_count=0/);
  assert.match(report, /source_discovery_feedback_report_markdown=content\/newsroom\/2026-05-16\/source-discovery-feedback-report\.md/);
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

test('Stage 2 feedback does not flag valid concrete source_extraction bullets', () => {
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

  const result = runSourceDiscoveryBoundary({
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
  assert.match(report, /## Parser\/source feedback/);
  assert.match(report, /parser_gap_count=0/);
});

test('Stage 2 enabled without credentials writes failure report without mutating candidate artifacts', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  writeMergedCandidateArtifacts({ root, date, payload, geminiPayload: [] });

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

  assert.equal(fs.existsSync(mergedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(mergedCandidateManifestPath(root, date)), true);
  assert.equal(fs.existsSync(geminiCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(manualCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(collectedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(rawCandidateManifestPath(root, date)), true);
  const report = fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'gemini-source-discovery-report.md'), 'utf8');
  assert.match(report, /FAILED_LLM_CREDENTIALS/);
  assert.match(report, /Candidate artifacts were not modified/);
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
            'https://developer.android.com/jetpack/androidx/releases/camera',
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
          text: async () => '<html><head><title>CameraX release notes</title><meta name="datePublished" content="2026-05-15"></head></html>'
        };
      }
      return { ok: false, status: 404, text: async () => '' };
    }
  });

  assert.equal(result.status, 'PASS');
  assert.equal(readJson(geminiSourceProposalsPath(root, date)).proposals.length, 1);
  assert.equal(readJson(geminiSourceProposalValidationReportPath(root, date)).validations.length, 2);
  assert.equal(readJson(geminiCandidatesPath(root, date)).candidates.length, 1);
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
  assert.match(report, /domain_not_allowed/);
  assert.match(report, /summary=Gemini added 1 new unique URL\(s\), 1 publishable candidate\(s\), and 0 manual-duplicate URL\(s\)\./);
  assert.match(report, /manual_candidate_count=1/);
  assert.match(report, /gemini_candidate_count=1/);
  assert.match(report, /gemini_new_unique_url_count=1/);
  assert.match(report, /gemini_manual_duplicate_url_count=0/);
  assert.match(report, /gemini_publishable_candidate_count=1/);
  assert.match(report, /proposal_validation_report=content\/newsroom\/2026-05-16\/gemini-source-proposal-validation-report\.json/);
  assert.match(report, /## Parser\/source feedback/);
  assert.match(report, /parser_gap_count=1/);
  assert.match(report, /duplicate_discovery_gap_count=1/);
  const feedback = readJson(sourceDiscoveryFeedbackReportPath(root, date));
  assert.equal(feedback.status, 'WARNING');
  assert.equal(feedback.parser_gap_count, 1);
  assert.equal(feedback.duplicate_discovery_gap_count, 1);
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
