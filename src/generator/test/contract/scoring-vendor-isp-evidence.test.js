'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  hasConcreteApiComponent,
  noApiComponentPenalty
} = require('../../select/selection-candidate-scoring');

// #792: 분류기(aosp-camera-scope.js)는 벤더 ISP/V4L2 드라이버 모듈명을 camera_driver evidence로
// 인식하지만, 스코어러 hasConcreteApiComponent는 \bISP\b만 써서 이 토큰들을 놓쳤다. 그 결과 진짜
// 카메라 드라이버 기사가 evidence/actionability 상실 + noApiComponentPenalty 14점으로 main에서 탈락했다.
// 토큰 단일출처(STRONG_CAMERA_DRIVER_PATTERNS)를 스코어러가 재사용하면 이 벤더 항목들이 인식돼야 한다.

// 본문에 독립 "camera"/"image sensor"/standalone "ISP" 리터럴이 없고 api_or_component도 비어 있어,
// 벤더 드라이버 모듈명 자체가 유일한 카메라 evidence인 lore 패치 제목들.
const VENDOR_DRIVER_CANDIDATES = [
  { token: 'rkisp1', title: 'media: rkisp1: fix AGC gain calculation for low-light frames' },
  { token: 'rkisp2', title: 'media: rkisp2: correct statistics buffer sequencing' },
  { token: 'atomisp', title: 'media: atomisp: fix input buffer queue underflow' },
  { token: 'camss', title: 'media: camss: add VFE hardware version for glymur' },
  { token: 'mtk-isp', title: 'media: mtk-isp: rework DIP frame job scheduling' },
  { token: 'uvcvideo', title: 'media: uvcvideo: fix control descriptor parsing' }
];

test('#792 hasConcreteApiComponent recognizes vendor ISP/V4L2 driver module names as camera evidence', () => {
  for (const { token, title } of VENDOR_DRIVER_CANDIDATES) {
    const candidate = { title, summary: '' };
    assert.equal(
      hasConcreteApiComponent(candidate),
      true,
      `vendor driver token "${token}" should count as a concrete API/component`
    );
  }
});

test('#792 vendor ISP driver candidate escapes the no-API-component penalty', () => {
  const candidate = { title: 'media: rkisp1: fix AGC gain calculation for low-light frames', summary: '' };
  assert.equal(noApiComponentPenalty(candidate), 0);
});

test('#792 non-camera media/kernel candidates still have no concrete camera API component', () => {
  // 회귀 가드: 벤더 카메라 토큰이 아닌 항목은 인식되면 안 된다(스코프 과확장 방지).
  const nonCamera = [
    { title: 'net: tcp: fix congestion control window scaling' },
    { title: 'media: dvb: fix demux buffer overrun in tuner reset' }
  ];
  for (const candidate of nonCamera) {
    assert.equal(
      hasConcreteApiComponent(candidate),
      false,
      `"${candidate.title}" should not be treated as a concrete camera API/component`
    );
  }
});
