const fs = require('fs');
const path = require('path');
const {
  BUCKETS
} = require('./aosp-camera-scope');

const POLICY_REL_PATH = path.join('config', 'newsletter-policy.json');
const POLICY_BLOCK_BEGIN = '<!-- NEWSLETTER_POLICY:BEGIN -->';
const POLICY_BLOCK_END = '<!-- NEWSLETTER_POLICY:END -->';
const REQUIRED_HARD_FAIL_CONDITIONS = [
  'source-less main article',
  'source candidate binding failure',
  'missing dated evidence',
  'source_gap_risk',
  'fact-check must_fix',
  'duplicate source URL',
  'stale claim hard failure',
  'undated watch/reference page promoted to main article'
];
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const policyPath = path.join(repoRoot, POLICY_REL_PATH);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(ensureArray(values))];
}

function readPolicyConfig(filePath = policyPath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function knownBuckets() {
  return Object.values(BUCKETS);
}

function validateInteger(value, field, errors, { min = 0 } = {}) {
  if (!Number.isInteger(value) || value < min) {
    errors.push(`${field} must be an integer >= ${min}.`);
  }
}

function validateBucketList(value, field, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${field} must be a non-empty array.`);
    return [];
  }
  const allowed = new Set(knownBuckets());
  const buckets = [];
  for (const bucket of value) {
    if (typeof bucket !== 'string' || !bucket.trim()) {
      errors.push(`${field} contains an empty or non-string bucket.`);
      continue;
    }
    if (!allowed.has(bucket)) {
      errors.push(`${field} contains unknown bucket: ${bucket}.`);
    }
    buckets.push(bucket);
  }
  const duplicates = buckets.filter((bucket, index) => buckets.indexOf(bucket) !== index);
  for (const bucket of unique(duplicates)) {
    errors.push(`${field} contains duplicate bucket: ${bucket}.`);
  }
  return buckets;
}

function validateNewsletterPolicyConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { ok: false, errors: ['Newsletter Policy config must be a JSON object.'] };
  }
  validateInteger(config.schemaVersion, 'schemaVersion', errors, { min: 1 });
  const article = config.articlePolicy || {};
  const quality = config.qualityGatePolicy || {};
  const count = article.mainArticleCount || {};
  validateInteger(count.min, 'articlePolicy.mainArticleCount.min', errors, { min: 1 });
  validateInteger(count.max, 'articlePolicy.mainArticleCount.max', errors, { min: 1 });
  if (Number.isInteger(count.min) && Number.isInteger(count.max) && count.max < count.min) {
    errors.push('articlePolicy.mainArticleCount.max must be >= min.');
  }
  const primary = article.primaryCameraStack || {};
  validateInteger(primary.minRequired, 'articlePolicy.primaryCameraStack.minRequired', errors, { min: 1 });
  const primaryBuckets = validateBucketList(primary.buckets, 'articlePolicy.primaryCameraStack.buckets', errors);
  const supportingBuckets = validateBucketList(article.supportingMainBuckets, 'articlePolicy.supportingMainBuckets', errors);
  const forbiddenBuckets = validateBucketList(article.forbiddenMainBuckets, 'articlePolicy.forbiddenMainBuckets', errors);
  const primarySet = new Set(primaryBuckets);
  const supportingSet = new Set(supportingBuckets);
  const forbiddenSet = new Set(forbiddenBuckets);
  for (const bucket of primarySet) {
    if (supportingSet.has(bucket)) errors.push(`Bucket cannot be both primary and supporting: ${bucket}.`);
    if (forbiddenSet.has(bucket)) errors.push(`Bucket cannot be both primary and forbidden: ${bucket}.`);
  }
  for (const bucket of supportingSet) {
    if (forbiddenSet.has(bucket)) errors.push(`Bucket cannot be both supporting and forbidden: ${bucket}.`);
  }
  if (Number.isInteger(primary.minRequired) && Number.isInteger(count.max) && primary.minRequired > count.max) {
    errors.push('articlePolicy.primaryCameraStack.minRequired cannot exceed articlePolicy.mainArticleCount.max.');
  }
  const threshold = quality.threshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    errors.push('qualityGatePolicy.threshold must be a number between 0 and 100.');
  }
  const hardFailConditions = ensureArray(quality.hardFailConditions);
  if (hardFailConditions.length === 0 || hardFailConditions.some(item => typeof item !== 'string' || !item.trim())) {
    errors.push('qualityGatePolicy.hardFailConditions must contain non-empty strings.');
  }
  for (const condition of REQUIRED_HARD_FAIL_CONDITIONS) {
    if (!hardFailConditions.includes(condition)) {
      errors.push(`qualityGatePolicy.hardFailConditions must include required hard fail condition: ${condition}.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function normalizeNewsletterPolicyConfig(config) {
  const article = config.articlePolicy;
  const quality = config.qualityGatePolicy;
  return deepFreeze({
    schemaVersion: config.schemaVersion,
    name: config.name || 'Newsletter Policy',
    articlePolicy: {
      mainArticleCount: {
        min: article.mainArticleCount.min,
        max: article.mainArticleCount.max
      },
      primaryCameraStack: {
        minRequired: article.primaryCameraStack.minRequired,
        buckets: unique(article.primaryCameraStack.buckets)
      },
      supportingMainBuckets: unique(article.supportingMainBuckets),
      forbiddenMainBuckets: unique(article.forbiddenMainBuckets)
    },
    qualityGatePolicy: {
      threshold: quality.threshold,
      hardFailConditions: [...quality.hardFailConditions]
    }
  });
}

function loadNewsletterPolicy(filePath = policyPath) {
  const config = readPolicyConfig(filePath);
  const validation = validateNewsletterPolicyConfig(config);
  if (!validation.ok) {
    const displayPath = path.relative(repoRoot, filePath).replace(/\\/g, '/') || filePath;
    throw new Error(`Invalid Newsletter Policy config at ${displayPath}:\n- ${validation.errors.join('\n- ')}`);
  }
  return normalizeNewsletterPolicyConfig(config);
}

let defaultPolicyCache = null;

function getDefaultNewsletterPolicy() {
  if (!defaultPolicyCache) {
    defaultPolicyCache = loadNewsletterPolicy(policyPath);
  }
  return defaultPolicyCache;
}

function getArticlePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.articlePolicy;
}

function getQualityGatePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.qualityGatePolicy;
}

