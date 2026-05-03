const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  collectedCandidatesRelPath,
  newsroomRelPath
} = require('../common/artifact-paths');

const SCHEMA_VERSION = 1;

function usage() {
  console.error('Usage: node scripts/write-artifact-manifest.js <snapshot_dir> <date>');
  process.exit(1);
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function criticalFiles(date) {
  return [
    '.tmp/newsletter-date.txt',
    '.tmp/newsletter-generation-status.json',
    collectedCandidatesRelPath(date),
    newsroomRelPath(date, 'shortlisted-candidates.json'),
    newsroomRelPath(date, 'reporter-candidates.json'),
    newsroomRelPath(date, 'quality-report.json'),
    newsroomRelPath(date, 'quality-report.md'),
    newsroomRelPath(date, 'retry-history.json'),
    newsroomRelPath(date, 'retry-history.md'),
    `newsletters/${date}/newsletter.md`,
    `newsletters/${date}/index.html`
  ];
}

function readJsonIfPresent(root, relPath, warnings) {
  const filePath = path.join(root, ...relPath.split('/'));
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`${relPath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function readTextIfPresent(root, relPath) {
  const filePath = path.join(root, ...relPath.split('/'));
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
}

function firstValue(source, paths) {
  if (!source || typeof source !== 'object') return undefined;
  for (const segments of paths) {
    let current = source;
    for (const segment of segments) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        current = undefined;
        break;
      }
      current = current[segment];
    }
    if (current !== undefined && current !== null && current !== '') return current;
  }
  return undefined;
}

function comparable(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== '') return numeric;
  return String(value).trim();
}

function addMismatchWarning(warnings, label, leftName, leftValue, rightName, rightValue) {
  const left = comparable(leftValue);
  const right = comparable(rightValue);
  if (left === undefined || right === undefined || left === right) return;
  warnings.push(`${label} mismatch: ${leftName}=${left} ${rightName}=${right}`);
}

function statusSummary(status) {
  if (!status) return null;
  const fields = [
    'date',
    'newsletter_date',
    'status',
    'failure_stage',
    'failure_reason',
    'fact_check_status',
    'must_fix_count',
    'quality_status',
    'quality_score',
    'quality_threshold',
    'quality_attempt_count',
    'input_candidate_count',
    'eligible_candidate_count',
    'selected_article_count',
    'underfilled',
    'publish_ready'
  ];
  return Object.fromEntries(fields.filter(field => status[field] !== undefined).map(field => [field, status[field]]));
}

function qualitySummary(report) {
  if (!report) return null;
  return {
    schema_version: report.schema_version,
    date: report.date || report.newsletter_date,
    score: report.score,
    threshold: report.threshold,
    status: report.status,
    article_count: report.metrics?.article_count ?? report.article_count,
    must_fix_count: report.metrics?.must_fix_count
  };
}

function walkFiles(root, dir = root, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(root, filePath, files);
    } else if (entry.isFile()) {
      const relPath = toPosix(path.relative(root, filePath));
      if (relPath !== 'artifact-manifest.json') files.push(relPath);
    }
  }
  return files;
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function gitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (_) {
    return '';
  }
}

function buildManifest(snapshotDir, date) {
  const warnings = [];
  const resolvedSnapshotDir = path.resolve(snapshotDir);
  const statusRelPath = '.tmp/newsletter-generation-status.json';
  const qualityRelPath = newsroomRelPath(date, 'quality-report.json');
  const status = readJsonIfPresent(resolvedSnapshotDir, statusRelPath, warnings);
  const quality = readJsonIfPresent(resolvedSnapshotDir, qualityRelPath, warnings);
  const dateText = readTextIfPresent(resolvedSnapshotDir, '.tmp/newsletter-date.txt');

  if (dateText) {
    addMismatchWarning(warnings, 'date', 'manifest.date', date, '.tmp/newsletter-date.txt', dateText);
  }

  if (status && quality) {
    addMismatchWarning(
      warnings,
      'date',
      'newsletter-generation-status',
      firstValue(status, [['date'], ['newsletter_date']]),
      'quality-report',
      firstValue(quality, [['date'], ['newsletter_date']])
    );
    addMismatchWarning(
      warnings,
      'quality score',
      'newsletter-generation-status',
      firstValue(status, [['quality_score'], ['score']]),
      'quality-report',
      firstValue(quality, [['score'], ['quality_score']])
    );
    addMismatchWarning(
      warnings,
      'article count',
      'newsletter-generation-status',
      firstValue(status, [['selected_article_count'], ['article_count']]),
      'quality-report',
      firstValue(quality, [['metrics', 'article_count'], ['article_count'], ['selected_article_count']])
    );
    addMismatchWarning(
      warnings,
      'quality status',
      'newsletter-generation-status',
      firstValue(status, [['quality_status'], ['status']]),
      'quality-report',
      firstValue(quality, [['status'], ['quality_status']])
    );
  }

  const missingCriticalFiles = criticalFiles(date).filter(relPath => {
    return !fs.existsSync(path.join(resolvedSnapshotDir, ...relPath.split('/')));
  });
  const files = walkFiles(resolvedSnapshotDir)
    .sort()
    .map(relPath => {
      const filePath = path.join(resolvedSnapshotDir, ...relPath.split('/'));
      const stat = fs.statSync(filePath);
      return {
        path: relPath,
        size: stat.size,
        sha256: hashFile(filePath)
      };
    });

  const manifest = {
    schema_version: SCHEMA_VERSION,
    date,
    generated_at: new Date().toISOString(),
    status_summary: statusSummary(status),
    quality_summary: qualitySummary(quality),
    files,
    missing_critical_files: missingCriticalFiles,
    consistency_warnings: warnings
  };

  const sha = gitSha();
  if (sha) manifest.git_sha = sha;
  if (process.env.GITHUB_RUN_ID) manifest.github_run_id = process.env.GITHUB_RUN_ID;
  if (process.env.GITHUB_JOB) manifest.github_job = process.env.GITHUB_JOB;

  return manifest;
}

function main() {
  const [, , snapshotDir, date] = process.argv;
  if (!snapshotDir || !date) usage();
  const manifest = buildManifest(snapshotDir, date);
  fs.writeFileSync(
    path.join(path.resolve(snapshotDir), 'artifact-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  console.log(`Wrote artifact manifest for ${date}: ${path.join(snapshotDir, 'artifact-manifest.json')}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildManifest,
  criticalFiles
};
