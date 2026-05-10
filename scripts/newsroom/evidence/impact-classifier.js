const { FETCH_STATUSES } = require('./linked-evidence-types');

const IMPACT_TYPES = Object.freeze({
  BUILD_DEPENDENCY_FIX: 'build_dependency_fix',
  RUNTIME_BEHAVIOR_CHANGE: 'runtime_behavior_change',
  CAMERA_API_CHANGE: 'camera_api_change',
  IMAGE_CAPTURE_FIX: 'image_capture_fix',
  VIDEO_CAPTURE_FIX: 'video_capture_fix',
  DEVICE_QUIRK_FIX: 'device_quirk_fix',
  TEST_ONLY_CHANGE: 'test_only_change',
  DOCUMENTATION_ONLY: 'documentation_only',
  SECURITY_COMPONENT_CAMERA_RELATED: 'security_component_camera_related',
  GENERIC_TOOLING_CHANGE: 'generic_tooling_change',
  UNKNOWN: 'unknown'
});

const IMPACT_TYPE_VALUES = Object.freeze(Object.values(IMPACT_TYPES));

const RECOMMENDED_ARTICLE_TYPES = Object.freeze({
  MAIN: 'main',
  WATCH: 'watch',
  UNKNOWN: 'unknown'
});

const NON_CONTENT_FETCH_STATUSES = new Set([
  FETCH_STATUSES.SKIPPED,
  FETCH_STATUSES.BLOCKED,
  FETCH_STATUSES.FAILED,
  FETCH_STATUSES.UNSUPPORTED
]);

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function includesAny(value, patterns) {
  return patterns.some(pattern => pattern.test(value));
}

function rounded(value) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function uniqueWarnings(values) {
  return [...new Set(ensureArray(values).map(text).filter(Boolean))];
}

function candidateEvidenceText(candidate = {}) {
  return [
    candidate.title,
    candidate.summary,
    candidate.description,
    candidate.version_or_release,
    candidate.api_or_component,
    candidate.behavior_change,
    candidate.reason,
    candidate.collection_reason,
    candidate.relevance_reason,
    candidate.section,
    candidate.source_section,
    candidate.category,
    candidate.source_category,
    candidate.source_kind,
    candidate.collectionMode,
    candidate.collection_mode
  ].map(text).join(' ');
}

function resolvedEvidenceText(evidenceItems = []) {
  return ensureArray(evidenceItems)
    .filter(item => item && item.fetch_status === FETCH_STATUSES.RESOLVED)
    .map(item => {
      const resolved = item.resolved || {};
      return [
        item.identifier,
        item.source_text,
        resolved.title,
        resolved.summary,
        resolved.component,
        resolved.test_info,
        ...ensureArray(resolved.changed_files),
        ...ensureArray(resolved.bug_ids),
        ...ensureArray(resolved.cve_ids),
        ...ensureArray(resolved.labels)
      ].map(text).join(' ');
    })
    .join(' ');
}

function unresolvedWarnings(evidenceItems = []) {
  const statuses = new Set();
  for (const item of ensureArray(evidenceItems)) {
    if (NON_CONTENT_FETCH_STATUSES.has(item?.fetch_status)) {
      statuses.add(item.fetch_status);
    }
  }
  return [...statuses].map(status => `linked_evidence_${status}`);
}

function hasCandidateRuntimePipelineEvidence(candidateText) {
  const explicitPipelineComponent = includesAny(candidateText, [
    /\bCameraPipe\b/i,
    /\bImageCapture\b/i,
    /\bImageAnalysis\b/i,
    /\bVideoCapture\b/i,
    /\bimage pipeline\b/i,
    /\bcamera pipeline\b/i,
    /\bcamera request\b/i,
    /\bcamera result\b/i,
    /\bcapture request\b/i,
    /\bcapture result\b/i
  ]);
  const cameraContext = includesAny(candidateText, [
    /\bCamera\s*HAL\b/i,
    /\bcamera\s*provider\b/i,
    /\bCameraX\b/i,
    /\bandroidx\.camera\b/i,
    /\bCamera2\b/i,
    /\bcamera\b/i,
    /\bcapture\b/i,
    /\bpreview\b/i
  ]);
  const genericRuntimeTerm = includesAny(candidateText, [
    /\bcamera metadata\b/i,
    /\bmetadata (?:handling|behavior|stream|buffer|request|result)\b/i,
    /\bstream\b/i,
    /\bbuffer\b/i,
    /\bSurface\b/i
  ]);
  return explicitPipelineComponent || (cameraContext && genericRuntimeTerm);
}

