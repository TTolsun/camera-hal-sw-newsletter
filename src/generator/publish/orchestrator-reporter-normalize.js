// Orchestrator reporter-output normalization helpers.
//
// Single responsibility: turn raw LLM reporter output and editor sections into
// the deterministic, validated candidate / section shape the rest of the
// pipeline expects — candidate field coercion, reporter<->shortlist
// reconciliation, image-provenance restoration, and editor-section
// normalization. Pure transforms on their arguments only — no
// generationRunState, no fs, no module globals — extracted verbatim from the
// generation orchestrator (gemini-newsroom-newsletter.js).

const { ensureArray } = require('../render/newsletter-renderer');
const { isSafeExternalImageUrl } = require('../../shared/render/image-candidates');
const { numberOrDefault, stringOrEmpty } = require('./orchestrator-shared-helpers');
const {
  normalizeUrl,
  normalizedUrlHash
} = require('../select/newsroom-selection');
const { BUCKETS, BUCKET_PRIORITY } = require('../../shared/domain/aosp-camera-scope');
const {
  isFinalSelected,
  normalizeReporterReport
} = require('../select/selection-diagnostics');
const { candidateGroupKey } = require('../../shared/common/article-groups');
const { classifyHalImpact } = require('../reporter/hal-impact-classifier');
const { capsuleInputForCandidates } = require('../select/article-capsules');
const { mergePublicArticleFromLlm } = require('../reporter/public-article-contract');
const { dropVerifiedFactsClassifiedAsNonFact } = require('../editor/editor-output-contract');
const { urlKeys } = require('../../shared/common/section-identity');
const {
  reporterCandidateId,
  buildReporterCandidateIndexes,
  matchReporterOutputCandidate,
  reporterMergeWarning,
  mergeReporterEvidenceFields
} = require('./orchestrator-reporter-match');

const fallbackCategories = ['AOSP Camera Watch', 'Camera Driver / SoC Platform Watch', 'C++ / AI Practical Tip'];

function booleanFromCandidate(collected, candidate, field, fallback = false) {
  if (typeof collected[field] === 'boolean') return collected[field];
  if (typeof candidate[field] === 'boolean') return candidate[field];
  return fallback;
}

function imageCandidatesForReporterCandidate(candidate, collectedByUrl) {
  const collected = collectedByUrl.get(candidate.url) || collectedByUrl.get(candidate.article_url) || {};
  const images = ensureArray(candidate.imageCandidates).length > 0
    ? ensureArray(candidate.imageCandidates)
    : ensureArray(collected.imageCandidates);
  return images.filter(image => image && image.url && isSafeExternalImageUrl(image.url));
}

function collectedCandidateFor(candidate, collectedByUrl) {
  return collectedByUrl.get(candidate.url) ||
    collectedByUrl.get(candidate.article_url) ||
    collectedByUrl.get(candidate.articleUrl) ||
    {};
}

function reporterCandidateRejectionReason(candidate) {
  const halActionability =
    Number(candidate.camera_hal_relevance_score || 0) +
    Number(candidate.android_camera_relevance_score || 0) +
    Number(candidate.practical_actionability_score || 0);
  if (!['main', 'short'].includes(candidate.finalSelectionEligibility)) {
    return `finalSelectionEligibility=${candidate.finalSelectionEligibility || 'unknown'}`;
  }
  if (candidate.isWatchPage === true && candidate.hasDatedEvidence !== true) {
    return 'watch page without dated evidence';
  }
  if (candidate.main_eligible === false) return 'main_eligible=false';
  if (candidate.source_gap_risk === true) return 'source_gap_risk=true';
  if (Number(candidate.evidence_score || 0) < 6) return `evidence_score=${Number(candidate.evidence_score || 0)} < 6`;
  if (halActionability < 8) return `HAL/actionability score ${halActionability} < 8`;
  return '';
}

function reporterCandidateMainArticleBlockReason(candidate, options = {}) {
  const reason = reporterCandidateRejectionReason(candidate);
  if (reason) return reason;
  if (isReserveCandidate(candidate) && options.allowReserve !== true) {
    return 'premature_reserve_candidate';
  }
  if (!isFinalSelected(candidate) && !isReserveCandidate(candidate)) return 'final_selected=false';
  return '';
}

function isReserveCandidate(candidate = {}) {
  return candidate.reserve_candidate === true || candidate.selection_stage === 'deterministic-reserve';
}

