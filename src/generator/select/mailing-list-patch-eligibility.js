const { ensureArray } = require('../../shared/common/value-coercion');
const { evidenceStrength, technicalDepth } = require('../../discovery/score-source-candidates');
const {
  normalizeSourceQuality,
  sourceQualityFlatFields
} = require('../../shared/collect/source-quality-classifier');

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
  // blocker가 하나도 없는데 막혀 있는 후보는 이 승급의 대상이 아니다. conditional 정책이 구체적인
  // 날짜 근거가 없어 막은 경우가 그렇고, 그때 아래 every(...)는 빈 배열이라 무조건 true가 된다.
  // 정책이 main에서 빼 둔 후보(watchlist_only/blocked)는 policy_locked_out_of_main blocker를 달고
  // 오므로 이 가드가 아니라 every(...)가 막는다(#1056).
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

// Apply the eligibility upgrade to a candidate, keeping the canonical
// source_quality object and the flat source-quality fields in sync so the
// upgrade propagates to every downstream consumer (capsule build, editor
// hard-block validation, quality gate) without tripping source-quality drift.
function applyMailingListPatchEligibilityToCandidate(candidate, policy) {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const current = normalizeSourceQuality(candidate);
  const upgraded = upgradeMailingListPatchEligibility(current, candidate, policy);
  if (upgraded === current) return candidate;
  return {
    ...candidate,
    source_quality: upgraded,
    ...sourceQualityFlatFields(upgraded)
  };
}

module.exports = {
  applyMailingListPatchEligibilityToCandidate,
  upgradeMailingListPatchEligibility
};
