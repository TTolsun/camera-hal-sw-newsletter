const {
  isFinalSelected
} = require('../generate/selection-diagnostics');
const {
  normalizeUrl,
  normalizedUrlHash
} = require('../generate/newsroom-selection');
const {
  BUCKETS,
  BUCKET_PRIORITY,
  classifyAospCameraStackCandidate
} = require('../common/aosp-camera-scope');
const {
  articlePolicy,
  qualityGatePolicy,
  articleCountRangeText,
  isForbiddenMainBucket,
  isPrimaryCameraStackBucket,
  isSupportingMainBucket,
  publishGateCriteriaText
} = require('../common/newsletter-policy');
const {
  IMPACT_TYPES,
  RECOMMENDED_ARTICLE_TYPES
} = require('../evidence/impact-classifier');
const {
  findFieldHygieneIssues,
  inferImpactClaimLevel
} = require('../generate/article-field-builder');
const {
  ARTICLE_SECTION_KEYS,
  articleSectionSummary,
  normalizeArticleSections
} = require('../common/article-section-contract');

// Legacy compatibility exports only. New quality code should prefer qualityGatePolicy and articlePolicy.
const QUALITY_THRESHOLD = qualityGatePolicy.threshold;
const MIN_MAIN_ARTICLES = articlePolicy.mainArticleCount.min;
const MAX_MAIN_ARTICLES = articlePolicy.mainArticleCount.max;
function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return String(value || '').trim();
}

function sectionText(section) {
  const articleSections = normalizeArticleSections(section);
  return [
    section.category,
    section.headline,
    articleSections.verified_facts,
    articleSections.background_context,
    articleSections.hal_driver_impact,
    articleSections.action_items,
    articleSections.team_share_points,
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes,
    section.camera_hal_checks,
    section.sources
  ].map(text).join(' ');
}

function normalizeForMatch(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function urlKeys(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const keys = new Set([raw, raw.toLowerCase()]);
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    const normalized = parsed.toString().replace(/\/$/, '');
    keys.add(normalized);
    keys.add(normalized.toLowerCase());
  } catch {
    keys.add(raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase());
  }
  return [...keys].filter(Boolean);
}

function normalizedUrlKey(value) {
  return normalizeUrl(value) || text(value).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
}

function candidateUrls(candidate = {}) {
  return [...new Set([
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.normalized_url
  ].map(text).filter(Boolean))];
}

function candidateCanonicalUrl(candidate = {}) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl || candidate.normalized_url);
}

function candidateHash(candidate = {}) {
  const candidateUrl = candidateCanonicalUrl(candidate);
  return text(candidate.source_candidate_hash || candidate.url_hash || candidate.normalized_url_hash) ||
    (candidateUrl ? normalizedUrlHash(candidateUrl) : '');
}

function candidateIdentity(candidate = {}) {
  return [
    normalizedUrlKey(candidateCanonicalUrl(candidate)),
    normalizeForMatch(candidate.source_id),
    normalizeForMatch(candidate.title),
    normalizeForMatch(candidate.published_date || candidate.publishedAt),
    normalizeForMatch(candidate.version_or_release || candidate.versionOrRelease),
    normalizeForMatch(candidate.api_or_component || candidate.apiOrComponent)
  ].join('|');
}

