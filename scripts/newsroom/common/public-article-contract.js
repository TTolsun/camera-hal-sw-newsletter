const PUBLIC_ARTICLE_REQUIRED_KEYS = Object.freeze([
  'headline',
  'lead',
  'body_paragraphs',
  'camera_hal_takeaway',
  'reader_checkpoints',
  'source_links'
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
} = require('./source-url-key');

const NO_IMMEDIATE_ACTION_TEXT = '즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function compactText(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

function publicSafeText(value) {
  return compactText(value)
    .replace(/\bTooling Watch \/ Fallback:\s*/gi, '')
    .replace(/\bFallback\b/gi, 'Watch')
    .replace(/\bReview-only\b/gi, '참고 동향')
    .replace(/\bquality gate\b/gi, 'quality review')
    .replace(/자동 정상 발행 기준/g, '검토 기준')
    .replace(/자동 발행 기준/g, '검토 기준')
    .replace(/편집자 확인 후 merge/g, '검토')
    .replace(/merge 발행/g, '발행')
    .replace(/\bcandidate\b/gi, 'source item')
    .trim();
}

function normalizePublicSourceRole(value) {
  const role = compactText(value);
  if (!role) return '';
  if (PUBLIC_SOURCE_ROLES.includes(role)) return role;
  return PUBLIC_SOURCE_ROLE_ALIASES[role] || role;
}

const HARD_PUBLIC_IDENTIFIERS = Object.freeze([
  'source_gap_risk',
  'finalSelectionEligibility',
  'candidate_pool_preflight',
  'relevance_bucket',
  'impact_claim_level',
  'do_not_claim',
  'do_not_overstate',
  'hal_signal_capsule',
  'HAL Signal Capsule',
  'article_sections',
  'specificity_checks',
  'overclaim_guardrails',
  'main_article_readiness',
  'reader_owners',
  'check_within_2_weeks',
  'why_now',
  'impact_axes',
  'review_only',
  'cpp_ai_tooling_fallback',
  'generic_tech_watchlist',
  'source_dedup',
  'processed_source_event_ids',
  'processed_evidence_ids',
  'previous_values',
  'current_values',
  'data/source-snapshots/',
  'content/source-events/',
  '자동 정상 발행 기준',
  '자동 발행 기준',
  '편집자 확인 후 merge',
  'merge 발행',
  'Review-only 발행본',
  '편집자 검토 후 공개 가능한',
  '편집자 검토 후 발행 가능한'
]);

const LEGACY_PUBLIC_FORBIDDEN_TERMS = Object.freeze([
  'Review-only',
  'Fallback',
  'editor review',
  'normal publishable coverage',
  'section repair',
  'hard failure',
  'candidate shortage',
  'survivor',
  'donor',
  '중복 issue',
  '구조화 필드',
  'publish gate'
]);

const CONTEXTUAL_PUBLIC_TERMS = Object.freeze([
  'deterministic',
  'guardrail',
  'validator',
  'validation gate',
  'quality gate',
  'quality threshold',
  'publish-ready',
  'claim binding',
  'claim-binding',
  'overclaim'
]);

const CONTEXTUAL_INTERNAL_MARKERS = Object.freeze([
  'internal',
  'debug',
  'report',
  'failure',
  'failed',
  'output',
  'diagnostic',
  'diagnostics',
  'gate',
  'policy',
  'schema',
  'contract',
  'pipeline',
  'public_article',
  'editor draft',
  'validation'
]);

const CONTEXTUAL_ALLOW_PHRASES = Object.freeze([
  'API validator',
  'input validator',
  'form validator',
  'schema validator library',
  'static analysis validator',
  'Android Studio validator'
]);

const CONTEXTUAL_FAIL_PHRASES = Object.freeze([
  'internal validator report',
  'validator report',
  'quality gate output',
  'internal validator',
  'debug validator result',
  'claim binding failure',
  'claim-binding diagnostics',
  'overclaim guardrail',
  'overclaim check result',
  'internal guardrail output'
]);

const PUBLIC_PROSE_PLACEHOLDER_PATTERNS = Object.freeze([
  { pattern: /\bAPI\/component\/date\b/i, reason: 'api_component_date_placeholder' },
  { pattern: /\bsource title\/domain\/version\/date\b/i, reason: 'source_identity_placeholder' },
  { pattern: /\btest\/log\/metric\/API\b/i, reason: 'test_log_metric_api_placeholder' },
  { pattern: /\bbuild\/test\/debug metric\b/i, reason: 'build_test_debug_metric_placeholder' },
  { pattern: /\bcompatibility test scenario\b/i, reason: 'compatibility_test_scenario_placeholder' },
  { pattern: /관련\s+API\/component/i, reason: 'related_api_component_placeholder' },
  { pattern: /관련\s+API\/component\/date/i, reason: 'related_api_component_date_placeholder' },
  { pattern: /현재\s+device matrix와\s+맞는지/i, reason: 'device_matrix_fit_placeholder' },
  { pattern: /compatibility test scenario\s+또는\s+stream\/metadata/i, reason: 'test_scenario_stream_metadata_placeholder' },
  { pattern: /stream\/metadata\s+확인\s+항목/i, reason: 'stream_metadata_check_item_placeholder' },
  { pattern: /확인\s+항목만\s+추적합니다/i, reason: 'check_item_tracking_placeholder' },
  { pattern: /source\s+범위에서[^.!?。！？\r\n]*확인\s+항목을\s+점검합니다/i, reason: 'source_scope_check_item_placeholder' },
  { pattern: /release note 범위에서[^.!?。！？\r\n]*API\/component\/date/i, reason: 'release_note_placeholder_template' }
]);

function normalizedLeakText(value) {
  return compactText(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
}

function lowerLeakText(value) {
  return normalizedLeakText(value).toLowerCase();
}

function sentenceFragments(value) {
  return normalizedLeakText(value)
    .split(/(?<=[.!?。！？])\s+|(?<=[다요함음임됨됨니다]\.)\s+|[\r\n]+/u)
    .map(item => item.trim())
    .filter(Boolean);
}

function includesPhrase(textValue, phrase) {
  return textValue.includes(String(phrase || '').toLowerCase());
}

function sentenceAtIndex(value, index) {
  const normalized = normalizedLeakText(value);
  const matches = [...normalized.matchAll(/[^.!?。！？\r\n]+(?:[.!?。！？]+|$)/gu)];
  const match = matches.find(item => index >= item.index && index < item.index + item[0].length);
  return match ? match[0].trim() : '';
}

function hasAllowPhraseInContext(textValue, term) {
  return CONTEXTUAL_ALLOW_PHRASES
    .map(phrase => phrase.toLowerCase())
    .some(phrase => phrase.includes(term) && String(textValue || '').includes(phrase));
}

function contextualLeakReasons(value) {
  const normalized = normalizedLeakText(value);
  const lower = normalized.toLowerCase();
  const reasons = [];

  for (const phrase of CONTEXTUAL_FAIL_PHRASES) {
    if (includesPhrase(lower, phrase)) reasons.push(phrase);
  }

  for (const term of CONTEXTUAL_PUBLIC_TERMS) {
    const lowerTerm = term.toLowerCase();
    if (!lower.includes(lowerTerm)) continue;
    const termIndexes = [];
    let fromIndex = 0;
    while (fromIndex < lower.length) {
      const index = lower.indexOf(lowerTerm, fromIndex);
      if (index === -1) break;
      termIndexes.push(index);
      fromIndex = index + lowerTerm.length;
    }
    for (const index of termIndexes) {
      const windowText = lower.slice(Math.max(0, index - 40), index + lowerTerm.length + 40);
      const sameSentence = sentenceAtIndex(normalized, index).toLowerCase();
      if (
        hasAllowPhraseInContext(windowText, lowerTerm) ||
        hasAllowPhraseInContext(sameSentence, lowerTerm)
      ) {
        continue;
      }
      if (CONTEXTUAL_INTERNAL_MARKERS.some(marker => windowText.includes(marker))) {
        reasons.push(`${term}+internal_marker`);
        continue;
      }
      if (sameSentence) {
        if (CONTEXTUAL_INTERNAL_MARKERS.some(marker => sameSentence.includes(marker))) {
          reasons.push(`${term}+same_sentence_marker`);
        }
      }
    }
  }
  return [...new Set(reasons)];
}

function publicProseLeakageIssues(value, label = 'public text') {
  const lower = lowerLeakText(value);
  const normalized = normalizedLeakText(value);
  const issues = [];
  for (const term of HARD_PUBLIC_IDENTIFIERS) {
    if (lower.includes(String(term).toLowerCase())) {
      issues.push(`${label} contains hard internal identifier: ${term}`);
    }
  }
  for (const term of LEGACY_PUBLIC_FORBIDDEN_TERMS) {
    if (lower.includes(String(term).toLowerCase())) {
      issues.push(`${label} contains internal public-forbidden term: ${term}`);
    }
  }
  for (const reason of contextualLeakReasons(value)) {
    issues.push(`${label} contains contextual internal term: ${reason}`);
  }
  for (const { pattern, reason } of PUBLIC_PROSE_PLACEHOLDER_PATTERNS) {
    if (pattern.test(normalized)) {
      issues.push(`${label} contains validator-token prose instead of reader-facing prose: ${reason}`);
    }
  }
  return issues;
}

function hasInternalPublicTerm(value) {
  return publicProseLeakageIssues(value).length > 0;
}

function fallbackLeadText(sourceText, headline) {
  const fallback = `${headline || 'Camera HAL 관련 소식'}은 공개 출처가 확인한 범위 안에서 Camera HAL 독자가 참고할 만한 동향으로 정리했습니다.`;
  if (!sourceText || hasInternalPublicTerm(sourceText)) return fallback;
  return publicSafeText(sourceText);
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

function normalizePublicSafeStringArray(value) {
  return normalizeStringArray(value).map(publicSafeText).filter(Boolean);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function publicUrlError(value) {
  const raw = compactText(value);
  if (!raw) return 'missing_url';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return 'invalid_url';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'non_public_scheme';
  const urlText = raw.toLowerCase();
  if (
    urlText.includes('/.tmp/') ||
    urlText.includes('/content/newsroom/') ||
    urlText.includes('/content/collected-news/') ||
    urlText.includes('/content/source-events/') ||
    urlText.includes('/data/source-snapshots/')
  ) {
    return 'internal_artifact_url';
  }
  if (parsed.hostname === 'github.com' && /\/actions\/(?:runs|workflows)\//i.test(parsed.pathname)) {
    return 'github_actions_artifact_url';
  }
  return '';
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

function sourceLinksFromSection(section = {}) {
  return ensureArray(section.sources)
    .map(source => normalizeSourceLink({
      title: publicSafeText(source?.title || source?.url),
      url: source?.url,
      source_role: 'primary'
    }))
    .filter(source => source && source.title && source.url && !publicUrlError(source.url));
}

function fallbackParagraphs(section = {}) {
  const paragraphs = normalizePublicSafeStringArray([
    section.background,
    section.camera_hal_perspective || section.why_it_matters
  ]);
  while (paragraphs.length < 2) {
    paragraphs.push('이 항목은 공개 출처가 제공한 범위 안에서만 참고 동향으로 공유합니다.');
  }
  return paragraphs.slice(0, 4);
}

function sectionBucket(section = {}) {
  return compactText(section.relevance_bucket || section.bucket || section.impact_claim_level || section.category);
}

function publicComponentText(section = {}) {
  return publicSafeText(
    section.api_or_component ||
    section.apiOrComponent ||
    section.component ||
    section.category ||
    section.headline ||
    'Camera 관련 항목'
  );
}

function buildToolingFallbackCheckpoints(section = {}) {
  const headline = `${section.headline || section.category || ''}`;
  if (/AI Studio/i.test(headline)) {
    return [
      'AI Studio가 만든 샘플 앱이 Camera API를 호출할 수 있으므로, prototype 단계에서 Camera 권한과 CameraX/Camera2 사용 방식을 확인합니다.',
      '이 소스는 HAL/driver 변경을 직접 언급하지 않으므로 vendor camera pipeline 영향으로 확대 해석하지 않습니다.'
    ];
  }
  return [
    'native tooling이나 prototype 코드가 Camera API를 호출한다면, Camera 권한과 preview/capture 호출 흐름만 확인합니다.',
    '이 소스는 production HAL runtime 변경을 직접 언급하지 않으므로 vendor camera pipeline 영향으로 확대 해석하지 않습니다.'
  ];
}

function buildCameraApiFallbackCheckpoints() {
  return [
    'CameraX preview가 다양한 화면 크기에서 aspect ratio와 rotation을 유지하는지 app/framework 레벨에서 확인합니다.',
    '이 소스는 HAL API 변경을 직접 언급하지 않으므로, HAL/driver 변경 신호가 아니라 preview layout 회귀 가능성으로만 해석합니다.'
  ];
}

function buildDirectHalFallbackCheckpoints(section = {}) {
  const component = publicComponentText(section);
  return [
    `${component}가 request/result, stream configuration, buffer lifecycle 중 어떤 HAL 계약과 연결되는지 source 근거 안에서 확인합니다.`,
    'source가 직접 뒷받침하지 않는 driver branch, vendor tag, pipeline 변경 주장은 분리합니다.'
  ];
}

function buildLowImpactFallbackCheckpoints(section = {}) {
  const component = publicComponentText(section);
  return [
    `${component}와 직접 연결된 공개 출처의 Camera API나 component 변화만 확인합니다.`,
    'HAL/driver 변경 근거가 없으면 request/result나 vendor tag 변화로 해석하지 않습니다.'
  ];
}

function fallbackCheckpoints(section = {}) {
  const actions = normalizePublicSafeStringArray(section.action_items)
    .filter(item => !/source URL|published date|Publication|Direct HAL behavior claim|watch\/supporting context|다음 issue|후속 release note/i.test(item));
  if (actions.length >= 2) return actions;
  const bucket = sectionBucket(section);
  let generated;
  if (/cpp_ai_tooling|tooling|native/i.test(bucket)) {
    generated = buildToolingFallbackCheckpoints(section);
  } else if (/android_platform_camera_adjacent|android_camera_api|android_camera|multimedia|CameraX|Camera2/i.test(bucket)) {
    generated = buildCameraApiFallbackCheckpoints(section);
  } else if (/direct|camera_driver|image_pipeline|direct_aosp_camera|camera_stack/i.test(bucket)) {
    generated = buildDirectHalFallbackCheckpoints(section);
  } else {
    generated = buildLowImpactFallbackCheckpoints(section);
  }
  return [
    ...actions,
    ...generated
  ].slice(0, 3);
}

function publicArticleForSection(section = {}, { allowLegacyFallback = true } = {}) {
  const raw = isPlainObject(section.public_article) ? section.public_article : {};
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

  if (!allowLegacyFallback) return normalized;

  if (!normalized.headline) normalized.headline = publicSafeText(section.headline || section.category || 'Camera HAL 관련 소식');
  if (!normalized.lead) normalized.lead = fallbackLeadText(section.what_changed || section.summary || section.evidence_summary, normalized.headline);
  if (normalized.body_paragraphs.length < 2) normalized.body_paragraphs = fallbackParagraphs(section);
  if (!normalized.camera_hal_takeaway) {
    normalized.camera_hal_takeaway = publicSafeText(section.camera_hal_perspective || section.why_it_matters || 'Camera HAL / Driver 관점의 직접 영향은 공개 출처가 확인한 범위에서만 해석합니다.');
  }
  if (normalized.reader_checkpoints.length === 0) normalized.reader_checkpoints = fallbackCheckpoints(section);
  if (normalized.source_links.length === 0) normalized.source_links = sourceLinksFromSection(section);
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
    issues.push({ index: index + 1, headline, type: 'duplicate_public_checkpoint' });
  }
  const prefixes = new Set();
  for (const item of normalized) {
    const prefix = item.split(/\s+/).slice(0, 6).join(' ');
    if (!prefix) continue;
    if (prefixes.has(prefix)) {
      issues.push({ index: index + 1, headline, type: 'duplicate_public_checkpoint_prefix', prefix });
      break;
    }
    prefixes.add(prefix);
  }
  const concrete = checkpoints.filter(item => isConcreteCheckpoint(item, section));
  if (concrete.length < 2) {
    issues.push({
      index: index + 1,
      headline,
      type: 'insufficient_concrete_public_checkpoints',
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
    base[index].public_article = publicArticleForSection(base[index]);
    if (!publicArticleIsValid(base[index])) {
      throw publicArticleMergeError('missing_llm_section_public_article_invalid', 'Missing LLM section could not be repaired with fallback public_article.', {
        base_index: index,
        base_section: sectionMergeLabel(base[index])
      });
    }
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
  merged.public_article = publicArticleForSection(merged, { allowLegacyFallback: false });
  return merged;
}

function validatePublicArticle(section = {}, index = 0) {
  const issues = [];
  const headline = compactText(section.headline || section.category || `article ${index + 1}`);
  if (!isPlainObject(section.public_article)) {
    return [{
      index: index + 1,
      headline,
      type: 'missing_public_article',
      keys: PUBLIC_ARTICLE_REQUIRED_KEYS
    }];
  }
  const raw = section.public_article;
  const unexpected = Object.keys(raw).filter(key => !PUBLIC_ARTICLE_REQUIRED_KEYS.includes(key));
  if (unexpected.length > 0) {
    issues.push({ index: index + 1, headline, type: 'unexpected_public_article_keys', keys: unexpected });
  }
  const normalized = publicArticleForSection(section, { allowLegacyFallback: false });
  for (const key of ['headline', 'lead', 'camera_hal_takeaway']) {
    if (!normalized[key]) issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key });
  }
  if (normalized.body_paragraphs.length < 2) {
    issues.push({ index: index + 1, headline, type: 'insufficient_public_body_paragraphs', key: 'body_paragraphs', actualCount: normalized.body_paragraphs.length, expectedMinCount: 2 });
  }
  if (normalized.reader_checkpoints.length === 0) {
    issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key: 'reader_checkpoints' });
  }
  issues.push(...checkpointConcreteIssues(section, normalized.reader_checkpoints, index, headline));
  if (normalized.source_links.length === 0) {
    issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key: 'source_links' });
  }
  for (const [field, value] of Object.entries({
    headline: normalized.headline,
    lead: normalized.lead,
    camera_hal_takeaway: normalized.camera_hal_takeaway,
    body_paragraphs: normalized.body_paragraphs,
    reader_checkpoints: normalized.reader_checkpoints
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
  NO_IMMEDIATE_ACTION_TEXT,
  PUBLIC_ARTICLE_REQUIRED_KEYS,
  PUBLIC_SOURCE_LINK_ALLOWED_KEYS,
  PUBLIC_SOURCE_ROLES,
  allowedPublicSourceUrlKeys,
  allowedPublicSourceUrlRoleMap,
  isConcreteCheckpoint,
  mergePublicArticleFromLlm,
  mergePublicArticlesFromLlmSections,
  publicProseLeakageIssues,
  publicArticleForSection,
  publicUrlError,
  sourceLinkIssues,
  validatePublicArticle
};
