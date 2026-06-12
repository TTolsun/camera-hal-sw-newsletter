const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { changedArtifactDate } = require('../../../src/core/common/artifact-paths');

const HISTORICAL_POLICY_WARNING_REASON = 'historical artifact outside current/changed/generated validation target, warning only';

function changedFilesFromGit({ root = process.cwd(), env = process.env } = {}) {
  const candidates = [];
  const eventName = env.GITHUB_EVENT_NAME || '';
  const baseRef = env.GITHUB_BASE_REF || '';

  if (eventName === 'pull_request' && baseRef) {
    candidates.push(`origin/${baseRef}...HEAD`);
  } else if (eventName === 'push') {
    candidates.push('HEAD^..HEAD');
  }

  candidates.push('origin/main...HEAD');

  for (const range of candidates) {
    try {
      const output = execFileSync('git', ['diff', '--name-only', range], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      return output.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    } catch (_) {
      // Try the next range; local validation may not have origin/main or a parent commit.
    }
  }
  return [];
}

function readNewsletterDate(newsletterDatePath) {
  if (!newsletterDatePath || !fs.existsSync(newsletterDatePath)) return '';
  return fs.readFileSync(newsletterDatePath, 'utf8').trim();
}

function changedNewsletterDatesFromFiles(files = []) {
  const dates = new Set();
  for (const file of files) {
    const normalized = String(file || '').replace(/\\/g, '/');
    if (/^content\/newsroom\/\d{4}-\d{2}-\d{2}\/image-audit-report\.(?:json|md)$/.test(normalized)) {
      continue;
    }
    const date = changedArtifactDate(file);
    if (date) dates.add(date);
  }
  return dates;
}

function strictTargetDatesFromInputs({ changedFiles = [], newsletterDate = '' } = {}) {
  const dates = changedNewsletterDatesFromFiles(changedFiles);
  const trimmedDate = String(newsletterDate || '').trim();
  if (trimmedDate) dates.add(trimmedDate);
  return dates;
}

function strictTargetDates({
  root = process.cwd(),
  env = process.env,
  newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt')
} = {}) {
  return strictTargetDatesFromInputs({
    changedFiles: changedFilesFromGit({ root, env }),
    newsletterDate: readNewsletterDate(newsletterDatePath)
  });
}

function historicalPolicyWarningReason() {
  return HISTORICAL_POLICY_WARNING_REASON;
}

module.exports = {
  HISTORICAL_POLICY_WARNING_REASON,
  changedFilesFromGit,
  changedNewsletterDatesFromFiles,
  historicalPolicyWarningReason,
  readNewsletterDate,
  strictTargetDates,
  strictTargetDatesFromInputs
};
