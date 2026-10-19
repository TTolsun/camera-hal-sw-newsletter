const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { buildWeeklyNewsletterPage } = require('../../render/weekly-newsletter-page');
const { weeklyNewsletterStructureStatus } = require('../../publish/public-structure');
const { writeJson, writeText } = require('../../../shared/test/helpers/fs');

const cli = path.resolve(__dirname, '../../validate/validate-site.js');
// Minimal hand-authored renderer inputs; not generated/golden publication samples.
function section(id) {
  const url = `https://example.com/camera-${id}`;
  return {
    category: 'Android Camera', headline: `Camera HAL 버퍼 반환 제안 ${id}`,
    sources: [{ title: '제안 근거', url }],
    public_article: {
      headline: `Camera HAL 버퍼 반환 제안 ${id}`,
      lead: '캡처 요청 종료 시 버퍼 반환 순서를 검토하는 제안입니다.',
      body_paragraphs: ['캡처 요청 종료 전에 전달된 버퍼가 모두 반환되는지 확인합니다.', '제안의 적용 범위는 요청 종료 경로이며 병합된 기능으로 해석하지 않습니다.'],
      camera_hal_takeaway: '스트림 종료 경로의 버퍼 반환 여부를 검토할 수 있습니다.',
      source_links: [{ title: '제안 근거', url, source_role: 'primary' }]
    }
  };
}

function stageIssue(root, weeklyKey = '2026-W43') {
  const page = buildWeeklyNewsletterPage({
    date: '2026-10-19', summary: '버퍼 반환 제안을 검토합니다.',
    tags: ['Android'], sections: [section(1), section(2)],
    references: [{ title: '참고 근거', url: 'https://example.com/reference' }]
  }, { weeklyKey });
  const dir = path.join(root, 'articles/newsletters', weeklyKey);
  writeJson(path.join(dir, 'issue.json'), page.issue);
  writeText(path.join(dir, 'index.html'), page.html);
  writeText(path.join(dir, 'newsletter.md'), page.markdown);
  const data = path.join(root, 'articles/data/newsletters-weekly.json');
  const entries = fs.existsSync(data) ? JSON.parse(fs.readFileSync(data, 'utf8')) : [];
  writeJson(data, entries.concat({ weeklyKey, date: page.weekStartDate, title: page.issue.title,
    summary: page.issue.summary, tags: page.issue.tags,
    html: `newsletters/${weeklyKey}/index.html`, md: `newsletters/${weeklyKey}/newsletter.md` }));
  return { dir, page };
}

function stage(t) {
  const prefix = path.join(os.tmpdir(), 'weekly-site-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => { assert.ok(path.resolve(root).startsWith(prefix)); fs.rmSync(root, { recursive: true, force: true }); });
  writeJson(path.join(root, 'articles/data/newsletters.json'), []);
  writeText(path.join(root, '.tmp/newsletter-date.txt'), '2026-10-19');
  writeText(path.join(root, 'index.html'), `<a href="archive.html">전체 아카이브 보기</a><div id="featured-card"></div><div id="latest-grid"></div><script src="assets/js/newsletter-archive.js"></script><script>function loadNewsletters(){fetch('data/newsletters-weekly.json');fetch('data/homepage-headline.json');}</script>`);
  const hooks = ['data-archive-status', 'data-archive-controls', 'data-topic-filter', 'data-sort-control', 'data-result-summary', 'data-archive-grid', 'data-archive-pagination', 'data-empty-state', 'data-error-state'];
  writeText(path.join(root, 'articles/archive.html'), `<body class="homepage" data-page="archive"><script src="assets/js/newsletter-archive.js"></script><script>fetch('data/newsletters-weekly.json')</script>${hooks.map(hook => `<div ${hook}></div>`).join('')}</body>`);
  const files = stageIssue(root);
  assert.equal(weeklyNewsletterStructureStatus(root, '2026-W43').ok, true, 'synthetic weekly content satisfies the existing lane');
  return { root, ...files };
}

function run(root) {
  return spawnSync(process.execPath, [cli], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_NAME: '', GITHUB_BASE_REF: '' } });
}

test('site validates a current synthetic weekly issue with no dated output', t => {
  const { root } = stage(t);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, 'articles/newsletters/2026-10-19')), false);
});

