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

function normalizePolicy(config) {
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

const rawConfig = readPolicyConfig();
const validation = validateNewsletterPolicyConfig(rawConfig);
if (!validation.ok) {
  throw new Error(`Invalid Newsletter Policy config:\n- ${validation.errors.join('\n- ')}`);
}

const policy = normalizePolicy(rawConfig);
const articlePolicy = policy.articlePolicy;
const qualityGatePolicy = policy.qualityGatePolicy;

function bucketValue(bucket) {
  return String(bucket || '').trim();
}

function isPrimaryCameraStackBucket(bucket) {
  return articlePolicy.primaryCameraStack.buckets.includes(bucketValue(bucket));
}

function isSupportingMainBucket(bucket) {
  return articlePolicy.supportingMainBuckets.includes(bucketValue(bucket));
}

function isForbiddenMainBucket(bucket) {
  return articlePolicy.forbiddenMainBuckets.includes(bucketValue(bucket));
}

function isMainArticleAllowedBucket(bucket) {
  return isPrimaryCameraStackBucket(bucket) || isSupportingMainBucket(bucket);
}

function articleCountRangeText() {
  const { min, max } = articlePolicy.mainArticleCount;
  return `${min}-${max}`;
}

function publishGateCriteriaText() {
  return [
    `main articles: ${articleCountRangeText()}`,
    `required primary camera stack articles: ${articlePolicy.primaryCameraStack.minRequired}`,
    `forbidden main buckets: ${articlePolicy.forbiddenMainBuckets.join(', ') || 'none'}`,
    `quality threshold: ${qualityGatePolicy.threshold}`
  ].join('; ');
}

function renderNewsletterPolicyBlock() {
  return [
    POLICY_BLOCK_BEGIN,
    '<!-- This block is generated. Update config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->',
    '',
    '### Newsletter Policy',
    '',
    `- Source of truth: \`${POLICY_REL_PATH.replace(/\\/g, '/')}\``,
    `- Main article count: ${articleCountRangeText()}`,
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

function replaceNewsletterPolicyBlock(text) {
  const block = renderNewsletterPolicyBlock();
  if (!text.includes(POLICY_BLOCK_BEGIN) || !text.includes(POLICY_BLOCK_END)) {
    return `${text.replace(/\s*$/, '')}\n\n${block}\n`;
  }
  const pattern = new RegExp(`${POLICY_BLOCK_BEGIN}[\\s\\S]*?${POLICY_BLOCK_END}`);
  return text.replace(pattern, block);
}

// Legacy compatibility exports only. New code should prefer articlePolicy and qualityGatePolicy.
const MIN_MAIN_ARTICLES = articlePolicy.mainArticleCount.min;
const MAX_MAIN_ARTICLES = articlePolicy.mainArticleCount.max;
const QUALITY_THRESHOLD = qualityGatePolicy.threshold;

module.exports = {
  POLICY_BLOCK_BEGIN,
  POLICY_BLOCK_END,
  POLICY_REL_PATH,
  articlePolicy,
  qualityGatePolicy,
  MIN_MAIN_ARTICLES,
  MAX_MAIN_ARTICLES,
  QUALITY_THRESHOLD,
  articleCountRangeText,
  isForbiddenMainBucket,
  isMainArticleAllowedBucket,
  isPrimaryCameraStackBucket,
  isSupportingMainBucket,
  publishGateCriteriaText,
  readPolicyConfig,
  renderNewsletterPolicyBlock,
  replaceNewsletterPolicyBlock,
  validateNewsletterPolicyConfig
};
