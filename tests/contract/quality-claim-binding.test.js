'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildQualityReportMarkdown
} = require('../../scripts/newsroom/validate/newsletter-quality');
const {
  reportFor,
  scopedCandidate,
  section,
  validSections,
  reporterCandidatesFor
} = require('../helpers/quality-builders');
const {
  seedEvidencePack,
  seedPack
} = require('../helpers/quality-fixtures');

function linkedEvidenceSummary(overrides = {}) {
  return {
    schema_version: 1,
    total_count: 1,
    by_type: { github_pull_request: 1 },
    by_fetch_status: { resolved: 1 },
    impact_type_counts: {},
    warning_count: 0,
    has_resolved_evidence: true,
    has_unresolved_evidence: false,
    top_identifiers: ['PR #123'],
    ...overrides
  };
}

function impactClassification(overrides = {}) {
  return {
    impact_type: 'runtime_behavior_change',
    hal_runtime_impact: true,
    camera_pipeline_impact: true,
    recommended_article_type: 'main',
    confidence: 0.75,
    reason: 'Synthetic linked evidence impact.',
    warnings: [],
    ...overrides
  };
}

function linkedEvidenceCandidate(url, bucket = 'direct_aosp_camera', overrides = {}) {
  return scopedCandidate(url, bucket, {
    linked_evidence_summary: linkedEvidenceSummary(),
    impact_classification: impactClassification(),
    ...overrides
  });
}

function reportWithTargetSection(targetSection, targetCandidate, extraCandidates = []) {
  const sections = [
    targetSection,
    section({ headline: 'CameraX release B', url: 'https://example.com/linked-b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/linked-c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/linked-d' })
  ];
  return reportFor(sections, [
    targetCandidate,
    scopedCandidate('https://example.com/linked-b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/linked-c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/linked-d', 'direct_aosp_camera'),
    ...extraCandidates
  ]);
}

function linkedDeductions(report, category) {
  return report.deductions.filter(item => item.category === category);
}

test('strict claim validation blocks factual fields without claims', () => {
  const url = 'https://example.com/claimless';
  const report = reportFor(
    [
      section({
        headline: 'Claimless factual article',
        url,
        confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
        evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX.'
      }),
      ...validSections().slice(1)
    ],
    [
      scopedCandidate(url, 'direct_aosp_camera', {
        primary_evidence_ids: ['seed-camerax-primary-01'],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url]
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(1)
    ],
    { strictClaimValidation: true }
  );

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item =>
    item.category === 'claim-contract' &&
    item.reason_code === 'missing_claims'
  ));
  assert.ok(report.uncovered_facts.some(item =>
    item.field === 'article_sections.verified_facts[0]' ||
    item.field === 'confirmed_facts[0]'
  ));
});

test('deterministic binding fills missing evidence_ids on otherwise source-supported fact claims', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const article = section({
    headline: 'CameraX 1.6.1 fact claim without evidence_ids',
    url,
    confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
    evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX.',
    claims: [{
      claim_id: 'claim-1',
      text: 'CameraX 1.6.1 release date: 2026-05-06.',
      claim_type: 'fact',
      evidence_ids: [],
      source_urls: [url],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }]
  });
  const report = reportFor(
    [article, ...validSections().slice(1)],
    [
      scopedCandidate(url, 'android_platform_camera_adjacent', {
        primary_evidence_ids: ['seed-camerax-primary-01'],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url]
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(1)
    ],
    { strictClaimValidation: true }
  );

  assert.ok(!report.deductions.some(item => item.reason_code === 'missing_fact_evidence_ids'));
  const claim = report.claim_results.find(item => item.claim_id === 'claim-1');
  assert.equal(claim.status, 'bound');
  assert.deepEqual(claim.evidence_ids, ['seed-camerax-primary-01']);
});

