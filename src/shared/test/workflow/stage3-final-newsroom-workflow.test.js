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
} = require('../../common/newsletter-policy');

test('final newsroom workflow separates review PR success from publish-ready gate', () => {
  const workflowPath = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows', 'newsletters-03-editor-pr.yml');
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
  // 감사 outcome을 PR 본문 생성에 넘기려면 감사가 먼저 끝나 있어야 한다(#896).
  assertTextInOrder(workflow, [
    '- name: Audit newsletter image lineage',
    '- name: Prepare pull request body'
  ]);
  const summaryStep = workflowStep(workflow, 'Write workflow run summary');
  assert.match(summaryStep, /if: always\(\)/);
  assert.match(summaryStep, /continue-on-error:\s*true/);
  assert.match(summaryStep, /SUMMARY_PROFILE: newsroom-final/);
  assert.match(summaryStep, /run: node src\/shared\/tooling\/cli\/write-newsroom-workflow-summary\.js/);
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
  assert.match(workflow, /GEMINI_THINKING_BUDGET_JUDGE: \$\{\{ vars\.GEMINI_THINKING_BUDGET_JUDGE \|\| '' \}\}/);
  // 비용 임계값도 코드 기본값이 단일 정본이다(#660). 여기서 리터럴 폴백이 되살아나면
  // 코드 기본값이 프로덕션에 영원히 도달하지 못한다 — #574가 실제로 그렇게 묻혔다.
  assert.match(workflow, /NEWSROOM_WARN_COST_USD: \$\{\{ vars\.NEWSROOM_WARN_COST_USD \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_MAX_COST_USD: \$\{\{ vars\.NEWSROOM_MAX_COST_USD \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MODE: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MODE \|\| 'extract_only' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE \|\| '8' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN \|\| '40' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS \|\| '5000' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_BYTES: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_BYTES \|\| '200000' \}\}/);
  assert.doesNotMatch(workflow, /LLM_FALLBACK_MODELS=gemini-2\.5-flash-lite,gemini-2\.5-pro/);
  assert.doesNotMatch(workflow, /\[ "\$\{INPUT_LLM_PROVIDER\}" = "gemini" \]/);
  assert.doesNotMatch(workflow, /INTERNAL_LLM_API_KEY/);
  assert.doesNotMatch(workflow, /INTERNAL_LLM_ENDPOINT/);
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
  const workflowDocs = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'docs', 'NEWSROOM_WORKFLOW.md'), 'utf8');
  assert.doesNotMatch(workflowDocs, /^LLM_MODEL=$/m);
  assert.doesNotMatch(workflowDocs, /allow_pro=true/);
  assert.doesNotMatch(workflowDocs, /NEWSROOM_ALLOW_PRO/);
  assert.doesNotMatch(workflowDocs, /NEWSROOM_PRO_ESCALATION/);
  assert.match(generateStep, /continue-on-error:\s*true/);
  assert.match(ensurePublicStep, /node src\/generator\/publish\/ensure-public-newsletter-artifacts\.js/);
  assert.match(resolveMetaStep, /node src\/generator\/publish\/resolve-reviewable-artifacts\.js >> "\$GITHUB_OUTPUT"/);
  assert.match(validateGeneratedSiteStep, /if: steps\.meta\.outputs\.public_newsletter_ready == 'true'/);
  assert.match(validateGeneratedSiteStep, /^\s*run: npm run validate:post-generation$/m);
  assert.doesNotMatch(validateGeneratedSiteStep, /npm run validate:quality/);
  assert.doesNotMatch(validateGeneratedSiteStep, /^\s*run: npm run validate$/m);
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf8'));
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
  assert.match(workflow, /node src\/generator\/publish\/write-publish-status-output\.js >> "\$GITHUB_OUTPUT"/);
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
  // generate가 리뷰 패키지 작성 전에 리포트를 이미 생성하므로 이 스텝은 crash-path 백필 전용이다.
  // --skip-if-present 없이 재생성하면 generated_at만 바뀐 바이트가 artifact-manifest.json의
  // sha256과 어긋난 채 커밋되므로, 플래그를 계약으로 고정한다.
  assert.match(halSignalQualityStep, /npm run report:hal-signal-quality -- --date "\$\{\{ steps\.resolve-newsletter-date\.outputs\.date \}\}" --skip-if-present/);
  assert.match(imageAuditStep, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  // LOCK FLIPPED (#886). 이전 계약은 이 스텝이 job을 죽이는 하드 블록이어야 한다는 것이었다
  // (`doesNotMatch(/continue-on-error:\s*true/)`). 그 계약에서는 감사 실패가 곧 PR 생성 스텝
  // 전체 skip이라, 이미지 계보 문제 하나로 그 주 뉴스레터 PR이 통째로 사라졌다 — 막히는 것은
  // 발행이 아니라 사람이 판단할 리뷰 표면이었다. 새 계약은 "강등하되 강제 지점은 옮긴다"이며,
  // 아래 두 assertion이 그 대체 강제 지점을 함께 고정한다. 둘 중 하나라도 빠지면 이 강등은
  // 게이트 제거가 된다.
  assert.match(imageAuditStep, /id: audit-images/);
  assert.match(imageAuditStep, /continue-on-error:\s*true/);
  assert.match(imageAuditStep, /steps\.meta\.outputs\.public_newsletter_ready/);
  assert.match(
    imageAuditStep,
    /npm run newsroom:audit-images -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}" --fail-on-publish-blocking/
  );
  assert.match(
    imageAuditStep,
    /npm run newsroom:audit-images -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"\s*$/m
  );
  assert.match(snapshotStep, /copy_tree_if_present "articles\/content\/source-events\/\$\{DATE\}"/);
  assert.match(snapshotStep, /copy_tree_if_present "articles\/content\/newsroom\/\$\{DATE\}"/);
  assert.match(snapshotStep, /copy_tree_if_present "state\/source-snapshots"/);
  assert.match(snapshotStep, /copy_if_present "articles\/newsletters\/\$\{DATE\}\/newsletter\.md"/);
  assert.match(snapshotStep, /copy_if_present "articles\/newsletters\/\$\{DATE\}\/index\.html"/);
  assert.match(snapshotStep, /copy_if_present "articles\/data\/homepage-headline\.json"/);
  assert.match(snapshotStep, /copy_if_present "state\/article-exposure-history\.json"/);
  assert.match(preparePrBodyStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(ensureLabelsStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(createPrStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(createPrStep, /base: main/);
  // 기본 GITHUB_TOKEN으로 만든 PR은 on: pull_request 워크플로(validate-site)를 자동 실행하지
  // 않으므로, newsletter PR은 NEWSROOM_PR_TOKEN으로 만들어야 한다(secret이 없으면 GITHUB_TOKEN으로
  // 폴백). 회귀를 막기 위해 token 라인을 테스트로 고정한다.
  assert.match(createPrStep, /token: \$\{\{ secrets\.NEWSROOM_PR_TOKEN \|\| github\.token \}\}/);
  assert.match(preparePrBodyStep, /VALIDATE_OUTCOME: \$\{\{ steps\.validate\.outcome \|\| 'skipped' \}\}/);
  // LOCK ADDED (#896). #886의 강등은 라벨 절반에만 배선돼 있었고, 같은 리뷰 표면의 다른 절반인 PR
  // 본문은 감사 결과를 몰라 needs-fix 라벨 밑에 publish-ready 판정 본문이 달렸다. 편집장이 실제로
  // 읽는 것은 본문이므로, 본문 생성이 감사 outcome을 받아야 두 절반이 같은 말을 한다.
  assert.match(preparePrBodyStep, /IMAGE_AUDIT_OUTCOME: \$\{\{ steps\.audit-images\.outcome \|\| 'skipped' \}\}/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_FIGMA_URL: https:\/\/www\.figma\.com\/design\/EWJMa8vjfZLjdn9a7s3Kzs/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_DESKTOP_COVERAGE: covered/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_MOBILE_COVERAGE: covered/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION: none/);
  assert.match(workflow, /node src\/generator\/publish\/build-newsroom-pr-body\.js > \.tmp\/newsroom-pr-body\.md/);
  assert.match(workflow, /node src\/generator\/validate\/validate-pr-body\.js \.tmp\/newsroom-pr-body\.md --type newsletter --date "\$\{\{ steps\.meta\.outputs\.date \}\}" --require-publish-status-consistency/);
  assert.match(workflow, /cat \.tmp\/newsroom-pr-body\.md/);
  // LOCK RETARGETED (#886). 감사 스텝이 강등된 뒤에도 이미지 계보가 깨진 주에 publish-ready
  // 라벨이 붙으면 안 되므로, 라벨 스크립트가 감사 outcome을 읽어 hasAiPublishReady를 꺾어야 한다
  // (선례 5f83dd61과 동일 배선). 기존 assertion은 has_ai_publish_ready만 보는 식을 고정했으므로
  // 새 계약식으로 바꾼다 — 약화가 아니라 조건이 하나 더 붙은 강화다.
  // LOCK RETARGETED 2차. `!== 'failure'`는 skipped·cancelled까지 통과로 쳤다. 감사가 실제로
  // 돌아 성공한 outcome('success')만 publish-ready를 허용한다 — 조건이 좁아진 강화다.
  assert.match(workflow, /const imageAuditPassed = '\$\{\{ steps\.audit-images\.outcome \}\}' === 'success';/);
  assert.match(workflow, /const hasAiPublishReady = '\$\{\{ steps\.final-publish-status\.outputs\.has_ai_publish_ready \}\}' === 'true' && imageAuditPassed;/);
  assert.match(workflow, /const diagnosticsOnly = '\$\{\{ steps\.meta\.outputs\.diagnostics_only \}\}' === 'true';/);
  // LOCK RETARGETED (#896). 이전 계약은 라벨 분기가 meta의 review_publication_ready만 읽는 것이었다.
  // meta는 감사 스텝보다 먼저 계산되고 review_publication_ready는 final_publish_ready=false를 요구하므로,
  // 감사 강등 주에는 이 분기가 통째로 빠져 review-only-publication이 붙지 않았다. 이 라벨의 정의 자체가
  // "공개 파일이 준비돼 있어 merge하면 Pages에 뜬다"이므로(.github/workflows/AGENTS.md) 정의 그대로
  // public_newsletter_ready로 판정한다 — 약화가 아니라 누락 복구다.
  assert.match(workflow, /const publicNewsletterReady = '\$\{\{ steps\.meta\.outputs\.public_newsletter_ready \}\}' === 'true';/);
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
  const workflowPath = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows', 'newsletters-03-editor-pr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const labelStep = workflowStep(workflow, 'Add pull request labels');
  const reviewPublicationStart = labelStep.indexOf('} else if (publicNewsletterReady) {');
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
  const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');
  const stage1 = fs.readFileSync(path.join(workflowDir, 'newsletters-01-source-collect-pr.yml'), 'utf8');
  const stage2 = fs.readFileSync(path.join(workflowDir, 'newsletters-02-source-discovery-pr.yml'), 'utf8');
  const stage3 = fs.readFileSync(path.join(workflowDir, 'newsletters-03-editor-pr.yml'), 'utf8');
  const stage2RunStep = workflowStep(stage2, 'Run Gemini source discovery');
  const stage2PrepareBodyStep = workflowStep(stage2, 'Prepare source discovery pull request body');
  const stage2CreatePrStep = workflowStep(stage2, 'Create source discovery pull request');
  const stage2UploadStep = workflowStep(stage2, 'Upload source discovery debug artifacts');
  const rawPrBodyBuilder = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', '..', 'src', 'collector', 'build-raw-candidate-pr-body.js'),
    'utf8'
  );

  assert.match(stage1, /^name: Newsletters 01 - Source Collection PR/m);
  assert.match(stage2, /^name: Newsletters 02 - Source Discovery PR/m);
  assert.match(stage3, /^name: Newsletters 03 - Editor PR/m);

  assert.match(stage1, /workflow_dispatch:/);
  assert.match(stage1, /manual_source_urls:/);
  assert.doesNotMatch(stage1, /collection_intent_path:/);
  assert.doesNotMatch(stage1, /llm_provider:/);
  assert.match(stage1, /NEWSROOM_MANUAL_SOURCE_URLS: \$\{\{ github\.event\.inputs\.manual_source_urls \}\}/);
  assert.doesNotMatch(stage1, /^\s*schedule:/m);
  assert.match(stage1, /^\s*workflow_call:/m);
  assert.match(stage2, /^\s*workflow_call:/m);
  assert.match(stage3, /^\s*workflow_call:/m);
  assert.match(stage1, /run: npm run doctor:config -- --no-llm-credentials/);
  assert.match(stage1, /run: npm run collect/);
  assert.doesNotMatch(stage1, /npm run generate/);
  assert.doesNotMatch(stage1, /GEMINI_API_KEY/);
  assert.doesNotMatch(stage1, /INTERNAL_LLM_API_KEY/);
  assert.match(stage1, /branch=newsroom-raw\/\$\{DATE\}/);
  assert.match(stage1, /manual-candidates\.json/);
  assert.match(stage1, /collection-intent\.json/);
  assert.match(stage1, /raw-candidate-manifest\.json/);
  assert.match(stage1, /articles\/content\/source-events\/\$\{\{ steps\.raw-meta\.outputs\.date \}\}\/source-change-events\.json/);
  assert.match(stage1, /articles\/content\/source-events\/\$\{\{ steps\.raw-meta\.outputs\.date \}\}\/source-change-events\.md/);
  assert.match(stage1, /state\/source-snapshots\/\*\*/);

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
  assert.match(stage2, /node src\/discovery\/gemini-source-discovery-boundary\.js --date/);
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
  const generatorPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'generator', 'publish', 'gemini-newsroom-newsletter.js');
  const generator = fs.readFileSync(generatorPath, 'utf8');
  // render → structural guard 순서는 main()에 그대로 남는다.
  const renderedMarkdownIndex = generator.indexOf('newsletterMarkdown = buildMarkdown(editor);');
  const structuralGuardIndex = generator.indexOf('assertTerminalPublicationContracts({', renderedMarkdownIndex);
  // 그 직후 main()은 발행 가부 결정 + generation-status 기록 블록을
  // decidePublishReadinessAndWriteStatus(orchestrator-publish-decision.js)로 위임한다(#655).
  const decideCallIndex = generator.indexOf('decidePublishReadinessAndWriteStatus({', structuralGuardIndex);

  assert.notEqual(renderedMarkdownIndex, -1);
  assert.notEqual(structuralGuardIndex, -1);
  assert.notEqual(decideCallIndex, -1);
  assert.ok(renderedMarkdownIndex < structuralGuardIndex);
  assert.ok(structuralGuardIndex < decideCallIndex);

  // 발행 안전 순서 불변(결정 → editorialReviewable → public artifact 쓰기 가드 → 공개 산출물
  // 쓰기 → validate → finalPublishReady)은 추출된 모듈 안에서 그대로 유지된다(#655). 등급 결정
  // 분기(underfill/fact-check/quality)는 orchestrator-generation-status.js로 추출됐고, 추출된
  // 결정 블록에는 그 순수 분류기 호출만 남는다.
  const decisionPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'generator', 'publish', 'orchestrator-publish-decision.js');
  const decision = fs.readFileSync(decisionPath, 'utf8');
  const generationStatusIndex = decision.indexOf('const generationStatus = classifyGenerationStatus({');
  const editorialReviewableIndex = decision.indexOf(
    'const editorialReviewable = isEditorialReviewableStatus(generationStatus);',
    generationStatusIndex
  );
  const shouldWriteIndex = decision.indexOf('const shouldWritePublicArtifacts = !editorialReviewable;', editorialReviewableIndex);
  const writeGuardIndex = decision.indexOf('if (shouldWritePublicArtifacts) {', shouldWriteIndex);
  const markdownWriteIndex = decision.indexOf("fs.writeFileSync(newsletterMd, newsletterMarkdown, 'utf8');", writeGuardIndex);
  const htmlWriteIndex = decision.indexOf("fs.writeFileSync(newsletterHtml, newsletterHtmlContent, 'utf8');", writeGuardIndex);
  const dataWriteIndex = decision.indexOf('updateNewsletterData(date, editor);', writeGuardIndex);
  const validateResultIndex = decision.indexOf('const validateResult = editorialReviewable', dataWriteIndex);
  const finalPublishReadyIndex = decision.indexOf('const finalPublishReady =', validateResultIndex);

  assert.notEqual(generationStatusIndex, -1);
  assert.notEqual(editorialReviewableIndex, -1);
  assert.notEqual(shouldWriteIndex, -1);
  assert.notEqual(writeGuardIndex, -1);
  assert.notEqual(markdownWriteIndex, -1);
  assert.notEqual(htmlWriteIndex, -1);
  assert.notEqual(dataWriteIndex, -1);
  assert.notEqual(validateResultIndex, -1);
  assert.notEqual(finalPublishReadyIndex, -1);
  assert.ok(generationStatusIndex < editorialReviewableIndex);
  assert.ok(editorialReviewableIndex < shouldWriteIndex);
  assert.ok(shouldWriteIndex < writeGuardIndex);
  assert.ok(writeGuardIndex < markdownWriteIndex);
  assert.ok(markdownWriteIndex < htmlWriteIndex);
  assert.ok(htmlWriteIndex < dataWriteIndex);
  assert.ok(dataWriteIndex < validateResultIndex);
  assert.ok(validateResultIndex < finalPublishReadyIndex);
});

