const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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
const {
  resolvePublishStatus
} = require('../scripts/newsroom/common/publish-status');
const {
  extractSections,
  validatePrBodyFile,
  validatePrBodyText
} = require('../scripts/validate-pr-body');
const {
  buildPublishStatusOutputs
} = require('../scripts/write-publish-status-output');
const {
  buildReviewableArtifactOutputs,
  REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS,
  resolveReviewableArtifacts
} = require('../scripts/resolve-reviewable-artifacts');
const {
  main: annotatePublicationQualityMain,
  resolveTargetItems
} = require('../scripts/annotate-publication-quality');
const {
  renderEditorPublicationPolicyMarkdown
} = require('../scripts/newsroom/common/editor-publication-policy');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function assertTextInOrder(text, labels) {
  let previous = -1;
  for (const label of labels) {
    const current = text.indexOf(label);
    assert.notEqual(current, -1, `${label} must exist`);
    assert.ok(current > previous, `${label} must appear after previous marker`);
    previous = current;
  }
}

function workflowStep(text, name) {
  const marker = `- name: ${name}`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${name} step must exist`);
  const next = text.indexOf('\n      - name:', start + marker.length);
  return text.slice(start, next === -1 ? undefined : next);
}

function extractMarkdownSection(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${heading} section must exist`);
  const next = text.indexOf('\n## ', start + marker.length);
  return text.slice(start, next === -1 ? undefined : next);
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'newsroom-pr-body-'));
}

function writeMinimalPublishArtifacts(root, date, overrides = {}) {
  const status = {
    date,
    status: 'PASS',
    selection_publish_ready: true,
    final_publish_ready: overrides.finalPublishReady ?? false,
    publish_gate_passed: true,
    review_gate_passed: true,
    quality_status: 'PASS',
    quality_score: 90,
    quality_threshold: qualityGatePolicy.threshold,
    fact_check_status: 'PASS',
    must_fix_count: 0,
    source_gap_count: 0,
    stale_claim_status: 'PASS',
    stale_claim_hard_failure_count: 0,
    composition_mode: 'NORMAL',
    selected_article_count: articlePolicy.mainArticleCount.min,
    final_selected_article_count: articlePolicy.mainArticleCount.min,
    ...(overrides.status || {})
  };
  const quality = {
    status: 'PASS',
    score: 90,
    threshold: qualityGatePolicy.threshold,
    deductions: [],
    ...(overrides.quality || {})
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    ...(overrides.factCheck || {})
  };
  const staleClaim = {
    status: 'PASS',
    hard_failures: [],
    stale_claim_items_removed: [],
    unsupported_release_claims_removed: [],
    unused_references_removed: [],
    ...(overrides.staleClaim || {})
  };
  const shortlist = {
    publish_ready: true,
    publish_gate_passed: true,
    review_gate_passed: true,
    composition_mode: 'NORMAL',
    selection_composition_mode: 'NORMAL',
    selected_article_count: articlePolicy.mainArticleCount.min,
    composition_summary: {
      selected_article_count: articlePolicy.mainArticleCount.min,
      primary_camera_stack_topic_count: articlePolicy.primaryCameraStack.minRequired,
      supporting_main_article_count: articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired,
      forbidden_main_article_count: 0,
      non_fallback_reviewable_article_count: articlePolicy.mainArticleCount.min
    },
    ...(overrides.shortlist || {})
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), quality);
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  writeJson(path.join(root, 'content', 'newsroom', date, 'stale-claim-report.json'), staleClaim);
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), shortlist);

  return { status, quality, factCheck, staleClaim, shortlist };
}

function writePublicNewsletterArtifacts(root, date, overrides = {}) {
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), overrides.markdown || '# Camera HAL SW Newsletter\n');
  writeText(path.join(root, 'newsletters', date, 'index.html'), overrides.html || '<!doctype html><html><body>Camera HAL SW Newsletter</body></html>\n');
  writeJson(path.join(root, 'data', 'newsletters.json'), [
    {
      date,
      title: overrides.title || `Camera HAL SW Newsletter - ${date}`,
      summary: overrides.summary || 'Public issue summary',
      html: `newsletters/${date}/index.html`,
      md: `newsletters/${date}/newsletter.md`,
      tags: ['Camera HAL']
    }
  ]);
}

function writeNewsletterIndex(root, items) {
  writeJson(path.join(root, 'data', 'newsletters.json'), items.map(item => ({
    date: item.date,
    title: item.title || `Camera HAL SW Newsletter - ${item.date}`,
    summary: item.summary || 'Public issue summary',
    html: `newsletters/${item.date}/index.html`,
    md: `newsletters/${item.date}/newsletter.md`,
    tags: ['Camera HAL']
  })));
}

