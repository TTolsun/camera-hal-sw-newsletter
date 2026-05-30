// pure helpers — status/reason formatting

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatReasonSummary(items, options = {}) {
  const topN = options.topN ?? 5;
  return ensureArray(items)
    .slice(0, topN)
    .map(item => `${item.reason || 'unknown'} (${item.count ?? 'n/a'})`)
    .join('; ') || 'none';
}

module.exports = { formatReasonSummary };
