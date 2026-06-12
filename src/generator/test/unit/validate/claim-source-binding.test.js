const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildAllowedClaimEvidence,
  buildEvidenceIndex,
  normalizeSeedPackStatus,
  stableLinkedEvidenceItemId,
  stableSourceExtractionItemId,
  validateArticleClaims
} = require('../../../quality/claim-source-binding');
const { readJsonFixture } = require('../../../../core/test/helpers/fixture-loader');

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

function seedEvidencePack(packs = []) {
  return {
    schema_version: 1,
    report_type: 'seed_evidence_pack',
    packs
  };
}

function seedPack({
  packId = 'seed-camerax-pack',
  seedId = 'seed-camerax',
  sourceId = '',
  url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
  evidenceId = 'seed-camerax-primary-01',
  linkedEvidenceId = '',
  linkedStatus,
  title = 'CameraX 1.6.1 release',
  fact = 'CameraX 1.6.1 release date: 2026-05-06.',
  linkedFact = 'CameraX linked context remains app-facing.',
  publishedAt = '2026-05-06',
  doNotClaim = []
} = {}) {
  const linkedEvidence = linkedEvidenceId
    ? [{
        evidence_id: linkedEvidenceId,
        url,
        title,
        ...(linkedStatus ? { fetch_status: linkedStatus } : {}),
        source_backed_items: [linkedFact]
      }]
    : [];
  return {
    evidence_pack_id: packId,
    seed_id: seedId,
    source_id: sourceId,
    seed_url: url,
    final_url: url,
    title,
    primary_evidence: [{
      evidence_id: evidenceId,
      url,
      title,
      published_at: publishedAt,
      source_backed_items: [fact]
    }],
    linked_evidence: linkedEvidence,
    do_not_claim: doNotClaim
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

test('source extraction item id distinguishes different Korean-only evidence text', () => {
  // Pure Korean evidence (no distinguishing Latin). Under old NFKD + 가-힣 filter both texts
  // normalized to the same empty residue and hashed to an identical id, colliding distinct
  // evidence items. NFC preserves the Korean so the ids stay apart. (Fails on old NFKD.)
  const first = stableSourceExtractionItemId(
    { source_candidate_hash: 'hash-a' },
    'evidence_blocks',
    '카메라 버퍼 관리 동작이 변경되었습니다.'
  );
  const second = stableSourceExtractionItemId(
    { source_candidate_hash: 'hash-a' },
    'evidence_blocks',
    '카메라 스트림 구성 동작이 변경되었습니다.'
  );
  assert.notEqual(first, second);
});

test('allowed claim evidence exposes only validator-allowed item ids', () => {
  const sourceText = 'CameraX 1.6.1 fixes preview behavior for foldable window resizing.';
  const claimCandidate = candidate({
    summary: 'CameraX 1.6.1 release summary.',
    behavior_change: 'CameraX preview behavior changed.',
    evidence_pack_ids: ['seed-camerax-pack'],
    primary_evidence_ids: ['seed-camerax-primary-01'],
    linked_evidence_ids: ['seed-camerax-linked-01'],
    evidence_ids: ['candidate-evidence-1'],
    source_extraction: {
      evidence_blocks: [{
        heading: 'CameraX 1.6.1',
        text: sourceText,
        links: [{ url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1' }]
      }]
    },
    linked_evidence: [{
      evidence_id: 'blocked-linked-1',
      fetch_status: 'failed',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      source_text: 'Failed linked context should not be exposed as allowed claim evidence.'
    }],
    unsupported_linked_evidence_ids: ['unsupported-linked-1'],
    unsupported_linked_evidence_urls: ['https://example.com/unsupported']
  });
  const seedPackData = seedEvidencePack([
    seedPack({ linkedEvidenceId: 'seed-camerax-linked-01', linkedStatus: 'allowed' })
  ]);

  const allowed = buildAllowedClaimEvidence(claimCandidate, section(), {
    seedEvidencePack: seedPackData
  });
  const allowedIds = allowed.map(item => item.evidence_id);
  const expectedIds = [...buildEvidenceIndex(claimCandidate, section(), {
    seedEvidencePack: seedPackData
  }).byId.values()]
    .filter(item => item.status === 'allowed' && item.provenance_only !== true)
    .map(item => item.id)
    .sort();

  assert.deepEqual([...allowedIds].sort(), expectedIds);
  assert.ok(allowedIds.includes('seed-camerax-primary-01'));
  assert.ok(allowedIds.includes('seed-camerax-linked-01'));
  assert.ok(allowedIds.includes('candidate-evidence-1'));
  assert.ok(allowedIds.includes(stableSourceExtractionItemId(claimCandidate, 'evidence_blocks', sourceText)));
  assert.ok(allowedIds.includes('candidate:candidate-hash:source-summary'));
  assert.equal(allowedIds.includes('seed-camerax-pack'), false);
  assert.equal(allowedIds.includes('blocked-linked-1'), false);
  assert.equal(allowedIds.includes('unsupported-linked-1'), false);
  assert.ok(allowed.every(item =>
    typeof item.evidence_id === 'string' &&
    typeof item.kind === 'string' &&
    Array.isArray(item.source_urls) &&
    typeof item.text === 'string'
  ));
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

test('stale candidate impact_claim_level does not satisfy direct HAL claim evidence', () => {
  const result = validateArticleClaims({
    section: section({
      headline: 'Google AI Studio native Android tooling update',
      article_sections: {
        ...section().article_sections,
        hal_driver_impact: 'No direct HAL runtime impact is confirmed; treat this as Android app tooling context.'
      },
      claims: [{
        claim_id: 'claim-1',
        text: 'Google AI Studio changes Camera HAL runtime behavior.',
        claim_type: 'fact',
        evidence_ids: ['ai-studio-primary-01'],
        source_urls: ['https://developers.googleblog.com/ai-studio-native-android-apps'],
        impact_level: 'direct_hal_contract',
        overclaim_risk: 'high'
      }]
    }),
    candidate: candidate({
      title: 'Google AI Studio native Android app generation',
      url: 'https://developers.googleblog.com/ai-studio-native-android-apps',
      relevance_bucket: 'cpp_ai_tooling_fallback',
      impact_claim_level: 'direct_hal_change',
      primary_evidence_ids: ['ai-studio-primary-01'],
      compact_evidence: {
        primary_facts: ['Google AI Studio can generate native Android apps from a prompt.'],
        linked_context: ['Generated apps can use Android APIs such as Camera, GPS, and Bluetooth.'],
        do_not_claim: [],
        evidence_urls: ['https://developers.googleblog.com/ai-studio-native-android-apps']
      }
    }),
    strict: true
  });
  const reasons = result.claim_results[0].issues.map(item => item.reason_code);
  assert.ok(reasons.includes('direct_hal_claim_without_direct_evidence'));
  assert.ok(reasons.includes('do_not_claim_violation'));
});

test('article_sections.do_not_claim blocks direct HAL fact claims', () => {
  const result = validateArticleClaims({
    section: section({
      article_sections: {
        ...section().article_sections,
        do_not_claim: ['Do not claim direct Camera HAL API changes from this source.']
      },
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
    candidate: candidate({
      compact_evidence: {
        primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
        linked_context: ['CameraX remains an app-facing AndroidX library.'],
        do_not_claim: [],
        evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }
    }),
    strict: true
  });
  const reasons = result.claim_results[0].issues.map(item => item.reason_code);
  assert.ok(reasons.includes('do_not_claim_violation'));
});

test('article_sections.known_limitations blocks direct runtime overclaim when limitation says no direct evidence', () => {
  const result = validateArticleClaims({
    section: section({
      article_sections: {
        ...section().article_sections,
        known_limitations: ['No direct HAL API evidence is stated by the source.']
      },
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
    candidate: candidate({
      compact_evidence: {
        primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
        linked_context: ['CameraX remains an app-facing AndroidX library.'],
        do_not_claim: [],
        evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }
    }),
    strict: true
  });
  const reasons = result.claim_results[0].issues.map(item => item.reason_code);
  assert.ok(reasons.includes('do_not_claim_violation'));
});

test('article_sections.watch_items does not become a do_not_claim guardrail', () => {
  const result = validateArticleClaims({
    section: section({
      article_sections: {
        ...section().article_sections,
        watch_items: ['Watch direct HAL API evidence in future releases.']
      },
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
    candidate: candidate({
      compact_evidence: {
        primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
        linked_context: ['CameraX remains an app-facing AndroidX library.'],
        do_not_claim: [],
        evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }
    }),
    strict: true
  });
  const reasons = result.claim_results[0].issues.map(item => item.reason_code);
  assert.ok(reasons.includes('direct_hal_claim_without_direct_evidence'));
  assert.equal(reasons.includes('do_not_claim_violation'), false);
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

test('seed evidence pack primary item supports only the bound candidate evidence index', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      primary_evidence_ids: [],
      linked_evidence_ids: [],
      compact_evidence: {
        evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }
    }),
    seedEvidencePack: seedEvidencePack([seedPack()]),
    strict: true
  });
  assert.equal(result.claim_results[0].status, 'bound');
  assert.deepEqual(result.claim_results[0].invalid_evidence_ids, []);
});

test('missing seed evidence pack preserves candidate-local validation behavior', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate(),
    strict: true
  });
  assert.equal(result.claim_results[0].status, 'bound');
  assert.equal(result.issues.some(item => /^seed_evidence_pack_/.test(item.reason_code)), false);
});

test('missing evidence id mapping fixture remains unresolved', () => {
  const fixture = readJsonFixture('seed-evidence/bad/missing-evidence-id-mapping.json');
  const missingEvidenceId = fixture.section.claims[0].evidence_ids[0];
  const result = validateArticleClaims({
    section: section(fixture.section),
    candidate: candidate(fixture.candidate),
    seedEvidencePack: fixture.seed_evidence_pack,
    strict: true
  });

  assert.equal(result.claim_results[0].status, 'needs_fix');
  assert.equal(result.claim_results[0].invalid_evidence_ids.includes(missingEvidenceId), true);
  assert.ok(result.claim_results[0].issues.some(item => item.reason_code === fixture.expected.reason));
});

test('keyword hint fixture cannot be used as source-backed evidence', () => {
  const fixture = readJsonFixture('seed-evidence/bad/keyword-hint-used-as-fact.json');
  const keywordEvidenceId = fixture.section.claims[0].evidence_ids[0];
  const result = validateArticleClaims({
    section: section(fixture.section),
    candidate: candidate(fixture.candidate),
    seedEvidencePack: fixture.seed_evidence_pack,
    strict: true
  });

  assert.equal(result.claim_results[0].status, 'needs_fix');
  assert.equal(result.claim_results[0].invalid_evidence_ids.includes(keywordEvidenceId), true);
  assert.ok(result.claim_results[0].issues.some(item => item.reason_code === fixture.expected.reason));
});

test('seed pack can merge by primary_evidence_ids without pack id or ref', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      source_extraction_ref: '',
      evidence_pack_ids: [],
      seed_ids: [],
      primary_evidence_ids: ['seed-camerax-primary-01'],
      linked_evidence_ids: []
    }),
    seedEvidencePack: seedEvidencePack([seedPack()]),
    strict: true
  });

  assert.equal(result.claim_results[0].status, 'bound');
  assert.deepEqual(result.claim_results[0].invalid_evidence_ids, []);
});

test('seed pack can match by linked_evidence_ids but missing linked status is unsupported', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX linked context remains app-facing.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-linked-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      source_extraction_ref: '',
      evidence_pack_ids: [],
      seed_ids: [],
      primary_evidence_ids: [],
      linked_evidence_ids: ['seed-camerax-linked-01']
    }),
    seedEvidencePack: seedEvidencePack([
      seedPack({ linkedEvidenceId: 'seed-camerax-linked-01' })
    ]),
    strict: true
  });

  assert.equal(result.claim_results[0].status, 'needs_fix');
  assert.ok(result.claim_results[0].blocked_evidence_ids.includes('seed-camerax-linked-01'));
  assert.ok(result.claim_results[0].issues.some(item => item.reason_code === 'blocked_or_failed_evidence_id'));
  assert.equal(result.claim_results[0].evidence_statuses[0].normalized_status, 'unsupported');
});

