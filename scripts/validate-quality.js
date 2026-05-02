const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  QUALITY_THRESHOLD,
  buildNewsletterQualityReport
} = require('./lib/newsletter-quality');
const { readJson } = require('./lib/common');

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
    const normalized = file.replace(/\\/g, '/');
    const match = normalized.match(/^(?:newsletters|newsroom|collected-news)\/(\d{4}-\d{2}-\d{2})\//);
    if (match) dates.add(match[1]);
  }
  return dates;
}

function validateQualityReport(item, requireReport) {
  const reportPath = path.join(root, 'newsroom', item.date, 'quality-report.json');
  if (!fs.existsSync(reportPath)) {
    if (requireReport) {
      fail(`Missing quality report for generated newsletter ${item.date}: newsroom/${item.date}/quality-report.json`);
    }
    return;
  }

  const report = readJsonIfExists(reportPath);
  if (!report) return;
  const threshold = Number.isFinite(Number(report.threshold)) ? Number(report.threshold) : QUALITY_THRESHOLD;
  const score = Number(report.score);
  if (!Number.isFinite(score)) {
    fail(`Newsletter ${item.date} quality report has invalid score.`);
    return;
  }
  if (threshold < QUALITY_THRESHOLD) {
    fail(`Newsletter ${item.date} quality threshold must be at least ${QUALITY_THRESHOLD}, found ${threshold}.`);
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

  const editor = readJsonIfExists(path.join(root, 'newsroom', item.date, 'editor-draft.json'));
  const factCheck = readJsonIfExists(path.join(root, 'newsroom', item.date, 'fact-check-report.json'));
  const reporter = readJsonIfExists(path.join(root, 'newsroom', item.date, 'reporter-candidates.json')) || {};
  if (editor && factCheck) {
    const recomputed = buildNewsletterQualityReport(item.date, editor, reporter, factCheck, { threshold });
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
