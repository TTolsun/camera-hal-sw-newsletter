const assert = require('assert');
const {
  normalizeReporterReport,
  normalizeShortlistReport,
  renderCandidateSelectionDiagnostics,
  selectionDiagnosticsFromReports
} = require('../generate/selection-diagnostics');
const {
  buildNewsletterQualityReport
} = require('../validate/newsletter-quality');

const date = '2026-05-03';

const finalSelectedRss = {
  title: 'Camera RSS article',
  source: 'Camera Feed',
  url: 'https://example.com/camera-rss',
  normalized_url: 'https://example.com/camera-rss',
  selected: true,
  selected_for_editor: true,
  exclusion_reasons: []
};

const reporterSelectedWatchPage = {
  title: 'AOSP What is New',
  source: 'AOSP',
  url: 'https://source.android.com/docs/whatsnew',
  normalized_url: 'https://source.android.com/docs/whatsnew',
  selected: false,
  selected_for_editor: false,
  finalSelectionEligibility: 'watchlist',
  exclusion_reasons: [
    'finalSelectionEligibility=watchlist',
    'missing dated evidence'
  ]
};

const reporterSelectedReferencePage = {
  title: 'AOSP Camera Documentation',
  source: 'AOSP',
  url: 'https://source.android.com/docs/core/camera',
  normalized_url: 'https://source.android.com/docs/core/camera',
  selected: false,
  selected_for_editor: false,
  finalSelectionEligibility: 'exclude',
  exclusion_reasons: [
    'reference_only=true',
    'finalSelectionEligibility=exclude'
  ]
};

const nonReporterSelectedExcluded = {
  title: 'Generic source-gap item',
  source: 'Example',
  url: 'https://example.com/source-gap',
  normalized_url: 'https://example.com/source-gap',
  selected: false,
  selected_for_editor: false,
  finalSelectionEligibility: 'main',
  exclusion_reasons: ['source_gap_risk=true']
};

const shortlist = normalizeShortlistReport({
  schema_version: 1,
  date,
  input_candidate_count: 4,
  eligible_candidate_count: 1,
  selected_article_count: 1,
  shortlisted_candidates: [finalSelectedRss],
  selected_articles: [finalSelectedRss],
  excluded_candidates: [
    reporterSelectedWatchPage,
    reporterSelectedReferencePage,
    nonReporterSelectedExcluded
  ],
  exclusion_reason_summary: []
});

const reporter = normalizeReporterReport({
  schema_version: 1,
  date,
  candidates: [
    { title: finalSelectedRss.title, source: finalSelectedRss.source, url: finalSelectedRss.url, selected: true },
    { title: reporterSelectedWatchPage.title, source: reporterSelectedWatchPage.source, url: reporterSelectedWatchPage.url, selected: true },
    { title: reporterSelectedReferencePage.title, source: reporterSelectedReferencePage.source, url: reporterSelectedReferencePage.url, selected: true },
    { title: nonReporterSelectedExcluded.title, source: nonReporterSelectedExcluded.source, url: nonReporterSelectedExcluded.url, selected: false }
  ]
}, shortlist);

const shortlistWithReporter = normalizeShortlistReport(shortlist, reporter);
const diagnostics = selectionDiagnosticsFromReports(shortlistWithReporter, reporter);
const markdown = renderCandidateSelectionDiagnostics(diagnostics);

const reporterRss = reporter.candidates.find(candidate => candidate.url === finalSelectedRss.url);
const reporterWatch = reporter.candidates.find(candidate => candidate.url === reporterSelectedWatchPage.url);
const shortlistRss = shortlistWithReporter.shortlisted_candidates.find(candidate => candidate.url === finalSelectedRss.url);

assert.strictEqual(reporter.selection_stage, 'reporter');
assert.strictEqual(reporter.reporter_candidate_count, 4);
assert.strictEqual(reporter.reporter_selected_count, 3);
assert.strictEqual(reporter.reporter_selected_but_final_excluded_count, 2);
assert.strictEqual(reporterRss.reporter_selected, true);
assert.strictEqual(reporterRss.selected, reporterRss.reporter_selected);
assert.strictEqual(reporterRss.final_selected, true);
assert.strictEqual(reporterWatch.reporter_selected, true);
assert.strictEqual(reporterWatch.final_selected, false);
assert.deepStrictEqual(reporterWatch.final_exclusion_reasons, [
  'finalSelectionEligibility=watchlist',
  'missing dated evidence'
]);

