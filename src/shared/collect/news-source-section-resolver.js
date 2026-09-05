const fs = require('fs');

const DEFAULT_SECTION_MAP = {
  android: 'Android / AOSP / Camera',
  'android-media': 'Android Media / Camera Output',
  'camera-api': 'Android / AOSP / Camera',
  'camera-hal': 'Android / AOSP / Camera',
  aosp: 'Android / AOSP / Camera',
  compatibility: 'Android / AOSP / Camera',
  security: 'Android / AOSP / Camera',
  'vendor-security': 'Android / AOSP / Camera',
  'linux-camera': 'Linux Camera / Driver',
  'linux-kernel': 'Linux Camera / Driver',
  driver: 'Linux Camera / Driver',
  v4l2: 'Linux Camera / Driver',
  cpp: 'C++ / Native / Toolchain',
  toolchain: 'C++ / Native / Toolchain',
  native: 'C++ / Native / Toolchain',
  llvm: 'C++ / Native / Toolchain',
  embedded: 'Embedded / Semiconductor',
  'embedded-ai': 'Embedded / Semiconductor',
  semiconductor: 'Embedded / Semiconductor',
  electronics: 'Embedded / Semiconductor',
  ai: 'AI / SW Engineering Trends',
  'ai-research': 'AI / SW Engineering Trends',
  'ai-engineering': 'AI / SW Engineering Trends',
  'ai-coding': 'AI / SW Engineering Trends',
  'ai-trends': 'AI / SW Engineering Trends',
  'tech-trends': 'AI / SW Engineering Trends',
  'software-engineering': 'AI / SW Engineering Trends',
  'open-source': 'AI / SW Engineering Trends',
  'korea-tech': 'Korean Tech Trends',
  'korea-engineering': 'Korean Tech Trends'
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sectionMapValidationErrors(sectionMap, label = 'sectionMap') {
  const errors = [];
  if (!isPlainObject(sectionMap) || Object.keys(sectionMap || {}).length === 0) {
    errors.push(`${label} must be a non-empty object.`);
    return errors;
  }

  for (const [category, section] of Object.entries(sectionMap)) {
    if (typeof category !== 'string' || !category.trim()) {
      errors.push(`${label} keys must be non-empty strings.`);
    }
    if (typeof section !== 'string' || !section.trim()) {
      errors.push(`${label}.${category} must be a non-empty string.`);
    }
  }
  return errors;
}

function validateSectionMap(sectionMap, label = 'sectionMap') {
  const errors = sectionMapValidationErrors(sectionMap, label);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return { ...sectionMap };
}

function resolveSection(sectionMap, category, sourceLabel = 'source') {
  if (typeof category !== 'string' || !category.trim()) {
    throw new Error(`${sourceLabel}.category must be a non-empty string.`);
  }
  if (!Object.prototype.hasOwnProperty.call(sectionMap, category)) {
    throw new Error(`${sourceLabel}.category "${category}" must exist in sectionMap.`);
  }
  return sectionMap[category];
}

function normalizeSourceEntry(source, sectionMap, options = {}) {
  const index = Number.isInteger(options.index) ? options.index : 0;
  const label = options.label || `sources[${index}]`;
  if (!isPlainObject(source)) {
    throw new Error(`${label} must be an object.`);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'section')) {
    throw new Error(`${label}.section duplicates sectionMap-derived data and is not allowed.`);
  }

  const category = source.category || options.defaultCategory;
  const sourceUrl = source.sourceUrl || source.url;
  const normalizeCollectionModeHint = options.normalizeCollectionModeHint || (value => value);

  return {
    id: source.id || '',
    name: source.name,
    url: sourceUrl,
    sourceUrl,
    rssUrl: source.rssUrl || null,
    category,
    section: resolveSection(sectionMap, category, label),
    priority: source.priority || 'medium',
    reliability: source.reliability || 'unknown',
    candidateOnly: source.candidateOnly === true,
    requiresCrossCheck: source.requiresCrossCheck === true,
    allowFeedHint: options.allowFeedHint === true,
    usageHint: source.usageHint || '',
    linkedEvidencePolicy: source.linkedEvidencePolicy || null,
    collectionModeHint: normalizeCollectionModeHint(source.collectionModeHint || source.sourceKind || ''),
    sourceRole: source.sourceRole || '',
    sourceUrlQualityHint: source.sourceUrlQualityHint || '',
    mainArticlePolicy: source.mainArticlePolicy || '',
    requiresCrossCheckDefault: source.requiresCrossCheckDefault === true,
    evidenceGranularityHint: source.evidenceGranularityHint || '',
    suppressGenericCandidateFallback: source.suppressGenericCandidateFallback === true,
    sourceQualityNotes: Array.isArray(source.sourceQualityNotes) ? source.sourceQualityNotes : [],
    sourceKind: source.sourceKind || '',
    keywords: Array.isArray(source.keywords) ? source.keywords : []
  };
}

function normalizeEnabledSources(registry, options = {}) {
  if (!isPlainObject(registry)) {
    throw new Error('source registry must be an object.');
  }
  const sectionMap = validateSectionMap(registry.sectionMap);
  const sources = (registry.sources || [])
    .filter(source => source.enabled !== false)
    .map((source, index) => normalizeSourceEntry(source, sectionMap, { ...options, index }));

  return { sectionMap, sources };
}

function readSourceRegistry(filePath, readJson) {
  if (readJson) return readJson(filePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  DEFAULT_SECTION_MAP,
  normalizeEnabledSources,
  normalizeSourceEntry,
  readSourceRegistry,
  resolveSection,
  sectionMapValidationErrors,
  validateSectionMap
};
