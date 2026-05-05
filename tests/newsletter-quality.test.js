const assert = require('node:assert/strict');
const test = require('node:test');

const {
  QUALITY_THRESHOLD,
  buildNewsletterQualityReport,
  buildQualityReportMarkdown,
  determineQualityStatus
} = require('../scripts/lib/newsletter-quality');

function source(url, title = 'Source') {
  return { title, url };
}

function section(overrides = {}) {
  const title = overrides.headline || 'CameraX 1.5 release gives HAL teams a compatibility target';
  return {
    category: 'Android Camera',
    headline: title,
    what_changed: 'CameraX 1.5.0 was released on 2026-05-01 with Android Camera compatibility behavior.',
    confirmed_facts: ['CameraX 1.5.0 release date: 2026-05-01.'],
    evidence_summary: 'Version: CameraX 1.5.0; release date: 2026-05-01; API/component: CameraX; behavior change: compatibility validation target.',
    specificity_checks: ['Version: CameraX 1.5.0', 'Release date: 2026-05-01'],
    source_verification_notes: ['Official source, dated release evidence.'],
    background: 'CameraX sits above camera2 and exposes compatibility regressions that can map back to Camera HAL stream and metadata behavior.',
    why_it_matters: 'HAL teams can use this as a regression check input.',
    camera_hal_perspective: 'Validate request/result metadata, stream combinations, Camera ITS scenes, latency, frame drop, thermal, and buffer behavior on representative devices.',
    camera_hal_checks: ['Run Camera ITS focused scenes on CameraX-backed capture paths.'],
    action_items: [
      'Within 2 weeks, assign a camera owner to compare Camera ITS logs before and after CameraX 1.5.0.',
      'Measure preview/capture latency and frame drop metrics on at least one legacy and one flagship device.'
    ],
    team_summary: 'Use CameraX 1.5.0 as a concrete compatibility validation trigger.',
    is_ai_related: false,
    article_type: 'camera-hal',
    sources: [source(overrides.url || 'https://example.com/camerax')],
    ...overrides
  };
}

function reporterCandidate(url, overrides = {}) {
  return {
    title: 'Reporter candidate',
    url,
    finalSelectionEligibility: 'main',
    isWatchPage: false,
    hasDatedEvidence: true,
    main_eligible: true,
    source_gap_risk: false,
    reference_only: false,
    selected: true,
    camera_hal_relevance_score: 5,
    android_camera_relevance_score: 5,
    practical_actionability_score: 5,
    ...overrides
  };
}

function reportFor(sections, reporterCandidates) {
  return buildNewsletterQualityReport(
    '2026-05-03',
    {
      briefing: ['one', 'two', 'three'],
      sections
    },
    { candidates: reporterCandidates },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 }
  );
}

function validSections(count = 4) {
  const sections = [
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({ headline: 'AOSP Camera change B', url: 'https://example.com/b' }),
    section({ headline: 'Android Camera API change C', url: 'https://example.com/c' }),
    section({
      headline: 'AI camera workflow D',
      url: 'https://example.com/ai',
      is_ai_related: true,
      article_type: 'ai',
      what_changed: 'AI camera workflow changed on 2026-05-01 for Camera HAL stream testing.',
      evidence_summary: 'Version: AI workflow 1.0; release date: 2026-05-01; API/component: Android Camera frame pipeline; behavior change: camera frame inference validation.',
      specificity_checks: ['Version: AI workflow 1.0', 'Release date: 2026-05-01']
    })
  ];
  return sections.slice(0, count);
}

function reporterCandidatesFor(sections) {
  return sections.map(item => reporterCandidate(item.sources[0].url));
}

test('quality threshold defaults to 85 and preserves numeric boundary behavior', () => {
  assert.equal(QUALITY_THRESHOLD, 85);
  assert.equal(determineQualityStatus(84, QUALITY_THRESHOLD, {
    sourceGapCount: 0,
    hasFactCheckMustFix: false,
    blockingDeductions: []
  }), 'NEEDS_FIX');
  assert.equal(determineQualityStatus(85, QUALITY_THRESHOLD, {
    sourceGapCount: 0,
    hasFactCheckMustFix: false,
    blockingDeductions: []
  }), 'PASS');
});

test('quality threshold does not override hard blockers at high scores', () => {
  assert.equal(determineQualityStatus(90, QUALITY_THRESHOLD, {
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

test('quality gate keeps underfilled drafts in NEEDS_FIX even above threshold', () => {
  const sections = validSections(3);
  const report = reportFor(sections, reporterCandidatesFor(sections));

  assert.equal(report.score >= QUALITY_THRESHOLD, true);
  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item => item.reason.includes('Expected 4-5 main articles')));
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

  assert.equal(report.score >= QUALITY_THRESHOLD, true);
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
    reporterCandidate('https://example.com/same'),
    reporterCandidate('https://example.com/aosp'),
    reporterCandidate('https://example.com/ai')
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
    reporterCandidate(badUrl, { hasDatedEvidence: false, source_gap_risk: true }),
    reporterCandidate('https://example.com/b'),
    reporterCandidate('https://example.com/c'),
    reporterCandidate('https://example.com/ai')
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
    reporterCandidate('https://example.com/camerax'),
    reporterCandidate('https://example.com/b'),
    reporterCandidate('https://example.com/c'),
    reporterCandidate('https://example.com/ai')
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

test('quality report markdown separates score threshold max score and result', () => {
  const markdown = buildQualityReportMarkdown({
    date: '2026-05-03',
    score: 70,
    max_score: 100,
    threshold: 85,
    status: 'NEEDS_FIX',
    summary: '품질 점수 70, 기준 85, 만점 100.',
    deductions: [
      { category: 'composition', points: 4, reason: 'Expected 4-5 main articles, found 3.' }
    ],
    metrics: {
      article_count: 3,
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

  assert.match(markdown, /Quality score: 70/);
  assert.match(markdown, /Quality threshold: 85/);
  assert.match(markdown, /Max score: 100/);
  assert.match(markdown, /Result: NEEDS_FIX/);
  assert.match(markdown, /## Article Gate Results/);
  assert.match(markdown, /Generic AI assistant release/);
  assert.match(markdown, /## Hard Fails/);
  assert.match(markdown, /## Soft Deductions/);
  assert.match(markdown, /Underfilled\/composition failure: only 3 main articles/);
  assert.doesNotMatch(markdown, /70\/85/);
});
