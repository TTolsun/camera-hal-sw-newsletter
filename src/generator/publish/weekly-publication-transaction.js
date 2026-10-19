const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { weeklyKeyForDate } = require('../reporter/weekly-newsletter');
const { translationArtifactPaths } = require('../render/translation-state');
const { writeSitemap } = require('../render/generate-sitemap');

const WEEKLY_INDEX = 'articles/data/newsletters-weekly.json';
const DATED_INDEX = 'articles/data/newsletters.json';

function snapshotPath(root, date) {
  weeklyKeyForDate(date); // Validate before using the execution date in a path.
  return path.join(root, '.tmp', 'weekly-publication', date + '.json');
}

function publicationFiles(weeklyKey) {
  return [
    ...['index.html', 'newsletter.md', 'issue.json'].map(name => 'articles/newsletters/' + weeklyKey + '/' + name),
    ...translationArtifactPaths(weeklyKey),
    'articles/data/homepage-headline.json',
    'state/article-exposure-history.json'
  ];
}

function readIndex(root, relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) return [];
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error(relativePath + ' must contain an array');
  return value;
}

function write(root, relativePath, content, changed) {
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Publication path escapes repository');
  if (content === null) {
    if (fs.existsSync(target)) { fs.unlinkSync(target); changed.push(relativePath); }
    return;
  }
  const buffer = Buffer.from(content, 'base64');
  if (fs.existsSync(target) && fs.readFileSync(target).equals(buffer)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  changed.push(relativePath);
}

function saveSnapshot(file, snapshot) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  fs.renameSync(file + '.tmp', file);
}

function publicationRunKey({ runKey, env = process.env } = {}) {
  if (runKey !== undefined) {
    if (typeof runKey !== 'string' || !runKey.trim()) throw new Error('Publication runKey must be a non-empty string');
    return runKey;
  }
  if (env.GITHUB_RUN_ID) return env.GITHUB_RUN_ID + ':' + (env.GITHUB_RUN_ATTEMPT || '1');
  return env.NEWSLETTER_PUBLICATION_RUN_KEY || '';
}

// All local generator paths, including early diagnostics-only failures, start a
// fresh UUID owner. Child commands inherit it; separate CLI recovery must supply
// the explicit owner. GitHub steps share run ID and attempt, never process IDs.
function initializePublicationRun(env = process.env) {
  if (!env.GITHUB_RUN_ID) env.NEWSLETTER_PUBLICATION_RUN_KEY = 'local:' + randomUUID();
  return publicationRunKey({ env });
}

function readSnapshot(root, date) {
  const file = snapshotPath(root, date);
  if (!fs.existsSync(file)) return null;
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  const weeklyKey = weeklyKeyForDate(date);
  const expectedFiles = publicationFiles(weeklyKey);
  if (snapshot.schemaVersion !== 1 || snapshot.date !== date || snapshot.weeklyKey !== weeklyKey ||
    !['pending', 'completed', 'rolled_back'].includes(snapshot.state) ||
    (snapshot.weeklyEntry !== null && snapshot.weeklyEntry?.weeklyKey !== weeklyKey) ||
    !Array.isArray(snapshot.datedTranslations) || !snapshot.files ||
    Object.keys(snapshot.files).length !== expectedFiles.length ||
    expectedFiles.some(name => !Object.hasOwn(snapshot.files, name) || (snapshot.files[name] !== null &&
      (typeof snapshot.files[name] !== 'string' || Buffer.from(snapshot.files[name], 'base64').toString('base64') !== snapshot.files[name])))) {
    throw new Error('Invalid weekly publication snapshot for ' + date);
  }
  if (typeof snapshot.runKey !== 'string' || !snapshot.runKey.trim()) throw new Error('Invalid weekly publication snapshot owner');
  return snapshot;
}

function ownedSnapshot(root, date, options) {
  const snapshot = readSnapshot(root, date);
  if (!snapshot) return { reason: 'no_snapshot' };
  const owner = publicationRunKey(options);
  if (!owner) throw new Error('Cannot recover weekly publication without an explicit run owner');
  if (snapshot.runKey !== owner) return { reason: 'owner_mismatch' };
  if (snapshot.state === 'completed') return { reason: 'completed' };
  return { snapshot };
}

function completeWeeklyPublication(options = {}) {
  const { root = process.cwd(), date } = options;
  const owned = ownedSnapshot(root, date, options);
  if (!owned.snapshot) return { completed: false, reason: owned.reason };
  if (owned.snapshot.state === 'rolled_back') return { completed: false, reason: 'already_rolled_back' };
  owned.snapshot.state = 'completed';
  saveSnapshot(snapshotPath(root, date), owned.snapshot);
  return { completed: true, reason: 'publication_run_completed' };
}