test('unique URL seed pack fallback is diagnostic-only and does not merge evidence', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      source_extraction_ref: '',
      evidence_pack_ids: [],
      seed_ids: [],
      primary_evidence_ids: [],
      linked_evidence_ids: []
    }),
    seedEvidencePack: seedEvidencePack([seedPack()]),
    strict: true
  });

  assert.ok(result.issues.some(item => item.reason_code === 'seed_evidence_pack_url_fallback_rejected'));
  assert.ok(result.claim_results[0].invalid_evidence_ids.includes('seed-camerax-primary-01'));
});

test('shared release-note URL-only seed pack match is rejected without disambiguating evidence', () => {
  const sharedUrl = 'https://developer.android.com/jetpack/androidx/releases/camera';
  const result = validateArticleClaims({
    section: section({
      confirmed_facts: ['Release note source evidence exists.'],
      evidence_summary: 'Official release note source evidence.',
      article_sections: {
        verified_facts: ['Release note source evidence exists.'],
        background_context: 'CameraX sits above camera2.',
        hal_driver_impact: 'Treat as adjacent source context.',
        action_items: ['Review source evidence.'],
        team_share_points: 'Use only matched evidence.'
      },
      claims: [{
        claim_id: 'claim-1',
        text: 'Release note source evidence exists.',
        claim_type: 'fact',
        evidence_ids: ['seed-a-primary-01'],
        source_urls: [sharedUrl],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }],
      sources: [{ title: 'CameraX release notes', url: sharedUrl }]
    }),
    candidate: candidate({
      title: 'Release notes',
      url: sharedUrl,
      version_or_release: '',
      published_date: '',
      publishedAt: '',
      api_or_component: '',
      evidence_pack_ids: [],
      seed_ids: [],
      primary_evidence_ids: [],
      linked_evidence_ids: [],
      compact_evidence: { evidence_urls: [sharedUrl] }
    }),
    seedEvidencePack: seedEvidencePack([
      seedPack({
        packId: 'seed-a-pack',
        seedId: 'seed-a',
        url: sharedUrl,
        evidenceId: 'seed-a-primary-01',
        title: 'Release 1.0',
        fact: 'Release note source evidence exists.'
      }),
      seedPack({
        packId: 'seed-b-pack',
        seedId: 'seed-b',
        url: sharedUrl,
        evidenceId: 'seed-b-primary-01',
        title: 'Release 2.0',
        fact: 'Other release evidence exists.'
      })
    ]),
    strict: true
  });
  assert.ok(result.issues.some(item => item.reason_code === 'seed_evidence_pack_url_only_shared_page_rejected'));
  assert.ok(result.claim_results[0].invalid_evidence_ids.includes('seed-a-primary-01'));
});

