const fs = require('fs');

const SUPPORTED_SCHEMA_VERSION = 1;
const VALID_SELECTION_LANES = Object.freeze([
  'primary_camera_stack',
  'supporting_native_tooling',
  'reference_context'
]);
const VALID_SOURCE_PRIORITIES = Object.freeze(['high', 'medium', 'low']);
const VALID_DATE_EXTRACTORS = Object.freeze([
  'visible_date',
  'visible_last_updated',
  'structured_date_published',
  'structured_date_modified',
  'release_row_date',
  'sitemap_lastmod',
  'http_last_modified',
  'url_path_date'
]);

const REQUIRED_SOURCE_FIELDS = Object.freeze([
  'source_id',
  'root_url',
  'url_patterns',
  'source_priority',
  'selection_lane',
  'expected_categories',
  'date_extractors',
  'content_hash_enabled',
  'main_article_allowed',
  'fallback_only',
  'max_pages_per_run',
  'fetch_timeout_ms'
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function labelFor(source, index) {
  return source?.source_id ? `sources[${index}] (${source.source_id})` : `sources[${index}]`;
}

function validateStringArray(errors, label, value) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty array of strings.`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      errors.push(`${label}[${index}] must be a non-empty string.`);
    }
  });
}

function validateBoolean(errors, label, value) {
  if (typeof value !== 'boolean') {
    errors.push(`${label} must be a boolean.`);
  }
}

function validateBoundedInteger(errors, label, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${label} must be an integer between ${min} and ${max}.`);
  }
}

function validateSource(errors, source, index, seenIds) {
  const label = labelFor(source, index);
  if (!isPlainObject(source)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  for (const field of REQUIRED_SOURCE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) {
      errors.push(`${label}.${field} is required.`);
    }
  }

  if (typeof source.source_id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.source_id)) {
    errors.push(`${label}.source_id must be lowercase kebab-case.`);
  } else if (seenIds.has(source.source_id)) {
    errors.push(`${label}.source_id duplicates an earlier source_id.`);
  } else {
    seenIds.add(source.source_id);
  }

  if (!isHttpUrl(source.root_url)) {
    errors.push(`${label}.root_url must be an http or https URL.`);
  }
  validateStringArray(errors, `${label}.url_patterns`, source.url_patterns);
  validateStringArray(errors, `${label}.expected_categories`, source.expected_categories);
  validateStringArray(errors, `${label}.date_extractors`, source.date_extractors);
  if (Array.isArray(source.date_extractors)) {
    for (const extractor of source.date_extractors) {
      if (!VALID_DATE_EXTRACTORS.includes(extractor)) {
        errors.push(`${label}.date_extractors contains unknown extractor: ${extractor}.`);
      }
    }
  }
  if (!VALID_SOURCE_PRIORITIES.includes(source.source_priority)) {
    errors.push(`${label}.source_priority must be one of: ${VALID_SOURCE_PRIORITIES.join(', ')}.`);
  }
  if (!VALID_SELECTION_LANES.includes(source.selection_lane)) {
    errors.push(`${label}.selection_lane must be one of: ${VALID_SELECTION_LANES.join(', ')}.`);
  }
  validateBoolean(errors, `${label}.content_hash_enabled`, source.content_hash_enabled);
  validateBoolean(errors, `${label}.main_article_allowed`, source.main_article_allowed);
  validateBoolean(errors, `${label}.fallback_only`, source.fallback_only);
  if (source.main_article_allowed === true && source.fallback_only === true) {
    errors.push(`${label}.main_article_allowed=true cannot be combined with fallback_only=true.`);
  }
  validateBoundedInteger(errors, `${label}.max_pages_per_run`, source.max_pages_per_run, 1, 25);
  validateBoundedInteger(errors, `${label}.fetch_timeout_ms`, source.fetch_timeout_ms, 1000, 20000);
  if (source.seed_urls !== undefined) {
    validateStringArray(errors, `${label}.seed_urls`, source.seed_urls);
    if (Array.isArray(source.seed_urls)) {
      source.seed_urls.forEach((url, urlIndex) => {
        if (!isHttpUrl(url)) errors.push(`${label}.seed_urls[${urlIndex}] must be an http or https URL.`);
      });
    }
  }
}

function validateSourceMonitorRegistryText(text, options = {}) {
  const filePath = options.filePath || 'data/source-monitor-registry.json';
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
    return { ok: false, errors, registry };
  }
  if (registry.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SUPPORTED_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(registry.sources) || registry.sources.length === 0) {
    errors.push('sources must be a non-empty array.');
  } else {
    const seenIds = new Set();
    registry.sources.forEach((source, index) => validateSource(errors, source, index, seenIds));
  }

  return {
    ok: errors.length === 0,
    errors,
    registry
  };
}

function validateSourceMonitorRegistryFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return validateSourceMonitorRegistryText(text, { filePath });
}

module.exports = {
  REQUIRED_SOURCE_FIELDS,
  SUPPORTED_SCHEMA_VERSION,
  VALID_DATE_EXTRACTORS,
  VALID_SELECTION_LANES,
  VALID_SOURCE_PRIORITIES,
  validateSourceMonitorRegistryFile,
  validateSourceMonitorRegistryText
};
