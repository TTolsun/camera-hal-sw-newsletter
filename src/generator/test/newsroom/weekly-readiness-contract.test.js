const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildHtml, buildMarkdown } = require('../../render/newsletter-renderer');
const { validSections } = require('../../../shared/test/helpers/quality-builders');
const { writeJson, writeText } = require('../../../shared/test/helpers/fs');
const { weeklyKeyForDate, weekBoundsForKey } = require('../../reporter/weekly-newsletter');
const { buildGenerationStatus } = require('../../publish/orchestrator-status-builders');
const { executionPublicStructureStatus, publicationTarget } = require('../../publish/public-structure');
const { resolveReviewableArtifacts } = require('../../publish/resolve-reviewable-artifacts');
const { classifyLatestPublicState, reconcilePublicState } = require('../../publish/public-state-reconciliation');
const { buildReviewArtifactInventory } = require('../../publish/review-artifact-inventory');
const { buildManifest } = require('../../publish/write-artifact-manifest');
const { renderPublicNewsletterReadiness } = require('../../publish/pr-body-readiness-sections');

function stage(t, runDate = '2026-10-22') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-readiness-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const key = weeklyKeyForDate(runDate);
  const week = weekBoundsForKey(key);
  const issue = {
    date: week.weekStartDate, weekly_key: key, generation_anchor_date: runDate,
    coverage_week_key: '2026-W42', summary: '주간 카메라 호환성 검토입니다.',
    briefing: ['CameraX 호환성 검증 범위를 확인합니다.'], sections: validSections(1),
    action_items: ['Camera ITS 검증 범위를 확인합니다.'], references: []
  };
  const dir = path.join(root, 'articles/newsletters', key);
  writeText(path.join(dir, 'index.html'), buildHtml(issue));
  writeText(path.join(dir, 'newsletter.md'), buildMarkdown(issue));
  writeJson(path.join(dir, 'issue.json'), issue);
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), [{ weeklyKey: key, date: week.weekStartDate, title: '주간 카메라 소식', summary: issue.summary, html: 'newsletters/' + key + '/index.html', md: 'newsletters/' + key + '/newsletter.md', tags: [] }]);
  writeJson(path.join(root, 'articles/data/newsletters.json'), []);
  writeText(path.join(root, 'index.html'), '<div id="featured-card"></div><div id="latest-grid"></div><script>async function loadNewsletters(){ await fetch("data/newsletters-weekly.json"); } loadNewsletters();</script>');
  const status = {
    date: runDate, public_output_lane: 'weekly', status: 'PASS', public_output_expected: true,
    weekly_output_status: 'written', final_publish_ready: false, review_gate_passed: true, editor_review_required: true
  };
  writeJson(path.join(root, 'articles/content/newsroom', runDate, 'generation-status.json'), status);
  writeJson(path.join(root, '.tmp/newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp/newsletter-date.txt'), runDate);
  const changedArtifacts = ['articles/content/newsroom/' + runDate + '/generation-status.json'];
  return { root, date: runDate, key, dir, issue, status, changedArtifacts };
}

test('new generation statuses always declare the weekly lane, even on early failure', () => {
  for (const status of ['STARTED', 'FAILED', 'PASS']) {
    const actual = buildGenerationStatus({ date: '2026-10-22', status, extra: { public_output_lane: 'daily', legacy_dated_output_enabled: false } });
    assert.equal(actual.public_output_lane, 'weekly');
    assert.equal(actual.legacy_dated_output_enabled, true);
  }
  assert.throws(() => publicationTarget('2026-10-22', { public_output_lane: 'unknown' }), /Unsupported/);
});

test('weekly-only readiness accepts a same-week no-op public rerun and lists the correct review files', t => {
  const data = stage(t);
  const structure = executionPublicStructureStatus(data.root, data.date, data.status);
  assert.equal(structure.ok, true, structure.errors.join('\n'));
  const resolved = resolveReviewableArtifacts(data);
  assert.equal(resolved.publicNewsletterReady, true, resolved.publicNewsletterReason);
  assert.equal(resolved.reviewPublicationReady, true);
  assert.equal(resolved.homepageVisibleAfterMerge, true);
  assert.equal(resolved.requiredPublicArtifacts.length, 4);
  assert.ok(resolved.requiredPublicArtifacts.every(file => !file.includes('/' + data.date + '/')));
  assert.equal(fs.existsSync(path.join(data.root, 'articles/newsletters', data.date)), false);
  assert.match(renderPublicNewsletterReadiness(data.root, data.date, resolved), /newsletters\/2026-W43\/issue.json/);
  assert.equal(classifyLatestPublicState({ ...data, status: { ...data.status, public_newsletter_ready: true, review_publication_ready: true } }), 'REVIEW_ONLY_PUBLIC_CREATED');
});

