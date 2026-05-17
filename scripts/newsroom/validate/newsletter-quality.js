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
const {
  buildHalSignalQualitySummary,
  buildMainArticleSignalChecks,
  normalizeHalSignalCapsule,
  normalizeHalSignalFields
} = require('../common/hal-signal-quality');
const {
  SOURCE_QUALITY_FIELD_DRIFT,
  normalizeSourceQuality,
  sourceQualityFieldDrift
} = require('../collect/source-quality-classifier');
const {
  summarizeClaimValidation,
  validateArticleClaims
} = require('./claim-source-binding');

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

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function halSignalInput(section = {}, candidate = {}, scope = {}) {
  return {
    ...objectValue(candidate),
    ...section,
    relevance_bucket: text(section.relevance_bucket) || text(candidate?.relevance_bucket) || text(scope?.relevance_bucket),
    scope_count: scope
  };
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
  const hasCanonicalSourceQuality = Boolean(candidate.source_quality && typeof candidate.source_quality === 'object' && !Array.isArray(candidate.source_quality));
  if (candidate.source_quality_required === true && !hasCanonicalSourceQuality) {
    violations.push('missing canonical source_quality');
  }
  if (hasCanonicalSourceQuality) {
    const sourceQuality = normalizeSourceQuality(candidate);
    const drift = sourceQualityFieldDrift(candidate);
    if (!candidateCanonicalUrl(candidate)) violations.push('missing_url');
    if (drift.length > 0) violations.push(SOURCE_QUALITY_FIELD_DRIFT);
    if (sourceQuality.source_url_quality === 'unknown') violations.push('unresolved source_url_quality=unknown');
    if (sourceQuality.source_quality_status === 'blocked') violations.push('source_quality_status=blocked');
    if (sourceQuality.main_article_source_allowed !== true) violations.push('main_article_source_allowed=false');
    for (const blocker of ensureArray(sourceQuality.main_article_source_blockers)) {
      violations.push(`source_quality_blocker=${blocker}`);
    }
  }
  return violations.join('; ');
}

function hasPattern(value, pattern) {
  return pattern.test(text(value));
}

function sourceExtractionFor(section = {}, candidate = {}) {
  return section.source_extraction || candidate?.source_extraction || null;
}

function derivedHintsFor(section = {}, candidate = {}) {
  return section.derived_editorial_hints || candidate?.derived_editorial_hints || null;
}

function extractionQualityFor(section = {}, candidate = {}) {
  return section.extraction_quality ||
    candidate?.extraction_quality ||
    section.source_extraction?.extraction_quality ||
    candidate?.source_extraction?.extraction_quality ||
    null;
}

function sourceExtractionItems(value = {}) {
  return [
    ...(Array.isArray(value?.release?.sections) ? value.release.sections : []),
    ...(Array.isArray(value?.minor_line_context?.sections) ? value.minor_line_context.sections : [])
  ].flatMap(section => ensureArray(section?.items));
}

function hasSourceExtractionBullet(value = {}) {
  return sourceExtractionItems(value).some(item => text(item?.text || item?.source_text));
}

function cameraXReleaseUrl(value = '') {
  const raw = text(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera';
  } catch {
    return /developer\.android\.com\/jetpack\/androidx\/releases\/camera/i.test(raw);
  }
}

function isCameraXReleaseArticle(section = {}, candidate = {}) {
  const extraction = sourceExtractionFor(section, candidate);
  if (extraction?.adapter_id === 'android-developers-jetpack-release') return true;
  return [
    section.source_candidate_url,
    candidate?.url,
    candidate?.article_url,
    candidate?.source_candidate_url,
    ...ensureArray(section.sources).map(source => source?.url),
    ...candidateUrls(candidate || {})
  ].some(cameraXReleaseUrl);
}

function articleTextWithLegacyFields(section = {}) {
  const articleSections = normalizeArticleSections(section);
  return [
    section.category,
    section.headline,
    section.what_changed,
    section.background,
    section.why_it_matters,
    section.camera_hal_perspective,
    section.confirmed_facts,
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes,
    section.camera_hal_checks,
    section.action_items,
    articleSections.verified_facts,
    articleSections.background_context,
    articleSections.hal_driver_impact,
    articleSections.action_items,
    articleSections.team_share_points,
    section.sources
  ].map(text).join(' ');
}

