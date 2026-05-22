const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyHomepageHeadlineSelection,
  computeHeadlineScore,
  computeKstAgeDays,
  emptyHeadlineState,
  headlineSnapshotFromCandidate,
  isHeadlineEligible,
  validateHomepageHeadlineState
} = require('../../../scripts/newsroom/common/homepage-headline');

const policy = Object.freeze({
  decayModel: 'linear',
  decayRatePerDay: 2,
  replacementMargin: 5,
  minimumHeadlineScore: 40,
  latestInclusionRequired: true,
  historyMaxEntries: 50
});

function headlineCandidate(overrides = {}) {
  return {
    title: 'Camera HAL stream metadata update',
    summary: 'Camera HAL stream metadata update changes buffer validation.',
    source_url: 'https://source.android.com/docs/camera/metadata-update',
    source: 'source.android.com',
    published_date: '2026-05-23',
    hasDatedEvidence: true,
    finalSelectionEligibility: 'main',
    main_eligible: true,
    relevance_bucket: 'direct_aosp_camera',
    reliability: 'official',
    deterministic_score: 70,
    editorial_priority: 1,
    ...overrides
  };
}

test('KST age day calculation uses KST date boundary and clamps future dates', () => {
  assert.equal(computeKstAgeDays('2026-05-22', '2026-05-23'), 1);
  assert.equal(computeKstAgeDays('2026-05-22', '2026-05-22T16:00:00Z'), 1);
  assert.equal(computeKstAgeDays('2026-05-24', '2026-05-23'), 0);
  assert.equal(computeKstAgeDays('invalid', '2026-05-23'), 0);
});

test('headline score applies official bonus and fallback/generic penalties', () => {
  const official = computeHeadlineScore(headlineCandidate(), policy).headline_score;
  const fallback = computeHeadlineScore(headlineCandidate({
    relevance_bucket: 'cpp_ai_tooling_fallback',
    reliability: 'community'
  }), policy).headline_score;
  const generic = computeHeadlineScore(headlineCandidate({
    relevance_bucket: 'generic_tech_watchlist',
    reliability: 'community'
  }), policy).headline_score;

  assert.ok(official > fallback);
  assert.ok(fallback > generic);
});

test('missing score breakdown still produces a deterministic eligible score', () => {
  const candidate = headlineCandidate({
    deterministic_score: undefined,
    score_breakdown: undefined
  });
  const score = computeHeadlineScore(candidate, policy);

  assert.equal(Number.isInteger(score.headline_score), true);
  assert.equal(isHeadlineEligible(candidate, { policy }), true);
});

test('equal score below replacement margin retains current headline and injects it into latest', () => {
  const current = headlineSnapshotFromCandidate(headlineCandidate({
    source_url: 'https://source.android.com/docs/camera/current',
    deterministic_score: 80
  }), {
    date: '2026-05-22',
    policy,
    scoredAt: '2026-05-22'
  });
  const state = {
    ...emptyHeadlineState({ date: '2026-05-22', policy }),
    current_headline: current
  };
  const result = applyHomepageHeadlineSelection({
    date: '2026-05-23',
    selectedArticles: [headlineCandidate({
      source_url: 'https://source.android.com/docs/camera/new',
      deterministic_score: 76
    })],
    eligibleCandidates: [],
    currentState: state,
    policy
  });

  assert.equal(result.headline_decision.reason, 'retained_current_above_margin');
  assert.equal(result.headline_latest_inclusion.injected_from_snapshot, true);
  assert.ok(result.selected_articles.some(article => article.injected_from_headline_snapshot === true));
  assert.equal(result.homepage_headline_state.current_headline.article_identity_key, current.article_identity_key);
});

test('null current headline seeds from current issue candidate', () => {
  const result = applyHomepageHeadlineSelection({
    date: '2026-05-23',
    selectedArticles: [headlineCandidate()],
    eligibleCandidates: [],
    currentState: emptyHeadlineState({ date: '2026-05-23', policy }),
    policy
  });

  assert.equal(result.headline_decision.reason, 'seeded_from_current_issue');
  assert.equal(result.headline_latest_inclusion.mode, 'selected_normally');
  assert.equal(result.homepage_headline_state.current_headline.title, 'Camera HAL stream metadata update');
});

test('state validator accepts null headline and rejects missing snapshot evidence', () => {
  assert.equal(validateHomepageHeadlineState(emptyHeadlineState({ policy }), { policy }).ok, true);
  const invalid = {
    ...emptyHeadlineState({ policy }),
    current_headline: {
      title: 'Missing fields'
    }
  };

  assert.equal(validateHomepageHeadlineState(invalid, { policy }).ok, false);
});
