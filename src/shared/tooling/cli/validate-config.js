const fs = require('fs');
const path = require('path');

const {
  validateNewsSourcesConfigText
} = require('../validate/news-sources-config-validator');
const {
  validateSourceMonitorRegistryText
} = require('../../validate/source-monitor-registry-validator');
const {
  validateQuirkLedgerStateText
} = require('../../validate/quirk-ledger-state-validator');

const root = process.cwd();
const configPath = path.resolve(root, process.argv[2] || path.join('src', 'shared', 'data', 'news-sources.json'));
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

if (process.argv[2]) {
  process.exit(0);
}

const monitorConfigPath = path.resolve(root, 'state', 'source-monitor-registry.json');
const monitorDisplayPath = path.relative(root, monitorConfigPath).replace(/\\/g, '/') || monitorConfigPath;
if (fs.existsSync(monitorConfigPath)) {
  const monitorText = fs.readFileSync(monitorConfigPath, 'utf8');
  const monitorResult = validateSourceMonitorRegistryText(monitorText, { filePath: monitorDisplayPath });
  if (!monitorResult.ok) {
    console.error(`Source monitor registry config validation failed for ${monitorDisplayPath}:`);
    for (const error of monitorResult.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log(`Source monitor registry config validation passed for ${monitorDisplayPath}.`);
}

const quirkLedgerPath = path.resolve(root, 'state', 'quirk-ledger.json');
const quirkLedgerDisplayPath = path.relative(root, quirkLedgerPath).replace(/\\/g, '/') || quirkLedgerPath;
if (fs.existsSync(quirkLedgerPath)) {
  const quirkLedgerResult = validateQuirkLedgerStateText(fs.readFileSync(quirkLedgerPath, 'utf8'), { filePath: quirkLedgerDisplayPath });
  if (!quirkLedgerResult.ok) {
    console.error(`Quirk ledger state validation failed for ${quirkLedgerDisplayPath}:`);
    for (const error of quirkLedgerResult.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log(`Quirk ledger state validation passed for ${quirkLedgerDisplayPath}.`);
}
