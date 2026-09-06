const assert = require('node:assert/strict');
const test = require('node:test');

const {
  upgradeMailingListPatchEligibility,
  applyMailingListPatchEligibilityToCandidate
} = require('../../../select/mailing-list-patch-eligibility');
const { buildArticleCapsule } = require('../../../select/article-capsules');
const { decorateCandidate } = require('../../../select/newsroom-selection');
const { candidateSelectionViolation } = require('../../../quality/quality-deduction-rules');
const {
  classifySourceQuality,
  sourceQualityFieldDrift
} = require('../../../../shared/collect/source-quality-classifier');
const { evidenceStrength, technicalDepth } = require('../../../../discovery/score-source-candidates');

const POLICY = {
  enabled: true,
  sourceRole: 'project_mailing_list_source',
  evidenceStrengthMin: 0.5,
  technicalDepthMin: 0.5
};

function blockedMailingListSourceQuality(overrides = {}) {
  return {
    source_role: 'project_mailing_list_source',
    source_url_quality: 'project_mailing_list_release',
    source_quality_status: 'blocked',
    main_article_source_allowed: false,
    main_article_source_allowed_reason: 'Source requires primary confirmation before main promotion.',
    main_article_source_blockers: ['cross_check_required_but_missing'],
    cross_check_status: 'required_missing',
    requires_cross_check: true,
    requires_conditional_evidence: true,
    conditional_evidence_type: 'primary_confirmation',
    ...overrides
  };
}

function strongPatchCandidate(overrides = {}) {
  return {
    title: '[PATCH v2 0/6] media: v4l2-ctrls: bound stateless HEVC/AV1 tile counts',
    hasDatedEvidence: true,
    source_gap_risk: false,
    summary: 'V4L2 control bounds validation for HEVC and AV1 tile counts in the media subsystem.',
    behavior_change: 'Adds bounds validation to v4l2-ctrls for stateless HEVC/AV1 decoder tile counts.',
    ...overrides
  };
}

// A candidate carrying both the canonical source_quality object and the flat
// fields the pipeline keeps in sync, modelling a real collected mailing-list patch.
function blockedMailingListCandidate(overrides = {}) {
  const sourceQuality = blockedMailingListSourceQuality();
  return {
    title: '[PATCH v2 0/6] media: v4l2-ctrls: bound stateless HEVC/AV1 tile counts',
    url: 'https://lore.kernel.org/linux-media/20260614155609.3107600-1-author@example.com/',
    source: 'lore.kernel.org linux-media list',
    published_date: '2026-06-14T00:00:00Z',
    summary: 'V4L2 control bounds validation for stateless HEVC and AV1 tile counts in the media subsystem.',
    behavior_change: 'Adds bounds validation to v4l2-ctrls for stateless HEVC/AV1 decoder tile counts.',
    api_or_component: 'v4l2-ctrls',
    version_or_release: 'V2 PATCH series',
    relevance_bucket: 'camera_driver_image_pipeline',
    hasDatedEvidence: true,
    source_gap_risk: false,
    reference_only: false,
    isWatchPage: false,
    finalSelectionEligibility: 'main',
    source_quality_required: true,
    source_quality: sourceQuality,
    source_role: sourceQuality.source_role,
    source_url_quality: sourceQuality.source_url_quality,
    source_quality_status: sourceQuality.source_quality_status,
    main_article_source_allowed: sourceQuality.main_article_source_allowed,
    main_article_source_allowed_reason: sourceQuality.main_article_source_allowed_reason,
    main_article_source_blockers: sourceQuality.main_article_source_blockers,
    cross_check_status: sourceQuality.cross_check_status,
    requires_cross_check: sourceQuality.requires_cross_check,
    requires_conditional_evidence: sourceQuality.requires_conditional_evidence,
    conditional_evidence_type: sourceQuality.conditional_evidence_type,
    ...overrides
  };
}

test('strong-evidence mailing-list patch source quality is upgraded to main-eligible', () => {
  const result = upgradeMailingListPatchEligibility(
    blockedMailingListSourceQuality(),
    strongPatchCandidate(),
    POLICY
  );
  assert.equal(result.main_article_source_allowed, true);
  assert.equal(result.source_quality_status, 'allowed');
  assert.equal(result.cross_check_status, 'required_satisfied');
  assert.equal(result.conditional_evidence_type, 'project_patch_strong_evidence');
  assert.deepEqual(result.main_article_source_blockers, []);
});

test('thin mailing-list reply with low technical depth stays blocked', () => {
  const candidate = strongPatchCandidate({
    title: 'Re: [PATCH v10 4/6] dt-bindings: sun6i-a31-mipi-dphy: Add V3s SoC compatible entry',
    summary: '',
    behavior_change: ''
  });
  const result = upgradeMailingListPatchEligibility(blockedMailingListSourceQuality(), candidate, POLICY);
  assert.equal(result.main_article_source_allowed, false);
});

