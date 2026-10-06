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
} = require('../../../common/artifact-paths');
const {
  CANDIDATE_SCHEMA_VERSION,
  CandidateArtifactValidationError,
  buildRawCandidateManifest,
  resolveCandidateInputArtifact,
  validateCandidateArtifact,
  writeManualCandidateArtifacts,
  writeMergedCandidateArtifacts
} = require('../../../common/candidate-artifacts');
const {
  FAILED_LLM_CREDENTIALS,
  buildSourceDiscoveryFeedbackReport,
  run: runSourceDiscoveryBoundary
} = require('../../../../discovery/gemini-source-discovery-boundary');
const {
  notYetEligibleOverflowRelPath
} = require('../../../cli/collect-news-candidates');
const {
  readTextFixture
} = require('../../helpers/fixture-loader');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-artifacts-'));
  fs.mkdirSync(path.join(root, 'src', 'shared', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'shared', 'data', 'news-sources.json'), '{"sources":[]}\n', 'utf8');
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
        relevance_bucket: 'android',
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

  assert.equal(manualCandidatesRelPath(date), 'articles/content/collected-news/2026-05-16/manual-candidates.json');
  assert.equal(collectedCandidatesRelPath(date), 'articles/content/collected-news/2026-05-16/candidates.json');
  assert.equal(mergedCandidatesRelPath(date), 'articles/content/collected-news/2026-05-16/merged-candidates.json');
  assert.equal(rawCandidateManifestRelPath(date), 'articles/content/collected-news/2026-05-16/raw-candidate-manifest.json');
  assert.equal(mergedCandidateManifestRelPath(date), 'articles/content/collected-news/2026-05-16/merged-candidate-manifest.json');
  assert.equal(sourceDiscoveryFeedbackReportRelPath(date), 'articles/content/newsroom/2026-05-16/source-discovery-feedback-report.json');
  assert.equal(sourceDiscoveryFeedbackReportMarkdownRelPath(date), 'articles/content/newsroom/2026-05-16/source-discovery-feedback-report.md');
  assert.equal(path.basename(manualCandidatesPath(root, date)), 'manual-candidates.json');
  assert.equal(path.basename(mergedCandidatesPath(root, date)), 'merged-candidates.json');
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

  assert.equal(result.manifest.collection_intent, 'articles/content/collected-news/2026-05-16/collection-intent.json');
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
      collectionIntentPath: 'articles/content/collected-news/2026-05-16/collection-intent.json'
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
  writeMergedCandidateArtifacts({ root, date, payload });
  writeJson(path.join(root, 'articles', 'content', 'collected-news', date, 'other-candidates.json'), payload);

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
    `articles/content/collected-news/${date}/gemini-candidates.json`,
    `articles/content/collected-news/${date}/other-candidates.json`,
    `articles/content/collected-news/2026-05-15/manual-candidates.json`
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

