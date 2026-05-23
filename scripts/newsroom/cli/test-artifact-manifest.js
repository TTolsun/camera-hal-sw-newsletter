const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildManifest } = require('./write-artifact-manifest');
const {
  buildReviewArtifactInventory,
  REVIEW_ARTIFACT_SCHEMA_VERSION
} = require('../common/review-artifact-inventory');
const {
  collectedCandidatesRelPath,
  newsroomRelPath,
  seedEvidencePackMarkdownRelPath,
  seedMergeReportMarkdownRelPath
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
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'evidence-pack-summary.json').split('/')), {
    schema_version: 1,
    date,
    selected_main_articles: []
  });
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'artifact-manifest.json').split('/')), {
    schema_version: 1,
    date,
    files: []
  });
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'retry-history.json').split('/')), []);
  writeJson(path.join(snapshotDir, '.tmp', 'gemini-raw', 'attempt-1.json'), { text: '{' });
  writeJson(path.join(snapshotDir, 'cache', 'news-summary', 'summary.json'), { title: 'cached' });

  const manifest = runWriter(snapshotDir);
  assert.strictEqual(manifest.schema_version, REVIEW_ARTIFACT_SCHEMA_VERSION);
  assert.strictEqual(manifest.date, date);
  assert.ok(fs.existsSync(path.join(snapshotDir, 'artifact-manifest.json')));
  assert.ok(Array.isArray(manifest.review_artifacts));
  assert.ok(manifest.review_artifacts.some(artifact =>
    artifact.path === newsroomRelPath(date, 'artifact-manifest.json') &&
    artifact.present === true &&
    artifact.derived === true
  ));
  assert.ok(manifest.files.some(file => file.path === '.tmp/newsletter-generation-status.json'));
  assert.ok(manifest.files.some(file => file.path === collectedCandidatesRelPath(date)));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'selection-diagnostics.md')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'selection-report.json')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'selection-report.md')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'linked-evidence-report.json')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'linked-evidence-diagnostics.md')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'event-bundles.json')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'event-bundle-diagnostics.md')));
  assert.ok(manifest.files.some(file => file.path === newsroomRelPath(date, 'evidence-pack-summary.json')));
  assert.ok(manifest.files.some(file => file.path === '.tmp/gemini-raw/attempt-1.json'));
  assert.ok(manifest.files.some(file => file.path === 'cache/news-summary/summary.json'));
  assert.ok(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.ok(manifest.files.every(file =>
    Object.keys(file).sort().join(',') === 'path,sha256,size' &&
    typeof file.path === 'string' &&
    typeof file.size === 'number' &&
    typeof file.sha256 === 'string'
  ));
  assert.ok(manifest.files.every(file => !file.path.endsWith('artifact-manifest.json')));
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

function testReviewInventoryRequiredStateAndFallbacks() {
  const snapshotDir = makeSnapshot();
  const unknownPath = newsroomRelPath(date, 'experimental-selection-report.json');
  writeText(path.join(snapshotDir, ...seedEvidencePackMarkdownRelPath(date).split('/')), '# Seed Evidence\n');
  writeJson(path.join(snapshotDir, ...unknownPath.split('/')), { experimental: true });

  const inventory = buildReviewArtifactInventory({
    root: snapshotDir,
    date,
    changedArtifacts: [unknownPath.replace(/\//g, '\\')],
    runContext: {
      seedUsed: false,
      publicOutputExpected: true,
      status: 'weird_new_status'
    }
  });

  const seedEvidence = inventory.review_artifacts.find(artifact =>
    artifact.path === seedEvidencePackMarkdownRelPath(date)
  );
  const seedMerge = inventory.review_artifacts.find(artifact =>
    artifact.path === seedMergeReportMarkdownRelPath(date)
  );
  const newsletterMd = inventory.review_artifacts.find(artifact =>
    artifact.path === `newsletters/${date}/newsletter.md`
  );
  const newsletterHtml = inventory.review_artifacts.find(artifact =>
    artifact.path === `newsletters/${date}/index.html`
  );
  const unknown = inventory.review_artifacts.find(artifact => artifact.path === unknownPath);

  assert.equal(inventory.status, 'weird_new_status');
  assert.equal(seedEvidence.present, true);
  assert.equal(seedEvidence.requiredActive, false);
  assert.equal(seedEvidence.review_blocking, false);
  assert.equal(seedEvidence.review_attention_required, true);
  assert.equal(seedEvidence.warning.code, 'seed_artifact_present_without_seed');
  assert.equal(seedMerge.requiredActive, false);
  assert.equal(newsletterMd.requiredActive, true);
  assert.equal(newsletterHtml.requiredActive, true);
  assert.ok(inventory.missingRequired.some(artifact => artifact.path === `newsletters/${date}/newsletter.md`));
  assert.ok(inventory.missingRequired.some(artifact => artifact.path === `newsletters/${date}/index.html`));
  assert.equal(unknown.group, 'unknown_artifacts');
  assert.equal(unknown.role, 'unclassified');
  assert.equal(unknown.required, 'optional');
  assert.equal(unknown.requiredActive, false);
  assert.equal(unknown.review_order, 95);
  assert.equal(unknown.review_attention_required, true);
  assert.equal(unknown.changed, true);
}

function testDerivedArtifactsDoNotCreateMissingRequired() {
  const snapshotDir = makeSnapshot();
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, '00-review-guide.md').split('/')), '# Guide\n');
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'release-qa-report.md').split('/')), '# Release QA\n');
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'artifact-manifest.json').split('/')), {
    schema_version: REVIEW_ARTIFACT_SCHEMA_VERSION,
    files: []
  });

  const inventory = buildReviewArtifactInventory({
    root: snapshotDir,
    date,
    runContext: {
      seedUsed: false,
      publicOutputExpected: false,
      status: 'FAILED_REPAIR_REVIEWABLE'
    }
  });
  const guide = inventory.review_artifacts.find(artifact =>
    artifact.path === newsroomRelPath(date, '00-review-guide.md')
  );
  const releaseQa = inventory.review_artifacts.find(artifact =>
    artifact.path === newsroomRelPath(date, 'release-qa-report.md')
  );
  const manifest = inventory.review_artifacts.find(artifact =>
    artifact.path === newsroomRelPath(date, 'artifact-manifest.json')
  );

  assert.equal(guide.present, true);
  assert.equal(guide.derived, true);
  assert.equal(guide.requiredActive, false);
  assert.equal(releaseQa.present, true);
  assert.equal(releaseQa.derived, true);
  assert.equal(releaseQa.requiredActive, false);
  assert.equal(manifest.present, true);
  assert.equal(manifest.derived, true);
  assert.equal(manifest.requiredActive, false);
  assert.equal(inventory.missingRequired.some(artifact => artifact.derived), false);
}

testManifestCreationAndHashes();
testWarningsWhenReportsDisagree();
testNoWarningsWhenReportsAgree();
testReviewInventoryRequiredStateAndFallbacks();
testDerivedArtifactsDoNotCreateMissingRequired();

console.log('Artifact manifest tests passed.');
