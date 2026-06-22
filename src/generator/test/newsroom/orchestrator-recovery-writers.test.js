const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const {
  writeRecoveryPrompt,
  writeSelectionDiagnosticsArtifact
} = require('../../publish/orchestrator-recovery-writers');
const {
  writeDateReviewPackage
} = require('../../publish/orchestrator-review-package-writer');
const { generationRunState } = require('../../publish/orchestrator-run-state');
const { tempRoot } = require('../../../shared/test/helpers/fs');

// 추출 전 god-file에 인라인으로 있던 recovery/selection-diagnostics/review-package writer를
// 입력→파일 산출로 고정한다. 이 writer들은 selectionStatusExtra + buildSelectionReport로
// selection 진단 markdown을 그려 정해진 파일명을 쓰는 게 책임이며, selection 점수 계산 자체는
// status-builders/selection-diagnostics 테스트가 따로 검증한다.

function shortlistReportFixture(date) {
  return {
    date,
    selected_articles: [],
    selection_errors: ['no eligible primary camera stack candidate'],
    selection_warnings: ['underfilled main slot'],
    selection_shortage_hints: ['SOURCE_PARSER_EMPTY: feed returned no items']
  };
}

test('writeRecoveryPrompt: recovery-prompt.md에 단계/사유와 selection 진단 마커를 쓴다', () => {
  const newsroomDir = tempRoot('recovery-writer-');
  const date = '2026-05-08';
  const shortlistReport = shortlistReportFixture(date);

  const filePath = writeRecoveryPrompt(newsroomDir, {
    date,
    stage: 'deterministic selection',
    reason: 'selection errors present',
    shortlistReport,
    selectedInputs: shortlistReport.selected_articles
  });

  assert.equal(filePath, path.join(newsroomDir, 'recovery-prompt.md'));
  assert.ok(fs.existsSync(filePath));
  const text = fs.readFileSync(filePath, 'utf8');
  assert.match(text, new RegExp(`# 복구 프롬프트 - ${date}`));
  assert.match(text, /## 실패/);
  assert.match(text, /- 단계: deterministic selection/);
  assert.match(text, /- 사유: selection errors present/);
  assert.match(text, /## Deterministic Final Selection 상태/);
  assert.match(text, /## 다시 실행/);
  assert.match(text, /## Artifact 체크리스트/);
  // trailing newline 보존
  assert.ok(text.endsWith('\n'));
});

test('writeSelectionDiagnosticsArtifact: diagnostics/report 마크다운+JSON 세 파일을 쓴다', () => {
  const newsroomDir = tempRoot('recovery-writer-');
  const date = '2026-05-08';
  const shortlistReport = shortlistReportFixture(date);

  const filePath = writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);

  assert.equal(filePath, path.join(newsroomDir, 'selection-diagnostics.md'));
  assert.ok(fs.existsSync(path.join(newsroomDir, 'selection-diagnostics.md')));
  assert.ok(fs.existsSync(path.join(newsroomDir, 'selection-report.json')));
  assert.ok(fs.existsSync(path.join(newsroomDir, 'selection-report.md')));

  const diagnostics = fs.readFileSync(filePath, 'utf8');
  assert.match(diagnostics, new RegExp(`# Candidate Selection Diagnostics - ${date}`));
  assert.match(diagnostics, /## Gate Summary/);
  assert.match(diagnostics, /- Review Gate: (PASS|FAIL)/);
  assert.match(diagnostics, /- Publish Gate: (PASS|FAIL)/);

  const reportMd = fs.readFileSync(path.join(newsroomDir, 'selection-report.md'), 'utf8');
  assert.match(reportMd, new RegExp(`# Selection Report - ${date}`));
  assert.match(reportMd, /## Selection Errors/);
  assert.match(reportMd, /- no eligible primary camera stack candidate/);
  assert.match(reportMd, /## Shortage Hints/);

  const reportJson = JSON.parse(fs.readFileSync(path.join(newsroomDir, 'selection-report.json'), 'utf8'));
  assert.equal(reportJson.date, date);
  assert.equal(reportJson.status, 'FAILED'); // selection_errors present
  assert.deepEqual(reportJson.selection_errors, shortlistReport.selection_errors);
});

test('writeSelectionDiagnosticsArtifact: shortlistReport 미지정 시 generationRunState로 기본값을 채운다', () => {
  const newsroomDir = tempRoot('recovery-writer-');
  const date = '2026-05-09';
  const prevShortlist = generationRunState.shortlistReport;
  const prevDate = generationRunState.date;
  try {
    generationRunState.date = date;
    generationRunState.shortlistReport = shortlistReportFixture(date);
    const filePath = writeSelectionDiagnosticsArtifact(newsroomDir);
    const diagnostics = fs.readFileSync(filePath, 'utf8');
    assert.match(diagnostics, new RegExp(`# Candidate Selection Diagnostics - ${date}`));
  } finally {
    generationRunState.shortlistReport = prevShortlist;
    generationRunState.date = prevDate;
  }
});

test('writeDateReviewPackage: review-guide/release-qa/manifest 세 파일을 한 묶음으로 쓴다', () => {
  const rootDir = tempRoot('review-package-');
  const date = '2026-05-08';

  writeDateReviewPackage({
    rootDir,
    date,
    files: [],
    validateText: 'characterization run',
    runContext: { status: 'OK', publicOutputExpected: false }
  });

  const newsroomDir = path.join(rootDir, 'articles', 'content', 'newsroom', date);
  assert.ok(fs.existsSync(path.join(newsroomDir, '00-review-guide.md')));
  assert.ok(fs.existsSync(path.join(newsroomDir, 'release-qa-report.md')));
  assert.ok(fs.existsSync(path.join(newsroomDir, 'artifact-manifest.json')));

  const manifest = JSON.parse(fs.readFileSync(path.join(newsroomDir, 'artifact-manifest.json'), 'utf8'));
  assert.ok(manifest);
});