function isMainSupplementBucket(candidate = {}) {
  return Boolean(candidate.relevance_bucket) && candidate.relevance_bucket !== BUCKETS.GENERIC_TECH_WATCHLIST;
}

function candidatePriority(candidate = {}) {
  return BUCKET_PRIORITY[candidate.relevance_bucket] || 99;
}

function validateReporter(value, date, collectedCandidates = []) {
  const deterministicCandidates = ensureArray(collectedCandidates);
  const collectedByUrl = new Map();
  for (const candidate of deterministicCandidates) {
    if (candidate.url) collectedByUrl.set(candidate.url, candidate);
    if (candidate.article_url) collectedByUrl.set(candidate.article_url, candidate);
    if (candidate.articleUrl) collectedByUrl.set(candidate.articleUrl, candidate);
  }

  if (value.date !== date) value.date = date;
  if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
    throw new Error('Reporter output must contain at least one candidate.');
  }
  const reporterMergeWarnings = [];
  const matchedByCandidate = new Map();
  const seenOutputIds = new Set();
  const indexes = buildReporterCandidateIndexes(deterministicCandidates.length > 0 ? deterministicCandidates : value.candidates);
  for (const outputCandidate of value.candidates) {
    const outputId = stringOrEmpty(outputCandidate.candidate_id);
    if (outputId) {
      if (seenOutputIds.has(outputId)) {
        reporterMergeWarnings.push(reporterMergeWarning(outputCandidate, 'duplicate_output_candidate_id'));
        continue;
      }
      seenOutputIds.add(outputId);
    }
    const deterministic = matchReporterOutputCandidate(outputCandidate, indexes, reporterMergeWarnings);
    if (!deterministic) continue;
    if (matchedByCandidate.has(deterministic)) {
      reporterMergeWarnings.push(reporterMergeWarning(outputCandidate, 'duplicate_output_match', {
        matched_candidate_id: reporterCandidateId(deterministic)
      }));
      continue;
    }
    matchedByCandidate.set(deterministic, outputCandidate);
  }

  const rejectedMainIneligible = [];
  const normalizedCandidates = [];
  const outputBase = deterministicCandidates.length > 0 ? deterministicCandidates : value.candidates;
  for (const baseCandidate of outputBase) {
    const candidate = mergeReporterEvidenceFields(baseCandidate, matchedByCandidate.get(baseCandidate));
    if (!candidate.title || !candidate.url || !candidate.source) {
      throw new Error('Reporter candidate is missing title, source, or url.');
    }
    const collected = collectedCandidateFor(candidate, collectedByUrl);
    candidate.candidate_id = reporterCandidateId(candidate);
    candidate.camera_hal_relevance_score = numberOrDefault(candidate.camera_hal_relevance_score);
    candidate.android_camera_relevance_score = numberOrDefault(candidate.android_camera_relevance_score);
    candidate.practical_actionability_score = numberOrDefault(candidate.practical_actionability_score);
    candidate.source_reliability_score = numberOrDefault(candidate.source_reliability_score);
    candidate.freshness_score = numberOrDefault(candidate.freshness_score);
    candidate.ai_required_slot_fit_score = numberOrDefault(candidate.ai_required_slot_fit_score);
    candidate.cpp_fallback_value_score = numberOrDefault(candidate.cpp_fallback_value_score);
    candidate.version_or_release = stringOrEmpty(candidate.version_or_release || collected.version_or_release);
    candidate.api_or_component = stringOrEmpty(candidate.api_or_component || collected.api_or_component);
    candidate.behavior_change = stringOrEmpty(candidate.behavior_change || collected.behavior_change);
    candidate.effective_date = stringOrEmpty(collected.effective_date || candidate.effective_date);
    candidate.date_source = stringOrEmpty(collected.date_source || candidate.date_source);
    candidate.date_confidence = numberOrDefault(collected.date_confidence ?? candidate.date_confidence);
    candidate.source_event_id = stringOrEmpty(collected.source_event_id || candidate.source_event_id);
    candidate.evidence_id = stringOrEmpty(collected.evidence_id || candidate.evidence_id);
    candidate.event_type = stringOrEmpty(collected.event_type || candidate.event_type);
    candidate.needs_editor_date_review = typeof collected.needs_editor_date_review === 'boolean'
      ? collected.needs_editor_date_review
      : Boolean(candidate.needs_editor_date_review);
    candidate.collectionMode = stringOrEmpty(collected.collectionMode || collected.collection_mode || candidate.collectionMode);
    candidate.isArticleCandidate = booleanFromCandidate(collected, candidate, 'isArticleCandidate',
      Boolean(collected.is_article_candidate));
    candidate.isWatchPage = booleanFromCandidate(collected, candidate, 'isWatchPage',
      Boolean(collected.is_watch_page));
    candidate.hasDatedEvidence = booleanFromCandidate(collected, candidate, 'hasDatedEvidence',
      Boolean(collected.has_dated_evidence));
    candidate.evidenceLevel = stringOrEmpty(collected.evidenceLevel || collected.evidence_level || candidate.evidenceLevel);
    candidate.finalSelectionEligibility = stringOrEmpty(
      collected.finalSelectionEligibility ||
      collected.final_selection_eligibility ||
      candidate.finalSelectionEligibility
    );
    candidate.source_kind = stringOrEmpty(collected.source_kind || candidate.source_kind);
    candidate.source_gap_risk = typeof collected.source_gap_risk === 'boolean'
      ? collected.source_gap_risk
      : Boolean(candidate.source_gap_risk);
    candidate.main_eligible = typeof collected.main_eligible === 'boolean'
      ? collected.main_eligible
      : Boolean(candidate.main_eligible);
    candidate.briefing_only = typeof collected.briefing_only === 'boolean'
      ? collected.briefing_only
      : Boolean(candidate.briefing_only);
    candidate.reference_only = typeof collected.reference_only === 'boolean'
      ? collected.reference_only
      : Boolean(candidate.reference_only);
    candidate.evidence_score = numberOrDefault(collected.evidence_score ?? candidate.evidence_score);
    candidate.evidence_notes = ensureArray(candidate.evidence_notes);
    candidate.cross_check_status = stringOrEmpty(candidate.cross_check_status || 'not-required');
    candidate.editorial_priority = numberOrDefault(collected.editorial_priority ?? candidate.editorial_priority, 6);
    candidate.relevance_bucket = stringOrEmpty(collected.relevance_bucket || candidate.relevance_bucket || 'generic_tech_watchlist');
    candidate.aosp_camera_directness = numberOrDefault(collected.aosp_camera_directness ?? candidate.aosp_camera_directness);
    candidate.driver_stack_relevance = numberOrDefault(collected.driver_stack_relevance ?? candidate.driver_stack_relevance);
    candidate.soc_platform_relevance = numberOrDefault(collected.soc_platform_relevance ?? candidate.soc_platform_relevance);
    candidate.native_tooling_relevance = numberOrDefault(collected.native_tooling_relevance ?? candidate.native_tooling_relevance);
    candidate.counts_as_primary_camera_topic = booleanFromCandidate(collected, candidate, 'counts_as_primary_camera_topic');
    candidate.counts_as_driver_topic = booleanFromCandidate(collected, candidate, 'counts_as_driver_topic');
    candidate.counts_as_soc_topic = booleanFromCandidate(collected, candidate, 'counts_as_soc_topic');
    candidate.counts_as_fallback_topic = booleanFromCandidate(collected, candidate, 'counts_as_fallback_topic');
    delete candidate.impact_claim_level;
    delete candidate.impactClaimLevel;
    candidate.evidence_origin = stringOrEmpty(collected.evidence_origin || candidate.evidence_origin || 'unknown');
    candidate.source_hint = stringOrEmpty(collected.source_hint || candidate.source_hint || collected.usageHint || collected.source_usage_hint);
    candidate.article_group_key = stringOrEmpty(collected.article_group_key || candidate.article_group_key || candidateGroupKey(collected));
    candidate.tooling_workflow_type = stringOrEmpty(collected.tooling_workflow_type || candidate.tooling_workflow_type);
    candidate.native_workflow_evidence_score = numberOrDefault(collected.native_workflow_evidence_score ?? candidate.native_workflow_evidence_score);
    candidate.related_context_candidates = ensureArray(collected.related_context_candidates || candidate.related_context_candidates);
    candidate.imageCandidates = imageCandidatesForReporterCandidate(candidate, collectedByUrl);
    // #477: 후보에 보수적인 report-only HAL impact signal을 붙인다. editor용 진단
    // 정보일 뿐이며 selection이나 publish gate 판정에는 영향을 주지 않는다.
    candidate.hal_signal = classifyHalImpact(candidate, {
      sourceQuality: { source_url_quality: candidate.source_url_quality || candidate.sourceUrlQuality }
    });
    const rejectionReason = reporterCandidateRejectionReason(candidate);
    candidate.evidence_eligible = !rejectionReason;
    // Keep legacy aliases, but final/editor selection is owned by final_selected/selected_for_editor.
    candidate.reporter_selected = candidate.evidence_eligible;
    candidate.selected = candidate.evidence_eligible;
    if (rejectionReason) {
      rejectedMainIneligible.push({
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        reason: rejectionReason
      });
    }
    normalizedCandidates.push(candidate);
  }
  value.candidates = normalizedCandidates;
  value.reporter_merge_warnings = reporterMergeWarnings;
  value.rejected_main_ineligible_candidates = rejectedMainIneligible;
  return value;
}

