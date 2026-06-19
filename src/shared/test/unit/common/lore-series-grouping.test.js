'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  fallbackGroupKey,
  loreSeriesKey,
  loreSeriesPatchNumber,
  loreThreadUrl
} = require('../../../common/article-groups');

const LORE_LIST = 'https://lore.kernel.org/linux-media';

function loreCandidate(messageId, title) {
  return {
    title: title || `lore message ${messageId}`,
    url: `${LORE_LIST}/${messageId}/`
  };
}

test('loreSeriesKey collapses new-style v1 cover and patches into one key', () => {
  const cover = loreCandidate('20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com', 'cover letter');
  const patch1 = loreCandidate('20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com', 'patch 1');
  const patch2 = loreCandidate('20260529-glymur_camss-v1-2-bee535396d22@oss.qualcomm.com', 'patch 2');

  const coverKey = loreSeriesKey(cover);
  assert.ok(coverKey, 'cover key should be non-empty');
  assert.equal(loreSeriesKey(patch1), coverKey);
  assert.equal(loreSeriesKey(patch2), coverKey);
});

test('loreSeriesKey collapses new-style patches sent without a -vN version token', () => {
  // b4/git-send-email first-version series sometimes omit the -v<N> token entirely.
  const cover = loreCandidate('20260529-glymur_camss-0-bee535396d22@oss.qualcomm.com', 'cover letter');
  const patch1 = loreCandidate('20260529-glymur_camss-1-bee535396d22@oss.qualcomm.com', 'patch 1');
  const patch2 = loreCandidate('20260529-glymur_camss-2-bee535396d22@oss.qualcomm.com', 'patch 2');

  const coverKey = loreSeriesKey(cover);
  assert.ok(coverKey, 'no-version cover key should be non-empty');
  assert.equal(loreSeriesKey(patch1), coverKey);
  assert.equal(loreSeriesKey(patch2), coverKey);

  // a no-version series is a distinct series from the same slug with an explicit -v1 token.
  const versioned = loreCandidate('20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com');
  assert.notEqual(loreSeriesKey(versioned), coverKey);
});

test('loreSeriesKey collapses old-style datetime.pid patches into one key', () => {
  const patch1 = loreCandidate('20260527170531.383871-1-miguel.vadillo@intel.com', 'patch 1');
  const patch2 = loreCandidate('20260527170531.383871-2-miguel.vadillo@intel.com', 'patch 2');

  const key1 = loreSeriesKey(patch1);
  assert.ok(key1, 'old-style key should be non-empty');
  assert.equal(loreSeriesKey(patch2), key1);
});

test('loreSeriesKey keeps distinct series distinct', () => {
  const seriesA = loreCandidate('20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com');
  // different base slug
  const seriesB = loreCandidate('20260529-iris-remote-fmts-v7-1-a8bd57ac8b5a@oss.qualcomm.com');
  // same slug but different version -> a different series resend
  const seriesAv2 = loreCandidate('20260529-glymur_camss-v2-0-cc1234567890@oss.qualcomm.com');

  assert.notEqual(loreSeriesKey(seriesA), loreSeriesKey(seriesB));
  assert.notEqual(loreSeriesKey(seriesA), loreSeriesKey(seriesAv2));
});

test('loreSeriesKey returns empty for non-series lore message-ids and non-lore URLs', () => {
  assert.equal(loreSeriesKey(loreCandidate('051b9597-873c-44ca-b7a5-29efa795406f@oss.qualcomm.com')), '');
  assert.equal(loreSeriesKey(loreCandidate('ahyh0ZlwlZqr7VNa%40kekkonen.localdomain')), '');
  assert.equal(loreSeriesKey({ url: 'https://lore.kernel.org/linux-media/' }), '');
  assert.equal(loreSeriesKey({ url: 'https://example.com/some/path/article' }), '');
  assert.equal(loreSeriesKey({}), '');
});

test('loreSeriesPatchNumber returns the patch number and a large number when unknown', () => {
  const cover = loreCandidate('20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com');
  const patch2 = loreCandidate('20260529-glymur_camss-v1-2-bee535396d22@oss.qualcomm.com');
  const oldPatch1 = loreCandidate('20260527170531.383871-1-miguel.vadillo@intel.com');

  assert.equal(loreSeriesPatchNumber(cover), 0);
  assert.equal(loreSeriesPatchNumber(patch2), 2);
  assert.equal(loreSeriesPatchNumber(oldPatch1), 1);
  assert.ok(loreSeriesPatchNumber({ url: 'https://lore.kernel.org/linux-media/' }) > 1000000);
  assert.ok(loreSeriesPatchNumber({}) > 1000000);
});

test('fallbackGroupKey collapses a patch series and keeps non-series lore messages distinct', () => {
  const cover = loreCandidate('20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com', 'cover letter');
  const patch1 = loreCandidate('20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com', 'patch 1');
  const patch2 = loreCandidate('20260529-glymur_camss-v1-2-bee535396d22@oss.qualcomm.com', 'patch 2');

  const groupKey = fallbackGroupKey(cover);
  assert.ok(groupKey.startsWith('lore-series:'), 'series fallback key should be a lore-series key');
  assert.equal(fallbackGroupKey(patch1), groupKey);
  assert.equal(fallbackGroupKey(patch2), groupKey);

  // a standalone (non-series) lore message keeps the existing article: URL fallback key.
  const standalone = loreCandidate('051b9597-873c-44ca-b7a5-29efa795406f@oss.qualcomm.com', 'standalone fix');
  assert.ok(fallbackGroupKey(standalone).startsWith('article:'));
  assert.notEqual(fallbackGroupKey(standalone), groupKey);
});

test('loreThreadUrl maps a series patch URL to its thread view and ignores non-series', () => {
  const patch1 = loreCandidate('20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com');
  assert.equal(
    loreThreadUrl(patch1.url),
    `${LORE_LIST}/20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com/T/#t`
  );
  // cover letter(patch 0)도 같은 시리즈라 thread view로 변환된다.
  const cover = loreCandidate('20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com');
  assert.ok(loreThreadUrl(cover.url).endsWith('/T/#t'));
  // 비-시리즈 lore message-id, 비-lore URL, 빈 값은 보조 링크를 만들지 않는다.
  assert.equal(loreThreadUrl(`${LORE_LIST}/051b9597-873c-44ca-b7a5-29efa795406f@oss.qualcomm.com/`), '');
  assert.equal(loreThreadUrl('https://example.com/some/path/article'), '');
  assert.equal(loreThreadUrl(''), '');
});
