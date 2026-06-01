'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildShortlistReport } = require('../../scripts/newsroom/generate/newsroom-selection');
const { PUBLISH_MODES } = require('../../scripts/newsroom/generate/publish-mode');
const { emptyHeadlineState } = require('../../scripts/newsroom/common/homepage-headline');

// 빈 후보 풀 → 발행 신호 없음 → QUIET
// emptyHeadlineState 를 주입해 디스크의 직전 헤드라인 상태가 빈 선택을 오염시키지 않도록 한다.
test('empty candidate pool resolves to QUIET publish mode', () => {
  const date = '2026-05-31';
  const report = buildShortlistReport(date, { candidates: [] }, {
    homepageHeadlineState: emptyHeadlineState({ date })
  });
  assert.equal(report.publish_mode, PUBLISH_MODES.QUIET);
  assert.ok(report.publish_mode_detail);
  assert.equal(report.publish_mode_detail.core_count, 0);
});
