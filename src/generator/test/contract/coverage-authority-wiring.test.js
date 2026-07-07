'use strict';

// #724: coverage 권한 배선의 순수 결정 지점을 고정한다. ON일 때만 editorial-plan이
// reserve 포함 shortlisted view를 받아 승급 후보를 볼 수 있고, OFF는 현행(selected)과 동일.
const assert = require('node:assert/strict');
const test = require('node:test');

const { editorialPlanCapsuleView } = require('../../publish/orchestrator-editorial-plan-stage');

test('editorial-plan uses shortlisted capsule view only when coverage authority is on', () => {
  assert.equal(editorialPlanCapsuleView(true), 'shortlisted');
  assert.equal(editorialPlanCapsuleView(false), 'selected');
  assert.equal(editorialPlanCapsuleView(undefined), 'selected');
});
