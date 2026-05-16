const {
  candidateTitle,
  candidateUrl,
  stableId,
  text
} = require('../collect/source-intelligence-utils');

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
  const hasSupportedCoreClaim = supportedClaims.length > 0 || Boolean(text(candidate.summary || candidate.behavior_change));
  let finalSelectionBlocked = false;
  let editorReviewRequired = false;
  let status = 'pass';
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
  if (unsupportedCount > 0 && !hasSupportedCoreClaim) {
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
    deep_checked: shouldDeepCheck(candidate),
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
    .filter(candidate => options.includeAll || shouldDeepCheck(candidate) || candidate.source_gap_risk === true)
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
