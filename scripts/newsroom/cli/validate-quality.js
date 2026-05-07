const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  buildNewsletterQualityReport
} = require('../validate/newsletter-quality');
const { qualityGatePolicy } = require('../common/newsletter-policy');
const { readJson } = require('../common/common');
const {
  changedArtifactDate,
  newsroomDir,
  newsroomRelPath
} = require('../common/artifact-paths');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return readJson(filePath);
  } catch (error) {
    fail(`Invalid JSON in ${path.relative(root, filePath)}: ${error.message}`);
    return null;
  }
}

function newsletterItems() {
  if (!fs.existsSync(dataPath)) {
    fail('Missing data/newsletters.json');
    return [];
  }
  const items = readJsonIfExists(dataPath);
  if (!Array.isArray(items)) {
    fail('data/newsletters.json must contain an array');
    return [];
  }

  if (fs.existsSync(newsletterDatePath)) {
    const date = fs.readFileSync(newsletterDatePath, 'utf8').trim();
    const matches = items.filter(item => item.date === date);
    if (matches.length === 0) fail(`No newsletter entry found for .tmp/newsletter-date.txt date: ${date}`);
    return matches;
  }

  return items;
}

function changedFilesFromGit() {
  const candidates = [];
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const baseRef = process.env.GITHUB_BASE_REF || '';

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

function changedNewsletterDates() {
  const dates = new Set();
  for (const file of changedFilesFromGit()) {
    const date = changedArtifactDate(file);
    if (date) dates.add(date);
  }
  return dates;
}

function validateQualityReport(item, requireReport) {
  const dateNewsroomDir = newsroomDir(root, item.date);
  const reportPath = path.join(dateNewsroomDir, 'quality-report.json');
  if (!fs.existsSync(reportPath)) {
    if (requireReport) {
      fail(`Missing quality report for generated newsletter ${item.date}: ${newsroomRelPath(item.date, 'quality-report.json')}`);
    }
    return;
  }

  const report = readJsonIfExists(reportPath);
  if (!report) return;
  const threshold = Number.isFinite(Number(report.threshold)) ? Number(report.threshold) : qualityGatePolicy.threshold;
  const score = Number(report.score);
  if (!Number.isFinite(score)) {
    fail(`Newsletter ${item.date} quality report has invalid score.`);
    return;
  }
  if (threshold < qualityGatePolicy.threshold) {
    fail(`Newsletter ${item.date} quality threshold must be at least ${qualityGatePolicy.threshold}, found ${threshold}.`);
  }
  if (!requireReport && (score < threshold || report.status !== 'PASS')) {
    warn(`Newsletter ${item.date} has non-publishable review quality report ${score}/${threshold} ${report.status}; not enforcing because this run is not publishing that issue.`);
    return;
  }
  if (score < threshold || report.status !== 'PASS') {
    fail(`Newsletter ${item.date} quality score ${score}/${threshold} does not pass.`);
  }
  if (!Array.isArray(report.deductions)) {
    fail(`Newsletter ${item.date} quality report must include deductions array.`);
  }

  const editor = readJsonIfExists(path.join(dateNewsroomDir, 'editor-draft.json'));
  const factCheck = readJsonIfExists(path.join(dateNewsroomDir, 'fact-check-report.json'));
  const reporter = readJsonIfExists(path.join(dateNewsroomDir, 'reporter-candidates.json')) || {};
  const shortlistReport = readJsonIfExists(path.join(dateNewsroomDir, 'shortlisted-candidates.json')) || null;
  const staleClaimReport = readJsonIfExists(path.join(dateNewsroomDir, 'stale-claim-report.json')) || null;
  if (editor && factCheck) {
    const recomputed = buildNewsletterQualityReport(item.date, editor, reporter, factCheck, {
      threshold,
      shortlistReport,
      staleClaimReport
    });
    if (recomputed.score !== score || recomputed.status !== report.status) {
      fail(`Newsletter ${item.date} quality report is stale. Expected ${recomputed.score}/${threshold} ${recomputed.status}, found ${score}/${threshold} ${report.status}.`);
    }
  }
}

const changedDates = changedNewsletterDates();
const requireGeneratedReport = fs.existsSync(newsletterDatePath) || process.env.REQUIRE_NEWSLETTER_QUALITY === '1';
for (const item of newsletterItems()) {
  validateQualityReport(item, requireGeneratedReport || changedDates.has(item.date));
}

if (warnings.length > 0) {
  console.warn(warnings.map(warning => `Warning: ${warning}`).join('\n'));
}

if (errors.length > 0) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Validated newsletter quality reports.');