test('generation path passes runtime selection window policy into shortlist report', () => {
  const generatorPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'generator', 'publish', 'gemini-newsroom-newsletter.js');
  const generator = fs.readFileSync(generatorPath, 'utf8');
  const runtimeConfigIndex = generator.indexOf('const runtimeConfig = readRuntimeConfig(process.env);');
  const shortlistIndex = generator.indexOf('let shortlistReport = buildShortlistReport(date, candidates, {');
  const selectionWindowPolicyIndex = generator.indexOf(
    'selectionWindowPolicy: runtimeConfig.selectionWindowPolicy',
    shortlistIndex
  );
  const coverageWeekKeyOverrideIndex = generator.indexOf(
    'coverageWeekKeyOverride: runtimeConfig.coverageWeekKeyOverride',
    shortlistIndex
  );

  assert.notEqual(runtimeConfigIndex, -1);
  assert.notEqual(shortlistIndex, -1);
  assert.notEqual(selectionWindowPolicyIndex, -1);
  assert.notEqual(coverageWeekKeyOverrideIndex, -1);
  assert.ok(runtimeConfigIndex < shortlistIndex);
  assert.ok(shortlistIndex < selectionWindowPolicyIndex);
  assert.ok(shortlistIndex < coverageWeekKeyOverrideIndex);
});

