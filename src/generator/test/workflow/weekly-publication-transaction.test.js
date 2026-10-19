const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const transaction = require('../../publish/weekly-publication-transaction');
const { completeWeeklyPublication, initializePublicationRun } = transaction;
const OWNER = 'synthetic-run:1';
const captureWeeklyPublication = options => transaction.captureWeeklyPublication({ env: {}, runKey: OWNER, ...options });
const rollbackWeeklyPublication = options => transaction.rollbackWeeklyPublication({ env: {}, runKey: OWNER, ...options });
const { reconcilePublicState, unexposeFailedPublication } = require('../../publish/public-state-reconciliation');
const { writeJson, writeText } = require('../../../shared/test/helpers/fs');

const DATE = '2026-10-22';
const KEY = '2026-W43';
const WEEKLY = 'articles/data/newsletters-weekly.json';
const DATED = 'articles/data/newsletters.json';
const SNAPSHOT = '.tmp/weekly-publication/' + DATE + '.json';
function read(root, name) { return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')); }
function stage(t, existing = true) {
  const prefix = path.join(os.tmpdir(), 'weekly-transaction-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => { assert.ok(path.resolve(root).startsWith(prefix)); fs.rmSync(root, { recursive: true, force: true }); });
  const entry = { weeklyKey: KEY, date: '2026-10-19', html: 'newsletters/' + KEY + '/index.html', md: 'newsletters/' + KEY + '/newsletter.md', title: 'Earlier publication' };
  writeJson(path.join(root, WEEKLY), existing ? [entry] : []);
  writeJson(path.join(root, DATED), []);
  if (existing) {
    for (const file of ['index.html', 'newsletter.md', 'issue.json']) writeText(path.join(root, 'articles/newsletters', KEY, file), 'Earlier public bytes: ' + file);
  }
  writeText(path.join(root, 'articles/data/homepage-headline.json'), 'Earlier headline bytes');
  writeText(path.join(root, 'state/article-exposure-history.json'), 'Earlier exposure bytes');
  return { root, entry };
}
function overwriteRun(root, entry) {
  for (const file of ['index.html', 'newsletter.md', 'issue.json']) writeText(path.join(root, 'articles/newsletters', KEY, file), 'Failed run bytes: ' + file);
  writeJson(path.join(root, WEEKLY), [{ ...entry, title: 'Failed append' }]);
  writeText(path.join(root, 'articles/data/homepage-headline.json'), 'Failed headline bytes');
  writeText(path.join(root, 'state/article-exposure-history.json'), 'Failed exposure bytes');
}

test('failed same-week append restores prior public bytes, entry, headline and exposure state', t => {
  const { root, entry } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  overwriteRun(root, entry);
  const result = rollbackWeeklyPublication({ root, date: DATE });
  assert.equal(result.restoredPreviousWeek, true);
  assert.deepEqual(read(root, WEEKLY), [entry]);
  for (const file of ['index.html', 'newsletter.md', 'issue.json']) assert.equal(fs.readFileSync(path.join(root, 'articles/newsletters', KEY, file), 'utf8'), 'Earlier public bytes: ' + file);
  assert.equal(fs.readFileSync(path.join(root, 'articles/data/homepage-headline.json'), 'utf8'), 'Earlier headline bytes');
  assert.equal(fs.readFileSync(path.join(root, 'state/article-exposure-history.json'), 'utf8'), 'Earlier exposure bytes');
  assert.equal(read(root, SNAPSHOT).state, 'rolled_back');
});

test('failed first publication removes its new weekly exposure and public files', t => {
  const { root, entry } = stage(t, false);
  captureWeeklyPublication({ root, date: DATE });
  overwriteRun(root, entry);
  const result = rollbackWeeklyPublication({ root, date: DATE });
  assert.equal(result.restoredPreviousWeek, false);
  assert.deepEqual(read(root, WEEKLY), []);
  for (const file of ['index.html', 'newsletter.md', 'issue.json']) assert.equal(fs.existsSync(path.join(root, 'articles/newsletters', KEY, file)), false);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'articles/sitemap.xml'), 'utf8'), /2026-W43/);
});