test('generated section facts cannot disambiguate shared URL seed packs', () => {
  const sharedUrl = 'https://developer.android.com/jetpack/androidx/releases/camera';
  const result = validateArticleClaims({
    section: section({
      confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
      evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX.',
      article_sections: {
        verified_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
        background_context: 'CameraX sits above camera2.',
        hal_driver_impact: 'Treat as adjacent source context.',
        action_items: ['Review source evidence.'],
        team_share_points: 'Use only matched evidence.'
      },
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-a-primary-01'],
        source_urls: [sharedUrl],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }],
      sources: [{ title: 'CameraX release notes', url: sharedUrl }]
    }),
    candidate: candidate({
      title: 'Release notes',
      url: sharedUrl,
      version_or_release: '',
      published_date: '',
      publishedAt: '',
      api_or_component: '',
      evidence_pack_ids: [],
      seed_ids: [],
      primary_evidence_ids: [],
      linked_evidence_ids: [],
      compact_evidence: { evidence_urls: [sharedUrl] }
    }),
    seedEvidencePack: seedEvidencePack([
      seedPack({
        packId: 'seed-a-pack',
        seedId: 'seed-a',
        url: sharedUrl,
        evidenceId: 'seed-a-primary-01',
        title: 'CameraX 1.6.1',
        fact: 'CameraX 1.6.1 release date: 2026-05-06.'
      }),
      seedPack({
        packId: 'seed-b-pack',
        seedId: 'seed-b',
        url: sharedUrl,
        evidenceId: 'seed-b-primary-01',
        title: 'CameraX 1.6.0',
        fact: 'CameraX 1.6.0 release date: 2026-04-01.'
      })
    ]),
    strict: true
  });

  assert.ok(result.issues.some(item => item.reason_code === 'seed_evidence_pack_url_only_shared_page_rejected'));
  assert.ok(result.claim_results[0].invalid_evidence_ids.includes('seed-a-primary-01'));
});

