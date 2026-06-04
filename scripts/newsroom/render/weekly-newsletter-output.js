'use strict';

// Additive weekly newsletter output (#486 PR2) with same-week upsert (#488). On a publish-ready run
// the orchestrator calls this to accumulate that run's articles into the matching ISO-week newsletter:
// load the existing weekly issue, append non-duplicate articles (deterministic identity dedup), apply
// the weekly article limits (#492), regenerate the weekly directory page, and upsert the separate
// data/newsletters-weekly.json index. Daily output and data/newsletters.json are never touched.
// LLM duplicate merge (#489) and merged-article validation (#490) layer on top of this deterministic
// append; here a duplicate is simply skipped.

const fs = require('fs');
const path = require('path');

const { buildWeeklyNewsletterPage } = require('./weekly-newsletter-page');
const { weeklyKeyForDate } = require('../common/weekly-newsletter');
const { applyWeeklyArticleLimits } = require('../common/weekly-article-limits');
const { articleIdentityKey } = require('../common/article-identity');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function sectionSourceUrl(section = {}) {
  return section.source_candidate_url ||
    section.url ||
    (ensureArray(section.sources)[0] && ensureArray(section.sources)[0].url) ||
    '';
}

function sectionIdentity(section = {}) {
  return articleIdentityKey({
    url: sectionSourceUrl(section),
    title: section.headline || section.title,
    ...section
  });
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

function writeWeeklyNewsletterArtifacts({ root = process.cwd(), date, editor, tags = [] } = {}) {
  const weeklyKey = weeklyKeyForDate(date);
  const existingIssue = loadExistingWeeklyIssue(root, weeklyKey);
  const existingSections = existingIssue ? ensureArray(existingIssue.sections) : [];
  const existingKeys = new Set(existingSections.map(sectionIdentity));

  const incomingNew = ensureArray(editor && editor.sections).filter(section => !existingKeys.has(sectionIdentity(section)));
  const { articles } = applyWeeklyArticleLimits({ existing: existingSections, incoming: incomingNew });

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
    title: page.issue.title,
    summary: String(editor && editor.summary || (existingIssue && existingIssue.summary) || ''),
    html: page.indexRoute,
    md: page.markdownRoute,
    tags: mergedTags,
    article_count: articles.length
  });

  return {
    weeklyKey: page.weeklyKey,
    weeklyArticleCount: articles.length,
    addedArticleCount: incomingNew.length,
    files: [
      page.indexRoute,
      page.markdownRoute,
      `newsletters/${weeklyKey}/issue.json`,
      indexFile
    ]
  };
}

module.exports = { writeWeeklyNewsletterArtifacts };