function hasCandidateRuntimeMainEvidence(candidateText) {
  const explicitCameraStack = includesAny(candidateText, [
    /\bCamera\s*HAL\b/i,
    /\bcamera\s*provider\b/i,
    /\bcamera3\b/i,
    /\bICamera\w*\b/i,
    /\bAOSP Camera\b/i,
    /\bAndroid Camera\b/i,
    /\blibcamera\b/i,
    /\bV4L2\b/i,
    /\bISP\b/i,
    /\bimage sensor\b/i
  ]);
  const cameraContext = includesAny(candidateText, [
    /\bCameraX\b/i,
    /\bandroidx\.camera\b/i,
    /\bCamera2\b/i,
    /\bcamera\b/i,
    /\bcapture\b/i,
    /\bpreview\b/i
  ]);
  const runtimeContext = hasCandidateRuntimePipelineEvidence(candidateText);
  const changeSignal = includesAny(candidateText, [
    /\badd(?:ed|s)?\b/i,
    /\bchange(?:d|s)?\b/i,
    /\bfix(?:ed|es)?\b/i,
    /\bupdate(?:d|s)?\b/i,
    /\bimprove(?:d|s|ment)?\b/i,
    /\bsupport(?:ed|s)?\b/i,
    /\bbehavior\b/i,
    /\bcompatibility\b/i,
    /\bAPI\b/i,
    /\bruntime\b/i,
    /\brequest\b/i,
    /\bresult\b/i,
    /\bcapture\b/i
  ]);
  return (explicitCameraStack || (cameraContext && runtimeContext)) && changeSignal;
}

function classifyImpactType(candidateText, combinedText, hasMainEvidence, hasRuntimePipelineEvidence) {
  const documentationOnly = includesAny(candidateText, [
    /\bdocumentation(?:_page)?\b/i,
    /\bdocumentation-watch\b/i,
    /\breference[_ -]?only\b/i,
    /\bdocs?\b/i,
    /\bguide\b/i,
    /\breference page\b/i
  ]);
  if (documentationOnly && !hasRuntimePipelineEvidence) return IMPACT_TYPES.DOCUMENTATION_ONLY;

  const buildTooling = includesAny(combinedText, [
    /\bGradle\b/i,
    /\bMaven\b/i,
    /\bdependency\b/i,
    /\bBazel\b/i,
    /\bCMake\b/i,
    /\bSoong\b/i,
    /\bAndroid\.bp\b/i,
    /\bbuild\b/i
  ]);
  if (buildTooling && !hasRuntimePipelineEvidence) return IMPACT_TYPES.BUILD_DEPENDENCY_FIX;

  const testOnly = includesAny(combinedText, [
    /\btest(?:s|ing)?\b/i,
    /\bCTS\b/i,
    /\bVTS\b/i,
    /\bCamera ITS\b/i,
    /\bJUnit\b/i,
    /\bgtest\b/i,
    /\bunit test\b/i
  ]);
  if (testOnly && !hasRuntimePipelineEvidence) return IMPACT_TYPES.TEST_ONLY_CHANGE;

  const genericTooling = includesAny(combinedText, [
    /\bC\+\+\b/i,
    /\bLLVM\b/i,
    /\bClang\b/i,
    /\bGCC\b/i,
    /\bNDK\b/i,
    /\btoolchain\b/i,
    /\bdeveloper tooling\b/i,
    /\bCI\b/i
  ]);
  if (genericTooling && !hasRuntimePipelineEvidence) return IMPACT_TYPES.GENERIC_TOOLING_CHANGE;

  if (
    includesAny(combinedText, [/\bCVE-\d{4}-\d{4,}\b/i, /\bsecurity\b/i, /\bvulnerabilit/i, /\bbulletin\b/i]) &&
    includesAny(candidateText, [/\bcamera\b/i, /\bCameraX\b/i, /\bCamera2\b/i, /\bCamera HAL\b/i, /\bandroidx\.camera\b/i])
  ) {
    return IMPACT_TYPES.SECURITY_COMPONENT_CAMERA_RELATED;
  }

  if (includesAny(combinedText, [/\bquirk\b/i, /\bdevice[- ]specific\b/i, /\bdevice bug\b/i, /\bvendor\b/i])) {
    return IMPACT_TYPES.DEVICE_QUIRK_FIX;
  }

  if (includesAny(combinedText, [/\bVideoCapture\b/i, /\bvideo capture\b/i, /\brecord(?:er|ing)?\b/i])) {
    return IMPACT_TYPES.VIDEO_CAPTURE_FIX;
  }

  if (includesAny(combinedText, [/\bImageCapture\b/i, /\bImageAnalysis\b/i, /\bstill capture\b/i, /\bRAW(?:10|12|14)?\b/i, /\bYUV\b/i, /\bJPEG\b/i, /\bUltra HDR\b/i])) {
    return IMPACT_TYPES.IMAGE_CAPTURE_FIX;
  }

  if (includesAny(combinedText, [/\bCameraX\b/i, /\bCamera2\b/i, /\bandroidx\.camera\b/i, /\bcamera API\b/i, /\bAPI\b/i])) {
    return IMPACT_TYPES.CAMERA_API_CHANGE;
  }

  if (hasMainEvidence) return IMPACT_TYPES.RUNTIME_BEHAVIOR_CHANGE;

  if (genericTooling) {
    return IMPACT_TYPES.GENERIC_TOOLING_CHANGE;
  }

  return IMPACT_TYPES.UNKNOWN;
}

