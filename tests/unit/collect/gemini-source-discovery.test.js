const assert = require('node:assert/strict');
const test = require('node:test');

const {
  promoteProposalUrls
} = require('../../../scripts/newsroom/collect/gemini-source-discovery');
const {
  calculateSourceQuality
} = require('../../../scripts/newsroom/collect/score-source-candidates');

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
