// 기기 우회 장부(quirk ledger): 상위 계층(AndroidX)이 어떤 기기의 HAL 동작을 우회하고 있는지 모은 목록이다.
// 개별 패치 기사는 "무엇이 머지되었다"만 전하지만, 같은 패치를 모으면 "어떤 기기의 HAL 결함을 덮고 있는가"가
// 보인다. 이 모듈은 그 목록을 Gerrit 응답에서 결정론적으로 만든다. LLM도, 외부 기기 DB도 쓰지 않는다.
//
// 지키는 계약.
// 1. 표의 모든 칸은 Gerrit 응답(커밋 메시지, 쿼크 파일 diff의 추가 줄)에 적힌 문자열에서만 나온다.
//    기기를 못 뽑으면 빈 값으로 둔다. 제조사·SoC를 추측하거나 지어내지 않는다.
// 2. Exynos 표시는 근거 텍스트에 `exynos` 또는 `s5e\d+`가 있을 때만 붙이고, 걸린 문자열을 함께 남긴다.
//    커밋 메시지가 "영향 없는 기기"로 Exynos를 언급해도 이 규칙은 걸린다 - 문장의 뜻은 판정하지 않으므로
//    근거 문자열을 보고 사람이 가려낼 수 있게 남긴다.
// 3. 이 모듈의 어떤 실패도 발행을 막지 않는다. 호출부(CLI)가 실패를 진단으로 남기고 끝낸다.

const path = require('path');

const {
  changeUrl,
  commitMessageOf,
  fetchMergedCameraChanges,
  fetchQuirkAddedLines,
  quirkFilesOf
} = require('../../shared/collect/androidx-quirk-gerrit-changes');
const { gerritTimeMs } = require('../../shared/collect/gerrit-camera-changes');

const LEDGER_REPORT_SCHEMA_VERSION = 1;

// 제목에 이 문자열이 있으면 기기 우회가 아니라 저장소 전체 잡음이다(2026-11-20 실측).
const NOISE_SUBJECT_PATTERNS = Object.freeze([
  /Merge empty history/i,
  /Snap for/i,
  /ktfmt/i,
  /Format all code/i,
  /JSpecify/i
]);

// 쿼크 파일을 이만큼 한꺼번에 바꾼 변경은 특정 기기의 우회가 아니라 기계적 리팩터링으로 본다.
const MASS_REFACTOR_QUIRK_FILE_COUNT = 12;

const EXCLUSION_REASONS = Object.freeze({
  outsideWindow: 'outside_window',
  noiseSubject: 'noise_subject',
  massRefactor: 'mass_refactor'
});

// Samsung 모델 번호(SM-F971, SM-S942U1 ...). 커밋 메시지와 diff 어디서든 같은 모양이다.
const SAMSUNG_MODEL_PATTERN = /\bSM-[A-Z]\d{3,4}[A-Z0-9]*/gi;
// 커밋 메시지가 `Build.MODEL "SM-A546*"`처럼 필드와 값을 함께 적은 경우.
const BUILD_FIELD_VALUE_PATTERN = /Build\.(?:MODEL|DEVICE)\s+"([^"]+)"/g;
// 쿼크 코드의 문자열 리터럴. 기기 값은 모델 번호("PHT110")나 코드명("a54x")이라 공백이 없다.
const QUOTED_TOKEN_PATTERN = /"([A-Za-z0-9_-]{3,})"/g;
// 카메라 ID("0", "2")와 구별하려고 글자와 숫자가 모두 있어야 기기 값으로 본다.
// SM8550 같은 Qualcomm SoC 이름은 기기가 아니라서 뺀다.
const QUALCOMM_SOC_PATTERN = /^SM\d{4}$/i;
const EXYNOS_PATTERN = /exynos|s5e\d+/gi;
const SOURCE_STRENGTH = Object.freeze(['diff_code', 'diff_comment', 'commit_message']);

function dateOnly(timeMs) {
  return new Date(timeMs).toISOString().slice(0, 10);
}

function quirkClassName(filePath) {
  return path.posix.basename(filePath).replace(/\.(kt|java)$/, '');
}

function quirkFileChange(status) {
  if (status === 'A') return 'added';
  if (status === 'D') return 'deleted';
  return 'modified';
}

