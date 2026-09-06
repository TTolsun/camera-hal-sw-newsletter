'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const RULES = require('../../../generator/quality/section-scope-fallback-rules');
const { BUCKET_PRIORITY } = require('../../domain/aosp-camera-scope');

test('폴백 규칙의 순위는 사다리와 어긋나지 않는다', () => {
  // 예전에는 이 값들을 손으로 적어 두어, 드라이버가 2 에서 5 로 내려간 뒤에도 2 였다.
  for (const rule of RULES) {
    assert.equal(
      rule.scope.editorial_priority,
      BUCKET_PRIORITY[rule.scope.relevance_bucket],
      rule.scope.relevance_bucket
    );
  }
});

test('규칙이 다루는 버킷은 전부 사다리에 있다', () => {
  for (const rule of RULES) {
    assert.ok(BUCKET_PRIORITY[rule.scope.relevance_bucket], rule.scope.relevance_bucket);
  }
});
