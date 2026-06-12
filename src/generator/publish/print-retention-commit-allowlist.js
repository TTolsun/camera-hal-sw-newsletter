const { retentionCommitAllowlist } = require('../reporter/review-artifact-inventory');

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
  const paths = retentionCommitAllowlist({
    root: args.root || process.cwd(),
    date: args.date
  });
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