function writeEditorialReviewableArtifacts(root, date, overrides = {}) {
  const status = {
    date,
    status: 'NEEDS_FIX',
    failure_kind: 'editorial_reviewable',
    final_publish_ready: false,
    validate_ok: false,
    editor_review_required: true,
    fact_check_status: 'NEEDS_FIX',
    must_fix_count: 1,
    quality_status: 'NEEDS_FIX',
    quality_score: 82,
    quality_threshold: qualityGatePolicy.threshold,
    publish_gate_passed: false,
    review_gate_passed: true,
    ...(overrides.status || {})
  };
  const editor = {
    date,
    title: `Camera HAL SW Newsletter - ${date}`,
    summary: 'Review-only draft',
    briefing: ['one', 'two', 'three'],
    sections: [],
    references: [],
    ...(overrides.editor || {})
  };
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [{ issue: 'editorial fact-check remains' }],
    source_gaps: [],
    source_gap_count: 0,
    ...(overrides.factCheck || {})
  };
  const quality = {
    status: 'NEEDS_FIX',
    score: 82,
    threshold: qualityGatePolicy.threshold,
    deductions: [{ category: 'source-integrity', points: 15, reason: 'Fact checker returned 1 must_fix item(s).' }],
    ...(overrides.quality || {})
  };
  const generationStatus = {
    ...status,
    ...(overrides.generationStatus || {})
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  if (overrides.writeEditor !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), editor);
  }
  if (overrides.writeFactCheck !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  }
  if (overrides.writeQuality !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), quality);
  }
  if (overrides.writeGenerationStatus !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), generationStatus);
  }

  return { status, editor, factCheck, quality, generationStatus };
}

function writeFailedRepairReviewableArtifacts(root, date, overrides = {}) {
  const status = {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    publish_ready: true,
    selection_publish_ready: true,
    final_publish_ready: true,
    publish_gate_passed: true,
    review_gate_passed: false,
    quality_status: 'PASS',
    quality_score: 90,
    quality_threshold: qualityGatePolicy.threshold,
    fact_check_status: 'PASS',
    must_fix_count: 0,
    source_gap_count: 0,
    composition_mode: 'NORMAL',
    ...(overrides.status || {})
  };
  const editor = {
    date,
    title: `Camera HAL SW Newsletter - ${date}`,
    summary: 'Fallback draft',
    briefing: ['one', 'two', 'three'],
    sections: [],
    references: [],
    ...(overrides.editor || {})
  };
  const quality = {
    status: 'PASS',
    score: 90,
    threshold: qualityGatePolicy.threshold,
    deductions: [],
    ...(overrides.quality || {})
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    ...(overrides.factCheck || {})
  };
  const repairFailure = {
    name: 'EditorSemanticValidationError',
    message: 'Fallback repair failure',
    ...(overrides.repairFailure || {})
  };
  const generationStatus = {
    ...status,
    publish_ready: false,
    selection_publish_ready: false,
    final_publish_ready: false,
    publish_gate_passed: false,
    composition_mode: 'NEEDS_FIX',
    ...(overrides.generationStatus || {})
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  if (overrides.writeEditor !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), editor);
  }
  if (overrides.writeQuality !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), quality);
  }
  if (overrides.writeFactCheck !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  }
  if (overrides.writeRepairFailure !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'), repairFailure);
  }
  if (overrides.writeGenerationStatus !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), generationStatus);
  }

  return { status, editor, quality, factCheck, repairFailure, generationStatus };
}

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

test('FAILED_REPAIR_REVIEWABLE status is reviewable but never publish-ready', () => {
  const outputs = buildGenerationStatusOutputs({
    status: 'FAILED_REPAIR_REVIEWABLE',
    quality_status: 'NEEDS_FIX',
    quality_score: 79,
    quality_threshold: qualityGatePolicy.threshold,
    publish_ready: true,
    selection_publish_ready: true,
    final_publish_ready: true,
    review_gate_passed: true,
    publish_gate_passed: true,
    composition_mode: 'NORMAL',
    editor_review_required: false,
    rendered_main_article_count: articlePolicy.mainArticleCount.min,
    selected_article_count: articlePolicy.mainArticleCount.min,
    final_selected_article_count: articlePolicy.mainArticleCount.min,
    primary_camera_stack_topic_count: articlePolicy.primaryCameraStack.minRequired,
    supporting_main_article_count: articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired,
    forbidden_main_article_count: 0
  });

  assert.equal(outputs.status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(outputs.publish_ready, 'false');
  assert.equal(outputs.selection_publish_ready, 'false');
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.editor_review_required, 'true');
  assert.equal(outputs.composition_mode, 'NEEDS_FIX');
});

