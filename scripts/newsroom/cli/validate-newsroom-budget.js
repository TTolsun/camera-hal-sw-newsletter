const fs = require('fs');
const path = require('path');

const {
  validateNewsroomBudgetConfigText
} = require('../validate/newsroom-budget-config-validator');

const root = process.cwd();
const configPath = path.resolve(root, process.argv[2] || path.join('config', 'newsroom-budget.json'));
const displayPath = path.relative(root, configPath).replace(/\\/g, '/') || configPath;

let text;
try {
  text = fs.readFileSync(configPath, 'utf8');
} catch (error) {
  console.error(`Newsroom budget config validation failed: could not read ${displayPath}: ${error.message}`);
  process.exit(1);
}

const result = validateNewsroomBudgetConfigText(text, { filePath: displayPath });

if (!result.ok) {
  console.error(`Newsroom budget config validation failed for ${displayPath}:`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Newsroom budget config validation passed for ${displayPath}.`);
