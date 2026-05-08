const fs = require('fs');
const path = require('path');

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
  'retry-history.json',
  'repair-failure.json',
  'recovery-prompt.md',
  'shortlisted-candidates.json',
  'selection-report.json',
  'selection-diagnostics.md'
];

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
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
  const hasCanonicalDiagnostic = canonicalArtifacts.length > 0;
  const statusReviewable = REVIEWABLE_STATUSES.has(status.status);
  const failedRepairReviewable = status.status === STATUS_FAILED_REPAIR_REVIEWABLE;
  const hasReviewableArtifacts = hasCanonicalDiagnostic && statusReviewable;
  const hasPublishCandidate = hasCanonicalDiagnostic && publicArtifacts.length > 0 && statusReviewable && !failedRepairReviewable;
  const reasonParts = [
    `status=${status.status || 'UNKNOWN'}`,
    hasCanonicalDiagnostic
      ? `canonical=${canonicalArtifacts.join(',')}`
      : 'canonical=none',
    publicArtifacts.length > 0
      ? `public=${publicArtifacts.join(',')}`
      : 'public=none'
  ];

  return {
    date,
    branch,
    status,
    newsroomDir,
    canonicalArtifacts,
    publicArtifacts,
    hasReviewableArtifacts,
    hasPublishCandidate,
    reviewableArtifactReason: reasonParts.join('; ')
  };
}

function buildReviewableArtifactOutputs(resolved) {
  return {
    date: resolved.date,
    branch: resolved.branch,
    has_reviewable_artifacts: resolved.hasReviewableArtifacts ? 'true' : 'false',
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
  REVIEWABLE_STATUSES,
  buildReviewableArtifactOutputs,
  resolveDate,
  resolveReviewableArtifacts
};
