const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildShortlistReport,
  policyDriverCandidate,
  policySupportingCandidate
} = require('../../../shared/test/helpers/selection-builders');
const { publishReadyCompositionPolicy } = require('../../../shared/common/newsletter-policy');

test('restored AI candidates cannot exceed the supporting cap or prevent a valid camera lineup', () => {
  const date = '2026-09-21';
  const published_date = '2026-09-17';
  const candidates = [
    ...['Codex CLI sandbox', 'Claude Code review', 'Agentic coding CI tests'].map((title, i) =>
      policySupportingCandidate(i, { title, published_date, editorial_priority: 2 })),
    ...Array.from({ length: 5 }, (_, i) => policyDriverCandidate(i, { published_date }))
  ];
  const report = buildShortlistReport(date, { candidates });
  assert.equal(report.composition_summary.supporting_main_article_count, publishReadyCompositionPolicy.supportingMainMaxAllowed);
  assert.equal(report.publish_gate_passed, true);
  assert.ok(report.reserve_candidates.some(candidate => candidate.relevance_bucket === 'cpp_ai_tooling_fallback'));
});
