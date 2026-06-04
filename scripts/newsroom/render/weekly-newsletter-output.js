'use strict';

// Additive weekly newsletter output (#486, PR2). On a publish-ready run the orchestrator calls this
// to ALSO emit a weekly directory page (newsletters/<weeklyKey>/{index.html,newsletter.md}) and upsert
// a weekly entry into the SEPARATE data/newsletters-weekly.json. It never touches the daily public
// output or data/newsletters.json, and it renders exactly one publish-ready run (no cross-run merge).

const fs = require('fs');
const path = require('path');

const { buildWeeklyNewsletterPage } = require('./weekly-newsletter-page');

function readWeeklyIndex(dataPath) {
  if (!fs.existsSync(dataPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function upsertWeeklyIndex(root, entry) {
  const relPath = 'data/newsletters-weekly.json';
  const dataPath = path.join(root, 'data', 'newsletters-weekly.json');
  const updated = readWeeklyIndex(dataPath)
    .filter(item => item && item.weeklyKey !== entry.weeklyKey)
    .concat(entry)
    .sort((a, b) => String(b.weeklyKey || '').localeCompare(String(a.weeklyKey || '')));
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return relPath;
}

function writeWeeklyNewsletterArtifacts({ root = process.cwd(), date, editor, tags = [] } = {}) {
  const page = buildWeeklyNewsletterPage(editor, { date });
  const dir = path.join(root, 'newsletters', page.weeklyKey);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page.html, 'utf8');
  fs.writeFileSync(path.join(dir, 'newsletter.md'), page.markdown, 'utf8');
  const indexFile = upsertWeeklyIndex(root, {
    weeklyKey: page.weeklyKey,
    weekStartDate: page.weekStartDate,
    weekEndDate: page.weekEndDate,
    date: page.weekStartDate,
    title: page.issue.title,
    summary: String(editor && editor.summary || ''),
    html: page.indexRoute,
    md: page.markdownRoute,
    tags: Array.isArray(tags) ? tags : []
  });
  return {
    weeklyKey: page.weeklyKey,
    files: [page.indexRoute, page.markdownRoute, indexFile]
  };
}

module.exports = { writeWeeklyNewsletterArtifacts };
