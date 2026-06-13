const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_AUDIT_REPORT_PATH,
  DEFAULT_CLEANUP_REPORT_PATH,
  auditHistoricalArchive,
  buildInventoryFinalMetrics,
  parseInventoryTableRows,
  validateHistoricalArchive
} = require('../../quality/historical-archive');
const {
  CLEANUP_REPORT_PATH: AUDIT_CLEANUP_REPORT_PATH,
  INVENTORY_PATH: AUDIT_INVENTORY_PATH,
  LEDGER_PATH: AUDIT_LEDGER_PATH
} = require('../../reporter/audit-paths');
const {
  readJson,
  tempRoot,
  writeJson,
  writeText
} = require('../../../core/test/helpers/fs');

function writePublicIssue(root, date, text = '') {
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), [
    '# Camera HAL / SW Newsletter',
    '',
    text || 'Historical public newsletter body.',
    ''
  ].join('\n'));
  writeText(path.join(root, 'articles', 'newsletters', date, 'index.html'), [
    '<!doctype html>',
    '<html><body>',
    text || 'Historical public newsletter body.',
    '</body></html>'
  ].join('\n'));
}

function writeNewsroom(root, date) {
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), {
    status: 'PASS',
    score: 90,
    threshold: 85,
    deductions: []
  });
}

function tableRows(dates) {
  return dates.map(date => `| ${date} | historical_unreviewed |`).join('\n');
}

function writeArchiveDocs(root, datesOrOptions) {
  const options = Array.isArray(datesOrOptions)
    ? {
        ledgerDates: datesOrOptions,
        inventoryDates: datesOrOptions,
        cleanupDates: datesOrOptions
      }
    : datesOrOptions;
  const {
    ledgerDates = [],
    inventoryDates = [],
    cleanupDates = []
  } = options || {};
  writeText(path.join(root, AUDIT_LEDGER_PATH), [
    '# Historical Newsletter Provenance Ledger',
    '',
    tableRows(ledgerDates),
    ''
  ].join('\n'));
  writeText(path.join(root, AUDIT_INVENTORY_PATH), [
    '# Existing Newsletter Quality Inventory',
    '',
    tableRows(inventoryDates),
    ''
  ].join('\n'));
  writeText(path.join(root, AUDIT_CLEANUP_REPORT_PATH), [
    '# Existing Newsletter Quality Cleanup Report',
    '',
    tableRows(cleanupDates),
    ''
  ].join('\n'));
}

function writeNewsletterIndex(root, dates) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), dates.map(date => ({
    date,
    title: `Newsletter ${date}`,
    summary: 'Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL']
  })));
}

function writeStatus(root, entries) {
  writeJson(path.join(root, 'articles', 'content', 'audit', 'historical-archive-status.json'), entries);
}

function statusEntry(date, overrides = {}) {
  return {
    date,
    archive_status: 'historical_unreviewed',
    historical_cleanup_reviewed: false,
    known_limitations: ['historical_cleanup_pending'],
    historical_cleanup_context: 'historical_archive_cleanup',
    public_visibility: 'listed',
    ...overrides
  };
}

