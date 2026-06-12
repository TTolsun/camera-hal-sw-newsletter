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

function report(candidates, policyOverrides = {}) {
  return buildShortlistReport('2026-06-03', { candidates }, {
    exposureHistory: { articles: [] },
    homepageHeadlineState: EMPTY_HEADLINE_STATE,
    catchUpPolicy: { ...CATCH_UP_POLICY, ...policyOverrides }
  });
}

const CAMERA_RELEASE_PAGE = 'https://developer.android.com/jetpack/androidx/releases/camera';

function selectedReleasePageCount(result) {
  return result.selected_articles
    .map(article => String(article.url || '').split('#')[0].replace(/\/$/, ''))
    .filter(url => url === CAMERA_RELEASE_PAGE)
    .length;
}

// #500: the catch-up lane bypassed the same-release-page dedup that primary selection enforces,
// so a fresh main article and an older catch-up article from the same CameraX release-note page
// were both promoted -> "Duplicate source URL is used across main sections" hard fail on thin days.
test('catch-up does not promote a second main article from an already-selected CameraX release page', () => {
  const result = report([
    strongRelease({
      title: 'CameraX SessionConfig stable API',
      url: `${CAMERA_RELEASE_PAGE}#1.7.0`,
      published_date: '2026-06-01', version_or_release: '1.7.0', behavior_change: 'SessionConfig stable API'
    }),
    strongRelease({
      title: 'CameraX VideoCapture concurrent recording',
      url: `${CAMERA_RELEASE_PAGE}#1.6.0`,
      published_date: '2026-03-25', version_or_release: '1.6.0', behavior_change: 'VideoCapture concurrent recording'
    })
  ]);
  assert.equal(result.catch_up_used_count, 0, 'same release-note page must not be promoted twice via catch-up');
  assert.equal(selectedReleasePageCount(result), 1, 'only one main article may carry the CameraX release-note base URL');
});

// Over-block guard: a strong catch-up release from a DIFFERENT page must still fill an open slot.
test('catch-up still promotes a strong release from a different source page', () => {
  const result = report([
    strongRelease({
      title: 'CameraX SessionConfig stable API',
      url: `${CAMERA_RELEASE_PAGE}#1.7.0`,
      published_date: '2026-06-01', version_or_release: '1.7.0', behavior_change: 'SessionConfig stable API'
    }),
    strongRelease({
      title: 'Camera HAL AIDL v3 interface update',
      url: 'https://source.android.com/docs/core/camera/aidl-v3',
      published_date: '2026-03-25', version_or_release: 'AIDL v3', behavior_change: 'ICameraDevice interface change'
    })
  ]);
  assert.equal(result.catch_up_used_count, 1, 'a different-page strong release must still be promoted');
  assert.equal(result.selected_articles.length, 2);
});
