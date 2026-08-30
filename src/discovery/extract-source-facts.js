const {
  candidateDate,
  candidateFactId,
  candidateTitle,
  candidateUrl,
  clamp,
  evidenceSourceKey,
  fetchTextWithLimit,
  numeric,
  text
} = require('../shared/collect/source-intelligence-utils');

function inferClaim(candidate = {}, fetchedText = '') {
  const summary = text(candidate.summary || candidate.behavior_change || candidate.what_changed);
  if (summary) return summary;
  const title = candidateTitle(candidate);
  if (title) return title;
  return text(fetchedText).slice(0, 160);
}

function buildFact(candidate = {}, options = {}) {
  const fetchedText = text(options.fetchedText);
  const metadataFallback = options.metadataFallback !== false;
  const url = candidateUrl(candidate);
  const claim = inferClaim(candidate, fetchedText);
  const sourceQuality = candidate.source_quality_score;
  return {
    id: candidateFactId(candidate),
    url,
    title: candidateTitle(candidate),
    published_at: candidateDate(candidate),
    source_type: candidate.source_type || candidate.sourceType || candidate.source_kind || 'unknown',
    source_fetch_used: options.sourceFetchUsed === true,
    source_fetch_status: options.sourceFetchStatus || 'skipped',
    source_fetch_error: options.sourceFetchError || '',
    validation_mode: options.validationMode || (options.sourceFetchUsed ? 'source_fetch' : 'metadata_only'),
    claims: claim ? [{
      claim,
      evidence_text: fetchedText ? fetchedText.slice(0, 500) : (metadataFallback ? text(candidate.summary || '') : ''),
      confidence: fetchedText || candidate.source_gap_risk !== true ? 'medium' : 'low'
    }] : [],
    camera_relevance: clamp(numeric(candidate.cameraHalRelevanceScore ?? candidate.camera_hal_relevance_score ?? candidate.relevanceScore, 0) / 100, 0, 1),
    android_hal_relevance: clamp(numeric(candidate.cameraHalRelevanceScore ?? candidate.camera_hal_relevance_score, candidate.relevanceScore || 0) / 100, 0, 1),
    ai_relevance: /ai|npu|gpu|model/i.test(`${candidateTitle(candidate)} ${candidate.summary || ''}`) ? 0.5 : 0,
    technical_depth: sourceQuality !== undefined ? clamp(Number(sourceQuality), 0, 1) : 0.5,
    warnings: []
  };
}

async function extractSourceFacts(candidates = [], options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const shouldFetch = options.fetch === true;
  const sources = [];
  // 같은 기사 URL이 수집본과 발견본으로 두 번 들어온다. 사본마다 fact를 만들어야 하지만
  // 원문을 두 번 받아올 이유는 없으므로 실행 안에서 출처당 한 번만 받는다.
  // 키는 대상을 고르는 쪽(selectEvidenceFetchTargetGroups)과 같은 evidenceSourceKey다.
  // 다른 키를 쓰면 cap이 센 칸 수와 실제 수신 횟수가 어긋난다.
  const fetchedBySource = new Map();
  for (const candidate of candidates) {
    let fetchedText = '';
    let sourceFetchStatus = 'skipped';
    let sourceFetchError = '';
    const url = candidateUrl(candidate);
    const sourceKey = evidenceSourceKey(candidate) || url;
    if (shouldFetch && fetchImpl && url) {
      if (!fetchedBySource.has(sourceKey)) {
        try {
          fetchedBySource.set(sourceKey, { text: await fetchTextWithLimit(fetchImpl, url, options), status: 'success', error: '' });
        } catch (error) {
          fetchedBySource.set(sourceKey, { text: '', status: 'failed', error: error.message });
        }
      }
      const fetched = fetchedBySource.get(sourceKey);
      fetchedText = fetched.text;
      sourceFetchStatus = fetched.status;
      sourceFetchError = fetched.error;
    }
    sources.push(buildFact(candidate, {
      fetchedText,
      metadataFallback: options.metadataFallback ?? !shouldFetch,
      sourceFetchUsed: shouldFetch,
      sourceFetchStatus,
      sourceFetchError,
      validationMode: shouldFetch ? 'source_fetch' : 'metadata_only'
    }));
  }
  return { sources };
}

module.exports = {
  buildFact,
  extractSourceFacts
};
