'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  componentFromText,
  evidenceMetadata
} = require('../../../cli/collect-news-candidates');

// #805: 분류기(#744)와 스코어러(#792)는 벤더 ISP/V4L2 드라이버 모듈명을 카메라 evidence로
// 인식하지만, 수집 측 evidence 파서 componentFromText는 API_OR_COMPONENT_PATTERN의 \bISP\b만
// 써서 rkisp1/camss처럼 "ISP"가 토큰 내부에 있는 이름을 놓쳤다. 그 결과 진짜 카메라 드라이버
// 패치가 api_or_component='' -> evidence_score 4(<6) -> source_gap_risk=true로 main에서 탈락했다.
// 단일출처(STRONG_CAMERA_DRIVER_PATTERNS) fallback으로 세 소비자의 어휘를 정합시킨다.
// (#792의 src/generator/test/contract/scoring-vendor-isp-evidence.test.js와 짝이 되는 수집 측 버전)

const VENDOR_DRIVER_TITLES = [
  { token: 'rkisp1', title: 'media: rkisp1: fix AGC gain calculation for low-light frames' },
  { token: 'rkisp2', title: 'media: rkisp2: correct statistics buffer sequencing' },
  { token: 'atomisp', title: 'media: atomisp: fix input buffer queue underflow' },
  { token: 'camss', title: 'media: camss: add VFE hardware version for glymur' },
  { token: 'mtk-isp', title: 'media: mtk-isp: rework DIP frame job scheduling' },
  { token: 'mtk-cam', title: 'media: mtk-cam: fix seninf DMA buffer handling' },
  { token: 'uvcvideo', title: 'media: uvcvideo: fix control descriptor parsing' },
  // 2026-W31 갭 감사 실증: libcamera libipa AGC 43-patch RFC가 evidence 4로 watchlist 강등됐다.
  { token: 'libipa', title: '[RFC,v2,42/43] ipa: libipa: agc: Work without `CameraSensorHelper`' }
];

test('#805 componentFromText recognizes vendor ISP/V4L2 driver module names as component evidence', () => {
  for (const { token, title } of VENDOR_DRIVER_TITLES) {
    assert.ok(
      componentFromText(title, {}),
      `vendor driver token "${token}" should yield a non-empty api_or_component`
    );
  }
});

test('#805 dated vendor ISP driver patch escapes source_gap_risk (evidence_score 4 -> 6)', () => {
  const source = {
    id: 'lore-linux-media-list',
    name: 'lore.kernel.org linux-media list',
    category: 'linux-camera',
    sourceRole: 'project_mailing_list_source'
  };
  const raw = { sourceKind: 'rss_item', publishedAt: '2026-07-21' };
  const title = 'media: rkisp1: fix AGC gain calculation for low-light frames';
  const metadata = evidenceMetadata(raw, source, title, '', 40, false);

  assert.equal(metadata.has_api_or_component, true);
  assert.equal(metadata.evidence_score, 6);
  assert.equal(metadata.source_gap_risk, false);
  assert.equal(metadata.main_eligible, true);
});

test('#805 non-camera media/kernel candidates keep source_gap_risk (no scope leak)', () => {
  // 회귀 가드(#795): 비카메라 media(DVB 튜너 등)가 fallback 어휘로 evidence를 얻으면 안 된다.
  const source = {
    id: 'lore-linux-media-list',
    name: 'lore.kernel.org linux-media list',
    category: 'linux-camera',
    sourceRole: 'project_mailing_list_source'
  };
  const nonCameraTitles = [
    'media: dw2102: fix buffer overflow in DVB tuner',
    'net: tcp: fix congestion control window scaling'
  ];
  for (const title of nonCameraTitles) {
    assert.equal(componentFromText(title, {}), '', `"${title}" should not yield component evidence`);
    const metadata = evidenceMetadata({ sourceKind: 'rss_item', publishedAt: '2026-07-21' }, source, title, '', 40, false);
    assert.equal(metadata.evidence_score, 4);
    assert.equal(metadata.source_gap_risk, true);
    assert.equal(metadata.main_eligible, false);
  }
});
