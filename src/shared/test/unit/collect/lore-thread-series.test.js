'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  deriveLoreSeriesId,
  isLoreReplyItem
} = require('../../../collect/lore-thread-series');
const {
  collapseSeriesRepresentatives,
  parseRss
} = require('../../../cli/collect-news-candidates');

// 2026-W31 갭 감사 A1: lore 카메라 검색 피드(#806)는 창 전체를 돌려주지만, 시리즈 조각과 Re: 답장이
// 후보 슬롯을 각각 차지해 per-source 캡 8이 최근 2~3일 조각으로 소진됐다(SM8750/Kaanapali CAMSS
// 시리즈가 피드에 있었는데도 수집 탈락). lore에는 patchwork 같은 서버측 시리즈 id가 없으므로
// message-id 규약에서 seriesId를 파생해 collapseSeriesRepresentatives(#799)가 작동하게 한다.

test('deriveLoreSeriesId groups b4-style cover letter and fragments into one series key', () => {
  const cover = deriveLoreSeriesId({
    url: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/'
  });
  const fragmentByOwnUrl = deriveLoreSeriesId({
    url: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-4-e70ad4fa39ce@oss.qualcomm.com/'
  });
  const fragmentByParent = deriveLoreSeriesId({
    url: 'https://lore.kernel.org/linux-media/442145bb-9487-41be-8a9d-af5553e6fe8b@linaro.org/',
    inReplyTo: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/'
  });
  assert.ok(cover);
  assert.equal(fragmentByOwnUrl, cover);
  assert.equal(fragmentByParent, cover);
});

test('deriveLoreSeriesId groups git-send-email style fragments into one series key', () => {
  const first = deriveLoreSeriesId({
    url: 'https://lore.kernel.org/linux-media/20260726214401.19042-1-j@metarealtyinc.ca/'
  });
  const second = deriveLoreSeriesId({
    url: 'https://lore.kernel.org/linux-media/20260726214401.19042-2-j@metarealtyinc.ca/'
  });
  assert.ok(first);
  assert.equal(second, first);
});

test('deriveLoreSeriesId keeps distinct series and unknown message-id styles apart', () => {
  const camss = deriveLoreSeriesId({
    url: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/'
  });
  const sm8750 = deriveLoreSeriesId({
    url: 'https://lore.kernel.org/linux-media/20260721123456.9876-1-quic_x@quicinc.com/'
  });
  assert.ok(sm8750);
  assert.notEqual(sm8750, camss);
  // uuid 스타일 등 규약 밖 message-id와 비-lore URL은 파생하지 않는다(기존 동작 유지 = collapse 안 함).
  assert.equal(deriveLoreSeriesId({
    url: 'https://lore.kernel.org/linux-media/442145bb-9487-41be-8a9d-af5553e6fe8b@linaro.org/'
  }), null);
  assert.equal(deriveLoreSeriesId({
    url: 'https://example.com/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/'
  }), null);
});

test('isLoreReplyItem flags Re: titles only for lore URLs', () => {
  assert.equal(isLoreReplyItem({
    url: 'https://lore.kernel.org/linux-media/442145bb@linaro.org/',
    title: 'Re: [PATCH v2 1/2] dt-bindings: media: i2c: Add Samsung S5KJN5 image sensor'
  }), true);
  assert.equal(isLoreReplyItem({
    url: 'https://lore.kernel.org/linux-media/20260724-sk5jn5-v2-0-871d3b9a2e47@oss.qualcomm.com/',
    title: '[PATCH v2 0/2] media: i2c: Add Samsung S5KJN5 image sensor'
  }), false);
  assert.equal(isLoreReplyItem({
    url: 'https://example.com/thread/1',
    title: 'Re: how do I configure the build?'
  }), false);
});

test('parseRss drops lore replies and stamps series keys so the cap keeps one slot per series', () => {
  const source = {
    id: 'lore-linux-media-list',
    name: 'lore.kernel.org linux-media list',
    url: 'https://lore.kernel.org/linux-media/',
    category: 'linux-camera',
    priority: 'high',
    reliability: 'project-official',
    keywords: []
  };
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:thr="http://purl.org/syndication/thread/1.0">
<entry>
  <title>[PATCH v5 0/5] media: qcom: camss: CAMSS Offline Processing Engine support</title>
  <updated>2026-07-24T09:00:00Z</updated>
  <link href="https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/"/>
</entry>
<entry>
  <title>[PATCH v5 4/5] media: qcom: camss: Add CAMSS Offline Processing Engine driver</title>
  <updated>2026-07-24T09:01:00Z</updated>
  <link href="https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-4-e70ad4fa39ce@oss.qualcomm.com/"/>
  <thr:in-reply-to href="https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/"/>
</entry>
<entry>
  <title>Re: [PATCH v5 4/5] media: qcom: camss: Add CAMSS Offline Processing Engine driver</title>
  <updated>2026-07-25T10:00:00Z</updated>
  <link href="https://lore.kernel.org/linux-media/442145bb-9487-41be-8a9d-af5553e6fe8b@linaro.org/"/>
  <thr:in-reply-to href="https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-4-e70ad4fa39ce@oss.qualcomm.com/"/>
</entry>
<entry>
  <title>[PATCH v6 0/7] media: qcom: camss: Add SM8750 support</title>
  <updated>2026-07-21T08:00:00Z</updated>
  <link href="https://lore.kernel.org/linux-media/20260721123456.9876-1-quic_x@quicinc.com/"/>
</entry>
</feed>`;

  const candidates = parseRss(xml, source);
  const titles = candidates.map(candidate => candidate.title);
  assert.equal(candidates.length, 3, 'Re: 답장은 후보가 되면 안 된다');
  assert.ok(titles.every(title => !/^re:/i.test(title)));

  const cover = candidates.find(candidate => candidate.title.includes('0/5'));
  const fragment = candidates.find(candidate => candidate.title.includes('4/5'));
  const sm8750 = candidates.find(candidate => candidate.title.includes('SM8750'));
  assert.ok(cover.seriesId);
  assert.equal(fragment.seriesId, cover.seriesId);
  assert.ok(sm8750.seriesId);
  assert.notEqual(sm8750.seriesId, cover.seriesId);

  // 조각이 캡 이전에 대표 1건으로 붕괴되므로, 같은 시리즈 조각이 슬롯을 중복 소비하지 않는다.
  const collapsed = collapseSeriesRepresentatives(candidates);
  assert.deepEqual(collapsed.map(candidate => candidate.title), [
    '[PATCH v5 0/5] media: qcom: camss: CAMSS Offline Processing Engine support',
    '[PATCH v6 0/7] media: qcom: camss: Add SM8750 support'
  ]);
});

test('parseRss keeps Re: titles from non-lore feeds untouched', () => {
  const source = {
    id: 'example-feed',
    name: 'Example feed',
    url: 'https://example.com/feed',
    category: 'android',
    priority: 'medium',
    reliability: 'community',
    keywords: []
  };
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
  <title>Re: thoughts on the new camera API</title>
  <updated>2026-07-24T09:00:00Z</updated>
  <link href="https://example.com/posts/1"/>
</entry>
</feed>`;
  const candidates = parseRss(xml, source);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].seriesId ?? null, null);
});
