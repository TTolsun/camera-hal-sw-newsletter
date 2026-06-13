const { ensureArray } = require('../../shared/common/value-coercion');
const {
  DECISION_IMPACT_VALUES,
  DECISION_SCOPE_VALUES,
  DECISION_ACTION_VALUES,
  DECISION_RISK_VALUES,
  normalizeEnumArray,
  actionRank
} = require('./decision-metadata');
const {
  publicProseLeakageIssues,
  publicUrlError
} = require('./public-prose-leakage');
const PUBLIC_ARTICLE_BASE_REQUIRED_KEYS = Object.freeze([
  'headline',
  'lead',
  'body_paragraphs',
  'camera_hal_takeaway',
  'reader_checkpoints',
  'source_links'
]);

const STORY_CONTRACT_VERSION = 1;
const STORY_PUBLIC_CONTRACT_VERSION = 'story-v1';
const GENERATION_CONTRACT_VERSION = 1;
const SUPPORTED_STORY_CONTRACT_VERSIONS = new Set([STORY_CONTRACT_VERSION]);
const SUPPORTED_PUBLIC_CONTRACT_VERSIONS = new Set([STORY_PUBLIC_CONTRACT_VERSION]);
const SUPPORTED_GENERATION_CONTRACT_VERSIONS = new Set([GENERATION_CONTRACT_VERSION]);

const PUBLIC_ARTICLE_STORY_KEYS = Object.freeze([
  'story_contract_version',
  'source_subtitle',
  'editorial_story',
  'decision_metadata'
]);

const PUBLIC_ARTICLE_REQUIRED_KEYS = PUBLIC_ARTICLE_BASE_REQUIRED_KEYS;

const PUBLIC_ARTICLE_STORY_REQUIRED_KEYS = Object.freeze([
  ...PUBLIC_ARTICLE_BASE_REQUIRED_KEYS,
  'story_contract_version',
  'source_subtitle',
  'editorial_story',
  'decision_metadata'
]);

const PUBLIC_ARTICLE_ALLOWED_KEYS = Object.freeze([
  ...PUBLIC_ARTICLE_BASE_REQUIRED_KEYS,
  ...PUBLIC_ARTICLE_STORY_KEYS
]);

const EDITORIAL_STORY_KEYS = Object.freeze([
  'reader_scenario',
  'what_happened',
  'why_it_matters',
  'field_scenario',
  'not_to_overclaim',
  'editor_take'
]);

const PUBLIC_SOURCE_LINK_ALLOWED_KEYS = Object.freeze([
  'title',
  'url',
  'publisher',
  'source_role',
  'checked_at'
]);

const PUBLIC_SOURCE_ROLES = Object.freeze([
  'primary',
  'seed_evidence',
  'related_context'
]);

const PUBLIC_SOURCE_ROLE_ALIASES = Object.freeze({
  official_release_source: 'primary',
  project_release_source: 'primary',
  project_mailing_list_source: 'primary',
  engineering_blog_source: 'primary',
  linked_primary_evidence: 'primary',
  seed_page: 'primary',
  seed_evidence: 'seed_evidence',
  supporting: 'seed_evidence',
  tech_media_lead_source: 'seed_evidence',
  community_lead_source: 'seed_evidence',
  context: 'related_context',
  official_documentation_reference: 'related_context',
  fallback_context_source: 'related_context',
  unknown_source: 'related_context'
});

const {
  normalizeNewsSourceKey
} = require('../../shared/common/source-url-key');

