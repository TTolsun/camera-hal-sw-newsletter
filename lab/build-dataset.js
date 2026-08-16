'use strict';

// Builds the Week 01 evaluation dataset from frozen collection artifacts.
// Reads only articles/content/collected-news/<date>/candidates.json. No LLM calls,
// no pipeline run, no writes outside lab/.
//
// Split unit is the article group, not the URL: the same story reaches the
// collector through several URLs, and a URL-level split would put both halves of
// one story on opposite sides of the seal. candidateGroupKey() is the repository's
// own grouping function, so the lab and production agree on what "one story" means.
//
// Allocation is computed once and committed to datasets/split.json. Re-running
// recomputes and compares rather than reassigning, because the collector keeps
// adding candidates: a sort-and-slice allocation recomputed against a larger pool
// silently moves families between buckets, which would break the seal that the
// Week 02 and Week 08 gates depend on.

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { candidateGroupKey } = require('../src/shared/common/article-groups');

const REPO_ROOT = path.resolve(__dirname, '..');
const COLLECTED_NEWS_DIR = path.join(REPO_ROOT, 'articles', 'content', 'collected-news');
const DATASETS_DIR = path.join(__dirname, 'datasets');
const SPLIT_PATH = path.join(DATASETS_DIR, 'split.json');
const CALIBRATION_PATH = path.join(DATASETS_DIR, 'calibration.json');

const BUCKET_SIZES = { calibration: 20, dev: 20 };

// Patch series arrive once per revision (v7, v8, v9) under distinct group keys.
// They are one story, so fold the revision suffix away before splitting.
const LORE_REVISION = /^lore-series:\d{8}-(.+?)-v\d+-[0-9a-f]{12}@/;

function familyKey(groupKey) {
  const match = LORE_REVISION.exec(groupKey);
  return match ? `lore-family:${match[1]}` : groupKey;
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function readCandidates() {
  const records = [];
  for (const date of fs.readdirSync(COLLECTED_NEWS_DIR).sort()) {
    const file = path.join(COLLECTED_NEWS_DIR, date, 'candidates.json');
    if (!fs.existsSync(file)) continue;

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`${file} is not valid JSON: ${error.message}`);
    }

    const list = Array.isArray(parsed) ? parsed : (parsed.candidates || []);
    for (const candidate of list) {
      if (candidate.main_eligible !== true) continue;
      records.push({ date, candidate });
    }
  }
  return records;
}

function groupByFamily(records) {
  const families = new Map();
  for (const { date, candidate } of records) {
    const key = familyKey(candidateGroupKey(candidate));
    const family = families.get(key) || { key, records: [] };
    family.records.push({ date, candidate });
    families.set(key, family);
  }
  // Newest record wins: the labeler judges the most recent form of the story.
  for (const family of families.values()) {
    family.records.sort((a, b) => b.date.localeCompare(a.date));
  }
  return families;
}

function allocate(familyKeys) {
  const ordered = [...familyKeys]
    .map(key => ({ key, hash: sha1(key) }))
    .sort((a, b) => a.hash.localeCompare(b.hash));

  assert.ok(
    ordered.length >= BUCKET_SIZES.calibration + BUCKET_SIZES.dev + 1,
    `only ${ordered.length} families available, need more than ${BUCKET_SIZES.calibration + BUCKET_SIZES.dev}`
  );

  const allocation = {};
  ordered.forEach((entry, index) => {
    if (index < BUCKET_SIZES.calibration) allocation[entry.key] = 'calibration';
    else if (index < BUCKET_SIZES.calibration + BUCKET_SIZES.dev) allocation[entry.key] = 'dev';
    else allocation[entry.key] = 'test';
  });
  return allocation;
}

function loadCommittedAllocation() {
  if (!fs.existsSync(SPLIT_PATH)) return null;
  return JSON.parse(fs.readFileSync(SPLIT_PATH, 'utf8')).allocation;
}

