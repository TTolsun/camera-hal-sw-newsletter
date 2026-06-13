const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { changedArtifactDate } = require('../../shared/common/artifact-paths');

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
      // --name-status -M로 rename을 식별한다. 내용이 그대로인 순수 rename(R100)은
      // 콘텐츠 변경이 아니므로 strict validation target에서 제외한다(#262 articles/ 이동이
      // 과거 newsletter를 strict target으로 끌어올려 historical placeholder를 hard fail로
      // 바꾸는 것을 막는다). 내용도 바뀐 rename(R<100>)은 대상 경로를 포함한다.
      const output = execFileSync('git', ['diff', '--name-status', '-M', range], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      return parseNameStatus(output);
    } catch (_) {
      // Try the next range; local validation may not have origin/main or a parent commit.
    }
  }
  return [];
}

function parseNameStatus(output) {
  const files = [];
  for (const rawLine of String(output || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\t/);
    const status = parts[0] || '';
    if (status.startsWith('R')) {
      // R<similarity>\t<old>\t<new>. 100% similarity(R100)는 순수 이동이라 무시한다.
      const similarity = Number(status.slice(1));
      if (similarity >= 100) continue;
      const dest = parts[2] || parts[1];
      if (dest) files.push(dest.trim());
    } else if (status.startsWith('C')) {
      // Copy: 대상 경로만 의미가 있다.
      const dest = parts[2] || parts[1];
      if (dest) files.push(dest.trim());
    } else if (parts[1]) {
      files.push(parts[1].trim());
    }
  }
  return files;
}

function readNewsletterDate(newsletterDatePath) {
  if (!newsletterDatePath || !fs.existsSync(newsletterDatePath)) return '';
  return fs.readFileSync(newsletterDatePath, 'utf8').trim();
}

function changedNewsletterDatesFromFiles(files = []) {
  const dates = new Set();
  for (const file of files) {
    const normalized = String(file || '').replace(/\\/g, '/');
    if (/^articles\/content\/newsroom\/\d{4}-\d{2}-\d{2}\/image-audit-report\.(?:json|md)$/.test(normalized)) {
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
