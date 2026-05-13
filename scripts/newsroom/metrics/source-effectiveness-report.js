const fs = require('fs');
const path = require('path');

const {
  kstDate,
  readJson,
  writeJson
} = require('../common/common');
const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  newsroomDir,
  newsroomRelPath
} = require('../common/artifact-paths');
const {
  normalizeUrl
} = require('../generate/newsroom-selection');

const SCHEMA_VERSION = 1;
const MAX_SAMPLE_URLS = 5;
const MAX_REASON_ROWS = 5;
const RECOMMENDATION_ORDER = [
  'NO_RECENT_SIGNAL',
  'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR',
  'KEEP',
  'KEEP_AND_FIX_PARSER',
  'DOWNGRADE_TO_CANDIDATE_ONLY',
  'REVIEW_SOURCE_OR_PARSER',
  'DISABLE_OR_REVIEW',
  'KEEP_AND_MONITOR'
];

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function compareText(left, right) {
  const a = text(left);
  const b = text(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function uniqueSorted(values) {
  return [...new Set(values.map(text).filter(Boolean))].sort(compareText);
}

function lower(value) {
  return text(value).toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rounded(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function safeRate(numerator, denominator) {
  const parsedNumerator = Number(numerator);
  const parsedDenominator = Number(denominator);
  if (!Number.isFinite(parsedNumerator) || !Number.isFinite(parsedDenominator) || parsedDenominator === 0) {
    return 0;
  }
  return rounded(parsedNumerator / parsedDenominator);
}

function slug(value, fallback = 'unknown-source') {
  const normalized = lower(value)
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function domainFromUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

function canonicalCandidateUrl(candidate = {}) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl || candidate.normalized_url);
}

function candidateIdentityKey(candidate = {}) {
  const url = normalizeUrl(canonicalCandidateUrl(candidate));
  if (url) return url;
  return `missing-url:${slug([
    candidate.source_id,
    candidate.sourceId,
    objectValue(candidate.source).id,
    candidate.source_name,
    typeof candidate.source === 'string' ? candidate.source : '',
    candidate.title,
    candidate.published_date,
    candidate.publishedAt
  ].map(text).filter(Boolean).join('|'))}`;
}

function finalSelectionEligibility(candidate = {}) {
  return lower(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
}

function hasDatedEvidence(candidate = {}) {
  if (candidate.hasDatedEvidence === false) return false;
  if (candidate.has_dated_evidence === false) return false;
  return true;
}

function isEligibleCandidate(candidate = {}) {
  const eligibility = finalSelectionEligibility(candidate);
  return candidate.main_eligible !== false &&
    candidate.source_gap_risk !== true &&
    candidate.reference_only !== true &&
    hasDatedEvidence(candidate) &&
    ['main', 'short'].includes(eligibility);
}

function isSelectedCandidate(candidate = {}) {
  return candidate.final_selected === true ||
    candidate.primary_selected === true ||
    candidate.selected_for_editor === true;
}

function isWatchlistCandidate(candidate = {}) {
  return finalSelectionEligibility(candidate) === 'watchlist' ||
    candidate.isWatchPage === true ||
    candidate.is_watch_page === true;
}

function sourceObject(candidate = {}) {
  return objectValue(candidate.source);
}

function genericNoiseCandidate(candidate = {}, source = {}) {
  const haystack = [
    candidate.relevance_bucket,
    candidate.selection_exclusion_reason,
    candidate.watchlist_reason,
    candidate.verification_hint,
    candidate.summary,
    candidate.category,
    source.category,
    source.source_name
  ].map(value => text(value)).join(' ').toLowerCase();

  return haystack.includes('generic_tech_watchlist') ||
    /generic (technology|tech|ai|it)/i.test(haystack) ||
    /without article-level camera/i.test(haystack) ||
    /general (technology|tech|ai|it)/i.test(haystack);
}

function derivedExclusionReasons(candidate = {}) {
  const reasons = [];
  const eligibility = finalSelectionEligibility(candidate);
  if (!canonicalCandidateUrl(candidate)) reasons.push('missing URL evidence');
  if (!hasDatedEvidence(candidate)) {
    reasons.push('hasDatedEvidence=false');
  }
  if (candidate.source_gap_risk === true) reasons.push('source_gap_risk=true');
  if (candidate.reference_only === true) reasons.push('reference_only=true');
  if (candidate.main_eligible === false) reasons.push('main_eligible=false');
  if (candidate.briefing_only === true) reasons.push('briefing_only=true');
  if (eligibility && !['main', 'short'].includes(eligibility)) {
    reasons.push(`finalSelectionEligibility=${eligibility}`);
  }
  return reasons;
}

function candidateExclusionReasons(candidate = {}) {
  const explicit = [
    ...ensureArray(candidate.final_exclusion_reasons),
    ...ensureArray(candidate.exclusion_reasons),
    candidate.selection_exclusion_reason,
    candidate.watchlist_reason,
    candidate.verification_hint
  ].map(text).filter(value => value && !/^eligible for/i.test(value));
  return uniqueSorted([
    ...explicit,
    ...derivedExclusionReasons(candidate)
  ]);
}

function addMulti(map, key, source) {
  const normalized = lower(key);
  if (!normalized) return;
  if (!map.has(normalized)) map.set(normalized, []);
  map.get(normalized).push(source);
}

function uniqueMatch(map, key) {
  const matches = ensureArray(map.get(lower(key)));
  return matches.length === 1 ? matches[0] : null;
}

function normalizeRegistrySource(source = {}, index = 0) {
  return {
    source_id: text(source.id),
    source_name: text(source.name || source.id),
    source_url: text(source.sourceUrl),
    rss_url: text(source.rssUrl),
    category: text(source.category),
    priority: text(source.priority),
    reliability: text(source.reliability),
    enabled: source.enabled !== false,
    candidate_only: source.candidateOnly === true,
    requires_cross_check: source.requiresCrossCheck === true,
    collection_mode_hint: text(source.collectionModeHint),
    source_role: text(source.sourceRole || source.source_role),
    synthetic: false,
    registry_index: index
  };
}

function buildRegistryIndex(sourceRegistry = {}) {
  const sources = ensureArray(sourceRegistry.sources).map(normalizeRegistrySource);
  const byId = new Map();
  const byName = new Map();
  const bySourceUrl = new Map();
  const byRssUrl = new Map();
  const byDomain = new Map();

  for (const source of sources) {
    addMulti(byId, source.source_id, source);
    addMulti(byName, source.source_name, source);
    addMulti(bySourceUrl, normalizeUrl(source.source_url), source);
    addMulti(byRssUrl, normalizeUrl(source.rss_url), source);
    addMulti(byDomain, domainFromUrl(source.source_url), source);
    addMulti(byDomain, domainFromUrl(source.rss_url), source);
  }

  for (const map of [byId, byName, bySourceUrl, byRssUrl, byDomain]) {
    for (const [key, values] of map.entries()) {
      map.set(key, values.sort((a, b) => compareText(a.source_id, b.source_id)));
    }
  }

  return { sources, byId, byName, bySourceUrl, byRssUrl, byDomain };
}

function matchLabel(index, value) {
  return uniqueMatch(index.byName, value) || uniqueMatch(index.byId, value);
}

function registeredSourceForCandidate(candidate = {}, index, warningSet = new Set()) {
  const nestedSource = sourceObject(candidate);
  const sourceField = typeof candidate.source === 'string' ? candidate.source : '';
  const orderedChecks = [
    () => uniqueMatch(index.byId, candidate.source_id),
    () => uniqueMatch(index.byId, candidate.sourceId),
    () => uniqueMatch(index.byId, nestedSource.id),
    () => uniqueMatch(index.byName, candidate.source_name),
    () => matchLabel(index, sourceField),
    () => uniqueMatch(index.bySourceUrl, normalizeUrl(candidate.sourceUrl || candidate.source_url)),
    () => uniqueMatch(index.byRssUrl, normalizeUrl(candidate.rssUrl || candidate.rss_url))
  ];

  for (const check of orderedChecks) {
    const matched = check();
    if (matched) return matched;
  }

  const domainCandidates = uniqueSorted([
    domainFromUrl(candidate.sourceUrl || candidate.source_url),
    domainFromUrl(candidate.rssUrl || candidate.rss_url),
    domainFromUrl(canonicalCandidateUrl(candidate))
  ]);
  for (const domain of domainCandidates) {
    const matches = ensureArray(index.byDomain.get(domain));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      warningSet.add(`Ambiguous source domain ${domain} matched registry sources ${matches.map(item => item.source_id).join(', ')}.`);
    }
  }

  return null;
}

function syntheticSourceForCandidate(candidate = {}, syntheticSources, warningSet) {
  const seed = text(candidate.source_id || candidate.sourceId || sourceObject(candidate).id) ||
    text(candidate.source_name) ||
    (typeof candidate.source === 'string' ? text(candidate.source) : '') ||
    domainFromUrl(candidate.sourceUrl || candidate.source_url) ||
    domainFromUrl(canonicalCandidateUrl(candidate)) ||
    'unknown-source';
  const sourceId = `synthetic-${slug(seed)}`;
  if (!syntheticSources.has(sourceId)) {
    const source = {
      source_id: sourceId,
      source_name: `Unregistered source: ${seed}`,
      source_url: text(candidate.sourceUrl || candidate.source_url),
      rss_url: text(candidate.rssUrl || candidate.rss_url),
      category: text(candidate.category || candidate.source_category),
      priority: text(candidate.priority || candidate.source_priority),
      reliability: text(candidate.reliability || candidate.source_reliability),
      enabled: true,
      candidate_only: false,
      requires_cross_check: false,
      collection_mode_hint: text(candidate.sourceCollectionMode || candidate.source_collection_mode),
      source_role: text(candidate.sourceRole || candidate.source_role),
      synthetic: true,
      registry_index: Number.MAX_SAFE_INTEGER
    };
    syntheticSources.set(sourceId, source);
    warningSet.add(`Unregistered candidate source grouped as ${sourceId}.`);
  }
  return syntheticSources.get(sourceId);
}

function sourceState(source) {
  return {
    source,
    entriesByKey: new Map(),
    duplicateAcrossKeys: new Set(),
    factCheckGapKeys: new Set(),
    selectedKeys: new Set(),
    selectedUrls: new Set(),
    renderedKeys: new Set(),
    renderedUrls: new Set(),
    reasonCounts: new Map()
  };
}

function incrementReason(state, reason) {
  const key = text(reason);
  if (!key) return;
  state.reasonCounts.set(key, (state.reasonCounts.get(key) || 0) + 1);
}

function collectCandidatesFromShortlist(shortlistReport = {}, reporterCandidates = {}) {
  const out = [];
  const seen = new Set();
  for (const candidate of [
    ...ensureArray(shortlistReport.primary_selected_articles),
    ...ensureArray(shortlistReport.selected_articles),
    ...ensureArray(shortlistReport.shortlisted_candidates),
    ...ensureArray(shortlistReport.reserve_candidates),
    ...ensureArray(shortlistReport.demoted_candidates),
    ...ensureArray(shortlistReport.excluded_candidates),
    ...ensureArray(reporterCandidates.candidates)
  ]) {
    const key = `${candidateIdentityKey(candidate)}|${text(candidate.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

function orderedUnique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values.map(text).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function sectionSourceUrls(section = {}) {
  return orderedUnique([
    section.source_candidate_url,
    ...ensureArray(section.sources).map(source => source?.url)
  ]);
}

function renderedSectionMatches(editorDraft = {}, knownCandidateKeys) {
  const matches = [];
  const unmatched = [];
  for (const [index, section] of ensureArray(editorDraft.sections).entries()) {
    const urls = sectionSourceUrls(section);
    let matched = null;
    for (const url of urls) {
      const key = normalizeUrl(url);
      if (key && knownCandidateKeys.has(key)) {
        matched = { key, url, index };
        break;
      }
    }
    if (matched) {
      matches.push(matched);
    } else if (urls.length > 0) {
      unmatched.push(`sections[${index}] source URL did not match any candidate: ${urls[0]}`);
    }
  }
  return { matches, unmatched };
}

function urlsFromText(value) {
  return uniqueSorted(ensureArray(String(value || '').match(/https?:\/\/[^\s)\]}>"']+/g)));
}

function factCheckSourceGapItems(factCheckReport = {}) {
  return ensureArray(factCheckReport.source_gaps).map(item => {
    if (typeof item === 'string') {
      return {
        urls: urlsFromText(item),
        reason: item
      };
    }
    const gap = objectValue(item);
    return {
      urls: uniqueSorted([
        gap.source_url,
        gap.sourceUrl,
        gap.source_candidate_url,
        gap.url,
        ...urlsFromText([
          gap.problem,
          gap.issue,
          gap.reason,
          gap.claim,
          gap.suggestion,
          gap.headline
        ].map(text).join(' '))
      ]),
      reason: text(gap.problem || gap.issue || gap.reason || gap.claim || gap.headline) || 'fact-check source gap'
    };
  });
}

function applyFactCheckSourceGaps(factCheckReport, states, keySources, warnings) {
  for (const item of factCheckSourceGapItems(factCheckReport)) {
    if (item.urls.length === 0) {
      warnings.add(`Unattributed fact-check source gap could not be mapped to a source: ${item.reason}`);
      continue;
    }
    for (const url of item.urls) {
      const key = normalizeUrl(url);
      const sourceIds = keySources.get(key);
      if (!sourceIds || sourceIds.size === 0) {
        warnings.add(`Fact-check source gap URL did not match a collected candidate: ${url}`);
        continue;
      }
      if (sourceIds.size > 1) {
        warnings.add(`Fact-check source gap URL matched multiple collected sources: ${url}`);
        continue;
      }
      const state = states.get([...sourceIds][0]);
      if (!state) continue;
      state.factCheckGapKeys.add(key);
      incrementReason(state, item.reason);
    }
  }
}

function sortedReasonRows(reasonCounts) {
  return [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || compareText(a.reason, b.reason))
    .slice(0, MAX_REASON_ROWS);
}

function officialLike(source = {}) {
  return ['official', 'project-official', 'official-community'].includes(lower(source.reliability)) ||
    lower(source.priority) === 'high';
}

function genericSourceLike(source = {}, metrics = {}) {
  const haystack = [
    source.category,
    source.source_name,
    source.collection_mode_hint
  ].map(lower).join(' ');
  return metrics.noise_rate >= 0.5 ||
    /\b(ai|it|tech|software-engineering|ai-trends|ai-engineering|ai-coding)\b/i.test(haystack);
}

function cameraRelevantRawSignal(candidate = {}) {
  const haystack = [
    candidate.title,
    candidate.summary,
    candidate.description,
    candidate.category,
    candidate.relevance_bucket,
    candidate.source_name,
    candidate.api_or_component,
    candidate.version_or_release,
    candidate.behavior_change,
    candidate.source_extraction,
    candidate.derived_editorial_hints
  ].map(value => typeof value === 'object' ? JSON.stringify(value) : text(value)).join(' ');
  return /\b(?:camera|camerax|camera2|androidx\.camera|hal|stream|buffer|metadata|image\s+pipeline|isp|v4l2|libcamera)\b/i.test(haystack);
}

function parserRepairReason(reason = '') {
  return /\b(?:parser|parse|extraction|source_extraction|date|dated|version|anchor|source url|missing URL evidence|missing dated evidence|release row|fallback)\b/i.test(text(reason));
}

function recommendationFor(source, metrics) {
  const reasons = [];
  let recommendation = 'KEEP_AND_MONITOR';

  if (metrics.collected_count === 0) {
    recommendation = 'NO_RECENT_SIGNAL';
    reasons.push('No recent candidates were collected for this source.');
  } else if (
    officialLike(source) &&
    metrics.eligible_count === 0 &&
    metrics.camera_relevant_raw_count > 0 &&
    metrics.parser_repair_reason_count > 0
  ) {
    recommendation = 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR';
    reasons.push('Official or high-priority source produced camera-relevant candidates, but parser/source-extraction-like rejection reasons blocked eligibility.');
  } else if (
    metrics.rendered_main_count > 0 &&
    metrics.effectiveness_score >= 60 &&
    metrics.source_gap_rate <= 0.3 &&
    metrics.noise_rate <= 0.5
  ) {
    recommendation = 'KEEP';
    reasons.push('Source contributed at least one rendered main article.');
  } else if (
    officialLike(source) &&
    (metrics.source_gap_rate >= 0.25 ||
      metrics.reference_only_count > 0 ||
      metrics.watchlist_count > 0 ||
      metrics.main_eligible_false_count > 0)
  ) {
    recommendation = 'KEEP_AND_FIX_PARSER';
    reasons.push('Official or high-priority source has parser/source-evidence issues but should stay enabled.');
  } else if (
    !officialLike(source) &&
    genericSourceLike(source, metrics) &&
    metrics.collected_count >= 3 &&
    metrics.eligible_count === 0 &&
    metrics.rendered_main_count === 0 &&
    (metrics.noise_rate >= 0.5 || metrics.source_gap_rate >= 0.5)
  ) {
    recommendation = 'DOWNGRADE_TO_CANDIDATE_ONLY';
    reasons.push('Generic AI/IT source collected many candidates but produced no eligible or rendered main article contribution.');
  } else if (metrics.source_gap_rate >= 0.5 || metrics.source_gap_count >= 2) {
    recommendation = 'REVIEW_SOURCE_OR_PARSER';
    reasons.push('Source gap rate is high; inspect source URLs and parser extraction before changing source policy.');
  } else if (
    !officialLike(source) &&
    metrics.collected_count >= 3 &&
    metrics.eligible_count === 0 &&
    metrics.rendered_main_count === 0
  ) {
    recommendation = 'DISABLE_OR_REVIEW';
    reasons.push('Non-official source collected multiple candidates without eligible or rendered contribution.');
  }

  if (metrics.duplicate_count > 0) {
    reasons.push(`Duplicate candidates detected: within_source=${metrics.duplicate_within_source_count}, across_sources=${metrics.duplicate_across_sources_count}.`);
  }
  if (metrics.source_gap_count > 0) {
    reasons.push('Source gap candidates may indicate source URL, dated evidence, or parser repair work.');
  }
  if (metrics.generic_noise_count > 0) {
    reasons.push('Generic noise candidates were detected from artifact exclusion metadata.');
  }

  return {
    recommendation,
    reasons: uniqueSorted(reasons)
  };
}

function finalizeState(state) {
  const source = state.source;
  const uniqueEntries = [...state.entriesByKey.entries()];
  const metrics = {
    collected_count: uniqueEntries.length,
    eligible_count: 0,
    selected_count: state.selectedKeys.size,
    rendered_main_count: state.renderedKeys.size,
    source_gap_count: 0,
    camera_relevant_raw_count: 0,
    parser_repair_reason_count: 0,
    reference_only_count: 0,
    watchlist_count: 0,
    main_eligible_false_count: 0,
    briefing_only_count: 0,
    duplicate_count: 0,
    duplicate_within_source_count: 0,
    duplicate_across_sources_count: state.duplicateAcrossKeys.size,
    generic_noise_count: 0
  };
  const selectedUrls = new Set(state.selectedUrls);
  const excludedUrls = new Set();
  const sourceGapKeys = new Set();

  for (const [key, entries] of uniqueEntries) {
    const candidates = entries.map(entry => entry.candidate);
    const firstUrl = entries.map(entry => entry.url).find(Boolean);
    const eligible = candidates.some(isEligibleCandidate);
    const sourceGap = candidates.some(candidate => candidate.source_gap_risk === true);
    const referenceOnly = candidates.some(candidate => candidate.reference_only === true);
    const watchlist = candidates.some(isWatchlistCandidate);
    const mainEligibleFalse = candidates.some(candidate => candidate.main_eligible === false);
    const briefingOnly = candidates.some(candidate => candidate.briefing_only === true);
    const genericNoise = candidates.some(candidate => genericNoiseCandidate(candidate, source));
    const cameraRelevant = candidates.some(cameraRelevantRawSignal);

    if (eligible) metrics.eligible_count += 1;
    if (cameraRelevant) metrics.camera_relevant_raw_count += 1;
    if (sourceGap) {
      metrics.source_gap_count += 1;
      sourceGapKeys.add(key);
    }
    if (referenceOnly) metrics.reference_only_count += 1;
    if (watchlist) metrics.watchlist_count += 1;
    if (mainEligibleFalse) metrics.main_eligible_false_count += 1;
    if (briefingOnly) metrics.briefing_only_count += 1;
    if (genericNoise) metrics.generic_noise_count += 1;
    if (entries.length > 1) metrics.duplicate_within_source_count += entries.length - 1;

    if (!eligible && firstUrl) excludedUrls.add(firstUrl);
    if (state.selectedKeys.has(key) && firstUrl) selectedUrls.add(firstUrl);

    if (!eligible || sourceGap || genericNoise) {
      const reasons = uniqueSorted(candidates.flatMap(candidateExclusionReasons));
      if (reasons.some(parserRepairReason)) metrics.parser_repair_reason_count += 1;
      for (const reason of reasons) incrementReason(state, reason);
    }
  }

  for (const key of state.factCheckGapKeys) {
    if (!sourceGapKeys.has(key)) metrics.source_gap_count += 1;
  }

  metrics.duplicate_count = metrics.duplicate_within_source_count + metrics.duplicate_across_sources_count;
  metrics.eligible_rate = safeRate(metrics.eligible_count, metrics.collected_count);
  metrics.selection_rate = safeRate(metrics.selected_count, metrics.eligible_count);
  metrics.rendered_rate = safeRate(metrics.rendered_main_count, metrics.selected_count);
  metrics.source_gap_rate = safeRate(metrics.source_gap_count, metrics.collected_count);
  metrics.noise_rate = safeRate(metrics.generic_noise_count, metrics.collected_count);
  metrics.effectiveness_score = rounded(clamp(
    metrics.eligible_rate * 35 +
      metrics.selection_rate * 25 +
      metrics.rendered_rate * 30 +
      (metrics.rendered_main_count > 0 ? 10 : 0) -
      metrics.source_gap_rate * 25 -
      metrics.noise_rate * 20 -
      safeRate(metrics.duplicate_count, metrics.collected_count) * 10,
    0,
    100
  ), 2);

  const recommendation = recommendationFor(source, metrics);

  return {
    source_id: source.source_id,
    source_name: source.source_name,
    source_url: source.source_url,
    rss_url: source.rss_url,
    category: source.category,
    priority: source.priority,
    reliability: source.reliability,
    enabled: source.enabled,
    candidate_only: source.candidate_only,
    collection_mode_hint: source.collection_mode_hint,
    synthetic: source.synthetic,
    ...metrics,
    recommendation: recommendation.recommendation,
    reasons: recommendation.reasons,
    top_exclusion_reasons: sortedReasonRows(state.reasonCounts),
    sample_selected_urls: uniqueSorted([...selectedUrls]).slice(0, MAX_SAMPLE_URLS),
    sample_excluded_urls: uniqueSorted([...excludedUrls]).slice(0, MAX_SAMPLE_URLS)
  };
}

function sourceSort(a, b) {
  return compareText(a.source_id, b.source_id);
}

function recommendationSort(a, b) {
  const left = RECOMMENDATION_ORDER.indexOf(a.recommendation);
  const right = RECOMMENDATION_ORDER.indexOf(b.recommendation);
  return left - right ||
    b.effectiveness_score - a.effectiveness_score ||
    b.rendered_main_count - a.rendered_main_count ||
    compareText(a.source_id, b.source_id);
}

function buildSourceEffectivenessReport(options = {}) {
  const date = text(options.date);
  const warnings = new Set(ensureArray(options.warnings));
  const sourceRegistry = options.sourceRegistry || {};
  const collectedCandidates = ensureArray(options.collectedCandidates?.candidates);
  const shortlistReport = options.shortlistReport || {};
  const reporterCandidates = options.reporterCandidates || {};
  const editorDraft = options.editorDraft || null;
  const registryIndex = buildRegistryIndex(sourceRegistry);
  const syntheticSources = new Map();
  const states = new Map();
  const keySources = new Map();
  const knownCandidateKeys = new Set();
  const candidatesByKey = new Map();

  function ensureState(source) {
    if (!states.has(source.source_id)) states.set(source.source_id, sourceState(source));
    return states.get(source.source_id);
  }

  for (const source of registryIndex.sources) ensureState(source);

  for (const candidate of collectedCandidates) {
    const registered = registeredSourceForCandidate(candidate, registryIndex, warnings);
    const source = registered || syntheticSourceForCandidate(candidate, syntheticSources, warnings);
    const state = ensureState(source);
    const key = candidateIdentityKey(candidate);
    const url = canonicalCandidateUrl(candidate);
    knownCandidateKeys.add(key);
    if (!candidatesByKey.has(key)) candidatesByKey.set(key, []);
    candidatesByKey.get(key).push({ candidate, source_id: source.source_id });
    if (!state.entriesByKey.has(key)) state.entriesByKey.set(key, []);
    state.entriesByKey.get(key).push({ candidate, key, url });
    if (!keySources.has(key)) keySources.set(key, new Set());
    keySources.get(key).add(source.source_id);
  }

  for (const [key, sourceIds] of keySources.entries()) {
    if (key.startsWith('missing-url:') || sourceIds.size < 2) continue;
    for (const sourceId of sourceIds) {
      ensureState(states.get(sourceId)?.source || syntheticSources.get(sourceId)).duplicateAcrossKeys.add(key);
    }
  }

  for (const candidate of collectCandidatesFromShortlist(shortlistReport, reporterCandidates)) {
    if (!isSelectedCandidate(candidate)) continue;
    const key = candidateIdentityKey(candidate);
    const url = canonicalCandidateUrl(candidate);
    knownCandidateKeys.add(key);
    const registered = registeredSourceForCandidate(candidate, registryIndex, warnings);
    const fallbackSourceIds = keySources.get(key);
    const source = registered ||
      (fallbackSourceIds && fallbackSourceIds.size === 1 ? states.get([...fallbackSourceIds][0]).source : null) ||
      syntheticSourceForCandidate(candidate, syntheticSources, warnings);
    const state = ensureState(source);
    state.selectedKeys.add(key);
    if (url) state.selectedUrls.add(url);
  }

  if (editorDraft) {
    const rendered = renderedSectionMatches(editorDraft, knownCandidateKeys);
    for (const message of rendered.unmatched) warnings.add(message);
    for (const match of rendered.matches) {
      const candidates = ensureArray(candidatesByKey.get(match.key));
      const candidateSource = candidates.find(item => item.source_id && states.has(item.source_id));
      const fallbackSourceIds = keySources.get(match.key);
      const source = candidateSource
        ? states.get(candidateSource.source_id).source
        : fallbackSourceIds && fallbackSourceIds.size === 1
          ? states.get([...fallbackSourceIds][0]).source
          : null;
      if (!source) {
        warnings.add(`Rendered section source URL matched a candidate but not a unique source: ${match.url}`);
        continue;
      }
      const state = ensureState(source);
      state.renderedKeys.add(match.key);
      state.renderedUrls.add(match.url);
    }
  }

  if (options.factCheckReport) {
    applyFactCheckSourceGaps(options.factCheckReport, states, keySources, warnings);
  }

  const sources = [...states.values()]
    .map(finalizeState)
    .sort(sourceSort);
  const summary = {
    source_count: sources.length,
    registry_source_count: registryIndex.sources.length,
    synthetic_source_count: sources.filter(source => source.synthetic).length,
    unregistered_candidate_count: sources
      .filter(source => source.synthetic)
      .reduce((sum, source) => sum + source.collected_count, 0),
    collected_count: sources.reduce((sum, source) => sum + source.collected_count, 0),
    eligible_count: sources.reduce((sum, source) => sum + source.eligible_count, 0),
    selected_count: sources.reduce((sum, source) => sum + source.selected_count, 0),
    rendered_main_count: sources.reduce((sum, source) => sum + source.rendered_main_count, 0),
    source_gap_count: sources.reduce((sum, source) => sum + source.source_gap_count, 0),
    generic_noise_count: sources.reduce((sum, source) => sum + source.generic_noise_count, 0),
    duplicate_count: sources.reduce((sum, source) => sum + source.duplicate_count, 0),
    recommendation_counts: RECOMMENDATION_ORDER.map(recommendation => ({
      recommendation,
      count: sources.filter(source => source.recommendation === recommendation).length
    })).filter(item => item.count > 0)
  };

  return {
    schema_version: SCHEMA_VERSION,
    date,
    inputs: {
      collected_candidates: collectedCandidatesRelPath(date),
      shortlisted_candidates: newsroomRelPath(date, 'shortlisted-candidates.json'),
      source_registry: 'data/news-sources.json',
      optional_artifacts: optionalArtifactPaths(date, options)
    },
    summary,
    sources,
    warnings: uniqueSorted([...warnings])
  };
}

function markdownEscape(value) {
  return text(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function markdownTable(headers, rows) {
  if (rows.length === 0) return '_없음_\n';
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`
  ];
  for (const row of rows) {
    lines.push(`| ${row.map(markdownEscape).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

function recommendationCountText(summary) {
  return ensureArray(summary.recommendation_counts)
    .map(item => `${item.recommendation}: ${item.count}`)
    .join(', ') || 'none';
}

function renderSourceEffectivenessMarkdown(report) {
  const sources = ensureArray(report.sources);
  const lines = [
    '# Source Effectiveness Report',
    '',
    `Date: ${report.date}`,
    '',
    '## Summary',
    '',
    `- Sources: ${report.summary.source_count} (registry=${report.summary.registry_source_count}, synthetic=${report.summary.synthetic_source_count})`,
    `- Collected candidates: ${report.summary.collected_count}`,
    `- Unregistered candidates: ${report.summary.unregistered_candidate_count}`,
    `- Eligible candidates: ${report.summary.eligible_count}`,
    `- Selected candidates: ${report.summary.selected_count}`,
    `- Rendered main articles: ${report.summary.rendered_main_count}`,
    `- Source gap candidates: ${report.summary.source_gap_count}`,
    `- Generic noise candidates: ${report.summary.generic_noise_count}`,
    `- Duplicate candidates: ${report.summary.duplicate_count}`,
    `- Recommendations: ${recommendationCountText(report.summary)}`,
    '',
    '## Top Effective Sources',
    '',
    markdownTable(
      ['Source', 'Recommendation', 'Score', 'Collected', 'Eligible', 'Selected', 'Rendered'],
      sources
        .filter(source => source.rendered_main_count > 0)
        .sort((a, b) => b.effectiveness_score - a.effectiveness_score ||
          b.rendered_main_count - a.rendered_main_count ||
          compareText(a.source_id, b.source_id))
        .map(source => [
          source.source_id,
          source.recommendation,
          source.effectiveness_score,
          source.collected_count,
          source.eligible_count,
          source.selected_count,
          source.rendered_main_count
        ])
    ),
    '## Sources Needing Parser Repair',
    '',
    markdownTable(
      ['Source', 'Recommendation', 'Collected', 'Eligible', 'Source Gap', 'Top Reason'],
      sources
        .filter(source => ['OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR', 'KEEP_AND_FIX_PARSER'].includes(source.recommendation))
        .sort(recommendationSort)
        .map(source => [
          source.source_id,
          source.recommendation,
          source.collected_count,
          source.eligible_count,
          source.source_gap_count,
          source.top_exclusion_reasons[0]?.reason || ''
        ])
    ),
    '## Generic Noise / Downgrade Candidates',
    '',
    markdownTable(
      ['Source', 'Recommendation', 'Collected', 'Noise Rate', 'Source Gap Rate', 'Top Reason'],
      sources
        .filter(source => source.recommendation === 'DOWNGRADE_TO_CANDIDATE_ONLY')
        .sort(recommendationSort)
        .map(source => [
          source.source_id,
          source.recommendation,
          source.collected_count,
          source.noise_rate,
          source.source_gap_rate,
          source.top_exclusion_reasons[0]?.reason || ''
        ])
    ),
    '## Source Details',
    '',
    markdownTable(
      ['Source', 'Recommendation', 'Score', 'Collected', 'Eligible Rate', 'Selection Rate', 'Rendered Rate', 'Gap Rate', 'Noise Rate', 'Duplicates'],
      sources
        .slice()
        .sort(recommendationSort)
        .map(source => [
          source.source_id,
          source.recommendation,
          source.effectiveness_score,
          source.collected_count,
          source.eligible_rate,
          source.selection_rate,
          source.rendered_rate,
          source.source_gap_rate,
          source.noise_rate,
          source.duplicate_count
        ])
    ),
    '## Warnings',
    '',
    ensureArray(report.warnings).length === 0
      ? '_없음_'
      : ensureArray(report.warnings).slice().sort(compareText).map(warning => `- ${warning}`).join('\n'),
    ''
  ];

  return lines.join('\n');
}

function relPath(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/') || filePath;
}

function readRequiredJson(root, filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required input ${label}: ${relPath(root, filePath)}`);
  }
  try {
    return readJson(filePath);
  } catch (error) {
    throw new Error(`Invalid required input ${label}: ${relPath(root, filePath)}: ${error.message}`);
  }
}

function readOptionalJson(root, filePath, label, warnings) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing optional artifact ${relPath(root, filePath)}; related metrics remain zero or artifact-limited.`);
    return null;
  }
  try {
    return readJson(filePath);
  } catch (error) {
    warnings.push(`Invalid optional artifact ${relPath(root, filePath)} skipped: ${error.message}`);
    return null;
  }
}

function optionalArtifactPaths(date, options = {}) {
  const provided = options.optionalArtifactPaths || {};
  return {
    reporter_candidates: Object.prototype.hasOwnProperty.call(provided, 'reporter_candidates')
      ? provided.reporter_candidates
      : options.reporterCandidates ? newsroomRelPath(date, 'reporter-candidates.json') : null,
    editor_draft: Object.prototype.hasOwnProperty.call(provided, 'editor_draft')
      ? provided.editor_draft
      : options.editorDraft ? newsroomRelPath(date, 'editor-draft.json') : null,
    fact_check_report: Object.prototype.hasOwnProperty.call(provided, 'fact_check_report')
      ? provided.fact_check_report
      : options.factCheckReport ? newsroomRelPath(date, 'fact-check-report.json') : null,
    quality_report: Object.prototype.hasOwnProperty.call(provided, 'quality_report')
      ? provided.quality_report
      : options.qualityReport ? newsroomRelPath(date, 'quality-report.json') : null
  };
}

function existingOptionalArtifactPath(filePath, rel) {
  return fs.existsSync(filePath) ? rel : null;
}

function loadSourceEffectivenessInputs(root, date) {
  const resolvedRoot = path.resolve(root || process.cwd());
  const dateNewsroomDir = newsroomDir(resolvedRoot, date);
  const warnings = [];
  const reporterCandidatesRelPath = newsroomRelPath(date, 'reporter-candidates.json');
  const editorDraftRelPath = newsroomRelPath(date, 'editor-draft.json');
  const factCheckReportRelPath = newsroomRelPath(date, 'fact-check-report.json');
  const qualityReportRelPath = newsroomRelPath(date, 'quality-report.json');
  const reporterCandidatesPath = path.join(dateNewsroomDir, 'reporter-candidates.json');
  const editorDraftPath = path.join(dateNewsroomDir, 'editor-draft.json');
  const factCheckReportPath = path.join(dateNewsroomDir, 'fact-check-report.json');
  const qualityReportPath = path.join(dateNewsroomDir, 'quality-report.json');
  return {
    date,
    warnings,
    optionalArtifactPaths: {
      reporter_candidates: existingOptionalArtifactPath(reporterCandidatesPath, reporterCandidatesRelPath),
      editor_draft: existingOptionalArtifactPath(editorDraftPath, editorDraftRelPath),
      fact_check_report: existingOptionalArtifactPath(factCheckReportPath, factCheckReportRelPath),
      quality_report: existingOptionalArtifactPath(qualityReportPath, qualityReportRelPath)
    },
    sourceRegistry: readRequiredJson(
      resolvedRoot,
      path.join(resolvedRoot, 'data', 'news-sources.json'),
      'data/news-sources.json'
    ),
    collectedCandidates: readRequiredJson(
      resolvedRoot,
      collectedCandidatesPath(resolvedRoot, date),
      collectedCandidatesRelPath(date)
    ),
    shortlistReport: readRequiredJson(
      resolvedRoot,
      path.join(dateNewsroomDir, 'shortlisted-candidates.json'),
      newsroomRelPath(date, 'shortlisted-candidates.json')
    ),
    reporterCandidates: readOptionalJson(
      resolvedRoot,
      reporterCandidatesPath,
      reporterCandidatesRelPath,
      warnings
    ),
    editorDraft: readOptionalJson(
      resolvedRoot,
      editorDraftPath,
      editorDraftRelPath,
      warnings
    ),
    factCheckReport: readOptionalJson(
      resolvedRoot,
      factCheckReportPath,
      factCheckReportRelPath,
      warnings
    ),
    qualityReport: readOptionalJson(
      resolvedRoot,
      qualityReportPath,
      qualityReportRelPath,
      warnings
    )
  };
}

function writeSourceEffectivenessArtifacts(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const date = text(options.date) || kstDate();
  const inputs = options.inputs || loadSourceEffectivenessInputs(root, date);
  const report = buildSourceEffectivenessReport({ ...inputs, date });
  const markdown = renderSourceEffectivenessMarkdown(report);
  const outDir = newsroomDir(root, date);
  const jsonPath = path.join(outDir, 'source-effectiveness-report.json');
  const markdownPath = path.join(outDir, 'source-effectiveness-report.md');
  writeJson(jsonPath, report);
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  return { report, markdown, jsonPath, markdownPath };
}

module.exports = {
  RECOMMENDATION_ORDER,
  buildSourceEffectivenessReport,
  loadSourceEffectivenessInputs,
  renderSourceEffectivenessMarkdown,
  writeSourceEffectivenessArtifacts
};
