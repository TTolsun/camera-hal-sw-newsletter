'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildGenerationStatusOutputs
} = require('../../../generator/publish/write-generation-status-output');
const {
  articlePolicy,
  qualityGatePolicy
} = require('../../common/newsletter-policy');
const {
  buildReviewableArtifactOutputs,
  REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS,
  REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_RAW_ARTIFACT_VALIDATION_REVIEWABLE_ARTIFACTS,
  requiredPublicFiles,
  resolveReviewableArtifacts
} = require('../../../generator/publish/resolve-reviewable-artifacts');
const {
  ensurePublicNewsletterArtifacts
} = require('../../../generator/publish/ensure-public-newsletter-artifacts');
const {
  removeNewsletterIndexEntry
} = require('../../../generator/publish/public-state-reconciliation');
const {
  tempRoot: fsTempRoot,
  writeJson,
  writeText
} = require('../helpers/fs');
const {
  writeArchiveSyncSurface,
  writeCandidateShortageReviewableArtifacts,
  writeEditorialReviewableArtifacts,
  writeFailedRawArtifactValidationArtifacts,
  writeFailedRepairReviewableArtifacts,
  writeMinimalPublishArtifacts,
  writePublicNewsletterArtifacts
} = require('../helpers/workflow-fixtures');

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

test('FAILED_EDITOR_REVIEWABLE is reviewable from the pre-editor selection artifacts (no editor draft required)', () => {
  // The editor can hard-fail before any valid draft exists; the daily job must still produce a
  // diagnostics PR from the deterministic selection artifacts instead of crashing.
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-09';
  writeCandidateShortageReviewableArtifacts(root, date, {
    status: { status: 'FAILED_EDITOR_REVIEWABLE', failure_kind: 'editor_failed_reviewable' }
  });

  const changedArtifacts = ['generation-status.json', 'shortlisted-candidates.json', 'selection-report.json', 'selection-diagnostics.md', 'article-capsules.json']
    .map(file => `articles/content/newsroom/${date}/${file}`);
  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({ root, changedArtifacts }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.diagnostics_only, 'true');
});

test('reviewable artifact resolver does not accept tmp status alone', () => {
  const root = fsTempRoot('newsroom-pr-body-');
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
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'NEEDS_FIX',
    final_publish_ready: false
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), {
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
  const root = fsTempRoot('newsroom-pr-body-');
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
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `articles/content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.equal(outputs.review_publication_ready, 'false');
  assert.equal(outputs.homepage_visible_after_merge, 'false');
  assert.equal(outputs.publish_candidate_ready, 'false');
  assert.equal(outputs.changed_artifact_count, String(REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.length));
  assert.match(outputs.reviewable_artifact_reason, /failure_kind=editorial_reviewable/);
  assert.match(outputs.reviewable_artifact_reason, /editorial_reject=none/);
});

test('reviewable artifact resolver keeps editorial handoff reviewable without the best-effort HAL signal report', () => {
  // #503: the HAL signal quality report is produced by a separate continue-on-error workflow step,
  // not the generator, so its absence must not collapse a genuine editorial-review draft into a
  // non-reviewable (job-failing) state.
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date, { writeHalSignalQuality: false });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `articles/content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.match(outputs.reviewable_artifact_reason, /editorial_reject=none/);
  assert.doesNotMatch(outputs.reviewable_artifact_reason, /missing_editorial_required=.*hal-signal-quality-report/);
});

test('reviewable artifact resolver accepts editorial reviewable public and data writes when structurally ready', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `articles/content/newsroom/${date}/${file}`)
      .concat([
        `articles/newsletters/${date}/newsletter.md`,
        `articles/newsletters/${date}/index.html`,
        'articles/data/newsletters.json'
      ])
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'true');
  assert.equal(outputs.has_required_public_newsletter_files, 'true');
  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.has_publish_candidate, 'true');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'false');
  assert.equal(outputs.diagnostics_only, 'false');
  assert.equal(outputs.review_publication_ready, 'true');
  assert.equal(outputs.homepage_visible_after_merge, 'true');
  assert.equal(outputs.publish_candidate_ready, 'true');
  assert.match(outputs.reviewable_artifact_reason, /public_newsletter_ready=true/);
  assert.doesNotMatch(outputs.public_newsletter_reason, /quality|final_publish_ready|repair|shortage/);
});

