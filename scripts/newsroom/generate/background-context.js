const {
  buildStaticBackgroundContext,
  inferImpactClaimLevel
} = require('./article-field-builder');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').trim();
}

function capsuleItems(capsuleReport = {}) {
  return [
    ...ensureArray(capsuleReport.selected_capsules),
    ...ensureArray(capsuleReport.reserve_capsules),
    ...ensureArray(capsuleReport.shortlisted_capsules)
  ];
}

function stableUniqueItems(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = text(item.url || item.source_candidate_url || item.url_hash || item.source_candidate_hash);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function buildStaticBackgroundContextReport(date, capsuleReport = {}) {
  const contexts = stableUniqueItems(capsuleItems(capsuleReport)).map(capsule => {
    const impactClaimLevel = inferImpactClaimLevel(capsule);
    return {
      title: text(capsule.title),
      url: text(capsule.url),
      source_candidate_hash: text(capsule.source_candidate_hash || capsule.url_hash),
      relevance_bucket: text(capsule.relevance_bucket),
      impact_claim_level: impactClaimLevel,
      background_context: text(capsule.background_context_static) ||
        buildStaticBackgroundContext({ ...capsule, impact_claim_level: impactClaimLevel }),
      background_basis: 'supplied article capsule metadata 기반 deterministic static fallback',
      background_confidence: 'medium',
      background_warnings: ensureArray(capsule.behavior_cleaning?.warnings)
    };
  });
  return {
    schema_version: 1,
    date,
    generated_at: new Date().toISOString(),
    stage: 'static-fallback',
    background_contexts: contexts
  };
}

module.exports = {
  buildStaticBackgroundContextReport
};
