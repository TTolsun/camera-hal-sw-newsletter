const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { isTrue, isFalse } = require('../../shared/common/value-coercion');
const {
  kstDate
} = require('../../shared/common/common');
const {
  readJsonIfExists
} = require('../../shared/common/json');
const {
  readStatus,
  renderGithubOutputs
} = require('./write-generation-status-output');
const {
  REQUIRED_PUBLIC_NEWSLETTER_FILES,
  newsletterIndexDateStatus,
  publicNewsletterStructureStatus,
  requiredPublicFiles,
  weeklyNewsletterStructureStatus
} = require('./public-structure');
const {
  weeklyKeyForDate
} = require('../reporter/weekly-newsletter');
const {
  PUBLICATION_MODES,
  HOMEPAGE_VISIBILITY,
  FALLBACK_HOMEPAGE_BADGE
} = require('../../shared/common/publication-mode');

const STATUS_FAILED_REPAIR_REVIEWABLE = 'FAILED_REPAIR_REVIEWABLE';
const STATUS_FAILED_RAW_ARTIFACT_VALIDATION = 'FAILED_RAW_ARTIFACT_VALIDATION';
const STATUS_FAILED_EDITOR_REVIEWABLE = 'FAILED_EDITOR_REVIEWABLE';
const FAILURE_KIND_EDITORIAL_REVIEWABLE = 'editorial_reviewable';
const FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE = 'candidate_shortage_reviewable';

const REVIEWABLE_STATUSES = new Set([
  'PASS',
  'NEEDS_FIX',
  'QUALITY_NEEDS_FIX',
  'UNDERFILLED_NEEDS_FIX',
  STATUS_FAILED_REPAIR_REVIEWABLE,
  STATUS_FAILED_RAW_ARTIFACT_VALIDATION,
  STATUS_FAILED_EDITOR_REVIEWABLE
]);

const CANONICAL_REVIEW_ARTIFACTS = [
  'editor-draft.json',
  'fact-check-report.json',
  'quality-report.json',
  'hal-signal-quality-report.json',
  'hal-signal-quality-report.md',
  'generation-status.json',
  'retry-history.json',
  'repair-failure.json',
  'recovery-prompt.md',
  'shortlisted-candidates.json',
  'article-capsules.json',
  'background-context.json',
  'selection-report.json',
  'selection-diagnostics.md'
];

// hal-signal-quality-report.* is best-effort (written by the review package writer during
// generate, with a continue-on-error workflow backfill step for crash paths), so it must not
// gate reviewability (#503). It stays in CANONICAL_REVIEW_ARTIFACTS so it is still bundled
// into the review PR when present.
const REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS = [
  'editor-draft.json',
  'quality-report.json',
  'fact-check-report.json',
  'repair-failure.json',
  'generation-status.json'
];

// The editor can hard-fail (semantic validation) before any valid draft exists. The deterministic
// selection artifacts written before the editor are still reviewable, so the daily job produces a
// diagnostics PR instead of crashing. No editor-draft / quality-report is required here.
const REQUIRED_FAILED_EDITOR_REVIEWABLE_ARTIFACTS = [
  'generation-status.json',
  'shortlisted-candidates.json',
  'selection-report.json',
  'selection-diagnostics.md',
  'article-capsules.json'
];

// Raw artifact validation fails before any LLM step, so only generation-status is guaranteed.
const REQUIRED_FAILED_RAW_ARTIFACT_VALIDATION_REVIEWABLE_ARTIFACTS = [
  'generation-status.json'
];

const REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS = [
  'editor-draft.json',
  'quality-report.json',
  'fact-check-report.json',
  'generation-status.json'
];

const REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS = [
  'generation-status.json',
  'shortlisted-candidates.json',
  'selection-report.json',
  'selection-diagnostics.md',
  'article-capsules.json'
];

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
}

function readTextResult(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, text: '', error: null };
  }
  try {
    return { exists: true, text: fs.readFileSync(filePath, 'utf8'), error: null };
  } catch (error) {
    return { exists: true, text: '', error };
  }
}

function toRepoPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGitStatusPorcelain(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(line => {
      const rawPath = line.slice(3).trim();
      const renameIndex = rawPath.lastIndexOf(' -> ');
      const currentPath = renameIndex >= 0 ? rawPath.slice(renameIndex + 4) : rawPath;
      return toRepoPath(currentPath.replace(/^"|"$/g, ''));
    })
    .filter(Boolean);
}

