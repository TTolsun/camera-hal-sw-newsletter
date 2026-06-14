const { ensureArray } = require('../../shared/common/value-coercion');
const { evidenceStrength, technicalDepth } = require('../../discovery/score-source-candidates');

// Blockers that strong technical evidence is allowed to satisfy in place of an
// external primary confirmation. A kernel patch posted to a project mailing list
// IS the primary artifact, so for these sources strong evidence counts as the
// confirmation the conditional source policy asks for. Any other blocker
// (source gap, unknown quality, blocked linked evidence, missing url, ...) must
// keep the candidate out of a main slot.
const UPGRADEABLE_BLOCKERS = new Set([
  'cross_check_required_but_missing',
  'candidate_only_without_primary_confirmation'
]);

function strongMailingListPatch(sourceQuality, candidate, policy) {
  if (!policy || policy.enabled !== true) return false;
  if (sourceQuality.source_role !== policy.sourceRole) return false;
  if (evidenceStrength(candidate) < policy.evidenceStrengthMin) return false;
  if (technicalDepth(candidate) < policy.technicalDepthMin) return false;
  const blockers = ensureArray(sourceQuality.main_article_source_blockers);
  if (blockers.length === 0) return false;
  return blockers.every(blocker => UPGRADEABLE_BLOCKERS.has(blocker));
}

// Upgrade a blocked project mailing-list patch to main-article eligible when its
// technical evidence is strong enough. Returns the source-quality object
// unchanged when the candidate is already eligible or does not qualify.
function upgradeMailingListPatchEligibility(sourceQuality, candidate, policy) {
  if (!sourceQuality || sourceQuality.main_article_source_allowed === true) return sourceQuality;
  if (!strongMailingListPatch(sourceQuality, candidate, policy)) return sourceQuality;
  return {
    ...sourceQuality,
    source_quality_status: 'allowed',
    main_article_source_allowed: true,
    main_article_source_allowed_reason:
      'Strong-evidence project mailing-list patch satisfies main-article eligibility; frame as proposed/under-review.',
    main_article_source_blockers: [],
    cross_check_status: 'required_satisfied',
    conditional_evidence_type: 'project_patch_strong_evidence'
  };
}

module.exports = {
  upgradeMailingListPatchEligibility
};