function enforceDeterministicReporterSelection(reporter, shortlistReport) {
  const finalByUrl = new Map([
    ...ensureArray(shortlistReport?.primary_selected_articles),
    ...ensureArray(shortlistReport?.selected_articles),
    ...ensureArray(shortlistReport?.reserve_candidates),
    ...ensureArray(shortlistReport?.shortlisted_candidates),
    ...ensureArray(shortlistReport?.demoted_candidates),
    ...ensureArray(shortlistReport?.excluded_candidates)
  ].map(candidate => [normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl), candidate]));

  reporter.candidates = ensureArray(reporter.candidates).map(candidate => {
    const url = normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl);
    const deterministic = finalByUrl.get(url) || {};
    return {
      ...deterministic,
      ...candidate,
      deterministic_score: deterministic.deterministic_score ?? candidate.deterministic_score,
      score_breakdown: deterministic.score_breakdown || candidate.score_breakdown,
      final_selected: isFinalSelected(deterministic),
      selected_for_editor: isFinalSelected(deterministic),
      primary_selected: isFinalSelected(deterministic),
      reserve_candidate: isReserveCandidate(deterministic),
      selection_slot: isFinalSelected(deterministic)
        ? deterministic.selection_slot || candidate.selection_slot || 'deterministic-final'
        : isReserveCandidate(deterministic)
          ? deterministic.selection_slot || candidate.selection_slot || 'reserve'
          : ''
    };
  });
  return normalizeReporterReport(reporter, shortlistReport);
}

