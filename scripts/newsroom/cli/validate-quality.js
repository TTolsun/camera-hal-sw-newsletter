const fs = require('fs');
const path = require('path');
const {
  buildNewsletterQualityReport
} = require('../validate/newsletter-quality');
const { qualityGatePolicy } = require('../../../src/core/common/newsletter-policy');
const { readJson } = require('../../../src/core/common/common');
const {
  newsroomDir,
  newsroomRelPath,
  seedEvidencePackPath
} = require('../../../src/core/common/artifact-paths');
const {
  historicalPolicyWarningReason,
  strictTargetDates
} = require('../common/validation-targets');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const generationStatusPath = path.join(root, '.tmp', 'newsletter-generation-status.json');
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function currentGenerationStatusDate(filePath = generationStatusPath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  try {
    const parsed = readJson(filePath);
    const date = String(parsed?.date || '').trim();
    const statusSha = String(parsed?.run_context?.github_sha || '').trim();
    const currentSha = String(process.env.GITHUB_SHA || '').trim();
    if (statusSha && (!currentSha || statusSha !== currentSha)) return '';
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  } catch (_) {
    return '';
  }
}

function currentCanonicalGenerationStatusDates(items = []) {
  const currentSha = String(process.env.GITHUB_SHA || '').trim();
  if (!currentSha) return new Set();
  const dates = new Set();
  for (const item of items) {
    const filePath = path.join(newsroomDir(root, item.date), 'generation-status.json');
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = readJson(filePath);
      const statusSha = String(parsed?.run_context?.github_sha || '').trim();
      const date = String(parsed?.date || item.date || '').trim();
      if (statusSha === currentSha && /^\d{4}-\d{2}-\d{2}$/.test(date)) dates.add(date);
    } catch (error) {
      fail(`Invalid JSON in ${path.relative(root, filePath)}: ${error.message}`);
    }
  }
  return dates;
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

function isTrue(value) {
  return value === true || value === 'true';
}

function isFalse(value) {
  return value === false || value === 'false';
}

function reviewPublicationExceptionReason(item = {}, report = {}, status = {}) {
  const publicationMode = String(
    item.publication_mode ||
    report.publication_mode ||
    status.publication_mode ||
    ''
  ).trim();
  if (!['review_only', 'fallback_public'].includes(publicationMode)) return '';
  if (!isTrue(status.review_publication_ready)) return '';
  if (!isTrue(status.public_newsletter_ready)) return '';
  if (!isTrue(status.homepage_visible_after_merge)) return '';
  if (!isTrue(status.editor_review_required)) return '';
  if (!isFalse(status.final_publish_ready)) return '';
  if (isTrue(status.diagnostics_only)) return '';
  if (publicationMode === 'fallback_public') {
    if (!isTrue(status.fallback_public_ready)) return '';
    if (!isTrue(status.fallback_only)) return '';
    if (Number(status.camera_anchor_count) !== 0) return '';
  }
  const reason = String(
    status.review_publication_ready_reason ||
    report.review_publication_ready_reason ||
    status.editor_review_reason ||
    report.editor_review_reason ||
    ''
  ).trim();
  return reason;
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

function validateQualityReport(item, { requireReport = false, strictPolicy = false } = {}) {
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
  const status = readJsonIfExists(path.join(dateNewsroomDir, 'generation-status.json')) || {};
  const reviewPublicationReason = reviewPublicationExceptionReason(item, report, status);
  const strictClaimValidation = strictPolicy && !reviewPublicationReason;
  const threshold = Number.isFinite(Number(report.threshold)) ? Number(report.threshold) : qualityGatePolicy.threshold;
  const score = Number(report.score);
  if (!Number.isFinite(score)) {
    fail(`Newsletter ${item.date} quality report has invalid score.`);
    return;
  }
  if (threshold < qualityGatePolicy.threshold) {
    const message = `Newsletter ${item.date} quality threshold is below current Newsletter Policy threshold ${qualityGatePolicy.threshold}, found ${threshold}.`;
    if (strictPolicy) {
      fail(message);
    } else {
      warn(`${message} ${historicalPolicyWarningReason()}.`);
    }
  }
  if (score < threshold || report.status !== 'PASS') {
    const message = `Newsletter ${item.date} quality score ${score}/${threshold} does not pass: ${report.status}.`;
    if (strictPolicy) {
      fail(message);
    } else {
      warn(`${message} ${historicalPolicyWarningReason()}.`);
    }
  }
  if (!Array.isArray(report.deductions)) {
    fail(`Newsletter ${item.date} quality report must include deductions array.`);
  }

  const editor = readJsonIfExists(path.join(dateNewsroomDir, 'editor-draft.json'));
  const factCheck = readJsonIfExists(path.join(dateNewsroomDir, 'fact-check-report.json'));
  const reporter = readJsonIfExists(path.join(dateNewsroomDir, 'reporter-candidates.json')) || {};
  const shortlistReport = readJsonIfExists(path.join(dateNewsroomDir, 'shortlisted-candidates.json')) || null;
  const staleClaimReport = readJsonIfExists(path.join(dateNewsroomDir, 'stale-claim-report.json')) || null;
  const seedEvidencePack = readJsonIfExists(seedEvidencePackPath(root, item.date)) || null;
  if (editor && factCheck) {
    const recomputed = buildNewsletterQualityReport(item.date, editor, reporter, factCheck, {
      threshold,
      shortlistReport,
      staleClaimReport,
      strictClaimValidation,
      seedEvidencePack
    });
    if (recomputed.score !== score || recomputed.status !== report.status) {
      const message = `Newsletter ${item.date} quality report is stale. Expected ${recomputed.score}/${threshold} ${recomputed.status}, found ${score}/${threshold} ${report.status}.`;
      if (strictPolicy) {
        fail(message);
      } else {
        warn(`${message} ${historicalPolicyWarningReason()}.`);
      }
    }
  }
}

const strictDates = strictTargetDates({ root, newsletterDatePath });
const currentGenerationDate = currentGenerationStatusDate(generationStatusPath);
if (currentGenerationDate) strictDates.add(currentGenerationDate);
const items = newsletterItems();
for (const date of currentCanonicalGenerationStatusDates(items)) strictDates.add(date);
const requireAllReports = process.env.REQUIRE_NEWSLETTER_QUALITY === '1';
for (const item of items) {
  const strictPolicy = requireAllReports || strictDates.has(item.date);
  validateQualityReport(item, {
    requireReport: strictPolicy,
    strictPolicy
  });
}

if (warnings.length > 0) {
  console.warn(warnings.map(warning => `Warning: ${warning}`).join('\n'));
}

if (errors.length > 0) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Validated newsletter quality reports.');