function bucketValue(bucket) {
  return String(bucket || '').trim();
}

function isPrimaryCameraStackBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return getArticlePolicy(policy).primaryCameraStack.buckets.includes(bucketValue(bucket));
}

function isSupportingMainBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return getArticlePolicy(policy).supportingMainBuckets.includes(bucketValue(bucket));
}

function isForbiddenMainBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return getArticlePolicy(policy).forbiddenMainBuckets.includes(bucketValue(bucket));
}

function isMainArticleAllowedBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return isPrimaryCameraStackBucket(bucket, policy) || isSupportingMainBucket(bucket, policy);
}

function articleCountRangeText(policy = getDefaultNewsletterPolicy()) {
  const articlePolicy = getArticlePolicy(policy);
  const { min, max } = articlePolicy.mainArticleCount;
  return `${min}-${max}`;
}

function publishGateCriteriaText(policy = getDefaultNewsletterPolicy()) {
  const articlePolicy = getArticlePolicy(policy);
  const qualityGatePolicy = getQualityGatePolicy(policy);
  return [
    `main articles: ${articleCountRangeText(policy)}`,
    `required primary camera stack articles: ${articlePolicy.primaryCameraStack.minRequired}`,
    `forbidden main buckets: ${articlePolicy.forbiddenMainBuckets.join(', ') || 'none'}`,
    `quality threshold: ${qualityGatePolicy.threshold}`
  ].join('; ');
}

