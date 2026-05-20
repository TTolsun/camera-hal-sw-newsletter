const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  collectionIntentPath,
  geminiCandidatesPath,
  manualCandidatesPath,
  mergedCandidateManifestPath,
  mergedCandidatesPath,
  seedCandidatesPath,
  seedEvidencePackPath
} = require('../../../scripts/newsroom/common/artifact-paths');
const {
  writeManualCandidateArtifacts,
  writeMergedCandidateArtifacts
} = require('../../../scripts/newsroom/common/candidate-artifacts');
const {
  FAILED_LLM_CREDENTIALS,
  SEED_ONLY_LLM_CREDENTIALS_MISSING,
  run: runSourceDiscoveryBoundary
} = require('../../../scripts/newsroom/cli/gemini-source-discovery-boundary');
const {
  promoteProposalUrls
} = require('../../../scripts/newsroom/collect/gemini-source-discovery');
const {
  calculateSourceQuality
} = require('../../../scripts/newsroom/collect/score-source-candidates');
const {
  sourceDiscoveryCandidateStats,
  sourceDiscoveryStatsSummary
} = require('../../../scripts/newsroom/common/candidate-artifacts');
const {
  readTextFixture
} = require('../../helpers/fixture-loader');

function registry() {
  return {
    sources: [
      {
        id: 'android',
        name: 'Android Developers',
        sourceUrl: 'https://developer.android.com/',
        category: 'android',
        reliability: 'official',
        linkedEvidencePolicy: {
          enabled: true,
          allowedDomains: ['developer.android.com']
        }
      },
      {
        id: 'camerax-release-notes',
        name: 'CameraX Release Notes',
        sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
        category: 'camera-api',
        priority: 'high',
        reliability: 'official',
        enabled: true,
        candidateOnly: false,
        requiresCrossCheck: false,
        collectionModeHint: 'release-note-watch',
        evidenceGranularityHint: 'versioned_release_row',
        linkedEvidencePolicy: {
          enabled: true,
          allowedDomains: ['developer.android.com']
        }
      }
    ]
  };
}

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-source-discovery-'));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'news-sources.json'), JSON.stringify({
    schemaVersion: 2,
    sources: registry().sources
  }, null, 2), 'utf8');
  return root;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function candidatePayload(date = '2026-05-16') {
  return {
    schema_version: 5,
    date,
    newsletter_date: date,
    generated_at: '2026-05-16T00:00:00.000Z',
    candidates: [{
      title: 'Manual CameraX release',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#manual',
      source_id: 'camerax-release-notes',
      source: 'CameraX Release Notes',
      reliability: 'official',
      finalSelectionEligibility: 'short',
      final_selection_eligibility: 'short',
      main_eligible: true
    }],
    failures: []
  };
}

function proposal(proposalId) {
  return {
    schema_version: 1,
    proposal_type: 'gemini_source_discovery',
    newsletter_date: '2026-05-16',
    proposals: [{
      proposal_id: proposalId,
      topic_gap: 'CameraX release notes',
      source_family: 'official_android',
      candidate_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
      search_keywords: ['CameraX'],
      expected_evidence: ['published date'],
      risk_notes: []
    }]
  };
}

function proposalWithUrls(proposalId, candidateUrls = []) {
  const payload = proposal(proposalId);
  return {
    ...payload,
    proposals: [{
      ...payload.proposals[0],
      candidate_urls: candidateUrls
    }]
  };
}

async function fetchOk() {
  return {
    ok: true,
    text: async () => readTextFixture('source-html/camerax-release-notes-live-structure.html')
  };
}

async function fetchWithoutParserEvidence() {
  return {
    ok: true,
    text: async () => '<html><head><title>CameraX release notes</title><meta name="datePublished" content="2026-05-15"></head></html>'
  };
}