test('newsroom PR body treats FAILED_REPAIR_REVIEWABLE as needs-fix review flow', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date, {
    status: {
      quality_status: 'NEEDS_FIX',
      quality_score: 79,
      final_publish_ready: false,
      rendered_main_article_count: articlePolicy.mainArticleCount.min,
      selected_article_count: articlePolicy.mainArticleCount.min,
      final_selected_article_count: articlePolicy.mainArticleCount.min,
      primary_camera_stack_topic_count: articlePolicy.primaryCameraStack.minRequired,
      supporting_main_article_count: articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired,
      forbidden_main_article_count: 0,
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0
    },
    quality: {
      status: 'NEEDS_FIX',
      score: 79,
      threshold: qualityGatePolicy.threshold
    }
  });
  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure'
  });

  assert.match(body, /전체 상태: NEEDS_FIX/);
  assert.match(body, /생성 실행 상태: FAILED_REPAIR_REVIEWABLE/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /publish_gate_passed: false/);
  assert.match(body, /권장 조치:/);
  assert.doesNotMatch(body, /최종 발행 조건이 모두 통과했습니다/);
});

test('newsroom PR body marks editorial reviewable handoff as non-publishable', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);

  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'skipped'
  });

  assert.match(body, /발행 불가 경고:/);
  assert.match(body, /발행 불가 review PR/);
  assert.match(body, /failure_kind=editorial_reviewable/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /validate_ok=false/);
  assert.match(body, /editor_review_required=true/);
  assert.match(body, new RegExp(`newsletters/${date}/newsletter\\.md - not generated`));
  assert.match(body, new RegExp(`newsletters/${date}/index\\.html - not generated`));
  assert.match(body, /data\/newsletters\.json - not updated/);
  const sections = extractSections(body);
  const generatedArtifactsSection = [...sections.values()]
    .find(section => section.includes(`content/collected-news/${date}/candidates.json`)) || '';
  assert.doesNotMatch(generatedArtifactsSection, new RegExp(`newsletters/${date}/newsletter\\.md`));
  assert.doesNotMatch(generatedArtifactsSection, new RegExp(`newsletters/${date}/index\\.html`));
  assert.doesNotMatch(generatedArtifactsSection, /data\/newsletters\.json/);
  assert.equal(validatePrBodyText(body).ok, true);

  const missingWarning = body.replace(/^발행 불가 경고:.*\n/m, '');
  const result = validatePrBodyText(missingWarning);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /non-publish warning/);

  const leakedPublicArtifact = body.replace(
    `- content/collected-news/${date}/candidates.json`,
    `- content/collected-news/${date}/candidates.json\n- newsletters/${date}/newsletter.md`
  );
  const leakedResult = validatePrBodyText(leakedPublicArtifact, { date });
  assert.equal(leakedResult.ok, false);
  assert.match(leakedResult.errors.join('\n'), /must not list public artifacts/);

  const publicArtifactOutsideGeneratedSection = body.replace(
    '## 생성하지 않은 public 산출물',
    `## 참고\n\n- newsletters/${date}/newsletter.md - not generated\n\n## 생성하지 않은 public 산출물`
  );
  assert.equal(validatePrBodyText(publicArtifactOutsideGeneratedSection, { date }).ok, true);
});

test('reviewable artifact resolver does not accept tmp status alone', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    final_publish_ready: false
  });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);

  const resolved = resolveReviewableArtifacts({ root });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(resolved.date, date);
  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical=none/);
});

test('reviewable artifact resolver requires changed artifacts even when canonical artifacts exist', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'NEEDS_FIX',
    final_publish_ready: false
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), {
    date,
    sections: []
  });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: []
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical=editor-draft\.json/);
  assert.match(outputs.reviewable_artifact_reason, /changed=none/);
});

test('reviewable artifact resolver rejects stale base artifacts without repo-visible changes', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: []
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /changed=none/);
  assert.match(outputs.reviewable_artifact_reason, /missing_required=none/);
});

test('reviewable artifact resolver accepts editorial reviewable handoff without public artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /failure_kind=editorial_reviewable/);
  assert.match(outputs.reviewable_artifact_reason, /editorial_reject=none/);
});

