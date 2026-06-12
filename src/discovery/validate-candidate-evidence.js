const {
  candidateTitle,
  candidateUrl,
  stableId,
  text
} = require('../core/collect/source-intelligence-utils');

function finalEligible(candidate = {}) {
  return ['main', 'short'].includes(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
}

function shouldDeepCheck(candidate = {}) {
  if (!finalEligible(candidate)) return false;
  if (candidate.duplicate_of_selected_source === true) return false;
  return ['strong_candidate', 'review_candidate'].includes(candidate.source_quality_bucket);
}

function validateOne(candidate = {}, facts = {}) {
  const id = candidate.id || candidate.source_candidate_id || stableId([candidateUrl(candidate), candidateTitle(candidate)]);
  const fact = facts[id] || {};
  const claims = Array.isArray(fact.claims) ? fact.claims : [];
  const supportedClaims = claims.filter(claim => text(claim.evidence_text));
  const unsupportedClaims = claims.filter(claim => !text(claim.evidence_text));
  const unsupportedCount = unsupportedClaims.length;
  const sourceFetchUsed = fact.source_fetch_used === true;
  const sourceFetchStatus = fact.source_fetch_status || 'skipped';
  const sourceFetchError = fact.source_fetch_error || '';
  const validationMode = fact.validation_mode || (candidate.source_gap_risk === true ? 'metadata_only' : 'skipped');
  const fetchFailed = sourceFetchUsed && sourceFetchStatus === 'failed';
  const metadataCanSupportClaim = validationMode === 'metadata_only';
  const hasSupportedCoreClaim = supportedClaims.length > 0 ||
    (metadataCanSupportClaim && Boolean(text(candidate.summary || candidate.behavior_change)));
  let finalSelectionBlocked = false;
  let editorReviewRequired = false;
  let status = validationMode === 'skipped' ? 'not_checked' : 'pass';
  const reasons = [];

  if (candidate.source_gap_risk === true) {
    finalSelectionBlocked = true;
    status = 'blocked';
    reasons.push('source_gap_risk=true');
  }
  if (candidate.stale_claim_risk === 'high' && candidate.editor_approved_exception !== true) {
    finalSelectionBlocked = true;
    status = 'blocked';
    reasons.push('stale_claim_risk=high');
  }
  if (fetchFailed && candidate.source_gap_risk !== true) {
    editorReviewRequired = true;
    status = status === 'blocked' ? status : 'fetch_failed_review_required';
    reasons.push('source_fetch_failed');
  } else if (unsupportedCount > 0 && !hasSupportedCoreClaim) {
    finalSelectionBlocked = true;
    status = 'blocked';
    reasons.push('unsupported_claims_without_supported_core_claim');
  } else if (unsupportedCount > 0) {
    editorReviewRequired = true;
    status = status === 'blocked' ? status : 'editor_review_required';
    reasons.push('unsupported_claims_excluded');
  }

  return {
    candidate_id: id,
    url: candidateUrl(candidate),
    title: candidateTitle(candidate),
    deep_checked: sourceFetchUsed && sourceFetchStatus === 'success',
    source_fetch_used: sourceFetchUsed,
    source_fetch_status: sourceFetchStatus,
    source_fetch_error: sourceFetchError,
    validation_mode: validationMode,
    unsupported_claims: unsupportedCount,
    supported_claims: supportedClaims.length,
    final_selection_blocked: finalSelectionBlocked,
    editor_review_required: editorReviewRequired,
    unsupported_claims_excluded: unsupportedCount > 0 && hasSupportedCoreClaim,
    evidence_validation_status: status,
    reasons
  };
}

function validateCandidateEvidence(candidates = [], sourceFacts = {}, options = {}) {
  const factMap = {};
  for (const fact of sourceFacts.sources || []) {
    const id = fact.id || stableId([fact.url, fact.title]);
    factMap[id] = fact;
  }
  const checked = candidates
    .map(candidate => validateOne(candidate, factMap));
  const byId = new Map(checked.map(item => [item.candidate_id, item]));
  const annotatedCandidates = candidates.map(candidate => {
    const id = candidate.id || candidate.source_candidate_id || stableId([candidateUrl(candidate), candidateTitle(candidate)]);
    const item = byId.get(id);
    if (!item) {
      return {
        ...candidate,
        final_selection_blocked: candidate.final_selection_blocked === true,
        editor_review_required: candidate.editor_review_required === true,
        unsupported_claims_excluded: candidate.unsupported_claims_excluded === true,
        evidence_validation_status: candidate.evidence_validation_status || 'not_checked'
      };
    }
    return {
      ...candidate,
      final_selection_blocked: item.final_selection_blocked,
      editor_review_required: item.editor_review_required,
      unsupported_claims_excluded: item.unsupported_claims_excluded,
      evidence_validation_status: item.evidence_validation_status
    };
  });

  return {
    report: {
      schema_version: 1,
      report_type: 'evidence_validation',
      newsletter_date: options.newsletterDate || '',
      candidates: checked,
      counts: checked.reduce((counts, item) => {
        counts[item.evidence_validation_status] = (counts[item.evidence_validation_status] || 0) + 1;
        return counts;
      }, {})
    },
    annotatedCandidates
  };
}

module.exports = {
  shouldDeepCheck,
  validateCandidateEvidence,
  validateOne
};
