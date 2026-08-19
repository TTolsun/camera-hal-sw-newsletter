const { ensureArray } = require('../../shared/common/value-coercion');
const fs = require('fs');
const path = require('path');

const {
  qualityGatePolicy
} = require('../../shared/common/newsletter-policy');
const {
  readJsonIfExists
} = require('../../shared/common/json');
const {
  IMAGE_AUDIT_OUTCOME_NOT_REPORTED,
  imageAuditGatePassed
} = require('../../shared/common/publication-mode');

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

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
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

// 이미지 계보 감사는 site 검증과 같은 층의 발행 게이트다(#896). 03 workflow가 감사 outcome을
// 넘겨준 실행에서만 판정에 쓴다. 통과 규칙 자체는 라벨·run summary와 공유하는
// publication-mode.imageAuditGatePassed가 정본이다.
function resolveImageAuditOutcome(options = {}) {
  if (options.imageAuditOutcome) return options.imageAuditOutcome;
  if (process.env.IMAGE_AUDIT_OUTCOME) return process.env.IMAGE_AUDIT_OUTCOME;
  return IMAGE_AUDIT_OUTCOME_NOT_REPORTED;
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
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
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

// artifact 읽기 단계의 일관성 오류만 수집한다.
function collectArtifactConsistencyErrors(inputs) {
  const errors = [];
  if (inputs.statusInput.error) {
    errors.push(`Could not read .tmp/newsletter-generation-status.json: ${inputs.statusInput.error.message}`);
  }
  const newsroomArtifactsByName = {
    'editor-draft.json': inputs.editor,
    'quality-report.json': inputs.quality,
    'fact-check-report.json': inputs.factCheck,
    'repair-failure.json': inputs.repairFailure,
    'generation-status.json': inputs.generationStatus,
    'stale-claim-report.json': inputs.staleClaim,
    'shortlisted-candidates.json': inputs.shortlist
  };
  for (const [name, artifact] of Object.entries(newsroomArtifactsByName)) {
    if (artifact.error) {
      errors.push(`Could not read articles/content/newsroom/${inputs.date}/${name}: ${artifact.error.message}`);
    }
  }
  return errors;
}

// FAILED_REPAIR_REVIEWABLE 특수 상태의 검토 가능 여부와 누락 artifact 오류를 한곳에서 판정한다.
function resolveReviewableRepairState(status, inputs) {
  const failedRepairReviewableStatus = status.status === STATUS_FAILED_REPAIR_REVIEWABLE;
  const repairReviewArtifacts = {
    'editor-draft.json': inputs.editor,
    'quality-report.json': inputs.quality,
    'fact-check-report.json': inputs.factCheck,
    'repair-failure.json': inputs.repairFailure,
    'generation-status.json': inputs.generationStatus
  };
  const errors = [];
  if (failedRepairReviewableStatus) {
    for (const [name, artifact] of Object.entries(repairReviewArtifacts)) {
      if (!artifact.exists) {
        errors.push(`Missing reviewable repair artifact: articles/content/newsroom/${inputs.date}/${name}`);
      }
    }
  }
  const reviewableRepairFailure = failedRepairReviewableStatus &&
    Object.values(repairReviewArtifacts).every(artifact => artifact.exists && !artifact.error);
  return { failedRepairReviewableStatus, reviewableRepairFailure, errors };
}

// artifact 수준 발행 준비 정책: 조건 맵과 AND 판정을 함께 반환한다.
function computeArtifactFinalPublishReady({
  factCheck,
  quality,
  staleClaim,
  selection,
  inputs,
  explicitStatusInput,
  failedRepairReviewableStatus
}) {
  const conditions = {
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
  const ready = !failedRepairReviewableStatus && Object.values(conditions).every(Boolean);
  return { conditions, ready };
}

// 최종 발행 준비: artifact 준비 상태에 site 검증과 이미지 계보 감사 결과를 결합한다.
function computeFinalPublishReady({
  artifactFinalPublishReady,
  validateOutcome,
  imageAuditOutcome,
  failedRepairReviewableStatus
}) {
  const validationPassed = validateOutcome === 'success';
  const imageAuditPassed = imageAuditGatePassed(imageAuditOutcome);
  const conditions = {
    artifact_final_publish_ready: artifactFinalPublishReady,
    validate_outcome_success: validationPassed,
    image_audit_gate_passed: imageAuditPassed
  };
  const ready = !failedRepairReviewableStatus && Object.values(conditions).every(Boolean);
  return { conditions, ready, validationPassed, imageAuditPassed };
}

// status.final_publish_ready 플래그가 재계산 결과와 불일치하는지 감지한다.
function detectFinalPublishReadyMismatch({ rawStatus, status, artifactFinalPublishReady, failedRepairReviewableStatus }) {
  const statusFinalPublishReady = hasOwn(rawStatus, 'final_publish_ready')
    ? rawStatus.final_publish_ready
    : undefined;

  const validationOnlyStatusMismatch =
    statusFinalPublishReady === false &&
    artifactFinalPublishReady === true &&
    status.validate_ok === false;

  const errors = [];
  if (
    typeof statusFinalPublishReady === 'boolean' &&
    statusFinalPublishReady !== artifactFinalPublishReady &&
    !validationOnlyStatusMismatch &&
    !failedRepairReviewableStatus
  ) {
    errors.push(
      `status.final_publish_ready=${String(statusFinalPublishReady)} but artifact_final_publish_ready=${String(artifactFinalPublishReady)}`
    );
  }
  return { statusFinalPublishReady, errors };
}

// 결정된 값들로 공개 status 객체를 조립한다(정책 계산 없음).
function buildResolvedStatus({
  status,
  factCheck,
  quality,
  staleClaim,
  selection,
  validateOutcome,
  validationPassed,
  imageAuditOutcome,
  imageAuditPassed,
  artifactFinalPublishReady,
  finalPublishReady,
  statusFinalPublishReady,
  failedRepairReviewableStatus,
  reviewableRepairFailure,
  artifactFinalPublishReadyConditions,
  finalPublishReadyConditions,
  consistencyErrors
}) {
  return {
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
    image_audit_outcome: imageAuditOutcome,
    image_audit_gate_passed: imageAuditPassed,
    artifact_final_publish_ready_conditions: artifactFinalPublishReadyConditions,
    final_publish_ready_conditions: finalPublishReadyConditions,
    consistency_errors: consistencyErrors
  };
}

function resolvePublishStatus(options = {}) {
  const inputs = options.inputs || readPublishStatusInputs(options);
  const status = inputs.statusInput.status;
  const rawStatus = inputs.statusInput.rawStatus;

  const artifactConsistencyErrors = collectArtifactConsistencyErrors(inputs);
  const reviewableRepair = resolveReviewableRepairState(status, inputs);
  const failedRepairReviewableStatus = reviewableRepair.failedRepairReviewableStatus;

  const factCheck = factCheckSummary(status, inputs.factCheck.value);
  const quality = qualitySummary(status, inputs.quality.value);
  const staleClaim = staleClaimSummary(status, inputs.staleClaim.value);
  const selection = selectionSummary(status, inputs.shortlist.value);
  const validateOutcome = resolveValidateOutcome(status, options);
  const imageAuditOutcome = resolveImageAuditOutcome(options);
  const explicitStatusInput = inputs.statusInput.sourcePath === null;

  const artifactReadiness = computeArtifactFinalPublishReady({
    factCheck,
    quality,
    staleClaim,
    selection,
    inputs,
    explicitStatusInput,
    failedRepairReviewableStatus
  });
  const finalReadiness = computeFinalPublishReady({
    artifactFinalPublishReady: artifactReadiness.ready,
    validateOutcome,
    imageAuditOutcome,
    failedRepairReviewableStatus
  });
  const mismatch = detectFinalPublishReadyMismatch({
    rawStatus,
    status,
    artifactFinalPublishReady: artifactReadiness.ready,
    failedRepairReviewableStatus
  });

  // 오류 발생 순서대로 합친다: artifact 읽기 -> 검토 repair 누락 -> final 불일치.
  const consistencyErrors = artifactConsistencyErrors
    .concat(reviewableRepair.errors)
    .concat(mismatch.errors);

  const resolvedStatus = buildResolvedStatus({
    status,
    factCheck,
    quality,
    staleClaim,
    selection,
    validateOutcome,
    validationPassed: finalReadiness.validationPassed,
    imageAuditOutcome,
    imageAuditPassed: finalReadiness.imageAuditPassed,
    artifactFinalPublishReady: artifactReadiness.ready,
    finalPublishReady: finalReadiness.ready,
    statusFinalPublishReady: mismatch.statusFinalPublishReady,
    failedRepairReviewableStatus,
    reviewableRepairFailure: reviewableRepair.reviewableRepairFailure,
    artifactFinalPublishReadyConditions: artifactReadiness.conditions,
    finalPublishReadyConditions: finalReadiness.conditions,
    consistencyErrors
  });

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
    imageAuditOutcome,
    artifactFinalPublishReady: artifactReadiness.ready,
    finalPublishReady: finalReadiness.ready,
    validationPassed: finalReadiness.validationPassed,
    imageAuditPassed: finalReadiness.imageAuditPassed,
    artifactFinalPublishReadyConditions: artifactReadiness.conditions,
    finalPublishReadyConditions: finalReadiness.conditions,
    consistencyErrors
  };
}

module.exports = {
  DEFAULT_STATUS,
  booleanOrNull,
  ensureArray,
  factCheckSummary,
  qualitySummary,
  readPublishStatusInputs,
  resolveDate,
  resolvePublishStatus,
  selectionSummary,
  staleClaimSummary
};
