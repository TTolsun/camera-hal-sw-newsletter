const path = require('path');

const { parseArgs, resolveDate, validateDate } = require('./report-cli-date');
const {
  FOLLOWUP_CONSECUTIVE_RUNS,
  buildSourceFollowupIssues,
  renderSourceFollowupIssuesMarkdown,
  writeSourceFollowupIssueArtifacts
} = require('../diagnostics/source-followup-issues');

function usage() {
  return [
    'Usage: node src/generator/publish/build-source-followup-issues.js [--date YYYY-MM-DD] [--dry-run]',
    '',
    'Reads the committed source-quality-diagnosis.json of this run and the runs before it,',
    'and writes issue drafts for sources whose recommendation has stuck for',
    `${FOLLOWUP_CONSECUTIVE_RUNS} consecutive runs.`,
    '',
    'This writes drafts only. It creates no GitHub issue and changes no publish decision.',
    '',
    '--dry-run: print the same drafts to stdout and write no file.',
    '',
    'Date priority: --date, NEWSLETTER_DATE, .tmp/newsletter-date.txt, today KST.'
  ].join('\n');
}

function main(argv = process.argv.slice(2), env = process.env, root = process.cwd()) {
  // --dry-run은 이 CLI만 받는다. 공유 파서(report-cli-date)는 --date만 다루고 CLI 여섯 개가
  // 함께 쓰므로, 거기에 넣으면 파일을 쓰는 나머지 CLI도 이 플래그를 조용히 받아들이게 된다.
  // 나머지 인자는 그대로 넘겨 알 수 없는 인자를 던지는 동작을 유지한다.
  const dryRun = argv.includes('--dry-run');
  const options = parseArgs(argv.filter(arg => arg !== '--dry-run'));
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const date = resolveDate(options, env, root);
  if (dryRun) {
    // 쓰기 경로와 같은 report에서 같은 markdown을 만든다.
    console.log(renderSourceFollowupIssuesMarkdown(buildSourceFollowupIssues({ root, date })));
    return 0;
  }
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
