const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown,
  determineQualityStatus,
  sectionPassesArticleGate
} = require('../scripts/lib/newsletter-quality');
const {
  reporterCandidate,
  reporterCandidatesFor,
  reportFor,
  scopedCandidate,
  section,
  validSections
} = require('./helpers/quality-builders');
const { readJsonFixture } = require('./helpers/fixture-loader');
const {
  articlePolicy,
  articleCountRangeText,
  qualityGatePolicy
} = require('../scripts/lib/newsletter-policy');

const hardFailRegressionCases = new Map([
  ['source-less main article', {
    name: 'hardFailCondition: source-less main article remains blocking in the quality gate',
    buildReport: () => {
      const sections = [
        section({ headline: 'Source-less main article', sources: [] }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, reporterCandidatesFor(validSections()).slice(1));
    },
    assertReport: report => {
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.article_results.some(item =>
        item.headline === 'Source-less main article' &&
        item.status === 'FAIL' &&
        item.hard_fail_reasons.some(reason => reason.includes('Missing required article list: sources'))
      ));
    }
  }],
  ['source candidate binding failure', {
    name: 'hardFailCondition: source candidate binding failure remains blocking in the quality gate',
    buildReport: () => {
      const sections = [
        section({ headline: 'Unbound source candidate article', url: 'https://example.com/unbound-source' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, reporterCandidatesFor(validSections()).slice(1));
    },
    assertReport: report => {
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.article_results.some(item =>
        item.headline === 'Unbound source candidate article' &&
        item.status === 'FAIL' &&
        item.hard_fail_reasons.some(reason => reason.includes('does not bind to reporter/shortlist candidate metadata'))
      ));
    }
  }],
  ['missing dated evidence', {
    name: 'hardFailCondition: missing dated evidence blocks publish-quality status above threshold',
    buildReport: () => {
      const sections = [
        section({ headline: 'Missing dated evidence article', url: 'https://example.com/missing-dated-evidence' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate('https://example.com/missing-dated-evidence', 'direct_aosp_camera', { hasDatedEvidence: false }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('missing dated evidence')
      ));
    }
  }],
  ['source_gap_risk', {
    name: 'hardFailCondition: source_gap_risk blocks publish-quality status above threshold',
    buildReport: () => {
      const sections = [
        section({ headline: 'Source gap risk article', url: 'https://example.com/source-gap-risk' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate('https://example.com/source-gap-risk', 'direct_aosp_camera', { source_gap_risk: true }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('source_gap_risk=true')
      ));
    }
  }],
  ['fact-check must_fix', {
    name: 'hardFailCondition: fact-check must_fix blocks publish-quality status above threshold',
    buildReport: () => buildNewsletterQualityReport(
      '2026-05-03',
      {
        briefing: ['one', 'two', 'three'],
        sections: validSections()
      },
      { candidates: reporterCandidatesFor(validSections()) },
      {
        status: 'NEEDS_FIX',
        must_fix: ['CameraX release A has an unsupported source claim.'],
        source_gaps: [],
        source_gap_count: 0
      }
    ),
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.equal(report.metrics.must_fix_count, 1);
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('Fact checker returned 1 must_fix item')
      ));
    }
  }],
  ['duplicate source URL', {
    name: 'hardFailCondition: duplicate source URL blocks publish-quality status above threshold',
    buildReport: () => {
      const sharedUrl = 'https://example.com/duplicate-source-url';
      const sections = [
        section({ headline: 'Duplicate source article A', url: sharedUrl }),
        section({ headline: 'Duplicate source article B', url: sharedUrl }),
        ...validSections().slice(2)
      ];
      return reportFor(sections, [
        scopedCandidate(sharedUrl, 'direct_aosp_camera'),
        ...reporterCandidatesFor(validSections()).slice(2)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('Duplicate source URL is used across main sections')
      ));
    }
  }],
  ['stale claim hard failure', {
    name: 'hardFailCondition: stale claim hard failure blocks publish-quality status above threshold',
    buildReport: () => reportFor(validSections(), reporterCandidatesFor(validSections()), {
      staleClaimReport: {
        status: 'NEEDS_FIX',
        stale_claim_items_removed: [],
        unsupported_release_claims_removed: [],
        hard_failures: [{ reason: 'removed-section-claim-remains', claims: ['Android 17 Beta 4'] }]
      }
    }),
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.equal(report.metrics.stale_claim_hard_failure_count, 1);
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('Stale claim report has 1 hard failure')
      ));
    }
  }],
  ['undated watch/reference page promoted to main article', {
    name: 'hardFailCondition: undated watch/reference page promoted to main article blocks publish-quality status above threshold',
    buildReport: () => {
      const sections = [
        section({ headline: 'Undated watch page promoted article', url: 'https://example.com/watch-page' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate('https://example.com/watch-page', 'direct_aosp_camera', {
          finalSelectionEligibility: 'watchlist',
          isWatchPage: true,
          hasDatedEvidence: false
        }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('watch page lacks dated evidence')
      ));
    }
  }]
]);

test('qualityGatePolicy.hardFailConditions have config-driven regression test coverage', () => {
  const configuredConditions = new Set(qualityGatePolicy.hardFailConditions);

  for (const condition of qualityGatePolicy.hardFailConditions) {
    const regression = hardFailRegressionCases.get(condition);
    assert.ok(regression, `Missing hard fail regression case for configured condition: ${condition}`);
    assert.ok(
      regression.name.includes(condition),
      `Regression test name must include configured hard fail condition: ${condition}`
    );
  }

  for (const condition of hardFailRegressionCases.keys()) {
    assert.ok(configuredConditions.has(condition), `Regression case is not configured in qualityGatePolicy.hardFailConditions: ${condition}`);
  }
});

for (const regression of hardFailRegressionCases.values()) {
  test(regression.name, () => {
    const report = regression.buildReport();
    regression.assertReport(report);
    assert.ok(report.metrics.blocking_deduction_count > 0);
    assert.ok(report.metrics.hard_fail_count > 0);
  });
}

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

test('quality threshold follows configured numeric boundary behavior', () => {
  assert.equal(determineQualityStatus(qualityGatePolicy.threshold - 1, qualityGatePolicy.threshold, {
    sourceGapCount: 0,
    hasFactCheckMustFix: false,
    blockingDeductions: []
  }), 'NEEDS_FIX');
  assert.equal(determineQualityStatus(qualityGatePolicy.threshold, qualityGatePolicy.threshold, {
    sourceGapCount: 0,
    hasFactCheckMustFix: false,
    blockingDeductions: []
  }), 'PASS');
});

test('quality threshold does not override hard blockers at high scores', () => {
  assert.equal(determineQualityStatus(qualityGatePolicy.threshold + 5, qualityGatePolicy.threshold, {
    sourceGapCount: 0,
    hasFactCheckMustFix: false,
    blockingDeductions: [{ category: 'composition', points: 4 }]
  }), 'NEEDS_FIX');
});

test('quality gate allows non-blocking actionability deductions above threshold', () => {
  const sections = validSections().map((item, index) => index < 3
    ? {
        ...item,
        action_items: [
          'Within 2 weeks, assign a camera owner to compare Camera ITS logs before and after this change.'
        ]
      }
    : item);
  const report = reportFor(sections, reporterCandidatesFor(sections));

  assert.equal(report.score, 88);
  assert.equal(report.status, 'PASS');
  assert.equal(report.metrics.blocking_deduction_count, 0);
  assert.equal(report.metrics.hard_fail_count, 0);
  assert.equal(report.metrics.soft_deduction_count, 3);
  assert.ok(report.deductions.every(item => item.category === 'actionability'));
  assert.ok(report.deductions.every(item => item.blocking === false));
  assert.ok(report.deductions.every(item => item.severity === 'soft'));
});

test('quality gate allows no-AI HAL lineups when other hard gates pass', () => {
  const sections = [
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({ headline: 'AOSP Camera change B', url: 'https://example.com/b' }),
    section({ headline: 'Android Camera API change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ];
  const report = reportFor(sections, reporterCandidatesFor(sections));

  assert.equal(report.status, 'PASS');
  assert.equal(report.metrics.ai_article_count, 0);
  assert.equal(report.metrics.blocking_deduction_count, 0);
  assert.equal(report.deductions.some(item => /AI article/i.test(item.reason)), false);
});

test('quality gate counts article buckets from structured candidate metadata', () => {
  const sections = [
    section({ headline: 'CameraX release note', url: 'https://example.com/camerax' }),
    section({
      headline: 'libcamera image sensor pipeline update',
      url: 'https://example.com/libcamera',
      category: 'Driver',
      what_changed: 'libcamera 0.5.0 updated image sensor pipeline behavior on 2026-05-01.',
      evidence_summary: 'Version: libcamera 0.5.0; release date: 2026-05-01; API/component: libcamera image sensor pipeline; behavior change: driver pipeline support.',
      background: 'V4L2 and libcamera changes can affect camera driver validation and ISP handoff.',
      camera_hal_perspective: 'Map libcamera image sensor behavior to V4L2 capture, ISP tuning, stream buffers, and Camera ITS coverage.',
      team_summary: 'Use the driver pipeline update as a V4L2/libcamera validation trigger.'
    }),
    section({
      headline: 'Snapdragon NPU thermal update',
      url: 'https://example.com/soc',
      category: 'SoC',
      what_changed: 'Snapdragon NPU thermal behavior changed on 2026-05-01 for sustained image processing.',
      evidence_summary: 'Version: platform note 1.0; release date: 2026-05-01; API/component: Snapdragon NPU thermal path; behavior change: sustained performance budget.',
      background: 'SoC thermal and power behavior affects camera preview, image processing, and frame latency.',
      camera_hal_perspective: 'Track ISP/NPU thermal throttling, frame latency, buffer queue pressure, and sustained camera workload metrics.',
      team_summary: 'Use this as SoC performance budget input for camera workloads.'
    }),
    section({
      headline: 'GCC 16.1 C++ native performance update',
      url: 'https://example.com/gcc',
      category: 'C++ Tooling',
      what_changed: 'GCC 16.1 changed C++ native performance diagnostics on 2026-05-01.',
      evidence_summary: 'Version: GCC 16.1; release date: 2026-05-01; API/component: GCC C++ compiler; behavior change: native diagnostics.',
      background: 'Native compiler diagnostics can shorten Camera HAL and driver test/debug loops.',
      camera_hal_perspective: 'Apply sanitizer and compiler diagnostics to native Camera HAL, V4L2 bridge, and image pipeline debug builds.',
      team_summary: 'Use the toolchain update for native camera debugging productivity.'
    })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/camerax', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/libcamera', 'camera_driver_image_pipeline'),
    scopedCandidate('https://example.com/soc', 'soc_platform_signal'),
    scopedCandidate('https://example.com/gcc', 'cpp_ai_tooling_fallback')
  ]);

  assert.equal(report.status, 'PASS');
  assert.equal(report.metrics.direct_aosp_camera_count, 1);
  assert.equal(report.metrics.camera_driver_image_pipeline_count, 1);
  assert.equal(report.metrics.soc_platform_signal_count, 1);
  assert.equal(report.metrics.cpp_ai_tooling_fallback_count, 1);
  assert.equal(report.metrics.primary_camera_stack_count, 2);
  assert.equal(report.metrics.fallback_relevance_count, 2);
  assert.equal(report.article_results[1].scope_count.relevance_bucket, 'camera_driver_image_pipeline');
  assert.match(report.article_results[1].scope_count.count_reason, /primary_camera_stack_count/);
});

test('quality gate falls back to reporter scores when section metadata has only a bucket', () => {
  const partial = section({
    headline: 'CameraX release with partial section metadata',
    url: 'https://example.com/partial-camerax',
    relevance_bucket: 'direct_aosp_camera'
  });
  const sections = [
    partial,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/partial-camerax', 'direct_aosp_camera', {
      aosp_camera_directness: 5,
      counts_as_primary_camera_topic: true
    }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ]);
  const result = report.article_results.find(item => item.headline === partial.headline);

  assert.equal(result.status, 'PASS');
  assert.equal(result.scope_count.metadata_source, 'merged');
  assert.deepEqual(result.scope_count.missing_score_fields, []);
  assert.equal(report.deductions.some(item =>
    item.location === partial.headline &&
    item.category === 'scope-relevance'
  ), false);
});

