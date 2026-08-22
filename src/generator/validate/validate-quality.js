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
  seedEvidencePackPath,
  seedEvidencePackRelPath
} = require('../../shared/common/artifact-paths');
const {
  generatedTargetDates,
  historicalPolicyWarningReason
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

// 발행 확정본 판별(#742): 재계산이 소비하는 committed 입력 전부가 origin/main과 byte 동일하면
// 그 날짜의 발행 상태가 그대로라는 뜻이므로, 재계산 불일치는 커밋 산출물이 아니라 로컬 worktree 쪽
// (남는 파일 입력은 gitignored editor-draft.json 잔재뿐)에서 온다. 하나라도 다르거나 git 확인이
// 불가능하면 false를 반환해 기존 strict fail을 유지한다(fail-closed — quality-report.json은 이
// 경로에서 항상 로컬에 존재하므로 git이 없으면 반드시 false가 된다).
function publishedRecomputeInputsIntact(date) {
  const relPaths = [
    'quality-report.json',
    'generation-status.json',
    'fact-check-report.json',
    'reporter-candidates.json',
    'shortlisted-candidates.json',
    'stale-claim-report.json'
  ].map(name => newsroomRelPath(date, name));
  relPaths.push(seedEvidencePackRelPath(date));
  return relPaths.every(matchesPublishedMain);
}

function matchesPublishedMain(relPath) {
  const gitOptions = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  let publishedHash = null;
  try {
    publishedHash = execFileSync('git', ['rev-parse', `origin/main:${relPath}`], gitOptions).trim();
  } catch (_) {
    publishedHash = null;
  }
  if (!fs.existsSync(path.join(root, relPath))) return publishedHash === null;
  if (!publishedHash) return false;
  try {
    return execFileSync('git', ['hash-object', '--', relPath], gitOptions).trim() === publishedHash;
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
      } else if (publishedRecomputeInputsIntact(item.date)) {
        warn(`${message} Every committed recompute input matches published origin/main, so the drift most likely comes from the uncommitted local editor-draft.json residue, warning only. Remove ${newsroomRelPath(item.date, 'editor-draft.json')} to clear this warning.`);
      } else {
        fail(message);
      }
    }
  }
}

// 품질 재판정은 그 실행이 **만들어 낸** 호에만 건다. 저장된 quality-report는 생성 실행의
// 산출물이라, 이미 발행된 페이지를 고치는 변경은 이 요구를 사후에 만족시킬 수 없다 — 내용이
// 바뀌지 않았는데도 그 호가 변경 집합에 들었다는 이유만으로 hard fail이 난다. 실제로
// 2026-05-05가 그렇게 막혔고, 상태·점수·차감 범주가 동일한 2026-05-20은 경고에 그쳤다.
const strictDates = generatedTargetDates({ root, newsletterDatePath });
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