test('mailing-list candidate with source gap risk stays blocked', () => {
  const candidate = strongPatchCandidate({ source_gap_risk: true });
  const result = upgradeMailingListPatchEligibility(blockedMailingListSourceQuality(), candidate, POLICY);
  assert.equal(result.main_article_source_allowed, false);
});

test('mailing-list patch with a non-crosscheck blocker stays blocked', () => {
  const sourceQuality = blockedMailingListSourceQuality({
    main_article_source_blockers: ['cross_check_required_but_missing', 'unknown_source_quality']
  });
  const result = upgradeMailingListPatchEligibility(sourceQuality, strongPatchCandidate(), POLICY);
  assert.equal(result.main_article_source_allowed, false);
});

test('non-mailing-list conditional source is not upgraded', () => {
  const sourceQuality = blockedMailingListSourceQuality({ source_role: 'tech_media_lead_source' });
  const result = upgradeMailingListPatchEligibility(sourceQuality, strongPatchCandidate(), POLICY);
  assert.equal(result.main_article_source_allowed, false);
});

test('already main-eligible source quality is returned unchanged', () => {
  const sourceQuality = blockedMailingListSourceQuality({
    main_article_source_allowed: true,
    source_quality_status: 'allowed',
    main_article_source_blockers: [],
    cross_check_status: 'required_satisfied'
  });
  const result = upgradeMailingListPatchEligibility(sourceQuality, strongPatchCandidate(), POLICY);
  assert.equal(result.main_article_source_allowed, true);
  assert.deepEqual(result.main_article_source_blockers, []);
});

test('disabled policy leaves source quality unchanged', () => {
  const result = upgradeMailingListPatchEligibility(
    blockedMailingListSourceQuality(),
    strongPatchCandidate(),
    { ...POLICY, enabled: false }
  );
  assert.equal(result.main_article_source_allowed, false);
});

test('applyMailingListPatchEligibilityToCandidate upgrades canonical and flat fields without drift', () => {
  const candidate = applyMailingListPatchEligibilityToCandidate(blockedMailingListCandidate(), POLICY);
  assert.equal(candidate.source_quality.main_article_source_allowed, true);
  assert.equal(candidate.main_article_source_allowed, true);
  assert.equal(candidate.source_quality_status, 'allowed');
  assert.equal(candidate.cross_check_status, 'required_satisfied');
  assert.deepEqual(sourceQualityFieldDrift(candidate), [], 'canonical and flat source-quality fields must stay in sync');
});

test('applyMailingListPatchEligibilityToCandidate leaves a thin reply unchanged', () => {
  const candidate = applyMailingListPatchEligibilityToCandidate(
    blockedMailingListCandidate({
      title: 'Re: [PATCH v10 4/6] dt-bindings: sun6i-a31-mipi-dphy: Add V3s SoC compatible entry',
      summary: 'A short reply in the patch thread.',
      behavior_change: ''
    }),
    POLICY
  );
  assert.equal(candidate.main_article_source_allowed, false);
});

test('upgraded mailing-list patch clears the quality-gate candidate-selection violation', () => {
  const blocked = blockedMailingListCandidate();
  assert.match(
    candidateSelectionViolation(blocked),
    /main_article_source_allowed=false/,
    'baseline blocked patch must trip the quality gate'
  );
  const upgraded = applyMailingListPatchEligibilityToCandidate(blocked, POLICY);
  assert.equal(candidateSelectionViolation(upgraded), '', 'upgraded patch must clear quality-gate source-quality violations');
});

test('decorateCandidate promotes a strong mailing-list patch end to end', () => {
  const decorated = decorateCandidate(blockedMailingListCandidate(), '2026-06-15');
  assert.equal(decorated.source_quality.main_article_source_allowed, true);
  assert.equal(decorated.main_article_source_allowed, true);
  const capsule = buildArticleCapsule(decorated);
  assert.equal(capsule.source_quality.main_article_source_allowed, true);
  assert.equal(capsule.main_article_readiness.source_ready, true);
});

// #1033: 리뷰가 붙지 않은 Gerrit 제안은 후보 수준 mainArticlePolicy=watchlist_only로 막힌다. 그 상태의
// source_quality는 blocker 목록이 비어 있고, 이 승급은 upgradeable blocker가 하나라도 있을 때만 걸린다.
// 두 사실 중 하나라도 무너지면(예: 소스 등록부가 requiresCrossCheck=true로 돌아가면) 아무도 리뷰하지
// 않은 제안이 강한 기술 근거만으로 main 기사가 된다.
test('a policy-blocked candidate with no blockers is never upgraded to main-article eligible', () => {
  const policyBlocked = blockedMailingListSourceQuality({
    main_article_source_allowed_reason: 'Source policy keeps this candidate on the watchlist and out of main articles.',
    main_article_source_blockers: [],
    cross_check_status: 'not_required',
    requires_cross_check: false,
    conditional_evidence_type: ''
  });
  const candidate = strongPatchCandidate({
    title: 'VirtualCamera: prevent integer underflow in outBufferSize - platform/frameworks/av',
    behavior_change: 'Proposed change would update 2 camera source file(s) in platform/frameworks/av +10/-0.',
    source_quality: policyBlocked
  });

  assert.equal(upgradeMailingListPatchEligibility(policyBlocked, candidate, POLICY), policyBlocked);
  const decorated = decorateCandidate(candidate, '2026-09-02', { mailingListPatchPolicy: POLICY });
  assert.equal(decorated.source_quality.main_article_source_allowed, false);
  assert.equal(decorated.source_quality.source_quality_status, 'blocked');
});

