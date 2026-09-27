'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { translationSourceHash } = require('./apply-translation');
const { writeSitemap } = require('./generate-sitemap');

function translationArtifactPaths(key) {
  if (!/^\d{4}-W\d{2}$/.test(key)) throw new Error('Invalid weekly key');
  return [
    `articles/en/newsletters/${key}/index.html`,
    `articles/en/newsletters/${key}/newsletter.md`,
    `articles/newsletters/${key}/translation.en.json`,
    `articles/newsletters/${key}/translation-cost-report.md`
  ];
}

// Run before committing a Korean correction. Removing stale backing files also prevents direct
// URLs from continuing to serve the old translation. No recursive directory deletion is needed.
function invalidateTranslation(root, key, sourceText) {
  const artifacts = translationArtifactPaths(key);
  const overlayPath = path.join(root, artifacts[2]);
  if (fs.existsSync(overlayPath)) {
    const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
    if (overlay.source_hash === translationSourceHash(sourceText)) return [];
  }
  const changed = [];
  const weeklyPath = path.join(root, 'articles/data/newsletters-weekly.json');
  const weekly = fs.existsSync(weeklyPath) ? JSON.parse(fs.readFileSync(weeklyPath, 'utf8')) : [];
  const date = weekly.find(item => item.weeklyKey === key)?.date;
  for (const name of ['newsletters-weekly.json', 'newsletters.json']) {
    const rel = `articles/data/${name}`;
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const index = JSON.parse(fs.readFileSync(file, 'utf8'));
    let dirty = false;
    for (const entry of index) {
      if ((name === 'newsletters-weekly.json' ? entry.weeklyKey === key : date && entry.date === date) && Object.hasOwn(entry, 'en')) {
        delete entry.en;
        dirty = true;
      }
    }
    if (dirty) {
      fs.writeFileSync(file, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
      changed.push(rel);
    }
  }
  for (const rel of artifacts) {
    const file = path.join(root, rel);
    if (fs.existsSync(file)) { fs.unlinkSync(file); changed.push(rel); }
  }
  if (changed.length) { writeSitemap(root); changed.push('articles/sitemap.xml'); }
  return changed;
}

if (require.main === module) {
  const key = process.argv[2];
  translationArtifactPaths(key);
  const root = process.cwd();
  const sourceText = fs.readFileSync(path.join(root, 'articles/newsletters', key, 'issue.json'), 'utf8');
  console.log(invalidateTranslation(root, key, sourceText).join('\n'));
}

module.exports = { invalidateTranslation, translationArtifactPaths };
