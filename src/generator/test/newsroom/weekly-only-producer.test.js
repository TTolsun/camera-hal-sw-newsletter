const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { section } = require('../../../shared/test/helpers/quality-builders');
const { writeJson, writeText } = require('../../../shared/test/helpers/fs');
const transaction = require('../../publish/weekly-publication-transaction');
const { unexposeFailedPublication } = require('../../publish/public-state-reconciliation');

const decisionPath = require.resolve('../../publish/orchestrator-publish-decision');
const read = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

async function withProducer(t, run, { writerFailsAfterWrite = false } = {}) {
  const prefix = path.join(os.tmpdir(), 'weekly-only-producer-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => { assert.ok(path.resolve(root).startsWith(prefix)); fs.rmSync(root, { recursive: true, force: true }); });
  const previousCwd = process.cwd();
  const previousOwner = process.env.NEWSLETTER_PUBLICATION_RUN_KEY;
  const weeklyWriter = require('../../render/weekly-newsletter-output').writeWeeklyNewsletterArtifacts;
  const saved = [];
  function stub(modulePath, exports) {
    const key = require.resolve(modulePath);
    saved.push([key, require.cache[key]]);
    require.cache[key] = { id: key, filename: key, loaded: true, exports };
  }
  stub('../../publish/orchestrator-validate-runner', { runValidate: () => ({ ok: true, text: 'offline boundary stub' }) });
  stub('../../editor/weekly-merge', { buildWeeklyMergeResolver: () => ({}) });
  stub('../../editor/intro-letter', { buildIntroLetterGenerator: () => undefined, buildIntroLetterReviewer: () => undefined });
  stub('../../publish/orchestrator-terminal-contracts', {
    updateNewsletterData: () => { throw new Error('dated index writer must not be called'); },
    persistHeadlineStateArtifacts: () => ({ files: [], exposureCoverage: null })
  });
  stub('../../publish/orchestrator-artifact-writers', {
    writeCostReport: () => {},
    writeGenerationStatus: status => writeJson(path.join(root, 'articles/content/newsroom', status.date, 'generation-status.json'), status)
  });
  stub('../../render/weekly-newsletter-output', {
    writeWeeklyNewsletterArtifacts: async options => {
      const result = await weeklyWriter(options);
      if (writerFailsAfterWrite) throw new Error('synthetic failure after weekly write');
      return result;
    }
  });
  delete require.cache[decisionPath];
  process.chdir(root);
  let attempt = 0;
  try {
    const { decidePublishReadinessAndWriteStatus } = require(decisionPath);
    const publish = async (date, id = 'a') => {
      process.env.NEWSLETTER_PUBLICATION_RUN_KEY = 'synthetic:' + (++attempt);
      const newsroomDir = path.join(root, 'articles/content/newsroom', date);
      const editor = { date, title: '주간 카메라 소식', summary: '공식 카메라 변경의 검증 범위를 확인합니다.', briefing: ['검증 범위를 확인합니다.'],
        sections: [section({ headline: 'Camera article ' + id, url: 'https://example.com/' + id })], action_items: [], references: [] };
      writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
      const out = await decidePublishReadinessAndWriteStatus({ date, editor,
        factCheck: { status: 'PASS', must_fix: [], source_gap_count: 0 },
        qualityReport: { status: 'PASS', score: 95, threshold: 60, deductions: [] },
        shortlistReport: { underfilled: false, publish_ready: true, composition_mode: 'normal' },
        retryHistory: [], staleScrub: {}, newsroomDir,
        newsletterDir: path.join(root, 'articles/newsletters', date),
        newsletterMarkdown: '# dated must not be written', newsletterHtmlContent: '<html>dated must not be written</html>',
        mustFixCount: 0, todoFound: false, emptySourceSections: [],
        baseFiles: ['articles/content/newsroom/' + date + '/editor-draft.json']
      });
      assert.equal(out.generationStatusArtifact.public_output_lane, 'weekly');
      assert.equal(out.generationStatusArtifact.legacy_dated_output_enabled, false);
      assert.equal(out.files.some(file => file.startsWith('articles/newsletters/' + date + '/')), false);
      assert.equal(out.files.includes('articles/data/newsletters.json'), false);
      assert.equal(fs.existsSync(path.join(newsroomDir, 'editor-draft.json')), true);
      return out;
    };
    return await run({ root, publish });
  } finally {
    process.chdir(previousCwd);
    if (previousOwner === undefined) delete process.env.NEWSLETTER_PUBLICATION_RUN_KEY;
    else process.env.NEWSLETTER_PUBLICATION_RUN_KEY = previousOwner;
    delete require.cache[decisionPath];
    for (const [key, previous] of saved.reverse()) {
      if (previous) require.cache[key] = previous;
      else delete require.cache[key];
    }
  }
}

function assertNoDated(root, date) {
  assert.equal(fs.existsSync(path.join(root, 'articles/newsletters', date)), false);
}

function preserveLegacy(root, date = '2026-10-19') {
  const names = ['articles/newsletters/' + date + '/index.html', 'articles/newsletters/' + date + '/newsletter.md',
    'articles/en/newsletters/2026-W42/index.html', 'articles/en/newsletters/2026-W42/newsletter.md'];
  for (const name of names) writeText(path.join(root, name), 'Preserved public bytes: ' + name);
  writeJson(path.join(root, 'articles/data/newsletters.json'), [{ date, title: '보존 날짜 호', en: { html: 'en/newsletters/2026-W42/index.html', md: 'en/newsletters/2026-W42/newsletter.md' } }]);
  names.push('articles/data/newsletters.json');
  const before = names.map(name => fs.readFileSync(path.join(root, name)));
  return () => assert.deepEqual(names.map(name => fs.readFileSync(path.join(root, name))), before);
}

test('새 주 producer는 weekly 세 파일과 인덱스만 만들고 날짜 공개 폴더를 만들지 않는다', async t => {
  await withProducer(t, async ({ root, publish }) => {
    const checkLegacy = preserveLegacy(root, '2026-10-12');
    const out = await publish('2026-10-19');
    assert.equal(out.generationStatusArtifact.weekly_output_status, 'written');
    assert.equal(read(root, 'articles/newsletters/2026-W43/issue.json').sections.length, 1);
    assertNoDated(root, '2026-10-19');
    checkLegacy();
  });
});

test('같은 주 append와 중복 재실행은 dated 없이 기존 주간 기사를 누적하고 중복을 보존하지 않는다', async t => {
  await withProducer(t, async ({ root, publish }) => {
    const checkLegacy = preserveLegacy(root, '2026-10-12');
    await publish('2026-10-19', 'a');
    await publish('2026-10-22', 'b');
    const file = 'articles/newsletters/2026-W43/issue.json';
    assert.equal(read(root, file).sections.length, 2);
    const before = fs.readFileSync(path.join(root, file));
    await publish('2026-10-22', 'b');
    assert.equal(read(root, file).sections.length, 2);
    assert.deepEqual(fs.readFileSync(path.join(root, file)), before);
    assertNoDated(root, '2026-10-19'); assertNoDated(root, '2026-10-22');
    checkLegacy();
  });
});

for (const existingWeek of [false, true]) {
  test('실제 weekly writer 뒤 실패 rollback은 dated와 EN을 보존한다: existing=' + existingWeek, async t => {
    await withProducer(t, async ({ root, publish }) => {
      const date = '2026-10-19';
      const checkLegacy = preserveLegacy(root, existingWeek ? date : '2026-10-12');
      const weekDir = path.join(root, 'articles/newsletters/2026-W43');
      if (existingWeek) {
        // 기존 정상 주간 baseline 뒤 다음 실행의 실패를 주입한다.
        // canonical renderer로 baseline을 만든다. 실패 주입은 후속 producer에만 적용한다.
        const { buildWeeklyNewsletterPage } = require('../../render/weekly-newsletter-page');
        const page = buildWeeklyNewsletterPage({ date, coverage_week_key: '2026-W42', sections: [section({ headline: 'Earlier camera article', url: 'https://example.com/earlier' })], action_items: [], references: [] }, { date });
        for (const [name, content] of [['index.html', page.html], ['newsletter.md', page.markdown], ['issue.json', JSON.stringify(page.issue)]]) writeText(path.join(weekDir, name), content);
        writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), [{ weeklyKey: '2026-W43', date, title: 'Earlier', html: 'newsletters/2026-W43/index.html', md: 'newsletters/2026-W43/newsletter.md' }]);
      }
      const before = existingWeek ? ['index.html', 'newsletter.md', 'issue.json'].map(name => fs.readFileSync(path.join(weekDir, name))) : [];
      const out = await publish(date, 'new');
      assert.equal(out.generationStatusArtifact.weekly_output_status, 'failed');
      assert.equal(out.validateResult.ok, false);
      assert.match(out.generationStatusArtifact.weekly_output_failure_reason, /synthetic failure/);
      const result = unexposeFailedPublication(root, date, { status: out.generationStatusArtifact });
      assert.equal(result.error, '');
      if (existingWeek) assert.deepEqual(['index.html', 'newsletter.md', 'issue.json'].map(name => fs.readFileSync(path.join(weekDir, name))), before);
      else assert.equal(fs.existsSync(path.join(weekDir, 'issue.json')), false);
      if (!existingWeek) assertNoDated(root, date);
      assert.equal(read(root, '.tmp/weekly-publication/' + date + '.json').state, 'rolled_back');
      assert.equal(fs.existsSync(path.join(root, 'articles/content/newsroom', date, 'generation-status.json')), true);
      checkLegacy();
    }, { writerFailsAfterWrite: true });
  });
}

test('보존 dated 인덱스가 없는 새 주 producer도 dated 인덱스를 새로 만들지 않는다', async t => {
  await withProducer(t, async ({ root, publish }) => {
    const out = await publish('2026-10-19');
    assert.equal(out.generationStatusArtifact.weekly_output_status, 'written');
    assertNoDated(root, '2026-10-19');
    assert.equal(fs.existsSync(path.join(root, 'articles/data/newsletters.json')), false);
    assert.equal(read(root, 'articles/data/newsletters-weekly.json').length, 1);
  });
});

test('보존 dated 날짜를 명시해 재실행해도 그 HTML/MD와 인덱스 행을 덮어쓰지 않는다', async t => {
  await withProducer(t, async ({ root, publish }) => {
    const checkLegacy = preserveLegacy(root, '2026-10-19');
    const out = await publish('2026-10-19');
    assert.equal(out.generationStatusArtifact.weekly_output_status, 'written');
    checkLegacy();
  });
});
