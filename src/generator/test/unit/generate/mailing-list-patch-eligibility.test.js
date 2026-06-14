const assert = require('node:assert/strict');
const test = require('node:test');

const {
  upgradeMailingListPatchEligibility
} = require('../../../select/mailing-list-patch-eligibility');
const { buildArticleCapsule } = require('../../../select/article-capsules');

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

test('strong-evidence mailing-list patch is upgraded to main-eligible', () => {
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

function strongPatchCapsuleCandidate(overrides = {}) {
  return {
    candidate_id: 'patch-v4l2-hevc-av1',
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
    final_selected: true,
    selected_for_editor: true,
    finalSelectionEligibility: 'main',
    source_quality: blockedMailingListSourceQuality(),
    ...overrides
  };
}

test('buildArticleCapsule promotes a strong mailing-list patch to main-eligible', () => {
  const capsule = buildArticleCapsule(strongPatchCapsuleCandidate());
  assert.equal(capsule.source_quality.main_article_source_allowed, true);
  assert.equal(capsule.main_article_readiness.source_ready, true);
  assert.ok(
    !capsule.main_article_readiness.blockers.includes('main_article_source_allowed_false'),
    'main_article_source_allowed_false blocker should be cleared'
  );
});

test('buildArticleCapsule keeps a thin mailing-list reply blocked', () => {
  const capsule = buildArticleCapsule(strongPatchCapsuleCandidate({
    title: 'Re: [PATCH v10 4/6] dt-bindings: sun6i-a31-mipi-dphy: Add V3s SoC compatible entry',
    summary: 'A short reply in the patch thread.',
    behavior_change: ''
  }));
  assert.equal(capsule.source_quality.main_article_source_allowed, false);
});