test('strict candidate artifacts accept the producer schema version contract', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload('producer contract', { schema_version: CANDIDATE_SCHEMA_VERSION });
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const validated = validateCandidateArtifact({
    root,
    date,
    candidatePath: manualCandidatesPath(root, date),
    manifestPath: rawCandidateManifestPath(root, date),
    requireManifest: true,
    validationMode: 'strict',
    expectedManifestType: 'raw_candidate'
  });
  assert.equal(validated.validation_status, 'validated');
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
  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'collected-news', date, 'gemini-candidates.json')), false);
  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.merge_mode, 'disabled_pass_through');
  assert.equal(manifest.manual_candidate_count, 1);
  assert.equal(manifest.manual_unique_url_count, 1);
  assert.equal(manifest.merged_candidate_count, 1);
  assert.equal(manifest.merged_unique_url_count, 1);
  for (const field of ['gemini_candidate_artifact', 'gemini_candidate_count', 'gemini_new_unique_url_count', 'gemini_publishable_candidate_count']) {
    assert.equal(Object.hasOwn(manifest, field), false, `${field}는 제안 단계와 함께 사라졌다`);
  }
  const report = fs.readFileSync(result.reportPath, 'utf8');
  assert.match(report, /next_step: strengthen_candidates/);
  assert.match(report, /03 진행 가능하나 후보 보강 권장/);
  assert.match(report, /\| merge_mode \| disabled_pass_through \|/);
  assert.match(report, /\| parser gap \| 1 \| 보강 필요 \|/);
  assert.doesNotMatch(report, /gemini_candidate_artifact/);
  assert.match(report, /source_discovery_feedback_report: articles\/content\/newsroom\/2026-05-16\/source-discovery-feedback-report\.md/);
  assert.doesNotMatch(report, /## Parser\/source feedback/);
  const feedback = readJson(sourceDiscoveryFeedbackReportPath(root, date));
  assert.equal(feedback.status, 'WARNING');
  assert.equal(feedback.parser_gap_count, 1);
  assert.equal(Object.hasOwn(feedback, 'duplicate_discovery_gap_count'), false);
  assert.equal(Object.hasOwn(feedback, 'gemini_parser_failures'), false);
  assert.equal(feedback.items[0].action, 'PARSER_REPAIR_REQUIRED');
  assert.equal(feedback.items[0].reason, 'missing_source_extraction');
  assert.equal(feedback.items[0].adapter_hint, 'android-developers-jetpack-release');
  assert.equal(Object.hasOwn(feedback.items[0], 'duplicate_discovered_by_gemini'), false);
  assert.equal(feedback.items[0].source_gap_risk, false);
  assert.equal(feedback.items[0].evidence_validation_status, null);
  assert.equal(feedback.items[0].final_selection_eligibility, 'short');
  assert.equal(feedback.items[0].confidence, 'high');
  assert.match(fs.readFileSync(sourceDiscoveryFeedbackReportMarkdownPath(root, date), 'utf8'), /PARSER_REPAIR_REQUIRED/);
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
    mergedCandidates: [candidate]
  });

  assert.equal(report.status, 'WARNING');
  assert.equal(report.parser_gap_count, 1);
  assert.equal(report.items[0].source_gap_risk, true);
  assert.equal(report.items[0].evidence_validation_status, 'fail');
  assert.equal(report.items[0].source_quality_bucket, 'strong_candidate');
  assert.equal(report.items[0].confidence, 'medium');
});

