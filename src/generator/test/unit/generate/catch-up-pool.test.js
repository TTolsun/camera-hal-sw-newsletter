'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCatchUpPool } = require('../../../select/newsroom-selection');

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

function publishedRecord(newsletterArticleDate) {
  return {
    articles: [{
      article_identity_key: refCandidate().article_identity_key,
      exposure_type: 'newsletter_article',
      exposure_types: ['newsletter_article'],
      newsletter_date: newsletterArticleDate,
      newsletter_article_date: newsletterArticleDate,
      cooldown_until: '2026-06-29'
    }]
  };
}

test('keeps the candidate this same issue published, so a re-run keeps its own catch-up article', () => {
  // 워크플로 03은 ref: main을 체크아웃하므로 이미 발행된 날짜로 다시 돌리면 state에 그 호 자신의
  // 레코드가 들어 있다. primary 레인은 자기차단을 이미 풀었는데(annotateArticleExposure) catch-up
  // 레인이 그대로면 같은 회귀가 다른 통로로 남는다.
  const pool = buildCatchUpPool([refCandidate()], publishedRecord('2026-06-08'), POLICY, '2026-06-08');
  assert.equal(pool.length, 1);
});

test('still drops the candidate a previous issue published', () => {
  // 자기차단 해제가 게재 이력 필터 자체를 무력화하면 안 된다.
  const pool = buildCatchUpPool([refCandidate()], publishedRecord('2026-06-01'), POLICY, '2026-06-08');
  assert.equal(pool.length, 0);
});

test('drops a legacy record that has no newsletter_article_date even when a date is given', () => {
  // 백필 이전 레코드에는 newsletter_article_date가 없다. 빈 값과 빈 값이 맞아떨어져 이력이
  // 통째로 무시되면 재게재 필터가 조용히 죽는다.
  const legacy = { articles: [{ article_identity_key: refCandidate().article_identity_key, exposure_type: 'newsletter_article' }] };
  const pool = buildCatchUpPool([refCandidate()], legacy, POLICY, '2026-06-08');
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
