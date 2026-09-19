const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildShortlistReport, policyPrimaryCandidate, policyDriverCandidate, policySupportingCandidate
} = require('../../../shared/test/helpers/selection-builders');
const { reconcileCoverage } = require('../../select/coverage-reconciliation');
const { buildHtml, buildMarkdown } = require('../../render/newsletter-renderer');
const { applyHomepageHeadlineSelection } = require('../../reporter/homepage-headline');
const date = '2026-09-21';
const published_date = '2026-09-17';

function lineup() {
  return [
    ...Array.from({ length: 5 }, (_, i) => policyDriverCandidate(i, { published_date })),
    ...['GCC compiler diagnostics', 'Claude Code review', 'Codex CLI sandbox'].map((title, i) =>
      policySupportingCandidate(i, { title, published_date })),
    policyPrimaryCandidate(0, { published_date })
  ];
}

test('AOSP leads and multiple GCC/AI main articles precede drivers without using the supporting cap', () => {
  const report = buildShortlistReport(date, { candidates: lineup() });
  assert.deepEqual(report.selected_articles.map(c => c.relevance_bucket), [
    'direct_aosp_camera', 'cpp_ai_tooling_fallback', 'cpp_ai_tooling_fallback',
    'cpp_ai_tooling_fallback', 'camera_driver_image_pipeline'
  ]);
  assert.equal(report.composition_summary.supporting_main_article_count, 0);
  assert.equal(report.composition_summary.primary_camera_stack_topic_count, 2);
  assert.equal(report.publish_gate_passed, true);
});

test('coverage cap retains AOSP and tooling over higher-scored driver proposals', () => {
  const candidates = lineup().map((c, i) => ({ ...c, url_hash: c.url, main_article_source_allowed: true,
    deterministic_score: c.relevance_bucket === 'camera_driver_image_pipeline' ? 1000 + i : 50 }));
  const report = reconcileCoverage({ shortlistReport: { selected_articles: candidates.slice(0, 5), reserve_candidates: candidates.slice(5), publish_ready: true },
    editorialPlanReport: { editorial_plans: candidates.map(c => ({ url: c.url, coverage_decision: 'main_article' })) } });
  const selected = report.selected;
  assert.deepEqual(selected.map(c => c.relevance_bucket), [
    'direct_aosp_camera', 'cpp_ai_tooling_fallback', 'cpp_ai_tooling_fallback',
    'cpp_ai_tooling_fallback', 'camera_driver_image_pipeline'
  ]);
});

test('Markdown and HTML place AOSP then AI/GCC before drivers even if the editor returns reverse order', () => {
  const sections = [ ['Driver article', 'camera_driver_image_pipeline'], ['AI article', 'cpp_ai_tooling_fallback'], ['AOSP article', 'direct_aosp_camera'] ]
    .map(([headline, relevance_bucket]) => ({ headline, relevance_bucket, public_article: {
      headline, lead: headline + ' lead.', body_paragraphs: ['Source-backed release details.'], camera_hal_takeaway: 'Review the source.',
      source_links: [{ title: headline, url: 'https://example.com/' + relevance_bucket, source_role: 'primary' }]
    } }));
  const issue = { date, title: 'Weekly issue', summary: 'Summary.', briefing: [], sections };
  for (const content of [buildMarkdown(issue), buildHtml(issue)]) {
    assert.ok(content.indexOf('AOSP article') < content.indexOf('AI article'));
    assert.ok(content.indexOf('AI article') < content.indexOf('Driver article'));
  }
  assert.equal(sections[0].headline, 'Driver article');
});

test('homepage headline uses AOSP then AI priority before source recency', () => {
  const [driver, ai, camera] = [policyDriverCandidate(0, { published_date: '2026-09-19' }),
    policySupportingCandidate(0, { published_date: '2026-09-18' }), policyPrimaryCandidate(0, { published_date })];
  const choose = selectedArticles => applyHomepageHeadlineSelection({ date, selectedArticles }).homepage_headline_state.current_headline.source_url;
  assert.equal(choose([driver, ai, camera]), camera.url);
  assert.equal(choose([driver, ai]), ai.url);
});


test('driver-only selection keeps at most two useful eligible articles and does not fill five slots', () => {
  const drivers = ['IPU6 CSI receiver routing', 'imx708 image sensor binding', 'uvcvideo probe ordering', 'atomisp firmware cleanup'].map((title, i) => policyDriverCandidate(i, { published_date, title }));
  const report = buildShortlistReport(date, { candidates: drivers });
  assert.equal(report.selected_articles.length, 2);
  assert.equal(report.composition_summary.camera_driver_image_pipeline_count, 2);
  assert.equal(report.publish_gate_passed, true);
});

test('coverage proposals and both catch-up lanes cannot exceed two driver articles', () => {
  const drivers = Array.from({ length: 4 }, (_, i) => ({ ...policyDriverCandidate(i, { published_date }),
    url_hash: 'driver-' + i, main_article_source_allowed: true, deterministic_score: 100 - i }));
  const reconciled = reconcileCoverage({ shortlistReport: { selected_articles: drivers.slice(0, 2), reserve_candidates: drivers.slice(2), publish_ready: true },
    editorialPlanReport: { editorial_plans: drivers.map(c => ({ url: c.url, coverage_decision: 'main_article' })) } });
  assert.equal(reconciled.selected.length, 2);
  const { admitCatchUpCandidates } = require('../../select/newsroom-selection');
  for (const channel of ['patch', 'release']) {
    const result = admitCatchUpCandidates({ selected: drivers.slice(0, 2),
      pool: drivers.slice(2).map(c => ({ ...c, freshness_window: 'reference', channel })), generalTake: 2, maxReleaseClassArticles: 2 });
    assert.equal(result.admitted.length, 0);
  }
});

test('weekly accumulation and final quality gate enforce the driver cap independently', () => {
  const { applyWeeklyArticleLimits } = require('../../reporter/weekly-article-limits');
  const drivers = Array.from({ length: 4 }, (_, i) => ({ ...policyDriverCandidate(i, { published_date }), score: i }));
  const weekly = applyWeeklyArticleLimits({ existing: drivers.slice(0, 2), incoming: drivers.slice(2) });
  assert.equal(weekly.articles.length, 2);
  assert.deepEqual(weekly.articles.map(c => c.score).sort(), [2, 3]);
  const { reportFor, section, scopedCandidate } = require('../../../shared/test/helpers/quality-builders');
  const sections = drivers.slice(0, 3).map((c, i) => section({ headline: 'Driver release ' + i, url: c.url }));
  const report = reportFor(sections, sections.map(s => scopedCandidate(s.sources[0].url, 'camera_driver_image_pipeline')));
  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(d => /Driver main article count/.test(d.reason) && d.blocking !== false));
});