// linked 파생 후보는 collectionStage가 'gemini'다. Gemini 단계가 만든 후보는 parser 수리 대상이 아니라서
// feedback이 거른다(#1186 이후에도 이 조건은 파생 후보 때문에 남는다). 같은 후보에서 표지만 빼면 parser
// gap으로 잡히는 것으로 "표지 때문에 걸러진다"를 고정한다.
test('Stage 2 feedback does not treat Gemini-stage derived candidates as parser repair targets', () => {
  const date = '2026-05-16';
  const derived = {
    ...candidatePayload().candidates[0],
    id: 'gemini-linked-derived',
    origin: 'gemini_linked_discovery',
    collectionStage: 'gemini'
  };

  const filtered = buildSourceDiscoveryFeedbackReport({ date, manualCandidates: [], mergedCandidates: [derived] });
  assert.equal(filtered.parser_gap_count, 0);

  const { origin, collectionStage, ...withoutGeminiStage } = derived;
  const unfiltered = buildSourceDiscoveryFeedbackReport({ date, manualCandidates: [], mergedCandidates: [withoutGeminiStage] });
  assert.equal(unfiltered.parser_gap_count, 1);
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
  writeJson(path.join(root, 'src', 'shared', 'data', 'news-sources.json'), {
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
  assert.match(report, /seed_candidate_artifact: articles\/content\/collected-news\/2026-05-16\/seed-candidates\.json/);
  assert.match(report, /seed_evidence_pack: articles\/content\/collected-news\/2026-05-16\/seed-evidence-pack\.json/);
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
  manifest.collection_intent = 'articles/content/collected-news/2026-05-16/collection-intent.json';
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
  writeMergedCandidateArtifacts({ root, date, payload });
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
  assert.equal(fs.existsSync(manualCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(collectedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(rawCandidateManifestPath(root, date)), true);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'newsroom', date, 'gemini-source-discovery-report.md')), false);
});

// #1186: 제안 단계를 제거한 뒤 이 단계가 병합 단계에서 새로 만드는 후보는 seed 근거 확장과 linked
// evidence 파생 둘뿐이다. 아래 테스트들은 둘을 후보 운반 수단으로 쓴다.
function writeSeedIntent(root, date, urls) {
  writeJson(collectionIntentPath(root, date), {
    schema_version: 1,
    newsletter_date: date,
    seed_urls: urls.map((url, index) => ({
      seed_id: `seed-${index}`,
      url,
      expected_topic: 'CameraX release notes'
    })),
    keyword_hints: []
  });
}

function datedSeedPageFetch(datePublished) {
  return async (url) => ({
    ok: true,
    status: 200,
    url,
    headers: { get: () => '' },
    text: async () => `<html><head><title>Seed camera release</title><meta name="datePublished" content="${datePublished}"></head>` +
      `<body>${datePublished} camera release evidence.</body></html>`
  });
}

function writeAndroidRegistry(root) {
  writeJson(path.join(root, 'src', 'shared', 'data', 'news-sources.json'), {
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
}

const ENABLED_ENV = date => ({
  NEWSLETTER_DATE: date,
  NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true',
  GEMINI_API_KEY: 'test-key',
  GEMINI_RETRY_DELAYS_MS: '0'
});

test('Stage 2 enabled merges linked evidence candidates and writes manifest v3 reports without proposal artifacts', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  // coverage_end_date를 후보 날짜보다 뒤에 둬서 이 테스트가 검증하려는 계약(병합 후보 수·manifest
  // 필드)이 Task 10의 not-yet-eligible 경계에 영향받지 않게 한다 — 그 경계는 별도 테스트가 검증한다.
  const payload = {
    ...candidatePayload(),
    coverage: {
      coverage_week_key: '2026-W19',
      coverage_start_date: '2026-05-04',
      coverage_end_date: '2026-05-10',
      coverage_end_exclusive_at: '2026-05-11T00:00:00.000Z'
    },
    not_yet_eligible: [],
    carry_forward_status: 'not_applicable'
  };
  const linkedUrl = 'https://github.com/androidx/androidx/releases/tag/camera-1.6.1';
  payload.candidates[0].outgoing_links = [{
    url: linkedUrl,
    text: 'CameraX 1.6.1 release',
    source_field: 'rss.body',
    extraction_method: 'html_anchor'
  }];
  writeAndroidRegistry(root);
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: ENABLED_ENV(date),
    callLlmJsonBudgetedImpl: async (_stage, _system, _prompt, _schema, options = {}) => {
      options.budget.mergeDiagnostics({
        model_usage: {
          'source_discovery#0': {
            stage_key: 'source_discovery#0',
            stage_id: 'source_discovery',
            quality_attempt: 0,
            label: 'sourceDiscovery',
            parent_run_key: null,
            models: { fake: { requests: 1, successes: 1 } }
          }
        },
        cost_report: {
          calls: [{ stage_key: 'source_discovery#0', stage_id: 'source_discovery', model: 'fake' }]
        }
      });
      return { selections: [{ url: linkedUrl, is_newsworthy: true, reason: 'CameraX release' }] };
    },
    fetchImpl: async () => ({ ok: false, status: 404, text: async () => '' })
  });

  assert.equal(result.status, 'PASS');
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
  const collectedDir = path.join(root, 'articles', 'content', 'collected-news', date);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'gemini-source-proposals.json')), false);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'gemini-source-proposal-validation-report.json')), false);
  assert.equal(fs.existsSync(path.join(collectedDir, 'gemini-candidates.json')), false);
  const merged = readJson(mergedCandidatesPath(root, date));
  assert.deepEqual(merged.candidates.map(item => item.origin || 'manual'), ['manual', 'gemini_linked_discovery']);
  assert.equal(fs.existsSync(extractedSourceFactsPath(root, date)), true);
  assert.equal(fs.existsSync(evidenceValidationReportPath(root, date)), true);
  assert.equal(fs.existsSync(geminiUsageReportPath(root, date)), true);

  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.schema_version, 3);
  assert.equal(manifest.carry_forward_status, 'not_applicable');
  assert.equal(manifest.not_yet_eligible_count, 0);
  assert.equal(manifest.not_yet_eligible_overflow, false);
  assert.equal(manifest.llm_used, true);
  assert.equal(manifest.manual_candidate_count, 1);
  assert.equal(manifest.manual_unique_url_count, 1);
  assert.equal(manifest.derived_candidate_count, 1);
  assert.equal(manifest.merged_candidate_count, 2);
  assert.equal(manifest.merged_unique_url_count, 2);
  assert.equal(manifest.usage_report, 'articles/content/newsroom/2026-05-16/gemini-usage-report.json');
  for (const field of [
    'proposal_validation_report',
    'gemini_candidate_artifact',
    'gemini_candidate_artifact_hash',
    'gemini_candidate_count',
    'gemini_unique_url_count',
    'gemini_new_unique_url_count',
    'gemini_manual_duplicate_url_count',
    'gemini_duplicate_record_count',
    'gemini_publishable_candidate_count'
  ]) {
    assert.equal(Object.hasOwn(manifest, field), false, `${field}는 제안 단계와 함께 사라졌다`);
  }
  assert.equal(manifest.source_discovery_feedback_report, 'articles/content/newsroom/2026-05-16/source-discovery-feedback-report.json');
  assert.equal(manifest.source_discovery_feedback_report_markdown, 'articles/content/newsroom/2026-05-16/source-discovery-feedback-report.md');
  const usage = readJson(geminiUsageReportPath(root, date));
  assert.equal(usage.requested_attempt_count, 1);
  assert.equal(usage.successful_response_count, 1);
  assert.equal(usage.stage_counts.source_discovery.requested_attempts, 1);
  // 키 집합을 통째로 고정한다. 한 키만 조회하면 조인이 끊겨 생긴 유령 버킷(unknown,
  // 옛 어휘 잔재)이 함께 있어도 보이지 않는다 -- #982 회귀가 그렇게 3개월 숨었다.
  assert.deepEqual(Object.keys(usage.stage_counts), ['source_discovery']);
  assert.equal(usage.schema_version, 2);
  // #1203: calls는 stage_counts와 같은 진단에서 나온다. 성공 응답 합계 == calls 길이.
  // 제안 단계가 사라진 뒤에는 linked evidence 선택 호출이 그 유일한 호출이다.
  assert.equal(usage.calls.length, usage.successful_response_count);

  // Stage 3 strict 검증: llm_used=true라서 필수 report 항목을 요구한다. 제안 report를 쓰지 않으면서
  // 그 항목을 필수로 두면 그 주 발행이 terminal failure로 끝난다(#1186).
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
  assert.match(report, /\| manual 후보 \| 1 \| 입력 \|/);
  assert.match(report, /\| linked evidence 파생 후보 \| 1 \| 있음 \|/);
  assert.match(report, /\| parser gap \| 1 \| 보강 필요 \|/);
  assert.doesNotMatch(report, /proposal_validation_report|Gemini 후보|Gemini 신규|rejected proposal/);
  assert.doesNotMatch(report, /## Parser\/source feedback/);
  // linked 파생 후보는 Gemini 단계가 만든 후보라 parser 수리 대상이 아니다 — manual 후보만 센다.
  const feedback = readJson(sourceDiscoveryFeedbackReportPath(root, date));
  assert.equal(feedback.status, 'WARNING');
  assert.equal(feedback.parser_gap_count, 1);
  assert.equal(feedback.items[0].url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1');
  assert.equal(feedback.items[0].selector_exclusion_reason, 'CameraX release-note candidate has no concrete source_extraction bullet');

  // 필수 report 항목은 그대로 강제한다 — 제안 report만 필수에서 빠졌다.
  fs.unlinkSync(geminiUsageReportPath(root, date));
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
    /usage_report target is missing/
  );
});

