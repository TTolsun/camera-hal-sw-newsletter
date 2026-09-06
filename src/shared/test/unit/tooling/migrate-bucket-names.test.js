const assert = require('node:assert/strict');
const test = require('node:test');

const { walk, BUCKET_KEYS, LEGACY_TO_NEW } = require('../../../tooling/cli/migrate-bucket-names');

test('버킷 값을 담는 키만 바꾼다', () => {
  const { value, changed } = walk({
    relevance_bucket: 'soc_platform_signal',
    aosp_camera_stack_bucket: 'android_multimedia_camera_output',
    relevanceBucketHint: 'android_platform_camera_adjacent'
  });

  assert.equal(changed, 3);
  assert.equal(value.relevance_bucket, 'android');
  assert.equal(value.aosp_camera_stack_bucket, 'android');
  assert.equal(value.relevanceBucketHint, 'android');
});

test('필드 이름은 건드리지 않는다', () => {
  // soc_platform_relevance / android_multimedia_camera_output_count 는 그대로 살아 있는
  // 신호다. 버킷 이름만 합쳐졌지 근거가 사라진 것이 아니다.
  const input = {
    soc_platform_relevance: 3,
    multimedia_camera_output_relevance: 5,
    android_multimedia_camera_output_count: 2,
    soc_platform_signal_count: 1
  };
  const { value, changed } = walk(input);

  assert.equal(changed, 0);
  assert.deepEqual(value, input);
});

test('버킷 키가 아닌 곳의 같은 단어는 남긴다', () => {
  // 산문과 URL 에 같은 문자열이 있을 수 있다. 값만 보고 바꾸면 본문이 손상된다.
  const { value, changed } = walk({
    summary: 'soc_platform_signal 버킷이 사라졌습니다.',
    url: 'https://example.test/soc_platform_signal',
    count_reason: 'android_multimedia_camera_output counts toward supporting.'
  });

  assert.equal(changed, 0);
  assert.match(value.summary, /soc_platform_signal/);
  assert.match(value.url, /soc_platform_signal/);
});

test('중첩 배열과 객체를 끝까지 훑는다', () => {
  const { value, changed } = walk({
    weeks: [{ sections: [{ relevance_bucket: 'soc_platform_signal' }] }]
  });

  assert.equal(changed, 1);
  assert.equal(value.weeks[0].sections[0].relevance_bucket, 'android');
});

test('모르는 버킷 값은 그대로 둔다', () => {
  const { value, changed } = walk({ relevance_bucket: 'direct_aosp_camera' });
  assert.equal(changed, 0);
  assert.equal(value.relevance_bucket, 'direct_aosp_camera');
});

test('옛 이름 세 개가 모두 android 로 간다', () => {
  assert.deepEqual([...LEGACY_TO_NEW.values()], ['android', 'android', 'android']);
  assert.ok(BUCKET_KEYS.has('relevance_bucket'));
  // 넓은 키를 무심코 추가하면 커밋된 아티팩트가 조용히 손상된다.
  assert.ok(!BUCKET_KEYS.has('name'));
  assert.ok(!BUCKET_KEYS.has('title'));
});
