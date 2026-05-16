const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  geminiCandidatesPath,
  geminiCandidatesRelPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  mergedCandidateManifestPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesPath,
  mergedCandidatesRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath,
  toPosix
} = require('./artifact-paths');
const {
  readJson,
  repoPath,
  writeJson
} = require('./common');

const CANDIDATE_INPUT_MODES = Object.freeze({
  DEFAULT: 'default',
  ARTIFACT: 'artifact'
});

class CandidateArtifactValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CandidateArtifactValidationError';
    this.stage = 'raw artifact validation';
    this.details = details;
  }
}

function hashBuffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashFile(filePath) {
  return hashBuffer(fs.readFileSync(filePath));
}

function hashFileIfExists(filePath) {
  return fs.existsSync(filePath) ? hashFile(filePath) : '';
}

function relPath(root, filePath) {
  return toPosix(path.relative(root, filePath));
}

function candidateItems(payload = {}) {
  return Array.isArray(payload?.candidates) ? payload.candidates : [];
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function candidateUrl(candidate = {}) {
  return [
    candidate.url,
    candidate.articleUrl,
    candidate.article_url,
    candidate.source_candidate_url,
    candidate.normalized_url
  ].map(text).find(Boolean) || '';
}

function normalizedCandidateUrl(candidate = {}) {
  const raw = candidateUrl(candidate);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.href;
  } catch {
    return raw;
  }
}

function normalizedUrlSet(candidates = []) {
  const urls = new Set();
  for (const candidate of candidates) {
    const url = normalizedCandidateUrl(candidate);
    if (url) urls.add(url);
  }
  return urls;
}

function boolTrue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function boolFalse(value) {
  return value === false || String(value).toLowerCase() === 'false';
}

function finalSelectionEligibility(candidate = {}) {
  return text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
}

function isPublishableGeminiCandidate(candidate = {}) {
  return candidate.origin === 'gemini_discovery' &&
    Boolean(normalizedCandidateUrl(candidate)) &&
    !boolTrue(candidate.source_gap_risk) &&
    !boolFalse(candidate.main_eligible) &&
    ['main', 'short'].includes(finalSelectionEligibility(candidate));
}

function sourceDiscoveryCandidateStats({
  manualCandidates = [],
  geminiCandidates = [],
  mergedCandidates = []
} = {}) {
  const manualRecords = Array.isArray(manualCandidates) ? manualCandidates : [];
  const geminiRecords = Array.isArray(geminiCandidates) ? geminiCandidates : [];
  const mergedRecords = Array.isArray(mergedCandidates) ? mergedCandidates : [];
  const manualUrls = normalizedUrlSet(manualRecords);
  const geminiUrls = normalizedUrlSet(geminiRecords);
  const mergedUrls = normalizedUrlSet(mergedRecords);

  let geminiNewUniqueUrlCount = 0;
  let geminiManualDuplicateUrlCount = 0;
  for (const url of geminiUrls) {
    if (manualUrls.has(url)) {
      geminiManualDuplicateUrlCount += 1;
    } else {
      geminiNewUniqueUrlCount += 1;
    }
  }

  return {
    manual_candidate_count: manualRecords.length,
    manual_unique_url_count: manualUrls.size,
    gemini_candidate_count: geminiRecords.length,
    gemini_unique_url_count: geminiUrls.size,
    gemini_new_unique_url_count: geminiNewUniqueUrlCount,
    gemini_manual_duplicate_url_count: geminiManualDuplicateUrlCount,
    gemini_duplicate_record_count: geminiRecords
      .filter(candidate => manualUrls.has(normalizedCandidateUrl(candidate)))
      .length,
    merged_candidate_count: mergedRecords.length,
    merged_unique_url_count: mergedUrls.size,
    gemini_publishable_candidate_count: geminiRecords.filter(isPublishableGeminiCandidate).length
  };
}

