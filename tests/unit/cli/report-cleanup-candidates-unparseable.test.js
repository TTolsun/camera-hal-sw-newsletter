'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('path');

const {
  UNPARSEABLE_REQUIRE_PATTERNS,
  UNPARSEABLE_EXPORT_PATTERNS,
  findUnparseableReasons,
} = require(path.resolve(__dirname, '../../../scripts/newsroom/cli/report-cleanup-candidates.js'));

// UNPARSEABLE_REQUIRE_PATTERNS — 백틱 제거 회귀(PR #449) 방지
test('template literal require는 동적 require로 탐지되어야 한다', () => {
  const reasons = findUnparseableReasons('require(`tmpl`)', UNPARSEABLE_REQUIRE_PATTERNS);
  assert.equal(reasons.length, 1);
});

test('변수 require는 동적 require로 탐지되어야 한다', () => {
  const reasons = findUnparseableReasons('require(variable)', UNPARSEABLE_REQUIRE_PATTERNS);
  assert.equal(reasons.length, 1);
});

test('정적 단일따옴표 require는 동적 require로 탐지되지 않아야 한다', () => {
  const reasons = findUnparseableReasons("require('./path')", UNPARSEABLE_REQUIRE_PATTERNS);
  assert.equal(reasons.length, 0);
});

test('정적 이중따옴표 require는 동적 require로 탐지되지 않아야 한다', () => {
  const reasons = findUnparseableReasons('require("./path")', UNPARSEABLE_REQUIRE_PATTERNS);
  assert.equal(reasons.length, 0);
});

// UNPARSEABLE_EXPORT_PATTERNS — spot check
test('Object.assign(module.exports, ...) 는 unparseable export로 탐지되어야 한다', () => {
  const reasons = findUnparseableReasons('Object.assign(module.exports, extra)', UNPARSEABLE_EXPORT_PATTERNS);
  assert.equal(reasons.length, 1);
});

test('module.exports[key] = ... 는 unparseable export로 탐지되어야 한다', () => {
  const reasons = findUnparseableReasons('module.exports[key] = value;', UNPARSEABLE_EXPORT_PATTERNS);
  assert.equal(reasons.length, 1);
});
