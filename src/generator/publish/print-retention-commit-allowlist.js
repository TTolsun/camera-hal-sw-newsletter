const fs = require('fs');
const { execFileSync } = require('child_process');
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

function changedSinceHead(root, relPaths) {
  try {
    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...relPaths], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const changed = new Set(output.split(/\r?\n/).filter(Boolean).map(line => line.slice(3).trim()));
    return { measured: true, paths: relPaths.filter(relPath => changed.has(relPath)) };
  } catch (_) {
    return { measured: false, paths: relPaths };
  }
}

// #1189: 빼는 것은 디스크 존재 기준이지만(안전 쪽), 보고는 HEAD와 다른 경로로 좁힌다. main에 이미 있는
// 주간 페이지·sitemap은 진단 전용 실행에서도 디스크에 있어서, 존재만으로 경고하면 매번 "생산자가 썼다"는
// 오경보가 난다. 실제로 바뀐 공개 경로는 그 파일을 쓴 생산자가 진단 전용 계약을 어겼다는 단서라 조용히
// 넘기지 않고 로그와 run summary에 남긴다. PR 생성은 막지 않는다.
function reportDroppedPublicPages(root, date, excludedPublicPaths) {
  if (excludedPublicPaths.length === 0) return;
  const { measured, paths } = changedSinceHead(root, excludedPublicPaths);
  if (paths.length === 0) return;
  const message = measured
    ? `Public page paths changed on a diagnostics-only run for date=${date} (generation status records ` +
      'public_output_expected: false) and were dropped from the pull request. A step wrote public pages on a ' +
      'run that publishes nothing; find and fix that producer:'
    : `Public page paths present on disk were dropped from the diagnostics-only pull request for date=${date} ` +
      '(generation status records public_output_expected: false). git could not tell whether they changed:';
  console.error(`WARNING: ${message}\n${paths.map(p => `  - ${p}`).join('\n')}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\n### Public pages dropped from the pull request\n\n${message}\n\n` +
      `${paths.map(p => `- \`${p}\``).join('\n')}\n`, 'utf8');
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.date) usage();
  const root = args.root || process.cwd();
  // stdout은 add-paths로 쓰이므로 경로만 싣는다. 뺀 공개 경로 보고는 stderr와 run summary로 간다.
  const { paths, excludedPublicPaths } = retentionCommitPlan({ root, date: args.date });
  reportDroppedPublicPages(root, args.date, excludedPublicPaths);
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
