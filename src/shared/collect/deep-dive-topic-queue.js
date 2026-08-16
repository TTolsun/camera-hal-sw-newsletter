// 심층(deep-dive) 주제 큐. 파이프라인이 main으로 못 실은 Android 카메라 신호를 적립해 두고,
// 조용한 주(direct_aosp_camera ≤ 1)에 심층 기사 주제로 소비한다.
// 계약 정본: docs/NEWSROOM_WORKFLOW.md 「심층(deep-dive) 주제 큐」 절.
// - 적립 쓰기는 01(collect), 상태 전환 쓰기는 03(generator) — 단계별 단일 작성자.
// - accrual_count는 저장하지 않는다. distinct fingerprint 수로 읽는 시점에 계산한다.
// - 파일 손상은 빈 큐로 대체하지 않고 throw한다 — 구현 오류를 콘텐츠 실패로 위장하지 않는다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeJsonAtomic } = require('../common/json');

const DEEP_DIVE_QUEUE_REL_PATH = 'state/deep-dive-topic-queue.json';

function queueFilePath(root) {
  return path.join(root, ...DEEP_DIVE_QUEUE_REL_PATH.split('/'));
}

// 소비자(선정·적립·발동 report)는 모든 topic이 topic_key와 evidence 배열을 가진다고 전제하고
// 바로 읽는다. 그 전제를 load에서 검사하지 않으면 손상된 큐가 소비 지점에서 TypeError로 터져
// "구현 오류"가 엉뚱한 곳의 알 수 없는 오류로 보인다. 여기서 무엇이 어떻게 깨졌는지 말한다.
function topicShapeProblem(topic) {
  if (!topic || typeof topic !== 'object' || Array.isArray(topic)) return '토픽이 객체가 아닙니다';
  if (typeof topic.topic_key !== 'string' || !topic.topic_key.trim()) return 'topic_key가 비어 있습니다';
  if (!Array.isArray(topic.evidence)) return 'evidence 배열이 없습니다';
  if (topic.evidence.some(item => !item || typeof item !== 'object')) return 'evidence 항목이 객체가 아닙니다';
  return '';
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
  parsed.topics.forEach((topic, index) => {
    const problem = topicShapeProblem(topic);
    if (problem) {
      throw new Error(`deep-dive-topic-queue 스키마가 아닙니다(${DEEP_DIVE_QUEUE_REL_PATH}): topics[${index}] ${problem}.`);
    }
  });
  return parsed;
}

// 이 파일이 잘리면 load가 throw해 다음 주 발행 결정이 멈춘다. 그래서 덮어쓰기가 아니라
// 임시 파일+rename으로 쓴다(같은 성격의 source-snapshots와 동일한 방식).
function saveDeepDiveTopicQueue(root, queue) {
  writeJsonAtomic(queueFilePath(root), queue);
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

// localeCompare는 실행 환경의 로케일에 따라 순서가 달라진다. topic_key에는 문서 섹션 제목
// (한글 포함)이 들어가므로, 한국어 로케일 Windows와 Linux CI의 선정 결과가 갈릴 수 있다.
// 선정은 결정론이어야 하므로 코드 유닛 비교로 고정한다.
function compareText(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function selectDeepDiveTopic(queue) {
  const queued = (queue.topics || []).filter(topic => topic.status === 'queued');
  if (queued.length === 0) return null;
  return [...queued].sort((a, b) =>
    ((a.bucket === 'direct_aosp_camera' ? 0 : 1) - (b.bucket === 'direct_aosp_camera' ? 0 : 1)) ||
    (distinctFingerprintCount(b) - distinctFingerprintCount(a)) ||
    compareText(latestEffectiveDate(b), latestEffectiveDate(a)) ||
    compareText(a.topic_key, b.topic_key)
  )[0];
}

function updateTopic(queue, topicKey, updater) {
  return {
    ...queue,
    topics: queue.topics.map(topic => (topic.topic_key === topicKey ? updater({ ...topic }) : topic))
  };
}

// 아래 두 상태 전환은 2단계(생성·검증·렌더)가 호출한다. 1단계(shadow)에는 호출자가 없다 —
// 재선정 규칙(blocked는 새 fingerprint 전까지 다시 안 뽑힌다)을 적립·선정과 같은 자리에서
// 확정해 두려고 함께 둔다. 지금 지우면 그 규칙이 큐 밖으로 흩어진다.
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
