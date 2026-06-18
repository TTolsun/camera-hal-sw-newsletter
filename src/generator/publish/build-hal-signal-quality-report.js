const path = require('path');

const { parseArgs, resolveDate, validateDate } = require('./report-cli-date');
const {
  writeHalSignalQualityArtifacts
} = require('../diagnostics/hal-signal-quality-report');

function usage() {
  return [
    'Usage: node src/generator/publish/build-hal-signal-quality-report.js [--date YYYY-MM-DD]',
    '',
    'Date priority: --date, NEWSLETTER_DATE, .tmp/newsletter-date.txt, today KST.'
  ].join('\n');
}

function main(argv = process.argv.slice(2), env = process.env, root = process.cwd()) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const date = resolveDate(options, env, root);
  const result = writeHalSignalQualityArtifacts({ root, date });
  console.log(`Wrote ${path.relative(root, result.jsonPath).replace(/\\/g, '/')}`);
  console.log(`Wrote ${path.relative(root, result.markdownPath).replace(/\\/g, '/')}`);
  if (result.report.status !== 'PASS') {
    console.warn(`HAL signal quality status: ${result.report.status}`);
  }
  if (result.report.warnings.length > 0) {
    console.warn(`HAL signal quality warnings: ${result.report.warnings.length}`);
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
