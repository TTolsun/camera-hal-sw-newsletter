const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { tempRoot } = require('../../../shared/test/helpers/fs');

// 추출 전 god-file에 인라인으로 있던 terminal failure 집계기를 입력→산출로 고정한다.
// writeTerminalFailureStatus는 module-level root/runtimeConfig(process.cwd()/env)에 묶이고
// 여러 sibling writer를 통해 cwd 아래에 파일을 쓰므로, cwd를 temp로 둔 child process에서
// 전체 모듈 그래프를 새로 로드해 검증한다(부수효과 격리).

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const MODULE_PATH = path.join('src', 'generator', 'publish', 'orchestrator-terminal-failure.js');

function runInTemp(snippet) {
  const dir = tempRoot('terminal-failure-');
  const script = `
    const { writeTerminalFailureStatus } = require(${JSON.stringify(path.join(REPO_ROOT, MODULE_PATH))});
    const { generationRunState } = require(${JSON.stringify(path.join(REPO_ROOT, 'src', 'generator', 'publish', 'orchestrator-run-state.js'))});
    ${snippet}
    writeTerminalFailureStatus(thrown);
  `;
  execFileSync(process.execPath, ['-e', script], {
    cwd: dir,
    env: { ...process.env, NEWSLETTER_DATE: '2026-05-08' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  const statusPath = path.join(dir, '.tmp', 'newsletter-generation-status.json');
  assert.ok(fs.existsSync(statusPath), 'generation-status.json was written');
  return JSON.parse(fs.readFileSync(statusPath, 'utf8'));
}

test('writeTerminalFailureStatus: 일반 오류는 FAILED 상태로 기록한다', () => {
  const status = runInTemp(`
    generationRunState.date = '2026-05-08';
    generationRunState.retryHistory = [];
    const thrown = new Error('reporter network failure');
  `);
  assert.equal(status.status, 'FAILED');
  assert.equal(status.failure_reason, 'reporter network failure');
  assert.equal(status.date, '2026-05-08');
});

test('writeTerminalFailureStatus: editor semantic 실패 + shortlistReport이면 reviewable로 라우팅한다', () => {
  const status = runInTemp(`
    const { EditorSemanticValidationError } = require(${JSON.stringify(path.join(REPO_ROOT, 'src', 'generator', 'editor', 'editor-output-contract.js'))});
    generationRunState.date = '2026-05-08';
    generationRunState.retryHistory = [];
    generationRunState.shortlistReport = { selected_articles: [], publish_ready: false };
    const thrown = new EditorSemanticValidationError('editor produced invalid sections', {});
  `);
  assert.equal(status.status, 'FAILED_EDITOR_REVIEWABLE');
  assert.equal(status.failure_kind, 'editor_failed_reviewable');
});