function fieldBuilderWarningsFor(section = {}, candidate = {}) {
  return [
    ...ensureArray(section.field_builder_warnings),
    ...ensureArray(candidate?.field_builder_warnings)
  ].map(text);
}

function hasRawCameraXTableArtifact(section = {}) {
  return /Maven Group versions?|View the Camera Library|Close\b|camera-[a-z0-9-]+\s+(?:-|\d+\.\d+\S*)\s+(?:-|\d+\.\d+\S*)/i
    .test(articleTextWithLegacyFields(section));
}

function hasGenericCameraXFallbackText(section = {}) {
  const value = text(section.what_changed || section.evidence_summary || section.headline);
  return /^CameraX(?:\s*\/\s*androidx\.camera)?\s+(?:update|updates|updated|release|released|업데이트|릴리스)(?:입니다|입니다\.|\.?)?$/i
    .test(value);
}

function hasCameraXHalBoundary(section = {}, hints = {}) {
  if (!text(hints?.hal_boundary)) return false;
  return /HAL boundary|not direct HAL|framework[-_\s]adjacent|framework adjacent|CameraX sits above camera2|above camera2|direct Camera HAL API.*not|not.*direct Camera HAL/i
    .test(articleTextWithLegacyFields(section));
}

function hasCameraXValidationChecklist(section = {}, hints = {}) {
  const articleText = articleTextWithLegacyFields(section);
  const articleSections = normalizeArticleSections(section);
  const actionItems = [
    ...ensureArray(section.action_items),
    ...ensureArray(section.camera_hal_checks),
    ...ensureArray(articleSections.action_items)
  ];
  if (actionItems.length === 0) return false;
  const targets = ensureArray(hints?.validation_targets).map(text).filter(Boolean);
  if (targets.length === 0) {
    return /\b(?:Camera ITS|CTS|VTS|stream|buffer|metadata|request\/result|VideoCapture|ImageAnalysis|CameraPipe|validation)\b/i
      .test(articleText);
  }
  return targets.some(target => {
    const terms = text(target).match(/\b(?:VideoCapture|ImageAnalysis|SessionConfig|CameraPipe|Camera2|stream|buffer|metadata|validation)\b/gi) || [];
    return terms.some(term => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(articleText));
  });
}

function hasDirectHalOverclaim(section = {}, candidate = {}) {
  const level = text(section.impact_claim_level || candidate?.impact_claim_level);
  if (level === 'direct_hal_change') return false;
  return /\b(?:direct\s+Camera\s+HAL|direct\s+HAL|HAL\s+API|vendor\s+HAL|HAL\s+contract|camera\s+provider\s+contract)\b/i
    .test(articleTextWithLegacyFields(section));
}

