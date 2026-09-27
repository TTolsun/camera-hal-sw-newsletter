const fs = require('fs');
const { retentionCommitPlan } = require('./review-artifact-inventory');

function usage() {
  console.error('Usage: node src/generator/publish/print-retention-commit-allowlist.js --date YYYY-MM-DD [--root /path/to/repo]');
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--date' && argv[i + 1]) {
      args.date = argv[++i];
    } else if (argv[i] === '--root' && argv[i + 1]) {
      args.root = argv[++i];
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.date) usage();
  const { paths, excludedPublicPaths } = retentionCommitPlan({
    root: args.root || process.cwd(),
    date: args.date
  });
  // #1189: stdout은 add-paths로 쓰이므로 경로만 싣는다. 뺀 공개 경로는 그 파일을 쓴 생산자가 진단 전용
  // 계약을 어겼다는 단서라 조용히 넘기지 않고 로그와 run summary에 남긴다. PR 생성은 막지 않는다.
  if (excludedPublicPaths.length > 0) {
    const message = `Public page paths dropped from the diagnostics-only pull request for date=${args.date} ` +
      '(generation status records public_output_expected: false). A step wrote public pages on a run that ' +
      'publishes nothing; find and fix that producer:';
    console.error(`WARNING: ${message}\n${excludedPublicPaths.map(p => `  - ${p}`).join('\n')}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `\n### Public pages dropped from the pull request\n\n${message}\n\n` +
        `${excludedPublicPaths.map(p => `- \`${p}\``).join('\n')}\n`, 'utf8');
    }
  }
  if (paths.length === 0) {
    console.error(`ERROR: retention commit allowlist resolved to zero paths for date=${args.date}. ` +
      'This would cause peter-evans/create-pull-request to stage ALL changes. Aborting.');
    process.exit(1);
  }
  for (const p of paths) {
    process.stdout.write(p + '\n');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
