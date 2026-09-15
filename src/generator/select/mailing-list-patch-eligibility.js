const { ensureArray } = require('../../shared/common/value-coercion');
const { candidateTitle } = require('../../shared/collect/source-intelligence-utils');
const { evidenceStrength, technicalDepth } = require('../../discovery/score-source-candidates');
const {
  normalizeSourceQuality,
  sourceQualityFlatFields
} = require('../../shared/collect/source-quality-classifier');

// Blockers that strong technical evidence is allowed to satisfy in place of an
// external primary confirmation. A patch submitted to a project mailing list or
// review system (lore, patchwork, Gerrit) IS the primary artifact, so for a
// candidate that is such a submission (see patchSubmission below) strong
// evidence counts as the confirmation the conditional source policy asks for.
// Any other blocker (source gap, unknown quality, blocked linked evidence,
// missing url, ...) must keep the candidate out of a main slot.
const UPGRADEABLE_BLOCKERS = new Set([
  'cross_check_required_but_missing',
  'candidate_only_without_primary_confirmation'
]);

// 메일링 리스트 메일의 제목 접두. 실데이터에는 `[PATCH v2 0/6]`뿐 아니라 `[PATCHv2 6/6]`,
// `[RESEND PATCH v5 0/2]`, `[RFC PATCH]`, `[PATCH RESEND v3 1/2]`가 있다. 답장(`Re: [PATCH …]`)은
// lore 수집기(isLoreReplyItem)가 이미 걸러 이 함수까지 오지 않으므로 여기서는 맞추지 않는다.
const PATCH_SUBMISSION_TITLE = /^\s*\[(?:RESEND\s+)?(?:RFC\s+)?PATCH(?:v\d+)?\b/;

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

// 후보가 패치 제출인지. 위 머리말이 승급 근거로 삼는 것은 "패치가 곧 1차 산출물"이라는 사실이므로,
// 패치가 아닌 메일(사용자 문의, 공지, 빌드 로봇 보고)은 기술 낱말이 있어도 교차 확인을 대신할 수
// 없다(#1129, 09-14호의 Acer 노트북 카메라 문의가 technicalDepth 0.85로 승급된 사례). 세 가지 근거
// 중 하나면 된다: 제목 접두, 수집기가 실어 준 시리즈 키(patchwork REST series id, lore message-id에서
// 파생한 lore-series 키 — gmail 형식 message-id의 질문 스레드는 null), Gerrit Change-Id.
// 정책 키로 두지 않는다. 누구도 false로 둘 일이 없는 토글이라서다.
function patchSubmission(candidate) {
  if (PATCH_SUBMISSION_TITLE.test(candidateTitle(candidate))) return true;
  if (hasValue(candidate.seriesId ?? candidate.series_id)) return true;
  return hasValue(candidate.gerrit_change_id);
}

function strongMailingListPatch(sourceQuality, candidate, policy) {
  if (!policy || policy.enabled !== true) return false;
  if (sourceQuality.source_role !== policy.sourceRole) return false;
  if (!patchSubmission(candidate)) return false;
  if (evidenceStrength(candidate) < policy.evidenceStrengthMin) return false;
  if (technicalDepth(candidate) < policy.technicalDepthMin) return false;
  const blockers = ensureArray(sourceQuality.main_article_source_blockers);
  // blocker가 하나도 없는데 막혀 있는 후보는 이 승급의 대상이 아니다. conditional 정책이 구체적인
  // 날짜 근거가 없어 막은 경우가 그렇고, 그때 아래 every(...)는 빈 배열이라 무조건 true가 된다.
  // classifySourceQuality가 방금 분류한 값은 정책이 main에서 빼 둔 후보(watchlist_only/blocked)에
  // policy_locked_out_of_main blocker를 달아 주므로, 그런 후보는 이 가드가 아니라 every(...)가
  // 막는다(#1056). 다만 이 함수는 임의의 source_quality를 받고, normalizeSourceQuality는 후보에
  // 이미 실려 있는 source_quality를 그대로 돌려준다 — 이 blocker가 생기기 전에 수집된 후보는
  // 여전히 빈 배열로 들어오고, 그쪽은 이 가드가 막는다.
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
