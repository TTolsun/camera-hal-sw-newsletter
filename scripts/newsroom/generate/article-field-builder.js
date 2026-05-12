const {
  BUCKETS,
  classifyAospCameraStackCandidate
} = require('../common/aosp-camera-scope');

const IMPACT_CLAIM_LEVELS = Object.freeze({
  DIRECT_HAL_CHANGE: 'direct_hal_change',
  CAMERA_STACK_DIRECT: 'camera_stack_direct',
  ANDROID_FRAMEWORK_ADJACENT: 'android_framework_adjacent',
  TOOLING_SUPPORTING: 'tooling_supporting',
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

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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
    candidate.derived_editorial_hints,
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

function inferImpactClaimLevel(candidate = {}) {
  const explicit = text(candidate.impact_claim_level || candidate.impactClaimLevel);
  if (Object.values(IMPACT_CLAIM_LEVELS).includes(explicit)) return explicit;

  const bucket = candidateBucket(candidate);
  const directness = Number(candidate.aosp_camera_directness || 0);
  if (bucket === BUCKETS.DIRECT_AOSP_CAMERA) {
    return directness >= 3 ? IMPACT_CLAIM_LEVELS.DIRECT_HAL_CHANGE : IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT;
  }
  if (bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE) return IMPACT_CLAIM_LEVELS.CAMERA_STACK_DIRECT;
  if (bucket === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT) return IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT;
  if (bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK) return IMPACT_CLAIM_LEVELS.TOOLING_SUPPORTING;
  if (bucket === BUCKETS.SOC_PLATFORM_SIGNAL) {
    return hasDirectCameraPipelineEvidence(candidate)
      ? IMPACT_CLAIM_LEVELS.CAMERA_STACK_DIRECT
      : IMPACT_CLAIM_LEVELS.WATCH_ONLY;
  }
  return IMPACT_CLAIM_LEVELS.WATCH_ONLY;
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
  const impact = inferImpactClaimLevel(candidate);
  if (impact === IMPACT_CLAIM_LEVELS.DIRECT_HAL_CHANGE) {
    return 'Camera HAL owner는 변경을 HAL API, metadata contract, stream, buffer, request/result 동작 변경으로 다루기 전에 source evidence를 확인해야 합니다.';
  }
  if (impact === IMPACT_CLAIM_LEVELS.CAMERA_STACK_DIRECT || bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE) {
    return 'Driver, sensor, ISP, libcamera, V4L2 변경은 image pipeline 검증, frame timing, format negotiation, downstream camera integration 작업에 영향을 줄 수 있습니다.';
  }
  if (impact === IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT || bucket === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT) {
    return 'CameraX와 Camera2는 HAL 위 계층이므로 release note는 direct HAL contract evidence가 아니라 compatibility, API usage, app-facing validation 신호로 보는 것이 적절합니다.';
  }
  if (impact === IMPACT_CLAIM_LEVELS.TOOLING_SUPPORTING || bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK) {
    return 'Native build, test, sanitizer, compiler, debug workflow 변경은 Camera HAL과 driver 팀을 지원할 수 있지만, camera-specific runtime evidence가 없으면 workflow signal로만 표현해야 합니다.';
  }
  return '이 항목은 background 또는 watchlist material입니다. main Camera HAL claim으로 승격하기 전에 follow-up source evidence를 추적할 가치가 있는지 판단하는 용도로 사용합니다.';
}

function buildHalPerspective(candidate = {}) {
  const impact = inferImpactClaimLevel(candidate);
  if (impact === IMPACT_CLAIM_LEVELS.DIRECT_HAL_CHANGE) {
    return 'Linked source가 직접 뒷받침하는 범위에서만 HAL API, metadata, request/result, stream, buffer contract 항목으로 다룹니다.';
  }
  if (impact === IMPACT_CLAIM_LEVELS.CAMERA_STACK_DIRECT) {
    return 'Android HAL contract 변경으로 단정하지 말고 driver, sensor, ISP, image pipeline, frame timing, integration validation을 위한 camera stack input으로 검토합니다.';
  }
  if (impact === IMPACT_CLAIM_LEVELS.ANDROID_FRAMEWORK_ADJACENT) {
    return 'CameraX 또는 Camera2 usage pattern, compatibility assumption, app-facing behavior를 검증해 HAL boundary 위 계층의 문제 신호로 활용합니다.';
  }
  if (impact === IMPACT_CLAIM_LEVELS.TOOLING_SUPPORTING) {
    return 'build, test, debug, native tooling workflow 항목으로 유지합니다. camera-specific source evidence 없이 HAL runtime impact로 승격하지 않습니다.';
  }
  return 'Dated camera-stack evidence가 더 강한 claim을 뒷받침하기 전까지 briefing 또는 watchlist context로 유지합니다.';
}

function buildOverclaimGuardrails(candidate = {}) {
  const bucket = candidateBucket(candidate);
  const impact = inferImpactClaimLevel(candidate);
  const guardrails = [
    'Supplied source evidence가 말하지 않으면 HAL API, metadata contract, stream, buffer, request/result, CTS, VTS, Camera ITS impact를 claim하지 않습니다.',
    'Release-table text 또는 UI snippet을 background knowledge로 바꾸지 않습니다.'
  ];
  if (impact !== IMPACT_CLAIM_LEVELS.DIRECT_HAL_CHANGE) {
    guardrails.push('이 항목을 direct HAL API 또는 contract change로 표현하지 않습니다.');
  }
  if (bucket === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT) {
    guardrails.push('CameraX 또는 Camera2 항목은 vendor HAL implementation change가 아니라 app/framework compatibility와 validation pattern 중심으로 설명합니다.');
  }
  if (bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK) {
    guardrails.push('Native tooling 항목은 explicit camera evidence 없이 Android Camera HAL toolchain migration 또는 runtime behavior change로 claim하지 않습니다.');
  }
  if (bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE) {
    guardrails.push('libcamera, V4L2, driver, sensor 항목은 downstream Android evidence가 없으면 Android vendor HAL behavior로 claim하지 않습니다.');
  }
  return unique(guardrails);
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
    field: 'background',
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
      reason: 'background exactly duplicates what_changed.'
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
      reason: `background overlaps what_changed too much (${overlap.toFixed(2)} >= ${overlapThreshold}).`
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
      reason: 'background and what_changed overlap, but token count is below hard-fail threshold.'
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

function sectionSnippets(section = {}) {
  return [
    section.what_changed,
    section.background,
    section.camera_hal_perspective,
    section.why_it_matters,
    section.team_summary
  ]
    .flatMap(value => text(value).split(/(?:[.!?。！？]+|\r?\n|[;；])\s*/))
    .map(value => value.trim())
    .filter(Boolean);
}

function isNegatedOrGuardrailSnippet(value) {
  return /(?:단정하지|claim하지|표현하지|간주하지|승격하지|보지\s*않|source\s+evidence가\s*없으면|evidence가\s*없으면|\bwithout\b|\bunless\b|\bavoid\b|\bdo\s+not\b|\bmust\s+not\b|\bshould\s+not\b|\bnot\s+(?:a\s+)?direct\s+HAL\b|\bnot\s+(?:supported|backed)\s+by\s+evidence\b|\bno\s+(?:source\s+)?evidence\b)/i.test(value);
}

function hasDirectHalChangeClaim(value) {
  const mutation = String.raw`(?:change|changes|changed|changing|impact|impacts|affect|affects|affected|require|requires|required|must|need|needs|alter|alters|modify|modifies|modification|변경|영향|요구|필요|바뀜|수정|조정|강제|해야)`;
  const halBoundary = String.raw`(?:\bHAL\b|HAL\s*boundary)`;
  const contractTerm = String.raw`(?:API|contract|interface|metadata\s*(?:contract|계약)|메타데이터\s*(?:contract|계약)|계약|인터페이스)`;
  const ioTerm = String.raw`(?:stream|buffer|request\s*\/\s*result|request|result)`;
  const ioClaim = String.raw`(?:contract|계약|API|direct\s+impact|직접\s*영향|change|changes|changed|changing|require|requires|required|변경|요구)`;

  if (/\b직접\s*HAL\s*API\b/i.test(value)) return true;
  if (/\bdirect\s+HAL\s+API\b/i.test(value)) return true;
  if (new RegExp(`${halBoundary}[^.\\n]{0,80}${contractTerm}[^.\\n]{0,80}${mutation}`, 'i').test(value)) return true;
  if (new RegExp(`${contractTerm}[^.\\n]{0,80}${halBoundary}[^.\\n]{0,80}${mutation}`, 'i').test(value)) return true;
  if (new RegExp(`${halBoundary}[^.\\n]{0,80}${ioTerm}[^.\\n]{0,80}${ioClaim}`, 'i').test(value)) return true;
  if (new RegExp(`${halBoundary}[^.\\n]{0,80}${ioClaim}[^.\\n]{0,80}${ioTerm}`, 'i').test(value)) return true;
  return false;
}

function directHalOverclaim(section = {}) {
  const impact = text(section.impact_claim_level || section.impactClaimLevel);
  if (!impact || impact === IMPACT_CLAIM_LEVELS.DIRECT_HAL_CHANGE) return '';
  for (const snippet of sectionSnippets(section)) {
    if (isNegatedOrGuardrailSnippet(snippet)) continue;
    if (hasDirectHalChangeClaim(snippet)) return snippet;
  }
  return '';
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
  const checkedFields = [
    'what_changed',
    'background',
    'camera_hal_perspective',
    'why_it_matters',
    'team_summary',
    'evidence_summary',
    'confirmed_facts'
  ];
  for (const field of checkedFields) {
    for (const artifact of rawArtifactMatches(section[field])) {
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
  const overlapIssue = backgroundOverlapIssue(section.background, section.what_changed, overlapThreshold);
  if (overlapIssue) issues.push(overlapIssue);
  const overclaimSnippet = directHalOverclaim(section);
  if (overclaimSnippet) {
    issues.push({
      type: 'overclaim_guardrail',
      field: 'camera_hal_perspective',
      impact_claim_level: text(section.impact_claim_level || section.impactClaimLevel),
      snippet: compactText(overclaimSnippet, MAX_FRAGMENT_LENGTH),
      severity: 'hard',
      blocking: true,
      reason: 'Article claims direct HAL API or contract impact without direct_hal_change impact_claim_level.'
    });
  }
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
  IMPACT_CLAIM_LEVELS,
  OVERLAP_THRESHOLD,
  RAW_ARTIFACT_PATTERNS,
  buildConfirmedFacts,
  buildHalPerspective,
  buildOverclaimGuardrails,
  buildStaticBackgroundContext,
  cleanBehaviorChange,
  findFieldHygieneIssues,
  inferImpactClaimLevel,
  normalizedTokenOverlap,
  rawArtifactMatches
};
