const HAL_SIGNAL_SCHEMA_VERSION = 1;

const HAL_IMPACT_AXES = Object.freeze([
  'framework_hal_contract',
  'driver_image_pipeline',
  'stream_buffer_metadata',
  'cts_vts_its_cdd',
  'performance_latency_frame_drop',
  'thermal_power_memory_pressure',
  'soc_resource_contention',
  'camerax_app_compatibility',
  'native_tooling_workflow',
  'security_vendor_component',
  'reference_only',
  'unknown'
]);

const ACTIONABILITY_LEVELS = Object.freeze([
  'none',
  'generic_review',
  'concrete_check',
  'measurable_test',
  'owner_metric_log'
]);

const SIGNAL_QUALITY_STATUSES = Object.freeze([
  'strong_signal',
  'usable_signal',
  'weak_signal',
  'watchlist_only',
  'blocked_source_gap',
  'unknown'
]);

const CAPSULE_REQUIRED_FIELDS = Object.freeze([
  'why_now',
  'reader_owners',
  'check_within_2_weeks',
  'impact_axes',
  'do_not_overstate'
]);

const REFERENCE_ONLY_AXES = new Set(['reference_only', 'unknown']);
const VALID_AXES = new Set(HAL_IMPACT_AXES);
const VALID_ACTIONABILITY = new Set(ACTIONABILITY_LEVELS);
const VALID_STATUS = new Set(SIGNAL_QUALITY_STATUSES);
const ACTIONABILITY_RANK = Object.freeze(
  ACTIONABILITY_LEVELS.reduce((ranks, level, index) => ({ ...ranks, [level]: index }), {})
);
const HARD_BLOCKER_REASON_CODE_BY_BLOCKER = Object.freeze({
  missing_hal_impact_axis: 'hal_impact_axis_missing',
  actionability_none: 'hal_actionability_none',
  generic_review_actionability: 'hal_generic_review_actionability',
  fallback_promotion_missing_reason: 'fallback_promotion_not_allowed',
  soc_platform_missing_camera_pipeline_link: 'soc_camera_pipeline_link_missing'
});
const CONCRETE_TWO_WEEK_ACTION_PATTERN =
  /test|log|metric|measure|CTS|VTS|Camera ITS|stream|buffer|metadata|owner|API|PoC/i;

const CONSERVATIVE_DO_NOT_OVERSTATE =
  '출처 근거를 넘어 기기 적용, HAL API 변경, 양산 영향으로 확대 해석하지 않는다.';
const FALLBACK_DO_NOT_OVERSTATE =
  'source evidence가 뒷받침하지 않으면 Camera HAL 직접 동작 변경으로 표현하지 않습니다.';

const BUCKET_IMPACT_AXES = Object.freeze({
  direct_aosp_camera: ['framework_hal_contract'],
  camera_driver_image_pipeline: ['driver_image_pipeline'],
  android_platform_camera_adjacent: ['camerax_app_compatibility'],
  android_multimedia_camera_output: ['stream_buffer_metadata'],
  soc_platform_signal: ['soc_resource_contention'],
  cpp_ai_tooling_fallback: ['native_tooling_workflow'],
  generic_tech_watchlist: ['reference_only']
});

const AXIS_READER_OWNER_MAP = Object.freeze({
  framework_hal_contract: ['camera_hal_owner'],
  stream_buffer_metadata: ['camera_hal_owner'],
  driver_image_pipeline: ['camera_driver_owner'],
  cts_vts_its_cdd: ['camera_test_owner'],
  camerax_app_compatibility: ['camerax_app_compat_owner'],
  native_tooling_workflow: ['native_tooling_owner'],
  thermal_power_memory_pressure: ['soc_platform_owner'],
  soc_resource_contention: ['soc_platform_owner'],
  security_vendor_component: ['security_owner']
});

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value).trim();
}

function firstText(...values) {
  for (const value of values) {
    const parsed = text(value);
    if (parsed) return parsed;
  }
  return '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of ensureArray(values).flat()) {
    const parsed = text(value);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    out.push(parsed);
  }
  return out;
}

