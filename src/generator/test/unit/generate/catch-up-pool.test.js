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

// ── catch-up 레인의 시리즈 인지(#1036) ────────────────────────────────────────
// 수집 단계가 한 패치 시리즈를 대표 1건으로 줄이면서 그 대표 URL을 주마다 바꾼다
// (#799 collapse · #822 커버레터 우선). URL identity만 보면 지난주 발행한 시리즈가
// 이번 주에 다른 조각 URL로 catch-up 레인을 통과한다. 아래 두 URL은 같은 시리즈다
// (2026-08-31호가 08/12 조각을 발행했고 커버레터도 같은 주 후보에 있었다).
const SERIES_PUBLISHED_PIECE_URL =
  'https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com';
const SERIES_COVER_LETTER_URL =
  'https://lore.kernel.org/linux-media/cover.1787872237.git.mauriziocasciano7@gmail.com/';

function seriesRefCandidate(url, title) {
  return refCandidate({
    title,
    url,
    article_identity_key: `url:${url}`,
    api_or_component: 'atomisp',
    behavior_change: 'Adds the Yoga Book OV2740 sensor link',
    version_or_release: ''
  });
}

function seriesPublishedHistory(sourceUrl) {
  return {
    articles: [{
      article_identity_key: `url:${sourceUrl}`,
      source_url: sourceUrl,
      exposure_type: 'newsletter_article',
      exposure_types: ['newsletter_article'],
      newsletter_date: '2026-08-31',
      newsletter_article_date: '2026-08-31',
      cooldown_until: '2026-09-21'
    }]
  };
}

test('drops a candidate whose patch series was already covered under a different piece URL', () => {
  const candidate = seriesRefCandidate(
    SERIES_COVER_LETTER_URL,
    '[PATCH v3 00/12] media: Add Lenovo Yoga Book YB1-X91 camera support'
  );
  const pool = buildCatchUpPool(
    [candidate],
    seriesPublishedHistory(SERIES_PUBLISHED_PIECE_URL),
    POLICY,
    '2026-09-07'
  );

  assert.equal(pool.length, 0);
});

test('keeps a non-series candidate when an unrelated non-series article was covered', () => {
  // 거짓 차단 감시: 시리즈 키가 빈 후보끼리 맞아떨어지면 catch-up 풀이 통째로 비어 버린다.
  const pool = buildCatchUpPool(
    [refCandidate()],
    seriesPublishedHistory('https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2'),
    POLICY,
    '2026-09-07'
  );

  assert.equal(pool.length, 1);
});
