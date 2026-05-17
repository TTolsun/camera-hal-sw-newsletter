const {
  sectionMapValidationErrors
} = require('../collect/news-source-section-resolver');
const {
  MAIN_ARTICLE_POLICIES,
  SOURCE_ROLES,
  SOURCE_URL_QUALITIES
} = require('../collect/source-quality-classifier');

const REQUIRED_SOURCE_FIELDS = [
  'id',
  'name',
  'sourceUrl',
  'rssUrl',
  'category',
  'priority',
  'reliability',
  'enabled',
  'candidateOnly',
  'requiresCrossCheck',
  'sourceRole',
  'sourceUrlQualityHint',
  'mainArticlePolicy',
  'requiresCrossCheckDefault',
  'evidenceGranularityHint',
  'sourceQualityNotes',
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
const LINKED_EVIDENCE_POLICY_ARRAY_FIELDS = [
  'allowedDomains',
  'importantAnchorKeywords',
  'ignoreAnchorKeywords'
];
const VALID_SOURCE_ROLES = new Set(SOURCE_ROLES);
const VALID_SOURCE_URL_QUALITY_HINTS = new Set(SOURCE_URL_QUALITIES);
const VALID_MAIN_ARTICLE_POLICIES = new Set(MAIN_ARTICLE_POLICIES);
const CONDITIONAL_EVIDENCE_RULE_HINTS = new Set([
  'generic_ai_or_it_trend',
  'engineering_blog_with_camera_evidence',
  'project_release',
  'project_mailing_list_release'
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

function validateOptionalStringArray(errors, path, value) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array of strings.`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      errors.push(`${path}[${index}] must be a non-empty string.`);
    }
  });
}

function validateStringArray(errors, path, value) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array of strings.`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      errors.push(`${path}[${index}] must be a non-empty string.`);
    }
  });
}

function validateLinkedEvidencePolicy(errors, path, value) {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  if (typeof value.enabled !== 'boolean') {
    errors.push(`${path}.enabled must be a boolean.`);
  }
  for (const field of LINKED_EVIDENCE_POLICY_ARRAY_FIELDS) {
    validateOptionalStringArray(errors, `${path}.${field}`, value[field]);
  }
  if (value.enabled === true && (!Array.isArray(value.allowedDomains) || value.allowedDomains.length === 0)) {
    errors.push(`${path}.allowedDomains must be a non-empty array when enabled is true.`);
  }
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
  if (Object.prototype.hasOwnProperty.call(source, 'section')) {
    errors.push(`${label}.section duplicates sectionMap-derived data and is not allowed.`);
  }
  if (typeof source.category === 'string' && source.category.trim()) {
    if (!Object.prototype.hasOwnProperty.call(sectionMap, source.category)) {
      errors.push(`${label}.category must exist in sectionMap.`);
    }
  }

  if (!VALID_PRIORITIES.has(source.priority)) {
    errors.push(`${label}.priority must be one of: high, medium, low.`);
  }
  validateString(errors, `${label}.reliability`, source.reliability);
  validateBoolean(errors, `${label}.enabled`, source.enabled);
  validateBoolean(errors, `${label}.candidateOnly`, source.candidateOnly);
  validateBoolean(errors, `${label}.requiresCrossCheck`, source.requiresCrossCheck);
  validateString(errors, `${label}.sourceRole`, source.sourceRole);
  if (typeof source.sourceRole === 'string' && !VALID_SOURCE_ROLES.has(source.sourceRole)) {
    errors.push(`${label}.sourceRole must be one of: ${[...VALID_SOURCE_ROLES].join(', ')}.`);
  }
  validateString(errors, `${label}.sourceUrlQualityHint`, source.sourceUrlQualityHint);
  if (typeof source.sourceUrlQualityHint === 'string' && !VALID_SOURCE_URL_QUALITY_HINTS.has(source.sourceUrlQualityHint)) {
    errors.push(`${label}.sourceUrlQualityHint must be one of: ${[...VALID_SOURCE_URL_QUALITY_HINTS].join(', ')}.`);
  }
  validateString(errors, `${label}.mainArticlePolicy`, source.mainArticlePolicy);
  if (typeof source.mainArticlePolicy === 'string' && !VALID_MAIN_ARTICLE_POLICIES.has(source.mainArticlePolicy)) {
    errors.push(`${label}.mainArticlePolicy must be one of: ${[...VALID_MAIN_ARTICLE_POLICIES].join(', ')}.`);
  }
  validateBoolean(errors, `${label}.requiresCrossCheckDefault`, source.requiresCrossCheckDefault);
  validateString(errors, `${label}.evidenceGranularityHint`, source.evidenceGranularityHint);
  validateStringArray(errors, `${label}.sourceQualityNotes`, source.sourceQualityNotes);
  if (
    source.mainArticlePolicy === 'conditional' &&
    source.requiresCrossCheckDefault !== true &&
    !CONDITIONAL_EVIDENCE_RULE_HINTS.has(source.sourceUrlQualityHint)
  ) {
    errors.push(`${label}.mainArticlePolicy=conditional requires requiresCrossCheckDefault=true or an explicit evidence-rule sourceUrlQualityHint.`);
  }
  validateString(errors, `${label}.usageHint`, source.usageHint);
  validateKeywords(errors, `${label}.keywords`, source.keywords);
  validateLinkedEvidencePolicy(errors, `${label}.linkedEvidencePolicy`, source.linkedEvidencePolicy);

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

  if (registry.schemaVersion !== 2) {
    errors.push('schemaVersion must be 2.');
  }

  errors.push(...sectionMapValidationErrors(registry.sectionMap));

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
  VALID_MAIN_ARTICLE_POLICIES,
  VALID_COLLECTION_MODE_HINTS,
  VALID_PRIORITIES,
  VALID_SOURCE_ROLES,
  VALID_SOURCE_URL_QUALITY_HINTS,
  LINKED_EVIDENCE_POLICY_ARRAY_FIELDS,
  validateNewsSourcesConfigText
};
