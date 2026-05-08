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

const STATUS_FAILED_REPAIR_REVIEWABLE = 'FAILED_REPAIR_REVIEWABLE';
const FAILURE_KIND_EDITORIAL_REVIEWABLE = 'editorial_reviewable';

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
  'generation-status.json',
  'retry-history.json',
  'repair-failure.json',
  'recovery-prompt.md',
  'shortlisted-candidates.json',
  'selection-report.json',
  'selection-diagnostics.md'
];

const REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS = [
  'editor-draft.json',
  'quality-report.json',
  'fact-check-report.json',
  'repair-failure.json',
  'generation-status.json'
];

const REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS = [
  'editor-draft.json',
  'quality-report.json',
  'fact-check-report.json',
  'generation-status.json'
];

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
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
  return relativeFiles.filter(relativeFile => fs.existsSync(path.join(root, relativeFile.replaceAll('${date}', date))));
}

function artifactJsonReadResults(root, date, artifactNames) {
  return Object.fromEntries(artifactNames.map(name => [
    name,
    readJsonIfExists(path.join(root, 'content', 'newsroom', date, name))
  ]));
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
    return { exists: false, hasDate: false, error: null };
  }
  if (result.error) {
    return { exists: true, hasDate: false, error: result.error };
  }
  if (!Array.isArray(result.value)) {
    return {
      exists: true,
      hasDate: false,
      error: new Error('data/newsletters.json must contain an array')
    };
  }
  return {
    exists: true,
    hasDate: result.value.some(item => item?.date === date),
    error: null
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
  const publicArtifacts = existingArtifacts(root, date, [
    'newsletters/${date}/newsletter.md',
    'newsletters/${date}/index.html'
  ]);
  const newsletterIndex = newsletterIndexDateStatus(root, date);
  const changedArtifacts = Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')
    ? relevantChangedArtifacts(options.changedArtifacts, date)
    : relevantChangedArtifacts(getChangedRepoVisibleArtifacts({ root, date }), date);
  const hasCanonicalDiagnostic = canonicalArtifacts.length > 0;
  const statusReviewable = REVIEWABLE_STATUSES.has(status.status);
  const failedRepairReviewable = status.status === STATUS_FAILED_REPAIR_REVIEWABLE;
  const changedPublicArtifacts = changedArtifacts.filter(filePath =>
    filePath.startsWith(`newsletters/${date}/`) ||
    filePath === 'data/newsletters.json'
  );
  const dataNewsletterChanged = changedArtifacts.includes('data/newsletters.json');
  const editorialArtifacts = artifactJsonReadResults(root, date, REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS);
  const editorialGenerationStatus = editorialArtifacts['generation-status.json'];
  const statusValues = [status.status, editorialGenerationStatus.value?.status].filter(Boolean);
  const editorialStatus = statusValues.some(value => value === 'NEEDS_FIX' || value === 'QUALITY_NEEDS_FIX');
  const editorialReviewableRequested =
    status.failure_kind === FAILURE_KIND_EDITORIAL_REVIEWABLE ||
    editorialGenerationStatus.value?.failure_kind === FAILURE_KIND_EDITORIAL_REVIEWABLE ||
    editorialStatus;
  const editorialMissingRequired = missingArtifacts(editorialArtifacts);
  const editorialInvalidArtifacts = invalidArtifacts(editorialArtifacts);
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
    if (publicArtifacts.length > 0) {
      editorialRejectReasons.push(`public_exists=${publicArtifacts.join(',')}`);
    }
    const changedPublicNewsletterFiles = changedPublicArtifacts.filter(filePath => filePath.startsWith(`newsletters/${date}/`));
    if (changedPublicNewsletterFiles.length > 0) {
      editorialRejectReasons.push(`public_changed=${changedPublicNewsletterFiles.join(',')}`);
    }
    if (dataNewsletterChanged) {
      editorialRejectReasons.push('data_newsletters_changed=true');
    }
    if (newsletterIndex.error) {
      editorialRejectReasons.push(`data_newsletters_invalid=${newsletterIndex.error.message}`);
    } else if (newsletterIndex.hasDate) {
      editorialRejectReasons.push(`data_newsletters_has_date=${date}`);
    }
  }
  const missingRequired = failedRepairReviewable
    ? REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.filter(file => !canonicalArtifacts.includes(file))
    : [];
  const hasRequiredCanonicalArtifacts = failedRepairReviewable
    ? missingRequired.length === 0
    : editorialReviewableRequested
      ? editorialRejectReasons.length === 0
      : hasCanonicalDiagnostic;
  const hasReviewableArtifacts =
    hasRequiredCanonicalArtifacts &&
    statusReviewable &&
    changedArtifacts.length > 0 &&
    (!editorialReviewableRequested || editorialRejectReasons.length === 0);
  const hasPublicArtifacts =
    hasReviewableArtifacts &&
    publicArtifacts.length > 0 &&
    changedPublicArtifacts.length > 0;
  const hasAiPublishReady = status.final_publish_ready === true;
  const hasPublishCandidate =
    hasPublicArtifacts &&
    !editorialReviewableRequested &&
    !failedRepairReviewable;
  const reasonParts = [
    `status=${status.status || 'UNKNOWN'}`,
    editorialReviewableRequested ? `failure_kind=${FAILURE_KIND_EDITORIAL_REVIEWABLE}` : '',
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
    publicArtifacts.length > 0
      ? `public=${publicArtifacts.join(',')}`
      : 'public=none'
  ].filter(Boolean);

  return {
    date,
    branch,
    status,
    newsroomDir,
    canonicalArtifacts,
    publicArtifacts,
    changedArtifacts,
    missingRequired,
    editorialRejectReasons,
    hasReviewableArtifacts,
    hasPublicArtifacts,
    hasAiPublishReady,
    hasPublishCandidate,
    reviewableArtifactReason: reasonParts.join('; ')
  };
}

function buildReviewableArtifactOutputs(resolved) {
  return {
    date: resolved.date,
    branch: resolved.branch,
    has_reviewable_artifacts: resolved.hasReviewableArtifacts ? 'true' : 'false',
    has_public_artifacts: resolved.hasPublicArtifacts ? 'true' : 'false',
    has_ai_publish_ready: resolved.hasAiPublishReady ? 'true' : 'false',
    has_publish_candidate: resolved.hasPublishCandidate ? 'true' : 'false',
    reviewable_artifact_reason: resolved.reviewableArtifactReason
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
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS,
  REVIEWABLE_STATUSES,
  buildReviewableArtifactOutputs,
  getChangedRepoVisibleArtifacts,
  parseGitStatusPorcelain,
  resolveDate,
  resolveReviewableArtifacts
};