test('deterministic binding leaves unsupported fact claims unbound (no false evidence binding)', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const article = section({
    headline: 'Unsupported fabricated fact claim',
    url,
    confirmed_facts: ['CameraX 9.9.9 adds a fabricated direct HAL API on 2099-01-01.'],
    evidence_summary: 'Version: CameraX 9.9.9; release date: 2099-01-01; API/component: CameraX.',
    claims: [{
      claim_id: 'claim-fabricated',
      text: 'CameraX 9.9.9 adds a fabricated direct HAL API on 2099-01-01.',
      claim_type: 'fact',
      evidence_ids: [],
      source_urls: [url],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }]
  });
  const report = reportFor(
    [article, ...validSections().slice(1)],
    [
      scopedCandidate(url, 'android_platform_camera_adjacent', {
        primary_evidence_ids: ['seed-camerax-primary-01'],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url]
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(1)
    ],
    { strictClaimValidation: true }
  );

  // The claim text (fabricated 9.9.9 / 2099) is not supported by the 1.6.1 evidence,
  // so the oracle refuses to bind: the claim stays unbound, not falsely evidence-backed.
  const claim = report.claim_results.find(item => item.claim_id === 'claim-fabricated');
  assert.notEqual(claim.status, 'bound');
  assert.deepEqual(claim.evidence_ids, []);
});

test('pack-level evidence fallback is soft and reported as derived mapping', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const article = section({
    headline: 'CameraX 1.6.1 claim binding',
    url,
    confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
    evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX.',
    claims: [{
      claim_id: 'claim-1',
      text: 'CameraX 1.6.1 release date: 2026-05-06.',
      claim_type: 'fact',
      evidence_ids: ['seed-camerax-pack'],
      source_urls: [url],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }]
  });
  const report = reportFor(
    [article, ...validSections().slice(1)],
    [
      scopedCandidate(url, 'android_platform_camera_adjacent', {
        evidence_pack_ids: ['seed-camerax-pack'],
        primary_evidence_ids: ['seed-camerax-primary-01'],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url],
          do_not_claim: ['Do not claim direct Camera HAL API changes.']
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(1)
    ],
    { strictClaimValidation: true }
  );

  assert.ok(report.claim_results.some(item => item.derived_evidence_mapping === true));
  assert.equal(report.metrics.derived_evidence_mapping_count >= 1, true);
  assert.ok(report.deductions.some(item =>
    item.reason_code === 'derived_evidence_mapping' &&
    item.blocking === false
  ));
});

test('claim results expose stable status and markdown diagnostics', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const article = section({
    headline: 'CameraX 1.6.1 claim status article',
    url,
    confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
    evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX.',
    claims: [{
      claim_id: 'claim-1',
      text: 'CameraX 1.6.1 release date: 2026-05-06.',
      claim_type: 'fact',
      evidence_ids: ['seed-camerax-primary-01'],
      source_urls: [url],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }]
  });
  const report = reportFor(
    [article, ...validSections().slice(1)],
    [
      scopedCandidate(url, 'android_platform_camera_adjacent', {
        primary_evidence_ids: ['seed-camerax-primary-01'],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url]
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(1)
    ],
    { strictClaimValidation: true }
  );
  const claim = report.claim_results.find(item => item.claim_id === 'claim-1');
  assert.equal(claim.status, 'bound');
  assert.equal(claim.article_headline, 'CameraX 1.6.1 claim status article');
  assert.deepEqual(claim.invalid_evidence_ids, []);
  assert.deepEqual(claim.blocked_evidence_ids, []);

  const markdown = buildQualityReportMarkdown(report);
  assert.match(markdown, /\| Article \| Claim \| Type \| Status \| Impact \| Risk \| Reason codes \| Evidence \| Source \|/);
  assert.match(markdown, /CameraX 1\.6\.1 claim status article/);
  assert.match(markdown, /\| fact \| bound \| app_api_or_framework_adjacent \| low \|/);
});

