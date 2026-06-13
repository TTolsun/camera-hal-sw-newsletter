const {
  ensureArray
} = require('./publish-status');
const {
  sanitizeMarkdownTableCell,
  sanitizeMarkdownLinkUrl,
  trustedMarkdownTableCell
} = require('../../core/common/markdown');

const TRACE_STATUS_RANK = {
  final_selected: 1,
  primary_selected: 2,
  reserve: 3,
  merged: 4,
  demoted: 5,
  rejected: 6,
  excluded: 7,
  not_main_eligible: 8,
  briefing_only: 9,
  reference_only: 10,
  quality_fail: 11,
  factcheck_fail: 12,
  unknown: 99
};

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function firstText(values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function valuesAsArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function extractCandidateTitle(candidate) {
  return firstText([candidate?.title, candidate?.headline, candidate?.article_title, candidate?.name]);
}

function sourceFromValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return firstText([value.name, value.title, value.source_name, value.source]);
}

function extractCandidateSource(candidate) {
  return firstText([
    candidate?.source_name,
    sourceFromValue(candidate?.source),
    candidate?.publisher,
    candidate?.feed_source,
    sourceFromValue(ensureArray(candidate?.sources)[0])
  ]);
}

function extractCandidateBucket(candidate) {
  return firstText([
    candidate?.relevance_bucket,
    candidate?.aosp_camera_stack_bucket,
    candidate?.bucket,
    candidate?.category
  ]);
}

function extractCandidateUrls(candidate) {
  const urls = [
    candidate?.article_url,
    candidate?.articleUrl,
    candidate?.url,
    candidate?.source_url,
    candidate?.sourceUrl,
    candidate?.link
  ];
  for (const source of ensureArray(candidate?.sources)) {
    urls.push(source?.url, source?.source_url, source?.sourceUrl);
  }
  for (const url of valuesAsArray(candidate?.source_urls)) {
    urls.push(url);
  }
  return [...new Set(urls.map(url => String(url || '').trim()).filter(Boolean))];
}

function extractReasonList(candidate) {
  const reasons = [];
  const push = value => {
    for (const item of valuesAsArray(value)) {
      const text = typeof item === 'string' ? item : (item?.reason || item?.problem || item?.message || JSON.stringify(item));
      if (text) reasons.push(text);
    }
  };
  push(candidate?.selection_exclusion_reason);
  push(candidate?.final_exclusion_reasons);
  push(candidate?.exclusion_reasons);
  push(candidate?.watchlist_reason);
  push(candidate?.reason);
  push(candidate?.collection_reason);
  if (candidate?.source_gap_risk === true) reasons.push('source_gap_risk=true');
  push(candidate?.evidence_origin);
  push(candidate?.finalSelectionEligibility);
  return reasons.length > 0 ? [...new Set(reasons)] : ['no explicit reason'];
}

function classifyCandidateStatus(candidate, hint = '') {
  if (candidate?.final_selected === true || hint === 'final_selected') return 'final_selected';
  if (candidate?.primary_selected === true || candidate?.selected_for_editor === true || hint === 'primary_selected') {
    return 'primary_selected';
  }
  if (candidate?.reserve_candidate === true || hint === 'reserve') return 'reserve';
  if (hint === 'merged') return 'merged';
  if (hint === 'demoted') return 'demoted';
  if (hint === 'rejected') return 'rejected';
  if (ensureArray(candidate?.final_exclusion_reasons).length > 0 || ensureArray(candidate?.exclusion_reasons).length > 0 || hint === 'excluded') {
    return 'excluded';
  }
  if (candidate?.main_eligible === false) return 'not_main_eligible';
  if (candidate?.briefing_only === true) return 'briefing_only';
  if (candidate?.reference_only === true) return 'reference_only';
  if (hint === 'quality_fail') return 'quality_fail';
  if (hint === 'factcheck_fail') return 'factcheck_fail';
  return 'unknown';
}

function reasonCodeFor(candidate, status, reportStatus = '') {
  const haystack = [
    status,
    reportStatus,
    ...extractReasonList(candidate)
  ].join(' ').toLowerCase();
  if (status === 'merged' || /merged/.test(haystack)) return 'merged_into_selected_article';
  if (/fact.?check.*source.?gap|source_gap/.test(haystack) && /fact/.test(reportStatus)) return 'factcheck_source_gap';
  if (/fact.?check|must_fix/.test(haystack)) return 'factcheck_must_fix';
  if (/quality|hard_fail/.test(haystack)) return 'quality_hard_fail';
  if (/source.?gap/.test(haystack)) return 'source_gap';
  if (/weak.*hal|hal.*weak|scope.?relevance|hal.*connection|camera.*evidence.*weak/.test(haystack)) return 'weak_hal_connection';
  if (/generic.*ai|generic.*tech|buzzword/.test(haystack)) return 'generic_ai_noise';
  if (/duplicate.*source|duplicate.*url|duplicate_base_url/.test(haystack)) return 'duplicate_source';
  if (/same.*source.*cluster|same.*release/.test(haystack)) return 'same_source_cluster';
  if (/missing.*date|missing.*dated|no date|stale/.test(haystack)) return 'missing_dated_evidence';
  if (candidate?.main_eligible === false || /main_eligible=false|not_main_eligible/.test(haystack)) return 'not_main_eligible';
  if (candidate?.briefing_only === true || /briefing_only=true/.test(haystack)) return 'briefing_only';
  if (candidate?.reference_only === true || /reference_only=true/.test(haystack)) return 'reference_only';
  if (/fallback/.test(haystack)) return 'fallback_only';
  return 'unknown_reason';
}

function formatCandidateLink(candidate) {
  const title = sanitizeMarkdownTableCell(candidate.title || 'unknown title', { maxLength: 120 });
  const url = sanitizeMarkdownLinkUrl(candidate.url);
  // validator regex forbids literal `]` inside link text; replace [ ] with ( ) so "[PATCH 1/6]" becomes "(PATCH 1/6)"
  const linkText = title.replace(/\[/g, '(').replace(/\]/g, ')');
  return url ? trustedMarkdownTableCell(`[${linkText}](<${url}>)`) : title;
}

module.exports = {
  TRACE_STATUS_RANK,
  normalizeMatchText,
  firstText,
  valuesAsArray,
  extractCandidateTitle,
  sourceFromValue,
  extractCandidateSource,
  extractCandidateBucket,
  extractCandidateUrls,
  extractReasonList,
  classifyCandidateStatus,
  reasonCodeFor,
  formatCandidateLink
};
