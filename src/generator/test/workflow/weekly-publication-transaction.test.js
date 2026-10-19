const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { captureWeeklyPublication, rollbackWeeklyPublication } = require('../../publish/weekly-publication-transaction');
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
  rollbackWeeklyPublication({ root, date: DATE });
  assert.deepEqual(read(root, WEEKLY), [entry]);
  assert.equal(rollbackWeeklyPublication({ root, date: DATE }).reason, 'already_rolled_back');
  writeText(path.join(root, 'articles/newsletters', KEY, 'index.html'), 'New approved baseline');
  captureWeeklyPublication({ root, date: DATE, runKey: 'second' });
  overwriteRun(root, entry);
  rollbackWeeklyPublication({ root, date: DATE });
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
  const result = unexposeFailedPublication(root, DATE);
  assert.equal(result.error, '');
  assert.deepEqual(read(root, WEEKLY), [entry]);
  assert.deepEqual(read(root, DATED), [{ date: '2026-10-19' }]);
});

test('reconciliation rolls back a failed weekly-only output even when dated files were never written', t => {
  const { root, entry } = stage(t);
  captureWeeklyPublication({ root, date: DATE });
  overwriteRun(root, entry);
  const result = reconcilePublicState({ root, date: DATE, status: { date: DATE, diagnostics_only: true, public_newsletter_ready: false } });
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