test('title fallback seed pack match is diagnostic-only and does not merge evidence', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://example.com/fallback-pack#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }],
      sources: [{ title: 'Fallback source', url: 'https://example.com/candidate-only' }]
    }),
    candidate: candidate({
      title: 'CameraX 1.6.1 release',
      source_id: 'androidx-camera',
      url: 'https://example.com/candidate-only',
      compact_evidence: { evidence_urls: ['https://example.com/candidate-only'] },
      source_extraction_ref: '',
      evidence_pack_ids: [],
      seed_ids: [],
      primary_evidence_ids: [],
      linked_evidence_ids: []
    }),
    seedEvidencePack: seedEvidencePack([
      seedPack({
        packId: 'seed-camerax-pack',
        seedId: 'seed-camerax',
        sourceId: 'androidx-camera',
        url: 'https://example.com/fallback-pack#1.6.1'
      })
    ]),
    strict: true
  });

  assert.ok(result.issues.some(item => item.reason_code === 'seed_evidence_pack_title_fallback_rejected'));
  assert.ok(result.claim_results[0].invalid_evidence_ids.includes('seed-camerax-primary-01'));
});

test('source extraction ref out of range is diagnostic-only and does not merge evidence', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      source_extraction_ref: 'seed-evidence-pack.json#/packs/9',
      evidence_pack_ids: [],
      seed_ids: [],
      primary_evidence_ids: [],
      linked_evidence_ids: []
    }),
    seedEvidencePack: seedEvidencePack([seedPack()]),
    strict: true
  });

  assert.ok(result.issues.some(item => item.reason_code === 'seed_evidence_pack_ref_out_of_range'));
  assert.ok(result.claim_results[0].invalid_evidence_ids.includes('seed-camerax-primary-01'));
});

