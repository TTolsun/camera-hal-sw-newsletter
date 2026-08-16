const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runWeeklyDeepDive, weeklyDeepDiveTrigger } = require('../../../render/weekly-deep-dive');
const { accrueDeepDiveTopics, saveDeepDiveTopicQueue, DEEP_DIVE_QUEUE_REL_PATH } = require('../../../../shared/collect/deep-dive-topic-queue');

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-deep-dive-'));
}

function readReport(root, date) {
  return JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'deep-dive-report.json'), 'utf8'));
}

const DIRECT = { final_relevance_bucket: 'direct_aosp_camera' };
const DRIVER = { final_relevance_bucket: 'camera_driver_image_pipeline' };

test('발동 판정은 위클리 최종 기사의 direct_aosp_camera 수 기준이다', () => {
  assert.equal(weeklyDeepDiveTrigger([DRIVER, DRIVER, DRIVER]).activated, true);
  assert.equal(weeklyDeepDiveTrigger([DIRECT]).activated, true);
  assert.equal(weeklyDeepDiveTrigger([DIRECT, DIRECT]).activated, false);
});

test('미발동 주는 not_activated report를 남긴다', () => {
  const root = makeRoot();
  const report = runWeeklyDeepDive({ root, date: '2026-08-17', articles: [DIRECT, DIRECT] });
  assert.equal(report.status, 'skipped');
  assert.equal(report.skip_reason, 'not_activated');
  assert.equal(readReport(root, '2026-08-17').activated, false);
});

test('발동 + 빈 큐는 queue_empty, 발동 + 큐 있음은 shadow_selected다', () => {
  const root = makeRoot();
  const empty = runWeeklyDeepDive({ root, date: '2026-08-17', articles: [DRIVER] });
  assert.equal(empty.skip_reason, 'queue_empty');

  const { queue } = accrueDeepDiveTopics({ schemaVersion: 1, topics: [] }, [{
    topic_key: 'https://example.com/topic',
    title: 'topic',
    bucket: 'direct_aosp_camera',
    evidence: [{ url: 'https://example.com/topic', excerpt: 'x', fingerprint: 'fp', effective_date: '2026-08-10', date_source: 'visible_last_updated', date_confidence: 85, origin: 'monitor_event' }]
  }], { detectedAt: '2026-08-17' });
  saveDeepDiveTopicQueue(root, queue);
  const selected = runWeeklyDeepDive({ root, date: '2026-08-17', articles: [DRIVER] });
  assert.equal(selected.status, 'shadow_selected');
  assert.equal(selected.selected_topic_key, 'https://example.com/topic');
  assert.equal(readReport(root, '2026-08-17').status, 'shadow_selected');
});

test('큐 손상은 error report를 남기고 다시 throw한다', () => {
  const root = makeRoot();
  const filePath = path.join(root, ...DEEP_DIVE_QUEUE_REL_PATH.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '{broken', 'utf8');
  assert.throws(() => runWeeklyDeepDive({ root, date: '2026-08-17', articles: [DRIVER] }), /deep-dive-topic-queue/);
  assert.equal(readReport(root, '2026-08-17').status, 'error');
});
