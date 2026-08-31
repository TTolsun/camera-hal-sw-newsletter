const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  collectedCandidatesRelPath,
  newsroomRelPath
} = require('../../shared/common/artifact-paths');
const {
  REVIEW_ARTIFACT_SCHEMA_VERSION,
  DEBUG_HEAVY,
  TRANSIENT_ATTEMPT,
  buildReviewArtifactInventory,
  resolveRetentionLocation
} = require('./review-artifact-inventory');

const SCHEMA_VERSION = REVIEW_ARTIFACT_SCHEMA_VERSION;

function usage() {
  console.error('Usage: node src/generator/publish/write-artifact-manifest.js <snapshot_dir> <date>');
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
    newsroomRelPath(date, 'selection-diagnostics.md'),
    newsroomRelPath(date, 'selection-report.json'),
    newsroomRelPath(date, 'selection-report.md'),
    newsroomRelPath(date, 'linked-evidence-report.json'),
    newsroomRelPath(date, 'linked-evidence-diagnostics.md'),
    newsroomRelPath(date, 'event-bundles.json'),
    newsroomRelPath(date, 'event-bundle-diagnostics.md'),
    newsroomRelPath(date, 'article-capsules.json'),
    newsroomRelPath(date, 'background-context.json'),
    newsroomRelPath(date, 'reporter-candidates.json'),
    newsroomRelPath(date, 'quality-report.json'),
    newsroomRelPath(date, 'quality-report.md'),
    newsroomRelPath(date, 'evidence-pack-summary.json'),
    newsroomRelPath(date, 'hal-signal-quality-report.json'),
    newsroomRelPath(date, 'hal-signal-quality-report.md'),
    newsroomRelPath(date, 'retry-history.json'),
    newsroomRelPath(date, 'retry-history.md'),
    'articles/data/homepage-headline.json',
    'state/article-exposure-history.json',
    `articles/newsletters/${date}/newsletter.md`,
    `articles/newsletters/${date}/index.html`
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
    'failure_kind',
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
    'composition_mode',
    'selection_composition_mode',
    'editor_review_required',
    'final_publish_ready',
    'validate_ok',
    'underfilled',
    'publish_ready',
    'headline_decision',
    'headline_latest_inclusion',
    'article_exposure_coverage',
    // coverage lineage(대상 주·carry-forward 판정)를 요약에도 싣는다 — 이 요약만 보고도
    // 이번 실행이 어느 대상 주를 다뤘는지, 후보 carry-forward가 정상이었는지 알 수 있어야
    // 전체 generation-status.json을 열지 않고도 리뷰할 수 있다.
    'coverage_week_key',
    'coverage_start_date',
    'coverage_end_date',
    'generation_anchor_date',
    'carry_forward_status'
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

function halSignalQualitySummary(report) {
  if (!report) return null;
  const summary = report.hal_signal_quality_summary || {};
  return {
    schema_version: report.schema_version,
    date: report.date,
    status: report.status,
    input_completeness: report.input_completeness,
    main_article_count: summary.main_article_count,
    article_count_with_hal_signal_capsule: summary.article_count_with_hal_signal_capsule,
    article_count_without_hal_signal_capsule: summary.article_count_without_hal_signal_capsule,
    generic_signal_hard_blocker_count: summary.generic_signal_hard_blocker_count,
    hal_signal_hard_blocker_count: summary.hal_signal_hard_blocker_count
  };
}

function isArtifactManifestPath(relPath) {
  return path.basename(String(relPath || '')) === 'artifact-manifest.json';
}

function walkFiles(root, dir = root, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(root, filePath, files);
    } else if (entry.isFile()) {
      const relPath = toPosix(path.relative(root, filePath));
      if (path.basename(relPath) !== 'artifact-manifest.json') files.push(relPath);
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

function runContextFromStatus(status) {
  const explicitPublicOutputExpected = status?.public_output_expected ?? status?.publicOutputExpected;
  return {
    status: status?.status || 'unknown',
    seedUsed: status?.seed_used ?? status?.candidate_input?.seed_used,
    publicOutputExpected: explicitPublicOutputExpected === true ||
      explicitPublicOutputExpected === 'true' ||
      (explicitPublicOutputExpected === undefined &&
        (status?.public_artifact_ready === true ||
          status?.public_newsletter_ready === true ||
          status?.review_publication_ready === true ||
          status?.final_publish_ready === true))
  };
}

function buildManifest(snapshotDir, date) {
  const warnings = [];
  const resolvedSnapshotDir = path.resolve(snapshotDir);
  const statusRelPath = '.tmp/newsletter-generation-status.json';
  const qualityRelPath = newsroomRelPath(date, 'quality-report.json');
  const halSignalRelPath = newsroomRelPath(date, 'hal-signal-quality-report.json');
  const status = readJsonIfPresent(resolvedSnapshotDir, statusRelPath, warnings);
  const quality = readJsonIfPresent(resolvedSnapshotDir, qualityRelPath, warnings);
  const halSignalQuality = readJsonIfPresent(resolvedSnapshotDir, halSignalRelPath, warnings);
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
  const snapshotRelPaths = walkFiles(resolvedSnapshotDir).sort();
  const reviewInventory = buildReviewArtifactInventory({
    root: resolvedSnapshotDir,
    date,
    runContext: runContextFromStatus(status)
  });

  const retentionLocation = resolveRetentionLocation();

  // heavy 등급(debug_heavy·transient_attempt) 파일만 해싱한다. 이 목록은 커밋되는 date-scoped
  // 매니페스트(buildDateReviewManifest)에도 같은 모양으로 실리는데 정작 그 파일은 PR diff에 없고
  // Actions artifact 안에만 있다. 리뷰어가 내려받은 파일이 그 실행의 것인지 확인할 수단이
  // size·sha256뿐이라 heavy만 바이트를 유지한다. 나머지 파일은 해싱할 이유가 없다(#1018).
  const heavyRetentionGradeByPath = new Map(
    reviewInventory.review_artifacts
      .filter(artifact => artifact.retention_grade === DEBUG_HEAVY || artifact.retention_grade === TRANSIENT_ATTEMPT)
      .map(artifact => [artifact.path, artifact.retention_grade])
  );

  const retainedHeavyArtifacts = snapshotRelPaths
    .filter(relPath => heavyRetentionGradeByPath.has(relPath))
    .map(relPath => {
      const filePath = path.join(resolvedSnapshotDir, ...relPath.split('/'));
      return {
        path: relPath,
        size: fs.statSync(filePath).size,
        sha256: hashFile(filePath),
        retention_grade: heavyRetentionGradeByPath.get(relPath),
        retention_location: retentionLocation
      };
    });

  // files[]는 스냅샷에 실제로 있는 파일의 경로 목록이다. 이 배열의 size·sha256을 읽는 소비자는
  // 없었고, 여기 섞이는 두 종류 어느 쪽도 사본을 둘 이유가 없다. 커밋되는 항목은 Git tree가
  // 바이트 정본이라 매니페스트 사본이 곧 어긋나는 두 번째 정본이 된다. 커밋되지 않는 항목은
  // 파일 자체가 이 매니페스트와 같은 newsroom-final-debug-<run_id> Actions artifact 안에 함께
  // 들어가므로 해시 사본이 따로 가리킬 정본이 없다. 어느 쪽인지는 경로 접두가 아니라 보존
  // 등급이 가른다(retentionCommitAllowlist) — heavy 등급은 articles/** 아래에 있어도 커밋되지
  // 않으므로 두 번째 갈래다. 그래서 date-scoped 매니페스트가 이미 따르는 계약(#951)에 맞춰 path만 남긴다(#1018).
  const files = snapshotRelPaths.map(relPath => ({ path: relPath }));

  // 커밋되는 파일의 바이트 정본은 Git tree이므로 경로와 보존 등급만 기록한다. 이 스냅샷
  // 매니페스트도 파이프라인 도중에 쓰이고 그 뒤로도 같은 파일이 계속 바뀌어서, size·sha256
  // 사본은 기록되는 순간부터 틀린다(#942).
  const committedArtifacts = reviewInventory.review_artifacts
    .filter(artifact => artifact.present &&
      artifact.retention_grade !== DEBUG_HEAVY &&
      artifact.retention_grade !== TRANSIENT_ATTEMPT &&
      !isArtifactManifestPath(artifact.path))
    .map(artifact => ({
      path: artifact.path,
      retention_grade: artifact.retention_grade
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const retentionSummary = {};
  for (const artifact of reviewInventory.review_artifacts) {
    if (!artifact.present) continue;
    const grade = artifact.retention_grade || 'unknown';
    retentionSummary[grade] = (retentionSummary[grade] || 0) + 1;
  }

  const manifest = {
    schema_version: SCHEMA_VERSION,
    date,
    generated_at: new Date().toISOString(),
    status_summary: statusSummary(status),
    quality_summary: qualitySummary(quality),
    hal_signal_quality_summary: halSignalQualitySummary(halSignalQuality),
    files,
    review_summary: reviewInventory.summary,
    review_artifacts: reviewInventory.review_artifacts,
    missing_required_review_artifacts: reviewInventory.missingRequired.map(artifact => artifact.path),
    missing_critical_files: missingCriticalFiles,
    consistency_warnings: warnings,
    retention_schema_version: SCHEMA_VERSION,
    retention_location: retentionLocation,
    retention_summary: retentionSummary,
    retained_heavy_artifacts: retainedHeavyArtifacts,
    committed_artifacts: committedArtifacts
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
