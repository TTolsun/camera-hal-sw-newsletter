'use strict';

// Additive weekly newsletter output (#486 PR2) with same-week upsert (#488), within-week duplicate
// detection and LLM merge (#489), and merged-article validation (#490). On a publish-ready run the
// orchestrator calls this to accumulate the run's articles into the matching ISO-week newsletter:
// load the existing weekly issue, resolve each incoming article against the week (append / LLM merge /
// reject, with merged articles validated before they replace existing ones), apply the weekly limits
// (#492), regenerate the weekly directory page, and upsert the separate data/newsletters-weekly.json.
// Daily output and data/newsletters.json are never touched. Without an injected LLM merge resolver
// this falls back to the deterministic behavior (skip exact duplicates, keep the rest).

const fs = require('fs');
const path = require('path');

const { buildWeeklyNewsletterPage } = require('./weekly-newsletter-page');
const { weeklyKeyForDate } = require('../common/weekly-newsletter');
const { applyWeeklyArticleLimits } = require('../common/weekly-article-limits');
const { resolveWeeklyArticles } = require('../generate/weekly-duplicate-merge');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function loadExistingWeeklyIssue(root, weeklyKey) {
  const issuePath = path.join(root, 'newsletters', weeklyKey, 'issue.json');
  if (!fs.existsSync(issuePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(issuePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function dedupeReferences(references) {
  const seen = new Set();
  const result = [];
  for (const reference of ensureArray(references)) {
    const url = String(reference && reference.url || '').trim();
    const key = url || JSON.stringify(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(reference);
  }
  return result;
}

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

async function writeWeeklyNewsletterArtifacts({ root = process.cwd(), date, editor, tags = [], mergeDuplicate, validateMerged } = {}) {
  const weeklyKey = weeklyKeyForDate(date);
  const existingIssue = loadExistingWeeklyIssue(root, weeklyKey);
  const existingSections = existingIssue ? ensureArray(existingIssue.sections) : [];

  const resolved = await resolveWeeklyArticles({
    existingArticles: existingSections,
    incomingArticles: ensureArray(editor && editor.sections),
    mergeDuplicate,
    validateMerged
  });
  const { articles } = applyWeeklyArticleLimits({ existing: resolved.existingArticles, incoming: resolved.appendedArticles });

  const mergedTags = [...new Set([
    ...ensureArray(existingIssue && existingIssue.tags).map(String),
    ...ensureArray(tags).map(String)
  ].filter(Boolean))];

  const mergedDraft = {
    ...editor,
    sections: articles,
    references: dedupeReferences([
      ...ensureArray(existingIssue && existingIssue.references),
      ...ensureArray(editor && editor.references)
    ])
  };
  const page = buildWeeklyNewsletterPage(mergedDraft, { date });
  page.issue.tags = mergedTags;

  const dir = path.join(root, 'newsletters', weeklyKey);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page.html, 'utf8');
  fs.writeFileSync(path.join(dir, 'newsletter.md'), page.markdown, 'utf8');
  fs.writeFileSync(path.join(dir, 'issue.json'), `${JSON.stringify(page.issue, null, 2)}\n`, 'utf8');

  const indexFile = upsertWeeklyIndex(root, {
    weeklyKey: page.weeklyKey,
    weekStartDate: page.weekStartDate,
    weekEndDate: page.weekEndDate,
    date: page.weekStartDate,
    // Card title is the bare ISO week ("2026-W23" -> "2026 W23"); the week date range
    // moves to the card date badge (weekStartDate/weekEndDate) so it is not duplicated here.
    title: String(page.weeklyKey).replace('-W', ' W'),
    // The card lists this week's article titles, one per line (newline-joined), so each title
    // stays distinguishable. page.issue.briefing is the title list.
    summary: (Array.isArray(page.issue.briefing) && page.issue.briefing.length
      ? page.issue.briefing.join('\n')
      : String(editor && editor.summary || (existingIssue && existingIssue.summary) || '')),
    html: page.indexRoute,
    md: page.markdownRoute,
    tags: mergedTags,
    article_count: articles.length
  });

  return {
    weeklyKey: page.weeklyKey,
    weeklyArticleCount: articles.length,
    addedArticleCount: resolved.appendedArticles.length,
    mergeWarnings: resolved.warnings,
    mergeDecisions: resolved.decisions,
    files: [
      page.indexRoute,
      page.markdownRoute,
      `newsletters/${weeklyKey}/issue.json`,
      indexFile
    ]
  };
}

module.exports = { writeWeeklyNewsletterArtifacts };
