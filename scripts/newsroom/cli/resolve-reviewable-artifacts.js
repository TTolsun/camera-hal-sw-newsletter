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

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
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
  const changedArtifacts = Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')
    ? relevantChangedArtifacts(options.changedArtifacts, date)
    : relevantChangedArtifacts(getChangedRepoVisibleArtifacts({ root, date }), date);
  const hasCanonicalDiagnostic = canonicalArtifacts.length > 0;
  const statusReviewable = REVIEWABLE_STATUSES.has(status.status);
  const failedRepairReviewable = status.status === STATUS_FAILED_REPAIR_REVIEWABLE;
  const missingRequired = failedRepairReviewable
    ? REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.filter(file => !canonicalArtifacts.includes(file))
    : [];
  const hasRequiredCanonicalArtifacts = failedRepairReviewable
    ? missingRequired.length === 0
    : hasCanonicalDiagnostic;
  const changedPublicArtifacts = changedArtifacts.filter(filePath =>
    filePath.startsWith(`newsletters/${date}/`) ||
    filePath === 'data/newsletters.json'
  );
  const hasReviewableArtifacts = hasRequiredCanonicalArtifacts && statusReviewable && changedArtifacts.length > 0;
  const hasPublicArtifacts =
    hasReviewableArtifacts &&
    publicArtifacts.length > 0 &&
    changedPublicArtifacts.length > 0;
  const hasAiPublishReady = status.final_publish_ready === true;
  const hasPublishCandidate =
    hasPublicArtifacts &&
    !failedRepairReviewable;
  const reasonParts = [
    `status=${status.status || 'UNKNOWN'}`,
    hasCanonicalDiagnostic
      ? `canonical=${canonicalArtifacts.join(',')}`
      : 'canonical=none',
    `changed=${changedArtifacts.length > 0 ? changedArtifacts.join(',') : 'none'}`,
    failedRepairReviewable
      ? `missing_required=${missingRequired.length > 0 ? missingRequired.join(',') : 'none'}`
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
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS,
  REVIEWABLE_STATUSES,
  buildReviewableArtifactOutputs,
  getChangedRepoVisibleArtifacts,
  parseGitStatusPorcelain,
  resolveDate,
  resolveReviewableArtifacts
};
