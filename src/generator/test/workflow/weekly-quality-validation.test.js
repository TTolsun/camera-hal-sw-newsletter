const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { qualityGatePolicy } = require('../../../shared/common/newsletter-policy');
const { writeJson, writeText } = require('../../../shared/test/helpers/fs');

const cli = path.resolve(__dirname, '../../validate/validate-quality.js');
const runDate = '2026-10-22';
function stage(t, { marker = true, report = true } = {}) {
  const prefix = path.join(os.tmpdir(), 'weekly-quality-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => { assert.ok(path.resolve(root).startsWith(prefix)); fs.rmSync(root, { recursive: true, force: true }); });
  writeJson(path.join(root, 'articles/data/newsletters.json'), []);
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), [{ weeklyKey: '2026-W43', date: '2026-10-19' }]);
  if (marker) writeText(path.join(root, '.tmp/newsletter-date.txt'), runDate);
  const dir = path.join(root, 'articles/content/newsroom', runDate);
  if (report) writeJson(path.join(dir, 'quality-report.json'), {
    // Minimal report contract input, not a complete publishable article or golden fixture.
    score: 100, threshold: qualityGatePolicy.threshold, status: 'PASS', deductions: []
  });
  return { root, dir };
}
function run(root, env = {}) {
  return spawnSync(process.execPath, [cli], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, GITHUB_SHA: '', GITHUB_EVENT_NAME: '', GITHUB_BASE_REF: '', ...env }
  });
}

test('execution-date quality report is checked without a dated public index entry', t => {
  const { root } = stage(t);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, 'articles/newsletters', runDate)), false);
});

test('missing execution-date report is a hard failure rather than a missing dated entry', t => {
  const { root } = stage(t, { report: false });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing quality report for generated newsletter 2026-10-22/);
});

for (const [label, changes, expected] of [
  ['lowered threshold', { threshold: qualityGatePolicy.threshold - 1 }, /threshold is below/],
  ['failed status', { status: 'NEEDS_FIX' }, /does not pass: NEEDS_FIX/],
  ['low score', { score: qualityGatePolicy.threshold - 1 }, /quality score.*does not pass/]
]) {
  test('weekly-only execution still rejects ' + label, t => {
    const { root, dir } = stage(t);
    const file = path.join(dir, 'quality-report.json');
    writeJson(file, { ...JSON.parse(fs.readFileSync(file, 'utf8')), ...changes });
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, expected);
  });
}

test('current temporary generation status adds an unindexed execution date', t => {
  const { root } = stage(t, { marker: false, report: false });
  writeJson(path.join(root, '.tmp/newsletter-generation-status.json'), { date: runDate, run_context: { github_sha: 'current-run' } });
  const result = run(root, { GITHUB_SHA: 'current-run' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing quality report for generated newsletter 2026-10-22/);
});

test('current canonical generation status adds an unindexed execution date', t => {
  const { root, dir } = stage(t, { marker: false, report: false });
  writeJson(path.join(dir, 'generation-status.json'), { date: runDate, run_context: { github_sha: 'current-run' } });
  const result = run(root, { GITHUB_SHA: 'current-run' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing quality report for generated newsletter 2026-10-22/);
});

test('stale canonical status does not require new reports for an unchanged historical execution', t => {
  const { root, dir } = stage(t, { marker: false, report: false });
  writeJson(path.join(dir, 'generation-status.json'), { date: runDate, run_context: { github_sha: 'previous-run' } });
  const result = run(root, { GITHUB_SHA: 'current-run' });
  assert.equal(result.status, 0, result.stderr);
});

test('invalid execution date cannot become a report path', t => {
  const { root } = stage(t);
  writeText(path.join(root, '.tmp/newsletter-date.txt'), '../outside');
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid .tmp\/newsletter-date.txt date/);
});

for (const date of ['2026-10-19', '../outside']) {
  test('current canonical status cannot redirect its execution date to ' + date, t => {
    const { root, dir } = stage(t, { marker: false });
    writeJson(path.join(dir, 'generation-status.json'), { date, run_context: { github_sha: 'current-run' } });
    const result = run(root, { GITHUB_SHA: 'current-run' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Current canonical generation status date does not match newsroom directory/);
  });
}