function normalizeIdentifier(value) {
  const trimmed = String(value).replace(/\*+$/, '').trim();
  return /^sm-/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

function isCommentLine(line) {
  return /^\s*(\*|\/\*|\/\/)/.test(line);
}

function isDeviceToken(token) {
  return /[A-Za-z]/.test(token) && /\d/.test(token) && !QUALCOMM_SOC_PATTERN.test(token);
}

/**
 * 커밋 메시지와 쿼크 파일 추가 줄에서 기기 식별자를 뽑는다. 같은 문자열은 가장 강한 근거 하나만 남긴다.
 * source(강한 순): diff_code(쿼크 코드의 조건), diff_comment(쿼크 파일 주석), commit_message.
 * 추가 줄은 줄 단위라서, 기존 기기 줄을 다시 쓴 변경이면 새로 추가된 기기가 아닌 식별자도 섞인다.
 * 식별자는 "언급된 문자열"이지 "영향받는다는 판정"이 아니다(영향 없는 기기도 적힐 수 있다).
 */
function extractDeviceIdentifiers({ commitMessage = '', addedLines = [] } = {}) {
  const found = new Map();
  const add = (value, source) => {
    const identifier = normalizeIdentifier(value);
    if (!identifier) return;
    const known = found.get(identifier);
    if (!known || SOURCE_STRENGTH.indexOf(source) < SOURCE_STRENGTH.indexOf(known)) found.set(identifier, source);
  };

  for (const line of addedLines) {
    const comment = isCommentLine(line);
    const source = comment ? 'diff_comment' : 'diff_code';
    for (const match of line.matchAll(SAMSUNG_MODEL_PATTERN)) add(match[0], source);
    if (comment || /^\s*@/.test(line)) continue;
    for (const match of line.matchAll(QUOTED_TOKEN_PATTERN)) {
      if (isDeviceToken(match[1])) add(match[1], source);
    }
  }
  for (const match of String(commitMessage).matchAll(BUILD_FIELD_VALUE_PATTERN)) add(match[1], 'commit_message');
  for (const match of String(commitMessage).matchAll(SAMSUNG_MODEL_PATTERN)) add(match[0], 'commit_message');

  return [...found].map(([identifier, source]) => ({ identifier, source }));
}

/** Exynos 표시와 그 근거 문자열. 근거가 없으면 { exynos: false }. */
function detectExynos({ commitMessage = '', addedLines = [] } = {}) {
  const text = [commitMessage, ...addedLines].join('\n');
  const evidence = [...new Set([...text.matchAll(EXYNOS_PATTERN)].map(match => match[0].toLowerCase()))];
  return { exynos: evidence.length > 0, exynos_evidence: evidence };
}

/**
 * 쿼크 파일을 건드린 변경 하나를 장부 후보로 분류한다. 제외 사유는 하나만 돌려준다(우선순위: 제출일 창 밖,
 * 잡음 제목, 기계적 리팩터링). 쿼크 파일이 없으면 null이다 - 장부와 상관없는 변경이라 세지 않는다.
 */
function classifyChange(change, window) {
  const quirkFiles = quirkFilesOf(change);
  if (quirkFiles.length === 0) return null;
  const submittedMs = gerritTimeMs(change.submitted);
  const submittedDate = Number.isFinite(submittedMs) ? dateOnly(submittedMs) : '';
  let reason = '';
  if (!submittedDate || submittedDate < window.start_date || submittedDate > window.end_date) {
    reason = EXCLUSION_REASONS.outsideWindow;
  } else if (NOISE_SUBJECT_PATTERNS.some(pattern => pattern.test(change.subject || ''))) {
    reason = EXCLUSION_REASONS.noiseSubject;
  } else if (quirkFiles.length >= MASS_REFACTOR_QUIRK_FILE_COUNT) {
    reason = EXCLUSION_REASONS.massRefactor;
  }
  return { change, quirkFiles, submittedDate, reason };
}

function buildEntry({ change, quirkFiles, submittedDate }, addedLines) {
  const commitMessage = commitMessageOf(change);
  return {
    change_number: change._number,
    url: changeUrl(change._number),
    submitted_date: submittedDate,
    subject: String(change.subject || ''),
    quirk_classes: quirkFiles.map(file => ({ name: quirkClassName(file.path), change: quirkFileChange(file.status) })),
    devices: extractDeviceIdentifiers({ commitMessage, addedLines }),
    ...detectExynos({ commitMessage, addedLines })
  };
}

/**
 * 주간 창(UTC 날짜, 양끝 포함) 하나의 장부 보고서를 만든다. 목록을 못 읽거나 응답을 해석하지 못하면 던지지
 * 않고 status를 failed로 돌려준다. 쿼크 파일 diff 하나를 못 읽은 변경은 커밋 메시지 근거만으로 항목을 만들고
 * 진단을 남긴다.
 */
async function buildQuirkLedgerReport({ date, window, fetchTextImpl, now = new Date() }) {
  const report = {
    schemaVersion: LEDGER_REPORT_SCHEMA_VERSION,
    generated_at: now.toISOString(),
    date,
    window,
    status: 'ok',
    query_url: '',
    list_truncated: false,
    counts: { listed_changes: 0, quirk_file_changes: 0, entries: 0, excluded: 0 },
    entries: [],
    excluded: [],
    diagnostics: []
  };

  let listing;
  try {
    listing = await fetchMergedCameraChanges(window.start_date, fetchTextImpl);
  } catch (error) {
    report.status = 'failed';
    report.diagnostics.push({ kind: 'list_fetch_failed', message: error.message });
    return report;
  }
  report.query_url = listing.url;
  report.list_truncated = listing.truncated;
  if (listing.truncated) {
    report.diagnostics.push({ kind: 'list_truncated', message: 'Gerrit change list hit the page size; older changes in the window may be missing.' });
  }
  report.counts.listed_changes = listing.changes.length;

  try {
    const classified = listing.changes.map(change => classifyChange(change, window)).filter(Boolean);
    report.counts.quirk_file_changes = classified.length;

    for (const item of classified) {
      if (item.reason) {
        report.excluded.push({ change_number: item.change._number, subject: String(item.change.subject || ''), reason: item.reason });
        continue;
      }
      const addedLines = [];
      for (const file of item.quirkFiles) {
        try {
          addedLines.push(...await fetchQuirkAddedLines(item.change._number, file.path, fetchTextImpl));
        } catch (error) {
          report.diagnostics.push({ kind: 'diff_fetch_failed', change_number: item.change._number, message: error.message });
        }
      }
      report.entries.push(buildEntry(item, addedLines));
    }
    report.entries.sort((left, right) =>
      left.submitted_date.localeCompare(right.submitted_date) || left.change_number - right.change_number);
    report.counts.entries = report.entries.length;
    report.counts.excluded = report.excluded.length;
  } catch (error) {
    // 응답 모양이 예상과 다른 경우 등. 일부만 채운 항목이 정상 결과처럼 남지 않게 비운다.
    report.status = 'failed';
    report.entries = [];
    report.excluded = [];
    report.counts.entries = 0;
    report.counts.excluded = 0;
    report.diagnostics.push({ kind: 'build_failed', message: error.message });
  }
  return report;
}

const DEVICE_SOURCE_LABELS = Object.freeze([
  ['diff_code', '코드'],
  ['diff_comment', '주석'],
  ['commit_message', '커밋 메시지']
]);

function renderDevices(devices) {
  if (devices.length === 0) return '(식별자 없음)';
  return DEVICE_SOURCE_LABELS
    .map(([source, label]) => {
      const identifiers = devices.filter(device => device.source === source).map(device => device.identifier);
      return identifiers.length > 0 ? `${label}: ${identifiers.join(', ')}` : '';
    })
    .filter(Boolean)
    .join(' / ');
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderQuirkLedgerMarkdown(report) {
  const lines = [
    '# 기기 우회 장부 (quirk ledger)',
    '',
    `- 실행 날짜: ${report.date}`,
    `- 조회 창: ${report.window.start_date} ~ ${report.window.end_date} (UTC, 제출일 기준)`,
    `- 상태: ${report.status}`,
    `- 항목 ${report.counts.entries}건, 제외 ${report.counts.excluded}건 (쿼크 파일 변경 ${report.counts.quirk_file_changes}건 중)`,
    '- 이 보고서는 shadow 산출물이며 공개 뉴스레터에 쓰이지 않는다. 기기 식별자는 커밋 메시지와 diff에 적힌 문자열이고, 영향 여부의 판정이 아니다.',
    ''
  ];
  if (report.entries.length > 0) {
    lines.push('| 제출일 | change | 제목 | 기기 식별자 | 우회 클래스 | Exynos |', '| --- | --- | --- | --- | --- | --- |');
    for (const entry of report.entries) {
      const classes = entry.quirk_classes.map(item => `${item.name}(${item.change})`).join(', ');
      const exynos = entry.exynos ? `표시 (${entry.exynos_evidence.join(', ')})` : '-';
      lines.push(`| ${entry.submitted_date} | [${entry.change_number}](${entry.url}) | ${escapeTableCell(entry.subject)} | ${escapeTableCell(renderDevices(entry.devices))} | ${escapeTableCell(classes)} | ${exynos} |`);
    }
    lines.push('');
  }
  if (report.excluded.length > 0) {
    lines.push('## 제외된 변경', '');
    for (const item of report.excluded) {
      lines.push(`- ${item.change_number} (${item.reason}): ${item.subject}`);
    }
    lines.push('');
  }
  if (report.diagnostics.length > 0) {
    lines.push('## 진단', '');
    for (const item of report.diagnostics) {
      lines.push(`- ${item.kind}${item.change_number ? ` (change ${item.change_number})` : ''}: ${item.message}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

module.exports = {
  EXCLUSION_REASONS,
  LEDGER_REPORT_SCHEMA_VERSION,
  MASS_REFACTOR_QUIRK_FILE_COUNT,
  NOISE_SUBJECT_PATTERNS,
  buildQuirkLedgerReport,
  classifyChange,
  detectExynos,
  extractDeviceIdentifiers,
  renderQuirkLedgerMarkdown
};
