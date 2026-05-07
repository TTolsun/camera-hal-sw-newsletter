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
const {
  articlePolicy,
  qualityGatePolicy,
  publishGateCriteriaText
} = require('../scripts/lib/newsletter-policy');

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
  assert.equal(outputs.review_gate_passed, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
});

test('generation status output includes multiline selection diagnostics', () => {
  const configuredMinimum = articlePolicy.mainArticleCount.min;
  const requiredPrimary = articlePolicy.primaryCameraStack.minRequired;
  const outputs = buildGenerationStatusOutputs({
    status: 'QUALITY_NEEDS_FIX',
    must_fix_count: 0,
    quality_status: 'NEEDS_FIX',
    quality_score: 90,
    quality_threshold: qualityGatePolicy.threshold,
    publish_ready: false,
    final_publish_ready: false,
    review_gate_passed: true,
    publish_gate_passed: false,
    min_final_articles: configuredMinimum,
    absolute_min_reviewable_articles: requiredPrimary,
    min_non_fallback_publish_ready_articles: configuredMinimum,
    composition_mode: 'NEEDS_FIX',
    editor_review_required: true,
    underfilled: true,
    deterministic_selected_count: 5,
    rendered_main_article_count: configuredMinimum,
    reserve_candidate_count: 4,
    stale_claim_status: 'PASS',
    stale_claim_removed_count: 2,
    stale_claim_hard_failure_count: 0,
    selected_article_count: configuredMinimum,
    final_selected_article_count: configuredMinimum,
    primary_camera_stack_topic_count: 0,
    supporting_main_article_count: configuredMinimum,
    forbidden_main_article_count: 0,
    non_fallback_reviewable_article_count: 1,
    eligible_non_fallback_reviewable_article_count: 1,
    selection_warnings: ['Newsletter Policy review path'],
    selection_shortage_hints: ['Add at least one Primary Camera Stack candidate before publishing.'],
    final_exclusion_reason_summary: [
      { reason: 'missing dated evidence', count: 4 },
      { reason: 'source_gap_risk=true', count: 2 }
    ]
  });
  const rendered = renderGithubOutputs(outputs);

  assert.equal(outputs.final_selected_article_count_for_gate, String(configuredMinimum));
  assert.equal(outputs.composition_mode, 'NEEDS_FIX');
  assert.equal(outputs.editor_review_required, 'true');
  assert.equal(outputs.deterministic_selected_count, '5');
  assert.equal(outputs.rendered_main_article_count, String(configuredMinimum));
  assert.equal(outputs.reserve_candidate_count, '4');
  assert.equal(outputs.stale_claim_status, 'PASS');
  assert.equal(outputs.stale_claim_removed_count, '2');
  assert.equal(outputs.stale_claim_hard_failure_count, '0');
  assert.equal(outputs.non_fallback_reviewable_article_count, '1');
  assert.equal(outputs.eligible_non_fallback_reviewable_article_count, '1');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.publish_gate_passed, 'false');
  assert.equal(outputs.min_final_articles, String(configuredMinimum));
  assert.equal(outputs.absolute_min_reviewable_articles, String(requiredPrimary));
  assert.equal(outputs.min_non_fallback_publish_ready_articles, String(configuredMinimum));
  assert.equal(outputs.primary_camera_stack_topic_count, '0');
  assert.equal(outputs.supporting_main_article_count, String(configuredMinimum));
  assert.equal(outputs.forbidden_main_article_count, '0');
  assert.match(rendered, /candidate_selection_diagnostics<<EOF/);
  assert.match(rendered, /missing dated evidence \(4\)/);
  assert.match(rendered, /selection_warnings=Newsletter Policy review path/);
  assert.match(rendered, /selection_shortage_hints=Add at least one Primary Camera Stack candidate before publishing\./);
});

