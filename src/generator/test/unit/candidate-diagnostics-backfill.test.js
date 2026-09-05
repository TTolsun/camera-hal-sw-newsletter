'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  asOfExposureHistory,
  CANDIDATE_BODY_FIELDS
} = require('../../diagnostics/candidate-diagnostics-backfill');
const { extractOwnArgs, DEFAULT_OUT_DIR } = require('../../publish/dump-candidate-diagnostics');

const HISTORY = {
  schemaVersion: 1,
  articles: [
    { article_identity_key: 'past', newsletter_date: '2026-07-06' },
    { article_identity_key: 'same', newsletter_date: '2026-07-27' },
    { article_identity_key: 'future', newsletter_date: '2026-08-31' },
    { article_identity_key: 'undated' }
  ]
};

test('기준 날짜보다 나중에 발행된 이력은 잘라 낸다', () => {
  // 자르지 않으면 과거 주 재구성이 그때 있지도 않았던 이력에 막힌다.
  const result = asOfExposureHistory(HISTORY, '2026-07-27');
  const keys = result.articles.map(record => record.article_identity_key);
  assert.ok(!keys.includes('future'));
  assert.ok(keys.includes('past'));
});

test('같은 날짜 이력은 남긴다 — 동일 호 판정은 하류가 한다', () => {
  const result = asOfExposureHistory(HISTORY, '2026-07-27');
  assert.ok(result.articles.some(record => record.article_identity_key === 'same'));
});

test('날짜를 모르는 레코드는 남긴다', () => {
  // 지우면 실제로 있던 차단을 없애는 쪽으로 틀린다. 남기는 쪽이 안전하다.
  const result = asOfExposureHistory(HISTORY, '2026-07-27');
  assert.ok(result.articles.some(record => record.article_identity_key === 'undated'));
});

test('기준 날짜가 없으면 이력을 그대로 둔다', () => {
  assert.strictEqual(asOfExposureHistory(HISTORY, ''), HISTORY);
  assert.strictEqual(asOfExposureHistory(null, '2026-07-27'), null);
});

test('원본 이력을 바꾸지 않는다', () => {
  const before = HISTORY.articles.length;
  asOfExposureHistory(HISTORY, '2026-07-01');
  assert.strictEqual(HISTORY.articles.length, before);
});

test('후보 본문은 재심에 쓰는 필드만 싣는다', () => {
  // merged-candidates.json은 주당 1MB다. 통째로 실으면 백필 산출물이 원본만큼 커진다.
  assert.deepStrictEqual(CANDIDATE_BODY_FIELDS, [
    'title',
    'summary',
    'api_or_component',
    'version_or_release',
    'behavior_change',
    'source_name'
  ]);
});

test('이 CLI 전용 인자를 공용 파서에 넘기지 않는다', () => {
  const parsed = extractOwnArgs(['--all', '--out-dir', 'x/y', '--date', '2026-07-27']);
  assert.strictEqual(parsed.all, true);
  assert.strictEqual(parsed.outDir, 'x/y');
  assert.deepStrictEqual(parsed.rest, ['--date', '2026-07-27']);
});

test('--out-dir= 형태도 받는다', () => {
  const parsed = extractOwnArgs(['--out-dir=z']);
  assert.strictEqual(parsed.outDir, 'z');
  assert.deepStrictEqual(parsed.rest, []);
});

test('전용 인자가 없으면 기본 출력 경로를 쓴다', () => {
  const parsed = extractOwnArgs(['--date', '2026-07-27']);
  assert.strictEqual(parsed.all, false);
  assert.strictEqual(parsed.outDir, DEFAULT_OUT_DIR);
});