test('enabled boundary writes seed-only artifacts when Gemini credentials are missing after approved seed expansion', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  writeJson(collectionIntentPath(root, date), {
    schema_version: 1,
    newsletter_date: date,
    seed_urls: [{
      seed_id: 'seed-camerax',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera',
      expected_topic: 'CameraX release notes'
    }],
    keyword_hints: []
  });
  writeManualCandidateArtifacts({
    root,
    date,
    payload: candidatePayload(date),
    sourceCount: 1
  });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true'
    },
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      url,
      headers: { get: () => '' },
      text: async () => '<html><head><title>CameraX 1.6.1 release notes</title><meta name="datePublished" content="2026-05-15"></head><body>2026-05-15 CameraX 1.6.1 fixes Android camera stream validation.</body></html>'
    })
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.status_detail, SEED_ONLY_LLM_CREDENTIALS_MISSING);
  assert.equal(fs.existsSync(seedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(seedEvidencePackPath(root, date)), true);
  assert.equal(fs.existsSync(geminiCandidatesPath(root, date)), true);
  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.status, 'PASS');
  assert.equal(manifest.status_detail, SEED_ONLY_LLM_CREDENTIALS_MISSING);
  assert.equal(manifest.merge_mode, 'seed_evidence_expansion');
  assert.equal(manifest.llm_used, false);
  assert.equal(manifest.seed_used, true);
  const report = fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'gemini-source-discovery-report.md'), 'utf8');
  assert.match(report, /status_detail=SEED_ONLY_LLM_CREDENTIALS_MISSING/);
  assert.match(report, /Gemini discovery was skipped because LLM credentials were missing/);
});

test('enabled boundary without seed keeps missing credential path strictly no-mutation', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload(date);
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
  assert.equal(fs.existsSync(seedCandidatesPath(root, date)), false);
  assert.equal(fs.existsSync(seedEvidencePackPath(root, date)), false);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'gemini-source-discovery-report.md')), false);
  assert.equal(fs.existsSync(manualCandidatesPath(root, date)), true);
});

test('promoted Gemini candidate id is stable for the normalized URL across proposal ids', async () => {
  const first = await promoteProposalUrls({
    proposalPayload: proposal('proposal-a'),
    sourceRegistry: registry(),
    fetchImpl: fetchOk
  });
  const second = await promoteProposalUrls({
    proposalPayload: proposal('proposal-b'),
    sourceRegistry: registry(),
    fetchImpl: fetchOk
  });

  assert.equal(first.promoted.length, 1);
  assert.equal(second.promoted.length, 1);
  assert.equal(first.promoted[0].id, second.promoted[0].id);
  assert.equal(first.promoted[0].source_candidate_id, second.promoted[0].source_candidate_id);
  assert.equal(first.promoted[0].source_id, 'camerax-release-notes');
  assert.equal(first.promoted[0].source_gap_risk, false);
  assert.equal(first.promoted[0].source_extraction.mode, 'versioned_release_row');
  assert.equal(first.promoted[0].source_extraction.extraction_quality.used_versioned_release_row_extractor, true);
  assert.deepEqual(
    first.promoted[0].source_extraction.bullets,
    first.promoted[0].source_extraction.release.sections.flatMap(section => section.items.map(item => item.text))
  );
  assert.equal(first.promoted[0].proposal_id, 'proposal-a');
  assert.equal(second.promoted[0].proposal_trace_id, 'proposal-b');
});

test('release-note URL matching tolerates trailing slash before fragment', async () => {
  const result = await promoteProposalUrls({
    proposalPayload: proposalWithUrls('proposal-trailing-slash', [
      'https://developer.android.com/jetpack/androidx/releases/camera/#1.6.1'
    ]),
    sourceRegistry: registry(),
    fetchImpl: fetchOk
  });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0].source_id, 'camerax-release-notes');
  assert.equal(result.validationReport[0].extraction_status, 'parser_extracted');
});

test('release-note URL matching strips Android hl query before anchor comparison', async () => {
  const result = await promoteProposalUrls({
    proposalPayload: proposalWithUrls('proposal-hl-query', [
      'https://developer.android.com/jetpack/androidx/releases/camera?hl=ko#1.6.1'
    ]),
    sourceRegistry: registry(),
    fetchImpl: fetchOk
  });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0].source_id, 'camerax-release-notes');
  assert.equal(result.validationReport[0].source_policy_match, 'camerax-release-notes');
});

test('source matching selects CameraX release notes regardless of registry order', async () => {
  const result = await promoteProposalUrls({
    proposalPayload: proposal('proposal-order'),
    sourceRegistry: {
      sources: [...registry().sources].reverse()
    },
    fetchImpl: fetchOk
  });

  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0].source_id, 'camerax-release-notes');
  assert.equal(result.validationReport[0].source_policy_match, 'camerax-release-notes');
});

