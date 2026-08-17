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
const { assertLabelsWellFormed } = require('./label-schema');

const REPO_ROOT = path.resolve(__dirname, '..');
const COLLECTED_NEWS_DIR = path.join(REPO_ROOT, 'articles', 'content', 'collected-news');
const DATASETS_DIR = path.join(__dirname, 'datasets');
const SPLIT_PATH = path.join(DATASETS_DIR, 'split.json');
const CALIBRATION_PATH = path.join(DATASETS_DIR, 'calibration.json');

// Only calibration is written by default. dev and test stay as bare keys in split.json
// until someone asks for them by name, so that opening a sealed split is a decision
// rather than something that happens because a script was re-run.
const bucketPath = bucket => path.join(DATASETS_DIR, `${bucket}.json`);

const BUCKET_SIZES = { calibration: 20, dev: 20 };

// A patch series is resubmitted as v1, v2, v3 and arrives each time under a
// different group key, so the revisions have to be folded back together before
// the split — otherwise two postings of the same driver land on opposite sides
// of the seal, and the eval measures recall rather than judgement.
//
// The mailing list produces two key shapes, and only one of them carries the
// story. Tooling-generated ids embed a slug:
//
//   lore-series:20260619-hm1246-v10-d88e431a6c11@emfend.at
//
// while `git send-email` defaults to a bare timestamp and sender:
//
//   lore-series:20260731073505.2278769-eagle.alexander923@gmail.com
//
// The second shape identifies nothing. Folding it by sender would merge every
// series that person ever posted, so the subject line is the only signal left,
// and for a patch series a shared subject is precisely what one story means.
const LORE_SLUG_ID = /^lore-series:\d{8}-(.+?)-v\d+-[0-9a-f]{12}@/;
const MAILING_LIST_KEY = /^(?:lore-series|patchwork-series):/;
const SUBJECT_PREFIX = /^\s*(?:re|fwd)\s*:\s*|^\s*\[[^\]]*\]\s*/i;