test('Stage 2 enabled merge excludes not-yet-eligible seed candidates and carries them into not_yet_eligible with URL dedupe', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  // seed 페이지 날짜 2026-05-06은 coverage_end_date 2026-04-26보다 뒤라 [E, U) 밖(= not_yet_eligible)이다.
  const coverage = {
    coverage_week_key: '2026-W17',
    coverage_start_date: '2026-04-20',
    coverage_end_date: '2026-04-26',
    coverage_end_exclusive_at: '2026-04-27T00:00:00.000Z'
  };
  const seedUrl = 'https://developer.android.com/jetpack/androidx/releases/camera';
  const carriedOverFromStage1 = {
    url: 'https://example.com/already-carried',
    title: 'Already carried not-yet-eligible candidate',
    publishedAt: '2026-04-27T00:00:00.000Z'
  };
  // stage 1이 이미 이 URL을 carry-forward로 들고 있었다는 시나리오 — 이번 병합 단계가
  // 같은 URL을 다시 not_yet_eligible로 걸러내더라도 URL dedupe로 하나만 남아야 한다.
  const alreadyCarriedDuplicateOfNewCandidate = {
    url: seedUrl,
    title: 'Stage 1 already knew about this release',
    publishedAt: '2026-05-06T00:00:00.000Z'
  };
  const payload = {
    ...candidatePayload(),
    coverage,
    not_yet_eligible: [carriedOverFromStage1, alreadyCarriedDuplicateOfNewCandidate],
    not_yet_eligible_overflow: false,
    carry_forward_status: 'loaded',
    carry_source: {
      path: 'articles/content/collected-news/2026-05-09/merged-candidates.json',
      sha256: 'a'.repeat(64),
      run_mode: 'scheduled'
    }
  };
  writeAndroidRegistry(root);
  writeSeedIntent(root, date, [seedUrl]);
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: ENABLED_ENV(date),
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: datedSeedPageFetch('2026-05-06')
  });

  assert.equal(result.status, 'PASS');

  // not-yet-eligible로 판정된 신규 seed 후보는 merged.candidates에서 빠지고 manual 후보만 남는다.
  const merged = readJson(mergedCandidatesPath(root, date));
  assert.equal(merged.candidates.length, 1);
  assert.equal(merged.candidates.some(item => item.origin === 'seed_url_evidence'), false);

  // stage 1이 넘긴 not_yet_eligible(2건, 그중 1건은 이번 병합 단계가 새로 걸러낼 후보와
  // URL이 같다)과 이번 병합 단계가 새로 걸러낸 후보(1건)가 URL 기준으로 dedupe되어
  // 합쳐진다 — 겹치는 URL은 stage 1 항목이 우선하므로 최종 건수는 3이 아니라 2다.
  assert.equal(merged.not_yet_eligible.length, 2);
  const notYetEligibleUrls = merged.not_yet_eligible.map(item => item.url).sort();
  assert.deepEqual(notYetEligibleUrls, [
    'https://developer.android.com/jetpack/androidx/releases/camera',
    'https://example.com/already-carried'
  ]);
  const dedupedReleaseEntry = merged.not_yet_eligible.find(item => item.url === seedUrl);
  assert.equal(dedupedReleaseEntry.title, 'Stage 1 already knew about this release');
  assert.equal(merged.not_yet_eligible_overflow, false);
  assert.equal(merged.carry_forward_status, 'loaded');
  assert.deepEqual(merged.coverage, coverage);

  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.schema_version, 3);
  assert.equal(manifest.coverage_week_key, '2026-W17');
  assert.equal(manifest.carry_forward_status, 'loaded');
  assert.equal(manifest.not_yet_eligible_count, 2);
  assert.equal(manifest.not_yet_eligible_overflow, false);

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
});