const NO_IMMEDIATE_ACTION_TEXT = '즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.';

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function compactText(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

function normalizePublicSourceRole(value) {
  const role = compactText(value);
  if (!role) return '';
  if (PUBLIC_SOURCE_ROLES.includes(role)) return role;
  return PUBLIC_SOURCE_ROLE_ALIASES[role] || role;
}

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const output = [];
  for (const item of values) {
    const normalized = compactText(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function contractVersion(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSupportedStoryVersion(value) {
  return SUPPORTED_STORY_CONTRACT_VERSIONS.has(contractVersion(value));
}

function isSupportedGenerationVersion(value) {
  return SUPPORTED_GENERATION_CONTRACT_VERSIONS.has(contractVersion(value));
}

function isSupportedPublicContractVersion(value) {
  return SUPPORTED_PUBLIC_CONTRACT_VERSIONS.has(compactText(value));
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function storyContractMarkers(issue = {}, section = {}, options = {}) {
  const article = isPlainObject(section.public_article) ? section.public_article : {};
  const hasIssueContractValue = compactText(issue.public_contract_version) !== '';
  const hasGenerationContractValue = hasOwn(issue, 'generation_contract_version') &&
    compactText(issue.generation_contract_version) !== '';
  const hasSectionStoryContractValue = hasOwn(article, 'story_contract_version') &&
    compactText(article.story_contract_version) !== '';
  const hasIssueStoryMarker = isSupportedPublicContractVersion(issue.public_contract_version);
  const hasGenerationMarker = isSupportedGenerationVersion(issue.generation_contract_version);
  const hasSectionStoryMarker = isSupportedStoryVersion(article.story_contract_version);
  const unsupported = [];
  if (hasIssueContractValue && !hasIssueStoryMarker) {
    unsupported.push({
      type: 'unsupported_public_contract_version',
      key: 'public_contract_version',
      value: compactText(issue.public_contract_version),
      supported: [...SUPPORTED_PUBLIC_CONTRACT_VERSIONS]
    });
  }
  if (hasGenerationContractValue && !hasGenerationMarker) {
    unsupported.push({
      type: 'unsupported_generation_contract_version',
      key: 'generation_contract_version',
      value: issue.generation_contract_version,
      supported: [...SUPPORTED_GENERATION_CONTRACT_VERSIONS]
    });
  }
  if (hasSectionStoryContractValue && !hasSectionStoryMarker) {
    unsupported.push({
      type: 'unsupported_story_contract_version',
      key: 'story_contract_version',
      value: article.story_contract_version,
      supported: [...SUPPORTED_STORY_CONTRACT_VERSIONS]
    });
  }
  const hasStoryField = PUBLIC_ARTICLE_STORY_KEYS.some(key => hasOwn(article, key));
  const markerCount = [
    hasIssueStoryMarker,
    hasGenerationMarker,
    hasSectionStoryMarker
  ].filter(Boolean).length;
  const rawMarkerCount = [
    hasIssueContractValue,
    hasGenerationContractValue,
    hasSectionStoryContractValue
  ].filter(Boolean).length;
  const complete = markerCount === 3 && unsupported.length === 0;
  const requiredByCaller = options.requireStoryContract === true;
  return {
    hasIssueStoryMarker,
    hasGenerationMarker,
    hasSectionStoryMarker,
    hasStoryField,
    hasUnsupportedMarker: unsupported.length > 0,
    unsupported,
    rawMarkerCount,
    markerCount,
    complete,
    required: complete || requiredByCaller,
    mismatch: unsupported.length === 0 && ((markerCount > 0 && markerCount < 3) ||
      (markerCount === 0 && hasStoryField) ||
      (requiredByCaller && !complete))
  };
}

function requiresStoryContract(issue = {}, section = {}, options = {}) {
  return storyContractMarkers(issue, section, options).required;
}

function detectStoryContractMismatch(issue = {}, section = {}, options = {}) {
  return storyContractMarkers(issue, section, options).mismatch;
}

function normalizeSourceLink(source = {}) {
  if (!isPlainObject(source)) return null;
  const output = {
    title: compactText(source.title),
    url: compactText(source.url)
  };
  for (const key of ['publisher', 'source_role', 'checked_at']) {
    const value = compactText(source[key]);
    if (value) output[key] = value;
  }
  if (output.source_role) output.source_role = normalizePublicSourceRole(output.source_role);
  return output;
}

function normalizedSourceUrlKey(value = '') {
  const normalized = normalizeNewsSourceKey(value);
  return normalized.key || compactText(value).toLowerCase();
}

function sourceEntryRole(source, fallbackRole = 'primary') {
  if (!isPlainObject(source)) return normalizePublicSourceRole(fallbackRole);
  return normalizePublicSourceRole(source.source_role || source.role || source.context_role || fallbackRole);
}

function addSourceRole(roleMap, source, fallbackRole = 'primary') {
  const key = normalizedSourceUrlKey(source?.url || source);
  if (!key) return;
  const role = sourceEntryRole(source, fallbackRole);
  if (!roleMap.has(key)) roleMap.set(key, new Set());
  if (role) roleMap.get(key).add(role);
}

function allowedPublicSourceUrlRoleMap(section = {}) {
  const roleMap = new Map();
  ensureArray(section.sources).forEach(source => addSourceRole(roleMap, source, 'primary'));
  ensureArray(section.allowed_public_source_links).forEach(source => addSourceRole(roleMap, source, 'primary'));
  ensureArray(section.seed_evidence_urls).forEach(url => addSourceRole(roleMap, { url, source_role: 'seed_evidence' }, 'seed_evidence'));
  ensureArray(section.seedEvidenceUrls).forEach(url => addSourceRole(roleMap, { url, source_role: 'seed_evidence' }, 'seed_evidence'));
  ensureArray(section.related_context_sources).forEach(source => addSourceRole(roleMap, source, 'related_context'));
  ensureArray(section.related_context_candidates).forEach(source => addSourceRole(roleMap, source, 'related_context'));
  return roleMap;
}

function allowedPublicSourceUrlKeys(section = {}) {
  return new Set(allowedPublicSourceUrlRoleMap(section).keys());
}

function publicSourceLinkRoleIssue(role, { allowRelatedContext = false } = {}) {
  if (!role) return '';
  if (!PUBLIC_SOURCE_ROLES.includes(role)) return 'unsupported_role';
  if (role === 'related_context' && allowRelatedContext !== true) return 'related_context_not_allowed';
  return '';
}

function sourceLinkIssues(source = {}, index = 0, options = {}) {
  const issues = [];
  if (!isPlainObject(source)) {
    return [{ type: 'invalid_source_link', index, reason: 'not_object' }];
  }
  const unexpected = Object.keys(source).filter(key => !PUBLIC_SOURCE_LINK_ALLOWED_KEYS.includes(key));
  if (unexpected.length > 0) {
    issues.push({ type: 'unexpected_source_link_keys', index, keys: unexpected });
  }
  if (!compactText(source.title)) {
    issues.push({ type: 'invalid_source_link', index, field: 'title', reason: 'missing_title' });
  }
  for (const key of ['title', 'label', 'publisher']) {
    const value = compactText(source[key]);
    if (!value) continue;
    for (const message of publicProseLeakageIssues(value, `source_links[${index}].${key}`)) {
      issues.push({ type: 'public_article_leakage', index, field: key, reason: 'internal_public_term', message });
    }
  }
  const urlError = publicUrlError(source.url);
  if (urlError) {
    issues.push({ type: 'invalid_source_link', index, field: 'url', reason: urlError });
  }
  const allowedKeys = options.allowedSourceUrlKeys;
  const allowedRoles = options.allowedSourceUrlRoles;
  const key = urlError ? '' : normalizedSourceUrlKey(source.url);
  if (!urlError && allowedRoles instanceof Map && allowedRoles.size > 0) {
    const roles = allowedRoles.get(key);
    const requestedRole = normalizePublicSourceRole(source.source_role) || 'primary';
    if (!roles) {
      issues.push({ type: 'invalid_source_link', index, field: 'url', reason: 'url_not_in_allowed_source_set', value: source.url });
    } else if (!roles.has(requestedRole)) {
      issues.push({
        type: 'invalid_source_link',
        index,
        field: 'source_role',
        reason: 'source_role_not_allowed_for_url',
        value: requestedRole,
        allowedRoles: [...roles]
      });
    }
  } else if (!urlError && allowedKeys instanceof Set && allowedKeys.size > 0) {
    if (!allowedKeys.has(key)) {
      issues.push({ type: 'invalid_source_link', index, field: 'url', reason: 'url_not_in_allowed_source_set', value: source.url });
    }
  }
  const role = normalizePublicSourceRole(source.source_role);
  const roleIssue = publicSourceLinkRoleIssue(role, options);
  if (roleIssue) {
    issues.push({ type: 'invalid_source_link', index, field: 'source_role', reason: roleIssue, value: role });
  }
  return issues;
}

function sectionBucket(section = {}) {
  return compactText(section.relevance_bucket || section.bucket || section.category);
}

function combinedSectionText(section = {}, issue = {}) {
  return compactText([
    issue.publication_mode,
    issue.public_contract_version,
    section.relevance_bucket,
    section.actionability_level,
    section.effective_actionability_level,
    section.signal_quality_status,
    section.article_type,
    section.category,
    section.headline,
    section.source_quality_status,
    section.finalSelectionEligibility,
    section.public_article?.editorial_story,
    section.public_article?.headline,
    section.public_article?.lead,
    section.public_article?.body_paragraphs,
    section.public_article?.camera_hal_takeaway,
    section.public_article?.reader_checkpoints
  ]);
}

function sanitizeSectionForPublicDecision(section = {}) {
  if (!isPlainObject(section)) return {};
  const sanitized = { ...section };
  delete sanitized.impact_claim_level;
  delete sanitized.impactClaimLevel;
  return sanitized;
}

function hasSourceGapRisk(section = {}, issue = {}) {
  return section.source_gap_risk === true ||
    issue.source_gap_risk === true ||
    /source_gap_risk\s*[:=]\s*true/i.test(combinedSectionText(section, issue));
}

function hasForbiddenOrWatchlistPromotion(section = {}, issue = {}) {
  const combined = combinedSectionText(section, issue);
  return section.reference_only === true ||
    section.briefing_only === true ||
    section.main_eligible === false ||
    /finalSelectionEligibility\s*[:=]\s*(?:watchlist|exclude|reference_only)/i.test(combined) ||
    /generic_tech_watchlist|forbidden|watchlist|exclude/i.test(sectionBucket(section));
}

function hasMissingSourceEligibility(section = {}) {
  const quality = compactText(section.source_quality_status || section.source_url_quality);
  const allowed = section.main_article_source_allowed;
  return allowed === false || /blocked|unknown/i.test(quality);
}

function storyText(section = {}, key = '') {
  return compactText(section.public_article?.editorial_story?.[key]);
}

function hasDirectHalOverclaimFinding(section = {}, issue = {}) {
  const publicText = combinedSectionText(section, issue);
  const directWords = /직접\s*HAL|direct\s+HAL|HAL\s+(?:API|runtime|contract|buffer|stream|metadata)|request\/result|vendor\s+tag/i;
  const limitationWords = /직접\s*(?:말하지|언급하지|근거가 없|해석하지|확대하지)|do not|not claim|not overstate|범위.*제한|source.*범위/i;
  if (!directWords.test(publicText)) return false;
  if (limitationWords.test(publicText)) return false;
  const axes = ensureArray(section.hal_impact_axes || section.hal_signal_capsule?.impact_axes).map(compactText);
  const directImpact = axes.some(axis => /direct_hal|framework_hal_contract|stream_buffer_metadata/i.test(axis));
  return !directImpact;
}

function hasDoNotOverstateBoundary(section = {}) {
  return ensureArray(section.do_not_overstate).length > 0 ||
    ensureArray(section.hal_signal_capsule?.do_not_overstate).length > 0 ||
    Boolean(storyText(section, 'not_to_overclaim'));
}

function isFallbackOnly(section = {}, issue = {}) {
  const bucket = compactText(section.relevance_bucket || section.bucket);
  // cpp_fallback 메인 승격 기능은 비활성화됨 (publishModePolicy로 대체 예정) — 항상 fallback 취급
  return issue.fallback_only === true ||
    section.fallback_only === true ||
    issue.publication_mode === 'fallback_public' ||
    section.publication_mode === 'fallback_public' ||
    bucket === 'cpp_ai_tooling_fallback';
}

function isDirectHalSourceConfirmed(section = {}) {
  const bucket = sectionBucket(section);
  const axes = ensureArray(section.hal_impact_axes || section.hal_signal_capsule?.impact_axes).map(compactText);
  const directImpact = /direct_aosp_camera|camera_driver_image_pipeline/i.test(bucket) ||
    axes.some(axis => /direct_hal|framework_hal_contract|stream_buffer_metadata|driver_image_pipeline/i.test(axis));
  return directImpact && !hasSourceGapRisk(section) && !hasForbiddenOrWatchlistPromotion(section);
}

function deriveOverclaimRisk(section = {}, issue = {}) {
  // High-risk blockers must be evaluated before direct-HAL positive signals.
  if (hasSourceGapRisk(section, issue)) return 'High';
  if (hasForbiddenOrWatchlistPromotion(section, issue)) return 'High';
  if (hasMissingSourceEligibility(section, issue)) return 'High';
  if (hasDirectHalOverclaimFinding(section, issue)) return 'High';
  if (hasDoNotOverstateBoundary(section, issue)) return 'Medium';
  if (isFallbackOnly(section, issue)) return 'Medium';
  if (isDirectHalSourceConfirmed(section, issue)) return 'Low';
  return 'Medium';
}

function deriveReaderImpact(section = {}, issue = {}) {
  if (hasSourceGapRisk(section, issue) || hasForbiddenOrWatchlistPromotion(section, issue)) return 'Low';
  if (isDirectHalSourceConfirmed(section, issue) || /strong_signal|owner_metric_log/i.test(combinedSectionText(section, issue))) return 'High';
  if (/concrete_check|measurable_test|framework|driver|sensor|tooling/i.test(combinedSectionText(section, issue))) return 'Medium';
  return 'Low';
}

function addScope(scopes, value) {
  if (DECISION_SCOPE_VALUES.includes(value) && !scopes.includes(value)) scopes.push(value);
}

function structuredScopeText(section = {}) {
  return compactText([
    section.relevance_bucket,
    section.actionability_level,
    section.effective_actionability_level,
    section.signal_quality_status,
    section.article_type,
    section.category,
    section.headline,
    section.api_or_component,
    section.apiOrComponent,
    section.component,
    section.soc_signal_type,
    section.tooling_workflow_type,
    section.hal_impact_axes,
    section.hal_signal_capsule?.impact_axes,
    section.source_candidate_url
  ]);
}

function deriveReaderScope(section = {}, issue = {}) {
  const scopes = [];
  const structured = structuredScopeText(section);
  const bucket = sectionBucket(section);
  const axes = ensureArray(section.hal_impact_axes || section.hal_signal_capsule?.impact_axes).map(compactText);
  const directHal = isDirectHalSourceConfirmed(section, issue);
  if (directHal) addScope(scopes, 'HAL');
  if (/driver|v4l2|libcamera|image_pipeline/i.test(structured)) addScope(scopes, 'Driver');
  if (/sensor/i.test(structured)) addScope(scopes, 'Sensor');
  if (/tooling|c\+\+|clang|llvm|gcc|build|debug/i.test(structured)) addScope(scopes, 'Tooling');
  if (/\bAI\b|ai_studio|agent|LLM|inference|model/i.test(structured)) addScope(scopes, 'AI');
  if (/camerax|camera2|framework|android_platform|android_camera_api|compose|navigation/i.test(structured)) addScope(scopes, 'Framework');
  if (/soc|isp|npu|cpu|gpu|thermal|power|platform/i.test(structured)) addScope(scopes, 'SoC');
  if (scopes.length === 0) addScope(scopes, /tooling|cpp_ai/i.test(bucket) ? 'Tooling' : 'Framework');
  return scopes;
}

function normalizeDecisionActions(actions = [], section = {}, issue = {}, overclaimRisk = 'Medium') {
  const normalized = normalizeEnumArray(actions, DECISION_ACTION_VALUES, ['Watch']);
  let output = normalized;
  if (normalized.includes('Ignore')) {
    output = ['Ignore'];
  }
  if (hasSourceGapRisk(section, issue) || overclaimRisk === 'High' || isFallbackOnly(section, issue)) {
    output = output.filter(action => action !== 'Adopt');
  }
  if (output.includes('Adopt') && !output.includes('Test')) {
    output = ['Test', ...output];
  }
  output = [...new Set(output)].sort((left, right) => actionRank(left) - actionRank(right));
  return output.length > 0 ? output : ['Watch'];
}

function deriveReaderAction(section = {}, issue = {}, overclaimRisk = 'Medium') {
  if (hasSourceGapRisk(section, issue) || hasForbiddenOrWatchlistPromotion(section, issue)) return ['Watch'];
  const combined = combinedSectionText(section, issue);
  const directHal = isDirectHalSourceConfirmed(section, issue);
  let actions = ['Watch'];
  if (directHal || /test|measure|metric|Camera ITS|CTS|VTS|검증|테스트|측정|비교|점검/i.test(combined)) {
    actions.push('Test');
  }
  if (
    overclaimRisk !== 'High' &&
    !isFallbackOnly(section, issue) &&
    (directHal || /owner_metric_log|measurable_test/i.test(combined))
  ) {
    actions.push('Adopt');
  }
  return normalizeDecisionActions(actions, section, issue, overclaimRisk);
}

function deriveDecisionMetadata(section = {}, issue = {}) {
  const decisionSection = sanitizeSectionForPublicDecision(section);
  const overclaimRisk = deriveOverclaimRisk(decisionSection, issue);
  return {
    impact: deriveReaderImpact(decisionSection, issue),
    scope: deriveReaderScope(decisionSection, issue),
    action: deriveReaderAction(decisionSection, issue, overclaimRisk),
    overclaim_risk: overclaimRisk
  };
}

function normalizeDecisionMetadata(value = {}, section = {}, issue = {}) {
  return deriveDecisionMetadata(section, issue);
}

function normalizeEditorialStory(value = {}) {
  const story = isPlainObject(value) ? value : {};
  return EDITORIAL_STORY_KEYS.reduce((output, key) => {
    output[key] = compactText(story[key]);
    return output;
  }, {});
}

function publicArticleForSection(section = {}, { issue = {}, requireStoryContract = false } = {}) {
  const raw = isPlainObject(section.public_article) ? section.public_article : {};
  const storyState = storyContractMarkers(issue, section, { requireStoryContract });
  const sourceLinks = ensureArray(raw.source_links)
    .map(normalizeSourceLink)
    .filter(Boolean);
  const normalized = {
    headline: compactText(raw.headline),
    lead: compactText(raw.lead),
    body_paragraphs: normalizeStringArray(raw.body_paragraphs),
    camera_hal_takeaway: compactText(raw.camera_hal_takeaway),
    reader_checkpoints: normalizeStringArray(raw.reader_checkpoints),
    source_links: sourceLinks
  };
  const storyEnabled = (storyState.required || storyState.hasStoryField) && !storyState.hasUnsupportedMarker;
  if (storyEnabled) {
    normalized.story_contract_version = STORY_CONTRACT_VERSION;
    normalized.source_subtitle = compactText(raw.source_subtitle);
    normalized.editorial_story = normalizeEditorialStory(raw.editorial_story);
    normalized.decision_metadata = normalizeDecisionMetadata(raw.decision_metadata, section, issue);
  }

  return normalized;
}

const GENERIC_CHECKPOINT_PHRASES = Object.freeze([
  NO_IMMEDIATE_ACTION_TEXT,
  '참고 동향으로만 공유합니다',
  '즉시 조치할 항목은 없습니다',
  '관련 내용을 모니터링합니다',
  '필요 시 검토합니다',
  '팀 내 공유합니다'
]);

const CHECKPOINT_GENERIC_TOKENS = new Set([
  'android',
  'camera',
  'hal',
  'update',
  'release',
  'change',
  'issue',
  '관련',
  '확인',
  '검토',
  '공유'
]);

const HAL_VALIDATION_TARGET_PATTERN = /request\/result|request|result|metadata|stream configuration|stream metadata checks|stream|buffer lifecycle|buffer|vendor tag|capture session|Camera ITS|CameraX interop|Camera2 compatibility|CameraX|Camera2|Camera API|camera permission|권한 선언|preview\/capture|aspect ratio|rotation|crop|CTS|VTS|device matrix|app compatibility|dependency version|release note|branch|owner|test scenario|log|metric|preview latency|frame|format negotiation|HAL\/driver|driver|vendor|pipeline|codec|ISP|SoC/i;
const SOURCE_BOUND_LIMITATION_PATTERN = /HAL\/driver 변경 근거는 없음|HAL API 변경 소식은 아니므로|직접 언급하지 않으므로|변경 신호가 아니라|앱\/API 영향 범위로 제한|release note 범위 내 확인|직접 HAL|확대 해석하지|해석하지|주장하지|과장하지|source 범위|공개 출처|근거는 없음|범위로 제한/i;
const ACTION_VERB_PATTERN = /확인|비교|점검|추적|분리|테스트|추가|검증|review|compare|check|track|test|measure|profile|inspect|assign/i;
const ACTION_TARGET_PATTERN = /log|CTS|VTS|Camera ITS|device matrix|compatibility|release note|branch|owner|test scenario|metric|latency|frame|stream|buffer|metadata|vendor tag|capture session|CameraX|Camera2|Camera API|권한|사용 방식|preview\/capture|aspect ratio|rotation|crop|HAL|driver|API|build flag|dependency|performance|preview|format|pipeline/i;
const NON_GENERIC_ACTION_TARGET_PATTERN = /Camera ITS|Camera API|권한 선언|사용 방식|preview\/capture|aspect ratio|rotation|crop|request\/result|stream metadata checks|stream configuration|buffer lifecycle|vendor tag|capture session|preview regression|preview latency|format negotiation|dependency version|build flag|performance|pipeline|codec|ISP|SoC|log|metric|latency|frame/i;

function wordTokens(value) {
  return String(value || '')
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9+.#_-]*|[가-힣]{2,}/g) || [];
}

function sourceSpecificTokens(section = {}) {
  const values = [
    section.headline,
    section.category,
    ...ensureArray(section.sources).flatMap(source => [source?.title, source?.publisher, source?.url]),
    section.source_candidate_url,
    section.published_date,
    section.version_or_release
  ];
  return new Set(wordTokens(values.join(' ')).filter(token => !CHECKPOINT_GENERIC_TOKENS.has(token) && token.length > 2));
}

function normalizedCheckpointText(value) {
  return compactText(value).toLowerCase();
}

function isGenericCheckpoint(value) {
  const normalized = normalizedCheckpointText(value);
  if (!normalized) return true;
  if (GENERIC_CHECKPOINT_PHRASES.some(phrase => normalized.includes(String(phrase).toLowerCase()))) return true;
  const tokens = wordTokens(value);
  return tokens.length > 0 && tokens.every(token => CHECKPOINT_GENERIC_TOKENS.has(token));
}

function isConcreteCheckpoint(value, section = {}) {
  if (isGenericCheckpoint(value)) return false;
  if (publicProseLeakageIssues(value).length > 0) return false;
  const normalized = compactText(value);
  const tokens = wordTokens(value);
  const specific = sourceSpecificTokens(section);
  const sourceTokenCount = tokens.filter(token => specific.has(token)).length;
  const hasAction = ACTION_VERB_PATTERN.test(normalized);
  const hasTarget = ACTION_TARGET_PATTERN.test(normalized);
  const hasValidationTarget = HAL_VALIDATION_TARGET_PATTERN.test(normalized);
  const hasNonGenericTarget = NON_GENERIC_ACTION_TARGET_PATTERN.test(normalized);
  const hasSourceBoundLimitation = SOURCE_BOUND_LIMITATION_PATTERN.test(normalized);
  return (
    (sourceTokenCount >= 2 && hasAction && hasNonGenericTarget) ||
    (hasSourceBoundLimitation && hasValidationTarget) ||
    (hasValidationTarget && hasAction && hasTarget && hasNonGenericTarget)
  );
}

function checkpointConcreteIssues(section = {}, checkpoints = [], index = 0, headline = '') {
  const issues = [];
  const normalized = checkpoints.map(normalizedCheckpointText).filter(Boolean);
  const unique = new Set(normalized);
  if (unique.size < normalized.length) {
    issues.push({ index: index + 1, headline, type: 'duplicate_internal_reader_checkpoint' });
  }
  const prefixes = new Set();
  for (const item of normalized) {
    const prefix = item.split(/\s+/).slice(0, 6).join(' ');
    if (!prefix) continue;
    if (prefixes.has(prefix)) {
      issues.push({ index: index + 1, headline, type: 'duplicate_internal_reader_checkpoint_prefix', prefix });
      break;
    }
    prefixes.add(prefix);
  }
  const concrete = checkpoints.filter(item => isConcreteCheckpoint(item, section));
  if (concrete.length < 2) {
    issues.push({
      index: index + 1,
      headline,
      type: 'insufficient_concrete_internal_reader_checkpoints',
      actualCount: concrete.length,
      expectedMinCount: 2
    });
  }
  return issues;
}

const DETERMINISTIC_ARTICLE_FIELDS = Object.freeze([
  'relevance_bucket',
  'impact_claim_level',
  'finalSelectionEligibility',
  'source_gap_risk',
  'main_article_readiness',
  'do_not_claim'
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function publicArticleIsValid(section = {}) {
  const copy = cloneJson(section);
  return validatePublicArticle(copy).length === 0;
}

function publicArticleMergeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = {
    reason: code,
    ...details
  };
  return error;
}

function sectionCandidateHash(section = {}) {
  return compactText(
    section.source_candidate_hash ||
    section.sourceCandidateHash ||
    section.url_hash ||
    section.urlHash
  );
}

function sectionSourceUrlKeys(section = {}) {
  const values = [
    section.source_candidate_url,
    section.sourceCandidateUrl,
    section.url,
    ...ensureArray(section.sources).map(source => source?.url || source),
    ...ensureArray(section.public_article?.source_links).map(source => source?.url || source)
  ];
  return [...new Set(values.map(normalizedSourceUrlKey).filter(Boolean))];
}

function sectionTitleKeys(section = {}) {
  return [...new Set([
    section.headline,
    section.title,
    section.public_article?.headline
  ].map(value => compactText(value).toLowerCase()).filter(Boolean))];
}

function sectionMergeLabel(section = {}) {
  return compactText(section.public_article?.headline || section.headline || section.title || section.category || 'untitled');
}

function matchingSectionIndexes(baseSections = [], llmSection = {}) {
  const hash = sectionCandidateHash(llmSection);
  if (hash) {
    const matches = baseSections
      .map((section, index) => sectionCandidateHash(section) === hash ? index : -1)
      .filter(index => index >= 0);
    if (matches.length === 1) return { index: matches[0], strategy: 'source_candidate_hash' };
    if (matches.length > 1) {
      throw publicArticleMergeError('ambiguous_section_match', 'LLM section matched multiple base sections by source_candidate_hash.', {
        strategy: 'source_candidate_hash',
        match_count: matches.length,
        llm_section: sectionMergeLabel(llmSection)
      });
    }
  }

  const llmUrlKeys = sectionSourceUrlKeys(llmSection);
  if (llmUrlKeys.length > 0) {
    const llmUrlKeySet = new Set(llmUrlKeys);
    const matches = baseSections
      .map((section, index) => sectionSourceUrlKeys(section).some(key => llmUrlKeySet.has(key)) ? index : -1)
      .filter(index => index >= 0);
    if (matches.length === 1) return { index: matches[0], strategy: 'normalized_source_url' };
    if (matches.length > 1) {
      throw publicArticleMergeError('ambiguous_section_match', 'LLM section matched multiple base sections by normalized source URL.', {
        strategy: 'normalized_source_url',
        match_count: matches.length,
        llm_section: sectionMergeLabel(llmSection)
      });
    }
  }

  const titleKeys = sectionTitleKeys(llmSection);
  if (titleKeys.length > 0) {
    const titleKeySet = new Set(titleKeys);
    const matches = baseSections
      .map((section, index) => sectionTitleKeys(section).some(key => titleKeySet.has(key)) ? index : -1)
      .filter(index => index >= 0);
    if (matches.length === 1) return { index: matches[0], strategy: 'unique_title' };
    throw publicArticleMergeError('ambiguous_section_match', 'LLM section title fallback was not unique.', {
      strategy: 'unique_title',
      match_count: matches.length,
      llm_section: sectionMergeLabel(llmSection)
    });
  }

  throw publicArticleMergeError('unmatched_llm_section', 'LLM section did not include a usable section identity.', {
    llm_section: sectionMergeLabel(llmSection)
  });
}

function mergePublicArticlesFromLlmSections(baseSections = [], llmSections = [], capsules = []) {
  const base = ensureArray(baseSections).map(section => cloneJson(section));
  const llm = ensureArray(llmSections);
  const usedBaseIndexes = new Set();
  const matchRecords = [];

  for (const section of llm) {
    const match = matchingSectionIndexes(base, section);
    if (usedBaseIndexes.has(match.index)) {
      throw publicArticleMergeError('ambiguous_section_match', 'Multiple LLM sections matched the same base section.', {
        strategy: match.strategy,
        base_index: match.index,
        llm_section: sectionMergeLabel(section)
      });
    }
    usedBaseIndexes.add(match.index);
    matchRecords.push({ ...match, section });
  }

  for (const { index, section } of matchRecords) {
    base[index] = mergePublicArticleFromLlm(base[index], section, capsules[index] || {});
  }

  for (let index = 0; index < base.length; index += 1) {
    if (usedBaseIndexes.has(index)) continue;
    if (publicArticleIsValid(base[index])) continue;
    throw publicArticleMergeError('missing_llm_section_public_article_invalid', 'Missing LLM section public_article is invalid; refusing to synthesize public prose.', {
      base_index: index,
      base_section: sectionMergeLabel(base[index])
    });
  }

  return base;
}

function mergePublicArticleFromLlm(baseSection = {}, llmSection = {}, capsule = {}) {
  const merged = {
    ...cloneJson(baseSection || {}),
    public_article: isPlainObject(llmSection?.public_article)
      ? cloneJson(llmSection.public_article)
      : cloneJson(baseSection?.public_article || {})
  };
  if (ensureArray(baseSection?.sources).length > 0) {
    merged.sources = cloneJson(baseSection.sources);
  }
  for (const field of DETERMINISTIC_ARTICLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(capsule || {}, field)) {
      merged[field] = cloneJson(capsule[field]);
    } else if (Object.prototype.hasOwnProperty.call(baseSection || {}, field)) {
      merged[field] = cloneJson(baseSection[field]);
    } else {
      delete merged[field];
    }
  }
  merged.public_article = publicArticleForSection(merged);
  const sourceIssues = publicSourceLinkMergeIssues(merged);
  if (sourceIssues.length > 0) {
    throw publicArticleMergeError('invalid_public_source_links', 'LLM public_article source_links failed provenance validation.', {
      issues: sourceIssues
    });
  }
  return merged;
}

function publicSourceLinkMergeIssues(section = {}) {
  const issues = [];
  const allowedSourceUrlRoles = allowedPublicSourceUrlRoleMap(section);
  ensureArray(section.public_article?.source_links).forEach((source, sourceIndex) => {
    const linkIssues = sourceLinkIssues(source, sourceIndex, {
      allowedSourceUrlRoles,
      allowRelatedContext: section.allow_related_context_source_links === true
    });
    const urlError = publicUrlError(source?.url);
    if (!urlError && allowedSourceUrlRoles.size === 0) {
      linkIssues.push({
        type: 'invalid_source_link',
        index: sourceIndex,
        field: 'url',
        reason: 'url_not_in_allowed_source_set',
        value: source?.url
      });
    }
    issues.push(...linkIssues.filter(issue => (
      issue.type === 'invalid_source_link' ||
      issue.type === 'unexpected_source_link_keys'
    )));
  });
  return issues;
}

function publicArticleAllowedKeysFor(storyState) {
  return storyState.required ||
    storyState.hasStoryField ||
    storyState.markerCount > 0 ||
    storyState.rawMarkerCount > 0
    ? PUBLIC_ARTICLE_ALLOWED_KEYS
    : PUBLIC_ARTICLE_BASE_REQUIRED_KEYS;
}

function validateDecisionMetadataShape(metadata = {}, index, headline) {
  const issues = [];
  if (!isPlainObject(metadata)) {
    return [{ index: index + 1, headline, type: 'invalid_decision_metadata', reason: 'not_object' }];
  }
  if (!DECISION_IMPACT_VALUES.includes(metadata.impact)) {
    issues.push({ index: index + 1, headline, type: 'invalid_decision_metadata', key: 'impact', allowed: DECISION_IMPACT_VALUES });
  }
  if (!DECISION_RISK_VALUES.includes(metadata.overclaim_risk)) {
    issues.push({ index: index + 1, headline, type: 'invalid_decision_metadata', key: 'overclaim_risk', allowed: DECISION_RISK_VALUES });
  }
  const scope = ensureArray(metadata.scope);
  if (scope.length === 0 || scope.some(item => !DECISION_SCOPE_VALUES.includes(item))) {
    issues.push({ index: index + 1, headline, type: 'invalid_decision_metadata', key: 'scope', allowed: DECISION_SCOPE_VALUES });
  }
  const action = ensureArray(metadata.action);
  if (action.length === 0 || action.some(item => !DECISION_ACTION_VALUES.includes(item))) {
    issues.push({ index: index + 1, headline, type: 'invalid_decision_metadata', key: 'action', allowed: DECISION_ACTION_VALUES });
  }
  if (action.includes('Ignore') && action.length > 1) {
    issues.push({ index: index + 1, headline, type: 'invalid_decision_metadata', key: 'action', reason: 'ignore_is_exclusive' });
  }
  if (action.includes('Adopt') && !action.includes('Test')) {
    issues.push({ index: index + 1, headline, type: 'invalid_decision_metadata', key: 'action', reason: 'adopt_requires_test' });
  }
  if (metadata.overclaim_risk === 'High' && action.includes('Adopt')) {
    issues.push({ index: index + 1, headline, type: 'invalid_decision_metadata', key: 'action', reason: 'adopt_blocked_by_high_overclaim_risk' });
  }
  return issues;
}

function scenarioLooksFactual(value) {
  const normalized = compactText(value);
  if (!normalized) return false;
  if (/가정|상황|할 수 있|가능성|확인해야|검토해야|점검할/i.test(normalized)) return false;
  return /발생했|발생했다|깨졌|고장|누수|drop|드롭|crash|regression|회귀가 발생|문제가 발생/i.test(normalized);
}

function validatePublicArticle(section = {}, index = 0, options = {}) {
  const issues = [];
  const headline = compactText(section.headline || section.category || `article ${index + 1}`);
  if (!isPlainObject(section.public_article)) {
    return [{
      index: index + 1,
      headline,
      type: 'missing_public_article',
      keys: options.requireStoryContract === true ? PUBLIC_ARTICLE_STORY_REQUIRED_KEYS : PUBLIC_ARTICLE_REQUIRED_KEYS
    }];
  }
  const raw = section.public_article;
  const issue = options.issue || {};
  const storyState = storyContractMarkers(issue, section, {
    requireStoryContract: options.requireStoryContract === true
  });
  for (const unsupported of storyState.unsupported) {
    issues.push({
      index: index + 1,
      headline,
      ...unsupported
    });
  }
  if (storyState.mismatch) {
    issues.push({
      index: index + 1,
      headline,
      type: 'story_contract_version_mismatch',
      marker_count: storyState.markerCount,
      has_issue_story_marker: storyState.hasIssueStoryMarker,
      has_generation_marker: storyState.hasGenerationMarker,
      has_section_story_marker: storyState.hasSectionStoryMarker,
      has_story_field: storyState.hasStoryField
    });
  }
  const allowedKeys = publicArticleAllowedKeysFor(storyState);
  const unexpected = Object.keys(raw).filter(key => !allowedKeys.includes(key));
  if (unexpected.length > 0) {
    issues.push({ index: index + 1, headline, type: 'unexpected_public_article_keys', keys: unexpected });
  }
  const normalized = publicArticleForSection(section, {
    issue,
    requireStoryContract: storyState.required
  });
  for (const key of ['headline', 'lead', 'camera_hal_takeaway']) {
    if (!normalized[key]) issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key });
  }
  if (normalized.body_paragraphs.length < 2) {
    issues.push({ index: index + 1, headline, type: 'insufficient_public_body_paragraphs', key: 'body_paragraphs', actualCount: normalized.body_paragraphs.length, expectedMinCount: 2 });
  }
  if (normalized.reader_checkpoints.length === 0) {
    issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key: 'reader_checkpoints' });
  }
  if (normalized.source_links.length === 0) {
    issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key: 'source_links' });
  }
  if (storyState.required || storyState.hasStoryField) {
    if (contractVersion(raw.story_contract_version) < STORY_CONTRACT_VERSION) {
      issues.push({ index: index + 1, headline, type: 'missing_story_public_article_field', key: 'story_contract_version' });
    }
    if (!compactText(raw.source_subtitle)) {
      issues.push({ index: index + 1, headline, type: 'missing_story_public_article_field', key: 'source_subtitle' });
    }
    if (!isPlainObject(raw.editorial_story)) {
      issues.push({ index: index + 1, headline, type: 'missing_story_public_article_field', key: 'editorial_story' });
    } else {
      const story = normalizeEditorialStory(raw.editorial_story);
      for (const key of EDITORIAL_STORY_KEYS) {
        if (!story[key]) {
          issues.push({ index: index + 1, headline, type: 'empty_editorial_story_field', key });
        }
      }
      if (scenarioLooksFactual(story.reader_scenario)) {
        issues.push({
          index: index + 1,
          headline,
          type: 'reader_scenario_factual_boundary',
          key: 'reader_scenario',
          reason: 'reader_scenario_must_be_hypothetical'
        });
      }
    }
    issues.push(...validateDecisionMetadataShape(normalized.decision_metadata || raw.decision_metadata, index, headline));
  }
  for (const [field, value] of Object.entries({
    headline: normalized.headline,
    lead: normalized.lead,
    camera_hal_takeaway: normalized.camera_hal_takeaway,
    body_paragraphs: normalized.body_paragraphs,
    reader_checkpoints: normalized.reader_checkpoints,
    source_subtitle: normalized.source_subtitle || '',
    editorial_story: normalized.editorial_story || {}
  })) {
    for (const message of publicProseLeakageIssues(value, `public_article.${field}`)) {
      issues.push({ index: index + 1, headline, type: 'public_article_leakage', key: field, message });
    }
  }
  const allowedSourceUrlRoles = allowedPublicSourceUrlRoleMap(section);
  ensureArray(raw.source_links).forEach((source, sourceIndex) => {
    for (const issue of sourceLinkIssues(source, sourceIndex, {
      allowedSourceUrlRoles,
      allowRelatedContext: section.allow_related_context_source_links === true
    })) {
      issues.push({ index: index + 1, headline, ...issue });
    }
  });
  // Semantic validation also normalizes public_article for downstream render and quality paths.
  section.public_article = normalized;
  return issues;
}

