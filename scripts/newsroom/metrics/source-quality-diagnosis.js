const fs = require('fs');
const path = require('path');

const {
  kstDate,
  readJson,
  repoPath,
  writeJson
} = require('../common/common');
const {
  collectedCandidatesRelPath,
  manualCandidatesRelPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesRelPath,
  newsroomDir,
  newsroomRelPath
} = require('../common/artifact-paths');
const {
  normalizeUrl
} = require('../generate/newsroom-selection');

const SCHEMA_VERSION = 1;
const REPORT_TYPE = 'source_quality_diagnosis';

const DIAGNOSIS_KEYS = [
  'actual_news_shortage',
  'parser_extraction_failure',
  'source_gap_risk',
  'taxonomy_missing',
  'fallback_only_composition',
  'duplicate_or_noop_source_discovery'
];

const DIAGNOSIS_LABELS_KO = Object.freeze({
  actual_news_shortage: '실제 뉴스 부족',
  parser_extraction_failure: '파서 추출 실패',
  source_gap_risk: '소스 풀 부족 위험',
  taxonomy_missing: '분류 체계 누락',
  fallback_only_composition: 'Fallback 기사만 남음',
  duplicate_or_noop_source_discovery: 'Source discovery 중복 또는 무효'
});

const RECOMMENDED_ACTION_LABELS_KO = Object.freeze({
  KEEP_AND_FIX_PARSER: '소스 유지, 파서 수정',
  DOWNGRADE_GENERIC_SOURCE: '일반 소스로 강등',
  ADD_MULTIMEDIA_BUCKET: 'Multimedia bucket 추가',
  REVIEW_SOURCE_GAP: '소스 풀 보강 검토',
  REPAIR_SOURCE_DISCOVERY_DUPLICATES: 'Source discovery 중복 제거/수리',
  NO_ACTION_THIN_WEEK: '기사 부족 주간으로 판단, 조치 없음',
  KEEP_AND_MONITOR: '유지하고 추적'
});

const ACTION_PRIORITY = Object.freeze({
  KEEP_AND_FIX_PARSER: 1,
  ADD_MULTIMEDIA_BUCKET: 2,
  REVIEW_SOURCE_GAP: 3,
  REPAIR_SOURCE_DISCOVERY_DUPLICATES: 4,
  DOWNGRADE_GENERIC_SOURCE: 5,
  NO_ACTION_THIN_WEEK: 6,
  KEEP_AND_MONITOR: 7
});

const KNOWN_CAMERA_BUCKETS = new Set([
  'direct_aosp_camera',
  'camera_driver_image_pipeline',
  'android_platform_camera_adjacent',
  'android_multimedia_camera_output',
  'soc_platform_signal',
  'cpp_ai_tooling_fallback',
  'generic_tech_watchlist'
]);

const PARSER_REPAIR_RECOMMENDATIONS = new Set([
  'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR',
  'KEEP_AND_FIX_PARSER'
]);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function firstText(...values) {
  for (const value of values) {
    const parsed = text(value);
    if (parsed) return parsed;
  }
  return '';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = numberOrNull(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function candidateItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.candidates)) return payload.candidates;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function readJsonIfExists(root, relPath, warnings, options = {}) {
  const filePath = path.join(root, ...String(relPath || '').split('/'));
  if (!fs.existsSync(filePath)) {
    if (options.optional !== false) {
      warnings.push({
        type: 'missing_optional_artifact',
        message: `${relPath} not found; partial diagnosis will continue.`,
        source_artifact: relPath
      });
    }
    return null;
  }
  try {
    return readJson(filePath);
  } catch (error) {
    warnings.push({
      type: 'invalid_optional_artifact',
      message: `${relPath} is not valid JSON: ${error.message}`,
      source_artifact: relPath
    });
    return null;
  }
}

