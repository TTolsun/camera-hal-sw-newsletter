const {
  candidateDate,
  candidateTitle,
  candidateUrl,
  clamp,
  fetchTextWithLimit,
  numeric,
  stableId,
  text
} = require('./source-intelligence-utils');

function inferClaim(candidate = {}, fetchedText = '') {
  const summary = text(candidate.summary || candidate.behavior_change || candidate.what_changed);
  if (summary) return summary;
  const title = candidateTitle(candidate);
  if (title) return title;
  return text(fetchedText).slice(0, 160);
}

function buildFact(candidate = {}, options = {}) {
  const fetchedText = text(options.fetchedText);
  const url = candidateUrl(candidate);
  const claim = inferClaim(candidate, fetchedText);
  const sourceQuality = candidate.source_quality_score;
  return {
    id: candidate.id || candidate.source_candidate_id || stableId([url, candidateTitle(candidate)]),
    url,
    title: candidateTitle(candidate),
    published_at: candidateDate(candidate),
    source_type: candidate.source_type || candidate.sourceType || candidate.source_kind || 'unknown',
    claims: claim ? [{
      claim,
      evidence_text: fetchedText ? fetchedText.slice(0, 500) : text(candidate.summary || ''),
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
  const sources = [];
  for (const candidate of candidates) {
    let fetchedText = '';
    if (options.fetch === true && fetchImpl && candidateUrl(candidate)) {
      try {
        fetchedText = await fetchTextWithLimit(fetchImpl, candidateUrl(candidate), options);
      } catch (error) {
        fetchedText = '';
      }
    }
    sources.push(buildFact(candidate, { fetchedText }));
  }
  return { sources };
}

module.exports = {
  buildFact,
  extractSourceFacts
};
