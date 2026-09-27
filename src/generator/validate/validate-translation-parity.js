'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildHtml } = require('../render/newsletter-renderer');
const { validateEnglishEntry } = require('./english-locale');

function externalLinks(html) {
  return [...new Set(Array.from(html.matchAll(/href="(https?:[^"\s]+)"/g), match => match[1])
    .filter(url => !url.startsWith('https://ttolsun.github.io/camera-hal-sw-newsletter/')))].sort();
}

function validateTranslationParity(root) {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'articles/data/newsletters-weekly.json'), 'utf8'));
  const errors = [];
  const untranslated = [];
  for (const entry of index) {
    if (!Object.hasOwn(entry, 'en')) { untranslated.push(entry.weeklyKey); continue; }
    const problems = validateEnglishEntry(entry, root, { structure: false });
    errors.push(...problems);
    if (problems.length) continue;
    const issue = JSON.parse(fs.readFileSync(path.join(root, 'articles/newsletters', entry.weeklyKey, 'issue.json'), 'utf8'));
    const english = fs.readFileSync(path.join(root, 'articles', entry.en.html), 'utf8');
    // Historical Korean HTML predates renderer features (e.g. full patch-series links).
    if (JSON.stringify(externalLinks(buildHtml(issue))) !== JSON.stringify(externalLinks(english))) {
      errors.push(`Translation source link mismatch: ${entry.weeklyKey}`);
    }
  }
  return { errors, untranslated };
}

if (require.main === module) {
  const result = validateTranslationParity(process.cwd());
  console.log(`Untranslated issues: ${result.untranslated.join(', ') || '(none)'}`);
  for (const error of result.errors) console.error(error);
  if (result.errors.length) process.exitCode = 1;
  else console.log('Translation parity passed.');
}

module.exports = { externalLinks, validateTranslationParity };
