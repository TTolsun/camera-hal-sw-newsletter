const ARTICLE_SECTION_KEYS = Object.freeze([
  'verified_facts',
  'background_context',
  'hal_driver_impact',
  'action_items',
  'team_share_points'
]);

const ARTICLE_SECTION_LABELS = Object.freeze({
  verified_facts: '확인한 사실 / 릴리스 요약',
  background_context: '배경지식 / 왜 AOSP Camera 팀이 볼 만한가',
  hal_driver_impact: 'Camera HAL/Driver 관점 / 적용 가능 지점',
  action_items: '실행 항목 / PoC 제안 및 검증 기준',
  team_share_points: '팀 공유 포인트 / 결론'
});

const EMPTY_NORMALIZED_ARTICLE_SECTIONS = Object.freeze({
  verified_facts: Object.freeze([]),
  background_context: '',
  hal_driver_impact: '',
  action_items: Object.freeze([]),
  team_share_points: ''
});

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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

function isEmptyStrictValue(key, value) {
  return key === 'verified_facts' || key === 'action_items'
    ? ensureArray(value).length === 0
    : !normalizeText(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeArticleSections(section = {}) {
  const hasArticleSections = isPlainObject(section.article_sections);
  const source = hasArticleSections ? section.article_sections : {};
  const normalized = {
    verified_facts: normalizeStringArray(source.verified_facts),
    background_context: normalizeText(source.background_context),
    hal_driver_impact: normalizeText(source.hal_driver_impact),
    action_items: normalizeStringArray(source.action_items),
    team_share_points: normalizeText(source.team_share_points)
  };
  const missingKeys = ARTICLE_SECTION_KEYS.filter(key => isEmptyStrictValue(key, normalized[key]));

  return {
    ...normalized,
    diagnostics: {
      article_sections_present: hasArticleSections,
      missing_keys: missingKeys,
      complete: missingKeys.length === 0
    }
  };
}

function articleSectionSummary(section = {}) {
  const normalized = normalizeArticleSections(section);
  return {
    complete: normalized.diagnostics.complete,
    missing_keys: normalized.diagnostics.missing_keys
  };
}

module.exports = {
  ARTICLE_SECTION_KEYS,
  ARTICLE_SECTION_LABELS,
  EMPTY_NORMALIZED_ARTICLE_SECTIONS,
  articleSectionSummary,
  normalizeArticleSections,
  normalizeStringArray,
  normalizeText
};
