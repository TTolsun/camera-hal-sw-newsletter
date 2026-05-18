const fs = require('fs');
const path = require('path');

const {
  readJson,
  writeJson
} = require('../common/common');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ARCHIVE_STATUSES = new Set([
  'stable_archive',
  'reviewed_archive',
  'historical_unreviewed',
  'deprecated_archive',
  'removed'
]);

const PUBLIC_VISIBILITIES = new Set([
  'listed',
  'unlisted',
  'removed'
]);

const MATERIAL_REWRITE_STATUS = 'material_rewrite';
const REWRITE_DIFF_PREFIX = 'content/audit/historical-rewrite-diff/';
const FAKE_SEED_PROVENANCE_PATTERN = /\b(?:seed_evidence|seed-evidence-pack|seed_url|linked_evidence|compact_evidence|source_provenance)\b|Evidence Pack/;
const FORBIDDEN_GOOD_FIXTURE_PROVENANCE = new Set([
  'historically_rewritten_public_article',
  'pre_185_generated_public_article',
  'generated_newsletter_public_article'
]);

const DEFAULT_SIDECAR_PATH = 'content/audit/historical-archive-status.json';
const DEFAULT_AUDIT_REPORT_PATH = 'content/audit/historical-newsletter-audit-report.json';
const DEFAULT_CLEANUP_REPORT_PATH = 'docs/editorial/existing-newsletter-quality-cleanup-report.md';
const DEFAULT_LEDGER_PATH = 'docs/editorial/historical-newsletter-provenance-ledger.md';
const DEFAULT_INVENTORY_PATH = 'docs/editorial/existing-newsletter-quality-inventory.md';

function toPosix(value = '') {
  return String(value).replace(/\\/g, '/');
}

function repoPath(root, relPath) {
  return path.join(root, relPath);
}

function readJsonResult(root, relPath) {
  const filePath = repoPath(root, relPath);
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      value: null,
      error: null,
      relPath
    };
  }
  try {
    return {
      exists: true,
      value: readJson(filePath),
      error: null,
      relPath
    };
  } catch (error) {
    return {
      exists: true,
      value: null,
      error,
      relPath
    };
  }
}

function readTextIfExists(root, relPath) {
  const filePath = repoPath(root, relPath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function listDateDirs(root, relDir) {
  const dir = repoPath(root, relDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && DATE_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .sort();
}

function listFilesRecursive(root, relDir, extension = '') {
  const dir = repoPath(root, relDir);
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = toPosix(path.join(relDir, entry.name));
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(root, relPath, extension));
    } else if (!extension || entry.name.endsWith(extension)) {
      results.push(relPath);
    }
  }
  return results.sort();
}

function listPublicDates(root) {
  return listDateDirs(root, 'newsletters')
    .filter(date => {
      const dir = repoPath(root, path.join('newsletters', date));
      return fs.existsSync(path.join(dir, 'newsletter.md')) ||
        fs.existsSync(path.join(dir, 'index.html'));
    });
}

function listRewriteDiffs(root) {
  const dir = repoPath(root, REWRITE_DIFF_PREFIX);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => `${REWRITE_DIFF_PREFIX}${entry.name}`)
    .sort();
}

function normalizeNewsletterItems(value) {
  return Array.isArray(value) ? value : [];
}

function collectHistoricalArchiveState({ root = process.cwd() } = {}) {
  const dataResult = readJsonResult(root, 'data/newsletters.json');
  const sidecarResult = readJsonResult(root, DEFAULT_SIDECAR_PATH);
  const newsletterItems = normalizeNewsletterItems(dataResult.value);
  const activeDates = newsletterItems
    .map(item => String(item?.date || ''))
    .filter(date => DATE_PATTERN.test(date));
  const publicDates = listPublicDates(root);
  const newsroomDates = listDateDirs(root, 'content/newsroom');
  const rewriteDiffs = listRewriteDiffs(root);
  const fixtureFiles = listFilesRecursive(root, 'tests/fixtures', '.json');
  const sidecarEntries = Array.isArray(sidecarResult.value) ? sidecarResult.value : [];
  const sidecarDates = sidecarEntries
    .map(entry => String(entry?.date || ''))
    .filter(Boolean);
  const ledgerText = readTextIfExists(root, DEFAULT_LEDGER_PATH);
  const cleanupReportText = readTextIfExists(root, DEFAULT_CLEANUP_REPORT_PATH);
  const inventoryText = readTextIfExists(root, DEFAULT_INVENTORY_PATH);

  return {
    root,
    dataResult,
    sidecarResult,
    newsletterItems,
    activeDates,
    publicDates,
    newsroomDates,
    rewriteDiffs,
    fixtureFiles,
    sidecarEntries,
    sidecarDates,
    ledgerText,
    cleanupReportText,
    inventoryText
  };
}

