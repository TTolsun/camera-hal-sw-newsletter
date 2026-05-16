const fs = require('fs');
const path = require('path');

const {
  qualityGatePolicy
} = require('./newsletter-policy');

const STATUS_FAILED_REPAIR_REVIEWABLE = 'FAILED_REPAIR_REVIEWABLE';
const COMPOSITION_MODE_NEEDS_FIX = 'NEEDS_FIX';

const DEFAULT_STATUS = {
  status: 'UNKNOWN',
  fact_check_status: 'UNKNOWN',
  must_fix_count: 0,
  source_gap_count: 0,
  failure_kind: '',
  quality_status: 'UNKNOWN',
  quality_score: null,
  quality_threshold: qualityGatePolicy.threshold,
  publish_ready: false,
  selection_publish_ready: false,
  final_publish_ready: false,
  review_gate_passed: false,
  publish_gate_passed: false,
  stale_claim_status: 'UNKNOWN',
  stale_claim_removed_count: 0,
  stale_claim_hard_failure_count: 0
};

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, value: null, error: null };
  }
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

function numberOrNull(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function booleanOrNull(value) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function booleanOrFalse(value) {
  return booleanOrNull(value) === true;
}

function resolveDate(options = {}, status = {}, root = process.cwd()) {
  if (options.date) return options.date;
  if (status.date) return status.date;
  const datePath = path.join(root, '.tmp', 'newsletter-date.txt');
  if (fs.existsSync(datePath)) return fs.readFileSync(datePath, 'utf8').trim();
  return process.env.NEWSLETTER_DATE || '';
}

function resolveValidateOutcome(status = {}, options = {}) {
  if (options.validateOutcome) return options.validateOutcome;
  if (process.env.VALIDATE_OUTCOME) return process.env.VALIDATE_OUTCOME;
  if (status.validate_ok === true) return 'success';
  if (status.validate_ok === false) return 'failure';
  return 'unknown';
}

function resolveStatusInput(root, options = {}) {
  if (options.status) {
    return {
      status: { ...DEFAULT_STATUS, ...options.status },
      rawStatus: options.status,
      sourcePath: null,
      error: null
    };
  }

  const sourcePath = options.statusPath || path.join(root, '.tmp', 'newsletter-generation-status.json');
  const parsed = readJsonIfExists(sourcePath);
  if (parsed.error) {
    return {
      status: {
        ...DEFAULT_STATUS,
        failure_stage: 'publish-status',
        failure_reason: `Could not read newsletter-generation-status.json: ${parsed.error.message}`
      },
      rawStatus: {},
      sourcePath,
      error: parsed.error
    };
  }
  return {
    status: { ...DEFAULT_STATUS, ...(parsed.value || {}) },
    rawStatus: parsed.value || {},
    sourcePath,
    error: null
  };
}

function factCheckSummary(status, factCheck) {
  const mustFixItems = ensureArray(factCheck?.must_fix);
  const sourceGaps = ensureArray(factCheck?.source_gaps);
  const mustFixCount = factCheck
    ? numberOrNull(mustFixItems.length)
    : numberOrNull(status.must_fix_count);
  const sourceGapCount = factCheck
    ? numberOrNull(factCheck.source_gap_count, sourceGaps.length)
    : numberOrNull(status.source_gap_count);
  return {
    status: factCheck?.status || status.fact_check_status || 'UNKNOWN',
    mustFixCount: mustFixCount ?? 0,
    sourceGapCount: sourceGapCount ?? 0,
    sample: mustFixItems
      .slice(0, 3)
      .map(item => typeof item === 'string' ? item : item?.issue || item?.claim || item?.headline || item?.reason)
      .filter(Boolean)
  };
}

function qualitySummary(status, qualityReport) {
  const deductionCount = qualityReport
    ? ensureArray(qualityReport.deductions).length
    : numberOrNull(status.quality_deduction_count) || 0;
  return {
    status: qualityReport?.status || status.quality_status || 'UNKNOWN',
    score: numberOrNull(qualityReport?.score, status.quality_score),
    threshold: numberOrNull(qualityReport?.threshold, status.quality_threshold, qualityGatePolicy.threshold) ?? qualityGatePolicy.threshold,
    deductionCount
  };
}

function staleClaimSummary(status, staleReport) {
  const removedCount = numberOrNull(
    staleReport
      ? ensureArray(staleReport.stale_claim_items_removed).length +
      ensureArray(staleReport?.unsupported_release_claims_removed).length +
      ensureArray(staleReport?.unused_references_removed).length
      : null,
    status.stale_claim_removed_count
  ) ?? 0;
  const hardFailureCount = numberOrNull(
    staleReport ? ensureArray(staleReport.hard_failures).length : null,
    status.stale_claim_hard_failure_count
  ) ?? 0;
  return {
    status: staleReport?.status || status.stale_claim_status || 'UNKNOWN',
    removedCount,
    hardFailureCount
  };
}

function selectionSummary(status, shortlistReport) {
  const composition = shortlistReport?.composition_summary || status.composition_summary || {};
  return {
    selectionPublishReady: booleanOrNull(shortlistReport?.publish_ready) ?? booleanOrFalse(status.selection_publish_ready),
    reviewGatePassed: booleanOrNull(shortlistReport?.review_gate_passed) ?? booleanOrFalse(status.review_gate_passed),
    publishGatePassed: booleanOrNull(shortlistReport?.publish_gate_passed) ?? booleanOrFalse(status.publish_gate_passed),
    compositionMode: shortlistReport?.composition_mode || status.composition_mode || 'UNKNOWN',
    selectionCompositionMode: shortlistReport?.selection_composition_mode || status.selection_composition_mode || shortlistReport?.composition_mode || status.composition_mode || 'UNKNOWN',
    compositionReason: shortlistReport?.composition_reason || status.composition_reason || '',
    composition,
    selectionWarnings: ensureArray(shortlistReport?.selection_warnings).length > 0
      ? shortlistReport.selection_warnings
      : ensureArray(status.selection_warnings),
    selectionErrors: ensureArray(shortlistReport?.selection_errors).length > 0
      ? shortlistReport.selection_errors
      : ensureArray(status.selection_errors),
    publishGateReasonCodes: ensureArray(shortlistReport?.publish_gate_reason_codes).length > 0
      ? shortlistReport.publish_gate_reason_codes
      : ensureArray(status.publish_gate_reason_codes),
    publishGateReasonSummary: ensureArray(shortlistReport?.publish_gate_reason_summary).length > 0
      ? shortlistReport.publish_gate_reason_summary
      : ensureArray(status.publish_gate_reason_summary),
    selectionShortageHints: ensureArray(shortlistReport?.selection_shortage_hints).length > 0
      ? shortlistReport.selection_shortage_hints
      : ensureArray(status.selection_shortage_hints)
  };
}

function displayStatus(status, finalPublishReady, consistencyErrors, reviewableRepairFailure = false) {
  if (consistencyErrors.length > 0) return 'FAILED';
  if (reviewableRepairFailure) return COMPOSITION_MODE_NEEDS_FIX;
  if (finalPublishReady) return 'PASS';
  if (status.status === 'FAILED') return 'FAILED';
  if (status.status === 'UNKNOWN') return 'UNKNOWN';
  return 'NEEDS_FIX';
}

function readPublishStatusInputs(options = {}) {
  const root = options.root || process.cwd();
  const statusInput = resolveStatusInput(root, options);
  const date = resolveDate(options, statusInput.status, root);
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const editor = readJsonIfExists(path.join(newsroomDir, 'editor-draft.json'));
  const quality = readJsonIfExists(path.join(newsroomDir, 'quality-report.json'));
  const factCheck = readJsonIfExists(path.join(newsroomDir, 'fact-check-report.json'));
  const repairFailure = readJsonIfExists(path.join(newsroomDir, 'repair-failure.json'));
  const generationStatus = readJsonIfExists(path.join(newsroomDir, 'generation-status.json'));
  const staleClaim = readJsonIfExists(path.join(newsroomDir, 'stale-claim-report.json'));
  const shortlist = readJsonIfExists(path.join(newsroomDir, 'shortlisted-candidates.json'));

  return {
    root,
    date,
    newsroomDir,
    statusInput,
    editor,
    quality,
    factCheck,
    repairFailure,
    generationStatus,
    staleClaim,
    shortlist
  };
}

function resolvePublishStatus(options = {}) {
  const inputs = options.inputs || readPublishStatusInputs(options);
  const status = inputs.statusInput.status;
  const rawStatus = inputs.statusInput.rawStatus;
  const consistencyErrors = [];

  if (inputs.statusInput.error) {
    consistencyErrors.push(`Could not read .tmp/newsletter-generation-status.json: ${inputs.statusInput.error.message}`);
  }
  for (const [name, artifact] of Object.entries({
    'editor-draft.json': inputs.editor,
    'quality-report.json': inputs.quality,
    'fact-check-report.json': inputs.factCheck,
    'repair-failure.json': inputs.repairFailure,
    'generation-status.json': inputs.generationStatus,
    'stale-claim-report.json': inputs.staleClaim,
    'shortlisted-candidates.json': inputs.shortlist
  })) {
    if (artifact.error) {
      consistencyErrors.push(`Could not read content/newsroom/${inputs.date}/${name}: ${artifact.error.message}`);
    }
  }

  const failedRepairReviewableStatus = status.status === STATUS_FAILED_REPAIR_REVIEWABLE;
  const repairReviewArtifacts = {
    'editor-draft.json': inputs.editor,
    'quality-report.json': inputs.quality,
    'fact-check-report.json': inputs.factCheck,
    'repair-failure.json': inputs.repairFailure,
    'generation-status.json': inputs.generationStatus
  };
  if (failedRepairReviewableStatus) {
    for (const [name, artifact] of Object.entries(repairReviewArtifacts)) {
      if (!artifact.exists) {
        consistencyErrors.push(`Missing reviewable repair artifact: content/newsroom/${inputs.date}/${name}`);
      }
    }
  }
  const reviewableRepairFailure = failedRepairReviewableStatus &&
    Object.values(repairReviewArtifacts).every(artifact => artifact.exists && !artifact.error);

  const factCheck = factCheckSummary(status, inputs.factCheck.value);
  const quality = qualitySummary(status, inputs.quality.value);
  const staleClaim = staleClaimSummary(status, inputs.staleClaim.value);
  const selection = selectionSummary(status, inputs.shortlist.value);
  const validateOutcome = resolveValidateOutcome(status, options);
  const explicitStatusInput = inputs.statusInput.sourcePath === null;
  const artifactFinalPublishReadyConditions = {
    quality_report_present: explicitStatusInput || (inputs.quality.exists && !inputs.quality.error),
    fact_check_report_present: explicitStatusInput || (inputs.factCheck.exists && !inputs.factCheck.error),
    stale_claim_report_present: explicitStatusInput || (inputs.staleClaim.exists && !inputs.staleClaim.error),
    shortlisted_candidates_present: explicitStatusInput || (inputs.shortlist.exists && !inputs.shortlist.error),
    selection_publish_ready: selection.selectionPublishReady === true,
    quality_status_pass: quality.status === 'PASS',
    quality_score_meets_threshold: Number.isFinite(quality.score) && quality.score >= quality.threshold,
    fact_check_status_pass: factCheck.status === 'PASS',
    must_fix_count_zero: factCheck.mustFixCount === 0,
    source_gap_count_zero: factCheck.sourceGapCount === 0,
    stale_claim_status_not_needs_fix: staleClaim.status !== 'NEEDS_FIX',
    stale_claim_hard_failure_count_zero: staleClaim.hardFailureCount === 0
  };
  const artifactFinalPublishReady = !failedRepairReviewableStatus &&
    Object.values(artifactFinalPublishReadyConditions).every(Boolean);
  const validationPassed = validateOutcome === 'success';
  const finalPublishReadyConditions = {
    artifact_final_publish_ready: artifactFinalPublishReady,
    validate_outcome_success: validationPassed
  };
  const finalPublishReady = !failedRepairReviewableStatus &&
    Object.values(finalPublishReadyConditions).every(Boolean);
  const statusFinalPublishReady = hasOwn(rawStatus, 'final_publish_ready')
    ? rawStatus.final_publish_ready
    : undefined;

  const validationOnlyStatusMismatch =
    statusFinalPublishReady === false &&
    artifactFinalPublishReady === true &&
    status.validate_ok === false;

  if (
    hasOwn(rawStatus, 'final_publish_ready') &&
    statusFinalPublishReady !== artifactFinalPublishReady &&
    !validationOnlyStatusMismatch &&
    !failedRepairReviewableStatus
  ) {
    consistencyErrors.push(
      `status.final_publish_ready=${String(statusFinalPublishReady)} but artifact_final_publish_ready=${String(artifactFinalPublishReady)}`
    );
  }

  const resolvedStatus = {
    ...status,
    status: displayStatus(status, finalPublishReady, consistencyErrors, reviewableRepairFailure),
    generation_status: status.status || 'UNKNOWN',
    fact_check_status: factCheck.status,
    must_fix_count: factCheck.mustFixCount,
    source_gap_count: factCheck.sourceGapCount,
    quality_status: quality.status,
    quality_score: quality.score,
    quality_threshold: quality.threshold,
    quality_deduction_count: quality.deductionCount,
    publish_ready: failedRepairReviewableStatus ? false : selection.selectionPublishReady,
    selection_publish_ready: failedRepairReviewableStatus ? false : selection.selectionPublishReady,
    artifact_final_publish_ready: artifactFinalPublishReady,
    final_publish_ready: finalPublishReady,
    validate_ok: validationPassed,
    validation_passed: validationPassed,
    status_final_publish_ready: statusFinalPublishReady,
    review_gate_passed: failedRepairReviewableStatus ? reviewableRepairFailure : selection.reviewGatePassed,
    publish_gate_passed: failedRepairReviewableStatus ? false : selection.publishGatePassed,
    composition_mode: failedRepairReviewableStatus ? COMPOSITION_MODE_NEEDS_FIX : selection.compositionMode,
    selection_composition_mode: failedRepairReviewableStatus ? COMPOSITION_MODE_NEEDS_FIX : selection.selectionCompositionMode,
    composition_reason: selection.compositionReason,
    composition_summary: selection.composition,
    selection_warnings: selection.selectionWarnings,
    selection_errors: selection.selectionErrors,
    publish_gate_reason_codes: selection.publishGateReasonCodes,
    publish_gate_reason_summary: selection.publishGateReasonSummary,
    selection_shortage_hints: selection.selectionShortageHints,
    stale_claim_status: staleClaim.status,
    stale_claim_removed_count: staleClaim.removedCount,
    stale_claim_hard_failure_count: staleClaim.hardFailureCount,
    validate_outcome: validateOutcome,
    artifact_final_publish_ready_conditions: artifactFinalPublishReadyConditions,
    final_publish_ready_conditions: finalPublishReadyConditions,
    consistency_errors: consistencyErrors
  };

  return {
    root: inputs.root,
    date: inputs.date,
    newsroomDir: inputs.newsroomDir,
    status: resolvedStatus,
    rawStatus,
    editor: inputs.editor,
    quality,
    factCheck,
    staleClaim,
    selection,
    validateOutcome,
    artifactFinalPublishReady,
    finalPublishReady,
    validationPassed,
    artifactFinalPublishReadyConditions,
    finalPublishReadyConditions,
    consistencyErrors
  };
}

module.exports = {
  DEFAULT_STATUS,
  booleanOrNull,
  ensureArray,
  readPublishStatusInputs,
  resolveDate,
  resolvePublishStatus
};