function toRepoRelPath(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function candidateUrl(candidate = {}) {
  return firstText(
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.source_candidate_url,
    candidate.normalized_url
  );
}

function sourceObject(candidate = {}) {
  return objectValue(candidate.source);
}

function sourceIdForCandidate(candidate = {}) {
  const nested = sourceObject(candidate);
  return firstText(
    candidate.source_id,
    candidate.sourceId,
    nested.id,
    candidate.source_name,
    typeof candidate.source === 'string' ? candidate.source : '',
    candidate.sourceUrl,
    candidate.source_url,
    'unknown-source'
  );
}

function sourceNameForCandidate(candidate = {}) {
  const nested = sourceObject(candidate);
  return firstText(
    candidate.source_name,
    nested.name,
    typeof candidate.source === 'string' ? candidate.source : '',
    candidate.source_id,
    candidate.sourceId,
    'Unknown source'
  );
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

function candidateBlockers(candidate = {}) {
  const blockers = [];
  const eligibility = finalSelectionEligibility(candidate);
  if (!candidateUrl(candidate)) blockers.push('missing_url');
  if (!hasDatedEvidence(candidate)) blockers.push('hasDatedEvidence=false');
  if (candidate.source_gap_risk === true) blockers.push('source_gap_risk=true');
  if (candidate.reference_only === true) blockers.push('reference_only=true');
  if (candidate.main_eligible === false) blockers.push('main_eligible=false');
  if (candidate.briefing_only === true) blockers.push('briefing_only=true');
  if (eligibility && !['main', 'short'].includes(eligibility)) {
    blockers.push(`finalSelectionEligibility=${eligibility}`);
  }
  for (const value of [
    candidate.selection_exclusion_reason,
    candidate.watchlist_reason,
    candidate.verification_hint
  ]) {
    const parsed = text(value);
    if (parsed && !/^eligible for/i.test(parsed)) blockers.push(parsed);
  }
  return [...new Set(blockers)];
}

function normalizeWarning(value = {}) {
  if (typeof value === 'string') {
    return {
      type: 'warning',
      message: value,
      source_artifact: ''
    };
  }
  return {
    type: value.type || 'warning',
    message: value.message || value.reason || 'unknown warning',
    source_artifact: value.source_artifact || value.sourceArtifact || '',
    severity: value.severity || undefined
  };
}

function sourceActionForEffectiveness(source = {}) {
  const recommendation = text(source.recommendation);
  if (PARSER_REPAIR_RECOMMENDATIONS.has(recommendation)) return 'KEEP_AND_FIX_PARSER';
  if (recommendation === 'DOWNGRADE_TO_CANDIDATE_ONLY' || recommendation === 'DISABLE_OR_REVIEW') {
    return 'DOWNGRADE_GENERIC_SOURCE';
  }
  if (recommendation === 'REVIEW_SOURCE_OR_PARSER') return 'REVIEW_SOURCE_GAP';
  if (recommendation === 'NO_RECENT_SIGNAL') return 'NO_ACTION_THIN_WEEK';
  return 'KEEP_AND_MONITOR';
}

function parserSignalsFromSource(source = {}) {
  const values = [
    ...ensureArray(source.reasons),
    ...ensureArray(source.top_exclusion_reasons).map(item => item.reason)
  ].map(text).filter(Boolean);
  return values.filter(value => /parser|parse|extraction|source_extraction|date|dated|version|anchor|release row|missing URL evidence|missing dated evidence/i.test(value));
}

function buildSourceBreakdownFromEffectiveness(report = {}) {
  return ensureArray(report.sources).map(source => {
    const topBlockers = ensureArray(source.top_exclusion_reasons)
      .map(item => text(item.reason))
      .filter(Boolean)
      .slice(0, 5);
    return {
      source_id: text(source.source_id) || 'unknown-source',
      source_name: text(source.source_name) || text(source.source_id) || 'Unknown source',
      raw_count: Number(source.collected_count || 0),
      eligible_count: Number(source.eligible_count || 0),
      blocked_count: Math.max(0, Number(source.collected_count || 0) - Number(source.eligible_count || 0)),
      main_eligible_count: Number(source.main_eligible_source_quality_coverage?.main_eligible_candidate_count ?? source.eligible_count ?? 0),
      top_blockers: topBlockers,
      parser_failure_signals: parserSignalsFromSource(source),
      duplicate_url_count: Number(source.duplicate_count || 0),
      source_discovery_new_publishable_count: null,
      recommended_action: sourceActionForEffectiveness(source),
      recommended_action_label: RECOMMENDED_ACTION_LABELS_KO[sourceActionForEffectiveness(source)],
      source_effectiveness_recommendation: text(source.recommendation)
    };
  });
}

function buildSourceBreakdownFromCandidates(candidates = []) {
  const states = new Map();
  for (const candidate of candidates) {
    const id = sourceIdForCandidate(candidate);
    if (!states.has(id)) {
      states.set(id, {
        source_id: id,
        source_name: sourceNameForCandidate(candidate),
        raw_count: 0,
        eligible_count: 0,
        blocked_count: 0,
        main_eligible_count: 0,
        top_blockers: new Map(),
        parser_failure_signals: new Set(),
        urls: new Map(),
        duplicate_url_count: 0,
        source_discovery_new_publishable_count: null,
        recommended_action: 'KEEP_AND_MONITOR',
        recommended_action_label: RECOMMENDED_ACTION_LABELS_KO.KEEP_AND_MONITOR
      });
    }
    const state = states.get(id);
    state.raw_count += 1;
    if (isEligibleCandidate(candidate)) state.eligible_count += 1;
    if (candidate.main_eligible === true) state.main_eligible_count += 1;
    const blockers = candidateBlockers(candidate);
    if (blockers.length > 0) state.blocked_count += 1;
    for (const blocker of blockers) {
      state.top_blockers.set(blocker, (state.top_blockers.get(blocker) || 0) + 1);
      if (/parser|parse|extraction|source_extraction|date|dated|version|anchor|release row/i.test(blocker)) {
        state.parser_failure_signals.add(blocker);
      }
    }
    const url = normalizeUrl(candidateUrl(candidate));
    if (url) state.urls.set(url, (state.urls.get(url) || 0) + 1);
  }
  return [...states.values()].map(state => {
    const duplicateCount = [...state.urls.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    if (state.parser_failure_signals.size > 0) {
      state.recommended_action = 'KEEP_AND_FIX_PARSER';
    } else if (state.blocked_count >= 2 && state.eligible_count === 0) {
      state.recommended_action = 'REVIEW_SOURCE_GAP';
    }
    state.duplicate_url_count = duplicateCount;
    state.recommended_action_label = RECOMMENDED_ACTION_LABELS_KO[state.recommended_action];
    state.top_blockers = [...state.top_blockers.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([reason]) => reason);
    state.parser_failure_signals = [...state.parser_failure_signals].slice(0, 5);
    delete state.urls;
    return state;
  }).sort((a, b) => a.source_id.localeCompare(b.source_id));
}

function addReason(reasons, key, reason, sourceArtifact, severity = 'medium', extra = {}) {
  if (!DIAGNOSIS_KEYS.includes(key)) return;
  reasons[key].push({
    reason,
    source_artifact: sourceArtifact,
    severity,
    ...extra
  });
}

function countReasons(reasons, key) {
  return ensureArray(reasons[key]).length;
}

function boolFromReasons(reasons, key) {
  return countReasons(reasons, key) > 0;
}

function requiredCandidateShortage(summary = {}) {
  const actual = firstNumber(
    summary.publishable_candidate_count,
    summary.selected_article_count,
    summary.final_selected_article_count
  );
  const required = firstNumber(
    summary.required_publishable_candidate_count,
    summary.required_selected_article_count,
    summary.min_final_articles,
    summary.required_final_article_count
  );
  return actual !== null && required !== null && actual < required;
}

function candidateShortage(summary = {}, status = {}, selectionReport = {}) {
  return status.underfilled === true ||
    status.failure_kind === 'candidate_shortage_reviewable' ||
    selectionReport.candidate_shortage_reviewable === true ||
    requiredCandidateShortage(summary);
}

function highPrioritySourceRawCountLow(sourceEffectiveness = {}) {
  const sources = ensureArray(sourceEffectiveness.sources);
  if (sources.length === 0) return true;
  const count = sources
    .filter(source => ['official', 'project-official', 'official-community'].includes(lower(source.reliability)) || lower(source.priority) === 'high')
    .reduce((sum, source) => sum + Number(source.collected_count || 0), 0);
  return count <= 1;
}

function recommendationRepairCount(sourceEffectiveness = {}) {
  return ensureArray(sourceEffectiveness.sources)
    .filter(source => PARSER_REPAIR_RECOMMENDATIONS.has(text(source.recommendation)))
    .length;
}

function hasSourceEffectivenessSourceEvidence(sourceEffectiveness = {}) {
  return ensureArray(sourceEffectiveness.sources).length > 0;
}

function compactReasonText(items) {
  return ensureArray(items).map(item => text(item.reason)).filter(Boolean).join('; ');
}

function buildRecommendedIssues(sourceBreakdown, reasons) {
  const issues = [];
  for (const source of sourceBreakdown) {
    if (!source.recommended_action || source.recommended_action === 'KEEP_AND_MONITOR') continue;
    issues.push({
      action: source.recommended_action,
      action_label: RECOMMENDED_ACTION_LABELS_KO[source.recommended_action],
      source_id: source.source_id,
      source_name: source.source_name,
      reason: source.parser_failure_signals[0] || source.top_blockers[0] || source.source_effectiveness_recommendation || source.recommended_action,
      severity: source.recommended_action === 'KEEP_AND_FIX_PARSER' ? 'high' : 'medium',
      source_artifact: 'source-effectiveness-report.json'
    });
  }
  if (boolFromReasons(reasons, 'taxonomy_missing')) {
    issues.push({
      action: 'ADD_MULTIMEDIA_BUCKET',
      action_label: RECOMMENDED_ACTION_LABELS_KO.ADD_MULTIMEDIA_BUCKET,
      source_id: '',
      source_name: '',
      reason: compactReasonText(reasons.taxonomy_missing) || 'Bucket/classification mapping should be reviewed.',
      severity: 'medium',
      source_artifact: reasons.taxonomy_missing[0]?.source_artifact || ''
    });
  }
  if (boolFromReasons(reasons, 'duplicate_or_noop_source_discovery')) {
    issues.push({
      action: 'REPAIR_SOURCE_DISCOVERY_DUPLICATES',
      action_label: RECOMMENDED_ACTION_LABELS_KO.REPAIR_SOURCE_DISCOVERY_DUPLICATES,
      source_id: '',
      source_name: '',
      reason: compactReasonText(reasons.duplicate_or_noop_source_discovery),
      severity: 'medium',
      source_artifact: reasons.duplicate_or_noop_source_discovery[0]?.source_artifact || ''
    });
  }
  const actualNewsShortageReasons = ensureArray(reasons.actual_news_shortage)
    .filter(reason => reason.severity !== 'info');
  if (actualNewsShortageReasons.length > 0) {
    issues.push({
      action: 'NO_ACTION_THIN_WEEK',
      action_label: RECOMMENDED_ACTION_LABELS_KO.NO_ACTION_THIN_WEEK,
      source_id: '',
      source_name: '',
      reason: compactReasonText(actualNewsShortageReasons),
      severity: 'low',
      source_artifact: actualNewsShortageReasons[0]?.source_artifact || ''
    });
  }
  const seen = new Set();
  return issues
    .filter(item => {
      const key = `${item.action}|${item.source_id}|${item.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) =>
      (ACTION_PRIORITY[a.action] || 99) - (ACTION_PRIORITY[b.action] || 99) ||
      String(a.source_id).localeCompare(String(b.source_id)) ||
      String(a.reason).localeCompare(String(b.reason))
    )
    .slice(0, 10);
}

function sourceArtifactName(relPath) {
  return path.basename(String(relPath || ''));
}

function buildSourceQualityDiagnosisReport(options = {}) {
  const date = text(options.date);
  const warnings = ensureArray(options.warnings).map(normalizeWarning);
  const candidateInput = options.candidateInput || {};
  const candidatePayload = options.candidatePayload || {};
  const candidates = ensureArray(options.candidates).length > 0 ? options.candidates : candidateItems(candidatePayload);
  const shortlistReport = objectValue(options.shortlistReport);
  const selectionReport = objectValue(options.selectionReport);
  const generationStatus = objectValue(options.generationStatus);
  const sourceEffectivenessReport = objectValue(options.sourceEffectivenessReport);
  const sourceQualityReport = objectValue(options.sourceQualityReport);
  const sourceDiscoveryFeedbackReport = objectValue(options.sourceDiscoveryFeedbackReport);
  const mergedCandidateManifest = objectValue(options.mergedCandidateManifest);
  const evidencePackSummary = objectValue(options.evidencePackSummary);
  const inputRefs = {
    candidate_input: candidateInput.relPath || '',
    shortlisted_candidates: options.inputRefs?.shortlisted_candidates || newsroomRelPath(date, 'shortlisted-candidates.json'),
    selection_report: options.inputRefs?.selection_report || null,
    generation_status: options.inputRefs?.generation_status || null,
    source_effectiveness_report: options.inputRefs?.source_effectiveness_report || null,
    source_quality_report: options.inputRefs?.source_quality_report || null,
    source_discovery_feedback_report: options.inputRefs?.source_discovery_feedback_report || null,
    merged_candidate_manifest: options.inputRefs?.merged_candidate_manifest || null,
    evidence_pack_summary: options.inputRefs?.evidence_pack_summary || null
  };
  const candidateShortageSummary = objectValue(
    selectionReport.candidate_shortage_summary ||
    shortlistReport.candidate_shortage_summary ||
    generationStatus.candidate_shortage_summary
  );
  const sourceEffectivenessSummary = objectValue(sourceEffectivenessReport.summary);
  const gateSummary = objectValue(selectionReport.gate_summary || shortlistReport.gate_summary);
  const statusComposition = generationStatus.composition_summary || {};
  const rawCandidateCount = firstNumber(
    sourceEffectivenessSummary.collected_count,
    generationStatus.input_candidate_count,
    shortlistReport.input_candidate_count,
    candidates.length
  ) || 0;
  const eligibleCandidateCount = firstNumber(
    sourceEffectivenessSummary.eligible_count,
    generationStatus.eligible_candidate_count,
    shortlistReport.final_eligible_candidate_count,
    shortlistReport.eligible_candidate_count,
    candidateShortageSummary.publishable_candidate_count,
    candidates.filter(isEligibleCandidate).length
  ) || 0;
  const primaryCameraStackCount = firstNumber(
    candidateShortageSummary.primary_camera_stack_candidate_count,
    gateSummary.primary_camera_stack_topic_count,
    generationStatus.primary_camera_stack_topic_count,
    statusComposition.primary_camera_stack_topic_count,
    0
  ) || 0;
  const androidMultimediaCameraOutputCount = firstNumber(
    gateSummary.android_multimedia_camera_output_count,
    generationStatus.android_multimedia_camera_output_count,
    statusComposition.android_multimedia_camera_output_count,
    candidates.filter(candidate => lower(candidate.relevance_bucket) === 'android_multimedia_camera_output').length,
    0
  ) || 0;

  if (Number(sourceEffectivenessSummary.source_quality_field_drift_count || 0) > 0) {
    warnings.push({
      type: 'contract_drift',
      message: `source_quality_field_drift_count=${sourceEffectivenessSummary.source_quality_field_drift_count}`,
      source_artifact: sourceArtifactName(inputRefs.source_effectiveness_report)
    });
  }

  const reasons = Object.fromEntries(DIAGNOSIS_KEYS.map(key => [key, []]));
  const sourceEffectivenessRel = inputRefs.source_effectiveness_report || newsroomRelPath(date, 'source-effectiveness-report.json');
  const selectionRel = inputRefs.selection_report || newsroomRelPath(date, 'selection-report.json');
  const generationRel = inputRefs.generation_status || newsroomRelPath(date, 'generation-status.json');
  const feedbackRel = inputRefs.source_discovery_feedback_report || newsroomRelPath(date, 'source-discovery-feedback-report.json');
  const manifestRel = inputRefs.merged_candidate_manifest || mergedCandidateManifestRelPath(date);

  const parserRepairSources = ensureArray(sourceEffectivenessReport.sources)
    .filter(source => PARSER_REPAIR_RECOMMENDATIONS.has(text(source.recommendation)) || Number(source.parser_repair_reason_count || 0) > 0);
  for (const source of parserRepairSources.slice(0, 5)) {
    addReason(
      reasons,
      'parser_extraction_failure',
      `${source.source_id || 'unknown-source'} has ${source.recommendation || 'parser repair'} recommendation.`,
      sourceEffectivenessRel,
      PARSER_REPAIR_RECOMMENDATIONS.has(text(source.recommendation)) ? 'high' : 'medium',
      { source_id: source.source_id || '' }
    );
  }
  if (Number(sourceDiscoveryFeedbackReport.parser_gap_count || 0) > 0) {
    addReason(
      reasons,
      'parser_extraction_failure',
      `source-discovery feedback reports parser_gap_count=${sourceDiscoveryFeedbackReport.parser_gap_count}.`,
      feedbackRel,
      'high'
    );
  }
  if (Number(sourceDiscoveryFeedbackReport.gemini_parser_failure_count || 0) > 0) {
    addReason(
      reasons,
      'parser_extraction_failure',
      `Gemini discovery parser extraction failures=${sourceDiscoveryFeedbackReport.gemini_parser_failure_count}.`,
      feedbackRel,
      'high'
    );
  }

  const unknownSourceQualityCount = firstNumber(
    sourceEffectivenessSummary.unknown_source_quality_count,
    sourceQualityReport.unknown_source_quality_count,
    0
  ) || 0;
  const unknownBucketCandidates = candidates.filter(candidate => {
    const bucket = lower(candidate.relevance_bucket || candidate.aospCameraStackBucket || candidate.aosp_camera_stack_bucket);
    return cameraRelevantRawSignal(candidate) && (!bucket || !KNOWN_CAMERA_BUCKETS.has(bucket));
  });
  if (unknownBucketCandidates.length > 0) {
    addReason(
      reasons,
      'taxonomy_missing',
      `${unknownBucketCandidates.length} camera-relevant candidate(s) were not mapped to a known camera bucket.`,
      candidateInput.relPath || collectedCandidatesRelPath(date),
      'medium'
    );
  }
  if (androidMultimediaCameraOutputCount === 0 && candidateShortage(selectionReport.candidate_shortage_summary || shortlistReport.candidate_shortage_summary || {}, generationStatus, selectionReport)) {
    addReason(
      reasons,
      'taxonomy_missing',
      'android_multimedia_camera_output bucket signal is missing while the candidate pool is underfilled.',
      selectionRel,
      'medium'
    );
  }
  if (unknownSourceQualityCount > 0) {
    addReason(
      reasons,
      'taxonomy_missing',
      `unknown_source_quality_count=${unknownSourceQualityCount}; source role or source quality could not be interpreted by the classifier.`,
      sourceEffectivenessRel,
      'medium'
    );
  }

  const sourceGapSources = ensureArray(sourceEffectivenessReport.sources)
    .filter(source => {
      if (PARSER_REPAIR_RECOMMENDATIONS.has(text(source.recommendation))) return false;
      return text(source.recommendation) === 'REVIEW_SOURCE_OR_PARSER' ||
        Number(source.source_gap_count || 0) >= 2 ||
        Number(source.source_gap_rate || 0) >= 0.5;
    });
  for (const source of sourceGapSources.slice(0, 5)) {
    addReason(
      reasons,
      'source_gap_risk',
      `${source.source_id || 'unknown-source'} has source coverage risk: source_gap_count=${Number(source.source_gap_count || 0)}.`,
      sourceEffectivenessRel,
      'medium',
      { source_id: source.source_id || '' }
    );
  }
  if (primaryCameraStackCount === 0 && candidateShortageSummary.required_publishable_candidate_count !== undefined) {
    addReason(
      reasons,
      'source_gap_risk',
      'Primary camera stack lane has no publishable candidate while the pool is underfilled.',
      selectionRel,
      'high'
    );
  }

  const compositionMode = firstText(
    generationStatus.selection_composition_mode,
    generationStatus.composition_mode,
    statusComposition.composition_mode
  );
  const nonFallbackCount = firstNumber(
    generationStatus.non_fallback_reviewable_article_count,
    statusComposition.non_fallback_reviewable_article_count,
    gateSummary.non_fallback_reviewable_article_count
  );
  const requiredNonFallback = firstNumber(
    generationStatus.min_non_fallback_publish_ready_articles,
    gateSummary.min_non_fallback_publish_ready_articles
  );
  const fallbackCount = firstNumber(
    generationStatus.cpp_ai_tooling_fallback_count,
    statusComposition.cpp_ai_tooling_fallback_count,
    gateSummary.cpp_ai_tooling_fallback_count,
    0
  ) || 0;
  if (compositionMode === 'FALLBACK_COMPOSITION') {
    addReason(
      reasons,
      'fallback_only_composition',
      'composition_mode is FALLBACK_COMPOSITION.',
      generationRel,
      'medium'
    );
  } else if (nonFallbackCount !== null && requiredNonFallback !== null && nonFallbackCount < requiredNonFallback && fallbackCount > 0) {
    addReason(
      reasons,
      'fallback_only_composition',
      `non_fallback_reviewable_article_count=${nonFallbackCount} is below required=${requiredNonFallback} while fallback candidates exist.`,
      generationRel,
      'medium'
    );
  }

  const geminiCandidateCount = Number(mergedCandidateManifest.gemini_candidate_count || 0);
  const geminiNewUnique = numberOrNull(mergedCandidateManifest.gemini_new_unique_url_count);
  const geminiPublishable = numberOrNull(mergedCandidateManifest.gemini_publishable_candidate_count);
  const geminiManualDuplicate = Number(mergedCandidateManifest.gemini_manual_duplicate_url_count || 0);
  if (geminiCandidateCount > 0 && geminiNewUnique === 0) {
    addReason(
      reasons,
      'duplicate_or_noop_source_discovery',
      `Gemini discovery produced ${geminiCandidateCount} candidate(s) but gemini_new_unique_url_count=0.`,
      manifestRel,
      'medium'
    );
  }
  if (geminiCandidateCount > 0 && geminiPublishable === 0) {
    addReason(
      reasons,
      'duplicate_or_noop_source_discovery',
      'Gemini discovery produced no new publishable candidates.',
      manifestRel,
      'medium'
    );
  }
  if (geminiManualDuplicate > 0 || Number(sourceDiscoveryFeedbackReport.duplicate_discovery_gap_count || 0) > 0) {
    addReason(
      reasons,
      'duplicate_or_noop_source_discovery',
      `Duplicate discovery signal detected: gemini_manual_duplicate_url_count=${geminiManualDuplicate}, duplicate_discovery_gap_count=${Number(sourceDiscoveryFeedbackReport.duplicate_discovery_gap_count || 0)}.`,
      geminiManualDuplicate > 0 ? manifestRel : feedbackRel,
      'medium'
    );
  }

  const shortage = candidateShortage(candidateShortageSummary, generationStatus, selectionReport);
  const otherFailureSignals = [
    'parser_extraction_failure',
    'taxonomy_missing',
    'source_gap_risk',
    'fallback_only_composition',
    'duplicate_or_noop_source_discovery'
  ].some(key => boolFromReasons(reasons, key));
  if (
    shortage &&
    !otherFailureSignals &&
    hasSourceEffectivenessSourceEvidence(sourceEffectivenessReport) &&
    highPrioritySourceRawCountLow(sourceEffectivenessReport) &&
    recommendationRepairCount(sourceEffectivenessReport) === 0
  ) {
    addReason(
      reasons,
      'actual_news_shortage',
      'Candidate count is below requirement, no parser/taxonomy/fallback/discovery failure signal is present, and high-priority source raw candidate count is low.',
      selectionRel,
      'low'
    );
  } else if (shortage && otherFailureSignals) {
    addReason(
      reasons,
      'actual_news_shortage',
      'Not marked as actual news shortage because parser/taxonomy/source/discovery failure signals are present.',
      selectionRel,
      'info'
    );
  } else if (shortage && !hasSourceEffectivenessSourceEvidence(sourceEffectivenessReport)) {
    addReason(
      reasons,
      'actual_news_shortage',
      'Not marked as actual news shortage because source-effectiveness source evidence is unavailable.',
      selectionRel,
      'info'
    );
  }

  const diagnosis = Object.fromEntries(DIAGNOSIS_KEYS.map(key => [key, boolFromReasons(reasons, key)]));
  if (reasons.actual_news_shortage.some(reason => reason.severity === 'info')) {
    diagnosis.actual_news_shortage = false;
  }
  for (const key of DIAGNOSIS_KEYS) {
    if (diagnosis[key] === true && reasons[key].length === 0) {
      addReason(reasons, key, `${key}=true from deterministic diagnosis fallback.`, '', 'medium');
    }
  }

  const sourceBreakdown = ensureArray(sourceEffectivenessReport.sources).length > 0
    ? buildSourceBreakdownFromEffectiveness(sourceEffectivenessReport)
    : buildSourceBreakdownFromCandidates(candidates);
  const recommendedIssues = buildRecommendedIssues(sourceBreakdown, reasons);

  return {
    schema_version: SCHEMA_VERSION,
    report_type: REPORT_TYPE,
    date,
    input_refs: inputRefs,
    raw_candidate_count: rawCandidateCount,
    eligible_candidate_count: eligibleCandidateCount,
    primary_camera_stack_count: primaryCameraStackCount,
    android_multimedia_camera_output_count: androidMultimediaCameraOutputCount,
    diagnosis,
    diagnosis_reasons: reasons,
    source_breakdown: sourceBreakdown,
    recommended_issues: recommendedIssues,
    warnings
  };
}

function resolveCandidateInput(root, date, generationStatus = {}) {
  const configuredRel = text(generationStatus.candidate_input?.candidate_artifact);
  const candidates = [
    configuredRel,
    mergedCandidatesRelPath(date),
    manualCandidatesRelPath(date),
    collectedCandidatesRelPath(date)
  ].filter(Boolean);
  for (const relPath of candidates) {
    const filePath = repoPath(root, relPath);
    if (filePath && fs.existsSync(filePath)) {
      return {
        path: filePath,
        relPath: toRepoRelPath(root, filePath),
        payload: readJson(filePath)
      };
    }
  }
  throw new Error(`Missing candidate input artifact for ${date}: ${candidates.join(', ')}`);
}

function loadSourceQualityDiagnosisInputs(root, date) {
  const resolvedRoot = path.resolve(root || process.cwd());
  const warnings = [];
  const generationRel = newsroomRelPath(date, 'generation-status.json');
  const generationStatus = readJsonIfExists(resolvedRoot, generationRel, warnings) ||
    readJsonIfExists(resolvedRoot, '.tmp/newsletter-generation-status.json', warnings);
  const candidateInput = resolveCandidateInput(resolvedRoot, date, generationStatus || {});
  const shortlistRel = newsroomRelPath(date, 'shortlisted-candidates.json');
  const shortlistPath = path.join(resolvedRoot, ...shortlistRel.split('/'));
  if (!fs.existsSync(shortlistPath)) {
    throw new Error(`Missing required input ${shortlistRel}`);
  }
  const optionalSpecs = [
    ['selectionReport', newsroomRelPath(date, 'selection-report.json')],
    ['sourceEffectivenessReport', newsroomRelPath(date, 'source-effectiveness-report.json')],
    ['sourceQualityReport', newsroomRelPath(date, 'source-quality-report.json')],
    ['sourceDiscoveryFeedbackReport', newsroomRelPath(date, 'source-discovery-feedback-report.json')],
    ['mergedCandidateManifest', mergedCandidateManifestRelPath(date)],
    ['evidencePackSummary', newsroomRelPath(date, 'evidence-pack-summary.json')]
  ];
  const out = {
    date,
    warnings,
    candidateInput,
    candidatePayload: candidateInput.payload,
    shortlistReport: readJson(shortlistPath),
    generationStatus: generationStatus || {},
    inputRefs: {
      candidate_input: candidateInput.relPath,
      shortlisted_candidates: shortlistRel,
      generation_status: generationStatus ? generationRel : null
    }
  };
  for (const [key, relPath] of optionalSpecs) {
    out[key] = readJsonIfExists(resolvedRoot, relPath, warnings);
    out.inputRefs[{
      selectionReport: 'selection_report',
      sourceEffectivenessReport: 'source_effectiveness_report',
      sourceQualityReport: 'source_quality_report',
      sourceDiscoveryFeedbackReport: 'source_discovery_feedback_report',
      mergedCandidateManifest: 'merged_candidate_manifest',
      evidencePackSummary: 'evidence_pack_summary'
    }[key]] = out[key] ? relPath : null;
  }
  return out;
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

function statusText(value) {
  return value === true ? 'true' : 'false';
}

function firstReasonText(report, key) {
  return ensureArray(report.diagnosis_reasons?.[key]).map(item => text(item.reason)).filter(Boolean)[0] || '진단 신호 없음';
}

function trueDiagnosisLabels(report) {
  return DIAGNOSIS_KEYS
    .filter(key => report.diagnosis?.[key] === true)
    .map(key => DIAGNOSIS_LABELS_KO[key]);
}

function renderSourceQualityDiagnosisMarkdown(report) {
  const labels = trueDiagnosisLabels(report);
  const conclusion = report.diagnosis?.actual_news_shortage === true
    ? '실제 뉴스 부족 가능성이 큽니다.'
    : labels.length > 0
      ? '실제 뉴스 부족보다는 후보 추출/분류/source discovery 단계 손실 가능성이 큽니다.'
      : '뚜렷한 source quality failure signal은 없습니다.';
  const sourceRows = ensureArray(report.source_breakdown)
    .slice()
    .sort((a, b) =>
      (ACTION_PRIORITY[a.recommended_action] || 99) - (ACTION_PRIORITY[b.recommended_action] || 99) ||
      Number(b.raw_count || 0) - Number(a.raw_count || 0) ||
      text(a.source_id).localeCompare(text(b.source_id))
    )
    .slice(0, 20)
    .map(source => [
      source.source_name || source.source_id,
      source.raw_count,
      source.eligible_count,
      ensureArray(source.top_blockers).slice(0, 2).join('; ') || '없음',
      RECOMMENDED_ACTION_LABELS_KO[source.recommended_action] || source.recommended_action || ''
    ]);
  const issueRows = ensureArray(report.recommended_issues).slice(0, 10).map(issue => [
    RECOMMENDED_ACTION_LABELS_KO[issue.action] || issue.action,
    issue.source_name || issue.source_id || '전체',
    issue.reason,
    issue.severity
  ]);
  const warningRows = ensureArray(report.warnings).map(warning => [
    warning.type,
    warning.message,
    warning.source_artifact || '',
    warning.severity || ''
  ]);

  return [
    '# 소스 품질 진단 리포트',
    '',
    `Date: ${report.date}`,
    '',
    '## 요약',
    '',
    `- 원본 후보 수: ${report.raw_candidate_count}`,
    `- 최종 사용 가능 후보 수: ${report.eligible_candidate_count}`,
    `- Primary Camera Stack 후보 수: ${report.primary_camera_stack_count}`,
    `- Android multimedia camera output 후보 수: ${report.android_multimedia_camera_output_count}`,
    `- 주요 진단: ${labels.join(', ') || '없음'}`,
    `- 결론: ${conclusion}`,
    '',
    '## 진단 플래그',
    '',
    markdownTable(
      ['진단 항목', '상태', '근거'],
      DIAGNOSIS_KEYS.map(key => [
        DIAGNOSIS_LABELS_KO[key],
        statusText(report.diagnosis?.[key] === true),
        firstReasonText(report, key)
      ])
    ),
    '## 소스별 진단',
    '',
    markdownTable(
      ['소스', '원본 후보', '최종 후보', '주요 차단 원인', '권장 조치'],
      sourceRows
    ),
    '## 권장 조치',
    '',
    markdownTable(
      ['권장 조치', '대상', '근거', '심각도'],
      issueRows
    ),
    '## 경고',
    '',
    markdownTable(
      ['유형', '메시지', 'Source artifact', '심각도'],
      warningRows
    ),
    ''
  ].join('\n');
}

function writeSourceQualityDiagnosisArtifacts(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const date = text(options.date) || kstDate();
  const inputs = options.inputs || loadSourceQualityDiagnosisInputs(root, date);
  const report = buildSourceQualityDiagnosisReport({ ...inputs, date });
  const markdown = renderSourceQualityDiagnosisMarkdown(report);
  const outDir = newsroomDir(root, date);
  const jsonPath = path.join(outDir, 'source-quality-diagnosis.json');
  const markdownPath = path.join(outDir, 'source-quality-diagnosis.md');
  writeJson(jsonPath, report);
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  return { report, markdown, jsonPath, markdownPath };
}

module.exports = {
  DIAGNOSIS_KEYS,
  DIAGNOSIS_LABELS_KO,
  RECOMMENDED_ACTION_LABELS_KO,
  buildSourceQualityDiagnosisReport,
  loadSourceQualityDiagnosisInputs,
  renderSourceQualityDiagnosisMarkdown,
  writeSourceQualityDiagnosisArtifacts
};
