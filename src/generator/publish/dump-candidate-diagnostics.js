const fs = require('fs');
const path = require('path');

const { parseArgs, resolveDate, validateDate } = require('./report-cli-date');
const {
  backfillCandidateDiagnostics,
  backfillDates
} = require('../diagnostics/candidate-diagnostics-backfill');

const DEFAULT_OUT_DIR = path.join('.tmp', 'candidate-diagnostics');

function usage() {
  return [
    'Usage: node src/generator/publish/dump-candidate-diagnostics.js [--date YYYY-MM-DD | --all] [--out-dir DIR]',
    '',
    '커밋된 후보 풀에 현재 선정 로직을 다시 돌려 후보별 진단을 덤프한다.',
    '발행 아티팩트를 고치지 않는다 — 출력은 --out-dir(기본 .tmp/candidate-diagnostics)에만 쓴다.',
    '',
    'Date priority: --date, NEWSLETTER_DATE, .tmp/newsletter-date.txt, today KST.'
  ].join('\n');
}

function outPathFor(root, outDir, date) {
  return path.join(path.isAbsolute(outDir) ? outDir : path.join(root, outDir), `${date}.json`);
}

function dumpOne(root, outDir, date) {
  validateDate(date);
  const payload = backfillCandidateDiagnostics({ root, date });
  const outPath = outPathFor(root, outDir, date);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { payload, outPath };
}

// 이 CLI만 쓰는 인자를 떼어 내고 나머지를 공용 parseArgs에 넘긴다. 공용 파서는 모르는 인자를
// 던지므로(오타를 조용히 삼키지 않으려는 의도) 여기서 먼저 걷어내야 한다.
function extractOwnArgs(argv) {
  const rest = [];
  let all = false;
  let outDir = DEFAULT_OUT_DIR;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') {
      all = true;
    } else if (arg === '--out-dir') {
      outDir = argv[index + 1] || DEFAULT_OUT_DIR;
      index += 1;
    } else if (arg.startsWith('--out-dir=')) {
      outDir = arg.slice('--out-dir='.length) || DEFAULT_OUT_DIR;
    } else {
      rest.push(arg);
    }
  }
  return { all, outDir, rest };
}

function main(argv = process.argv.slice(2), env = process.env, root = process.cwd()) {
  const { all, outDir, rest } = extractOwnArgs(argv);
  const options = parseArgs(rest);
  if (options.help) {
    console.log(usage());
    return 0;
  }

  const dates = all ? backfillDates(root) : [resolveDate(options, env, root)];
  if (dates.length === 0) {
    console.warn('덤프할 날짜가 없다 — articles/content/collected-news 에 후보 풀 아티팩트가 없다.');
    return 0;
  }

  let failed = 0;
  for (const date of dates) {
    try {
      const { payload, outPath } = dumpOne(root, outDir, date);
      console.log(
        `${date} (${payload.weekly_key || 'no issue'}): 진단 ${payload.candidate_diagnostics_count}행`
        + `, 미평가 ${payload.candidate_diagnostics_not_evaluated ?? '?'}건`
        + ` → ${path.relative(root, outPath).split(path.sep).join('/')}`
      );
    } catch (error) {
      // --all 은 과거 전체를 훑는다. 한 날짜가 깨져도 나머지를 덤프한다 —
      // 백필은 발행 경로가 아니므로 한 건의 실패가 전체를 막을 이유가 없다.
      failed += 1;
      console.warn(`${date}: 건너뜀 — ${error.message}`);
    }
  }
  if (failed > 0) console.warn(`건너뛴 날짜 ${failed}건.`);
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

module.exports = { main, usage, extractOwnArgs, DEFAULT_OUT_DIR };
