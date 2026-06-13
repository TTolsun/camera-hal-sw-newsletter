// pure helpers — status/reason formatting

const { ensureArray } = require('./value-coercion');
function formatReasonSummary(items, options = {}) {
  const topN = options.topN ?? 5;
  return ensureArray(items)
    .slice(0, topN)
    .map(item => `${item.reason || 'unknown'} (${item.count ?? 'n/a'})`)
    .join('; ') || 'none';
}

module.exports = { formatReasonSummary };