test('newsroom PR body separates quality score threshold and result', () => {
  const configuredMinimum = articlePolicy.mainArticleCount.min;
  const selectedBelowMinimum = configuredMinimum - 1;
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'failure',
    status: {
      status: 'QUALITY_NEEDS_FIX',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      quality_status: 'NEEDS_FIX',
      quality_score: 90,
      quality_threshold: qualityGatePolicy.threshold,
      publish_ready: false,
      selection_publish_ready: false,
      final_publish_ready: false,
      review_gate_passed: true,
      publish_gate_passed: false,
      min_final_articles: configuredMinimum,
      absolute_min_reviewable_articles: articlePolicy.primaryCameraStack.minRequired,
      min_non_fallback_publish_ready_articles: configuredMinimum,
      composition_mode: 'NEEDS_FIX',
      selection_composition_mode: 'NEEDS_FIX',
      editor_review_required: true,
      deterministic_selected_count: 5,
      rendered_main_article_count: selectedBelowMinimum,
      reserve_candidate_count: 2,
      direct_aosp_camera_count: 1,
      camera_driver_image_pipeline_count: 1,
      android_platform_camera_adjacent_count: 0,
      soc_platform_signal_count: 1,
      cpp_ai_tooling_fallback_count: 0,
      generic_tech_watchlist_count: 0,
      primary_camera_stack_topic_count: 1,
      supporting_main_article_count: selectedBelowMinimum,
      forbidden_main_article_count: 0,
      composition_reason: 'Deterministic selection needs editor review before publishing.',
      underfilled: true,
      selected_article_count: selectedBelowMinimum,
      final_selected_article_count: selectedBelowMinimum,
      input_candidate_count: 20,
      eligible_candidate_count: selectedBelowMinimum,
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
  assert.match(body, new RegExp(`Quality threshold: ${qualityGatePolicy.threshold}`));
  assert.match(body, /Quality status: NEEDS_FIX/);
  assert.match(body, /Result: NEEDS_FIX/);
  assert.match(body, /Must-fix summary: must_fix=0; source_gap=0/);
  assert.match(body, /Stale claim status: PASS/);
  assert.match(body, /Stale claim summary: removed=1; hard_failures=0/);
  assert.match(body, /Recommended editor action:/);
  assert.match(body, /## Composition Summary/);
  assert.match(body, /composition_mode: NEEDS_FIX/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /Review Gate: true \(Newsletter Policy selection checks\)/);
  assert.match(body, new RegExp(`Publish Gate: false \\(${publishGateCriteriaText().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}; quality/fact-check/site validation pass\\)`));
  assert.match(body, /editor_review_required: true/);
  assert.match(body, /review_gate_passed: true/);
  assert.match(body, /publish_gate_passed: false/);
  assert.match(body, /direct_aosp_camera count: 1/);
  assert.match(body, /deterministic_selected_count: 5/);
  assert.match(body, new RegExp(`rendered_main_article_count: ${selectedBelowMinimum}`));
  assert.match(body, /reserve_candidate_count: 2/);
  assert.match(body, /Underfilled selection path: true/);
  assert.match(body, new RegExp(`Only ${selectedBelowMinimum} publishable articles were selected; expected at least ${configuredMinimum}\\.`));
  assert.doesNotMatch(body, new RegExp(`90/${qualityGatePolicy.threshold}`));
});

test('newsroom PR body marks fallback composition explicitly', () => {
  const configuredSelectedCount = Math.min(
    articlePolicy.mainArticleCount.max,
    articlePolicy.mainArticleCount.min + articlePolicy.primaryCameraStack.minRequired
  );
  const configuredSupportingCount = configuredSelectedCount - articlePolicy.primaryCameraStack.minRequired;
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'success',
    status: {
      status: 'PASS',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      quality_status: 'PASS',
      quality_score: 91,
      quality_threshold: qualityGatePolicy.threshold,
      publish_ready: true,
      selection_publish_ready: true,
      final_publish_ready: true,
      review_gate_passed: true,
      publish_gate_passed: true,
      min_final_articles: articlePolicy.mainArticleCount.min,
      absolute_min_reviewable_articles: articlePolicy.primaryCameraStack.minRequired,
      min_non_fallback_publish_ready_articles: articlePolicy.mainArticleCount.min,
      editor_review_required: true,
      underfilled: false,
      composition_mode: 'FALLBACK_COMPOSITION',
      selection_composition_mode: 'FALLBACK_COMPOSITION',
      direct_aosp_camera_count: 1,
      camera_driver_image_pipeline_count: 0,
      android_platform_camera_adjacent_count: 0,
      soc_platform_signal_count: configuredSupportingCount,
      cpp_ai_tooling_fallback_count: 0,
      generic_tech_watchlist_count: 0,
      primary_camera_stack_topic_count: articlePolicy.primaryCameraStack.minRequired,
      supporting_main_article_count: configuredSupportingCount,
      forbidden_main_article_count: 0,
      composition_reason: 'Primary AOSP Camera/driver/platform-adjacent candidates were below the normal target.',
      deterministic_selected_count: configuredSelectedCount,
      rendered_main_article_count: configuredSelectedCount,
      reserve_candidate_count: 5,
      selected_article_count: configuredSelectedCount,
      final_selected_article_count: configuredSelectedCount,
      stale_claim_status: 'PASS',
      stale_claim_removed_count: 0,
      stale_claim_hard_failure_count: 0
    }
  });

  assert.match(body, /composition_mode: FALLBACK_COMPOSITION/);
  assert.match(body, new RegExp(`soc_platform_signal count: ${configuredSupportingCount}`));
  assert.match(body, /cpp_ai_tooling_fallback count: 0/);
  assert.match(body, /Fallback composition:/);
  assert.match(body, /Do not add artificial Camera HAL wording/);
});

