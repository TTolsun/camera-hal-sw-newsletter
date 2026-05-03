const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildManifest } = require('./write-artifact-manifest');

const date = '2026-05-03';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function makeSnapshot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-manifest-'));
}

function runWriter(snapshotDir) {
  const manifest = buildManifest(snapshotDir, date);
  fs.writeFileSync(
    path.join(snapshotDir, 'artifact-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  return JSON.parse(fs.readFileSync(path.join(snapshotDir, 'artifact-manifest.json'), 'utf8'));
}

function seedAgreeingSnapshot(snapshotDir) {
  writeText(path.join(snapshotDir, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(snapshotDir, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'UNDERFILLED_NEEDS_FIX',
    quality_status: 'NEEDS_FIX',
    quality_score: 74,
    selected_article_count: 3,
    underfilled: true,
    publish_ready: false
  });
  writeJson(path.join(snapshotDir, 'newsroom', date, 'quality-report.json'), {
    date,
    score: 74,
    threshold: 90,
    status: 'NEEDS_FIX',
    metrics: {
      article_count: 3,
      must_fix_count: 0
    }
  });
  writeText(path.join(snapshotDir, 'newsroom', date, 'quality-report.md'), '# Quality\n');
}

function testManifestCreationAndHashes() {
  const snapshotDir = makeSnapshot();
  seedAgreeingSnapshot(snapshotDir);
  writeJson(path.join(snapshotDir, 'newsroom', date, 'retry-history.json'), []);
  writeJson(path.join(snapshotDir, '.tmp', 'gemini-raw', 'attempt-1.json'), { text: '{' });
  writeJson(path.join(snapshotDir, 'cache', 'news-summary', 'summary.json'), { title: 'cached' });

  const manifest = runWriter(snapshotDir);
  assert.strictEqual(manifest.date, date);
  assert.ok(fs.existsSync(path.join(snapshotDir, 'artifact-manifest.json')));
  assert.ok(manifest.files.some(file => file.path === '.tmp/newsletter-generation-status.json'));
  assert.ok(manifest.files.some(file => file.path === '.tmp/gemini-raw/attempt-1.json'));
  assert.ok(manifest.files.some(file => file.path === 'cache/news-summary/summary.json'));
  assert.ok(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.ok(manifest.missing_critical_files.includes(`collected-news/${date}/candidates.json`));
}

function testWarningsWhenReportsDisagree() {
  const snapshotDir = makeSnapshot();
  seedAgreeingSnapshot(snapshotDir);
  writeJson(path.join(snapshotDir, '.tmp', 'newsletter-generation-status.json'), {
    date,
    quality_status: 'PASS',
    quality_score: 95,
    selected_article_count: 4
  });

  const manifest = runWriter(snapshotDir);
  assert.ok(manifest.consistency_warnings.some(warning => warning.includes('quality score mismatch')));
  assert.ok(manifest.consistency_warnings.some(warning => warning.includes('article count mismatch')));
  assert.ok(manifest.consistency_warnings.some(warning => warning.includes('quality status mismatch')));
}

function testNoWarningsWhenReportsAgree() {
  const snapshotDir = makeSnapshot();
  seedAgreeingSnapshot(snapshotDir);

  const manifest = runWriter(snapshotDir);
  assert.deepStrictEqual(manifest.consistency_warnings, []);
}

testManifestCreationAndHashes();
testWarningsWhenReportsDisagree();
testNoWarningsWhenReportsAgree();

console.log('Artifact manifest tests passed.');
