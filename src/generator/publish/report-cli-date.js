// 리뷰용 리포트 CLI(build-evidence-pack-summary, build-hal-signal-quality-report,
// build-source-effectiveness-report, build-source-followup-issues,
// build-source-quality-diagnosis, dump-candidate-diagnostics)가 공유하는
// --date 인자 파싱과 newsletter 날짜 해석 헬퍼입니다.
//
// 여섯 CLI 모두 동일한 인자(--date / --date= / --help / -h)와 동일한 날짜 우선순위
// (--date, NEWSLETTER_DATE, .tmp/newsletter-date.txt, today KST)를 쓰므로 한곳에 모읍니다.
// 각 CLI는 자기 usage() 문구와 main()만 따로 가집니다. 자기만의 플래그(--dry-run,
// --skip-if-present)는 각 CLI가 argv에서 먼저 걷어낸 뒤 나머지를 이 파서에 넘깁니다.

const fs = require('fs');
const path = require('path');
const { kstDate } = require('../../shared/common/common');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      // 값이 없거나 값 자리에 다른 플래그가 오면 빈 값으로 넘기지 않고 여기서 멈춥니다.
      // 빈 값은 resolveDate가 env·.tmp·오늘 날짜로 조용히 대체하므로, 잘못된 회차 폴더에
      // 리포트를 쓰고도 성공으로 끝나기 때문입니다. 워크플로가 넘기는 빈 문자열 토큰
      // (--date "")은 값이 있는 것으로 보고 기존 fallback 경로를 그대로 탑니다.
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error('Missing value for --date');
      }
      options.date = value;
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

module.exports = {
  parseArgs,
  resolveDate,
  validateDate
};