for (const defect of ['missing html', 'empty markdown', 'missing issue', 'wrong issue key', 'missing weekly entry', 'wrong weekly route', 'broken home', 'invalid dated index', 'invalid weekly index']) {
  test('weekly-only readiness rejects ' + defect + ' with stale ready flags', t => {
    const data = stage(t);
    if (defect === 'missing html') fs.unlinkSync(path.join(data.dir, 'index.html'));
    if (defect === 'empty markdown') writeText(path.join(data.dir, 'newsletter.md'), ' ');
    if (defect === 'missing issue') fs.unlinkSync(path.join(data.dir, 'issue.json'));
    if (defect === 'wrong issue key') writeJson(path.join(data.dir, 'issue.json'), { ...data.issue, weekly_key: '2026-W42' });
    if (defect === 'missing weekly entry') writeJson(path.join(data.root, 'articles/data/newsletters-weekly.json'), []);
    if (defect === 'wrong weekly route') writeJson(path.join(data.root, 'articles/data/newsletters-weekly.json'), [{ weeklyKey: data.key, html: 'newsletters/2026-W42/index.html' }]);
    if (defect === 'broken home') writeText(path.join(data.root, 'index.html'), '<p>broken</p>');
    if (defect === 'invalid dated index') writeJson(path.join(data.root, 'articles/data/newsletters.json'), {});
    if (defect === 'invalid weekly index') writeJson(path.join(data.root, 'articles/data/newsletters-weekly.json'), {});
    data.status = { ...data.status, final_publish_ready: true, normal_public_ready: true, automatic_publish_ready: true, public_artifact_ready: true, fallback_public_ready: true, homepage_visibility: 'normal' };
    const resolved = resolveReviewableArtifacts(data);
    assert.equal(resolved.publicNewsletterReady, false);
    for (const field of ['hasAiPublishReady', 'normalPublicReady', 'automaticPublishReady', 'publicArtifactReady', 'fallbackPublicReady', 'homepageVisibleAfterMerge']) assert.equal(resolved[field], false, field);
    assert.equal(resolved.homepageVisibility, 'hidden');
  });
}

for (const patch of [{ public_output_expected: false, weekly_output_status: 'not_attempted' }, { weekly_output_status: 'failed' }]) {
  test('a prior valid weekly cannot hide the current execution outcome ' + JSON.stringify(patch), t => {
    const data = stage(t);
    data.status = { ...data.status, ...patch };
    const resolved = resolveReviewableArtifacts(data);
    assert.equal(resolved.publicNewsletterReady, false);
    assert.equal(resolved.homepageVisibleAfterMerge, false);
  });
}

test('weekly review inventory requires four weekly artifacts and scans newly added weekly files', t => {
  const data = stage(t);
  writeText(path.join(data.dir, 'new-review-note.md'), 'unclassified weekly review note');
  const inventory = buildReviewArtifactInventory({ ...data, runContext: { publicOutputExpected: true } });
  const required = inventory.review_artifacts.filter(item => item.group === 'public_output' && item.requiredActive);
  assert.equal(required.filter(item => item.role.startsWith('weekly_')).length, 4);
  assert.equal(required.some(item => item.path.includes('/' + data.date + '/')), false);
  assert.ok(inventory.review_artifacts.some(item => item.path.endsWith('/new-review-note.md') && item.review_attention_required));
  fs.unlinkSync(path.join(data.dir, 'issue.json'));
  const broken = buildReviewArtifactInventory({ ...data, runContext: { publicOutputExpected: true } });
  const missing = broken.missingRequired.find(item => item.role === 'weekly_public_issue');
  assert.equal(missing.review_blocking, true);
  const manifest = buildManifest(data.root, data.date);
  assert.ok(manifest.missing_critical_files.includes('articles/newsletters/' + data.key + '/issue.json'));
  assert.equal(manifest.missing_critical_files.some(file => file.includes('/' + data.date + '/index.html')), false);
});

