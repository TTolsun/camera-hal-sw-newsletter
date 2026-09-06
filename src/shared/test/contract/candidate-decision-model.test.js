const assert = require('node:assert/strict');
const test = require('node:test');

const {
  decisionFromCandidate
} = require('../../cli/collect-news-candidates');

function makeClassification(overrides = {}) {
  return {
    collectionMode: 'rss-item',
    sourceCollectionMode: 'rss',
    isArticleCandidate: true,
    isWatchPage: false,
    hasDatedEvidence: true,
    finalSelectionEligibility: 'main',
    evidenceSignalKind: 'dated-rss-article',
    selectionExclusionReason: 'Eligible for main article selection.',
    ...overrides
  };
}

function makeMetadata(overrides = {}) {
  return {
    source_kind: 'rss_item',
    source_role: 'official_release_source',
    has_published_date: true,
    has_version_or_release: true,
    has_api_or_component: true,
    has_behavior_change: true,
    evidence_score: 8,
    source_gap_risk: false,
    reference_only: false,
    ...overrides
  };
}

function makeScopeMetadata(overrides = {}) {
  return {
    relevance_bucket: 'android',
    aosp_camera_directness: 4,
    ...overrides
  };
}

function makeSourceQuality(overrides = {}) {
  return {
    source_role: 'official_release_source',
    source_url_quality: 'official_dated_release',
    source_quality_status: 'allowed',
    main_article_source_allowed: true,
    main_article_source_blockers: [],
    cross_check_status: 'not_required',
    requires_cross_check: false,
    ...overrides
  };
}

// decisionFromCandidate unit-level behavior: source-monitor 가 no_meaningful_change 이벤트는 후보로 emit 하지 않지만, decision 함수가 reference 로 분류한다는 단위 보장.
test('Case 1: AOSP Camera Documentation snapshot without content change -> reference', () => {
  const classification = makeClassification({
    isArticleCandidate: false,
    isWatchPage: true,
    hasDatedEvidence: false,
    finalSelectionEligibility: 'exclude',
    evidenceSignalKind: 'undated-watch-page'
  });
  const metadata = makeMetadata({
    source_role: 'official_documentation_reference',
    has_published_date: false,
    has_version_or_release: false,
    has_api_or_component: false,
    has_behavior_change: false,
    evidence_score: 2
  });
  const sourceQuality = makeSourceQuality({
    source_role: 'official_documentation_reference',
    source_url_quality: 'undated_reference_page',
    source_quality_status: 'blocked',
    main_article_source_allowed: false,
    main_article_source_blockers: ['reference_only', 'undated_reference_page']
  });
  const snapshot = {
    lastSeenAt: '2026-05-20T10:00:00Z',
    seenCount: 5,
    contentChanged: false
  };
  const scopeMetadata = makeScopeMetadata({ relevance_bucket: 'generic_tech_watchlist' });

  const decision = decisionFromCandidate({
    classification,
    metadata,
    sourceQuality,
    snapshot,
    scopeMetadata,
    candidateOnly: false
  });

  assert.equal(decision.evidenceLevel, 'reference');
  assert.equal(decision.selection, 'reference');
  assert.ok(decision.reason.toLowerCase().includes('no meaningful'), `reason should include 'no meaningful', got: ${decision.reason}`);
  assert.equal(decision.contentChanged, false);
  assert.ok(decision.snapshot);
  assert.equal(decision.snapshot.seenCount, 5);
});

test('Case 2: CameraX dated release row with concrete change -> primary, main or short', () => {
  const classification = makeClassification({
    finalSelectionEligibility: 'main'
  });
  const metadata = makeMetadata({
    source_role: 'project_release_source'
  });
  const sourceQuality = makeSourceQuality({
    source_role: 'project_release_source'
  });
  const scopeMetadata = makeScopeMetadata({ relevance_bucket: 'android' });

  const decision = decisionFromCandidate({
    classification,
    metadata,
    sourceQuality,
    snapshot: undefined,
    scopeMetadata,
    candidateOnly: false
  });

  assert.equal(decision.evidenceLevel, 'primary');
  assert.ok(['main', 'short'].includes(decision.selection), `selection should be main or short, got: ${decision.selection}`);
});

test('Case 3: Mailing list candidate without primary confirmation -> watch', () => {
  const classification = makeClassification({
    isArticleCandidate: false,
    finalSelectionEligibility: 'exclude',
    hasDatedEvidence: false
  });
  const metadata = makeMetadata({
    source_role: 'project_mailing_list_source',
    has_published_date: false
  });
  const sourceQuality = makeSourceQuality({
    source_role: 'project_mailing_list_source',
    source_url_quality: 'project_mailing_list_release',
    source_quality_status: 'blocked',
    main_article_source_allowed: false,
    main_article_source_blockers: ['cross_check_required_but_missing'],
    cross_check_status: 'required_missing',
    requires_cross_check: true
  });
  const scopeMetadata = makeScopeMetadata({ relevance_bucket: 'direct_aosp_camera' });

  const decision = decisionFromCandidate({
    classification,
    metadata,
    sourceQuality,
    snapshot: undefined,
    scopeMetadata,
    candidateOnly: false
  });

  assert.equal(decision.evidenceLevel, 'watch');
  assert.equal(decision.selection, 'watch');
});

test('Case 4: Cross-check satisfied candidate -> verified', () => {
  const classification = makeClassification({
    finalSelectionEligibility: 'main'
  });
  const metadata = makeMetadata({
    source_role: 'tech_media_lead_source'
  });
  const sourceQuality = makeSourceQuality({
    source_role: 'tech_media_lead_source',
    source_url_quality: 'tech_media_lead_requires_cross_check',
    source_quality_status: 'allowed',
    main_article_source_allowed: true,
    main_article_source_blockers: [],
    cross_check_status: 'required_satisfied',
    requires_cross_check: true
  });
  const scopeMetadata = makeScopeMetadata({ relevance_bucket: 'android' });

  const decision = decisionFromCandidate({
    classification,
    metadata,
    sourceQuality,
    snapshot: undefined,
    scopeMetadata,
    candidateOnly: false
  });

  assert.equal(decision.evidenceLevel, 'verified');
});

test('Case 5: Generic AI article without camera workflow evidence -> watch, not main', () => {
  const classification = makeClassification({
    finalSelectionEligibility: 'watchlist',
    hasDatedEvidence: true
  });
  const metadata = makeMetadata({
    source_role: 'generic_trend_source'
  });
  const sourceQuality = makeSourceQuality({
    source_role: 'generic_trend_source',
    source_url_quality: 'generic_ai_or_it_trend',
    source_quality_status: 'blocked',
    main_article_source_allowed: false,
    main_article_source_blockers: ['generic_trend_without_hal_workflow_link']
  });
  const scopeMetadata = makeScopeMetadata({ relevance_bucket: 'generic_tech_watchlist' });

  const decision = decisionFromCandidate({
    classification,
    metadata,
    sourceQuality,
    snapshot: undefined,
    scopeMetadata,
    candidateOnly: false
  });

  assert.equal(decision.evidenceLevel, 'watch');
  assert.notEqual(decision.selection, 'main');
});
