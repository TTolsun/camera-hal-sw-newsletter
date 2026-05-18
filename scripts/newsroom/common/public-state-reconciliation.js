const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  publicNewsletterPaths,
  publicNewsletterStructureStatus
} = require('./public-structure');

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
  'FAILED_REPAIR_REVIEWABLE'
]);

const RETENTION_SCOPE = 'same_date_diagnostics_only';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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
  const publicFiles = structure.statuses.filter(status => status.path.startsWith(`newsletters/${date}/`));
  return {
    ...structure,
    publicFiles,
    publicFilesExist: publicFiles.some(file => file.exists)
  };
}

function retentionMetadataPath(root, date) {
  return path.join(root, 'content', 'newsroom', date, 'public-retention.json');
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
      path: `content/newsroom/${date}/public-retention.json`
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
    path: `content/newsroom/${date}/public-retention.json`
  };
}

function fallbackPublicSourceExists({ root, date, status = {} }) {
  if (status.fallback_public_issue_status === 'CREATED') return true;
  const result = readJsonResult(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'));
  return result.exists && !result.error && result.value?.fallback_public_issue_status === 'CREATED';
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
    fallbackPublicSourceExists({ root, date: date || status.date, status }) &&
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
  const dataPath = path.join(root, 'data', 'newsletters.json');
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

function buildRemediationMessage(date) {
  return [
    `Remediation for ${date}:`,
    `- Remove the ${date} entry from data/newsletters.json, or`,
    `- Add valid content/newsroom/${date}/public-retention.json with:`,
    '  retain_existing_public=true',
    `  date=${date}`,
    `  scope=${RETENTION_SCOPE}`,
    '  reason',
    '  approved_by',
    '  approved_at=YYYY-MM-DD',
    '  retained_public_artifacts=[',
    `    "newsletters/${date}/index.html",`,
    `    "newsletters/${date}/newsletter.md"`,
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
        `Failed to remove ${date} from data/newsletters.json; reconciliation aborted before status write. ${result.error}`
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
  const repoVisibleStatusPath = `content/newsroom/${date}/generation-status.json`;
  const repoVisibleChangedArtifacts = uniqueArtifacts(changedArtifacts.concat(repoVisibleStatusPath, dataIndexChanged ? 'data/newsletters.json' : []));

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
  PUBLIC_ARTIFACT_POLICIES,
  PUBLIC_ARTIFACT_SOURCES,
  PUBLIC_STATES,
  RECONCILIATION_ACTIONS,
  RETENTION_SCOPE,
  RUN_MODES,
  buildRemediationMessage,
  classifyLatestPublicState,
  latestDiagnosticsOnly,
  publicNewsletterPaths,
  publicStructureStatus,
  reconcilePublicState,
  retentionMetadataPath,
  runModeForPublicState,
  validateRetentionMetadata,
  writeJsonAtomic
};
