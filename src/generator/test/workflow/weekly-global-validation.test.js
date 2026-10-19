const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { validateNewsletterIndexes } = require('../../quality/rendered-issue-structure');
const { writeJson, writeText } = require('../../../shared/test/helpers/fs');

const siteCli = path.resolve(__dirname, '../../validate/validate-site.js');
const localizationCli = path.resolve(__dirname, '../../validate/validate-localization.js');
const ENGLISH = 'This camera pipeline change requires developers to inspect the exact buffer lifetime and request completion sequence before changing their implementation because the current stream configuration can retain pending buffers after the session is closed.';

function stage(t, keys = ['2026-W43']) {
  const prefix = path.join(os.tmpdir(), 'weekly-global-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(prefix));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const entries = keys.map(weeklyKey => ({
    weeklyKey,
    date: weeklyKey === '2026-W43' ? '2026-10-19' : '2026-10-12',
    title: '카메라 소식',
    summary: '카메라 버퍼 변경을 살펴봅니다.',
    html: `newsletters/${weeklyKey}/index.html`,
    md: `newsletters/${weeklyKey}/newsletter.md`,
    tags: []
  }));
  writeJson(path.join(root, 'articles/data/newsletters.json'), []);
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), entries);
  writeJson(path.join(root, 'src/shared/data/news-sources.json'), { sources: [] });
  for (const entry of entries) {
    writeText(path.join(root, 'articles', entry.md), '# 카메라 소식\n\n버퍼 반환 순서를 검토하는 제안입니다.\n');
    writeText(path.join(root, 'articles', entry.html), '<html lang="ko"><body><p>버퍼 반환 순서를 검토하는 제안입니다.</p></body></html>');
  }
  return { root, entries };
}

function run(cli, root) {
  return spawnSync(process.execPath, [cli], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_EVENT_NAME: '', GITHUB_BASE_REF: '' }
  });
}

test('public indexes are validated without a dated entry or any rendered article', t => {
  const { root, entries } = stage(t);
  assert.deepEqual(validateNewsletterIndexes(root), []);
  entries[0].public_contract_version = 'unsupported-version';
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), entries);
  assert.ok(validateNewsletterIndexes(root).some(error => /newsletters-weekly.*unsupported public_contract_version/.test(error)));
});

test('site CLI checks the weekly index even when the dated archive is empty', t => {
  const { root, entries } = stage(t);
  delete entries[0].tags;
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), entries);
  const result = run(siteCli, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /articles\/data\/newsletters-weekly\.json entry 0 is missing "tags"/);
});

test('missing and malformed weekly indexes cannot disappear behind an empty dated archive', t => {
  const { root } = stage(t);
  const file = path.join(root, 'articles/data/newsletters-weekly.json');
  fs.unlinkSync(file);
  assert.ok(validateNewsletterIndexes(root).some(error => /Missing articles\/data\/newsletters-weekly/.test(error)));
  writeText(file, '{broken');
  assert.ok(validateNewsletterIndexes(root).some(error => /Invalid JSON in articles\/data\/newsletters-weekly/.test(error)));
});

test('Korean weekly prose passes localization with an empty dated archive', t => {
  const { root } = stage(t);
  const result = run(localizationCli, root);
  assert.equal(result.status, 0, result.stderr);
});

for (const format of ['md', 'html']) {
  test(`localization rejects English prose in the latest weekly ${format} without a dated entry`, t => {
    const { root, entries } = stage(t);
    const file = path.join(root, 'articles', entries[0][format]);
    writeText(file, format === 'html' ? `<html><body><p>${ENGLISH}</p></body></html>` : ENGLISH);
    const result = run(localizationCli, root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /newsletters\/2026-W43/);
    assert.match(result.stderr, /긴 영어 prose/);
  });
}

test('localization selects the latest weekly key even when its index order is reversed', t => {
  const { root, entries } = stage(t, ['2026-W42', '2026-W43']);
  writeText(path.join(root, 'articles', entries[1].md), ENGLISH);
  const result = run(localizationCli, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /newsletters\/2026-W43/);
});

test('an older changed publish week is localized independently of the newest weekly key', t => {
  const { root, entries } = stage(t, ['2026-W43', '2026-W42']);
  writeText(path.join(root, 'articles', entries[1].md), ENGLISH);
  assert.equal(run(localizationCli, root).status, 0, 'unchanged older prose keeps the existing scope');
  writeText(path.join(root, '.tmp/newsletter-date.txt'), '2026-10-12');
  const result = run(localizationCli, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /newsletters\/2026-W42/);
});

test('latest dated prose retains localization checks through the public asset resolver', t => {
  const { root } = stage(t, []);
  const entry = { date: '2026-10-19', title: '카메라 소식', summary: '카메라 버퍼를 확인합니다.', tags: [], md: 'newsletters/2026-10-19/newsletter.md' };
  writeJson(path.join(root, 'articles/data/newsletters.json'), [entry]);
  writeText(path.join(root, 'articles', entry.md), ENGLISH);
  const result = run(localizationCli, root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /newsletters\/2026-10-19/);
  assert.match(result.stderr, /긴 영어 prose/);
});
