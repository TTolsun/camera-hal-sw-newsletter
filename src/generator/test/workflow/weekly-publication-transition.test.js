const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { validateIndexedWeeklyNewsletters } = require('../../validate/validate-public-newsletter');
const { weeklyKeyForDate, weekBoundsForKey } = require('../../reporter/weekly-newsletter');
const { writeJson, writeText } = require('../../../shared/test/helpers/fs');

// #1315 preparation: exercise the existing weekly content gate without changing runtime wiring.
// Hand-authored synthetic content only; this is not a generated or golden publication fixture.
const MARKDOWN = [
  '# Camera SW 주간 소식',
  '',
  '## 1. 이번 주 핵심',
  '- Camera HAL 버퍼 반환 순서를 확인합니다.',
  '',
  '## 2. Camera HAL 버퍼 반환 순서 검토',
  '',
  '카메라 요청 종료 시 버퍼 반환 순서를 검토하는 제안입니다.',
  '',
  '프리뷰 스트림을 종료할 때 이미 전달한 버퍼가 모두 반환되는지 확인합니다.',
  '',
  '이 제안은 검토 중이며 Camera HAL에 반영된 기능으로 해석하지 않습니다.',
  '',
  '**출처**',
  '- [검토 근거](https://example.com/camera-buffer)',
  ''
].join('\n');
const HTML = '<!doctype html><html lang="ko"><body><h1>Camera HAL 버퍼 반환 순서 검토</h1><p>검토 중인 제안의 적용 조건을 확인합니다.</p></body></html>';

function testRoot(t) {
  const prefix = path.join(os.tmpdir(), 'weekly-transition-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(prefix));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

function stageWeekly(root, runDate, { markdown = MARKDOWN, html = HTML } = {}) {
  const weeklyKey = weeklyKeyForDate(runDate);
  const { weekStartDate } = weekBoundsForKey(weeklyKey);
  const coverageStart = new Date(`${weekStartDate}T00:00:00Z`);
  coverageStart.setUTCDate(coverageStart.getUTCDate() - 7);
  const coverageWeekKey = weeklyKeyForDate(coverageStart.toISOString().slice(0, 10));
  const htmlPath = `newsletters/${weeklyKey}/index.html`;
  const mdPath = `newsletters/${weeklyKey}/newsletter.md`;
  writeText(path.join(root, 'articles', htmlPath), html);
  writeText(path.join(root, 'articles', mdPath), markdown);
  const indexPath = path.join(root, 'articles', 'data', 'newsletters-weekly.json');
  const entries = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
  writeJson(indexPath, entries.concat({ weeklyKey, date: weekStartDate, coverage_week_key: coverageWeekKey, html: htmlPath, md: mdPath }));
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), runDate);
  return { weeklyKey, htmlPath: path.join(root, 'articles', htmlPath), mdPath: path.join(root, 'articles', mdPath), indexPath };
}

