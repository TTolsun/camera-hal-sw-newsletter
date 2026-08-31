'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  fallbackGroupKey,
  loreSeriesKey,
  loreSeriesPatchNumber,
  loreThreadUrl,
  seriesKey,
  seriesPatchNumber
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

// #1030: git-send-email이 커밋 해시로 message-id를 만들면 세 번째 형식이 온다.
// 시리즈를 가르는 것은 한 번의 send-email 호출을 나타내는 <epoch>이고, 앞자리는
// 커버레터면 'cover', 패치면 그 패치의 커밋 해시다. 아래 값은 2026-W35 실데이터다
// (Lenovo Yoga Book YB1-X91 카메라 시리즈 v3 = epoch 1787872237, v4 = 1787933456).
const YOGA_BOOK_V3_EPOCH = '1787872237';
const YOGA_BOOK_V4_EPOCH = '1787933456';
const YOGA_BOOK_SENDER = 'mauriziocasciano7@gmail.com';

test('loreSeriesKey collapses hash-style cover and patches sharing one send-email epoch', () => {
  const cover = loreCandidate(`cover.${YOGA_BOOK_V3_EPOCH}.git.${YOGA_BOOK_SENDER}`, '[PATCH v3 00/12] cover letter');
  const patch08 = loreCandidate(
    `34736c93669fcb3e34023137b7785d469a843254.${YOGA_BOOK_V3_EPOCH}.git.${YOGA_BOOK_SENDER}`,
    '[PATCH v3 08/12] media: atomisp: support the Yoga Book OV2740 link'
  );
  const patch11 = loreCandidate(
    `9535d6ecaa9b12421a6b17de54a954aa336a7819.${YOGA_BOOK_V3_EPOCH}.git.${YOGA_BOOK_SENDER}`,
    '[PATCH v3 11/12] media: atomisp: allow raw Bayer capture'
  );

  const coverKey = loreSeriesKey(cover);
  assert.ok(coverKey, 'hash-style cover key should be non-empty');
  assert.equal(loreSeriesKey(patch08), coverKey);
  assert.equal(loreSeriesKey(patch11), coverKey);
});

test('loreSeriesKey keeps hash-style re-rolls apart because each send-email run gets its own epoch', () => {
  const v3Cover = loreCandidate(`cover.${YOGA_BOOK_V3_EPOCH}.git.${YOGA_BOOK_SENDER}`);
  const v4Cover = loreCandidate(`cover.${YOGA_BOOK_V4_EPOCH}.git.${YOGA_BOOK_SENDER}`);
  const v4Patch14 = loreCandidate(
    `749f33adb08c4b311aec241c0bdcc455fcdc0a3c.${YOGA_BOOK_V4_EPOCH}.git.${YOGA_BOOK_SENDER}`
  );

  assert.notEqual(loreSeriesKey(v3Cover), loreSeriesKey(v4Cover));
  assert.equal(loreSeriesKey(v4Patch14), loreSeriesKey(v4Cover));
  // 같은 epoch·다른 보낸사람은 다른 시리즈다.
  const otherSender = loreCandidate(`cover.${YOGA_BOOK_V3_EPOCH}.git.someone.else@example.com`);
  assert.notEqual(loreSeriesKey(otherSender), loreSeriesKey(v3Cover));
});

test('hash-style patch numbers are known only for the cover letter', () => {
  // 이 형식은 순번을 인코딩하지 않는다. 커버레터만 0이고 나머지는 unknown이라,
  // 대표 선정(가장 낮은 patch 번호)에서 커버레터가 항상 이긴다.
  const cover = loreCandidate(`cover.${YOGA_BOOK_V4_EPOCH}.git.${YOGA_BOOK_SENDER}`);
  const patch14 = loreCandidate(
    `749f33adb08c4b311aec241c0bdcc455fcdc0a3c.${YOGA_BOOK_V4_EPOCH}.git.${YOGA_BOOK_SENDER}`
  );

  assert.equal(loreSeriesPatchNumber(cover), 0);
  assert.ok(loreSeriesPatchNumber(patch14) > 1000000);
});

