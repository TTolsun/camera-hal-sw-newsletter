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
  if (typeof entry?.historical_cleanup_context !== 'string' || !entry.historical_cleanup_context.trim()) {
    errors.push(`${label} must declare historical_cleanup_context.`);
  }
  if (entry?.historical_cleanup_issue !== undefined) {
    errors.push(`${label} must not use historical_cleanup_issue; use historical_cleanup_context.`);
  }
  if (entry?.archive_status === 'deprecated_archive' && (!Array.isArray(entry.known_limitations) || entry.known_limitations.length === 0)) {
    errors.push(`${label} deprecated_archive entries must include at least one known_limitations item.`);
  }
  if (entry?.historical_cleanup_context === 'review_only_publication' && !hasKnownLimitation(entry, 'review_only_publication')) {
    errors.push(`${label} review_only_publication entries must include known_limitations=review_only_publication.`);
  }
  if (hasKnownLimitation(entry, 'review_only_publication') && entry?.historical_cleanup_context !== 'review_only_publication') {
    errors.push(`${label} known_limitations=review_only_publication requires historical_cleanup_context=review_only_publication.`);
  }
  if (entry?.historical_cleanup_context === 'current_generation_archive_review' &&
    Array.isArray(entry.known_limitations) &&
    entry.known_limitations.length > 0) {
    errors.push(`${label} current_generation_archive_review entries must not declare known_limitations.`);
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

function parseRewriteDiffPath(relPath) {
  const normalized = toPosix(relPath);
  const match = normalized.match(/^content\/audit\/historical-rewrite-diff\/(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)\.md$/);
  if (!match) {
    return null;
  }
  const [, date, slug] = match;
  return { normalized, date, slug };
}

function validateRewriteDiffPath(root, relPath, sidecarDates, errors) {
  const parsed = parseRewriteDiffPath(relPath);
  if (!parsed) {
    errors.push(`Historical rewrite diff path must use ${REWRITE_DIFF_PREFIX}<date>-<slug>.md: ${relPath}`);
    return null;
  }
  const { normalized, date, slug } = parsed;
  if (!sidecarDates.has(date)) {
    errors.push(`Historical rewrite diff references unknown archive date ${date}: ${relPath}`);
  } else if (!articleSlugExists(root, date, slug)) {
    errors.push(`Historical rewrite diff references unknown article slug ${slug} for ${date}: ${relPath}`);
  }
  if (!fs.existsSync(repoPath(root, normalized))) {
    errors.push(`Historical rewrite diff is missing: ${normalized}`);
  }
  return parsed;
}

function materialRewriteDiffPaths(entry, date, errors) {
  const paths = [];
  if (entry.material_rewrite_diff) {
    if (typeof entry.material_rewrite_diff !== 'string') {
      errors.push(`Material rewrite ${date} material_rewrite_diff must be a string.`);
    } else {
      paths.push(entry.material_rewrite_diff);
    }
  }
  if (entry.material_rewrite_diffs !== undefined) {
    if (!Array.isArray(entry.material_rewrite_diffs)) {
      errors.push(`Material rewrite ${date} material_rewrite_diffs must be an array.`);
    } else {
      for (const relPath of entry.material_rewrite_diffs) {
        if (typeof relPath !== 'string' || !relPath.trim()) {
          errors.push(`Material rewrite ${date} material_rewrite_diffs must contain non-empty string paths.`);
        } else {
          paths.push(relPath);
        }
      }
      if (
        typeof entry.material_rewrite_diff === 'string' &&
        !entry.material_rewrite_diffs.includes(entry.material_rewrite_diff)
      ) {
        errors.push(`Material rewrite ${date} material_rewrite_diff must be included in material_rewrite_diffs.`);
      }
    }
  }
  return [...new Set(paths)];
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
      const diffPaths = materialRewriteDiffPaths(entry, date, errors);
      if (diffPaths.length === 0) {
        errors.push(`Material rewrite ${date} must declare material_rewrite_diff or material_rewrite_diffs.`);
      }
      for (const relPath of diffPaths) {
        const diff = validateRewriteDiffPath(root, relPath, new Set(archiveState.sidecarDates), errors);
        if (diff && diff.date !== date) {
          errors.push(`Material rewrite diff date ${diff.date} must match sidecar entry date ${date}.`);
        }
      }
    }
    if (isPre185Entry(entry) && publicDates.has(date)) {
      const publicText = readPublicArticleText(root, date);
      if (FAKE_SEED_PROVENANCE_PATTERN.test(publicText)) {
        errors.push(`Pre-seed-evidence public article ${date} contains seed evidence workflow provenance wording.`);
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

function splitMarkdownTableRow(line = '') {
  const trimmed = String(line).trim();
  const body = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  let escaped = false;
  for (const char of body) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseInventoryTableRows(inventoryText = '') {
  return String(inventoryText)
    .split(/\r?\n/)
    .filter(line => /^\|\s*(?:\d{4}-\d{2}-\d{2}|Date)\s*\|/.test(line))
    .filter(line => !/^\|\s*Date\s*\|/.test(line))
    .map(line => splitMarkdownTableRow(line))
    .filter(cells => cells.length >= 13)
    .map(cells => ({
      date: cells[0],
      article_title: cells[1],
      article_slug: cells[2],
      source_url_present: cells[3],
      source_backed_fact_present: cells[4],
      hal_relevance: cells[5],
      action_item_specificity: cells[6],
      overclaim_risk: cells[7],
      format_consistency: cells[8],
      current_quality_status: cells[9],
      recommended_decision: cells[10],
      severity: cells[11],
      review_note: cells[12]
    }));
}

function isRemovedInventoryRow(row = {}) {
  return row.current_quality_status === 'removed' ||
    row.recommended_decision === 'delete_completed';
}

function isFinalReviewedInventoryRow(row = {}) {
  return row.current_quality_status === 'reviewed_archive' &&
    row.recommended_decision === 'keep' &&
    row.severity === 'none';
}

function hasAcceptedLimitation(row = {}) {
  return isFinalReviewedInventoryRow(row) && /accepted historical limitation/i.test(row.review_note || '');
}

function buildInventoryFinalMetrics(inventoryText = '') {
  const rows = parseInventoryTableRows(inventoryText);
  const retainedRows = rows.filter(row => !isRemovedInventoryRow(row));
  const removedRows = rows.filter(isRemovedInventoryRow);
  const reviewedRows = retainedRows.filter(isFinalReviewedInventoryRow);
  const acceptedLimitationRows = retainedRows.filter(hasAcceptedLimitation);
  const remainingRewriteRows = retainedRows.filter(row => [
    'rewrite_review',
    'downgrade_review',
    'archive_note_review'
  ].includes(row.recommended_decision));
  const remainingS0S1Rows = retainedRows.filter(row => ['S0', 'S1'].includes(row.severity));
  const remainingSourceGapRows = retainedRows.filter(row =>
    row.source_url_present === 'no' || row.source_backed_fact_present === 'no'
  );
  const remainingOverclaimRows = retainedRows.filter(row => {
    if (row.overclaim_risk === 'high') return true;
    if (row.overclaim_risk === 'medium') return !hasAcceptedLimitation(row);
    return false;
  });
  const remainingWeakActionabilityRows = retainedRows.filter(row => {
    if (row.action_item_specificity === 'none') return true;
    if (row.action_item_specificity === 'generic') return !hasAcceptedLimitation(row);
    return false;
  });
  const acceptedLimitationCounts = {
    partial_source_backing: retainedRows.filter(row =>
      row.source_backed_fact_present === 'partial' && hasAcceptedLimitation(row)
    ).length,
    generic_actionability: retainedRows.filter(row =>
      row.action_item_specificity === 'generic' && hasAcceptedLimitation(row)
    ).length,
    medium_overclaim: retainedRows.filter(row =>
      row.overclaim_risk === 'medium' && hasAcceptedLimitation(row)
    ).length,
    weak_format: retainedRows.filter(row =>
      row.format_consistency === 'weak' && hasAcceptedLimitation(row)
    ).length
  };

  return {
    total_article_rows: rows.length,
    retained_article_rows: retainedRows.length,
    removed_article_rows: removedRows.length,
    reviewed_article_rows: reviewedRows.length,
    accepted_limitation_rows: acceptedLimitationRows.length,
    accepted_limitation_counts: acceptedLimitationCounts,
    remaining_s0_s1_rows: remainingS0S1Rows.length,
    remaining_rewrite_downgrade_archive_note_rows: remainingRewriteRows.length,
    remaining_source_gap_count: remainingSourceGapRows.length,
    remaining_overclaim_risk_count: remainingOverclaimRows.length,
    remaining_weak_actionability_count: remainingWeakActionabilityRows.length
  };
}

function buildMaterialRewriteTraceability(entries = []) {
  return entries
    .filter(entry => entry?.rewrite_status === MATERIAL_REWRITE_STATUS)
    .map(entry => {
      const paths = materialRewriteDiffPaths(entry, entry.date, []);
      return {
        date: entry.date,
        rewrite_count: paths.length,
        diff_artifacts: paths
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
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
  const archiveStatusCounts = countBy(state.sidecarEntries, 'archive_status');
  const publicVisibilityCounts = countBy(state.sidecarEntries, 'public_visibility');
  const inventoryMetrics = buildInventoryFinalMetrics(state.inventoryText);
  const finalDecision = {
    archive_trust_complete: validation.errors.length === 0 &&
      (archiveStatusCounts.historical_unreviewed || 0) === 0 &&
      (inventoryMetrics.remaining_s0_s1_rows || 0) === 0 &&
      (inventoryMetrics.remaining_rewrite_downgrade_archive_note_rows || 0) === 0 &&
      (inventoryMetrics.remaining_source_gap_count || 0) === 0 &&
      (inventoryMetrics.remaining_overclaim_risk_count || 0) === 0 &&
      (inventoryMetrics.remaining_weak_actionability_count || 0) === 0,
    reason: 'No unresolved S0/S1 rows, rewrite/downgrade/archive-note rows, source gaps, overclaim risks, or weak actionability rows remain after accepted historical limitations are recorded.'
  };

  return {
    schema_version: 1,
    report_type: 'historical_newsletter_audit',
    source_of_truth: DEFAULT_SIDECAR_PATH,
    data_newsletter_count: state.activeDates.length,
    public_artifact_count: state.publicDates.length,
    newsroom_artifact_count: state.newsroomDates.length,
    sidecar_entry_count: state.sidecarEntries.length,
    archive_status_counts: archiveStatusCounts,
    public_visibility_counts: publicVisibilityCounts,
    orphan_public_dates: state.publicDates.filter(date => !activeDates.has(date)),
    newsroom_only_dates: newsroomOnlyDates,
    unlisted_reviewed_archive_dates: state.sidecarEntries
      .filter(entry => entry.archive_status === 'reviewed_archive' && entry.public_visibility === 'unlisted')
      .map(entry => entry.date)
      .sort(),
    inventory_metrics: inventoryMetrics,
    material_rewrite_traceability: buildMaterialRewriteTraceability(state.sidecarEntries),
    historical_content_normalizations: state.sidecarDates.includes('2026-05-11') ? [
      {
        date: '2026-05-11',
        type: 'global_action_item_normalization',
        note: '2026-05-11 received date-level global action item normalization. No article-level material rewrite diff was added because article body meaning did not change; the change is recorded in the final archive trust report.'
      }
    ] : [],
    final_decision: finalDecision,
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
        historical_cleanup_context: isNewsroomOnly ? 'non_public_newsroom_artifact' : entry.historical_cleanup_context || ''
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
  const inventory = report.inventory_metrics || {};
  const accepted = inventory.accepted_limitation_counts || {};
  const rewriteTraceability = Array.isArray(report.material_rewrite_traceability)
    ? report.material_rewrite_traceability
    : [];
  const normalizations = Array.isArray(report.historical_content_normalizations)
    ? report.historical_content_normalizations
    : [];

  return [
    '# 기존 뉴스레터 품질 Cleanup Report',
    '',
    '이 문서는 unsupported seed evidence provenance를 사후 보강하지 않고 historical public archive cleanup 상태만 추적합니다.',
    '',
    '## Final Archive Trust Summary',
    '',
    '### Date-level status',
    '',
    `- reviewed archive dates: ${reviewedCount}`,
    `- removed archive dates: ${removedCount}`,
    `- historical unreviewed dates: ${unreviewedCount}`,
    `- deprecated archive dates: ${deprecatedCount}`,
    `- data/newsletters.json에 없는 public artifact 날짜: ${report.orphan_public_dates.length}`,
    `- content/newsroom 전용 날짜: ${report.newsroom_only_dates.length}`,
    '',
    '### Article-level status',
    '',
    `- reviewed article rows: ${inventory.reviewed_article_rows || 0}`,
    `- removed article rows: ${inventory.removed_article_rows || 0}`,
    `- accepted limitation rows: ${inventory.accepted_limitation_rows || 0}`,
    `- remaining S0/S1 rows: ${inventory.remaining_s0_s1_rows || 0}`,
    `- remaining rewrite/downgrade/archive-note rows: ${inventory.remaining_rewrite_downgrade_archive_note_rows || 0}`,
    `- remaining source gap rows: ${inventory.remaining_source_gap_count || 0}`,
    `- remaining overclaim risk rows: ${inventory.remaining_overclaim_risk_count || 0}`,
    `- remaining weak actionability rows: ${inventory.remaining_weak_actionability_count || 0}`,
    '',
    '## Final Review Transition Rule',
    '',
    '- A retained article row is final-reviewed only when no rewrite/downgrade/archive-note decision remains.',
    '- `medium` overclaim, `partial` source-backed coverage, `generic` actionability, and weak historical format are allowed only as accepted historical limitations recorded in this report.',
    '- A retained date becomes `reviewed_archive` only when every retained article row for that date is final-reviewed or explicitly covered by accepted limitations.',
    '',
    '## Final Metric Policy',
    '',
    '- `remaining_source_gap_count` counts rows with `source_url_present=no` or `source_backed_fact_present=no`.',
    '- `source_backed_fact_present=partial` is not counted as a remaining source gap when recorded as an accepted historical limitation.',
    '- `remaining_overclaim_risk_count` counts unresolved `high` or unresolved `medium` overclaim risk.',
    '- `remaining_weak_actionability_count` counts unresolved `none` or unresolved `generic` actionability.',
    '',
    '## Remaining Accepted Limitations',
    '',
    '- Pre-seed-evidence generation: source provenance was not backfilled.',
    `- Partial source-backed coverage rows retained as accepted limitations: ${accepted.partial_source_backing || 0}`,
    `- Generic actionability rows retained as accepted limitations: ${accepted.generic_actionability || 0}`,
    `- Medium overclaim rows retained as accepted limitations: ${accepted.medium_overclaim || 0}`,
    `- Weak historical format rows retained as accepted limitations: ${accepted.weak_format || 0}`,
    '',
    '### Unlisted reviewed archives',
    '',
    'These remain unlisted because they are absent from `data/newsletters.json`. This final trust report reviews their artifact quality but does not change public index visibility.',
    '',
    markdownList(report.unlisted_reviewed_archive_dates || []),
    '',
    '## Historical Content Normalizations',
    '',
    normalizations.length > 0
      ? normalizations.map(item => `- ${item.note}`).join('\n')
      : '- none',
    '',
    '## Material Rewrite Traceability',
    '',
    '| Date | Rewrite count | Diff artifacts |',
    '| --- | ---: | --- |',
    ...rewriteTraceability.map(item => [
      item.date,
      item.rewrite_count,
      item.diff_artifacts.map(diffPath => `\`${diffPath}\``).join('<br>')
    ].map(value => String(value).replace(/\|/g, '\\|')).join(' | ')).map(row => `| ${row} |`),
    '',
    '## Validation Status',
    '',
    `- validation errors: ${report.validation_error_count}`,
    `- validation warnings: ${report.validation_warning_count}`,
    '',
    '## Final Decision',
    '',
    report.final_decision?.archive_trust_complete
      ? 'Archive trust cleanup is complete because no unresolved S0/S1 rows remain, all material rewrites have diff artifacts, pre-seed-evidence provenance was not backfilled, and final validation passed.'
      : 'Archive trust cleanup is not complete because unresolved archive trust blockers remain.',
    '',
    '## Archive Entries',
    '',
    '| Date | Artifact scope | Archive status | Public visibility | Data index | Public artifact | Known limitations | Cleanup context |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.entries.map(entry => [
      entry.date,
      entry.artifact_scope || 'public_archive',
      entry.archive_status || 'none',
      entry.public_visibility,
      entry.in_data_newsletters ? 'yes' : 'no',
      entry.has_public_artifact ? 'yes' : 'no',
      entry.known_limitations.join(', ') || 'none',
      entry.historical_cleanup_context || 'none'
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
    'These dates have `content/newsroom/YYYY-MM-DD/` artifacts but no public newsletter artifact. They are not public archive entries and are not subject to public archive cleanup.',
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
  buildInventoryFinalMetrics,
  buildCleanupReportMarkdown,
  collectHistoricalArchiveState,
  parseInventoryTableRows,
  validateHistoricalArchive,
  writeAuditReports
};