function assertNoDatedOutput(root, runDate) {
  assert.equal(fs.existsSync(path.join(root, 'articles', 'data', 'newsletters.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'newsletters', runDate)), false);
}

test('weekly content validation needs no dated index and leaves its inputs unchanged', t => {
  const root = testRoot(t);
  const runDate = '2026-10-19';
  const files = stageWeekly(root, runDate);
  const paths = [files.htmlPath, files.mdPath, files.indexPath, path.join(root, '.tmp', 'newsletter-date.txt')];
  const before = paths.map(file => fs.readFileSync(file));

  assert.deepEqual(validateIndexedWeeklyNewsletters({ rootDir: root }), { errors: [], warnings: [] });

  assert.deepEqual(paths.map(file => fs.readFileSync(file)), before);
  assertNoDatedOutput(root, runDate);
});

for (const runDate of ['2026-10-22', '2027-01-01']) {
  test(`the run-date file selects the strict publication week even when its index date differs (${runDate})`, t => {
    const root = testRoot(t);
    const files = stageWeekly(root, runDate, {
      html: HTML.replace('</body>', '<p>Review-only quality gate output</p></body>')
    });
    const entry = JSON.parse(fs.readFileSync(files.indexPath, 'utf8'))[0];
    assert.notEqual(entry.date, runDate);
    assert.notEqual(entry.coverage_week_key, files.weeklyKey);
    assert.equal(files.weeklyKey, runDate === '2027-01-01' ? '2026-W53' : '2026-W43');

    const result = validateIndexedWeeklyNewsletters({ rootDir: root });

    assert.ok(result.errors.some(error => error.startsWith(`weekly ${files.weeklyKey}:`) && /Review-only/i.test(error)), JSON.stringify(result));
    assert.deepEqual(result.warnings, []);
    assert.equal(result.errors.some(error => error.startsWith(`weekly ${entry.coverage_week_key}:`)), false);
    assertNoDatedOutput(root, runDate);
  });
}

test('an internal source URL is a hard failure without a dated index', t => {
  const root = testRoot(t);
  const { weeklyKey } = stageWeekly(root, '2026-10-19', {
    markdown: MARKDOWN.replace('https://example.com/camera-buffer', 'https://example.com/content/newsroom/2026-10-19/editor-draft.json')
  });

  const result = validateIndexedWeeklyNewsletters({ rootDir: root });

  assert.ok(result.errors.some(error => error.startsWith(`weekly ${weeklyKey}:`) && /internal_artifact_url/.test(error)), JSON.stringify(result));
  assert.deepEqual(result.warnings, []);
});

for (const field of ['htmlPath', 'mdPath']) {
  test(`a missing weekly ${field} fails without relying on a dated page`, t => {
    const root = testRoot(t);
    const files = stageWeekly(root, '2026-10-19');
    fs.unlinkSync(files[field]);

    const result = validateIndexedWeeklyNewsletters({ rootDir: root });

    assert.ok(result.errors.some(error => error.startsWith(`weekly ${files.weeklyKey}:`) && /files are missing/.test(error)), JSON.stringify(result));
    assert.deepEqual(result.warnings, []);
  });
}

test('an unchanged historical violation cannot demote a current weekly violation to a warning', t => {
  const root = testRoot(t);
  const broken = HTML.replace('</body>', '<p>Review-only quality gate output</p></body>');
  const historical = stageWeekly(root, '2026-10-12', { html: broken });
  const current = stageWeekly(root, '2026-10-19', { html: broken });

  const result = validateIndexedWeeklyNewsletters({ rootDir: root });

  assert.ok(result.errors.some(error => error.startsWith(`weekly ${current.weeklyKey}:`)), JSON.stringify(result));
  assert.equal(result.errors.some(error => error.startsWith(`weekly ${historical.weeklyKey}:`)), false);
  assert.ok(result.warnings.some(warning => warning.startsWith(`weekly ${historical.weeklyKey}:`)), JSON.stringify(result));
  assert.equal(result.warnings.some(warning => warning.startsWith(`weekly ${current.weeklyKey}:`)), false);
});


// #1315 runtime migration: exercise the complete CLI, not only the exported lane.
function runPublicCli(root, args = []) {
  const { spawnSync } = require('node:child_process');
  const cli = path.resolve(__dirname, '../../validate/validate-public-newsletter.js');
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8',
    env: { ...process.env, GITHUB_EVENT_NAME: '', GITHUB_BASE_REF: '', REQUIRE_PUBLIC_NEWSLETTER_CONTRACT: '' } });
}
function stageCli(t, date = '2026-10-22') {
  const root = testRoot(t);
  const files = stageWeekly(root, date);
  writeJson(path.join(root, 'articles/data/newsletters.json'), []);
  return { root, date, ...files };
}

for (const args of [[], ['--date', '2026-10-22']]) {
  test('complete public CLI validates a weekly-only run with args ' + JSON.stringify(args), t => {
    const { root, date } = stageCli(t);
    const result = runPublicCli(root, args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, 'articles/newsletters', date)), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'articles/data/newsletters.json'), 'utf8')), []);
  });
}

for (const missing of ['index', 'entry', 'markdown']) {
  test('complete public CLI fails closed for missing current weekly ' + missing, t => {
    const { root, indexPath, mdPath } = stageCli(t);
    if (missing === 'index') fs.unlinkSync(indexPath);
    if (missing === 'entry') writeJson(indexPath, []);
    if (missing === 'markdown') fs.unlinkSync(mdPath);
    const result = runPublicCli(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /newsletters-weekly|missing public newsletter index entry|files are missing/);
  });
}