test('quality gate rejects complete section metadata without source candidate binding', () => {
  const sectionOnly = section({
    headline: 'Section-only V4L2 driver metadata',
    url: 'https://example.com/section-only-v4l2',
    relevance_bucket: 'camera_driver_image_pipeline',
    editorial_priority: 2,
    driver_stack_relevance: 5,
    counts_as_driver_topic: true
  });
  const sections = [
    sectionOnly,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ]);
  const result = report.article_results.find(item => item.headline === sectionOnly.headline);

  assert.equal(report.status, 'NEEDS_FIX');
  assert.equal(result.status, 'FAIL');
  assert.equal(result.scope_count.publishable_scope, false);
  assert.equal(result.scope_count.evidence_origin, 'section_text_fallback');
  assert.ok(report.deductions.some(item =>
    item.location === sectionOnly.headline &&
    item.category === 'source-integrity' &&
    item.reason.includes('does not bind')
  ));
});

test('quality gate merges section bucket override with reporter score fields', () => {
  const override = section({
    headline: 'Driver bucket override keeps reporter scores',
    url: 'https://example.com/driver-override',
    relevance_bucket: 'camera_driver_image_pipeline'
  });
  const sections = [
    override,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/driver-override', 'camera_driver_image_pipeline', {
      driver_stack_relevance: 5,
      counts_as_driver_topic: true
    }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ]);
  const result = report.article_results.find(item => item.headline === override.headline);

  assert.equal(result.status, 'PASS');
  assert.equal(result.scope_count.metadata_source, 'merged');
  assert.equal(result.scope_count.relevance_bucket, 'camera_driver_image_pipeline');
  assert.deepEqual(result.scope_count.missing_score_fields, []);
});