function pushCandidateEntries(entries, candidates, priority, source) {
  const seen = new Set(entries.map(entry => `${entry.priority}|${candidateIdentity(entry.candidate)}`));
  for (const candidate of ensureArray(candidates)) {
    const id = `${priority}|${candidateIdentity(candidate)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ candidate, priority, source });
  }
}

function candidateBindingIndex(reporter = {}, shortlistReport = null) {
  const entries = [];
  const primarySelected = ensureArray(shortlistReport?.primary_selected_articles);
  const flaggedSelected = ensureArray(shortlistReport?.shortlisted_candidates).filter(candidate =>
    candidate?.final_selected === true || candidate?.primary_selected === true || candidate?.selected_for_editor === true
  );
  pushCandidateEntries(
    entries,
    [
      ...primarySelected,
      ...ensureArray(shortlistReport?.selected_articles),
      ...flaggedSelected
    ],
    1,
    'shortlist_selected'
  );
  pushCandidateEntries(
    entries,
    [
      ...ensureArray(shortlistReport?.reserve_candidates),
      ...ensureArray(shortlistReport?.demoted_candidates),
      ...ensureArray(shortlistReport?.excluded_candidates),
      ...ensureArray(shortlistReport?.shortlisted_candidates).filter(candidate =>
        candidate?.final_selected !== true && candidate?.primary_selected !== true && candidate?.selected_for_editor !== true
      )
    ],
    2,
    'shortlist_other'
  );
  pushCandidateEntries(entries, ensureArray(reporter?.candidates), 3, 'reporter_candidate');

  const byUrl = new Map();
  for (const entry of entries) {
    const entryUrlKeys = new Set();
    for (const url of candidateUrls(entry.candidate)) {
      const key = normalizedUrlKey(url);
      if (!key || entryUrlKeys.has(key)) continue;
      entryUrlKeys.add(key);
      if (!byUrl.has(key)) byUrl.set(key, []);
      byUrl.get(key).push(entry);
    }
  }
  return { byUrl, entries };
}

function sourceEvidence(section) {
  return [
    section?.headline,
    section?.category,
    section?.what_changed,
    section?.confirmed_facts,
    section?.evidence_summary,
    section?.specificity_checks,
    section?.source_verification_notes,
    section?.sources
  ].map(text).join(' ');
}

function normalizedTokens(value) {
  return normalizeForMatch(value)
    .split(/\s+/)
    .filter(token => token.length >= 3);
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(normalizedTokens(left));
  const rightTokens = new Set(normalizedTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function candidateTitleSimilarity(section, candidate) {
  const sectionLabels = [
    section?.headline,
    ...ensureArray(section?.sources).flatMap(source => [source?.title, source?.url])
  ];
  return Math.max(0, ...sectionLabels.map(label => tokenSimilarity(label, candidate?.title)));
}

function dateTokens(value) {
  const raw = text(value);
  const tokens = new Set();
  for (const match of raw.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    tokens.add(`${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`);
  }
  for (const match of raw.matchAll(/\b(20\d{2})\s*\uB144\s*(\d{1,2})\s*\uC6D4\s*(\d{1,2})\s*\uC77C\b/g)) {
    tokens.add(`${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`);
  }
  const monthPattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/gi;
  const months = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12'
  };
  for (const match of raw.matchAll(monthPattern)) {
    tokens.add(`${match[3]}-${months[match[1].slice(0, 3).toLowerCase()]}-${String(match[2]).padStart(2, '0')}`);
  }
  const parsed = raw.length <= 80 && /\b20\d{2}\b/.test(raw) ? Date.parse(raw) : NaN;
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    tokens.add(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`);
  }
  return tokens;
}

function valueAppearsInSection(section, value) {
  const needle = normalizeForMatch(value);
  if (!needle || needle.length < 3) return false;
  return normalizeForMatch(sourceEvidence(section)).includes(needle);
}

function candidateDateMatchesSection(section, candidate) {
  const candidateDates = dateTokens(candidate?.published_date || candidate?.publishedAt);
  if (candidateDates.size === 0) return false;
  const sectionDates = dateTokens(sourceEvidence(section));
  return [...candidateDates].some(date => sectionDates.has(date));
}

function candidateVersionMatchesSection(section, candidate) {
  return valueAppearsInSection(section, candidate?.version_or_release || candidate?.versionOrRelease);
}

function candidateApiMatchesSection(section, candidate) {
  const api = text(candidate?.api_or_component || candidate?.apiOrComponent);
  if (!api || /^api$/i.test(api)) return false;
  return valueAppearsInSection(section, api);
}

function sectionSourceIdMatches(section, candidate) {
  const haystack = normalizeForMatch([
    section?.headline,
    section?.sources
  ]);
  return [
    candidate?.source_id,
    candidate?.source,
    candidate?.source_name
  ].some(value => {
    const normalized = normalizeForMatch(value);
    return normalized && haystack.includes(normalized);
  });
}

function bindingTieBreakScore(section, entry) {
  const candidate = entry.candidate;
  let score = 0;
  if (sectionSourceIdMatches(section, candidate)) score += 8;
  score += candidateTitleSimilarity(section, candidate) * 6;
  if (candidateDateMatchesSection(section, candidate)) score += 4;
  if (candidateVersionMatchesSection(section, candidate)) score += 4;
  if (candidateApiMatchesSection(section, candidate)) score += 2;
  return Number(score.toFixed(4));
}

function isSharedWatchOrReleaseNoteUrl(entry, sameUrlEntries) {
  const candidate = entry?.candidate || {};
  if (ensureArray(sameUrlEntries).length > 1) return true;
  return /release-note|watch|documentation_page|watchlist/i.test([
    candidate.collectionMode,
    candidate.collection_mode,
    candidate.sourceCollectionMode,
    candidate.source_collection_mode,
    candidate.source_kind
  ].map(text).join(' '));
}

function sharedUrlEvidenceMatches(section, entry, sameUrlEntries) {
  if (!isSharedWatchOrReleaseNoteUrl(entry, sameUrlEntries)) return true;
  return candidateVersionMatchesSection(section, entry.candidate) || candidateDateMatchesSection(section, entry.candidate);
}

function candidateConsistencyViolation(section, candidate) {
  const sectionTextValue = sourceEvidence(section);
  const sectionDates = dateTokens(sectionTextValue);
  const candidateDates = dateTokens(candidate?.published_date || candidate?.publishedAt);
  if (candidateDates.size > 0 && sectionDates.size > 0 && ![...candidateDates].some(date => sectionDates.has(date))) {
    return 'published_date mismatch';
  }
  const version = text(candidate?.version_or_release || candidate?.versionOrRelease);
  if (version && !candidateVersionMatchesSection(section, candidate) && /\b(?:v?\d+(?:\.\d+)+|20\d{2}|C\+\+\d{2}|Android\s+\d+)\b/i.test(sectionTextValue)) {
    return 'version_or_release mismatch';
  }
  const api = text(candidate?.api_or_component || candidate?.apiOrComponent);
  if (api && !/^api$/i.test(api) && !candidateApiMatchesSection(section, candidate) && candidateTitleSimilarity(section, candidate) < 0.2) {
    return 'api_or_component mismatch';
  }
  return '';
}

function bindCandidateForSection(section, bindingIndex) {
  const sourceUrls = [
    section?.source_candidate_url,
    ...ensureArray(section?.sources).map(source => source?.url)
  ].map(text).filter(Boolean);
  const checked = new Set();
  for (const sourceUrl of sourceUrls) {
    const key = normalizedUrlKey(sourceUrl);
    if (!key || checked.has(key)) continue;
    checked.add(key);
    const matches = ensureArray(bindingIndex?.byUrl?.get(key));
    if (matches.length === 0) continue;
    const bestPriority = Math.min(...matches.map(entry => entry.priority));
    const priorityMatches = matches.filter(entry => entry.priority === bestPriority);
    const scored = priorityMatches
      .map(entry => ({ ...entry, tie_score: bindingTieBreakScore(section, entry) }))
      .sort((a, b) => b.tie_score - a.tie_score || String(a.candidate?.title || '').localeCompare(String(b.candidate?.title || '')));
    const best = scored[0];
    const tied = scored.filter(entry => entry.tie_score === best.tie_score);
    if (tied.length > 1) {
      return {
        status: 'ambiguous',
        reason: `Ambiguous source candidate match for normalized URL: ${key}.`,
        source_url: sourceUrl,
        candidates: tied.map(entry => ({
          title: text(entry.candidate?.title),
          source: text(entry.source),
          published_date: text(entry.candidate?.published_date || entry.candidate?.publishedAt),
          version_or_release: text(entry.candidate?.version_or_release || entry.candidate?.versionOrRelease)
        }))
      };
    }
    if (!sharedUrlEvidenceMatches(section, best, matches)) {
      return {
        status: 'evidence_mismatch',
        reason: 'Shared watch/release-note URL requires matching version_or_release or published_date evidence.',
        source_url: sourceUrl,
        candidate: best.candidate,
        binding_source: best.source
      };
    }
    const consistencyViolation = candidateConsistencyViolation(section, best.candidate);
    if (consistencyViolation) {
      return {
        status: 'evidence_mismatch',
        reason: `Article evidence conflicts with bound candidate metadata: ${consistencyViolation}.`,
        source_url: sourceUrl,
        candidate: best.candidate,
        binding_source: best.source
      };
    }
    return {
      status: 'bound',
      reason: '',
      source_url: sourceUrl,
      candidate: best.candidate,
      binding_source: best.source,
      tie_score: best.tie_score
    };
  }
  return {
    status: 'missing',
    reason: 'No reporter/shortlist source candidate matches this main article source URL.',
    source_url: sourceUrls[0] || ''
  };
}

function candidateSelectionViolation(candidate) {
  if (!candidate) return '';
  const violations = [];
  const finalSelectionEligibility = text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
  const hasDatedEvidence = typeof candidate.hasDatedEvidence === 'boolean'
    ? candidate.hasDatedEvidence
    : candidate.has_dated_evidence;
  const isWatchPage = typeof candidate.isWatchPage === 'boolean'
    ? candidate.isWatchPage
    : candidate.is_watch_page;
  if (!['main', 'short'].includes(finalSelectionEligibility)) {
    violations.push(`finalSelectionEligibility=${finalSelectionEligibility || 'unknown'}`);
  }
  if (hasDatedEvidence !== true) violations.push('missing dated evidence');
  if (isWatchPage === true && hasDatedEvidence !== true) {
    violations.push('watch page lacks dated evidence');
  }
  if (candidate.main_eligible === false) violations.push('main_eligible=false');
  if (candidate.source_gap_risk === true) violations.push('source_gap_risk=true');
  if (candidate.reference_only === true) violations.push('reference_only=true');
  return violations.join('; ');
}

function hasPattern(value, pattern) {
  return pattern.test(text(value));
}

function boundedDeduct(state, category, points, reason, location = '', options = {}) {
  if (points <= 0) return;
  const blocking = options.blocking !== false;
  state.deductions.push({
    category,
    points,
    reason,
    location,
    blocking,
    severity: options.severity || (blocking ? 'hard' : 'soft')
  });
}

const LINKED_EVIDENCE_UNRESOLVED_STATUSES = Object.freeze([
  'blocked',
  'failed',
  'skipped',
  'unsupported'
]);

const LINKED_EVIDENCE_RUNTIME_TERMS = /\b(?:stream|buffer|metadata|request|result|ImageCapture|VideoCapture|Surface|CameraPipe)\b/i;
const LINKED_EVIDENCE_RUNTIME_CLAIM = /\b(?:HAL runtime|runtime behavior|product behavior|implementation change|camera pipeline|stream|buffer|metadata|request|result|ImageCapture|VideoCapture|Surface|CameraPipe)\b[^.\n]{0,90}\b(?:change|changed|fix|fixed|impact|affect|improve|regression|behavior|implementation|runtime)\b|\b(?:change|changed|fix|fixed|impact|affect|improve|regression|behavior|implementation|runtime)\b[^.\n]{0,90}\b(?:HAL runtime|runtime behavior|product behavior|camera pipeline|stream|buffer|metadata|request|result|ImageCapture|VideoCapture|Surface|CameraPipe)\b/i;
const LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM = /\b(?:Gerrit|IssueTracker|Issue Tracker|GitHub|mailing list|CVE|linked evidence)\b[^.\n]{0,90}\b(?:confirm|confirmed|proves?|verified|resolved|landed|merged|shows?|fix(?:ed|es)?)\b|\b(?:confirm|confirmed|proves?|verified|resolved|landed|merged|shows?|fix(?:ed|es)?)\b[^.\n]{0,90}\b(?:Gerrit|IssueTracker|Issue Tracker|GitHub|mailing list|CVE|linked evidence)\b/i;
const LINKED_EVIDENCE_HIGH_IMPACT_CLAIM = /\b(?:high|direct|confirmed|runtime|pipeline|HAL)\b[^.\n]{0,80}\b(?:impact|effect|risk|regression|behavior change)\b/i;
const LINKED_EVIDENCE_LIMITATION_NOTE = /\b(?:unresolved|blocked|failed|skipped|unsupported|not fetched|not_fetched|limited|diagnostic|not confirmed|not resolved)\b/i;

function linkedEvidenceArticleText(section) {
  return [
    section?.headline,
    section?.what_changed,
    section?.background,
    section?.why_it_matters,
    section?.camera_hal_perspective,
    section?.evidence_summary,
    section?.confirmed_facts,
    section?.source_verification_notes,
    section?.action_items
  ].map(text).join(' ');
}

function linkedEvidenceEvidenceText(section) {
  return [
    section?.evidence_summary,
    section?.confirmed_facts,
    section?.source_verification_notes
  ].map(text).join(' ');
}

function linkedEvidenceNotesText(section) {
  return text(section?.source_verification_notes);
}

function linkedEvidenceDiagnostics(candidate = {}) {
  const hasSummary = Object.prototype.hasOwnProperty.call(candidate, 'linked_evidence_summary') ||
    Object.prototype.hasOwnProperty.call(candidate, 'linkedEvidenceSummary');
  const hasImpact = Object.prototype.hasOwnProperty.call(candidate, 'impact_classification') ||
    Object.prototype.hasOwnProperty.call(candidate, 'impactClassification');
  if (!hasSummary && !hasImpact) {
    return {
      present: false,
      malformed: false,
      hasLinkedEvidence: false,
      hasUnresolvedEvidence: false,
      summary: null,
      impact: null
    };
  }

  const summary = candidate.linked_evidence_summary || candidate.linkedEvidenceSummary;
  const impact = candidate.impact_classification || candidate.impactClassification;
  const summaryIsObject = !hasSummary || (summary && typeof summary === 'object' && !Array.isArray(summary));
  const impactIsObject = !hasImpact || (impact && typeof impact === 'object' && !Array.isArray(impact));
  let malformed = hasSummary !== hasImpact || !summaryIsObject || !impactIsObject;
  const totalCount = summaryIsObject ? Number(summary?.total_count) : 0;
  if (hasSummary && !Number.isFinite(totalCount)) malformed = true;
  if (Number.isFinite(totalCount) && totalCount > 0 && !impactIsObject) malformed = true;

  const byFetchStatus = summaryIsObject && summary?.by_fetch_status && typeof summary.by_fetch_status === 'object'
    ? summary.by_fetch_status
    : {};
  const hasUnresolvedEvidence = summaryIsObject && (
    summary?.has_unresolved_evidence === true ||
    LINKED_EVIDENCE_UNRESOLVED_STATUSES.some(status => Number(byFetchStatus[status] || 0) > 0)
  );
  return {
    present: true,
    malformed,
    hasLinkedEvidence: Number.isFinite(totalCount) && totalCount > 0,
    hasUnresolvedEvidence,
    summary: summaryIsObject ? summary : null,
    impact: impactIsObject ? impact : null
  };
}

function addLinkedEvidenceQualityDeductions(state, section, candidate, location) {
  const diagnostics = linkedEvidenceDiagnostics(candidate);
  if (!diagnostics.present) return;

  if (diagnostics.malformed) {
    boundedDeduct(
      state,
      'linked-evidence-malformed',
      2,
      'Bound candidate has malformed linked evidence diagnostics; treat linked evidence as diagnostic-only.',
      location,
      { blocking: false }
    );
  }
  if (!diagnostics.hasLinkedEvidence || !diagnostics.impact) return;

  const articleText = linkedEvidenceArticleText(section);
  const evidenceText = linkedEvidenceEvidenceText(section);
  const notesText = linkedEvidenceNotesText(section);
  const impactType = text(diagnostics.impact.impact_type);
  const recommendedArticleType = text(diagnostics.impact.recommended_article_type);
  const runtimeClaim = LINKED_EVIDENCE_RUNTIME_CLAIM.test(articleText);
  const explicitRuntimeEvidence = LINKED_EVIDENCE_RUNTIME_TERMS.test(evidenceText);
  const overclaimReasons = [];

  if (diagnostics.hasUnresolvedEvidence && LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM.test(articleText)) {
    overclaimReasons.push('Article describes unresolved linked evidence as confirmed detail.');
  }
  if (impactType === IMPACT_TYPES.BUILD_DEPENDENCY_FIX && runtimeClaim) {
    overclaimReasons.push('Article frames build_dependency_fix linked evidence as HAL runtime or camera pipeline behavior change.');
  }
  if (impactType === IMPACT_TYPES.TEST_ONLY_CHANGE && runtimeClaim) {
    overclaimReasons.push('Article frames test_only_change linked evidence as product or runtime behavior change.');
  }
  if (impactType === IMPACT_TYPES.DOCUMENTATION_ONLY && runtimeClaim) {
    overclaimReasons.push('Article frames documentation_only linked evidence as implementation or runtime change.');
  }
  if (recommendedArticleType === RECOMMENDED_ARTICLE_TYPES.WATCH && !explicitRuntimeEvidence) {
    overclaimReasons.push('Article promotes watch-only linked evidence to main framing without explicit runtime or pipeline evidence.');
  }
  if (
    (diagnostics.impact.hal_runtime_impact !== true && diagnostics.impact.camera_pipeline_impact !== true) &&
    LINKED_EVIDENCE_HIGH_IMPACT_CLAIM.test(articleText) &&
    !explicitRuntimeEvidence
  ) {
    overclaimReasons.push('Article claims high HAL/runtime impact without explicit stream, buffer, metadata, request/result, ImageCapture, VideoCapture, Surface, or CameraPipe evidence.');
  }

  for (const reason of overclaimReasons) {
    boundedDeduct(state, 'linked-evidence-overclaim', 8, reason, location);
  }

  if (diagnostics.hasUnresolvedEvidence && !LINKED_EVIDENCE_LIMITATION_NOTE.test(notesText)) {
    boundedDeduct(
      state,
      'linked-evidence-limitation',
      2,
      'Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.',
      location,
      { blocking: false }
    );
  }
}

function countSections(sections, pattern) {
  return sections.filter(section => hasPattern(sectionText(section), pattern)).length;
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function knownBucket(value) {
  const bucket = text(value);
  return Object.values(BUCKETS).includes(bucket) ? bucket : '';
}

function fallbackSectionScope(section) {
  const body = sectionText(section);
  if (/카메라\s*HAL|안드로이드\s*카메라|카메라2|Camera\s*HAL|Android Camera|CameraX|Camera2|Camera ITS|CTS|VTS|AOSP Camera/i.test(body)) {
    return {
      editorial_priority: 1,
      relevance_bucket: BUCKETS.DIRECT_AOSP_CAMERA,
      aosp_camera_directness: 3,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: true,
      counts_as_driver_topic: false,
      counts_as_soc_topic: false,
      counts_as_fallback_topic: false,
      evidence_origin: 'section_text_fallback'
    };
  }
  if (/V4L2|libcamera|ISP|이미지\s*센서|image sensor|camera driver|media controller|MIPI|CSI-2|DMA-BUF/i.test(body)) {
    return {
      editorial_priority: 2,
      relevance_bucket: BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
      aosp_camera_directness: 0,
      driver_stack_relevance: 3,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: false,
      counts_as_driver_topic: true,
      counts_as_soc_topic: false,
      counts_as_fallback_topic: false,
      evidence_origin: 'section_text_fallback'
    };
  }
  if (/\bSoC\b|\bCPU\b|\bGPU\b|\bNPU\b|\bDSP\b|\bthermal\b|\bpower\b|\bDVFS\b|\bscheduler\b|\bmemory bandwidth\b|Exynos|Snapdragon|Google Tensor/i.test(body)) {
    return {
      editorial_priority: 4,
      relevance_bucket: BUCKETS.SOC_PLATFORM_SIGNAL,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 3,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: false,
      counts_as_driver_topic: false,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false,
      evidence_origin: 'section_text_fallback'
    };
  }
  if (/C\+\+|LLVM|Clang|GCC|sanitizer|native|toolchain|build|test|AI coding|LLM agent/i.test(body)) {
    return {
      editorial_priority: 5,
      relevance_bucket: BUCKETS.CPP_AI_TOOLING_FALLBACK,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 3,
      counts_as_primary_camera_topic: false,
      counts_as_driver_topic: false,
      counts_as_soc_topic: false,
      counts_as_fallback_topic: true,
      evidence_origin: 'section_text_fallback'
    };
  }
  return classifyAospCameraStackCandidate({
    title: section?.headline,
    summary: sectionText(section),
    api_or_component: section?.category,
    behavior_change: section?.what_changed
  });
}

function hasSpecificEvidence(section) {
  const evidence = [
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes
  ].map(text).join(' ');
  return /(?:\b(?:Android|CameraX|libcamera|OpenCL|LLVM|Clang|C\+\+|NDK|SDK|Glaze)\s*\d|[A-Za-z0-9_+.-]+\s+\d+\.\d+(?:\.\d+)*|\b\d+\.\d+(?:\.\d+)*\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:version|release|release date|published date|API\/component|behavior change|source gap|rolling page|no dated release|requires cross-check|official-source|cross-checked)\b|(?:version|release|API|component|extension|module|library):\s*\S+)/i
    .test(evidence);
}

function hasGenericMonitoringWithoutEvidence(section) {
  const body = sectionText(section);
  const generic = /monitor|watch|track|follow|review|모니터|추적|확인|주시|검토/i.test(body);
  return generic && !hasSpecificEvidence(section);
}

function hasHalDepth(section) {
  return /Camera HAL|HAL|Android Camera|CameraX|AOSP Camera|Camera2|stream|buffer|metadata|request|result|CTS|VTS|Camera ITS|CDD|latency|frame drop|thermal|power|memory|memory bandwidth|binder|scheduling|scheduler|EAS|DVFS|CPU|GPU|NPU|DSP|SoC|ISP|image sensor|MIPI|CSI-2|DMA-BUF|V4L2|libcamera|media controller|YUV|RAW|PRIVATE|logical|physical|vendor tag|session parameter|native|C\+\+|LLVM|Clang|GCC|sanitizer|toolchain|debugging|test productivity/i
    .test(sectionText(section));
}

function hasConcreteAction(section) {
  const actions = normalizeArticleSections(section).action_items;
  if (actions.length === 0) return false;
  return actions.some(action => /test|log|metric|measure|CTS|VTS|Camera ITS|stream|metadata|latency|frame drop|thermal|device|owner|API|PoC|benchmark|profile|검증|테스트|측정|로그|지표|벤치마크|담당|기기/i.test(text(action)));
}

function hasValidAiRelevance(section) {
  if (!section.is_ai_related && !/\b(?:AI|agent|LLM|NPU|GPU|on-device|inference|model)\b/i.test(sectionText(section))) {
    return false;
  }
  return /camera input|image|frame|stream|buffer|ImageAnalysis|NPU|GPU|ISP|privacy|HAL workflow|developer productivity|latency|thermal|power|agent|Camera HAL|Android Camera/i
    .test(sectionText(section));
}

function hasHalConnectionTerm(body) {
  return /Camera HAL|Android Camera|CameraX|Camera2|\bcamera\b|image frame|stream|buffer|metadata|request|result|ImageAnalysis|ISP|image sensor|V4L2|libcamera|driver|SoC|CPU|GPU|NPU|DSP|thermal|power|DVFS|scheduler|memory bandwidth|native|C\+\+|LLVM|Clang|GCC|sanitizer|HAL workflow|Camera ITS|CTS|VTS/i
    .test(body);
}

function hasNegativeHalConnectionWording(body) {
  return [
    /\b(?:no|without|lacks?|missing)\b[^.\n]{0,100}(?:Camera HAL|Android Camera|CameraX|Camera2|\bcamera\b|HAL workflow|Camera ITS|CTS|VTS)/i,
    /\b(?:no|without|lacks?|missing)\b[^.\n]{0,100}(?:device imaging|imaging workflow|image pipeline|camera workflow)/i,
    /\b(?:does not|doesn't|cannot|can't)\b[^.\n]{0,120}(?:Camera HAL|Android Camera|CameraX|Camera2|\bcamera\b|HAL workflow|Camera ITS|CTS|VTS)/i,
    /(?:Camera HAL|Android Camera|CameraX|Camera2|\bcamera\b|HAL workflow|Camera ITS|CTS|VTS)[^.\n]{0,120}\b(?:not identified|not found|not applicable|absent|missing|none|unclear|irrelevant)\b/i
  ].some(pattern => pattern.test(body));
}

function hasGenericAiWithoutHalConnection(section) {
  const body = sectionText(section);
  const aiRelated = section.is_ai_related === true || /\b(?:AI|agent|LLM|NPU|GPU|on-device|inference|model)\b/i.test(body);
  if (!aiRelated) return false;
  if (!hasHalConnectionTerm(body)) return true;
  return hasNegativeHalConnectionWording(body);
}

function isValidSourceUrl(value) {
  const raw = text(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function sourceGapCount(factCheck) {
  if (Number.isFinite(Number(factCheck?.source_gap_count))) return Number(factCheck.source_gap_count);
  return ensureArray(factCheck?.source_gaps).length;
}

function deductionMatchesSection(deduction, section) {
  const location = normalizeForMatch(deduction?.location);
  if (!location) return false;
  const labels = [
    section?.headline,
    section?.category,
    section?.location
  ].map(normalizeForMatch).filter(Boolean);
  return labels.some(label => location === label || location.includes(label) || label.includes(location));
}

function sectionHasQualityDeductions(section, deductions, categories = [
  'required-fields',
  'evidence-specificity',
  'hal-depth',
  'actionability'
]) {
  const categorySet = new Set(categories);
  return ensureArray(deductions).some(deduction =>
    categorySet.has(deduction?.category) && deductionMatchesSection(deduction, section)
  );
}

function factCheckItemMentionsSection(item, section) {
  const haystack = normalizeForMatch(item);
  if (!haystack) return false;
  const labels = [
    section?.headline,
    section?.category,
    ...ensureArray(section?.sources).flatMap(source => [source?.title, source?.url])
  ].map(normalizeForMatch).filter(Boolean);
  return labels.some(label => haystack.includes(label) || label.includes(haystack));
}

function sectionHasFactCheckMustFix(section, factCheck) {
  return ensureArray(factCheck?.must_fix).some(item => factCheckItemMentionsSection(item, section));
}

function sectionHasSourceGap(section, factCheck) {
  const localGap = /source gap|rolling page|no dated release|missing source|needs cross-check|needs-cross-check|출처\s*공백|소스\s*갭/i
    .test(sectionText(section));
  if (localGap) return true;
  return ensureArray(factCheck?.source_gaps).some(item => factCheckItemMentionsSection(item, section));
}

function articleResultMatchesSection(result, section) {
  const resultUrls = new Set(ensureArray(result?.sources).map(source => text(source?.url)).filter(Boolean));
  if (ensureArray(section?.sources).some(source => resultUrls.has(text(source?.url)))) return true;
  const resultLabels = [
    result?.headline,
    result?.category
  ].map(normalizeForMatch).filter(Boolean);
  if (resultLabels.length === 0) return false;
  const sectionLabels = [
    section?.headline,
    section?.category,
    ...ensureArray(section?.sources).flatMap(source => [source?.title, source?.url])
  ].map(normalizeForMatch).filter(Boolean);
  return sectionLabels.some(sectionLabel =>
    resultLabels.some(resultLabel =>
      resultLabel === sectionLabel ||
      resultLabel.includes(sectionLabel) ||
      sectionLabel.includes(resultLabel)
    )
  );
}

function articleResultForSection(section, qualityReport) {
  return ensureArray(qualityReport?.article_results)
    .find(result => articleResultMatchesSection(result, section)) || null;
}

function sectionPassesArticleGate(section, qualityReport, factCheck) {
  const articleResult = articleResultForSection(section, qualityReport);
  if (articleResult && articleResult.status !== 'PASS') return false;
  return !sectionHasQualityDeductions(section, qualityReport?.deductions) &&
    !sectionHasFactCheckMustFix(section, factCheck) &&
    !sectionHasSourceGap(section, factCheck);
}

function blockingDeductions(deductions) {
  return ensureArray(deductions).filter(deduction => deduction?.blocking !== false);
}

function softDeductions(deductions) {
  return ensureArray(deductions).filter(deduction => deduction?.blocking === false);
}

function sectionDeductions(section, deductions) {
  return ensureArray(deductions).filter(deduction => deductionMatchesSection(deduction, section));
}

function sectionSourceSummary(section) {
  return ensureArray(section?.sources).map(source => ({
    title: text(source?.title),
    url: text(source?.url)
  }));
}

const SCOPE_SCORE_FIELDS = Object.freeze([
  'aosp_camera_directness',
  'driver_stack_relevance',
  'soc_platform_relevance',
  'native_tooling_relevance'
]);

function optionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scopeScore(scope) {
  return Math.max(
    Number(scope?.aosp_camera_directness || 0),
    Number(scope?.driver_stack_relevance || 0),
    Number(scope?.soc_platform_relevance || 0),
    Number(scope?.native_tooling_relevance || 0)
  );
}

function scopeFromStructuredFields(value, origin) {
  const bucket = knownBucket(value?.relevance_bucket);
  if (!bucket) return null;
  const candidateUrl = candidateCanonicalUrl(value);
  const scores = {};
  const missingScoreFields = [];
  for (const field of SCOPE_SCORE_FIELDS) {
    const parsed = optionalNumber(value?.[field]);
    if (parsed === null) missingScoreFields.push(field);
    scores[field] = parsed ?? 0;
  }
  return {
    source_candidate_url: text(value.source_candidate_url) || candidateUrl,
    source_candidate_hash: text(value.source_candidate_hash || value.url_hash || value.normalized_url_hash) ||
      (candidateUrl ? normalizedUrlHash(candidateUrl) : ''),
    editorial_priority: number(value.editorial_priority, BUCKET_PRIORITY[bucket] || 6),
    relevance_bucket: bucket,
    ...scores,
    counts_as_primary_camera_topic: bool(
      value.counts_as_primary_camera_topic,
      bucket === BUCKETS.DIRECT_AOSP_CAMERA || bucket === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT
    ),
    counts_as_driver_topic: bool(value.counts_as_driver_topic, bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE),
    counts_as_soc_topic: bool(value.counts_as_soc_topic, bucket === BUCKETS.SOC_PLATFORM_SIGNAL),
    counts_as_fallback_topic: bool(value.counts_as_fallback_topic, bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK),
    impact_claim_level: text(value.impact_claim_level || value.impactClaimLevel) || inferImpactClaimLevel(value),
    evidence_origin: text(value.evidence_origin) || origin,
    missing_score_fields: missingScoreFields,
    metadata_source: origin,
    count_source: origin
  };
}

function metadataHasScore(metadata, field) {
  return Boolean(metadata) && !ensureArray(metadata.missing_score_fields).includes(field);
}

function scoreFromMetadata(metadata, field) {
  return metadataHasScore(metadata, field) ? number(metadata[field]) : null;
}

function candidateMetadataForBinding(binding) {
  if (binding?.status !== 'bound' || !binding.candidate) return null;
  const metadata = scopeFromStructuredFields(binding.candidate, binding.binding_source || 'bound_candidate');
  if (!metadata) return null;
  return {
    ...metadata,
    source_candidate_url: candidateCanonicalUrl(binding.candidate),
    source_candidate_hash: candidateHash(binding.candidate),
    binding_status: 'bound',
    binding_source: binding.binding_source || 'bound_candidate',
    binding_tie_score: binding.tie_score ?? null,
    publishable_scope: true
  };
}

function mergeScopeMetadata(sectionMetadata, candidateMetadata) {
  if (!candidateMetadata) return null;
  const candidateBucket = candidateMetadata.relevance_bucket || BUCKETS.GENERIC_TECH_WATCHLIST;
  const sectionBucket = sectionMetadata?.relevance_bucket;
  const sectionCanFill = sectionMetadata &&
    (!sectionBucket || (BUCKET_PRIORITY[sectionBucket] || 99) >= (BUCKET_PRIORITY[candidateBucket] || 99));
  const bucket = candidateBucket;
  const merged = {
    ...candidateMetadata,
    ...(sectionCanFill ? sectionMetadata : {}),
    relevance_bucket: bucket,
    editorial_priority: (sectionCanFill ? optionalNumber(sectionMetadata?.editorial_priority) : null) ??
      optionalNumber(candidateMetadata?.editorial_priority) ??
      BUCKET_PRIORITY[bucket] ??
      6,
    source_candidate_url: text(candidateMetadata?.source_candidate_url),
    source_candidate_hash: text(candidateMetadata?.source_candidate_hash),
    evidence_origin: text(candidateMetadata?.evidence_origin) || 'bound_candidate_metadata',
    metadata_source: sectionCanFill && candidateMetadata
      ? 'merged'
      : candidateMetadata.metadata_source || candidateMetadata.binding_source || 'bound_candidate',
    count_source: sectionCanFill && candidateMetadata
      ? 'merged'
      : candidateMetadata.count_source || candidateMetadata.binding_source || 'bound_candidate',
    binding_status: candidateMetadata.binding_status || 'bound',
    binding_source: candidateMetadata.binding_source || '',
    binding_tie_score: candidateMetadata.binding_tie_score ?? null,
    publishable_scope: true
  };
  const missingScoreFields = [];
  for (const field of SCOPE_SCORE_FIELDS) {
    const value = (sectionCanFill ? scoreFromMetadata(sectionMetadata, field) : null) ?? scoreFromMetadata(candidateMetadata, field);
    if (value === null) missingScoreFields.push(field);
    merged[field] = value ?? 0;
  }
  merged.missing_score_fields = missingScoreFields;
  return merged;
}

function diagnosticFallbackScope(section, binding = null) {
  return {
    ...fallbackSectionScope(section),
    source_candidate_url: binding?.status === 'bound' ? candidateCanonicalUrl(binding.candidate) : '',
    source_candidate_hash: binding?.status === 'bound' ? candidateHash(binding.candidate) : '',
    count_source: 'section_text_fallback',
    metadata_source: 'section_text_fallback',
    binding_status: binding?.status || 'missing',
    binding_source: binding?.binding_source || '',
    binding_reason: binding?.reason || '',
    publishable_scope: false,
    counts_as_primary_camera_topic: false,
    counts_as_driver_topic: false,
    counts_as_soc_topic: false,
    counts_as_fallback_topic: false
  };
}

function sectionScope(section, binding) {
  const sectionMetadata = scopeFromStructuredFields(section, 'section_metadata');
  const candidateMetadata = candidateMetadataForBinding(binding);
  const mergedMetadata = mergeScopeMetadata(sectionMetadata, candidateMetadata);
  if (mergedMetadata) return mergedMetadata;
  return diagnosticFallbackScope(section, binding);
}

function hasExpandedScope(scope) {
  return scope?.publishable_scope === true &&
    !isForbiddenMainBucket(scope.relevance_bucket) &&
    scopeScore(scope) >= 2;
}

function sectionCountDetail(section, scope, index) {
  const bucket = knownBucket(scope?.relevance_bucket) || BUCKETS.GENERIC_TECH_WATCHLIST;
  const publishableScope = scope?.publishable_scope === true;
  const countsAsPrimaryStack = isPrimaryCameraStackBucket(bucket);
  const countsAsSupportingMain = isSupportingMainBucket(bucket);
  const countsAsForbiddenMain = isForbiddenMainBucket(bucket);
  let countReason = `${scope?.count_source || scope?.evidence_origin || 'unknown'} classified this section as ${bucket}.`;
  let exclusionReason = '';
  if (!publishableScope) {
    countReason = `${scope?.count_source || scope?.evidence_origin || 'unknown'} classified this section as ${bucket} for diagnostics only.`;
    exclusionReason = 'Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available.';
  } else if (countsAsPrimaryStack) {
    countReason = `${bucket} counts toward primary_camera_stack_count.`;
  } else if (countsAsSupportingMain) {
    countReason = `${bucket} counts toward supporting_main_article_count, not primary_camera_stack_count.`;
    exclusionReason = 'Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic.';
  } else {
    exclusionReason = countsAsForbiddenMain
      ? `${bucket} is forbidden by Newsletter Policy and cannot remain as a main article.`
      : `${bucket} is not allowed by Newsletter Policy for main article composition.`;
  }
  return {
    index: index + 1,
    headline: section.headline || section.category || `article ${index + 1}`,
    source_candidate_url: scope?.source_candidate_url || text(section.source_candidate_url),
    source_candidate_hash: scope?.source_candidate_hash || text(section.source_candidate_hash),
    relevance_bucket: bucket,
    editorial_priority: number(scope?.editorial_priority, BUCKET_PRIORITY[bucket] || 6),
    counts_as_primary_camera_topic: countsAsPrimaryStack,
    counts_as_driver_topic: bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
    counts_as_soc_topic: bucket === BUCKETS.SOC_PLATFORM_SIGNAL,
    counts_as_fallback_topic: bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK,
    counts_as_supporting_main_article: countsAsSupportingMain,
    counts_as_forbidden_main_article: countsAsForbiddenMain,
    impact_claim_level: text(scope?.impact_claim_level) || inferImpactClaimLevel({ ...section, relevance_bucket: bucket }),
    evidence_origin: scope?.evidence_origin || 'unknown',
    metadata_source: scope?.metadata_source || scope?.count_source || 'unknown',
    binding_status: scope?.binding_status || 'unknown',
    binding_source: scope?.binding_source || '',
    binding_reason: scope?.binding_reason || '',
    publishable_scope: publishableScope,
    missing_score_fields: ensureArray(scope?.missing_score_fields),
    count_reason: countReason,
    exclusion_reason_if_not_counted: exclusionReason
  };
}

function articleStatusFor(section, hardItems, factCheck) {
  if (sectionHasSourceGap(section, factCheck)) return 'FAIL';
  if (hardItems.some(item => item.category === 'source-integrity')) return 'FAIL';
  if (hardItems.some(item => item.category === 'field-hygiene')) return 'FAIL';
  if (hardItems.some(item => item.category === 'required-fields' && /sources|source/i.test(item.reason))) return 'FAIL';
  if (hardItems.some(item => item.category === 'evidence-specificity' && /release date|dated|source gap|rolling page|evidence/i.test(item.reason))) return 'FAIL';
  if (hardItems.some(item => item.category === 'hal-relevance' || item.category === 'hal-depth' || item.category === 'scope-relevance')) return 'DEMOTE';
  return hardItems.length > 0 || sectionHasFactCheckMustFix(section, factCheck) ? 'FAIL' : 'PASS';
}

function repairActionForArticleStatus(status, hardItems, factCheck, section) {
  if (status === 'PASS') return 'preserve';
  if (sectionHasSourceGap(section, factCheck) || hardItems.some(item => item.category === 'source-integrity')) {
    return 'replace-or-demote';
  }
  if (status === 'DEMOTE') return 'demote-or-replace';
  return 'repair-section';
}

function buildArticleResults(sections, deductions, factCheck, sectionCountDetails = []) {
  return ensureArray(sections).map((section, index) => {
    const items = sectionDeductions(section, deductions);
    const hardItems = blockingDeductions(items);
    const softItems = softDeductions(items);
    const factCheckMustFix = sectionHasFactCheckMustFix(section, factCheck);
    const sourceGap = sectionHasSourceGap(section, factCheck);
    const status = articleStatusFor(section, hardItems, factCheck);
    const hardReasons = [
      ...hardItems.map(item => item.reason),
      factCheckMustFix ? 'Fact-check must_fix item mentions this section.' : '',
      sourceGap ? 'Source gap or ineligible source evidence mentions this section.' : ''
    ].filter(Boolean);
    return {
      index: index + 1,
      headline: section.headline || section.category || `article ${index + 1}`,
      category: section.category || '',
      status,
      repair_action: repairActionForArticleStatus(status, hardItems, factCheck, section),
      sources: sectionSourceSummary(section),
      section_contract: articleSectionSummary(section),
      scope_count: sectionCountDetails[index] || null,
      impact_claim_level: text(section.impact_claim_level) || text(sectionCountDetails[index]?.impact_claim_level),
      hard_fail_reasons: [...new Set(hardReasons)],
      soft_deductions: softItems.map(item => ({
        category: item.category,
        points: item.points,
        reason: item.reason
      }))
    };
  });
}

function summarizeArticleSectionContracts(sections) {
  const summaries = ensureArray(sections).map(articleSectionSummary);
  const missingKeyCounts = ARTICLE_SECTION_KEYS.reduce((counts, key) => {
    counts[key] = summaries.filter(summary => ensureArray(summary.missing_keys).includes(key)).length;
    return counts;
  }, {});
  return {
    complete_count: summaries.filter(summary => summary.complete === true).length,
    incomplete_count: summaries.filter(summary => summary.complete !== true).length,
    fallback_count: summaries.reduce((sum, summary) => sum + ensureArray(summary.fallbacks_used).length, 0),
    warning_count: summaries.reduce((sum, summary) => sum + ensureArray(summary.warnings).length, 0),
    conflict_count: summaries.reduce((sum, summary) => sum + ensureArray(summary.conflicts).length, 0),
    missing_key_counts: missingKeyCounts,
    summaries
  };
}

function determineQualityStatus(score, threshold, checks = {}) {
  const sourceGapCountValue = Number(checks.sourceGapCount || 0);
  const blockers = ensureArray(checks.blockingDeductions);
  return score >= threshold &&
    sourceGapCountValue === 0 &&
    checks.hasFactCheckMustFix !== true &&
    blockers.length === 0
    ? 'PASS'
    : 'NEEDS_FIX';
}

function summarizeDeductionCategories(deductions) {
  const counts = new Map();
  for (const deduction of ensureArray(deductions)) {
    const category = text(deduction?.category) || 'unknown';
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

function summarizeCandidateExclusions(reporter) {
  const counts = new Map();
  for (const candidate of ensureArray(reporter?.candidates)) {
    if (isFinalSelected(candidate)) continue;
    const reasons = ensureArray(candidate.final_exclusion_reasons).length > 0
      ? candidate.final_exclusion_reasons
      : ensureArray(candidate.exclusion_reasons);
    for (const reason of reasons) {
      const key = text(reason) || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function markdownTableCell(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\|/g, '\\|') || 'none';
}

function articleSectionContractMarkdownRows(report) {
  return ensureArray(report.article_results).map(item => {
    const summary = item.section_contract || {};
    const missing = ensureArray(summary.missing_keys);
    const fallbacks = ensureArray(summary.fallbacks_used);
    const warnings = ensureArray(summary.warnings);
    const conflicts = ensureArray(summary.conflicts);
    const row = [
      item.index || '',
      item.headline || '',
      summary.complete === true && missing.length === 0 ? 'pass' : `missing ${missing.join(', ') || 'unknown'}`,
      missing.includes('hal_driver_impact') ? 'missing' : 'present',
      missing.includes('action_items') ? 'missing' : (fallbacks.some(value => /action_items/.test(value)) ? 'fallback' : 'concrete'),
      conflicts.length > 0
        ? `conflict ${conflicts.map(conflict => conflict.key || conflict).join(', ')}`
        : (warnings.join('; ') || 'low')
    ];
    return `| ${row.map(markdownTableCell).join(' | ')} |`;
  }).join('\n') || '| none | none | none | none | none | none |';
}

function buildNewsletterQualityReport(date, editor, reporter = {}, factCheck = {}, options = {}) {
  const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : qualityGatePolicy.threshold;
  const sections = ensureArray(editor.sections);
  const state = { deductions: [] };
  const bindingIndex = candidateBindingIndex(reporter, options.shortlistReport || null);
  const staleClaimReport = options.staleClaimReport || null;
  let sourceIntegrityViolationCount = 0;
  const sourceUrlOwners = new Map();

  if (sections.length < articlePolicy.mainArticleCount.min || sections.length > articlePolicy.mainArticleCount.max) {
    boundedDeduct(state, 'composition', 8, `Main article count ${sections.length} is outside Newsletter Policy range (${articleCountRangeText()}).`);
  }
  if (ensureArray(editor.briefing).length !== 3) {
    boundedDeduct(state, 'composition', 3, `Expected exactly 3 briefing bullets, found ${ensureArray(editor.briefing).length}.`);
  }
  const sectionBindings = sections.map(section => bindCandidateForSection(section, bindingIndex));
  const sectionScopes = sections.map((section, index) => sectionScope(section, sectionBindings[index]));
  const sectionCountDetails = sections.map((section, index) => sectionCountDetail(section, sectionScopes[index], index));
  const scopeBucketCounts = sectionScopes.reduce((counts, scope) => {
    if (scope?.publishable_scope !== true) return counts;
    const bucket = text(scope?.relevance_bucket) || 'unknown';
    counts[bucket] = (counts[bucket] || 0) + 1;
    return counts;
  }, {
    [BUCKETS.DIRECT_AOSP_CAMERA]: 0,
    [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: 0,
    [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 0,
    [BUCKETS.SOC_PLATFORM_SIGNAL]: 0,
    [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 0,
    [BUCKETS.GENERIC_TECH_WATCHLIST]: 0
  });
  const directAospCameraCount = scopeBucketCounts[BUCKETS.DIRECT_AOSP_CAMERA] || 0;
  const cameraDriverImagePipelineCount = scopeBucketCounts[BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE] || 0;
  const androidPlatformCameraAdjacentCount = scopeBucketCounts[BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT] || 0;
  const socPlatformSignalCount = scopeBucketCounts[BUCKETS.SOC_PLATFORM_SIGNAL] || 0;
  const cppAiToolingFallbackCount = scopeBucketCounts[BUCKETS.CPP_AI_TOOLING_FALLBACK] || 0;
  const genericTechWatchlistCount = scopeBucketCounts[BUCKETS.GENERIC_TECH_WATCHLIST] || 0;
  const primaryCameraStackCount = articlePolicy.primaryCameraStack.buckets
    .reduce((sum, bucket) => sum + number(scopeBucketCounts[bucket]), 0);
  const supportingMainArticleCount = articlePolicy.supportingMainBuckets
    .reduce((sum, bucket) => sum + number(scopeBucketCounts[bucket]), 0);
  const forbiddenMainArticleCount = articlePolicy.forbiddenMainBuckets
    .reduce((sum, bucket) => sum + number(scopeBucketCounts[bucket]), 0);
  const fallbackRelevanceCount = socPlatformSignalCount + cppAiToolingFallbackCount;
  const expandedScopeCoverage = primaryCameraStackCount + supportingMainArticleCount;
  const publishableScopeCount = sectionScopes.filter(scope => scope?.publishable_scope === true).length;
  const compositionMode = publishableScopeCount === 0 && sections.length > 0
    ? 'NEEDS_FIX'
    : forbiddenMainArticleCount > 0
      ? 'NEEDS_FIX'
      : primaryCameraStackCount < articlePolicy.primaryCameraStack.minRequired
        ? 'NEEDS_FIX'
        : supportingMainArticleCount > 0
        ? 'FALLBACK_COMPOSITION'
        : 'NORMAL';
  if (primaryCameraStackCount < articlePolicy.primaryCameraStack.minRequired) {
    boundedDeduct(state, 'composition', 8, `Primary Camera Stack article count ${primaryCameraStackCount} is below Newsletter Policy requirement (${articlePolicy.primaryCameraStack.minRequired}).`);
  }
  if (forbiddenMainArticleCount > 0) {
    boundedDeduct(state, 'composition', 8, `Forbidden main bucket count ${forbiddenMainArticleCount} violates Newsletter Policy: ${articlePolicy.forbiddenMainBuckets.join(', ')}.`);
  }

  sections.forEach((section, index) => {
    const location = section.headline || section.category || `article ${index + 1}`;
    const binding = sectionBindings[index];
    const scope = sectionScopes[index];
    const articleSections = normalizeArticleSections(section);
    const sectionContract = articleSectionSummary(section);
    const requiredTextFields = ['headline', 'evidence_summary'];
    for (const field of requiredTextFields) {
      if (!text(section[field])) {
        boundedDeduct(state, 'required-fields', 3, `Missing required article field: ${field}.`, location);
      }
    }
    for (const field of ['specificity_checks', 'source_verification_notes', 'camera_hal_checks', 'sources']) {
      if (ensureArray(section[field]).length === 0) {
        boundedDeduct(state, 'required-fields', 4, `Missing required article list: ${field}.`, location);
      }
    }
    for (const missingKey of sectionContract.missing_keys) {
      boundedDeduct(
        state,
        'article-section-contract',
        missingKey === 'hal_driver_impact' ? 4 : 3,
        `Missing normalized article section: ${missingKey}.`,
        location,
        { blocking: false }
      );
    }
    for (const warning of sectionContract.warnings) {
      boundedDeduct(
        state,
        'article-section-contract',
        1,
        warning,
        location,
        { blocking: false }
      );
    }
    if (ensureArray(sectionContract.conflicts).length > 0) {
      boundedDeduct(
        state,
        'article-section-contract',
        2,
        `article_sections conflicts with legacy fields: ${sectionContract.conflicts.map(item => item.key).join(', ')}.`,
        location,
        { blocking: false }
      );
    }
    for (const issue of findFieldHygieneIssues({
      ...section,
      confirmed_facts: articleSections.verified_facts,
      background: articleSections.background_context,
      camera_hal_perspective: articleSections.hal_driver_impact,
      action_items: articleSections.action_items,
      team_summary: articleSections.team_share_points,
      impact_claim_level: text(section.impact_claim_level) || text(sectionCountDetails[index]?.impact_claim_level)
    })) {
      boundedDeduct(
        state,
        'field-hygiene',
        issue.blocking === false ? 2 : 8,
        issue.reason,
        location,
        issue.blocking === false ? { blocking: false, severity: issue.severity || 'soft' } : {}
      );
    }
    for (const source of ensureArray(section.sources)) {
      if (!isValidSourceUrl(source?.url)) {
        sourceIntegrityViolationCount += 1;
        boundedDeduct(state, 'source-integrity', 8, `Missing or invalid source URL: ${source?.url || 'empty'}.`, location);
      }
    }
    if (binding.status !== 'bound') {
      sourceIntegrityViolationCount += 1;
      boundedDeduct(
        state,
        'source-integrity',
        8,
        binding.status === 'ambiguous'
          ? binding.reason
          : binding.status === 'evidence_mismatch'
            ? binding.reason
            : 'Main article source URL does not bind to reporter/shortlist candidate metadata.',
        location
      );
    } else {
      const violation = candidateSelectionViolation(binding.candidate);
      if (violation) {
        sourceIntegrityViolationCount += 1;
        boundedDeduct(
          state,
          'source-integrity',
          8,
          `Main article source maps to ineligible reporter/shortlist candidate: ${violation}.`,
          location
        );
      }
      if (scope?.publishable_scope !== true) {
        sourceIntegrityViolationCount += 1;
        boundedDeduct(
          state,
          'source-integrity',
          8,
          'Bound source candidate lacks publishable relevance_bucket and scope score metadata.',
          location
        );
      }
      addLinkedEvidenceQualityDeductions(state, section, binding.candidate, location);
    }
    if (!hasSpecificEvidence(section)) {
      boundedDeduct(state, 'evidence-specificity', 5, 'Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.', location);
    }
    if (hasGenericMonitoringWithoutEvidence(section)) {
      boundedDeduct(state, 'evidence-specificity', 4, 'Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.', location);
    }
    if (!hasHalDepth(section)) {
      boundedDeduct(state, 'hal-depth', 4, 'Article lacks concrete AOSP Camera / driver / SoC / native engineering depth.', location);
    }
    if (!hasHalDepth({
      ...section,
      headline: '',
      category: '',
      what_changed: '',
      background: '',
      why_it_matters: '',
      evidence_summary: '',
      specificity_checks: [],
      source_verification_notes: [],
      team_summary: '',
      confirmed_facts: [],
      camera_hal_checks: [],
      action_items: [],
      sources: [],
      article_sections: {
        verified_facts: [],
        background_context: '',
        hal_driver_impact: articleSections.hal_driver_impact,
        action_items: [],
        team_share_points: ''
      },
      camera_hal_perspective: ''
    })) {
      boundedDeduct(state, 'hal-depth', 4, 'Article hal_driver_impact does not include concrete AOSP Camera / driver / SoC / native perspective.', location);
    }
    if (!hasExpandedScope(scope)) {
      boundedDeduct(state, 'scope-relevance', 8, 'Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.', location);
    }
    if (ensureArray(articleSections.action_items).length < 2) {
      boundedDeduct(
        state,
        'actionability',
        4,
        `Expected at least 2 action_items, found ${ensureArray(articleSections.action_items).length}.`,
        location,
        { blocking: false }
      );
    }
    if (!hasConcreteAction(section)) {
      boundedDeduct(
        state,
        'actionability',
        4,
        'Article action item is not concrete enough for a HAL engineering team.',
        location,
        { blocking: false }
      );
    }
    if (/C\+\+|LLVM|Clang|GCC|Linux|libcamera|AI|agent|LLM|OpenCL|NPU|GPU|CPU|SoC|thermal|power/i.test(sectionText(section)) && !hasHalDepth(section)) {
      boundedDeduct(state, 'scope-relevance', 4, 'Fallback article does not clearly connect back to AOSP Camera, driver, SoC platform, or native development work.', location);
    }
    if (hasGenericAiWithoutHalConnection(section) || ((section.is_ai_related === true || /\b(?:AI|agent|LLM|NPU|GPU|on-device|inference|model)\b/i.test(sectionText(section))) && !hasExpandedScope(scope))) {
      boundedDeduct(state, 'hal-relevance', 8, 'Generic AI article lacks a concrete Camera HAL / Android Camera connection and must not stay as a main article.', location);
    }
    if (scope?.publishable_scope === true && isForbiddenMainBucket(scope.relevance_bucket)) {
      boundedDeduct(state, 'scope-relevance', 8, `Bound candidate is ${scope.relevance_bucket} and cannot remain as a main article.`, location);
    }
    if (section.resolvedImage?.usedFallback === true) {
      boundedDeduct(
        state,
        'image-fallback',
        1,
        'Article image uses a local fallback visual.',
        location,
        { blocking: false }
      );
    }
    for (const source of ensureArray(section.sources)) {
      const sourceUrl = source?.url || '';
      for (const key of urlKeys(sourceUrl)) {
        if (!sourceUrlOwners.has(key)) {
          sourceUrlOwners.set(key, location);
        } else if (sourceUrlOwners.get(key) !== location) {
          sourceIntegrityViolationCount += 1;
          boundedDeduct(
            state,
            'source-integrity',
            8,
            `Duplicate source URL is used across main sections: ${sourceUrl}.`,
            location
          );
          break;
        }
      }
    }
  });

  const mustFixCount = ensureArray(factCheck.must_fix).length;
  if (factCheck.status === 'NEEDS_FIX' && mustFixCount > 0) {
    boundedDeduct(state, 'source-integrity', Math.min(15, mustFixCount * 5), `Fact checker returned ${mustFixCount} must_fix item(s).`);
  }
  const gaps = sourceGapCount(factCheck);
  if (gaps > 0) {
    boundedDeduct(state, 'source-integrity', Math.min(10, gaps * 3), `Fact checker reported ${gaps} source gap(s).`);
  }
  const staleHardFailures = ensureArray(staleClaimReport?.hard_failures);
  if (staleClaimReport?.status === 'NEEDS_FIX' || staleHardFailures.length > 0) {
    boundedDeduct(
      state,
      'source-integrity',
      Math.min(12, Math.max(6, staleHardFailures.length * 6)),
      `Stale claim report has ${staleHardFailures.length} hard failure(s).`
    );
  }

  const finalSelectedCandidates = ensureArray(reporter.candidates).filter(isFinalSelected);
  const lowScoreSelected = finalSelectedCandidates.filter(candidate => {
    if (candidate.relevance_bucket && candidate.relevance_bucket !== BUCKETS.GENERIC_TECH_WATCHLIST) {
      return scopeScore(candidate) < 2;
    }
    const total =
      Number(candidate.camera_hal_relevance_score || 0) +
      Number(candidate.android_camera_relevance_score || 0) +
      Number(candidate.practical_actionability_score || 0);
    return total < 8;
  });
  if (lowScoreSelected.length > 0) {
    boundedDeduct(state, 'scope-relevance', Math.min(8, lowScoreSelected.length * 2), `${lowScoreSelected.length} final-selected candidate(s) have weak HAL/actionability scores under the expanded AOSP Camera / driver / SoC / native relevance model.`);
  }

  const totalDeductions = state.deductions.reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, 100 - totalDeductions);
  const hasFactCheckMustFix = factCheck.status === 'NEEDS_FIX' || mustFixCount > 0;
  const blockers = blockingDeductions(state.deductions);
  const softItems = softDeductions(state.deductions);
  const articleResults = buildArticleResults(sections, state.deductions, factCheck, sectionCountDetails);
  const articleSectionContract = summarizeArticleSectionContracts(sections);
  const status = determineQualityStatus(score, threshold, {
    sourceGapCount: gaps,
    hasFactCheckMustFix,
    blockingDeductions: blockers
  });
  return {
    schema_version: 1,
    date,
    score,
    max_score: 100,
    threshold,
    status,
    summary: status === 'PASS'
      ? `Quality score ${score}, threshold ${threshold}, max score 100. Editor review is ready.`
      : `Quality score ${score}, threshold ${threshold}, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.`,
    deductions: state.deductions,
    article_results: articleResults,
    metrics: {
      article_count: sections.length,
      briefing_count: ensureArray(editor.briefing).length,
      camera_article_count: primaryCameraStackCount,
      legacy_regex_camera_article_count: countSections(sections, /카메라\s*HAL|안드로이드\s*카메라|카메라2|Camera HAL|Android Camera|CameraX|AOSP Camera|Camera2|CTS|VTS|Camera ITS/i),
      expanded_scope_article_count: expandedScopeCoverage,
      direct_aosp_camera_count: directAospCameraCount,
      camera_driver_image_pipeline_count: cameraDriverImagePipelineCount,
      android_platform_camera_adjacent_count: androidPlatformCameraAdjacentCount,
      soc_platform_signal_count: socPlatformSignalCount,
      cpp_ai_tooling_fallback_count: cppAiToolingFallbackCount,
      generic_tech_watchlist_count: genericTechWatchlistCount,
      primary_camera_stack_count: primaryCameraStackCount,
      supporting_main_article_count: supportingMainArticleCount,
      forbidden_main_article_count: forbiddenMainArticleCount,
      fallback_relevance_count: fallbackRelevanceCount,
      publishable_scope_count: publishableScopeCount,
      composition_mode: compositionMode,
      section_count_details: sectionCountDetails,
      relevance_bucket_counts: scopeBucketCounts,
      ai_article_count: sections.filter(hasValidAiRelevance).length,
      fact_check_status: factCheck.status || 'UNKNOWN',
      must_fix_count: mustFixCount,
      source_gap_count: gaps,
      stale_claim_status: staleClaimReport?.status || 'UNKNOWN',
      stale_claim_removed_count: ensureArray(staleClaimReport?.stale_claim_items_removed).length +
        ensureArray(staleClaimReport?.unsupported_release_claims_removed).length,
      stale_claim_hard_failure_count: staleHardFailures.length,
      source_integrity_violation_count: sourceIntegrityViolationCount,
      blocking_deduction_count: blockers.length,
      blocking_deduction_categories: [...new Set(blockers.map(deduction => deduction.category))],
      hard_fail_count: blockers.length,
      soft_deduction_count: softItems.length,
      article_gate_counts: articleResults.reduce((counts, item) => {
        counts[item.status] = (counts[item.status] || 0) + 1;
        return counts;
      }, { PASS: 0, DEMOTE: 0, FAIL: 0 }),
      article_section_contract: articleSectionContract,
      top_deduction_categories: summarizeDeductionCategories(state.deductions).slice(0, 5),
      candidate_exclusion_summary: summarizeCandidateExclusions(reporter).slice(0, 5)
    }
  };
}

function buildQualityReportMarkdown(report) {
  const deductions = ensureArray(report.deductions);
  const hardItems = blockingDeductions(deductions);
  const softItems = softDeductions(deductions);
  const metrics = report.metrics || {};
  const articleCount = Number(metrics.article_count);
  const compositionFailure = Number.isFinite(articleCount) && (articleCount < articlePolicy.mainArticleCount.min || articleCount > articlePolicy.mainArticleCount.max)
    ? `- Article composition failure: ${articleCount} main articles were generated; Newsletter Policy range is ${articleCountRangeText()}.`
    : '- Underfilled/composition failure: none';
  const topDeductionCategories = ensureArray(metrics.top_deduction_categories)
    .map(item => `- ${item.category} (${item.count})`)
    .join('\n') || '- none';
  const candidateExclusionSummary = ensureArray(metrics.candidate_exclusion_summary)
    .map(item => `- ${item.reason} (${item.count})`)
    .join('\n') || '- none';
  const articleGateRows = ensureArray(report.article_results).map(item => [
    `| ${item.index || ''} `,
    ` ${item.status || 'UNKNOWN'} `,
    ` ${item.repair_action || ''} `,
    ` ${item.headline || ''} `,
    ` ${item.scope_count?.relevance_bucket || ''} `,
    ` ${item.scope_count?.editorial_priority ?? ''} `,
    ` ${item.scope_count?.counts_as_primary_camera_topic === true} `,
    ` ${item.scope_count?.counts_as_driver_topic === true} `,
    ` ${item.scope_count?.counts_as_soc_topic === true} `,
    ` ${item.scope_count?.counts_as_fallback_topic === true} `,
    ` ${item.scope_count?.publishable_scope === true} `,
    ` ${item.scope_count?.binding_status || ''} `,
    ` ${item.scope_count?.binding_source || ''} `,
    ` ${item.scope_count?.metadata_source || ''} `,
    ` ${ensureArray(item.scope_count?.missing_score_fields).join(', ') || 'none'} `,
    ` ${item.scope_count?.count_reason || ''} `,
    ` ${item.scope_count?.exclusion_reason_if_not_counted || 'none'} `,
    ` ${ensureArray(item.hard_fail_reasons).join('; ') || 'none'} `,
    ` ${ensureArray(item.soft_deductions).map(deduction => `${deduction.category}: ${deduction.reason}`).join('; ') || 'none'} |`
  ].join('|')).join('\n') || '| none | none | none | none | none | none | none | none | none | none | none | none | none | none | none | none |';
  const articleStructureRows = articleSectionContractMarkdownRows(report);
  const hardDeductionLines = hardItems.map(item => `- ${item.points} pt [${item.category}] ${item.location ? `${item.location}: ` : ''}${item.reason}`).join('\n') || '- none';
  const softDeductionLines = softItems.map(item => `- ${item.points} pt [${item.category}] ${item.location ? `${item.location}: ` : ''}${item.reason}`).join('\n') || '- none';

  return `# 뉴스레터 품질 리포트 - ${report.date}

## Gate Result

- Quality score: ${report.score}
- Quality threshold: ${report.threshold}
- Max score: ${report.max_score || 100}
- Result: ${report.status}
- Summary: ${report.summary}

## Composition

- Main article count: ${metrics.article_count}
- Briefing count: ${metrics.briefing_count}
- Structured camera article count: ${metrics.camera_article_count}
- Legacy regex camera article count: ${metrics.legacy_regex_camera_article_count ?? 'n/a'}
- Expanded-scope article count: ${metrics.expanded_scope_article_count}
- direct_aosp_camera count: ${metrics.direct_aosp_camera_count ?? 0}
- camera_driver_image_pipeline count: ${metrics.camera_driver_image_pipeline_count ?? 0}
- android_platform_camera_adjacent count: ${metrics.android_platform_camera_adjacent_count ?? 0}
- soc_platform_signal count: ${metrics.soc_platform_signal_count ?? 0}
- cpp_ai_tooling_fallback count: ${metrics.cpp_ai_tooling_fallback_count ?? 0}
- generic_tech_watchlist count: ${metrics.generic_tech_watchlist_count ?? 0}
- primary_camera_stack_count: ${metrics.primary_camera_stack_count ?? 0}
- supporting_main_article_count: ${metrics.supporting_main_article_count ?? 0}
- forbidden_main_article_count: ${metrics.forbidden_main_article_count ?? 0}
- fallback_relevance_count: ${metrics.fallback_relevance_count ?? 0}
- publishable_scope_count: ${metrics.publishable_scope_count ?? 0}
- composition_mode: ${metrics.composition_mode || 'UNKNOWN'}
- Newsletter Policy gate: ${publishGateCriteriaText()}
- Relevance bucket counts: ${JSON.stringify(metrics.relevance_bucket_counts || {})}
- AI article count: ${metrics.ai_article_count}
${compositionFailure}

## Fact Check And Source Integrity

- Fact-check status: ${metrics.fact_check_status}
- Must-fix count: ${metrics.must_fix_count}
- Source-gap count: ${metrics.source_gap_count}
- Stale claim status: ${metrics.stale_claim_status || 'UNKNOWN'}
- Stale claim removals: ${metrics.stale_claim_removed_count ?? 0}
- Stale claim hard failures: ${metrics.stale_claim_hard_failure_count ?? 0}
- Source integrity violation count: ${metrics.source_integrity_violation_count || 0}
- Blocking deduction count: ${metrics.blocking_deduction_count || 0}
- Blocking deduction categories: ${ensureArray(metrics.blocking_deduction_categories).join(', ') || 'none'}
- Hard fail count: ${metrics.hard_fail_count || 0}
- Soft deduction count: ${metrics.soft_deduction_count || 0}

## Article Structure Contract

- Complete article sections: ${metrics.article_section_contract?.complete_count ?? 0}
- Incomplete article sections: ${metrics.article_section_contract?.incomplete_count ?? 0}
- Fallbacks used: ${metrics.article_section_contract?.fallback_count ?? 0}
- Contract warnings: ${metrics.article_section_contract?.warning_count ?? 0}
- Contract conflicts: ${metrics.article_section_contract?.conflict_count ?? 0}

| # | Article | 5-section | HAL impact | Action item | Overclaim risk |
| ---: | --- | --- | --- | --- | --- |
${articleStructureRows}

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${articleGateRows}

## Hard Fails

${hardDeductionLines}

## Soft Deductions

${softDeductionLines}

## Top Deduction Categories

${topDeductionCategories}

## Candidate Exclusion Summary

${candidateExclusionSummary}

## Deductions

${deductions.length === 0 ? '- none' : deductions.map(item => `- ${item.points} pt [${item.category}] ${item.location ? `${item.location}: ` : ''}${item.reason}`).join('\n')}
`;
}

module.exports = {
  QUALITY_THRESHOLD,
  MIN_MAIN_ARTICLES,
  MAX_MAIN_ARTICLES,
  buildNewsletterQualityReport,
  buildQualityReportMarkdown,
  deductionMatchesSection,
  sectionHasQualityDeductions,
  sectionHasFactCheckMustFix,
  sectionHasSourceGap,
  sectionPassesArticleGate,
  blockingDeductions,
  determineQualityStatus
};
