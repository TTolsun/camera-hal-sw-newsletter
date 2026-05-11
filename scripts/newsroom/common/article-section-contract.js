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

const ARTICLE_SECTION_ALIASES = Object.freeze({
  verified_facts: [
    'verified_facts',
    'verified facts',
    'confirmed_facts',
    'confirmed facts',
    'what_changed',
    'what changed',
    '확인한 사실',
    '릴리스 요약',
    '확인한 사실 / 릴리스 요약'
  ],
  background_context: [
    'background_context',
    'background context',
    'background',
    '배경지식',
    '왜 AOSP Camera 팀이 볼 만한가',
    '배경지식 / 왜 AOSP Camera 팀이 볼 만한가'
  ],
  hal_driver_impact: [
    'hal_driver_impact',
    'hal driver impact',
    'camera_hal_perspective',
    'camera hal perspective',
    'why_it_matters',
    'why it matters',
    'Camera HAL/Driver 관점',
    '적용 가능 지점',
    'Camera HAL/Driver 관점 / 적용 가능 지점'
  ],
  action_items: [
    'action_items',
    'action items',
    'action_hints',
    'action hints',
    '실행 항목',
    'PoC 제안 및 검증 기준',
    '실행 항목 / PoC 제안 및 검증 기준'
  ],
  team_share_points: [
    'team_share_points',
    'team share points',
    'team_summary',
    'team summary',
    '팀 공유 포인트',
    '결론',
    '팀 공유 포인트 / 결론'
  ]
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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function hasArticleSections(section = {}) {
  return section.article_sections && typeof section.article_sections === 'object' && !Array.isArray(section.article_sections);
}

function strictValueForKey(key, value) {
  if (key === 'verified_facts' || key === 'action_items') return normalizeStringArray(value);
  return normalizeText(value);
}

function isEmptyStrictValue(key, value) {
  return key === 'verified_facts' || key === 'action_items'
    ? ensureArray(value).length === 0
    : !normalizeText(value);
}

function legacyValueForKey(section = {}, key) {
  if (key === 'verified_facts') {
    const confirmed = normalizeStringArray(section.confirmed_facts);
    return confirmed.length > 0 ? confirmed : normalizeStringArray(section.what_changed);
  }
  if (key === 'background_context') return normalizeText(section.background);
  if (key === 'hal_driver_impact') return normalizeText(section.camera_hal_perspective || section.why_it_matters);
  if (key === 'action_items') {
    const actions = normalizeStringArray(section.action_items);
    return actions.length > 0 ? actions : normalizeStringArray(section.action_hints);
  }
  if (key === 'team_share_points') {
    const teamSummary = normalizeText(section.team_summary);
    return teamSummary || normalizeText(section.why_it_matters);
  }
  return key === 'verified_facts' || key === 'action_items' ? [] : '';
}

function legacySourceForKey(section = {}, key) {
  if (key === 'verified_facts') return normalizeStringArray(section.confirmed_facts).length > 0 ? 'confirmed_facts' : 'what_changed';
  if (key === 'background_context') return 'background';
  if (key === 'hal_driver_impact') return section.camera_hal_perspective ? 'camera_hal_perspective' : 'why_it_matters';
  if (key === 'action_items') return normalizeStringArray(section.action_items).length > 0 ? 'action_items' : 'action_hints';
  if (key === 'team_share_points') return section.team_summary ? 'team_summary' : 'why_it_matters';
  return '';
}

function compareValue(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join('\n').replace(/\s+/g, ' ').trim().toLowerCase();
  return normalizeText(value).toLowerCase();
}

function sectionCompleteness(normalized) {
  const missing = ARTICLE_SECTION_KEYS.filter(key => isEmptyStrictValue(key, normalized[key]));
  return {
    complete: missing.length === 0,
    missing_keys: missing
  };
}

function normalizeArticleSections(section = {}) {
  const source = hasArticleSections(section) ? section.article_sections : null;
  const normalized = {
    verified_facts: [],
    background_context: '',
    hal_driver_impact: '',
    action_items: [],
    team_share_points: ''
  };
  const missingArticleSectionKeys = [];
  const fallbacksUsed = [];
  const conflicts = [];
  const warnings = [];

  for (const key of ARTICLE_SECTION_KEYS) {
    const hasSectionValue = source && hasOwn(source, key);
    if (source && !hasSectionValue) missingArticleSectionKeys.push(key);

    const directValue = hasSectionValue ? strictValueForKey(key, source[key]) : undefined;
    if (directValue !== undefined && !isEmptyStrictValue(key, directValue)) {
      normalized[key] = directValue;
    } else {
      const legacyValue = strictValueForKey(key, legacyValueForKey(section, key));
      normalized[key] = legacyValue;
      if (!isEmptyStrictValue(key, legacyValue)) {
        const legacySource = legacySourceForKey(section, key);
        fallbacksUsed.push(`${key}_from_${legacySource}`);
        if (key === 'team_share_points' && legacySource === 'why_it_matters') {
          warnings.push('team_share_points uses legacy why_it_matters fallback');
        }
      }
    }

    if (source && hasSectionValue) {
      const legacyValue = strictValueForKey(key, legacyValueForKey(section, key));
      const sectionValue = strictValueForKey(key, source[key]);
      if (!isEmptyStrictValue(key, sectionValue) &&
        !isEmptyStrictValue(key, legacyValue) &&
        compareValue(sectionValue) !== compareValue(legacyValue)) {
        conflicts.push({
          key,
          article_sections_value: sectionValue,
          legacy_field: legacySourceForKey(section, key),
          legacy_value: legacyValue
        });
      }
    }
  }

  const completeness = sectionCompleteness(normalized);
  return {
    ...normalized,
    diagnostics: {
      article_sections_present: Boolean(source),
      missing_article_section_keys: missingArticleSectionKeys,
      fallbacks_used: fallbacksUsed,
      conflicts,
      warnings,
      ...completeness
    }
  };
}

function articleSectionSummary(section = {}) {
  const normalized = normalizeArticleSections(section);
  return {
    complete: normalized.diagnostics.complete,
    missing_keys: normalized.diagnostics.missing_keys,
    fallbacks_used: normalized.diagnostics.fallbacks_used,
    warnings: normalized.diagnostics.warnings,
    conflicts: normalized.diagnostics.conflicts.map(conflict => ({
      key: conflict.key,
      legacy_field: conflict.legacy_field
    }))
  };
}

module.exports = {
  ARTICLE_SECTION_KEYS,
  ARTICLE_SECTION_LABELS,
  ARTICLE_SECTION_ALIASES,
  EMPTY_NORMALIZED_ARTICLE_SECTIONS,
  articleSectionSummary,
  normalizeArticleSections,
  normalizeStringArray,
  normalizeText
};