test('the hash-style rule does not swallow the other two formats or non-series ids', () => {
  // 기존 두 형식은 그대로 자기 규칙으로 풀려야 한다(키 접두부로 확인).
  const b4 = loreCandidate('20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com');
  const oldStyle = loreCandidate('20260827181756.2430054-1-mauriziocasciano7@gmail.com');
  assert.equal(loreSeriesKey(b4), 'lore-series:20260529-glymur_camss-v1-bee535396d22@oss.qualcomm.com');
  assert.equal(loreSeriesKey(oldStyle), 'lore-series:20260827181756.2430054-mauriziocasciano7@gmail.com');

  // '.git.' 꼬리가 없거나 epoch 자리가 짧으면 시리즈로 보지 않는다.
  assert.equal(loreSeriesKey(loreCandidate('cover.1787872237.mauriziocasciano7@gmail.com')), '');
  assert.equal(loreSeriesKey(loreCandidate(`cover.12345.git.${YOGA_BOOK_SENDER}`)), '');
  assert.equal(loreSeriesKey(loreCandidate(`zzzz.${YOGA_BOOK_V3_EPOCH}.git.${YOGA_BOOK_SENDER}`)), '');
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

// patchwork.libcamera.org 시리즈: lore와 달리 patch URL(/patch/<id>/)은 패치별 고유이고
// message-id도 없다. 시리즈 식별자는 수집기가 REST의 series id를 후보에 실어준 candidate.seriesId,
// patch 번호는 제목의 [..,x/N]에서 온다. generic seriesKey/seriesPatchNumber가 lore와 patchwork를
// 모두 커버해야 한다(#795).
const PATCHWORK_PATCH = 'https://patchwork.libcamera.org/patch';

function patchworkCandidate(patchId, seriesId, title) {
  return {
    title: title || `[v1,1/1] patchwork patch ${patchId}`,
    url: `${PATCHWORK_PATCH}/${patchId}/`,
    seriesId
  };
}

test('seriesKey collapses patchwork series fragments sharing a seriesId', () => {
  const p1 = patchworkCandidate(27346, 880, '[RFC,v7,1/6] libcamera: software_isp: egl: Add filter parameter');
  const p2 = patchworkCandidate(27347, 880, '[RFC,v7,2/6] libcamera: software_isp: Add LSC data to DebayerParams');
  const p5 = patchworkCandidate(27349, 880, '[RFC,v7,5/6] libcamera: software_isp: Pass LSC availability');

  const key1 = seriesKey(p1);
  assert.ok(key1, 'patchwork series key should be non-empty');
  assert.ok(key1.startsWith('patchwork-series:'), 'patchwork key should be namespaced');
  assert.equal(seriesKey(p2), key1);
  assert.equal(seriesKey(p5), key1);
});

test('seriesKey keeps distinct patchwork series distinct and ignores missing seriesId', () => {
  const a = patchworkCandidate(27346, 880, '[RFC,v7,1/6] series A');
  const b = patchworkCandidate(30000, 999, '[v2,1/3] series B');
  assert.notEqual(seriesKey(a), seriesKey(b));
  // seriesId 없는 단일 patch는 시리즈 그룹핑 없음(무회귀).
  const standalone = patchworkCandidate(40000, undefined, '[PATCH] standalone libcamera fix');
  assert.equal(seriesKey(standalone), '');
});

test('seriesPatchNumber extracts x/N from patchwork titles', () => {
  assert.equal(seriesPatchNumber(patchworkCandidate(1, 5, '[RFC,v7,0/6] cover letter')), 0);
  assert.equal(seriesPatchNumber(patchworkCandidate(2, 5, '[RFC,v7,3/6] patch three')), 3);
  assert.equal(seriesPatchNumber(patchworkCandidate(3, 5, '[v2,1/2] add control')), 1);
  // 제목에 x/N이 없으면 unknown(큰 수).
  assert.ok(seriesPatchNumber(patchworkCandidate(4, 5, '[PATCH] single patch')) > 1000000);
});

test('generic seriesKey still resolves lore series (wraps loreSeriesKey)', () => {
  const lore = {
    title: 'cover',
    url: `${LORE_LIST}/20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com/`
  };
  assert.equal(seriesKey(lore), loreSeriesKey(lore));
  assert.ok(seriesKey(lore).startsWith('lore-series:'));
  assert.equal(seriesPatchNumber(lore), loreSeriesPatchNumber(lore));
});

test('fallbackGroupKey collapses a patchwork series into one group', () => {
  const p1 = patchworkCandidate(27346, 880, '[RFC,v7,1/6] a');
  const p2 = patchworkCandidate(27347, 880, '[RFC,v7,2/6] b');
  const key = fallbackGroupKey(p1);
  assert.ok(key.startsWith('patchwork-series:'), 'patchwork series should flow into the group key');
  assert.equal(fallbackGroupKey(p2), key);
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
  // fragment(#related, 실데이터에 존재)·query·이미 #t로 끝나는 URL은 thread 경로가 그 안으로 들어가면
  // 안 되므로 origin+pathname만 남기고 정규 thread URL로 변환한다(raw 문자열 append 회귀 방지).
  const canonical = `${LORE_LIST}/20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com/T/#t`;
  assert.equal(loreThreadUrl(`${LORE_LIST}/20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com/#related`), canonical);
  assert.equal(loreThreadUrl(`${LORE_LIST}/20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com/?b=master`), canonical);
  assert.equal(loreThreadUrl(`${LORE_LIST}/20260529-glymur_camss-v1-1-bee535396d22@oss.qualcomm.com/#t`), canonical);
  // 비-시리즈 lore message-id, 비-lore URL, 빈 값은 보조 링크를 만들지 않는다.
  assert.equal(loreThreadUrl(`${LORE_LIST}/051b9597-873c-44ca-b7a5-29efa795406f@oss.qualcomm.com/`), '');
  assert.equal(loreThreadUrl('https://example.com/some/path/article'), '');
  assert.equal(loreThreadUrl(''), '');
});