test('source extraction ref conflicting evidence_pack_ids does not merge evidence', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      source_extraction_ref: 'seed-evidence-pack.json#/packs/0',
      evidence_pack_ids: ['different-pack'],
      primary_evidence_ids: [],
      linked_evidence_ids: [],
      seed_ids: []
    }),
    seedEvidencePack: seedEvidencePack([seedPack()]),
    strict: true
  });

  assert.ok(result.issues.some(item => item.reason_code === 'seed_evidence_pack_ref_metadata_mismatch'));
  assert.ok(result.claim_results[0].invalid_evidence_ids.includes('seed-camerax-primary-01'));
});

test('source extraction ref metadata mismatch is soft when ref contract is valid', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      title: 'Different candidate title',
      source_id: 'different-source',
      source_extraction_ref: 'seed-evidence-pack.json#/packs/0',
      evidence_pack_ids: ['seed-camerax-pack']
    }),
    seedEvidencePack: seedEvidencePack([
      seedPack({ sourceId: 'androidx-camera' })
    ]),
    strict: true
  });

  assert.equal(result.claim_results[0].status, 'bound');
  assert.ok(result.issues.some(item =>
    item.reason_code === 'seed_evidence_pack_ref_metadata_mismatch' &&
    item.blocking === false
  ));
});

test('ambiguous seed pack match does not merge pack evidence', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-a-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate({
      seed_ids: ['seed-a', 'seed-b'],
      evidence_pack_ids: [],
      primary_evidence_ids: [],
      linked_evidence_ids: []
    }),
    seedEvidencePack: seedEvidencePack([
      seedPack({ packId: 'seed-a-pack', seedId: 'seed-a', evidenceId: 'seed-a-primary-01' }),
      seedPack({ packId: 'seed-b-pack', seedId: 'seed-b', evidenceId: 'seed-b-primary-01' })
    ]),
    strict: true
  });
  assert.ok(result.issues.some(item => item.reason_code === 'seed_evidence_pack_ambiguous'));
  assert.ok(result.claim_results[0].invalid_evidence_ids.includes('seed-a-primary-01'));
});

test('source mismatched evidence ids are reported separately from invalid ids', () => {
  const result = validateArticleClaims({
    section: section({
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://example.com/wrong-source#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate(),
    strict: true
  });

  assert.ok(result.claim_results[0].source_mismatched_evidence_ids.includes('seed-camerax-primary-01'));
  assert.equal(result.claim_results[0].invalid_evidence_ids.includes('seed-camerax-primary-01'), false);
});

test('seed pack do_not_claim guardrails are additive', () => {
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
    candidate: candidate({
      do_not_claim: [],
      compact_evidence: {
        primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
        evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }
    }),
    seedEvidencePack: seedEvidencePack([
      seedPack({
        doNotClaim: ['Do not claim direct Camera HAL API changes.']
      })
    ]),
    strict: true
  });
  assert.ok(result.claim_results[0].issues.some(item => item.reason_code === 'do_not_claim_violation'));
});

test('seed pack status normalization maps failed_or_blocked to blocked', () => {
  assert.equal(normalizeSeedPackStatus('failed_or_blocked'), 'blocked');
});

function koreanFactSection(verifiedFact, claimText, overrides = {}) {
  return section({
    headline: '한국어 사실 커버리지 테스트',
    confirmed_facts: [],
    evidence_summary: '',
    article_sections: {
      verified_facts: [verifiedFact],
      background_context: 'Google AI Studio는 Android 앱 개발 도구입니다.',
      hal_driver_impact: '프레임워크 인접 호환성 증거로 다룹니다.',
      action_items: ['참조 기기에서 검증 항목을 실행한다.'],
      team_share_points: '팀 공유용 호환성 관찰 항목.'
    },
    claims: [{
      claim_id: 'claim-ko',
      text: claimText,
      claim_type: 'fact',
      evidence_ids: ['seed-camerax-primary-01'],
      source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }],
    ...overrides
  });
}

