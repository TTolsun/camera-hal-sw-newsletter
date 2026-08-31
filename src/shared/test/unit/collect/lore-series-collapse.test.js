'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collapseSeriesRepresentatives,
  parseRss
} = require('../../../cli/collect-news-candidates');

// 2026-W31 갭 감사 A1: lore 카메라 검색 피드(#806)는 창 전체를 돌려주지만, 시리즈 조각과 Re: 답장이
// 후보 슬롯을 각각 차지해 per-source 캡 8이 최근 2~3일 조각으로 소진됐다(SM8750/Kaanapali CAMSS
// 시리즈가 피드에 있었는데도 수집 탈락). lore에는 patchwork 같은 서버측 시리즈 id가 없으므로
// 선정 단계와 같은 단일출처 파서(article-groups loreSeriesParts)로 seriesId를 파생해
// collapseSeriesRepresentatives(#799)가 작동하게 하고, Re: 답장은 후보에서 제외한다.

function loreSource() {
  return {
    id: 'lore-linux-media-list',
    name: 'lore.kernel.org linux-media list',
    url: 'https://lore.kernel.org/linux-media/',
    sourceUrl: 'https://lore.kernel.org/linux-media/',
    category: 'linux-camera',
    priority: 'high',
    reliability: 'project-official',
    keywords: []
  };
}

function atomFeed(entries) {
  return [
    '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:thr="http://purl.org/syndication/thread/1.0">',
    ...entries.map(entry => [
      '<entry>',
      `<title>${entry.title}</title>`,
      `<updated>${entry.updated}</updated>`,
      `<link href="${entry.link}"/>`,
      entry.inReplyTo ? `<thr:in-reply-to href="${entry.inReplyTo}"/>` : '',
      '</entry>'
    ].filter(Boolean).join('\n')),
    '</feed>'
  ].join('\n');
}

test('parseRss stamps one shared series key per lore patch series (b4, version-less b4, git-send-email)', () => {
  const xml = atomFeed([
    {
      title: '[PATCH v5 0/5] media: qcom: camss: CAMSS Offline Processing Engine support',
      updated: '2026-07-24T09:00:00Z',
      link: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/'
    },
    {
      title: '[PATCH v5 4/5] media: qcom: camss: Add CAMSS Offline Processing Engine driver',
      updated: '2026-07-24T09:01:00Z',
      link: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-4-e70ad4fa39ce@oss.qualcomm.com/',
      inReplyTo: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/'
    },
    {
      // 버전 토큰 없는 b4 첫 버전 표기(article-groups LORE_NEW_STYLE이 실데이터로 문서화한 형식).
      title: '[PATCH 0/3] media: qcom: camss: Add glymur CAMSS support',
      updated: '2026-07-22T08:00:00Z',
      link: 'https://lore.kernel.org/linux-media/20260722-glymur_camss-0-bee535396d22@oss.qualcomm.com/'
    },
    {
      title: '[PATCH 1/3] media: qcom: camss: glymur VFE bindings',
      updated: '2026-07-22T08:01:00Z',
      link: 'https://lore.kernel.org/linux-media/20260722-glymur_camss-1-bee535396d22@oss.qualcomm.com/'
    },
    {
      title: '[PATCH 0/2] media: add Himax HM1092 monochrome IR sensor support',
      updated: '2026-07-26T21:44:00Z',
      link: 'https://lore.kernel.org/linux-media/20260726214401.19042-1-j@metarealtyinc.ca/'
    },
    {
      title: '[PATCH 1/2] media: i2c: add Himax HM1092 IR sensor driver',
      updated: '2026-07-26T21:44:30Z',
      link: 'https://lore.kernel.org/linux-media/20260726214401.19042-2-j@metarealtyinc.ca/'
    }
  ]);

  const candidates = parseRss(xml, loreSource());
  assert.equal(candidates.length, 6);
  const seriesOf = fragment => candidates.find(candidate => candidate.title.includes(fragment)).seriesId;
  assert.ok(seriesOf('0/5'));
  assert.equal(seriesOf('4/5'), seriesOf('0/5'));
  assert.ok(seriesOf('glymur CAMSS support'));
  assert.equal(seriesOf('glymur VFE bindings'), seriesOf('glymur CAMSS support'));
  assert.ok(seriesOf('HM1092 monochrome'));
  assert.equal(seriesOf('HM1092 IR sensor driver'), seriesOf('HM1092 monochrome'));
  const keys = new Set([seriesOf('0/5'), seriesOf('glymur CAMSS support'), seriesOf('HM1092 monochrome')]);
  assert.equal(keys.size, 3, '서로 다른 시리즈는 다른 키를 가져야 한다');
});

