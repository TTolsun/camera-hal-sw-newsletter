const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { changedArtifactDate } = require('../../shared/common/artifact-paths');

const HISTORICAL_POLICY_WARNING_REASON = 'historical artifact outside current/changed/generated validation target, warning only';

function changedEntriesFromGit({ root = process.cwd(), env = process.env } = {}) {
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
  const entries = [];
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
      if (dest) entries.push({ status, path: dest.trim() });
    } else if (status.startsWith('C')) {
      // Copy: 대상 경로만 의미가 있다.
      const dest = parts[2] || parts[1];
      if (dest) entries.push({ status, path: dest.trim() });
    } else if (parts[1]) {
      entries.push({ status, path: parts[1].trim() });
    }
  }
  return entries;
}

// 기존 호출부는 경로 목록만 쓴다. 반환 모양을 바꾸지 않는다.
function changedFilesFromGit(options = {}) {
  return changedEntriesFromGit(options).map(entry => entry.path);
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

// 이미 발행된 공개 페이지 경로.
const PUBLIC_NEWSLETTER_PATH = /^articles\/newsletters\/\d{4}-\d{2}-\d{2}\//;

// strictTargetDates가 "이번 변경이 건드린 호"라면, 이것은 그보다 좁은 "이번 변경이 **만들어 낸**
// 호"다. 둘을 갈라야 하는 이유는 검사에 두 종류가 있기 때문이다.
//
// - 커밋된 파일만 읽는 검사(태그 정합성·가짜 출처 캡션 금지·fact-check must_fix·공개 계약)는
//   과거 호를 고치는 변경도 **사후에 만족시킬 수 있다.** strictTargetDates를 그대로 쓴다.
// - 생성 실행만 만들 수 있는 산출물을 요구하는 검사(image-audit-report 존재, quality 재판정)는
//   과거 호를 고치는 변경이 **사후에 만족시킬 수 없다.** 그 산출물의 정본 editor-draft.json이
//   커밋되지 않기 때문이다. 이쪽만 이 좁은 집합을 쓴다.
//
// 판정 기준: 공개 페이지는 **추가**만 생성 신호로 본다. 수정·삭제는 이미 발행된 호를 고친
// 것이다. 생성 실행은 어차피 같은 날짜의 newsroom 아티팩트를 함께 커밋하므로 그 신호로 잡힌다.
function generatedNewsletterDatesFromEntries(entries = []) {
  const dates = new Set();
  for (const entry of entries) {
    const status = String(entry?.status || '');
    const filePath = String(entry?.path || '');
    const normalized = filePath.replace(/\\/g, '/');
    // 감사 리포트는 과거 날짜에 일괄 backfill될 수 있어(#263) 생성 신호가 아니다.
    if (/^articles\/content\/newsroom\/\d{4}-\d{2}-\d{2}\/image-audit-report\.(?:json|md)$/.test(normalized)) {
      continue;
    }
    if (PUBLIC_NEWSLETTER_PATH.test(normalized) && !status.startsWith('A')) continue;
    const date = changedArtifactDate(filePath);
    if (date) dates.add(date);
  }
  return dates;
}

function generatedTargetDatesFromInputs({ changedEntries = [], newsletterDate = '' } = {}) {
  const dates = generatedNewsletterDatesFromEntries(changedEntries);
  const trimmedDate = String(newsletterDate || '').trim();
  if (trimmedDate) dates.add(trimmedDate);
  return dates;
}

function generatedTargetDates({
  root = process.cwd(),
  env = process.env,
  newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt')
} = {}) {
  return generatedTargetDatesFromInputs({
    changedEntries: changedEntriesFromGit({ root, env }),
    newsletterDate: readNewsletterDate(newsletterDatePath)
  });
}

function historicalPolicyWarningReason() {
  return HISTORICAL_POLICY_WARNING_REASON;
}

module.exports = {
  HISTORICAL_POLICY_WARNING_REASON,
  changedEntriesFromGit,
  changedFilesFromGit,
  changedNewsletterDatesFromFiles,
  generatedNewsletterDatesFromEntries,
  generatedTargetDates,
  generatedTargetDatesFromInputs,
  historicalPolicyWarningReason,
  readNewsletterDate,
  strictTargetDates,
  strictTargetDatesFromInputs
};