for (const name of ['newsletter.md', 'issue.json']) {
  test(`current weekly ${name} cannot be missing even without a dated entry`, t => {
    const { root, dir } = stage(t);
    fs.unlinkSync(path.join(dir, name));
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(`missing required public file: articles/newsletters/2026-W43/${name}`), result.stderr);
  });
}

test('invalid weekly issue JSON cannot silently bypass the selected-image contract', t => {
  const { root, dir } = stage(t);
  writeText(path.join(dir, 'issue.json'), '{broken');
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid articles\/newsletters\/2026-W43\/issue.json/);
});

test('weekly issue image binding is inspected rather than trusting valid rendered HTML', t => {
  const { root, dir, page } = stage(t);
  page.issue.sections[0].selectedImage = 'https://example.com/unbound.png';
  page.issue.sections[0].imageCandidates = [];
  writeJson(path.join(dir, 'issue.json'), page.issue);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /selectedImage is not in imageCandidates/);
});

test('weekly Markdown source URLs receive the content contract without a dated copy', t => {
  const { root, dir, page } = stage(t);
  writeText(path.join(dir, 'newsletter.md'), page.markdown.replace('https://example.com/camera-1', 'https://example.com/content/newsroom/2026-10-19/editor-draft.json'));
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /internal_artifact_url/);
});

test('weekly index tags must agree with the rendered issue tags', t => {
  const { root } = stage(t);
  const file = path.join(root, 'articles/data/newsletters-weekly.json');
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  entries[0].tags = ['Driver'];
  writeJson(file, entries);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTML issue tags.*newsletters-weekly.json tags/);
});

test('unchanged historical issue schemas stay outside the current strict weekly lane', t => {
  const { root } = stage(t);
  const old = stageIssue(root, '2026-W42');
  fs.unlinkSync(path.join(old.dir, 'issue.json'));
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('root homepage checks are independent of dated and weekly render invocations', t => {
  const { root } = stage(t);
  fs.unlinkSync(path.join(root, 'index.html'));
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /root index.html missing/);
});

for (const value of [null, {}]) {
  test('valid JSON without weekly sections cannot silently disable image binding: ' + JSON.stringify(value), t => {
    const { root, dir } = stage(t);
    writeJson(path.join(dir, 'issue.json'), value);
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /issue.json: sections must be an array/);
  });
}

test('weekly-only execution cannot bypass unresolved fact-check must_fix', t => {
  const { root } = stage(t);
  writeText(path.join(root, '.tmp/newsletter-date.txt'), '2026-10-22');
  writeJson(path.join(root, 'articles/content/newsroom/2026-10-22/fact-check-report.json'), {
    status: 'NEEDS_FIX', must_fix: ['출처와 본문의 날짜가 일치하지 않습니다.']
  });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /2026-10-22 has unresolved fact-check must_fix/);
});

test('a same-week execution checks its own facts instead of the first run anchor', t => {
  const { root } = stage(t);
  writeText(path.join(root, '.tmp/newsletter-date.txt'), '2026-10-22');
  const file = path.join(root, 'articles/data/newsletters-weekly.json');
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  entries[0].generation_anchor_date = '2026-10-19';
  writeJson(file, entries);
  writeJson(path.join(root, 'articles/content/newsroom/2026-10-19/fact-check-report.json'), {
    status: 'NEEDS_FIX', must_fix: ['이전 실행의 검토 항목']
  });
  writeJson(path.join(root, 'articles/content/newsroom/2026-10-22/fact-check-report.json'), { status: 'PASS', must_fix: [] });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});

test('diagnostic-only later execution does not make the previous published week a new fact target', t => {
  const { root } = stage(t);
  const { execFileSync } = require('node:child_process');
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git(['init']); git(['config', 'user.name', 'Synthetic test']); git(['config', 'user.email', 'synthetic@example.invalid']);
  git(['add', '.']); git(['commit', '-m', 'Stage previously approved weekly']);
  writeText(path.join(root, '.tmp/newsletter-date.txt'), '2026-10-22');
  writeJson(path.join(root, 'articles/content/newsroom/2026-10-22/fact-check-report.json'), {
    status: 'NEEDS_FIX', must_fix: ['발행하지 않은 초안의 검토 항목']
  });
  writeJson(path.join(root, 'articles/content/newsroom/2026-10-22/generation-status.json'), {
    date: '2026-10-22', public_output_expected: false
  });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});