function renderNewsletterPolicyBlock(policy = getDefaultNewsletterPolicy()) {
  const articlePolicy = getArticlePolicy(policy);
  const qualityGatePolicy = getQualityGatePolicy(policy);
  return [
    POLICY_BLOCK_BEGIN,
    '<!-- This block is generated. Update config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->',
    '',
    '### Newsletter Policy',
    '',
    `- Source of truth: \`${POLICY_REL_PATH.replace(/\\/g, '/')}\``,
    `- Main article count: ${articleCountRangeText(policy)}`,
    `- Required Primary Camera Stack articles: at least ${articlePolicy.primaryCameraStack.minRequired}`,
    `- Primary Camera Stack buckets: ${articlePolicy.primaryCameraStack.buckets.map(bucket => `\`${bucket}\``).join(', ')}`,
    `- Supporting main buckets: ${articlePolicy.supportingMainBuckets.map(bucket => `\`${bucket}\``).join(', ')}`,
    `- Forbidden main buckets: ${articlePolicy.forbiddenMainBuckets.map(bucket => `\`${bucket}\``).join(', ')}`,
    `- Quality threshold: ${qualityGatePolicy.threshold}`,
    `- Hard fail conditions remain blocking: ${qualityGatePolicy.hardFailConditions.join('; ')}`,
    '',
    POLICY_BLOCK_END
  ].join('\n');
}

function markerPositions(text, marker) {
  const positions = [];
  let start = 0;
  while (start < text.length) {
    const index = text.indexOf(marker, start);
    if (index === -1) break;
    positions.push(index);
    start = index + marker.length;
  }
  return positions;
}

function analyzeNewsletterPolicyBlock(text, policy = getDefaultNewsletterPolicy()) {
  const beginPositions = markerPositions(text, POLICY_BLOCK_BEGIN);
  const endPositions = markerPositions(text, POLICY_BLOCK_END);
  const errors = [];
  if (beginPositions.length === 0) errors.push(`missing BEGIN marker ${POLICY_BLOCK_BEGIN}`);
  if (endPositions.length === 0) errors.push(`missing END marker ${POLICY_BLOCK_END}`);
  if (beginPositions.length > 1) errors.push(`duplicate BEGIN marker ${POLICY_BLOCK_BEGIN}`);
  if (endPositions.length > 1) errors.push(`duplicate END marker ${POLICY_BLOCK_END}`);
  if (beginPositions.length === 1 && endPositions.length === 1 && beginPositions[0] > endPositions[0]) {
    errors.push('marker order error: BEGIN marker must appear before END marker');
  }

  const expectedBlock = renderNewsletterPolicyBlock(policy);
  let actualBlock = '';
  if (errors.length === 0) {
    actualBlock = text.slice(beginPositions[0], endPositions[0] + POLICY_BLOCK_END.length);
    if (actualBlock !== expectedBlock) {
      errors.push('generated Newsletter Policy block drift');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    expectedBlock,
    actualBlock,
    beginCount: beginPositions.length,
    endCount: endPositions.length
  };
}

function replaceNewsletterPolicyBlock(text, { policy = getDefaultNewsletterPolicy() } = {}) {
  const beginPositions = markerPositions(text, POLICY_BLOCK_BEGIN);
  const endPositions = markerPositions(text, POLICY_BLOCK_END);
  const block = renderNewsletterPolicyBlock(policy);
  if (beginPositions.length === 0 && endPositions.length === 0) {
    return `${text.replace(/\s*$/, '')}\n\n${block}\n`;
  }

  const structuralErrors = analyzeNewsletterPolicyBlock(text, policy)
    .errors
    .filter(error => error !== 'generated Newsletter Policy block drift');
  if (structuralErrors.length > 0) {
    throw new Error(structuralErrors.join('; '));
  }

  return `${text.slice(0, beginPositions[0])}${block}${text.slice(endPositions[0] + POLICY_BLOCK_END.length)}`;
}

module.exports = {
  POLICY_BLOCK_BEGIN,
  POLICY_BLOCK_END,
  POLICY_REL_PATH,
  get articlePolicy() {
    return getArticlePolicy();
  },
  get qualityGatePolicy() {
    return getQualityGatePolicy();
  },
  // Legacy compatibility exports only. New code should prefer articlePolicy and qualityGatePolicy.
  get MIN_MAIN_ARTICLES() {
    return getArticlePolicy().mainArticleCount.min;
  },
  get MAX_MAIN_ARTICLES() {
    return getArticlePolicy().mainArticleCount.max;
  },
  get QUALITY_THRESHOLD() {
    return getQualityGatePolicy().threshold;
  },
  analyzeNewsletterPolicyBlock,
  articleCountRangeText,
  getDefaultNewsletterPolicy,
  isForbiddenMainBucket,
  isMainArticleAllowedBucket,
  isPrimaryCameraStackBucket,
  isSupportingMainBucket,
  loadNewsletterPolicy,
  normalizeNewsletterPolicyConfig,
  publishGateCriteriaText,
  readPolicyConfig,
  renderNewsletterPolicyBlock,
  replaceNewsletterPolicyBlock,
  validateNewsletterPolicyConfig
};