test('newsroom PR body explains review-only fallback when publish gate is blocked', () => {
  const configuredMinimum = articlePolicy.mainArticleCount.min;
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'success',
    status: {
      status: 'PASS',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      quality_status: 'PASS',
      quality_score: 91,
      quality_threshold: qualityGatePolicy.threshold,
      publish_ready: false,
      selection_publish_ready: false,
      final_publish_ready: false,
      review_gate_passed: true,
      publish_gate_passed: false,
      min_final_articles: configuredMinimum,
      absolute_min_reviewable_articles: articlePolicy.primaryCameraStack.minRequired,
      min_non_fallback_publish_ready_articles: configuredMinimum,
      editor_review_required: true,
      underfilled: false,
      composition_mode: 'NEEDS_FIX',
      selection_composition_mode: 'FALLBACK_COMPOSITION',
      direct_aosp_camera_count: 0,
      camera_driver_image_pipeline_count: 0,
      android_platform_camera_adjacent_count: 0,
      soc_platform_signal_count: 0,
      cpp_ai_tooling_fallback_count: configuredMinimum,
      generic_tech_watchlist_count: 0,
      primary_camera_stack_topic_count: 0,
      supporting_main_article_count: configuredMinimum,
      forbidden_main_article_count: 0,
      non_fallback_reviewable_article_count: 0,
      composition_reason: 'Review Gate passed, but Publish Gate requires configured Primary Camera Stack coverage.',
      deterministic_selected_count: configuredMinimum,
      rendered_main_article_count: configuredMinimum,
      reserve_candidate_count: 5,
      selected_article_count: configuredMinimum,
      final_selected_article_count: configuredMinimum,
      stale_claim_status: 'PASS',
      stale_claim_removed_count: 0,
      stale_claim_hard_failure_count: 0
    }
  });

  assert.match(body, /Recommended editor action: Use this as an editor-review PR only; satisfy the configured Newsletter Policy before publishing\./);
  assert.match(body, /composition_mode: NEEDS_FIX/);
  assert.match(body, /selection_composition_mode: FALLBACK_COMPOSITION/);
  assert.match(body, /Review Gate passed, but Publish Gate is still blocked/);
});

