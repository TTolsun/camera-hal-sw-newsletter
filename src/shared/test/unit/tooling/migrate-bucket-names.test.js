const assert = require('node:assert/strict');
const test = require('node:test');

const { walk, alignEditorialPriority, BUCKET_KEYS, LEGACY_TO_NEW } = require('../../../tooling/cli/migrate-bucket-names');

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

test('저장된 editorial_priority 를 지금 사다리에 맞춘다', () => {
  // 드라이버는 2 에서 5 로 내려갔다. 저장된 2 를 그대로 두면 newsletter-quality 가
  // 사다리 기본값보다 저장값을 우선하므로 강등이 기존 후보에 안 먹는다.
  const { value, changed } = walk({
    relevance_bucket: 'camera_driver_image_pipeline',
    editorial_priority: 2
  });
  assert.equal(changed, 1);
  assert.equal(value.editorial_priority, 5);
});

test('옛 버킷 이름과 순위를 한 번에 옮긴다', () => {
  // 자식을 먼저 돌므로 순위를 볼 때 relevance_bucket 은 이미 새 이름이다.
  const { value, changed } = walk({
    relevance_bucket: 'soc_platform_signal',
    editorial_priority: 4
  });
  assert.equal(value.relevance_bucket, 'android');
  assert.equal(value.editorial_priority, 3);
  assert.equal(changed, 2);
});

test('이미 맞는 순위는 건드리지 않는다', () => {
  const { changed } = walk({ relevance_bucket: 'direct_aosp_camera', editorial_priority: 1 });
  assert.equal(changed, 0);
});

test('판단 근거가 없으면 순위를 그대로 둔다', () => {
  // 사다리에 없는 버킷, 버킷이 아예 없는 객체, 숫자가 아닌 값은 고칠 근거가 없다.
  assert.equal(alignEditorialPriority({ relevance_bucket: 'unknown_bucket', editorial_priority: 2 }), 0);
  assert.equal(alignEditorialPriority({ editorial_priority: 2 }), 0);
  assert.equal(alignEditorialPriority({ relevance_bucket: 'camera_driver_image_pipeline', editorial_priority: null }), 0);
});

test('순위 보정을 끄면 이름만 바꾼다', () => {
  // 지난 실행의 기록(newsroom·발행된 issue)에는 이름만 옮기고 순위는 그대로 둔다.
  const { value, changed } = walk({
    relevance_bucket: 'soc_platform_signal',
    editorial_priority: 4
  }, '', false);
  assert.equal(value.relevance_bucket, 'android');
  assert.equal(value.editorial_priority, 4);
  assert.equal(changed, 1);
});
