const { ensureArray } = require('../../shared/common/value-coercion');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  publicNewsletterPaths,
  publicNewsletterStructureStatus
} = require('./public-structure');

const {
  LEDGER_PATH: AUDIT_LEDGER_PATH
} = require('./audit-paths');

const PUBLIC_STATES = Object.freeze({
  PUBLISH_READY: 'PUBLISH_READY',
  REVIEW_ONLY_PUBLIC_CREATED: 'REVIEW_ONLY_PUBLIC_CREATED',
  DIAGNOSTICS_ONLY: 'DIAGNOSTICS_ONLY',
  DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC: 'DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC'
});

const RUN_MODES = Object.freeze({
  PUBLISH_READY: 'publish_ready',
  REVIEW_ONLY_PUBLIC: 'review_only_public',
  DIAGNOSTICS_ONLY: 'diagnostics_only',
  DIAGNOSTICS_ONLY_RETAINED_PUBLIC: 'diagnostics_only_retained_public'
});

const PUBLIC_ARTIFACT_POLICIES = Object.freeze({
  LATEST_PUBLIC_READY: 'latest_public_ready',
  LATEST_REVIEW_PUBLICATION_READY: 'latest_review_publication_ready',
  REVIEW_PUBLICATION_INVALID_PUBLIC_STRUCTURE: 'review_publication_invalid_public_structure',
  HIDE_EXISTING_PUBLIC_ARTIFACT_AFTER_LATEST_DIAGNOSTICS_ONLY:
    'hide_existing_public_artifact_after_latest_diagnostics_only',
  RETAIN_EXISTING_EDITOR_APPROVED_PUBLIC: 'retain_existing_editor_approved_public',
  INVALID_RETENTION_IGNORED: 'invalid_retention_ignored'
});

const RECONCILIATION_ACTIONS = Object.freeze({
  NONE_LATEST_PUBLIC_READY: 'none_latest_public_ready',
  UPSERTED_LATEST_PUBLIC_ENTRY: 'upserted_latest_public_entry',
  REMOVED_NEWSLETTERS_INDEX_ENTRY: 'removed_newsletters_index_entry',
  RETAINED_EXISTING_PUBLIC_WITH_METADATA: 'retained_existing_public_with_metadata',
  INVALID_RETENTION_IGNORED_AND_REMOVED_INDEX_ENTRY:
    'invalid_retention_ignored_and_removed_index_entry'
});

const PUBLIC_ARTIFACT_SOURCES = Object.freeze({
  LATEST_RUN: 'latest_run',
  PREVIOUS_RUN: 'previous_run',
  NONE: 'none'
});

const DIAGNOSTICS_STATUSES = new Set([
  'NEEDS_FIX',
  'QUALITY_NEEDS_FIX',
  'UNDERFILLED_NEEDS_FIX',
  'FAILED_REPAIR_REVIEWABLE',
  'FAILED_RAW_ARTIFACT_VALIDATION'
]);

// 추가 locale은 LEDGER_HEADING_TRANSLATIONS에 추가
const LEDGER_HEADING_TRANSLATIONS = Object.freeze(['Ledger', '원장']);

function ledgerHeadingPattern(translations = LEDGER_HEADING_TRANSLATIONS) {
  if (!Array.isArray(translations)) {
    throw new TypeError(
      `LEDGER_HEADING_TRANSLATIONS must be an array of strings (received ${typeof translations})`
    );
  }
  const alternatives = translations
    .filter(text => typeof text === 'string' && text.trim().length > 0)
    .map(text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (alternatives.length === 0) {
    throw new Error(
      `LEDGER_HEADING_TRANSLATIONS must contain at least one non-empty string ` +
      `(received ${translations.length} entr${translations.length === 1 ? 'y' : 'ies'})`
    );
  }
  return new RegExp(`^##\\s+(${alternatives.join('|')})\\b`);
}

const LEDGER_HEADING_PATTERN = ledgerHeadingPattern();

const RETENTION_SCOPE = 'same_date_diagnostics_only';
const ARCHIVE_SIDECAR_PATH = 'articles/content/audit/historical-archive-status.json';
const ARCHIVE_LEDGER_PATH = AUDIT_LEDGER_PATH;
const ARCHIVE_CURRENT_CONTEXTS = new Set([
  'current_generation_archive_review',
  'review_only_publication'
]);
const REVIEW_ONLY_LEDGER_ISSUE =
  'review-only public artifact, editor review required before publish confidence; no historical provenance backfill required';
const PUBLISH_READY_LEDGER_ISSUE =
  'current generated public artifact; no historical provenance backfill required';

function toRepoPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function isTrue(value) {
  return value === true || value === 'true';
}

function scalarBoolean(value) {
  return value === true ? 'true' : 'false';
}

function readTextResult(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, text: '', error: null };
  try {
    return { exists: true, text: fs.readFileSync(filePath, 'utf8'), error: null };
  } catch (error) {
    return { exists: true, text: '', error };
  }
}