function sourceDiscoveryStatsSummary(stats = {}, options = {}) {
  if (options.llmUsed !== true) {
    return 'Gemini source discovery was disabled; manual candidates were passed through.';
  }
  const newUniqueCount = Number(stats.gemini_new_unique_url_count || 0);
  const publishableCount = Number(stats.gemini_publishable_candidate_count || 0);
  const duplicateUrlCount = Number(stats.gemini_manual_duplicate_url_count || 0);
  if (newUniqueCount === 0 && publishableCount === 0) {
    return 'Gemini ran, but found no new unique publishable candidates.';
  }
  return `Gemini added ${newUniqueCount} new unique URL(s), ${publishableCount} publishable candidate(s), and ${duplicateUrlCount} manual-duplicate URL(s).`;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function artifactHash(manifest = {}) {
  return String(manifest.artifact_hash || manifest.candidate_artifact_hash || '').trim();
}

function manifestSchemaVersion(manifest = {}) {
  const value = manifest.schema_version === undefined ? 1 : Number(manifest.schema_version);
  return Number.isFinite(value) ? value : NaN;
}

function validateMergedManifestSchema(root, manifest, manifestRelPath, validationMode) {
  if (manifest.manifest_type !== 'merged_candidate') return;
  const version = manifestSchemaVersion(manifest);
  if (!Number.isInteger(version) || version < 1 || version > 2) {
    throw new CandidateArtifactValidationError(`Merged candidate manifest schema_version must be 1 or 2: ${manifestRelPath}`, {
      manifestRelPath,
      schema_version: manifest.schema_version
    });
  }

  if (version < 2) return;

  const reportFields = [
    'usage_report',
    'proposal_validation_report',
    'source_quality_report',
    'source_quality_report_markdown',
    'source_clusters',
    'evidence_validation_report'
  ];
  const enabledDiscovery = manifest.llm_used === true || manifest.merge_mode === 'gemini_source_discovery';
  for (const field of reportFields) {
    const value = String(manifest[field] || '').trim();
    if (!value) {
      if (validationMode === 'strict' && enabledDiscovery) {
        throw new CandidateArtifactValidationError(`Merged candidate manifest ${field} is required for enabled Gemini discovery: ${manifestRelPath}`, {
          manifestRelPath,
          field
        });
      }
      continue;
    }
    const resolved = repoPath(root, value);
    if (!resolved) {
      throw new CandidateArtifactValidationError(`Merged candidate manifest ${field} must stay inside the repository: ${manifestRelPath}`, {
        manifestRelPath,
        field,
        value
      });
    }
    if (validationMode === 'strict' && !fs.existsSync(resolved)) {
      throw new CandidateArtifactValidationError(`Merged candidate manifest ${field} target is missing: ${value}`, {
        manifestRelPath,
        field,
        value
      });
    }
  }
}

function readCandidatePayload(root, candidatePath) {
  try {
    return readJson(candidatePath);
  } catch (error) {
    throw new CandidateArtifactValidationError(`Invalid candidate artifact JSON: ${relPath(root, candidatePath)}`, {
      candidatePath,
      parse_error: error.message
    });
  }
}

function validateCandidatePayload({
  root = process.cwd(),
  date,
  candidatePath,
  validationMode = 'compatibility'
} = {}) {
  const payload = readCandidatePayload(root, candidatePath);
  const artifactRelPath = relPath(root, candidatePath);

  if (!isObject(payload)) {
    throw new CandidateArtifactValidationError(`Candidate artifact must be an object root: ${artifactRelPath}`, {
      candidatePath,
      validationMode
    });
  }
  if (!Array.isArray(payload.candidates)) {
    throw new CandidateArtifactValidationError(`Candidate artifact must include candidates array: ${artifactRelPath}`, {
      candidatePath,
      validationMode
    });
  }

  payload.candidates.forEach((candidate, index) => {
    if (!isObject(candidate)) {
      throw new CandidateArtifactValidationError(`Candidate artifact candidates[${index}] must be an object: ${artifactRelPath}`, {
        candidatePath,
        validationMode,
        candidate_index: index
      });
    }
  });

  if (validationMode === 'strict') {
    const schemaVersion = Number(payload.schema_version);
    if (!Number.isFinite(schemaVersion) || schemaVersion < 5) {
      throw new CandidateArtifactValidationError(`Strict candidate artifact schema_version must be >= 5: ${artifactRelPath}`, {
        candidatePath,
        validationMode,
        schema_version: payload.schema_version
      });
    }
    for (const field of ['date', 'newsletter_date']) {
      if (date && String(payload[field] || '').trim() !== date) {
        throw new CandidateArtifactValidationError(`Strict candidate artifact ${field} must match ${date}: ${artifactRelPath}`, {
          candidatePath,
          validationMode,
          field,
          expected: date,
          actual: payload[field]
        });
      }
    }
  }

  return {
    payload,
    candidateCount: payload.candidates.length
  };
}

function buildRawCandidateManifest({
  root = process.cwd(),
  date,
  candidatePath = manualCandidatesPath(root, date),
  sourceRegistryPath = path.join(root, 'data', 'news-sources.json'),
  sourceCount = null,
  generatedAt = new Date().toISOString(),
  workflow = 'raw-candidate-pr'
} = {}) {
  const payload = readJson(candidatePath);
  const candidateCount = candidateItems(payload).length;
  return {
    schema_version: 1,
    manifest_type: 'raw_candidate',
    newsletter_date: date,
    generated_at: generatedAt,
    workflow,
    candidate_artifact: relPath(root, candidatePath),
    candidate_artifact_hash: hashFile(candidatePath),
    artifact_hash: hashFile(candidatePath),
    candidate_count: candidateCount,
    source_count: sourceCount ?? 0,
    source_registry_path: fs.existsSync(sourceRegistryPath) ? relPath(root, sourceRegistryPath) : '',
    source_registry_hash: hashFileIfExists(sourceRegistryPath),
    llm_used: false,
    generator: 'collect-news-candidates',
    github_run_id: process.env.GITHUB_RUN_ID || '',
    github_sha: process.env.GITHUB_SHA || ''
  };
}

function writeManualCandidateArtifacts({
  root = process.cwd(),
  date,
  payload,
  sourceCount = null,
  generatedAt = payload?.generated_at || new Date().toISOString(),
  workflow = 'raw-candidate-pr'
} = {}) {
  const manualPath = manualCandidatesPath(root, date);
  const legacyPath = collectedCandidatesPath(root, date);
  writeJson(manualPath, payload);
  writeJson(legacyPath, payload);

  const manifestPath = rawCandidateManifestPath(root, date);
  const manifest = buildRawCandidateManifest({
    root,
    date,
    candidatePath: manualPath,
    sourceCount,
    generatedAt,
    workflow
  });
  writeJson(manifestPath, manifest);

  return {
    manualPath,
    legacyPath,
    manifestPath,
    manifest
  };
}

function buildMergedCandidateManifest({
  root = process.cwd(),
  date,
  candidatePath = mergedCandidatesPath(root, date),
  sourceCandidatePath = manualCandidatesPath(root, date),
  sourceManifestPath = rawCandidateManifestPath(root, date),
  geminiCandidatePath = geminiCandidatesPath(root, date),
  generatedAt = new Date().toISOString(),
  mergeMode = 'disabled_pass_through',
  geminiCandidateCount = 0,
  llmUsed = false,
  status = 'PASS',
  schemaVersion = 1,
  discoveryStats = null,
  reportRefs = {}
} = {}) {
  const payload = readJson(candidatePath);
  const manifest = {
    schema_version: schemaVersion,
    manifest_type: 'merged_candidate',
    newsletter_date: date,
    generated_at: generatedAt,
    workflow: 'gemini-source-discovery-pr',
    status,
    merge_mode: mergeMode,
    candidate_artifact: relPath(root, candidatePath),
    candidate_artifact_hash: hashFile(candidatePath),
    artifact_hash: hashFile(candidatePath),
    candidate_count: candidateItems(payload).length,
    source_candidate_artifact: fs.existsSync(sourceCandidatePath) ? relPath(root, sourceCandidatePath) : '',
    source_candidate_artifact_hash: hashFileIfExists(sourceCandidatePath),
    source_manifest: fs.existsSync(sourceManifestPath) ? relPath(root, sourceManifestPath) : '',
    source_manifest_hash: hashFileIfExists(sourceManifestPath),
    gemini_candidate_artifact: fs.existsSync(geminiCandidatePath) ? relPath(root, geminiCandidatePath) : '',
    gemini_candidate_artifact_hash: hashFileIfExists(geminiCandidatePath),
    gemini_candidate_count: geminiCandidateCount,
    llm_used: llmUsed,
    github_run_id: process.env.GITHUB_RUN_ID || '',
    github_sha: process.env.GITHUB_SHA || ''
  };
  if (discoveryStats && typeof discoveryStats === 'object' && !Array.isArray(discoveryStats)) {
    Object.assign(manifest, discoveryStats);
  }
  if (schemaVersion >= 2) {
    manifest.usage_report = reportRefs.usage_report || '';
    manifest.proposal_validation_report = reportRefs.proposal_validation_report || '';
    manifest.source_quality_report = reportRefs.source_quality_report || '';
    manifest.source_quality_report_markdown = reportRefs.source_quality_report_markdown || '';
    manifest.source_clusters = reportRefs.source_clusters || '';
    manifest.evidence_validation_report = reportRefs.evidence_validation_report || '';
  }
  return manifest;
}

function writeMergedCandidateArtifacts({
  root = process.cwd(),
  date,
  payload,
  sourceCandidatePath = manualCandidatesPath(root, date),
  sourceManifestPath = rawCandidateManifestPath(root, date),
  geminiPayload = null,
  generatedAt = new Date().toISOString(),
  mergeMode = 'disabled_pass_through',
  geminiCandidateCount = 0,
  llmUsed = false,
  status = 'PASS',
  manifestSchemaVersion = 1,
  discoveryStats = null,
  reportRefs = {}
} = {}) {
  const mergedPath = mergedCandidatesPath(root, date);
  writeJson(mergedPath, payload);
  const geminiPath = geminiCandidatesPath(root, date);
  if (geminiPayload !== null) {
    writeJson(geminiPath, geminiPayload);
  }

  const manifestPath = mergedCandidateManifestPath(root, date);
  const manifest = buildMergedCandidateManifest({
    root,
    date,
    candidatePath: mergedPath,
    sourceCandidatePath,
    sourceManifestPath,
    geminiCandidatePath: geminiPath,
    generatedAt,
    mergeMode,
    geminiCandidateCount,
    llmUsed,
    status,
    schemaVersion: manifestSchemaVersion,
    discoveryStats,
    reportRefs
  });
  writeJson(manifestPath, manifest);

  return {
    mergedPath,
    geminiPath: geminiPayload !== null ? geminiPath : '',
    manifestPath,
    manifest
  };
}

function validateCandidateArtifact({
  root = process.cwd(),
  date,
  candidatePath,
  manifestPath = '',
  requireManifest = false,
  expectedLlmUsed = false,
  allowMissingManifest = false,
  validationMode = requireManifest ? 'strict' : 'compatibility',
  expectedManifestType = ''
} = {}) {
  if (!candidatePath || !fs.existsSync(candidatePath)) {
    throw new CandidateArtifactValidationError(`Missing candidate artifact: ${relPath(root, candidatePath || '')}`, {
      candidatePath
    });
  }

  const result = {
    path: candidatePath,
    relPath: relPath(root, candidatePath),
    manifestPath: manifestPath || '',
    manifestRelPath: manifestPath ? relPath(root, manifestPath) : '',
    manifest: null,
    hash: hashFile(candidatePath),
    manifestRequired: requireManifest,
    validation_mode: validationMode
  };
  const payloadValidation = validateCandidatePayload({
    root,
    date,
    candidatePath,
    validationMode
  });
  result.candidate_count = payloadValidation.candidateCount;

  if (!manifestPath || !fs.existsSync(manifestPath)) {
    if (requireManifest && !allowMissingManifest) {
      throw new CandidateArtifactValidationError(`Missing candidate manifest for ${result.relPath}`, result);
    }
    return {
      ...result,
      validation_status: 'transition_fallback_no_manifest'
    };
  }

  const manifest = readJson(manifestPath);
  if (expectedManifestType && manifest.manifest_type !== expectedManifestType) {
    throw new CandidateArtifactValidationError(`Candidate manifest manifest_type must be ${expectedManifestType}: ${result.manifestRelPath}`, {
      ...result,
      actualManifestType: manifest.manifest_type
    });
  }
  validateMergedManifestSchema(root, manifest, result.manifestRelPath, validationMode);
  const expectedHash = artifactHash(manifest);
  if (!expectedHash) {
    throw new CandidateArtifactValidationError(`Candidate manifest is missing artifact_hash: ${result.manifestRelPath}`, result);
  }
  if (expectedHash !== result.hash) {
    throw new CandidateArtifactValidationError(`Candidate artifact hash mismatch for ${result.relPath}`, {
      ...result,
      expectedHash,
      actualHash: result.hash
    });
  }
  if (expectedLlmUsed !== 'any' && manifest.llm_used !== expectedLlmUsed) {
    throw new CandidateArtifactValidationError(`Candidate manifest llm_used must be ${String(expectedLlmUsed)}: ${result.manifestRelPath}`, {
      ...result,
      actualLlmUsed: manifest.llm_used
    });
  }
  if (date && manifest.newsletter_date && manifest.newsletter_date !== date) {
    throw new CandidateArtifactValidationError(`Candidate manifest date mismatch for ${result.manifestRelPath}`, {
      ...result,
      expectedDate: date,
      actualDate: manifest.newsletter_date
    });
  }
  if (Number(manifest.candidate_count) !== payloadValidation.candidateCount) {
    throw new CandidateArtifactValidationError(`Candidate manifest candidate_count mismatch for ${result.manifestRelPath}`, {
      ...result,
      expectedCandidateCount: payloadValidation.candidateCount,
      actualCandidateCount: manifest.candidate_count
    });
  }

  return {
    ...result,
    manifest,
    validation_status: 'validated'
  };
}

function inputSummary(input, mode) {
  return {
    mode,
    candidate_artifact: input.relPath,
    candidate_artifact_hash: input.hash,
    manifest: input.manifestRelPath,
    manifest_type: input.manifest?.manifest_type || '',
    manifest_status: input.validation_status,
    llm_used: input.manifest?.llm_used ?? false,
    merge_mode: input.manifest?.merge_mode || '',
    candidate_count: input.manifest?.candidate_count ?? null
  };
}

function resolveExplicitArtifactInput(root, date, inputPath) {
  const resolvedPath = repoPath(root, inputPath);
  if (!resolvedPath) {
    throw new CandidateArtifactValidationError(`NEWSROOM_CANDIDATE_INPUT_PATH must stay inside the repository: ${inputPath}`);
  }

  const name = path.basename(resolvedPath);
  const inputRelPath = relPath(root, resolvedPath);
  if (name === 'merged-candidates.json' && inputRelPath === mergedCandidatesRelPath(date)) {
    return validateCandidateArtifact({
      root,
      date,
      candidatePath: resolvedPath,
      manifestPath: path.join(path.dirname(resolvedPath), 'merged-candidate-manifest.json'),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'merged_candidate',
      expectedLlmUsed: 'any'
    });
  }
  if (name === 'manual-candidates.json' && inputRelPath === manualCandidatesRelPath(date)) {
    return validateCandidateArtifact({
      root,
      date,
      candidatePath: resolvedPath,
      manifestPath: path.join(path.dirname(resolvedPath), 'raw-candidate-manifest.json'),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'raw_candidate'
    });
  }
  throw new CandidateArtifactValidationError(
    `NEWSROOM_CANDIDATE_INPUT_PATH must point to approved candidate artifact for ${date}: ` +
    `${manualCandidatesRelPath(date)} or ${mergedCandidatesRelPath(date)}. ` +
    `Legacy ${collectedCandidatesRelPath(date)} is only allowed as automatic transition fallback.`,
    {
      inputPath,
      resolvedPath,
      allowedPaths: [manualCandidatesRelPath(date), mergedCandidatesRelPath(date)],
      rejectedPath: inputRelPath
    }
  );
}

function resolveCandidateInputArtifact({
  root = process.cwd(),
  date,
  env = process.env
} = {}) {
  const mode = String(env.NEWSROOM_CANDIDATE_INPUT_MODE || CANDIDATE_INPUT_MODES.DEFAULT).trim().toLowerCase() ||
    CANDIDATE_INPUT_MODES.DEFAULT;

  if (mode !== CANDIDATE_INPUT_MODES.ARTIFACT) {
    const input = validateCandidateArtifact({
      root,
      date,
      candidatePath: collectedCandidatesPath(root, date),
      allowMissingManifest: true
    });
    return {
      ...input,
      input_mode: mode,
      status_extra: inputSummary(input, mode)
    };
  }

  const explicitInputPath = String(env.NEWSROOM_CANDIDATE_INPUT_PATH || '').trim();
  if (explicitInputPath) {
    const input = resolveExplicitArtifactInput(root, date, explicitInputPath);
    return {
      ...input,
      input_mode: mode,
      status_extra: inputSummary(input, mode)
    };
  }

  const mergedPath = mergedCandidatesPath(root, date);
  if (fs.existsSync(mergedPath)) {
    const input = validateCandidateArtifact({
      root,
      date,
      candidatePath: mergedPath,
      manifestPath: mergedCandidateManifestPath(root, date),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'merged_candidate',
      expectedLlmUsed: 'any'
    });
    return {
      ...input,
      input_mode: mode,
      status_extra: inputSummary(input, mode)
    };
  }

  const manualPath = manualCandidatesPath(root, date);
  if (fs.existsSync(manualPath)) {
    const input = validateCandidateArtifact({
      root,
      date,
      candidatePath: manualPath,
      manifestPath: rawCandidateManifestPath(root, date),
      requireManifest: true,
      validationMode: 'strict',
      expectedManifestType: 'raw_candidate'
    });
    return {
      ...input,
      input_mode: mode,
      status_extra: inputSummary(input, mode)
    };
  }

  const fallbackPath = collectedCandidatesPath(root, date);
  const input = validateCandidateArtifact({
    root,
    date,
    candidatePath: fallbackPath,
    allowMissingManifest: true,
    validationMode: 'compatibility'
  });
  return {
    ...input,
    input_mode: mode,
    status_extra: inputSummary(input, mode)
  };
}

module.exports = {
  CANDIDATE_INPUT_MODES,
  CandidateArtifactValidationError,
  buildMergedCandidateManifest,
  buildRawCandidateManifest,
  hashFile,
  resolveCandidateInputArtifact,
  sourceDiscoveryCandidateStats,
  sourceDiscoveryStatsSummary,
  validateCandidateArtifact,
  writeManualCandidateArtifacts,
  writeMergedCandidateArtifacts,
  collectedCandidatesRelPath,
  manualCandidatesRelPath,
  geminiCandidatesRelPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesRelPath,
  rawCandidateManifestRelPath
};
