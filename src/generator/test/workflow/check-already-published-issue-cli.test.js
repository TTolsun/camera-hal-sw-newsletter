'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const { checkAlreadyPublishedIssue } = require('../../publish/check-already-published-issue');
const { tempRoot, writeText } = require('../../../shared/test/helpers/fs');

const CLI_PATH = path.join(__dirname, '..', '..', 'publish', 'check-already-published-issue.js');

// #1167: 이미 발행된 호로 예약 실행이 다시 돌면 수집(01)·탐색(02) 단계가 그 호의 입력 산출물을
// main에 직접 덮어썼다. 오케스트레이터 맨 앞의 이 판정이 true면 01부터 실행하지 않는다.

function commitAll(root, message) {
  execFileSync('git', ['add', '--all'], { cwd: root, stdio: 'ignore' });
  execFileSync(
    'git',
    ['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-m', message],
    { cwd: root, stdio: 'ignore' }
  );
}

function repoWithPublishedWeek(prefix, weeklyKey) {
  const root = tempRoot(prefix);
  execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
  writeText(
    path.join(root, 'articles', 'newsletters', weeklyKey, 'index.html'),
    '<!doctype html><html><body>published weekly issue</body></html>'
  );
  commitAll(root, `publish ${weeklyKey}`);
  return root;
}

test('a date whose week is already published blocks the run (#1167)', () => {
  // W39 사고 재현: 2026-09-21호가 발행된 뒤 같은 날짜로 예약 실행이 돌았다.
  const root = repoWithPublishedWeek('published-guard-blocked-', '2026-W39');

  const result = checkAlreadyPublishedIssue({ root, env: { NEWSLETTER_DATE: '2026-09-21' } });

  assert.equal(result.date, '2026-09-21');
  assert.equal(result.status, 'published');
  assert.equal(result.blocked, true);
});

test('a new week stays runnable on a repository with published history (#1167)', () => {
  const root = repoWithPublishedWeek('published-guard-new-', '2026-W39');

  const result = checkAlreadyPublishedIssue({ root, env: { NEWSLETTER_DATE: '2026-09-28' } });

  assert.equal(result.status, 'not_published');
  assert.equal(result.blocked, false);
});

test('the explicit republish switch lets the run through (#1167)', () => {
  const root = repoWithPublishedWeek('published-guard-allowed-', '2026-W39');

  const result = checkAlreadyPublishedIssue({
    root,
    env: { NEWSLETTER_DATE: '2026-09-21', NEWSLETTER_ALLOW_REPUBLISH: 'true' }
  });

  assert.equal(result.status, 'published');
  assert.equal(result.allowRepublish, true);
  assert.equal(result.blocked, false);
});

test('an unusable git checkout blocks the run instead of passing it (#1167)', () => {
  // git init을 하지 않은 루트. 측정 불가를 not_published로 흡수하면 가드가 조용히 열린다.
  const root = tempRoot('published-guard-nogit-');

  const result = checkAlreadyPublishedIssue({ root, env: { NEWSLETTER_DATE: '2026-09-21' } });

  assert.equal(result.status, 'check_failed');
  assert.equal(result.blocked, true);
});

test('the date falls back to today in KST the same way collect does (#1167)', () => {
  const root = repoWithPublishedWeek('published-guard-today-', '2026-W39');

  const result = checkAlreadyPublishedIssue({
    root,
    env: { NEWSLETTER_DATE: '  ' },
    today: () => '2026-09-28'
  });

  assert.equal(result.date, '2026-09-28');
  assert.equal(result.blocked, false);
});

// 워크플로는 이 CLI의 종료 코드로 collect를 막는다. 막히면 1, 통과면 0이다.
test('the CLI exits 1 when blocked and 0 when the run may continue (#1167)', () => {
  const root = repoWithPublishedWeek('published-guard-cli-', '2026-W39');
  const run = env => spawnSync(process.execPath, [CLI_PATH], {
    cwd: root,
    env: { ...process.env, NEWSLETTER_ALLOW_REPUBLISH: '', ...env },
    encoding: 'utf8'
  });

  const blocked = run({ NEWSLETTER_DATE: '2026-09-21' });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stdout, /Blocked as a republish \(#1167\): 2026-09-21 is already published/);

  const fresh = run({ NEWSLETTER_DATE: '2026-09-28' });
  assert.equal(fresh.status, 0);
  assert.match(fresh.stdout, /Not published yet: 2026-09-28/);

  const allowed = run({ NEWSLETTER_DATE: '2026-09-21', NEWSLETTER_ALLOW_REPUBLISH: 'true' });
  assert.equal(allowed.status, 0);
  assert.match(allowed.stdout, /Republish allowed/);
});