test('quality gate reports missing scope scores when no reporter fallback exists', () => {
  const missingScores = section({
    headline: 'Bucket-only section without reporter metadata',
    url: 'https://example.com/missing-scores',
    relevance_bucket: 'direct_aosp_camera'
  });
  const sections = [
    missingScores,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ]);
  const result = report.article_results.find(item => item.headline === missingScores.headline);

  assert.equal(result.status, 'FAIL');
  assert.equal(result.scope_count.metadata_source, 'section_text_fallback');
  assert.equal(result.scope_count.publishable_scope, false);
  assert.ok(report.deductions.some(item =>
    item.location === missingScores.headline &&
    item.category === 'source-integrity'
  ));
});

test('quality gate uses shortlist selected candidate before reporter candidate for binding', () => {
  const sameUrl = 'https://example.com/shared-release';
  const sections = [
    section({
      headline: 'CameraX 2.0 shared release',
      url: sameUrl,
      evidence_summary: 'Version: CameraX 2.0; release date: 2026-05-01; API/component: CameraX; behavior change: stream validation.'
    }),
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ];
  const report = reportFor(
    sections,
    [
      scopedCandidate(sameUrl, 'generic_tech_watchlist', { title: 'Reporter generic shared release' }),
      scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
      scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
      scopedCandidate('https://example.com/d', 'direct_aosp_camera')
    ],
    {
      shortlistReport: {
        shortlisted_candidates: [
          scopedCandidate(sameUrl, 'direct_aosp_camera', {
            title: 'CameraX 2.0 shared release',
            version_or_release: 'CameraX 2.0',
            published_date: '2026-05-01',
            final_selected: true,
            primary_selected: true
          })
        ]
      }
    }
  );
  const result = report.article_results.find(item => item.headline === 'CameraX 2.0 shared release');

  assert.equal(result.status, 'PASS');
  assert.equal(result.scope_count.binding_source, 'shortlist_selected');
  assert.equal(result.scope_count.relevance_bucket, 'direct_aosp_camera');
});

