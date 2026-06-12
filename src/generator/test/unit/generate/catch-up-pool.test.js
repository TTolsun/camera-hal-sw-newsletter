'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCatchUpPool } = require('../../../scripts/newsroom/generate/newsroom-selection');

const POLICY = {
  enabled: true,
  maxCatchUpArticles: 2,
  maxAgeDays: 90,
  eligibleBuckets: ['direct_aosp_camera', 'android_platform_camera_adjacent'],
  activationMode: 'thin_week_only'
};

function refCandidate(overrides = {}) {
  return {
    title: 'CameraX 1.6.0',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
    article_identity_key: 'url:https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
    relevance_bucket: 'direct_aosp_camera',
    freshness_window: 'reference',
    days_since_published: 70,
    version_or_release: '1.6.0',
    published_date: '2026-03-25',
    api_or_component: 'CameraX',
    behavior_change: 'CameraPipe migration',
    ...overrides
  };
}

const EMPTY_HISTORY = { articles: [] };

test('keeps eligible-bucket, in-age, uncovered, evidence-bearing reference candidate', () => {
  const pool = buildCatchUpPool([refCandidate()], EMPTY_HISTORY, POLICY);
  assert.equal(pool.length, 1);
});

test('drops candidate outside eligible buckets', () => {
  const pool = buildCatchUpPool([refCandidate({ relevance_bucket: 'cpp_ai_tooling_fallback' })], EMPTY_HISTORY, POLICY);
  assert.equal(pool.length, 0);
});

test('drops candidate older than maxAgeDays', () => {
  const pool = buildCatchUpPool([refCandidate({ days_since_published: 120 })], EMPTY_HISTORY, POLICY);
  assert.equal(pool.length, 0);
});

test('drops candidate already covered as newsletter_article', () => {
  const history = { articles: [{ article_identity_key: refCandidate().article_identity_key, exposure_type: 'newsletter_article', newsletter_date: '2026-04-01' }] };
  const pool = buildCatchUpPool([refCandidate()], history, POLICY);
  assert.equal(pool.length, 0);
});

test('drops candidate lacking concrete evidence', () => {
  const pool = buildCatchUpPool([refCandidate({ version_or_release: '', api_or_component: '', behavior_change: '', evidence_summary: '' })], EMPTY_HISTORY, POLICY);
  assert.equal(pool.length, 0);
});

test('returns empty when policy disabled', () => {
  const pool = buildCatchUpPool([refCandidate()], EMPTY_HISTORY, { ...POLICY, enabled: false });
  assert.equal(pool.length, 0);
});