function readJsonResult(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, value: null, error: null };
  try {
    return {
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      error: null
    };
  } catch (error) {
    return { exists: true, value: null, error };
  }
}

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function publicStructureStatus(root, date) {
  // Public files may remain on disk for forensic/debug purposes.
  // This strict structure status only decides whether they are allowed to be homepage/archive visible.
  const structure = publicNewsletterStructureStatus(root, date);
  const publicFiles = structure.statuses.filter(status => status.path.startsWith(`articles/newsletters/${date}/`));
  return {
    ...structure,
    publicFiles,
    publicFilesExist: publicFiles.some(file => file.exists)
  };
}

function retentionMetadataPath(root, date) {
  return path.join(root, 'articles', 'content', 'newsroom', date, 'public-retention.json');
}

function validateRetentionMetadata({ root = process.cwd(), date } = {}) {
  const expectedArtifacts = publicNewsletterPaths(date);
  const filePath = retentionMetadataPath(root, date);
  const result = readJsonResult(filePath);
  if (!result.exists) {
    return {
      exists: false,
      valid: false,
      value: null,
      errors: [],
      error: '',
      expectedArtifacts,
      path: `articles/content/newsroom/${date}/public-retention.json`
    };
  }
  const errors = [];
  if (result.error) {
    errors.push(`Invalid public-retention.json: ${result.error.message}`);
  }
  const value = result.value || {};
  if (!result.error) {
    if (value.retain_existing_public !== true) errors.push('public-retention.json retain_existing_public must be true');
    if (value.date !== date) errors.push(`public-retention.json date must be ${date}`);
    if (value.scope !== RETENTION_SCOPE) errors.push(`public-retention.json scope must be ${RETENTION_SCOPE}`);
    for (const field of ['reason', 'approved_by', 'approved_at']) {
      if (typeof value[field] !== 'string' || !value[field].trim()) {
        errors.push(`public-retention.json missing ${field}`);
      }
    }
    if (value.approved_at && !/^\d{4}-\d{2}-\d{2}$/.test(String(value.approved_at))) {
      errors.push('public-retention.json approved_at must match YYYY-MM-DD');
    }
    const retained = ensureArray(value.retained_public_artifacts).map(toRepoPath);
    if (retained.length === 0) {
      errors.push('public-retention.json missing retained_public_artifacts');
    }
    for (const expected of expectedArtifacts) {
      if (!retained.includes(expected)) {
        errors.push(`public-retention.json retained_public_artifacts must include ${expected}`);
      }
    }
    for (const retainedPath of retained) {
      const fullPath = path.resolve(root, retainedPath);
      const rootPath = path.resolve(root);
      if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${path.sep}`)) {
        errors.push(`public-retention.json retained_public_artifacts path escapes repository: ${retainedPath}`);
        continue;
      }
      const text = readTextResult(fullPath);
      if (!text.exists) errors.push(`retained public artifact missing: ${retainedPath}`);
      else if (text.error) errors.push(`retained public artifact unreadable: ${retainedPath}: ${text.error.message}`);
      else if (!String(text.text || '').trim()) errors.push(`retained public artifact empty: ${retainedPath}`);
    }
    const hashes = value.retained_public_artifact_hashes || {};
    if (hashes && typeof hashes === 'object' && !Array.isArray(hashes)) {
      for (const [hashPath, expectedHash] of Object.entries(hashes)) {
        const relPath = toRepoPath(hashPath);
        if (!retained.includes(relPath)) {
          errors.push(`retained_public_artifact_hashes path is not retained: ${relPath}`);
          continue;
        }
        if (!/^sha256:[a-f0-9]{64}$/i.test(String(expectedHash || ''))) {
          errors.push(`retained_public_artifact_hashes ${relPath} must be sha256:<hex>`);
          continue;
        }
        const fullPath = path.join(root, relPath);
        if (fs.existsSync(fullPath)) {
          const actualHash = sha256File(fullPath);
          if (actualHash.toLowerCase() !== String(expectedHash).toLowerCase()) {
            errors.push(`retained_public_artifact_hashes mismatch for ${relPath}`);
          }
        }
      }
    } else if (value.retained_public_artifact_hashes !== undefined) {
      errors.push('public-retention.json retained_public_artifact_hashes must be an object');
    }
  }

  return {
    exists: true,
    valid: errors.length === 0,
    value,
    errors,
    error: errors.join('; '),
    expectedArtifacts,
    path: `articles/content/newsroom/${date}/public-retention.json`
  };
}

function latestDiagnosticsOnly(status = {}) {
  if (isTrue(status.diagnostics_only)) return true;
  return !isTrue(status.public_newsletter_ready) &&
    !isTrue(status.final_publish_ready) &&
    !isTrue(status.review_publication_ready) &&
    DIAGNOSTICS_STATUSES.has(String(status.status || status.generation_status || ''));
}

function classifyLatestPublicState({ root = process.cwd(), date, status = {}, publicStructure, retention } = {}) {
  const structure = publicStructure || publicStructureStatus(root, date || status.date);
  const retentionState = retention || validateRetentionMetadata({ root, date: date || status.date });
  if (isTrue(status.final_publish_ready) && isTrue(status.public_newsletter_ready) && structure.ok) {
    return PUBLIC_STATES.PUBLISH_READY;
  }
  if (
    !isTrue(status.final_publish_ready) &&
    isTrue(status.review_publication_ready) &&
    isTrue(status.public_newsletter_ready) &&
    structure.ok
  ) {
    return PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED;
  }
  if (latestDiagnosticsOnly(status) && retentionState.valid && structure.ok) {
    return PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC;
  }
  return PUBLIC_STATES.DIAGNOSTICS_ONLY;
}

function runModeForPublicState(publicState) {
  if (publicState === PUBLIC_STATES.PUBLISH_READY) return RUN_MODES.PUBLISH_READY;
  if (publicState === PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED) return RUN_MODES.REVIEW_ONLY_PUBLIC;
  if (publicState === PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC) {
    return RUN_MODES.DIAGNOSTICS_ONLY_RETAINED_PUBLIC;
  }
  return RUN_MODES.DIAGNOSTICS_ONLY;
}

function removeNewsletterIndexEntry(root, date) {
  const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
  const result = readJsonResult(dataPath);
  if (!result.exists || result.error || !Array.isArray(result.value)) {
    return { changed: false, error: result.error ? result.error.message : 'data/newsletters.json is missing or invalid' };
  }
  const next = result.value.filter(item => item?.date !== date);
  if (next.length === result.value.length) return { changed: false, error: '' };
  try {
    writeJsonAtomic(dataPath, next);
    return { changed: true, error: '' };
  } catch (error) {
    return { changed: false, error: error.message };
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function uniqueArtifacts(values) {
  return [...new Set(ensureArray(values).map(toRepoPath).filter(Boolean))].sort();
}

function normalizeStringArray(value) {
  return ensureArray(value).map(item => String(item || '').trim()).filter(Boolean);
}

function expectedArchiveEntry(date, publicState) {
  const reviewOnly = publicState === PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED;
  return {
    date,
    archive_status: 'stable_archive',
    historical_cleanup_reviewed: true,
    known_limitations: reviewOnly ? ['review_only_publication'] : [],
    historical_cleanup_context: reviewOnly
      ? 'review_only_publication'
      : 'current_generation_archive_review',
    public_visibility: 'listed'
  };
}

function canonicalArchiveEntry(entry = {}) {
  return {
    date: String(entry.date || ''),
    archive_status: String(entry.archive_status || ''),
    historical_cleanup_reviewed: entry.historical_cleanup_reviewed === true,
    known_limitations: normalizeStringArray(entry.known_limitations).sort(),
    historical_cleanup_context: String(entry.historical_cleanup_context || ''),
    public_visibility: String(entry.public_visibility || '')
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function archiveConflictError({ date, file, reason, existing, expected }) {
  return new Error([
    `Archive reconciliation conflict for ${date} in ${file}: ${reason}.`,
    `existing=${JSON.stringify(existing)}`,
    `expected=${JSON.stringify(expected)}`
  ].join(' '));
}

function readArchiveSidecar(root) {
  const relPath = ARCHIVE_SIDECAR_PATH;
  const filePath = path.join(root, relPath);
  const result = readJsonResult(filePath);
  if (!result.exists) return [];
  if (result.error || !Array.isArray(result.value)) {
    throw archiveConflictError({
      date: 'unknown',
      file: relPath,
      reason: result.error ? `invalid JSON: ${result.error.message}` : 'sidecar must be a JSON array',
      existing: result.value,
      expected: []
    });
  }
  return result.value;
}

function duplicateDates(entries) {
  const seen = new Set();
  const duplicates = new Set();
  for (const entry of ensureArray(entries)) {
    const date = String(entry?.date || '');
    if (!date) continue;
    if (seen.has(date)) duplicates.add(date);
    seen.add(date);
  }
  return [...duplicates].sort();
}

function upsertArchiveSidecar({ root, date, publicState, write = true }) {
  const entries = readArchiveSidecar(root);
  const duplicates = duplicateDates(entries);
  if (duplicates.length > 0) {
    throw archiveConflictError({
      date,
      file: ARCHIVE_SIDECAR_PATH,
      reason: `duplicate sidecar date row(s): ${duplicates.join(', ')}`,
      existing: duplicates,
      expected: canonicalArchiveEntry(expectedArchiveEntry(date, publicState))
    });
  }

  const expected = expectedArchiveEntry(date, publicState);
  const expectedCanonical = canonicalArchiveEntry(expected);
  const existingIndex = entries.findIndex(entry => String(entry?.date || '') === date);
  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    const existingCanonical = canonicalArchiveEntry(existing);
    if (sameJson(existingCanonical, expectedCanonical)) {
      return { changed: false };
    }
    const historicalContext = String(existing.historical_cleanup_context || '');
    const unsafeReason = existing.archive_status === 'removed'
      ? 'existing entry is removed'
      : existing.public_visibility === 'unlisted' || existing.public_visibility === 'removed'
        ? `existing public_visibility is ${existing.public_visibility}`
        : !ARCHIVE_CURRENT_CONTEXTS.has(historicalContext)
          ? `existing cleanup context is ${historicalContext || 'missing'}`
          : 'existing canonical archive state differs from expected state';
    throw archiveConflictError({
      date,
      file: ARCHIVE_SIDECAR_PATH,
      reason: unsafeReason,
      existing: existingCanonical,
      expected: expectedCanonical
    });
  }

  const nextEntries = [...entries, expected]
    .sort((left, right) => String(right?.date || '').localeCompare(String(left?.date || '')));
  if (write) writeJsonAtomic(path.join(root, ARCHIVE_SIDECAR_PATH), nextEntries);
  return { changed: true };
}

function parseLedgerCells(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function expectedLedgerRow(date, publicState) {
  const expected = expectedArchiveEntry(date, publicState);
  return {
    date,
    original_generation_mode: 'current_generation',
    known_quality_issues: publicState === PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED
      ? REVIEW_ONLY_LEDGER_ISSUE
      : PUBLISH_READY_LEDGER_ISSUE,
    rewrite_allowed: 'no',
    rewrite_status: 'none',
    archive_status: expected.archive_status,
    public_visibility: expected.public_visibility,
    cleanup_context: expected.historical_cleanup_context
  };
}

function ledgerRowToLine(row) {
  return [
    row.date,
    row.original_generation_mode,
    row.known_quality_issues,
    row.rewrite_allowed,
    row.rewrite_status,
    row.archive_status,
    row.public_visibility,
    row.cleanup_context
  ].join(' | ').replace(/^/, '| ').replace(/$/, ' |');
}

function canonicalLedgerRow(row = {}) {
  return {
    date: String(row.date || ''),
    original_generation_mode: String(row.original_generation_mode || ''),
    known_quality_issues: String(row.known_quality_issues || ''),
    rewrite_allowed: String(row.rewrite_allowed || ''),
    rewrite_status: String(row.rewrite_status || ''),
    archive_status: String(row.archive_status || ''),
    public_visibility: String(row.public_visibility || ''),
    cleanup_context: String(row.cleanup_context || '')
  };
}

function parseLedgerTable(text, dateForError) {
  const lines = String(text || '').split(/\r?\n/);
  const ledgerHeadingIndex = lines.findIndex(line => LEDGER_HEADING_PATTERN.test(line));
  const headerIndex = ledgerHeadingIndex < 0
    ? -1
    : lines.findIndex((line, index) => index > ledgerHeadingIndex && /^\|\s*Date\s*\|/.test(line));
  if (ledgerHeadingIndex < 0 || headerIndex < 0) {
    throw archiveConflictError({
      date: dateForError,
      file: ARCHIVE_LEDGER_PATH,
      reason: 'ledger table marker/header is missing',
      existing: 'missing',
      expected: '## Ledger table with Date header'
    });
  }
  const separatorIndex = headerIndex + 1;
  if (!/^\|\s*-+/.test(lines[separatorIndex] || '')) {
    throw archiveConflictError({
      date: dateForError,
      file: ARCHIVE_LEDGER_PATH,
      reason: 'ledger table separator is missing',
      existing: lines[separatorIndex] || '',
      expected: '| --- |'
    });
  }

  const rows = [];
  let rowEndIndex = separatorIndex + 1;
  for (; rowEndIndex < lines.length; rowEndIndex += 1) {
    const line = lines[rowEndIndex];
    if (!line.startsWith('|')) break;
    const cells = parseLedgerCells(line);
    rows.push({
      line,
      date: cells[0] || '',
      original_generation_mode: cells[1] || '',
      known_quality_issues: cells[2] || '',
      rewrite_allowed: cells[3] || '',
      rewrite_status: cells[4] || '',
      archive_status: cells[5] || '',
      public_visibility: cells[6] || '',
      cleanup_context: cells[7] || ''
    });
  }
  return { lines, headerIndex, separatorIndex, rowEndIndex, rows };
}

function assertNoDuplicateLedgerRows(rows, dateForError) {
  const counts = new Map();
  for (const row of rows) {
    if (!row.date) continue;
    counts.set(row.date, (counts.get(row.date) || 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([date]) => date);
  if (duplicates.length > 0) {
    throw archiveConflictError({
      date: dateForError,
      file: ARCHIVE_LEDGER_PATH,
      reason: `duplicate ledger date row(s): ${duplicates.join(', ')}`,
      existing: duplicates,
      expected: canonicalLedgerRow(expectedLedgerRow(dateForError, PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED))
    });
  }
}

function upsertArchiveLedger({ root, date, publicState, write = true }) {
  const filePath = path.join(root, ARCHIVE_LEDGER_PATH);
  if (!fs.existsSync(filePath)) {
    throw archiveConflictError({
      date,
      file: ARCHIVE_LEDGER_PATH,
      reason: 'ledger file is missing',
      existing: 'missing',
      expected: ARCHIVE_LEDGER_PATH
    });
  }
  const originalText = fs.readFileSync(filePath, 'utf8');
  const table = parseLedgerTable(originalText, date);
  assertNoDuplicateLedgerRows(table.rows, date);
  const expected = expectedLedgerRow(date, publicState);
  const expectedCanonical = canonicalLedgerRow(expected);
  const existing = table.rows.find(row => row.date === date);
  if (existing) {
    const existingCanonical = canonicalLedgerRow(existing);
    if (sameJson(existingCanonical, expectedCanonical)) {
      return { changed: false };
    }
    throw archiveConflictError({
      date,
      file: ARCHIVE_LEDGER_PATH,
      reason: 'existing ledger row differs from expected archive state',
      existing: existingCanonical,
      expected: expectedCanonical
    });
  }

  const nextRows = [...table.rows, expected]
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
    .map(ledgerRowToLine);
  const nextLines = [
    ...table.lines.slice(0, table.separatorIndex + 1),
    ...nextRows,
    ...table.lines.slice(table.rowEndIndex)
  ];
  const nextText = nextLines.join('\n');
  if (nextText === originalText) return { changed: false };
  if (write) fs.writeFileSync(filePath, nextText, 'utf8');
  return { changed: true };
}

function syncArchivePublicationState({ root, date, publicState }) {
  if (![PUBLIC_STATES.PUBLISH_READY, PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED].includes(publicState)) {
    return { changedArtifacts: [] };
  }
  const sidecar = upsertArchiveSidecar({ root, date, publicState, write: false });
  const ledger = upsertArchiveLedger({ root, date, publicState, write: false });
  if (sidecar.changed) upsertArchiveSidecar({ root, date, publicState, write: true });
  if (ledger.changed) upsertArchiveLedger({ root, date, publicState, write: true });
  return {
    changedArtifacts: uniqueArtifacts([
      sidecar.changed ? ARCHIVE_SIDECAR_PATH : '',
      ledger.changed ? ARCHIVE_LEDGER_PATH : ''
    ])
  };
}

function buildRemediationMessage(date) {
  return [
    `Remediation for ${date}:`,
    `- Remove the ${date} entry from articles/data/newsletters.json, or`,
    `- Add valid articles/content/newsroom/${date}/public-retention.json with:`,
    '  retain_existing_public=true',
    `  date=${date}`,
    `  scope=${RETENTION_SCOPE}`,
    '  reason',
    '  approved_by',
    '  approved_at=YYYY-MM-DD',
    '  retained_public_artifacts=[',
    `    "articles/newsletters/${date}/index.html",`,
    `    "articles/newsletters/${date}/newsletter.md"`,
    '  ]'
  ].join('\n');
}

function reconciliationFieldsFor({ publicState, status, retention, publicStructure, existingPublicArtifactDetected }) {
  if (publicState === PUBLIC_STATES.PUBLISH_READY) {
    return {
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_PUBLIC_READY,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.LATEST_RUN,
      action: RECONCILIATION_ACTIONS.NONE_LATEST_PUBLIC_READY,
      reason: 'latest run is final publish-ready and public structure is valid'
    };
  }
  if (publicState === PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED) {
    return {
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_REVIEW_PUBLICATION_READY,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.LATEST_RUN,
      action: RECONCILIATION_ACTIONS.UPSERTED_LATEST_PUBLIC_ENTRY,
      reason: 'latest run created a structurally valid review-only public issue'
    };
  }
  if (publicState === PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC) {
    return {
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.RETAIN_EXISTING_EDITOR_APPROVED_PUBLIC,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.PREVIOUS_RUN,
      action: RECONCILIATION_ACTIONS.RETAINED_EXISTING_PUBLIC_WITH_METADATA,
      reason: 'valid public-retention.json allows previous public issue to remain visible'
    };
  }
  if (retention.exists && !retention.valid) {
    return {
      effectiveHomepageVisible: false,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.INVALID_RETENTION_IGNORED,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.NONE,
      action: RECONCILIATION_ACTIONS.INVALID_RETENTION_IGNORED_AND_REMOVED_INDEX_ENTRY,
      reason: `invalid public-retention.json ignored: ${retention.error || 'unknown retention error'}`
    };
  }
  if (isTrue(status.review_publication_ready) && !publicStructure.ok) {
    return {
      effectiveHomepageVisible: false,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.REVIEW_PUBLICATION_INVALID_PUBLIC_STRUCTURE,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.NONE,
      action: RECONCILIATION_ACTIONS.REMOVED_NEWSLETTERS_INDEX_ENTRY,
      reason: `review_publication_ready was true but public structure was invalid: ${publicStructure.errors.join('; ') || 'unknown'}`
    };
  }
  return {
    effectiveHomepageVisible: false,
    publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.HIDE_EXISTING_PUBLIC_ARTIFACT_AFTER_LATEST_DIAGNOSTICS_ONLY,
    publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.NONE,
    action: RECONCILIATION_ACTIONS.REMOVED_NEWSLETTERS_INDEX_ENTRY,
    reason: existingPublicArtifactDetected
      ? 'latest diagnostics-only run is not public-ready and no valid retention metadata exists'
      : 'latest diagnostics-only run has no effective public artifacts'
  };
}

function reconcilePublicState(options = {}) {
  const root = options.root || process.cwd();
  const status = options.status || {};
  const date = options.date || status.date;
  if (!date) throw new Error('reconcilePublicState requires a date.');

  const publicStructure = publicStructureStatus(root, date);
  const retention = validateRetentionMetadata({ root, date });
  const publicState = classifyLatestPublicState({ root, date, status, publicStructure, retention });
  const existingPublicArtifactDetected = publicStructure.publicFilesExist || publicStructure.dataIndex.hasDate;
  const fields = reconciliationFieldsFor({
    publicState,
    status,
    retention,
    publicStructure,
    existingPublicArtifactDetected
  });

  let dataIndexChanged = false;
  const shouldRemoveIndexEntry =
    !fields.effectiveHomepageVisible &&
    (publicStructure.dataIndex.exists || publicStructure.publicFilesExist);
  if (options.write !== false && shouldRemoveIndexEntry) {
    const result = removeNewsletterIndexEntry(root, date);
    if (result.error) {
      throw new Error(
        `Failed to remove ${date} from articles/data/newsletters.json; reconciliation aborted before status write. ${result.error}`
      );
    }
    dataIndexChanged = result.changed;
  }

  const runMode = runModeForPublicState(publicState);
  const statusPatch = {
    ...status,
    date,
    public_state: publicState,
    run_mode: runMode,
    public_newsletter_ready:
      publicState === PUBLIC_STATES.PUBLISH_READY ||
      publicState === PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED,
    diagnostics_only:
      publicState === PUBLIC_STATES.DIAGNOSTICS_ONLY ||
      publicState === PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC,
    effective_homepage_visible: fields.effectiveHomepageVisible,
    homepage_visible_after_merge: fields.effectiveHomepageVisible,
    existing_public_artifact_detected: existingPublicArtifactDetected,
    retention_valid: retention.valid,
    retention_error: retention.error || '',
    public_artifact_policy: fields.publicArtifactPolicy,
    public_artifact_source: fields.publicArtifactSource,
    reconciliation_required: false,
    reconciliation_action: fields.action,
    reconciliation_reason: fields.reason
  };

  const changedArtifacts = uniqueArtifacts(options.changedArtifacts);
  const repoVisibleStatusPath = `articles/content/newsroom/${date}/generation-status.json`;
  const archiveSync = options.write !== false
    ? syncArchivePublicationState({ root, date, publicState })
    : { changedArtifacts: [] };
  const repoVisibleChangedArtifacts = uniqueArtifacts(changedArtifacts.concat(
    repoVisibleStatusPath,
    dataIndexChanged ? 'articles/data/newsletters.json' : [],
    archiveSync.changedArtifacts
  ));

  if (options.write !== false) {
    writeJsonAtomic(path.join(root, repoVisibleStatusPath), statusPatch);
    writeJsonAtomic(path.join(root, '.tmp', 'newsletter-generation-status.json'), statusPatch);
  }

  const outputs = {
    public_state: publicState,
    run_mode: runMode,
    effective_homepage_visible: scalarBoolean(fields.effectiveHomepageVisible),
    homepage_visible_after_merge: scalarBoolean(fields.effectiveHomepageVisible),
    existing_public_artifact_detected: scalarBoolean(existingPublicArtifactDetected),
    retention_valid: scalarBoolean(retention.valid),
    retention_error: retention.error || 'none',
    public_artifact_policy: fields.publicArtifactPolicy,
    public_artifact_source: fields.publicArtifactSource,
    reconciliation_required: 'false',
    reconciliation_action: fields.action,
    reconciliation_reason: statusPatch.reconciliation_reason,
    reconciled_changed_artifacts: repoVisibleChangedArtifacts.join(',') || 'none'
  };

  return {
    statusPatch,
    outputs,
    dataIndexChanged,
    retained: publicState === PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC,
    retention,
    publicState,
    publicStructure,
    effectiveHomepageVisible: fields.effectiveHomepageVisible,
    action: fields.action,
    reason: statusPatch.reconciliation_reason,
    changedArtifacts: repoVisibleChangedArtifacts
  };
}

module.exports = {
  LEDGER_HEADING_TRANSLATIONS,
  PUBLIC_ARTIFACT_POLICIES,
  PUBLIC_ARTIFACT_SOURCES,
  PUBLIC_STATES,
  RECONCILIATION_ACTIONS,
  RETENTION_SCOPE,
  RUN_MODES,
  buildRemediationMessage,
  classifyLatestPublicState,
  latestDiagnosticsOnly,
  ledgerHeadingPattern,
  publicNewsletterPaths,
  publicStructureStatus,
  reconcilePublicState,
  retentionMetadataPath,
  runModeForPublicState,
  syncArchivePublicationState,
  validateRetentionMetadata,
  writeJsonAtomic
};
