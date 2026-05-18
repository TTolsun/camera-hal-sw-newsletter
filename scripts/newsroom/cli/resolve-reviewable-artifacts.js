const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  kstDate
} = require('../common/common');
const {
  readStatus,
  renderGithubOutputs
} = require('./write-generation-status-output');
const {
  validateRenderedIssueStructure
} = require('../validate/rendered-issue-structure');

const STATUS_FAILED_REPAIR_REVIEWABLE = 'FAILED_REPAIR_REVIEWABLE';
const FAILURE_KIND_EDITORIAL_REVIEWABLE = 'editorial_reviewable';
const FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE = 'candidate_shortage_reviewable';

const REVIEWABLE_STATUSES = new Set([
  'PASS',
  'NEEDS_FIX',
  'QUALITY_NEEDS_FIX',
  'UNDERFILLED_NEEDS_FIX',
  STATUS_FAILED_REPAIR_REVIEWABLE
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

const REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS = [
  'editor-draft.json',
  'quality-report.json',
  'fact-check-report.json',
  'hal-signal-quality-report.json',
  'hal-signal-quality-report.md',
  'repair-failure.json',
  'generation-status.json'
];

const REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS = [
  'editor-draft.json',
  'quality-report.json',
  'fact-check-report.json',
  'hal-signal-quality-report.json',
  'hal-signal-quality-report.md',
  'generation-status.json'
];

const REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS = [
  'generation-status.json',
  'shortlisted-candidates.json',
  'selection-report.json',
  'selection-diagnostics.md',
  'article-capsules.json'
];

const REQUIRED_PUBLIC_NEWSLETTER_FILES = [
  'newsletters/${date}/newsletter.md',
  'newsletters/${date}/index.html',
  'data/newsletters.json'
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

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, value: null, error: null };
  }
  try {
    return {
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      error: null
    };
  } catch (error) {
    return { exists: true, value: null, error };
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

function requiredPublicFiles(date) {
  return REQUIRED_PUBLIC_NEWSLETTER_FILES.map(file => file.replaceAll('${date}', date));
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

function newsletterIndexDateStatus(root, date) {
  const dataPath = path.join(root, 'data', 'newsletters.json');
  const result = readJsonIfExists(dataPath);
  if (!result.exists) {
    return { exists: false, hasDate: false, entry: null, pathsMatch: false, pathErrors: [], error: null };
  }
  if (result.error) {
    return { exists: true, hasDate: false, entry: null, pathsMatch: false, pathErrors: [], error: result.error };
  }
  if (!Array.isArray(result.value)) {
    return {
      exists: true,
      hasDate: false,
      entry: null,
      pathsMatch: false,
      pathErrors: [],
      error: new Error('data/newsletters.json must contain an array')
    };
  }
  const entry = result.value.find(item => item?.date === date) || null;
  const expectedHtml = `newsletters/${date}/index.html`;
  const expectedMd = `newsletters/${date}/newsletter.md`;
  const pathErrors = [];
  if (!entry) {
    pathErrors.push(`data/newsletters.json missing date entry ${date}`);
  } else {
    if (entry.html !== expectedHtml) pathErrors.push(`data/newsletters.json html path mismatch: ${entry.html || 'missing'}`);
    if (entry.md !== expectedMd) pathErrors.push(`data/newsletters.json md path mismatch: ${entry.md || 'missing'}`);
  }
  return {
    exists: true,
    hasDate: Boolean(entry),
    entry,
    pathsMatch: pathErrors.length === 0,
    pathErrors,
    error: null
  };
}

function publicFileStatuses(root, date) {
  return requiredPublicFiles(date).map(relativePath => {
    const absolutePath = path.join(root, relativePath);
    const read = readTextResult(absolutePath);
    return {
      path: relativePath,
      exists: read.exists,
      nonEmpty: read.exists && String(read.text || '').trim().length > 0,
      error: read.error,
      text: read.text
    };
  });
}

function rootIndexContractErrors(root) {
  const indexPath = path.join(root, 'index.html');
  const read = readTextResult(indexPath);
  if (!read.exists) return ['root index.html missing'];
  if (read.error) return [`root index.html unreadable: ${read.error.message}`];
  const html = read.text;
  const checks = [
    { label: "fetch('data/newsletters.json')", pattern: /fetch\(\s*['"]data\/newsletters\.json['"]/ },
    { label: 'loadNewsletters', pattern: /\bloadNewsletters\b/ },
    { label: 'latest-card', pattern: /latest-card/ },
    { label: 'archive-list', pattern: /archive-list/ }
  ];
  return checks
    .filter(check => !check.pattern.test(html))
    .map(check => `root index.html missing ${check.label} contract`);
}

function publicNewsletterStructureStatus(root, date) {
  const statuses = publicFileStatuses(root, date);
  const errors = [];
  for (const status of statuses) {
    if (!status.exists) errors.push(`missing required public file: ${status.path}`);
    else if (status.error) errors.push(`unreadable required public file: ${status.path}: ${status.error.message}`);
    else if (!status.nonEmpty) errors.push(`empty required public file: ${status.path}`);
  }

  const newsletterMd = statuses.find(item => item.path.endsWith('/newsletter.md'));
  const newsletterHtml = statuses.find(item => item.path.endsWith('/index.html'));
  const dataIndex = newsletterIndexDateStatus(root, date);
  if (!dataIndex.exists) {
    errors.push('missing data/newsletters.json');
  } else if (dataIndex.error) {
    errors.push(`invalid data/newsletters.json: ${dataIndex.error.message}`);
  } else {
    errors.push(...dataIndex.pathErrors);
  }

  if (newsletterHtml?.text && !/<a\s+[^>]*href=["'](?:\.\/)?newsletter\.md["']/i.test(newsletterHtml.text)) {
    errors.push(`Newsletter HTML missing newsletter.md link: newsletters/${date}/index.html`);
  }

  errors.push(...rootIndexContractErrors(root));

  if (newsletterMd?.nonEmpty && newsletterHtml?.nonEmpty) {
    const editorResult = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'));
    const structural = validateRenderedIssueStructure({
      date,
      editor: editorResult.error ? null : editorResult.value,
      markdown: newsletterMd.text,
      html: newsletterHtml.text,
      root
    });
    if (!structural.ok) {
      errors.push(...structural.errors.map(error => `structural: ${error}`));
    }
  }

  const requiredFilesExist = statuses.every(status => status.exists);
  const requiredFilesNonEmpty = statuses.every(status => status.nonEmpty);
  return {
    ok: errors.length === 0,
    errors,
    dataIndex,
    requiredFilesExist,
    requiredFilesNonEmpty,
    statuses
  };
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
    : [];
  const hasRequiredCanonicalArtifacts = failedRepairReviewable
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
  const reasonParts = [
    `status=${status.status || 'UNKNOWN'}`,
    editorialReviewableRequested ? `failure_kind=${FAILURE_KIND_EDITORIAL_REVIEWABLE}` : '',
    candidateShortageRequested ? `failure_kind=${FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE}` : '',
    hasCanonicalDiagnostic
      ? `canonical=${canonicalArtifacts.join(',')}`
      : 'canonical=none',
    `changed=${changedArtifacts.length > 0 ? changedArtifacts.join(',') : 'none'}`,
    failedRepairReviewable
      ? `missing_required=${missingRequired.length > 0 ? missingRequired.join(',') : 'none'}`
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
