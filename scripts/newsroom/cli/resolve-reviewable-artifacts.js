const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  kstDate
} = require('../common/common');
const {
  readJsonIfExists
} = require('../common/json');
const {
  readStatus,
  renderGithubOutputs
} = require('./write-generation-status-output');
const {
  REQUIRED_PUBLIC_NEWSLETTER_FILES,
  newsletterIndexDateStatus,
  publicNewsletterStructureStatus,
  requiredPublicFiles
} = require('../common/public-structure');

const STATUS_FAILED_REPAIR_REVIEWABLE = 'FAILED_REPAIR_REVIEWABLE';
const STATUS_FAILED_RAW_ARTIFACT_VALIDATION = 'FAILED_RAW_ARTIFACT_VALIDATION';
const FAILURE_KIND_EDITORIAL_REVIEWABLE = 'editorial_reviewable';
const FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE = 'candidate_shortage_reviewable';

const REVIEWABLE_STATUSES = new Set([
  'PASS',
  'NEEDS_FIX',
  'QUALITY_NEEDS_FIX',
  'UNDERFILLED_NEEDS_FIX',
  STATUS_FAILED_REPAIR_REVIEWABLE,
  STATUS_FAILED_RAW_ARTIFACT_VALIDATION
]);

const CANONICAL_REVIEW_ARTIFACTS = [
  'editor-draft.json',
  'fact-check-report.json',
  'quality-report.json',
  'hal-signal-quality-report.json',
  'hal-signal-quality-report.md',
  'generation-status.json',
  'retry-history.json',
  'repair-failure.json',
  'recovery-prompt.md',
  'shortlisted-candidates.json',
  'article-capsules.json',
  'background-context.json',
  'selection-report.json',
  'selection-diagnostics.md'
];

// hal-signal-quality-report.* is produced by a separate best-effort (continue-on-error)
// workflow step, not by the generator, so it must not gate reviewability (#503). It stays in
// CANONICAL_REVIEW_ARTIFACTS so it is still bundled into the review PR when present.
const REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS = [
  'editor-draft.json',
  'quality-report.json',
  'fact-check-report.json',
  'repair-failure.json',
  'generation-status.json'
];

// Raw artifact validation fails before any LLM step, so only generation-status is guaranteed.
const REQUIRED_FAILED_RAW_ARTIFACT_VALIDATION_REVIEWABLE_ARTIFACTS = [
  'generation-status.json'
];

const REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS = [
  'editor-draft.json',
  'quality-report.json',
  'fact-check-report.json',
  'generation-status.json'
];

const REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS = [
  'generation-status.json',
  'shortlisted-candidates.json',
  'selection-report.json',
  'selection-diagnostics.md',
  'article-capsules.json'
];

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
}

function readTextResult(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, text: '', error: null };
  }
  try {
    return { exists: true, text: fs.readFileSync(filePath, 'utf8'), error: null };
  } catch (error) {
    return { exists: true, text: '', error };
  }
}

function toRepoPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function isTrue(value) {
  return value === true || value === 'true';
}