// The committed allocation is authoritative. Families that appear later are
// parked as 'unassigned' so that growth never disturbs a sealed bucket.
function reconcile(committed, computed) {
  const merged = { ...committed };
  const drifted = [];
  let added = 0;

  for (const key of Object.keys(computed)) {
    if (!(key in committed)) {
      merged[key] = 'unassigned';
      added += 1;
    }
  }
  for (const key of Object.keys(committed)) {
    if (!(key in computed)) drifted.push(`${key}: present in split.json, absent from current pool`);
  }
  return { merged, drifted, added };
}

function calibrationItems(families, allocation) {
  const items = [];
  for (const [key, bucket] of Object.entries(allocation)) {
    if (bucket !== 'calibration') continue;
    const family = families.get(key);
    assert.ok(family, `calibration family ${key} is not in the current pool`);

    const { date, candidate } = family.records[0];
    items.push({
      family_key: key,
      collected_date: date,
      title: candidate.title || '',
      url: candidate.url || '',
      source_name: candidate.source_name || candidate.source || '',
      summary: candidate.summary || '',
      // Stratification aid only. NOT ground truth - the human label is.
      pipeline_selection: candidate.final_selection_eligibility || '',
      human_label: null,
      human_note: ''
    });
  }
  items.sort((a, b) => a.family_key.localeCompare(b.family_key));
  return items;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const records = readCandidates();
  const families = groupByFamily(records);
  const computed = allocate([...families.keys()]);

  const committed = loadCommittedAllocation();
  let allocation = computed;
  let status = 'created';

  if (committed) {
    const { merged, drifted, added } = reconcile(committed, computed);
    allocation = merged;
    status = 'reconciled';
    if (drifted.length > 0) {
      console.warn(`WARN ${drifted.length} committed families are no longer in the pool:`);
      for (const line of drifted) console.warn(`  ${line}`);
    }
    if (added > 0) {
      console.log(`${added} new families parked as unassigned (sealed buckets untouched)`);
    }
  }

  const counts = {};
  for (const bucket of Object.values(allocation)) counts[bucket] = (counts[bucket] || 0) + 1;

  assert.strictEqual(counts.calibration, BUCKET_SIZES.calibration, `calibration=${counts.calibration}`);
  assert.strictEqual(counts.dev, BUCKET_SIZES.dev, `dev=${counts.dev}`);
  assert.ok(counts.test > 0, 'test bucket is empty');
  assert.strictEqual(
    new Set(Object.keys(allocation)).size,
    Object.keys(allocation).length,
    'duplicate family key in allocation'
  );

  const items = calibrationItems(families, allocation);
  assert.strictEqual(items.length, BUCKET_SIZES.calibration, `calibration items=${items.length}`);
  assert.strictEqual(
    new Set(items.map(item => item.family_key)).size,
    items.length,
    'duplicate family in calibration items'
  );

  writeJson(SPLIT_PATH, {
    note: 'Authoritative allocation. Never regenerate - build-dataset.js reconciles against this file.',
    bucket_sizes: BUCKET_SIZES,
    counts,
    allocation
  });

  // Only calibration contents are materialised. dev and test stay as bare keys
  // in split.json so that opening them is a deliberate act, not an accident.
  writeJson(CALIBRATION_PATH, {
    note: 'human_label is the only ground truth. Fill it by hand: "yes" or "no".',
    label_definition: 'lab/label-definition.md',
    items
  });

  console.log(`pool: ${records.length} main-eligible records -> ${families.size} families (${status})`);
  console.log(`split: ${JSON.stringify(counts)}`);
  console.log(`wrote: ${path.relative(REPO_ROOT, SPLIT_PATH)}, ${path.relative(REPO_ROOT, CALIBRATION_PATH)}`);

  const labelled = items.filter(item => item.human_label !== null).length;
  console.log(`calibration labelled: ${labelled}/${items.length}`);
}

main();