test('review artifact advisory metadata does not change publish readiness resolver output', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'artifact-manifest.json'), {
    schema_version: 2,
    date,
    files: [],
    review_artifacts: [{
      path: `articles/newsletters/${date}/newsletter.md`,
      present: false,
      group: 'public_output',
      role: 'public_markdown',
      required: 'when_public_output',
      requiredActive: true,
      review_blocking: true,
      review_attention_required: true,
      review_order: 30
    }],
    missing_required_review_artifacts: [`articles/newsletters/${date}/newsletter.md`]
  });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `articles/content/newsroom/${date}/${file}`)
      .concat([
        `articles/content/newsroom/${date}/artifact-manifest.json`,
        `articles/newsletters/${date}/newsletter.md`,
        `articles/newsletters/${date}/index.html`,
        'articles/data/newsletters.json'
      ])
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'true');
  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.publish_candidate_ready, 'true');
  assert.equal(outputs.review_publication_ready, 'true');
  assert.equal(outputs.homepage_visible_after_merge, 'true');
  assert.doesNotMatch(outputs.public_newsletter_reason, /review_blocking|review_attention|required_review/);
});

test('reviewable artifact resolver accepts string booleans for review publication readiness', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date, {
    status: {
      final_publish_ready: 'false',
      review_gate_passed: 'true',
      editor_review_required: 'true'
    }
  });
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `articles/content/newsroom/${date}/${file}`)
      .concat([
        `articles/newsletters/${date}/newsletter.md`,
        `articles/newsletters/${date}/index.html`,
        'articles/data/newsletters.json'
      ])
  }));

  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.review_publication_ready, 'true');
  assert.equal(outputs.homepage_visible_after_merge, 'true');
});

test('reviewable artifact resolver rejects editorial reviewable invalid canonical artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date, {
    generationStatus: {
      failure_kind: 'wrong_kind'
    }
  });

  let outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `articles/content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical_failure_kind=wrong_kind/);

  writeText(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), '{ invalid json');
  outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `articles/content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical_generation_status=invalid/);
  assert.match(outputs.reviewable_artifact_reason, /invalid_editorial_required=/);

  const missingRoot = fsTempRoot('newsroom-pr-body-');
  writeEditorialReviewableArtifacts(missingRoot, date, { writeQuality: false });
  outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root: missingRoot,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `articles/content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /missing_editorial_required=quality-report\.json/);
});

test('reviewable artifact resolver accepts candidate shortage reviewable handoff without LLM artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-11';
  writeCandidateShortageReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS
      .map(file => `articles/content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'false');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.equal(outputs.review_publication_ready, 'false');
  assert.equal(outputs.homepage_visible_after_merge, 'false');
  assert.equal(outputs.publish_candidate_ready, 'false');
  assert.equal(outputs.changed_artifact_count, String(REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS.length));
  assert.match(outputs.reviewable_artifact_reason, /failure_kind=candidate_shortage_reviewable/);
  assert.match(outputs.reviewable_artifact_reason, /candidate_shortage_reject=none/);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json')), false);
});

test('reviewable artifact resolver reports fallback_public contract conflicts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-15';
  writePublicNewsletterArtifacts(root, date);
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'NEEDS_FIX',
    final_publish_ready: false,
    review_gate_passed: true,
    editor_review_required: true,
    publication_mode: 'fallback_public',
    homepage_visibility: 'visible_with_fallback_badge',
    fallback_only: false,
    camera_anchor_count: 1,
    fallback_public_ready: true
  });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  }));

  assert.notEqual(outputs.publication_contract_error_count, '0');
  assert.match(outputs.publication_contract_errors, /fallback_only=true/);
  assert.match(outputs.publication_contract_errors, /camera_anchor_count=0/);
  assert.match(outputs.reviewable_artifact_reason, /publication_contract_errors=/);
});