test('proposal validation report records accepted and rejected URL decisions', async () => {
  const result = await promoteProposalUrls({
    proposalPayload: proposalWithUrls('proposal-a', [
      'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      'https://example.com/not-allowed'
    ]),
    sourceRegistry: registry(),
    fetchImpl: fetchOk
  });

  assert.equal(result.validationReport.length, 2);
  assert.deepEqual(
    result.validationReport.map(item => [item.normalized_url || item.candidate_url, item.accepted, item.rejected_reason]),
    [
      ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1', true, ''],
      ['https://example.com/not-allowed', false, 'domain_not_allowed']
    ]
  );
  assert.equal(result.validationReport[0].extraction_status, 'parser_extracted');
  assert.equal(result.validationReport[0].adapter_hint, 'android-developers-jetpack-release');
});

test('release-note source discovery blocks shallow promotion when parser extraction fails', async () => {
  const result = await promoteProposalUrls({
    proposalPayload: proposal('proposal-a'),
    sourceRegistry: registry(),
    fetchImpl: fetchWithoutParserEvidence
  });

  assert.equal(result.promoted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].rejected_reason, 'discovered_not_extractable');
  assert.equal(result.rejected[0].discovery_status, 'discovered');
  assert.equal(result.rejected[0].extraction_status, 'discovered_not_extractable');
  assert.equal(result.rejected[0].adapter_hint, 'android-developers-jetpack-release');
  assert.equal(result.validationReport[0].accepted, false);
  assert.equal(result.validationReport[0].rejected_reason, 'discovered_not_extractable');
  assert.equal(result.validationReport[0].suggested_fixture_case.includes('CameraX release-note fixture'), true);
});

test('source gap risk has bucket precedence over high numeric source quality', () => {
  const item = calculateSourceQuality({
    id: 'source-gap',
    title: 'Official CameraX release note',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    reliability: 'official',
    relevanceScore: 100,
    cameraHalRelevanceScore: 100,
    published_date: '2026-05-15',
    summary: 'CameraX stream buffer metadata release note.',
    source_gap_risk: true
  }, {
    newsletterDate: '2026-05-16'
  });

  assert.equal(item.source_quality_bucket, 'blocked_candidate');
});

test('source discovery stats separate Gemini records, unique URLs, and manual duplicates', () => {
  const stats = sourceDiscoveryCandidateStats({
    manualCandidates: [
      { url: 'https://example.com/a' },
      { url: 'https://example.com/b' }
    ],
    geminiCandidates: [
      {
        url: 'https://example.com/a',
        origin: 'gemini_discovery',
        finalSelectionEligibility: 'watchlist',
        source_gap_risk: true,
        main_eligible: false
      },
      {
        url: 'https://example.com/c',
        origin: 'gemini_discovery',
        finalSelectionEligibility: 'main',
        source_gap_risk: false,
        main_eligible: true
      },
      {
        url: 'https://example.com/c',
        origin: 'gemini_discovery',
        final_selection_eligibility: 'short',
        source_gap_risk: false,
        main_eligible: true
      }
    ],
    mergedCandidates: [
      { url: 'https://example.com/a' },
      { url: 'https://example.com/b' },
      { url: 'https://example.com/a' },
      { url: 'https://example.com/c' },
      { url: 'https://example.com/c' }
    ]
  });

  assert.deepEqual(stats, {
    manual_candidate_count: 2,
    manual_unique_url_count: 2,
    gemini_candidate_count: 3,
    gemini_unique_url_count: 2,
    gemini_new_unique_url_count: 1,
    gemini_manual_duplicate_url_count: 1,
    gemini_duplicate_record_count: 1,
    merged_candidate_count: 5,
    merged_unique_url_count: 3,
    gemini_publishable_candidate_count: 2
  });
});