test('quality gate tie-breaks duplicate normalized URLs with version evidence', () => {
  const sharedUrl = 'https://example.com/changelog';
  const target = section({
    headline: 'Driver stack 2.0 changelog item',
    url: sharedUrl,
    evidence_summary: 'Version: Driver stack 2.0; release date: 2026-05-02; API/component: V4L2 driver; behavior change: buffer ownership validation.',
    specificity_checks: ['Version: Driver stack 2.0', 'Release date: 2026-05-02']
  });
  const sections = [
    target,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ];
  const report = reportFor(sections, [
    scopedCandidate(sharedUrl, 'generic_tech_watchlist', {
      title: 'Driver stack 1.0 changelog item',
      version_or_release: 'Driver stack 1.0',
      published_date: '2026-05-01'
    }),
    scopedCandidate(sharedUrl, 'camera_driver_image_pipeline', {
      title: 'Driver stack 2.0 changelog item',
      version_or_release: 'Driver stack 2.0',
      published_date: '2026-05-02'
    }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ]);
  const result = report.article_results.find(item => item.headline === target.headline);

  assert.equal(result.status, 'PASS');
  assert.equal(result.scope_count.relevance_bucket, 'camera_driver_image_pipeline');
});

test('quality gate fails ambiguous duplicate normalized URL binding', () => {
  const sharedUrl = 'https://example.com/ambiguous';
  const ambiguous = section({
    headline: 'Ambiguous shared changelog item',
    url: sharedUrl,
    evidence_summary: 'Version: ambiguous; release date: 2026-05-01; API/component: CameraX; behavior change: compatibility validation.'
  });
  const report = reportFor([
    ambiguous,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ], [
    scopedCandidate(sharedUrl, 'direct_aosp_camera', { title: 'Alpha shared item' }),
    scopedCandidate(sharedUrl, 'direct_aosp_camera', { title: 'Beta shared item' }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ]);
  const result = report.article_results.find(item => item.headline === ambiguous.headline);

  assert.equal(result.status, 'FAIL');
  assert.ok(result.hard_fail_reasons.some(reason => reason.includes('Ambiguous source candidate match')));
});

test('quality gate fails shared release-note URL without matching date or version evidence', () => {
  const sharedUrl = 'https://example.com/release-notes';
  const releaseNote = section({
    headline: 'Release note article without matching item evidence',
    url: sharedUrl,
    evidence_summary: 'Version: CameraX 1.0; release date: 2026-05-01; API/component: CameraX; behavior change: stream validation.',
    specificity_checks: ['Version: CameraX 1.0', 'Release date: 2026-05-01']
  });
  const report = reportFor([
    releaseNote,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ], [
    scopedCandidate(sharedUrl, 'direct_aosp_camera', {
      title: 'CameraX 2.0 release notes',
      collectionMode: 'release-note-item',
      version_or_release: 'CameraX 2.0',
      published_date: '2026-05-02'
    }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ]);
  const result = report.article_results.find(item => item.headline === releaseNote.headline);

  assert.equal(result.status, 'FAIL');
  assert.ok(result.hard_fail_reasons.some(reason => reason.includes('Shared watch/release-note URL requires matching')));
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

test('generic bucket is not promoted by camera wording in generated text', () => {
  const generic = section({
    headline: 'Generic FreeBSD release with forced camera wording',
    url: 'https://example.com/freebsd',
    category: 'Generic',
    what_changed: 'FreeBSD 15.1 Beta changed generic OS packaging on 2026-05-01.',
    evidence_summary: 'Version: FreeBSD 15.1 Beta; release date: 2026-05-01; API/component: OS release; behavior change: generic package update.',
    background: 'This paragraph mentions Camera HAL and Android Camera, but the source candidate is generic.',
    camera_hal_perspective: 'Camera HAL teams should not treat this generic release as a direct camera or driver signal.',
    team_summary: 'Keep this in watchlist unless a concrete camera, driver, SoC, or native tooling path appears.'
  });
  const sections = [
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({ headline: 'V4L2 driver update B', url: 'https://example.com/b' }),
    section({ headline: 'Snapdragon ISP update C', url: 'https://example.com/c' }),
    generic
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/a', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/b', 'camera_driver_image_pipeline'),
    scopedCandidate('https://example.com/c', 'soc_platform_signal'),
    scopedCandidate('https://example.com/freebsd', 'generic_tech_watchlist')
  ]);

  assert.equal(report.metrics.generic_tech_watchlist_count, 1);
  assert.equal(report.metrics.primary_camera_stack_count, 2);
  assert.equal(report.metrics.legacy_regex_camera_article_count >= 3, true);
  const genericResult = report.article_results.find(item => item.headline === generic.headline);
  assert.equal(genericResult.scope_count.relevance_bucket, 'generic_tech_watchlist');
  assert.match(genericResult.scope_count.exclusion_reason_if_not_counted, /forbidden by Newsletter Policy/);
  assert.equal(genericResult.status, 'DEMOTE');
  assert.equal(sectionPassesArticleGate(generic, report, { status: 'PASS', must_fix: [], source_gaps: [] }), false);
});

test('quality report supports fallback composition from structured SoC and tooling buckets', () => {
  const sections = [
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({
      headline: 'Snapdragon ISP thermal update B',
      url: 'https://example.com/b',
      category: 'SoC',
      what_changed: 'Snapdragon ISP thermal behavior changed on 2026-05-01.',
      evidence_summary: 'Version: Snapdragon ISP note 1.0; release date: 2026-05-01; API/component: Snapdragon ISP; behavior change: thermal budget.',
      background: 'ISP thermal budget affects image pipeline latency and sustained camera capture.',
      camera_hal_perspective: 'Measure camera preview frame latency, ISP throttling, buffer pressure, and thermal headroom.',
      team_summary: 'Use this SoC signal as fallback review material for camera workloads.'
    }),
    section({
      headline: 'GPU camera inference latency update C',
      url: 'https://example.com/c',
      category: 'SoC',
      what_changed: 'GPU inference latency behavior changed on 2026-05-01.',
      evidence_summary: 'Version: GPU platform note 1.0; release date: 2026-05-01; API/component: GPU inference path; behavior change: latency.',
      background: 'GPU latency can affect camera frame analysis and image pipeline throughput.',
      camera_hal_perspective: 'Compare GPU camera inference latency, frame drops, and thermal behavior on representative devices.',
      team_summary: 'Use this as SoC fallback material for camera performance review.'
    }),
    section({
      headline: 'LLVM sanitizer C++ workflow update D',
      url: 'https://example.com/d',
      category: 'C++ Tooling',
      what_changed: 'LLVM sanitizer workflow changed on 2026-05-01.',
      evidence_summary: 'Version: LLVM 20.1; release date: 2026-05-01; API/component: LLVM sanitizer; behavior change: native debugging.',
      background: 'Native sanitizer workflows improve Camera HAL and driver debugging productivity.',
      camera_hal_perspective: 'Apply sanitizer checks to Camera HAL request/result handling and V4L2 buffer ownership tests.',
      team_summary: 'Use this fallback item for native camera debugging productivity.'
    })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/a', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/b', 'soc_platform_signal'),
    scopedCandidate('https://example.com/c', 'soc_platform_signal'),
    scopedCandidate('https://example.com/d', 'cpp_ai_tooling_fallback')
  ]);

  assert.equal(report.status, 'PASS');
  assert.equal(report.metrics.primary_camera_stack_count, 1);
  assert.equal(report.metrics.fallback_relevance_count, 3);
  assert.equal(report.metrics.composition_mode, 'FALLBACK_COMPOSITION');
});

test('quality gate keeps drafts below configured article minimum in NEEDS_FIX even above threshold', () => {
  const sections = validSections(articlePolicy.mainArticleCount.min - 1);
  const report = reportFor(sections, reporterCandidatesFor(sections));

  assert.equal(report.score >= qualityGatePolicy.threshold, true);
  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item => item.reason.includes('outside Newsletter Policy range')));
});

