const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEEP_DIVE_QUEUE_REL_PATH,
  loadDeepDiveTopicQueue,
  saveDeepDiveTopicQueue,
  accrueDeepDiveTopics,
  selectDeepDiveTopic,
  distinctFingerprintCount,
  markTopicBlocked,
  markTopicCovered
} = require('../../../collect/deep-dive-topic-queue');

function entry(overrides = {}) {
  return {
    topic_key: 'https://source.android.com/docs/compatibility/cts/its-release-notes-17#pass-star',
    title: 'PASS* 판정 상태',
    bucket: 'direct_aosp_camera',
    evidence: [{
      url: 'https://source.android.com/docs/compatibility/cts/its-release-notes-17#pass-star',
      excerpt: 'PASS* indicates a result near the threshold.',
      fingerprint: 'fp-1',
      effective_date: '2026-08-06',
      date_source: 'visible_last_updated',
      date_confidence: 85,
      origin: 'document_section'
    }],
    ...overrides
  };
}

test('같은 fingerprint 재적립은 멱등이다', () => {
  let result = accrueDeepDiveTopics({ schemaVersion: 1, topics: [] }, [entry()], { detectedAt: '2026-08-17' });
  result = accrueDeepDiveTopics(result.queue, [entry()], { detectedAt: '2026-08-17' });
  assert.equal(result.queue.topics.length, 1);
  assert.equal(distinctFingerprintCount(result.queue.topics[0]), 1);
  assert.equal(result.accruedFingerprintCount, 0);
});

test('적립 evidence는 detected_at과 effective_date를 구분해 보존한다', () => {
  const { queue } = accrueDeepDiveTopics({ schemaVersion: 1, topics: [] }, [entry()], { detectedAt: '2026-08-17' });
  const saved = queue.topics[0].evidence[0];
  assert.equal(saved.effective_date, '2026-08-06');
  assert.equal(saved.detected_at, '2026-08-17');
});

test('선정은 direct 버킷 → fingerprint 수 → 최신 effective_date → topic_key 순의 결정론이다', () => {
  const adjacent = entry({ topic_key: 'k-adjacent', bucket: 'android_platform_camera_adjacent' });
  const twoFingerprints = entry({ topic_key: 'k-two' });
  twoFingerprints.evidence = [
    { ...entry().evidence[0], fingerprint: 'fp-a' },
    { ...entry().evidence[0], fingerprint: 'fp-b' }
  ];
  const one = entry({ topic_key: 'k-one' });
  const { queue } = accrueDeepDiveTopics(
    { schemaVersion: 1, topics: [] },
    [adjacent, one, twoFingerprints],
    { detectedAt: '2026-08-17' }
  );
  assert.equal(selectDeepDiveTopic(queue).topic_key, 'k-two');
});

test('blocked 주제는 새 fingerprint 없이는 재선정되지 않는다', () => {
  let { queue } = accrueDeepDiveTopics({ schemaVersion: 1, topics: [] }, [entry()], { detectedAt: '2026-08-17' });
  queue = markTopicBlocked(queue, entry().topic_key, ['fp-1']);
  assert.equal(selectDeepDiveTopic(queue), null);
  assert.ok(queue.topics[0].attempted_evidence_set_hash);
  const fresh = entry();
  fresh.evidence = [{ ...fresh.evidence[0], fingerprint: 'fp-2' }];
  queue = accrueDeepDiveTopics(queue, [fresh], { detectedAt: '2026-08-24' }).queue;
  assert.equal(queue.topics[0].status, 'queued');
  assert.equal(queue.topics[0].attempted_evidence_set_hash, undefined);
});

test('covered 주제는 새 fingerprint 적립 시에만 queued로 돌아온다', () => {
  let { queue } = accrueDeepDiveTopics({ schemaVersion: 1, topics: [] }, [entry()], { detectedAt: '2026-08-17' });
  queue = markTopicCovered(queue, entry().topic_key, '2026-W34', ['fp-1']);
  assert.equal(queue.topics[0].status, 'covered');
  assert.equal(queue.topics[0].covered_in, '2026-W34');
  queue = accrueDeepDiveTopics(queue, [entry()], { detectedAt: '2026-08-24' }).queue;
  assert.equal(queue.topics[0].status, 'covered');
  const fresh = entry();
  fresh.evidence = [{ ...fresh.evidence[0], fingerprint: 'fp-2' }];
  queue = accrueDeepDiveTopics(queue, [fresh], { detectedAt: '2026-08-24' }).queue;
  assert.equal(queue.topics[0].status, 'queued');
});

test('큐 파일 손상은 조용히 빈 큐로 대체하지 않고 throw한다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-dive-queue-'));
  const filePath = path.join(root, ...DEEP_DIVE_QUEUE_REL_PATH.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '{broken json', 'utf8');
  assert.throws(() => loadDeepDiveTopicQueue(root), /deep-dive-topic-queue/);
});

test('load와 save는 왕복 보존이고 파일이 없으면 빈 큐다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-dive-queue-'));
  assert.deepEqual(loadDeepDiveTopicQueue(root), { schemaVersion: 1, topics: [] });
  const { queue } = accrueDeepDiveTopics({ schemaVersion: 1, topics: [] }, [entry()], { detectedAt: '2026-08-17' });
  saveDeepDiveTopicQueue(root, queue);
  assert.deepEqual(loadDeepDiveTopicQueue(root), queue);
});