test('seed evidence pack unmatched and title fallback diagnostics are soft and explicit', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const unmatchedArticle = section({
    headline: 'Seed pack unmatched article',
    url,
    confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
    evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX.',
    claims: [{
      claim_id: 'claim-unmatched',
      text: 'CameraX 1.6.1 release date: 2026-05-06.',
      claim_type: 'fact',
      evidence_ids: ['seed-camerax-primary-01'],
      source_urls: [url],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }]
  });
  const fallbackCandidateUrl = 'https://example.com/title-fallback-candidate';
  const fallbackEvidenceUrl = 'https://example.com/title-fallback#1.0';
  const fallbackArticle = section({
    headline: 'Title fallback seed article',
    url: fallbackCandidateUrl,
    confirmed_facts: ['CameraX fallback release date: 2026-05-06.'],
    evidence_summary: 'Version: CameraX fallback; release date: 2026-05-06; API/component: CameraX.',
    claims: [{
      claim_id: 'claim-fallback',
      text: 'CameraX fallback release date: 2026-05-06.',
      claim_type: 'fact',
      evidence_ids: ['seed-fallback-primary-01'],
      source_urls: [fallbackEvidenceUrl],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }]
  });
  const report = reportFor(
    [unmatchedArticle, fallbackArticle, ...validSections().slice(2)],
    [
      scopedCandidate(url, 'android_platform_camera_adjacent', {
        evidence_pack_ids: ['missing-pack'],
        primary_evidence_ids: ['seed-camerax-primary-01'],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url]
        }
      }),
      scopedCandidate(fallbackCandidateUrl, 'android_platform_camera_adjacent', {
        title: 'Title fallback seed article',
        source_id: 'fallback-source',
        evidence_pack_ids: [],
        seed_ids: [],
        primary_evidence_ids: [],
        compact_evidence: {
          evidence_urls: [fallbackCandidateUrl]
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(2)
    ],
    {
      strictClaimValidation: true,
      seedEvidencePack: seedEvidencePack([
        seedPack({
          packId: 'fallback-pack',
          seedId: 'fallback-seed',
          sourceId: 'fallback-source',
          url: fallbackEvidenceUrl,
          evidenceId: 'seed-fallback-primary-01',
          title: 'Title fallback seed article',
          fact: 'CameraX fallback release date: 2026-05-06.'
        })
      ])
    }
  );

  assert.ok(report.deductions.some(item =>
    item.reason_code === 'seed_evidence_pack_unmatched' &&
    item.blocking === false
  ));
  assert.ok(report.deductions.some(item =>
    item.reason_code === 'seed_evidence_pack_title_fallback_rejected' &&
    item.blocking === false
  ));
  const fallbackClaim = report.claim_results.find(item => item.claim_id === 'claim-fallback');
  assert.equal(fallbackClaim.status, 'needs_fix');
  assert.ok(fallbackClaim.invalid_evidence_ids.includes('seed-fallback-primary-01'));
  assert.match(buildQualityReportMarkdown(report), /seed_evidence_pack_title_fallback_rejected/);
  assert.equal(report.uncovered_facts.every(item => item.article_headline), true);
});

test('claim results separate source mismatched evidence ids from invalid evidence ids', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const article = section({
    headline: 'CameraX mismatched source claim',
    url,
    confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
    evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX.',
    claims: [{
      claim_id: 'claim-source-mismatch',
      text: 'CameraX 1.6.1 release date: 2026-05-06.',
      claim_type: 'fact',
      evidence_ids: ['seed-camerax-primary-01'],
      source_urls: ['https://example.com/wrong-source#1.6.1'],
      impact_level: 'app_api_or_framework_adjacent',
      overclaim_risk: 'low'
    }]
  });
  const report = reportFor(
    [article, ...validSections().slice(1)],
    [
      scopedCandidate(url, 'android_platform_camera_adjacent', {
        primary_evidence_ids: ['seed-camerax-primary-01'],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url]
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(1)
    ],
    { strictClaimValidation: true }
  );

  const claim = report.claim_results.find(item => item.claim_id === 'claim-source-mismatch');
  assert.deepEqual(claim.invalid_evidence_ids, []);
  assert.deepEqual(claim.source_mismatched_evidence_ids, ['seed-camerax-primary-01']);
  assert.ok(report.deductions.some(item => item.reason_code === 'source_url_fragment_mismatch'));
});

