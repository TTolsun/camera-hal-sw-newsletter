const { ensureArray } = require('../../shared/common/value-coercion');
const {
  BUCKETS,
  classifyAospCameraStackCandidate,
  canonicalBucket
} = require('../../shared/domain/aosp-camera-scope');
const { normalizeArticleSections } = require('./article-section-contract');

const GUARDRAIL_IMPACT_CLASSES = Object.freeze({
  DIRECT_HAL_CONTRACT: 'direct_hal_contract',
  CAMERA_STACK_SOURCE: 'camera_stack_source',
  FRAMEWORK_ADJACENT: 'framework_adjacent',
  TOOLING_SUPPORT: 'tooling_support',
  WATCH_ONLY: 'watch_only'
});

const OVERLAP_THRESHOLD = 0.7;
const MAX_FRAGMENT_LENGTH = 180;
const RAW_ARTIFACT_PATTERNS = Object.freeze([
  {
    id: 'android-developers-release-table-ui',
    pattern: /\bView the [^.]{0,120}?\bClose\b/gi
  },
  {
    id: 'androidx-maven-group-table',
    pattern: /\b(?:Maven Group versions?|This library was last updated on:)[\s\S]*?(?:Close|vers\b|$)/gi
  },
  {
    id: 'module-version-table-dump',
    pattern: /\bcamera-[a-z0-9-]+\s+(?:-|\d+\.\d+\S*)\s+(?:-|\d+\.\d+\S*)\s+(?:-|\d+\.\d+\S*)\b/gi
  },
  {
    id: 'html-tag-fragment',
    pattern: /<\/?[a-z][^>]*>/gi
  },
  {
    id: 'truncated-version-table-tail',
    pattern: /\.\.\.\s*vers\b|\bvers\s*$/gi
  }
]);

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function compactText(value, max = 420) {
  const raw = text(value).replace(/\s+/g, ' ').trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function firstText(...values) {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return '';
}

function unique(values) {
  const seen = new Set();
  const output = [];
  for (const value of values.map(text).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function candidateBody(candidate = {}) {
  return [
    candidate.title,
    candidate.summary,
    candidate.behavior_change,
    candidate.what_changed,
    candidate.api_or_component,
    candidate.version_or_release,
    candidate.source_extraction,
    candidate.relevance_bucket,
    candidate.relevance_reason,
    candidate.collection_reason
  ].map(text).join(' ');
}

function extractionSections(candidate = {}) {
  return [
    ...(Array.isArray(candidate?.source_extraction?.release?.sections) ? candidate.source_extraction.release.sections : []),
    ...(Array.isArray(candidate?.source_extraction?.minor_line_context?.sections) ? candidate.source_extraction.minor_line_context.sections : [])
  ];
}

function sourceExtractionBullet(candidate = {}) {
  for (const section of extractionSections(candidate)) {
    for (const item of ensureArray(section?.items)) {
      const value = firstText(item?.text, item?.source_text);
      if (value) return value;
    }
  }
  return '';
}

function hasDirectCameraPipelineEvidence(candidate = {}) {
  return /\b(?:ISP|image sensor|camera pipeline|MIPI|CSI|V4L2|camera driver|image pipeline|camera)\b/i
    .test(candidateBody(candidate));
}

function candidateBucket(candidate = {}) {
  const classified = classifyAospCameraStackCandidate(candidate);
  return firstText(candidate.relevance_bucket, candidate.relevanceBucket, classified.relevance_bucket);
}

function publishedDate(candidate = {}) {
  return firstText(candidate.source_extraction?.release?.date, candidate.published_date, candidate.publishedDate, candidate.published_at, candidate.date, candidate.updated_at);
}

function componentText(candidate = {}) {
  return firstText(candidate.source_extraction?.release?.component, candidate.component, candidate.api_or_component, candidate.apiOrComponent, candidate.source_section, candidate.source);
}

function versionText(candidate = {}) {
  const direct = firstText(candidate.source_extraction?.release?.version, candidate.version_or_release, candidate.versionOrRelease, candidate.version, candidate.release);
  if (direct) return direct;
  const title = text(candidate.title);
  const match = title.match(/\b(?:v)?\d+\.\d+(?:\.\d+)?(?:[-.](?:alpha|beta|rc)\d*)?\b/i);
  return match ? match[0] : '';
}

function fallbackBehavior(candidate = {}) {
  const component = componentText(candidate);
  const version = versionText(candidate);
  const title = firstText(candidate.title, candidate.headline, component || 'candidate');
  if (/CameraX|androidx\.camera|camera-/i.test(candidateBody(candidate))) {
    return compactText(`CameraX / androidx.camera ${version ? `${version} ` : ''}업데이트입니다. 대상: ${component || title}.`);
  }
  if (/libcamera|V4L2|sensor|ISP|pipeline/i.test(candidateBody(candidate))) {
    return compactText(`${title}는 camera driver 또는 image pipeline 관련 변경입니다.`);
  }
  if (candidateBucket(candidate) === BUCKETS.CPP_AI_TOOLING_FALLBACK) {
    return compactText(`${title}는 camera stack 팀이 관찰할 native tooling 또는 workflow 신호입니다.`);
  }
  return compactText(`${title}는 camera-stack relevance metadata가 있는 후보입니다.`);
}

function replaceAndRecord(raw, pattern, id, removedFragments) {
  return raw.replace(pattern, match => {
    const fragment = compactText(match, MAX_FRAGMENT_LENGTH);
    if (fragment) removedFragments.push({ id, text: fragment });
    return ' ';
  });
}

function cleanBehaviorChange(candidate = {}) {
  const removedFragments = [];
  const warnings = [];
  let value = firstText(
    sourceExtractionBullet(candidate),
    candidate.what_changed,
    candidate.behavior_change,
    candidate.behaviorChange,
    candidate.summary,
    candidate.reason,
    candidate.collection_reason,
    candidate.title
  );
  const original = value;

  for (const entry of RAW_ARTIFACT_PATTERNS) {
    value = replaceAndRecord(value, entry.pattern, entry.id, removedFragments);
  }

  const cameraModuleCount = (original.match(/\bcamera-[a-z0-9-]+\b/gi) || []).length;
  const dashTableCount = (original.match(/\s-\s-/g) || []).length;
  if (cameraModuleCount >= 3 || dashTableCount >= 2) {
    warnings.push('raw_module_table_removed');
    value = value.replace(/\bcamera-[a-z0-9-]+(?:\s+(?:-|\d+\S*)){1,5}/gi, ' ');
  }
  if (removedFragments.length > 0) warnings.push('raw_ui_or_table_artifact_removed');

  value = compactText(value.replace(/\s+/g, ' ').trim());
  if (!value || value.length < 24 || removedFragments.length > 0 && value.length < 60) {
    value = fallbackBehavior(candidate);
    warnings.push('behavior_fallback_from_metadata');
  }

  return {
    text: value,
    removed_fragments: removedFragments,
    warnings: unique(warnings)
  };
}

// android 로 합쳐지기 전 이름이나 relevance 점수만 들고 오는 호출부가 있다.
// 셋 중 하나라도 있으면 그 근거로 본다.
function hasSocEvidence(candidate = {}) {
  return candidate.counts_as_soc_topic === true ||
    candidate.relevance_bucket === 'soc_platform_signal' ||
    Number(candidate.soc_platform_relevance || 0) > 0;
}

function hasMultimediaOutputEvidence(candidate = {}) {
  return candidate.relevance_bucket === 'android_multimedia_camera_output' ||
    Number(candidate.multimedia_camera_output_relevance || 0) > 0;
}

function inferGuardrailImpactClass(candidate = {}) {
  const explicit = text(candidate.guardrail_impact_class || candidate.guardrailImpactClass);
  if (Object.values(GUARDRAIL_IMPACT_CLASSES).includes(explicit)) return explicit;

  // 옛 버킷 이름이 그대로 들어오는 호출부가 있어 한 번 접는다.
  const bucket = canonicalBucket(candidateBucket(candidate));
  const directness = Number(candidate.aosp_camera_directness || 0);
  if (bucket === BUCKETS.DIRECT_AOSP_CAMERA) {
    return directness >= 3 ? GUARDRAIL_IMPACT_CLASSES.DIRECT_HAL_CONTRACT : GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT;
  }
  if (bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE) return GUARDRAIL_IMPACT_CLASSES.CAMERA_STACK_SOURCE;
  if (bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK) return GUARDRAIL_IMPACT_CLASSES.TOOLING_SUPPORT;
  // SoC 근거로 android 에 들어온 항목은 카메라 파이프라인 근거가 있을 때만 stack source 다.
  // 버킷이 합쳐졌으므로 버킷 이름이 아니라 분류가 남긴 근거 종류를 본다.
  if (hasSocEvidence(candidate)) {
    return hasDirectCameraPipelineEvidence(candidate)
      ? GUARDRAIL_IMPACT_CLASSES.CAMERA_STACK_SOURCE
      : GUARDRAIL_IMPACT_CLASSES.WATCH_ONLY;
  }
  if (bucket === BUCKETS.ANDROID) return GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT;
  return GUARDRAIL_IMPACT_CLASSES.WATCH_ONLY;
}

function buildConfirmedFacts(candidate = {}) {
  const facts = [];
  const source = firstText(candidate.source, candidate.source_name, candidate.sourceTitle, 'Source');
  const date = publishedDate(candidate);
  const version = versionText(candidate);
  const component = componentText(candidate);
  const cleaned = cleanBehaviorChange(candidate);

  if (date) facts.push(`${source}가 ${date}에 게시 또는 업데이트한 항목입니다.`);
  else facts.push(`${source} 항목이며, 추가 날짜 claim은 생성하지 않았습니다.`);
  if (version) facts.push(`버전/릴리스: ${version}.`);
  if (component) facts.push(`관련 컴포넌트: ${component}.`);
  if (cleaned.text) facts.push(`확인된 변경점: ${cleaned.text}`);
  return unique(facts).slice(0, 5);
}

function buildStaticBackgroundContext(candidate = {}) {
  const bucket = candidateBucket(candidate);
  const impact = inferGuardrailImpactClass(candidate);
  if (impact === GUARDRAIL_IMPACT_CLASSES.DIRECT_HAL_CONTRACT) {
    return 'Camera HAL owner는 변경을 HAL API, metadata contract, stream, buffer, request/result 동작 변경으로 다루기 전에 source evidence를 확인해야 합니다.';
  }
  if (impact === GUARDRAIL_IMPACT_CLASSES.CAMERA_STACK_SOURCE || bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE) {
    return 'Driver, sensor, ISP, libcamera, V4L2 변경은 image pipeline 검증, frame timing, format negotiation, downstream camera integration 작업에 영향을 줄 수 있습니다.';
  }
  if (hasMultimediaOutputEvidence(candidate)) {
    return 'Camera output / multimedia supporting items are not direct HAL contract evidence; treat them as capture output, preview/video/gallery/video-call behavior, and downstream validation signals.';
  }
  if (impact === GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT || bucket === BUCKETS.ANDROID) {
    return 'CameraX와 Camera2는 HAL 위 계층이므로 release note는 direct HAL contract evidence가 아니라 compatibility, API usage, app-facing validation 신호로 보는 것이 적절합니다.';
  }
  if (impact === GUARDRAIL_IMPACT_CLASSES.TOOLING_SUPPORT || bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK) {
    return 'Native build, test, sanitizer, compiler, debug workflow 변경은 Camera HAL과 driver 팀을 지원할 수 있지만, camera-specific runtime evidence가 없으면 workflow signal로만 표현해야 합니다.';
  }
  return '이 항목은 background 또는 watchlist material입니다. main Camera HAL claim으로 승격하기 전에 follow-up source evidence를 추적할 가치가 있는지 판단하는 용도로 사용합니다.';
}

function buildHalPerspective(candidate = {}) {
  const impact = inferGuardrailImpactClass(candidate);
  const bucket = candidateBucket(candidate);
  if (impact === GUARDRAIL_IMPACT_CLASSES.DIRECT_HAL_CONTRACT) {
    return 'Linked source가 직접 뒷받침하는 범위에서만 HAL API, metadata, request/result, stream, buffer contract 항목으로 다룹니다.';
  }
  if (impact === GUARDRAIL_IMPACT_CLASSES.CAMERA_STACK_SOURCE) {
    return 'driver, sensor, ISP, image pipeline 관점에서 frame timing, format negotiation, integration validation 같은 구체 점검 항목을 먼저 제시하고, source 범위를 벗어난 Android HAL contract 변경으로는 단정하지 않습니다.';
  }
  if (hasMultimediaOutputEvidence(candidate)) {
    return 'Do not infer a HAL API change; review preview, video, gallery, video-call, and captured image/video output quality or compatibility regressions.';
  }
  if (impact === GUARDRAIL_IMPACT_CLASSES.FRAMEWORK_ADJACENT) {
    return 'CameraX 또는 Camera2 usage pattern, compatibility assumption, app-facing behavior를 검증해 HAL boundary 위 계층의 문제 신호로 활용합니다.';
  }
  if (impact === GUARDRAIL_IMPACT_CLASSES.TOOLING_SUPPORT) {
    return 'build, test, debug, native tooling workflow 항목으로 유지합니다. camera-specific source evidence 없이 HAL runtime impact로 승격하지 않습니다.';
  }
  return 'Dated camera-stack evidence가 더 강한 claim을 뒷받침하기 전까지 briefing 또는 watchlist context로 유지합니다.';
}

function buildOverclaimGuardrails(candidate = {}) {
  const bucket = candidateBucket(candidate);
  const impact = inferGuardrailImpactClass(candidate);
  const guardrails = [
    'Supplied source evidence가 말하지 않으면 HAL API, metadata contract, stream, buffer, request/result, CTS, VTS, Camera ITS impact를 claim하지 않습니다.',
    'Release-table text 또는 UI snippet을 background knowledge로 바꾸지 않습니다.'
  ];
  if (impact !== GUARDRAIL_IMPACT_CLASSES.DIRECT_HAL_CONTRACT) {
    guardrails.push('이 항목을 direct HAL API 또는 contract change로 표현하지 않습니다.');
  }
  if (bucket === BUCKETS.ANDROID) {
    guardrails.push('CameraX 또는 Camera2 항목은 vendor HAL implementation change가 아니라 app/framework compatibility와 validation pattern 중심으로 설명합니다.');
  }
  if (bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK) {
    guardrails.push('Native tooling 항목은 explicit camera evidence 없이 Android Camera HAL toolchain migration 또는 runtime behavior change로 claim하지 않습니다.');
  }
  if (bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE) {
    guardrails.push('libcamera, V4L2, driver, sensor 항목은 downstream Android evidence가 없으면 Android vendor HAL behavior로 claim하지 않습니다.');
  }
  if (hasMultimediaOutputEvidence(candidate)) {
    guardrails.push('Camera output / multimedia supporting items must not be described as direct HAL API, vendor HAL implementation, or HAL contract changes.');
  }
  return unique(guardrails);
}

function normalizeForMatch(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedTokens(value) {
  return normalizeForMatch(value)
    .split(/\s+/)
    .filter(token => token.length >= 3);
}

function normalizedTokenOverlap(left, right) {
  const leftTokens = new Set(normalizedTokens(left));
  const rightTokens = new Set(normalizedTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function backgroundOverlapIssue(background, whatChanged, overlapThreshold) {
  const backgroundText = text(background);
  const changedText = text(whatChanged);
  const normalizedBackground = normalizeForMatch(backgroundText);
  const normalizedChanged = normalizeForMatch(changedText);
  const backgroundTokens = normalizedTokens(backgroundText);
  const changedTokens = normalizedTokens(changedText);
  const overlap = normalizedTokenOverlap(backgroundText, changedText);
  const baseIssue = {
    type: 'field_overlap',
    field: 'background_context',
    overlap,
    background_token_count: backgroundTokens.length,
    changed_token_count: changedTokens.length
  };

  if (normalizedBackground && normalizedBackground === normalizedChanged) {
    return {
      ...baseIssue,
      overlap: 1,
      overlap_kind: 'exact_duplicate',
      severity: 'hard',
      blocking: true,
      reason: 'background_context exactly duplicates what_changed.'
    };
  }
  if (
    backgroundTokens.length >= 6 &&
    changedTokens.length >= 6 &&
    overlap >= overlapThreshold
  ) {
    return {
      ...baseIssue,
      overlap_kind: 'semantic_overlap',
      severity: 'hard',
      blocking: true,
      reason: `background_context overlaps what_changed too much (${overlap.toFixed(2)} >= ${overlapThreshold}).`
    };
  }
  if (
    backgroundTokens.length >= 3 &&
    changedTokens.length >= 3 &&
    overlap >= overlapThreshold
  ) {
    return {
      ...baseIssue,
      overlap_kind: 'short_overlap_warning',
      severity: 'warning',
      blocking: false,
      reason: 'background_context and what_changed overlap, but token count is below hard-fail threshold.'
    };
  }
  return null;
}

function rawArtifactMatches(value) {
  const raw = text(value);
  if (!raw) return [];
  const findings = [];
  for (const entry of RAW_ARTIFACT_PATTERNS) {
    const pattern = new RegExp(entry.pattern.source, entry.pattern.flags);
    if (pattern.test(raw)) findings.push(entry.id);
  }
  const moduleRows = (raw.match(/\bcamera-[a-z0-9-]+(?:\s+(?:-|\d+\S*)){2,5}/gi) || []).length;
  if (moduleRows >= 2) findings.push('module-version-table-dump');
  return unique(findings);
}

function confirmedFactClassificationLeaks(section = {}) {
  const value = text(section.confirmed_facts);
  if (!value) return [];
  return [
    { id: 'relevance_bucket', pattern: /\b(?:Relevance bucket|relevance_bucket)\b/i },
    { id: 'impact_claim_level', pattern: /\bimpact_claim_level\b/i },
    { id: 'source_gap_risk', pattern: /\bsource_gap_risk\b/i }
  ].filter(entry => entry.pattern.test(value)).map(entry => entry.id);
}

function findFieldHygieneIssues(section = {}, options = {}) {
  const overlapThreshold = Number.isFinite(Number(options.overlapThreshold))
    ? Number(options.overlapThreshold)
    : OVERLAP_THRESHOLD;
  const issues = [];
  const articleSections = normalizeArticleSections(section);
  const checkedFields = {
    what_changed: section.what_changed,
    background_context: articleSections.background_context,
    hal_driver_impact: articleSections.hal_driver_impact,
    team_share_points: articleSections.team_share_points,
    verified_facts: articleSections.verified_facts,
    evidence_summary: section.evidence_summary,
    confirmed_facts: section.confirmed_facts
  };
  for (const [field, fieldValue] of Object.entries(checkedFields)) {
    for (const artifact of rawArtifactMatches(fieldValue)) {
      issues.push({
        type: 'raw_artifact',
        field,
        artifact,
        severity: 'hard',
        blocking: true,
        reason: `${field} contains raw source UI or table artifact: ${artifact}.`
      });
    }
  }
  const overlapIssue = backgroundOverlapIssue(articleSections.background_context, section.what_changed, overlapThreshold);
  if (overlapIssue) issues.push(overlapIssue);
  for (const classification of confirmedFactClassificationLeaks(section)) {
    issues.push({
      type: 'internal_classification_in_confirmed_facts',
      field: 'confirmed_facts',
      classification,
      severity: 'hard',
      blocking: true,
      reason: 'confirmed_facts must contain source-confirmed facts only, not internal editorial classification.'
    });
  }
  return issues;
}

module.exports = {
  GUARDRAIL_IMPACT_CLASSES,
  OVERLAP_THRESHOLD,
  RAW_ARTIFACT_PATTERNS,
  buildConfirmedFacts,
  buildHalPerspective,
  buildOverclaimGuardrails,
  buildStaticBackgroundContext,
  cleanBehaviorChange,
  findFieldHygieneIssues,
  inferGuardrailImpactClass,
  normalizedTokenOverlap,
  rawArtifactMatches
};
