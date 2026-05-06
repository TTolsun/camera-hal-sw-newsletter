const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildSourceEffectivenessReport,
  renderSourceEffectivenessMarkdown,
  writeSourceEffectivenessArtifacts
} = require('../scripts/newsroom/metrics/source-effectiveness-report');

const fixture = require('./fixtures/source-effectiveness/basic-source-effectiveness.json');

function buildReport(overrides = {}) {
  return buildSourceEffectivenessReport({
    date: fixture.date,
    sourceRegistry: fixture.sourceRegistry,
    collectedCandidates: fixture.collectedCandidates,
    shortlistReport: fixture.shortlistReport,
    reporterCandidates: fixture.reporterCandidates,
    editorDraft: fixture.editorDraft,
    factCheckReport: fixture.factCheckReport,
    qualityReport: fixture.qualityReport,
    ...overrides
  });
}

function source(report, id) {
  return report.sources.find(item => item.source_id === id);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('selected and rendered source gets high score and KEEP recommendation', () => {
  const report = buildReport();
  const effective = source(report, 'effective-camera');

  assert.equal(effective.recommendation, 'KEEP');
  assert.equal(effective.collected_count, 1);
  assert.equal(effective.eligible_count, 1);
  assert.equal(effective.selected_count, 1);
  assert.equal(effective.rendered_main_count, 1);
  assert.ok(effective.effectiveness_score >= 80);
  assert.equal(effective.duplicate_within_source_count, 1);
  assert.equal(effective.duplicate_across_sources_count, 1);
});

test('official source with collected candidates but zero eligible needs parser repair', () => {
  const report = buildReport();
  const official = source(report, 'official-broken');

  assert.equal(official.collected_count, 1);
  assert.equal(official.eligible_count, 0);
  assert.equal(official.recommendation, 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR');
});

test('generic source with many collected and zero eligible is downgrade candidate', () => {
  const report = buildReport();
  const generic = source(report, 'generic-ai-firehose');

  assert.equal(generic.collected_count, 3);
  assert.equal(generic.eligible_count, 0);
  assert.equal(generic.generic_noise_count, 3);
  assert.equal(generic.recommendation, 'DOWNGRADE_TO_CANDIDATE_ONLY');
});

test('source gap heavy non-generic source is review source or parser', () => {
  const report = buildReport();
  const gapHeavy = source(report, 'gap-heavy');

  assert.equal(gapHeavy.source_gap_count, 3);
  assert.equal(gapHeavy.recommendation, 'REVIEW_SOURCE_OR_PARSER');
  assert.ok(gapHeavy.top_exclusion_reasons.some(item => item.reason === 'source_gap_risk=true'));
});

test('rendered section URL matches normalized candidate URL', () => {
  const report = buildReport();
  const effective = source(report, 'effective-camera');

  assert.equal(effective.rendered_main_count, 1);
  assert.deepEqual(effective.sample_selected_urls, [
    'https://camera.example.com/articles/camera-hal-release?utm=collector',
    'https://camera.example.com/articles/camera-hal-release?utm=selected'
  ]);
});

test('fact-check source gap URL is mapped back to the collected source', () => {
  const report = buildReport({
    collectedCandidates: {
      candidates: fixture.collectedCandidates.candidates.filter(candidate => candidate.title !== 'Cross-source duplicate')
    },
    factCheckReport: {
      status: 'NEEDS_FIX',
      must_fix: [],
      source_gaps: [{
        source_url: 'https://camera.example.com/articles/camera-hal-release?from=fact-check',
        problem: 'Rendered article source has a source gap.'
      }],
      source_gap_count: 1
    }
  });
  const effective = source(report, 'effective-camera');

  assert.equal(effective.source_gap_count, 1);
  assert.ok(effective.top_exclusion_reasons.some(item => item.reason === 'Rendered article source has a source gap.'));
});

test('missing optional artifacts do not crash artifact generation', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'source-effectiveness-'));
  const date = fixture.date;

  writeJson(path.join(tempRoot, 'data', 'news-sources.json'), fixture.sourceRegistry);
  writeJson(path.join(tempRoot, 'content', 'collected-news', date, 'candidates.json'), fixture.collectedCandidates);
  writeJson(path.join(tempRoot, 'content', 'newsroom', date, 'shortlisted-candidates.json'), fixture.shortlistReport);

  const result = writeSourceEffectivenessArtifacts({ root: tempRoot, date });
  assert.equal(fs.existsSync(result.jsonPath), true);
  assert.equal(fs.existsSync(result.markdownPath), true);
  assert.ok(result.report.warnings.some(warning => warning.includes('reporter-candidates.json')));
  assert.ok(result.report.warnings.some(warning => warning.includes('editor-draft.json')));
});

test('JSON and Markdown report output is deterministic', () => {
  const first = buildReport();
  const second = buildReport();
  const firstJson = JSON.stringify(first, null, 2);
  const secondJson = JSON.stringify(second, null, 2);
  const firstMarkdown = renderSourceEffectivenessMarkdown(first);
  const secondMarkdown = renderSourceEffectivenessMarkdown(second);

  assert.equal(firstJson, secondJson);
  assert.equal(firstMarkdown, secondMarkdown);
  assert.ok(firstMarkdown.indexOf('| effective-camera | KEEP |') < firstMarkdown.indexOf('| official-broken | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR |'));
  assert.ok(first.warnings.some(warning => warning.includes('synthetic-unknown-camera-blog')));
});
