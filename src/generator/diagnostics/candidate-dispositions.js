const { ensureArray } = require('../../shared/common/value-coercion');
const { normalizeUrl } = require('../../shared/common/selection-normalizers');
const { freshnessWindowMetadata } = require('../select/newsroom-selection');

// Advisory only: preserve independent date, policy and extraction causes. A source can
// have both old candidates and blocked proposals; neither is evidence of a parser bug.
function candidateDispositions(candidates, date, coverageWeekKey) {
  const seen = new Set();
  return ensureArray(candidates).flatMap(candidate => {
    const sourceId = candidate.source_id || candidate.sourceId || candidate.source?.id || 'unknown-source';
    const url = candidate.url || candidate.article_url || candidate.articleUrl || '';
    const key = `${sourceId}|${normalizeUrl(url)}`;
    if (url && seen.has(key)) return [];
    if (url) seen.add(key);
    const window = freshnessWindowMetadata(candidate, date, undefined, {
      coverageWeekKeyOverride: coverageWeekKey
    }).freshness_window;
    const blockers = [...new Set([
      ...ensureArray(candidate.main_article_source_blockers),
      ...ensureArray(candidate.mainArticleSourceBlockers),
      ...ensureArray(candidate.source_quality?.main_article_source_blockers)
    ])];
    const reasons = [];
    if (window === 'reference' || window === 'stale') reasons.push('outside_main_window');
    if (window === 'not_yet_eligible') reasons.push('after_coverage_week');
    if (window === 'unknown') reasons.push('missing_date_evidence');
    if (blockers.includes('policy_locked_out_of_main')) reasons.push('source_policy_blocked');
    if (blockers.includes('cross_check_required_but_missing')) reasons.push('primary_confirmation_missing');
    if (candidate.source_extraction?.used_fallback === true) reasons.push('extraction_fallback');
    if (candidate.reference_only === true) reasons.push('reference_only');
    return [{
      source_id: sourceId,
      title: candidate.title || '',
      url,
      published_date: candidate.published_date || candidate.publishedAt || '',
      freshness_window: window,
      gerrit_change_status: candidate.gerrit_change_status || '',
      source_policy_blockers: blockers,
      reason_codes: reasons
    }];
  });
}

module.exports = { candidateDispositions };
