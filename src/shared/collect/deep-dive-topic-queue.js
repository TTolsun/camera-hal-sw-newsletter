// 심층(deep-dive) 주제 큐. 파이프라인이 main으로 못 실은 Android 카메라 신호를 적립해 두고,
// 조용한 주(direct_aosp_camera ≤ 1)에 심층 기사 주제로 소비한다.
// 계약(스펙 .tmp/codex/deep-dive-section-design.md):
// - 적립 쓰기는 01(collect), 상태 전환 쓰기는 03(generator) — 단계별 단일 작성자.
// - accrual_count는 저장하지 않는다. distinct fingerprint 수로 읽는 시점에 계산한다.
// - 파일 손상은 빈 큐로 대체하지 않고 throw한다 — 구현 오류를 콘텐츠 실패로 위장하지 않는다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEEP_DIVE_QUEUE_REL_PATH = 'state/deep-dive-topic-queue.json';

function queueFilePath(root) {
  return path.join(root, ...DEEP_DIVE_QUEUE_REL_PATH.split('/'));
}

function loadDeepDiveTopicQueue(root) {
  const filePath = queueFilePath(root);
  if (!fs.existsSync(filePath)) return { schemaVersion: 1, topics: [] };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`deep-dive-topic-queue 파일이 손상됐습니다(${DEEP_DIVE_QUEUE_REL_PATH}): ${error.message}`);
  }
  if (!parsed || !Array.isArray(parsed.topics)) {
    throw new Error(`deep-dive-topic-queue 스키마가 아닙니다(${DEEP_DIVE_QUEUE_REL_PATH}): topics 배열이 없습니다.`);
  }
  return parsed;
}

function saveDeepDiveTopicQueue(root, queue) {
  const filePath = queueFilePath(root);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
}

function distinctFingerprintCount(topic) {
  return new Set((topic?.evidence || []).map(item => item.fingerprint).filter(Boolean)).size;
}

function evidenceSetHash(fingerprints) {
  return crypto.createHash('sha256').update([...fingerprints].sort().join('\n')).digest('hex').slice(0, 16);
}

function accrueDeepDiveTopics(queue, entries, { detectedAt }) {
  const topics = queue.topics.map(topic => ({ ...topic, evidence: [...topic.evidence] }));
  const byKey = new Map(topics.map(topic => [topic.topic_key, topic]));
  let accruedFingerprintCount = 0;
  for (const entry of entries || []) {
    if (!entry || !entry.topic_key || !Array.isArray(entry.evidence)) continue;
    let topic = byKey.get(entry.topic_key);
    if (!topic) {
      topic = { topic_key: entry.topic_key, title: entry.title || '', bucket: entry.bucket || '', status: 'queued', evidence: [] };
      topics.push(topic);
      byKey.set(entry.topic_key, topic);
    }
    const known = new Set(topic.evidence.map(item => item.fingerprint));
    let appended = false;
    for (const item of entry.evidence) {
      if (!item || !item.fingerprint || known.has(item.fingerprint)) continue;
      known.add(item.fingerprint);
      topic.evidence.push({ ...item, detected_at: detectedAt });
      accruedFingerprintCount += 1;
      appended = true;
    }
    // 재활성화: blocked/covered 주제에 새 fingerprint가 붙으면 queued로 돌아온다(반복 방지의 핵심).
    if (appended && topic.status !== 'queued') {
      topic.status = 'queued';
      delete topic.attempted_evidence_set_hash;
    }
  }
  return { queue: { ...queue, topics }, accruedFingerprintCount };
}

function latestEffectiveDate(topic) {
  return (topic.evidence || []).map(item => item.effective_date || '').sort().at(-1) || '';
}

function selectDeepDiveTopic(queue) {
  const queued = (queue.topics || []).filter(topic => topic.status === 'queued');
  if (queued.length === 0) return null;
  return [...queued].sort((a, b) =>
    ((a.bucket === 'direct_aosp_camera' ? 0 : 1) - (b.bucket === 'direct_aosp_camera' ? 0 : 1)) ||
    (distinctFingerprintCount(b) - distinctFingerprintCount(a)) ||
    latestEffectiveDate(b).localeCompare(latestEffectiveDate(a)) ||
    a.topic_key.localeCompare(b.topic_key)
  )[0];
}

function updateTopic(queue, topicKey, updater) {
  return {
    ...queue,
    topics: queue.topics.map(topic => (topic.topic_key === topicKey ? updater({ ...topic }) : topic))
  };
}

function markTopicBlocked(queue, topicKey, usedFingerprints) {
  return updateTopic(queue, topicKey, topic => {
    topic.status = 'blocked_until_new_evidence';
    topic.attempted_evidence_set_hash = evidenceSetHash(usedFingerprints);
    return topic;
  });
}

function markTopicCovered(queue, topicKey, weeklyKey, usedFingerprints) {
  return updateTopic(queue, topicKey, topic => {
    topic.status = 'covered';
    topic.covered_in = weeklyKey;
    topic.covered_fingerprints = [...usedFingerprints].sort();
    return topic;
  });
}

module.exports = {
  DEEP_DIVE_QUEUE_REL_PATH,
  accrueDeepDiveTopics,
  distinctFingerprintCount,
  loadDeepDiveTopicQueue,
  markTopicBlocked,
  markTopicCovered,
  saveDeepDiveTopicQueue,
  selectDeepDiveTopic
};