test('reviewable artifact resolver rejects candidate shortage when deterministic artifact is missing', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-11';
  writeCandidateShortageReviewableArtifacts(root, date, { writeArticleCapsules: false });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS
      .filter(file => file !== 'article-capsules.json')
      .map(file => `articles/content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /failure_kind=candidate_shortage_reviewable/);
  assert.match(outputs.reviewable_artifact_reason, /missing_candidate_shortage_required=article-capsules\.json/);
});

test('reviewable artifact resolver rejects failed repair with repair-failure only', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    publish_ready: false,
    selection_publish_ready: false,
    final_publish_ready: false,
    publish_gate_passed: false
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'repair-failure.json'), {
    message: 'Editor output must contain 3-5 sections; got 2.'
  });

  const resolved = resolveReviewableArtifacts({
    root,
    changedArtifacts: [`articles/content/newsroom/${date}/repair-failure.json`]
  });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(outputs.date, date);
  assert.equal(outputs.branch, `newsletter/${date}`);
  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /status=FAILED_REPAIR_REVIEWABLE/);
  assert.match(outputs.reviewable_artifact_reason, /repair-failure\.json/);
  assert.match(outputs.reviewable_artifact_reason, /missing_required=/);
  for (const required of REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.filter(file => file !== 'repair-failure.json')) {
    assert.match(outputs.reviewable_artifact_reason, new RegExp(required.replace('.', '\\.')));
  }
});

test('reviewable artifact resolver rejects complete failed repair when only tmp state changed', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: []
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.equal(outputs.changed_artifact_count, '0');
  assert.match(outputs.reviewable_artifact_reason, /changed=none/);
});

test('reviewable artifact resolver accepts complete changed failed repair artifact set', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), '# draft\n');

  const resolved = resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.map(file => `articles/content/newsroom/${date}/${file}`)
      .concat(`articles/newsletters/${date}/newsletter.md`)
  });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.equal(outputs.review_publication_ready, 'false');
  assert.equal(outputs.homepage_visible_after_merge, 'false');
  assert.equal(outputs.publish_candidate_ready, 'false');
  assert.equal(outputs.changed_artifact_count, String(REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.length + 1));
  assert.match(outputs.reviewable_artifact_reason, /missing_required=none/);
});

test('reviewable artifact resolver treats legacy quality failures as public-ready when public files are valid', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'QUALITY_NEEDS_FIX',
    final_publish_ready: false
  });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), {
    date,
    sections: []
  });
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: [
      `articles/content/newsroom/${date}/editor-draft.json`,
      `articles/newsletters/${date}/newsletter.md`,
      `articles/newsletters/${date}/index.html`,
      'articles/data/newsletters.json'
    ]
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'true');
  assert.equal(outputs.has_required_public_newsletter_files, 'true');
  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.has_ai_publish_ready, 'false');
  assert.equal(outputs.has_publish_candidate, 'true');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'false');
  assert.equal(outputs.diagnostics_only, 'false');
  assert.equal(outputs.review_publication_ready, 'false');
  assert.equal(outputs.homepage_visible_after_merge, 'true');
  assert.equal(outputs.publish_candidate_ready, 'true');
  assert.match(outputs.reviewable_artifact_reason, /public_newsletter_ready=true/);
  assert.doesNotMatch(outputs.public_newsletter_reason, /quality|final_publish_ready|repair|shortage/);
});

test('reviewable artifact resolver does not treat FAILED status as a publish candidate', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED'
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'repair-failure.json'), {
    message: 'terminal failure'
  });
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), '# stale draft\n');

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: [
      `articles/content/newsroom/${date}/repair-failure.json`,
      `articles/newsletters/${date}/newsletter.md`
    ]
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
});

test('public newsletter readiness requires every public file in changed artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts: [
      `articles/newsletters/${date}/newsletter.md`,
      'articles/data/newsletters.json'
    ]
  }));

  assert.equal(outputs.has_required_public_newsletter_files, 'true');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.public_newsletter_reason, /required public files not changed/);
});

test('public newsletter readiness requires valid data/newsletters.json entry for public files', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writePublicNewsletterArtifacts(root, date);

  for (const [label, newsletters, expectedReason] of [
    ['missing date entry', [], /articles\/data\/newsletters\.json missing date entry/],
    ['path mismatch', [{
      date,
      title: 'Camera HAL / SW Newsletter',
      summary: 'Path mismatch fixture',
      html: `newsletters/${date}/wrong-index.html`,
      md: `newsletters/${date}/wrong-newsletter.md`,
      tags: ['Camera HAL']
    }], /articles\/data\/newsletters\.json html path mismatch|articles\/data\/newsletters\.json md path mismatch/]
  ]) {
    writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), newsletters);

    const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
      root,
      date,
      changedArtifacts: requiredPublicFiles(date)
    }));

    assert.equal(outputs.has_required_public_newsletter_files, 'false', label);
    assert.equal(outputs.public_newsletter_ready, 'false', label);
    assert.equal(outputs.has_publish_candidate, 'false', label);
    assert.match(outputs.public_newsletter_reason, expectedReason, label);
  }
});

test('root wrapper CLIs expose review handoff outputs', () => {
  const repoRoot = path.join(__dirname, '..', '..', '..', '..');
  const date = '2026-05-10';
  const resolveRoot = fsTempRoot('newsroom-pr-body-');
  execFileSync('git', ['init'], { cwd: resolveRoot, stdio: 'ignore' });
  writeFailedRepairReviewableArtifacts(resolveRoot, date);

  const resolveOutput = execFileSync(
    process.execPath,
    [path.join(repoRoot, 'src', 'generator', 'publish', 'resolve-reviewable-artifacts.js')],
    { cwd: resolveRoot, encoding: 'utf8' }
  );

  assert.match(resolveOutput, /review_pr_ready=true/);
  assert.match(resolveOutput, /review_only=true/);
  assert.match(resolveOutput, /diagnostics_only=true/);
  assert.match(resolveOutput, /review_publication_ready=false/);
  assert.match(resolveOutput, /homepage_visible_after_merge=false/);
  assert.match(resolveOutput, /publish_candidate_ready=false/);
  assert.match(resolveOutput, /changed_artifact_count=\d+/);

  const ensureRoot = fsTempRoot('newsroom-pr-body-');
  execFileSync('git', ['init'], { cwd: ensureRoot, stdio: 'ignore' });
  writeMinimalPublishArtifacts(ensureRoot, date, {
    finalPublishReady: true,
    status: {
      final_publish_ready: true,
      validate_ok: true
    }
  });
  writePublicNewsletterArtifacts(ensureRoot, date);
  writeArchiveSyncSurface(ensureRoot);

  const ensureOutput = execFileSync(
    process.execPath,
    [
      path.join(repoRoot, 'src', 'generator', 'publish', 'ensure-public-newsletter-artifacts.js'),
      '--date',
      date,
      '--no-build'
    ],
    { cwd: ensureRoot, encoding: 'utf8' }
  );

  assert.match(ensureOutput, /review_pr_ready=true/);
  assert.match(ensureOutput, /review_only=false/);
  assert.match(ensureOutput, /diagnostics_only=false/);
  assert.match(ensureOutput, /review_publication_ready=false/);
  assert.match(ensureOutput, /homepage_visible_after_merge=true/);
  assert.match(ensureOutput, /publish_candidate_ready=true/);
  assert.match(ensureOutput, /changed_artifact_count=\d+/);
});

test('reviewable artifact resolver accepts FAILED_RAW_ARTIFACT_VALIDATION with generation-status in changed artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRawArtifactValidationArtifacts(root, date);

  const resolved = resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_FAILED_RAW_ARTIFACT_VALIDATION_REVIEWABLE_ARTIFACTS
      .map(file => `articles/content/newsroom/${date}/${file}`)
  });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.match(outputs.reviewable_artifact_reason, /status=FAILED_RAW_ARTIFACT_VALIDATION/);
  assert.match(outputs.reviewable_artifact_reason, /missing_required=none/);
  assert.match(outputs.reviewable_artifact_reason, /raw_artifact_validation_error_field=merged_candidate_manifest/);
  assert.match(outputs.reviewable_artifact_reason, /raw_artifact_validation_error_value=/);
});

test('reviewable artifact resolver rejects FAILED_RAW_ARTIFACT_VALIDATION when generation-status absent from changed artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED_RAW_ARTIFACT_VALIDATION',
    final_publish_ready: false
  });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);

  const resolved = resolveReviewableArtifacts({
    root,
    changedArtifacts: []
  });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(outputs.review_pr_ready, 'false');
  assert.match(outputs.reviewable_artifact_reason, /status=FAILED_RAW_ARTIFACT_VALIDATION/);
  assert.match(outputs.reviewable_artifact_reason, /generation-status\.json/);
  assert.match(outputs.reviewable_artifact_reason, /missing_required=/);
});

test('un-exposing the newsletters.json entry downgrades a structurally-ready run to reviewable-but-not-published', () => {
  // Guards the generator behaviour: when a publishable draft (quality/fact PASS) fails
  // deterministic publish validation, the generator removes the newsletters.json entry it
  // already wrote and downgrades to a diagnostics-only review PR instead of a terminal
  // failure. The resulting state must still create a review PR but must never publish.
  const root = fsTempRoot('newsroom-unexpose-');
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);
  const changedArtifacts = REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
    .map(file => `articles/content/newsroom/${date}/${file}`)
    .concat([
      `articles/newsletters/${date}/newsletter.md`,
      `articles/newsletters/${date}/index.html`,
      'articles/data/newsletters.json'
    ]);

  const exposed = buildReviewableArtifactOutputs(resolveReviewableArtifacts({ root, changedArtifacts }));
  assert.equal(exposed.public_newsletter_ready, 'true');
  assert.equal(exposed.homepage_visible_after_merge, 'true');

  removeNewsletterIndexEntry(root, date);

  const unexposed = buildReviewableArtifactOutputs(resolveReviewableArtifacts({ root, changedArtifacts }));
  assert.equal(unexposed.review_pr_ready, 'true', 'un-exposed run still produces a reviewable PR');
  assert.equal(unexposed.public_newsletter_ready, 'false', 'un-exposed newsletter is not publish-ready');
  assert.equal(unexposed.homepage_visible_after_merge, 'false', 'merging an un-exposed run must not publish');
  assert.equal(unexposed.diagnostics_only, 'true');
});

// #905: 독자가 여는 주간 페이지의 구조 검사가 발행 시점에 돈다. 다만 판정은 관측으로만 남고
// 발행 여부를 바꾸지 않는다. 주간 규칙이 발행 경로에 걸리는 것은 이번이 처음이라, 어떤 실패가
// 실제로 나오는지 보기 전에 차단을 걸면 발행 가능한 호를 막는다.
//
// 아래 단언들이 그 계약이다. 하나라도 뒤집히면 이 변경의 성격이 관측에서 게이트로 바뀐다.
const WEEKLY_OBSERVATION_KEY = '2026-W37';

function stageWeeklyIssueForObservation(root, date, { html } = {}) {
  const repoRoot = path.join(__dirname, '..', '..', '..', '..');
  const issueDir = path.join(root, 'articles', 'newsletters', WEEKLY_OBSERVATION_KEY);
  fs.mkdirSync(issueDir, { recursive: true });
  for (const file of ['newsletter.md', 'issue.json']) {
    writeText(
      path.join(issueDir, file),
      fs.readFileSync(path.join(repoRoot, 'articles', 'newsletters', WEEKLY_OBSERVATION_KEY, file), 'utf8')
    );
  }
  const publishedHtml = fs.readFileSync(
    path.join(repoRoot, 'articles', 'newsletters', WEEKLY_OBSERVATION_KEY, 'index.html'),
    'utf8'
  );
  writeText(path.join(issueDir, 'index.html'), html ? html(publishedHtml) : publishedHtml);

  // fallback 이미지 계약은 파일 존재까지 본다. 이것을 빠뜨리면 정상 페이지도 errors가 되어,
  // 아래 "깨진 페이지" 단언이 주입한 결함과 무관하게 통과한다.
  const fallbackRelative = 'articles/assets/images/fallback/newsletter-default.svg';
  const fallbackTarget = path.join(root, fallbackRelative);
  fs.mkdirSync(path.dirname(fallbackTarget), { recursive: true });
  writeText(fallbackTarget, fs.readFileSync(path.join(repoRoot, fallbackRelative), 'utf8'));

  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{
    weeklyKey: WEEKLY_OBSERVATION_KEY,
    date,
    title: `Camera HAL / SW Newsletter - ${WEEKLY_OBSERVATION_KEY}`,
    summary: 'Weekly issue summary',
    html: `newsletters/${WEEKLY_OBSERVATION_KEY}/index.html`,
    md: `newsletters/${WEEKLY_OBSERVATION_KEY}/newsletter.md`,
    tags: ['Camera HAL']
  }]);
}

function weeklyObservationChangedArtifacts(date) {
  return REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
    .map(file => `articles/content/newsroom/${date}/${file}`)
    .concat([
      `articles/newsletters/${date}/newsletter.md`,
      `articles/newsletters/${date}/index.html`,
      'articles/data/newsletters.json'
    ]);
}

test('a broken weekly page is observed but does not change the publish decision (#905)', () => {
  const date = '2026-09-07';

  // 먼저 손대지 않은 발행본이 ok인지 본다. 이 단언이 없으면 아래 errors 단언이 주입한 결함이
  // 아니라 픽스처 자체의 결손으로도 통과한다.
  const healthyRoot = fsTempRoot('weekly-structure-healthy');
  writeMinimalPublishArtifacts(healthyRoot, date);
  writePublicNewsletterArtifacts(healthyRoot, date);
  writeArchiveSyncSurface(healthyRoot);
  stageWeeklyIssueForObservation(healthyRoot, date);
  const healthy = resolveReviewableArtifacts({
    root: healthyRoot,
    changedArtifacts: weeklyObservationChangedArtifacts(date)
  });
  assert.deepEqual(healthy.weeklyStructure.errors, []);
  assert.equal(healthy.weeklyStructure.status, 'ok');

  // 같은 픽스처에서 anchor 균형만 무너뜨린다.
  const brokenRoot = fsTempRoot('weekly-structure-observation');
  writeMinimalPublishArtifacts(brokenRoot, date);
  writePublicNewsletterArtifacts(brokenRoot, date);
  writeArchiveSyncSurface(brokenRoot);
  stageWeeklyIssueForObservation(brokenRoot, date, { html: published => `${published}<a href="#dangling">` });
  const broken = resolveReviewableArtifacts({
    root: brokenRoot,
    changedArtifacts: weeklyObservationChangedArtifacts(date)
  });

  assert.equal(broken.weeklyStructure.weeklyKey, WEEKLY_OBSERVATION_KEY);
  assert.equal(broken.weeklyStructure.status, 'errors', '주입한 anchor 결함이 관측되어야 한다.');
  assert.ok(
    broken.weeklyStructure.errors.some(error => /Anchor tag mismatch/.test(error)),
    `주입한 결함이 잡혀야 한다. 실제 오류: ${JSON.stringify(broken.weeklyStructure.errors)}`
  );
  assert.equal(
    broken.publicNewsletterReady,
    healthy.publicNewsletterReady,
    '주간 구조 실패는 발행 판정을 바꾸지 않는다. 이 단언이 깨지면 관측이 게이트로 변한 것이다.'
  );
});

// 관측 값이 메모리에만 있으면 이 변경은 아무것도 남기지 않는다. 이 저장소에는 새 필드가
// 중간 관문에서 조용히 사라진 전례가 있다(seriesId). 그래서 파일까지 확인한다.
test('the weekly observation reaches the committed generation status (#905)', () => {
  const date = '2026-09-07';
  const root = fsTempRoot('weekly-structure-status-file');
  writeMinimalPublishArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);
  writeArchiveSyncSurface(root);
  stageWeeklyIssueForObservation(root, date, { html: published => `${published}<a href="#dangling">` });

  ensurePublicNewsletterArtifacts({ root, date, changedArtifacts: weeklyObservationChangedArtifacts(date) });

  const status = JSON.parse(fs.readFileSync(
    path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'),
    'utf8'
  ));
  assert.equal(status.weekly_page_structure_status, 'errors');
  assert.equal(status.weekly_page_structure_key, WEEKLY_OBSERVATION_KEY);
  assert.ok(Array.isArray(status.weekly_page_structure_errors));
  assert.ok(status.weekly_page_structure_errors.length > 0);
});

// 발행 경로 전체가 관측 하나 때문에 죽으면 안 된다. weeklyKeyForDate는 YYYY-MM-DD가 아니면
// throw하고, resolveDate가 고르는 값은 형식 검증을 받지 않는다.
test('an unparseable date does not take the whole resolver down (#905)', () => {
  const root = fsTempRoot('weekly-structure-bad-date');

  const resolved = resolveReviewableArtifacts({ root, date: 'unknown' });

  assert.equal(resolved.weeklyStructure.status, 'not_written');
  assert.equal(resolved.weeklyStructure.weeklyKey, '');
});

test('a run without weekly artifacts reports not_written rather than a failure (#905)', () => {
  const root = fsTempRoot('weekly-structure-absent');
  const date = '2026-09-07';

  writeMinimalPublishArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);
  writeArchiveSyncSurface(root);

  const resolved = resolveReviewableArtifacts({ root });

  // reviewable 실행은 주간 산출물을 아예 쓰지 않는다. 그것은 그 실행의 정상 결과다.
  assert.equal(resolved.weeklyStructure.status, 'not_written');
  assert.deepEqual(resolved.weeklyStructure.errors, []);
});
