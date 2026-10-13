const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const archive = require('../../../../articles/assets/js/newsletter-archive');
const { applyTranslation } = require('../../../generator/render/apply-translation');
const { buildHtml } = require('../../../generator/render/newsletter-renderer');

// The producer is owned by #1276. A checkout without that dependency must report
// this integration as pending rather than substitute a production stub.
let buildReaderBrief;
try {
  ({ buildReaderBrief } = require('../../../generator/render/reader-brief'));
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND' || !error.message.includes("'../../../generator/render/reader-brief'")) throw error;
}

const root = path.resolve(__dirname, '../../../..');
const escaped = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

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
