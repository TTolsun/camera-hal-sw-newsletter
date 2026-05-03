const REQUIRED_SOURCE_FIELDS = [
  'id',
  'name',
  'sourceUrl',
  'rssUrl',
  'category',
  'section',
  'priority',
  'reliability',
  'enabled',
  'candidateOnly',
  'requiresCrossCheck',
  'usageHint',
  'keywords'
];

const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);
const VALID_COLLECTION_MODE_HINTS = new Set([
  'rss-source',
  'release-note-watch',
  'documentation-watch',
  'homepage-watch',
  'media-lead'
]);

function sourceLabel(source, index) {
  if (source && typeof source === 'object' && typeof source.id === 'string' && source.id.trim()) {
    return `sources[${index}] (${source.id})`;
  }
  return `sources[${index}]`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function validateString(errors, path, value) {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path} must be a non-empty string.`);
  }
}

function validateBoolean(errors, path, value) {
  if (typeof value !== 'boolean') {
    errors.push(`${path} must be a boolean.`);
  }
}

function validateKeywords(errors, path, value) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array of strings.`);
    return;
  }

  value.forEach((keyword, index) => {
    if (typeof keyword !== 'string' || !keyword.trim()) {
      errors.push(`${path}[${index}] must be a non-empty string.`);
    }
  });
}

function validateSource(errors, source, index, sectionMap, seenIds) {
  const label = sourceLabel(source, index);

  if (!isPlainObject(source)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  for (const field of REQUIRED_SOURCE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) {
      errors.push(`${label}.${field} is required.`);
    }
  }

  validateString(errors, `${label}.id`, source.id);
  if (typeof source.id === 'string' && source.id.trim()) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id)) {
      errors.push(`${label}.id must be lowercase kebab-case.`);
    }
    if (seenIds.has(source.id)) {
      errors.push(`${label}.id duplicates an earlier source id.`);
    } else {
      seenIds.add(source.id);
    }
  }

  validateString(errors, `${label}.name`, source.name);
  if (!isHttpUrl(source.sourceUrl)) {
    errors.push(`${label}.sourceUrl must be an http or https URL.`);
  }
  if (source.rssUrl !== null && !isHttpUrl(source.rssUrl)) {
    errors.push(`${label}.rssUrl must be null or an http or https URL.`);
  }

  validateString(errors, `${label}.category`, source.category);
  validateString(errors, `${label}.section`, source.section);
  if (typeof source.category === 'string' && source.category.trim()) {
    if (!Object.prototype.hasOwnProperty.call(sectionMap, source.category)) {
      errors.push(`${label}.category must exist in sectionMap.`);
    } else if (source.section !== sectionMap[source.category]) {
      errors.push(`${label}.section must match sectionMap.${source.category}.`);
    }
  }

  if (!VALID_PRIORITIES.has(source.priority)) {
    errors.push(`${label}.priority must be one of: high, medium, low.`);
  }
  validateString(errors, `${label}.reliability`, source.reliability);
  validateBoolean(errors, `${label}.enabled`, source.enabled);
  validateBoolean(errors, `${label}.candidateOnly`, source.candidateOnly);
  validateBoolean(errors, `${label}.requiresCrossCheck`, source.requiresCrossCheck);
  validateString(errors, `${label}.usageHint`, source.usageHint);
  validateKeywords(errors, `${label}.keywords`, source.keywords);

  if (
    Object.prototype.hasOwnProperty.call(source, 'collectionModeHint') &&
    !VALID_COLLECTION_MODE_HINTS.has(source.collectionModeHint)
  ) {
    errors.push(`${label}.collectionModeHint must be one of: ${[...VALID_COLLECTION_MODE_HINTS].join(', ')}.`);
  }
}

function validateNewsSourcesConfigText(text, options = {}) {
  const filePath = options.filePath || 'data/news-sources.json';
  const errors = [];
  let registry;

  try {
    registry = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`${filePath} must contain valid JSON: ${error.message}`],
      registry: null
    };
  }

  const canonical = `${JSON.stringify(registry, null, 2)}\n`;
  if (text !== canonical) {
    errors.push(`${filePath} must be formatted as JSON.stringify(value, null, 2) with a trailing newline.`);
  }

  if (!isPlainObject(registry)) {
    errors.push(`${filePath} must contain a JSON object.`);
    return { ok: errors.length === 0, errors, registry };
  }

  if (registry.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.');
  }

  if (!isPlainObject(registry.sectionMap) || Object.keys(registry.sectionMap || {}).length === 0) {
    errors.push('sectionMap must be a non-empty object.');
  } else {
    for (const [category, section] of Object.entries(registry.sectionMap)) {
      if (typeof category !== 'string' || !category.trim()) {
        errors.push('sectionMap keys must be non-empty strings.');
      }
      if (typeof section !== 'string' || !section.trim()) {
        errors.push(`sectionMap.${category} must be a non-empty string.`);
      }
    }
  }

  if (!Array.isArray(registry.sources) || registry.sources.length === 0) {
    errors.push('sources must be a non-empty array.');
  } else {
    const seenIds = new Set();
    for (let index = 0; index < registry.sources.length; index += 1) {
      validateSource(errors, registry.sources[index], index, registry.sectionMap || {}, seenIds);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    registry
  };
}

module.exports = {
  REQUIRED_SOURCE_FIELDS,
  VALID_COLLECTION_MODE_HINTS,
  VALID_PRIORITIES,
  validateNewsSourcesConfigText
};
