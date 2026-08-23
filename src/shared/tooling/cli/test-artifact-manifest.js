const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildManifest } = require('../../../generator/publish/write-artifact-manifest');
const {
  buildDateReviewManifest,
  buildReviewArtifactInventory,
  renderReviewGuideMarkdown,
  REVIEW_ARTIFACT_SCHEMA_VERSION,
  PUBLIC_SOURCE_OF_TRUTH,
  REVIEW_REQUIRED_COMPACT,
  DEBUG_HEAVY,
  TRANSIENT_ATTEMPT
} = require('../../../generator/publish/review-artifact-inventory');
const {
  collectedCandidatesRelPath,
  newsroomRelPath,
  seedEvidencePackMarkdownRelPath,
  seedMergeReportMarkdownRelPath
} = require('../../common/artifact-paths');
const {
  articlePolicy,
  qualityGatePolicy
} = require('../../common/newsletter-policy');

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

// 매니페스트 경로 규약 잠금(#952).
//
// 매니페스트가 기록하는 경로는 #262 phase 6(2026-06-13 머지)을 경계로 두 규약으로 갈린다.
// 그 전에 쓰인 매니페스트는 공개 출력물을 articles/ 접두 없이 content/·data/·newsletters/·
// sitemap.xml로 기록했고, 그 뒤에 쓰인 매니페스트는 저장소 루트 기준이라 articles/로 시작한다.
// schema_version은 이 차이를 표시하지 않는다(4가 두 규약에 모두 걸쳐 있다). 그래서 규약을
// 산문 대신 이 검사로 잠근다 — 새로 쓰이는 매니페스트는 반드시 저장소 루트 기준이어야 하고,
// 이미 커밋된 과거 매니페스트는 쓰이던 시점의 규약을 그대로 지켜야 한다(사후 정규화 금지).
const REPOSITORY_ROOT_PATH_CONVENTION_START_DATE = '2026-06-16';
const MANIFEST_PATH_ARRAYS = ['files', 'review_artifacts', 'retained_heavy_artifacts', 'committed_artifacts'];
const PUBLIC_OUTPUT_ROOT_PREFIXES = ['content/', 'data/', 'newsletters/'];

// 규약 판별 대상은 #262에서 articles/ 아래로 옮겨진 공개 출력물 경로뿐이다. .tmp/·cache/·
// state/는 옮겨지지 않아 두 규약에서 똑같이 쓰이므로 판별에 쓸 수 없다.
function isPublicOutputManifestPath(relPath) {
  const withoutArticlesPrefix = relPath.startsWith('articles/')
    ? relPath.slice('articles/'.length)
    : relPath;
  return withoutArticlesPrefix === 'sitemap.xml' ||
    PUBLIC_OUTPUT_ROOT_PREFIXES.some(prefix => withoutArticlesPrefix.startsWith(prefix));
}

function manifestPathEntries(manifest) {
  const entries = [];
  for (const key of MANIFEST_PATH_ARRAYS) {
    for (const entry of manifest[key] || []) {
      if (entry && typeof entry.path === 'string') entries.push({ key, path: entry.path });
    }
  }
  return entries;
}

function assertManifestPathConvention(manifest, { label, expectArticlesPrefix }) {
  let publicOutputPathCount = 0;
  for (const entry of manifestPathEntries(manifest)) {
    if (!isPublicOutputManifestPath(entry.path)) continue;
    publicOutputPathCount += 1;
    const hasArticlesPrefix = entry.path.startsWith('articles/');
    assert.strictEqual(
      hasArticlesPrefix,
      expectArticlesPrefix,
      expectArticlesPrefix
        ? `${label}: ${entry.key}[] 경로 "${entry.path}"가 저장소 루트 기준이 아니다. #262 이후 공개 출력물 경로는 articles/로 시작해야 한다.`
        : `${label}: ${entry.key}[] 경로 "${entry.path}"에 articles/ 접두가 붙었다. #262 이전 매니페스트는 기록된 규약 그대로 두어야 한다(#952).`
    );
  }
  assert.ok(
    publicOutputPathCount > 0,
    `${label}: 공개 출력물 경로가 하나도 없어 경로 규약을 검사하지 못했다`
  );
}