// #1056: 위 테스트는 손으로 만든 source_quality를 쓴다. 아래 세 개는 분류기가 실제로 만들어 내는
// 값으로 같은 계약을 잠근다. 후보 수준 mainArticlePolicy=watchlist_only로 내려간 Gerrit 제안이
// 대상이고, 승급 문턱(evidenceStrengthMin/technicalDepthMin)은 넘도록 근거를 채워 둔다. 문턱 미달
// 후보로 잠그면 무엇이 막았는지 구분할 수 없어 수정 전에도 통과하는 테스트가 된다.
const GERRIT_REGISTRY_SOURCE = {
  id: 'aosp-gerrit-camera-changes',
  sourceUrl: 'https://android-review.googlesource.com/changes/?q=x&n=100',
  sourceRole: 'project_mailing_list_source',
  sourceUrlQualityHint: 'project_mailing_list_release',
  mainArticlePolicy: 'conditional',
  candidateOnly: false,
  requiresCrossCheck: false,
  requiresCrossCheckDefault: false,
  evidenceGranularityHint: 'article_with_primary_confirmation'
};

function gerritProposalCandidate(overrides = {}) {
  return {
    title: 'VirtualCamera: prevent integer underflow in outBufferSize - platform/frameworks/av',
    url: 'https://android-review.googlesource.com/c/platform/frameworks/av/+/4228183',
    summary: 'Proposed change would update 2 camera source file(s) in platform/frameworks/av +10/-0. VirtualCamera buffer size handling in the camera HAL path.',
    behavior_change: 'Proposed change would update 2 camera source file(s) in platform/frameworks/av +10/-0.',
    api_or_component: 'VirtualCamera',
    published_date: '2026-09-01T00:00:00Z',
    hasDatedEvidence: true,
    source_gap_risk: false,
    mainArticlePolicy: 'watchlist_only',
    ...overrides
  };
}

function classifiedGerritProposal(sourceOverrides = {}, candidateOverrides = {}) {
  const candidate = gerritProposalCandidate(candidateOverrides);
  const sourceQuality = classifySourceQuality({
    candidate,
    source: { ...GERRIT_REGISTRY_SOURCE, ...sourceOverrides }
  });
  return { candidate, sourceQuality };
}

test('the Gerrit proposal fixture clears the upgrade thresholds, so only policy can block it', () => {
  const candidate = gerritProposalCandidate();
  assert.ok(evidenceStrength(candidate) >= POLICY.evidenceStrengthMin);
  assert.ok(technicalDepth(candidate) >= POLICY.technicalDepthMin);
});

test('a watchlist_only proposal stays out of main when the source turns candidateOnly on', () => {
  const { candidate, sourceQuality } = classifiedGerritProposal({ candidateOnly: true });
  assert.ok(sourceQuality.main_article_source_blockers.includes('candidate_only_without_primary_confirmation'));
  const upgraded = upgradeMailingListPatchEligibility(sourceQuality, candidate, POLICY);
  assert.equal(upgraded.main_article_source_allowed, false);
});

test('a watchlist_only proposal stays out of main when both cross-check flags are turned on', () => {
  const { candidate, sourceQuality } = classifiedGerritProposal({
    requiresCrossCheck: true,
    requiresCrossCheckDefault: true
  });
  assert.ok(sourceQuality.main_article_source_blockers.includes('cross_check_required_but_missing'));
  const upgraded = upgradeMailingListPatchEligibility(sourceQuality, candidate, POLICY);
  assert.equal(upgraded.main_article_source_allowed, false);
});

test('the conditional mailing-list upgrade path stays open for a cross-check blocker', () => {
  const { candidate, sourceQuality } = classifiedGerritProposal(
    { requiresCrossCheck: true, requiresCrossCheckDefault: true },
    { mainArticlePolicy: 'conditional' }
  );
  assert.deepEqual(sourceQuality.main_article_source_blockers, ['cross_check_required_but_missing']);
  const upgraded = upgradeMailingListPatchEligibility(sourceQuality, candidate, POLICY);
  assert.equal(upgraded.main_article_source_allowed, true);
});