// Local transaction data, never a review/public artifact. Capture before any writer
// invalidates English output or advances headline/exposure state.
function captureWeeklyPublication(options = {}) {
  const { root = process.cwd(), date } = options;
  const runKey = publicationRunKey(options) || 'local:' + randomUUID();
  const file = snapshotPath(root, date);
  const weeklyKey = weeklyKeyForDate(date);
  if (fs.existsSync(file)) {
    const previous = readSnapshot(root, date);
    if (previous.runKey === runKey && previous.state === 'completed') throw new Error('Publication run is already completed');
    if (previous.runKey === runKey && previous.state === 'pending') return previous;
  }
  const weeklyEntry = readIndex(root, WEEKLY_INDEX).find(entry => entry.weeklyKey === weeklyKey) || null;
  const datedTranslations = readIndex(root, DATED_INDEX)
    .filter(entry => entry.date === weeklyEntry?.date || entry.en?.html === 'en/newsletters/' + weeklyKey + '/index.html')
    .map(entry => ({ date: entry.date, ...(Object.hasOwn(entry, 'en') ? { en: entry.en } : {}) }));
  const files = Object.fromEntries(publicationFiles(weeklyKey).map(relativePath => {
    const full = path.join(root, relativePath);
    return [relativePath, fs.existsSync(full) ? fs.readFileSync(full).toString('base64') : null];
  }));
  const snapshot = { schemaVersion: 1, date, weeklyKey, runKey, state: 'pending', weeklyEntry, datedTranslations, files };
  saveSnapshot(file, snapshot);
  return snapshot;
}

function rollbackWeeklyPublication(options = {}) {
  const { root = process.cwd(), date } = options;
  const file = snapshotPath(root, date);
  if (!fs.existsSync(file)) return { applied: false, files: [], reason: 'no_snapshot' };
  const owned = ownedSnapshot(root, date, options);
  if (!owned.snapshot) return { applied: false, files: [], reason: owned.reason };
  const snapshot = owned.snapshot;
  const weeklyKey = snapshot.weeklyKey;
  const expectedFiles = publicationFiles(weeklyKey);
  if (snapshot.state === 'rolled_back') return { applied: false, files: [], reason: 'already_rolled_back' };
  // Parse all shared indexes before restoring any files; broken state must fail closed.
  const currentWeekly = readIndex(root, WEEKLY_INDEX);
  const weekly = currentWeekly.filter(entry => entry.weeklyKey !== weeklyKey);
  if (snapshot.weeklyEntry) weekly.push(snapshot.weeklyEntry);
  weekly.sort((a, b) => String(b.weeklyKey).localeCompare(String(a.weeklyKey)));
  const dated = readIndex(root, DATED_INDEX);
  const datedBefore = JSON.stringify(dated);
  for (const previous of snapshot.datedTranslations) {
    const current = dated.find(entry => entry.date === previous.date);
    if (!current) continue; // Never resurrect a removed dated entry.
    if (Object.hasOwn(previous, 'en')) current.en = previous.en;
    else delete current.en;
  }
  const changed = [];
  for (const relativePath of expectedFiles) write(root, relativePath, snapshot.files[relativePath], changed);
  const indexes = [];
  if (JSON.stringify(currentWeekly) !== JSON.stringify(weekly)) indexes.push([WEEKLY_INDEX, weekly]);
  if (datedBefore !== JSON.stringify(dated)) indexes.push([DATED_INDEX, dated]);
  for (const [relativePath, value] of indexes) {
    // A missing historical index is not created merely to roll back a weekly run.
    if (relativePath === DATED_INDEX && !fs.existsSync(path.join(root, relativePath))) continue;
    write(root, relativePath, Buffer.from(JSON.stringify(value, null, 2) + '\n').toString('base64'), changed);
  }
  writeSitemap(root);
  changed.push('articles/sitemap.xml');
  snapshot.state = 'rolled_back';
  saveSnapshot(file, snapshot);
  return { applied: true, files: [...new Set(changed)], restoredPreviousWeek: Boolean(snapshot.weeklyEntry), reason: 'failed_run_rolled_back' };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args[0] !== '--complete' || !args[1] || ![2, 4].includes(args.length) ||
      (args.length === 4 && args[2] !== '--run-key')) throw new Error('Usage: weekly-publication-transaction.js --complete YYYY-MM-DD [--run-key KEY]');
    const result = completeWeeklyPublication({ date: args[1], ...(args[3] ? { runKey: args[3] } : {}) });
    if (!result.completed && !['no_snapshot', 'completed', 'already_rolled_back'].includes(result.reason)) throw new Error('Cannot complete weekly publication: ' + result.reason);
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { captureWeeklyPublication, completeWeeklyPublication, initializePublicationRun, publicationRunKey, rollbackWeeklyPublication };