test('weekly execution structure uses publication week rather than coverage at the ISO year boundary', t => {
  const data = stage(t, '2027-01-01');
  assert.equal(data.key, '2026-W53');
  assert.equal(resolveReviewableArtifacts(data).publicNewsletterReady, true);
});

test('weekly-only reconciliation creates public state without dated archive provenance or index additions', t => {
  const data = stage(t);
  const before = fs.readFileSync(path.join(data.root, 'articles/data/newsletters.json'), 'utf8');
  const result = reconcilePublicState({ ...data, status: { ...data.status, legacy_dated_output_enabled: false, public_newsletter_ready: true, review_publication_ready: true }, write: true });
  assert.equal(result.publicState, 'REVIEW_ONLY_PUBLIC_CREATED');
  assert.equal(fs.readFileSync(path.join(data.root, 'articles/data/newsletters.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(data.root, 'articles/content/audit/historical-archive-status.json')), false);
});

test('failed weekly-only reconciliation keeps a preserved same-date archive entry unchanged', t => {
  const data = stage(t);
  const indexPath = path.join(data.root, 'articles/data/newsletters.json');
  const datedEntry = { date: data.date, title: 'Preserved archive', summary: 'Preserved archive', html: 'newsletters/' + data.date + '/index.html', md: 'newsletters/' + data.date + '/newsletter.md', tags: [] };
  writeJson(indexPath, [datedEntry]);
  const before = fs.readFileSync(indexPath, 'utf8');
  const failed = { ...data.status, legacy_dated_output_enabled: false, weekly_output_status: 'failed', final_publish_ready: true, public_newsletter_ready: true };
  const result = reconcilePublicState({ ...data, status: failed, write: true });
  assert.equal(result.publicState, 'DIAGNOSTICS_ONLY');
  assert.equal(result.statusPatch.public_newsletter_ready, false);
  assert.equal(fs.readFileSync(indexPath, 'utf8'), before);
});

for (const defect of ['different status date', 'missing canonical status', 'different canonical date', 'unfinished canonical write']) {
  test('same-week old successful status cannot prove the current execution: ' + defect, t => {
    const data = stage(t);
    const canonicalPath = path.join(data.root, 'articles/content/newsroom', data.date, 'generation-status.json');
    if (defect === 'different status date') data.status = { ...data.status, date: '2026-10-19', final_publish_ready: true };
    if (defect === 'missing canonical status') fs.unlinkSync(canonicalPath);
    if (defect === 'different canonical date') writeJson(canonicalPath, { ...data.status, date: '2026-10-19' });
    if (defect === 'unfinished canonical write') writeJson(canonicalPath, { ...data.status, weekly_output_status: 'failed' });
    const resolved = resolveReviewableArtifacts(data);
    assert.equal(resolved.publicNewsletterReady, false);
    assert.equal(resolved.homepageVisibleAfterMerge, false);
    assert.equal(resolved.hasAiPublishReady, false);
  });
}

test('default review inventory derives required weekly output from the canonical run status', t => {
  const data = stage(t);
  fs.unlinkSync(path.join(data.dir, 'newsletter.md'));
  const inventory = buildReviewArtifactInventory(data);
  assert.equal(inventory.publicOutputLane, 'weekly');
  assert.ok(inventory.missingRequired.some(item => item.role === 'weekly_public_markdown' && item.review_blocking));
});

test('valid dated retention cannot authorize a failed weekly execution or be reported as weekly approval', t => {
  const data = stage(t);
  const paths = ['articles/newsletters/' + data.date + '/index.html', 'articles/newsletters/' + data.date + '/newsletter.md'];
  for (const file of paths) writeText(path.join(data.root, file), 'preserved archive');
  writeJson(path.join(data.root, 'articles/content/newsroom', data.date, 'public-retention.json'), {
    retain_existing_public: true, date: data.date, scope: 'same_date_diagnostics_only',
    reason: 'Retain the dated archive', approved_by: 'editor', approved_at: data.date,
    retained_public_artifacts: paths
  });
  const result = reconcilePublicState({ ...data, status: { ...data.status, public_output_expected: false, weekly_output_status: 'failed', diagnostics_only: true }, write: false });
  assert.equal(result.publicState, 'DIAGNOSTICS_ONLY');
  assert.equal(result.retention.valid, false);
  assert.match(result.retention.error, /does not authorize weekly/);
  assert.equal(result.statusPatch.retention_valid, false);
});
