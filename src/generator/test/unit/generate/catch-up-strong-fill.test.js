'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildShortlistReport } = require('../../../select/newsroom-selection');

// Empty headline state so the test never reads the real repo's homepage-headline.json.
const EMPTY_HEADLINE_STATE = {
  schemaVersion: 1,
  updated_at: '2026-06-03T00:00:00+09:00',
  current_headline: null,
  headline_history: [],
  policy: {}
};

const CATCH_UP_POLICY = {
  enabled: true, maxCatchUpArticles: 2, maxAgeDays: 90, targetMainArticles: 3,
  eligibleBuckets: ['direct_aosp_camera'], activationMode: 'fill_open_slots'
};

// A fully-classified, strong CameraX release: passes main_article_score_eligible
// (scope_relevance >= 2 via aosp_camera_directness, dated, concrete API/component).
function strongRelease(overrides = {}) {
  return {
    relevance_bucket: 'direct_aosp_camera',
    aosp_camera_directness: 4,
    counts_as_primary_camera_topic: true,
    has_dated_evidence: true,
    finalSelectionEligibility: 'main',
    api_or_component: 'CameraX',
    ...overrides
  };
}

// A thin reference candidate: passes buildCatchUpPool (eligible bucket, dated, evidence)
// but FAILS main_article_score_eligible (no scope signal -> scope_relevance = 0).
function weakRelease(overrides = {}) {
  return {
    relevance_bucket: 'direct_aosp_camera',
    has_dated_evidence: true,
    finalSelectionEligibility: 'main',
    api_or_component: 'CameraX',
    ...overrides
  };
}

function report(candidates, policyOverrides = {}) {
  return buildShortlistReport('2026-06-10', { candidates }, {
    exposureHistory: { articles: [] },
    homepageHeadlineState: EMPTY_HEADLINE_STATE,
    catchUpPolicy: { ...CATCH_UP_POLICY, ...policyOverrides }
  });
}

test('weak reference catch-up candidate is not promoted to fill a thin week', () => {
  // 1 fresh strong primary article + 1 thin (floor-failing) reference candidate.
  const result = report([
    strongRelease({
      title: 'CameraX 1.7.0', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0',
      published_date: '2026-06-01', version_or_release: '1.7.0', behavior_change: 'SessionConfig API'
    }),
    weakRelease({
      title: 'Google I/O camera roundup', url: 'https://developer.android.com/jetpack/androidx/releases/camera#io-roundup',
      published_date: '2026-05-08', version_or_release: 'I/O 2025', behavior_change: 'roundup'
    })
  ]);
  assert.equal(result.catch_up_used_count, 0, 'floor-failing catch-up candidate must not be promoted');
  assert.equal(result.selected_articles.length, 1, 'thin week publishes only the strong article');
  assert.equal(result.selected_articles[0].title, 'CameraX 1.7.0');
});

test('strong reference catch-up candidate is still promoted alongside a fresh article', () => {
  // Over-block guard: a realistic strong reference release must still fill an open slot.
  const result = report([
    strongRelease({
      title: 'CameraX 1.7.0', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0',
      published_date: '2026-06-01', version_or_release: '1.7.0', behavior_change: 'SessionConfig API'
    }),
    strongRelease({
      title: 'Camera HAL AIDL v3 interface update',
      url: 'https://source.android.com/docs/core/camera/aidl-v3',
      published_date: '2026-05-10', version_or_release: 'AIDL v3', behavior_change: 'ICameraDevice interface change'
    })
  ]);
  assert.equal(result.catch_up_used_count, 1, 'strong reference catch-up must still be promoted');
  assert.equal(result.selected_articles.length, 2);
});
