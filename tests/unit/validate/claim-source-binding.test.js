const assert = require('node:assert/strict');
const test = require('node:test');

const {
  stableLinkedEvidenceItemId,
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

test('non-allowed linked evidence status ids fail fact claims', () => {
  for (const [field, evidenceId] of [
    ['failed_linked_evidence_ids', 'linked-failed-1'],
    ['skipped_linked_evidence_ids', 'linked-skipped-1'],
    ['unsupported_linked_evidence_ids', 'linked-unsupported-1']
  ]) {
    const result = validateArticleClaims({
      section: section({
        claims: [{
          claim_id: `claim-${evidenceId}`,
          text: 'CameraX 1.6.1 release date: 2026-05-06.',
          claim_type: 'fact',
          evidence_ids: [evidenceId],
          source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      }),
      candidate: candidate({
        [field]: [evidenceId],
        [`${field.replace(/_ids$/, '')}_urls`]: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }),
      strict: true
    });
    const issue = result.claim_results[0].issues.find(item => item.reason_code === 'blocked_or_failed_evidence_id');
    assert.ok(issue, field);
    assert.equal(issue.blocking, true);
  }
});

test('linked evidence fallback id is stable across item reordering', () => {
  const linkedItem = {
    fetch_status: 'skipped',
    url: 'https://example.com/linked/context',
    source_text: 'Linked evidence resolve skipped: policy_disabled.'
  };
  const first = stableLinkedEvidenceItemId(candidate(), linkedItem);
  const second = stableLinkedEvidenceItemId(candidate({
    source_aware_linked_evidence: [
      { fetch_status: 'resolved', url: 'https://example.com/other', source_text: 'Other evidence.' },
      linkedItem
    ]
  }), linkedItem);
  assert.equal(first, second);
  assert.match(first, /^le:candidate-hash:skipped:[a-f0-9]{16}:[a-f0-9]{16}$/);
});

test('claim source URL must match the referenced evidence item URL', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 linked context is app-facing AndroidX evidence.',
        claim_type: 'fact',
        evidence_ids: ['linked-a'],
        source_urls: ['https://example.com/linked-b'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      url: 'https://example.com/candidate',
      linked_evidence_ids: ['linked-a', 'linked-b'],
      compact_evidence: {
        linked_context: ['CameraX 1.6.1 linked context is app-facing AndroidX evidence.']
      },
      source_aware_linked_evidence: [
        {
          evidence_id: 'linked-a',
          fetch_status: 'resolved',
          url: 'https://example.com/linked-a',
          source_text: 'CameraX 1.6.1 linked context is app-facing AndroidX evidence.'
        },
        {
          evidence_id: 'linked-b',
          fetch_status: 'resolved',
          url: 'https://example.com/linked-b',
          source_text: 'CameraX 1.6.1 alternate evidence.'
        }
      ]
    }),
    strict: true
  });
  assert.ok(result.claim_results[0].issues.some(item => item.reason_code === 'evidence_source_url_mismatch'));
});

test('URL-less linked evidence item can fall back to candidate source URL', () => {
  const linkedItem = {
    fetch_status: 'resolved',
    source_text: 'CameraX 1.6.1 release date: 2026-05-06.'
  };
  const evidenceId = stableLinkedEvidenceItemId(candidate(), linkedItem);
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: [evidenceId],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      source_aware_linked_evidence: [linkedItem]
    }),
    strict: true
  });
  assert.equal(result.claim_results[0].issues.some(item => item.reason_code === 'evidence_source_url_mismatch'), false);
});

test('release-date evidence cannot support stream buffer runtime fact claims', () => {
  const result = validateArticleClaims({
    section: section({
      article_sections: {
        ...section().article_sections,
        verified_facts: ['CameraX 1.6.1 release date: 2026-05-06.']
      },
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 changes stream buffer runtime behavior.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'stream_buffer_metadata',
        overclaim_risk: 'medium'
      }]
    }),
    candidate: candidate(),
    strict: true
  });
  const reasons = result.claim_results[0].issues.map(item => item.reason_code);
  assert.ok(reasons.includes('runtime_claim_without_runtime_evidence'));
  assert.ok(reasons.includes('stream_buffer_metadata_without_stream_buffer_metadata_evidence'));
  assert.ok(result.claim_results[0].issues.some(item =>
    item.reason_code === 'stream_buffer_metadata_without_stream_buffer_metadata_evidence' &&
    item.support_checked_evidence_ids.includes('seed-camerax-primary-01') &&
    item.support_missing_terms.includes('stream')
  ));
});

test('safe risk_note and recommendation wording may mention non-allowed evidence without hard failure', () => {
  for (const claimType of ['risk_note', 'recommendation']) {
    const result = validateArticleClaims({
      section: section({
        claims: [{
          claim_id: `claim-${claimType}`,
          text: 'Linked evidence fetch failed, so direct HAL impact is not confirmed.',
          claim_type: claimType,
          evidence_ids: ['linked-failed-1'],
          source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      }),
      candidate: candidate({
        failed_linked_evidence_ids: ['linked-failed-1'],
        failed_linked_evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }),
      strict: true
    });
    const issue = result.claim_results[0].issues.find(item => item.reason_code === 'blocked_or_failed_evidence_id');
    assert.ok(issue, claimType);
    assert.equal(issue.blocking, false);
  }
});

test('unsafe limitation wording cannot present failed evidence as direct HAL support', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'Failed linked evidence confirms direct HAL impact.',
        claim_type: 'limitation',
        evidence_ids: ['linked-failed-1'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'direct_hal_contract',
        overclaim_risk: 'high'
      }]
    }),
    candidate: candidate({
      failed_linked_evidence_ids: ['linked-failed-1'],
      failed_linked_evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
    }),
    strict: true
  });
  const issue = result.claim_results[0].issues.find(item => item.reason_code === 'blocked_or_failed_evidence_id');
  assert.ok(issue);
  assert.equal(issue.blocking, true);
});
