const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runWeeklyDeepDive, weeklyDeepDiveTrigger } = require('../../../render/weekly-deep-dive');
const { accrueDeepDiveTopics, saveDeepDiveTopicQueue, DEEP_DIVE_QUEUE_REL_PATH } = require('../../../../shared/collect/deep-dive-topic-queue');
const { loadNewsletterPolicy, readPolicyConfig } = require('../../../../shared/common/newsletter-policy');

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-deep-dive-'));
}

function policyWithActivationMax(max) {
  const config = JSON.parse(JSON.stringify(readPolicyConfig()));
  config.deepDivePolicy = { directAospCameraMaxForActivation: max };
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'deep-dive-policy-')), 'newsletter-policy.json');
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return loadNewsletterPolicy(filePath);
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

// 임계값의 정본은 newsletter-policy.json이다. 여기에 숫자를 다시 적어 두면 정책 파일을 바꿔도
// 동작이 따라오지 않고, 생성 블록(문서)만 새 값으로 갱신돼 코드와 문서가 조용히 갈라진다.
test('발동 임계값은 newsletter-policy.json의 deepDivePolicy 값을 따른다', () => {
  const relaxed = policyWithActivationMax(2);

  assert.equal(weeklyDeepDiveTrigger([DIRECT, DIRECT]).activated, false);
  assert.equal(weeklyDeepDiveTrigger([DIRECT, DIRECT], relaxed).activated, true);
  assert.equal(weeklyDeepDiveTrigger([DIRECT, DIRECT, DIRECT], relaxed).activated, false);
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

// queue_size·accrued_this_week는 shadow 단계의 유일한 관측 출력이다. 단언이 없으면 두 값이
// 항상 0으로 나가도 아무 테스트가 깨지지 않아, 관찰 기간 내내 잘못된 수치를 보게 된다.
test('shadow report는 큐 크기와 이번 실행 적립 수를 기록한다', () => {
  const root = makeRoot();
  const evidence = (fingerprint, detectedAt) => ({
    topic_key: `https://example.com/${fingerprint}`,
    title: fingerprint,
    bucket: 'direct_aosp_camera',
    evidence: [{
      url: `https://example.com/${fingerprint}`,
      excerpt: 'x',
      fingerprint,
      effective_date: '2026-08-10',
      date_source: 'visible_last_updated',
      date_confidence: 85,
      origin: 'monitor_event'
    }],
    detectedAt
  });
  // 지난 주에 쌓인 주제 하나 + 이번 실행 날짜로 쌓인 주제 하나.
  let queue = accrueDeepDiveTopics({ schemaVersion: 1, topics: [] }, [evidence('old')], { detectedAt: '2026-08-10' }).queue;
  queue = accrueDeepDiveTopics(queue, [evidence('fresh')], { detectedAt: '2026-08-17' }).queue;
  saveDeepDiveTopicQueue(root, queue);

  const report = runWeeklyDeepDive({ root, date: '2026-08-17', articles: [DRIVER] });

  assert.equal(report.queue_size, 2);
  assert.equal(report.accrued_this_week, 1);
  assert.equal(readReport(root, '2026-08-17').accrued_this_week, 1);
});

test('큐 손상은 error report를 남기고 다시 throw한다', () => {
  const root = makeRoot();
  const filePath = path.join(root, ...DEEP_DIVE_QUEUE_REL_PATH.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '{broken', 'utf8');
  assert.throws(() => runWeeklyDeepDive({ root, date: '2026-08-17', articles: [DRIVER] }), /deep-dive-topic-queue/);
  assert.equal(readReport(root, '2026-08-17').status, 'error');
});