test('source discovery stats separate seed evidence records from Gemini records', () => {
  const stats = sourceDiscoveryCandidateStats({
    manualCandidates: [
      { url: 'https://example.com/a' }
    ],
    seedCandidates: [
      {
        url: 'https://example.com/a',
        origin: 'seed_url_evidence',
        finalSelectionEligibility: 'short',
        source_gap_risk: false,
        main_eligible: true,
        primary_evidence_ids: ['seed-a-primary-01']
      },
      {
        url: 'https://example.com/b',
        origin: 'seed_url_evidence',
        finalSelectionEligibility: 'watchlist',
        source_gap_risk: true,
        main_eligible: false
      }
    ],
    geminiCandidates: [
      {
        url: 'https://example.com/c',
        origin: 'gemini_discovery',
        finalSelectionEligibility: 'short',
        source_gap_risk: false,
        main_eligible: true
      }
    ],
    mergedCandidates: [
      { url: 'https://example.com/a' },
      { url: 'https://example.com/b' },
      { url: 'https://example.com/c' }
    ]
  });

  assert.equal(stats.seed_candidate_count, 2);
  assert.equal(stats.seed_unique_url_count, 2);
  assert.equal(stats.seed_new_unique_url_count, 1);
  assert.equal(stats.seed_enriched_duplicate_count, 1);
  assert.equal(stats.seed_publishable_candidate_count, 1);
  assert.equal(stats.seed_primary_evidence_count, 1);
  assert.equal(stats.gemini_candidate_count, 1);
  assert.equal(stats.gemini_new_unique_url_count, 1);
});

test('source discovery summary reports no new publishable Gemini candidates distinctly from duplicate URLs', () => {
  const stats = sourceDiscoveryCandidateStats({
    manualCandidates: [
      { url: 'https://example.com/a' },
      { url: 'https://example.com/b' },
      { url: 'https://example.com/c' },
      { url: 'https://example.com/d' },
      { url: 'https://example.com/e' },
      { url: 'https://example.com/f' }
    ],
    geminiCandidates: ['a', 'b', 'c', 'd', 'e', 'f'].map(item => ({
      url: `https://example.com/${item}`,
      origin: 'gemini_discovery',
      finalSelectionEligibility: 'watchlist',
      source_gap_risk: true,
      main_eligible: false
    })),
    mergedCandidates: []
  });

  assert.equal(stats.gemini_candidate_count, 6);
  assert.equal(stats.gemini_unique_url_count, 6);
  assert.equal(stats.gemini_new_unique_url_count, 0);
  assert.equal(stats.gemini_manual_duplicate_url_count, 6);
  assert.equal(stats.gemini_duplicate_record_count, 6);
  assert.equal(stats.gemini_publishable_candidate_count, 0);
  assert.equal(
    sourceDiscoveryStatsSummary(stats, { llmUsed: true }),
    'Gemini ran, but found no new unique publishable candidates.'
  );
});

test('source discovery stats use URL aliases and exclude URL-less Gemini candidates from publishable count', () => {
  const stats = sourceDiscoveryCandidateStats({
    manualCandidates: [
      { source_candidate_url: 'https://example.com/a' }
    ],
    geminiCandidates: [
      {
        articleUrl: 'https://example.com/a',
        origin: 'gemini_discovery',
        finalSelectionEligibility: 'main',
        source_gap_risk: false,
        main_eligible: true
      },
      {
        normalized_url: 'https://example.com/b',
        origin: 'gemini_discovery',
        final_selection_eligibility: 'short',
        source_gap_risk: false,
        main_eligible: true
      },
      {
        origin: 'gemini_discovery',
        finalSelectionEligibility: 'main',
        source_gap_risk: false,
        main_eligible: true
      }
    ],
    mergedCandidates: [
      { source_candidate_url: 'https://example.com/a' },
      { normalized_url: 'https://example.com/b' }
    ]
  });

  assert.equal(stats.manual_candidate_count, 1);
  assert.equal(stats.manual_unique_url_count, 1);
  assert.equal(stats.gemini_candidate_count, 3);
  assert.equal(stats.gemini_unique_url_count, 2);
  assert.equal(stats.gemini_new_unique_url_count, 1);
  assert.equal(stats.gemini_manual_duplicate_url_count, 1);
  assert.equal(stats.gemini_duplicate_record_count, 1);
  assert.equal(stats.merged_candidate_count, 2);
  assert.equal(stats.merged_unique_url_count, 2);
  assert.equal(stats.gemini_publishable_candidate_count, 2);
});