test('claim-level direct HAL overclaim is reported once by dedupe key', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const article = section({
    headline: 'CameraX direct HAL overclaim claim',
    url,
    camera_hal_perspective: 'CameraX 1.6.1 changes direct Camera HAL API behavior.',
    article_sections: {
      verified_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
      background_context: 'CameraX sits above camera2.',
      hal_driver_impact: 'CameraX 1.6.1 changes direct Camera HAL API behavior.',
      action_items: [
        'Within 2 weeks, assign a camera owner to compare Camera ITS logs.',
        'Measure preview latency on a representative device.'
      ],
      team_share_points: 'Do not overstate direct HAL impact.'
    },
    claims: [{
      claim_id: 'claim-1',
      text: 'CameraX 1.6.1 changes direct Camera HAL API behavior.',
      claim_type: 'fact',
      evidence_ids: ['seed-camerax-primary-01'],
      source_urls: [url],
      impact_level: 'direct_hal_contract',
      overclaim_risk: 'high'
    }]
  });
  const report = reportFor(
    [article, ...validSections().slice(1)],
    [
      scopedCandidate(url, 'android_platform_camera_adjacent', {
        primary_evidence_ids: ['seed-camerax-primary-01'],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url],
          do_not_claim: ['Do not claim direct Camera HAL API changes.']
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(1)
    ],
    { strictClaimValidation: true }
  );

  const overclaimDeductions = report.deductions.filter(item =>
    item.category === 'claim-overclaim' &&
    item.dedupe_key === '1:claim-1:direct_hal_claim_without_direct_evidence'
  );
  assert.equal(overclaimDeductions.length, 1);
  assert.equal(report.claim_validation_summary.overclaim_risk, 'high');
});

test('claim validation allows cautious CameraX risk_note without direct HAL overclaim', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const article = section({
    headline: 'CameraX cautious indirect HAL risk note',
    url,
    what_changed: 'CameraX 1.6.1 was released on 2026-05-06 as an AndroidX camera library update.',
    background: 'CameraX sits above camera2 and is framework-adjacent evidence.',
    camera_hal_perspective: 'Treat this as an app-facing CameraX signal and validate stream and buffer behavior through regression checks before claiming HAL runtime impact.',
    camera_hal_checks: ['Run CameraX preview and capture regression checks for stream and buffer behavior.'],
    action_items: ['Schedule CameraX regression checks before any HAL runtime claim is made.'],
    confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
    evidence_summary: 'CameraX 1.6.1 release date: 2026-05-06.',
    specificity_checks: ['Version: CameraX 1.6.1', 'Release date: 2026-05-06'],
    source_verification_notes: ['Official AndroidX CameraX release-note evidence.'],
    claims: [
      {
        claim_id: 'claim-1',
        text: 'CameraX 1.6.1 release date: 2026-05-06.',
        claim_type: 'fact',
        evidence_ids: ['seed-camerax-primary-01'],
        source_urls: [url],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      },
      {
        claim_id: 'claim-2',
        text: 'Linked evidence fetch failed, so HAL stream buffer regression risk is not confirmed; run CameraX regression checks before treating it as HAL runtime impact.',
        claim_type: 'risk_note',
        evidence_ids: ['linked-failed-1'],
        source_urls: [url],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }
    ]
  });
  const report = reportFor(
    [article, ...validSections().slice(1)],
    [
      scopedCandidate(url, 'android_platform_camera_adjacent', {
        title: 'CameraX Release Notes - CameraX 1.6.1',
        published_date: '2026-05-06',
        version_or_release: 'CameraX 1.6.1',
        api_or_component: 'CameraX',
        primary_evidence_ids: ['seed-camerax-primary-01'],
        failed_linked_evidence_ids: ['linked-failed-1'],
        failed_linked_evidence_urls: [url],
        compact_evidence: {
          primary_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_urls: [url],
          do_not_claim: ['Do not claim direct Camera HAL API changes.']
        },
        source_extraction: {
          adapter_id: 'android-developers-jetpack-release',
          source_type: 'release_note',
          source: {
            name: 'CameraX Release Notes',
            url: 'https://developer.android.com/jetpack/androidx/releases/camera'
          },
          release: {
            version: '1.6.1',
            date: '2026-05-06',
            component: 'CameraX',
            sections: [{
              heading: 'CameraX 1.6.1',
              items: [{
                text: 'CameraX 1.6.1 release date: 2026-05-06.',
                url
              }]
            }]
          },
          extraction_quality: {
            has_concrete_behavior_change: true,
            used_fallback: false,
            raw_table_used_as_body: false,
            main_article_allowed: true,
            warnings: []
          }
        },
        extraction_quality: {
          has_concrete_behavior_change: true,
          used_fallback: false,
          raw_table_used_as_body: false,
          main_article_allowed: true,
          warnings: []
        },
        derived_editorial_hints: {
          relevance_bucket_hint: 'direct_aosp_camera',
          hal_boundary: 'framework_adjacent_not_direct_hal_contract',
          validation_targets: ['stream buffer regression validation'],
          device_specific_notes: [],
          do_not_claim: ['Do not claim direct Camera HAL API changes.'],
          main_article_allowed_hint: true,
          warnings: []
        }
      }),
      ...reporterCandidatesFor(validSections()).slice(1)
    ]
  );

  assert.equal(report.status, 'PASS');
  assert.ok(report.deductions.every(item => item.reason_code !== 'direct_hal_claim_without_direct_evidence'));
  assert.ok(report.claim_results.some(item =>
    item.claim_id === 'claim-2' &&
    item.issues.some(issue => issue.reason_code === 'blocked_or_failed_evidence_id' && issue.blocking === false)
  ));
});

