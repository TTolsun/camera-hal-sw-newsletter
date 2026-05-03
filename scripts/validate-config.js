const fs = require('fs');
const path = require('path');

const {
  validateNewsSourcesConfigText
} = require('./lib/news-sources-config-validator');

const root = process.cwd();
const configPath = path.resolve(root, process.argv[2] || path.join('data', 'news-sources.json'));
const displayPath = path.relative(root, configPath).replace(/\\/g, '/') || configPath;

let text;
try {
  text = fs.readFileSync(configPath, 'utf8');
} catch (error) {
  console.error(`Source registry config validation failed: could not read ${displayPath}: ${error.message}`);
  process.exit(1);
}

const result = validateNewsSourcesConfigText(text, { filePath: displayPath });

if (!result.ok) {
  console.error(`Source registry config validation failed for ${displayPath}:`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Source registry config validation passed for ${displayPath}.`);