// 이미 커밋된 매니페스트는 감사 기록이라 사후에 경로를 고쳐 쓰지 않는다. 대신 각 매니페스트가
// 자기 날짜의 규약을 지키는지 확인해, 새 매니페스트가 옛 규약으로 쓰이거나 과거 매니페스트가
// 조용히 정규화되면 이 검사가 실패하게 한다.
function testTrackedManifestPathConvention() {
  const repositoryRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const newsroomRoot = path.join(repositoryRoot, 'articles', 'content', 'newsroom');
  const dateDirectories = fs.readdirSync(newsroomRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map(entry => entry.name)
    .sort();

  let checkedManifestCount = 0;
  for (const dateDirectory of dateDirectories) {
    const manifestPath = path.join(newsroomRoot, dateDirectory, 'artifact-manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    assertManifestPathConvention(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), {
      label: `articles/content/newsroom/${dateDirectory}/artifact-manifest.json`,
      expectArticlesPrefix: dateDirectory >= REPOSITORY_ROOT_PATH_CONVENTION_START_DATE
    });
    checkedManifestCount += 1;
  }

  assert.ok(
    checkedManifestCount > 0,
    '커밋된 artifact-manifest.json을 하나도 읽지 못했다 — 경로 규약 검사가 무력화됐다'
  );
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
  assertManifestPathConvention(manifest, {
    label: 'buildManifest',
    expectArticlesPrefix: true
  });
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
  assert.ok(manifest.missing_critical_files.includes(`articles/newsletters/${date}/newsletter.md`));

  // retention fields
  assert.ok(Array.isArray(manifest.retained_heavy_artifacts), 'retained_heavy_artifacts should be an array');
  assert.ok(Array.isArray(manifest.committed_artifacts), 'committed_artifacts should be an array');
  assert.ok(typeof manifest.retention_summary === 'object', 'retention_summary should be an object');
  assert.ok(typeof manifest.retention_location === 'string', 'retention_location should be a string');
  assert.strictEqual(manifest.retention_schema_version, REVIEW_ARTIFACT_SCHEMA_VERSION);

  const heavyShortlisted = manifest.retained_heavy_artifacts.find(a =>
    a.path === newsroomRelPath(date, 'shortlisted-candidates.json')
  );
  assert.ok(heavyShortlisted, 'shortlisted-candidates.json should be in retained_heavy_artifacts');
  assert.strictEqual(heavyShortlisted.retention_grade, DEBUG_HEAVY);
  assert.ok(typeof heavyShortlisted.retention_location === 'string');
  assert.ok(typeof heavyShortlisted.size === 'number');
  assert.ok(typeof heavyShortlisted.sha256 === 'string');

  const committedSelectionReport = manifest.committed_artifacts.find(a =>
    a.path === newsroomRelPath(date, 'selection-report.json')
  );
  assert.ok(committedSelectionReport, 'selection-report.json should be in committed_artifacts');
  assert.strictEqual(committedSelectionReport.retention_grade, REVIEW_REQUIRED_COMPACT);

  const committedQualityReport = manifest.committed_artifacts.find(a =>
    a.path === newsroomRelPath(date, 'quality-report.json')
  );
  assert.ok(committedQualityReport, 'quality-report.json should be in committed_artifacts');
  assert.strictEqual(committedQualityReport.retention_grade, REVIEW_REQUIRED_COMPACT);

  // committed_artifacts 항목은 path와 retention_grade만 담는다. 커밋되는 파일의 바이트는
  // Git tree가 정본이라 committed_artifacts에 size·sha256 사본을 두지 않는다(#942).
  assert.ok(manifest.committed_artifacts.length > 0, 'committed_artifacts should not be empty');
  assert.ok(
    manifest.committed_artifacts.every(entry => !('size' in entry) && !('sha256' in entry)),
    'committed_artifacts entries must not carry size or sha256'
  );
  assert.ok(
    manifest.committed_artifacts.every(entry =>
      Object.keys(entry).sort().join(',') === 'path,retention_grade'
    ),
    'committed_artifacts entries must carry exactly path and retention_grade'
  );
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
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, '.DS_Store').split('/')), 'ignored\n');
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'Thumbs.db').split('/')), 'ignored\n');
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'debug.tmp').split('/')), 'ignored\n');
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'old.bak').split('/')), 'ignored\n');

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
    artifact.path === `articles/newsletters/${date}/newsletter.md`
  );
  const newsletterHtml = inventory.review_artifacts.find(artifact =>
    artifact.path === `articles/newsletters/${date}/index.html`
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
  assert.ok(inventory.missingRequired.some(artifact => artifact.path === `articles/newsletters/${date}/newsletter.md`));
  assert.ok(inventory.missingRequired.some(artifact => artifact.path === `articles/newsletters/${date}/index.html`));
  assert.equal(unknown.group, 'unknown_artifacts');
  assert.equal(unknown.role, 'unclassified');
  assert.equal(unknown.required, 'optional');
  assert.equal(unknown.requiredActive, false);
  assert.equal(unknown.review_order, 95);
  assert.equal(unknown.review_attention_required, true);
  assert.equal(unknown.changed, true);
  assert.equal(inventory.review_artifacts.some(artifact => artifact.path.endsWith('.DS_Store')), false);
  assert.equal(inventory.review_artifacts.some(artifact => artifact.path.endsWith('Thumbs.db')), false);
  assert.equal(inventory.review_artifacts.some(artifact => artifact.path.endsWith('.tmp')), false);
  assert.equal(inventory.review_artifacts.some(artifact => artifact.path.endsWith('.bak')), false);
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

function testRecoveryPromptAttentionPolicy() {
  const passSnapshot = makeSnapshot();
  const passInventory = buildReviewArtifactInventory({
    root: passSnapshot,
    date,
    runContext: {
      seedUsed: false,
      publicOutputExpected: true,
      status: 'PASS'
    }
  });
  const passRecovery = passInventory.review_artifacts.find(artifact =>
    artifact.path === newsroomRelPath(date, 'recovery-prompt.md')
  );
  assert.equal(passRecovery.present, false);
  assert.equal(passRecovery.requiredActive, false);
  assert.equal(passRecovery.review_attention_required, false);
  assert.equal(passRecovery.warning, undefined);
  assert.equal(renderReviewGuideMarkdown(passInventory).includes(newsroomRelPath(date, 'recovery-prompt.md')), false);

  const failureSnapshot = makeSnapshot();
  const failureInventory = buildReviewArtifactInventory({
    root: failureSnapshot,
    date,
    runContext: {
      seedUsed: false,
      publicOutputExpected: false,
      status: 'FAILED_REPAIR_REVIEWABLE'
    }
  });
  const failureRecovery = failureInventory.review_artifacts.find(artifact =>
    artifact.path === newsroomRelPath(date, 'recovery-prompt.md')
  );
  assert.equal(failureRecovery.present, false);
  assert.equal(failureRecovery.requiredActive, false);
  assert.equal(failureRecovery.review_attention_required, true);
  assert.equal(failureRecovery.warning.code, 'recovery_prompt_missing_for_reviewable_failure');
}

function testDerivedMissingWarningsAndOptionalGateBlocking() {
  const snapshotDir = makeSnapshot();
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'stale-claim-report.md').split('/')), '# Stale Claims\n');

  const inventory = buildReviewArtifactInventory({
    root: snapshotDir,
    date,
    runContext: {
      seedUsed: false,
      publicOutputExpected: false,
      status: 'PASS'
    }
  });
  const guide = inventory.review_artifacts.find(artifact =>
    artifact.path === newsroomRelPath(date, '00-review-guide.md')
  );
  const releaseQa = inventory.review_artifacts.find(artifact =>
    artifact.path === newsroomRelPath(date, 'release-qa-report.md')
  );
  const staleClaim = inventory.review_artifacts.find(artifact =>
    artifact.path === newsroomRelPath(date, 'stale-claim-report.md')
  );

  assert.equal(guide.derived, true);
  assert.equal(guide.requiredActive, false);
  assert.equal(guide.review_attention_required, true);
  assert.equal(guide.warning.code, 'derived_artifact_missing');
  assert.equal(releaseQa.derived, true);
  assert.equal(releaseQa.requiredActive, false);
  assert.equal(releaseQa.review_attention_required, true);
  assert.equal(releaseQa.warning.code, 'derived_artifact_missing');
  assert.equal(inventory.missingRequired.some(artifact => artifact.path === guide.path), false);
  assert.equal(inventory.missingRequired.some(artifact => artifact.path === releaseQa.path), false);
  assert.equal(staleClaim.present, true);
  assert.equal(staleClaim.requiredActive, false);
  assert.equal(staleClaim.review_blocking, true);
}