test('explicit run-date validation reads weekly public JSON for leaked source snapshot state', t => {
  const { root, weeklyKey, date } = stageCli(t);
  writeJson(path.join(root, 'articles/newsletters', weeklyKey, 'issue.json'), {
    processed_source_event_ids: ['internal-event'], source: 'state/source-snapshots/camera.json'
  });
  const result = runPublicCli(root, ['--date', date]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /processed_source_event_ids|state\/source-snapshots/);
});

test('explicit run-date validation cannot hide a weekly defect behind intact dated files', t => {
  const { root, date, htmlPath } = stageCli(t);
  writeText(path.join(root, 'articles/newsletters', date, 'index.html'), HTML);
  writeText(path.join(root, 'articles/newsletters', date, 'newsletter.md'), MARKDOWN);
  writeJson(path.join(root, 'articles/data/newsletters.json'), [{ date,
    html: 'newsletters/' + date + '/index.html', md: 'newsletters/' + date + '/newsletter.md' }]);
  writeText(htmlPath, HTML.replace('</body>', '<p>Review-only quality gate output</p></body>'));
  const result = runPublicCli(root, ['--date', date]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Review-only/);
});

test('explicit archive validation preserves dated compatibility without a matching weekly entry', t => {
  const root = testRoot(t);
  const date = '2026-04-01';
  writeText(path.join(root, 'articles/newsletters', date, 'index.html'), HTML);
  writeText(path.join(root, 'articles/newsletters', date, 'newsletter.md'), MARKDOWN);
  writeJson(path.join(root, 'articles/data/newsletters.json'), [{ date,
    html: 'newsletters/' + date + '/index.html', md: 'newsletters/' + date + '/newsletter.md' }]);
  const result = runPublicCli(root, ['--date', date]);
  assert.equal(result.status, 0, result.stderr);
});

test('explicit weekly-only date validation requires its matching weekly entry', t => {
  const { root, date, indexPath } = stageCli(t);
  writeJson(indexPath, []);
  const result = runPublicCli(root, ['--date', date]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing publish week entry: 2026-W43/);
});

test('complete CLI keeps execution date and publication ISO year separate across New Year', t => {
  const { root, date, weeklyKey } = stageCli(t, '2027-01-01');
  assert.equal(weeklyKey, '2026-W53');
  const result = runPublicCli(root, ['--date', date]);
  assert.equal(result.status, 0, result.stderr);
});


test('an explicit current run cannot use a dated copy when its weekly entry is missing', t => {
  const { root, date, indexPath } = stageCli(t);
  writeJson(indexPath, []);
  writeText(path.join(root, 'articles/newsletters', date, 'index.html'), HTML);
  writeText(path.join(root, 'articles/newsletters', date, 'newsletter.md'), MARKDOWN);
  writeJson(path.join(root, 'articles/data/newsletters.json'), [{ date,
    html: 'newsletters/' + date + '/index.html', md: 'newsletters/' + date + '/newsletter.md' }]);
  const result = runPublicCli(root, ['--date', date]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing publish week entry: 2026-W43/);
});

for (const args of [[], ['--date', '2026-10-22']]) {
  test('complete public CLI rejects a current entry pointing at another week with args ' + JSON.stringify(args), t => {
    const { root, indexPath } = stageCli(t);
    writeText(path.join(root, 'articles/newsletters/2026-W42/index.html'), HTML);
    writeText(path.join(root, 'articles/newsletters/2026-W42/newsletter.md'), MARKDOWN);
    const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    entries[0].html = 'newsletters/2026-W42/index.html';
    entries[0].md = 'newsletters/2026-W42/newsletter.md';
    writeJson(indexPath, entries);
    const result = runPublicCli(root, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /index path mismatch/);
  });
}

test('complete public CLI rejects an invalid execution marker instead of losing its strict week', t => {
  const { root } = stageCli(t);
  writeText(path.join(root, '.tmp/newsletter-date.txt'), 'invalid-date');
  const result = runPublicCli(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid .tmp\/newsletter-date.txt execution date/);
});