assert.strictEqual(shortlistWithReporter.selection_stage, 'deterministic-final');
assert.strictEqual(shortlistWithReporter.final_input_candidate_count, 4);
assert.strictEqual(shortlistWithReporter.final_eligible_candidate_count, 1);
assert.strictEqual(shortlistWithReporter.final_selected_article_count, 1);
assert.strictEqual(shortlistWithReporter.reporter_selected_count, 3);
assert.strictEqual(shortlistWithReporter.reporter_selected_but_final_excluded_count, 2);
assert.strictEqual(shortlistRss.final_selected, true);
assert.strictEqual(shortlistRss.selected, shortlistRss.final_selected);
assert.strictEqual(shortlistRss.selected_for_editor, true);
assert.strictEqual(shortlistRss.reporter_selected, true);

const reasonCounts = new Map(diagnostics.final_exclusion_reason_summary.map(item => [item.reason, item.count]));
assert.strictEqual(reasonCounts.get('finalSelectionEligibility=watchlist'), 1);
assert.strictEqual(reasonCounts.get('missing dated evidence'), 1);
assert.strictEqual(reasonCounts.get('reference_only=true'), 1);
assert.strictEqual(reasonCounts.get('source_gap_risk=true'), 1);

assert.match(markdown, /Reporter-selected candidates: 3/);
assert.match(markdown, /Final eligible candidates: 1/);
assert.match(markdown, /Final selected articles: 1/);
assert.match(markdown, /Reporter-selected but final-excluded: 2/);
assert.match(markdown, /Reporter-selected candidates are not necessarily publishable/);

function qualitySection(index, url, headlineSuffix = '') {
  return {
    category: 'Android Camera / Camera HAL',
    headline: `Camera HAL validation article ${index}${headlineSuffix}`,
    what_changed: `Android Camera API behavior changed on 2026-05-03 for Camera HAL stream metadata path ${index}.`,
    confirmed_facts: [
      `Release date 2026-05-03 names Camera HAL stream metadata component ${index}.`
    ],
    evidence_summary: `2026-05-03 release note names Camera HAL stream metadata behavior change ${index}.`,
    specificity_checks: [
      `2026-05-03 Camera HAL stream metadata API behavior change ${index}`
    ],
    source_verification_notes: [
      `Verified source URL ${url} for dated Camera HAL evidence.`
    ],
    background: `Camera HAL owners need this Camera2 stream metadata context for CTS and VTS validation ${index}.`,
    camera_hal_perspective: `Camera HAL stream buffer metadata request/result validation needs CTS, VTS, Camera ITS, latency, and frame drop checks ${index}.`,
    camera_hal_checks: [
      `Run CTS Camera ITS stream metadata validation on device class ${index}.`
    ],
    action_items: [
      `Run CTS Camera ITS stream metadata test on device class ${index} within 2 weeks.`,
      `Collect camera HAL latency metric and frame drop log for stream combination ${index}.`
    ],
    team_summary: `Camera HAL team should validate stream metadata request/result behavior ${index}.`,
    is_ai_related: index === 1,
    article_type: index === 1 ? 'AI Camera HAL workflow' : 'Android Camera platform',
    sources: [
      { title: `Camera source ${index}`, url }
    ]
  };
}

const qualityReport = buildNewsletterQualityReport(
  date,
  {
    sections: [
      qualitySection(1, finalSelectedRss.url, ' with AI camera model inference workflow'),
      qualitySection(2, 'https://example.com/camera-2'),
      qualitySection(3, 'https://example.com/camera-3'),
      qualitySection(4, 'https://example.com/camera-4')
    ],
    briefing: ['one', 'two', 'three']
  },
  {
    candidates: [
      {
        title: 'Weak final selected',
        url: finalSelectedRss.url,
        selected: false,
        reporter_selected: false,
        final_selected: true,
        selected_for_editor: true,
        finalSelectionEligibility: 'main',
        hasDatedEvidence: true,
        main_eligible: true,
        camera_hal_relevance_score: 1,
        android_camera_relevance_score: 1,
        practical_actionability_score: 1
      },
      {
        title: 'Weak reporter selected but final excluded',
        url: reporterSelectedWatchPage.url,
        selected: true,
        reporter_selected: true,
        final_selected: false,
        selected_for_editor: false,
        finalSelectionEligibility: 'watchlist',
        hasDatedEvidence: false,
        camera_hal_relevance_score: 1,
        android_camera_relevance_score: 1,
        practical_actionability_score: 1
      }
    ]
  },
  { status: 'PASS', must_fix: [], source_gaps: [] },
  { threshold: 0, seedEvidencePack: null }
);
const weakFinalDeduction = qualityReport.deductions.filter(deduction =>
  /final-selected candidate\(s\) have weak HAL\/actionability scores/.test(deduction.reason)
);
assert.strictEqual(weakFinalDeduction.length, 1);
assert.strictEqual(weakFinalDeduction[0].points, 2);

console.log('selection diagnostics fixture passed');