test('rollback restores invalidated English bytes and dated translation metadata without rewriting dated content', t => {
  const { root, entry } = stage(t);
  const en = { html: 'en/newsletters/' + KEY + '/index.html', md: 'en/newsletters/' + KEY + '/newsletter.md' };
  entry.en = en;
  writeJson(path.join(root, WEEKLY), [entry]);
  const dated = { date: '2026-10-19', en, title: 'Preserved dated entry' };
  writeJson(path.join(root, DATED), [dated]);
  const files = ['articles/en/newsletters/' + KEY + '/index.html', 'articles/en/newsletters/' + KEY + '/newsletter.md', 'articles/newsletters/' + KEY + '/translation.en.json', 'articles/newsletters/' + KEY + '/translation-cost-report.md'];
  for (const file of files) writeText(path.join(root, file), 'Existing translation: ' + file);
  writeText(path.join(root, 'articles/newsletters/2026-10-19/index.html'), 'Existing dated HTML');
  captureWeeklyPublication({ root, date: DATE });
  for (const file of files) fs.unlinkSync(path.join(root, file));
  writeJson(path.join(root, WEEKLY), [{ ...entry, en: undefined }]);
  writeJson(path.join(root, DATED), [{ ...dated, en: undefined }]);
  rollbackWeeklyPublication({ root, date: DATE });
  for (const file of files) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), 'Existing translation: ' + file);
  assert.deepEqual(read(root, WEEKLY), [entry]);
  assert.deepEqual(read(root, DATED), [dated]);
  assert.equal(fs.readFileSync(path.join(root, 'articles/newsletters/2026-10-19/index.html'), 'utf8'), 'Existing dated HTML');
});

test('rolling back one week preserves another week added after capture', t => {
  const { root, entry } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  const other = { weeklyKey: '2026-W44', html: 'newsletters/2026-W44/index.html', date: '2026-10-26' };
  writeJson(path.join(root, WEEKLY), [{ ...entry, title: 'Failed append' }, other]);
  rollbackWeeklyPublication({ root, date: DATE });
  assert.deepEqual(read(root, WEEKLY), [other, entry]);
  assert.match(fs.readFileSync(path.join(root, 'articles/sitemap.xml'), 'utf8'), /2026-W44/);
});

test('snapshot capture and rollback are idempotent within a run and a new run gets a fresh baseline', t => {
  const { root, entry } = stage(t);
  captureWeeklyPublication({ root, date: DATE, runKey: 'first' });
  overwriteRun(root, entry);
  captureWeeklyPublication({ root, date: DATE, runKey: 'first' });
  rollbackWeeklyPublication({ root, date: DATE, runKey: 'first' });
  assert.deepEqual(read(root, WEEKLY), [entry]);
  assert.equal(rollbackWeeklyPublication({ root, date: DATE, runKey: 'first' }).reason, 'already_rolled_back');
  writeText(path.join(root, 'articles/newsletters', KEY, 'index.html'), 'New approved baseline');
  captureWeeklyPublication({ root, date: DATE, runKey: 'second' });
  overwriteRun(root, entry);
  rollbackWeeklyPublication({ root, date: DATE, runKey: 'second' });
  assert.equal(fs.readFileSync(path.join(root, 'articles/newsletters', KEY, 'index.html'), 'utf8'), 'New approved baseline');
});

test('malformed shared index prevents a partial rollback and remains an explicit failure', t => {
  const { root, entry } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  overwriteRun(root, entry);
  writeText(path.join(root, WEEKLY), '{bad');
  assert.throws(() => rollbackWeeklyPublication({ root, date: DATE }));
  assert.equal(fs.readFileSync(path.join(root, 'articles/newsletters', KEY, 'index.html'), 'utf8'), 'Failed run bytes: index.html');
  assert.equal(read(root, SNAPSHOT).state, 'pending');
});

test('a snapshot with an unexpected path is rejected before any writes', t => {
  const { root } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  const snapshot = read(root, SNAPSHOT);
  snapshot.files['../outside.txt'] = Buffer.from('unsafe').toString('base64');
  writeJson(path.join(root, SNAPSHOT), snapshot);
  assert.throws(() => rollbackWeeklyPublication({ root, date: DATE }), /Invalid weekly publication snapshot/);
});

test('failure unexpose rolls back weekly output and removes only the failed dated entry', t => {
  const { root, entry } = stage(t);
  writeJson(path.join(root, DATED), [{ date: '2026-10-19' }]);
  captureWeeklyPublication({ root, date: DATE });
  overwriteRun(root, entry);
  writeJson(path.join(root, DATED), [{ date: '2026-10-19' }, { date: DATE }]);
  const result = unexposeFailedPublication(root, DATE, { runKey: OWNER });
  assert.equal(result.error, '');
  assert.deepEqual(read(root, WEEKLY), [entry]);
  assert.deepEqual(read(root, DATED), [{ date: '2026-10-19' }]);
});

