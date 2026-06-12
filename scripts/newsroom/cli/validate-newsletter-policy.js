const path = require('path');
const {
  POLICY_REL_PATH,
  normalizeNewsletterPolicyConfig,
  readPolicyConfig,
  validateNewsletterPolicyConfig
} = require('../../../src/core/common/newsletter-policy');

const root = process.cwd();
const configPath = path.resolve(root, process.argv[2] || POLICY_REL_PATH);
const displayPath = path.relative(root, configPath).replace(/\\/g, '/') || configPath;

let config;
try {
  config = readPolicyConfig(configPath);
} catch (error) {
  console.error(`Newsletter Policy validation failed: could not read ${displayPath}: ${error.message}`);
  process.exit(1);
}

const result = validateNewsletterPolicyConfig(config);
if (!result.ok) {
  console.error(`Newsletter Policy validation failed for ${displayPath}:`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

try {
  normalizeNewsletterPolicyConfig(config);
} catch (error) {
  console.error(`Newsletter Policy validation failed for ${displayPath}: could not normalize config: ${error.message}`);
  process.exit(1);
}

console.log(`Newsletter Policy validation passed for ${displayPath}.`);
