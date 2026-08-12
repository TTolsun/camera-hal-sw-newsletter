// Orchestrator completion-pass helpers.
//
// Single responsibility: support the editor completion pass that refills main
// article slots emptied by demotion/removal — pick the eligible reserve/primary
// candidates that may fill them, and serialize the locked/duplicate/source-gap
// sections as the completion prompt's exclusion context. Pure transforms on
// their arguments only — no generationRunState, no fs, no module globals —
// extracted verbatim from the generation orchestrator
// (gemini-newsroom-newsletter.js).

const { ensureArray } = require('../../shared/common/value-coercion');
const { sectionSummary } = require('../../shared/common/section-identity');
const { isFinalSelected } = require('../select/selection-diagnostics');
const {
  isReserveCandidate,
  isMainSupplementBucket,
  reporterCandidateRejectionReason,
  candidatePriority
} = require('./orchestrator-reporter-normalize');
const {
  candidateDuplicateReason,
  retryRejectionRecord
} = require('./orchestrator-section-locking');

function availableCompletionCandidates(reporter, currentSections, excludedSections = [], rejected = [], options = {}) {
  const allCandidates = ensureArray(reporter?.candidates).filter(candidate =>
    isFinalSelected(candidate) || (options.allowReserve === true && isReserveCandidate(candidate))
  );
  const hasStrongerReserve = allCandidates.some(candidate =>
    isReserveCandidate(candidate) &&
    isMainSupplementBucket(candidate) &&
    !reporterCandidateRejectionReason(candidate) &&
    !candidateDuplicateReason(candidate, currentSections, 'locked') &&
    !candidateDuplicateReason(candidate, excludedSections, 'demoted')
  );
  const accepted = [];
  for (const candidate of allCandidates) {
    let reason = '';
    const eligibilityReason = reporterCandidateRejectionReason(candidate);
    if (eligibilityReason) {
      reason = /source_gap_risk=true|watch page|missing dated evidence|evidence_score=/i.test(eligibilityReason)
        ? 'source_gap_candidate'
        : eligibilityReason;
    } else if (!isMainSupplementBucket(candidate)) {
      reason = hasStrongerReserve ? 'weaker_priority_than_available_reserve' : 'ineligible_bucket';
    } else {
      reason =
        candidateDuplicateReason(candidate, currentSections, 'locked') ||
        candidateDuplicateReason(candidate, excludedSections, 'demoted');
    }
    if (reason) {
      rejected.push(retryRejectionRecord(candidate, reason));
      continue;
    }
    accepted.push(candidate);
  }
  return accepted.sort((a, b) =>
    candidatePriority(a) - candidatePriority(b) ||
    Number(b.deterministic_score || 0) - Number(a.deterministic_score || 0) ||
    String(a.title || '').localeCompare(String(b.title || ''))
  );
}

function buildCompletionExclusionContext(lockedSections, duplicateSections, sourceGapOrIneligibleSections) {
  const context = {
    locked_sections: lockedSections.map((section, index) => sectionSummary(section, index)),
    duplicate_or_rejected_sections: duplicateSections.map((section, index) => sectionSummary(section, index)),
    source_gap_or_ineligible_sections: sourceGapOrIneligibleSections.map((section, index) => sectionSummary(section, index))
  };
  return JSON.stringify(context, null, 2);
}

module.exports = {
  availableCompletionCandidates,
  buildCompletionExclusionContext
};
