// 오케스트레이터 맨 앞에서 이번 실행의 대상 호가 main에 이미 발행돼 있는지 판정한다(#1167).
//
// 03 단계의 PR 생성 차단(#1160)만으로는 부족했다. 그보다 앞의 수집(01)·탐색(02) 단계가 auto mode에서
// 입력 산출물을 main에 직접 push하므로, 이미 발행된 호로 다시 돌면 그 호의 입력이 덮인다. 실제로
// 2026-09-19에 W39를 발행한 뒤 09-21 예약 실행이 같은 날짜의 입력 21개 파일을 덮었다.
//
// 판정은 #1160과 같은 코드로 한다(alreadyPublishedIssueAtHead, isRepublishBlocked). 날짜는 collect와
// 같은 식으로 정한다 — NEWSLETTER_DATE가 있으면 그 값, 없으면 오늘 KST
// (collect-news-candidates.js의 `runtimeConfig.newsletterDate || kstDate()`, runtime-config.js가 trim).
// 식이 다르면 가드와 collect가 서로 다른 호를 본다.
//
// 막히면 exit 1로 끝낸다. 03 단계가 재발행을 막을 때와 같이 실행을 빨간불로 남겨, 사람이 알아채게 한다.

const { kstDate } = require('../../shared/common/common');
const { isTrue } = require('../../shared/common/value-coercion');
const {
  alreadyPublishedIssueAtHead,
  isRepublishBlocked
} = require('./resolve-reviewable-artifacts');

function checkAlreadyPublishedIssue({ root = process.cwd(), env = process.env, today = kstDate } = {}) {
  const date = String(env.NEWSLETTER_DATE || '').trim() || today();
  const { status, matched } = alreadyPublishedIssueAtHead(root, date);
  const allowRepublish = isTrue(env.NEWSLETTER_ALLOW_REPUBLISH);
  return {
    date,
    status,
    matched,
    allowRepublish,
    blocked: isRepublishBlocked(status, allowRepublish)
  };
}

function describe(result) {
  if (result.blocked && result.status === 'check_failed') {
    return `Blocked (#1167): could not check whether ${result.date} is already published on main, `
      + 'so collect, discovery and generate are skipped.';
  }
  if (result.blocked) {
    return `Blocked as a republish (#1167): ${result.date} is already published on main (${result.matched.join(', ')}). `
      + 'Collect, discovery and generate are skipped, so nothing overwrites the published inputs. '
      + 'Re-run with allow_republish=true only if you intend to replace the published issue.';
  }
  if (result.status === 'check_failed') {
    return `Republish allowed: could not check whether ${result.date} is already published on main, but allow_republish is on.`;
  }
  if (result.status === 'published') {
    return `Republish allowed: ${result.date} is already published on main, but allow_republish is on.`;
  }
  return `Not published yet: ${result.date}. The run continues.`;
}

function main(options) {
  const result = checkAlreadyPublishedIssue(options);
  console.log(describe(result));
  return result.blocked ? 1 : 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { checkAlreadyPublishedIssue, describe, main };