function getChangedRepoVisibleArtifacts({ root = process.cwd(), date } = {}) {
  if (!date) return [];
  try {
    const output = execFileSync(
      'git',
      [
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--',
        `articles/content/newsroom/${date}`,
        `articles/newsletters/${date}`,
        'articles/data/newsletters.json'
      ],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );
    return parseGitStatusPorcelain(output);
  } catch (_) {
    return [];
  }
}

// 이번 실행이 만든 산출물이 아니라 **직전 커밋에 이미 들어 있는** 발행물을 본다(#1160).
// getChangedRepoVisibleArtifacts는 작업 트리의 변경을 보므로, 이미 발행된 주를 다시 생성해도
// "바뀐 산출물이 있다"로 읽힌다. 재생성물은 LLM 출력이라 매번 달라서 그 경로로는 중복 발행을
// 절대 구분하지 못한다.
//
// 발행 단위는 주간호다. 날짜 경로만 보면 같은 주를 다른 날짜로 다시 만드는 실행을 놓친다 —
// 예약 발행 다음 날 재실행하면 날짜가 바뀌므로 그 경로가 실제 복구 절차에서 바로 열린다.
// 그래서 날짜 페이지와 주간 페이지를 함께 본다. 둘 다 PR이 커밋하는 대상이다
// (review-artifact-inventory.js의 retention allowlist).
function publishedIssuePathsFor(date) {
  const paths = [`articles/newsletters/${date}/index.html`];
  try {
    paths.push(`articles/newsletters/${weeklyKeyForDate(date)}/index.html`);
  } catch (_) {
    // weeklyKeyForDate는 YYYY-MM-DD가 아니면 throw한다. 주간 경로를 못 만든 것뿐이라
    // 날짜 경로 검사는 그대로 진행한다.
  }
  return paths;
}