function hasKnownLimitation(entry, value) {
  return Array.isArray(entry?.known_limitations) && entry.known_limitations.includes(value);
}

function isPre185Entry(entry) {
  return entry?.original_generation_mode === 'pre_185' ||
    hasKnownLimitation(entry, 'pre_185_generation');
}

function sidecarEntryByDate(entries) {
  const map = new Map();
  const duplicates = new Set();
  for (const entry of entries) {
    const date = String(entry?.date || '');
    if (!date) continue;
    if (map.has(date)) duplicates.add(date);
    map.set(date, entry);
  }
  return { map, duplicates };
}

function ledgerReferenceExists(state, date) {
  return state.ledgerText.includes(date);
}

function cleanupReportReferenceExists(state, date) {
  return state.cleanupReportText.includes(date);
}

function readPublicArticleText(root, date) {
  return [
    `newsletters/${date}/newsletter.md`,
    `newsletters/${date}/index.html`
  ].map(relPath => readTextIfExists(root, relPath)).join('\n');
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ');
}

function slugifyArticleText(value) {
  return stripHtml(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function articleHeadingSlugs(root, date) {
  const text = readPublicArticleText(root, date);
  const slugs = new Set();
  for (const line of text.split(/\r?\n/)) {
    const markdownHeading = line.match(/^#{2,3}\s+(.+)$/);
    if (markdownHeading) {
      const heading = markdownHeading[1].replace(/^\d+\.\s+/, '');
      const slug = slugifyArticleText(heading);
      if (slug) slugs.add(slug);
    }
  }
  for (const match of text.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)) {
    const heading = stripHtml(match[1]).replace(/^\d+\.\s+/, '');
    const slug = slugifyArticleText(heading);
    if (slug) slugs.add(slug);
  }
  return slugs;
}

function articleSlugExists(root, date, slug) {
  const normalizedSlug = slugifyArticleText(slug);
  if (!normalizedSlug) return false;
  return articleHeadingSlugs(root, date).has(normalizedSlug);
}

function hasPathSegment(relPath, segment) {
  return toPosix(relPath).split('/').includes(segment);
}

function fixtureProvenanceValues(entry = {}) {
  return [
    entry.source,
    entry.provenance,
    entry.metadata?.source,
    entry.metadata?.provenance,
    entry.fixture_meta?.provenance
  ].filter(Boolean);
}

function validateFixturePublicArticleProvenance(root, relPath, errors) {
  if (!hasPathSegment(relPath, 'good') && !hasPathSegment(relPath, 'golden')) return;
  const result = readJsonResult(root, relPath);
  if (result.error || !result.value || typeof result.value !== 'object') return;
  const forbiddenValue = fixtureProvenanceValues(result.value)
    .find(value => FORBIDDEN_GOOD_FIXTURE_PROVENANCE.has(value));
  if (forbiddenValue) {
    errors.push(`${relPath} must not use historical/generated public article provenance in good/golden fixtures: ${forbiddenValue}`);
  }
}

function validateSidecarEntry(entry, index, state, errors) {
  const label = `${DEFAULT_SIDECAR_PATH}[${index}]`;
  const date = String(entry?.date || '');
  if (!DATE_PATTERN.test(date)) {
    errors.push(`${label} must include a valid date.`);
  }
  if (!ARCHIVE_STATUSES.has(entry?.archive_status)) {
    errors.push(`${label} has invalid archive_status: ${entry?.archive_status || 'missing'}.`);
  }
  if (!PUBLIC_VISIBILITIES.has(entry?.public_visibility)) {
    errors.push(`${label} has invalid public_visibility: ${entry?.public_visibility || 'missing'}.`);
  }
  if (typeof entry?.historical_cleanup_reviewed !== 'boolean') {
    errors.push(`${label} must declare historical_cleanup_reviewed as a boolean.`);
  }
  if (!Array.isArray(entry?.known_limitations)) {
    errors.push(`${label} must declare known_limitations as an array.`);
  }
  if (typeof entry?.historical_cleanup_issue !== 'string' || !entry.historical_cleanup_issue.trim()) {
    errors.push(`${label} must declare historical_cleanup_issue.`);
  }
  if (entry?.archive_status === 'deprecated_archive' && (!Array.isArray(entry.known_limitations) || entry.known_limitations.length === 0)) {
    errors.push(`${label} deprecated_archive entries must include at least one known_limitations item.`);
  }
  if (entry?.archive_status === 'removed' && entry?.public_visibility !== 'removed') {
    errors.push(`${label} removed archives must use public_visibility=removed.`);
  }
  if (entry?.public_visibility === 'removed' && entry?.archive_status !== 'removed') {
    errors.push(`${label} public_visibility=removed requires archive_status=removed.`);
  }
  if (date && !ledgerReferenceExists(state, date)) {
    errors.push(`${label} date ${date} must be referenced by ${DEFAULT_LEDGER_PATH}.`);
  }
  if (date && entry?.archive_status !== 'stable_archive' && !cleanupReportReferenceExists(state, date)) {
    errors.push(`${label} date ${date} must be summarized by ${DEFAULT_CLEANUP_REPORT_PATH}.`);
  }
}

function validateRewriteDiffPath(root, relPath, sidecarDates, errors) {
  const normalized = toPosix(relPath);
  const match = normalized.match(/^content\/audit\/historical-rewrite-diff\/(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)\.md$/);
  if (!match) {
    errors.push(`Historical rewrite diff path must use ${REWRITE_DIFF_PREFIX}<date>-<slug>.md: ${relPath}`);
    return;
  }
  const [, date, slug] = match;
  if (!sidecarDates.has(date)) {
    errors.push(`Historical rewrite diff references unknown archive date ${date}: ${relPath}`);
  } else if (!articleSlugExists(root, date, slug)) {
    errors.push(`Historical rewrite diff references unknown article slug ${slug} for ${date}: ${relPath}`);
  }
  if (!fs.existsSync(repoPath(root, normalized))) {
    errors.push(`Historical rewrite diff is missing: ${normalized}`);
  }
}

function validateHistoricalArchive({ root = process.cwd(), state = null } = {}) {
  const archiveState = state || collectHistoricalArchiveState({ root });
  const errors = [];
  const warnings = [];

  if (!archiveState.dataResult.exists) {
    errors.push('Missing data/newsletters.json.');
  } else if (archiveState.dataResult.error) {
    errors.push(`Invalid JSON in data/newsletters.json: ${archiveState.dataResult.error.message}`);
  } else if (!Array.isArray(archiveState.dataResult.value)) {
    errors.push('data/newsletters.json must contain an array.');
  }

  if (!archiveState.sidecarResult.exists) {
    errors.push(`Missing ${DEFAULT_SIDECAR_PATH}.`);
  } else if (archiveState.sidecarResult.error) {
    errors.push(`Invalid JSON in ${DEFAULT_SIDECAR_PATH}: ${archiveState.sidecarResult.error.message}`);
  } else if (!Array.isArray(archiveState.sidecarResult.value)) {
    errors.push(`${DEFAULT_SIDECAR_PATH} must contain an array.`);
  }

  const activeDates = new Set(archiveState.activeDates);
  const publicDates = new Set(archiveState.publicDates);
  const newsroomDates = new Set(archiveState.newsroomDates);
  const { map: sidecarByDate, duplicates } = sidecarEntryByDate(archiveState.sidecarEntries);

  for (const date of duplicates) {
    errors.push(`${DEFAULT_SIDECAR_PATH} must contain exactly one entry for ${date}.`);
  }

  archiveState.sidecarEntries.forEach((entry, index) => validateSidecarEntry(entry, index, archiveState, errors));

  for (const date of activeDates) {
    const entry = sidecarByDate.get(date);
    if (!entry) {
      errors.push(`Active data/newsletters.json entry ${date} has no ${DEFAULT_SIDECAR_PATH} status entry.`);
      continue;
    }
    if (entry.public_visibility !== 'listed') {
      errors.push(`Active data/newsletters.json entry ${date} must use public_visibility=listed.`);
    }
    if (entry.archive_status === 'removed') {
      errors.push(`Removed archive ${date} must not remain in data/newsletters.json.`);
    }
  }

  for (const date of publicDates) {
    const entry = sidecarByDate.get(date);
    if (!entry) {
      errors.push(`Public newsletter artifact ${date} has no ${DEFAULT_SIDECAR_PATH} status entry.`);
      continue;
    }
    if (entry.public_visibility === 'removed' || entry.archive_status === 'removed') {
      errors.push(`Removed archive ${date} must not keep public newsletter artifacts.`);
    }
  }

  for (const entry of archiveState.sidecarEntries) {
    const date = String(entry?.date || '');
    if (!DATE_PATTERN.test(date)) continue;
    if (entry.archive_status === 'removed') {
      if (activeDates.has(date)) errors.push(`Removed archive ${date} is still exposed in data/newsletters.json.`);
      if (publicDates.has(date)) errors.push(`Removed archive ${date} still has newsletters/${date} artifacts.`);
      if (newsroomDates.has(date)) errors.push(`Removed archive ${date} still has content/newsroom/${date} artifacts.`);
    }
    if (entry.public_visibility === 'listed' && !activeDates.has(date)) {
      errors.push(`Sidecar entry ${date} is listed but missing from data/newsletters.json.`);
    }
    if (entry.public_visibility === 'unlisted' && activeDates.has(date)) {
      errors.push(`Sidecar entry ${date} is unlisted but still exposed in data/newsletters.json.`);
    }
    if (!activeDates.has(date) && !publicDates.has(date) && newsroomDates.has(date) && entry.archive_status !== 'removed') {
      errors.push(`Sidecar entry ${date} points to a non-public newsroom artifact; newsroom-only artifacts are audit report only.`);
    }
    if (!activeDates.has(date) && !publicDates.has(date) && !newsroomDates.has(date) && entry.archive_status !== 'removed') {
      errors.push(`Sidecar entry ${date} has no matching public or newsroom artifact.`);
    }
    if (entry.rewrite_status === MATERIAL_REWRITE_STATUS) {
      if (!entry.material_rewrite_diff) {
        errors.push(`Material rewrite ${date} must declare material_rewrite_diff.`);
      } else {
        validateRewriteDiffPath(root, entry.material_rewrite_diff, new Set(archiveState.sidecarDates), errors);
      }
    }
    if (isPre185Entry(entry) && publicDates.has(date)) {
      const publicText = readPublicArticleText(root, date);
      if (FAKE_SEED_PROVENANCE_PATTERN.test(publicText)) {
        errors.push(`Pre-#185 public article ${date} contains seed evidence workflow provenance wording.`);
      }
    }
  }

  for (const relPath of archiveState.rewriteDiffs) {
    validateRewriteDiffPath(root, relPath, new Set(archiveState.sidecarDates), errors);
  }

  for (const relPath of archiveState.fixtureFiles) {
    validateFixturePublicArticleProvenance(root, relPath, errors);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    state: archiveState
  };
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item?.[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function buildAuditReport(validation) {
  const state = validation.state;
  const activeDates = new Set(state.activeDates);
  const publicDates = new Set(state.publicDates);
  const newsroomDates = new Set(state.newsroomDates);
  const sidecarByDate = new Map(state.sidecarEntries.map(entry => [entry.date, entry]));
  const newsroomOnlyDates = state.newsroomDates.filter(date => !activeDates.has(date) && !publicDates.has(date));
  const allDates = [...new Set([
    ...state.activeDates,
    ...state.publicDates,
    ...state.newsroomDates,
    ...state.sidecarDates
  ])].filter(date => DATE_PATTERN.test(date)).sort().reverse();

  return {
    schema_version: 1,
    report_type: 'historical_newsletter_audit',
    source_of_truth: DEFAULT_SIDECAR_PATH,
    data_newsletter_count: state.activeDates.length,
    public_artifact_count: state.publicDates.length,
    newsroom_artifact_count: state.newsroomDates.length,
    sidecar_entry_count: state.sidecarEntries.length,
    archive_status_counts: countBy(state.sidecarEntries, 'archive_status'),
    public_visibility_counts: countBy(state.sidecarEntries, 'public_visibility'),
    orphan_public_dates: state.publicDates.filter(date => !activeDates.has(date)),
    newsroom_only_dates: newsroomOnlyDates,
    validation_error_count: validation.errors.length,
    validation_warning_count: validation.warnings.length,
    validation_errors: validation.errors,
    validation_warnings: validation.warnings,
    entries: allDates.map(date => {
      const entry = sidecarByDate.get(date) || {};
      const isNewsroomOnly = newsroomOnlyDates.includes(date) && !sidecarByDate.has(date);
      return {
        date,
        artifact_scope: isNewsroomOnly ? 'non_public_newsroom_artifact' : 'public_archive',
        in_data_newsletters: activeDates.has(date),
        has_public_artifact: publicDates.has(date),
        has_newsroom_artifact: newsroomDates.has(date),
        archive_status: isNewsroomOnly ? null : entry.archive_status || 'unclassified',
        public_visibility: isNewsroomOnly ? 'not_public' : entry.public_visibility || 'unclassified',
        historical_cleanup_reviewed: entry.historical_cleanup_reviewed === true,
        known_limitations: Array.isArray(entry.known_limitations) ? entry.known_limitations : [],
        historical_cleanup_issue: isNewsroomOnly ? '#108' : entry.historical_cleanup_issue || ''
      };
    })
  };
}

function markdownList(items) {
  return items.length > 0 ? items.map(item => `- ${item}`).join('\n') : '- none';
}

function buildCleanupReportMarkdown(report) {
  const reviewedCount = report.entries.filter(entry => entry.archive_status === 'reviewed_archive' || entry.archive_status === 'stable_archive').length;
  const deprecatedCount = report.entries.filter(entry => entry.archive_status === 'deprecated_archive').length;
  const removedCount = report.entries.filter(entry => entry.archive_status === 'removed').length;
  const unreviewedCount = report.entries.filter(entry => entry.archive_status === 'historical_unreviewed').length;

  return [
    '# 기존 뉴스레터 품질 Cleanup Report',
    '',
    'Issue #108은 unsupported seed evidence provenance를 사후 보강하지 않고 historical public archive cleanup 상태만 추적합니다.',
    '',
    '## Historical Archive Trust Summary',
    '',
    `- reviewed archive: ${reviewedCount}`,
    `- deprecated archive: ${deprecatedCount}`,
    `- removed archive: ${removedCount}`,
    `- known unreviewed archive: ${unreviewedCount}`,
    `- data/newsletters.json에 없는 public artifact 날짜: ${report.orphan_public_dates.length}`,
    `- content/newsroom 전용 날짜: ${report.newsroom_only_dates.length}`,
    '',
    '## Validation Status',
    '',
    `- validation errors: ${report.validation_error_count}`,
    `- validation warnings: ${report.validation_warning_count}`,
    '',
    '## Archive Entries',
    '',
    '| Date | Artifact scope | Archive status | Public visibility | Data index | Public artifact | Known limitations | Issue |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.entries.map(entry => [
      entry.date,
      entry.artifact_scope || 'public_archive',
      entry.archive_status || 'none',
      entry.public_visibility,
      entry.in_data_newsletters ? 'yes' : 'no',
      entry.has_public_artifact ? 'yes' : 'no',
      entry.known_limitations.join(', ') || 'none',
      entry.historical_cleanup_issue || 'none'
    ].map(value => String(value).replace(/\|/g, '\\|')).join(' | ')).map(row => `| ${row} |`),
    '',
    '## data/newsletters.json에 없는 Public Dates',
    '',
    markdownList(report.orphan_public_dates),
    '',
    '## Non-public newsroom artifacts',
    '',
    '`not_public` is an audit report classification, not a `content/audit/historical-archive-status.json` sidecar enum value.',
    '',
    'These dates have `content/newsroom/YYYY-MM-DD/` artifacts but no public newsletter artifact. They are not public archive entries and are not subject to #108 public archive cleanup.',
    '',
    markdownList(report.newsroom_only_dates),
    ''
  ].join('\n');
}

function writeAuditReports({ root = process.cwd(), validation }) {
  const report = buildAuditReport(validation);
  writeJson(repoPath(root, DEFAULT_AUDIT_REPORT_PATH), report);
  fs.mkdirSync(path.dirname(repoPath(root, DEFAULT_CLEANUP_REPORT_PATH)), { recursive: true });
  fs.writeFileSync(repoPath(root, DEFAULT_CLEANUP_REPORT_PATH), buildCleanupReportMarkdown(report), 'utf8');
  return report;
}

function auditHistoricalArchive({ root = process.cwd(), writeReports = false } = {}) {
  const validation = validateHistoricalArchive({ root });
  if (writeReports) {
    writeAuditReports({ root, validation });
    const refreshedValidation = validateHistoricalArchive({ root });
    return {
      ...refreshedValidation,
      report: writeAuditReports({ root, validation: refreshedValidation })
    };
  }
  const report = buildAuditReport(validation);
  return {
    ...validation,
    report
  };
}

module.exports = {
  ARCHIVE_STATUSES,
  DEFAULT_AUDIT_REPORT_PATH,
  DEFAULT_CLEANUP_REPORT_PATH,
  DEFAULT_INVENTORY_PATH,
  DEFAULT_LEDGER_PATH,
  DEFAULT_SIDECAR_PATH,
  FAKE_SEED_PROVENANCE_PATTERN,
  FORBIDDEN_GOOD_FIXTURE_PROVENANCE,
  PUBLIC_VISIBILITIES,
  auditHistoricalArchive,
  buildAuditReport,
  buildCleanupReportMarkdown,
  collectHistoricalArchiveState,
  validateHistoricalArchive,
  writeAuditReports
};