test('linked evidence overclaim detection uses only the bound source candidate', () => {
  const target = section({
    headline: 'CameraX runtime overclaim from unrelated diagnostics',
    url: 'https://example.com/bound-clean',
    what_changed: 'CameraX request/result metadata behavior changed for HAL runtime validation on 2026-05-01.'
  });
  const report = reportWithTargetSection(
    target,
    scopedCandidate('https://example.com/bound-clean', 'direct_aosp_camera'),
    [
      linkedEvidenceCandidate('https://example.com/unrelated-linked', 'direct_aosp_camera', {
        linked_evidence_summary: linkedEvidenceSummary({ by_fetch_status: { skipped: 1 }, has_unresolved_evidence: true }),
        impact_classification: impactClassification({
          impact_type: 'build_dependency_fix',
          hal_runtime_impact: false,
          camera_pipeline_impact: false,
          recommended_article_type: 'watch'
        })
      })
    ]
  );

  assert.equal(linkedDeductions(report, 'linked-evidence-overclaim').length, 0);
  assert.equal(linkedDeductions(report, 'linked-evidence-limitation').length, 0);
});

test('linked evidence overclaim detection does not infer diagnostics when source binding is missing', () => {
  const target = section({
    headline: 'Unbound linked evidence overclaim',
    url: 'https://example.com/unbound-linked-overclaim',
    what_changed: 'GitHub linked evidence confirmed the Camera HAL request metadata fix on 2026-05-01.'
  });
  const report = reportFor([
    target,
    section({ headline: 'CameraX release B', url: 'https://example.com/unbound-b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/unbound-c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/unbound-d' })
  ], [
    scopedCandidate('https://example.com/unbound-b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/unbound-c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/unbound-d', 'direct_aosp_camera'),
    linkedEvidenceCandidate('https://example.com/unrelated-overclaim')
  ]);

  assert.ok(report.deductions.some(item =>
    item.category === 'source-integrity' &&
    item.reason.includes('does not bind')
  ));
  assert.equal(linkedDeductions(report, 'linked-evidence-overclaim').length, 0);
});

test('resolved linked evidence does not bypass source date and source gap contracts', () => {
  const target = section({
    headline: 'Linked evidence cannot repair source gap',
    url: 'https://example.com/linked-source-gap'
  });
  const report = reportWithTargetSection(
    target,
    linkedEvidenceCandidate('https://example.com/linked-source-gap', 'direct_aosp_camera', {
      hasDatedEvidence: false,
      source_gap_risk: true
    })
  );

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item => item.reason.includes('missing dated evidence')));
  assert.ok(report.deductions.some(item => item.reason.includes('source_gap_risk=true')));
});