test('validate-site uses shared rendered issue structural validator', () => {
  const validateSitePath = path.join(__dirname, '..', '..', '..', '..', 'src', 'generator', 'validate', 'validate-site.js');
  const validateSite = fs.readFileSync(validateSitePath, 'utf8');

  assert.match(validateSite, /validateRenderedIssueStructure/);
  assert.match(validateSite, /rendered-issue-structure/);
});

test('site validation workflow keeps structural checks blocking and quality annotations non-blocking', () => {
  const workflowPath = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows', 'site-01-validate.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const structuralStep = workflowStep(workflow, 'Validate structural publication artifacts');
  const annotationStep = workflowStep(workflow, 'Annotate publication quality and fact-check status');

  assert.match(workflow, /^name: Site 01 - Validate Site and Images$/m);
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
  // #885 — committed repo state만 읽는 구조 검사(secret·네트워크·생성 artifact 불요)는 #712 기준상
  // PR CI에서 blocking이어야 한다. 이 셋은 단위 테스트가 손으로 만든 경로 배열·임시 트리·주입된
  // 목록만 입력으로 받아 `npm run test`가 실제 트리를 검사하지 않으므로, 워크플로에서 빠지면
  // 위반이 머지 시점이 아니라 그 주 발행 때 처음 드러나 본문 품질과 무관한 이유로 발행이 강등된다.
  assert.match(structuralStep, /npm run check:repo-hygiene/);
  assert.match(structuralStep, /npm run check:artifact-retention/);
  assert.match(structuralStep, /npm run check:artifact-path-convention/);
  assert.match(structuralStep, /npm run check:domain-model-boundary/);
  assert.match(structuralStep, /npm run validate:policy/);
  assert.match(structuralStep, /npm run check:policy-docs/);
  assert.match(structuralStep, /npm run validate:config/);
  assert.match(structuralStep, /npm run validate:site/);
  assert.match(structuralStep, /npm run validate:images/);
  assert.match(structuralStep, /npm run validate:localization/);
  // #712 — 발행상태 드리프트(archive sidecar / 공개상태 / URL parity)를 PR CI에서 차단.
  // 셋 다 committed site state만 보고 blocking 검증한다(생성 newsroom artifact·secret 불요).
  assert.match(structuralStep, /npm run validate:archive/);
  assert.match(structuralStep, /npm run validate:public/);
  assert.match(structuralStep, /npm run validate:url-parity/);
  assert.doesNotMatch(structuralStep, /npm run validate:quality/);
  assert.doesNotMatch(structuralStep, /^\s*npm run validate$/m);
  assert.doesNotMatch(structuralStep, /continue-on-error:\s*true/);
  assert.match(annotationStep, /if: always\(\)/);
  assert.match(annotationStep, /continue-on-error:\s*true/);
  assert.match(annotationStep, /run: node src\/generator\/publish\/annotate-publication-quality\.js --latest/);
  const annotationCommands = workflowRunCommands(workflow, 'src/generator/publish/annotate-publication-quality.js');
  assert.ok(annotationCommands.length > 0, 'annotate-publication-quality.js must be invoked');
  for (const command of annotationCommands) {
    assert.match(command, /\bnode\s+src\/generator\/publish\/annotate-publication-quality\.js\b[^\n]*\s--latest\b/);
  }
});
