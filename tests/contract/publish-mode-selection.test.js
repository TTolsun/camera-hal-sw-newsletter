'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildShortlistReport } = require('../../scripts/newsroom/generate/newsroom-selection');
const { PUBLISH_MODES } = require('../../scripts/newsroom/generate/publish-mode');

// 빈 후보 풀 → 발행 신호 없음 → QUIET
test('empty candidate pool resolves to QUIET publish mode', () => {
  const report = buildShortlistReport('2026-05-31', { candidates: [] });
  assert.equal(report.publish_mode, PUBLISH_MODES.QUIET);
  assert.ok(report.publish_mode_detail);
  assert.equal(report.publish_mode_detail.core_count, 0);
});
