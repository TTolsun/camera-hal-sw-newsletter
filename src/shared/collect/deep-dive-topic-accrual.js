// collect(01)에서 심층 주제 큐로의 적립. 스펙: 적립원 3개 —
// (1) collect가 강등한 direct/adjacent 버킷 후보, (2) primary lane 모니터 이벤트,
// (3) 모니터 문서의 섹션 지문. 전부 여기서만 쓴다(01=적립 쓰기 단일 작성자).
const { hashText } = require('../common/source-identity');
const { accrueDeepDiveTopics, loadDeepDiveTopicQueue, saveDeepDiveTopicQueue } = require('./deep-dive-topic-queue');
const { loadRegistry } = require('./source-monitor');

const CAMERA_HAL_DEEP_DIVE_BUCKETS = new Set(['direct_aosp_camera', 'android_platform_camera_adjacent']);
const MAIN_ELIGIBILITY = new Set(['main', 'short']);

function candidateEntries(candidates) {
  return (candidates || [])
    .filter(candidate => CAMERA_HAL_DEEP_DIVE_BUCKETS.has(candidate.relevance_bucket) &&
      !MAIN_ELIGIBILITY.has(candidate.finalSelectionEligibility))
    .map(candidate => ({
      topic_key: candidate.url,
      title: candidate.title || '',
      bucket: candidate.relevance_bucket,
      evidence: [{
        url: candidate.url,
        excerpt: String(candidate.summary || candidate.title || '').slice(0, 360),
        fingerprint: hashText(`${candidate.url}\n${candidate.title || ''}`),
        effective_date: candidate.publishedAt || '',
        date_source: 'candidate_published_at',
        date_confidence: candidate.publishedAt ? 85 : 0,
        origin: 'demoted_candidate'
      }]
    }));
}

function monitorEventEntries(monitorEvents, primaryLaneSourceIds) {
  return (monitorEvents || [])
    .filter(event => event.candidate_allowed && primaryLaneSourceIds.has(event.source_id))
    .map(event => ({
      topic_key: event.canonical_url || event.url,
      title: event.title || '',
      bucket: 'direct_aosp_camera',
      evidence: [{
        url: event.canonical_url || event.url,
        excerpt: String(event.reason || event.title || '').slice(0, 360),
        fingerprint: event.evidence_id,
        effective_date: event.effective_date || '',
        date_source: event.date_source || 'missing',
        date_confidence: event.date_confidence || 0,
        origin: 'monitor_event'
      }]
    }));
}

function pageExtractEntries(pageExtracts, primaryLaneSourceIds) {
  const entries = [];
  for (const extract of pageExtracts || []) {
    if (!primaryLaneSourceIds.has(extract.source_id)) continue;
    for (const section of extract.sections || []) {
      const sectionUrl = section.url || `${extract.url}#${section.heading}`;
      entries.push({
        topic_key: sectionUrl,
        title: `${extract.release} — ${section.heading}`,
        bucket: 'direct_aosp_camera',
        evidence: [{
          url: sectionUrl,
          excerpt: String(section.sentence || section.heading).slice(0, 360),
          fingerprint: section.hash,
          effective_date: extract.event?.effective_date || '',
          date_source: extract.event?.date_source || 'missing',
          date_confidence: extract.event?.date_confidence || 0,
          origin: 'document_section'
        }]
      });
    }
  }
  return entries;
}

function deepDiveAccrualEntries({ candidates, monitorEvents, pageExtracts, primaryLaneSourceIds }) {
  return [
    ...candidateEntries(candidates),
    ...monitorEventEntries(monitorEvents, primaryLaneSourceIds),
    ...pageExtractEntries(pageExtracts, primaryLaneSourceIds)
  ];
}

function accrueDeepDiveTopicsFromCollect({ root, date, candidates, monitorResult }) {
  const registry = loadRegistry(root);
  const primaryLaneSourceIds = new Set(
    (registry.sources || [])
      .filter(source => source.selection_lane === 'primary_camera_stack')
      .map(source => source.source_id)
  );
  const entries = deepDiveAccrualEntries({
    candidates,
    monitorEvents: monitorResult?.report?.events || [],
    pageExtracts: monitorResult?.pageExtracts || [],
    primaryLaneSourceIds
  });
  const { queue, accruedFingerprintCount } = accrueDeepDiveTopics(
    loadDeepDiveTopicQueue(root),
    entries,
    { detectedAt: date }
  );
  saveDeepDiveTopicQueue(root, queue);
  return { accruedFingerprintCount, queueSize: queue.topics.length };
}

module.exports = { accrueDeepDiveTopicsFromCollect, deepDiveAccrualEntries };
