const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveAospSiteUpdateItems,
  pageDate,
  describesSameMonth,
  MAX_DATE_LOOKUPS
} = require('../../../collect/aosp-site-update-dates');
const { resolveFollowedSourceItems, followedSourceResolverIds } = require('../../../collect/followed-source-item-resolvers');
const { dateQualityForCandidate } = require('../../../common/date-signals');

const SOURCE = Object.freeze({
  id: 'aosp-site-updates',
  name: 'AOSP Site Updates',
  url: 'https://source.android.com/docs/setup/about/site-updates'
});

const TARGET = 'https://source.android.com/docs/compatibility/cts/camera-its-tests';

// 사이트 업데이트 표: 월별 묶음 제목 + 카메라 관련 행 하나.
function indexHtml() {
  return `<html><body>
    <h2>July 2026</h2>
    <table><tr>
      <td><a href="/docs/compatibility">Compatibility</a></td>
      <td>Updated <a href="/docs/compatibility/cts/camera-its-tests">Camera ITS tests</a>
          to add fast-FAIL descriptions to scene0 tests.</td>
    </tr></table>
  </body></html>`;
}

function targetHtml(dateLine = 'Last updated 2026-07-13 UTC.') {
  return `<html><body><main><p>${dateLine}</p><p>Camera ITS test catalogue.</p></main></body></html>`;
}

test('월 정밀도 날짜를 대상 페이지의 일 단위 날짜로 올린다', async () => {
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => targetHtml()
  });

  const item = items.find(entry => entry.url === TARGET);
  assert.equal(item.publishedAt, '2026-07-13');
  assert.equal(item.datePrecision, 'day');
  // 어휘는 date-signals.js 의 DATE_SOURCES 에 있는 값이어야 한다.
  assert.equal(item.date_source, 'visible_last_updated');
  // 표가 말한 월은 근거 추적용으로 남긴다.
  assert.equal(item.site_update_month, '2026-07-01');
});

test('날짜 출처와 함께 신뢰도도 적는다', async () => {
  // 신뢰도를 안 적으면 후보 레코드가 명시적 0 으로 굳히고, dateQualityForCandidate 의
  // 폴백은 0 을 유효한 숫자로 받아 그대로 쓴다 — date_source 가 옳아도 자격이 막힌다.
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => targetHtml()
  });

  const item = items.find(entry => entry.url === TARGET);
  assert.equal(item.date_confidence, 85, 'visible_last_updated 의 신뢰도');

  const quality = dateQualityForCandidate({
    effective_date: item.publishedAt,
    date_source: item.date_source,
    date_confidence: item.date_confidence
  });
  assert.equal(quality.main_article_date_eligible, true);
  assert.equal(quality.needs_editor_date_review, false);
});

test('Last updated 가 없으면 본문 날짜를 쓰고 출처를 visible_date 로 적는다', async () => {
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => targetHtml('Published July 9, 2026.')
  });

  const item = items.find(entry => entry.url === TARGET);
  assert.equal(item.publishedAt, '2026-07-09');
  assert.equal(item.date_source, 'visible_date');
});

test('행이 실린 달을 벗어난 페이지 날짜는 쓰지 않는다', async () => {
  // 페이지의 "Last updated" 는 그 페이지를 아무 이유로든 마지막으로 손댄 날이다.
  // 실측: 2026-03 행 "Buy and set up a Gen2 box" 의 페이지가 2026-08-31 을 말한다.
  // 그 값을 쓰면 몇 달 지난 행이 이번 주 날짜를 얻어 수집 창 안으로 들어온다.
  const diagnostics = [];
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => targetHtml('Last updated 2026-08-31 UTC.'),
    onDiagnostic: event => diagnostics.push(event)
  });

  const item = items.find(entry => entry.url === TARGET);
  assert.equal(item.datePrecision, 'month');
  assert.equal(item.publishedAt, '2026-07-01');
  assert.equal(item.date_source, undefined);
  assert.equal(diagnostics[0].type, 'aosp_site_update_date_outside_row_month');
  assert.match(diagnostics[0].reason, /2026-08-31/);
});

