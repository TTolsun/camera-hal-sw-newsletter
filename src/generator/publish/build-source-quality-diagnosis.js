const fs = require('fs');
const path = require('path');

const {
  kstDate
} = require('../../core/common/common');
const {
  writeSourceQualityDiagnosisArtifacts
} = require('../render/source-quality-diagnosis');

function usage() {
  return [
    'Usage: node scripts/build-source-quality-diagnosis.js [--date YYYY-MM-DD]',
    '',
    'Date priority: --date, NEWSLETTER_DATE, .tmp/newsletter-date.txt, today KST.'
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      options.date = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--date=')) {
      options.date = arg.slice('--date='.length);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    throw new Error(`Newsletter date must use YYYY-MM-DD, found: ${date || '(empty)'}`);
  }
  return date;
}

function resolveDate(options = {}, env = process.env, root = process.cwd()) {
  if (options.date) return validateDate(String(options.date).trim());
  if (env.NEWSLETTER_DATE) return validateDate(String(env.NEWSLETTER_DATE).trim());
  const datePath = path.join(root, '.tmp', 'newsletter-date.txt');
  if (fs.existsSync(datePath)) {
    const date = fs.readFileSync(datePath, 'utf8').trim();
    if (date) return validateDate(date);
  }
  return kstDate();
}

function main(argv = process.argv.slice(2), env = process.env, root = process.cwd()) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const date = resolveDate(options, env, root);
  const result = writeSourceQualityDiagnosisArtifacts({ root, date });
  console.log(`Wrote ${path.relative(root, result.jsonPath).replace(/\\/g, '/')}`);
  console.log(`Wrote ${path.relative(root, result.markdownPath).replace(/\\/g, '/')}`);
  if (result.report.warnings.length > 0) {
    console.warn(`Source quality diagnosis warnings: ${result.report.warnings.length}`);
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(1);
  }
}

module.exports = {
  main,
  parseArgs,
  resolveDate,
  validateDate
};
