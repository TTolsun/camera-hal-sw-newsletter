'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildReaderBrief } = require('../render/reader-brief');
const { applyTranslation } = require('../render/apply-translation');
const { snapshot } = require('../render/archive-publication');

// Refresh only serialized public projections. Source prose, overlay hashes and index identity,
// ordering, dates, summaries, media fields and existing issue-level tags remain untouched.
function refreshReaderBriefs({ root = process.cwd(), write = false } = {}) {
  const indexPath = path.join(root, 'articles/data/newsletters-weekly.json');
  const original = fs.readFileSync(indexPath, 'utf8');
  const entries = JSON.parse(original);
  const pages = [];
  for (const entry of entries) {
    const dir = path.join(root, 'articles/newsletters', entry.weeklyKey);
    const sourceText = fs.readFileSync(path.join(dir, 'issue.json'), 'utf8');
    const source = JSON.parse(sourceText);
    for (const locale of ['ko', 'en']) {
      if (locale === 'en' && !entry.en) continue;
      const issue = locale === 'en' ? applyTranslation(source, JSON.parse(fs.readFileSync(path.join(dir, 'translation.en.json'), 'utf8')), { sourceText }) : source;
      const issueHref = `${locale === 'en' ? 'en/' : ''}newsletters/${entry.weeklyKey}/index.html`;
      const brief = buildReaderBrief(issue, { locale, issueHref });
      const html = fs.readFileSync(path.join(root, 'articles', issueHref), 'utf8');
      const published = snapshot(html);
      if (brief.items.length !== published.articles.length || brief.items.some((item, index) =>
        item.headline !== published.articles[index].headline || !published.ids.includes(item.href.split('#')[1]))) {
        throw new Error(`Public article projection mismatch: ${issueHref}`);
      }
      const target = locale === 'en' ? entry.en : entry;
      const changed = JSON.stringify(target.reader_brief) !== JSON.stringify(brief);
      pages.push({ key: entry.weeklyKey, locale, articles: brief.items.length, changed });
      target.reader_brief = brief;
    }
  }
  const next = `${JSON.stringify(entries, null, 2)}\n`;
  if (write && next !== original) fs.writeFileSync(indexPath, next, 'utf8');
  return { mode: write ? 'write' : 'dry-run', changed: next !== original, pages };
}

if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    if (argv.some(arg => !['--write', '--dry-run'].includes(arg))) throw new Error('Use --dry-run or --write');
    console.log(JSON.stringify(refreshReaderBriefs({ write: argv.includes('--write') }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { refreshReaderBriefs };
