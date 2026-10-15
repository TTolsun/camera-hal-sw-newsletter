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