function selectedReporterCapsules(date, reporter, capsuleReport, options = {}) {
  return capsuleInputForCandidates(date, ensureArray(reporter.candidates).filter(isFinalSelected), capsuleReport, options);
}

function reserveReporterCapsules(date, reporter, capsuleReport, options = {}) {
  return capsuleInputForCandidates(date, ensureArray(reporter.candidates).filter(isReserveCandidate), capsuleReport, options);
}

// #724 always-on: coverage 재조정이 main-set을 바꾼 뒤, reporter 후보의 선택 플래그를 재조정
// 결과에 맞춘다. editor/fact-check/repair/completion/judge는 전부 selectedReporterCapsules
// (= reporter.candidates.filter(isFinalSelected))로 작성·검증 대상 집합을 정하므로, 이 재동기화가
// 없으면 콘텐츠는 재조정 前 집합을 쓰고 publish_ready/composition은 재조정 後 집합을 써서 발행
// 콘텐츠와 게이트가 어긋난다. enforceDeterministicReporterSelection은 pristine
// primary_selected_articles까지 참조 map에 넣어 강등 후보가 그대로 남으므로 재사용하지 않고,
// 재조정된 main 집합만으로 플래그를 직접 세팅한다.
function syncReporterSelectionToMain(reporter, reconciledMain) {
  const mainUrls = new Set(ensureArray(reconciledMain)
    .map(candidate => normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl))
    .filter(Boolean));
  reporter.candidates = ensureArray(reporter.candidates).map(candidate => {
    const selected = mainUrls.has(normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl));
    return {
      ...candidate,
      final_selected: selected,
      selected_for_editor: selected,
      primary_selected: selected,
      reserve_candidate: selected ? false : isReserveCandidate(candidate)
    };
  });
  return reporter;
}

function reporterCandidateCapsules(date, candidates, capsuleReport, options = {}) {
  return capsuleInputForCandidates(date, candidates, capsuleReport, options);
}

