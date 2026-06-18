// 리뷰용 리포트 CLI(build-evidence-pack-summary, build-hal-signal-quality-report,
// build-source-effectiveness-report, build-source-quality-diagnosis)가 공유하는
// --date 인자 파싱과 newsletter 날짜 해석 헬퍼입니다.
//
// 네 CLI 모두 동일한 인자(--date / --date= / --help / -h)와 동일한 날짜 우선순위
// (--date, NEWSLETTER_DATE, .tmp/newsletter-date.txt, today KST)를 쓰므로 한곳에 모읍니다.
// 각 CLI는 자기 usage() 문구와 main()만 따로 가집니다.

const fs = require('fs');
const path = require('path');
const { kstDate } = require('../../shared/common/common');

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

module.exports = {
  parseArgs,
  resolveDate,
  validateDate
};
