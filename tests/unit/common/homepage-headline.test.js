const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyHomepageHeadlineSelection,
  computeHeadlineScore,
  computeKstAgeDays,
  emptyHeadlineState,
  HEADLINE_STATE_REMEDIATION,
  headlineSnapshotFromCandidate,
  isHeadlineEligible,
  REMOVED_DUE_TO_HEADLINE_INCLUSION_REASON,
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

test('replacement can use eligible candidate that is not already selected', () => {
  const current = headlineSnapshotFromCandidate(headlineCandidate({
    source_url: 'https://source.android.com/docs/camera/current',
    deterministic_score: 60
  }), {
    date: '2026-05-22',
    policy,
    scoredAt: '2026-05-22'
  });
  const eligibleOnly = headlineCandidate({
    title: 'Higher priority Camera HAL headline',
    source_url: 'https://source.android.com/docs/camera/high-priority',
    deterministic_score: 95
  });
  const result = applyHomepageHeadlineSelection({
    date: '2026-05-23',
    selectedArticles: [headlineCandidate({
      title: 'Selected lower score article',
      source_url: 'https://source.android.com/docs/camera/selected-low',
      deterministic_score: 62
    })],
    eligibleCandidates: [eligibleOnly],
    currentState: {
      ...emptyHeadlineState({ date: '2026-05-22', policy }),
      current_headline: current
    },
    policy
  });

  assert.equal(result.headline_decision.reason, 'replaced_by_new_candidate');
  assert.equal(result.homepage_headline_state.current_headline.title, 'Higher priority Camera HAL headline');
  assert.equal(result.headline_latest_inclusion.mode, 'injected_from_headline_snapshot');
  assert.ok(result.selected_articles.some(article => article.injected_from_headline_snapshot === true));
});

test('headline injection records candidate removed by max article count', () => {
  const selectedArticles = Array.from({ length: 5 }, (_, index) => headlineCandidate({
    title: `Selected Camera HAL article ${index}`,
    source_url: `https://source.android.com/docs/camera/selected-${index}`,
    deterministic_score: 62 - index,
    editorial_priority: index === 4 ? 99 : index + 1
  }));
  const headlineOnly = headlineCandidate({
    title: 'Highest eligible homepage headline',
    source_url: 'https://source.android.com/docs/camera/highest-headline-only',
    deterministic_score: 98,
    editorial_priority: 1
  });

  const result = applyHomepageHeadlineSelection({
    date: '2026-05-23',
    selectedArticles,
    eligibleCandidates: [headlineOnly],
    currentState: emptyHeadlineState({ date: '2026-05-23', policy }),
    policy
  });

  assert.equal(result.selected_articles.length, 5);
  assert.equal(result.headline_decision.reason, 'seeded_from_current_issue');
  assert.equal(result.headline_latest_inclusion.mode, 'injected_from_headline_snapshot');
  assert.equal(result.headline_latest_inclusion.removed_due_to_headline_inclusion_count, 1);
  assert.equal(result.removed_due_to_headline_inclusion.length, 1);
  assert.equal(result.removed_due_to_headline_inclusion[0].title, 'Selected Camera HAL article 4');
  assert.equal(result.removed_due_to_headline_inclusion[0].reason, REMOVED_DUE_TO_HEADLINE_INCLUSION_REASON);
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

test('state validator explains how to refresh stale decayed headline state', () => {
  const state = {
    ...emptyHeadlineState({ date: '2026-05-01', policy }),
    current_headline: {
      article_identity_key: 'url:https://source.android.com/docs/camera/stale-headline',
      title: 'Stale Camera HAL headline',
      summary: 'Stale Camera HAL headline summary.',
      source_url: 'https://source.android.com/docs/camera/stale-headline',
      newsletter_date: '2026-05-01',
      newsletter_url: 'newsletters/2026-05-01/index.html',
      selected_at: '2026-05-01',
      base_score: 41,
      current_score: 41,
      last_scored_at: '2026-05-01',
      date_evidence: {
        date: '2026-05-01',
        date_field: 'published_date',
        evidence_level: 'dated_release',
        publish_ready_date_evidence: true
      },
      quality_flags: {
        source_gap_risk: false,
        fact_check_must_fix_unresolved: false,
        stale_claim_hard_failure: false,
        blocked_source: false
      },
      score_breakdown: {},
      snapshot: {
        category: 'direct_aosp_camera',
        source_name: 'source.android.com'
      }
    }
  };

  const result = validateHomepageHeadlineState(state, { policy, scoredAt: '2026-05-23' });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /headline_score_below_minimum/);
  assert.match(result.errors.join('\n'), new RegExp(HEADLINE_STATE_REMEDIATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
