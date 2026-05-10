const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  FETCH_STATUSES,
  IMPACT_TYPES,
  RAW_EXCERPT_MAX_LENGTH,
  analyzeLinkedEvidenceForCandidates,
  writeLinkedEvidenceDiagnosticsArtifacts
} = require('../scripts/newsroom/evidence');
const { buildShortlistReport } = require('../scripts/lib/newsroom-selection');
const { candidate } = require('./helpers/newsroom-builders');

function linkedCandidate(overrides = {}) {
  return candidate({
    title: 'Camera HAL metadata update',
    url: 'https://example.com/camera-hal-metadata',
    summary: [
      'Camera HAL capture result metadata behavior changes for stream buffers.',
      'Linked change: https://github.com/androidx/androidx/pull/1234.',
      'Extra context '.repeat(80)
    ].join(' '),
    api_or_component: 'Camera HAL metadata',
    behavior_change: 'Fixes capture result metadata behavior for stream buffers.',
    ...overrides
  });
}

test('linked evidence diagnostics produce candidate-safe summary and report-only payload', async () => {
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', [linkedCandidate()]);
  const [safeCandidate] = diagnostics.candidates;
  const [reportCandidate] = diagnostics.report.candidates;

  assert.equal(diagnostics.report.schema_version, 1);
  assert.equal(diagnostics.report.enable_network, false);
  assert.equal(diagnostics.report.candidate_count, 1);
  assert.equal(safeCandidate.linked_evidence_summary.schema_version, 1);
  assert.equal(safeCandidate.impact_classification.impact_type, IMPACT_TYPES.RUNTIME_BEHAVIOR_CHANGE);
  assert.equal(safeCandidate.impact_classification.recommended_article_type, 'main');
  assert.equal(safeCandidate.linked_evidence, undefined);
  assert.equal(safeCandidate.resolved, undefined);
  assert.equal(safeCandidate.raw_excerpt, undefined);
  assert.equal(Array.isArray(reportCandidate.linked_evidence), true);
  assert.equal(reportCandidate.linked_evidence[0].fetch_status, FETCH_STATUSES.SKIPPED);
  assert.ok(reportCandidate.linked_evidence[0].raw_excerpt.length <= RAW_EXCERPT_MAX_LENGTH);
  assert.equal(reportCandidate.linked_evidence_summary.by_fetch_status[FETCH_STATUSES.SKIPPED], 1);
});

test('linked evidence diagnostics create empty artifacts for zero candidates', async () => {
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', []);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linked-evidence-diagnostics-'));

  writeLinkedEvidenceDiagnosticsArtifacts(tempDir, diagnostics);

  const reportPath = path.join(tempDir, 'linked-evidence-report.json');
  const markdownPath = path.join(tempDir, 'linked-evidence-diagnostics.md');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const markdown = fs.readFileSync(markdownPath, 'utf8');

  assert.equal(report.candidate_count, 0);
  assert.equal(report.totals.total_count, 0);
  assert.deepEqual(report.candidates, []);
  assert.match(markdown, /- candidate_count: 0/);
  assert.match(markdown, /- none/);
});

test('linked evidence summary does not change deterministic selection scores or order', async () => {
  const baseCandidates = [
    linkedCandidate({ title: 'Camera HAL metadata A', url: 'https://example.com/a' }),
    linkedCandidate({ title: 'Camera HAL metadata B', url: 'https://example.com/b', camera_hal_relevance_score: 80 })
  ];
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', baseCandidates);
  const baseReport = buildShortlistReport('2026-05-10', baseCandidates, { minArticles: 1 });
  const enrichedReport = buildShortlistReport('2026-05-10', diagnostics.candidates, { minArticles: 1 });

  assert.deepEqual(
    enrichedReport.shortlisted_candidates.map(item => item.url),
    baseReport.shortlisted_candidates.map(item => item.url)
  );
  assert.deepEqual(
    enrichedReport.shortlisted_candidates.map(item => item.deterministic_score),
    baseReport.shortlisted_candidates.map(item => item.deterministic_score)
  );
  assert.deepEqual(enrichedReport.selection_errors, baseReport.selection_errors);
});
