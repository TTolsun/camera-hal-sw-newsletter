'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { weeklyTopicTags } = require('../../../render/newsletter-renderer');

function article(relevanceBucket, extra = {}) {
  return { relevance_bucket: relevanceBucket, ...extra };
}

test('a week with only driver articles gets no Camera HAL or Android tag', () => {
  const tags = weeklyTopicTags([article('camera_driver_image_pipeline'), article('camera_driver_image_pipeline')]);

  assert.deepEqual(tags, ['Driver', 'Image Processing']);
});

test('a direct Android camera article adds Camera HAL, and only that article does', () => {
  const tags = weeklyTopicTags([article('camera_driver_image_pipeline'), article('direct_aosp_camera')]);

  assert.deepEqual(tags, ['Driver', 'Image Processing', 'Camera HAL']);
});

test('an android bucket article adds Android only when it is not an SoC platform article', () => {
  assert.deepEqual(weeklyTopicTags([article('android')]), ['Android']);
  assert.deepEqual(weeklyTopicTags([article('android', { counts_as_soc_topic: false })]), ['Android']);
});

test('an android bucket article that counts as an SoC topic adds SoC Platform instead of Android', () => {
  const tags = weeklyTopicTags([article('android', { counts_as_soc_topic: true })]);

  assert.deepEqual(tags, ['SoC Platform']);
});

test('the SoC flag only matters inside the android bucket', () => {
  assert.deepEqual(weeklyTopicTags([article('direct_aosp_camera', { counts_as_soc_topic: true })]), ['Camera HAL']);
  assert.deepEqual(weeklyTopicTags([article('camera_driver_image_pipeline', { counts_as_soc_topic: true })]), ['Driver', 'Image Processing']);
});

test('the combined C++ and AI bucket splits by the article own is_ai_related flag', () => {
  assert.deepEqual(weeklyTopicTags([article('cpp_ai_tooling_fallback', { is_ai_related: false })]), ['C++']);
  assert.deepEqual(weeklyTopicTags([article('cpp_ai_tooling_fallback', { is_ai_related: true })]), ['AI']);
});

test('a combined bucket article without the flag keeps the earlier AI classification', () => {
  assert.deepEqual(weeklyTopicTags([article('cpp_ai_tooling_fallback')]), ['AI']);
});

test('the watchlist bucket, an empty bucket and an unknown bucket add no topic', () => {
  assert.deepEqual(weeklyTopicTags([article('generic_tech_watchlist'), article(''), article('주간 다이제스트')]), []);
});

test('the lead article topic comes first so it stays the card kicker, and topics are deduplicated', () => {
  const tags = weeklyTopicTags([
    article('cpp_ai_tooling_fallback', { is_ai_related: false }),
    article('camera_driver_image_pipeline'),
    article('cpp_ai_tooling_fallback', { is_ai_related: false })
  ]);

  assert.deepEqual(tags, ['C++', 'Driver', 'Image Processing']);
});

test('legacy bucket names fold into the android bucket before topics are chosen', () => {
  // soc_platform_signal 은 bucket 통합 이후 읽기 경로에서만 남는 옛 이름이다.
  assert.deepEqual(weeklyTopicTags([article('soc_platform_signal', { counts_as_soc_topic: true })]), ['SoC Platform']);
  assert.deepEqual(weeklyTopicTags([article('android_multimedia_camera_output')]), ['Android']);
});

test('a driver article about an SoC camera block also gets SoC Platform', () => {
  // Qualcomm CAMSS 는 SoC 카메라 서브시스템이라 Driver 와 SoC Platform 에 함께 해당한다. (#1250)
  const camss = article('camera_driver_image_pipeline', { headline: 'Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개' });
  const platformDts = article('camera_driver_image_pipeline', { headline: 'Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개' });

  assert.deepEqual(weeklyTopicTags([camss]), ['Driver', 'Image Processing', 'SoC Platform']);
  assert.deepEqual(weeklyTopicTags([platformDts]), ['Driver', 'Image Processing', 'SoC Platform']);
});

test('an external sensor driver article stays Driver only, even from a company that also makes SoCs', () => {
  for (const headline of [
    'Samsung S5KJN5 50MP 이미지 센서 지원을 위한 독립형 V4L2 드라이버 패치 제안',
    'Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2)',
    'libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가'
  ]) {
    assert.deepEqual(weeklyTopicTags([article('camera_driver_image_pipeline', { headline })]), ['Driver', 'Image Processing'], headline);
  }
});

test('the SoC camera block title rule only applies to driver articles', () => {
  const headline = 'Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개';

  assert.deepEqual(weeklyTopicTags([article('direct_aosp_camera', { headline })]), ['Camera HAL']);
  assert.deepEqual(weeklyTopicTags([article('android', { headline })]), ['Android']);
});

test('a watchlist article whose title is about a C++ toolchain is filed under C++', () => {
  for (const headline of [
    'Tooling Watch: GCC 16.1 released: C++26 reflection / contracts / safety',
    'C++26 assert(): Camera HAL debug-build 검토 범위',
    'Tooling Watch: Glaze 7.2 - C++26 Reflection | YAML, CBOR, MessagePack'
  ]) {
    assert.deepEqual(weeklyTopicTags([article('generic_tech_watchlist', { headline })]), ['C++'], headline);
  }
});

test('a watchlist article gets no C++ tag when it is an AI article or its title is not about C++', () => {
  assert.deepEqual(weeklyTopicTags([article('generic_tech_watchlist', { headline: 'Clang 기반 AI 코딩 도구', is_ai_related: true })]), []);
  assert.deepEqual(weeklyTopicTags([article('generic_tech_watchlist', { headline: 'Kotlin 2.3 릴리스', what_changed: 'C++ interop 개선' })]), []);
});