test('linked evidence overclaim blocking deductions cover conservative impact classes', () => {
  const cases = [
    {
      title: 'Build dependency framed as runtime',
      url: 'https://example.com/linked-build',
      section: {
        what_changed: 'CameraX dependency update changed request/result metadata behavior in HAL runtime on 2026-05-01.'
      },
      impact: {
        impact_type: 'build_dependency_fix',
        hal_runtime_impact: false,
        camera_pipeline_impact: false,
        recommended_article_type: 'watch'
      }
    },
    {
      title: 'Test only framed as product runtime',
      url: 'https://example.com/linked-test',
      section: {
        what_changed: 'CameraX test update fixed product runtime behavior for stream buffers on 2026-05-01.'
      },
      impact: {
        impact_type: 'test_only_change',
        hal_runtime_impact: false,
        camera_pipeline_impact: false,
        recommended_article_type: 'watch'
      }
    },
    {
      title: 'Docs framed as implementation',
      url: 'https://example.com/linked-docs',
      section: {
        what_changed: 'CameraX docs update changed implementation behavior for ImageCapture Surface handling on 2026-05-01.'
      },
      impact: {
        impact_type: 'documentation_only',
        hal_runtime_impact: false,
        camera_pipeline_impact: false,
        recommended_article_type: 'watch'
      }
    },
    {
      title: 'Watch evidence promoted to main',
      url: 'https://example.com/linked-watch',
      section: {
        what_changed: 'CameraX watch item is presented as a main implementation update for HAL teams on 2026-05-01.',
        evidence_summary: 'Version: CameraX watch item; release date: 2026-05-01; API/component: CameraX; behavior change: watch signal.'
      },
      impact: {
        impact_type: 'generic_tooling_change',
        hal_runtime_impact: false,
        camera_pipeline_impact: false,
        recommended_article_type: 'watch'
      }
    },
    {
      title: 'Unresolved evidence described as confirmed',
      url: 'https://example.com/linked-unresolved',
      section: {
        what_changed: 'GitHub linked evidence confirmed the Camera HAL request metadata fix on 2026-05-01.'
      },
      summary: {
        by_fetch_status: { skipped: 1 },
        has_resolved_evidence: false,
        has_unresolved_evidence: true
      },
      impact: {
        impact_type: 'runtime_behavior_change',
        hal_runtime_impact: true,
        camera_pipeline_impact: true,
        recommended_article_type: 'main'
      }
    }
  ];

  for (const item of cases) {
    const target = section({
      headline: item.title,
      url: item.url,
      ...item.section
    });
    const report = reportWithTargetSection(
      target,
      linkedEvidenceCandidate(item.url, 'direct_aosp_camera', {
        linked_evidence_summary: linkedEvidenceSummary(item.summary || {}),
        impact_classification: impactClassification(item.impact)
      })
    );
    assert.ok(linkedDeductions(report, 'linked-evidence-overclaim').some(deduction => deduction.blocking === true), item.title);
  }
});

test('linked evidence absent or unresolved without inference does not create overclaim deduction', () => {
  const absent = reportWithTargetSection(
    section({ headline: 'No linked evidence candidate', url: 'https://example.com/no-linked' }),
    scopedCandidate('https://example.com/no-linked', 'direct_aosp_camera')
  );
  assert.equal(linkedDeductions(absent, 'linked-evidence-overclaim').length, 0);

  const unresolved = reportWithTargetSection(
    section({
      headline: 'Unresolved linked evidence disclosed as limited',
      url: 'https://example.com/unresolved-limited',
      what_changed: 'CameraX source note was reviewed on 2026-05-01.',
      evidence_summary: 'Version: CameraX source note; release date: 2026-05-01; API/component: CameraX; behavior change: not claimed.',
      background: 'This item is kept as source review context.',
      why_it_matters: 'Teams can record the item for later source review.',
      camera_hal_perspective: 'Use this as limited triage context only.',
      action_items: ['Within 2 weeks, record the source review status.'],
      team_summary: 'Keep the item as limited source review context.',
      source_verification_notes: ['Official source checked; linked evidence is unresolved diagnostic context only.']
    }),
    linkedEvidenceCandidate('https://example.com/unresolved-limited', 'direct_aosp_camera', {
      linked_evidence_summary: linkedEvidenceSummary({
        by_fetch_status: { skipped: 1 },
        has_resolved_evidence: false,
        has_unresolved_evidence: true
      }),
      impact_classification: impactClassification({
        impact_type: 'unknown',
        hal_runtime_impact: false,
        camera_pipeline_impact: false,
        recommended_article_type: 'unknown'
      })
    })
  );
  assert.equal(linkedDeductions(unresolved, 'linked-evidence-overclaim').length, 0);
  assert.equal(linkedDeductions(unresolved, 'linked-evidence-limitation').length, 0);
});

