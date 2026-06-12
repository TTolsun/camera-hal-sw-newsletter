const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyHomepageHeadlineSelection,
  computeHeadlineScore,
  computeKstAgeDays,
  emptyHeadlineState,
  HEADLINE_STATE_REMEDIATION,
  headlineEligibilityRejection,
  headlineSnapshotFromCandidate,
  isHeadlineEligible,
  REMOVED_DUE_TO_HEADLINE_INCLUSION_REASON,
  validateHomepageHeadlineState
} = require('../../../reporter/homepage-headline');

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

test('a YouTube playlist headline is rejected as a collection, not a dated article', () => {
  // 저장된 homepage headline이 재생목록(컬렉션) URL이면 매 run 메인으로 주입되어 게이트를
  // hard-fail시킨다. 재검증(headlineEligibilityRejection)에서 거부해 clear/교체되게 한다.
  const playlist = headlineCandidate({
    source_url: 'https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY'
  });

  assert.equal(headlineEligibilityRejection(playlist, { policy }), 'playlist_collection_url');
  assert.equal(isHeadlineEligible(playlist, { policy }), false);
});

test('a single YouTube watch video headline is not rejected as a playlist collection', () => {
  const watch = headlineCandidate({
    source_url: 'https://www.youtube.com/watch?v=Wh3LWb_Phfk'
  });

  assert.notEqual(headlineEligibilityRejection(watch, { policy }), 'playlist_collection_url');
});

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

test('headline is the most recent Camera HAL article in the issue (by source date)', () => {
  const result = applyHomepageHeadlineSelection({
    date: '2026-06-06',
    selectedArticles: [
      headlineCandidate({ title: 'Older camera article', source_url: 'https://source.android.com/docs/camera/older', published_date: '2026-05-20' }),
      headlineCandidate({ title: 'Newer camera article', source_url: 'https://source.android.com/docs/camera/newer', published_date: '2026-05-25' })
    ],
    currentState: emptyHeadlineState({ date: '2026-06-06', policy }),
    policy
  });

  assert.equal(result.headline_decision.reason, 'latest_camera_hal_article');
  assert.equal(result.homepage_headline_state.current_headline.title, 'Newer camera article');
});

test('retains the current headline when the issue has no Camera HAL article (never blanks)', () => {
  const current = headlineSnapshotFromCandidate(headlineCandidate({
    title: 'Existing camera headline',
    source_url: 'https://source.android.com/docs/camera/existing',
    published_date: '2026-05-22'
  }), { date: '2026-05-22', policy, scoredAt: '2026-05-22' });

  const result = applyHomepageHeadlineSelection({
    date: '2026-06-06',
    selectedArticles: [headlineCandidate({
      title: 'Generic non-camera article',
      source_url: 'https://example.com/generic',
      relevance_bucket: 'generic_tech_watchlist',
      published_date: '2026-06-05'
    })],
    currentState: { ...emptyHeadlineState({ date: '2026-05-22', policy }), current_headline: current },
    policy
  });

  assert.notEqual(result.homepage_headline_state.current_headline, null);
  assert.equal(result.homepage_headline_state.current_headline.title, 'Existing camera headline');
});

test('a YouTube playlist or non-camera article is excluded even if it is newer', () => {
  const result = applyHomepageHeadlineSelection({
    date: '2026-06-06',
    selectedArticles: [
      headlineCandidate({ title: 'Newer Google IO playlist', source_url: 'https://youtube.com/playlist?list=PLabc', published_date: '2026-06-05' }),
      headlineCandidate({ title: 'Valid camera article', source_url: 'https://source.android.com/docs/camera/valid', published_date: '2026-05-20' })
    ],
    currentState: emptyHeadlineState({ date: '2026-06-06', policy }),
    policy
  });

  assert.equal(result.homepage_headline_state.current_headline.title, 'Valid camera article');
});

test('the headline is never injected into the issue article list', () => {
  const current = headlineSnapshotFromCandidate(headlineCandidate({
    title: 'Retained headline from a past issue',
    source_url: 'https://source.android.com/docs/camera/past',
    published_date: '2026-06-01'
  }), { date: '2026-06-01', policy, scoredAt: '2026-06-01' });

  const result = applyHomepageHeadlineSelection({
    date: '2026-06-06',
    selectedArticles: [headlineCandidate({
      title: 'This issue camera article',
      source_url: 'https://source.android.com/docs/camera/this-issue',
      published_date: '2026-05-25'
    })],
    currentState: { ...emptyHeadlineState({ date: '2026-06-01', policy }), current_headline: current },
    policy
  });

  // current(06-01) is newer than this issue's article(05-25) -> retained, never injected
  assert.equal(result.selected_articles.length, 1);
  assert.equal(result.headline_latest_inclusion.injected_from_snapshot, false);
  assert.equal(result.removed_due_to_headline_inclusion.length, 0);
  assert.ok(result.selected_articles.every(article => article.injected_from_headline_snapshot !== true));
  assert.equal(result.homepage_headline_state.current_headline.title, 'Retained headline from a past issue');
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
