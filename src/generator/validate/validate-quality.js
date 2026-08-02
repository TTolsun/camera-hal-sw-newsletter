const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  buildNewsletterQualityReport
} = require('../quality/newsletter-quality');
const { qualityGatePolicy } = require('../../shared/common/newsletter-policy');
const { readJson } = require('../../shared/common/common');
const {
  newsroomDir,
  newsroomRelPath,
  seedEvidencePackPath
} = require('../../shared/common/artifact-paths');
const {
  historicalPolicyWarningReason,
  strictTargetDates
} = require('../reporter/validation-targets');
const {
  PUBLICATION_MODES
} = require('../../shared/common/publication-mode');
const { isTrue, isFalse } = require('../../shared/common/value-coercion');

const root = process.cwd();
const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
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

// 발행본(origin/main)과 byte 동일한 quality-report는 이미 리뷰·머지가 끝난 확정본이므로,
// 이때의 재계산 불일치는 리포트가 아니라 미커밋 editor-draft.json 로컬 잔재(다른 run 산출물)에서 온다(#742).
// git 확인이 불가능한 환경(비-git 루트 등)에서는 false를 반환해 strict fail 쪽을 유지한다.
function reportMatchesPublishedMain(date) {
  const relPath = newsroomRelPath(date, 'quality-report.json');
  const gitOptions = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  try {
    const worktreeHash = execFileSync('git', ['hash-object', '--', relPath], gitOptions).trim();
    const publishedHash = execFileSync('git', ['rev-parse', `origin/main:${relPath}`], gitOptions).trim();
    return worktreeHash !== '' && worktreeHash === publishedHash;
  } catch (_) {
    return false;
  }
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

function reviewPublicationExceptionReason(item = {}, report = {}, status = {}) {
  const publicationMode = String(
    item.publication_mode ||
    report.publication_mode ||
    status.publication_mode ||
    ''
  ).trim();
  if (![PUBLICATION_MODES.REVIEW_ONLY, PUBLICATION_MODES.FALLBACK_PUBLIC].includes(publicationMode)) return '';
  if (!isTrue(status.review_publication_ready)) return '';
  if (!isTrue(status.public_newsletter_ready)) return '';
  if (!isTrue(status.homepage_visible_after_merge)) return '';
  if (!isTrue(status.editor_review_required)) return '';
  if (!isFalse(status.final_publish_ready)) return '';
  if (isTrue(status.diagnostics_only)) return '';
  if (publicationMode === PUBLICATION_MODES.FALLBACK_PUBLIC) {
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
      if (!strictPolicy) {
        warn(`${message} ${historicalPolicyWarningReason()}.`);
      } else if (reportMatchesPublishedMain(item.date)) {
        warn(`${message} quality-report.json matches published origin/main, so the drift comes from uncommitted local editor-draft.json residue, warning only. Remove ${newsroomRelPath(item.date, 'editor-draft.json')} to clear this warning.`);
      } else {
        fail(message);
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
