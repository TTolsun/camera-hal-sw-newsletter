const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_AUDIT_REPORT_PATH,
  DEFAULT_CLEANUP_REPORT_PATH,
  auditHistoricalArchive,
  validateHistoricalArchive
} = require('../../scripts/newsroom/validate/historical-archive');
const {
  readJson,
  tempRoot,
  writeJson,
  writeText
} = require('../helpers/fs');

function writePublicIssue(root, date, text = '') {
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), [
    '# Camera HAL SW Newsletter',
    '',
    text || 'Historical public newsletter body.',
    ''
  ].join('\n'));
  writeText(path.join(root, 'newsletters', date, 'index.html'), [
    '<!doctype html>',
    '<html><body>',
    text || 'Historical public newsletter body.',
    '</body></html>'
  ].join('\n'));
}

function writeNewsroom(root, date) {
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), {
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
  writeText(path.join(root, 'docs', 'editorial', 'historical-newsletter-provenance-ledger.md'), [
    '# Historical Newsletter Provenance Ledger',
    '',
    tableRows(ledgerDates),
    ''
  ].join('\n'));
  writeText(path.join(root, 'docs', 'editorial', 'existing-newsletter-quality-inventory.md'), [
    '# Existing Newsletter Quality Inventory',
    '',
    tableRows(inventoryDates),
    ''
  ].join('\n'));
  writeText(path.join(root, 'docs', 'editorial', 'existing-newsletter-quality-cleanup-report.md'), [
    '# Existing Newsletter Quality Cleanup Report',
    '',
    tableRows(cleanupDates),
    ''
  ].join('\n'));
}

function writeNewsletterIndex(root, dates) {
  writeJson(path.join(root, 'data', 'newsletters.json'), dates.map(date => ({
    date,
    title: `Newsletter ${date}`,
    summary: 'Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL']
  })));
}

function writeStatus(root, entries) {
  writeJson(path.join(root, 'content', 'audit', 'historical-archive-status.json'), entries);
}

function statusEntry(date, overrides = {}) {
  return {
    date,
    archive_status: 'historical_unreviewed',
    historical_cleanup_reviewed: false,
    known_limitations: ['historical_cleanup_pending'],
    historical_cleanup_issue: '#108',
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
  assert.equal(entry.historical_cleanup_issue, '#108');
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
  assert.match(result.errors.join('\n'), /Public newsletter artifact 2026-05-06 has no content\/audit\/historical-archive-status\.json status entry/);
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
  assert.match(result.errors.join('\n'), /historical-newsletter-provenance-ledger\.md/);

  const audit = auditHistoricalArchive({ root, writeReports: false });
  assert.equal(audit.ok, false);
  assert.equal(audit.report.validation_error_count > 0, true);
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
  assert.match(result.errors.join('\n'), /existing-newsletter-quality-cleanup-report\.md/);
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
  assert.match(result.errors.join('\n'), /Removed archive 2026-05-05 must not remain in data\/newsletters\.json/);
  assert.match(result.errors.join('\n'), /Removed archive 2026-05-05 still has newsletters\/2026-05-05 artifacts/);
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
  assert.match(result.errors.join('\n'), /Pre-#185 public article 2026-05-05 contains seed evidence workflow provenance wording/);
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
  assert.match(result.errors.join('\n'), /Material rewrite 2026-05-05 must declare material_rewrite_diff/);
});

test('historical archive validator requires material rewrite diff slug to match an article heading', () => {
  const root = tempRoot('historical-archive-material-rewrite-slug-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date, '## 2. libcamera v0.7.1 release\n\nHistorical article body.');
  writeArchiveDocs(root, [date]);
  writeText(
    path.join(root, 'content', 'audit', 'historical-rewrite-diff', '2026-05-05-unrelated-article.md'),
    '# Rewrite diff\n'
  );
  writeStatus(root, [
    statusEntry(date, {
      rewrite_status: 'material_rewrite',
      material_rewrite_diff: 'content/audit/historical-rewrite-diff/2026-05-05-unrelated-article.md'
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
  const diffPath = 'content/audit/historical-rewrite-diff/2026-05-05-firebase-ai-logic-camera-hal-npu-gpu.md';
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

test('historical archive validator rejects forbidden public article provenance in good fixtures', () => {
  const root = tempRoot('historical-archive-good-fixture-provenance-');
  const date = '2026-05-05';
  writeNewsletterIndex(root, [date]);
  writePublicIssue(root, date);
  writeArchiveDocs(root, [date]);
  writeStatus(root, [statusEntry(date)]);
  writeJson(path.join(root, 'tests', 'fixtures', 'quality', 'good', 'historical-public-article.json'), {
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
