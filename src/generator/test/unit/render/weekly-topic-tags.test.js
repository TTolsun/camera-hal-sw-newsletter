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
