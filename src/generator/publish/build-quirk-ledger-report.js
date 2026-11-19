const fs = require('fs');
const path = require('path');

const { parseArgs, resolveDate, validateDate } = require('./report-cli-date');
const { coverageForAnchorDate } = require('../../shared/common/coverage-week');
const { fetchText } = require('../../shared/collect/linked-release-note-evidence');
const { newsroomDir } = require('../../shared/common/artifact-paths');
const {
  buildQuirkLedgerReport,
  renderQuirkLedgerMarkdown
} = require('../diagnostics/quirk-ledger');
const {
  mergeQuirkLedgerState,
  readQuirkLedgerState,
  writeQuirkLedgerState
} = require('../diagnostics/quirk-ledger-state');

// 기기 우회 장부 shadow 보고서 CLI. 공개 렌더링에는 아무것도 넣지 않고, 어떤 조회 실패도 진단으로만 남긴다
// (목록을 못 읽어도 보고서는 status failed로 쓰고 종료 코드 0). 발행 흐름이 이 단계에 기대지 않는다.

function usage() {
  return [
    'Usage: node src/generator/publish/build-quirk-ledger-report.js [--date YYYY-MM-DD] [--since YYYY-MM-DD --until YYYY-MM-DD]',
    '',
    'Date priority: --date, NEWSLETTER_DATE, .tmp/newsletter-date.txt, today KST.',
    'Window: the coverage week of the run date (COVERAGE_WEEK_KEY overrides). --since/--until set a manual UTC window (both inclusive).'
  ].join('\n');
}

// 이 CLI만의 플래그를 먼저 걷어내고 나머지를 공용 파서에 넘긴다(report-cli-date.js 머리 주석 참고).
function splitWindowFlags(argv) {
  const rest = [];
  const window = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--since' || arg === '--until') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      window[arg.slice(2)] = validateDate(value);
      index += 1;
    } else {
      rest.push(arg);
    }
  }
  if (Boolean(window.since) !== Boolean(window.until)) throw new Error('--since and --until must be given together');
  return { rest, window };
}

function resolveWindow(date, explicit, env) {
  if (explicit.since) {
    if (explicit.since > explicit.until) throw new Error('--since must not be after --until');
    return { start_date: explicit.since, end_date: explicit.until, source: 'explicit' };
  }
  const coverage = coverageForAnchorDate(date, env.COVERAGE_WEEK_KEY || '');
  return { start_date: coverage.coverage_start_date, end_date: coverage.coverage_end_date, source: 'coverage_week' };
}

async function main(argv = process.argv.slice(2), env = process.env, root = process.cwd(), { fetchTextImpl = fetchText, now = new Date() } = {}) {
  const { rest, window: explicitWindow } = splitWindowFlags(argv);
  const options = parseArgs(rest);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const date = resolveDate(options, env, root);
  const window = resolveWindow(date, explicitWindow, env);

  const report = await buildQuirkLedgerReport({ date, window, fetchTextImpl, now });

  const targetDir = newsroomDir(root, date);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'quirk-ledger-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'quirk-ledger-report.md'), renderQuirkLedgerMarkdown(report), 'utf8');
  console.log(`Wrote quirk-ledger-report for ${date} (window ${window.start_date}..${window.end_date}, status ${report.status}, entries ${report.counts.entries}).`);

  if (report.status === 'ok') {
    const state = mergeQuirkLedgerState(readQuirkLedgerState(root).entries, report);
    writeQuirkLedgerState(root, state);
    console.log(`Updated state/quirk-ledger.json (${state.entries.length} entries).`);
  } else {
    console.warn(`Quirk ledger not updated: ${report.diagnostics.map(item => item.message).join('; ')}`);
  }
  return 0;
}

if (require.main === module) {
  main().then(code => process.exit(code), error => {
    console.error(error.message);
    console.error(usage());
    process.exit(1);
  });
}

module.exports = { main, resolveWindow, splitWindowFlags };