test('Stage 2 enabled merge caps a combined not_yet_eligible over the limit and preserves the full list in .tmp', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  // seed 페이지 날짜 2026-05-06은 coverage_end_date 2026-04-26보다 뒤라 not_yet_eligible이 된다.
  const coverage = {
    coverage_week_key: '2026-W17',
    coverage_start_date: '2026-04-20',
    coverage_end_date: '2026-04-26',
    coverage_end_exclusive_at: '2026-04-27T00:00:00.000Z'
  };
  const seedUrl = 'https://developer.android.com/jetpack/androidx/releases/camera';
  // stage 1이 이미 상한(60건)만큼 넘겨준 상황을 재현한다 — 전부 같은 날짜라 정렬 동률이면
  // URL 사전순으로 먼저 온다. 이번 병합 단계가 걸러낼 신규 후보(2026-05-06, 더 최신)는
  // 오름차순 정렬에서 항상 이 60건 뒤로 밀려나므로, 상한을 넘기면 신규 후보 쪽이 committed
  // 에서 잘려나간다 — 그 사실 자체가 이 테스트가 검증하려는 silent truncate 시나리오다.
  const stage1AtCap = Array.from({ length: 60 }, (_, index) => ({
    url: `https://example.com/carried-${String(index).padStart(2, '0')}`,
    title: `Carried candidate ${index}`,
    publishedAt: '2026-04-01T00:00:00.000Z'
  }));
  const payload = {
    ...candidatePayload(),
    coverage,
    not_yet_eligible: stage1AtCap,
    not_yet_eligible_overflow: false,
    carry_forward_status: 'loaded'
  };
  writeAndroidRegistry(root);
  writeSeedIntent(root, date, [seedUrl]);
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const overflowPath = path.join(root, notYetEligibleOverflowRelPath(date));
  assert.equal(fs.existsSync(overflowPath), false);

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: ENABLED_ENV(date),
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: datedSeedPageFetch('2026-05-06')
  });

  assert.equal(result.status, 'PASS');

  const merged = readJson(mergedCandidatesPath(root, date));
  // stage 1의 60건 + 이번 병합 단계가 새로 걸러낸 1건 = 61건이 상한(60)을 넘긴다.
  assert.equal(merged.not_yet_eligible.length, 60);
  assert.equal(merged.not_yet_eligible_overflow, true);
  // 더 최신(2026-05-06)인 신규 후보가 오름차순 정렬에서 committed 60건 밖으로 밀려난다.
  assert.equal(merged.not_yet_eligible.some(item => item.url === seedUrl), false);

  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.not_yet_eligible_count, 60);
  assert.equal(manifest.not_yet_eligible_overflow, true);

  // silent truncate 금지: 잘려나간 신규 후보가 .tmp 전체 목록 diagnostics artifact에 남아있어야
  // 한다.
  assert.equal(fs.existsSync(overflowPath), true);
  const overflowFull = readJson(overflowPath);
  assert.equal(overflowFull.length, 61);
  assert.equal(overflowFull.some(item => item.url === seedUrl), true);
});