function testRetentionGradeAssignment() {
  const snapshotDir = makeSnapshot();
  seedAgreeingSnapshot(snapshotDir);

  // PUBLIC_SOURCE_OF_TRUTH: newsletter.md
  writeText(path.join(snapshotDir, 'articles', 'newsletters', date, 'newsletter.md'), '# Newsletter\n');
  // REVIEW_REQUIRED_COMPACT: selection-report.md
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'selection-report.md').split('/')), '# Selection Report\n');
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'selection-report.json').split('/')), { date });
  // DEBUG_HEAVY: shortlisted-candidates.json
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'shortlisted-candidates.json').split('/')), { date, selected_article_count: 0 });
  // TRANSIENT_ATTEMPT: attempt file
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'editor-draft-attempt-1.json').split('/')), { attempt: 1 });

  const inventory = buildReviewArtifactInventory({
    root: snapshotDir,
    date,
    runContext: { seedUsed: false, publicOutputExpected: true, status: 'PASS' }
  });

  const newsletterMd = inventory.review_artifacts.find(a => a.path === `articles/newsletters/${date}/newsletter.md`);
  assert.ok(newsletterMd, 'newsletter.md should be in inventory');
  assert.strictEqual(newsletterMd.retention_grade, PUBLIC_SOURCE_OF_TRUTH);

  const selectionReportMd = inventory.review_artifacts.find(a => a.path === newsroomRelPath(date, 'selection-report.md'));
  assert.ok(selectionReportMd, 'selection-report.md should be in inventory');
  assert.strictEqual(selectionReportMd.retention_grade, REVIEW_REQUIRED_COMPACT);

  const shortlisted = inventory.review_artifacts.find(a => a.path === newsroomRelPath(date, 'shortlisted-candidates.json'));
  assert.ok(shortlisted, 'shortlisted-candidates.json should be in inventory');
  assert.strictEqual(shortlisted.retention_grade, DEBUG_HEAVY);

  const attempt = inventory.review_artifacts.find(a => a.path === newsroomRelPath(date, 'editor-draft-attempt-1.json'));
  assert.ok(attempt, 'editor-draft-attempt-1.json should be in inventory');
  assert.strictEqual(attempt.retention_grade, TRANSIENT_ATTEMPT);
}

