const assert = require('node:assert/strict');
const test = require('node:test');

const {
  upgradeMailingListPatchEligibility,
  applyMailingListPatchEligibilityToCandidate
} = require('../../../select/mailing-list-patch-eligibility');
const { buildArticleCapsule } = require('../../../select/article-capsules');
const { decorateCandidate } = require('../../../select/newsroom-selection');
const { candidateSelectionViolation } = require('../../../quality/quality-deduction-rules');
const { sourceQualityFieldDrift } = require('../../../../shared/collect/source-quality-classifier');

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