test('historical archive validator accepts listed and unlisted sidecar statuses', () => {
  const root = tempRoot('historical-archive-valid-');
  const listedDate = '2026-05-05';
  const unlistedDate = '2026-05-06';
  writeNewsletterIndex(root, [listedDate]);
  writePublicIssue(root, listedDate);
  writePublicIssue(root, unlistedDate);
  writeNewsroom(root, listedDate);
  writeNewsroom(root, unlistedDate);
  writeArchiveDocs(root, [listedDate, unlistedDate]);
  writeStatus(root, [
    statusEntry(listedDate),
    statusEntry(unlistedDate, {
      public_visibility: 'unlisted',
      known_limitations: ['not_listed_in_data_newsletters', 'historical_cleanup_pending']
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, true, result.errors.join('\n'));

  const audit = auditHistoricalArchive({ root, writeReports: true });
  assert.equal(audit.report.orphan_public_dates.includes(unlistedDate), true);
  assert.equal(readJson(path.join(root, DEFAULT_AUDIT_REPORT_PATH)).sidecar_entry_count, 2);
  assert.match(
    require('node:fs').readFileSync(path.join(root, DEFAULT_CLEANUP_REPORT_PATH), 'utf8'),
    /2026-05-06/
  );
});

test('historical archive audit classifies newsroom-only artifacts as non-public report entries', () => {
  const root = tempRoot('historical-archive-newsroom-only-');
  const date = '2026-05-06';
  writeNewsletterIndex(root, []);
  writeNewsroom(root, date);
  writeArchiveDocs(root, []);
  writeStatus(root, []);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, true, result.errors.join('\n'));

  const audit = auditHistoricalArchive({ root, writeReports: true });
  const entry = audit.report.entries.find(item => item.date === date);
  assert.equal(entry.artifact_scope, 'non_public_newsroom_artifact');
  assert.equal(entry.archive_status, null);
  assert.equal(entry.public_visibility, 'not_public');
  assert.equal(entry.historical_cleanup_context, 'non_public_newsroom_artifact');
  assert.equal(audit.report.validation_warning_count, 0);
  assert.match(
    require('node:fs').readFileSync(path.join(root, DEFAULT_CLEANUP_REPORT_PATH), 'utf8'),
    /Non-public newsroom artifacts/
  );
});

test('historical archive validator rejects unclassified public artifacts', () => {
  const root = tempRoot('historical-archive-unclassified-');
  const listedDate = '2026-05-05';
  const orphanDate = '2026-05-06';
  writeNewsletterIndex(root, [listedDate]);
  writePublicIssue(root, listedDate);
  writePublicIssue(root, orphanDate);
  writeArchiveDocs(root, [listedDate]);
  writeStatus(root, [statusEntry(listedDate)]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Public newsletter artifact 2026-05-06 has no articles\/content\/audit\/historical-archive-status\.json status entry/);
});

test('historical archive validator requires sidecar entries to be referenced by the ledger', () => {
  const root = tempRoot('historical-archive-ledger-reference-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeArchiveDocs(root, {
    ledgerDates: [],
    inventoryDates: [date],
    cleanupDates: [date]
  });
  writeStatus(root, [statusEntry(date)]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /newsletter-provenance-ledger\.md/);

  const audit = auditHistoricalArchive({ root, writeReports: false });
  assert.equal(audit.ok, false);
  assert.equal(audit.report.validation_error_count > 0, true);
});

test('historical archive validator accepts review-only public stable archive entries', () => {
  const root = tempRoot('historical-archive-review-only-current-');
  const date = '2026-05-23';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeArchiveDocs(root, [date]);
  writeStatus(root, [
    statusEntry(date, {
      archive_status: 'stable_archive',
      historical_cleanup_reviewed: true,
      known_limitations: ['review_only_publication'],
      historical_cleanup_context: 'review_only_publication',
      public_visibility: 'listed'
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('historical archive validator rejects current-generation archive entries with limitations', () => {
  const root = tempRoot('historical-archive-current-generation-limitations-');
  const date = '2026-05-24';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeArchiveDocs(root, [date]);
  writeStatus(root, [
    statusEntry(date, {
      archive_status: 'stable_archive',
      historical_cleanup_reviewed: true,
      known_limitations: ['review_only_publication'],
      historical_cleanup_context: 'current_generation_archive_review',
      public_visibility: 'listed'
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /current_generation_archive_review entries must not declare known_limitations/);
});

test('historical archive validator rejects review-only context without review-only limitation', () => {
  const root = tempRoot('historical-archive-review-only-missing-limitation-');
  const date = '2026-05-23';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeArchiveDocs(root, [date]);
  writeStatus(root, [
    statusEntry(date, {
      archive_status: 'stable_archive',
      historical_cleanup_reviewed: true,
      known_limitations: [],
      historical_cleanup_context: 'review_only_publication',
      public_visibility: 'listed'
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /review_only_publication entries must include known_limitations=review_only_publication/);
});

test('historical archive validator requires non-stable sidecar entries in the cleanup report', () => {
  const root = tempRoot('historical-archive-cleanup-reference-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeArchiveDocs(root, {
    ledgerDates: [date],
    inventoryDates: [date],
    cleanupDates: []
  });
  writeStatus(root, [statusEntry(date)]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /newsletter-quality-cleanup-report\.md/);
});

test('historical archive validator rejects removed archives exposed through public index', () => {
  const root = tempRoot('historical-archive-removed-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeNewsroom(root, date);
  writeArchiveDocs(root, [date]);
  writeStatus(root, [
    statusEntry(date, {
      archive_status: 'removed',
      historical_cleanup_reviewed: true,
      public_visibility: 'removed'
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Removed archive 2026-05-05 must not remain in articles\/data\/newsletters\.json/);
  assert.match(result.errors.join('\n'), /Removed archive 2026-05-05 still has articles\/newsletters\/2026-05-05 artifacts/);
});

test('historical archive validator rejects fake seed evidence provenance in pre-185 public articles', () => {
  const root = tempRoot('historical-archive-fake-seed-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date, 'This historical article now claims Evidence Pack provenance.');
  writeArchiveDocs(root, [date]);
  writeStatus(root, [
    statusEntry(date, {
      known_limitations: ['pre_185_generation', 'source_provenance_not_backfilled']
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Pre-seed-evidence public article 2026-05-05 contains seed evidence workflow provenance wording/);
});

test('historical archive validator requires diff artifact for material rewrite entries', () => {
  const root = tempRoot('historical-archive-material-rewrite-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeArchiveDocs(root, [date]);
  writeStatus(root, [
    statusEntry(date, {
      rewrite_status: 'material_rewrite'
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Material rewrite 2026-05-05 must declare material_rewrite_diff or material_rewrite_diffs/);
});

test('historical archive validator requires material rewrite diff slug to match an article heading', () => {
  const root = tempRoot('historical-archive-material-rewrite-slug-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date, '## 2. libcamera v0.7.1 release\n\nHistorical article body.');
  writeArchiveDocs(root, [date]);
  writeText(
    path.join(root, 'articles', 'content', 'audit', 'historical-rewrite-diff', '2026-05-05-unrelated-article.md'),
    '# Rewrite diff\n'
  );
  writeStatus(root, [
    statusEntry(date, {
      rewrite_status: 'material_rewrite',
      material_rewrite_diff: 'articles/content/audit/historical-rewrite-diff/2026-05-05-unrelated-article.md'
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unknown article slug unrelated-article/);
});

test('historical archive validator requires material rewrite diff date to match sidecar entry date', () => {
  const root = tempRoot('historical-archive-material-rewrite-date-');
  const rewriteDate = '2026-05-05';
  const wrongEntryDate = '2026-05-19';
  const diffPath = 'articles/content/audit/historical-rewrite-diff/2026-05-05-firebase-ai-logic-camera-hal-npu-gpu.md';
  writeNewsletterIndex(root, [rewriteDate, wrongEntryDate]);
  writePublicIssue(root, rewriteDate, '## 2. firebase ai logic camera hal npu gpu\n\nHistorical article body.');
  writePublicIssue(root, wrongEntryDate);
  writeArchiveDocs(root, [rewriteDate, wrongEntryDate]);
  writeText(path.join(root, diffPath), '# Rewrite diff\n');
  writeStatus(root, [
    statusEntry(rewriteDate),
    statusEntry(wrongEntryDate, {
      rewrite_status: 'material_rewrite',
      material_rewrite_diff: diffPath
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Material rewrite diff date 2026-05-05 must match sidecar entry date 2026-05-19/);
});

test('historical archive validator accepts material rewrite diff arrays', () => {
  const root = tempRoot('historical-archive-material-rewrite-array-');
  const date = '2026-05-05';
  const firstDiffPath = 'articles/content/audit/historical-rewrite-diff/2026-05-05-firebase-ai-logic-camera-hal-npu-gpu.md';
  const secondDiffPath = 'articles/content/audit/historical-rewrite-diff/2026-05-05-c-26-assert-camera-hal.md';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date, [
    '## 2. firebase ai logic camera hal npu gpu',
    '',
    'Historical article body.',
    '',
    '## 3. c 26 assert camera hal',
    '',
    'Historical article body.',
    ''
  ].join('\n'));
  writeArchiveDocs(root, [date]);
  writeText(path.join(root, firstDiffPath), '# Rewrite diff\n');
  writeText(path.join(root, secondDiffPath), '# Rewrite diff\n');
  writeStatus(root, [
    statusEntry(date, {
      rewrite_status: 'material_rewrite',
      material_rewrite_diffs: [
        firstDiffPath,
        secondDiffPath
      ]
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('historical archive validator requires legacy material rewrite diff to be included in diff arrays', () => {
  const root = tempRoot('historical-archive-material-rewrite-array-legacy-');
  const date = '2026-05-05';
  const legacyDiffPath = 'articles/content/audit/historical-rewrite-diff/2026-05-05-firebase-ai-logic-camera-hal-npu-gpu.md';
  const arrayDiffPath = 'articles/content/audit/historical-rewrite-diff/2026-05-05-c-26-assert-camera-hal.md';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date, [
    '## 2. firebase ai logic camera hal npu gpu',
    '',
    'Historical article body.',
    '',
    '## 3. c 26 assert camera hal',
    '',
    'Historical article body.',
    ''
  ].join('\n'));
  writeArchiveDocs(root, [date]);
  writeText(path.join(root, legacyDiffPath), '# Rewrite diff\n');
  writeText(path.join(root, arrayDiffPath), '# Rewrite diff\n');
  writeStatus(root, [
    statusEntry(date, {
      rewrite_status: 'material_rewrite',
      material_rewrite_diff: legacyDiffPath,
      material_rewrite_diffs: [
        arrayDiffPath
      ]
    })
  ]);

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /material_rewrite_diff must be included in material_rewrite_diffs/);
});

test('historical archive validator rejects forbidden public article provenance in good fixtures', () => {
  const root = tempRoot('historical-archive-good-fixture-provenance-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeArchiveDocs(root, [date]);
  writeStatus(root, [statusEntry(date)]);
  writeJson(path.join(root, 'src', 'core', 'test', 'fixtures', 'quality', 'good', 'historical-public-article.json'), {
    metadata: {
      provenance: 'generated_newsletter_public_article'
    },
    article: {
      title: 'Generated public article fixture'
    }
  });

  const result = validateHistoricalArchive({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /generated_newsletter_public_article/);
});

test('historical archive final metrics parse escaped pipe inventory rows', () => {
  const inventoryText = [
    '# Existing Newsletter Quality Inventory',
    '',
    '| Date | Article title | Article slug | Source URL present | Source-backed fact present | HAL relevance | Action item specificity | Overclaim risk | Format consistency | Current quality status | Recommended decision | Severity | Review note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 2026-05-19 | Glaze 7.2 - C++26 Reflection \\| YAML | glaze-7-2-c-26-reflection | yes | partial | low | generic | medium | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic actionability, medium overclaim risk, weak historical format. |',
    '| 2026-04-30 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Removed. |',
    ''
  ].join('\n');

  const rows = parseInventoryTableRows(inventoryText);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].article_title, 'Glaze 7.2 - C++26 Reflection | YAML');

  const metrics = buildInventoryFinalMetrics(inventoryText);
  assert.equal(metrics.total_article_rows, 2);
  assert.equal(metrics.reviewed_article_rows, 1);
  assert.equal(metrics.removed_article_rows, 1);
  assert.equal(metrics.accepted_limitation_rows, 1);
  assert.equal(metrics.remaining_source_gap_count, 0);
  assert.equal(metrics.remaining_overclaim_risk_count, 0);
  assert.equal(metrics.remaining_weak_actionability_count, 0);
  assert.equal(metrics.accepted_limitation_counts.partial_source_backing, 1);
  assert.equal(metrics.accepted_limitation_counts.generic_actionability, 1);
  assert.equal(metrics.accepted_limitation_counts.medium_overclaim, 1);
  assert.equal(metrics.accepted_limitation_counts.weak_format, 1);
});
