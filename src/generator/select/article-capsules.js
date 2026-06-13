const { ensureArray } = require('../../shared/common/value-coercion');
const CAPSULE_TOKEN_TARGET = '700-1200';
const MAX_TEXT = 420;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_IMAGE_CANDIDATES = 3;
const {
  buildHalPerspective,
  buildOverclaimGuardrails,
  buildStaticBackgroundContext,
  cleanBehaviorChange
} = require('../reporter/article-field-builder');
const {
  normalizeHalSignalFields
} = require('../reporter/hal-signal-quality');
const {
  normalizeSourceQuality,
  sourceQualityFieldDrift,
  sourceQualityFlatFields
} = require('../../shared/collect/source-quality-classifier');
const {
  candidateGroupKey,
  compactContextCandidate
} = require('../../shared/common/article-groups');
const {
  buildArticleSourceFactBundle
} = require('../reporter/source-fact-bundle');
const {
  buildAllowedClaimEvidence
} = require('../quality/claim-source-binding');

function text(value) {
  return String(value || '').trim();
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compactText(value, max = MAX_TEXT) {
  const raw = text(value).replace(/\s+/g, ' ');
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1).trim()}...`;
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function normalizeUrlExact(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function candidateUrl(candidate) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl);
}

function candidateBody(candidate) {
  return [
    candidate.title,
    candidate.summary,
    candidate.section,
    candidate.source_section,
    candidate.category,
    candidate.api_or_component,
    candidate.behavior_change,
    candidate.relevance_reason,
    candidate.collection_reason
  ].map(text).join(' ');
}

function topicType(candidate) {
  const body = candidateBody(candidate);
  if (/Camera HAL|camera provider|camera3|HAL3|ICamera/i.test(body)) return 'camera-hal';
  if (/Android Camera|AOSP Camera|CameraX|Camera2|Camera ITS|CTS|VTS/i.test(body)) return 'android-camera';
  if (/\b(C\+\+|cpp|LLVM|Clang|NDK|native|toolchain)\b/i.test(body)) return 'cpp';
  if (/\b(AI|agent|LLM|Gemini|NPU|GPU|on-device|inference|model)\b/i.test(body)) return 'ai';
  return 'general';
}

function summaryCacheText(candidate) {
  const cache = candidate.summary_cache || {};
  return compactText(cache.summary || cache.text || '');
}

function evidenceItems(candidate) {
  const sourceExtractionBullet = ensureArray(candidate?.source_extraction?.release?.sections)
    .flatMap(section => ensureArray(section?.items))
    .map(item => text(item?.text || item?.source_text))
    .find(Boolean);
  const items = [
    candidate.version_or_release ? `version_or_release: ${candidate.version_or_release}` : '',
    candidate.api_or_component ? `api_or_component: ${candidate.api_or_component}` : '',
    candidate.behavior_change ? `behavior_change: ${candidate.behavior_change}` : '',
    sourceExtractionBullet ? `source_extraction.release_bullet: ${sourceExtractionBullet}` : '',
    ...ensureArray(candidate.compact_evidence?.primary_facts).map(item => `seed_primary_fact: ${item}`),
    ...ensureArray(candidate.compact_evidence?.linked_context).map(item => `seed_linked_context: ${item}`),
    ...ensureArray(candidate.evidence_notes).map(item => `evidence_note: ${item}`),
    summaryCacheText(candidate) ? `summary_cache: ${summaryCacheText(candidate)}` : '',
    candidate.summary ? `summary: ${candidate.summary}` : ''
  ].map(item => compactText(item, 160)).filter(Boolean);
  return [...new Set(items)].slice(0, MAX_EVIDENCE_ITEMS);
}

function compactExtractionItems(items) {
  return ensureArray(items).slice(0, 5).map(item => ({
    text: compactText(item?.text || item?.source_text, 180),
    source_text: compactText(item?.source_text || item?.text, 180),
    links: ensureArray(item?.links).slice(0, 3),
    issue_ids: ensureArray(item?.issue_ids).slice(0, 5),
    artifact_names: ensureArray(item?.artifact_names).slice(0, 5)
  }));
}

function compactExtractionSections(sections) {
  return ensureArray(sections).slice(0, 5).map(section => ({
    category: text(section?.category),
    heading: compactText(section?.heading, 80),
    items: compactExtractionItems(section?.items)
  })).filter(section => section.items.length > 0);
}

function compactSourceExtraction(extraction) {
  if (!extraction || typeof extraction !== 'object') return null;
  const minor = extraction.minor_line_context || null;
  return {
    adapter_id: text(extraction.adapter_id),
    source_type: text(extraction.source_type),
    source: extraction.source || null,
    release: {
      version: text(extraction.release?.version),
      date: text(extraction.release?.date),
      component: text(extraction.release?.component),
      sections: compactExtractionSections(extraction.release?.sections)
    },
    minor_line_context: minor ? {
      version: text(minor.version),
      date: text(minor.date),
      component: text(minor.component),
      sections: compactExtractionSections(minor.sections)
    } : null,
    extraction_quality: extraction.extraction_quality || null
  };
}

function compactDerivedHints(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    relevance_bucket_hint: text(value.relevance_bucket_hint),
    hal_boundary: text(value.hal_boundary),
    validation_targets: ensureArray(value.validation_targets).slice(0, 6).map(item => compactText(item, 120)),
    device_specific_notes: ensureArray(value.device_specific_notes).slice(0, 4).map(item => compactText(item, 120)),
    do_not_claim: ensureArray(value.do_not_claim).slice(0, 4).map(item => compactText(item, 120)),
    main_article_allowed_hint: value.main_article_allowed_hint === true,
    warnings: ensureArray(value.warnings).slice(0, 8)
  };
}

function score(candidate) {
  const breakdown = candidate.score_breakdown || {};
  return {
    total: number(candidate.deterministic_score ?? breakdown.total),
    camera_hal_directness: number(breakdown.camera_hal_directness ?? breakdown.camera_hal_relevance ?? candidate.camera_hal_relevance_score),
    evidence_specificity: number(breakdown.evidence_specificity ?? candidate.evidence_score),
    freshness: number(breakdown.freshness_score ?? breakdown.freshness ?? candidate.freshness_score),
    practical_actionability: number(breakdown.practical_actionability ?? candidate.practical_actionability_score),
    source_reliability: number(breakdown.source_reliability ?? candidate.source_reliability_score),
    optional_ai_cpp_bonus: number(breakdown.optional_ai_cpp_bonus)
  };
}

function risk(candidate) {
  const hasDatedEvidence = typeof candidate.hasDatedEvidence === 'boolean'
    ? candidate.hasDatedEvidence
    : bool(candidate.has_dated_evidence);
  return {
    source_gap: bool(candidate.source_gap_risk),
    watch_page: bool(candidate.isWatchPage, bool(candidate.is_watch_page)),
    no_dated_evidence: !text(candidate.published_date || candidate.publishedAt || candidate.published_at || candidate.effective_date) || !hasDatedEvidence,
    candidate_only: bool(candidate.candidateOnly, bool(candidate.candidate_only)),
    requires_cross_check: bool(candidate.requiresCrossCheck, bool(candidate.requires_cross_check)),
    final_selection_eligibility: text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility)
  };
}

function eligibility(candidate) {
  return {
    collectionMode: text(candidate.collectionMode || candidate.collection_mode),
    isArticleCandidate: bool(candidate.isArticleCandidate, bool(candidate.is_article_candidate)),
    isWatchPage: bool(candidate.isWatchPage, bool(candidate.is_watch_page)),
    hasDatedEvidence: bool(candidate.hasDatedEvidence, bool(candidate.has_dated_evidence)),
    evidenceLevel: text(candidate.evidenceLevel || candidate.evidence_level),
    evidenceSignalKind: text(candidate.evidenceSignalKind || candidate.evidence_signal_kind),
    finalSelectionEligibility: text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility),
    source_kind: text(candidate.source_kind),
    source_gap_risk: bool(candidate.source_gap_risk),
    main_eligible: candidate.main_eligible !== false,
    briefing_only: bool(candidate.briefing_only),
    reference_only: bool(candidate.reference_only),
    evidence_score: number(candidate.evidence_score),
    cross_check_status: text(candidate.cross_check_status || 'not_required')
  };
}

function linkedEvidenceDoNotClaim(candidate) {
  const messages = [];
  const byStatus = candidate.linked_evidence_summary?.by_fetch_status ||
    candidate.source_aware_linked_evidence_summary?.by_fetch_status ||
    {};
  if (Number(byStatus.blocked || 0) > 0) {
    messages.push('Do not use blocked linked evidence as factual support.');
  }
  if (Number(byStatus.failed || 0) > 0) {
    messages.push('Do not use failed linked evidence as factual support.');
  }
  return messages;
}

function sourceQualityDoNotClaim(sourceQuality) {
  const blockers = ensureArray(sourceQuality.main_article_source_blockers);
  const messages = [];
  if (sourceQuality.main_article_source_allowed !== true) {
    messages.push('Do not promote this candidate to a main article while source quality blockers remain.');
  }
  if (blockers.includes('generic_trend_without_hal_workflow_link')) {
    messages.push('Do not claim direct HAL, Android Camera, driver, SoC, or native workflow impact unless supplied source evidence explicitly connects it.');
  }
  if (blockers.includes('cross_check_required_but_missing')) {
    messages.push('Do not use this source as the main article source until primary confirmation is supplied.');
  }
  if (blockers.includes('unknown_source_quality')) {
    messages.push('Do not infer or repair unknown source quality inside Stage 3 generation.');
  }
  return messages;
}

function readinessBlockers(candidate, sourceQuality, halSignal, drift) {
  const blockers = [];
  if (!candidateUrl(candidate)) blockers.push('missing_url');
  if (sourceQuality.source_url_quality === 'unknown') blockers.push('unknown_source_quality');
  if (sourceQuality.source_quality_status === 'blocked') blockers.push('source_quality_status_blocked');
  if (sourceQuality.main_article_source_allowed !== true) blockers.push('main_article_source_allowed_false');
  for (const blocker of ensureArray(sourceQuality.main_article_source_blockers)) blockers.push(blocker);
  for (const blocker of ensureArray(halSignal.hal_signal_hard_blockers)) blockers.push(`hal_signal:${blocker}`);
  if (drift.length > 0) blockers.push('SOURCE_QUALITY_FIELD_DRIFT');
  if (!['main', 'short'].includes(text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility))) {
    blockers.push('selection_not_main_or_short');
  }
  if (candidate.main_eligible === false) blockers.push('main_eligible_false');
  if (candidate.source_gap_risk === true) blockers.push('source_gap_risk');
  if (candidate.reference_only === true) blockers.push('reference_only');
  return [...new Set(blockers)];
}

function mainArticleReadiness(candidate, sourceQuality, halSignal, drift) {
  const sourceReady = sourceQuality.main_article_source_allowed === true &&
    sourceQuality.source_url_quality !== 'unknown' &&
    sourceQuality.source_quality_status !== 'blocked' &&
    drift.length === 0;
  const halSignalReady = ensureArray(halSignal.hal_signal_hard_blockers).length === 0;
  const selectionReady = ['main', 'short'].includes(text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility)) &&
    candidate.main_eligible !== false &&
    candidate.source_gap_risk !== true &&
    candidate.reference_only !== true;
  const blockers = readinessBlockers(candidate, sourceQuality, halSignal, drift);
  return {
    ready: sourceReady && halSignalReady && selectionReady && blockers.length === 0,
    source_ready: sourceReady,
    hal_signal_ready: halSignalReady,
    selection_input_ready: selectionReady,
    selection_ready: selectionReady,
    blockers
  };
}

function capsuleSourceQualityFlatFields(sourceQuality) {
  const flat = sourceQualityFlatFields(sourceQuality);
  return {
    source_role: flat.source_role,
    source_url_quality: flat.source_url_quality,
    source_quality_status: flat.source_quality_status,
    main_article_source_allowed: flat.main_article_source_allowed,
    main_article_source_blockers: flat.main_article_source_blockers,
    cross_check_status: flat.cross_check_status,
    requires_cross_check: flat.requires_cross_check,
    requires_conditional_evidence: flat.requires_conditional_evidence,
    conditional_evidence_type: flat.conditional_evidence_type,
    evidence_granularity: flat.evidence_granularity
  };
}

function compactSourceQuality(sourceQuality = {}) {
  const normalized = normalizeSourceQuality({ source_quality: sourceQuality });
  const compact = {
    source_role: normalized.source_role,
    source_url_quality: normalized.source_url_quality,
    source_quality_status: normalized.source_quality_status,
    main_article_source_allowed: normalized.main_article_source_allowed
  };
  if (ensureArray(normalized.main_article_source_blockers).length > 0) {
    compact.main_article_source_blockers = normalized.main_article_source_blockers;
  }
  if (normalized.requires_cross_check === true) compact.requires_cross_check = true;
  if (normalized.requires_conditional_evidence === true) compact.requires_conditional_evidence = true;
  if (text(normalized.conditional_evidence_type)) compact.conditional_evidence_type = normalized.conditional_evidence_type;
  return Object.fromEntries(Object.entries(compact).filter(([, value]) => value !== ''));
}

function compactImageCandidates(candidate) {
  return ensureArray(candidate.imageCandidates || candidate.image_candidates)
    .filter(image => image && image.url)
    .slice(0, MAX_IMAGE_CANDIDATES)
    .map(image => ({
      url: text(image.url),
      sourceUrl: text(image.sourceUrl),
      articleUrl: text(image.articleUrl),
      sourceKind: text(image.sourceKind),
      contentType: text(image.contentType),
      licenseStatus: text(image.licenseStatus),
      attribution: compactText(image.attribution, 120),
      validationStatus: text(image.validationStatus)
    }));
}

function compactRelatedContextCandidates(candidate) {
  return ensureArray(candidate.related_context_candidates)
    .slice(0, 8)
    .map(item => compactContextCandidate({
      ...item,
      article_group_key: item.article_group_key || candidate.article_group_key
    }));
}

function estimatedTokens(value) {
  return Math.ceil(JSON.stringify(value).length / 4);
}

function isFinalSelected(candidate) {
  if (typeof candidate.final_selected === 'boolean') return candidate.final_selected;
  if (typeof candidate.selected_for_editor === 'boolean') return candidate.selected_for_editor;
  return bool(candidate.selected);
}

function buildArticleCapsule(candidate, contextCandidates = [], options = {}) {
  const cleanedBehavior = cleanBehaviorChange(candidate);
  const fieldCandidate = { ...candidate };
  const halSignal = normalizeHalSignalFields(fieldCandidate);
  const sourceQuality = normalizeSourceQuality(fieldCandidate);
  const sourceQualityDrift = sourceQualityFieldDrift(fieldCandidate);
  const sourceQualityFlat = capsuleSourceQualityFlatFields(sourceQuality);
  const readiness = mainArticleReadiness(fieldCandidate, sourceQuality, halSignal, sourceQualityDrift);
  const doNotClaim = [
    ...ensureArray(halSignal.do_not_overstate),
    ...ensureArray(fieldCandidate.derived_editorial_hints?.do_not_claim),
    ...ensureArray(fieldCandidate.do_not_claim),
    ...ensureArray(fieldCandidate.compact_evidence?.do_not_claim),
    ...sourceQualityDoNotClaim(sourceQuality),
    ...linkedEvidenceDoNotClaim(fieldCandidate)
  ].map(item => compactText(item, 140));
  const capsule = {
    candidate_id: text(candidate.candidate_id || candidate.source_candidate_hash || candidate.url_hash),
    title: compactText(candidate.title, 180),
    url: candidateUrl(candidate),
    source: compactText(candidate.source || candidate.source_name, 120),
    published_date: text(candidate.published_date || candidate.publishedAt || candidate.published_at),
    effective_date: text(candidate.effective_date || candidate.effectiveDate),
    date_source: text(candidate.date_source),
    date_confidence: number(candidate.date_confidence),
    source_event_id: text(candidate.source_event_id),
    evidence_id: text(candidate.evidence_id),
    event_type: text(candidate.event_type),
    needs_editor_date_review: bool(candidate.needs_editor_date_review),
    topic_type: topicType(candidate),
    editorial_priority: number(candidate.editorial_priority, 6),
    relevance_bucket: text(candidate.relevance_bucket),
    article_group_key: text(candidate.article_group_key || candidate.articleGroupKey),
    tooling_workflow_type: text(candidate.tooling_workflow_type || candidate.toolingWorkflowType),
    native_workflow_evidence_score: number(candidate.native_workflow_evidence_score),
    related_context_candidates: compactRelatedContextCandidates(candidate),
    blocked_context_candidates: compactRelatedContextCandidates(candidate)
      .filter(item => item.context_usage_allowed !== true),
    parent_context: text(candidate.parentUrl || candidate.parent_url) ? {
      title: compactText(candidate.parentTitle || candidate.parent_title || 'Parent roundup', 120),
      url: text(candidate.parentUrl || candidate.parent_url),
      canonical_url: text(candidate.parentCanonicalUrl || candidate.parent_canonical_url || candidate.parentUrl || candidate.parent_url),
      roundup_item_index: candidate.roundupItemIndex ?? candidate.roundup_item_index ?? null,
      anchor_text: compactText(candidate.anchorText || candidate.anchor_text, 160)
    } : null,
    scope_relevance: {
      aosp_camera_directness: number(candidate.aosp_camera_directness),
      driver_stack_relevance: number(candidate.driver_stack_relevance),
      soc_platform_relevance: number(candidate.soc_platform_relevance),
      native_tooling_relevance: number(candidate.native_tooling_relevance),
      counts_as_primary_camera_topic: bool(candidate.counts_as_primary_camera_topic),
      counts_as_driver_topic: bool(candidate.counts_as_driver_topic),
      counts_as_soc_topic: bool(candidate.counts_as_soc_topic),
      counts_as_fallback_topic: bool(candidate.counts_as_fallback_topic),
      evidence_origin: text(candidate.evidence_origin)
    },
    hal_impact_axes: halSignal.hal_impact_axes,
    reader_owners: halSignal.reader_owners,
    actionability_level: halSignal.actionability_level,
    effective_actionability_level: halSignal.effective_actionability_level,
    signal_quality_status: halSignal.signal_quality_status,
    fallback_promotion_allowed: halSignal.fallback_promotion_allowed,
    soc_signal_source_allowed: halSignal.soc_signal_source_allowed,
    ...(candidate.decision ? { decision: candidate.decision } : {}),
    source_quality: compactSourceQuality(sourceQuality),
    source_quality_reason: compactText(sourceQuality.main_article_source_allowed_reason, 180),
    ...sourceQualityFlat,
    source_quality_field_drift: sourceQualityDrift,
    main_article_readiness: readiness,
    component: compactText(candidate.api_or_component || candidate.version_or_release, 160),
    source_fact_bundle: buildArticleSourceFactBundle(candidate, contextCandidates),
    what_changed: compactText(cleanedBehavior.text || candidate.behavior_change || candidate.summary || summaryCacheText(candidate), MAX_TEXT),
    background_context_static: compactText(buildStaticBackgroundContext(fieldCandidate), MAX_TEXT),
    camera_hal_perspective_static: compactText(buildHalPerspective(fieldCandidate), MAX_TEXT),
    overclaim_guardrails: buildOverclaimGuardrails(fieldCandidate).slice(0, 2).map(item => compactText(item, 100)),
    why_hal_engineer_cares: compactText(
      candidate.relevance_reason ||
      candidate.collection_reason ||
      candidate.reason ||
      buildHalPerspective(fieldCandidate) ||
      candidate.summary,
      MAX_TEXT
    ),
    evidence: evidenceItems(candidate),
    allowed_claim_evidence: buildAllowedClaimEvidence(candidate, {}, {
      seedEvidencePack: options.seedEvidencePack || null
    }),
    seed_evidence: candidate.compact_evidence ? {
      evidence_pack_ids: ensureArray(candidate.evidence_pack_ids).slice(0, 6),
      primary_evidence_ids: ensureArray(candidate.primary_evidence_ids).slice(0, 8),
      linked_evidence_ids: ensureArray(candidate.linked_evidence_ids).slice(0, 8),
      source_extraction_ref: text(candidate.source_extraction_ref),
      compact_evidence: {
        primary_facts: ensureArray(candidate.compact_evidence.primary_facts).slice(0, 4).map(item => compactText(item, 180)),
        linked_context: ensureArray(candidate.compact_evidence.linked_context).slice(0, 3).map(item => compactText(item, 160)),
        do_not_claim: ensureArray(candidate.compact_evidence.do_not_claim).slice(0, 6).map(item => compactText(item, 140)),
        evidence_urls: ensureArray(candidate.compact_evidence.evidence_urls).slice(0, 6).map(text)
      }
    } : null,
    source_extraction: compactSourceExtraction(candidate.source_extraction),
    derived_editorial_hints: compactDerivedHints(candidate.derived_editorial_hints),
    extraction_quality: candidate.extraction_quality || candidate.source_extraction?.extraction_quality || null,
    risk: risk(candidate),
    eligibility: eligibility(candidate),
    score: score(candidate),
    selection: {
      final_selected: isFinalSelected(candidate),
      primary_selected: bool(candidate.primary_selected, isFinalSelected(candidate)),
      reserve_candidate: bool(candidate.reserve_candidate),
      selected_for_editor: bool(candidate.selected_for_editor, isFinalSelected(candidate)),
      selection_slot: text(candidate.selection_slot),
      main_article_score_eligible: candidate.main_article_score_eligible !== false,
      score_filter_reasons: ensureArray(candidate.score_filter_reasons).slice(0, 5),
      exclusion_reasons: ensureArray(candidate.exclusion_reasons).slice(0, 5)
    },
    url_hash: text(candidate.url_hash),
    imageCandidates: compactImageCandidates(candidate)
  };
  if (ensureArray(cleanedBehavior.removed_fragments).length > 0 || ensureArray(cleanedBehavior.warnings).length > 0) {
    capsule.behavior_cleaning = {
      removed_fragments: ensureArray(cleanedBehavior.removed_fragments).slice(0, 5),
      warnings: ensureArray(cleanedBehavior.warnings)
    };
  }
  if (ensureArray(halSignal.do_not_overstate).length > 0) {
    capsule._overclaim_guardrail_hints = ensureArray(halSignal.do_not_overstate).slice(0, 5);
  }
  if (doNotClaim.length > 0) {
    capsule.do_not_claim = [...new Set(doNotClaim)].slice(0, 8);
  }
  if (halSignal.fallback_promotion_reason) {
    capsule.fallback_promotion_reason = compactText(halSignal.fallback_promotion_reason, 180);
  }
  if (halSignal.actionability_upgrade_reason) {
    capsule.actionability_upgrade_reason = compactText(halSignal.actionability_upgrade_reason, 180);
  }
  if (halSignal.actionability_upgrade_evidence) {
    capsule.actionability_upgrade_evidence = {
      source_url: text(halSignal.actionability_upgrade_evidence.source_url),
      evidence_id: text(halSignal.actionability_upgrade_evidence.evidence_id),
      matched_signal: text(halSignal.actionability_upgrade_evidence.matched_signal),
      verification_target: text(halSignal.actionability_upgrade_evidence.verification_target),
      upgrade_from: text(halSignal.actionability_upgrade_evidence.upgrade_from),
      upgrade_to: text(halSignal.actionability_upgrade_evidence.upgrade_to)
    };
  }
  if (ensureArray(halSignal.fallback_guard_notes).length > 0) {
    capsule.fallback_guard_notes = ensureArray(halSignal.fallback_guard_notes).slice(0, 5);
  }
  if (halSignal.soc_signal_type) {
    capsule.soc_signal_type = halSignal.soc_signal_type;
  }
  if (halSignal.camera_pipeline_link) {
    capsule.camera_pipeline_link = compactText(halSignal.camera_pipeline_link, 180);
  }
  if (!capsule.tooling_workflow_type) delete capsule.tooling_workflow_type;
  if (!capsule.article_group_key) delete capsule.article_group_key;
  if (!capsule.native_workflow_evidence_score) delete capsule.native_workflow_evidence_score;
  if (!capsule.effective_date) delete capsule.effective_date;
  if (!capsule.date_source) {
    delete capsule.date_source;
    delete capsule.date_confidence;
  }
  if (!capsule.source_event_id) delete capsule.source_event_id;
  if (!capsule.evidence_id) delete capsule.evidence_id;
  if (!capsule.event_type) delete capsule.event_type;
  if (!capsule.source_event_id && !capsule.effective_date && !capsule.needs_editor_date_review) {
    delete capsule.needs_editor_date_review;
  }
  if (ensureArray(capsule.blocked_context_candidates).length === 0) delete capsule.blocked_context_candidates;
  if (!capsule.parent_context) delete capsule.parent_context;
  return {
    ...capsule,
    estimated_tokens: estimatedTokens(capsule)
  };
}

function capsuleMap(capsules) {
  const exact = new Map();
  const normalized = new Map();
  for (const capsule of ensureArray(capsules)) {
    const exactKey = normalizeUrlExact(capsule.url);
    const normalizedKey = normalizeUrl(capsule.url);
    if (exactKey && !exact.has(exactKey)) exact.set(exactKey, capsule);
    if (normalizedKey && !normalized.has(normalizedKey)) normalized.set(normalizedKey, capsule);
  }
  return { exact, normalized };
}

function capsulesForCandidates(candidates, capsules = [], options = {}) {
  const byUrl = capsuleMap(capsules);
  return ensureArray(candidates).map(candidate => {
    const exactKey = normalizeUrlExact(candidateUrl(candidate));
    const key = normalizeUrl(candidateUrl(candidate));
    return byUrl.exact.get(exactKey) || byUrl.normalized.get(key) || buildArticleCapsule(candidate, [], options);
  });
}

function buildArticleCapsuleReport(date, shortlistReport, reporterInput = null, options = {}) {
  const shortlistedCandidates = ensureArray(reporterInput?.candidates).length > 0
    ? ensureArray(reporterInput.candidates)
    : ensureArray(shortlistReport?.shortlisted_candidates);
  const shortlistedCapsules = shortlistedCandidates.map(candidate => buildArticleCapsule(candidate, shortlistedCandidates, options));
  const selectedCapsules = capsulesForCandidates(
    ensureArray(shortlistReport?.selected_articles),
    shortlistedCapsules,
    options
  );
  const reserveCapsules = capsulesForCandidates(
    ensureArray(shortlistReport?.reserve_candidates),
    shortlistedCapsules,
    options
  );
  return {
    schema_version: 3,
    date,
    generated_at: new Date().toISOString(),
    capsule_token_target: CAPSULE_TOKEN_TARGET,
    shortlisted_capsule_count: shortlistedCapsules.length,
    selected_capsule_count: selectedCapsules.length,
    reserve_capsule_count: reserveCapsules.length,
    shortlisted_capsules: shortlistedCapsules,
    selected_capsules: selectedCapsules,
    reserve_capsules: reserveCapsules
  };
}

function capsuleInputFromReport(report, type = 'shortlisted') {
  const candidates = type === 'selected'
    ? ensureArray(report?.selected_capsules)
    : type === 'reserve'
      ? ensureArray(report?.reserve_capsules)
      : ensureArray(report?.shortlisted_capsules);
  return {
    date: report?.date || '',
    capsule_token_target: report?.capsule_token_target || CAPSULE_TOKEN_TARGET,
    candidates
  };
}

function capsuleInputForCandidates(date, candidates, report = null) {
  const capsules = [
    ...ensureArray(report?.shortlisted_capsules),
    ...ensureArray(report?.selected_capsules),
    ...ensureArray(report?.reserve_capsules)
  ];
  return {
    date,
    capsule_token_target: report?.capsule_token_target || CAPSULE_TOKEN_TARGET,
    candidates: capsulesForCandidates(candidates, capsules)
  };
}

function compactSelectionContext(shortlistReport) {
  return {
    date: shortlistReport?.date || '',
    input_candidate_count: shortlistReport?.input_candidate_count ?? null,
    eligible_candidate_count: shortlistReport?.eligible_candidate_count ?? null,
    selected_article_count: shortlistReport?.selected_article_count ?? null,
    deterministic_selected_count: shortlistReport?.deterministic_selected_count ?? shortlistReport?.selected_article_count ?? null,
    primary_selected_article_count: shortlistReport?.primary_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    reserve_candidate_count: shortlistReport?.reserve_candidate_count ?? null,
    composition_mode: shortlistReport?.composition_mode || '',
    composition_reason: shortlistReport?.composition_reason || '',
    composition_summary: shortlistReport?.composition_summary || {},
    eligible_composition_summary: shortlistReport?.eligible_composition_summary || {},
    editor_review_required: shortlistReport?.editor_review_required === true,
    shortlist_cap: shortlistReport?.shortlist_cap ?? null,
    underfilled: Boolean(shortlistReport?.underfilled),
    publish_ready: shortlistReport?.publish_ready !== undefined ? Boolean(shortlistReport.publish_ready) : null,
    selection_policy: shortlistReport?.selection_policy || {},
    selection_warnings: ensureArray(shortlistReport?.selection_warnings),
    selection_errors: ensureArray(shortlistReport?.selection_errors),
    selection_shortage_hints: ensureArray(shortlistReport?.selection_shortage_hints),
    selected_articles: ensureArray(shortlistReport?.selected_articles).map(candidate => ({
      title: compactText(candidate.title, 180),
      url: candidateUrl(candidate),
      article_group_key: candidateGroupKey(candidate),
      deterministic_score: number(candidate.deterministic_score),
      selection_slot: text(candidate.selection_slot),
      editorial_priority: number(candidate.editorial_priority, 6),
      relevance_bucket: text(candidate.relevance_bucket)
    })),
    primary_selected_articles: ensureArray(shortlistReport?.primary_selected_articles).map(candidate => ({
      title: compactText(candidate.title, 180),
      url: candidateUrl(candidate),
      article_group_key: candidateGroupKey(candidate),
      deterministic_score: number(candidate.deterministic_score),
      selection_slot: text(candidate.selection_slot),
      editorial_priority: number(candidate.editorial_priority, 6),
      relevance_bucket: text(candidate.relevance_bucket)
    })),
    reserve_candidates: ensureArray(shortlistReport?.reserve_candidates).map(candidate => ({
      title: compactText(candidate.title, 180),
      url: candidateUrl(candidate),
      deterministic_score: number(candidate.deterministic_score),
      selection_slot: text(candidate.selection_slot),
      editorial_priority: number(candidate.editorial_priority, 6),
      relevance_bucket: text(candidate.relevance_bucket)
    })),
    selected_relevance_bucket_summary: ensureArray(shortlistReport?.selected_relevance_bucket_summary),
    reserve_relevance_bucket_summary: ensureArray(shortlistReport?.reserve_relevance_bucket_summary),
    exclusion_reason_summary: ensureArray(shortlistReport?.exclusion_reason_summary).slice(0, 10)
  };
}

module.exports = {
  CAPSULE_TOKEN_TARGET,
  buildArticleCapsule,
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext,
  estimatedTokens
};