test('malformed linked evidence diagnostics are soft and non-fatal', () => {
  const cases = [
    {
      headline: 'Malformed linked evidence candidate',
      url: 'https://example.com/malformed-linked',
      candidate: scopedCandidate('https://example.com/malformed-linked', 'direct_aosp_camera', {
        linked_evidence_summary: 'malformed',
        impact_classification: null
      })
    },
    {
      headline: 'Partial linked evidence summary candidate',
      url: 'https://example.com/summary-only-linked',
      candidate: scopedCandidate('https://example.com/summary-only-linked', 'direct_aosp_camera', {
        linked_evidence_summary: linkedEvidenceSummary()
      })
    },
    {
      headline: 'Partial linked evidence impact candidate',
      url: 'https://example.com/impact-only-linked',
      candidate: scopedCandidate('https://example.com/impact-only-linked', 'direct_aosp_camera', {
        impact_classification: impactClassification()
      })
    }
  ];

  for (const item of cases) {
    const target = section({
      headline: item.headline,
      url: item.url
    });
    const report = reportWithTargetSection(target, item.candidate);
    const [deduction] = linkedDeductions(report, 'linked-evidence-malformed');

    assert.equal(deduction.blocking, false);
    assert.equal(deduction.severity, 'soft');
    assert.equal(report.article_results.find(result => result.headline === target.headline).status, 'PASS');
  }

  const absentTarget = section({
    headline: 'No linked evidence diagnostics candidate',
    url: 'https://example.com/no-linked-diagnostics'
  });
  const absentReport = reportWithTargetSection(
    absentTarget,
    scopedCandidate('https://example.com/no-linked-diagnostics', 'direct_aosp_camera')
  );
  assert.equal(linkedDeductions(absentReport, 'linked-evidence-malformed').length, 0);
});

test('weak linked evidence limitation wording is soft and explicit limitation avoids it', () => {
  const weak = reportWithTargetSection(
    section({
      headline: 'Unresolved linked evidence without limitation note',
      url: 'https://example.com/weak-linked-note',
      source_verification_notes: ['Official source checked.']
    }),
    linkedEvidenceCandidate('https://example.com/weak-linked-note', 'direct_aosp_camera', {
      linked_evidence_summary: linkedEvidenceSummary({
        by_fetch_status: { skipped: 1 },
        has_resolved_evidence: false,
        has_unresolved_evidence: true
      }),
      impact_classification: impactClassification({
        impact_type: 'unknown',
        hal_runtime_impact: false,
        camera_pipeline_impact: false,
        recommended_article_type: 'unknown'
      })
    })
  );
  const [weakDeduction] = linkedDeductions(weak, 'linked-evidence-limitation');
  assert.equal(weakDeduction.blocking, false);

  const explicit = reportWithTargetSection(
    section({
      headline: 'Unresolved linked evidence with limitation note',
      url: 'https://example.com/explicit-linked-note',
      source_verification_notes: ['Official source checked; linked evidence is skipped and remains diagnostic only.']
    }),
    linkedEvidenceCandidate('https://example.com/explicit-linked-note', 'direct_aosp_camera', {
      linked_evidence_summary: linkedEvidenceSummary({
        by_fetch_status: { skipped: 1 },
        has_resolved_evidence: false,
        has_unresolved_evidence: true
      }),
      impact_classification: impactClassification({
        impact_type: 'unknown',
        hal_runtime_impact: false,
        camera_pipeline_impact: false,
        recommended_article_type: 'unknown'
      })
    })
  );
  assert.equal(linkedDeductions(explicit, 'linked-evidence-limitation').length, 0);
});