test('parseRss drops lore Re: replies but keeps non-lore feeds untouched', () => {
  const xml = atomFeed([
    {
      title: 'Re: [PATCH v5 4/5] media: qcom: camss: Add CAMSS Offline Processing Engine driver',
      updated: '2026-07-25T10:00:00Z',
      link: 'https://lore.kernel.org/linux-media/442145bb-9487-41be-8a9d-af5553e6fe8b@linaro.org/',
      inReplyTo: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-4-e70ad4fa39ce@oss.qualcomm.com/'
    },
    {
      title: '[PATCH v5 0/5] media: qcom: camss: CAMSS Offline Processing Engine support',
      updated: '2026-07-24T09:00:00Z',
      link: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/'
    }
  ]);
  const loreCandidates = parseRss(xml, loreSource());
  assert.equal(loreCandidates.length, 1, 'lore Re: 답장은 후보가 되면 안 된다');
  assert.ok(!/^re:/i.test(loreCandidates[0].title));

  const nonLoreXml = atomFeed([
    { title: 'Re: thoughts on the new camera API', updated: '2026-07-24T09:00:00Z', link: 'https://example.com/posts/1' }
  ]);
  const nonLoreCandidates = parseRss(nonLoreXml, {
    ...loreSource(), id: 'example-feed', name: 'Example feed', url: 'https://example.com/feed', reliability: 'community'
  });
  assert.equal(nonLoreCandidates.length, 1, '비-lore 피드의 Re: 제목은 건드리지 않는다');
  assert.equal(nonLoreCandidates[0].seriesId ?? null, null);
});

test('a standalone patch posted into another series thread keeps its own series key', () => {
  // git send-email --in-reply-to 관행: 자기 message-id가 멀쩡히 파싱되는 비-Re: 패치가 남의
  // 스레드에 답글로 게시돼도 남의 시리즈 키를 물려받아 collapse로 소실되면 안 된다
  // (단일출처 파서가 자기 message-id를 우선하므로 보장된다).
  const xml = atomFeed([
    {
      title: '[PATCH v2 0/4] media: qcom: camss: Report CAMSS hardware version',
      updated: '2026-07-21T09:00:00Z',
      link: 'https://lore.kernel.org/linux-media/20260721093000.4321-1-a@x.com/'
    },
    {
      title: '[PATCH] media: uvcvideo: query pan/tilt position on every read',
      updated: '2026-07-22T11:00:00Z',
      link: 'https://lore.kernel.org/linux-media/20260722110000.7777-1-b@y.com/',
      inReplyTo: 'https://lore.kernel.org/linux-media/20260721093000.4321-1-a@x.com/'
    }
  ]);
  const candidates = parseRss(xml, loreSource());
  assert.equal(candidates.length, 2);
  const [camss, uvc] = candidates;
  assert.ok(uvc.seriesId);
  assert.notEqual(uvc.seriesId, camss.seriesId);
  assert.equal(collapseSeriesRepresentatives(candidates).length, 2, '독립 패치가 남의 시리즈로 붕괴되면 안 된다');
});

test('collapse keeps the first-seen slot but prefers the cover letter as series representative', () => {
  // public-inbox 검색 atom은 최신순이라 커버레터(가장 먼저 발송)가 조각들보다 뒤에 온다.
  // 대표 슬롯(캡 경쟁 순위)은 rank 최상위 조각의 자리를 쓰되, 내용은 시리즈 개요를 담은
  // 커버레터(patch 번호 최소)로 채운다.
  const xml = atomFeed([
    {
      title: '[PATCH v5 4/5] media: qcom: camss: Add CAMSS Offline Processing Engine driver',
      updated: '2026-07-24T09:05:00Z',
      link: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-4-e70ad4fa39ce@oss.qualcomm.com/'
    },
    {
      title: '[PATCH v5 0/5] media: qcom: camss: CAMSS Offline Processing Engine support',
      updated: '2026-07-24T09:00:00Z',
      link: 'https://lore.kernel.org/linux-media/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com/'
    },
    {
      title: '[PATCH v6 0/7] media: qcom: camss: Add SM8750 support',
      updated: '2026-07-21T08:00:00Z',
      link: 'https://lore.kernel.org/linux-media/20260721080000.1234-1-quic_x@quicinc.com/'
    }
  ]);
  const candidates = parseRss(xml, loreSource());
  const collapsed = collapseSeriesRepresentatives(candidates);
  assert.deepEqual(collapsed.map(candidate => candidate.title), [
    '[PATCH v5 0/5] media: qcom: camss: CAMSS Offline Processing Engine support',
    '[PATCH v6 0/7] media: qcom: camss: Add SM8750 support'
  ]);
});