test('reviewable artifact resolver rejects editorial reviewable public and data writes', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
      .concat([
        `newsletters/${date}/newsletter.md`,
        `newsletters/${date}/index.html`,
        'data/newsletters.json'
      ])
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_public_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /public_exists=/);
  assert.match(outputs.reviewable_artifact_reason, /public_changed=/);
  assert.match(outputs.reviewable_artifact_reason, /data_newsletters_changed=true/);
  assert.match(outputs.reviewable_artifact_reason, /data_newsletters_has_date=2026-05-09/);
});

test('reviewable artifact resolver rejects editorial reviewable invalid canonical artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date, {
    generationStatus: {
      failure_kind: 'wrong_kind'
    }
  });

  let outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical_failure_kind=wrong_kind/);

  writeText(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), '{ invalid json');
  outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical_generation_status=invalid/);
  assert.match(outputs.reviewable_artifact_reason, /invalid_editorial_required=/);

  const missingRoot = tempRoot();
  writeEditorialReviewableArtifacts(missingRoot, date, { writeQuality: false });
  outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root: missingRoot,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.match(outputs.reviewable_artifact_reason, /missing_editorial_required=quality-report\.json/);
});

test('reviewable artifact resolver rejects failed repair with repair-failure only', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    publish_ready: false,
    selection_publish_ready: false,
    final_publish_ready: false,
    publish_gate_passed: false
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'), {
    message: 'Editor output must contain 3-5 sections; got 2.'
  });

  const resolved = resolveReviewableArtifacts({
    root,
    changedArtifacts: [`content/newsroom/${date}/repair-failure.json`]
  });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(outputs.date, date);
  assert.equal(outputs.branch, `newsletter/${date}`);
  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /status=FAILED_REPAIR_REVIEWABLE/);
  assert.match(outputs.reviewable_artifact_reason, /repair-failure\.json/);
  assert.match(outputs.reviewable_artifact_reason, /missing_required=/);
  for (const required of REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.filter(file => file !== 'repair-failure.json')) {
    assert.match(outputs.reviewable_artifact_reason, new RegExp(required.replace('.', '\\.')));
  }
});

test('reviewable artifact resolver accepts complete changed failed repair artifact set', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), '# draft\n');

  const resolved = resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
      .concat(`newsletters/${date}/newsletter.md`)
  });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /missing_required=none/);
});

test('reviewable artifact resolver rejects legacy quality failures without editorial failure kind', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'QUALITY_NEEDS_FIX',
    final_publish_ready: false
  });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), {
    date,
    sections: []
  });
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: [
      `content/newsroom/${date}/editor-draft.json`,
      `newsletters/${date}/newsletter.md`,
      `newsletters/${date}/index.html`,
      'data/newsletters.json'
    ]
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_public_artifacts, 'false');
  assert.equal(outputs.has_ai_publish_ready, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical_generation_status=missing/);
  assert.match(outputs.reviewable_artifact_reason, /public_changed=/);
  assert.match(outputs.reviewable_artifact_reason, /data_newsletters_changed=true/);
});

test('reviewable artifact resolver does not treat FAILED status as a publish candidate', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED'
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'), {
    message: 'terminal failure'
  });
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), '# stale draft\n');

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: [
      `content/newsroom/${date}/repair-failure.json`,
      `newsletters/${date}/newsletter.md`
    ]
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
});