test('Korean paraphrase of a verified fact is covered by a similar fact claim', () => {
  // 같은 사실의 조사/어미만 다른 paraphrase("네이티브…지원" vs "전체…제공")는
  // 어절 Jaccard로는 0.72 미만이지만 hybrid(문자 bigram) similarity로 커버되어야 한다.
  const result = validateArticleClaims({
    section: koreanFactSection(
      '네이티브 Android 앱을 빌드하는 도구를 지원합니다.',
      '전체 Android 앱을 빌드할 수 있는 네이티브 도구를 제공합니다.'
    ),
    candidate: candidate(),
    strict: true
  });
  assert.equal(
    result.uncovered_facts.some(item => item.field === 'article_sections.verified_facts[0]'),
    false
  );
});

test('a verified fact is not falsely covered by a claim about a different fact in the same article', () => {
  const result = validateArticleClaims({
    section: koreanFactSection(
      '네이티브 Android 앱을 빌드하는 도구를 지원합니다.',
      '카메라 입력 기반 객체 감지와 이미지 세분화를 수행합니다.'
    ),
    candidate: candidate(),
    strict: true
  });
  assert.ok(result.uncovered_facts.some(item =>
    item.field === 'article_sections.verified_facts[0]' &&
    item.reason_code === 'missing_matching_fact_claim'
  ));
});

test('claims sharing only generic Korean modifiers do not falsely cover a fact', () => {
  const result = validateArticleClaims({
    section: koreanFactSection(
      '전체 Android 앱 빌드를 위한 도구를 지원합니다.',
      '전체 Android 보안 패치 배포 일정을 안내합니다.'
    ),
    candidate: candidate(),
    strict: true
  });
  assert.ok(result.uncovered_facts.some(item =>
    item.field === 'article_sections.verified_facts[0]' &&
    item.reason_code === 'missing_matching_fact_claim'
  ));
});

test('protected version token blocks coverage despite high character overlap', () => {
  // 문자 overlap이 매우 높아도(버전만 다름) protected-token guard가 먼저 차단해야 한다.
  const result = validateArticleClaims({
    section: koreanFactSection(
      'CameraX 1.6.1 릴리스 날짜는 2026-05-06입니다.',
      'CameraX 1.6.0 릴리스 날짜는 2026-05-06입니다.'
    ),
    candidate: candidate({
      compact_evidence: {
        primary_facts: ['CameraX 1.6.0 릴리스 날짜는 2026-05-06입니다.'],
        evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
      }
    }),
    strict: true
  });
  assert.ok(result.uncovered_facts.some(item =>
    item.field === 'article_sections.verified_facts[0]' &&
    item.reason_code === 'missing_matching_fact_claim'
  ));
});

test('only article_sections.verified_facts requires claim coverage; confirmed_facts and evidence_summary do not', () => {
  const result = validateArticleClaims({
    section: section({
      headline: 'canonical verified_facts coverage 계약',
      confirmed_facts: ['레거시 확정 사실: 어떤 claim으로도 커버되지 않는 내용.'],
      evidence_summary: '어떤 claim으로도 커버되지 않는 별도의 요약 텍스트입니다.',
      article_sections: {
        verified_facts: ['Google AI Studio는 프롬프트 기반 앱 빌드를 지원합니다.'],
        background_context: 'Google AI Studio 배경 맥락.',
        hal_driver_impact: '프레임워크 인접 영향.',
        action_items: ['검증 항목을 실행한다.'],
        team_share_points: '공유 포인트.'
      },
      claims: [{
        claim_id: 'claim-vf',
        text: 'Google AI Studio는 프롬프트 기반 앱 빌드를 지원합니다.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    }),
    candidate: candidate(),
    strict: true
  });
  // verified_facts[0]은 동일 claim으로 커버되고, 레거시 confirmed_facts/evidence_summary는
  // 더 이상 coverage 대상이 아니므로 uncovered가 없어야 한다.
  assert.deepEqual(result.uncovered_facts, []);
  assert.equal(
    result.uncovered_facts.some(item =>
      /^confirmed_facts\[/.test(item.field) || item.field === 'evidence_summary'
    ),
    false
  );
});
