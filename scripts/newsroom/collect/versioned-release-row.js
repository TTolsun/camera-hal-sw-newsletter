const { decodeHtml } = require('../common/common');

const DEFAULT_EVIDENCE_GRANULARITY = 'versioned_release_row';

function text(value = '') {
  return String(value || '').trim();
}

function clean(value = '') {
  return decodeHtml(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function unique(values = []) {
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

function sectionItems(sections = []) {
  return (Array.isArray(sections) ? sections : [])
    .flatMap(section => Array.isArray(section?.items) ? section.items : []);
}

function itemText(item = {}) {
  if (typeof item === 'string') return text(item);
  return text(item.text || item.source_text || item.summary || item.title);
}

function canonicalBulletTexts(sections = []) {
  return unique(sectionItems(sections).map(itemText));
}

function urlParts(value = '') {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function linkRole(link = {}, context = {}) {
  if (link.role) return link.role;
  const value = `${link.text || ''} ${link.url || ''}`;
  const parsed = urlParts(link.url);
  if (context.parentSourceUrl && link.url === context.parentSourceUrl) return 'parent_source';
  if (context.releaseNoteUrl && link.url === context.releaseNoteUrl) return 'release_note_anchor';
  if (parsed?.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parsed.pathname)) {
    return parsed.hash ? 'release_note_anchor' : 'parent_source';
  }
  if (/issuetracker\.google\.com|android-review\.googlesource\.com|github\.com|(?:\bb\/\d+|\bissue\b|\bbug\b)/i.test(value)) {
    return 'issue_or_bug';
  }
  if (/\bandroidx\.camera(?::[a-z0-9_.-]+)?\b|\bcamera-[a-z0-9-]+\b|Maven Group/i.test(value)) {
    return 'artifact';
  }
  return 'related';
}

function normalizeLinks(links = [], context = {}) {
  const base = [
    context.parentSourceUrl ? {
      role: 'parent_source',
      text: context.parentSourceName || 'Parent source',
      url: context.parentSourceUrl
    } : null,
    context.releaseNoteUrl ? {
      role: 'release_note_anchor',
      text: context.releaseNoteText || context.heading || 'Release note',
      url: context.releaseNoteUrl
    } : null,
    ...(Array.isArray(links) ? links : [])
  ].filter(Boolean);
  const seen = new Set();
  const output = [];
  for (const link of base) {
    const url = text(link.url);
    if (!url) continue;
    const normalized = {
      role: linkRole(link, context),
      text: clean(link.text || link.title || ''),
      url
    };
    const key = `${normalized.role}|${normalized.url}|${normalized.text}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function normalizeSections(sections = []) {
  return (Array.isArray(sections) ? sections : [])
    .map(section => ({
      ...section,
      items: (Array.isArray(section?.items) ? section.items : [])
        .map(item => {
          if (typeof item === 'string') {
            return { text: item, source_text: item };
          }
          const value = itemText(item);
          return {
            ...item,
            text: value,
            source_text: text(item.source_text || value)
          };
        })
        .filter(item => item.text)
    }))
    .filter(section => section.items.length > 0);
}

function normalizeVersionedReleaseExtraction({
  adapterId,
  sourceType = 'release_note',
  source = {},
  heading = '',
  release = {},
  sections = [],
  links = [],
  parentSource = {},
  releaseNoteUrl = '',
  minorLineContext = null,
  extractionQuality = {},
  usedVersionedReleaseRowExtractor = true
} = {}) {
  const normalizedSections = normalizeSections(sections);
  const bullets = canonicalBulletTexts(normalizedSections);
  const hasConcrete = bullets.length > 0;
  const warnings = unique([
    ...(Array.isArray(extractionQuality.warnings) ? extractionQuality.warnings : []),
    ...(!hasConcrete ? ['missing_concrete_release_note_bullet'] : [])
  ]);
  const normalizedLinks = normalizeLinks(links, {
    parentSourceName: parentSource.name || source.name,
    parentSourceUrl: parentSource.url || parentSource.sourceUrl || '',
    releaseNoteUrl,
    releaseNoteText: release.version || heading,
    heading
  });
  const quality = {
    ...extractionQuality,
    has_concrete_behavior_change: extractionQuality.has_concrete_behavior_change ?? hasConcrete,
    used_fallback: extractionQuality.used_fallback ?? !hasConcrete,
    raw_table_used_as_body: extractionQuality.raw_table_used_as_body ?? false,
    main_article_allowed: extractionQuality.main_article_allowed ?? hasConcrete,
    used_versioned_release_row_extractor: usedVersionedReleaseRowExtractor,
    used_empty_evidence_fallback: extractionQuality.used_empty_evidence_fallback ?? !hasConcrete,
    warnings
  };
  const output = {
    adapter_id: adapterId,
    source_type: sourceType,
    evidence_granularity: DEFAULT_EVIDENCE_GRANULARITY,
    mode: DEFAULT_EVIDENCE_GRANULARITY,
    heading: heading || release.version || '',
    bullets,
    links: normalizedLinks,
    source: {
      name: source.name || 'Release notes',
      url: source.url || source.sourceUrl || releaseNoteUrl || ''
    },
    release: {
      version: release.version || '',
      date: release.date || '',
      component: release.component || '',
      sections: normalizedSections
    },
    extraction_quality: quality
  };
  if (minorLineContext) output.minor_line_context = minorLineContext;
  return output;
}

function firstConcreteBullet(extraction = {}) {
  return canonicalBulletTexts(extraction.release?.sections || [])[0] || '';
}

module.exports = {
  DEFAULT_EVIDENCE_GRANULARITY,
  canonicalBulletTexts,
  firstConcreteBullet,
  normalizeVersionedReleaseExtraction
};
