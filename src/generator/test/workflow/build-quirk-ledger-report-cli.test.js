'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { main, resolveWindow, splitWindowFlags } = require('../../publish/build-quirk-ledger-report');
const { tempRoot, readJson } = require('../../../shared/test/helpers/fs');
const {
  fakeGerritFetch,
  gerritChange,
  quirkPath
} = require('../../../shared/test/helpers/androidx-gerrit-builders');

// 이 CLI는 발행을 막지 않는 shadow 단계다. 실제 네트워크는 부르지 않고(fetchTextImpl 주입, 전역 fetch는
// 아래에서 막는다) 산출물 경로, 상태 갱신, 실패 시 비차단 계약만 확인한다.

const NOW = new Date('2026-11-20T00:00:00Z');
const ARGV = ['--date', '2026-11-16', '--since', '2026-11-10', '--until', '2026-11-16'];

function zslChange(number, submitted) {
  return gerritChange({
    number,
    subject: 'Disable ZSL on Samsung SM-F971',
    submitted,
    files: { [quirkPath('ZslDisablerQuirk')]: {} }
  });
}

async function run(argv, root, fetchTextImpl, env = {}) {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalWarn = console.warn;
  globalThis.fetch = () => { throw new Error('테스트에서 실제 네트워크를 부르면 안 된다'); };
  console.log = () => {};
  console.warn = () => {};
  try {
    return await main(argv, env, root, { fetchTextImpl, now: NOW });
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

const reportDir = root => path.join(root, 'articles', 'content', 'newsroom', '2026-11-16');
const statePath = root => path.join(root, 'state', 'quirk-ledger.json');

test('정상 실행은 보고서 JSON·MD와 누적 상태를 쓰고 종료 코드 0을 돌려준다', async () => {
  const root = tempRoot('quirk-ledger-');
  const fetchTextImpl = fakeGerritFetch({ changes: [zslChange(1, '2026-11-12 04:00:00.000000000')], diffs: { 1: ['                "SM-F971",'] } });
  assert.equal(await run(ARGV, root, fetchTextImpl), 0);

  const report = readJson(path.join(reportDir(root), 'quirk-ledger-report.json'));
  assert.equal(report.status, 'ok');
  assert.equal(report.entries.length, 1);
  assert.deepEqual(report.window, { start_date: '2026-11-10', end_date: '2026-11-16', source: 'explicit' });
  assert.match(fs.readFileSync(path.join(reportDir(root), 'quirk-ledger-report.md'), 'utf8'), /^# 기기 우회 장부/);
  assert.deepEqual(readJson(statePath(root)).entries.map(entry => entry.change_number), [1]);
});

test('Gerrit 조회가 실패해도 종료 코드 0이고 failed 보고서만 남으며 기존 상태는 그대로다', async () => {
  const root = tempRoot('quirk-ledger-');
  await run(ARGV, root, fakeGerritFetch({ changes: [zslChange(1, '2026-11-12 04:00:00.000000000')], diffs: { 1: [] } }));
  const before = fs.readFileSync(statePath(root), 'utf8');

  const exitCode = await run(ARGV, root, fakeGerritFetch({ listError: new Error('ECONNRESET') }));
  assert.equal(exitCode, 0);
  const report = readJson(path.join(reportDir(root), 'quirk-ledger-report.json'));
  assert.equal(report.status, 'failed');
  assert.equal(report.diagnostics[0].kind, 'list_fetch_failed');
  assert.equal(fs.readFileSync(statePath(root), 'utf8'), before, '읽기 실패가 누적 상태를 지우면 안 된다');
});

test('조회가 처음부터 실패하면 상태 파일을 만들지 않는다', async () => {
  const root = tempRoot('quirk-ledger-');
  assert.equal(await run(ARGV, root, fakeGerritFetch({ listError: new Error('503') })), 0);
  assert.equal(fs.existsSync(statePath(root)), false);
});

test('공개 산출물(articles/newsletters, articles/data)에는 아무것도 쓰지 않는다', async () => {
  const root = tempRoot('quirk-ledger-');
  await run(ARGV, root, fakeGerritFetch({ changes: [zslChange(1, '2026-11-12 04:00:00.000000000')], diffs: { 1: [] } }));
  const written = [];
  (function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full); else written.push(path.relative(root, full).split(path.sep).join('/'));
    }
  })(root);
  assert.deepEqual(written.sort(), [
    'articles/content/newsroom/2026-11-16/quirk-ledger-report.json',
    'articles/content/newsroom/2026-11-16/quirk-ledger-report.md',
    'state/quirk-ledger.json'
  ]);
});

test('창을 주지 않으면 실행일 기준 직전 완결 ISO 주를 쓰고 COVERAGE_WEEK_KEY가 이를 바꾼다', () => {
  assert.deepEqual(resolveWindow('2026-11-16', {}, {}), { start_date: '2026-11-09', end_date: '2026-11-15', source: 'coverage_week' });
  assert.deepEqual(resolveWindow('2026-11-16', {}, { COVERAGE_WEEK_KEY: '2026-W45' }), { start_date: '2026-11-02', end_date: '2026-11-08', source: 'coverage_week' });
});

test('--since와 --until은 함께 줘야 하고 순서가 맞아야 한다', () => {
  assert.throws(() => splitWindowFlags(['--since', '2026-11-10']), /together/);
  assert.throws(() => splitWindowFlags(['--until', '2026-11-16']), /together/);
  assert.throws(() => resolveWindow('2026-11-16', { since: '2026-11-16', until: '2026-11-10' }, {}), /after/);
  assert.throws(() => splitWindowFlags(['--since', '11-10', '--until', '2026-11-16']), /YYYY-MM-DD/);
});