module.exports = {
  DECISION_ACTION_VALUES,
  DECISION_IMPACT_VALUES,
  DECISION_RISK_VALUES,
  DECISION_SCOPE_VALUES,
  EDITORIAL_STORY_KEYS,
  GENERATION_CONTRACT_VERSION,
  NO_IMMEDIATE_ACTION_TEXT,
  PUBLIC_ARTICLE_ALLOWED_KEYS,
  PUBLIC_ARTICLE_BASE_REQUIRED_KEYS,
  PUBLIC_ARTICLE_REQUIRED_KEYS,
  PUBLIC_ARTICLE_STORY_REQUIRED_KEYS,
  STORY_CONTRACT_VERSION,
  STORY_PUBLIC_CONTRACT_VERSION,
  PUBLIC_SOURCE_LINK_ALLOWED_KEYS,
  PUBLIC_SOURCE_ROLES,
  allowedPublicSourceUrlKeys,
  allowedPublicSourceUrlRoleMap,
  deriveDecisionMetadata,
  detectStoryContractMismatch,
  isConcreteCheckpoint,
  mergePublicArticleFromLlm,
  mergePublicArticlesFromLlmSections,
  requiresStoryContract,
  storyContractMarkers,
  publicProseLeakageIssues,
  publicArticleForSection,
  publicUrlError,
  sourceLinkIssues,
  validatePublicArticle,
  isFallbackOnly
};
