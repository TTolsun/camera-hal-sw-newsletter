'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { candidatesAreDuplicate } = require('../../select/newsroom-selection');
const { buildShortlistReport, policyDriverCandidate } = require('../../../core/test/helpers/selection-builders');

const LORE_LIST = 'https://lore.kernel.org/linux-media';

function loreSeriesCandidate(index, messageId, title, overrides = {}) {
  return policyDriverCandidate(index, {
    title,
    url: `${LORE_LIST}/${messageId}/`,
    source: 'lore.kernel.org',
    published_date: '2026-05-29',
    ...overrides
  });
}

test('candidatesAreDuplicate treats same-series lore patches as duplicates and distinct series as distinct', () => {
  const cover = { url: `${LORE_LIST}/20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com/`, title: 'cover letter: camss support' };
  const patch1 = { url: `${LORE_LIST}/20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com/`, title: 'media: camss: add csid' };
  const otherSeries = { url: `${LORE_LIST}/20260529-iris-remote-fmts-v7-1-a8bd57ac8b5a@oss.qualcomm.com/`, title: 'media: iris: remote fmts' };

  assert.equal(candidatesAreDuplicate(cover, patch1), true);
  // 다른 시리즈는 시리즈 키로 묶이지 않는다 (함수의 기존 falsy 반환 계약을 따른다).
  assert.ok(!candidatesAreDuplicate(cover, otherSeries));
});

test('a lore.kernel.org patch series collapses to exactly one main candidate (the cover letter)', () => {
  // 동일 패치 시리즈의 cover letter + 3개 패치, 각기 다른 message-id URL과 다른 title.
  const cover = loreSeriesCandidate(0, '20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com',
    'media: camss: glymur camera subsystem support (cover letter)');
  const patch1 = loreSeriesCandidate(1, '20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com',
    'media: camss: add CSID hardware version for glymur');
  const patch2 = loreSeriesCandidate(2, '20260529-glymur_camss-v1-2-bee535396d22@oss.qualcomm.com',
    'media: camss: wire up VFE for glymur image pipeline');
  const patch3 = loreSeriesCandidate(3, '20260529-glymur_camss-v1-3-bee535396d22@oss.qualcomm.com',
    'media: dt-bindings: camss document glymur bindings');
  // 시리즈와 무관한 별도 후보 (다른 V4L2 드라이버 토픽).
  const unrelated = policyDriverCandidate(9, {
    title: 'media: i2c: imx sensor format negotiation fix',
    url: `${LORE_LIST}/20260527170531.999999-1-other.author@example.com/`,
    source: 'lore.kernel.org',
    published_date: '2026-05-27'
  });

  const report = buildShortlistReport('2026-06-01', [patch1, patch2, cover, patch3, unrelated], {
    minArticles: 1,
    maxArticles: 5
  });

  const selectedLore = report.selected_articles.filter(article => article.url.startsWith(`${LORE_LIST}/`));
  const seriesSelected = selectedLore.filter(article => article.url.includes('glymur_camss-v1'));

  // 시리즈에서는 정확히 하나의 main 후보만 살아남는다.
  assert.equal(seriesSelected.length, 1, 'exactly one patch-series candidate should survive as a main article');
  // 살아남은 후보는 cover letter (patch 번호 0) 여야 한다.
  assert.equal(seriesSelected[0].url, cover.url);
  // 무관한 후보는 영향을 받지 않고 그대로 선택된다.
  assert.ok(
    report.selected_articles.some(article => article.url === unrelated.url),
    'the unrelated non-series candidate should still survive'
  );
});
