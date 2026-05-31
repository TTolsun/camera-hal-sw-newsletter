'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertTextInOrder,
  workflowRunCommands,
  workflowStep
} = require('../helpers/workflow-yaml');
const {
  articlePolicy
} = require('../../scripts/newsroom/common/newsletter-policy');

test('final newsroom workflow separates review PR success from publish-ready gate', () => {
  const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', '03-newsroom-final-pr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const validatePolicyStep = workflowStep(workflow, 'Validate newsletter policy');
  const checkPolicyDocsStep = workflowStep(workflow, 'Check policy docs');
  const doctorStep = workflowStep(workflow, 'Doctor runtime config');
  const preflightStep = workflowStep(workflow, 'Run unit and regression tests');
  const generateStep = workflowStep(workflow, 'Generate newsletter with approved candidate artifact');
  const ensurePublicStep = workflowStep(workflow, 'Ensure public newsletter artifacts');
  const resolveMetaStep = workflowStep(workflow, 'Resolve newsletter metadata');
  const validateGeneratedSiteStep = workflowStep(workflow, 'Validate generated site');
  const resolveFinalStatusStep = workflowStep(workflow, 'Resolve final publish status');
  const sourceEffectivenessStep = workflowStep(workflow, 'Generate source effectiveness report');
  const sourceQualityDiagnosisStep = workflowStep(workflow, 'Generate source quality diagnosis');
  const evidencePackStep = workflowStep(workflow, 'Generate evidence pack summary');
  const halSignalQualityStep = workflowStep(workflow, 'Generate HAL signal quality report');
  const imageAuditStep = workflowStep(workflow, 'Audit newsletter image lineage');
  const snapshotStep = workflowStep(workflow, 'Snapshot newsroom debug artifacts');
  const preparePrBodyStep = workflowStep(workflow, 'Prepare pull request body');
  const ensureLabelsStep = workflowStep(workflow, 'Ensure labels');
  const createPrStep = workflowStep(workflow, 'Create final newsletter pull request');
  const addLabelsStepIndex = workflow.indexOf('- name: Add pull request labels');

  assert.notEqual(addLabelsStepIndex, -1);
  assertTextInOrder(workflow, [
    '- name: Apply manual LLM overrides',
    '- name: Doctor runtime config',
    '- name: Validate newsletter policy',
    '- name: Check policy docs',
    '- name: Run unit and regression tests'
  ]);
  assertTextInOrder(workflow, [
    '- name: Generate newsletter with approved candidate artifact',
    '- name: Generate HAL signal quality report',
    '- name: Ensure public newsletter artifacts',
    '- name: Resolve newsletter metadata',
    '- name: Resolve final publish status',
    '- name: Prepare pull request body',
    '- name: Create final newsletter pull request'
  ]);
  assertTextInOrder(workflow, [
    '- name: Generate source effectiveness report',
    '- name: Generate source quality diagnosis',
    '- name: Generate evidence pack summary',
    '- name: Audit newsletter image lineage',
    '- name: Snapshot newsroom debug artifacts'
  ]);
  assert.match(workflow, /llm_provider:/);
  assert.match(workflow, /-\s+"openapi"/);
  assert.match(workflow, /llm_model:/);
  assert.match(workflow, /llm_fallback_models:/);
  assert.doesNotMatch(workflow, /allow_pro/);
  assert.match(workflow, /llm_model:\s*[\s\S]*?default: ""/);
  assert.match(workflow, /LLM_PROVIDER=\$\{INPUT_LLM_PROVIDER\}/);
  assert.match(workflow, /LLM_MODEL=\$\{INPUT_LLM_MODEL\}/);
  assert.match(workflow, /LLM_FALLBACK_MODELS=\$\{INPUT_LLM_FALLBACK_MODELS\}/);
  assert.match(workflow, /Workflow inputs must be single-line values\./);
  assert.doesNotMatch(workflow, /NEWSROOM_ALLOW_PRO_ON_MANUAL/);
  assert.doesNotMatch(workflow, /NEWSROOM_ALLOW_PRO_ON_SCHEDULE/);
  assert.doesNotMatch(workflow, /NEWSROOM_PRO_ESCALATION/);
  assert.match(workflow, /NEWSROOM_REPORTER_MODEL: \$\{\{ vars\.NEWSROOM_REPORTER_MODEL \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_EDITOR_MODEL: \$\{\{ vars\.NEWSROOM_EDITOR_MODEL \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_FACTCHECK_MODEL: \$\{\{ vars\.NEWSROOM_FACTCHECK_MODEL \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_REPAIR_MODEL: \$\{\{ vars\.NEWSROOM_REPAIR_MODEL \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_JUDGE_MODEL: \$\{\{ vars\.NEWSROOM_JUDGE_MODEL \|\| '' \}\}/);
  assert.match(workflow, /GEMINI_THINKING_BUDGET_JUDGE: \$\{\{ vars\.GEMINI_THINKING_BUDGET_JUDGE \|\| '0' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MODE: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MODE \|\| 'extract_only' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE \|\| '8' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN \|\| '40' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS \|\| '5000' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_BYTES: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_BYTES \|\| '200000' \}\}/);
  assert.doesNotMatch(workflow, /LLM_FALLBACK_MODELS=gemini-2\.5-flash-lite,gemini-2\.5-pro/);
  assert.doesNotMatch(workflow, /\[ "\$\{INPUT_LLM_PROVIDER\}" = "gemini" \]/);
  assert.match(workflow, /INTERNAL_LLM_API_KEY: \$\{\{ secrets\.INTERNAL_LLM_API_KEY \}\}/);
  assert.match(workflow, /INTERNAL_LLM_ENDPOINT: \$\{\{ vars\.INTERNAL_LLM_ENDPOINT \}\}/);
  assert.doesNotMatch(doctorStep, /--no-llm-credentials/);
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
  const workflowDocs = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'newsroom-workflow.md'), 'utf8');
  assert.doesNotMatch(workflowDocs, /^LLM_MODEL=$/m);
  assert.doesNotMatch(workflowDocs, /allow_pro=true/);
  assert.doesNotMatch(workflowDocs, /NEWSROOM_ALLOW_PRO/);
  assert.doesNotMatch(workflowDocs, /NEWSROOM_PRO_ESCALATION/);
  assert.match(generateStep, /continue-on-error:\s*true/);
  assert.match(ensurePublicStep, /node scripts\/ensure-public-newsletter-artifacts\.js/);
  assert.match(resolveMetaStep, /node scripts\/resolve-reviewable-artifacts\.js >> "\$GITHUB_OUTPUT"/);
  assert.match(validateGeneratedSiteStep, /if: steps\.meta\.outputs\.public_newsletter_ready == 'true'/);
  assert.match(validateGeneratedSiteStep, /^\s*run: npm run validate:post-generation$/m);
  assert.doesNotMatch(validateGeneratedSiteStep, /npm run validate:quality/);
  assert.doesNotMatch(validateGeneratedSiteStep, /^\s*run: npm run validate$/m);
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['validate:post-generation'], /validate:llm-publication-quality/);
  assert.doesNotMatch(packageJson.scripts['validate:post-generation'], /validate:quality/);
  assert.match(workflow, /newsletter/);
  assert.match(workflow, /aosp-camera/);
  assert.match(workflow, /editor-review/);
  assert.match(workflow, /needs-fix/);
  assert.match(workflow, /fallback-composition/);
  assert.match(workflow, /thin-week/);
  assert.match(workflow, /publish-ready/);
  assert.match(workflow, /review-only/);
  assert.match(workflow, /review-only-publication/);
  assert.match(workflow, /diagnostics-only/);
  assert.match(workflow, /failed-repair-reviewable/);
  assert.match(workflow, /const stateLabels = \[/);
  assert.match(workflow, /'review-only'/);
  assert.match(workflow, /'review-only-publication'/);
  assert.match(workflow, /'diagnostics-only'/);
  assert.match(workflow, /'failed-repair-reviewable'/);
  assert.match(workflow, /github\.rest\.issues\.removeLabel/);
  assert.match(workflow, /- name: Resolve final publish status/);
  assert.match(workflow, /id: final-publish-status/);
  assert.match(workflow, /node scripts\/write-publish-status-output\.js >> "\$GITHUB_OUTPUT"/);
  assert.match(resolveFinalStatusStep, /if: steps\.meta\.outputs\.public_newsletter_ready == 'true'/);
  assert.match(resolveFinalStatusStep, /VALIDATE_OUTCOME: \$\{\{ steps\.validate\.outcome \|\| 'skipped' \}\}/);
  assert.match(sourceEffectivenessStep, /if: always\(\) && steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(sourceEffectivenessStep, /continue-on-error:\s*true/);
  assert.match(sourceQualityDiagnosisStep, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  assert.match(sourceQualityDiagnosisStep, /continue-on-error:\s*true/);
  assert.match(sourceQualityDiagnosisStep, /npm run report:source-quality-diagnosis -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"/);
  assert.match(evidencePackStep, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  assert.match(evidencePackStep, /continue-on-error:\s*true/);
  assert.match(evidencePackStep, /npm run report:evidence-pack -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"/);
  assert.match(halSignalQualityStep, /if: always\(\) && steps\.resolve-newsletter-date\.outputs\.date != ''/);
  assert.match(halSignalQualityStep, /continue-on-error:\s*true/);
  assert.match(halSignalQualityStep, /npm run report:hal-signal-quality -- --date "\$\{\{ steps\.resolve-newsletter-date\.outputs\.date \}\}"/);
  assert.match(imageAuditStep, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  assert.doesNotMatch(imageAuditStep, /continue-on-error:\s*true/);
  assert.match(imageAuditStep, /steps\.meta\.outputs\.public_newsletter_ready/);
  assert.match(
    imageAuditStep,
    /npm run newsroom:audit-images -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}" --fail-on-publish-blocking/
  );
  assert.match(
    imageAuditStep,
    /npm run newsroom:audit-images -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"\s*$/m
  );
  assert.match(snapshotStep, /copy_tree_if_present "content\/source-events\/\$\{DATE\}"/);
  assert.match(snapshotStep, /copy_tree_if_present "content\/newsroom\/\$\{DATE\}"/);
  assert.match(snapshotStep, /copy_tree_if_present "data\/source-snapshots"/);
  assert.match(snapshotStep, /copy_if_present "newsletters\/\$\{DATE\}\/newsletter\.md"/);
  assert.match(snapshotStep, /copy_if_present "newsletters\/\$\{DATE\}\/index\.html"/);
  assert.match(snapshotStep, /copy_if_present "data\/homepage-headline\.json"/);
  assert.match(snapshotStep, /copy_if_present "data\/article-exposure-history\.json"/);
  assert.match(preparePrBodyStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(ensureLabelsStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(createPrStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(createPrStep, /base: main/);
  assert.match(preparePrBodyStep, /VALIDATE_OUTCOME: \$\{\{ steps\.validate\.outcome \|\| 'skipped' \}\}/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_FIGMA_URL: https:\/\/www\.figma\.com\/design\/EWJMa8vjfZLjdn9a7s3Kzs/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_DESKTOP_COVERAGE: covered/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_MOBILE_COVERAGE: covered/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION: none/);
  assert.match(workflow, /node scripts\/build-newsroom-pr-body\.js > \.tmp\/newsroom-pr-body\.md/);
  assert.match(workflow, /node scripts\/validate-pr-body\.js \.tmp\/newsroom-pr-body\.md --type newsletter --date "\$\{\{ steps\.meta\.outputs\.date \}\}" --require-publish-status-consistency/);
  assert.match(workflow, /cat \.tmp\/newsroom-pr-body\.md/);
  assert.match(workflow, /const hasAiPublishReady = '\$\{\{ steps\.final-publish-status\.outputs\.has_ai_publish_ready \}\}' === 'true';/);
  assert.match(workflow, /const diagnosticsOnly = '\$\{\{ steps\.meta\.outputs\.diagnostics_only \}\}' === 'true';/);
  assert.match(workflow, /const reviewPublicationReady = '\$\{\{ steps\.meta\.outputs\.review_publication_ready \}\}' === 'true';/);
  assert.match(workflow, /const compositionMode = '\$\{\{ steps\.final-publish-status\.outputs\.composition_mode \}\}';/);
  assert.doesNotMatch(workflow, /steps\.meta\.outputs\.has_publish_candidate/);
  assert.doesNotMatch(workflow, /if: steps\.meta\.outputs\.has_reviewable_artifacts == 'true'/);
  assert.doesNotMatch(workflow.slice(addLabelsStepIndex), /steps\.generation-status\.outputs\.final_publish_ready/);
  assert.doesNotMatch(workflow.slice(addLabelsStepIndex), /validationPassed/);
  assert.match(workflow, /compositionMode === 'FALLBACK_COMPOSITION' && !hasAiPublishReady/);
  assert.match(workflow, /compositionMode === 'THIN_WEEK_REVIEW'/);
  assert.match(workflow, /labels\.push\('needs-fix', 'editor-review', 'review-only', 'review-only-publication'\)/);
  assert.match(workflow, /labels\.push\('needs-fix', 'editor-review', 'review-only', 'diagnostics-only'\)/);
  assert.doesNotMatch(workflow, /labels\.push\([^)]*review-only-publication[^)]*diagnostics-only/);
  assert.match(workflow, /Fail if no reviewable PR can be created/);
  assert.match(workflow, /steps\.meta\.outputs\.review_pr_ready != 'true'/);
  assert.doesNotMatch(workflow, /final_publish_ready != 'true'/);
  assert.doesNotMatch(
    workflow,
    new RegExp(`fromJSON\\(steps\\.generation-status\\.outputs\\.final_selected_article_count_for_gate\\) < ${articlePolicy.mainArticleCount.min}`)
  );
});

test('final newsroom workflow labels review publication and diagnostics-only mutually exclusively', () => {
  const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', '03-newsroom-final-pr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const labelStep = workflowStep(workflow, 'Add pull request labels');
  const reviewPublicationStart = labelStep.indexOf('} else if (reviewPublicationReady) {');
  const diagnosticsStart = labelStep.indexOf('} else if (diagnosticsOnly) {');
  const fallbackStart = labelStep.indexOf('} else {', diagnosticsStart);

  assert.notEqual(reviewPublicationStart, -1);
  assert.notEqual(diagnosticsStart, -1);
  assert.notEqual(fallbackStart, -1);
  assert.match(labelStep, /const stateLabels = \[[^\n]*'review-only-publication'[^\n]*'diagnostics-only'[^\n]*\]/);

  const reviewPublicationBranch = labelStep.slice(reviewPublicationStart, diagnosticsStart);
  const diagnosticsBranch = labelStep.slice(diagnosticsStart, fallbackStart);

  assert.match(reviewPublicationBranch, /labels\.push\('needs-fix', 'editor-review', 'review-only', 'review-only-publication'\)/);
  assert.doesNotMatch(reviewPublicationBranch, /diagnostics-only/);
  assert.match(diagnosticsBranch, /labels\.push\('needs-fix', 'editor-review', 'review-only', 'diagnostics-only'\)/);
  assert.doesNotMatch(diagnosticsBranch, /review-only-publication/);
  assert.match(labelStep, /compositionMode === 'FALLBACK_COMPOSITION' && !hasAiPublishReady/);
});

// Cross-stage contract. Reads all three workflow YAMLs.
test('split newsroom workflows preserve #88 stage boundaries', () => {
  const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  const stage1 = fs.readFileSync(path.join(workflowDir, '01-newsroom-manual-source-collect-pr.yml'), 'utf8');
  const stage2 = fs.readFileSync(path.join(workflowDir, '02-newsroom-gemini-source-discovery-pr.yml'), 'utf8');
  const stage3 = fs.readFileSync(path.join(workflowDir, '03-newsroom-final-pr.yml'), 'utf8');
  const stage2RunStep = workflowStep(stage2, 'Run Gemini source discovery');
  const stage2PrepareBodyStep = workflowStep(stage2, 'Prepare source discovery pull request body');
  const stage2CreatePrStep = workflowStep(stage2, 'Create source discovery pull request');
  const stage2UploadStep = workflowStep(stage2, 'Upload source discovery debug artifacts');
  const rawPrBodyBuilder = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'build-raw-candidate-pr-body.js'),
    'utf8'
  );

  assert.match(stage1, /^name: Newsroom 01 - Manual Source Collection PR/m);
  assert.match(stage2, /^name: Newsroom 02 - Gemini Source Discovery PR/m);
  assert.match(stage3, /^name: Newsroom 03 - Gemini Final Newsletter PR/m);

  assert.match(stage1, /workflow_dispatch:/);
  assert.match(stage1, /manual_source_urls:/);
  assert.doesNotMatch(stage1, /collection_intent_path:/);
  assert.doesNotMatch(stage1, /llm_provider:/);
  assert.match(stage1, /NEWSROOM_MANUAL_SOURCE_URLS: \$\{\{ github\.event\.inputs\.manual_source_urls \}\}/);
  assert.match(stage1, /^\s*schedule:/m);
  assert.match(stage1, /cron: "0 0 \* \* \*"/);
  assert.match(stage1, /run: npm run doctor:config -- --no-llm-credentials/);
  assert.match(stage1, /run: npm run collect/);
  assert.doesNotMatch(stage1, /npm run generate/);
  assert.doesNotMatch(stage1, /GEMINI_API_KEY/);
  assert.doesNotMatch(stage1, /INTERNAL_LLM_API_KEY/);
  assert.match(stage1, /branch=newsroom-raw\/\$\{DATE\}/);
  assert.match(stage1, /manual-candidates\.json/);
  assert.match(stage1, /collection-intent\.json/);
  assert.match(stage1, /raw-candidate-manifest\.json/);
  assert.match(stage1, /content\/source-events\/\$\{\{ steps\.raw-meta\.outputs\.date \}\}\/source-change-events\.json/);
  assert.match(stage1, /content\/source-events\/\$\{\{ steps\.raw-meta\.outputs\.date \}\}\/source-change-events\.md/);
  assert.match(stage1, /data\/source-snapshots\/\*\*/);

  assert.match(stage2, /NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY:\s*"true"/);
  assert.doesNotMatch(stage2, /enable_gemini_source_discovery:/);
  assert.match(stage2, /llm_provider:/);
  assert.match(stage2, /-\s+"openapi"/);
  assert.match(stage2, /llm_model:/);
  assert.match(stage2, /LLM_PROVIDER: \$\{\{ github\.event\.inputs\.llm_provider \|\| 'default' \}\}/);
  assert.match(stage2, /- name: Apply manual LLM overrides/);
  assert.match(stage2, /INPUT_LLM_MODEL: \$\{\{ github\.event\.inputs\.llm_model \}\}/);
  assert.ok(stage2.indexOf('- name: Apply manual LLM overrides') <
    stage2.indexOf('- name: Run Gemini source discovery'));
  assert.doesNotMatch(stage2, /vars\.LLM_PROVIDER/);
  assert.doesNotMatch(stage2, /vars\.LLM_MODEL/);
  assert.doesNotMatch(stage2, /vars\.LLM_FALLBACK_MODELS/);
  assert.doesNotMatch(stage2, /Preflight LLM credentials for enabled source discovery/);
  assert.doesNotMatch(stage2, /--preflight-only/);
  assert.doesNotMatch(stage2, /npm run doctor:config/);
  assert.ok(stage2.indexOf('- name: Run Gemini source discovery') <
    stage2.indexOf('- name: Prepare source discovery pull request body'));
  assert.ok(stage2.indexOf('- name: Prepare source discovery pull request body') <
    stage2.indexOf('- name: Upload source discovery debug artifacts'));
  assert.ok(stage2.indexOf('- name: Upload source discovery debug artifacts') <
    stage2.indexOf('- name: Create source discovery pull request'));
  assert.doesNotMatch(stage2CreatePrStep, /if:\s*always\(\)/);
  assert.match(stage2PrepareBodyStep, /gemini-source-discovery-report\.md/);
  assert.match(stage2UploadStep, /if:\s*always\(\)/);
  assert.match(stage2UploadStep, /uses:\s*actions\/upload-artifact@v4/);
  assert.match(stage2UploadStep, /if-no-files-found:\s*warn/);
  assert.match(stage2UploadStep, /merged-candidate-manifest\.json/);
  assert.match(stage2UploadStep, /gemini-source-discovery-report\.md/);
  assert.match(stage2UploadStep, /seed-candidates\.json/);
  assert.match(stage2UploadStep, /seed-evidence-pack\.json/);
  assert.match(stage2UploadStep, /seed-fetch-report\.json/);
  assert.match(stage2UploadStep, /seed-merge-report\.md/);
  assert.match(stage2, /node scripts\/gemini-source-discovery-boundary\.js --date/);
  assert.doesNotMatch(stage2RunStep, /--preflight-only/);
  assert.match(stage2, /gemini-source-discovery-report\.md/);
  assert.match(stage2, /gemini-source-proposals\.json/);
  assert.match(stage2, /gemini-source-proposal-validation-report\.json/);
  assert.match(stage2, /gemini-usage-report\.json/);
  assert.match(stage2, /source-quality-report\.json/);
  assert.match(stage2, /source-clusters\.json/);
  assert.match(stage2, /evidence-validation-report\.json/);
  assert.match(stage2UploadStep, /source-discovery-feedback-report\.json/);
  assert.match(stage2UploadStep, /source-discovery-feedback-report\.md/);
  assert.match(stage2, /gemini-candidates\.json/);
  assert.match(stage2, /merged-candidates\.json/);
  assert.match(stage2, /merged-candidate-manifest\.json/);

  assert.match(stage3, /NEWSROOM_CANDIDATE_INPUT_MODE: artifact/);
  assert.match(stage3, /llm_provider:/);
  assert.match(stage3, /-\s+"openapi"/);
  assert.match(stage3, /NEWSROOM_CANDIDATE_INPUT_PATH:\s*""/);
  assert.doesNotMatch(stage3, /candidate_input_path:/);
  assert.match(stage3, /run: npm run generate/);
  assert.doesNotMatch(stage3, /--no-llm-credentials/);
  assert.doesNotMatch(stage3, /npm run collect/);
  assert.match(stage3, /branch: newsroom-final\/\$\{\{ steps\.meta\.outputs\.date \}\}/);
  assert.match(stage3, /base: main/);
  assert.match(stage3, /manual-candidates\.json/);
  assert.match(stage3, /merged-candidates\.json/);
  assert.match(stage3, /collection-intent\.json/);
  assert.match(stage3, /seed-candidates\.json/);
  assert.match(stage3, /seed-evidence-pack\.json/);
  assert.doesNotMatch(rawPrBodyBuilder, /source_gap_risk_count/);
  assert.doesNotMatch(rawPrBodyBuilder, /Priority Override \/ Legacy Compatibility/);
});

test('generation path guards public artifacts for editorial reviewable failures', () => {
  const generatorPath = path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js');
  const generator = fs.readFileSync(generatorPath, 'utf8');
  const renderedMarkdownIndex = generator.indexOf('const newsletterMarkdown = buildMarkdown(editor);');
  const structuralGuardIndex = generator.indexOf('assertTerminalPublicationContracts({', renderedMarkdownIndex);
  const generationStatusIndex = generator.indexOf("let generationStatus = 'PASS';");
  const factCheckNeedsFixIndex = generator.indexOf("factCheck.status === 'NEEDS_FIX' && mustFixCount > 0", generationStatusIndex);
  const qualityNeedsFixIndex = generator.indexOf("qualityReport.status !== 'PASS'", generationStatusIndex);
  const editorialReviewableIndex = generator.indexOf(
    'const editorialReviewable = isEditorialReviewableStatus(generationStatus);',
    qualityNeedsFixIndex
  );
  const shouldWriteIndex = generator.indexOf('const shouldWritePublicArtifacts = !editorialReviewable;', editorialReviewableIndex);
  const writeGuardIndex = generator.indexOf('if (shouldWritePublicArtifacts) {', shouldWriteIndex);
  const markdownWriteIndex = generator.indexOf("fs.writeFileSync(newsletterMd, newsletterMarkdown, 'utf8');", writeGuardIndex);
  const htmlWriteIndex = generator.indexOf("fs.writeFileSync(newsletterHtml, newsletterHtmlContent, 'utf8');", writeGuardIndex);
  const dataWriteIndex = generator.indexOf('updateNewsletterData(date, editor);', writeGuardIndex);
  const validateResultIndex = generator.indexOf('const validateResult = editorialReviewable', dataWriteIndex);
  const finalPublishReadyIndex = generator.indexOf('const finalPublishReady =', validateResultIndex);

  assert.notEqual(generationStatusIndex, -1);
  assert.notEqual(renderedMarkdownIndex, -1);
  assert.notEqual(structuralGuardIndex, -1);
  assert.notEqual(factCheckNeedsFixIndex, -1);
  assert.notEqual(qualityNeedsFixIndex, -1);
  assert.notEqual(editorialReviewableIndex, -1);
  assert.notEqual(shouldWriteIndex, -1);
  assert.notEqual(writeGuardIndex, -1);
  assert.notEqual(markdownWriteIndex, -1);
  assert.notEqual(htmlWriteIndex, -1);
  assert.notEqual(dataWriteIndex, -1);
  assert.notEqual(validateResultIndex, -1);
  assert.notEqual(finalPublishReadyIndex, -1);
  assert.ok(renderedMarkdownIndex < structuralGuardIndex);
  assert.ok(structuralGuardIndex < generationStatusIndex);
  assert.ok(generationStatusIndex < factCheckNeedsFixIndex);
  assert.ok(factCheckNeedsFixIndex < qualityNeedsFixIndex);
  assert.ok(qualityNeedsFixIndex < editorialReviewableIndex);
  assert.ok(editorialReviewableIndex < shouldWriteIndex);
  assert.ok(shouldWriteIndex < writeGuardIndex);
  assert.ok(writeGuardIndex < markdownWriteIndex);
  assert.ok(markdownWriteIndex < htmlWriteIndex);
  assert.ok(htmlWriteIndex < dataWriteIndex);
  assert.ok(dataWriteIndex < validateResultIndex);
  assert.ok(validateResultIndex < finalPublishReadyIndex);
});

test('generation path passes runtime selection window policy into shortlist report', () => {
  const generatorPath = path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js');
  const generator = fs.readFileSync(generatorPath, 'utf8');
  const runtimeConfigIndex = generator.indexOf('const runtimeConfig = readRuntimeConfig(process.env);');
  const shortlistIndex = generator.indexOf('let shortlistReport = buildShortlistReport(date, candidates, {');
  const selectionWindowPolicyIndex = generator.indexOf(
    'selectionWindowPolicy: runtimeConfig.selectionWindowPolicy',
    shortlistIndex
  );

  assert.notEqual(runtimeConfigIndex, -1);
  assert.notEqual(shortlistIndex, -1);
  assert.notEqual(selectionWindowPolicyIndex, -1);
  assert.ok(runtimeConfigIndex < shortlistIndex);
  assert.ok(shortlistIndex < selectionWindowPolicyIndex);
});

test('validate-site uses shared rendered issue structural validator', () => {
  const validateSitePath = path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'validate-site.js');
  const validateSite = fs.readFileSync(validateSitePath, 'utf8');

  assert.match(validateSite, /validateRenderedIssueStructure/);
  assert.match(validateSite, /rendered-issue-structure/);
});

test('site validation workflow keeps structural checks blocking and quality annotations non-blocking', () => {
  const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', 'validate-site.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const structuralStep = workflowStep(workflow, 'Validate structural publication artifacts');
  const annotationStep = workflowStep(workflow, 'Annotate publication quality and fact-check status');

  assert.match(workflow, /^name: Validate Site and Images$/m);
  assert.match(workflow, /^  push:\n    branches: \["main"\]$/m);
  assert.match(workflow, /^  pull_request:\n    branches: \["main"\]$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assertTextInOrder(workflow, [
    '- name: Run unit and regression tests',
    '- name: Validate structural publication artifacts',
    '- name: Annotate publication quality and fact-check status'
  ]);
  assert.match(workflowStep(workflow, 'Run unit and regression tests'), /^\s*run: npm run test$/m);
  assertTextInOrder(structuralStep, [
    'npm run check:encoding',
    'npm run validate:policy'
  ]);
  assert.match(structuralStep, /npm run check:encoding/);
  assert.match(structuralStep, /npm run validate:policy/);
  assert.match(structuralStep, /npm run check:policy-docs/);
  assert.match(structuralStep, /npm run validate:config/);
  assert.match(structuralStep, /npm run validate:site/);
  assert.match(structuralStep, /npm run validate:images/);
  assert.match(structuralStep, /npm run validate:localization/);
  assert.doesNotMatch(structuralStep, /npm run validate:quality/);
  assert.doesNotMatch(structuralStep, /^\s*npm run validate$/m);
  assert.doesNotMatch(structuralStep, /continue-on-error:\s*true/);
  assert.match(annotationStep, /if: always\(\)/);
  assert.match(annotationStep, /continue-on-error:\s*true/);
  assert.match(annotationStep, /run: node scripts\/annotate-publication-quality\.js --latest/);
  const annotationCommands = workflowRunCommands(workflow, 'scripts/annotate-publication-quality.js');
  assert.ok(annotationCommands.length > 0, 'annotate-publication-quality.js must be invoked');
  for (const command of annotationCommands) {
    assert.match(command, /\bnode\s+scripts\/annotate-publication-quality\.js\b[^\n]*\s--latest\b/);
  }
});