test('quality gate keeps drafts without required primary camera stack in NEEDS_FIX even above threshold', () => {
  const sections = validSections(articlePolicy.mainArticleCount.min);
  const supportingBuckets = articlePolicy.supportingMainBuckets;
  const report = reportFor(sections, sections.map((item, index) =>
    scopedCandidate(item.sources[0].url, supportingBuckets[index % supportingBuckets.length])
  ));

  assert.equal(report.score >= qualityGatePolicy.threshold, true);
  assert.equal(report.status, 'NEEDS_FIX');
  assert.equal(report.metrics.primary_camera_stack_count, 0);
  assert.ok(report.deductions.some(item => item.reason.includes('Primary Camera Stack article count')));
});

test('quality gate keeps fact-check must_fix in NEEDS_FIX even above threshold', () => {
  const sections = validSections();
  const report = buildNewsletterQualityReport(
    '2026-05-03',
    {
      briefing: ['one', 'two', 'three'],
      sections
    },
    { candidates: reporterCandidatesFor(sections) },
    {
      status: 'NEEDS_FIX',
      must_fix: ['CameraX release A has an unsupported source claim.'],
      source_gaps: [],
      source_gap_count: 0
    }
  );

  assert.equal(report.score >= qualityGatePolicy.threshold, true);
  assert.equal(report.status, 'NEEDS_FIX');
  assert.equal(report.metrics.must_fix_count, 1);
});

