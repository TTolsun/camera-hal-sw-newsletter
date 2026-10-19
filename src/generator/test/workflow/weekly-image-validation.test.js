const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { writeJson, writeText } = require('../../../shared/test/helpers/fs');
const cli = path.resolve(__dirname, '../../validate/validate-external-images.js');
const runDate = '2026-10-22';
const weeklyKey = '2026-W43';

function stage(t, { marker = true, audit = true, image = '' } = {}) {
  const prefix = path.join(os.tmpdir(), 'weekly-images-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => { assert.ok(path.resolve(root).startsWith(prefix)); fs.rmSync(root, { recursive: true, force: true }); });
  writeJson(path.join(root, 'articles/data/newsletters.json'), []);
  const entry = { weeklyKey, date: '2026-10-19', generation_anchor_date: runDate,
    html: 'newsletters/' + weeklyKey + '/index.html', md: 'newsletters/' + weeklyKey + '/newsletter.md' };
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), [entry]);
  writeText(path.join(root, 'articles', entry.html), '<html><body><h2>버퍼 제안</h2>' + (image ? '<img class="article-image" src="' + image + '">' : '') + '</body></html>');
  writeText(path.join(root, 'articles', entry.md), '# 버퍼 제안\n' + (image ? '![](' + image + ')' : ''));
  if (marker) writeText(path.join(root, '.tmp/newsletter-date.txt'), runDate);
  const auditPath = path.join(root, 'articles/content/newsroom', runDate, 'image-audit-report.json');
  if (audit) writeJson(auditPath, { date: runDate, summary: { publish_blocking_issue_count: 0 }, errors: [] });
  return { root, entry, auditPath };
}
function run(root) {
  const preload = path.join(root, 'fetch-stub.cjs');
  writeText(preload, "global.fetch = async () => new Response(null, { status: 403 });\n");
  return spawnSync(process.execPath, ['--require', preload, cli], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_NAME: '', GITHUB_BASE_REF: '' } });
}
function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

test('weekly-only public output validates without a dated index entry', t => {
  const { root } = stage(t);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('weekly-only execution still enforces a publish-blocking lineage report', t => {
  const { root, auditPath } = stage(t);
  writeJson(auditPath, { date: runDate, summary: { publish_blocking_issue_count: 1 }, errors: [] });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /lineage audit reports 1 publish-blocking/);
  assert.match(result.stderr, /newsletter 2026-10-22/);
});

test('weekly image files are inspected even when the dated archive is empty', t => {
  const { root } = stage(t, { image: 'assets/images/fallback/missing.svg' });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Local article image is missing: newsletters\/2026-W43/);
});

test('a current weekly external image receives live validation', t => {
  const { root } = stage(t, { image: 'https://publisher.example.com/camera.png' });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /External article image failed live validation: newsletters\/2026-W43/);
});

test('an unchanged historical weekly external image does not acquire a live probe', t => {
  const { root } = stage(t, { marker: false, image: 'https://publisher.example.com/camera.png' });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('a missing weekly Markdown file cannot be skipped', t => {
  const { root, entry } = stage(t);
  fs.unlinkSync(path.join(root, 'articles', entry.md));
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /md file does not exist: newsletters\/2026-W43/);
});

test('new committed weekly output requires its execution audit report', t => {
  const { root } = stage(t, { audit: false });
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'Newsletter Test']);
  git(root, ['config', 'user.email', 'newsletter@example.com']);
  git(root, ['add', 'articles/data/newsletters.json']);
  git(root, ['commit', '-q', '-m', 'baseline']);
  git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  git(root, ['add', 'articles']);
  git(root, ['commit', '-q', '-m', 'publish weekly']);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /lineage audit report is missing: newsletter 2026-10-22/);
});

test('the explicit run date wins over the first run anchor of an accumulated week', t => {
  const { root, entry } = stage(t);
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), [{ ...entry, generation_anchor_date: '2026-10-19' }]);
  writeJson(path.join(root, 'articles/content/newsroom/2026-10-19/image-audit-report.json'), { date: '2026-10-19', summary: { publish_blocking_issue_count: 1 } });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('a changed published week checks its bound audit even without a run-date marker', t => {
  const { root, entry, auditPath } = stage(t, { marker: false });
  writeJson(auditPath, { date: runDate, summary: { publish_blocking_issue_count: 1 }, errors: [] });
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'Newsletter Test']);
  git(root, ['config', 'user.email', 'newsletter@example.com']);
  git(root, ['add', 'articles']);
  git(root, ['commit', '-q', '-m', 'published baseline']);
  git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  writeText(path.join(root, 'articles', entry.html), '<html><body><h2>수정된 버퍼 제안</h2></body></html>');
  git(root, ['add', 'articles']);
  git(root, ['commit', '-q', '-m', 'edit weekly body']);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /lineage audit reports 1 publish-blocking/);
});
