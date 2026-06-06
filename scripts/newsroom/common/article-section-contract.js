const { ensureArray } = require('./value-coercion');
const ARTICLE_SECTION_REQUIRED_KEYS = Object.freeze([
  'verified_facts',
  'background_context',
  'hal_driver_impact',
  'action_items',
  'team_share_points'
]);

const ARTICLE_SECTION_OPTIONAL_KEYS = Object.freeze([
  'known_limitations',
  'watch_items',
  'do_not_claim'
]);

const ARTICLE_SECTION_ALLOWED_KEYS = Object.freeze([
  ...ARTICLE_SECTION_REQUIRED_KEYS,
  ...ARTICLE_SECTION_OPTIONAL_KEYS
]);

// Backward-compatible alias for existing required-key consumers.
const ARTICLE_SECTION_KEYS = ARTICLE_SECTION_REQUIRED_KEYS;

const ARTICLE_SECTION_LABELS = Object.freeze({
  verified_facts: '확인한 사실 / 릴리스 요약',
  background_context: '배경지식 / 왜 AOSP Camera 팀이 볼 만한가',
  hal_driver_impact: 'Camera HAL/Driver 관점 / 적용 가능 지점',
  action_items: '실행 항목 / PoC 제안 및 검증 기준',
  team_share_points: '팀 공유 포인트 / 결론',
  known_limitations: '제한 / 주의',
  watch_items: '추적 항목'
});

const LIMITATION_VISIBILITY = Object.freeze({
  NONE: 'none',
  // Watch-only public signal: watch_items exists without a public limitation block.
  PRESENT: 'present',
  GUARDRAIL_ONLY: 'guardrail-only',
  PUBLIC_LIMITATION: 'public-limitation'
});

const EMPTY_NORMALIZED_ARTICLE_SECTIONS = Object.freeze({
  verified_facts: Object.freeze([]),
  background_context: '',
  hal_driver_impact: '',
  action_items: Object.freeze([]),
  team_share_points: '',
  known_limitations: Object.freeze([]),
  watch_items: Object.freeze([]),
  do_not_claim: Object.freeze([])
});

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function normalizeText(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const output = [];
  for (const item of values) {
    const normalized = normalizeText(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function isEmptyRequiredValue(key, value) {
  return key === 'verified_facts' || key === 'action_items'
    ? ensureArray(value).length === 0
    : !normalizeText(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unexpectedArticleSectionKeys(section = {}) {
  if (!isPlainObject(section.article_sections)) return [];
  const expected = new Set(ARTICLE_SECTION_ALLOWED_KEYS);
  return Object.keys(section.article_sections).filter(key => !expected.has(key));
}

function articleSectionLimitationVisibility(section = {}) {
  const normalized = normalizeArticleSections(section);
  if (normalized.known_limitations.length > 0) return LIMITATION_VISIBILITY.PUBLIC_LIMITATION;
  if (normalized.do_not_claim.length > 0) return LIMITATION_VISIBILITY.GUARDRAIL_ONLY;
  if (normalized.watch_items.length > 0) return LIMITATION_VISIBILITY.PRESENT;
  return LIMITATION_VISIBILITY.NONE;
}

function normalizeArticleSections(section = {}) {
  const hasArticleSections = isPlainObject(section.article_sections);
  const source = hasArticleSections ? section.article_sections : {};
  const normalized = {
    verified_facts: normalizeStringArray(source.verified_facts),
    background_context: normalizeText(source.background_context),
    hal_driver_impact: normalizeText(source.hal_driver_impact),
    action_items: normalizeStringArray(source.action_items),
    team_share_points: normalizeText(source.team_share_points),
    known_limitations: normalizeStringArray(source.known_limitations),
    watch_items: normalizeStringArray(source.watch_items),
    do_not_claim: normalizeStringArray(source.do_not_claim)
  };
  const missingRequiredKeys = ARTICLE_SECTION_REQUIRED_KEYS
    .filter(key => isEmptyRequiredValue(key, normalized[key]));
  const presentOptionalKeys = ARTICLE_SECTION_OPTIONAL_KEYS
    .filter(key => normalized[key].length > 0);
  const unexpectedKeys = unexpectedArticleSectionKeys(section);

  return {
    ...normalized,
    diagnostics: {
      article_sections_present: hasArticleSections,
      missing_keys: missingRequiredKeys,
      missing_required_keys: missingRequiredKeys,
      present_optional_keys: presentOptionalKeys,
      unexpected_keys: unexpectedKeys,
      complete: missingRequiredKeys.length === 0
    }
  };
}

function articleSectionSummary(section = {}) {
  const normalized = normalizeArticleSections(section);
  return {
    complete: normalized.diagnostics.complete,
    missing_keys: normalized.diagnostics.missing_keys,
    missing_required_keys: normalized.diagnostics.missing_required_keys,
    present_optional_keys: normalized.diagnostics.present_optional_keys,
    unexpected_keys: normalized.diagnostics.unexpected_keys,
    has_limitations: normalized.known_limitations.length > 0,
    has_watch_items: normalized.watch_items.length > 0,
    has_do_not_claim: normalized.do_not_claim.length > 0,
    limitation_visibility: articleSectionLimitationVisibility(section)
  };
}

module.exports = {
  ARTICLE_SECTION_ALLOWED_KEYS,
  ARTICLE_SECTION_KEYS,
  ARTICLE_SECTION_LABELS,
  ARTICLE_SECTION_OPTIONAL_KEYS,
  ARTICLE_SECTION_REQUIRED_KEYS,
  EMPTY_NORMALIZED_ARTICLE_SECTIONS,
  LIMITATION_VISIBILITY,
  articleSectionLimitationVisibility,
  articleSectionSummary,
  normalizeArticleSections,
  normalizeStringArray,
  normalizeText,
  unexpectedArticleSectionKeys
};