test('a hash-style series and its re-rolls collapse to one candidate (#1030, 2026-W35 shape)', () => {
  // 2026-08-31호 실측: lore 8슬롯 중 6칸을 Lenovo Yoga Book 한 시리즈의 v2/v3/v4가 먹었다.
  // v3·v4는 git-send-email이 커밋 해시로 만든 message-id(cover.<epoch>.git.<보낸사람>)라
  // 시리즈 키가 안 뽑혔고, seriesId가 비면 collapseSeriesRerolls의 subject 비교까지 함께
  // 꺼져 재제출 병합도 안 걸렸다. 아래는 그 6건을 피드에 도착한 순서(최신순)대로 넣은 것이다.
  const xml = atomFeed([
    {
      title: '[PATCH v4 14/15] media: atomisp: allow raw Bayer capture',
      updated: '2026-08-28T16:15:00Z',
      link: 'https://lore.kernel.org/linux-media/749f33adb08c4b311aec241c0bdcc455fcdc0a3c.1787933456.git.mauriziocasciano7@gmail.com/'
    },
    {
      title: '[PATCH v4 00/15] media: Add Lenovo Yoga Book YB1-X91 camera support',
      updated: '2026-08-28T16:14:00Z',
      link: 'https://lore.kernel.org/linux-media/cover.1787933456.git.mauriziocasciano7@gmail.com/'
    },
    {
      title: '[PATCH v3 11/12] media: atomisp: allow raw Bayer capture',
      updated: '2026-08-27T23:18:00Z',
      link: 'https://lore.kernel.org/linux-media/9535d6ecaa9b12421a6b17de54a954aa336a7819.1787872237.git.mauriziocasciano7@gmail.com/'
    },
    {
      title: '[PATCH v3 08/12] media: atomisp: support the Yoga Book OV2740 link',
      updated: '2026-08-27T23:17:30Z',
      link: 'https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com/'
    },
    {
      title: '[PATCH v3 00/12] media: Add Lenovo Yoga Book YB1-X91 camera support',
      updated: '2026-08-27T23:17:00Z',
      link: 'https://lore.kernel.org/linux-media/cover.1787872237.git.mauriziocasciano7@gmail.com/'
    },
    {
      title: '[PATCH v2 00/11] media: Add Lenovo Yoga Book YB1-X91 camera support',
      updated: '2026-08-27T18:18:00Z',
      link: 'https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/'
    },
    // 같은 창의 다른 시리즈는 collapse에서 소실되지 않아야 한다.
    {
      title: '[PATCH v3 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor',
      updated: '2026-08-28T06:49:00Z',
      link: 'https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/'
    }
  ]);

  const candidates = parseRss(xml, loreSource());
  assert.equal(candidates.length, 7);

  // v2(old-style)·v3·v4는 서로 다른 시리즈 키를 받는다 — 각 발송이 자기 epoch를 갖기 때문이다.
  const seriesOf = fragment => candidates.find(candidate => candidate.title.includes(fragment)).seriesId;
  assert.equal(seriesOf('v3 08/12'), seriesOf('v3 00/12'));
  assert.equal(seriesOf('v4 14/15'), seriesOf('v4 00/15'));
  assert.notEqual(seriesOf('v3 00/12'), seriesOf('v4 00/15'));
  assert.notEqual(seriesOf('v2 00/11'), seriesOf('v3 00/12'));

  const collapsed = collapseSeriesRepresentatives(candidates);
  assert.deepEqual(collapsed.map(candidate => candidate.title), [
    '[PATCH v4 00/15] media: Add Lenovo Yoga Book YB1-X91 camera support',
    '[PATCH v3 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor'
  ], '6조각이 최신 버전 커버레터 1건으로 접히고 다른 시리즈는 남아야 한다');
});

test('hash-style fragments without a cover letter still pick the lowest patch number', () => {
  // 커버레터가 창 밖으로 밀린 주에도 대표는 결정론적이어야 한다. message-id에 순번이 없으므로
  // 제목 브래킷의 x/N을 읽는다 — 도착 순서(피드 rank)가 대표를 정하면 재실행마다 기사 source가
  // 흔들린다. 슬롯 자리는 first-seen을 쓰되 내용은 09/15가 맡는다.
  const xml = atomFeed([
    {
      title: '[PATCH v4 14/15] media: atomisp: allow raw Bayer capture',
      updated: '2026-08-28T16:15:00Z',
      link: 'https://lore.kernel.org/linux-media/749f33adb08c4b311aec241c0bdcc455fcdc0a3c.1787933456.git.mauriziocasciano7@gmail.com/'
    },
    {
      // 이 조각의 해시만 합성값이다(나머지 message-id·epoch는 2026-W35 실측). 40자 hex +
      // 10자리 epoch라 LORE_HASH_STYLE의 길이 하한을 실제로 통과해야 매치된다.
      title: '[PATCH v4 09/15] media: intel: ipu-bridge: allow sensor-specific link frequencies',
      updated: '2026-08-28T16:14:30Z',
      link: 'https://lore.kernel.org/linux-media/8ad2f0b1c3e45a6789bcdef0123456789abcdef0.1787933456.git.mauriziocasciano7@gmail.com/'
    }
  ]);
  const collapsed = collapseSeriesRepresentatives(parseRss(xml, loreSource()));
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].title, '[PATCH v4 09/15] media: intel: ipu-bridge: allow sensor-specific link frequencies');
});