test('quality gate treats unresolved stale claim report failures as hard blockers', () => {
  const sections = validSections();
  const report = buildNewsletterQualityReport(
    '2026-05-03',
    {
      briefing: ['one', 'two', 'three'],
      sections
    },
    { candidates: reporterCandidatesFor(sections) },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 },
    {
      staleClaimReport: {
        status: 'NEEDS_FIX',
        stale_claim_items_removed: [],
        unsupported_release_claims_removed: [],
        hard_failures: [{ reason: 'removed-section-claim-remains', claims: ['Android 17 Beta 4'] }]
      }
    }
  );

  assert.equal(report.status, 'NEEDS_FIX');
  assert.equal(report.metrics.stale_claim_status, 'NEEDS_FIX');
  assert.equal(report.metrics.stale_claim_hard_failure_count, 1);
  assert.ok(report.deductions.some(item => item.reason.includes('Stale claim report')));
});

test('quality gate fails duplicate source URLs across main sections', () => {
  const sections = [
    section({ headline: 'CameraX release A', url: 'https://example.com/same' }),
    section({ headline: 'CameraX release B', url: 'https://example.com/same' }),
    section({ headline: 'AOSP Camera change', url: 'https://example.com/aosp' }),
    section({ headline: 'AI camera workflow', url: 'https://example.com/ai', is_ai_related: true, article_type: 'ai', what_changed: 'AI camera workflow changed on 2026-05-01 for Camera HAL stream testing.' })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/same', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/aosp', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/ai', 'direct_aosp_camera')
  ]);

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item => item.reason.includes('Duplicate source URL')));
  assert.ok(report.article_results.some(item =>
    item.status === 'FAIL' &&
    item.hard_fail_reasons.some(reason => reason.includes('Duplicate source URL'))
  ));
});

