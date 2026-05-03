const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown
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
});

test('quality report markdown separates score threshold max score and result', () => {
  const markdown = buildQualityReportMarkdown({
    date: '2026-05-03',
    score: 70,
    max_score: 100,
    threshold: 90,
    status: 'NEEDS_FIX',
    summary: '품질 점수 70, 기준 90, 만점 100.',
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
      top_deduction_categories: [{ category: 'composition', count: 1 }],
      candidate_exclusion_summary: [{ reason: 'missing dated evidence', count: 2 }]
    }
  });

  assert.match(markdown, /Quality score: 70/);
  assert.match(markdown, /Quality threshold: 90/);
  assert.match(markdown, /Max score: 100/);
  assert.match(markdown, /Result: NEEDS_FIX/);
  assert.match(markdown, /Underfilled\/composition failure: only 3 main articles/);
  assert.doesNotMatch(markdown, /70\/90/);
});