function reporterImageCandidatesForSection(section, reporter) {
  const sourceUrls = new Set(ensureArray(section.sources).map(source => source && source.url).filter(Boolean));
  const matching = ensureArray(reporter.candidates)
    .filter(candidate => sourceUrls.has(candidate.url))
    .flatMap(candidate => ensureArray(candidate.imageCandidates));
  const fallback = ensureArray(reporter.candidates).flatMap(candidate => ensureArray(candidate.imageCandidates));
  const seen = new Set();
  const images = (matching.length > 0 ? matching : fallback)
    .filter(image => image && image.url && isSafeExternalImageUrl(image.url))
    .filter(image => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
  return images.slice(0, 6);
}

// capsule 압축과 editor LLM round-trip이 떨어뜨리거나 위조하는 image provenance(sourceKind, contentType)를
// reporter candidate의 검증된 값으로 URL 기준 복원한다.
function authoritativeImageProvenanceByUrl(reporter) {
  const byUrl = new Map();
  for (const candidate of ensureArray(reporter && reporter.candidates)) {
    for (const image of ensureArray(candidate.imageCandidates)) {
      if (image && image.url && !byUrl.has(image.url)) byUrl.set(image.url, image);
    }
  }
  return byUrl;
}

function restoreImageProvenance(image, provenanceByUrl) {
  const authoritative = provenanceByUrl.get(image.url);
  if (!authoritative) return image;
  return {
    ...image,
    sourceKind: authoritative.sourceKind || image.sourceKind,
    contentType: authoritative.contentType || image.contentType,
    licenseStatus: authoritative.licenseStatus || image.licenseStatus,
    validationStatus: authoritative.validationStatus || image.validationStatus,
    attribution: image.attribution || authoritative.attribution,
    width: image.width != null ? image.width : authoritative.width,
    height: image.height != null ? image.height : authoritative.height,
    alt: image.alt || authoritative.alt
  };
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function firstHttpsUrl(...values) {
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (isHttpsUrl(trimmed)) return trimmed;
  }
  return '';
}

function normalizeSectionImageFields(section, reporter) {
  const provenanceByUrl = authoritativeImageProvenanceByUrl(reporter);
  const sectionImages = ensureArray(section.imageCandidates)
    .filter(image => image && image.url && isSafeExternalImageUrl(image.url))
    .map(image => restoreImageProvenance(image, provenanceByUrl));
  const imageCandidates = sectionImages.length > 0 ? sectionImages : reporterImageCandidatesForSection(section, reporter);
  const allowed = new Set(imageCandidates.map(image => image.url));
  const requestedImage = allowed.has(section.selectedImage) ? section.selectedImage : '';
  const selected = imageCandidates.find(image => image.url === requestedImage);

  if (requestedImage) {
    const imageSource = firstHttpsUrl(
      section.imageSource,
      selected?.articleUrl,
      selected?.sourceUrl,
      ensureArray(section.sources)[0]?.url
    );
    const imageAttribution = String(section.imageAttribution || selected?.attribution || ensureArray(section.sources)[0]?.title || '').trim();
    const imageAlt = String(section.imageAlt || selected?.alt || section.headline || 'Article image').trim();
    const imageLicenseStatus = String(section.imageLicenseStatus || selected?.licenseStatus || 'unknown').trim();

    if (imageSource && imageAttribution && imageAlt && imageLicenseStatus) {
      return {
        imageCandidates,
        selectedImage: requestedImage,
        imageSource,
        imageAttribution,
        imageAlt,
        imageLicenseStatus,
        imageUsageDecisionReason: section.imageUsageDecisionReason || 'Editor-selected image with HTTPS source attribution.'
      };
    }
  }

  return {
    imageCandidates,
    selectedImage: '',
    imageSource: '',
    imageAttribution: '',
    imageAlt: '',
    imageLicenseStatus: 'none',
    imageUsageDecisionReason: section.imageUsageDecisionReason ||
      'No suitable image with complete HTTPS attribution metadata selected; local fallback visual will be used.'
  };
}

function reporterCandidateUrlMap(reporter) {
  const map = new Map();
  function add(key, candidate) {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, candidate);
      return;
    }
    if (map.get(key) !== candidate) {
      map.set(key, null);
    }
  }

  for (const candidate of ensureArray(reporter.candidates)) {
    for (const value of [candidate.url, candidate.article_url, candidate.articleUrl]) {
      for (const key of urlKeys(value)) add(key, candidate);
    }
  }
  return map;
}

function candidateForSourceUrl(sourceUrl, candidateMap) {
  for (const key of urlKeys(sourceUrl)) {
    const candidate = candidateMap.get(key);
    if (candidate) return candidate;
  }
  return null;
}