test('reconciliation rolls back a failed weekly-only output even when dated files were never written', t => {
  const { root, entry } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  overwriteRun(root, entry);
  const result = reconcilePublicState({ root, date: DATE, runKey: OWNER, status: { date: DATE, diagnostics_only: true, public_newsletter_ready: false } });
  assert.equal(result.effectiveHomepageVisible, false);
  assert.deepEqual(read(root, WEEKLY), [entry]);
  assert.equal(fs.existsSync(path.join(root, 'articles/newsletters', DATE)), false);
});

test('a failure with no transaction leaves a previously published week alone', t => {
  const { root, entry } = stage(t);
  const result = rollbackWeeklyPublication({ root, date: DATE });
  assert.equal(result.reason, 'no_snapshot');
  assert.deepEqual(read(root, WEEKLY), [entry]);
});


test('rollback preserves the exact bytes of an unrelated historical dated index', t => {
  const { root, entry } = stage(t);
  const original = '[{"date":"2026-10-15","title":"기존 공개 항목"}]\n';
  writeText(path.join(root, DATED), original);
  captureWeeklyPublication({ root, date: DATE });
  overwriteRun(root, entry);
  rollbackWeeklyPublication({ root, date: DATE });
  assert.equal(fs.readFileSync(path.join(root, DATED), 'utf8'), original);
});


function githubOwner(id, attempt = '1') { return { GITHUB_RUN_ID: id, GITHUB_RUN_ATTEMPT: attempt }; }
function successfulBytes(root, entry) {
  writeText(path.join(root, 'articles/newsletters', KEY, 'index.html'), 'PUBLISHED-GOOD');
  writeJson(path.join(root, WEEKLY), [{ ...entry, title: 'PUBLISHED-GOOD' }]);
  writeText(path.join(root, 'articles/data/homepage-headline.json'), 'PUBLISHED-GOOD headline');
  writeText(path.join(root, 'state/article-exposure-history.json'), 'PUBLISHED-GOOD exposure');
}
function assertSuccessfulBytes(root) {
  assert.equal(fs.readFileSync(path.join(root, 'articles/newsletters', KEY, 'index.html'), 'utf8'), 'PUBLISHED-GOOD');
  assert.equal(read(root, WEEKLY)[0].title, 'PUBLISHED-GOOD');
  assert.equal(fs.readFileSync(path.join(root, 'articles/data/homepage-headline.json'), 'utf8'), 'PUBLISHED-GOOD headline');
  assert.equal(fs.readFileSync(path.join(root, 'state/article-exposure-history.json'), 'utf8'), 'PUBLISHED-GOOD exposure');
}

test('a later run without capture cannot apply an earlier successful pending snapshot through either failure boundary', t => {
  const { root, entry } = stage(t);
  transaction.captureWeeklyPublication({ root, date: DATE, env: githubOwner('run-A') });
  successfulBytes(root, entry);
  writeJson(path.join(root, DATED), [{ date: DATE, title: 'PUBLISHED-GOOD dated metadata' }]);
  const result = unexposeFailedPublication(root, DATE, { env: githubOwner('run-B') });
  assert.equal(result.weeklyRollback.reason, 'owner_mismatch');
  assertSuccessfulBytes(root);
  reconcilePublicState({ root, date: DATE, env: githubOwner('run-B'), status: { date: DATE, diagnostics_only: true } });
  assertSuccessfulBytes(root);
  assert.equal(read(root, DATED)[0].title, 'PUBLISHED-GOOD dated metadata');
  assert.equal(read(root, SNAPSHOT).state, 'pending');
});

test('a completed publication is never rolled back by a later diagnostic run without capture', t => {
  const { root, entry } = stage(t);
  transaction.captureWeeklyPublication({ root, date: DATE, env: githubOwner('run-A') });
  successfulBytes(root, entry);
  assert.equal(completeWeeklyPublication({ root, date: DATE, env: githubOwner('run-A') }).completed, true);
  assert.equal(read(root, SNAPSHOT).state, 'completed');
  unexposeFailedPublication(root, DATE, { env: githubOwner('run-B') });
  reconcilePublicState({ root, date: DATE, env: githubOwner('run-B'), status: { date: DATE, diagnostics_only: true } });
  assertSuccessfulBytes(root);
});

