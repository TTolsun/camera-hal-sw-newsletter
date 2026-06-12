'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown
} = require('../../../../scripts/newsroom/validate/newsletter-quality');
const {
  articlePolicy,
  articleCountRangeText,
  qualityGatePolicy
} = require('../../common/newsletter-policy');
const {
  reportFor,
  scopedCandidate,
  section,
  validSections,
  reporterCandidatesFor
} = require('../helpers/quality-builders');
const {
  articleStructureSection
} = require('../helpers/quality-fixtures');

test('quality report exposes normalized article section contract metrics and article results', () => {
  const sections = validSections();
  const report = reportFor(sections, reporterCandidatesFor(sections));

  assert.equal(report.metrics.article_section_contract.complete_count, sections.length);
  assert.equal(report.metrics.article_section_contract.incomplete_count, 0);
  assert.equal(report.article_results[0].section_contract.complete, true);
  assert.deepEqual(report.article_results[0].section_contract.missing_keys, []);
  assert.equal(report.article_results[0].section_contract.limitation_visibility, 'none');
  assert.deepEqual(Object.keys(report.article_results[0].section_contract).sort(), [
    'complete',
    'has_do_not_claim',
    'has_limitations',
    'has_watch_items',
    'limitation_visibility',
    'missing_keys',
    'missing_required_keys',
    'present_optional_keys',
    'unexpected_keys'
  ].sort());
});

test('quality report records article section optional limitation visibility', () => {
  const sections = [
    section({
      headline: 'CameraX release with public limitation',
      article_sections: {
        ...section().article_sections,
        known_limitations: ['No direct HAL contract change is stated.']
      }
    }),
    section({
      headline: 'CameraX release with guardrail only',
      url: 'https://example.com/guardrail-only',
      article_sections: {
        ...section({ url: 'https://example.com/guardrail-only' }).article_sections,
        do_not_claim: ['Do not claim direct Camera HAL API changes.']
      }
    }),
    ...validSections().slice(2)
  ];
  const report = reportFor(sections, reporterCandidatesFor(sections));

  assert.equal(report.article_results[0].section_contract.limitation_visibility, 'public-limitation');
  assert.equal(report.article_results[0].section_contract.has_limitations, true);
  assert.equal(report.article_results[1].section_contract.limitation_visibility, 'guardrail-only');
  assert.equal(report.article_results[1].section_contract.has_do_not_claim, true);
  assert.equal(report.metrics.article_section_contract.optional_key_counts.known_limitations, 1);
  assert.equal(report.metrics.article_section_contract.optional_key_counts.do_not_claim, 1);
  assert.equal(report.metrics.article_section_contract.limitation_visibility_counts['public-limitation'], 1);
  assert.equal(report.metrics.article_section_contract.limitation_visibility_counts['guardrail-only'], 1);

  const markdown = buildQualityReportMarkdown(report);
  assert.match(markdown, /\| # \| Article \| 5-section \| Fact boundary \| HAL impact axis \| Actionability \| Limitations \|/);
  assert.match(markdown, /public-limitation/);
  assert.match(markdown, /guardrail-only/);
  assert.match(markdown, /present\+guarded/);
  assert.doesNotMatch(articleStructureSection(markdown), /source-backed/);
});

test('quality report records missing article_sections keys without legacy fallback', () => {
  const sections = [
    section({
      headline: 'CameraX release with missing team share point',
      article_sections: {
        verified_facts: ['CameraX 1.5.0 release date: 2026-05-01.'],
        background_context: 'CameraX sits above camera2 and can expose compatibility regressions.',
        hal_driver_impact: 'Validate request/result metadata, stream combinations, Camera ITS scenes, latency, frame drop, thermal, and buffer behavior.',
        action_items: [
          'Within 2 weeks, assign a camera owner to compare Camera ITS logs before and after CameraX 1.5.0.',
          'Measure preview/capture latency and frame drop metrics on at least one legacy and one flagship device.'
        ]
      }
    }),
    ...validSections().slice(1)
  ];
  const report = reportFor(sections, reporterCandidatesFor(sections));

  assert.equal(report.metrics.article_section_contract.incomplete_count, 1);
  assert.equal(report.metrics.article_section_contract.missing_key_counts.team_share_points, 1);
  assert.ok(report.deductions.some(item =>
    item.category === 'article-section-contract' &&
    item.blocking === false &&
    item.reason.includes('team_share_points')
  ));
  assert.deepEqual(report.article_results[0].section_contract.missing_keys, ['team_share_points']);
  assert.equal(report.article_results[0].section_contract.complete, false);
});

test('quality report marks article PASS DEMOTE FAIL and separates hard and soft causes', () => {
  const sections = [
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({
      headline: 'Generic AI assistant release',
      url: 'https://example.com/generic-ai',
      category: 'AI',
      article_type: 'ai',
      is_ai_related: true,
      what_changed: 'A generic LLM assistant release was announced on 2026-05-01.',
      confirmed_facts: ['The source announces AI assistant 1.0 on 2026-05-01.'],
      evidence_summary: 'Version: AI assistant 1.0; release date: 2026-05-01; API/component: assistant; behavior change: generic productivity.',
      specificity_checks: ['Version: AI assistant 1.0', 'Release date: 2026-05-01'],
      camera_hal_checks: ['Track only as a briefing item.'],
      action_items: [
        'Review whether this belongs in briefing instead of main article.',
        'Do not create device validation work from this generic AI source.'
      ],
      article_sections: {
        verified_facts: ['The source announces AI assistant 1.0 on 2026-05-01.'],
        background_context: 'The release is about generic office productivity.',
        hal_driver_impact: 'No concrete device imaging workflow is named.',
        action_items: [
          'Review whether this belongs in briefing instead of main article.',
          'Do not create device validation work from this generic AI source.'
        ],
        team_share_points: 'Generic AI item should stay outside main article slots.'
      }
    }),
    section({
      headline: 'Invalid source URL article',
      url: 'invalid-source-url-without-scheme',
      evidence_summary: 'No valid dated source URL is provided.'
    }),
    section({
      headline: 'Fallback image article',
      url: 'https://example.com/fallback',
      resolvedImage: { usedFallback: true }
    })
  ];
  const report = reportFor(sections, reporterCandidatesFor(sections));

  // Topic-based DEMOTE (e.g. "Generic AI") was removed; per-article usefulness is now the
  // fact-checker's call. This test keeps the safety FAIL (source gap) and soft (image-fallback)
  // separation, which the deterministic gate still owns.
  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.metrics.hard_fail_count > 0);
  assert.ok(report.metrics.soft_deduction_count > 0);
  assert.equal(report.article_results[0].status, 'PASS');
  assert.equal(report.article_results[2].status, 'FAIL');
  assert.ok(report.article_results[2].hard_fail_reasons.length > 0);
  assert.equal(report.article_results[3].status, 'PASS');
  assert.ok(report.article_results[3].soft_deductions.some(item => item.category === 'image-fallback'));
});

