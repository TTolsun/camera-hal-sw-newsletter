'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildShortlistReport } = require('../../../scripts/newsroom/generate/newsroom-selection');

// Empty headline state so the test never reads the real repo's homepage-headline.json.
const EMPTY_HEADLINE_STATE = {
  schemaVersion: 1,
  updated_at: '2026-06-03T00:00:00+09:00',
  current_headline: null,
  headline_history: [],
  policy: {}
};

// Reference-window-eligible candidate: passes non-window exclusion checks
// (dated evidence + main eligibility) but is 70/84 days old → reference window.
function refRelease(overrides = {}) {
  return {
    relevance_bucket: 'direct_aosp_camera',
    has_dated_evidence: true,
    finalSelectionEligibility: 'main',
    api_or_component: 'CameraX',
    ...overrides
  };
}

// A thin-week collection: no fresh in-window candidate; only two reference-window
// (70d / 84d old) CameraX releases. primary+fallback select 0 → thin week → catch-up.
function collected() {
  return { candidates: [
    refRelease({
      title: 'CameraX 1.6.0', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
      published_date: '2026-03-25', version_or_release: '1.6.0', behavior_change: 'CameraPipe migration'
    }),
    refRelease({
      title: 'CameraX 1.7.0-alpha01', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha01',
      published_date: '2026-03-11', version_or_release: '1.7.0-alpha01', behavior_change: 'SessionConfig API'
    })
  ] };
}

const CATCH_UP_POLICY = {
  enabled: true, maxCatchUpArticles: 2, maxAgeDays: 90,
  eligibleBuckets: ['direct_aosp_camera'], activationMode: 'thin_week_only'
};

test('thin week pulls catch-up articles from reference window, capped at maxCatchUpArticles', () => {
  const report = buildShortlistReport('2026-06-03', collected(), {
    exposureHistory: { articles: [] },
    homepageHeadlineState: EMPTY_HEADLINE_STATE,
    catchUpPolicy: CATCH_UP_POLICY
  });
  const catchUp = report.selected_articles.filter(a => a.coverage_type === 'catch_up');
  assert.ok(catchUp.length >= 1 && catchUp.length <= 2, `expected 1-2 catch-up, got ${catchUp.length}`);
  assert.ok(catchUp.every(a => Number.isFinite(a.catch_up_age_days)));
  assert.equal(report.catch_up_used_count, catchUp.length);
});

test('non-thin week (min already met) selects zero catch-up articles', () => {
  const fresh = { candidates: [
    refRelease({ title: 'Fresh A', url: 'https://example.com/a', published_date: '2026-06-03',
      version_or_release: 'a1', behavior_change: 'x' })
  ] };
  const report = buildShortlistReport('2026-06-03', fresh, {
    exposureHistory: { articles: [] },
    homepageHeadlineState: EMPTY_HEADLINE_STATE,
    catchUpPolicy: CATCH_UP_POLICY
  });
  assert.equal(report.catch_up_used_count, 0);
});