test('quality gate fails missing dated evidence and source gap mapped candidates', () => {
  const badUrl = 'https://example.com/bad';
  const sections = [
    section({ url: badUrl }),
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change', url: 'https://example.com/c' }),
    section({ headline: 'AI camera workflow', url: 'https://example.com/ai', is_ai_related: true, article_type: 'ai', what_changed: 'AI camera workflow changed on 2026-05-01 for Camera HAL stream testing.' })
  ];
  const report = reportFor(sections, [
    scopedCandidate(badUrl, 'direct_aosp_camera', { hasDatedEvidence: false, source_gap_risk: true }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/ai', 'direct_aosp_camera')
  ]);

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item => item.reason.includes('missing dated evidence')));
  assert.ok(report.deductions.some(item => item.reason.includes('source_gap_risk=true')));
  assert.equal(report.article_results[0].status, 'FAIL');
  assert.equal(report.article_results[0].repair_action, 'replace-or-demote');
});

test('quality gate fails missing Camera HAL perspective and fewer than 2 action items', () => {
  const sections = [
    section({ camera_hal_perspective: 'Read it later.', action_items: ['Check it.'] }),
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change', url: 'https://example.com/c' }),
    section({ headline: 'AI camera workflow', url: 'https://example.com/ai', is_ai_related: true, article_type: 'ai', what_changed: 'AI camera workflow changed on 2026-05-01 for Camera HAL stream testing.' })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/camerax', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/ai', 'direct_aosp_camera')
  ]);

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item => item.reason.includes('camera_hal_perspective')));
  assert.ok(report.deductions.some(item => item.reason.includes('at least 2 action_items')));
  assert.equal(report.deductions.find(item => item.reason.includes('at least 2 action_items')).severity, 'soft');
  assert.equal(report.article_results[0].status, 'DEMOTE');
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
      background: 'The release is about generic office productivity.',
      camera_hal_perspective: 'No concrete device imaging workflow is named.',
      camera_hal_checks: ['Track only as a briefing item.'],
      action_items: [
        'Review whether this belongs in briefing instead of main article.',
        'Do not create device validation work from this generic AI source.'
      ],
      team_summary: 'Generic AI item should stay outside main article slots.'
    }),
    section({
      headline: 'Source gap article',
      url: 'https://example.com/gap',
      evidence_summary: 'source gap: no dated release evidence.',
      source_verification_notes: ['source gap'],
      specificity_checks: ['source gap']
    }),
    section({
      headline: 'Fallback image article',
      url: 'https://example.com/fallback',
      resolvedImage: { usedFallback: true }
    })
  ];
  const report = reportFor(sections, reporterCandidatesFor(sections));

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.metrics.hard_fail_count > 0);
  assert.ok(report.metrics.soft_deduction_count > 0);
  assert.equal(report.article_results[0].status, 'PASS');
  assert.equal(report.article_results[1].status, 'DEMOTE');
  assert.equal(report.article_results[2].status, 'FAIL');
  assert.equal(report.article_results[3].status, 'PASS');
  assert.ok(report.article_results[1].hard_fail_reasons.some(reason => /Generic AI/.test(reason)));
  assert.ok(report.article_results[3].soft_deductions.some(item => item.category === 'image-fallback'));
});