function isFalse(value) {
  return value === false || value === 'false';
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGitStatusPorcelain(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(line => {
      const rawPath = line.slice(3).trim();
      const renameIndex = rawPath.lastIndexOf(' -> ');
      const currentPath = renameIndex >= 0 ? rawPath.slice(renameIndex + 4) : rawPath;
      return toRepoPath(currentPath.replace(/^"|"$/g, ''));
    })
    .filter(Boolean);
}

function getChangedRepoVisibleArtifacts({ root = process.cwd(), date } = {}) {
  if (!date) return [];
  try {
    const output = execFileSync(
      'git',
      [
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--',
        `content/newsroom/${date}`,
        `newsletters/${date}`,
        'data/newsletters.json'
      ],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );
    return parseGitStatusPorcelain(output);
  } catch (_) {
    return [];
  }
}

function resolveDate({ root, status, explicitDate } = {}) {
  if (explicitDate) return explicitDate;
  if (status?.date) return status.date;
  const dateFile = readTextIfExists(path.join(root, '.tmp', 'newsletter-date.txt'));
  if (dateFile) return dateFile;
  if (process.env.NEWSLETTER_DATE) return process.env.NEWSLETTER_DATE;
  return kstDate();
}

function existingArtifacts(root, date, relativeFiles) {
  return relativeFiles
    .map(relativeFile => relativeFile.replaceAll('${date}', date))
    .filter(relativeFile => fs.existsSync(path.join(root, relativeFile)));
}

function artifactJsonReadResults(root, date, artifactNames) {
  return Object.fromEntries(artifactNames.map(name => [
    name,
    readJsonIfExists(path.join(root, 'content', 'newsroom', date, name))
  ]));
}

function artifactReadResults(root, date, artifactNames) {
  return Object.fromEntries(artifactNames.map(name => {
    const filePath = path.join(root, 'content', 'newsroom', date, name);
    if (name.endsWith('.json')) {
      return [name, readJsonIfExists(filePath)];
    }
    return [name, readTextResult(filePath)];
  }));
}

function missingArtifacts(results) {
  return Object.entries(results)
    .filter(([, result]) => !result.exists)
    .map(([name]) => name);
}

function invalidArtifacts(results) {
  return Object.entries(results)
    .filter(([, result]) => result.error)
    .map(([name, result]) => `${name}: ${result.error.message}`);
}

function relevantChangedArtifacts(changedArtifacts, date) {
  return [...new Set((Array.isArray(changedArtifacts) ? changedArtifacts : [])
    .map(toRepoPath)
    .filter(filePath =>
      filePath.startsWith(`content/newsroom/${date}/`) ||
      filePath.startsWith(`newsletters/${date}/`) ||
      filePath === 'data/newsletters.json'
    ))].sort();
}

function resolveReviewableArtifacts(options = {}) {
  const root = options.root || process.cwd();
  const statusPath = options.statusPath || path.join(root, '.tmp', 'newsletter-generation-status.json');
  const status = options.status || readStatus(statusPath);
  const date = resolveDate({ root, status, explicitDate: options.date });
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const branch = options.branch || `newsletter/${date}`;
  const canonicalArtifacts = fs.existsSync(newsroomDir)
    ? CANONICAL_REVIEW_ARTIFACTS.filter(file => fs.existsSync(path.join(newsroomDir, file)))
    : [];
  const requiredPublicArtifacts = requiredPublicFiles(date);
  const publicArtifacts = existingArtifacts(root, date, REQUIRED_PUBLIC_NEWSLETTER_FILES);
  const publicStructure = publicNewsletterStructureStatus(root, date);
  const newsletterIndex = newsletterIndexDateStatus(root, date);
  const changedArtifacts = Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')
    ? relevantChangedArtifacts(options.changedArtifacts, date)
    : relevantChangedArtifacts(getChangedRepoVisibleArtifacts({ root, date }), date);
  const hasCanonicalDiagnostic = canonicalArtifacts.length > 0;
  const statusReviewable = REVIEWABLE_STATUSES.has(status.status);
  const failedRepairReviewable = status.status === STATUS_FAILED_REPAIR_REVIEWABLE;
  const failedRawArtifactValidationReviewable = status.status === STATUS_FAILED_RAW_ARTIFACT_VALIDATION;
  const changedRequiredPublicArtifacts = requiredPublicArtifacts.filter(filePath => changedArtifacts.includes(filePath));
  const editorialArtifacts = artifactReadResults(root, date, REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS);
  const editorialGenerationStatus = editorialArtifacts['generation-status.json'];
  const candidateShortageArtifacts = artifactReadResults(root, date, REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS);
  const candidateShortageGenerationStatus = candidateShortageArtifacts['generation-status.json'];
  const statusValues = [status.status, editorialGenerationStatus.value?.status].filter(Boolean);
  const failureKinds = [
    status.failure_kind,
    editorialGenerationStatus.value?.failure_kind,
    candidateShortageGenerationStatus.value?.failure_kind
  ].filter(Boolean);
  const candidateShortageRequested = failureKinds.includes(FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE);
  const editorialStatus = statusValues.some(value => value === 'NEEDS_FIX' || value === 'QUALITY_NEEDS_FIX');
  const editorialReviewableRequested =
    status.failure_kind === FAILURE_KIND_EDITORIAL_REVIEWABLE ||
    editorialGenerationStatus.value?.failure_kind === FAILURE_KIND_EDITORIAL_REVIEWABLE ||
    editorialStatus;
  const editorialMissingRequired = missingArtifacts(editorialArtifacts);
  const editorialInvalidArtifacts = invalidArtifacts(editorialArtifacts);
  const candidateShortageMissingRequired = missingArtifacts(candidateShortageArtifacts);
  const candidateShortageInvalidArtifacts = invalidArtifacts(candidateShortageArtifacts);
  const candidateShortageRejectReasons = [];
  if (candidateShortageRequested) {
    if (!candidateShortageGenerationStatus.exists) {
      candidateShortageRejectReasons.push('candidate_shortage_generation_status=missing');
    } else if (candidateShortageGenerationStatus.error) {
      candidateShortageRejectReasons.push(`candidate_shortage_generation_status=invalid:${candidateShortageGenerationStatus.error.message}`);
    } else if (candidateShortageGenerationStatus.value?.status !== 'UNDERFILLED_NEEDS_FIX') {
      candidateShortageRejectReasons.push(`candidate_shortage_status=${candidateShortageGenerationStatus.value?.status || 'missing'}`);
    } else if (candidateShortageGenerationStatus.value?.failure_kind !== FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE) {
      candidateShortageRejectReasons.push(`candidate_shortage_failure_kind=${candidateShortageGenerationStatus.value?.failure_kind || 'missing'}`);
    }
    if (candidateShortageMissingRequired.length > 0) {
      candidateShortageRejectReasons.push(`missing_candidate_shortage_required=${candidateShortageMissingRequired.join(',')}`);
    }
    if (candidateShortageInvalidArtifacts.length > 0) {
      candidateShortageRejectReasons.push(`invalid_candidate_shortage_required=${candidateShortageInvalidArtifacts.join(',')}`);
    }
  }
  const editorialRejectReasons = [];
  if (editorialReviewableRequested) {
    if (!editorialStatus) {
      editorialRejectReasons.push(`status_not_editorial=${statusValues.find(Boolean) || 'UNKNOWN'}`);
    }
    if (!editorialGenerationStatus.exists) {
      editorialRejectReasons.push('canonical_generation_status=missing');
    } else if (editorialGenerationStatus.error) {
      editorialRejectReasons.push(`canonical_generation_status=invalid:${editorialGenerationStatus.error.message}`);
    } else if (editorialGenerationStatus.value?.failure_kind !== FAILURE_KIND_EDITORIAL_REVIEWABLE) {
      editorialRejectReasons.push(`canonical_failure_kind=${editorialGenerationStatus.value?.failure_kind || 'missing'}`);
    }
    if (editorialMissingRequired.length > 0) {
      editorialRejectReasons.push(`missing_editorial_required=${editorialMissingRequired.join(',')}`);
    }
    if (editorialInvalidArtifacts.length > 0) {
      editorialRejectReasons.push(`invalid_editorial_required=${editorialInvalidArtifacts.join(',')}`);
    }
    if (newsletterIndex.error) {
      editorialRejectReasons.push(`data_newsletters_invalid=${newsletterIndex.error.message}`);
    }
  }
  const missingRequired = failedRepairReviewable
    ? REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.filter(file => !canonicalArtifacts.includes(file))
    : failedRawArtifactValidationReviewable
      ? REQUIRED_FAILED_RAW_ARTIFACT_VALIDATION_REVIEWABLE_ARTIFACTS.filter(file => !canonicalArtifacts.includes(file))
      : [];
  const hasRequiredCanonicalArtifacts = failedRepairReviewable
    ? missingRequired.length === 0
    : failedRawArtifactValidationReviewable
      ? missingRequired.length === 0
      : candidateShortageRequested
        ? candidateShortageRejectReasons.length === 0
        : editorialReviewableRequested
          ? editorialRejectReasons.length === 0
          : hasCanonicalDiagnostic;
  let hasReviewableArtifacts =
    hasRequiredCanonicalArtifacts &&
    statusReviewable &&
    changedArtifacts.length > 0 &&
    (!editorialReviewableRequested || editorialRejectReasons.length === 0) &&
    (!candidateShortageRequested || candidateShortageRejectReasons.length === 0);
  const hasPublicArtifacts = publicArtifacts.length > 0;
  const hasRequiredPublicNewsletterFiles =
    publicStructure.requiredFilesExist &&
    publicStructure.requiredFilesNonEmpty &&
    newsletterIndex.hasDate === true &&
    newsletterIndex.pathsMatch === true;
  const missingChangedPublicArtifacts = requiredPublicArtifacts.filter(filePath => !changedArtifacts.includes(filePath));
  const publicNewsletterReasons = [
    ...publicStructure.errors,
    missingChangedPublicArtifacts.length > 0
      ? `required public files not changed: ${missingChangedPublicArtifacts.join(',')}`
      : ''
  ].filter(Boolean);
  const publicNewsletterReady =
    hasRequiredPublicNewsletterFiles &&
    publicStructure.ok &&
    missingChangedPublicArtifacts.length === 0;
  if (publicNewsletterReady) {
    hasReviewableArtifacts = true;
  }
  const changedArtifactCount = changedArtifacts.length;
  const reviewPrReady = publicNewsletterReady || (
    hasReviewableArtifacts &&
    changedArtifactCount > 0 &&
    statusReviewable
  );
  const diagnosticsOnly = reviewPrReady && !publicNewsletterReady;
  const reviewOnly = diagnosticsOnly;
  const publishCandidateReady = publicNewsletterReady;
  const hasAiPublishReady = isTrue(status.final_publish_ready);
  const hasPublishCandidate = publicNewsletterReady;
  const reviewPublicationReady =
    publicNewsletterReady &&
    isFalse(status.final_publish_ready) &&
    isTrue(status.review_gate_passed) &&
    isTrue(status.editor_review_required);
  const homepageVisibleAfterMerge =
    publicNewsletterReady &&
    newsletterIndex.hasDate === true &&
    newsletterIndex.pathsMatch === true;
  const fallbackPublicReady = isTrue(status.fallback_public_ready);
  const fallbackOnly = isTrue(status.fallback_only);
  const cameraAnchorCount = numberOrNull(status.camera_anchor_count);
  const publicationMode = status.publication_mode ||
    (diagnosticsOnly
      ? 'diagnostics_only'
      : fallbackPublicReady
        ? 'fallback_public'
        : hasAiPublishReady
          ? 'normal_public'
          : 'review_only');
  const homepageVisibility = status.homepage_visibility ||
    (diagnosticsOnly
      ? 'hidden'
      : publicationMode === 'fallback_public'
        ? 'visible_with_fallback_badge'
        : homepageVisibleAfterMerge
          ? 'normal'
          : 'hidden');
  const normalPublicReady = isTrue(status.normal_public_ready) || (hasAiPublishReady && publicNewsletterReady);
  const automaticPublishReady = isTrue(status.automatic_publish_ready) || normalPublicReady;
  const publicArtifactReady = isTrue(status.public_artifact_ready) || publicNewsletterReady;
  const homepageBadge = status.homepage_badge || (publicationMode === 'fallback_public' ? 'Tooling Watch Edition' : '');
  const publicationContractErrors = [];
  if (publicationMode === 'fallback_public') {
    if (homepageVisibility !== 'visible_with_fallback_badge') {
      publicationContractErrors.push('fallback_public requires homepage_visibility=visible_with_fallback_badge');
    }
    if (fallbackOnly !== true) {
      publicationContractErrors.push('fallback_public requires fallback_only=true');
    }
    if (cameraAnchorCount !== null && cameraAnchorCount !== 0) {
      publicationContractErrors.push('fallback_public requires camera_anchor_count=0');
    }
    if (fallbackPublicReady !== true) {
      publicationContractErrors.push('fallback_public requires fallback_public_ready=true');
    }
  }
  if (
    cameraAnchorCount === 0 &&
    homepageVisibility !== 'hidden' &&
    publicationMode !== 'fallback_public'
  ) {
    publicationContractErrors.push('homepage-visible camera_anchor_count=0 requires publication_mode=fallback_public');
  }
  const reasonParts = [
    `status=${status.status || 'UNKNOWN'}`,
    editorialReviewableRequested ? `failure_kind=${FAILURE_KIND_EDITORIAL_REVIEWABLE}` : '',
    candidateShortageRequested ? `failure_kind=${FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE}` : '',
    hasCanonicalDiagnostic
      ? `canonical=${canonicalArtifacts.join(',')}`
      : 'canonical=none',
    `changed=${changedArtifacts.length > 0 ? changedArtifacts.join(',') : 'none'}`,
    (failedRepairReviewable || failedRawArtifactValidationReviewable)
      ? `missing_required=${missingRequired.length > 0 ? missingRequired.join(',') : 'none'}`
      : '',
    failedRawArtifactValidationReviewable
      ? `raw_artifact_validation_error_field=${status.raw_artifact_validation_error?.field || 'unknown'}`
      : '',
    failedRawArtifactValidationReviewable
      ? `raw_artifact_validation_error_value=${status.raw_artifact_validation_error?.value || ''}`
      : '',
    editorialReviewableRequested
      ? `editorial_reject=${editorialRejectReasons.length > 0 ? editorialRejectReasons.join(';') : 'none'}`
      : '',
    candidateShortageRequested
      ? `candidate_shortage_reject=${candidateShortageRejectReasons.length > 0 ? candidateShortageRejectReasons.join(';') : 'none'}`
      : '',
    publicArtifacts.length > 0
      ? `public=${publicArtifacts.join(',')}`
      : 'public=none',
    `required_public=${hasRequiredPublicNewsletterFiles ? 'present' : 'missing_or_invalid'}`,
    `changed_public=${changedRequiredPublicArtifacts.length > 0 ? changedRequiredPublicArtifacts.join(',') : 'none'}`,
    `public_newsletter_ready=${publicNewsletterReady ? 'true' : 'false'}`,
    `review_pr_ready=${reviewPrReady ? 'true' : 'false'}`,
    `review_only=${reviewOnly ? 'true' : 'false'}`,
    `diagnostics_only=${diagnosticsOnly ? 'true' : 'false'}`,
    `review_publication_ready=${reviewPublicationReady ? 'true' : 'false'}`,
    `homepage_visible_after_merge=${homepageVisibleAfterMerge ? 'true' : 'false'}`,
    `publication_mode=${publicationMode}`,
    `homepage_visibility=${homepageVisibility}`,
    `fallback_only=${fallbackOnly ? 'true' : 'false'}`,
    `camera_anchor_count=${cameraAnchorCount ?? 'n/a'}`,
    publicationContractErrors.length > 0 ? `publication_contract_errors=${publicationContractErrors.join('|')}` : '',
    `changed_artifact_count=${changedArtifactCount}`,
    publicNewsletterReasons.length > 0 ? `public_newsletter_reason=${publicNewsletterReasons.join(';')}` : 'public_newsletter_reason=none'
  ].filter(Boolean);

  return {
    date,
    branch,
    status,
    newsroomDir,
    canonicalArtifacts,
    publicArtifacts,
    requiredPublicArtifacts,
    publicStructure,
    changedArtifacts,
    changedRequiredPublicArtifacts,
    missingRequired,
    editorialRejectReasons,
    hasReviewableArtifacts,
    hasPublicArtifacts,
    hasRequiredPublicNewsletterFiles,
    publicNewsletterReady,
    reviewPrReady,
    reviewOnly,
    diagnosticsOnly,
    reviewPublicationReady,
    homepageVisibleAfterMerge,
    publicationMode,
    homepageVisibility,
    normalPublicReady,
    automaticPublishReady,
    publicArtifactReady,
    fallbackPublicReady,
    fallbackOnly,
    cameraAnchorCount,
    homepageBadge,
    publicationContractErrors,
    publishCandidateReady,
    changedArtifactCount,
    publicNewsletterReason: publicNewsletterReasons.length > 0 ? publicNewsletterReasons.join('; ') : 'ready',
    hasAiPublishReady,
    hasPublishCandidate,
    reviewableArtifactReason: reasonParts.join('; ')
  };
}

function buildReviewableArtifactOutputs(resolved) {
  const status = resolved.status || {};
  return {
    date: resolved.date,
    branch: resolved.branch,
    has_reviewable_artifacts: resolved.hasReviewableArtifacts ? 'true' : 'false',
    has_public_artifacts: resolved.hasPublicArtifacts ? 'true' : 'false',
    has_required_public_newsletter_files: resolved.hasRequiredPublicNewsletterFiles ? 'true' : 'false',
    public_newsletter_ready: resolved.publicNewsletterReady ? 'true' : 'false',
    review_pr_ready: resolved.reviewPrReady ? 'true' : 'false',
    review_only: resolved.reviewOnly ? 'true' : 'false',
    diagnostics_only: resolved.diagnosticsOnly ? 'true' : 'false',
    review_publication_ready: resolved.reviewPublicationReady ? 'true' : 'false',
    homepage_visible_after_merge: resolved.homepageVisibleAfterMerge ? 'true' : 'false',
    publication_mode: resolved.publicationMode || 'n/a',
    homepage_visibility: resolved.homepageVisibility || 'n/a',
    normal_public_ready: resolved.normalPublicReady ? 'true' : 'false',
    automatic_publish_ready: resolved.automaticPublishReady ? 'true' : 'false',
    public_artifact_ready: resolved.publicArtifactReady ? 'true' : 'false',
    fallback_public_ready: resolved.fallbackPublicReady ? 'true' : 'false',
    fallback_only: resolved.fallbackOnly ? 'true' : 'false',
    camera_anchor_count: resolved.cameraAnchorCount === null || resolved.cameraAnchorCount === undefined ? 'n/a' : String(resolved.cameraAnchorCount),
    homepage_badge: resolved.homepageBadge || 'none',
    publication_contract_error_count: String(resolved.publicationContractErrors?.length ?? 0),
    publication_contract_errors: resolved.publicationContractErrors?.join('\n') || 'none',
    publish_candidate_ready: resolved.publishCandidateReady ? 'true' : 'false',
    changed_artifact_count: String(resolved.changedArtifactCount ?? 0),
    public_newsletter_reason: resolved.publicNewsletterReason,
    has_ai_publish_ready: resolved.hasAiPublishReady ? 'true' : 'false',
    has_publish_candidate: resolved.hasPublishCandidate ? 'true' : 'false',
    reviewable_artifact_reason: resolved.reviewableArtifactReason,
    public_state: status.public_state || status.run_public_state || 'n/a',
    run_mode: status.run_mode || 'n/a',
    effective_homepage_visible: isTrue(status.effective_homepage_visible)
      ? 'true'
      : isFalse(status.effective_homepage_visible)
        ? 'false'
        : (resolved.homepageVisibleAfterMerge ? 'true' : 'false'),
    existing_public_artifact_detected: isTrue(status.existing_public_artifact_detected)
      ? 'true'
      : isFalse(status.existing_public_artifact_detected)
        ? 'false'
        : 'n/a',
    retention_valid: isTrue(status.retention_valid)
      ? 'true'
      : isFalse(status.retention_valid)
        ? 'false'
        : 'n/a',
    retention_error: status.retention_error || 'none',
    public_artifact_policy: status.public_artifact_policy || 'n/a',
    public_artifact_source: status.public_artifact_source || 'n/a',
    reconciliation_required: isTrue(status.reconciliation_required) ? 'true' : 'false',
    reconciliation_action: status.reconciliation_action || 'n/a',
    reconciliation_reason: status.reconciliation_reason || 'none'
  };
}

function main() {
  const resolved = resolveReviewableArtifacts();
  process.stdout.write(`${renderGithubOutputs(buildReviewableArtifactOutputs(resolved))}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  CANONICAL_REVIEW_ARTIFACTS,
  REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS,
  REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_RAW_ARTIFACT_VALIDATION_REVIEWABLE_ARTIFACTS,
  REQUIRED_PUBLIC_NEWSLETTER_FILES,
  REVIEWABLE_STATUSES,
  buildReviewableArtifactOutputs,
  getChangedRepoVisibleArtifacts,
  parseGitStatusPorcelain,
  publicNewsletterStructureStatus,
  requiredPublicFiles,
  resolveDate,
  resolveReviewableArtifacts
};
