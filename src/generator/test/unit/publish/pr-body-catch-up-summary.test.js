'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { renderCatchUpSummary } = require('../../../publish/pr-body-diagnostic-sections');

// release-class 레인(#825)은 fresh 선정이 목표를 채운 주에도 발동하므로, PR 본문의
// catch-up 요약이 그런 주에 "fresh 기사가 부족해"라고 거짓 진술하면 안 된다.
// 사람 리뷰 산출물의 진실성은 이 저장소 발행 안전 모델의 전제다.

function writeShortlistReport(report) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catch-up-summary-'));
  const date = '2026-07-27';
  const dir = path.join(root, 'articles', 'content', 'newsroom', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'shortlisted-candidates.json'), JSON.stringify(report), 'utf8');
  return { root, date };
}

test('legacy reports without catch_up_lane keep the thin-week sentence (backwards compatible)', () => {
  const { root, date } = writeShortlistReport({
    catch_up_used_count: 2,
    catch_up_articles: [
      { title: 'CameraX 1.6.0', url: 'https://example.com/a', catch_up_age_days: 24 },
      { title: 'Camera HAL AIDL v3', url: 'https://example.com/b', catch_up_age_days: 29 }
    ]
  });
  const summary = renderCatchUpSummary(root, date);
  assert.ok(summary.includes('fresh 기사가 부족해 2건'), '과거 리포트는 기존 thin-week 문구를 유지해야 한다');
  assert.ok(!summary.includes('릴리스 캐치업'));
});

test('a release-class-only week does not claim fresh articles were insufficient', () => {
  const { root, date } = writeShortlistReport({
    catch_up_used_count: 1,
    catch_up_articles: [
      { title: 'v0.7.2', url: 'https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2', catch_up_age_days: 17, catch_up_lane: 'release_class' }
    ]
  });
  const summary = renderCatchUpSummary(root, date);
  assert.ok(!summary.includes('부족해'), 'release-class만 승격된 주에 fresh 부족 문구를 쓰면 안 된다');
  assert.ok(summary.includes('릴리스 캐치업(release-class) 레인이 신선도 창을 놓친 미게재 릴리스 1건'));
  assert.ok(summary.includes('v0.7.2'));
});

test('mixed lanes report each lane with its own count', () => {
  const { root, date } = writeShortlistReport({
    catch_up_used_count: 2,
    catch_up_articles: [
      { title: 'CameraX 1.6.0', url: 'https://example.com/a', catch_up_age_days: 24, catch_up_lane: 'fill_open_slots' },
      { title: 'v0.7.2', url: 'https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2', catch_up_age_days: 17, catch_up_lane: 'release_class' }
    ]
  });
  const summary = renderCatchUpSummary(root, date);
  assert.ok(summary.includes('fresh 기사가 부족해 1건'));
  assert.ok(summary.includes('미게재 릴리스 1건'));
});
