const {
  candidateTitle,
  candidateUrl,
  stableId,
  text
} = require('../shared/collect/source-intelligence-utils');

function canonicalRank(candidate = {}) {
  if (candidate.manualSeed === true || candidate.manual_seed === true) return 0;
  const reliability = text(candidate.reliability || candidate.source_reliability).toLowerCase();
  if (reliability === 'official') return 1;
  if (reliability === 'upstream') return 2;
  if (candidate.source_type === 'official_release_note' || candidate.sourceType === 'official_release_note') return 3;
  return 10;
}

function titleKey(value = '') {
  return text(value).toLowerCase().replace(/[^a-z0-9가-힣]+/gi, ' ').replace(/\s+/g, ' ').trim();
}

function clusterKey(candidate = {}) {
  const url = candidateUrl(candidate);
  if (url) {
    return url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
  return titleKey(candidateTitle(candidate));
}

function staleClaimRisk(candidate = {}, newsletterDate = '') {
  const publishedRaw = text(candidate.publishedAt || candidate.published_date || candidate.publishedDate);
  if (!publishedRaw || !newsletterDate) return '';
  const published = new Date(`${publishedRaw.slice(0, 10)}T00:00:00Z`);
  const base = new Date(`${newsletterDate}T00:00:00Z`);
  if (Number.isNaN(published.getTime()) || Number.isNaN(base.getTime())) return '';
  const days = Math.max(0, (base.getTime() - published.getTime()) / 86400000);
  if (days > 90) return 'high';
  if (days > 45) return 'medium';
  return 'low';
}

function checkSourceDuplicates(candidates = [], options = {}) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = clusterKey(candidate);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }

  const canonicalByKey = new Map();
  const clusters = [];
  for (const [key, items] of groups.entries()) {
    const sorted = [...items].sort((a, b) => canonicalRank(a) - canonicalRank(b));
    const canonical = sorted[0];
    canonicalByKey.set(key, candidateUrl(canonical) || candidateTitle(canonical));
    clusters.push({
      cluster_id: stableId([key]),
      cluster_key: key,
      canonical_url: candidateUrl(canonical),
      canonical_title: candidateTitle(canonical),
      candidate_count: items.length,
      duplicate_count: Math.max(0, items.length - 1),
      candidates: items.map(item => ({
        url: candidateUrl(item),
        title: candidateTitle(item),
        canonical: item === canonical,
        reliability: item.reliability || item.source_reliability || '',
        manual_seed: item.manualSeed === true || item.manual_seed === true
      }))
    });
  }

  const annotatedCandidates = candidates.map(candidate => {
    const key = clusterKey(candidate);
    const canonicalRef = canonicalByKey.get(key);
    const isDuplicate = Boolean(canonicalRef && (candidateUrl(candidate) || candidateTitle(candidate)) !== canonicalRef);
    return {
      ...candidate,
      duplicate_of_selected_source: isDuplicate,
      stale_claim_risk: candidate.stale_claim_risk || staleClaimRisk(candidate, options.newsletterDate)
    };
  });

  return {
    report: {
      schema_version: 1,
      report_type: 'source_clusters',
      newsletter_date: options.newsletterDate || '',
      clusters
    },
    annotatedCandidates
  };
}

module.exports = {
  checkSourceDuplicates,
  clusterKey
};
