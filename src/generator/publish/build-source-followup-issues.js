const path = require('path');

const { parseArgs, resolveDate, validateDate } = require('./report-cli-date');
const {
  FOLLOWUP_CONSECUTIVE_RUNS,
  writeSourceFollowupIssueArtifacts
} = require('../diagnostics/source-followup-issues');

function usage() {
  return [
    'Usage: node src/generator/publish/build-source-followup-issues.js [--date YYYY-MM-DD]',
    '',
    'Reads the committed source-quality-diagnosis.json of this run and the runs before it,',
    'and writes issue drafts for sources whose recommendation has stuck for',
    `${FOLLOWUP_CONSECUTIVE_RUNS} consecutive runs.`,
    '',
    'This writes drafts only. It creates no GitHub issue and changes no publish decision.',
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
  const result = writeSourceFollowupIssueArtifacts({ root, date });
  console.log(`Wrote ${path.relative(root, result.jsonPath).replace(/\\/g, '/')}`);
  console.log(`Wrote ${path.relative(root, result.markdownPath).replace(/\\/g, '/')}`);
  console.log(`Follow-up issue drafts: ${result.report.items.length}`);
  if (result.report.warnings.length > 0) {
    console.warn(`Source follow-up warnings: ${result.report.warnings.length}`);
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