test('같은 달 판정은 연도까지 함께 본다', () => {
  assert.equal(describesSameMonth('2026-07-31', '2026-07-01'), true);
  assert.equal(describesSameMonth('2026-08-01', '2026-07-01'), false);
  // 1년 차이가 나는 같은 달을 통과시키면 안 된다.
  assert.equal(describesSameMonth('2025-07-15', '2026-07-01'), false);
  assert.equal(describesSameMonth('', '2026-07-01'), false);
});

test('페이지에서 날짜를 못 얻으면 항목을 그대로 둔다', async () => {
  // 못 읽은 날짜를 지어내는 것보다 월 정밀도로 남아 참고 레인에 머무는 편이 낫다.
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => '<html><body><main><p>No date here.</p></main></body></html>'
  });

  const item = items.find(entry => entry.url === TARGET);
  assert.equal(item.datePrecision, 'month');
  assert.equal(item.date_source, undefined);
});

test('한 페이지가 실패해도 나머지 후보는 그대로 나간다', async () => {
  const diagnostics = [];
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => { throw new Error('boom'); },
    onDiagnostic: event => diagnostics.push(event)
  });

  assert.ok(items.length > 0);
  assert.equal(items.find(entry => entry.url === TARGET).datePrecision, 'month');
  assert.equal(diagnostics[0].type, 'aosp_site_update_date_lookup_failed');
  assert.match(diagnostics[0].reason, /boom/);
});

test('Error 가 아닌 값이 던져져도 사유를 남긴다', async () => {
  const diagnostics = [];
  await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => { throw 'plain string'; },
    onDiagnostic: event => diagnostics.push(event)
  });
  assert.match(diagnostics[0].reason, /plain string/);
});

test('같은 URL 이 여러 행에 나와도 한 번만 가져온다', async () => {
  let calls = 0;
  await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => { calls += 1; return targetHtml(); }
  });
  assert.equal(calls, 1);
});

test('주입된 fetch 에도 영문판을 강제한다', async () => {
  // 프로덕션은 늘 fetchTextImpl 을 주입한다. hl 을 defaultFetchText 안에만 두면
  // 그 방어가 프로덕션 경로에서 죽는다.
  const asked = [];
  await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async url => { asked.push(String(url)); return targetHtml(); }
  });
  assert.ok(asked.length > 0, '대상 페이지를 가져왔다');
  assert.ok(asked.every(url => url.includes('hl=en')), asked.join(', '));
});

test('Last updated 가 없으면 본문의 첫 날짜를 쓴다', () => {
  // source-monitor 가 스냅샷을 만들 때와 같은 두 추출기, 같은 순서다.
  assert.deepEqual(pageDate(targetHtml('Last updated 2026-07-13 UTC.')),
    { date: '2026-07-13', dateSource: 'visible_last_updated' });
  assert.deepEqual(pageDate('<main><p>Published June 2, 2026.</p></main>'),
    { date: '2026-06-02', dateSource: 'visible_date' });
  // 월까지만 적힌 페이지는 날짜를 주지 않는다.
  assert.deepEqual(pageDate('<main><p>Last updated July 2026.</p></main>'),
    { date: '', dateSource: '' });
});

test('리졸버가 followed-source 레지스트리에 등록돼 있다', async () => {
  assert.ok(followedSourceResolverIds().includes('aosp-site-updates'));

  const items = await resolveFollowedSourceItems(SOURCE, {
    text: indexHtml(),
    fetchTextImpl: async () => targetHtml()
  });
  assert.equal(items.find(entry => entry.url === TARGET).publishedAt, '2026-07-13');
});

test('fetch 상한은 표 파서 상한과 같다', () => {
  // 표가 커져도 fetch 가 파서 출력 상한보다 늘지 않아야 한다.
  assert.equal(MAX_DATE_LOOKUPS, 12);
});