function normalizeSubject(title) {
  let subject = String(title || '');
  let previous;
  // Strip repeatedly: a reply to a revision carries both, as in "Re: [PATCH v6 2/2] ...".
  do {
    previous = subject;
    subject = subject.replace(SUBJECT_PREFIX, '');
  } while (subject !== previous);
  return subject.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Families are connected components over group keys, not a relabelling of them.
//
// Replacing a group key with something derived from the subject would break the
// grouping that already works: a bare-timestamp series id covers every patch in
// one submission, and those patches carry different subjects, so keying on the
// subject alone splits a series that was whole. Union instead — two group keys
// belong together when they share a revision slug or a normalized subject, and
// whatever each key already grouped stays grouped.
function buildFamilyIndex(records) {
  const parent = new Map();

  function find(key) {
    if (!parent.has(key)) parent.set(key, key);
    while (parent.get(key) !== key) {
      parent.set(key, parent.get(parent.get(key)));
      key = parent.get(key);
    }
    return key;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    // Smaller key wins, so the representative does not depend on input order.
    if (rootA < rootB) parent.set(rootB, rootA);
    else parent.set(rootA, rootB);
  }

  const bySlug = new Map();
  const bySubject = new Map();

  for (const { candidate } of records) {
    const groupKey = candidateGroupKey(candidate);
    find(groupKey);

    const slug = LORE_SLUG_ID.exec(groupKey);
    if (slug) {
      const previous = bySlug.get(slug[1]);
      if (previous) union(previous, groupKey);
      else bySlug.set(slug[1], groupKey);
    }

    // Subject matching is limited to mailing-list items. Elsewhere a shared title
    // is common enough to merge unrelated pages: several sources publish a page
    // simply called "Compatibility".
    if (MAILING_LIST_KEY.test(groupKey)) {
      const subject = normalizeSubject(candidate.title);
      if (subject) {
        const previous = bySubject.get(subject);
        if (previous) union(previous, groupKey);
        else bySubject.set(subject, groupKey);
      }
    }
  }

  return candidate => find(candidateGroupKey(candidate));
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
  const resolveFamily = buildFamilyIndex(records);
  const families = new Map();
  for (const { date, candidate } of records) {
    const key = resolveFamily(candidate);
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

// Hand labels are the only irreproducible artifact here — twenty verdicts and twenty
// written rationales that the Week 02 and Week 08 gates rest on. Rebuilding the item
// list must carry them across, or a re-run silently destroys the week's work while
// reporting success.
function existingLabels(file) {
  if (!fs.existsSync(file)) return new Map();
  const previous = JSON.parse(fs.readFileSync(file, 'utf8')).items || [];
  assertLabelsWellFormed(previous, path.basename(file));
  return new Map(
    previous
      .filter(item => item.human_label !== null || item.human_note)
      .map(item => [item.family_key, { human_label: item.human_label, human_note: item.human_note || '' }])
  );
}

function bucketItems(families, allocation, wanted) {
  const items = [];
  for (const [key, bucket] of Object.entries(allocation)) {
    if (bucket !== wanted) continue;
    const family = families.get(key);
    assert.ok(family, `${wanted} family ${key} is not in the current pool`);

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

  const carried = existingLabels(bucketPath(wanted));
  const orphaned = [...carried.keys()].filter(key => !items.some(item => item.family_key === key));
  if (orphaned.length > 0) {
    throw new Error(
      `${orphaned.length} labelled families have no home in the rebuilt ${wanted} set, so ` +
      `their labels would be lost:\n  ${orphaned.join('\n  ')}\n` +
      'Refusing to write. Reconcile split.json against the current pool first.'
    );
  }
  for (const item of items) {
    const previous = carried.get(item.family_key);
    if (previous) Object.assign(item, previous);
  }
  return items;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// Changing familyKey changes which families exist, which changes the allocation.
// That is safe only while no label has been written: afterwards it would silently
// move hand-labelled items into a sealed bucket and quietly break the seal the
// Week 02 and Week 08 gates rest on.
function assertReallocationAllowed() {
  if (!fs.existsSync(CALIBRATION_PATH)) return;
  const items = JSON.parse(fs.readFileSync(CALIBRATION_PATH, 'utf8')).items || [];
  const labelled = items.filter(item => item.human_label !== null).length;
  if (labelled > 0) {
    throw new Error(
      `${labelled} calibration items are already labelled. Reallocating now would move ` +
      'labelled items across the seal. Either keep the current split, or delete the labels ' +
      'and start the week over deliberately.'
    );
  }
}

function main() {
  const reallocate = process.argv.includes('--reallocate');
  const records = readCandidates();
  const families = groupByFamily(records);
  const computed = allocate([...families.keys()]);

  if (reallocate) {
    assertReallocationAllowed();
    fs.rmSync(SPLIT_PATH, { force: true });
    console.log('reallocating from scratch (no labels recorded yet)');
  }

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

  const items = bucketItems(families, allocation, 'calibration');
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

  const openAt = process.argv.indexOf('--open');
  const opening = openAt === -1 ? null : process.argv[openAt + 1];
  if (!opening) return;

  if (!['dev', 'test'].includes(opening)) {
    throw new Error(`--open takes dev or test, got "${opening}"`);
  }
  const openedItems = bucketItems(families, allocation, opening);
  const openedFile = bucketPath(opening);
  const alreadyLabelled = openedItems.filter(item => item.human_label !== null).length;

  writeJson(openedFile, {
    note: `${opening} split. Opened deliberately — this bucket answers a one-shot gate. ` +
      'human_label is the only ground truth; fill it by hand before running the judge.',
    label_definition: 'lab/label-definition.md',
    items: openedItems
  });

  console.log(`\nopened ${opening}: ${openedItems.length} items -> ${path.relative(REPO_ROOT, openedFile)}`);
  console.log(`${opening} labelled: ${alreadyLabelled}/${openedItems.length}`);
  if (alreadyLabelled < openedItems.length) {
    console.log('The judge cannot be scored against this split until every item carries a hand label.');
  }
}

main();
