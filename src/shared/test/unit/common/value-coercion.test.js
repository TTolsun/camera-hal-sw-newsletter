'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ensureArray,
  isTrue,
  isFalse
} = require('../../../common/value-coercion');

// #650 — isTrue/isFalse 불리언 강제 헬퍼를 value-coercion으로 단일화.
// 발행 상태 분류가 같은 강제 로직을 여러 파일에서 복제하던 것을 정본 한 곳으로 모은다.
// 직렬화된 'true'/'false' 문자열과 실제 boolean을 동일하게 다뤄야 한다(generation-status.json 호환).

test('isTrue: boolean true와 문자열 "true"만 참이다', () => {
  assert.equal(isTrue(true), true);
  assert.equal(isTrue('true'), true);
  assert.equal(isTrue(false), false);
  assert.equal(isTrue('false'), false);
  assert.equal(isTrue(undefined), false);
  assert.equal(isTrue(null), false);
  assert.equal(isTrue(1), false);
  assert.equal(isTrue('TRUE'), false);
});

test('isFalse: boolean false와 문자열 "false"만 참이다', () => {
  assert.equal(isFalse(false), true);
  assert.equal(isFalse('false'), true);
  assert.equal(isFalse(true), false);
  assert.equal(isFalse('true'), false);
  assert.equal(isFalse(undefined), false);
  assert.equal(isFalse(null), false);
  assert.equal(isFalse(0), false);
});

test('isTrue/isFalse는 서로의 부정이 아니다 — 미지정 값은 둘 다 거짓', () => {
  assert.equal(isTrue(undefined), false);
  assert.equal(isFalse(undefined), false);
});

test('ensureArray: 비배열은 빈 배열로 떨어뜨린다', () => {
  assert.deepEqual(ensureArray([1, 2]), [1, 2]);
  assert.deepEqual(ensureArray('x'), []);
  assert.deepEqual(ensureArray(undefined), []);
  assert.deepEqual(ensureArray(null), []);
});