function defaultImpactClassification() {
  return {
    impact_type: IMPACT_TYPES.UNKNOWN,
    hal_runtime_impact: false,
    camera_pipeline_impact: false,
    recommended_article_type: RECOMMENDED_ARTICLE_TYPES.UNKNOWN,
    confidence: 0,
    reason: 'No linked evidence impact signal was classified.',
    warnings: []
  };
}

function classifyLinkedEvidenceImpact(candidate = {}, evidenceItems = []) {
  const candidateText = candidateEvidenceText(candidate);
  const resolvedText = resolvedEvidenceText(evidenceItems);
  const combinedText = `${candidateText} ${resolvedText}`;
  const hasMainEvidence = hasCandidateRuntimeMainEvidence(candidateText);
  const hasRuntimePipelineEvidence = hasCandidateRuntimePipelineEvidence(candidateText);
  const impactType = classifyImpactType(candidateText, combinedText, hasMainEvidence, hasRuntimePipelineEvidence);
  const warnings = unresolvedWarnings(evidenceItems);

  const halRuntimeImpact = hasMainEvidence && ![
    IMPACT_TYPES.BUILD_DEPENDENCY_FIX,
    IMPACT_TYPES.TEST_ONLY_CHANGE,
    IMPACT_TYPES.DOCUMENTATION_ONLY,
    IMPACT_TYPES.GENERIC_TOOLING_CHANGE,
    IMPACT_TYPES.UNKNOWN
  ].includes(impactType);
  const cameraPipelineImpact = hasMainEvidence && includesAny(candidateText, [
    /\bimage pipeline\b/i,
    /\bcamera pipeline\b/i,
    /\bCameraPipe\b/i,
    /\bImageCapture\b/i,
    /\bImageAnalysis\b/i,
    /\bVideoCapture\b/i,
    /\bstream\b/i,
    /\bbuffer\b/i,
    /\bmetadata\b/i,
    /\bISP\b/i,
    /\blibcamera\b/i,
    /\bV4L2\b/i
  ]);
  const mainEligibleImpact = hasMainEvidence && ![
    IMPACT_TYPES.BUILD_DEPENDENCY_FIX,
    IMPACT_TYPES.TEST_ONLY_CHANGE,
    IMPACT_TYPES.DOCUMENTATION_ONLY,
    IMPACT_TYPES.GENERIC_TOOLING_CHANGE,
    IMPACT_TYPES.UNKNOWN
  ].includes(impactType);

  const recommendedArticleType = mainEligibleImpact
    ? RECOMMENDED_ARTICLE_TYPES.MAIN
    : impactType === IMPACT_TYPES.UNKNOWN
      ? RECOMMENDED_ARTICLE_TYPES.UNKNOWN
      : RECOMMENDED_ARTICLE_TYPES.WATCH;

  if (!hasMainEvidence && recommendedArticleType !== RECOMMENDED_ARTICLE_TYPES.MAIN) {
    warnings.push('main_hint_requires_candidate_runtime_evidence');
  }

  const evidenceCount = ensureArray(evidenceItems).length;
  const confidence = impactType === IMPACT_TYPES.UNKNOWN
    ? 0
    : hasMainEvidence ? 0.75 : evidenceCount > 0 ? 0.45 : 0.35;
  const reason = impactType === IMPACT_TYPES.UNKNOWN
    ? 'No explicit candidate-level HAL/runtime/camera pipeline impact signal was found.'
    : `${impactType} classified from candidate text${resolvedText ? ' and resolved linked evidence metadata' : ''}.`;

  return {
    impact_type: IMPACT_TYPE_VALUES.includes(impactType) ? impactType : IMPACT_TYPES.UNKNOWN,
    hal_runtime_impact: bool(halRuntimeImpact),
    camera_pipeline_impact: bool(cameraPipelineImpact),
    recommended_article_type: recommendedArticleType,
    confidence: rounded(confidence),
    reason,
    warnings: uniqueWarnings(warnings)
  };
}

module.exports = {
  IMPACT_TYPES,
  IMPACT_TYPE_VALUES,
  RECOMMENDED_ARTICLE_TYPES,
  classifyLinkedEvidenceImpact,
  defaultImpactClassification
};
