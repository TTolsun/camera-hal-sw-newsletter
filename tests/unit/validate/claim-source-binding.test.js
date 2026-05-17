const assert = require('node:assert/strict');
const test = require('node:test');

const {
  stableSourceExtractionItemId,
  validateArticleClaims
} = require('../../../scripts/newsroom/validate/claim-source-binding');

function section(overrides = {}) {
  return {
    headline: 'CameraX 1.6.1 release',
    confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
    evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX.',
    article_sections: {
      verified_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
      background_context: 'CameraX sits above camera2.',
      hal_driver_impact: 'Treat this as framework-adjacent compatibility evidence.',
      action_items: ['Run Camera ITS checks.'],
      team_share_points: 'Use as a compatibility watch item.'
    },
    sources: [{
      title: 'CameraX release notes',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
    }],
    ...overrides
  };
}

function candidate(overrides = {}) {
  return {
    title: 'CameraX release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    source_candidate_hash: 'candidate-hash',
    impact_claim_level: 'android_framework_adjacent',
    evidence_pack_ids: ['seed-camerax-pack'],
    primary_evidence_ids: ['seed-camerax-primary-01'],
    linked_evidence_ids: ['seed-camerax-linked-01'],
    compact_evidence: {
      primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
      linked_context: ['CameraX remains an app-facing AndroidX library.'],
      do_not_claim: ['Do not claim direct Camera HAL API changes.'],
      evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
    },
    ...overrides
  };
}

test('source extraction item id remains stable when item order changes', () => {
  const first = stableSourceExtractionItemId(
    { source_candidate_hash: 'hash-a' },
    'release-bug-fixes',
    'Fixed CameraX ListenableFuture compile error.'
  );
  const second = stableSourceExtractionItemId(
    { source_candidate_hash: 'hash-a' },
    'release-bug-fixes',
    'Fixed CameraX ListenableFuture compile error.'
  );
  assert.equal(first, second);
  assert.match(first, /^sx:hash-a:release-bug-fixes:[a-f0-9]{16}$/);
});

test('pack fallback is migration-only and reports derived_evidence_mapping', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-pack'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate(),
    strict: true
  });
  assert.equal(result.claim_results[0].derived_evidence_mapping, true);
  assert.ok(result.claim_results[0].issues.some(item =>
    item.reason_code === 'derived_evidence_mapping' &&
    item.blocking === false
  ));
});

test('version mismatch prevents coverage even when text is similar', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      compact_evidence: {
        primary_facts: ['CameraX release date: 2026-05-06.'],
        evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }
    }),
    strict: true
  });
  assert.ok(result.uncovered_facts.some(item => item.reason_code === 'missing_matching_fact_claim'));
});

test('release-note fragment mismatch fails for anchor-specific evidence', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.0'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate(),
    strict: true
  });
  assert.ok(result.claim_results[0].issues.some(item => item.reason_code === 'source_url_fragment_mismatch'));
});

test('do_not_claim blocks direct HAL fact claims without direct evidence', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 changes direct Camera HAL API behavior.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'direct_hal_contract',
        overclaim_risk: 'high'
      }]
    }),
    candidate: candidate(),
    strict: true
  });
  const reasons = result.claim_results[0].issues.map(item => item.reason_code);
  assert.ok(reasons.includes('do_not_claim_violation'));
  assert.ok(reasons.includes('direct_hal_claim_without_direct_evidence'));
});
