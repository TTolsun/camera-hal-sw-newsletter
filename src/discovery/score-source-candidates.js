const {
  candidateDate,
  candidateTitle,
  candidateUrl,
  clamp,
  numeric,
  stableId,
  text
} = require('../core/collect/source-intelligence-utils');

function reliabilityScore(candidate = {}) {
  const reliability = text(candidate.reliability || candidate.source_reliability).toLowerCase();
  if (reliability === 'official') return 1;
  if (['upstream', 'project-official', 'official-community'].includes(reliability)) return 0.85;
  if (['vendor', 'expert-media'].includes(reliability)) return 0.65;
  if (['community', 'newsletter'].includes(reliability)) return 0.35;
  return 0.2;
}

function recencyScore(candidate = {}, newsletterDate = '') {
  const publishedRaw = candidateDate(candidate);
  if (!publishedRaw) return 0.25;
  const published = new Date(`${publishedRaw.slice(0, 10)}T00:00:00Z`);
  const base = newsletterDate ? new Date(`${newsletterDate}T00:00:00Z`) : new Date();
  if (Number.isNaN(published.getTime()) || Number.isNaN(base.getTime())) return 0.25;
  const days = Math.max(0, (base.getTime() - published.getTime()) / 86400000);
  if (days <= 7) return 1;
  if (days <= 21) return 0.8;
  if (days <= 45) return 0.5;
  return 0.15;
}

function evidenceStrength(candidate = {}) {
  if (candidate.source_gap_risk === true) return 0;
  if (candidate.hasDatedEvidence === true || candidate.has_dated_evidence === true) return 0.9;
  if (candidate.summary || candidate.source_extraction) return 0.55;
  return 0.25;
}

function technicalDepth(candidate = {}) {
  const haystack = `${candidateTitle(candidate)} ${candidate.summary || ''} ${candidate.behavior_change || ''}`;
  if (/HAL|driver|kernel|V4L2|ISP|metadata|buffer|stream|CameraX|androidx\.camera/i.test(haystack)) return 0.85;
  if (/camera|image|sensor|release/i.test(haystack)) return 0.55;
  return 0.25;
}

function marketingPenalty(candidate = {}) {
  const haystack = `${candidateTitle(candidate)} ${candidate.summary || ''}`;
  return /launch|campaign|webinar|award|showcase|sponsored/i.test(haystack) ? 0.15 : 0;
}

function calculateSourceQuality(candidate = {}, options = {}) {
  const relevance = clamp(numeric(candidate.relevanceScore ?? candidate.relevance_score ?? candidate.cameraHalRelevanceScore, 0) / 100, 0, 1);
  const halRelevance = clamp(numeric(candidate.cameraHalRelevanceScore ?? candidate.camera_hal_relevance_score, relevance * 100) / 100, 0, 1);
  const duplicatePenalty = candidate.duplicate_of_selected_source === true ? 0.25 : 0;
  const stalePenalty = candidate.stale_claim_risk === 'high' ? 0.25 : candidate.stale_claim_risk === 'medium' ? 0.1 : 0;
  const score = clamp(
    reliabilityScore(candidate) * 0.25 +
    relevance * 0.25 +
    halRelevance * 0.15 +
    technicalDepth(candidate) * 0.15 +
    recencyScore(candidate, options.newsletterDate) * 0.10 +
    evidenceStrength(candidate) * 0.10 -
    duplicatePenalty -
    stalePenalty -
    marketingPenalty(candidate),
    0,
    1
  );
  const bucket = candidate.source_gap_risk === true
    ? 'blocked_candidate'
    : score >= 0.8
      ? 'strong_candidate'
      : score >= 0.65
        ? 'review_candidate'
        : 'weak_candidate';
  return {
    candidate_id: candidate.id || candidate.source_candidate_id || stableId([candidateUrl(candidate), candidateTitle(candidate)]),
    url: candidateUrl(candidate),
    title: candidateTitle(candidate),
    source_quality_score: Number(score.toFixed(3)),
    source_quality_bucket: bucket,
    breakdown: {
      reliability_score: reliabilityScore(candidate),
      camera_relevance: relevance,
      android_hal_relevance: halRelevance,
      technical_depth: technicalDepth(candidate),
      recency_score: recencyScore(candidate, options.newsletterDate),
      evidence_strength: evidenceStrength(candidate),
      duplicate_penalty: duplicatePenalty,
      stale_claim_penalty: stalePenalty,
      marketing_only_penalty: marketingPenalty(candidate)
    }
  };
}

function scoreSourceCandidates(candidates = [], options = {}) {
  const items = candidates.map(candidate => calculateSourceQuality(candidate, options));
  const byId = new Map(items.map(item => [item.candidate_id, item]));
  const annotatedCandidates = candidates.map(candidate => {
    const id = candidate.id || candidate.source_candidate_id || stableId([candidateUrl(candidate), candidateTitle(candidate)]);
    const item = byId.get(id);
    return {
      ...candidate,
      source_quality_score: item.source_quality_score,
      source_quality_bucket: item.source_quality_bucket,
      source_quality_report_ref: id
    };
  });
  return {
    report: {
      schema_version: 1,
      report_type: 'source_quality',
      newsletter_date: options.newsletterDate || '',
      candidates: items,
      counts: items.reduce((counts, item) => {
        counts[item.source_quality_bucket] = (counts[item.source_quality_bucket] || 0) + 1;
        return counts;
      }, {})
    },
    annotatedCandidates
  };
}

function renderSourceQualityMarkdown(report = {}) {
  const lines = [
    `# Source Quality Report - ${report.newsletter_date || 'unknown'}`,
    '',
    '| Bucket | Score | Candidate | URL |',
    '|---|---:|---|---|'
  ];
  for (const item of report.candidates || []) {
    lines.push(`| ${item.source_quality_bucket} | ${item.source_quality_score} | ${String(item.title || '').replace(/\|/g, '\\|')} | ${item.url || ''} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  calculateSourceQuality,
  renderSourceQualityMarkdown,
  scoreSourceCandidates
};