function alreadyPublishedIssueAtHead(root, date) {
  if (!date) return { status: 'not_published', paths: [], matched: [] };
  const paths = publishedIssuePathsFor(date);
  try {
    // git을 쓸 수 없거나 저장소가 아니면 측정 자체가 불가능하다. 커밋이 없는 경우와 구분해야
    // 한다 — 전자를 not_published로 흡수하면 가드가 조용히 열린다.
    execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore']
    });
  } catch (_) {
    return { status: 'check_failed', paths, matched: [] };
  }
  try {
    // 커밋이 하나도 없는 저장소(테스트 fixture의 git init 직후)에는 HEAD가 없다. 저장소는
    // 멀쩡하므로 발행된 것이 없다는 뜻이다.
    execFileSync('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore']
    });
  } catch (_) {
    return { status: 'not_published', paths, matched: [] };
  }
  try {
    const output = execFileSync('git', ['ls-tree', '--name-only', 'HEAD', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const matched = String(output).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return { status: matched.length > 0 ? 'published' : 'not_published', paths, matched };
  } catch (_) {
    return { status: 'check_failed', paths, matched: [] };
  }
}

// 재발행 차단 규칙. 03 단계의 PR 생성(#1160)과 오케스트레이터 맨 앞의 가드(#1167)가 같은 규칙을
// 쓰도록 한곳에 둔다. check_failed도 막는다 — 측정하지 못한 것을 통과로 다루지 않는다.
function isRepublishBlocked(publishedStatus, allowRepublish) {
  return !allowRepublish && (publishedStatus === 'published' || publishedStatus === 'check_failed');
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
  return relativeFiles
    .map(relativeFile => relativeFile.replaceAll('${date}', date))
    .filter(relativeFile => fs.existsSync(path.join(root, relativeFile)));
}

function artifactJsonReadResults(root, date, artifactNames) {
  return Object.fromEntries(artifactNames.map(name => [
    name,
    readJsonIfExists(path.join(root, 'articles', 'content', 'newsroom', date, name))
  ]));
}

function artifactReadResults(root, date, artifactNames) {
  return Object.fromEntries(artifactNames.map(name => {
    const filePath = path.join(root, 'articles', 'content', 'newsroom', date, name);
    if (name.endsWith('.json')) {
      return [name, readJsonIfExists(filePath)];
    }
    return [name, readTextResult(filePath)];
  }));
}

function missingArtifacts(results) {
  return Object.entries(results)
    .filter(([, result]) => !result.exists)
    .map(([name]) => name);
}

function invalidArtifacts(results) {
  return Object.entries(results)
    .filter(([, result]) => result.error)
    .map(([name, result]) => `${name}: ${result.error.message}`);
}

function relevantChangedArtifacts(changedArtifacts, date) {
  return [...new Set((Array.isArray(changedArtifacts) ? changedArtifacts : [])
    .map(toRepoPath)
    .filter(filePath =>
      filePath.startsWith(`articles/content/newsroom/${date}/`) ||
      filePath.startsWith(`articles/newsletters/${date}/`) ||
      filePath === 'articles/data/newsletters.json'
    ))].sort();
}

// 관측 값이라 오류 전문을 status에 싣지 않는다. 어느 규칙이 걸렸는지 알아볼 수 있을 만큼만
// 남기고, 전체는 검사를 다시 돌리면 나온다.
const MAX_OBSERVED_WEEKLY_STRUCTURE_ERRORS = 5;

function weeklyStructureObservation(root, date) {
  // weeklyKeyForDate는 YYYY-MM-DD가 아니면 throw한다. 여기서 새어 나가면 관측 하나 때문에
  // 진단만 내던 실행이 통째로 죽는다 — 게이트보다 나쁘다. resolveDate가 고르는 값은
  // .tmp 파일이나 환경 변수에서 올 수 있고 형식 검증을 받지 않는다.
  // review-artifact-inventory.js가 같은 함수를 같은 이유로 감싸고 있다.
  //
  // 날짜를 못 읽은 경우와 "이번 주 페이지가 아직 없는" 경우가 같은 not_written으로 합쳐진다.
  // 둘을 가르는 것은 weeklyKey가 비어 있는지 여부다.
  let weeklyKey = '';
  try {
    weeklyKey = weeklyKeyForDate(date);
  } catch {
    return { weeklyKey: '', status: 'not_written', errors: [] };
  }
  // 그 주 첫 publish-ready 실행이 주간 3종을 쓰고 커밋하므로, 같은 주의 뒤 실행은 자기가
  // 만들지 않은 페이지를 본다. 관측 대상은 "지금 디스크에 있는 그 주 페이지"이고, 페이지가
  // 아직 없는 것은 결함이 아니라 그 실행의 정상 결과다.
  if (!fs.existsSync(path.join(root, 'articles', 'newsletters', weeklyKey, 'index.html'))) {
    return { weeklyKey, status: 'not_written', errors: [] };
  }
  // 검사 자체도 감싼다. 지금 이 경로의 파일 읽기는 전부 방어적이라 던지지 않지만, 그것을
  // 강제하는 것이 없고 검사가 먹는 주간 issue.json은 이미 스키마가 여러 번 바뀐 산출물이다.
  // 이 호출자는 continue-on-error 없는 워크플로 스텝 세 곳에서 돌기 때문에, 관측 하나가
  // 던지면 진단만 내던 실행이 통째로 죽는다.
  try {
    const result = weeklyNewsletterStructureStatus(root, weeklyKey);
    return {
      weeklyKey,
      status: result.ok ? 'ok' : 'errors',
      errors: result.errors.slice(0, MAX_OBSERVED_WEEKLY_STRUCTURE_ERRORS)
    };
  } catch (error) {
    return {
      weeklyKey,
      status: 'check_failed',
      errors: [String(error?.message || error)].slice(0, MAX_OBSERVED_WEEKLY_STRUCTURE_ERRORS)
    };
  }
}

function resolveReviewableArtifacts(options = {}) {
  const root = options.root || process.cwd();
  const statusPath = options.statusPath || path.join(root, '.tmp', 'newsletter-generation-status.json');
  const status = options.status || readStatus(statusPath);
  const date = resolveDate({ root, status, explicitDate: options.date });
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
  const branch = options.branch || `newsletter/${date}`;
  const canonicalArtifacts = fs.existsSync(newsroomDir)
    ? CANONICAL_REVIEW_ARTIFACTS.filter(file => fs.existsSync(path.join(newsroomDir, file)))
    : [];
  const requiredPublicArtifacts = requiredPublicFiles(date);
  const publicArtifacts = existingArtifacts(root, date, REQUIRED_PUBLIC_NEWSLETTER_FILES);
  const publicStructure = publicNewsletterStructureStatus(root, date);
  // 독자가 홈과 아카이브에서 실제로 여는 페이지는 주간호인데, 발행 시점에 그것을 검사하는
  // 경로가 없었다(#905). 이 자리는 repair 이후라 newsroom:repair-images가 이미 주간 3종과
  // article_images를 다시 쓴 상태다 — 그 전에 판정하면 임시 이미지 상태를 최종으로 오판한다.
  //
  // #905는 관측으로만 남겼고, #1142가 게이트로 승격했다. 발행된 주간호 20개(W19~W38)에 이
  // 검사를 전수로 돌려 현행 생성기가 만드는 최근 14개 호가 전부 통과함을 확인한 뒤다. 검사가
  // 이번 주 키 하나만 보므로 옛 스키마인 과거 6개 호(W19~W23, W26)는 대상이 되지 않는다.
  //
  // not_written은 같은 주 뒤 실행의 정상 상태라 통과시킨다. errors와 check_failed(검사 불능)는
  // fail-closed로 막는다 — 측정하지 못한 것을 통과로 다루지 않는다.
  const weeklyStructure = weeklyStructureObservation(root, date);
  const weeklyStructureBlocked =
    weeklyStructure.status === 'errors' ||
    weeklyStructure.status === 'check_failed';
  const newsletterIndex = newsletterIndexDateStatus(root, date);
  const changedArtifacts = Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')
    ? relevantChangedArtifacts(options.changedArtifacts, date)
    : relevantChangedArtifacts(getChangedRepoVisibleArtifacts({ root, date }), date);
  const hasCanonicalDiagnostic = canonicalArtifacts.length > 0;
  const statusReviewable = REVIEWABLE_STATUSES.has(status.status);
  const failedRepairReviewable = status.status === STATUS_FAILED_REPAIR_REVIEWABLE;
  const failedRawArtifactValidationReviewable = status.status === STATUS_FAILED_RAW_ARTIFACT_VALIDATION;
  const failedEditorReviewable = status.status === STATUS_FAILED_EDITOR_REVIEWABLE;
  const changedRequiredPublicArtifacts = requiredPublicArtifacts.filter(filePath => changedArtifacts.includes(filePath));
  const editorialArtifacts = artifactReadResults(root, date, REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS);
  const editorialGenerationStatus = editorialArtifacts['generation-status.json'];
  const candidateShortageArtifacts = artifactReadResults(root, date, REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS);
  const candidateShortageGenerationStatus = candidateShortageArtifacts['generation-status.json'];
  const statusValues = [status.status, editorialGenerationStatus.value?.status].filter(Boolean);
  const failureKinds = [
    status.failure_kind,
    editorialGenerationStatus.value?.failure_kind,
    candidateShortageGenerationStatus.value?.failure_kind
  ].filter(Boolean);
  const candidateShortageRequested = failureKinds.includes(FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE);
  const editorialStatus = statusValues.some(value => value === 'NEEDS_FIX' || value === 'QUALITY_NEEDS_FIX');
  const editorialReviewableRequested =
    status.failure_kind === FAILURE_KIND_EDITORIAL_REVIEWABLE ||
    editorialGenerationStatus.value?.failure_kind === FAILURE_KIND_EDITORIAL_REVIEWABLE ||
    editorialStatus;
  const editorialMissingRequired = missingArtifacts(editorialArtifacts);
  const editorialInvalidArtifacts = invalidArtifacts(editorialArtifacts);
  const candidateShortageMissingRequired = missingArtifacts(candidateShortageArtifacts);
  const candidateShortageInvalidArtifacts = invalidArtifacts(candidateShortageArtifacts);
  const candidateShortageRejectReasons = [];
  if (candidateShortageRequested) {
    if (!candidateShortageGenerationStatus.exists) {
      candidateShortageRejectReasons.push('candidate_shortage_generation_status=missing');
    } else if (candidateShortageGenerationStatus.error) {
      candidateShortageRejectReasons.push(`candidate_shortage_generation_status=invalid:${candidateShortageGenerationStatus.error.message}`);
    } else if (candidateShortageGenerationStatus.value?.status !== 'UNDERFILLED_NEEDS_FIX') {
      candidateShortageRejectReasons.push(`candidate_shortage_status=${candidateShortageGenerationStatus.value?.status || 'missing'}`);
    } else if (candidateShortageGenerationStatus.value?.failure_kind !== FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE) {
      candidateShortageRejectReasons.push(`candidate_shortage_failure_kind=${candidateShortageGenerationStatus.value?.failure_kind || 'missing'}`);
    }
    if (candidateShortageMissingRequired.length > 0) {
      candidateShortageRejectReasons.push(`missing_candidate_shortage_required=${candidateShortageMissingRequired.join(',')}`);
    }
    if (candidateShortageInvalidArtifacts.length > 0) {
      candidateShortageRejectReasons.push(`invalid_candidate_shortage_required=${candidateShortageInvalidArtifacts.join(',')}`);
    }
  }
  const editorialRejectReasons = [];
  if (editorialReviewableRequested) {
    if (!editorialStatus) {
      editorialRejectReasons.push(`status_not_editorial=${statusValues.find(Boolean) || 'UNKNOWN'}`);
    }
    if (!editorialGenerationStatus.exists) {
      editorialRejectReasons.push('canonical_generation_status=missing');
    } else if (editorialGenerationStatus.error) {
      editorialRejectReasons.push(`canonical_generation_status=invalid:${editorialGenerationStatus.error.message}`);
    } else if (editorialGenerationStatus.value?.failure_kind !== FAILURE_KIND_EDITORIAL_REVIEWABLE) {
      editorialRejectReasons.push(`canonical_failure_kind=${editorialGenerationStatus.value?.failure_kind || 'missing'}`);
    }
    if (editorialMissingRequired.length > 0) {
      editorialRejectReasons.push(`missing_editorial_required=${editorialMissingRequired.join(',')}`);
    }
    if (editorialInvalidArtifacts.length > 0) {
      editorialRejectReasons.push(`invalid_editorial_required=${editorialInvalidArtifacts.join(',')}`);
    }
    if (newsletterIndex.error) {
      editorialRejectReasons.push(`data_newsletters_invalid=${newsletterIndex.error.message}`);
    }
  }
  const missingRequired = failedRepairReviewable
    ? REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.filter(file => !canonicalArtifacts.includes(file))
    : failedRawArtifactValidationReviewable
      ? REQUIRED_FAILED_RAW_ARTIFACT_VALIDATION_REVIEWABLE_ARTIFACTS.filter(file => !canonicalArtifacts.includes(file))
      : failedEditorReviewable
        ? REQUIRED_FAILED_EDITOR_REVIEWABLE_ARTIFACTS.filter(file => !canonicalArtifacts.includes(file))
        : [];
  const hasRequiredCanonicalArtifacts = failedRepairReviewable
    ? missingRequired.length === 0
    : failedRawArtifactValidationReviewable
      ? missingRequired.length === 0
      : failedEditorReviewable
        ? missingRequired.length === 0
        : candidateShortageRequested
          ? candidateShortageRejectReasons.length === 0
          : editorialReviewableRequested
            ? editorialRejectReasons.length === 0
            : hasCanonicalDiagnostic;
  let hasReviewableArtifacts =
    hasRequiredCanonicalArtifacts &&
    statusReviewable &&
    changedArtifacts.length > 0 &&
    (!editorialReviewableRequested || editorialRejectReasons.length === 0) &&
    (!candidateShortageRequested || candidateShortageRejectReasons.length === 0);
  const hasPublicArtifacts = publicArtifacts.length > 0;
  const hasRequiredPublicNewsletterFiles =
    publicStructure.requiredFilesExist &&
    publicStructure.requiredFilesNonEmpty &&
    newsletterIndex.hasDate === true &&
    newsletterIndex.pathsMatch === true;
  const missingChangedPublicArtifacts = requiredPublicArtifacts.filter(filePath => !changedArtifacts.includes(filePath));
  const publicNewsletterReasons = [
    ...publicStructure.errors,
    missingChangedPublicArtifacts.length > 0
      ? `required public files not changed: ${missingChangedPublicArtifacts.join(',')}`
      : '',
    weeklyStructureBlocked
      ? `weekly page structure ${weeklyStructure.status} (${weeklyStructure.weeklyKey}): ${weeklyStructure.errors.join('|') || 'no error detail'}`
      : ''
  ].filter(Boolean);
  const publicNewsletterReady =
    hasRequiredPublicNewsletterFiles &&
    publicStructure.ok &&
    missingChangedPublicArtifacts.length === 0 &&
    !weeklyStructureBlocked;
  if (publicNewsletterReady) {
    hasReviewableArtifacts = true;
  }
  const changedArtifactCount = changedArtifacts.length;
  // 이미 발행된 호를 다시 만든 실행은 PR을 열지 않는다(#1160). 그대로 두면 발행본을 덮는 PR이
  // 열리고, 실제로 2026-09-21에 예약 실행의 재시도가 그 PR을 열었다(#1154). 막은 것은 사람이었다.
  //
  // check_failed도 막는다. 측정하지 못한 것을 통과로 다루지 않는다 — 주간 구조 관측과 같은 방향이다.
  //
  // 이 판정을 reviewPrReady에 곱하지 않는다. 그 값은 PR 생성 말고도 진단 전용 여부(diagnosticsOnly)와
  // 발행 상태 화해(ensure-public-newsletter-artifacts.js)가 함께 읽어서, 곱하면 상태 기록까지 사실과
  // 다르게 바뀐다. 막아야 하는 것은 PR 하나뿐이므로 판정만 내보내고 차단은 워크플로의 PR 생성
  // 조건에서 한다.
  const alreadyPublishedIssue = alreadyPublishedIssueAtHead(root, date);
  const allowRepublish = isTrue(process.env.NEWSLETTER_ALLOW_REPUBLISH);
  const republishBlocked = isRepublishBlocked(alreadyPublishedIssue.status, allowRepublish);
  const reviewPrReady = publicNewsletterReady || (
    hasReviewableArtifacts &&
    changedArtifactCount > 0 &&
    statusReviewable
  );
  const diagnosticsOnly = reviewPrReady && !publicNewsletterReady;
  const reviewOnly = diagnosticsOnly;
  const publishCandidateReady = publicNewsletterReady;
  const hasAiPublishReady = isTrue(status.final_publish_ready);
  const hasPublishCandidate = publicNewsletterReady;
  const reviewPublicationReady =
    publicNewsletterReady &&
    isFalse(status.final_publish_ready) &&
    isTrue(status.review_gate_passed) &&
    isTrue(status.editor_review_required);
  const homepageVisibleAfterMerge =
    publicNewsletterReady &&
    newsletterIndex.hasDate === true &&
    newsletterIndex.pathsMatch === true;
  const fallbackPublicReady = isTrue(status.fallback_public_ready);
  const fallbackOnly = isTrue(status.fallback_only);
  const cameraAnchorCount = numberOrNull(status.camera_anchor_count);
  const publicationMode = status.publication_mode ||
    (diagnosticsOnly
      ? PUBLICATION_MODES.DIAGNOSTICS_ONLY
      : fallbackPublicReady
        ? PUBLICATION_MODES.FALLBACK_PUBLIC
        : hasAiPublishReady
          ? PUBLICATION_MODES.NORMAL_PUBLIC
          : PUBLICATION_MODES.REVIEW_ONLY);
  const homepageVisibility = status.homepage_visibility ||
    (diagnosticsOnly
      ? HOMEPAGE_VISIBILITY.HIDDEN
      : publicationMode === PUBLICATION_MODES.FALLBACK_PUBLIC
        ? HOMEPAGE_VISIBILITY.VISIBLE_WITH_FALLBACK_BADGE
        : homepageVisibleAfterMerge
          ? HOMEPAGE_VISIBILITY.NORMAL
          : HOMEPAGE_VISIBILITY.HIDDEN);
  const normalPublicReady = isTrue(status.normal_public_ready) || (hasAiPublishReady && publicNewsletterReady);
  const automaticPublishReady = isTrue(status.automatic_publish_ready) || normalPublicReady;
  const publicArtifactReady = isTrue(status.public_artifact_ready) || publicNewsletterReady;
  const homepageBadge = status.homepage_badge || (publicationMode === PUBLICATION_MODES.FALLBACK_PUBLIC ? FALLBACK_HOMEPAGE_BADGE : '');
  const publicationContractErrors = [];
  if (publicationMode === PUBLICATION_MODES.FALLBACK_PUBLIC) {
    if (homepageVisibility !== HOMEPAGE_VISIBILITY.VISIBLE_WITH_FALLBACK_BADGE) {
      publicationContractErrors.push('fallback_public requires homepage_visibility=visible_with_fallback_badge');
    }
    if (fallbackOnly !== true) {
      publicationContractErrors.push('fallback_public requires fallback_only=true');
    }
    if (cameraAnchorCount !== null && cameraAnchorCount !== 0) {
      publicationContractErrors.push('fallback_public requires camera_anchor_count=0');
    }
    if (fallbackPublicReady !== true) {
      publicationContractErrors.push('fallback_public requires fallback_public_ready=true');
    }
  }
  if (
    cameraAnchorCount === 0 &&
    homepageVisibility !== HOMEPAGE_VISIBILITY.HIDDEN &&
    publicationMode !== PUBLICATION_MODES.FALLBACK_PUBLIC
  ) {
    publicationContractErrors.push('homepage-visible camera_anchor_count=0 requires publication_mode=fallback_public');
  }
  const reasonParts = [
    `status=${status.status || 'UNKNOWN'}`,
    editorialReviewableRequested ? `failure_kind=${FAILURE_KIND_EDITORIAL_REVIEWABLE}` : '',
    candidateShortageRequested ? `failure_kind=${FAILURE_KIND_CANDIDATE_SHORTAGE_REVIEWABLE}` : '',
    hasCanonicalDiagnostic
      ? `canonical=${canonicalArtifacts.join(',')}`
      : 'canonical=none',
    `changed=${changedArtifacts.length > 0 ? changedArtifacts.join(',') : 'none'}`,
    (failedRepairReviewable || failedRawArtifactValidationReviewable || failedEditorReviewable)
      ? `missing_required=${missingRequired.length > 0 ? missingRequired.join(',') : 'none'}`
      : '',
    failedRawArtifactValidationReviewable
      ? `raw_artifact_validation_error_field=${status.raw_artifact_validation_error?.field || 'unknown'}`
      : '',
    failedRawArtifactValidationReviewable
      ? `raw_artifact_validation_error_value=${status.raw_artifact_validation_error?.value || ''}`
      : '',
    editorialReviewableRequested
      ? `editorial_reject=${editorialRejectReasons.length > 0 ? editorialRejectReasons.join(';') : 'none'}`
      : '',
    candidateShortageRequested
      ? `candidate_shortage_reject=${candidateShortageRejectReasons.length > 0 ? candidateShortageRejectReasons.join(';') : 'none'}`
      : '',
    publicArtifacts.length > 0
      ? `public=${publicArtifacts.join(',')}`
      : 'public=none',
    `required_public=${hasRequiredPublicNewsletterFiles ? 'present' : 'missing_or_invalid'}`,
    `changed_public=${changedRequiredPublicArtifacts.length > 0 ? changedRequiredPublicArtifacts.join(',') : 'none'}`,
    `public_newsletter_ready=${publicNewsletterReady ? 'true' : 'false'}`,
    `already_published_issue=${alreadyPublishedIssue.status}`,
    `already_published_paths=${alreadyPublishedIssue.matched.length > 0 ? alreadyPublishedIssue.matched.join(",") : "none"}`,
    `allow_republish=${allowRepublish ? 'true' : 'false'}`,
    `republish_blocked=${republishBlocked ? 'true' : 'false'}`,
    `review_pr_ready=${reviewPrReady ? 'true' : 'false'}`,
    `review_only=${reviewOnly ? 'true' : 'false'}`,
    `diagnostics_only=${diagnosticsOnly ? 'true' : 'false'}`,
    `review_publication_ready=${reviewPublicationReady ? 'true' : 'false'}`,
    `homepage_visible_after_merge=${homepageVisibleAfterMerge ? 'true' : 'false'}`,
    `publication_mode=${publicationMode}`,
    `homepage_visibility=${homepageVisibility}`,
    `fallback_only=${fallbackOnly ? 'true' : 'false'}`,
    `camera_anchor_count=${cameraAnchorCount ?? 'n/a'}`,
    publicationContractErrors.length > 0 ? `publication_contract_errors=${publicationContractErrors.join('|')}` : '',
    `changed_artifact_count=${changedArtifactCount}`,
    publicNewsletterReasons.length > 0 ? `public_newsletter_reason=${publicNewsletterReasons.join(';')}` : 'public_newsletter_reason=none'
  ].filter(Boolean);

  return {
    date,
    branch,
    status,
    newsroomDir,
    canonicalArtifacts,
    publicArtifacts,
    requiredPublicArtifacts,
    publicStructure,
    weeklyStructure,
    changedArtifacts,
    changedRequiredPublicArtifacts,
    missingRequired,
    editorialRejectReasons,
    hasReviewableArtifacts,
    hasPublicArtifacts,
    hasRequiredPublicNewsletterFiles,
    publicNewsletterReady,
    alreadyPublishedIssue,
    allowRepublish,
    republishBlocked,
    reviewPrReady,
    reviewOnly,
    diagnosticsOnly,
    reviewPublicationReady,
    homepageVisibleAfterMerge,
    publicationMode,
    homepageVisibility,
    normalPublicReady,
    automaticPublishReady,
    publicArtifactReady,
    fallbackPublicReady,
    fallbackOnly,
    cameraAnchorCount,
    homepageBadge,
    publicationContractErrors,
    publishCandidateReady,
    changedArtifactCount,
    publicNewsletterReason: publicNewsletterReasons.length > 0 ? publicNewsletterReasons.join('; ') : 'ready',
    hasAiPublishReady,
    hasPublishCandidate,
    reviewableArtifactReason: reasonParts.join('; ')
  };
}

function buildReviewableArtifactOutputs(resolved) {
  const status = resolved.status || {};
  return {
    date: resolved.date,
    branch: resolved.branch,
    has_reviewable_artifacts: resolved.hasReviewableArtifacts ? 'true' : 'false',
    has_public_artifacts: resolved.hasPublicArtifacts ? 'true' : 'false',
    has_required_public_newsletter_files: resolved.hasRequiredPublicNewsletterFiles ? 'true' : 'false',
    public_newsletter_ready: resolved.publicNewsletterReady ? 'true' : 'false',
    already_published_issue: resolved.alreadyPublishedIssue?.status || 'not_published',
    already_published_paths: resolved.alreadyPublishedIssue?.matched?.length > 0
      ? resolved.alreadyPublishedIssue.matched.join(',')
      : 'none',
    allow_republish: resolved.allowRepublish ? 'true' : 'false',
    republish_blocked: resolved.republishBlocked ? 'true' : 'false',
    review_pr_ready: resolved.reviewPrReady ? 'true' : 'false',
    review_only: resolved.reviewOnly ? 'true' : 'false',
    diagnostics_only: resolved.diagnosticsOnly ? 'true' : 'false',
    review_publication_ready: resolved.reviewPublicationReady ? 'true' : 'false',
    homepage_visible_after_merge: resolved.homepageVisibleAfterMerge ? 'true' : 'false',
    publication_mode: resolved.publicationMode || 'n/a',
    homepage_visibility: resolved.homepageVisibility || 'n/a',
    normal_public_ready: resolved.normalPublicReady ? 'true' : 'false',
    automatic_publish_ready: resolved.automaticPublishReady ? 'true' : 'false',
    public_artifact_ready: resolved.publicArtifactReady ? 'true' : 'false',
    fallback_public_ready: resolved.fallbackPublicReady ? 'true' : 'false',
    fallback_only: resolved.fallbackOnly ? 'true' : 'false',
    camera_anchor_count: resolved.cameraAnchorCount === null || resolved.cameraAnchorCount === undefined ? 'n/a' : String(resolved.cameraAnchorCount),
    homepage_badge: resolved.homepageBadge || 'none',
    publication_contract_error_count: String(resolved.publicationContractErrors?.length ?? 0),
    publication_contract_errors: resolved.publicationContractErrors?.join('\n') || 'none',
    publish_candidate_ready: resolved.publishCandidateReady ? 'true' : 'false',
    changed_artifact_count: String(resolved.changedArtifactCount ?? 0),
    public_newsletter_reason: resolved.publicNewsletterReason,
    has_ai_publish_ready: resolved.hasAiPublishReady ? 'true' : 'false',
    has_publish_candidate: resolved.hasPublishCandidate ? 'true' : 'false',
    reviewable_artifact_reason: resolved.reviewableArtifactReason,
    public_state: status.public_state || status.run_public_state || 'n/a',
    run_mode: status.run_mode || 'n/a',
    effective_homepage_visible: isTrue(status.effective_homepage_visible)
      ? 'true'
      : isFalse(status.effective_homepage_visible)
        ? 'false'
        : (resolved.homepageVisibleAfterMerge ? 'true' : 'false'),
    existing_public_artifact_detected: isTrue(status.existing_public_artifact_detected)
      ? 'true'
      : isFalse(status.existing_public_artifact_detected)
        ? 'false'
        : 'n/a',
    retention_valid: isTrue(status.retention_valid)
      ? 'true'
      : isFalse(status.retention_valid)
        ? 'false'
        : 'n/a',
    retention_error: status.retention_error || 'none',
    public_artifact_policy: status.public_artifact_policy || 'n/a',
    public_artifact_source: status.public_artifact_source || 'n/a',
    reconciliation_required: isTrue(status.reconciliation_required) ? 'true' : 'false',
    reconciliation_action: status.reconciliation_action || 'n/a',
    reconciliation_reason: status.reconciliation_reason || 'none'
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
  REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS,
  REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_EDITOR_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_RAW_ARTIFACT_VALIDATION_REVIEWABLE_ARTIFACTS,
  REQUIRED_PUBLIC_NEWSLETTER_FILES,
  REVIEWABLE_STATUSES,
  alreadyPublishedIssueAtHead,
  buildReviewableArtifactOutputs,
  isRepublishBlocked,
  getChangedRepoVisibleArtifacts,
  parseGitStatusPorcelain,
  publicNewsletterStructureStatus,
  requiredPublicFiles,
  resolveDate,
  resolveReviewableArtifacts
};