function normalizeEnum(value) {
  return text(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function arrayFromCommaText(value) {
  if (Array.isArray(value)) return value;
  if (!text(value)) return [];
  return String(value).split(/[,;]\s*/).map(item => item.trim()).filter(Boolean);
}

function articleSections(value = {}) {
  return objectValue(value.article_sections || value.articleSections);
}

function sourceUrls(value = {}) {
  return unique([
    value.url,
    value.article_url,
    value.articleUrl,
    value.normalized_url,
    value.source_candidate_url,
    ...ensureArray(value.sources).map(source => source?.url)
  ]);
}

function articleText(value = {}) {
  const sections = articleSections(value);
  return [
    value.title,
    value.headline,
    value.category,
    value.summary,
    value.what_changed,
    value.behavior_change,
    value.evidence_summary,
    value.specificity_checks,
    value.source_verification_notes,
    value.camera_hal_checks,
    value.action_items,
    sections.verified_facts,
    sections.background_context,
    sections.hal_driver_impact,
    sections.action_items,
    sections.team_share_points,
    value.derived_editorial_hints,
    value.source_extraction,
    value.extraction_quality,
    value.sources
  ].map(text).filter(Boolean).join(' ');
}

function normalizeAxes(values) {
  return unique(ensureArray(values).flatMap(value => arrayFromCommaText(value)))
    .map(normalizeEnum)
    .filter(value => VALID_AXES.has(value));
}

function rawAxisValues(values) {
  return unique(ensureArray(values).flatMap(value => arrayFromCommaText(value)))
    .map(normalizeEnum)
    .filter(Boolean);
}

function explicitAxes(value = {}) {
  return normalizeAxes([
    ...ensureArray(value.hal_impact_axes),
    ...ensureArray(value.halImpactAxes),
    ...ensureArray(objectValue(value.impact_classification).hal_impact_axes),
    ...ensureArray(objectValue(value.impact_classification).axes),
    ...ensureArray(objectValue(value.hal_signal_capsule).impact_axes)
  ]);
}

function inferHalImpactAxes(value = {}) {
  const explicit = explicitAxes(value);
  if (explicit.length > 0) return explicit;

  const body = articleText(value);
  const bodyLower = body.toLowerCase();
  const bucket = normalizeEnum(firstText(
    value.relevance_bucket,
    value.relevanceBucket,
    objectValue(value.scope_count).relevance_bucket,
    objectValue(value.scope_relevance).relevance_bucket
  ));
  const axes = [];

  if (bucket === 'direct_aosp_camera') axes.push('framework_hal_contract');
  if (bucket === 'camera_driver_image_pipeline') axes.push('driver_image_pipeline');
  if (bucket === 'android_platform_camera_adjacent') axes.push('camerax_app_compatibility');
  if (bucket === 'android_multimedia_camera_output') axes.push('stream_buffer_metadata');
  if (bucket === 'soc_platform_signal') axes.push('soc_resource_contention');
  if (bucket === 'cpp_ai_tooling_fallback') axes.push('native_tooling_workflow');
  if (bucket === 'generic_tech_watchlist') axes.push('reference_only');

  if (/\b(?:camera\s*hal|camera provider|camera3|hal3|icamera|vendor tag|session parameter)\b/i.test(body)) {
    axes.push('framework_hal_contract');
  }
  if (/\b(?:driver|isp|image pipeline|sensor|mipi|csi-?2|dma-buf|v4l2|libcamera|media controller|raw|yuv)\b/i.test(body)) {
    axes.push('driver_image_pipeline');
  }
  if (/\b(?:stream|buffer|metadata|request|result|surface|camera pipe|imagecapture|videocapture|imageanalysis)\b/i.test(body)) {
    axes.push('stream_buffer_metadata');
  }
  if (/\b(?:cts|vts|camera its|its|cdd)\b/i.test(body)) {
    axes.push('cts_vts_its_cdd');
  }
  if (/\b(?:latency|frame drop|jank|throughput|fps|profile|benchmark)\b/i.test(body)) {
    axes.push('performance_latency_frame_drop');
  }
  if (/\b(?:thermal|power|memory|dvfs|scheduler|eas|throttle|bandwidth)\b/i.test(body)) {
    axes.push('thermal_power_memory_pressure');
  }
  if (/\b(?:soc|isp|gpu|npu|dsp|cpu|platform resource|resource contention)\b/i.test(body)) {
    axes.push('soc_resource_contention');
  }
  if (/\b(?:camerax|camera2|android camera|jetpack camera)\b/i.test(body)) {
    axes.push('camerax_app_compatibility');
  }
  if (/\b(?:c\+\+|llvm|clang|gcc|ndk|native|sanitizer|toolchain|debugging)\b/i.test(body)) {
    axes.push('native_tooling_workflow');
  }
  if (/\b(?:security|cve|vendor component|firmware)\b/i.test(body)) {
    axes.push('security_vendor_component');
  }
  if (/\b(?:reference only|watchlist|briefing only|documentation page)\b/i.test(bodyLower)) {
    axes.push('reference_only');
  }

  const normalized = normalizeAxes(axes);
  return normalized.length > 0 ? normalized : ['unknown'];
}

function hasNonReferenceAxis(axes) {
  return ensureArray(axes).some(axis => !REFERENCE_ONLY_AXES.has(normalizeEnum(axis)));
}

function countConcreteActionSignals(value = {}) {
  const body = articleText(value);
  const capsule = objectValue(value.hal_signal_capsule);
  const haystack = [
    body,
    capsule.check_within_2_weeks,
    capsule.reader_owners,
    value.reader_owners
  ].map(text).join(' ');
  const checks = [
    /\b(?:owner|assignee|camera owner|hal owner|driver owner|team)\b/i,
    /\b(?:test|cts|vts|camera its|its|smoke|regression|validation|poc)\b/i,
    /\b(?:log|trace|systrace|perfetto|dumpsys|bugreport)\b/i,
    /\b(?:metric|measure|latency|frame drop|fps|throughput|benchmark|profile)\b/i,
    /\b(?:api|component|camera2|camerax|hal|driver|isp|vendor tag)\b/i,
    /\b(?:stream|buffer|metadata|request|result|surface|imagecapture|videocapture|imageanalysis)\b/i,
    /\b(?:device|pixel|soc|gpu|npu|isp|sensor|thermal|power|memory)\b/i,
    /\b(?:within\s+2\s+weeks?|two\s+weeks?|14\s+days?|2\uc8fc|2 weeks)\b/i
  ];
  return checks.reduce((count, pattern) => count + (pattern.test(haystack) ? 1 : 0), 0);
}

function actionabilityEvidenceText(value = {}) {
  const sections = articleSections(value);
  const capsule = objectValue(value.hal_signal_capsule);
  return [
    sections.action_items,
    value.action_items,
    value.camera_hal_checks,
    value.specificity_checks,
    capsule.check_within_2_weeks,
    capsule.reader_owners,
    value.reader_owners
  ].map(text).join(' ');
}

function actionabilityVerificationText(value = {}) {
  const sections = articleSections(value);
  const capsule = objectValue(value.hal_signal_capsule);
  return [
    sections.action_items,
    value.action_items,
    value.camera_hal_checks,
    value.specificity_checks,
    capsule.check_within_2_weeks
  ].map(text).join(' ');
}

function hasActionabilitySourceBinding(value = {}) {
  return sourceUrls(value).length > 0 ||
    Boolean(firstText(value.evidence_id, value.source_event_id)) ||
    ensureArray(value.evidence_ids).length > 0 ||
    ensureArray(value.primary_evidence_ids).length > 0;
}

function actionabilitySignalMatches(value = {}) {
  const haystack = actionabilityVerificationText(value);
  const match = (name, pattern) => pattern.test(haystack) ? name : '';
  return unique([
    match('owner', /\b(?:owner|assignee|camera owner|hal owner|driver owner|team)\b/i),
    match('test', /\b(?:test|cts|vts|camera its|its|smoke|regression|validation|poc|verify|check)\b/i),
    match('log', /\b(?:log|trace|systrace|perfetto|dumpsys|bugreport)\b/i),
    match('metric', /\b(?:metric|measure|compare|latency|frame drop|fps|throughput|benchmark|profile|timing)\b/i),
    match('api', /\b(?:api|camera2|camerax|hal|driver|isp|vendor tag)\b/i),
    match('stream_buffer_metadata', /\b(?:stream|buffer|metadata|request|result|surface|imagecapture|videocapture|imageanalysis)\b/i),
    match('follow_up_window', /\b(?:within\s+2\s+weeks?|two\s+weeks?|14\s+days?|2\uc8fc|2 weeks)\b/i)
  ]).filter(Boolean);
}

function observableVerificationTarget(value = {}) {
  const haystack = actionabilityVerificationText(value);
  if (/\b(?:no|not|without)\b.{0,40}\b(?:cts|vts|test|metric|measure|log|trace|perfetto|required|needed)\b/i.test(haystack) ||
    /\b(?:cts|vts|test|metric|measure|log|trace|perfetto)\b.{0,40}\b(?:not required|not needed|unnecessary|unneeded)\b/i.test(haystack) ||
    /(?:테스트|검증|측정).{0,12}(?:불필요|필요\s*없음)/i.test(haystack)) {
    return '';
  }
  const checks = [
    ['frame timing metric', /\b(?:frame timing|frame drop|fps|latency|metric|measure|compare|benchmark|throughput)\b/i],
    ['log or trace output', /\b(?:log|trace|systrace|perfetto|dumpsys|bugreport)\b/i],
    ['camera test result', /\b(?:cts|vts|camera its|its|smoke|regression|validation|test)\b/i],
    ['API behavior', /\b(?:api|camera2|camerax|imagecapture|videocapture|imageanalysis)\b/i],
    ['stream/buffer/metadata behavior', /\b(?:stream|buffer|metadata|request|result|surface)\b/i]
  ];
  const found = checks.find(([, pattern]) => pattern.test(haystack));
  return found ? found[0] : '';
}

function inferActionabilityUpgradeEvidence(value = {}, fromLevel = 'none') {
  const matchedSignals = actionabilitySignalMatches(value);
  const verificationTarget = observableVerificationTarget(value);
  const sourceBound = hasActionabilitySourceBinding(value);
  const articleSpecific = text(actionabilityVerificationText(value)).length > 0;
  if (!sourceBound || !articleSpecific || !verificationTarget || matchedSignals.length === 0) {
    return {
      upgrade_to: fromLevel,
      matched_signal: '',
      verification_target: '',
      source_bound: sourceBound,
      article_specific: articleSpecific
    };
  }

  const hasOwner = matchedSignals.includes('owner');
  const hasMetric = matchedSignals.includes('metric');
  const hasLog = matchedSignals.includes('log');
  const hasFollowUp = matchedSignals.includes('follow_up_window');
  const hasMeasurementVerb = /\b(?:measure|compare|profile|benchmark|track)\b/i.test(actionabilityVerificationText(value));
  let upgradeTo = 'concrete_check';
  if (hasMetric && hasMeasurementVerb) upgradeTo = 'measurable_test';
  if (hasOwner && hasFollowUp && (hasMetric || hasLog)) upgradeTo = 'owner_metric_log';

  return {
    source_url: sourceUrls(value)[0] || '',
    evidence_id: firstText(value.evidence_id, value.source_event_id, ensureArray(value.evidence_ids)[0], ensureArray(value.primary_evidence_ids)[0]),
    matched_signal: matchedSignals.join(','),
    verification_target: verificationTarget,
    upgrade_from: fromLevel,
    upgrade_to: upgradeTo,
    source_bound: true,
    article_specific: true
  };
}

function countActionabilityUpgradeSignals(value = {}) {
  const haystack = actionabilityVerificationText(value);
  const checks = [
    /\b(?:owner|assignee|camera owner|hal owner|driver owner|team)\b/i,
    /\b(?:test|cts|vts|camera its|its|smoke|regression|validation|poc)\b/i,
    /\b(?:log|trace|systrace|perfetto|dumpsys|bugreport)\b/i,
    /\b(?:metric|measure|latency|frame drop|fps|throughput|benchmark|profile)\b/i,
    /\b(?:api|camera2|camerax)\b/i,
    /\bstream\b/i,
    /\bbuffer\b/i,
    /\bmetadata\b/i
  ];
  return checks.reduce((count, pattern) => count + (pattern.test(haystack) ? 1 : 0), 0);
}

function inferredActionabilityLevel(value = {}, signalCount = countConcreteActionSignals(value)) {
  const body = articleText(value);
  if (!text(objectValue(value.hal_signal_capsule).check_within_2_weeks) &&
    ensureArray(articleSections(value).action_items).length === 0 &&
    ensureArray(value.action_items).length === 0) {
    return 'none';
  }
  if (signalCount >= 5) return 'owner_metric_log';
  if (signalCount >= 3) return 'measurable_test';
  if (signalCount >= 2) return 'concrete_check';
  if (/\b(?:review|monitor|watch|track|follow|check)\b/i.test(body)) return 'generic_review';
  return 'none';
}

function resolveActionability(value = {}) {
  const explicit = normalizeEnum(firstText(value.actionability_level, value.actionabilityLevel));
  const signalCount = countConcreteActionSignals(value);
  const upgradeSignalCount = countActionabilityUpgradeSignals(value);
  const inferredActionability = inferredActionabilityLevel(value, signalCount);
  const actionabilityLevel = explicit && VALID_ACTIONABILITY.has(explicit)
    ? explicit
    : inferredActionability;
  const upgradeEvidence = inferActionabilityUpgradeEvidence(value, actionabilityLevel);
  const inferredByAction = upgradeEvidence.upgrade_to || actionabilityLevel;
  const effectiveActionabilityLevel = ACTIONABILITY_RANK[inferredByAction] > ACTIONABILITY_RANK[actionabilityLevel]
    ? inferredByAction
    : actionabilityLevel;
  const actionabilityUpgradeReason = actionabilityLevel !== effectiveActionabilityLevel
    ? `Contains source-bound ${upgradeEvidence.verification_target || 'verification'} action evidence: ${upgradeEvidence.matched_signal || 'concrete signal'}.`
    : '';
  return {
    actionability_level: actionabilityLevel,
    effective_actionability_level: effectiveActionabilityLevel,
    actionability_upgrade_reason: actionabilityUpgradeReason,
    actionability_upgrade_evidence: actionabilityLevel !== effectiveActionabilityLevel ? {
      ...upgradeEvidence,
      upgrade_from: actionabilityLevel,
      upgrade_to: effectiveActionabilityLevel
    } : null,
    concrete_action_signal_count: signalCount,
    actionability_upgrade_signal_count: upgradeSignalCount
  };
}

function inferActionabilityLevel(value = {}) {
  return resolveActionability(value).actionability_level;
}

function inferEffectiveActionabilityLevel(value = {}) {
  return resolveActionability(value).effective_actionability_level;
}

function inferReaderOwners(value = {}, axes = inferHalImpactAxes(value)) {
  const explicit = unique([
    ...ensureArray(value.reader_owners),
    ...ensureArray(value.readerOwners),
    ...ensureArray(objectValue(value.hal_signal_capsule).reader_owners)
  ]).map(normalizeEnum).filter(Boolean);
  if (explicit.length > 0) return explicit;

  const owners = [];
  const axisSet = new Set(ensureArray(axes).map(normalizeEnum));
  if (axisSet.has('framework_hal_contract') || axisSet.has('stream_buffer_metadata')) owners.push('camera_hal_owner');
  if (axisSet.has('camerax_app_compatibility')) owners.push('camera_framework_owner', 'camerax_app_compat_owner');
  if (axisSet.has('driver_image_pipeline')) owners.push('camera_driver_owner');
  if (axisSet.has('cts_vts_its_cdd')) owners.push('camera_test_owner');
  if (axisSet.has('performance_latency_frame_drop') || axisSet.has('thermal_power_memory_pressure')) owners.push('performance_thermal_owner');
  if (axisSet.has('soc_resource_contention')) owners.push('soc_platform_owner');
  if (axisSet.has('native_tooling_workflow')) owners.push('native_tooling_owner');
  if (axisSet.has('security_vendor_component')) owners.push('security_owner');
  return unique(owners.length > 0 ? owners : ['unknown_owner']);
}

function normalizeDoNotOverstate(value = {}) {
  return unique([
    ...ensureArray(value.do_not_overstate),
    ...ensureArray(value.doNotOverstate),
    ...ensureArray(value.do_not_claim),
    ...ensureArray(objectValue(value.derived_editorial_hints).do_not_claim),
    ...ensureArray(value.overclaim_guardrails),
    ...ensureArray(objectValue(value.hal_signal_capsule).do_not_overstate)
  ]).slice(0, 8);
}

function boolOrNull(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

function inferFallbackPromotionAllowed(value = {}, axes = inferHalImpactAxes(value), actionability = inferEffectiveActionabilityLevel(value)) {
  const explicit = boolOrNull(value.fallback_promotion_allowed ?? value.fallbackPromotionAllowed);
  if (explicit !== null) return explicit;
  const bucket = normalizeEnum(firstText(value.relevance_bucket, value.relevanceBucket, objectValue(value.scope_count).relevance_bucket));
  if (!['cpp_ai_tooling_fallback', 'soc_platform_signal', 'generic_tech_watchlist'].includes(bucket)) return true;
  if (bucket === 'generic_tech_watchlist') return false;
  return hasNonReferenceAxis(axes) && actionability !== 'none' && actionability !== 'generic_review';
}

function inferFallbackPromotionReason(value = {}) {
  return firstText(
    value.fallback_promotion_reason,
    value.fallbackPromotionReason,
    value.relevance_reason,
    value.collection_reason,
    value.selection_reason,
    value.reason,
    objectValue(value.scope_count).count_reason
  );
}

function inferFallbackGuardNotes(value = {}) {
  return unique([
    ...ensureArray(value.fallback_guard_notes),
    ...ensureArray(value.fallbackGuardNotes),
    ...normalizeDoNotOverstate(value)
  ]).slice(0, 8);
}

function inferSocSignalType(value = {}) {
  const explicit = normalizeEnum(firstText(value.soc_signal_type, value.socSignalType));
  if (explicit) return explicit;
  const body = articleText(value);
  if (/\b(?:isp|image signal processor|sensor|mipi|csi-?2)\b/i.test(body)) return 'isp_image_pipeline';
  if (/\b(?:gpu|npu|dsp|inference|ai)\b/i.test(body)) return 'accelerator_camera_workload';
  if (/\b(?:thermal|power|dvfs|scheduler|memory|bandwidth)\b/i.test(body)) return 'resource_budget';
  if (/\b(?:soc|platform)\b/i.test(body)) return 'platform_signal';
  return '';
}

function inferCameraPipelineLink(value = {}) {
  return firstText(
    value.camera_pipeline_link,
    value.cameraPipelineLink,
    objectValue(value.scope_count).camera_pipeline_link
  );
}

function inferSocSignalSourceAllowed(value = {}) {
  const explicit = boolOrNull(value.soc_signal_source_allowed ?? value.socSignalSourceAllowed);
  if (explicit !== null) return explicit;
  const body = articleText(value);
  const bucket = normalizeEnum(firstText(value.relevance_bucket, value.relevanceBucket, objectValue(value.scope_count).relevance_bucket));
  if (bucket !== 'soc_platform_signal') return true;
  return /\b(?:camera|image|frame|stream|buffer|metadata|isp|sensor|latency|thermal|power|memory|camera workload)\b/i.test(body);
}

function inferSignalQualityStatus(value = {}, axes = inferHalImpactAxes(value), actionability = inferEffectiveActionabilityLevel(value)) {
  const explicit = normalizeEnum(firstText(value.signal_quality_status, value.signalQualityStatus));
  if (explicit && VALID_STATUS.has(explicit)) return explicit;
  if (value.source_gap_risk === true || /source gap|no dated evidence|missing source/i.test(articleText(value))) {
    return 'blocked_source_gap';
  }
  if (!hasNonReferenceAxis(axes)) return 'watchlist_only';
  if (actionability === 'owner_metric_log' || actionability === 'measurable_test') return 'strong_signal';
  if (actionability === 'concrete_check') return 'usable_signal';
  return 'weak_signal';
}

function normalizeHalSignalCapsule(section = {}) {
  const raw = objectValue(section.hal_signal_capsule || section.halSignalCapsule);
  const readerOwners = unique(ensureArray(raw.reader_owners).flatMap(arrayFromCommaText)).map(normalizeEnum);
  const impactAxes = normalizeAxes(raw.impact_axes);
  const doNotOverstate = unique(ensureArray(raw.do_not_overstate));
  const normalized = {
    why_now: text(raw.why_now),
    reader_owners: readerOwners,
    check_within_2_weeks: text(raw.check_within_2_weeks),
    impact_axes: impactAxes,
    do_not_overstate: doNotOverstate
  };
  const missing = CAPSULE_REQUIRED_FIELDS.filter(field => {
    const value = normalized[field];
    return Array.isArray(value) ? value.length === 0 : !text(value);
  });
  return {
    present: Object.keys(raw).length > 0,
    complete: Object.keys(raw).length > 0 && missing.length === 0,
    missing_keys: missing,
    capsule: normalized
  };
}

function isCompleteHalSignalCapsule(section = {}) {
  return normalizeHalSignalCapsule(section).complete === true;
}

function canonicalizeHalSignalCapsule(capsule = {}) {
  const normalized = normalizeHalSignalCapsule({ hal_signal_capsule: capsule }).capsule;
  return {
    why_now: normalized.why_now,
    reader_owners: [...normalized.reader_owners].sort(),
    check_within_2_weeks: normalized.check_within_2_weeks,
    impact_axes: [...normalized.impact_axes].sort(),
    do_not_overstate: [...normalized.do_not_overstate].sort()
  };
}

function dateValuesFromFields(fields = []) {
  return unique(fields
    .map(item => {
      const match = text(item).match(/\b\d{4}-\d{2}-\d{2}\b/);
      return match ? match[0] : '';
    })
    .filter(Boolean))
    .sort()
    .reverse();
}

function sourceDateValues(value = {}) {
  const sourceExtraction = objectValue(value.source_extraction);
  const structuredFields = [
    value.evidence_date,
    value.source_date,
    value.published_at,
    value.publishedAt,
    value.published_date,
    value.effective_date,
    sourceExtraction.date,
    sourceExtraction.published_at,
    sourceExtraction.publishedAt,
    sourceExtraction.published_date,
    sourceExtraction.effective_date,
    ...ensureArray(value.sources).flatMap(source => [
      source?.published_at,
      source?.publishedAt,
      source?.published_date,
      source?.date,
      source?.effective_date
    ])
  ];
  const structuredDates = dateValuesFromFields(structuredFields);
  if (structuredDates.length > 0) return structuredDates;
  return dateValuesFromFields([
    value.source_verification_notes,
    sourceExtraction.source_verification_notes
  ]);
}

function explicitImpactAxisResult(value = {}) {
  const rawValues = rawAxisValues([
    ...ensureArray(value.hal_impact_axes),
    ...ensureArray(value.halImpactAxes),
    ...ensureArray(objectValue(value.impact_classification).hal_impact_axes),
    ...ensureArray(objectValue(value.impact_classification).axes),
    ...ensureArray(objectValue(value.hal_signal_capsule).impact_axes)
  ]);
  const invalid = rawValues.filter(axis => !VALID_AXES.has(axis));
  return {
    rawValues,
    invalid,
    axes: rawValues.filter(axis => VALID_AXES.has(axis))
  };
}

function bucketImpactAxes(value = {}) {
  const bucket = normalizeEnum(firstText(
    value.relevance_bucket,
    value.relevanceBucket,
    objectValue(value.scope_count).relevance_bucket,
    objectValue(value.scope_relevance).relevance_bucket
  ));
  return BUCKET_IMPACT_AXES[bucket] || [];
}

function explicitReaderOwners(value = {}) {
  return unique([
    ...ensureArray(objectValue(value.hal_signal_capsule).reader_owners),
    ...ensureArray(value.reader_owners),
    ...ensureArray(value.readerOwners)
  ].flatMap(arrayFromCommaText)).map(normalizeEnum).filter(Boolean);
}

function readerOwnersForAxes(impactAxes = []) {
  return unique(ensureArray(impactAxes)
    .map(normalizeEnum)
    .flatMap(axis => AXIS_READER_OWNER_MAP[axis] || []));
}

function completeHalSignalCapsuleFromExistingFields(value = {}, options = {}) {
  const mode = options.mode || 'fallback_completion';
  const strictEditorRepair = mode === 'editor_deterministic_repair';
  const existing = normalizeHalSignalCapsule(value);
  if (existing.complete) {
    return {
      capsule: existing.capsule,
      complete: true,
      changed: false,
      reason_codes: []
    };
  }

  const reasonCodes = [];
  const raw = objectValue(value.hal_signal_capsule || value.halSignalCapsule);
  const normalized = strictEditorRepair ? null : normalizeHalSignalFields(value);
  const axisResult = strictEditorRepair ? explicitImpactAxisResult(value) : { invalid: [], axes: normalized.hal_impact_axes };
  if (axisResult.invalid.length > 0) reasonCodes.push('unknown_impact_axis');
  const impactAxes = axisResult.axes.length > 0
    ? axisResult.axes
    : strictEditorRepair
      ? bucketImpactAxes(value)
      : normalized.hal_impact_axes;
  if (impactAxes.length === 0) reasonCodes.push('unknown_impact_axis');

  const readerOwners = strictEditorRepair
    ? unique([
      ...explicitReaderOwners(value),
      ...readerOwnersForAxes(impactAxes)
    ])
    : unique([
      ...ensureArray(raw.reader_owners),
      ...ensureArray(value.reader_owners),
      ...normalized.reader_owners
    ].flatMap(arrayFromCommaText)).map(normalizeEnum).filter(Boolean);
  if (readerOwners.length === 0) reasonCodes.push('missing_reader_owner_mapping');

  const actionItems = ensureArray(articleSections(value).action_items).length > 0
    ? ensureArray(articleSections(value).action_items)
    : ensureArray(value.action_items);
  const concreteAction = actionItems.find(item => CONCRETE_TWO_WEEK_ACTION_PATTERN.test(text(item)));
  const fallbackAction = concreteAction || (strictEditorRepair ? '' : actionItems[0]);
  const checkWithinTwoWeeks = text(raw.check_within_2_weeks) ||
    text(fallbackAction) ||
    (strictEditorRepair ? '' : '2주 안에 camera owner를 지정해 stream, buffer, metadata, test 영향 여부를 확인합니다.');
  if (!checkWithinTwoWeeks) {
    reasonCodes.push(strictEditorRepair && actionItems.length > 0
      ? 'missing_concrete_two_week_check'
      : 'missing_action_items');
  }

  const datedSources = sourceDateValues(value);
  const whyNow = text(raw.why_now) || (datedSources.length > 0
    ? `Source date ${datedSources[0]} provides the dated context for this HAL validation signal.`
    : strictEditorRepair
      ? ''
      : `${value.headline || value.category || '이 출처'}는 날짜가 확인된 HAL 검토 신호로 포함했습니다.`);
  if (!whyNow) reasonCodes.push('missing_why_now_context');

  const doNotOverstate = strictEditorRepair
    ? unique([
      ...ensureArray(raw.do_not_overstate),
      ...ensureArray(value.do_not_overstate)
    ])
    : unique([
      ...ensureArray(raw.do_not_overstate),
      ...ensureArray(value.do_not_overstate),
      ...ensureArray(value.overclaim_guardrails),
      ...ensureArray(value.fallback_guard_notes)
    ]);

  const capsule = {
    why_now: whyNow,
    reader_owners: readerOwners,
    check_within_2_weeks: checkWithinTwoWeeks,
    impact_axes: impactAxes,
    do_not_overstate: doNotOverstate.length > 0
      ? doNotOverstate
      : [strictEditorRepair ? CONSERVATIVE_DO_NOT_OVERSTATE : FALLBACK_DO_NOT_OVERSTATE]
  };
  const completed = normalizeHalSignalCapsule({ hal_signal_capsule: capsule });
  if (!completed.complete) reasonCodes.push(...completed.missing_keys.map(key => `missing_${key}`));

  return {
    capsule: completed.capsule,
    complete: completed.complete && reasonCodes.length === 0,
    changed: true,
    reason_codes: unique(reasonCodes)
  };
}

function normalizeHalSignalFields(value = {}) {
  const axes = inferHalImpactAxes(value);
  const actionability = resolveActionability(value);
  const actionabilityLevel = actionability.actionability_level;
  const effectiveActionabilityLevel = actionability.effective_actionability_level;
  const status = inferSignalQualityStatus(value, axes, effectiveActionabilityLevel);
  const readerOwners = inferReaderOwners(value, axes);
  const doNotOverstate = normalizeDoNotOverstate(value);
  const fallbackPromotionAllowed = inferFallbackPromotionAllowed(value, axes, effectiveActionabilityLevel);
  const fallbackPromotionReason = inferFallbackPromotionReason(value);
  const fallbackGuardNotes = inferFallbackGuardNotes(value);
  const socSignalType = inferSocSignalType(value);
  const socSignalSourceAllowed = inferSocSignalSourceAllowed(value);
  const cameraPipelineLink = inferCameraPipelineLink(value);
  const concreteActionSignalCount = actionability.concrete_action_signal_count;
  const bucket = normalizeEnum(firstText(value.relevance_bucket, value.relevanceBucket, objectValue(value.scope_count).relevance_bucket));
  const hardBlockers = [];

  if (!hasNonReferenceAxis(axes)) hardBlockers.push('missing_hal_impact_axis');
  if (effectiveActionabilityLevel === 'none') hardBlockers.push('actionability_none');
  if (actionabilityLevel === 'generic_review' && effectiveActionabilityLevel === 'generic_review') {
    hardBlockers.push('generic_review_actionability');
  }
  if (['cpp_ai_tooling_fallback', 'generic_tech_watchlist', 'soc_platform_signal'].includes(bucket) &&
    (fallbackPromotionAllowed !== true || !fallbackPromotionReason)) {
    hardBlockers.push('fallback_promotion_missing_reason');
  }
  if (bucket === 'soc_platform_signal' && !cameraPipelineLink) {
    hardBlockers.push('soc_platform_missing_camera_pipeline_link');
  }

  return {
    hal_impact_axes: axes,
    reader_owners: readerOwners,
    actionability_level: actionabilityLevel,
    effective_actionability_level: effectiveActionabilityLevel,
    actionability_upgrade_reason: actionability.actionability_upgrade_reason,
    actionability_upgrade_evidence: actionability.actionability_upgrade_evidence,
    signal_quality_status: status,
    signal_quality_notes: unique([
      status === 'watchlist_only' ? 'No non-reference HAL signal axis is present.' : '',
      actionabilityLevel === 'generic_review' && effectiveActionabilityLevel === 'generic_review'
        ? 'Actionability remains generic unless at least two concrete signals are present.'
        : '',
      actionability.actionability_upgrade_reason,
      ...hardBlockers
    ]),
    do_not_overstate: doNotOverstate,
    fallback_promotion_allowed: fallbackPromotionAllowed,
    fallback_promotion_reason: fallbackPromotionReason,
    fallback_guard_notes: fallbackGuardNotes,
    soc_signal_type: socSignalType,
    soc_signal_source_allowed: socSignalSourceAllowed,
    camera_pipeline_link: cameraPipelineLink,
    has_non_reference_hal_axis: hasNonReferenceAxis(axes),
    concrete_action_signal_count: concreteActionSignalCount,
    hal_signal_hard_blockers: unique(hardBlockers)
  };
}

function hardBlockerReasonCodes(blockers = [], capsule = {}) {
  const codes = ensureArray(blockers)
    .map(blocker => HARD_BLOCKER_REASON_CODE_BY_BLOCKER[normalizeEnum(blocker)] || normalizeEnum(blocker))
    .filter(Boolean);
  if (capsule.present === false) codes.push('hal_signal_capsule_missing');
  else if (capsule.complete === false) codes.push('hal_signal_capsule_incomplete');
  return unique(codes);
}

function countBy(values) {
  return ensureArray(values).reduce((counts, value) => {
    const key = text(value) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function buildMainArticleSignalChecks(articles = []) {
  return ensureArray(articles).map((article, index) => {
    const normalized = normalizeHalSignalFields(article);
    const capsule = normalizeHalSignalCapsule(article);
    return {
      index: index + 1,
      title: firstText(article.headline, article.title, article.category, `article ${index + 1}`),
      url: sourceUrls(article)[0] || '',
      relevance_bucket: firstText(article.relevance_bucket, article.relevanceBucket, objectValue(article.scope_count).relevance_bucket) || 'unknown',
      hal_impact_axes: normalized.hal_impact_axes,
      reader_owners: normalized.reader_owners,
      actionability_level: normalized.actionability_level,
      effective_actionability_level: normalized.effective_actionability_level,
      actionability_upgrade_reason: normalized.actionability_upgrade_reason,
      signal_quality_status: normalized.signal_quality_status,
      concrete_action_signal_count: normalized.concrete_action_signal_count,
      fallback_promotion_allowed: normalized.fallback_promotion_allowed,
      fallback_promotion_reason: normalized.fallback_promotion_reason,
      fallback_guard_notes: normalized.fallback_guard_notes,
      soc_signal_type: normalized.soc_signal_type,
      soc_signal_source_allowed: normalized.soc_signal_source_allowed,
      camera_pipeline_link: normalized.camera_pipeline_link,
      has_hal_signal_capsule: capsule.present,
      hal_signal_capsule_complete: capsule.complete,
      hal_signal_capsule_missing_keys: capsule.missing_keys,
      hard_blockers: normalized.hal_signal_hard_blockers,
      hard_blocker_reason_codes: hardBlockerReasonCodes(normalized.hal_signal_hard_blockers, capsule)
    };
  });
}

function buildHalSignalQualitySummary(articles = []) {
  const checks = buildMainArticleSignalChecks(articles);
  const axes = checks.flatMap(check => check.hal_impact_axes);
  return {
    schema_version: HAL_SIGNAL_SCHEMA_VERSION,
    main_article_count: checks.length,
    strong_signal_count: checks.filter(check => check.signal_quality_status === 'strong_signal').length,
    usable_signal_count: checks.filter(check => check.signal_quality_status === 'usable_signal').length,
    weak_signal_count: checks.filter(check => check.signal_quality_status === 'weak_signal').length,
    watchlist_only_count: checks.filter(check => check.signal_quality_status === 'watchlist_only').length,
    blocked_source_gap_count: checks.filter(check => check.signal_quality_status === 'blocked_source_gap').length,
    article_count_with_hal_signal_capsule: checks.filter(check => check.has_hal_signal_capsule).length,
    article_count_without_hal_signal_capsule: checks.filter(check => !check.has_hal_signal_capsule).length,
    main_articles_with_owner_metric_log: checks.filter(check => check.effective_actionability_level === 'owner_metric_log').length,
    main_articles_with_concrete_action: checks.filter(check =>
      ['concrete_check', 'measurable_test', 'owner_metric_log'].includes(check.effective_actionability_level)
    ).length,
    fallback_main_article_count: checks.filter(check =>
      ['cpp_ai_tooling_fallback', 'soc_platform_signal', 'generic_tech_watchlist'].includes(normalizeEnum(check.relevance_bucket))
    ).length,
    android_multimedia_camera_output_count: checks.filter(check => normalizeEnum(check.relevance_bucket) === 'android_multimedia_camera_output').length,
    soc_platform_signal_count: checks.filter(check => normalizeEnum(check.relevance_bucket) === 'soc_platform_signal').length,
    generic_signal_hard_blocker_count: checks.filter(check => check.hard_blockers.length > 0).length,
    hal_signal_hard_blocker_count: checks.filter(check => ensureArray(check.hard_blocker_reason_codes).length > 0).length,
    hard_blocker_reason_code_counts: countBy(checks.flatMap(check => ensureArray(check.hard_blocker_reason_codes))),
    hal_impact_axis_counts: countBy(axes),
    actionability_level_counts: countBy(checks.map(check => check.actionability_level)),
    effective_actionability_level_counts: countBy(checks.map(check => check.effective_actionability_level)),
    signal_quality_status_counts: countBy(checks.map(check => check.signal_quality_status))
  };
}

function normalizeShortageHintDetail(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      bucket: firstText(value.bucket, value.relevance_bucket) || 'unknown',
      severity: firstText(value.severity) || 'medium',
      reason_code: firstText(value.reason_code, value.code) || 'selection_shortage',
      affected_sources: unique(ensureArray(value.affected_sources)),
      recommended_fix: firstText(value.recommended_fix, value.fix, value.message, value.reason) || 'Review source parser coverage and candidate eligibility.'
    };
  }
  const raw = text(value);
  const lowerRaw = raw.toLowerCase();
  let bucket = 'unknown';
  if (lowerRaw.includes('direct_aosp_camera')) bucket = 'direct_aosp_camera';
  else if (lowerRaw.includes('camera_driver_image_pipeline')) bucket = 'camera_driver_image_pipeline';
  else if (lowerRaw.includes('android_multimedia_camera_output')) bucket = 'android_multimedia_camera_output';
  else if (lowerRaw.includes('soc_platform_signal')) bucket = 'soc_platform_signal';
  else if (lowerRaw.includes('cpp_ai_tooling_fallback')) bucket = 'cpp_ai_tooling_fallback';
  let reasonCode = 'selection_shortage';
  if (/camerax|release note|version|anchor/i.test(raw)) reasonCode = 'camerax_release_note_parser_missing_version_or_anchor';
  else if (/source gap|dated evidence|rolling/i.test(raw)) reasonCode = 'dated_evidence_source_gap';
  return {
    bucket,
    severity: /0|missing|none|gap|fail/i.test(raw) ? 'high' : 'medium',
    reason_code: reasonCode,
    affected_sources: [],
    recommended_fix: raw || 'Review source parser coverage and candidate eligibility.'
  };
}

function buildSelectionShortageHintDetails(...sources) {
  return ensureArray(sources)
    .flatMap(source => [
      ...ensureArray(source?.selection_shortage_hint_details),
      ...ensureArray(source?.selection_shortage_hints),
      ...ensureArray(source?.candidate_shortage_hints)
    ])
    .filter(value => text(value))
    .map(normalizeShortageHintDetail);
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(value => String(value ?? '').replace(/\|/g, '\\|') || 'none').join(' | ')} |`)
  ].join('\n');
}

function renderHalSignalQualityMarkdown(report = {}) {
  const summary = objectValue(report.hal_signal_quality_summary);
  const checks = ensureArray(report.main_article_signal_checks);
  const inputs = objectValue(report.inputs);
  const rows = checks.map(check => [
    check.index,
    check.title,
    check.signal_quality_status,
    check.actionability_level,
    check.effective_actionability_level,
    ensureArray(check.hal_impact_axes).join(', ') || 'none',
    check.has_hal_signal_capsule === true ? 'yes' : 'no',
    ensureArray(check.hard_blocker_reason_codes).join(', ') || 'none'
  ]);
  return `# HAL Signal Quality Report - ${report.date || 'unknown'}

## Gate Boundary

- status: ${report.status || 'UNKNOWN'}
- input_completeness: ${report.input_completeness || 'unknown'}
- HAL signal checks are observability only; quality status does not gate on them: true
- hal_signal_capsule enforced by the editor output contract (validateHalSignalCapsules): true
- review artifacts preserved: true

## Inputs

- missing required: ${ensureArray(inputs.missing_required).join(', ') || 'none'}
- optional input_unavailable: ${ensureArray(inputs.unavailable_optional).join(', ') || 'none'}

## Summary

- main_article_count: ${summary.main_article_count ?? 0}
- strong_signal_count: ${summary.strong_signal_count ?? 0}
- usable_signal_count: ${summary.usable_signal_count ?? 0}
- weak_signal_count: ${summary.weak_signal_count ?? 0}
- watchlist_only_count: ${summary.watchlist_only_count ?? 0}
- blocked_source_gap_count: ${summary.blocked_source_gap_count ?? 0}
- article_count_with_hal_signal_capsule: ${summary.article_count_with_hal_signal_capsule ?? 0}
- article_count_without_hal_signal_capsule: ${summary.article_count_without_hal_signal_capsule ?? 0}
- android_multimedia_camera_output_count: ${summary.android_multimedia_camera_output_count ?? 0}
- soc_platform_signal_count: ${summary.soc_platform_signal_count ?? 0}
- generic_signal_hard_blocker_count: ${summary.generic_signal_hard_blocker_count ?? 0}
- hal_signal_hard_blocker_count: ${summary.hal_signal_hard_blocker_count ?? 0}
- hard_blocker_reason_code_counts: ${JSON.stringify(summary.hard_blocker_reason_code_counts || {})}
- hal_impact_axis_counts: ${JSON.stringify(summary.hal_impact_axis_counts || {})}
- actionability_level_counts: ${JSON.stringify(summary.actionability_level_counts || {})}
- effective_actionability_level_counts: ${JSON.stringify(summary.effective_actionability_level_counts || {})}
- signal_quality_status_counts: ${JSON.stringify(summary.signal_quality_status_counts || {})}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

${rows.length > 0
    ? markdownTable(['#', 'Article', 'signal_quality_status', 'actionability_level', 'effective_actionability_level', 'hal_impact_axes', 'capsule', 'hard_blocker_reason_codes'], rows)
    : '- none'}
`;
}

module.exports = {
  ACTIONABILITY_LEVELS,
  CAPSULE_REQUIRED_FIELDS,
  HAL_IMPACT_AXES,
  HAL_SIGNAL_SCHEMA_VERSION,
  SIGNAL_QUALITY_STATUSES,
  actionabilityEvidenceText,
  countActionabilityUpgradeSignals,
  buildHalSignalQualitySummary,
  buildMainArticleSignalChecks,
  buildSelectionShortageHintDetails,
  countConcreteActionSignals,
  ensureArray,
  inferActionabilityLevel,
  inferEffectiveActionabilityLevel,
  inferHalImpactAxes,
  hardBlockerReasonCodes,
  canonicalizeHalSignalCapsule,
  completeHalSignalCapsuleFromExistingFields,
  normalizeHalSignalCapsule,
  normalizeHalSignalFields,
  isCompleteHalSignalCapsule,
  renderHalSignalQualityMarkdown
};
