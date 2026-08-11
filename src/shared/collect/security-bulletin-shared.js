// 보안 게시판 리졸버(Android / MediaTek)가 함께 쓰는 카메라 판정 어휘·심각도 등급·HTML 정리
// 헬퍼의 단일 출처. 게시판마다 표 구조는 다르지만 "무엇을 카메라로 볼 것인가"와 "어느 심각도부터
// 실을 것인가"는 같은 기준이어야 한다. 두 모듈에 각자 두면 한쪽만 고쳐도 다른 쪽 수집 결과가
// 말없이 달라지므로 여기 한 곳에만 둔다.
//
// 주의: 어휘는 공유하지만 **패턴에 먹이는 필드는 리졸버마다 다르다**. Android는
// section/component/type/References href를, MediaTek은 subcomponent/CWE/description을 넣는다.
// 그래서 토큰을 하나 추가해도 한쪽에서만 발동할 수 있다 — 새 토큰을 넣을 땐 두 리졸버 각각의
// 입력 필드에 그 토큰이 실제로 나타나는지 확인할 것.
const { decodeHtml } = require('../common/common');

const MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]);

const SEVERITY_RANK = Object.freeze({ critical: 4, high: 3, moderate: 2, medium: 2, low: 1 });

// 미디어+카메라 핵심: Media framework, Camera service/HAL, V4L2/media 커널, 벤더 camera/ISP.
// 실제 게시판의 벤더/커널 섹션은 카메라 신호를 코드네임(camss/camx/csiphy 등)으로만 표기하므로 함께 본다.
// dng_sdk/libpng/libjpeg/RAW는 촬영한 RAW를 DNG로 저장하거나 썸네일/EXIF 이미지를 디코딩하는
// 카메라 출력 처리 라이브러리라 함께 본다. (bare "dng"는 무관 텍스트 오탐이 커서 제외하고
// 라이브러리명 dng_sdk/libdng로 한정한다.)
// imgsensor/imgsys는 MediaTek 게시판이 쓰는 카메라 센서·이미징 서브시스템 컴포넌트 이름이다
// (2026-03~2026-08 게시판 24개 서브컴포넌트 전수 확인: 카메라 계열은 이 둘뿐).
const CAMERA_MEDIA_PATTERN =
  /\b(?:camera|camera2|cameraserver|camera\s*hal|isp|image\s*sensor|imgsensor|imgsys|v4l2|video4linux|camss|camx|csiphy|csid|cam[_-]\w+|drivers\/media|media\s*framework|libstagefright|stagefright|mediacodec|mediaprovider|mediaserver|media\s*codec|dng_sdk|libdng|libpng|libjpeg(?:-turbo)?|camera\s*raw|raw\s+image)\b/i;

const CVE_PATTERN = /CVE-\d{4}-\d{4,}/i;

function cleanHtmlText(html = '') {
  const stripped = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');
  return decodeHtml(stripped).replace(/\s+/g, ' ').trim();
}

function severityRank(value) {
  return SEVERITY_RANK[String(value || '').trim().toLowerCase()] || 0;
}

/**
 * 게시판에 실을 심각도 하한. 값이 없거나 모르는 등급이면 moderate로 떨어진다.
 */
function minimumSeverityRank(value) {
  return severityRank(value) || SEVERITY_RANK.moderate;
}

module.exports = {
  CAMERA_MEDIA_PATTERN,
  CVE_PATTERN,
  MONTH_NAMES,
  cleanHtmlText,
  minimumSeverityRank,
  severityRank
};
