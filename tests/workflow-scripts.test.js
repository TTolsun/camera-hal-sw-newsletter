const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
  assert.equal(outputs.final_publish_ready, 'false');
});

test('generation status output includes multiline selection diagnostics', () => {
  const outputs = buildGenerationStatusOutputs({
    status: 'QUALITY_NEEDS_FIX',
    must_fix_count: 0,
    quality_status: 'NEEDS_FIX',
    quality_score: 90,
    quality_threshold: 85,
    publish_ready: false,
    final_publish_ready: false,
    composition_mode: 'THIN_WEEK_REVIEW',
    editor_review_required: true,
    underfilled: true,
    deterministic_selected_count: 5,
    rendered_main_article_count: 3,
    reserve_candidate_count: 4,
    stale_claim_status: 'PASS',
    stale_claim_removed_count: 2,
    stale_claim_hard_failure_count: 0,
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
  assert.equal(outputs.composition_mode, 'THIN_WEEK_REVIEW');
  assert.equal(outputs.editor_review_required, 'true');
  assert.equal(outputs.deterministic_selected_count, '5');
  assert.equal(outputs.rendered_main_article_count, '3');
  assert.equal(outputs.reserve_candidate_count, '4');
  assert.equal(outputs.stale_claim_status, 'PASS');
  assert.equal(outputs.stale_claim_removed_count, '2');
  assert.equal(outputs.stale_claim_hard_failure_count, '0');
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
      selection_publish_ready: false,
      final_publish_ready: false,
      composition_mode: 'THIN_WEEK_REVIEW',
      selection_composition_mode: 'THIN_WEEK_REVIEW',
      editor_review_required: true,
      deterministic_selected_count: 5,
      rendered_main_article_count: 3,
      reserve_candidate_count: 2,
      direct_aosp_camera_count: 1,
      camera_driver_image_pipeline_count: 1,
      android_platform_camera_adjacent_count: 0,
      soc_platform_signal_count: 1,
      cpp_ai_tooling_fallback_count: 0,
      generic_tech_watchlist_count: 0,
      composition_reason: 'Only 3 main article candidates are available.',
      underfilled: true,
      selected_article_count: 3,
      final_selected_article_count: 3,
      input_candidate_count: 20,
      eligible_candidate_count: 3,
      final_exclusion_reason_summary: [
        { reason: 'missing dated evidence', count: 7 }
      ],
      stale_claim_status: 'PASS',
      stale_claim_removed_count: 1,
      stale_claim_hard_failure_count: 0,
      source_gap_count: 0
    }
  });

  assert.match(body, /Quality score: 90/);
  assert.match(body, /Quality threshold: 85/);
  assert.match(body, /Quality status: NEEDS_FIX/);
  assert.match(body, /Result: NEEDS_FIX/);
  assert.match(body, /Must-fix summary: must_fix=0; source_gap=0/);
  assert.match(body, /Stale claim status: PASS/);
  assert.match(body, /Stale claim summary: removed=1; hard_failures=0/);
  assert.match(body, /Recommended editor action:/);
  assert.match(body, /## Composition Summary/);
  assert.match(body, /composition_mode: THIN_WEEK_REVIEW/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /editor_review_required: true/);
  assert.match(body, /direct_aosp_camera count: 1/);
  assert.match(body, /deterministic_selected_count: 5/);
  assert.match(body, /rendered_main_article_count: 3/);
  assert.match(body, /reserve_candidate_count: 2/);
  assert.match(body, /Thin-week review path/);
  assert.match(body, /Only 3 publishable articles were selected; expected at least 4\./);
  assert.doesNotMatch(body, /90\/85/);
});