function cameraXSourceExtractionViolations(section = {}, candidate = {}) {
  if (!isCameraXReleaseArticle(section, candidate)) return [];
  const extraction = sourceExtractionFor(section, candidate);
  const quality = extractionQualityFor(section, candidate) || {};
  const hints = derivedHintsFor(section, candidate) || {};
  const violations = [];
  if (quality.used_fallback === true) violations.push('source_extraction.used_fallback=true');
  if (quality.main_article_allowed === false) violations.push('source_extraction.main_article_allowed=false');
  if (fieldBuilderWarningsFor(section, candidate).includes('behavior_fallback_from_metadata')) {
    violations.push('behavior_fallback_from_metadata');
  }
  if (hasRawCameraXTableArtifact(section)) violations.push('raw CameraX artifact table remains in article text');
  if (!extraction || !hasSourceExtractionBullet(extraction)) {
    violations.push('source_extraction.release.sections has no concrete release-note bullet');
  }
  if (hasGenericCameraXFallbackText(section)) violations.push('generic CameraX fallback text used as main article body');
  if (!hasCameraXHalBoundary(section, hints)) violations.push('CameraX HAL boundary is missing from the article');
  if (!hasCameraXValidationChecklist(section, hints)) violations.push('CameraX validation checklist is missing from the article');
  if (hasDirectHalOverclaim(section, candidate)) {
    violations.push('direct HAL contract/API claim lacks direct_hal_change source evidence');
  }
  return [...new Set(violations)];
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
    severity: options.severity || (blocking ? 'hard' : 'soft'),
    reason_code: options.reason_code || '',
    dedupe_key: options.dedupe_key || ''
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

function claimIssueCategory(reasonCode = '') {
  if ([
    'missing_claims',
    'missing_claim_id',
    'empty_claim_text',
    'invalid_claim_type',
    'invalid_overclaim_risk',
    'missing_source_urls',
    'missing_fact_evidence_ids',
    'duplicate_claim_id',
    'missing_fact_claim'
  ].includes(reasonCode)) return 'claim-contract';
  if (reasonCode === 'invalid_impact_level') return 'claim-impact-level';
  if ([
    'source_url_mismatch',
    'evidence_source_url_mismatch',
    'source_url_fragment_mismatch',
    'seed_evidence_pack_unmatched',
    'seed_evidence_pack_ambiguous',
    'seed_evidence_pack_url_only_shared_page_rejected',
    'seed_evidence_pack_url_fallback_rejected',
    'seed_evidence_pack_title_fallback_rejected',
    'seed_evidence_pack_ref_out_of_range',
    'seed_evidence_pack_ref_metadata_mismatch'
  ].includes(reasonCode)) return 'claim-source-binding';
  if (reasonCode === 'missing_matching_fact_claim') return 'claim-coverage';
  if ([
    'direct_hal_claim_without_direct_evidence',
    'do_not_claim_violation',
    'do_not_overstate_violation'
  ].includes(reasonCode)) return 'claim-overclaim';
  if ([
    'unknown_evidence_id',
    'keyword_hint_is_not_evidence',
    'gemini_proposal_is_not_evidence',
    'provenance_id_without_item_evidence',
    'blocked_or_failed_evidence_id',
    'derived_evidence_mapping',
    'fact_claim_not_supported_by_evidence_text',
    'runtime_claim_without_runtime_evidence',
    'stream_buffer_metadata_without_stream_buffer_metadata_evidence'
  ].includes(reasonCode)) return 'claim-evidence';
  return 'claim-binding';
}

function addClaimValidationDeductions(state, validation, location, seenKeys) {
  const claimIssues = [
    ...ensureArray(validation.issues).map(item => ({
      ...item,
      claim_id: '',
      category: claimIssueCategory(item.reason_code)
    })),
    ...ensureArray(validation.claim_results).flatMap(claim =>
      ensureArray(claim.issues).map(item => ({
        ...item,
        claim_id: claim.claim_id,
        category: claimIssueCategory(item.reason_code)
      }))
    )
  ];
  for (const item of claimIssues) {
    const dedupeKey = [
      validation.article_index,
      item.claim_id || 'article',
      item.reason_code || item.message
    ].join(':');
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    boundedDeduct(
      state,
      item.category,
      item.blocking === false ? 1 : 8,
      item.message || item.reason_code || 'Claim validation issue.',
      location,
      {
        blocking: item.blocking !== false,
        severity: item.severity || (item.blocking === false ? 'soft' : 'hard'),
        reason_code: item.reason_code,
        dedupe_key: dedupeKey
      }
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
  if (hardItems.some(item => item.category === 'hal-signal' || item.category === 'hal-signal-capsule')) return 'FAIL';
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

function truncateText(value, limit = 100) {
  const normalized = String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > limit ? `${normalized.slice(0, Math.max(0, limit - 3))}...` : normalized;
}

function articleSectionContractMarkdownRows(report) {
  return ensureArray(report.article_results).map(item => {
    const summary = item.section_contract || {};
    const missing = ensureArray(summary.missing_keys);
    const row = [
      item.index || '',
      item.headline || '',
      summary.complete === true && missing.length === 0 ? 'pass' : `missing ${missing.join(', ') || 'unknown'}`,
      missing.includes('hal_driver_impact') ? 'missing' : 'present',
      missing.includes('action_items') ? 'missing' : 'present'
    ];
    return `| ${row.map(markdownTableCell).join(' | ')} |`;
  }).join('\n') || '| none | none | none | none | none |';
}

function buildNewsletterQualityReport(date, editor, reporter = {}, factCheck = {}, options = {}) {
  const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : qualityGatePolicy.threshold;
  const sections = ensureArray(editor.sections);
  const state = { deductions: [] };
  const bindingIndex = candidateBindingIndex(reporter, options.shortlistReport || null);
  const staleClaimReport = options.staleClaimReport || null;
  const strictClaimValidation = options.strictClaimValidation === true;
  const seedEvidencePack = options.seedEvidencePack || null;
  const claimValidations = [];
  const claimDeductionKeys = new Set();
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
    const claimValidation = validateArticleClaims({
      section,
      candidate: binding.status === 'bound' ? binding.candidate : {},
      articleIndex: index,
      strict: strictClaimValidation,
      seedEvidencePack
    });
    claimValidations.push(claimValidation);
    addClaimValidationDeductions(state, claimValidation, location, claimDeductionKeys);
    const cameraXViolations = cameraXSourceExtractionViolations(
      section,
      binding.status === 'bound' ? binding.candidate : null
    );
    if (cameraXViolations.length > 0) {
      sourceIntegrityViolationCount += 1;
      boundedDeduct(
        state,
        'source-integrity',
        8,
        `CameraX source extraction failure: ${cameraXViolations.join('; ')}.`,
        location
      );
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
    const halSignalInputValue = halSignalInput(
      section,
      binding.status === 'bound' ? binding.candidate : {},
      scope
    );
    const halSignal = normalizeHalSignalFields(halSignalInputValue);
    const halSignalReason = {
      missing_hal_impact_axis: 'Main article lacks a non-reference HAL impact axis.',
      actionability_none: 'Main article has actionability_level=none and cannot be publish-ready.',
      generic_review_actionability: 'Main article actionability_level=generic_review lacks at least two concrete owner/test/log/metric/API/stream/buffer/metadata signals.',
      fallback_promotion_missing_reason: 'Fallback article lacks fallback_promotion_allowed=true or fallback_promotion_reason before main promotion.',
      soc_platform_missing_camera_pipeline_link: 'SoC platform signal lacks explicit camera_pipeline_link.'
    };
    for (const blocker of ensureArray(halSignal.hal_signal_hard_blockers)) {
      boundedDeduct(
        state,
        'hal-signal',
        blocker === 'missing_hal_impact_axis' ? 8 : 6,
        halSignalReason[blocker] || `HAL signal hard blocker: ${blocker}.`,
        location
      );
    }
    const halSignalCapsule = normalizeHalSignalCapsule(section);
    if (!halSignalCapsule.present) {
      boundedDeduct(
        state,
        'hal-signal-capsule',
        8,
        'Missing HAL Signal Capsule for main article.',
        location
      );
    } else if (!halSignalCapsule.complete) {
      boundedDeduct(
        state,
        'hal-signal-capsule',
        6,
        `Incomplete HAL Signal Capsule; missing keys: ${halSignalCapsule.missing_keys.join(', ')}.`,
        location
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
  const claimValidationSummary = summarizeClaimValidation(claimValidations);
  const claimResults = claimValidations.flatMap(item => ensureArray(item.claim_results));
  const uncoveredFacts = claimValidations.flatMap(item => ensureArray(item.uncovered_facts));
  const halSignalArticles = sections.map((section, index) => halSignalInput(
    section,
    sectionBindings[index]?.status === 'bound' ? sectionBindings[index].candidate : {},
    sectionScopes[index]
  ));
  const halSignalQualitySummary = buildHalSignalQualitySummary(halSignalArticles);
  const mainArticleSignalChecks = buildMainArticleSignalChecks(halSignalArticles);
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
    claim_validation_summary: claimValidationSummary,
    claim_results: claimResults,
    uncovered_facts: uncoveredFacts,
    hal_signal_quality_summary: halSignalQualitySummary,
    main_article_signal_checks: mainArticleSignalChecks,
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
      claim_validation_summary: claimValidationSummary,
      derived_evidence_mapping_count: claimValidationSummary.derived_evidence_mapping_count || 0,
      uncovered_fact_count: uncoveredFacts.length,
      hal_signal_quality_summary: halSignalQualitySummary,
      main_article_signal_checks: mainArticleSignalChecks,
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
  const halSignalSummary = report.hal_signal_quality_summary || metrics.hal_signal_quality_summary || {};
  const claimSummary = report.claim_validation_summary || metrics.claim_validation_summary || {};
  const claimRows = ensureArray(report.claim_results)
    .slice(0, 40)
    .map(item => [
      item.article_headline || `article ${item.article_index || ''}`,
      `${item.claim_id || 'claim'}: ${truncateText(item.text || '', 100)}`,
      item.claim_type || 'unknown',
      item.status || 'not_available',
      item.impact_level || 'unknown',
      item.overclaim_risk || 'unknown',
      ensureArray(item.issues).map(issue => issue.reason_code || issue.message).filter(Boolean).join(', ') || 'none',
      ensureArray(item.evidence_ids).join(', ') || 'none',
      ensureArray(item.source_urls).join(', ') || 'none'
    ])
    .map(row => `| ${row.map(markdownTableCell).join(' | ')} |`)
    .join('\n') || '| none | none | none | none | none | none | none | none | none |';
  const uncoveredFactLines = ensureArray(report.uncovered_facts)
    .slice(0, 12)
    .map(item => `- article=${item.article_index}; headline=${markdownTableCell(item.article_headline || '')}; field=${item.field}; reason=${item.reason_code}; text=${markdownTableCell(item.text || '')}`)
    .join('\n') || '- none';
  const halSignalRows = ensureArray(report.main_article_signal_checks || metrics.main_article_signal_checks)
    .map(item => [
      item.index || '',
      item.title || '',
      item.signal_quality_status || 'unknown',
      item.actionability_level || 'unknown',
      item.effective_actionability_level || item.actionability_level || 'unknown',
      ensureArray(item.hal_impact_axes).join(', ') || 'none',
      item.hal_signal_capsule_complete === true ? 'complete' : `missing ${ensureArray(item.hal_signal_capsule_missing_keys).join(', ') || 'capsule'}`,
      ensureArray(item.hard_blocker_reason_codes || item.hard_blockers).join(', ') || 'none'
    ]);
  const halSignalTable = halSignalRows.length > 0
    ? halSignalRows.map(row => `| ${row.map(markdownTableCell).join(' | ')} |`).join('\n')
    : '| none | none | none | none | none | none | none | none |';
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
  const deductionLine = item => {
    const reasonCode = item.reason_code ? ` (${item.reason_code})` : '';
    return `- ${item.points} pt [${item.category}] ${item.location ? `${item.location}: ` : ''}${item.reason}${reasonCode}`;
  };
  const hardDeductionLines = hardItems.map(deductionLine).join('\n') || '- none';
  const softDeductionLines = softItems.map(deductionLine).join('\n') || '- none';

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

## HAL Signal Quality

- strong_signal_count: ${halSignalSummary.strong_signal_count ?? 0}
- usable_signal_count: ${halSignalSummary.usable_signal_count ?? 0}
- weak_signal_count: ${halSignalSummary.weak_signal_count ?? 0}
- watchlist_only_count: ${halSignalSummary.watchlist_only_count ?? 0}
- blocked_source_gap_count: ${halSignalSummary.blocked_source_gap_count ?? 0}
- article_count_with_hal_signal_capsule: ${halSignalSummary.article_count_with_hal_signal_capsule ?? 0}
- article_count_without_hal_signal_capsule: ${halSignalSummary.article_count_without_hal_signal_capsule ?? 0}
- generic_signal_hard_blocker_count: ${halSignalSummary.generic_signal_hard_blocker_count ?? 0}
- hal_signal_hard_blocker_count: ${halSignalSummary.hal_signal_hard_blocker_count ?? 0}
- hard_blocker_reason_code_counts: ${JSON.stringify(halSignalSummary.hard_blocker_reason_code_counts || {})}
- hal_impact_axis_counts: ${JSON.stringify(halSignalSummary.hal_impact_axis_counts || {})}
- actionability_level_counts: ${JSON.stringify(halSignalSummary.actionability_level_counts || {})}
- effective_actionability_level_counts: ${JSON.stringify(halSignalSummary.effective_actionability_level_counts || {})}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${halSignalTable}

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

## Claim Binding

- Claim validation status: ${claimSummary.status || 'not_available'}
- Claim coverage: bound_claims=${claimSummary.bound_claims ?? 'unknown'}; total_claims=${claimSummary.total_claims ?? 'unknown'}
- Derived evidence mapping count: ${claimSummary.derived_evidence_mapping_count ?? metrics.derived_evidence_mapping_count ?? 0}
- Overclaim risk: ${claimSummary.overclaim_risk || 'unknown'}
- Uncovered fact count: ${metrics.uncovered_fact_count ?? ensureArray(report.uncovered_facts).length}

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${claimRows}

### Uncovered Facts

${uncoveredFactLines}

## Article Structure Contract

- Complete article sections: ${metrics.article_section_contract?.complete_count ?? 0}
- Incomplete article sections: ${metrics.article_section_contract?.incomplete_count ?? 0}

| # | Article | 5-section | HAL impact | Action item |
| ---: | --- | --- | --- | --- |
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
