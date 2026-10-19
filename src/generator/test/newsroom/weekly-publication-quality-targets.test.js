const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { resolveTargetItems, collectPublicationQualityAnnotations } = require('../../publish/annotate-publication-quality');

function write(root, name, value) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
}

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-annotation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'articles/data/newsletters-weekly.json', [{ weeklyKey: '2026-W43', date: '2026-10-19', html: 'newsletters/2026-W43/index.html', md: 'newsletters/2026-W43/newsletter.md' }]);
  write(root, 'articles/newsletters/2026-W43/issue.json', { weekly_key: '2026-W43', generation_anchor_date: '2026-10-19', coverage_week_key: '2026-W42' });
  return root;
}

test('explicit weekly-only annotation targets actual execution rather than week start or coverage', t => {
  const root = setup(t);
  const targets = resolveTargetItems(root, { dates: ['2026-10-22'] });
  assert.equal(targets[0].date, '2026-10-22');
  assert.equal(targets[0].publication_week_key, '2026-W43');
});

test('latest annotation selects weekly rather than stale dated index and keeps later run identity', t => {
  const root = setup(t);
  write(root, 'articles/data/newsletters.json', [{ date: '2026-10-15' }]);
  write(root, 'articles/content/newsroom/2026-10-22/generation-status.json', { public_output_expected: true });
  write(root, 'articles/content/newsroom/2026-10-23/generation-status.json', { public_output_expected: false });
  const targets = resolveTargetItems(root, { latest: true, targetDates: new Set() });
  assert.deepEqual(targets.map(item => item.date), ['2026-10-22']);
});

test('current marker prevents falling back to older weekly or a preserved same-date archive', t => {
  const root = setup(t);
  write(root, '.tmp/newsletter-date.txt', '2026-10-26');
  write(root, 'articles/data/newsletters.json', [{ date: '2026-10-26' }]);
  assert.throws(() => resolveTargetItems(root, { latest: true }), /2026-10-26/);
});

test('changed execution dates win over latest and retain two executions in the same week', t => {
  const root = setup(t);
  const targets = resolveTargetItems(root, { latest: true, targetDates: new Set(['2026-10-19', '2026-10-22']) });
  assert.deepEqual(targets.map(item => item.date), ['2026-10-19', '2026-10-22']);
});

test('weekly-only annotations expose actual-run missing quality and fact-check reports', t => {
  const root = setup(t);
  const result = collectPublicationQualityAnnotations({ root, parsedOptions: { dates: ['2026-10-22'] } });
  assert.deepEqual(result.targetDates, ['2026-10-22']);
  for (const title of ['Missing quality report', 'Missing fact-check report', 'Missing generation status']) {
    const annotation = result.annotations.find(item => item.title === title);
    assert.equal(annotation.level, 'error');
    assert.match(annotation.file, /newsroom\/2026-10-22\//);
  }
});

for (const defect of ['malformed index', 'wrong public route', 'missing issue', 'wrong issue identity', 'missing run identity', 'invalid marker']) {
  test('weekly annotation fails closed on ' + defect, t => {
    const root = setup(t);
    const indexPath = 'articles/data/newsletters-weekly.json';
    const issuePath = 'articles/newsletters/2026-W43/issue.json';
    if (defect === 'malformed index') write(root, indexPath, {});
    if (defect === 'wrong public route') write(root, indexPath, [{ weeklyKey: '2026-W43', date: '2026-10-19', html: 'newsletters/2026-10-19/index.html' }]);
    if (defect === 'missing issue') fs.unlinkSync(path.join(root, issuePath));
    if (defect === 'wrong issue identity') write(root, issuePath, { weekly_key: '2026-W42', generation_anchor_date: '2026-10-19' });
    if (defect === 'missing run identity') write(root, issuePath, { weekly_key: '2026-W43' });
    if (defect === 'invalid marker') write(root, '.tmp/newsletter-date.txt', '2026-W43');
    assert.throws(() => resolveTargetItems(root, { latest: true, targetDates: new Set() }), /array|Invalid|Missing|mismatched/);
  });
}

test('changed weekly artifacts are not hidden by an unrelated changed dated artifact', t => {
  const root = setup(t);
  write(root, 'articles/data/newsletters.json', [{ date: '2026-10-15' }]);
  const targets = resolveTargetItems(root, { latest: true, targetDates: new Set(['2026-10-15']), weeklyKeys: new Set(['2026-W43']) });
  assert.deepEqual(targets.map(item => item.date), ['2026-10-15', '2026-10-19']);
});

test('weekly change without any dated newsroom diff still selects its public run reports', t => {
  const root = setup(t);
  const targets = resolveTargetItems(root, { targetDates: new Set(), weeklyKeys: new Set(['2026-W43']) });
  assert.deepEqual(targets.map(item => item.date), ['2026-10-19']);
  assert.throws(() => resolveTargetItems(root, { latest: true, targetDates: new Set(), weeklyKeys: new Set(['2026-W44']) }), /Missing weekly annotation entry/);
});

test('all-mode preserves dated archives and includes weekly-only publication targets', t => {
  const root = setup(t);
  write(root, 'articles/data/newsletters.json', [{ date: '2026-10-15' }]);
  const targets = resolveTargetItems(root, { all: true });
  assert.deepEqual(targets.map(item => item.date), ['2026-10-15', '2026-10-19']);
});