test('a different GitHub attempt cannot roll back the earlier attempt but the matching owner can', t => {
  const { root, entry } = stage(t);
  transaction.captureWeeklyPublication({ root, date: DATE, env: githubOwner('run-A', '1') });
  successfulBytes(root, entry);
  assert.equal(transaction.rollbackWeeklyPublication({ root, date: DATE, env: githubOwner('run-A', '2') }).reason, 'owner_mismatch');
  assertSuccessfulBytes(root);
  assert.equal(transaction.rollbackWeeklyPublication({ root, date: DATE, env: githubOwner('run-A', '1') }).applied, true);
  assert.deepEqual(read(root, WEEKLY), [entry]);
});

test('completed snapshots reject even a matching owner and cannot be silently reopened', t => {
  const { root, entry } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  successfulBytes(root, entry);
  completeWeeklyPublication({ root, date: DATE, runKey: OWNER });
  assert.equal(rollbackWeeklyPublication({ root, date: DATE }).reason, 'completed');
  assert.throws(() => captureWeeklyPublication({ root, date: DATE }), /already completed/);
  assertSuccessfulBytes(root);
});

test('a separate CLI completes only the explicit matching owner without relying on process ID', t => {
  const { root } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  const { spawnSync } = require('node:child_process');
  const cli = path.resolve(__dirname, '../../publish/weekly-publication-transaction.js');
  const env = { ...process.env, GITHUB_RUN_ID: '', GITHUB_RUN_ATTEMPT: '', NEWSLETTER_PUBLICATION_RUN_KEY: '' };
  const wrong = spawnSync(process.execPath, [cli, '--complete', DATE, '--run-key', 'other-run'], { cwd: root, env, encoding: 'utf8' });
  assert.notEqual(wrong.status, 0);
  assert.equal(read(root, SNAPSHOT).state, 'pending');
  const correct = spawnSync(process.execPath, [cli, '--complete', DATE, '--run-key', OWNER], { cwd: root, env, encoding: 'utf8' });
  assert.equal(correct.status, 0, correct.stderr);
  assert.equal(read(root, SNAPSHOT).state, 'completed');
});

test('anonymous local snapshots require their returned explicit UUID owner for recovery', t => {
  const { root, entry } = stage(t);
  const snapshot = transaction.captureWeeklyPublication({ root, date: DATE, env: {} });
  assert.match(snapshot.runKey, /^local:[0-9a-f-]{36}$/);
  successfulBytes(root, entry);
  assert.throws(() => transaction.rollbackWeeklyPublication({ root, date: DATE, env: {} }), /without an explicit run owner/);
  assertSuccessfulBytes(root);
  assert.equal(transaction.rollbackWeeklyPublication({ root, date: DATE, runKey: snapshot.runKey, env: {} }).applied, true);
});

test('local generator invocations get distinct UUID owners while GitHub steps share run and attempt', () => {
  const local = {};
  const first = initializePublicationRun(local);
  const second = initializePublicationRun(local);
  assert.notEqual(first, second);
  assert.equal(local.NEWSLETTER_PUBLICATION_RUN_KEY, second);
  assert.equal(initializePublicationRun(githubOwner('42', '3')), '42:3');
  assert.equal(initializePublicationRun(githubOwner('42', '4')), '42:4');
});

test('malformed snapshots still fail closed even when the caller has a different owner', t => {
  const { root } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  const snapshot = read(root, SNAPSHOT);
  snapshot.files = {};
  writeJson(path.join(root, SNAPSHOT), snapshot);
  assert.throws(() => transaction.rollbackWeeklyPublication({ root, date: DATE, runKey: 'different' }), /Invalid weekly publication snapshot/);
});

test('workflow finalizes a successful snapshot only after all publication gates and PR creation succeed', () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../../../../.github/workflows/newsletters-03-editor-pr.yml'), 'utf8');
  const start = workflow.indexOf('      - name: Finalize successful weekly publication snapshot');
  assert.ok(start > workflow.indexOf('      - name: Create final newsletter pull request'));
  const block = workflow.slice(start, workflow.indexOf('      - name:', start + 10));
  for (const id of ['generate', 'ensure-public-newsletter', 'validate', 'audit-images', 'cpr']) assert.ok(block.includes('steps.' + id + ".outcome == 'success'"), id);
  assert.ok(block.includes("steps.meta.outputs.public_newsletter_ready == 'true'"));
  assert.ok(block.includes('weekly-publication-transaction.js --complete'));
});


test('missing recovery ownership fails closed at the actual unexpose boundary without modifying public state', t => {
  const { root, entry } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  successfulBytes(root, entry);
  const result = unexposeFailedPublication(root, DATE, { env: {} });
  assert.match(result.error, /without an explicit run owner/);
  assertSuccessfulBytes(root);
});