test('newsroom PR body marks fallback composition explicitly', () => {
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'success',
    status: {
      status: 'PASS',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      quality_status: 'PASS',
      quality_score: 91,
      quality_threshold: 85,
      publish_ready: true,
      selection_publish_ready: true,
      final_publish_ready: true,
      editor_review_required: true,
      underfilled: false,
      composition_mode: 'FALLBACK_COMPOSITION',
      selection_composition_mode: 'FALLBACK_COMPOSITION',
      direct_aosp_camera_count: 1,
      camera_driver_image_pipeline_count: 0,
      android_platform_camera_adjacent_count: 0,
      soc_platform_signal_count: 2,
      cpp_ai_tooling_fallback_count: 1,
      generic_tech_watchlist_count: 0,
      composition_reason: 'Primary AOSP Camera/driver/platform-adjacent candidates were below the normal target.',
      deterministic_selected_count: 4,
      rendered_main_article_count: 4,
      reserve_candidate_count: 5,
      selected_article_count: 4,
      final_selected_article_count: 4,
      stale_claim_status: 'PASS',
      stale_claim_removed_count: 0,
      stale_claim_hard_failure_count: 0
    }
  });

  assert.match(body, /composition_mode: FALLBACK_COMPOSITION/);
  assert.match(body, /soc_platform_signal count: 2/);
  assert.match(body, /cpp_ai_tooling_fallback count: 1/);
  assert.match(body, /Fallback composition:/);
  assert.match(body, /Do not add artificial Camera HAL wording/);
});

test('weekly newsroom workflow separates review PR success from publish-ready gate', () => {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', '01-weekly-newsroom-pr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const doctorStepIndex = workflow.indexOf('- name: Doctor runtime config');
  const preflightStepIndex = workflow.indexOf('- name: Run unit and regression tests');
  const jitterStepIndex = workflow.indexOf('- name: Jitter scheduled run');
  const nextStepIndex = workflow.indexOf('\n      - name:', preflightStepIndex + 1);
  const preflightStep = workflow.slice(
    preflightStepIndex,
    nextStepIndex === -1 ? undefined : nextStepIndex
  );

  assert.notEqual(doctorStepIndex, -1);
  assert.notEqual(preflightStepIndex, -1);
  assert.notEqual(jitterStepIndex, -1);
  assert.ok(doctorStepIndex < preflightStepIndex);
  assert.ok(preflightStepIndex < jitterStepIndex);
  assert.match(preflightStep, /^\s*run: npm run test$/m);
  assert.doesNotMatch(preflightStep, /continue-on-error:\s*true/);
  assert.match(workflow, /uses: actions\/cache\/restore@v4/);
  assert.match(workflow, /key: news-summary-\$\{\{ runner\.os \}\}-/);
  assert.match(workflow, /uses: actions\/cache\/save@v4/);
  assert.match(workflow, /if: always\(\) && steps\.summary-cache\.outputs\.exists == 'true'/);
  assert.match(workflow, /newsletter/);
  assert.match(workflow, /aosp-camera/);
  assert.match(workflow, /editor-review/);
  assert.match(workflow, /needs-fix/);
  assert.match(workflow, /fallback-composition/);
  assert.match(workflow, /thin-week/);
  assert.match(workflow, /publish-ready/);
  assert.match(workflow, /const stateLabels = \['publish-ready', 'needs-fix', 'fallback-composition', 'thin-week'\];/);
  assert.match(workflow, /github\.rest\.issues\.removeLabel/);
  assert.match(workflow, /const finalPublishReady = '\$\{\{ steps\.generation-status\.outputs\.final_publish_ready \}\}' === 'true';/);
  assert.match(workflow, /compositionMode === 'FALLBACK_COMPOSITION'/);
  assert.match(workflow, /compositionMode === 'THIN_WEEK_REVIEW'/);
  assert.match(workflow, /Fail if reviewable newsroom artifacts were not created/);
  assert.doesNotMatch(workflow, /final_publish_ready != 'true'/);
  assert.doesNotMatch(workflow, /fromJSON\(steps\.generation-status\.outputs\.final_selected_article_count_for_gate\) < 4/);
});