function sourceCandidateMetadataForSection(section, reporter) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const candidate = ensureArray(section.sources)
    .map(source => candidateForSourceUrl(source?.url, candidateMap))
    .find(Boolean);
  if (!candidate) return {};
  const candidateUrl = candidate.url || candidate.article_url || candidate.articleUrl || '';
  return {
    source_candidate_url: candidateUrl,
    source_candidate_hash: candidate.url_hash || normalizedUrlHash(candidateUrl),
    article_group_key: candidate.article_group_key || candidateGroupKey(candidate),
    tooling_workflow_type: candidate.tooling_workflow_type || '',
    relevance_bucket: candidate.relevance_bucket || '',
    editorial_priority: candidate.editorial_priority ?? null,
    aosp_camera_directness: candidate.aosp_camera_directness ?? null,
    driver_stack_relevance: candidate.driver_stack_relevance ?? null,
    soc_platform_relevance: candidate.soc_platform_relevance ?? null,
    native_tooling_relevance: candidate.native_tooling_relevance ?? null,
    counts_as_primary_camera_topic: candidate.counts_as_primary_camera_topic === true,
    counts_as_driver_topic: candidate.counts_as_driver_topic === true,
    counts_as_soc_topic: candidate.counts_as_soc_topic === true,
    counts_as_fallback_topic: candidate.counts_as_fallback_topic === true,
    finalSelectionEligibility: candidate.finalSelectionEligibility || candidate.final_selection_eligibility || '',
    source_gap_risk: candidate.source_gap_risk === true,
    main_article_readiness: candidate.main_article_readiness || null,
    do_not_claim: ensureArray(candidate.do_not_claim || candidate.compact_evidence?.do_not_claim),
    evidence_origin: candidate.evidence_origin || 'candidate_metadata',
    source_hint: candidate.source_hint || ''
  };
}

function normalizeEditorSection(section, index, reporter) {
  // editor가 사실(verified_facts)에 넣은 문장을 같은 문장의 claim에서는 비-fact(inference 등)로
  // 분류한 자가당착을 검증 전에 결정론적으로 정리한다(추론은 사실 목록에서 제거). 이렇게 해야
  // missing_matching_fact_claim으로 멀쩡한 기사가 통째로 demote되지 않는다.
  section = dropVerifiedFactsClassifiedAsNonFact(section);
  const actionItems = ensureArray(section.action_items);
  const actionHints = ensureArray(section.action_hints);
  const normalized = {
    ...section,
    category: section.category || fallbackCategories[index] || `Main Article ${index + 1}`,
    confirmed_facts: ensureArray(section.confirmed_facts).length > 0
      ? ensureArray(section.confirmed_facts)
      : [section.what_changed].filter(Boolean),
    evidence_summary: stringOrEmpty(section.evidence_summary),
    specificity_checks: ensureArray(section.specificity_checks),
    source_verification_notes: ensureArray(section.source_verification_notes),
    action_items: actionItems.length > 0 ? actionItems : actionHints,
    action_hints: actionHints.length > 0 ? actionHints : actionItems,
    is_ai_related: Boolean(section.is_ai_related),
    article_type: section.article_type || (section.is_ai_related ? 'ai' : 'camera-hal'),
    sources: ensureArray(section.sources).filter(source => source && source.url)
  };
  const deterministicMetadata = sourceCandidateMetadataForSection(normalized, reporter);
  const merged = mergePublicArticleFromLlm({
    ...normalized,
    ...deterministicMetadata,
    ...normalizeSectionImageFields(normalized, reporter)
  }, normalized, deterministicMetadata);
  // LLM 이 임의로 채운 decision/evidenceLevel/selection 은 deterministic 코드가 결정해야 하므로 제거.
  delete merged.decision;
  delete merged.evidenceLevel;
  delete merged.selection;
  return merged;
}

module.exports = {
  fallbackCategories,
  booleanFromCandidate,
  imageCandidatesForReporterCandidate,
  collectedCandidateFor,
  reporterCandidateRejectionReason,
  reporterCandidateMainArticleBlockReason,
  isReserveCandidate,
  isMainSupplementBucket,
  candidatePriority,
  validateReporter,
  enforceDeterministicReporterSelection,
  syncReporterSelectionToMain,
  selectedReporterCapsules,
  reserveReporterCapsules,
  reporterCandidateCapsules,
  reporterImageCandidatesForSection,
  authoritativeImageProvenanceByUrl,
  restoreImageProvenance,
  isHttpsUrl,
  firstHttpsUrl,
  normalizeSectionImageFields,
  reporterCandidateUrlMap,
  candidateForSourceUrl,
  sourceCandidateMetadataForSection,
  normalizeEditorSection
};
