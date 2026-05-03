const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsroomPrBody
} = require('../scripts/build-newsroom-pr-body');
const {
  buildGenerationStatusOutputs,
  readStatus,
  renderGithubOutputs
} = require('../scripts/write-generation-status-output');

test('generation status output falls back when status JSON is missing', () => {
  const status = readStatus('__missing__/newsletter-generation-status.json');
  const outputs = buildGenerationStatusOutputs(status);

  assert.equal(outputs.status, 'UNKNOWN');
  assert.equal(outputs.must_fix_count, '0');
  assert.equal(outputs.quality_status, 'UNKNOWN');
  assert.equal(outputs.quality_score, 'n/a');
  assert.equal(outputs.quality_threshold, 'n/a');
  assert.equal(outputs.publish_ready, 'false');
});

test('generation status output includes multiline selection diagnostics', () => {
  const outputs = buildGenerationStatusOutputs({
    status: 'QUALITY_NEEDS_FIX',
    must_fix_count: 0,
    quality_status: 'NEEDS_FIX',
    quality_score: 90,
    quality_threshold: 85,
    publish_ready: false,
    underfilled: true,
    selected_article_count: 3,
    final_selected_article_count: 3,
    selection_warnings: ['Thin-week review path'],
    final_exclusion_reason_summary: [
      { reason: 'missing dated evidence', count: 4 },
      { reason: 'source_gap_risk=true', count: 2 }
    ]
  });
  const rendered = renderGithubOutputs(outputs);

  assert.equal(outputs.final_selected_article_count_for_gate, '3');
  assert.match(rendered, /candidate_selection_diagnostics<<EOF/);
  assert.match(rendered, /missing dated evidence \(4\)/);
  assert.match(rendered, /selection_warnings=Thin-week review path/);
});

test('newsroom PR body separates quality score threshold and result', () => {
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'failure',
    status: {
      status: 'QUALITY_NEEDS_FIX',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      quality_status: 'NEEDS_FIX',
      quality_score: 90,
      quality_threshold: 85,
      publish_ready: false,
      underfilled: true,
      selected_article_count: 3,
      final_selected_article_count: 3,
      input_candidate_count: 20,
      eligible_candidate_count: 3,
      final_exclusion_reason_summary: [
        { reason: 'missing dated evidence', count: 7 }
      ]
    }
  });

  assert.match(body, /Quality score: 90/);
  assert.match(body, /Quality threshold: 85/);
  assert.match(body, /Result: NEEDS_FIX/);
  assert.match(body, /Only 3 publishable articles were selected; expected at least 4\./);
  assert.doesNotMatch(body, /90\/85/);
});