test('quality report treats negative Camera HAL wording as no generic AI connection', () => {
  const sections = [
    section({
      headline: 'Generic AI assistant with no camera impact',
      url: 'https://example.com/generic-ai-negative',
      category: 'AI',
      article_type: 'ai',
      is_ai_related: true,
      what_changed: 'A generic LLM assistant release was announced on 2026-05-01.',
      confirmed_facts: ['The source announces AI assistant 1.0 on 2026-05-01.'],
      evidence_summary: 'Version: AI assistant 1.0; release date: 2026-05-01; API/component: assistant; behavior change: generic productivity.',
      specificity_checks: ['Version: AI assistant 1.0', 'Release date: 2026-05-01'],
      source_verification_notes: ['Official source, dated release evidence.'],
      background: 'The release is about generic office productivity.',
      why_it_matters: 'It may affect developer productivity outside device imaging systems.',
      camera_hal_perspective: 'No Camera HAL or Android Camera impact is identified.',
      camera_hal_checks: ['Keep this as a briefing item unless a concrete imaging component is named.'],
      action_items: [
        'Review whether this belongs in briefing instead of main article.',
        'Do not create device validation work from this generic AI source.'
      ],
      team_summary: 'Generic AI item should stay outside main article slots.'
    }),
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({ headline: 'AOSP Camera change B', url: 'https://example.com/b' }),
    section({ headline: 'Android Camera API change C', url: 'https://example.com/c' })
  ];
  const report = reportFor(sections, reporterCandidatesFor(sections));
  const genericResult = report.article_results.find(item => item.headline === 'Generic AI assistant with no camera impact');

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(genericResult);
  assert.equal(genericResult.status, 'DEMOTE');
  assert.ok(genericResult.hard_fail_reasons.some(reason => /Generic AI/.test(reason)));
});

test('bad regression fixtures cannot pass the main article quality gate', () => {
  const genericAi = readJsonFixture('quality/bad/generic-ai-main-article.json');
  const freebsd = readJsonFixture('quality/bad/freebsd-source-label-regression.json');
  const sections = [
    section({
      ...genericAi.section,
      url: genericAi.section.sources[0].url
    }),
    section({
      ...freebsd.section,
      url: freebsd.section.sources[0].url
    }),
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({ headline: 'AOSP Camera change B', url: 'https://example.com/b' })
  ];
  const report = reportFor(sections, [
    scopedCandidate(genericAi.section.sources[0].url, 'generic_tech_watchlist', genericAi.policyFlags),
    scopedCandidate(freebsd.section.sources[0].url, 'generic_tech_watchlist', {
      ...freebsd.candidate,
      editorial_priority: 6,
      camera_hal_relevance_score: 0,
      android_camera_relevance_score: 0,
      practical_actionability_score: 0
    }),
    scopedCandidate('https://example.com/a', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera')
  ]);

  assert.equal(report.status, 'NEEDS_FIX');
  assert.notEqual(report.article_results.find(item => item.headline === genericAi.section.headline).status, 'PASS');
  assert.notEqual(report.article_results.find(item => item.headline === freebsd.section.headline).status, 'PASS');
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
  assert.match(markdown, /## Article Gate Results/);
  assert.match(markdown, /Generic AI assistant release/);
  assert.match(markdown, /## Hard Fails/);
  assert.match(markdown, /## Soft Deductions/);
  assert.match(markdown, /Article composition failure:/);
  assert.doesNotMatch(markdown, new RegExp(`${score}/${qualityGatePolicy.threshold}`));
});
