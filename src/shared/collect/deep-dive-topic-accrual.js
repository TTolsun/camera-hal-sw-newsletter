// collect(01)에서 심층 주제 큐로의 적립. 스펙: 적립원 3개 —
// (1) collect가 강등한 direct/adjacent 버킷 후보, (2) primary lane 모니터 이벤트,
// (3) 모니터 문서의 섹션 지문. 전부 여기서만 쓴다(01=적립 쓰기 단일 작성자).
const { hashText } = require('../common/source-identity');
const { accrueDeepDiveTopics, loadDeepDiveTopicQueue, saveDeepDiveTopicQueue } = require('./deep-dive-topic-queue');
const { bucketForSource, loadRegistry } = require('./source-monitor');

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

function monitorEventEntries(monitorEvents, primaryLaneSources) {
  return (monitorEvents || [])
    .filter(event => event.candidate_allowed && primaryLaneSources.has(event.source_id))
    .map(event => ({
      topic_key: event.canonical_url || event.url,
      title: event.title || '',
      // 버킷은 소스가 정한다. 여기서 direct로 박으면 CameraX 같은 adjacent 소스가 선정
      // 1순위(direct 우선)를 가로채 진짜 AOSP 카메라 주제를 밀어낸다.
      bucket: bucketForSource(primaryLaneSources.get(event.source_id)),
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

function pageExtractEntries(pageExtracts, primaryLaneSources) {
  const entries = [];
  for (const extract of pageExtracts || []) {
    if (!primaryLaneSources.has(extract.source_id)) continue;
    const bucket = bucketForSource(primaryLaneSources.get(extract.source_id));
    for (const section of extract.sections || []) {
      const sectionUrl = section.url || `${extract.url}#${section.heading}`;
      entries.push({
        topic_key: sectionUrl,
        title: `${extract.release} — ${section.heading}`,
        bucket,
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

// primaryLaneSources: Map<source_id, registry source>. id만 넘기면 버킷을 여기서 다시
// 추측해야 하므로 소스 객체를 그대로 넘긴다(버킷 판정의 단일 출처는 bucketForSource).
function deepDiveAccrualEntries({ candidates, monitorEvents, pageExtracts, primaryLaneSources }) {
  const sources = primaryLaneSources || new Map();
  return [
    ...candidateEntries(candidates),
    ...monitorEventEntries(monitorEvents, sources),
    ...pageExtractEntries(pageExtracts, sources)
  ];
}

// 레지스트리는 모니터 실행이 성공했을 때만 읽는다. 모니터가 성공했다는 사실 자체가 레지스트리
// 파싱 성공의 증거다. 실패한 날에 여기서 loadRegistry를 부르면 그 throw가 수집 전체를 죽여,
// 예전에는 failures 항목으로 담기고 피드 후보로 마무리되던 날이 통째로 실패한다.
function primaryLaneSourcesFromRegistry(root, monitorResult) {
  if (!monitorResult) return new Map();
  return new Map(
    (loadRegistry(root).sources || [])
      .filter(source => source.selection_lane === 'primary_camera_stack')
      .map(source => [source.source_id, source])
  );
}

function accrueDeepDiveTopicsFromCollect({ root, date, candidates, monitorResult }) {
  const entries = deepDiveAccrualEntries({
    candidates,
    monitorEvents: monitorResult?.report?.events || [],
    pageExtracts: monitorResult?.pageExtracts || [],
    primaryLaneSources: primaryLaneSourcesFromRegistry(root, monitorResult)
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