test('quality report markdown separates score threshold max score and result', () => {
  const score = qualityGatePolicy.threshold - 15;
  const underfilledCount = articlePolicy.mainArticleCount.min - 1;
  const markdown = buildQualityReportMarkdown({
    date: '2026-05-03',
    score,
    max_score: 100,
    threshold: qualityGatePolicy.threshold,
    status: 'NEEDS_FIX',
    summary: 'Quality score is below the configured threshold.',
    deductions: [
      {
        category: 'composition',
        points: 4,
        reason: `Main article count ${underfilledCount} is outside Newsletter Policy range (${articleCountRangeText()}).`
      }
    ],
    metrics: {
      article_count: underfilledCount,
      briefing_count: 3,
      camera_article_count: 2,
      ai_article_count: 1,
      fact_check_status: 'PASS',
      must_fix_count: 0,
      source_gap_count: 1,
      source_integrity_violation_count: 0,
      blocking_deduction_count: 1,
      blocking_deduction_categories: ['composition'],
      hard_fail_count: 1,
      soft_deduction_count: 0,
      article_gate_counts: { PASS: 0, DEMOTE: 0, FAIL: 0 },
      top_deduction_categories: [{ category: 'composition', count: 1 }],
      candidate_exclusion_summary: [{ reason: 'missing dated evidence', count: 2 }]
    },
    article_results: [{
      index: 1,
      headline: 'Generic AI assistant release',
      status: 'DEMOTE',
      repair_action: 'demote-or-replace',
      hard_fail_reasons: ['Generic AI article lacks a concrete Camera HAL / Android Camera connection and must not stay as a main article.'],
      soft_deductions: []
    }]
  });

  assert.ok(markdown.includes(`Quality score: ${score}`));
  assert.ok(markdown.includes(`Quality threshold: ${qualityGatePolicy.threshold}`));
  assert.match(markdown, /Max score: 100/);
  assert.match(markdown, /Result: NEEDS_FIX/);
  assert.match(markdown, /## Article Structure Contract/);
  assert.match(markdown, /\| # \| Article \| 5-section \| Fact boundary \| HAL impact axis \| Actionability \| Limitations \|/);
  assert.match(markdown, /## Article Gate Results/);
  assert.match(markdown, /Generic AI assistant release/);
  assert.match(markdown, /## Hard Fails/);
  assert.match(markdown, /## Soft Deductions/);
  assert.match(markdown, /Article composition failure:/);
  assert.doesNotMatch(markdown, new RegExp(`${score}/${qualityGatePolicy.threshold}`));
});

test('quality gate reports missing story briefing structure elements for story v1', () => {
  const slug = 'camerax-1-5-0-gives-hal-teams-a-preview-regression-target';
  const url = `https://example.com/story-source-${slug}`;
  const target = section({ headline: 'CameraX 1.5.0 gives HAL teams a preview regression target', url });
  target.public_article = {
    ...target.public_article,
    story_contract_version: 1,
    headline: target.headline
  };
  const rest = validSections().slice(1);
  const report = buildNewsletterQualityReport(
    '2026-05-03',
    {
      public_contract_version: 'story-v1',
      generation_contract_version: 1,
      briefing: [
        'CameraX 1.5.0 update.',
        'HAL teams should review stream metadata logs.',
        'Check the source.'
      ],
      sections: [target, ...rest]
    },
    {
      candidates: [
        scopedCandidate(url, 'android_platform_camera_adjacent', { title: 'CameraX 1.5.0 release notes' }),
        ...reporterCandidatesFor(rest)
      ]
    },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 }
  );

  assert.ok(report.deductions.some(item =>
    item.category === 'editorial-story' &&
    item.blocking === false &&
    /Briefing bullet misses story structure elements/.test(item.reason)
  ));
});

test('quality gate treats short background overlap as non-blocking field hygiene warning', () => {
  const url = 'https://example.com/short-overlap';
  const sections = [
    section({
      headline: 'CameraX short overlap',
      url,
      what_changed: 'CameraX Android compatibility validation.',
      article_sections: {
        ...section().article_sections,
        background_context: 'CameraX Android compatibility checks.'
      }
    }),
    ...validSections().slice(1)
  ];
  const report = reportFor(sections, [
    scopedCandidate(url, 'android_platform_camera_adjacent'),
    ...reporterCandidatesFor(validSections()).slice(1)
  ]);
  const diagnostic = report.deductions.find(item =>
    item.category === 'field-hygiene' &&
    item.location === 'CameraX short overlap'
  );

  assert.equal(report.status, 'PASS');
  assert.ok(diagnostic);
  assert.equal(diagnostic.blocking, false);
  assert.equal(diagnostic.severity, 'warning');
  assert.equal(report.deductions.some(item => item.category === 'field-hygiene' && item.blocking === true), false);
  assert.notEqual(report.article_results[0].status, 'FAIL');
});

test('quality gate accepts distinct CameraX and libcamera background context', () => {
  const libcameraUrl = 'https://example.com/libcamera';
  const sections = [
    section({
      headline: 'libcamera pipeline update',
      url: libcameraUrl,
      what_changed: 'libcamera 0.5.0 updated image sensor pipeline behavior on 2026-05-01.',
      article_sections: {
        ...section().article_sections,
        background_context: 'V4L2 and libcamera changes can affect camera driver validation and ISP handoff.',
        hal_driver_impact: 'Review this as driver and image pipeline input before deciding whether Android camera integration follow-up is needed.'
      }
    }),
    ...validSections().slice(1)
  ];
  const report = reportFor(sections, [
    scopedCandidate(libcameraUrl, 'camera_driver_image_pipeline'),
    ...reporterCandidatesFor(validSections()).slice(1)
  ]);

  assert.equal(report.deductions.some(item => item.category === 'field-hygiene'), false);
  assert.notEqual(report.article_results[0].status, 'FAIL');
});