// A minimal handwritten legacy article model locks role-aware input validation;
// its contract keys are required machine input, not prose to render to readers.
function cliRenderModel() {
  const url = 'https://example.com/legacy-source';
  return {
    date: '2026-10-19', weekly_key: '2026-W43', title: 'Camera proposal', summary: 'A bounded proposal.',
    watch_points: [], reference_articles: [],
    sections: [{ id: 'buffer', category: 'Legacy', headline: 'Legacy Camera article',
      action_items: ['Run Camera ITS smoke test for Legacy Source preview stream metadata.', 'Compare Legacy Source preview latency and frame-drop logs.'],
      sources: [{ title: 'Legacy Source', url }],
      public_article: {
        headline: 'Legacy Camera article', lead: 'Legacy article stays on the old public article contract.',
        body_paragraphs: ['Legacy body paragraph one explains source-backed context.', 'Legacy body paragraph two keeps the HAL interpretation bounded.'],
        camera_hal_takeaway: 'Legacy rendering remains compatible.',
        reader_checkpoints: ['Run Camera ITS smoke test for Legacy Source preview stream metadata.', 'Compare Legacy Source preview latency and frame-drop logs.'],
        source_links: [{ title: 'Legacy Source', url, source_role: 'primary' }]
      }
    }]
  };
}
function writeCliModel(root, model = cliRenderModel()) {
  const file = path.join(root, 'articles/newsletters/2026-W43/issue.json');
  writeJson(file, model);
  return file;
}

test('default CLI accepts renderer contract keys and ignores inactive legacy provenance as active prose', t => {
  const { root } = stageCli(t);
  const model = cliRenderModel();
  model.decision_metadata = { note: 'Synthetic provenance' };
  model.issue = { articles: [{ metadata: { legacySection: { public_article: { story_contract_version: 999 } } } }] };
  writeCliModel(root, model);
  const result = runPublicCli(root);
  assert.equal(result.status, 0, result.stderr);
});

for (const value of ['{broken', '{}']) {
  test('default CLI rejects malformed or missing active renderer structure: ' + value, t => {
    const { root } = stageCli(t);
    writeText(path.join(root, 'articles/newsletters/2026-W43/issue.json'), value);
    const result = runPublicCli(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /issue.json.*invalid render input|renderer sections/);
  });
}

for (const missing of ['fields', 'article']) {
  test('default CLI checks the current newsroom public article contract with missing ' + missing, t => {
    const { root, date } = stageCli(t);
    const model = cliRenderModel();
    if (missing === 'fields') model.sections[0].public_article = {};
    else delete model.sections[0].public_article;
    writeJson(path.join(root, 'articles/content/newsroom', date, 'editor-draft.json'), model);
    const result = runPublicCli(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /editor-draft.json.*public_article failed/);
  });
}

test('default CLI does not regrade an unchanged older newsroom directory', t => {
  const { root } = stageCli(t);
  const old = cliRenderModel();
  delete old.sections[0].public_article;
  writeJson(path.join(root, 'articles/content/newsroom/2026-10-19/editor-draft.json'), old);
  const result = runPublicCli(root);
  assert.equal(result.status, 0, result.stderr);
});

test('diagnostic-only draft defects stay outside public JSON input checks while exposed weekly defects still block', t => {
  const { root, date } = stageCli(t);
  writeCliModel(root);
  const draft = cliRenderModel();
  draft.sections[0].public_article = {};
  writeJson(path.join(root, 'articles/content/newsroom', date, 'editor-draft.json'), draft);
  writeJson(path.join(root, 'articles/content/newsroom', date, 'generation-status.json'), { date, public_output_expected: false });
  assert.equal(runPublicCli(root).status, 0);
  writeCliModel(root, draft);
  const invalid = runPublicCli(root);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /issue.json.*public_article failed/);
});

test('latest typed JSON is inspected without a run marker while unchanged older JSON stays outside the strict lane', t => {
  const { root, indexPath } = stageCli(t);
  fs.unlinkSync(path.join(root, '.tmp/newsletter-date.txt'));
  writeCliModel(root);
  const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  entries.push({ weeklyKey: '2026-W42', html: 'newsletters/2026-W42/index.html', md: 'newsletters/2026-W42/newsletter.md' });
  writeJson(indexPath, entries);
  writeText(path.join(root, 'articles/newsletters/2026-W42/index.html'), HTML);
  writeText(path.join(root, 'articles/newsletters/2026-W42/newsletter.md'), MARKDOWN);
  writeText(path.join(root, 'articles/newsletters/2026-W42/issue.json'), '{historical malformed source');
  assert.equal(runPublicCli(root).status, 0);
  writeText(path.join(root, 'articles/newsletters/2026-W43/issue.json'), '{current malformed source');
  assert.notEqual(runPublicCli(root).status, 0);
});