test('merged candidate manifest schema_version 3 requires not_yet_eligible, coverage, and carry_forward_status', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = {
    ...candidatePayload(),
    coverage: {
      coverage_week_key: '2026-W17',
      coverage_start_date: '2026-04-20',
      coverage_end_date: '2026-04-26',
      coverage_end_exclusive_at: '2026-04-27T00:00:00.000Z'
    },
    not_yet_eligible: [],
    carry_forward_status: 'not_applicable'
  };
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  function writeAndValidate(mergedPayload) {
    writeMergedCandidateArtifacts({ root, date, payload: mergedPayload, manifestSchemaVersion: 3 });
    return validateCandidateArtifact({
      root,
      date,
      candidatePath: mergedCandidatesPath(root, date),
      manifestPath: mergedCandidateManifestPath(root, date),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'merged_candidate',
      expectedLlmUsed: 'any'
    });
  }

  const validated = writeAndValidate(payload);
  assert.equal(validated.validation_status, 'validated');
  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.schema_version, 3);
  assert.equal(manifest.coverage_week_key, '2026-W17');
  assert.equal(manifest.carry_forward_status, 'not_applicable');
  assert.equal(manifest.not_yet_eligible_count, 0);

  const { not_yet_eligible, ...withoutNotYetEligible } = payload;
  assert.throws(
    () => writeAndValidate(withoutNotYetEligible),
    /requires payload\.not_yet_eligible array/
  );

  const { coverage, ...withoutCoverage } = payload;
  assert.throws(
    () => writeAndValidate({ ...withoutCoverage, not_yet_eligible: [] }),
    /requires payload\.coverage object/
  );

  const { carry_forward_status, ...withoutCarryForwardStatus } = payload;
  assert.throws(
    () => writeAndValidate(withoutCarryForwardStatus),
    /requires carry_forward_status/
  );
});

test('merged candidate manifest schema_version 1 and 2 stay valid without the Task 10 not_yet_eligible fields', () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload();
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  writeMergedCandidateArtifacts({ root, date, payload, manifestSchemaVersion: 1 });
  const v1 = validateCandidateArtifact({
    root,
    date,
    candidatePath: mergedCandidatesPath(root, date),
    manifestPath: mergedCandidateManifestPath(root, date),
    requireManifest: true,
    validationMode: 'strict',
    expectedManifestType: 'merged_candidate',
    expectedLlmUsed: 'any'
  });
  assert.equal(v1.validation_status, 'validated');

  writeMergedCandidateArtifacts({ root, date, payload, manifestSchemaVersion: 2 });
  const v2 = validateCandidateArtifact({
    root,
    date,
    candidatePath: mergedCandidatesPath(root, date),
    manifestPath: mergedCandidateManifestPath(root, date),
    requireManifest: true,
    validationMode: 'strict',
    expectedManifestType: 'merged_candidate',
    expectedLlmUsed: 'any'
  });
  assert.equal(v2.validation_status, 'validated');
});
