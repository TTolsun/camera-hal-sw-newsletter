const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildManifest } = require('./write-artifact-manifest');
const {
  collectedCandidatesRelPath,
  newsroomRelPath
} = require('../common/artifact-paths');
const {
  articlePolicy,
  qualityGatePolicy
} = require('../common/newsletter-policy');

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
    quality_score: qualityGatePolicy.threshold - 11,
    selected_article_count: articlePolicy.mainArticleCount.min,
    underfilled: true,
    publish_ready: false
  });
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'quality-report.json').split('/')), {
    date,
    score: qualityGatePolicy.threshold - 11,
    threshold: qualityGatePolicy.threshold,
    status: 'NEEDS_FIX',
    metrics: {
      article_count: articlePolicy.mainArticleCount.min,
      must_fix_count: 0
    }
  });
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'quality-report.md').split('/')), '# Quality\n');
}

function testManifestCreationAndHashes() {
  const snapshotDir = makeSnapshot();
  seedAgreeingSnapshot(snapshotDir);
  writeJson(path.join(snapshotDir, ...collectedCandidatesRelPath(date).split('/')), { candidates: [] });
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'shortlisted-candidates.json').split('/')), {
    date,
    selected_article_count: 0
  });
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'selection-diagnostics.md').split('/')), '# Selection Diagnostics\n');
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'selection-report.json').split('/')), {
    date,
    failure_stage: 'deterministic selection',
    selection_errors: ['Only 1 eligible candidate remains.']
  });
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'selection-report.md').split('/')), '# Selection Report\n');
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'linked-evidence-report.json').split('/')), {
    schema_version: 1,
    date,
    enable_network: false,
    candidate_count: 0,
    totals: {},
    candidates: []
  });
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'linked-evidence-diagnostics.md').split('/')), '# Linked Evidence Diagnostics\n');
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'event-bundles.json').split('/')), {
    schema_version: 1,
    date,
    event_bundles: []
  });
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'event-bundle-diagnostics.md').split('/')), '# Event Bundle Diagnostics\n');
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'retry-history.json').split('/')), []);
  writeJson(path.join(snapshotDir, '.tmp', 'gemini-raw', 'attempt-1.json'), { text: '{' });
  writeJson(path.join(snapshotDir, 'cache', 'news-summary', 'summary.json'), { title: 'cached' });

  const manifest = runWriter(snapshotDir);
  assert.strictEqual(manifest.date, date);
  assert.ok(fs.existsSync(path.join(snapshotDir, 'artifact-manifest.json')));
  assert.ok(manifest.files.some(file => file.path === '.tmp/newsletter-generation-status.json'));
  assert.ok(manifest.files.some(file => file.path === collectedCandidatesRelPath(date)));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'selection-diagnostics.md')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'selection-report.json')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'selection-report.md')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'linked-evidence-report.json')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'linked-evidence-diagnostics.md')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'event-bundles.json')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'event-bundle-diagnostics.md')));
  assert.ok(manifest.files.some(file => file.path === '.tmp/gemini-raw/attempt-1.json'));
  assert.ok(manifest.files.some(file => file.path === 'cache/news-summary/summary.json'));
  assert.ok(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.ok(manifest.missing_critical_files.includes(`newsletters/${date}/newsletter.md`));
}

function testWarningsWhenReportsDisagree() {
  const snapshotDir = makeSnapshot();
  seedAgreeingSnapshot(snapshotDir);
  writeJson(path.join(snapshotDir, '.tmp', 'newsletter-generation-status.json'), {
    date,
    quality_status: 'PASS',
    quality_score: qualityGatePolicy.threshold + 10,
    selected_article_count: articlePolicy.mainArticleCount.min + 1
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
