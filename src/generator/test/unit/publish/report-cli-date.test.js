'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { parseArgs, resolveDate } = require('../../../publish/report-cli-date');

// 공유 파서는 CLI 여섯 개가 같이 쓴다. --date 값 자리에 다른 플래그가 오거나 값이 아예 없으면
// 예전에는 빈 값으로 넘어가 resolveDate가 오늘 날짜로 조용히 떨어졌다. 그러면 워크플로가
// 잘못된 회차 폴더에 리포트를 쓰고도 성공으로 끝난다(#479 코멘트가 남긴 별건).

test('report-cli-date: --date가 마지막 인자면 값 누락으로 거부한다 (#479)', () => {
  assert.throws(() => parseArgs(['--date']), /Missing value for --date/);
});

test('report-cli-date: --date 값 자리에 플래그가 오면 거부한다 (#479)', () => {
  // 호출부가 자기 플래그를 먼저 걷어내면 --date가 마지막이 되고, 걷어내지 않으면 다음 토큰이
  // 플래그다. 두 경우 모두 값이 아니다.
  assert.throws(() => parseArgs(['--date', '--help']), /Missing value for --date/);
  assert.throws(() => parseArgs(['--date', '--skip-if-present']), /Missing value for --date/);
});

// 빈 문자열 토큰(--date "")은 값이 "있되 비어 있는" 것이라 env·.tmp·오늘 KST 순서의 fallback이
// 예전과 같이 살아 있어야 한다. 워크플로는 날짜를 항상 채워서 넘기므로 이 경로에 기대는 스텝은
// 없지만, 값 누락 검사가 기존 호출 형태를 바꾸지 않는다는 것을 여기서 잠근다.
test('report-cli-date: 빈 문자열 토큰은 기존대로 fallback 경로로 간다', () => {
  assert.deepEqual(parseArgs(['--date', '']), { date: '' });
  assert.equal(resolveDate({ date: '' }, { NEWSLETTER_DATE: '2026-09-07' }, 'C:/no-such-root'), '2026-09-07');
});

test('report-cli-date: 정상 인자 형태는 그대로 파싱한다', () => {
  assert.deepEqual(parseArgs(['--date', '2026-09-07']), { date: '2026-09-07' });
  assert.deepEqual(parseArgs(['--date=2026-09-07']), { date: '2026-09-07' });
  assert.deepEqual(parseArgs(['--help']), { help: true });
  assert.deepEqual(parseArgs(['-h']), { help: true });
  assert.throws(() => parseArgs(['--no-such-flag']), /Unknown argument: --no-such-flag/);
});