test('weekly newsroom workflow separates review PR success from publish-ready gate', () => {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', '01-weekly-newsroom-pr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const manualOverrideStepIndex = workflow.indexOf('- name: Apply manual LLM overrides');
  const doctorStepIndex = workflow.indexOf('- name: Doctor runtime config');
  const validatePolicyStepIndex = workflow.indexOf('- name: Validate newsletter policy');
  const checkPolicyDocsStepIndex = workflow.indexOf('- name: Check policy docs');
  const preflightStepIndex = workflow.indexOf('- name: Run unit and regression tests');
  const jitterStepIndex = workflow.indexOf('- name: Jitter scheduled run');
  const validatePolicyNextStepIndex = workflow.indexOf('\n      - name:', validatePolicyStepIndex + 1);
  const validatePolicyStep = workflow.slice(
    validatePolicyStepIndex,
    validatePolicyNextStepIndex === -1 ? undefined : validatePolicyNextStepIndex
  );
  const checkPolicyDocsNextStepIndex = workflow.indexOf('\n      - name:', checkPolicyDocsStepIndex + 1);
  const checkPolicyDocsStep = workflow.slice(
    checkPolicyDocsStepIndex,
    checkPolicyDocsNextStepIndex === -1 ? undefined : checkPolicyDocsNextStepIndex
  );
  const nextStepIndex = workflow.indexOf('\n      - name:', preflightStepIndex + 1);
  const preflightStep = workflow.slice(
    preflightStepIndex,
    nextStepIndex === -1 ? undefined : nextStepIndex
  );

  assert.notEqual(manualOverrideStepIndex, -1);
  assert.notEqual(doctorStepIndex, -1);
  assert.notEqual(validatePolicyStepIndex, -1);
  assert.notEqual(checkPolicyDocsStepIndex, -1);
  assert.notEqual(preflightStepIndex, -1);
  assert.notEqual(jitterStepIndex, -1);
  assert.ok(manualOverrideStepIndex < doctorStepIndex);
  assert.ok(doctorStepIndex < validatePolicyStepIndex);
  assert.ok(validatePolicyStepIndex < checkPolicyDocsStepIndex);
  assert.ok(checkPolicyDocsStepIndex < preflightStepIndex);
  assert.ok(preflightStepIndex < jitterStepIndex);
  assert.match(workflow, /llm_provider:/);
  assert.match(workflow, /llm_model:/);
  assert.match(workflow, /llm_fallback_models:/);
  assert.match(workflow, /LLM_PROVIDER=\$\{INPUT_LLM_PROVIDER\}/);
  assert.match(workflow, /LLM_MODEL=\$\{INPUT_LLM_MODEL\}/);
  assert.match(workflow, /LLM_FALLBACK_MODELS=\$\{INPUT_LLM_FALLBACK_MODELS\}/);
  assert.match(workflow, /LLM override inputs must be single-line values\./);
  assert.match(workflow, /NEWSROOM_ALLOW_PRO_ON_MANUAL: \$\{\{ github\.event\.inputs\.allow_pro \|\| 'false' \}\}/);
  assert.doesNotMatch(workflow, /LLM_FALLBACK_MODELS=gemini-2\.5-flash-lite,gemini-2\.5-pro/);
  assert.doesNotMatch(workflow, /\[ "\$\{INPUT_LLM_PROVIDER\}" = "gemini" \]/);
  assert.match(workflow, /INTERNAL_LLM_API_KEY: \$\{\{ secrets\.INTERNAL_LLM_API_KEY \}\}/);
  assert.match(workflow, /INTERNAL_LLM_ENDPOINT: \$\{\{ vars\.INTERNAL_LLM_ENDPOINT \}\}/);
  assert.doesNotMatch(workflow, /vars\.LLM_PROVIDER/);
  assert.doesNotMatch(workflow, /vars\.LLM_MODEL/);
  assert.doesNotMatch(workflow, /vars\.LLM_FALLBACK_MODELS/);
  assert.doesNotMatch(workflow, /GEMINI_MODEL: \$\{\{ vars\.GEMINI_MODEL/);
  assert.doesNotMatch(workflow, /GEMINI_FALLBACK_MODELS: \$\{\{ vars\.GEMINI_FALLBACK_MODELS/);
  assert.match(validatePolicyStep, /^\s*run: npm run validate:policy$/m);
  assert.doesNotMatch(validatePolicyStep, /continue-on-error:\s*true/);
  assert.match(checkPolicyDocsStep, /^\s*run: npm run check:policy-docs$/m);
  assert.doesNotMatch(checkPolicyDocsStep, /continue-on-error:\s*true/);
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
  assert.doesNotMatch(
    workflow,
    new RegExp(`fromJSON\\(steps\\.generation-status\\.outputs\\.final_selected_article_count_for_gate\\) < ${articlePolicy.mainArticleCount.min}`)
  );
});