test('newsroom PR body separates quality score threshold and result in Korean status text', () => {
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

  assert.match(body, /^## 생성 상태$/m);
  assert.equal((body.match(/^## 생성 상태$/gm) || []).length, 1);
  assert.doesNotMatch(body, /^## Generation Status$/m);
  assert.match(body, /품질 점수: 90/);
  assert.match(body, new RegExp(`품질 기준: ${qualityGatePolicy.threshold}`));
  assert.match(body, /품질 상태: NEEDS_FIX/);
  assert.match(body, /must_fix 요약: must_fix_count=0; source_gap_count=0/);
  assert.match(body, /Stale claim 상태: PASS/);
  assert.match(body, /Stale claim 요약: removed=1; hard_failures=0/);
  assert.match(body, /권장 조치:/);
  assert.match(body, /## 기사 구성 요약/);
  assert.doesNotMatch(body, /## Composition Summary/);
  assert.match(body, /composition_mode: NEEDS_FIX/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /검토 게이트: true \(review_gate_passed: true\)/);
  assert.match(body, /최종 발행 가능 여부: false \(final_publish_ready: false\)/);
  assert.match(body, new RegExp(`정책상 발행 조건: false \\(publish_gate_passed: false; ${publishGateCriteriaText().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
  assert.doesNotMatch(body, /발행 게이트:/);
  assert.match(body, /상태 일관성 오류: 없음 \(consistency_errors: none\)/);
  assert.match(body, /editor_review_required: true/);
  assert.match(body, /review_gate_passed: true/);
  assert.match(body, /publish_gate_passed: false/);
  assert.match(body, /direct_aosp_camera count: 1/);
  assert.match(body, /deterministic_selected_count: 5/);
  assert.match(body, new RegExp(`rendered_main_article_count: ${selectedBelowMinimum}`));
  assert.match(body, /reserve_candidate_count: 2/);
  assert.match(body, /부족한 후보 경로: true/);
  assert.match(body, new RegExp(`선택된 발행 가능 article 수는 ${selectedBelowMinimum}개입니다\\. 최소 기준은 ${configuredMinimum}개입니다\\.`));
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
  assert.match(body, /인위적인 Camera HAL 표현/);
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

  assert.match(body, /권장 조치: 검토용 PR로만 사용하세요\. 후보 선택 발행 조건을 만족하기 전에는 최종 발행으로 보지 않습니다\./);
  assert.match(body, /composition_mode: NEEDS_FIX/);
  assert.match(body, /selection_composition_mode: FALLBACK_COMPOSITION/);
  assert.match(body, /후보 선택 발행 조건이 막혀 있으면 최종 발행 가능 상태가 아닙니다/);
});

test('newsroom PR body keeps one Korean generation status heading', () => {
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'failure',
    status: {
      status: 'QUALITY_NEEDS_FIX',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'NEEDS_FIX',
      quality_score: 80,
      quality_threshold: qualityGatePolicy.threshold,
      selection_publish_ready: false,
      final_publish_ready: false,
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0
    }
  });

  assert.equal((body.match(/^## 생성 상태$/gm) || []).length, 1);
  assert.doesNotMatch(body, /^## Generation Status$/m);
});

test('newsroom PR body strips stale editor brief gate sections', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeText(path.join(root, 'content', 'newsroom', date, 'editor-in-chief-brief.md'), [
    '# Brief',
    '',
    '## 이번 주 핵심 메시지',
    '',
    '핵심 메시지입니다.',
    '',
    '## 품질 게이트',
    '',
    '- 오래된 PASS 문구',
    '',
    '## Stale Claim Gate',
    '',
    '- old stale status',
    '',
    '## 권장 판단',
    '',
    'REQUEST_CHANGES'
  ].join('\n'));
  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    status: {
      status: 'QUALITY_NEEDS_FIX',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'NEEDS_FIX',
      quality_score: 80,
      quality_threshold: qualityGatePolicy.threshold,
      selection_publish_ready: false,
      final_publish_ready: false,
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0
    }
  });

  assert.match(body, /^## 이번 주 핵심 메시지$/m);
  assert.match(body, /핵심 메시지입니다/);
  assert.match(body, /^## 권장 판단$/m);
  assert.doesNotMatch(body, /^## 품질 게이트$/m);
  assert.doesNotMatch(body, /^## Stale Claim Gate$/m);
  assert.doesNotMatch(body, /오래된 PASS 문구/);
});

test('publish status resolver blocks final publish when fact-check needs fix', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'source gap remains' }]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_status, 'PASS');
  assert.equal(resolved.status.fact_check_status, 'NEEDS_FIX');
  assert.equal(resolved.status.final_publish_ready, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver keeps site validation failure out of consistency errors', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });

  assert.equal(resolved.status.artifact_final_publish_ready, true);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.validation_passed, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.validate_outcome_success, undefined);
  assert.equal(resolved.status.final_publish_ready_conditions.validate_outcome_success, false);
});

test('publish status resolver ignores status final mismatch caused only by validation failure', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      validate_ok: false
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });

  assert.equal(resolved.status.artifact_final_publish_ready, true);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver records consistency error when status final flag is stale', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'unresolved must_fix' }]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /status\.final_publish_ready=true but artifact_final_publish_ready=false/);
});

test('publish status resolver treats FAILED_REPAIR_REVIEWABLE artifacts as reviewable but not publish-ready', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });
  const outputs = buildPublishStatusOutputs(resolved);

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'NEEDS_FIX');
  assert.equal(resolved.status.review_gate_passed, true);
  assert.equal(resolved.status.publish_gate_passed, false);
  assert.equal(resolved.status.publish_ready, false);
  assert.equal(resolved.status.selection_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.composition_mode, 'NEEDS_FIX');
  assert.equal(resolved.status.consistency_errors.length, 0);
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.composition_mode, 'NEEDS_FIX');
});

test('publish status resolver does not promote FAILED_REPAIR_REVIEWABLE without canonical artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date, {
    writeEditor: false
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'FAILED');
  assert.equal(resolved.status.review_gate_passed, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /Missing reviewable repair artifact: content\/newsroom\/2026-05-08\/editor-draft\.json/);
});

test('publish status resolver does not promote FAILED_REPAIR_REVIEWABLE with invalid canonical artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);
  writeText(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), '{ invalid json');

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'FAILED');
  assert.equal(resolved.status.review_gate_passed, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /Could not read content\/newsroom\/2026-05-08\/editor-draft\.json/);
});

test('validate-pr-body fails when consistency errors are present', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'unresolved must_fix' }]
    }
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });
  const result = validatePrBodyText(body);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /consistency_errors/);
});

test('validate-pr-body allows review PR when final publish is false without consistency errors', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure' });
  const filePath = path.join(root, '.tmp', 'newsroom-pr-body.md');
  writeText(filePath, body);

  const result = validatePrBodyFile(filePath, {
    root,
    date,
    validateOutcome: 'failure'
  });

  assert.equal(result.ok, true);
});

test('newsroom PR body includes editor-approved publication policy', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure' });
  const result = validatePrBodyText(body);

  assert.equal(result.ok, true);
  assert.equal(
    extractMarkdownSection(body, 'Editor-approved Publication Policy').trimEnd(),
    renderEditorPublicationPolicyMarkdown().trimEnd()
  );
});

test('publish status output renders final and artifact readiness fields', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });
  const outputs = buildPublishStatusOutputs(resolved);

  assert.equal(outputs.artifact_final_publish_ready, 'true');
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.has_ai_publish_ready, 'false');
  assert.equal(outputs.selection_publish_ready, 'true');
  assert.equal(outputs.publish_gate_passed, 'true');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.validate_outcome, 'failure');
  assert.equal(outputs.quality_status, 'PASS');
  assert.equal(outputs.fact_check_status, 'PASS');
  assert.equal(outputs.must_fix_count, '0');
  assert.equal(outputs.source_gap_count, '0');
  assert.equal(outputs.stale_claim_status, 'PASS');
  assert.equal(outputs.stale_claim_hard_failure_count, '0');
  assert.equal(outputs.consistency_error_count, '0');
  assert.equal(outputs.consistency_errors, 'none');
  assert.equal(outputs.composition_mode, 'NORMAL');
  assert.equal(outputs.selection_composition_mode, 'NORMAL');
});

test('publication quality annotation reports quality and fact-check issues without failing', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writePublicNewsletterArtifacts(root, date);
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), {
    status: 'NEEDS_FIX',
    score: qualityGatePolicy.threshold - 5,
    threshold: qualityGatePolicy.threshold,
    deductions: [{ reason: 'weak camera relevance' }]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), {
    status: 'NEEDS_FIX',
    must_fix: [{ issue: 'unresolved source claim' }],
    source_gaps: [{ issue: 'missing article-level evidence' }],
    source_gap_count: 1
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), {
    final_publish_ready: false,
    publish_gate_passed: false,
    stale_claim_status: 'PASS',
    stale_claim_hard_failure_count: 0
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    publish_gate_passed: false
  });

  let stdout = '';
  let stderr = '';
  const code = annotatePublicationQualityMain(['--date', date], {
    root,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.match(stdout, /::error file=content\/newsroom\/2026-05-08\/quality-report\.json,title=Quality status not PASS::/);
  assert.match(stdout, /::warning file=content\/newsroom\/2026-05-08\/quality-report\.json,title=Quality score below threshold::/);
  assert.match(stdout, /::error file=content\/newsroom\/2026-05-08\/fact-check-report\.json,title=Fact-check must_fix items remain::/);
  assert.match(stdout, /::error file=content\/newsroom\/2026-05-08\/generation-status\.json,title=AI publish readiness is false::/);
  assert.match(stdout, /Publication quality annotation completed/);
});

test('publication quality annotation fails only for CLI or system errors', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writePublicNewsletterArtifacts(root, date);
  writeText(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), '{ invalid json');

  let stdout = '';
  let stderr = '';
  const code = annotatePublicationQualityMain(['--date', date], {
    root,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /Invalid JSON in content\/newsroom\/2026-05-08\/quality-report\.json/);
});

test('publication quality annotation latest mode targets latest only without changed public issue dates', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  const targets = resolveTargetItems(root, { dates: [], all: false, latest: true, targetDates: new Set() });

  assert.deepEqual(targets.map(item => item.date), ['2026-05-08']);
});

test('publication quality annotation changed public issue date wins over latest fallback permission', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  const targets = resolveTargetItems(root, {
    dates: [],
    all: false,
    latest: true,
    targetDates: new Set(['2026-05-07'])
  });

  assert.deepEqual(targets.map(item => item.date), ['2026-05-07']);
});

test('publication quality annotation fails without explicit target or changed public issue date', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  assert.throws(
    () => resolveTargetItems(root, { dates: [], all: false, latest: false, targetDates: new Set() }),
    /No target public issue date detected/
  );
});

test('publication quality annotation CLI fails without target fallback permission', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  let stdout = '';
  let stderr = '';
  const code = annotatePublicationQualityMain([], {
    root,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /No target public issue date detected/);
});

test('publication quality annotation rejects conflicting explicit targets', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-08' }
  ]);

  let stderr = '';
  const code = annotatePublicationQualityMain(['--date', '2026-05-08', '--latest'], {
    root,
    stdout: { write: () => {} },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 1);
  assert.match(stderr, /--latest cannot be combined with --date/);
});

test('publication quality annotation all mode includes historical public issues', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  const targets = resolveTargetItems(root, { dates: [], all: true });

  assert.deepEqual(targets.map(item => item.date), ['2026-05-07', '2026-05-08']);
});

test('publication quality annotation help documents target policy', () => {
  let stdout = '';
  const code = annotatePublicationQualityMain(['--help'], {
    root: tempRoot(),
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: () => {} }
  });

  assert.equal(code, 0);
  assert.match(stdout, /--date YYYY-MM-DD inspects only that public issue/);
  assert.match(stdout, /--all inspects every historical public issue/);
  assert.match(stdout, /Changed public issue dates inspect matching public issue dates, even when --latest is present/);
  assert.match(stdout, /--latest permits fallback to the latest public issue only when no changed public issue date is detected/);
  assert.match(stdout, /no explicit target and no changed public issue date, the command fails/);
});

test('newsroom PR body primary headings are Korean', () => {
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'success',
    status: {
      status: 'PASS',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'PASS',
      quality_score: 90,
      quality_threshold: qualityGatePolicy.threshold,
      selection_publish_ready: true,
      final_publish_ready: true,
      publish_gate_passed: true,
      review_gate_passed: true,
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0
    }
  });

  for (const heading of ['생성 상태', '기사 구성 요약', '최종 후보 선택 상태', '편집자 조치 가이드', '생성 산출물']) {
    assert.match(body, new RegExp(`^## ${heading}$`, 'm'));
  }
  for (const heading of ['Generation Status', 'Composition Summary', 'Editor Action Guidance', 'Generated Artifacts']) {
    assert.doesNotMatch(body, new RegExp(`^## ${heading}$`, 'm'));
  }
});

test('weekly newsroom workflow separates review PR success from publish-ready gate', () => {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', '01-weekly-newsroom-pr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const validatePolicyStep = workflowStep(workflow, 'Validate newsletter policy');
  const checkPolicyDocsStep = workflowStep(workflow, 'Check policy docs');
  const preflightStep = workflowStep(workflow, 'Run unit and regression tests');
  const resolveMetaStep = workflowStep(workflow, 'Resolve newsletter metadata');
  const validateGeneratedSiteStep = workflowStep(workflow, 'Validate generated site');
  const resolveFinalStatusStep = workflowStep(workflow, 'Resolve final publish status');
  const sourceEffectivenessStep = workflowStep(workflow, 'Generate source effectiveness report');
  const preparePrBodyStep = workflowStep(workflow, 'Prepare pull request body');
  const addLabelsStepIndex = workflow.indexOf('- name: Add pull request labels');

  assert.notEqual(addLabelsStepIndex, -1);
  assertTextInOrder(workflow, [
    '- name: Apply manual LLM overrides',
    '- name: Doctor runtime config',
    '- name: Validate newsletter policy',
    '- name: Check policy docs',
    '- name: Run unit and regression tests',
    '- name: Jitter scheduled run'
  ]);
  assertTextInOrder(workflow, [
    '- name: Resolve final publish status',
    '- name: Prepare pull request body',
    '- name: Create pull request'
  ]);
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
  assert.match(resolveMetaStep, /node scripts\/resolve-reviewable-artifacts\.js >> "\$GITHUB_OUTPUT"/);
  assert.match(validateGeneratedSiteStep, /if: steps\.meta\.outputs\.has_public_artifacts == 'true'/);
  assert.match(workflow, /newsletter/);
  assert.match(workflow, /aosp-camera/);
  assert.match(workflow, /editor-review/);
  assert.match(workflow, /needs-fix/);
  assert.match(workflow, /fallback-composition/);
  assert.match(workflow, /thin-week/);
  assert.match(workflow, /publish-ready/);
  assert.match(workflow, /const stateLabels = \['publish-ready', 'needs-fix', 'fallback-composition', 'thin-week'\];/);
  assert.match(workflow, /github\.rest\.issues\.removeLabel/);
  assert.match(workflow, /- name: Resolve final publish status/);
  assert.match(workflow, /id: final-publish-status/);
  assert.match(workflow, /node scripts\/write-publish-status-output\.js >> "\$GITHUB_OUTPUT"/);
  assert.match(resolveFinalStatusStep, /if: steps\.meta\.outputs\.has_public_artifacts == 'true'/);
  assert.match(resolveFinalStatusStep, /VALIDATE_OUTCOME: \$\{\{ steps\.validate\.outcome \|\| 'skipped' \}\}/);
  assert.match(sourceEffectivenessStep, /if: always\(\) && steps\.meta\.outputs\.has_public_artifacts == 'true'/);
  assert.match(preparePrBodyStep, /if: steps\.meta\.outputs\.has_reviewable_artifacts == 'true'/);
  assert.match(preparePrBodyStep, /VALIDATE_OUTCOME: \$\{\{ steps\.validate\.outcome \|\| 'skipped' \}\}/);
  assert.match(workflow, /node scripts\/build-newsroom-pr-body\.js > \.tmp\/newsroom-pr-body\.md/);
  assert.match(workflow, /node scripts\/validate-pr-body\.js \.tmp\/newsroom-pr-body\.md --date "\$\{\{ steps\.meta\.outputs\.date \}\}"/);
  assert.match(workflow, /cat \.tmp\/newsroom-pr-body\.md/);
  assert.match(workflow, /const hasAiPublishReady = '\$\{\{ steps\.final-publish-status\.outputs\.has_ai_publish_ready \}\}' === 'true';/);
  assert.match(workflow, /const compositionMode = '\$\{\{ steps\.final-publish-status\.outputs\.composition_mode \}\}';/);
  assert.doesNotMatch(workflow, /steps\.meta\.outputs\.has_publish_candidate/);
  assert.doesNotMatch(workflow.slice(addLabelsStepIndex), /steps\.generation-status\.outputs\.final_publish_ready/);
  assert.doesNotMatch(workflow.slice(addLabelsStepIndex), /validationPassed/);
  assert.match(workflow, /compositionMode === 'FALLBACK_COMPOSITION'/);
  assert.match(workflow, /compositionMode === 'THIN_WEEK_REVIEW'/);
  assert.match(workflow, /Fail if reviewable newsroom artifacts were not created/);
  assert.match(workflow, /steps\.meta\.outputs\.has_reviewable_artifacts != 'true'/);
  assert.doesNotMatch(workflow, /final_publish_ready != 'true'/);
  assert.doesNotMatch(
    workflow,
    new RegExp(`fromJSON\\(steps\\.generation-status\\.outputs\\.final_selected_article_count_for_gate\\) < ${articlePolicy.mainArticleCount.min}`)
  );
});

test('generation path guards public artifacts for editorial reviewable failures', () => {
  const generatorPath = path.join(__dirname, '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js');
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

test('validate-site uses shared rendered issue structural validator', () => {
  const validateSitePath = path.join(__dirname, '..', 'scripts', 'newsroom', 'cli', 'validate-site.js');
  const validateSite = fs.readFileSync(validateSitePath, 'utf8');

  assert.match(validateSite, /validateRenderedIssueStructure/);
  assert.match(validateSite, /rendered-issue-structure/);
});

test('site validation workflow keeps structural checks blocking and quality annotations non-blocking', () => {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', '02-validate-site.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const structuralStep = workflowStep(workflow, 'Validate structural publication artifacts');
  const annotationStep = workflowStep(workflow, 'Annotate publication quality and fact-check status');

  assertTextInOrder(workflow, [
    '- name: Validate structural publication artifacts',
    '- name: Annotate publication quality and fact-check status'
  ]);
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
});