test('unknown weekly public JSON retains the reader-facing internal-field guard', t => {
  const { root } = stageCli(t);
  writeJson(path.join(root, 'articles/newsletters/2026-W43/export.json'), { source_links: [] });
  const result = runPublicCli(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /export.json.*source_links/);
});

test('translation inputs keep their display schema and enforce the exact source hash', t => {
  const { root } = stageCli(t);
  const file = writeCliModel(root);
  const { translationSourceHash } = require('../../render/apply-translation');
  const translation = {
    schemaVersion: 1, weekly_key: '2026-W43', source_hash: translationSourceHash(fs.readFileSync(file, 'utf8')),
    title: 'Camera proposal', summary: 'A bounded proposal.', watch_points: [], reference_articles: [],
    sections: [{ id: 'buffer', headline: 'Legacy Camera article', lead: 'Legacy article stays on the old public article contract.',
      body_markdown: 'Legacy body paragraph one explains source-backed context.\n\nLegacy body paragraph two keeps the HAL interpretation bounded.',
      why_it_matters: 'Legacy rendering remains compatible.' }]
  };
  writeJson(path.join(root, 'articles/newsletters/2026-W43/translation.en.json'), translation);
  assert.equal(runPublicCli(root).status, 0);
  translation.source_hash = 'sha256:' + '0'.repeat(64);
  writeJson(path.join(root, 'articles/newsletters/2026-W43/translation.en.json'), translation);
  const stale = runPublicCli(root);
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /Stale translation source_hash/);
});


test('default CLI rejects raw monitor state in an otherwise valid active renderer input', t => {
  const { root } = stageCli(t);
  const model = cliRenderModel();
  model.processed_source_event_ids = ['raw-event'];
  writeCliModel(root, model);
  const result = runPublicCli(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /raw source monitor state: processed_source_event_ids/);
});

test('active article prose is still checked when renderer metadata keys are allowed', t => {
  const { root } = stageCli(t);
  const model = cliRenderModel();
  model.sections[0].public_article.lead = 'Review-only quality gate output';
  writeCliModel(root, model);
  const result = runPublicCli(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /public_article failed/);
});

test('without a marker the default CLI checks changed newsroom inputs while leaving unchanged older inputs alone', t => {
  const { root, date } = stageCli(t);
  writeCliModel(root);
  fs.unlinkSync(path.join(root, '.tmp/newsletter-date.txt'));
  const old = cliRenderModel();
  old.sections[0].public_article = {};
  writeJson(path.join(root, 'articles/content/newsroom/2026-10-19/editor-draft.json'), old);
  const { execFileSync } = require('node:child_process');
  const git = args => execFileSync('git', ['-c', 'user.name=Public CLI test', '-c', 'user.email=public-cli@example.invalid', '-c', 'core.hooksPath=', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q']);
  git(['add', '.']);
  git(['commit', '-qm', 'baseline']);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  const draft = path.join(root, 'articles/content/newsroom', date, 'editor-draft.json');
  writeJson(draft, cliRenderModel());
  git(['add', '.']);
  git(['commit', '-qm', 'current render input']);
  const good = runPublicCli(root);
  assert.equal(good.status, 0, good.stderr);
  writeJson(draft, old);
  git(['add', '.']);
  git(['commit', '-qm', 'invalid current render input']);
  const invalid = runPublicCli(root);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /2026-10-22\/editor-draft.json.*public_article failed/);
  assert.doesNotMatch(invalid.stderr, /2026-10-19\/editor-draft.json.*public_article failed/);
});


for (const args of [[], ['--date', '2026-10-22']]) {
  test('weekly index metadata receives the public JSON contract with args ' + JSON.stringify(args), t => {
    const { root, indexPath } = stageCli(t);
    const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    entries[0].processed_evidence_ids = ['internal-evidence'];
    writeJson(indexPath, entries);
    const result = runPublicCli(root, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /processed_evidence_ids/);
  });
}
