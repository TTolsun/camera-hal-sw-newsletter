const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const archive = require('../../../../articles/assets/js/newsletter-archive');
const { applyTranslation } = require('../../../generator/render/apply-translation');
const { buildHtml } = require('../../../generator/render/newsletter-renderer');
const root = path.resolve(__dirname, '../../../..');
const escaped = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

// The producer is owned by #1276. A checkout without that dependency must report
// this integration as pending rather than substitute a production stub.
let buildReaderBrief;
try {
  ({ buildReaderBrief } = require('../../../generator/render/reader-brief'));
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND' || !error.message.includes("'../../../generator/render/reader-brief'")) throw error;
}

function productionRoot(t) {
  const prefix = path.join(os.tmpdir(), 'homepage-production-');
  const dir = fs.mkdtempSync(prefix);
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(prefix));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function writeJson(dir, relative, value) {
  const file = path.join(dir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(dir, relative) {
  return JSON.parse(fs.readFileSync(path.join(dir, relative), 'utf8'));
}

function publishedInput(key) {
  return readJson(root, `articles/newsletters/${key}/issue.json`);
}

function indexEntry(dir, key) {
  return readJson(dir, 'articles/data/newsletters-weekly.json').find(item => item.weeklyKey === key);
}

const productionOptions = { skip: !buildReaderBrief && '#1276 production paths are not present in this checkout' };

test('actual weekly output serializes the W42 public projection consumed by homepage and article links', productionOptions, async t => {
  const { writeWeeklyNewsletterArtifacts } = require('../../../generator/render/weekly-newsletter-output');
  const dir = productionRoot(t);
  const editor = publishedInput('2026-W42');
  const result = await writeWeeklyNewsletterArtifacts({ root: dir, date: editor.date, editor });
  assert.equal(result.weeklyKey, '2026-W42');
  const entry = indexEntry(dir, result.weeklyKey);
  const issue = readJson(dir, 'articles/newsletters/2026-W42/issue.json');
  assert.equal(archive.readerBrief(entry), entry.reader_brief);
  assert.equal(entry.reader_brief.intro, issue.summary);
  assert.equal(entry.summary, issue.briefing.join('\n'), 'legacy summary remains a title list');
  assert.equal(Object.hasOwn(issue, 'reader_brief'), false);
  const home = archive.renderLatestIssue(entry);
  const html = fs.readFileSync(path.join(dir, 'articles', entry.html), 'utf8');
  for (const item of entry.reader_brief.items) {
    assert.ok(home.includes(`href="${escaped(item.href)}"`));
    assert.ok(html.includes(`id="${item.href.split('#')[1]}"`));
  }
  const firstSources = issue.sections[0].public_article.source_links;
  for (const source of firstSources) assert.ok(html.includes(escaped(source.url)));
  assert.doesNotMatch(archive.renderArchiveCard(entry), /<img/, 'W42 AOSP fallback must not borrow the Haiku image');
  const firstOutput = fs.readFileSync(path.join(dir, 'articles/newsletters/2026-W42/issue.json'), 'utf8');
  await writeWeeklyNewsletterArtifacts({ root: dir, date: editor.date, editor });
  assert.equal(fs.readFileSync(path.join(dir, 'articles/newsletters/2026-W42/issue.json'), 'utf8'), firstOutput);
});

test('actual English publication and weekly invalidation update homepage language and projection together', productionOptions, async t => {
  const { writeEnglishEditions } = require('../../../generator/render/english-edition');
  const { writeWeeklyNewsletterArtifacts } = require('../../../generator/render/weekly-newsletter-output');
  const dir = productionRoot(t);
  const key = '2026-W41';
  for (const name of ['issue.json', 'translation.en.json']) {
    const relative = `articles/newsletters/${key}/${name}`;
    fs.mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
    fs.copyFileSync(path.join(root, relative), path.join(dir, relative));
  }
  const original = indexEntry(root, key);
  writeJson(dir, 'articles/data/newsletters-weekly.json', [original]);
  writeEnglishEditions(dir, [key]);
  const translated = indexEntry(dir, key);
  assert.equal(archive.readerBrief(translated, 'en'), translated.en.reader_brief);
  const englishHome = archive.renderLatestIssue(translated, { locale: 'en', rootPath: '../' });
  const englishHtml = fs.readFileSync(path.join(dir, 'articles', translated.en.html), 'utf8');
  for (const item of translated.en.reader_brief.items) {
    assert.ok(englishHome.includes(`href="../${escaped(item.href)}"`));
    assert.ok(englishHtml.includes(`id="${item.href.split('#')[1]}"`));
  }
  assert.doesNotMatch(englishHome, /Korean only/);
  // The weekly producer changes the old render bytes (including the legacy summary).
  // Reuse of the old overlay must therefore follow the existing invalidation path.
  const source = publishedInput(key);
  await writeWeeklyNewsletterArtifacts({ root: dir, date: source.date, editor: source });
  const updated = indexEntry(dir, key);
  assert.equal(Object.hasOwn(updated, 'en'), false);
  assert.equal(fs.existsSync(path.join(dir, 'articles/en/newsletters', key, 'index.html')), false);
  assert.match(archive.renderLatestIssue(updated, { locale: 'en' }), /Korean only/);
  assert.equal(archive.readerBrief(updated, 'en'), null);
});

test('actual image repair preserves published prose and synchronizes the first item and legacy image', productionOptions, t => {
  const { syncWeeklyArticleImages } = require('../../../generator/render/weekly-newsletter-output');
  const { introLetterSourceHash } = require('../../../generator/editor/intro-letter');
  const dir = productionRoot(t);
  const key = '2026-W41';
  const issue = publishedInput(key);
  const originalSections = structuredClone(issue.sections);
  const first = originalSections[0];
  const realImage = first.resolvedImage?.url || first.resolvedImage?.src || first.selectedImage;
  assert.match(realImage, /^https:\/\//);
  const prose = JSON.stringify({ title: issue.title, summary: issue.summary, briefing: issue.briefing, sections: issue.sections.map(item => item.public_article) });
  const sourceHash = introLetterSourceHash(issue.sections);
  // A local stale-image probe; restore the actual resolver result of the same article.
  issue.sections[0].selectedImage = '../../assets/images/fallback/newsletter-default.svg';
  issue.sections[0].resolvedImage = { url: issue.sections[0].selectedImage, usedFallback: true };
  writeJson(dir, `articles/newsletters/${key}/issue.json`, issue);
  writeJson(dir, 'articles/data/newsletters-weekly.json', [indexEntry(root, key)]);
  const result = syncWeeklyArticleImages({ root: dir, date: issue.date, sections: originalSections });
  assert.equal(result.patchedSectionCount, 1);
  const repaired = readJson(dir, `articles/newsletters/${key}/issue.json`);
  assert.equal(JSON.stringify({ title: repaired.title, summary: repaired.summary, briefing: repaired.briefing, sections: repaired.sections.map(item => item.public_article) }), prose);
  assert.equal(introLetterSourceHash(repaired.sections), sourceHash);
  const entry = indexEntry(dir, key);
  assert.equal(entry.lead_article_image, realImage);
  assert.equal(entry.reader_brief.items[0].image.src, realImage);
  assert.ok(archive.renderArchiveCard(entry).includes(`src="${escaped(realImage)}"`));
});

for (const [weeklyKey, locale] of [['2026-W42', 'ko'], ['2026-W41', 'en']]) {
  test(`published ${weeklyKey} ${locale}: real builder output links homepage cards to rendered and committed anchors`, {
    skip: !buildReaderBrief && '#1276 reader-brief producer is not present in this checkout'
  }, () => {
    const sourceDir = path.join(root, 'articles/newsletters', weeklyKey);
    const sourceText = fs.readFileSync(path.join(sourceDir, 'issue.json'), 'utf8');
    let issue = JSON.parse(sourceText);
    if (locale === 'en') {
      issue = applyTranslation(issue, JSON.parse(fs.readFileSync(path.join(sourceDir, 'translation.en.json'), 'utf8')), { sourceText });
    }
    const prefix = locale === 'en' ? 'en/' : '';
    const issueHref = `${prefix}newsletters/${weeklyKey}/index.html`;
    const before = JSON.stringify(issue);
    const brief = buildReaderBrief(issue, { locale, issueHref });
    const entry = JSON.parse(fs.readFileSync(path.join(root, 'articles/data/newsletters-weekly.json'), 'utf8')).find(item => item.weeklyKey === weeklyKey);
    if (locale === 'en') entry.en = { ...entry.en, reader_brief: brief };
    else entry.reader_brief = brief;
    assert.equal(archive.readerBrief(entry, locale), brief, 'consumer must accept the real producer shape');
    assert.equal(brief.intro, issue.summary);
    assert.equal(brief.items.length, issue.sections.length);
    const home = archive.renderLatestIssue(entry, { locale });
    const card = archive.renderArchiveCard(entry, { locale });
    const rendered = buildHtml(issue, { locale });
    const committed = fs.readFileSync(path.join(root, 'articles', issueHref), 'utf8');
    for (const item of brief.items) {
      const anchor = item.href.split('#')[1];
      assert.ok(rendered.includes(`id="${anchor}"`), item.href);
      assert.ok(committed.includes(`id="${anchor}"`), `committed anchor: ${item.href}`);
      assert.ok(home.includes(`href="${escaped(item.href)}"`), `homepage anchor: ${item.href}`);
    }
    const first = brief.items[0];
    assert.ok(card.includes(escaped(first.headline)));
    assert.ok(home.includes(escaped(first.lead)));
    assert.ok(home.includes(escaped(first.takeaway)));
    if (!first.image || first.image.is_fallback) {
      assert.doesNotMatch(card, /<img/);
      assert.doesNotMatch(home, /<img/);
    } else {
      assert.ok(card.includes(`src="${escaped(first.image.src)}"`));
    }
    assert.equal(JSON.stringify(issue), before, 'producer and consumer must preserve the published issue');
  });
}
