const assert = require('node:assert/strict');
const test = require('node:test');

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

function registry() {
  return {
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
    }]
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
      candidate_urls: ['https://developer.android.com/jetpack/androidx/releases/camera'],
      search_keywords: ['CameraX'],
      expected_evidence: ['published date'],
      risk_notes: []
    }]
  };
}

async function fetchOk() {
  return {
    ok: true,
    text: async () => '<html><head><title>CameraX release notes</title><meta name="datePublished" content="2026-05-15"></head></html>'
  };
}

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
  assert.equal(first.promoted[0].proposal_id, 'proposal-a');
  assert.equal(second.promoted[0].proposal_trace_id, 'proposal-b');
});

test('proposal validation report records accepted and rejected URL decisions', async () => {
  const result = await promoteProposalUrls({
    proposalPayload: {
      ...proposal('proposal-a'),
      proposals: [{
        ...proposal('proposal-a').proposals[0],
        candidate_urls: [
          'https://developer.android.com/jetpack/androidx/releases/camera',
          'https://example.com/not-allowed'
        ]
      }]
    },
    sourceRegistry: registry(),
    fetchImpl: fetchOk
  });

  assert.equal(result.validationReport.length, 2);
  assert.deepEqual(
    result.validationReport.map(item => [item.normalized_url || item.candidate_url, item.accepted, item.rejected_reason]),
    [
      ['https://developer.android.com/jetpack/androidx/releases/camera', true, ''],
      ['https://example.com/not-allowed', false, 'domain_not_allowed']
    ]
  );
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