function testBuildDateReviewManifestRetentionFields() {
  const snapshotDir = makeSnapshot();
  seedAgreeingSnapshot(snapshotDir);

  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'shortlisted-candidates.json').split('/')), {
    date,
    selected_article_count: 0
  });
  writeText(path.join(snapshotDir, ...newsroomRelPath(date, 'selection-report.md').split('/')), '# Selection Report\n');
  writeJson(path.join(snapshotDir, ...newsroomRelPath(date, 'selection-report.json').split('/')), { date });

  const manifest = buildDateReviewManifest({
    root: snapshotDir,
    date,
    runContext: { seedUsed: false, publicOutputExpected: false, status: 'UNDERFILLED_NEEDS_FIX' }
  });

  assertManifestPathConvention(manifest, {
    label: 'buildDateReviewManifest',
    expectArticlesPrefix: true
  });
  assert.ok(Array.isArray(manifest.retained_heavy_artifacts), 'retained_heavy_artifacts should be an array');
  assert.ok(Array.isArray(manifest.committed_artifacts), 'committed_artifacts should be an array');
  assert.ok(typeof manifest.retention_summary === 'object', 'retention_summary should be an object');
  assert.ok(typeof manifest.retention_location === 'string', 'retention_location should be a string');

  const heavyShortlisted = manifest.retained_heavy_artifacts.find(a =>
    a.path === newsroomRelPath(date, 'shortlisted-candidates.json')
  );
  assert.ok(heavyShortlisted, 'shortlisted-candidates.json should appear in retained_heavy_artifacts');
  assert.strictEqual(heavyShortlisted.retention_grade, DEBUG_HEAVY);
  assert.ok(typeof heavyShortlisted.retention_location === 'string');
  assert.ok(typeof heavyShortlisted.size === 'number');
  assert.ok(typeof heavyShortlisted.sha256 === 'string');

  const committedQuality = manifest.committed_artifacts.find(a =>
    a.path === newsroomRelPath(date, 'quality-report.json')
  );
  assert.ok(committedQuality, 'quality-report.json should appear in committed_artifacts');
  assert.strictEqual(committedQuality.retention_grade, REVIEW_REQUIRED_COMPACT);

  // 날짜 단위 리뷰 매니페스트도 같은 계약을 지킨다: 커밋되는 파일의 바이트 정본은 Git tree라
  // committed_artifacts에는 size·sha256을 담지 않는다(#942).
  assert.ok(manifest.committed_artifacts.length > 0, 'committed_artifacts should not be empty');
  assert.ok(
    manifest.committed_artifacts.every(entry => !('size' in entry) && !('sha256' in entry)),
    'committed_artifacts entries must not carry size or sha256'
  );
  assert.ok(
    manifest.committed_artifacts.every(entry =>
      Object.keys(entry).sort().join(',') === 'path,retention_grade'
    ),
    'committed_artifacts entries must carry exactly path and retention_grade'
  );
}

testManifestCreationAndHashes();
testWarningsWhenReportsDisagree();
testNoWarningsWhenReportsAgree();
testReviewInventoryRequiredStateAndFallbacks();
testDerivedArtifactsDoNotCreateMissingRequired();
testRecoveryPromptAttentionPolicy();
testDerivedMissingWarningsAndOptionalGateBlocking();
testRetentionGradeAssignment();
testBuildDateReviewManifestRetentionFields();
testTrackedManifestPathConvention();

console.log('Artifact manifest tests passed.');
